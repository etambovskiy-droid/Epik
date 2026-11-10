/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import resetPasswordHandler from './reset-password.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'POST') {
    const parsedBody = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    req.body = { ...parsedBody, action: 'verify' };
  }
  return resetPasswordHandler(req, res);
}
