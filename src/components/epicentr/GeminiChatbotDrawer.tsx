/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  MessageSquare,
  Send,
  Sparkles,
  Trash2,
  Cpu,
  Zap,
  Brain,
  Globe,
  ExternalLink
} from 'lucide-react';
import {
  auth,
  FirestoreChatMessage,
  saveChatMessageToFirestore,
  clearUserChatMessagesFromFirestore,
  subscribeUserChatMessages
} from '../../firebase';
import { callGeminiDirect } from '../../services/geminiClientDirect';

interface GeminiChatbotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  catalogSummary: string;
}

type ChatModelOption = 'gemini-4-argon' | 'gemini-3.8-flash' | 'gemini-3.1-flash-lite';

interface LocalChatMessage extends FirestoreChatMessage {
  sources?: Array<{ uri: string; title: string }>;
}

const WELCOME_MESSAGE: LocalChatMessage = {
  id: 'msg_welcome',
  uid: 'system',
  role: 'model',
  text: 'Вітаю! Я — ваш ШІ-асистент маркетплейсу Епіцентр. Допоможу сформувати назви за 7-компонентною формулою, підібрати обов’язкові характеристики з довідника, перевірити описи на стоп-слова або розібрати помилки XML-фіду. Оберіть режим моделі зверху та поставте запитання!',
  model: 'gemini-3.8-flash',
  createdAt: new Date().toISOString()
};

export const GeminiChatbotDrawer: React.FC<GeminiChatbotDrawerProps> = ({
  isOpen,
  onClose,
  catalogSummary
}) => {
  const [selectedModel, setSelectedModel] = useState<ChatModelOption>('gemini-3.8-flash');
  const [useSearchGrounding, setUseSearchGrounding] = useState<boolean>(false);
  const [messages, setMessages] = useState<LocalChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub = subscribeUserChatMessages(uid, (firestoreMsgs) => {
      if (firestoreMsgs.length > 0) {
        setMessages([WELCOME_MESSAGE, ...firestoreMsgs]);
      } else {
        setMessages([WELCOME_MESSAGE]);
      }
    });
    return () => unsub();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMsg: LocalChatMessage = {
      id: `msg_u_${Date.now()}`,
      uid: auth.currentUser?.uid || 'local',
      role: 'user',
      text: trimmed,
      model: selectedModel,
      createdAt: new Date().toISOString()
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setIsSending(true);

    if (auth.currentUser) {
      saveChatMessageToFirestore({
        id: userMsg.id,
        role: userMsg.role,
        text: userMsg.text,
        model: userMsg.model
      }).catch(() => {});
    }

    try {
      const apiMessages = nextHistory
        .filter((m) => m.id !== 'msg_welcome')
        .slice(-16)
        .map((m) => ({
          role: m.role,
          text: m.text
        }));

      const systemInstruction = `Ти — розумний PIM-асистент селера маркетплейсу Епіцентр.
Допомагай продавцям із заповненням характеристик, регламентом назв, категоріями, перекладами, вимогами до фото та модерацією.
Контекст каталогу: ${catalogSummary || 'Не завантажено'}`;

      const conversationText = apiMessages
        .map((m) => `${m.role === 'user' ? 'Користувач' : 'Асистент'}: ${m.text}`)
        .join('\n\n');

      const aiRes = await callGeminiDirect(conversationText, {
        systemInstruction,
        tools: useSearchGrounding ? [{ googleSearch: {} }] : undefined,
        maxOutputTokens: 600
      });

      const replyText = aiRes.text || (aiRes.error ? `Помилка: ${aiRes.error}` : 'Відповідь порожня.');

      const modelMsg: LocalChatMessage = {
        id: `msg_m_${Date.now()}`,
        uid: auth.currentUser?.uid || 'local',
        role: 'model',
        text: replyText,
        model: selectedModel,
        createdAt: new Date().toISOString(),
        sources: aiRes.sources || []
      };

      setMessages((prev) => [...prev, modelMsg]);

      if (auth.currentUser && !aiRes.error) {
        saveChatMessageToFirestore({
          id: modelMsg.id,
          role: modelMsg.role,
          text: modelMsg.text,
          model: modelMsg.model
        }).catch(() => {});
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          uid: 'local',
          role: 'model',
          text: `Помилка з'єднання: ${err?.message || 'Сервер недоступний'}`,
          model: selectedModel,
          createdAt: new Date().toISOString()
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearThread = async () => {
    if (auth.currentUser) {
      await clearUserChatMessagesFromFirestore(auth.currentUser.uid);
    }
    setMessages([WELCOME_MESSAGE]);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-lg bg-white dark:bg-[#0F1422] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#004BB7] to-[#FF6B00] flex items-center justify-center text-white shadow-sm">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  ШІ-Консультант Епіцентр Маркетплейс
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Багатоходовий чат із підтримкою 3 моделей Gemini та синхронізацією з Firestore
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleClearThread}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Очистити історію чату"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Model Selector Bar */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F19] space-y-2">
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedModel('gemini-4-argon')}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedModel === 'gemini-4-argon'
                    ? 'bg-purple-500/15 border-purple-500/50 text-purple-700 dark:text-purple-300 font-bold'
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1 text-[11px]">
                  <Brain className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span className="truncate">Складні задачі</span>
                </div>
                <div className="text-[9px] font-mono opacity-80 truncate mt-0.5">
                  gemini-4-argon
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedModel('gemini-3.8-flash')}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedModel === 'gemini-3.8-flash'
                    ? 'bg-blue-500/15 border-blue-500/50 text-blue-700 dark:text-blue-300 font-bold'
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1 text-[11px]">
                  <Cpu className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="truncate">Універсальний</span>
                </div>
                <div className="text-[9px] font-mono opacity-80 truncate mt-0.5">
                  gemini-3.8-flash
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedModel('gemini-3.1-flash-lite')}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedModel === 'gemini-3.1-flash-lite'
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-300 font-bold'
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center gap-1 text-[11px]">
                  <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate">Швидкі відповіді</span>
                </div>
                <div className="text-[9px] font-mono opacity-80 truncate mt-0.5">
                  gemini-3.1-flash-lite
                </div>
              </button>
            </div>

            {selectedModel !== 'gemini-3.1-flash-lite' && (
              <label className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-900/60 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#004BB7]" />
                  <span>Підключити живі дані Google Search у відповідях</span>
                </span>
                <input
                  type="checkbox"
                  checked={useSearchGrounding}
                  onChange={(e) => setUseSearchGrounding(e.target.checked)}
                  className="rounded accent-[#004BB7]"
                />
              </label>
            )}
          </div>

          {/* Scrollable Message Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#004BB7] text-white rounded-br-xs'
                      : 'bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700/80 rounded-bl-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-300/60 dark:border-slate-700 space-y-1">
                      <div className="text-[10px] font-bold opacity-75">Джерела Google Search:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((s, idx) => (
                          <a
                            key={idx}
                            href={s.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/80 dark:bg-slate-900 text-[10px] text-[#004BB7] dark:text-blue-400 hover:underline"
                          >
                            <span className="truncate max-w-[180px]">{s.title}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-mono mt-1 px-1">
                  {msg.role === 'user' ? 'Ви' : msg.model}
                </span>
              </div>
            ))}

            {isSending && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 px-2">
                <Sparkles className="w-4 h-4 text-[#FF7A00] animate-spin" />
                <span>Модель {selectedModel} формує відповідь...</span>
              </div>
            )}

            <div ref={threadEndRef} />
          </div>

          {/* Quick Prompt Chips & Input Form */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 space-y-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                'Перевір формулу назви для моїх товарів',
                'Які слова заборонені в описі Епіцентру?',
                'Як правильно заповнити multiselect розміри?'
              ].map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInput(q)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 shrink-0 cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>

            <form onSubmit={handleSend} className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Напишіть запитання щодо каталогу, назв або характеристик..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#004BB7]"
              />
              <button
                type="submit"
                disabled={isSending || !input.trim()}
                className="p-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#e66000] text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
