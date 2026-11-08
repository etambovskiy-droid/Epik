/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { authService, UserProfile } from '../../services/authService';
import { LoginView } from './LoginView';
import { PendingApprovalView } from './PendingApprovalView';
import { AdminApprovalHandler } from './AdminApprovalHandler';
import { ResetPasswordModal } from './ResetPasswordModal';
import { AlertCircle, LogOut } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  onUserChanged?: (user: UserProfile | null) => void;
  onOpenAdminUsers?: () => void;
}

function extractTokenFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  // 1. Check standard URL search query params
  const searchParams = new URLSearchParams(window.location.search);
  const searchToken = searchParams.get('resetToken') || searchParams.get('oobCode');
  if (searchToken) return searchToken;

  // 2. Check hash in case of hash navigation
  if (window.location.hash.includes('resetToken=')) {
    const hashPart = window.location.hash.split('?')[1] || window.location.hash.slice(1);
    const hashParams = new URLSearchParams(hashPart);
    return hashParams.get('resetToken') || hashParams.get('oobCode');
  }

  return null;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  onUserChanged
}) => {
  const [user, setUser] = useState<UserProfile | null>(() => authService.getCurrentUser());

  // Global URL password reset listener (active regardless of whether user is already logged in or not)
  const [urlResetToken, setUrlResetToken] = useState<string | null>(() => extractTokenFromLocation());
  const [isUrlResetModalOpen, setIsUrlResetModalOpen] = useState<boolean>(() => Boolean(extractTokenFromLocation()));

  useEffect(() => {
    const unsubscribe = authService.subscribe((updatedUser) => {
      setUser(updatedUser);
      onUserChanged?.(updatedUser);
    });
    return () => unsubscribe();
  }, [onUserChanged]);

  // Check URL token on popstate or navigation
  useEffect(() => {
    const checkToken = () => {
      const token = extractTokenFromLocation();
      if (token) {
        setUrlResetToken(token);
        setIsUrlResetModalOpen(true);
      }
    };
    window.addEventListener('popstate', checkToken);
    return () => window.removeEventListener('popstate', checkToken);
  }, []);

  const handleCloseResetModal = useCallback(() => {
    setIsUrlResetModalOpen(false);
    setUrlResetToken(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('resetToken');
      url.searchParams.delete('oobCode');
      window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
    }
  }, []);

  const handlePasswordResetSuccess = useCallback((_resetEmail: string) => {
    // When password is changed from email link, log out active session so user re-authenticates with new password
    authService.logout();
    setUser(null);
    handleCloseResetModal();
  }, [handleCloseResetModal]);

  const globalResetModal = (
    <ResetPasswordModal
      isOpen={isUrlResetModalOpen}
      onClose={handleCloseResetModal}
      initialToken={urlResetToken}
      onPasswordResetSuccess={handlePasswordResetSuccess}
    />
  );

  // 1. Not Authenticated -> Show full-screen Login / Register View
  if (!user) {
    return (
      <>
        <AdminApprovalHandler onApprovalComplete={() => setUser(authService.getCurrentUser())} />
        {globalResetModal}
        <LoginView onSuccess={(newUser) => setUser(newUser)} />
      </>
    );
  }

  // 2. Pending Approval -> Show Pending Approval Screen
  if (user.status === 'pending_approval') {
    return (
      <>
        <AdminApprovalHandler onApprovalComplete={() => setUser(authService.getCurrentUser())} />
        {globalResetModal}
        <PendingApprovalView
          user={user}
          onStatusUpdated={(updated) => setUser(updated)}
          onLogout={() => setUser(null)}
        />
      </>
    );
  }

  // 3. Rejected -> Show Rejection Screen
  if (user.status === 'rejected') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex flex-col justify-center items-center p-4">
        {globalResetModal}
        <div className="w-full max-w-md bg-slate-900 border border-rose-800/80 rounded-3xl p-8 shadow-2xl text-slate-100 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>

          <h2 className="text-lg font-bold text-slate-100">Заявку на доступ відхилено</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Адміністратор розглянув реєстрацію вашого магазину <strong>{user.shopName}</strong> ({user.email}) та відхилив доступ.
          </p>

          {user.adminNotes && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/40 rounded-xl text-xs text-rose-200 text-left">
              <span className="font-semibold block text-[10px] text-rose-300 uppercase">Причина відхилення:</span>
              <p className="mt-0.5">{user.adminNotes}</p>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={() => {
                authService.logout();
                setUser(null);
              }}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Вийти або подати нову заявку
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Approved -> Full access to application
  return (
    <>
      <AdminApprovalHandler onApprovalComplete={() => setUser(authService.getCurrentUser())} />
      {globalResetModal}
      {children}
    </>
  );
};
