/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { fetchExternalXmlFeed, XmlProxyError } from './_xmlProxyUtils';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const targetUrl =
    req.method === 'POST'
      ? req.body?.url
      : req.query?.url;

  if (!targetUrl || typeof targetUrl !== 'string') {
    res.status(400).json({ error: 'Вкажіть URL-посилання на XML-фід.' });
    return;
  }

  try {
    const result = await fetchExternalXmlFeed(targetUrl);
    res.status(200).json({
      xml: result.xml,
      finalUrl: result.finalUrl,
      contentType: result.contentType,
      sizeBytes: result.sizeBytes
    });
  } catch (err: any) {
    if (err instanceof XmlProxyError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    res.status(502).json({ error: err?.message || 'Не вдалося завантажити фід з віддаленого сервера.' });
  }
}
