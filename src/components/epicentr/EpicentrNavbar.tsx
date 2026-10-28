/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
  SlidersHorizontal,
  Share2,
  History,
  HelpCircle,
  Store,
  ChevronDown,
  Cpu,
  Save,
  KeyRound,
  FileCode,
  LogIn,
  Sun,
  Moon,
  Monitor,
  Globe,
  Check,
  Image as ImageIcon,
  Search,
  MessageSquare
} from 'lucide-react';
import { ShopWorkspace } from '../../services/workspaceStorage';
import { UserProfile } from '../../services/authService';
import { uiPreferences, ThemeMode, LanguageMode } from '../../services/uiPreferencesService';

interface EpicentrNavbarProps {
  currentUser?: UserProfile | null;
  onOpenAuthModal?: () => void;
  onOpenProfileDrawer?: () => void;
  onOpenInstructions: () => void;
  onOpenValidator: () => void;
  onOpenShare: () => void;
  onOpenHistory: () => void;
  onOpenGuide: () => void;
  onOpenUserStories: () => void;
  onOpenApiKeySettings?: () => void;
  hasCustomApiKey?: boolean;
  onReset: () => void;
  activeStep: number;
  historyCount: number;
  currentShop: ShopWorkspace;
  allShops: ShopWorkspace[];
  onSelectShop: (shop: ShopWorkspace) => void;
  appVersion: string;
  lastSavedTimestamp?: number | null;
  isAutoSaving?: boolean;
  hasPendingChanges?: boolean;
  onManualSave?: () => void;
  onOpenXmlConverter?: () => void;
  isXmlConverterActive?: boolean;
  onOpenImageStudio?: () => void;
  onOpenSearchGrounding?: () => void;
  onOpenChatbot?: () => void;
}

export const EpicentrNavbar: React.FC<EpicentrNavbarProps> = ({
  currentUser,
  onOpenAuthModal,
  onOpenProfileDrawer,
  onOpenInstructions,
  onOpenValidator,
  onOpenShare,
  onOpenHistory,
  onOpenGuide,
  onOpenUserStories,
  onOpenApiKeySettings,
  hasCustomApiKey,
  onReset,
  activeStep,
  historyCount,
  currentShop,
  allShops,
  onSelectShop,
  appVersion = 'v1.2.0',
  lastSavedTimestamp,
  isAutoSaving,
  hasPendingChanges,
  onManualSave,
  onOpenXmlConverter,
  isXmlConverterActive,
  onOpenImageStudio,
  onOpenSearchGrounding,
  onOpenChatbot
}) => {
  const [shopMenuOpen, setShopMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(uiPreferences.getTheme());
  const [lang, setLang] = useState<LanguageMode>(uiPreferences.getLanguage());

  const themeMenuRef = useRef<HTMLDivElement>(null);
  const shopMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
      if (shopMenuRef.current && !shopMenuRef.current.contains(e.target as Node)) {
        setShopMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Subscribe to theme and lang changes from service
  useEffect(() => {
    const unsubTheme = uiPreferences.subscribeTheme((t) => setTheme(t));
    const unsubLang = uiPreferences.subscribeLanguage((l) => setLang(l));
    return () => {
      unsubTheme();
      unsubLang();
    };
  }, []);

  const handleSelectTheme = (mode: ThemeMode) => {
    setTheme(mode);
    uiPreferences.setTheme(mode);
    setThemeMenuOpen(false);
  };

  const toggleLang = () => {
    const nextLang: LanguageMode = lang === 'ua' ? 'en' : 'ua';
    setLang(nextLang);
    uiPreferences.setLanguage(nextLang);
  };

  const userInitials = currentUser?.name
    ? currentUser.name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'TS';

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 shadow-xs px-4 lg:px-8 py-2.5 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Left: Brand, Shop Switcher & Version */}
        <div className="flex items-center gap-3">
          {/* Epicentr Logo */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#004BB7] to-[#003380] flex items-center justify-center text-white font-black text-xl tracking-tighter shadow-md shrink-0 border border-blue-500/40 relative">
            <span className="relative z-10">Е</span>
            <div className="absolute inset-0 rounded-xl bg-[#FF6B00]/20 blur-xs -z-0" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight">
                Епіцентр
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#FF6B00] text-white shadow-xs">
                Маркетплейс
              </span>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700/70 shadow-2xs">
                {appVersion}
              </span>
            </div>

            {/* Shop workspace selector */}
            <div className="relative mt-0.5" ref={shopMenuRef}>
              <button
                type="button"
                onClick={() => setShopMenuOpen(!shopMenuOpen)}
                className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/60 px-1.5 cursor-pointer font-medium"
              >
                <Store className="w-3.5 h-3.5 text-[#FF7A00]" />
                <span className="font-bold truncate max-w-[200px]">
                  {currentShop?.name || 'TechSmart'}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  ({currentShop?.sellerCode || 'TS-842'})
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {shopMenuOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-64 bg-white dark:bg-[#0F1422] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 text-xs animate-fade-in">
                  <div className="px-2 py-1 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    {lang === 'ua' ? 'Кабінети селера' : 'Seller Cabinets'}
                  </div>
                  {allShops.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        onSelectShop(s);
                        setShopMenuOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                        s.id === currentShop.id
                          ? 'bg-[#FF6B00]/15 text-[#FF7A00] font-bold border border-[#FF6B00]/30'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="truncate">{s.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">{s.sellerCode}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center / Actions Bar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* XML Feed Converter Button */}
          {onOpenXmlConverter && (
            <button
              type="button"
              onClick={onOpenXmlConverter}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isXmlConverterActive
                  ? 'bg-[#FF6B00] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80'
              }`}
              title="Конвертація XML Prom / Rozetka"
            >
              <FileCode className="w-3.5 h-3.5 text-[#FF7A00]" />
              <span>{uiPreferences.t('nav.xmlFeed', lang)}</span>
            </button>
          )}

          {/* Title Validator */}
          <button
            type="button"
            onClick={onOpenValidator}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80 transition-colors cursor-pointer"
            title="Перевірити формулу генерації назви"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
            <span className="hidden sm:inline">{uiPreferences.t('nav.validator', lang)}</span>
          </button>

          {/* Regulations / Instructions */}
          <button
            type="button"
            onClick={onOpenInstructions}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80 transition-colors cursor-pointer"
            title="Офіційний регламент Епіцентру"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span className="hidden md:inline">{uiPreferences.t('nav.regulations', lang)}</span>
          </button>

          {/* Batch History */}
          <button
            type="button"
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80 transition-colors cursor-pointer"
            title="Історія оброблених партій"
          >
            <History className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
            <span className="hidden sm:inline">{uiPreferences.t('nav.history', lang)}</span>
            {historyCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 text-[10px] font-mono font-bold">
                {historyCount}
              </span>
            )}
          </button>

          {/* AI Image Studio (gemini-nano-banana-2.1) */}
          {onOpenImageStudio && (
            <button
              type="button"
              onClick={onOpenImageStudio}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-orange-500/10 hover:bg-orange-500/20 text-[#FF7A00] border border-orange-500/30 transition-colors cursor-pointer"
              title="ШІ-Фотостудія: Створення та редагування фото товарів (gemini-nano-banana-2.1)"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ШІ-Фото</span>
            </button>
          )}

          {/* Google Search Grounding (gemini-3.8-flash) */}
          {onOpenSearchGrounding && (
            <button
              type="button"
              onClick={onOpenSearchGrounding}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-[#004BB7] dark:text-blue-400 border border-blue-500/30 transition-colors cursor-pointer"
              title="Пошук актуальних характеристик у Google Search (gemini-3.8-flash)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Google Пошук</span>
            </button>
          )}

          {/* Multi-turn Gemini Chatbot */}
          {onOpenChatbot && (
            <button
              type="button"
              onClick={onOpenChatbot}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#004BB7] to-blue-600 hover:from-blue-700 hover:to-blue-600 text-white shadow-2xs transition-all cursor-pointer"
              title="Відкрити багатоходовий ШІ-чат (gemini-4-argon / gemini-3.8-flash / gemini-3.1-flash-lite)"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ШІ-Консультант</span>
            </button>
          )}
        </div>

        {/* Right: Auto-Save, Theme, Language & User Profile */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Auto-Save Status Badge */}
          <button
            type="button"
            onClick={onManualSave}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900/60 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-600 dark:text-slate-300 font-mono transition-all group cursor-pointer"
            title="Автозбереження чернетки (клікніть для збереження зараз)"
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isAutoSaving ? 'bg-[#FF7A00]' : hasPendingChanges ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isAutoSaving ? 'bg-[#FF7A00]' : hasPendingChanges ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
            </span>
            <span className="hidden sm:inline text-slate-500 dark:text-slate-400">
              {isAutoSaving ? 'Збереження...' : hasPendingChanges ? 'Чернетка:' : 'Автозбережено:'}
            </span>
            <span className={`${hasPendingChanges ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'} font-mono font-bold`}>
              {isAutoSaving
                ? 'sync'
                : hasPendingChanges
                ? '3s'
                : lastSavedTimestamp
                ? new Date(lastSavedTimestamp).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
                : 'OK'}
            </span>
          </button>

          {/* Theme Selector (Light / Dark / System) */}
          <div className="relative" ref={themeMenuRef}>
            <button
              type="button"
              onClick={() => setThemeMenuOpen(!themeMenuOpen)}
              className="flex items-center gap-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-900/60 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              title="Перемикач теми: Світла / Темна / Системна"
            >
              {theme === 'dark' ? (
                <Moon className="w-4 h-4 text-[#FF7A00]" />
              ) : theme === 'light' ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Monitor className="w-4 h-4 text-blue-500" />
              )}
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {themeMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#0F1422] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 text-xs animate-fade-in">
                <button
                  type="button"
                  onClick={() => handleSelectTheme('light')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    theme === 'light'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span>Світла ☀️</span>
                  </span>
                  {theme === 'light' && <Check className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectTheme('dark')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-[#FF6B00]/15 text-[#FF7A00] font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Moon className="w-3.5 h-3.5 text-[#FF7A00]" />
                    <span>Темна 🌙</span>
                  </span>
                  {theme === 'dark' && <Check className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectTheme('system')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    theme === 'system'
                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Monitor className="w-3.5 h-3.5 text-blue-500" />
                    <span>Системна 💻 (Авто)</span>
                  </span>
                  {theme === 'system' && <Check className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>

          {/* Language Toggle */}
          <button
            type="button"
            onClick={toggleLang}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900/60 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800/80 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            title="Перемкнути мову (UA / EN)"
          >
            <Globe className="w-3.5 h-3.5 text-[#FF7A00]" />
            <span className="font-mono uppercase">{lang}</span>
          </button>

          {/* User Profile Avatar with Online Status */}
          {currentUser ? (
            <button
              type="button"
              onClick={onOpenProfileDrawer}
              className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-900/70 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800/90 transition-all cursor-pointer group"
              title="Відкрити налаштування профілю селера"
            >
              <div className="relative">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#004BB7] to-[#002D6E] text-white flex items-center justify-center font-bold text-xs shadow-xs group-hover:scale-105 transition-transform">
                  {userInitials}
                </div>
                {/* Online pulse green dot */}
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0B0F19]" />
              </div>
              <div className="text-left hidden sm:block">
                <span className="block text-xs font-bold text-slate-900 dark:text-white leading-none truncate max-w-[120px]">
                  {currentUser.name}
                </span>
                <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  {currentUser.shopName || 'TechSmart'}
                </span>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#004BB7] hover:bg-blue-600 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{uiPreferences.t('nav.signIn', lang)}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
