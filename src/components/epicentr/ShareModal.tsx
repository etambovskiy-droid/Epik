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

  const inviteMessage = `Привіт! Ось доступ до SaaS-сервісу «Епіцентр Агент» для автоматичного заповнення Excel-шаблонів товарів за регламентом маркетплейсу:

🔗 Посилання для роботи: ${sharedUrl}

✨ Що вміє сервіс:
1. Заповнює обов'язкові характеристики за офіційним довідником значень
2. Зберігає коментарі комірок заголовків (JSON) та ID
3. Визначає базовий колір і візерунок за 1-м фото товару
4. Формує назви товарів за офіційною формулою Епіцентру (UA + RU)
5. Працює одразу в браузері, без встановлення додаткових програм!`;

  const handleCopyInviteText = () => {
    navigator.clipboard.writeText(inviteMessage);
    setCopiedInviteText(true);
    setTimeout(() => setCopiedInviteText(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-fadeIn">
      <div className="relative w-full max-w-2xl flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-800">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#004BB7] flex items-center justify-center text-white shadow-xs">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Надати додаток у користування іншим</h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Онлайн 24/7
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Передайте пряме посилання співробітникам, контент-менеджерам або партнерам
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-6 pt-2 text-xs">
          <button
            onClick={() => setActiveTab('link')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'link'
                ? 'border-[#004BB7] text-[#004BB7]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Пряме посилання</span>
          </button>

          <button
            onClick={() => setActiveTab('invite_text')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'invite_text'
                ? 'border-[#004BB7] text-[#004BB7]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Повідомлення в Telegram / Viber</span>
          </button>

          <button
            onClick={() => setActiveTab('qr')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'qr'
                ? 'border-[#004BB7] text-[#004BB7]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>QR-код</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 text-xs text-slate-600">
          {activeTab === 'link' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                    <Globe className="w-4 h-4 text-[#004BB7]" />
                    Публічна адреса застосунку:
                  </span>
                  <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Активно онлайн
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={sharedUrl}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-[#004BB7] select-all focus:outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF7A00] to-[#ea580c] hover:from-[#ff8a1a] hover:to-[#d94e07] text-white font-bold transition-all shadow-xs shrink-0 cursor-pointer"
                  >
                    {copiedLink ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'Скопійовано!' : 'Копіювати'}</span>
                  </button>
                  <a
                    href={sharedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 shrink-0"
                    title="Відкрити в новій вкладці"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                <p className="text-[11px] text-slate-500">
                  Будь-хто за цим посиланням може відкрити кабінет у браузері, завантажувати свої файли Excel та експортувати заповнені характеристики.
                </p>
              </div>

              {/* Roles selection */}
              <div className="space-y-2">
                <span className="font-bold text-slate-900 text-xs block">
                  Для кого ви надаєте доступ:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('content_manager')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedRole === 'content_manager'
                        ? 'bg-blue-50/80 border-[#004BB7] text-slate-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-bold text-slate-900 text-xs">Контент-менеджер</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Швидке заповнення характеристик</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('seller')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedRole === 'seller'
                        ? 'bg-blue-50/80 border-[#004BB7] text-slate-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-bold text-slate-900 text-xs">Селер / Партнер</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Масовий експорт готових шаблонів</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('client')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedRole === 'client'
                        ? 'bg-blue-50/80 border-[#004BB7] text-slate-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-bold text-slate-900 text-xs">Команда контенту</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Перевірка назв та довідників</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'invite_text' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs">
                  Шаблон повідомлення для відправки в чат або месенджер:
                </span>
                <button
                  onClick={handleCopyInviteText}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#004BB7] hover:bg-[#003d99] text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  {copiedInviteText ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedInviteText ? 'Текст скопійовано!' : 'Скопіювати весь текст'}</span>
                </button>
              </div>

              <textarea
                readOnly
                rows={9}
                value={inviteMessage}
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 select-all focus:outline-none leading-relaxed"
              />
            </div>
          )}

          {activeTab === 'qr' && (
            <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-36 h-36 rounded-2xl bg-white p-3 flex flex-col items-center justify-center text-slate-950 shadow-xs border border-slate-200 shrink-0">
                <QrCode className="w-24 h-24 text-slate-900" />
                <span className="text-[9px] font-bold text-center mt-1 uppercase tracking-wider text-[#004BB7]">
                  Епіцентр Агент
                </span>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">
                  Миттєвий запуск на смартфоні або планшеті
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Відскануйте QR-код камерою телефону, щоб перевіряти статус заповнення характеристик товарів у мобільному кабінеті без встановлення додатків.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Безпечний доступ без паролів через HTTPS</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#004BB7] hover:bg-[#003d99] text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Зрозуміло
          </button>
        </div>
      </div>
    </div>
  );
}
