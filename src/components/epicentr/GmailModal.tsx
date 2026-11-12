/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Send,
  FileEdit,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Inbox,
  LogOut,
  Sparkles,
  ExternalLink,
  Shield,
  HelpCircle,
  User,
  Paperclip,
  Clock,
  ArrowRight
} from 'lucide-react';
import {
  getGmailAccessToken,
  setGmailAccessToken,
  clearGmailAccessToken,
  signInWithGoogleForGmail,
  auth
} from '../../firebase';
import {
  GmailService,
  GmailUserProfile,
  GmailMessageSummary,
  SendEmailPayload
} from '../../services/gmailService';
import { ShopWorkspace } from '../../services/workspaceStorage';
import { UserProfile } from '../../services/authService';

interface GmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile | null;
  currentShop?: ShopWorkspace | null;
  productsCount?: number;
  categoryTitle?: string;
}

export const GmailModal: React.FC<GmailModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentShop,
  productsCount = 0,
  categoryTitle = 'Каталог товарів'
}) => {
  const [accessToken, setAccessToken] = useState<string | null>(() => getGmailAccessToken());
  const [profile, setProfile] = useState<GmailUserProfile | null>(null);
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'inbox' | 'compose'>('inbox');
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Compose State
  const [toEmail, setToEmail] = useState('');
  const [ccEmail, setCcEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Explicit confirmation modal state (Required by workspace integration rules)
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);

  // Check and initialize token & profile
  useEffect(() => {
    if (!isOpen) return;

    const token = getGmailAccessToken();
    setAccessToken(token);

    if (token) {
      loadProfileAndInbox(token);
    }
  }, [isOpen]);

  const loadProfileAndInbox = async (token: string, query = '') => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const [userProfile, inboxData] = await Promise.all([
        GmailService.getProfile(token),
        GmailService.listMessages(token, query, 12)
      ]);
      setProfile(userProfile);
      setMessages(inboxData.messages);
    } catch (err: any) {
      console.error('Gmail load error:', err);
      if (err?.message?.includes('401') || err?.message?.includes('invalid_token')) {
        clearGmailAccessToken();
        setAccessToken(null);
        setProfile(null);
        setStatusMessage({
          type: 'info',
          text: 'Сесія доступу до Gmail закінчилася. Будь ласка, авторизуйтесь знову.'
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: err?.message || 'Не вдалося завантажити пошту Gmail'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setStatusMessage(null);
    try {
      const result = await signInWithGoogleForGmail();
      setAccessToken(result.accessToken);
      await loadProfileAndInbox(result.accessToken);
      setStatusMessage({
        type: 'success',
        text: 'Успішно підключено до Gmail!'
      });
    } catch (err: any) {
      console.error('Google Sign-in error:', err);
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Не вдалося підключитись до Google Workspace'
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleDisconnect = () => {
    clearGmailAccessToken();
    setAccessToken(null);
    setProfile(null);
    setMessages([]);
    setSelectedMessage(null);
    setStatusMessage({
      type: 'info',
      text: 'Доступ до Gmail відключено з оперативної пам’яті додатку.'
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    loadProfileAndInbox(accessToken, searchQuery);
  };

  // Pre-fill Epicentr merchant templates
  const applyTemplate = (templateType: 'export_report' | 'support' | 'moderation') => {
    const sellerCode = currentShop?.sellerCode || 'EP-89214';
    const shopName = currentShop?.name || currentUser?.shopName || 'Епіцентр Постач Трейд';
    const dateStr = new Date().toLocaleString('uk-UA');

    if (templateType === 'export_report') {
      setToEmail('content@epicentrk.ua');
      setCcEmail(profile?.emailAddress || '');
      setEmailSubject(`[${sellerCode}] Звіт про вивантаження XML-прайсу: ${categoryTitle}`);
      setEmailBody(
        `Доброго дня, команда контенту Епіцентр Маркетплейс!\n\n` +
          `Направляємо звіт про підготовку та вивантаження товарного каталогу.\n\n` +
          `Інформація про мерчанта:\n` +
          `• Код продавця: ${sellerCode}\n` +
          `• Назва кабінету: ${shopName}\n` +
          `• Категорія: ${categoryTitle}\n` +
          `• Кількість товарних позицій: ${productsCount || 'Каталог'}\n` +
          `• Дата генерації: ${dateStr}\n\n` +
          `XML-фід пройшов валідацію за регламентом Епіцентру, обов'язкові параметри та словникові значення узгоджено.\n\n` +
          `Просимо прийняти на перевірку та оновити позиції на вітрині.\n\n` +
          `З повагою,\n${currentUser?.name || shopName}\n${profile?.emailAddress || ''}`
      );
    } else if (templateType === 'support') {
      setToEmail('marketplace-support@epicentrk.ua');
      setCcEmail('');
      setEmailSubject(`[${sellerCode}] Звернення селера: запит на консультацію`);
      setEmailBody(
        `Вітаємо, служба підтримки партнерів Епіцентру!\n\n` +
          `Звертається мерчант ${shopName} (Код: ${sellerCode}).\n\n` +
          `Тема питання:\n` +
          `[Опишіть ваше питання, наприклад: уточнення API ключів / налаштування категорій / статус модерації]\n\n` +
          `Контактні дані:\n` +
          `• Відповідальна особа: ${currentUser?.name || 'Менеджер кабінету'}\n` +
          `• Email: ${profile?.emailAddress || currentUser?.email || ''}\n\n` +
          `Будемо вдячні за оперативну відповідь.\n`
      );
    } else if (templateType === 'moderation') {
      setToEmail('moderation@epicentrk.ua');
      setCcEmail('');
      setEmailSubject(`[${sellerCode}] Питання до категорійного менеджера щодо характеристик: ${categoryTitle}`);
      setEmailBody(
        `Доброго дня, шановний категорійний менеджер!\n\n` +
          `Мерчант: ${shopName} (Код: ${sellerCode})\n` +
          `Категорія: ${categoryTitle}\n\n` +
          `Звертаємось щодо модерації обов'язкових характеристик та дозволених значень (allowedValues).\n\n` +
          `Питання:\n` +
          `1. [Вкажіть назву характеристики або відсутнє значення в довіднику]\n` +
          `2. [Опис або посилання на офіційний сайт виробника]\n\n` +
          `Дякуємо за співпрацю!\n`
      );
    }
    setActiveTab('compose');
  };

  const handleInitiateSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!toEmail.trim() || !emailSubject.trim() || !emailBody.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Будь ласка, заповніть обов’язкові поля: Одержувач, Тема та Текст листа.'
      });
      return;
    }
    // Open mandatory confirmation modal
    setConfirmSendOpen(true);
  };

  const handleConfirmExecuteSend = async () => {
    if (!accessToken) return;
    setConfirmSendOpen(false);
    setIsSending(true);
    setStatusMessage(null);

    const payload: SendEmailPayload = {
      to: toEmail.trim(),
      cc: ccEmail.trim() || undefined,
      subject: emailSubject.trim(),
      bodyText: emailBody
    };

    try {
      await GmailService.sendEmail(accessToken, payload);
      setStatusMessage({
        type: 'success',
        text: `Лист успішно надіслано на адресу ${payload.to}!`
      });
      // Clear form
      setEmailSubject('');
      setEmailBody('');
      setToEmail('');
      setCcEmail('');
      setActiveTab('inbox');
      // Refresh inbox
      loadProfileAndInbox(accessToken);
    } catch (err: any) {
      console.error('Send email error:', err);
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Не вдалося надіслати лист через Gmail API'
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!accessToken) return;
    if (!toEmail.trim() && !emailSubject.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Для чернетки вкажіть хоча б тему або одержувача.'
      });
      return;
    }

    setIsSending(true);
    try {
      await GmailService.createDraft(accessToken, {
        to: toEmail.trim(),
        cc: ccEmail.trim() || undefined,
        subject: emailSubject.trim() || '(Без теми)',
        bodyText: emailBody
      });
      setStatusMessage({
        type: 'success',
        text: 'Чернетку успішно збережено у вашому обліковому записі Gmail!'
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Не вдалося створити чернетку'
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#0B0F19] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight">
                  Gmail для Епіцентр Маркетплейс
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-mono">
                  Google Workspace
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Комунікація з модерацією, категорійними менеджерами та підтримкою
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {accessToken && (
              <button
                type="button"
                onClick={handleDisconnect}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                title="Відключити Gmail (очистити токен із пам'яті)"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Відключити</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Toast Banner */}
        {statusMessage && (
          <div
            className={`px-6 py-2.5 text-xs font-medium flex items-center gap-2 border-b ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
                : 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            ) : statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            ) : (
              <Sparkles className="w-4 h-4 shrink-0 text-blue-500" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Content Body */}
        {!accessToken ? (
          /* Sign-in prompt following Google Brand Guidelines */
          <div className="p-8 flex flex-col items-center justify-center text-center max-w-xl mx-auto my-auto space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-500 border border-rose-200 dark:border-rose-900/50 shadow-inner">
              <Mail className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold">Підключіть ваш обліковий запис Gmail</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Надсилайте офіційні звіти про оновлення XML-прайсів, ведіть листування з
                категорійними менеджерами Епіцентру та отримуйте сповіщення модерації прямо з додатку.
              </p>
            </div>

            {/* Official Google Sign-in button */}
            <button
              type="button"
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 shadow-sm font-semibold text-sm transition-all hover:shadow-md cursor-pointer disabled:opacity-50"
            >
              {/* Official Google "G" logo SVG */}
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isSigningIn ? 'Авторизація через Google...' : 'Sign in with Google'}</span>
            </button>

            {/* Privacy & Security Note */}
            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800">
              <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>
                Безпека Workspace: токен доступу зберігається <strong>виключно в оперативній пам'яті</strong> та ніколи не передається третім сторонам.
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Bar with user profile & Quick Templates */}
            <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center font-bold text-xs border border-rose-500/30">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>{profile?.emailAddress || 'Завантаження...'}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" title="Активне підключення" />
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Всього листів: {profile?.messagesTotal?.toLocaleString() || '...'}
                  </div>
                </div>
              </div>

              {/* Quick Template Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                  Шаблони:
                </span>
                <button
                  type="button"
                  onClick={() => applyTemplate('export_report')}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-[#004BB7] dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 transition-colors cursor-pointer"
                  title="Шаблон звіту про новий XML-прайс для контент-менеджерів"
                >
                  Звіт про XML
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('support')}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 transition-colors cursor-pointer"
                  title="Запит до служби підтримки маркетплейсу"
                >
                  Підтримка
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('moderation')}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/80 transition-colors cursor-pointer"
                  title="Звернення до категорійного менеджера щодо характеристик"
                >
                  Питання КМ
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="px-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('inbox');
                  setSelectedMessage(null);
                }}
                className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'inbox'
                    ? 'border-rose-500 text-rose-600 dark:text-rose-400 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Inbox className="w-4 h-4" />
                <span>Вхідні ({messages.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('compose')}
                className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'compose'
                    ? 'border-rose-500 text-rose-600 dark:text-rose-400 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <FileEdit className="w-4 h-4" />
                <span>Написати лист</span>
              </button>

              {activeTab === 'inbox' && (
                <div className="ml-auto flex items-center gap-2 my-2">
                  <form onSubmit={handleSearch} className="relative">
                    <input
                      type="text"
                      placeholder="Пошук у листах..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-48 sm:w-64 pl-7 pr-3 py-1 rounded-lg text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-rose-500"
                    />
                    <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-400" />
                  </form>
                  <button
                    type="button"
                    onClick={() => accessToken && loadProfileAndInbox(accessToken, searchQuery)}
                    disabled={isLoading}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Оновити список"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              )}
            </div>

            {/* Tab Views */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'inbox' ? (
                /* INBOX VIEW */
                selectedMessage ? (
                  /* Detail view of clicked email */
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setSelectedMessage(null)}
                      className="flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      ← Назад до списку листів
                    </button>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="text-base font-bold text-slate-900 dark:text-white">
                            {selectedMessage.subject}
                          </h4>
                          <div className="text-xs text-slate-500 mt-1">
                            Від: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedMessage.from}</span>
                          </div>
                          {selectedMessage.to && (
                            <div className="text-xs text-slate-500">
                              Кому: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedMessage.to}</span>
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono shrink-0">
                          {selectedMessage.date}
                        </span>
                      </div>

                      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
                        {selectedMessage.snippet}
                      </div>

                      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            setToEmail(selectedMessage.from.match(/<([^>]+)>/)?.[1] || selectedMessage.from);
                            setEmailSubject(`Re: ${selectedMessage.subject.replace(/^Re:\s*/i, '')}`);
                            setEmailBody(`\n\n--- Початкове повідомлення ---\n${selectedMessage.snippet}`);
                            setActiveTab('compose');
                            setSelectedMessage(null);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer"
                        >
                          Відповісти
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Messages List */
                  <div className="space-y-2">
                    {isLoading ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-500" />
                        Завантаження повідомлень Gmail...
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="p-12 text-center text-slate-400">
                        <Inbox className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-semibold">Листів не знайдено</p>
                        <p className="text-xs text-slate-500 mt-1">
                          За вашим пошуковим запитом немає листів.
                        </p>
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg.id}
                          onClick={() => setSelectedMessage(msg)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                            msg.unread
                              ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 shadow-xs'
                              : 'bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {msg.unread && (
                                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                              )}
                              <span
                                className={`text-xs truncate ${
                                  msg.unread ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {msg.from.replace(/<[^>]+>/, '').trim() || msg.from}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                {msg.date ? new Date(msg.date).toLocaleDateString('uk-UA') : ''}
                              </span>
                            </div>
                            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate mt-0.5">
                              {msg.subject}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {msg.snippet}
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                        </div>
                      ))
                    )}
                  </div>
                )
              ) : (
                /* COMPOSE VIEW */
                <form onSubmit={handleInitiateSend} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Одержувач (To) *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="content@epicentrk.ua"
                        value={toEmail}
                        onChange={(e) => setToEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Копія (Cc)
                      </label>
                      <input
                        type="email"
                        placeholder="manager@my-shop.ua"
                        value={ccEmail}
                        onChange={(e) => setCcEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Тема листа *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Напр.: [EP-89214] Оновлення прайсу товарів"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Текст повідомлення *
                    </label>
                    <textarea
                      rows={9}
                      required
                      placeholder="Введіть текст звернення..."
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-rose-500 font-sans leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={isSending}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <FileEdit className="w-3.5 h-3.5" />
                      <span>Зберегти як чернетку</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEmailSubject('');
                          setEmailBody('');
                          setToEmail('');
                          setCcEmail('');
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                      >
                        Очистити
                      </button>
                      <button
                        type="submit"
                        disabled={isSending}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Надіслати лист</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mandatory User Confirmation Dialog before sending an email */}
      {confirmSendOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#0F1422] rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Підтвердження відправки листа
                </h3>
                <p className="text-xs text-slate-500">
                  Google Workspace вимагає явного підтвердження операції
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <div>
                <span className="text-slate-400">Одержувач:</span>{' '}
                <strong className="text-slate-800 dark:text-slate-200">{toEmail}</strong>
              </div>
              {ccEmail && (
                <div>
                  <span className="text-slate-400">Копія:</span>{' '}
                  <strong className="text-slate-800 dark:text-slate-200">{ccEmail}</strong>
                </div>
              )}
              <div>
                <span className="text-slate-400">Тема:</span>{' '}
                <strong className="text-slate-800 dark:text-slate-200">{emailSubject}</strong>
              </div>
              <div>
                <span className="text-slate-400">Відправник:</span>{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {profile?.emailAddress || 'Ваш Gmail акаунт'}
                </strong>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Лист буде надіслано безпосередньо через ваш поштовий сервер Gmail. Бажаєте продовжити?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmSendOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={handleConfirmExecuteSend}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/30 cursor-pointer"
              >
                Підтвердити та відправити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
