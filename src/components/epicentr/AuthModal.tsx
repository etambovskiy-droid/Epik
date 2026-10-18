/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  User,
  Mail,
  Lock,
  Store,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  X,
  Zap,
  ArrowRight,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { authService, UserProfile, DEFAULT_DEMO_USER } from '../../services/authService';
import { uiPreferences } from '../../services/uiPreferencesService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: UserProfile) => void;
  initialMode?: 'signin' | 'register' | 'forgot';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'signin'
}) => {
  const [mode, setMode] = useState<'signin' | 'register' | 'forgot'>(initialMode);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const t = (k: string) => uiPreferences.t(k);

  const resetForm = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSwitchMode = (newMode: 'signin' | 'register' | 'forgot') => {
    setMode(newMode);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      if (mode === 'signin') {
        const res = await authService.login(email, password);
        if (res.success && res.user) {
          onSuccess?.(res.user);
          onClose();
        } else {
          setErrorMsg(res.error || 'Помилка входу');
        }
      } else if (mode === 'register') {
        const res = await authService.register(name, email, password, shopName);
        if (res.success && res.user) {
          onSuccess?.(res.user);
          onClose();
        } else {
          setErrorMsg(res.error || 'Помилка реєстрації');
        }
      } else if (mode === 'forgot') {
        const res = await authService.requestPasswordReset(email);
        if (res.success) {
          setSuccessMsg(res.message);
        } else {
          setErrorMsg(res.message);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setIsLoading(true);
    try {
      const res = await authService.loginAsDemo();
      onSuccess?.(res.user);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#004BB7] flex items-center justify-center text-white font-black text-xl shadow-xs">
              Е
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                {mode === 'signin' && t('auth.signInTitle')}
                {mode === 'register' && t('auth.registerTitle')}
                {mode === 'forgot' && t('auth.forgotTitle')}
              </h2>
              <p className="text-xs text-slate-500">
                {t('brand.marketplace')} — {t('brand.cabinet')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        {mode !== 'forgot' && (
          <div className="flex border-b border-slate-200 bg-slate-50/80 p-1">
            <button
              type="button"
              onClick={() => handleSwitchMode('signin')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'signin'
                  ? 'bg-white text-[#004BB7] shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Вхід
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('register')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-[#004BB7] shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Реєстрація селера
            </button>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Ваше ім'я та прізвище:
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Олександр Мельник"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#004BB7] focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Назва магазину / компанії:
                </label>
                <div className="relative">
                  <Store className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="Епіцентр Постач Трейд"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#004BB7] focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Email адреса:
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seller@epicentr.ua"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#004BB7] focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-800">
                  Пароль:
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('forgot')}
                    className="text-[11px] font-semibold text-[#004BB7] hover:underline cursor-pointer"
                  >
                    Забули пароль?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#004BB7] focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 absolute right-2.5 top-1/2 -translate-y-1/2 rounded cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-[#004BB7] hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <span>Обробка...</span>
            ) : mode === 'signin' ? (
              <>
                <span>Увійти в кабінет</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : mode === 'register' ? (
              <>
                <span>Зареєструвати магазин</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Надіслати інструкції</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* 1-Click Demo Login Button (in sign in mode) */}
          {mode === 'signin' && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleQuickDemo}
                disabled={isLoading}
                className="w-full py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-[#FF7A00]" />
                <span>Швидкий демо-вхід (seller@epicentr.ua)</span>
              </button>
            </div>
          )}

          {/* Mode Switch Footnotes */}
          <div className="pt-2 text-center text-xs text-slate-500">
            {mode === 'signin' && (
              <p>
                Немає акаунта селера?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('register')}
                  className="font-bold text-[#004BB7] hover:underline cursor-pointer"
                >
                  Зареєструватися
                </button>
              </p>
            )}
            {mode === 'register' && (
              <p>
                Вже маєте обліковий запис?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('signin')}
                  className="font-bold text-[#004BB7] hover:underline cursor-pointer"
                >
                  Увійти
                </button>
              </p>
            )}
            {mode === 'forgot' && (
              <p>
                Згадали пароль?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('signin')}
                  className="font-bold text-[#004BB7] hover:underline cursor-pointer"
                >
                  Повернутися до входу
                </button>
              </p>
            )}
          </div>
        </form>

        {/* Security Footer Notice */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Дані сесії безпечно зберігаються у браузері (localStorage)</span>
        </div>
      </div>
    </div>
  );
};
