/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Clock,
  ShieldCheck,
  Building2,
  Mail,
  User,
  RefreshCw,
  LogOut,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { authService, UserProfile } from '../../services/authService';

interface PendingApprovalViewProps {
  user: UserProfile;
  onStatusUpdated?: (user: UserProfile) => void;
  onLogout?: () => void;
}

export const PendingApprovalView: React.FC<PendingApprovalViewProps> = ({
  user,
  onStatusUpdated,
  onLogout
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  const handleCheckStatus = async () => {
    setIsChecking(true);
    setCheckMessage(null);
    try {
      const refreshed = authService.getCurrentUser();
      if (refreshed) {
        if (refreshed.status === 'approved') {
          setCheckMessage('Вітаємо! Ваш акаунт було схвалено адміністратором. Завантаження робочої області...');
          setTimeout(() => {
            onStatusUpdated?.(refreshed);
          }, 1200);
          return;
        } else if (refreshed.status === 'rejected') {
          setCheckMessage('На жаль, вашу заявку було відхилено адміністратором.');
        } else {
          setCheckMessage('Заявка все ще очікує підтвердження супер-адміністратором.');
        }
      }
    } finally {
      setTimeout(() => {
        setIsChecking(false);
      }, 500);
    }
  };

  const handleLogout = () => {
    authService.logout();
    onLogout?.();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex flex-col justify-center items-center p-4">
      {/* Decorative background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-lg bg-slate-900/90 border border-slate-700/80 rounded-3xl p-8 shadow-2xl backdrop-blur-md text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-wider text-amber-400">
                  Епіцентр Маркетплейс PIM
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Очікує підтвердження
                </span>
              </div>
              <h1 className="text-lg font-bold text-slate-100 mt-0.5">
                Заявка на доступ до платформи
              </h1>
            </div>
          </div>
        </div>

        {/* Status Announcement Banner */}
        <div className="mt-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed space-y-2">
          <p className="font-semibold text-amber-300 text-sm">
            Дякуємо за реєстрацію!
          </p>
          <p>
            Вашу заявку успішно надіслано на розгляд головному адміністратору платформи.
            Очікуйте підтвердження доступу на вказану вами електронну пошту.
          </p>
        </div>

        {/* Registration Details Card */}
        <div className="mt-6 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block pb-1 border-b border-slate-800">
            Дані зареєстрованого продавця:
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex items-center gap-2.5">
              <User className="w-4 h-4 text-sky-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block">ПІБ:</span>
                <span className="font-semibold text-slate-200">{user.name}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block">Компанія / Магазин:</span>
                <span className="font-semibold text-slate-200">{user.shopName}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block">Email облікового запису:</span>
                <span className="font-mono text-slate-200">{user.email}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block">Згенерований код продавця:</span>
                <span className="font-mono font-bold text-amber-400">{user.sellerCode}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Check Message Feedback */}
        {checkMessage && (
          <div className="mt-4 p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-200 flex items-center gap-2 animate-in fade-in duration-150">
            {checkMessage.includes('Вітаємо') ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{checkMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 pt-5 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-colors flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Вийти
          </button>

          <button
            type="button"
            onClick={handleCheckStatus}
            disabled={isChecking}
            className="px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Перевіряємо...' : 'Перевірити статус заявки'}
          </button>
        </div>
      </div>
    </div>
  );
};
