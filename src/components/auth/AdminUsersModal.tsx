/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Building2,
  Mail,
  Search,
  Filter,
  RefreshCw,
  X,
  ExternalLink,
  AlertTriangle
} from 'lucide-react';
import { authService, UserProfile } from '../../services/authService';

interface AdminUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated?: () => void;
}

export const AdminUsersModal: React.FC<AdminUsersModalProps> = ({
  isOpen,
  onClose,
  onUserUpdated
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending_approval' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; success: boolean } | null>(null);

  const currentUser = authService.getCurrentUser();
  const isSuperAdmin = authService.isSuperAdmin(currentUser);

  const loadUsers = () => {
    const list = authService.getAllUsers();
    setUsers(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      setActionFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Strict Super Admin Access Guard
  if (!isSuperAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <div className="w-full max-w-md bg-slate-900 border border-rose-700/80 rounded-2xl p-6 text-slate-100 shadow-2xl space-y-4">
          <div className="flex items-center gap-3 text-rose-400">
            <ShieldAlert className="w-8 h-8" />
            <div>
              <h2 className="text-base font-bold text-slate-100">403: Доступ заборонено</h2>
              <p className="text-xs text-rose-300">Недостатньо прав доступу</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Управління користувачами та схвалення реєстрацій дозволено виключно для головного адміністратора платформи.
          </p>
          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-200"
            >
              Закрити
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleApprove = async (email: string) => {
    setIsProcessing(email);
    setActionFeedback(null);
    try {
      const res = await authService.approveUser(email);
      if (res.success) {
        setActionFeedback({ message: res.message, success: true });
        loadUsers();
        onUserUpdated?.();
      } else {
        setActionFeedback({ message: res.message, success: false });
      }
    } finally {
      setIsProcessing(null);
    }
  };

  const handleReject = async (email: string) => {
    const reason = window.prompt('Вкажіть причину відхилення реєстрації:', 'Не відповідає вимогам верифікації постачальника');
    if (reason === null) return;

    setIsProcessing(email);
    setActionFeedback(null);
    try {
      const res = await authService.rejectUser(email, reason);
      if (res.success) {
        setActionFeedback({ message: res.message, success: true });
        loadUsers();
        onUserUpdated?.();
      } else {
        setActionFeedback({ message: res.message, success: false });
      }
    } finally {
      setIsProcessing(null);
    }
  };

  const filteredUsers = users.filter(u => {
    if (filterStatus !== 'all' && u.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (u.name || '').toLowerCase().includes(q);
      const matchEmail = (u.email || '').toLowerCase().includes(q);
      const matchShop = (u.shopName || '').toLowerCase().includes(q);
      const matchCode = (u.sellerCode || '').toLowerCase().includes(q);
      return matchName || matchEmail || matchShop || matchCode;
    }
    return true;
  });

  const pendingCount = users.filter(u => u.status === 'pending_approval').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  Управління мерчантами та схвалення заявок
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold uppercase">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Авторизовано: <strong className="text-amber-300">Головний адміністратор платформи</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar & Search */}
        <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Filters */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Всі ({users.length})
            </button>
            <button
              onClick={() => setFilterStatus('pending_approval')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
                filterStatus === 'pending_approval'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Очікують ({pendingCount})
            </button>
            <button
              onClick={() => setFilterStatus('approved')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                filterStatus === 'approved'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Схвалені ({users.filter(u => u.status === 'approved').length})
            </button>
            <button
              onClick={() => setFilterStatus('rejected')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                filterStatus === 'rejected'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Відхилені ({users.filter(u => u.status === 'rejected').length})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук за назвою, email..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Feedback message */}
        {actionFeedback && (
          <div
            className={`mx-6 mt-3 p-3 rounded-xl border text-xs flex items-center gap-2 ${
              actionFeedback.success
                ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300'
                : 'bg-rose-950/40 border-rose-700/60 text-rose-300'
            }`}
          >
            {actionFeedback.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
        )}

        {/* Users Table */}
        <div className="p-6 overflow-y-auto flex-1">
          {filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Clock className="w-8 h-8 mx-auto opacity-50" />
              <p className="text-xs">За заданими критеріями користувачів не знайдено</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((u) => {
                const isPending = u.status === 'pending_approval';
                const isApproved = u.status === 'approved';
                const isRejected = u.status === 'rejected';
                const isCurrentSuper = u.role === 'admin' || authService.isSuperAdmin(u);

                return (
                  <div
                    key={u.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isPending
                        ? 'bg-amber-950/20 border-amber-500/40'
                        : isApproved
                        ? 'bg-slate-950/40 border-slate-800'
                        : 'bg-rose-950/20 border-rose-800/40'
                    }`}
                  >
                    {/* User Info */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-100">{u.name}</span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {u.sellerCode}
                        </span>
                        {isCurrentSuper && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            Super Admin (Ви)
                          </span>
                        )}
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                            isApproved
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : isPending
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                              : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {isApproved ? 'Схвалено' : isPending ? 'Очікує рішення' : 'Відхилено'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400 pt-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate text-slate-300">{u.shopName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span className="truncate font-mono text-slate-300">{u.email}</span>
                        </div>
                      </div>

                      {u.adminNotes && (
                        <p className="text-[11px] text-rose-300 italic pt-1">
                          Примітка: {u.adminNotes}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    {!isCurrentSuper && (
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        {isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleReject(u.email)}
                              disabled={isProcessing === u.email}
                              className="px-3 py-1.5 rounded-lg border border-rose-700/60 hover:bg-rose-950/40 text-rose-300 text-xs font-semibold transition-colors flex items-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Відхилити
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApprove(u.email)}
                              disabled={isProcessing === u.email}
                              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Схвалити доступ
                            </button>
                          </>
                        )}

                        {isRejected && (
                          <button
                            type="button"
                            onClick={() => handleApprove(u.email)}
                            disabled={isProcessing === u.email}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-700/60 text-emerald-300 text-xs font-semibold transition-colors flex items-center gap-1.5"
                            title="Розблокувати акаунт та надати повний доступ"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Розблокувати доступ
                          </button>
                        )}

                        {isApproved && (
                          <button
                            type="button"
                            onClick={() => handleReject(u.email)}
                            disabled={isProcessing === u.email}
                            className="px-3.5 py-1.5 rounded-lg border border-rose-800/60 hover:bg-rose-950/60 hover:border-rose-600 text-rose-300 text-xs font-semibold transition-all flex items-center gap-1.5"
                            title="Заблокувати доступ мерчанта до PIM"
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            Заблокувати мерчанта
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Всього зареєстрованих селерів: <strong className="text-slate-200">{users.length}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
};
