/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { authService, UserProfile } from '../../services/authService';
import { LoginView } from './LoginView';
import { PendingApprovalView } from './PendingApprovalView';
import { AdminApprovalHandler } from './AdminApprovalHandler';
import { AlertCircle, LogOut } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  onUserChanged?: (user: UserProfile | null) => void;
  onOpenAdminUsers?: () => void;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  onUserChanged
}) => {
  const [user, setUser] = useState<UserProfile | null>(() => authService.getCurrentUser());

  useEffect(() => {
    const unsubscribe = authService.subscribe((updatedUser) => {
      setUser(updatedUser);
      onUserChanged?.(updatedUser);
    });
    return () => unsubscribe();
  }, [onUserChanged]);

  // 1. Not Authenticated -> Show full-screen Login / Register View
  if (!user) {
    return (
      <>
        <AdminApprovalHandler onApprovalComplete={() => setUser(authService.getCurrentUser())} />
        <LoginView onSuccess={(newUser) => setUser(newUser)} />
      </>
    );
  }

  // 2. Pending Approval -> Show Pending Approval Screen
  if (user.status === 'pending_approval') {
    return (
      <>
        <AdminApprovalHandler onApprovalComplete={() => setUser(authService.getCurrentUser())} />
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
      {children}
    </>
  );
};
