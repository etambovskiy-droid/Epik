/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GmailUserProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  unread: boolean;
  labels: string[];
}

export interface SendEmailPayload {
  to: string;
  subject: string;
  bodyText: string;
  cc?: string;
}

const GMAIL_BASE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Base64url encode utf-8 string safely in browser
 */
function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64url decode string safely in browser
 */
function fromBase64Url(base64Url: string): string {
  try {
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

/**
 * Build RFC 2822 email string
 */
function buildRfc2822Email(payload: SendEmailPayload): string {
  const { to, subject, bodyText, cc } = payload;
  // RFC 2047 encoded-word for UTF-8 Subject to avoid Cyrillic header corruption
  const encodedSubject = `=?UTF-8?B?${btoa(
    unescape(encodeURIComponent(subject))
  )}?=`;

  const headers = [
    `To: ${to.trim()}`,
    cc ? `Cc: ${cc.trim()}` : null,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit'
  ]
    .filter(Boolean)
    .join('\r\n');

  return `${headers}\r\n\r\n${bodyText}`;
}

export class GmailService {
  /**
   * Fetch current authenticated user's Gmail profile
   */
  static async getProfile(accessToken: string): Promise<GmailUserProfile> {
    const res = await fetch(`${GMAIL_BASE_URL}/profile`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(
        errJson?.error?.message ||
          `Помилка отримання профілю Gmail (${res.status} ${res.statusText})`
      );
    }

    return await res.json();
  }

  /**
   * List recent messages
   */
  static async listMessages(
    accessToken: string,
    query = '',
    maxResults = 15
  ): Promise<{ messages: GmailMessageSummary[]; nextPageToken?: string }> {
    const url = new URL(`${GMAIL_BASE_URL}/messages`);
    url.searchParams.set('maxResults', String(maxResults));
    if (query.trim()) {
      url.searchParams.set('q', query.trim());
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(
        errJson?.error?.message ||
          `Помилка завантаження списку листів (${res.status} ${res.statusText})`
      );
    }

    const data = await res.json();
    const rawList: Array<{ id: string; threadId: string }> = data.messages || [];

    // Fetch details for the top items in parallel
    const summaries: GmailMessageSummary[] = await Promise.all(
      rawList.map(async (item) => {
        try {
          return await GmailService.getMessage(accessToken, item.id);
        } catch {
          return {
            id: item.id,
            threadId: item.threadId,
            snippet: '',
            from: 'Невідомий',
            to: '',
            subject: 'Лист',
            date: '',
            unread: false,
            labels: []
          };
        }
      })
    );

    return {
      messages: summaries,
      nextPageToken: data.nextPageToken
    };
  }

  /**
   * Get single message by ID
   */
  static async getMessage(
    accessToken: string,
    messageId: string
  ): Promise<GmailMessageSummary> {
    const res = await fetch(
      `${GMAIL_BASE_URL}/messages/${messageId}?format=full`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json'
        }
      }
    );

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(
        errJson?.error?.message ||
          `Помилка отримання листа ID ${messageId} (${res.status})`
      );
    }

    const msg = await res.json();
    const headers: Array<{ name: string; value: string }> =
      msg.payload?.headers || [];

    const getHeader = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const labelIds: string[] = msg.labelIds || [];
    const isUnread = labelIds.includes('UNREAD');

    return {
      id: msg.id,
      threadId: msg.threadId,
      snippet: msg.snippet || '',
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject') || '(Без теми)',
      date: getHeader('Date'),
      unread: isUnread,
      labels: labelIds
    };
  }

  /**
   * Send email using Gmail API (Mutating action - MUST be confirmed in UI first)
   */
  static async sendEmail(
    accessToken: string,
    payload: SendEmailPayload
  ): Promise<{ id: string; threadId: string; labelIds: string[] }> {
    const rfcMessage = buildRfc2822Email(payload);
    const raw = toBase64Url(rfcMessage);

    const res = await fetch(`${GMAIL_BASE_URL}/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ raw })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(
        errJson?.error?.message ||
          `Помилка надсилання листа (${res.status} ${res.statusText})`
      );
    }

    return await res.json();
  }

  /**
   * Create email draft in Gmail
   */
  static async createDraft(
    accessToken: string,
    payload: SendEmailPayload
  ): Promise<{ id: string; message: { id: string } }> {
    const rfcMessage = buildRfc2822Email(payload);
    const raw = toBase64Url(rfcMessage);

    const res = await fetch(`${GMAIL_BASE_URL}/drafts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        message: { raw }
      })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      throw new Error(
        errJson?.error?.message ||
          `Помилка створення чернетки (${res.status} ${res.statusText})`
      );
    }

    return await res.json();
  }
}
