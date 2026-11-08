/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { authService, UserProfile, SUPER_ADMIN_EMAIL } from './services/authService';

export interface RouteGuardResult {
  allowed: boolean;
  redirectTo?: '/login' | '/register' | '/pending-approval' | '/admin/forbidden';
  reason?: string;
}

/**
 * Core Auth Middleware for route protection and access validation
 */
export function authMiddleware(path: string, user: UserProfile | null): RouteGuardResult {
  const cleanPath = (path || '/').toLowerCase();

  // Public authentication routes
  if (cleanPath === '/login' || cleanPath === '/register') {
    if (user && user.status === 'approved') {
      return { allowed: false, redirectTo: undefined };
    }
    return { allowed: true };
  }

  // Not authenticated
  if (!user) {
    return {
      allowed: false,
      redirectTo: '/login',
      reason: 'Користувач не авторизований'
    };
  }

  // Pending administrator approval
  if (user.status === 'pending_approval') {
    if (cleanPath === '/pending-approval') {
      return { allowed: true };
    }
    return {
      allowed: false,
      redirectTo: '/pending-approval',
      reason: 'Обліковий запис очікує підтвердження адміністратором'
    };
  }

  // Admin routes access check
  if (cleanPath.startsWith('/admin')) {
    const isSuperAdmin = (user.email || '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    if (!isSuperAdmin) {
      return {
        allowed: false,
        redirectTo: '/admin/forbidden',
        reason: `Доступ заборонено: розділ доступний лише для ${SUPER_ADMIN_EMAIL}`
      };
    }
  }

  // Approved user accessing application routes
  return { allowed: true };
}
