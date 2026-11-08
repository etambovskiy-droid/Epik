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
  AlertTriangle,
  User,
  Building2,
  Mail,
  ArrowRight
} from 'lucide-react';
import { authService } from '../../services/authService';

interface AdminApprovalHandlerProps {
  onApprovalComplete?: () => void;
}

export const AdminApprovalHandler: React.FC<AdminApprovalHandlerProps> = ({
  onApprovalComplete
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'forbidden' | 'not_found'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('approvalToken') || urlParams.get('token');
    const actionParam = urlParams.get('action') === 'reject' ? 'reject' : 'approve';

    if (tokenParam && tokenParam.startsWith('appr_')) {
      setToken(tokenParam);
      setAction(actionParam);
      handleProcessToken(tokenParam, actionParam);
    }
  }, []);

  const handleProcessToken = async (tokenVal: string, actionVal: 'approve' | 'reject') => {
    const currentUser = authService.getCurrentUser();

    // 1. Must be logged in as Super Admin
    if (!currentUser || !authService.isSuperAdmin(currentUser)) {
      setStatus('forbidden');
      return;
    }

    // 2. Process approval or rejection
    setStatus('processing');
    try {
      if (actionVal === 'approve') {
        const res = await authService.approveUser(tokenVal);
        if (res.success) {
          setStatus('success');
          setMessage(res.message);
          onApprovalComplete?.();
        } else {
          setStatus('not_found');
          setMessage(res.message);
        }
      } else {
        const res = await authService.rejectUser(tokenVal, 'Відхилено за посиланням адміністратора');
        if (res.success) {
          setStatus('success');
          setMessage(res.message);
          onApprovalComplete?.();
        } else {
          setStatus('not_found');
          setMessage(res.message);
        }
      }
    } catch (err: any) {
      setStatus('not_found');
      setMessage(err?.message || 'Помилка обробки токена');
    }
  };

  const clearTokenParam = () => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('approvalToken');
      url.searchParams.delete('token');
      url.searchParams.delete('action');
      window.history.replaceState({}, '', url.toString());
      setToken(null);
    }
  };

  if (!token) return null;

  const currentUser = authService.getCurrentUser();
  const isSuperAdmin = authService.isSuperAdmin(currentUser);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl p-6 text-slate-100 shadow-2xl space-y-4">
        {status === 'forbidden' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-rose-400">
              <ShieldAlert className="w-8 h-8 shrink-0" />
              <div>
                <h3 className="font-bold text-base text-slate-100">403: Доступ заборонено</h3>
                <p className="text-xs text-rose-300">Дія вимагає авторизації супер-адміністратора</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Посилання для схвалення мерчантів захищено. Виконувати цю дію має право виключно:
              <strong className="text-amber-400 block mt-1">Головний адміністратор платформи</strong>
            </p>

            {currentUser ? (
              <p className="text-xs text-slate-400">
                Зараз ви увійшли як: <span className="text-slate-200 font-mono">{currentUser.email}</span>. Будь ласка, увійдіть під обліковим записом адміністратора.
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                Будь ласка, спочатку увійдіть як супер-адміністратор для підтвердження заявки.
              </p>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={clearTokenParam}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-200"
              >
                Закрити
              </button>
            </div>
          </div>
        )}

        {status === 'processing' && (
          <div className="py-6 text-center space-y-2">
            <ShieldCheck className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-200">Обробка запиту адміністратора...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-100">
                {action === 'approve' ? 'Мерчанта успішно схвалено!' : 'Заявку відхилено'}
              </h3>
              <p className="text-xs text-slate-300 mt-1">{message}</p>
            </div>

            <button
              type="button"
              onClick={clearTokenParam}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs rounded-xl shadow-md"
            >
              Перейти до роботи
            </button>
          </div>
        )}

        {status === 'not_found' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-8 h-8 shrink-0" />
              <div>
                <h3 className="font-bold text-base text-slate-100">Заявку не знайдено</h3>
                <p className="text-xs text-amber-300">{message || 'Токен застарів або вже був використаний'}</p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={clearTokenParam}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-200"
              >
                Закрити
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
