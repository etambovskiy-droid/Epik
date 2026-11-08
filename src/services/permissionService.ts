/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserProfile } from './authService';

export type FeatureKey =
  | 'VIEW_SAMPLE_3_ROWS'
  | 'UPLOAD_CUSTOM_FILES'
  | 'CONFIGURE_API_KEYS'
  | 'EXPORT_CATALOG_FILE'
  | 'XML_CONVERTER'
  | 'IMAGE_STUDIO'
  | 'SEARCH_GROUNDING'
  | 'GEMINI_CHATBOT'
  | 'ADD_CUSTOM_STORE'
  | 'MANAGE_MERCHANTS'
  | string; // Allows any future feature key

/**
 * Strict Whitelist of features permitted in Demo Mode.
 * By default, ANY feature not explicitly listed here is strictly FORBIDDEN (Default Deny).
 */
export const DEMO_ALLOWED_FEATURES: readonly string[] = [
  'VIEW_SAMPLE_3_ROWS'
];

/**
 * Centralized Permission Guard (Default Deny Whitelist Architecture)
 * Checks whether the current user is allowed to access/execute a given feature.
 *
 * Rules:
 * 1. Unauthenticated users: false for everything.
 * 2. Super Administrator: true for everything.
 * 3. Approved users: true for everything (except admin-specific features like MANAGE_MERCHANTS).
 * 4. Demo users (isDemo === true): false by default for all current & future features,
 *    EXCEPT the strictly whitelisted 'VIEW_SAMPLE_3_ROWS'.
 * 5. Pending / Rejected users: false for all PIM features.
 */
export function canAccessFeature(feature: FeatureKey, user: UserProfile | null): boolean {
  if (!user) return false;

  // Super Administrator has unrestricted access to all features
  if (user.role === 'admin') {
    return true;
  }

  // Demo User: Strict Whitelist (Default Deny for everything else)
  if (user.isDemo) {
    return DEMO_ALLOWED_FEATURES.includes(feature);
  }

  // Merchant management is restricted to admins
  if (feature === 'MANAGE_MERCHANTS') {
    return false;
  }

  // Regular user must have approved status
  return user.status === 'approved';
}

/**
 * User-friendly explanation when a feature is blocked in Demo Mode
 */
export function getDemoRestrictionMessage(featureName?: string): string {
  const target = featureName ? `"${featureName}"` : 'Ця функція';
  return `${target} недоступна у демонстраційному режимі (Sandbox). Для отримання повного доступу та роботи з власними прайсами зареєструйте обліковий запис мерчанта та дочекайтесь підтвердження адміністратором.`;
}
