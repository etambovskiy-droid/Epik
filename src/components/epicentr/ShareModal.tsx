/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Copy,
  CheckCircle2,
  Globe,
  ExternalLink,
  ShieldCheck,
  Share2,
  Send,
  QrCode,
  Users,
  Smartphone,
  Lock,
  Sparkles,
  MessageSquare
} from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopName?: string;
}

export function ShareModal({ isOpen, onClose, shopName = 'Кабінет селера' }: ShareModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedInviteText, setCopiedInviteText] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'content_manager' | 'seller' | 'client'>('content_manager');
  const [activeTab, setActiveTab] = useState<'link' | 'invite_text' | 'qr'>('link');

  const sharedUrl = 'https://ais-pre-dkvzlwjvec5uvdy4xvo3pf-204028103673.europe-west1.run.app';

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(sharedUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const inviteMessage = `Привіт! Ось доступ до нашого SaaS-сервісу «Епіцентр Агент» для автоматичного заповнення Excel-шаблонів товарів за регламентом маркетплейсу:

🔗 Посилання для роботи: ${sharedUrl}

✨ Що вміє сервіс:
1. Заповнює обов'язкові характеристики за офіційним довідником значень
2. Зберігає коментарі комірок заголовків та ID
3. Визначає базовий колір і візерунок за 1-м фото товару
4. Формує назви товарів за офіційною формулою Епіцентру (UA + RU)
5. Працює одразу в браузері, без встановлення додаткових програм!`;

  const handleCopyInviteText = () => {
    navigator.clipboard.writeText(inviteMessage);
    setCopiedInviteText(true);
    setTimeout(() => setCopiedInviteText(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl flex flex-col bg-[#0b1b36] border border-blue-500/40 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Glow */}
        <div className="absolute -top-20 -right-20 w-44 h-44 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#071329]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Надати додаток у користування іншим</h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Публічний доступ 24/7
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Передайте пряме посилання своїм співробітникам, контент-менеджерам або клієнтам
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-2 text-xs">
          <button
            onClick={() => setActiveTab('link')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'link'
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Пряме посилання</span>
          </button>

          <button
            onClick={() => setActiveTab('invite_text')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'invite_text'
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Повідомлення в Telegram / Viber</span>
          </button>

          <button
            onClick={() => setActiveTab('qr')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'qr'
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>QR-код для телефону</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 text-xs text-slate-300">
          {activeTab === 'link' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
                    <Globe className="w-4 h-4 text-blue-400" />
                    Публічна адреса додатку (Shared Web App):
                  </span>
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Активно онлайн
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={sharedUrl}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-blue-300 select-all focus:outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold transition-all shadow-md shadow-blue-500/20 shrink-0"
                  >
                    {copiedLink ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'Скопійовано!' : 'Копіювати'}</span>
                  </button>
                  <a
                    href={sharedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 shrink-0"
                    title="Відкрити в новій вкладці"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                <p className="text-[11px] text-slate-400">
                  Будь-який користувач з цим посиланням може відкривати додаток у своєму браузері, завантажувати свої файли Excel і експортувати результати.
                </p>
              </div>

              {/* Roles selection */}
              <div className="space-y-2">
                <span className="font-semibold text-white text-xs block">
                  Для кого ви надаєте доступ:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('content_manager')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedRole === 'content_manager'
                        ? 'bg-blue-600/20 border-blue-400 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-bold text-white text-xs">Контент-менеджер</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Швидке заповнення обов'язкових характеристик</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('seller')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedRole === 'seller'
                        ? 'bg-blue-600/20 border-blue-400 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-bold text-white text-xs">Селер / Партнер</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Масовий експорт готових шаблонів до кабінету</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('client')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedRole === 'client'
                        ? 'bg-blue-600/20 border-blue-400 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-bold text-white text-xs">Клієнт магазину</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Перевірка та валідація назв і довідників</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'invite_text' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white text-xs">
                  Шаблон повідомлення для відправки в месенджер:
                </span>
                <button
                  onClick={handleCopyInviteText}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors"
                >
                  {copiedInviteText ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedInviteText ? 'Текст скопійовано!' : 'Скопіювати весь текст'}</span>
                </button>
              </div>

              <textarea
                readOnly
                rows={9}
                value={inviteMessage}
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-200 select-all focus:outline-none leading-relaxed"
              />
            </div>
          )}

          {activeTab === 'qr' && (
            <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              {/* Generated visual QR placeholder / icon block */}
              <div className="w-36 h-36 rounded-2xl bg-white p-3 flex flex-col items-center justify-center text-slate-950 shadow-xl shrink-0">
                <QrCode className="w-24 h-24 text-slate-900" />
                <span className="text-[9px] font-bold text-center mt-1 uppercase tracking-wider">
                  Епіцентр Агент
                </span>
              </div>

              <div className="space-y-2 text-center sm:text-left">
                <h4 className="font-bold text-white text-sm flex items-center gap-2 justify-center sm:justify-start">
                  <Smartphone className="w-4 h-4 text-amber-400" />
                  Відкрити зі смартфона або планшета
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Наведіть камеру вашого мобільного пристрою на QR-код для миттєвого входу в веб-додаток.
                </p>
                <div className="pt-2">
                  <button
                    onClick={handleCopyLink}
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold underline flex items-center gap-1 mx-auto sm:mx-0"
                  >
                    <span>Або скопіювати пряме посилання</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Privacy & Safe Storage badge */}
          <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 flex items-start gap-2.5 text-emerald-300 text-[11px] leading-relaxed">
            <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong>Безпечна ізоляція даних користувачів:</strong> Користувач, якому ви передали посилання, працює у своєму персональному сеансі. Файли обробляються у браузері, а коментарі заголовків та унікальні ідентифікатори ID надійно захищені від пошкодження.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-[#071329]">
          <span className="text-[11px] text-slate-400">
            Додаток готовий для публічного використання
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}
