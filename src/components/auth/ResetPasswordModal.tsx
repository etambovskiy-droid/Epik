/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  X,
  ShieldCheck
} from 'lucide-react';
import { authService } from '../../services/authService';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialToken?: string | null;
  initialEmail?: string;
  onPasswordResetSuccess?: (email: string) => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  initialToken = null,
  initialEmail = '',
  onPasswordResetSuccess
}) => {
  const [step, setStep] = useState<'request' | 'sent' | 'reset' | 'success'>('request');
  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState<string | null>(initialToken);

  // New password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Live 60-second countdown timer
  const [remainingSeconds, setRemainingSeconds] = useState(60);
  const [isExpired, setIsExpired] = useState(false);

  // Loading & error feedback
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If initialToken was passed or present in URL (via email link), verify and jump to 'reset' mode
  useEffect(() => {
    let isMounted = true;
    const effectiveToken = initialToken || (typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('resetToken') || new URLSearchParams(window.location.search).get('oobCode')) : null);

    if (effectiveToken && isOpen) {
      setToken(effectiveToken);
      setIsLoading(true);
      authService.verifyResetTokenAsync(effectiveToken).then((verification) => {
        if (!isMounted) return;
        setIsLoading(false);
        if (verification.valid) {
          setStep('reset');
          setRemainingSeconds(verification.remainingSeconds);
          setIsExpired(false);
          if (verification.email) setEmail(verification.email);
        } else {
          setStep('reset');
          setIsExpired(true);
          setRemainingSeconds(0);
          setErrorMessage(verification.error || 'Час дії посилання вичерпано або токен недійсний');
        }
      });
    } else if (isOpen && !effectiveToken) {
      setStep('request');
      setToken(null);
      setRemainingSeconds(60);
      setIsExpired(false);
    }
    return () => {
      isMounted = false;
    };
  }, [initialToken, isOpen]);

  // Active 60-second timer countdown ticker
  useEffect(() => {
    if (!isOpen || isExpired) return;
    if (step !== 'sent' && step !== 'reset') return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, step, isExpired]);

  if (!isOpen) return null;

  const handleModalClose = () => {
    if (step === 'success') {
      onPasswordResetSuccess?.(email);
    }
    onClose();
  };

  // Step 1: Request reset email (Zero In-App Token Leak: server dispatches out-of-band email)
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await authService.requestPasswordReset(email);
      if (res.success) {
        setIsExpired(false);
        setStep('sent');
      } else {
        setErrorMessage(res.message || 'Не вдалося надіслати запит');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Помилка звернення до сервера');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Submit new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isExpired || remainingSeconds <= 0) {
      setErrorMessage('Час дії посилання (60 сек) вичерпано. Згенеруйте нове посилання.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage('Пароль повинен містити не менше 6 символів');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Паролі не збігаються. Будь ласка, перевірте правильність');
      return;
    }

    if (!token) {
      setErrorMessage('Токен відновлення відсутній');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.resetPasswordWithToken(token, newPassword, confirmPassword);
      if (res.success) {
        setStep('success');
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Помилка збереження нового пароля');
    } finally {
      setIsLoading(false);
    }
  };

  const timerPercent = Math.max(0, Math.min(100, (remainingSeconds / 60) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl p-6 md:p-8 shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Відновлення пароля</h2>
              <p className="text-[11px] text-slate-400">Захищений доступ з таймінгом 60 сек</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleModalClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error banner */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/50 border border-rose-700/60 text-xs text-rose-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="leading-tight">{errorMessage}</p>
          </div>
        )}

        {/* Mode A: Request Reset Form */}
        {step === 'request' && (
          <form onSubmit={handleRequestReset} className="mt-5 space-y-4">
            <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-800/40 text-xs text-blue-200/90 leading-relaxed">
              ℹ️ Введіть адресу електронної пошти вашого кабінету. На вказаний email буде надіслано персональне захищене посилання для зміни пароля з <strong className="text-amber-300">таймінгом 60 секунд</strong>.
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Електронна пошта акаунта:
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seller@epicentr.ua"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <span>Надсилаємо запит...</span>
              ) : (
                <>
                  <span>Надіслати посилання для зміни пароля</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Mode B: Link Sent & Out-of-Band Delivery Notification (Zero in-app token leak) */}
        {step === 'sent' && (
          <div className="mt-5 space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-700/50 text-xs text-emerald-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-300 text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>Запит успішно оброблено!</span>
              </div>
              <p>
                Лист із захищеним посиланням надіслано на вашу електронну пошту.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-700/50 text-xs text-blue-200 space-y-2.5">
              <div className="flex items-center gap-2 text-amber-300 font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Захист від несанкціонованого доступу</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                З міркувань безпеки зміна пароля можлива <strong>виключно через перехід за персональним посиланням із листа</strong>, надісланого до вашої поштової скриньки.
              </p>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Будь ласка, відкрийте вашу пошту (перевірте також папку «Спам») та перейдіть за посиланням протягом <strong>60 секунд</strong>.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
            >
              Зрозуміло, перевіряю пошту
            </button>
          </div>
        )}

        {/* Mode C: Reset Form (2 Password inputs) */}
        {step === 'reset' && (
          <form onSubmit={handleResetPassword} className="mt-5 space-y-4">
            {/* Live Timer Widget */}
            <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
              isExpired
                ? 'bg-rose-950/40 border-rose-700/60 text-rose-300'
                : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
            }`}>
              <span className="flex items-center gap-1.5 font-semibold">
                <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>Залишилось часу:</span>
              </span>
              <span className="font-mono font-bold text-sm text-amber-300">
                {remainingSeconds} сек
              </span>
            </div>

            {isExpired ? (
              <div className="space-y-3 py-2 text-center">
                <p className="text-xs text-rose-300">
                  Час дії захищеного посилання (60 секунд) минув.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStep('request');
                    setIsExpired(false);
                    setRemainingSeconds(60);
                  }}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Згенерувати нове посилання</span>
                </button>
              </div>
            ) : (
              <>
                {/* 1. New Password */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Новий пароль:
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Мінімум 6 символів"
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 2. Repeat Password */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Повторіть новий пароль:
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Повторіть новий пароль"
                      className={`w-full pl-9 pr-10 py-2.5 bg-slate-950 border rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none ${
                        confirmPassword && confirmPassword !== newPassword
                          ? 'border-rose-600 focus:border-rose-500'
                          : confirmPassword && confirmPassword === newPassword
                          ? 'border-emerald-500 focus:border-emerald-500'
                          : 'border-slate-700 focus:border-amber-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Password match indicator */}
                {confirmPassword && (
                  <div className="text-[11px]">
                    {confirmPassword === newPassword ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Паролі збігаються
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Паролі не збігаються
                      </span>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || isExpired || !newPassword || newPassword !== confirmPassword}
                  className="w-full mt-2 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <span>Збереження пароля...</span>
                  ) : (
                    <>
                      <span>Зберегти новий пароль</span>
                      <ShieldCheck className="w-4 h-4" />
                    </>
                  )}
                </button>
              </>
            )}
          </form>
        )}

        {/* Mode D: Success State */}
        {step === 'success' && (
          <div className="mt-5 space-y-4 text-center py-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-100">Пароль успішно змінено!</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Ваш пароль для входу в систему було успішно оновлено. Тепер ви можете увійти до кабінету.
              </p>
            </div>

            <button
              type="button"
              onClick={handleModalClose}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              Перейти до форми входу
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
