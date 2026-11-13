/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dns from 'dns/promises';
import net from 'net';

const MAX_XML_BYTES = 20 * 1024 * 1024; // 20 MB
const FETCH_TIMEOUT_MS = 15000; // 15s
const MAX_REDIRECTS = 5;

export class XmlProxyError extends Error {
  public readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function isPrivateOrReservedIp(ipRaw: string): boolean {
  const ip = ipRaw.trim().toLowerCase();
  if (!ip) return true;

  // Handle IPv4-mapped IPv6 addresses like ::ffff:127.0.0.1 or ::ffff:7f00:1
  if (ip.startsWith('::ffff:')) {
    const rest = ip.slice('::ffff:'.length);
    if (net.isIPv4(rest)) {
      return isPrivateOrReservedIp(rest);
    }
    const hexParts = rest.split(':');
    if (hexParts.length === 2) {
      const high = parseInt(hexParts[0], 16);
      const low = parseInt(hexParts[1], 16);
      if (!Number.isNaN(high) && !Number.isNaN(low)) {
        const ipv4 = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
        return isPrivateOrReservedIp(ipv4);
      }
    }
  }

  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map((n) => parseInt(n, 10));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b, c] = parts;

    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
    if (a === 127) return true; // 127.0.0.0/8 (loopback)
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local & cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // 192.0.0.0/24, 192.0.2.0/24
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
    if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
    if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
    if (a >= 224) return true; // Multicast & reserved
    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.split('%')[0];
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // Unique local fc00::/7
    if (
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    ) {
      return true; // Link-local fe80::/10
    }
    return false;
  }

  return true;
}

export async function validateSafeExternalUrl(rawUrl: string): Promise<URL> {
  const trimmed = (rawUrl || '').trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new XmlProxyError(400, 'Некоректний формат URL-посилання. Приклад: https://example.com/feed.xml');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new XmlProxyError(400, 'Дозволено лише протоколи http:// або https://.');
  }

  if (parsed.username || parsed.password) {
    throw new XmlProxyError(400, 'URL не повинен містити вбудованих логінів/паролів.');
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  ) {
    throw new XmlProxyError(403, 'Запит до локальних або внутрішніх адрес заблоковано політикою безпеки (SSRF).');
  }

  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new XmlProxyError(403, 'Запит до приватної або зарезервованої IP-адреси заблоковано (SSRF).');
    }
    return parsed;
  }

  try {
    const records = await dns.lookup(host, { all: true });
    if (!records || records.length === 0) {
      throw new XmlProxyError(502, `Не вдалося знайти домен "${host}". Перевірте правильність адреси.`);
    }
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        throw new XmlProxyError(403, 'Домен веде на приватну або локальну мережу — доступ заблоковано (SSRF).');
      }
    }
  } catch (err: any) {
    if (err instanceof XmlProxyError) throw err;
    throw new XmlProxyError(502, `Не вдалося визначити адресу сервера "${host}". Перевірте посилання.`);
  }

  return parsed;
}

function decodeXmlBuffer(buffer: Buffer, contentTypeHeader: string): string {
  // Peek ASCII prefix for XML encoding declaration
  const headAscii = buffer.subarray(0, 300).toString('latin1').toLowerCase();
  const ctLower = (contentTypeHeader || '').toLowerCase();

  let charset = 'utf-8';
  const xmlEncMatch = headAscii.match(/encoding\s*=\s*["']([^"']+)["']/i);
  const ctCharsetMatch = ctLower.match(/charset\s*=\s*([^\s;]+)/i);
  const detected = (xmlEncMatch?.[1] || ctCharsetMatch?.[1] || '').trim().toLowerCase();

  if (detected === 'windows-1251' || detected === 'cp1251' || detected === 'win-1251') {
    charset = 'windows-1251';
  }

  try {
    const decoder = new TextDecoder(charset);
    return decoder.decode(buffer).replace(/^\uFEFF/, '');
  } catch {
    return buffer.toString('utf8').replace(/^\uFEFF/, '');
  }
}

export async function fetchExternalXmlFeed(rawUrl: string): Promise<{
  xml: string;
  finalUrl: string;
  contentType: string;
  sizeBytes: number;
}> {
  let currentUrl = await validateSafeExternalUrl(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let response: Response | null = null;
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
      response = await fetch(currentUrl.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'application/xml, text/xml, application/rss+xml, text/plain, */*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (compatible; EpicentrPIM-FeedFetcher/1.0)',
          'Accept-Language': 'uk-UA,uk;q=0.9,en;q=0.8'
        }
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new XmlProxyError(502, `Віддалений сервер повернув порожній редірект (${response.status}).`);
        }
        const resolvedNext = new URL(location, currentUrl).toString();
        currentUrl = await validateSafeExternalUrl(resolvedNext);
        continue;
      }
      break;
    }

    if (!response) {
      throw new XmlProxyError(502, 'Віддалений сервер не відповів.');
    }

    if (response.status >= 300 && response.status < 400) {
      throw new XmlProxyError(502, 'Занадто багато перенаправлень (Redirects) на віддаленому сервері.');
    }

    if (!response.ok) {
      if (response.status === 403) {
        throw new XmlProxyError(
          502,
          'Віддалений сервер відхилив запит (HTTP 403 Forbidden — можливо спрацював захист Cloudflare або доступ обмежено за IP).'
        );
      }
      if (response.status === 404) {
        throw new XmlProxyError(422, 'Файл фіду не знайдено за вказаним посиланням (HTTP 404).');
      }
      throw new XmlProxyError(502, `Віддалений сервер повернув помилку HTTP ${response.status}.`);
    }

    const declaredLength = Number(response.headers.get('content-length') || '0');
    if (declaredLength > MAX_XML_BYTES) {
      throw new XmlProxyError(
        413,
        `Розмір XML-фіду перевищує ліміт 20 МБ (${(declaredLength / (1024 * 1024)).toFixed(1)} МБ). Завантажте файл локально через вкладку «Файл (.xml, .yml)».`
      );
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > MAX_XML_BYTES) {
            await reader.cancel().catch(() => {});
            throw new XmlProxyError(
              413,
              'Розмір XML-фіду перевищує ліміт 20 МБ. Завантажте файл локально через вкладку «Файл (.xml, .yml)».'
            );
          }
          chunks.push(value);
        }
      }
    } else {
      const ab = await response.arrayBuffer();
      if (ab.byteLength > MAX_XML_BYTES) {
        throw new XmlProxyError(413, 'Розмір XML-фіду перевищує ліміт 20 МБ.');
      }
      totalBytes = ab.byteLength;
      chunks.push(new Uint8Array(ab));
    }

    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const contentType = response.headers.get('content-type') || 'text/xml';
    const xmlText = decodeXmlBuffer(buffer, contentType).trim();

    if (!xmlText) {
      throw new XmlProxyError(422, 'Віддалений сервер повернув порожній файл.');
    }

    const headLower = xmlText.slice(0, 600).toLowerCase();
    if (
      headLower.startsWith('<!doctype html') ||
      headLower.startsWith('<html') ||
      headLower.includes('<head>') ||
      headLower.includes('just a moment...') ||
      headLower.includes('attention required! | cloudflare')
    ) {
      throw new XmlProxyError(
        422,
        'Сервер постачальника повернув HTML-сторінку замість XML (перевірте посилання або захист Cloudflare/авторизацію).'
      );
    }

    if (!xmlText.includes('<')) {
      throw new XmlProxyError(422, 'Отриманий файл не є валідним XML/YML-документом.');
    }

    return {
      xml: xmlText,
      finalUrl: currentUrl.toString(),
      contentType,
      sizeBytes: totalBytes
    };
  } catch (err: any) {
    if (err instanceof XmlProxyError) throw err;
    if (err?.name === 'AbortError' || String(err?.message || '').toLowerCase().includes('aborted')) {
      throw new XmlProxyError(504, 'Перевищено час очікування відповіді від віддаленого сервера (15 сек).');
    }
    throw new XmlProxyError(502, `Не вдалося підключитись до віддаленого сервера: ${err?.message || 'помилка мережі'}`);
  } finally {
    clearTimeout(timeout);
  }
}
