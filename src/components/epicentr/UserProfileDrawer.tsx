/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Store,
  Mail,
  Phone,
  ShieldCheck,
  KeyRound,
  Lock,
  Save,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Moon,
  Sun,
  Monitor,
  Globe,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles
} from 'lucide-react';
import { authService, UserProfile } from '../../services/authService';
import { uiPreferences, ThemeMode, LanguageMode } from '../../services/uiPreferencesService';
import { epicentrMerchantApi } from '../../services/epicentrMerchantApiService';

interface UserProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout?: () => void;
}

export const UserProfileDrawer: React.FC<UserProfileDrawerProps> = ({
  isOpen,
  onClose,
  onLogout
}) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(authService.getCurrentUser());

  // Profile Form States
  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Epicentr Merchant API Token States
  const [merchantToken, setMerchantToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isTestingToken, setIsTestingToken] = useState(false);
  const [tokenResult, setTokenResult] = useState<{ success: boolean; message: string } | null>(null);
  const [tokenSaved, setTokenSaved] = useState(false);

  // Password Change Form States
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // UI Preferences
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(uiPreferences.getTheme());
  const [currentLang, setCurrentLang] = useState<LanguageMode>(uiPreferences.getLanguage());

  useEffect(() => {
    if (isOpen) {
      const u = authService.getCurrentUser();
      setCurrentUser(u);
      if (u) {
        setName(u.name || '');
        setShopName(u.shopName || '');
        setEmail(u.email || '');
        setPhone(u.phone || '');
      }
      setMerchantToken(epicentrMerchantApi.getToken());
      setTokenResult(null);
      setProfileSuccess(false);
      setPasswordSuccess(false);
      setProfileError(null);
      setPasswordError(null);
      setCurrentTheme(uiPreferences.getTheme());
      setCurrentLang(uiPreferences.getLanguage());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const t = (k: string) => uiPreferences.t(k);

  const initials = currentUser?.name
    ? currentUser.name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'СЕЛЕР';

  // Handle Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    try {
      const updated = await authService.updateProfile({
        name: name.trim(),
        shopName: shopName.trim(),
        email: email.trim(),
        phone: phone.trim()
      });
      setCurrentUser(updated);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      setProfileError(err.message || 'Не вдалося зберегти профіль');
    }
  };

  // Handle Merchant Token Save & Test
  const handleSaveToken = () => {
    epicentrMerchantApi.saveToken(merchantToken);
    setTokenSaved(true);
    setTimeout(() => setTokenSaved(false), 2500);
  };

  const handleTestToken = async () => {
    setIsTestingToken(true);
    setTokenResult(null);
    try {
      const res = await epicentrMerchantApi.testConnection(merchantToken);
      setTokenResult(res);
      if (res.success && merchantToken.trim()) {
        epicentrMerchantApi.saveToken(merchantToken);
      }
    } finally {
      setIsTestingToken(false);
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('Новий пароль та підтвердження не збігаються');
      return;
    }

    const res = await authService.changePassword(oldPassword, newPassword);
    if (res.success) {
      setPasswordSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPasswordSuccess(false);
        setShowPasswordFields(false);
      }, 3000);
    } else {
      setPasswordError(res.error || 'Помилка зміни пароля');
    }
  };

  // Handle UI Theme change
  const handleSelectTheme = (mode: ThemeMode) => {
    setCurrentTheme(mode);
    uiPreferences.setTheme(mode);
  };

  // Handle UI Lang change
  const handleSelectLanguage = (lang: LanguageMode) => {
    setCurrentLang(lang);
    uiPreferences.setLanguage(lang);
  };

  // Handle Logout
  const handleLogout = () => {
    authService.logout();
    onLogout?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-over Panel from Right */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col text-slate-800 animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#004BB7] to-[#002f7a] text-white flex items-center justify-center font-bold text-base shadow-sm ring-4 ring-blue-50">
                {initials}
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                  {currentUser?.name || t('nav.profile')}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-500 font-medium">
                    {currentUser?.shopName || 'Кабінет продавця'}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Онлайн
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Section 1: Profile Details */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <User className="w-3.5 h-3.5 text-[#004BB7]" />
                  {t('drawer.personalInfo')}
                </span>
                {currentUser?.sellerCode && (
                  <span className="font-mono text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">
                    {currentUser.sellerCode}
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t('drawer.name')}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#004BB7] focus:ring-1 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {t('drawer.shopName')}
                  </label>
                  <div className="relative">
                    <Store className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#004BB7] focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {t('drawer.email')}
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#004BB7] focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {t('drawer.phone')}
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+380..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#004BB7] focus:ring-1 focus:ring-blue-100"
                    />
                  </div>
                </div>

                {profileError && (
                  <p className="text-xs text-rose-600 flex items-center gap-1 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {profileError}
                  </p>
                )}

                {profileSuccess && (
                  <p className="text-xs text-emerald-700 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {t('drawer.saved')}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full py-2 rounded-xl bg-[#004BB7] hover:bg-blue-700 text-white font-bold text-xs shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{t('drawer.saveChanges')}</span>
                </button>
              </form>
            </div>

            {/* Section 2: Epicentr Merchant API Token */}
            <div className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5 uppercase tracking-wider">
                  <KeyRound className="w-3.5 h-3.5 text-[#FF7A00]" />
                  {t('drawer.merchantApi')}
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  epicentrMerchantApi.hasToken()
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  {epicentrMerchantApi.hasToken() ? 'Авторизовано' : 'Демо'}
                </span>
              </div>

              <p className="text-[11px] text-amber-900/80">
                {t('drawer.apiTokenDesc')} (<code className="font-mono text-[10px] text-amber-950">merchant-api.epicentrm.com.ua</code>).
              </p>

              <div className="space-y-2">
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={merchantToken}
                    onChange={(e) => {
                      setMerchantToken(e.target.value);
                      setTokenSaved(false);
                    }}
                    placeholder="Bearer Token: eyJhbGciOiJIUzI1NiIsIn..."
                    className="w-full pl-3 pr-9 py-2 bg-white border border-amber-300 rounded-xl text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#FF7A00]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="p-1 text-slate-400 hover:text-slate-700 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                  >
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestToken}
                    disabled={isTestingToken || !merchantToken.trim()}
                    className="flex-1 py-1.5 px-3 rounded-xl bg-white border border-amber-300 hover:bg-amber-50 text-amber-900 text-xs font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingToken ? 'animate-spin text-[#FF7A00]' : ''}`} />
                    <span>{isTestingToken ? 'Перевірка...' : t('drawer.testConnection')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveToken}
                    disabled={!merchantToken.trim()}
                    className="py-1.5 px-4 rounded-xl bg-[#FF7A00] hover:bg-amber-600 text-white text-xs font-bold shadow-2xs disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {tokenSaved ? 'Збережено!' : 'Зберегти'}
                  </button>
                </div>

                {tokenResult && (
                  <p className={`text-xs p-2 rounded-lg font-medium flex items-start gap-1.5 ${
                    tokenResult.success
                      ? 'bg-emerald-100/70 text-emerald-900'
                      : 'bg-rose-100/70 text-rose-900'
                  }`}>
                    {tokenResult.success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                    <span>{tokenResult.message}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Section 3: Change Password */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <Lock className="w-3.5 h-3.5 text-[#004BB7]" />
                  {t('drawer.changePassword')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPasswordFields(!showPasswordFields)}
                  className="text-xs font-semibold text-[#004BB7] hover:underline cursor-pointer"
                >
                  {showPasswordFields ? 'Згорнути' : 'Змінити пароль'}
                </button>
              </div>

              {showPasswordFields && (
                <form onSubmit={handleChangePassword} className="space-y-2.5 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {t('drawer.currentPassword')}
                    </label>
                    <input
                      type="password"
                      required
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#004BB7]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {t('drawer.newPassword')}
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Мінімум 6 символів"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#004BB7]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {t('drawer.confirmPassword')}
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Повторіть новий пароль"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#004BB7]"
                    />
                  </div>

                  {passwordError && (
                    <p className="text-xs text-rose-600 flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {passwordError}
                    </p>
                  )}

                  {passwordSuccess && (
                    <p className="text-xs text-emerald-700 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Пароль успішно змінено!
                    </p>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                  >
                    {t('drawer.updatePasswordBtn')}
                  </button>
                </form>
              )}
            </div>

            {/* Section 4: UI/UX Preferences (Theme & Language) */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-[#004BB7]" />
                {t('drawer.appearance')}
              </span>

              {/* Theme Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  {t('drawer.theme')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectTheme('light')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      currentTheme === 'light'
                        ? 'bg-white border-[#004BB7] text-[#004BB7] shadow-xs ring-1 ring-blue-100'
                        : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span>{t('drawer.themeLight')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectTheme('dark')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      currentTheme === 'dark'
                        ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                        : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5 text-sky-400" />
                    <span>{t('drawer.themeDark')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectTheme('system')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      currentTheme === 'system'
                        ? 'bg-white border-[#004BB7] text-[#004BB7] shadow-xs ring-1 ring-blue-100'
                        : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5 text-slate-500" />
                    <span>{t('drawer.themeSystem')}</span>
                  </button>
                </div>
              </div>

              {/* Language Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  {t('drawer.language')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectLanguage('ua')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      currentLang === 'ua'
                        ? 'bg-white border-[#004BB7] text-[#004BB7] shadow-xs ring-1 ring-blue-100'
                        : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <span className="text-base">🇺🇦</span>
                    <span>Українська (UA)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectLanguage('en')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      currentLang === 'en'
                        ? 'bg-white border-[#004BB7] text-[#004BB7] shadow-xs ring-1 ring-blue-100'
                        : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <span className="text-base">🇬🇧</span>
                    <span>English (EN)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Drawer Footer with Logout Action */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500 font-medium">
              Сесія збережена локально
            </span>

            <button
              type="button"
              onClick={handleLogout}
              className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
