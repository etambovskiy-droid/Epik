/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserStoryProposal } from '../types/userStories';
import { getUserStories, saveUserStories } from './userStoryEngine';
import { getStoredApiKey, maskApiKey } from './aiApiKeyService';

export const ADMIN_MODERATOR_EMAIL = 'e.tambovskiy@gmail.com';
export const STORAGE_APPROVAL_TOKENS_KEY = 'epicentr_approval_tokens';

export interface ApprovalTokenRecord {
  token: string;
  storyId: string;
  createdAt: string;
  recipientEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  storySnapshot: UserStoryProposal;
  authorByokMasked?: string;
}

/**
 * Generate cryptographically random approval token for a User Story.
 */
export function generateApprovalToken(storyId: string): string {
  const rand = Math.random().toString(36).substring(2, 10);
  const time = Date.now().toString(36);
  return `appr_${storyId.replace(/^story-/, '')}_${time}_${rand}`;
}

/**
 * Load all tokens from localStorage.
 */
export function getApprovalTokens(): Record<string, ApprovalTokenRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_APPROVAL_TOKENS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse approval tokens from storage:', e);
  }
  return {};
}

/**
 * Save token record to localStorage.
 */
export function saveApprovalTokenRecord(record: ApprovalTokenRecord): void {
  try {
    const tokens = getApprovalTokens();
    tokens[record.token] = record;
    localStorage.setItem(STORAGE_APPROVAL_TOKENS_KEY, JSON.stringify(tokens));
  } catch (e) {
    console.error('Failed to save approval token:', e);
  }
}

/**
 * Find token record by approval token string.
 */
export function getRecordByToken(token: string): ApprovalTokenRecord | null {
  const tokens = getApprovalTokens();
  if (tokens[token]) return tokens[token];

  // Fallback: search within user stories
  const stories = getUserStories();
  const matchedStory = stories.find(s => s.approvalToken === token);
  if (matchedStory) {
    return {
      token,
      storyId: matchedStory.id,
      createdAt: matchedStory.approvalEmailSentAt || matchedStory.createdAt,
      recipientEmail: matchedStory.approvalEmailRecipient || ADMIN_MODERATOR_EMAIL,
      status: matchedStory.status === 'approved_and_deployed' ? 'approved' : matchedStory.status === 'rejected' ? 'rejected' : 'pending',
      storySnapshot: matchedStory,
      authorByokMasked: matchedStory.authorByokMasked
    };
  }
  return null;
}

export interface EmailDispatchResult {
  success: boolean;
  recipient: string;
  token: string;
  approvalUrl: string;
  subject: string;
  body: string;
  mailtoUrl: string;
}

/**
 * Automatically prepares and dispatches email notification to e.tambovskiy@gmail.com
 * containing full User Story specification and unique approval token link.
 */
export function sendModeratorEmailNotification(story: UserStoryProposal): EmailDispatchResult {
  const token = story.approvalToken || generateApprovalToken(story.id);
  const byokKey = getStoredApiKey();
  const maskedByok = byokKey ? maskApiKey(byokKey) : 'НЕ ВСТАНОВЛЕНО (BYOK відсутній)';

  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
  const approvalUrl = `${baseUrl}?approval_token=${encodeURIComponent(token)}`;

  const subject = `[Епіцентр Агент] Нова User Story на модерацію: "${story.title}"`;

  const body = `Шановний адміністраторе!

Користувач подав нову User Story для впровадження у платформу "Епіцентр Агент":

--------------------------------------------------
НАЗВА: ${story.title}
РОЛЬ: ${story.userRole}
Я ХОЧУ: ${story.wantFeature}
ЩОБ ОТРИМАТИ: ${story.soThatBenefit}
ДАТА СТВОРЕННЯ: ${new Date(story.createdAt).toLocaleString('uk-UA')}

ОЦІНКА ТА АНАЛІТИКА (MoSCoW):
- Пріоритет: ${story.evaluation?.priority || 'Must Have'}
- Вплив на бізнес: ${story.evaluation?.businessImpactScore || 9}/10
- Технічна реалізованість: ${story.evaluation?.implementationFeasibility || 8}/10
- Рівень ризику: ${story.evaluation?.riskLevel || 'Низький'}
- Обґрунтування: ${story.evaluation?.summaryRationale || 'Оптимізація роботи селерів'}

ВИТРАТИ НА ЗБІРКУ ТА ТОКЕНИ (BYOK):
- Персональний ключ автора ("epic_ai_key"): ${maskedByok}
- Примітка: Витрати на генерацію та компіляцію релізу списуються з ключа автора ідеї.
--------------------------------------------------

ПОСИЛАННЯ ДЛЯ ПЕРЕВІРКИ ТА СХВАЛЕННЯ:
${approvalUrl}

Ви можете натиснути кнопку "Підтвердити реліз" або "Відхилити" безпосередньо за цим посиланням.
--------------------------------------------------
Епіцентр Агент — Корпоративна SaaS платформа`;

  const mailtoUrl = `mailto:${encodeURIComponent(ADMIN_MODERATOR_EMAIL)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;

  // Save token record
  saveApprovalTokenRecord({
    token,
    storyId: story.id,
    createdAt: new Date().toISOString(),
    recipientEmail: ADMIN_MODERATOR_EMAIL,
    status: 'pending',
    storySnapshot: story,
    authorByokMasked: byokKey ? maskApiKey(byokKey) : undefined
  });

  // Update story in storage
  const stories = getUserStories();
  const updatedStories = stories.map(s => {
    if (s.id === story.id) {
      return {
        ...s,
        status: (s.status === 'approved_and_deployed' ? s.status : 'pending_approval') as any,
        approvalToken: token,
        approvalEmailSentAt: new Date().toISOString(),
        approvalEmailRecipient: ADMIN_MODERATOR_EMAIL,
        authorByokMasked: byokKey ? maskApiKey(byokKey) : undefined
      };
    }
    return s;
  });
  saveUserStories(updatedStories);

  // Trigger app notification event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('epic_moderation_email_dispatched', {
        detail: {
          recipient: ADMIN_MODERATOR_EMAIL,
          storyTitle: story.title,
          token,
          approvalUrl
        }
      })
    );
  }

  return {
    success: true,
    recipient: ADMIN_MODERATOR_EMAIL,
    token,
    approvalUrl,
    subject,
    body,
    mailtoUrl
  };
}
