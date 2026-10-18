/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  KeyRound,
  ExternalLink,
  Mail,
  Cpu,
  Sparkles,
  RefreshCw,
  X,
  FileCheck,
  Check
} from 'lucide-react';
import { UserStoryProposal, ReleaseLogItem } from '../../types/userStories';
import { getRecordByToken, ADMIN_MODERATOR_EMAIL } from '../../services/moderationService';
import { compileAndDeployRelease, getUserStories, saveUserStories } from '../../services/userStoryEngine';
import { getStoredApiKey, maskApiKey } from '../../services/aiApiKeyService';

interface AdminApprovalModalProps {
  token: string | null;
  isOpen: boolean;
  onClose: () => void;
  onReleaseDeployed?: (release: ReleaseLogItem) => void;
  onOpenApiKeySettings?: () => void;
}

export const AdminApprovalModal: React.FC<AdminApprovalModalProps> = ({
  token,
  isOpen,
  onClose,
  onReleaseDeployed,
  onOpenApiKeySettings
}) => {
  const [story, setStory] = useState<UserStoryProposal | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilationLogs, setCompilationLogs] = useState<string[]>([]);
  const [compilationError, setCompilationError] = useState<string | null>(null);
  const [deployedRelease, setDeployedRelease] = useState<ReleaseLogItem | null>(null);
  const [byokKey, setByokKey] = useState<string | null>(getStoredApiKey());

  useEffect(() => {
    if (isOpen && token) {
      const rec = getRecordByToken(token);
      if (rec) {
        setStory(rec.storySnapshot);
      } else {
        // Search in all stories
        const all = getUserStories();
        const found = all.find(s => s.approvalToken === token || s.id === token);
        setStory(found || null);
      }
      setByokKey(getStoredApiKey());
      setCompilationError(null);
      setCompilationLogs([]);
      setDeployedRelease(null);
      setShowRejectForm(false);
    }
  }, [isOpen, token]);

  if (!isOpen || !token) return null;

  const handleApprove = () => {
    if (!story) return;

    setCompilationError(null);
    setIsCompiling(true);
    setCompilationLogs([
      `[MODERATOR] Запит на схвалення отримано від адміністратора (${ADMIN_MODERATOR_EMAIL})...`,
      `[BYOK CHECK] Перевірка наявності персонального ключа "epic_ai_key" в localStorage...`
    ]);

    setTimeout(() => {
      const result = compileAndDeployRelease(story, 'Схвалено адміністратором');
      setCompilationLogs(prev => [...prev, ...result.compilationLogs]);

      if (!result.success) {
        setIsCompiling(false);
        setCompilationError(
          result.error === 'MISSING_BYOK_KEY'
            ? 'Помилка компіляції: У автора відсутній ключ "epic_ai_key" у localStorage. За правилами платформи витрати на токени здійснюються за рахунок автора ідеї.'
            : 'Помилка компіляції релізу.'
        );
      } else {
        setIsCompiling(false);
        if (result.releaseItem) {
          setDeployedRelease(result.releaseItem);
          onReleaseDeployed?.(result.releaseItem);
        }
      }
    }, 900);
  };

  const handleReject = () => {
    if (!story) return;

    const all = getUserStories();
    const updated = all.map(s => {
      if (s.id === story.id) {
        return {
          ...s,
          status: 'rejected' as const,
          moderatedAt: new Date().toISOString(),
          moderatorDecision: 'rejected' as const,
          moderatorNotes: rejectionNotes.trim() || 'Відхилено адміністратором'
        };
      }
      return s;
    });

    saveUserStories(updated);
    setStory({
      ...story,
      status: 'rejected',
      moderatorNotes: rejectionNotes.trim() || 'Відхилено адміністратором'
    });
    setShowRejectForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-[#004BB7] to-blue-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-[#FF7A00]">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight">Панель модерації релізу</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold uppercase">
                  Admin
                </span>
              </div>
              <p className="text-xs text-blue-100 flex items-center gap-1 mt-0.5">
                <Mail className="w-3.5 h-3.5 text-blue-200" />
                <span>Отримувач сповіщення: {ADMIN_MODERATOR_EMAIL}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {!story ? (
            <div className="p-6 text-center space-y-2">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
              <div className="text-sm font-bold text-slate-800">
                Токен схвалення не знайдено або термін його дії минув
              </div>
              <p className="text-xs text-slate-500">
                Перевірте правильність посилання або виберіть User Story вручну в Лабораторії змін.
              </p>
            </div>
          ) : (
            <>
              {/* Story Details Card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      User Story ID: {story.id}
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                      {story.title}
                    </h3>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${
                      story.status === 'approved_and_deployed'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : story.status === 'rejected'
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                    }`}
                  >
                    {story.status === 'approved_and_deployed'
                      ? '✓ Схвалено та випущено'
                      : story.status === 'rejected'
                      ? '✕ Відхилено'
                      : 'Очікує модерації'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block">Роль та потреба:</span>
                    <span className="text-slate-800 font-semibold">{story.userRole}:</span>
                    <p className="text-slate-600 mt-0.5">{story.wantFeature}</p>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block">Очікувана вигода:</span>
                    <p className="text-slate-600 mt-0.5">{story.soThatBenefit}</p>
                  </div>
                </div>

                {story.evaluation && (
                  <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-lg text-xs flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="font-bold text-[#004BB7]">MoSCoW оцінка:</span>
                      <span className="ml-1.5 font-bold text-slate-800">
                        {story.evaluation.priority} (Вплив: {story.evaluation.businessImpactScore}/10, Ризик: {story.evaluation.riskLevel})
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 italic max-w-sm truncate">
                      {story.evaluation.summaryRationale}
                    </span>
                  </div>
                )}
              </div>

              {/* BYOK Status Card */}
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 ${
                  byokKey
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                    : 'bg-amber-50/80 border-amber-300 text-amber-950'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    byokKey ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'
                  }`}
                >
                  <KeyRound className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>Розрахунок витрат на токени (BYOK Policy):</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        byokKey ? 'bg-emerald-200 text-emerald-900 font-bold' : 'bg-amber-200 text-amber-900 font-bold'
                      }`}
                    >
                      {byokKey ? 'Ключ знайдено' : 'Ключ відсутній'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    {byokKey ? (
                      <>
                        Витрати на виклик моделі під час збірки релізу списуються з ключа автора: <code className="font-mono font-bold text-slate-800">{maskApiKey(byokKey)}</code> (localStorage: &quot;epic_ai_key&quot;).
                      </>
                    ) : (
                      <>
                        Увага: у чернетці відсутній ключ &quot;epic_ai_key&quot;. Додайте власний ключ Google AI Studio для покриття токенів запуску збірки.
                      </>
                    )}
                  </p>
                </div>
                {!byokKey && onOpenApiKeySettings && (
                  <button
                    type="button"
                    onClick={onOpenApiKeySettings}
                    className="px-2.5 py-1 rounded bg-[#004BB7] hover:bg-blue-700 text-white text-[11px] font-bold transition-colors shrink-0"
                  >
                    Додати ключ
                  </button>
                )}
              </div>

              {/* Error Message if compilation failed */}
              {compilationError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Помилка схвалення релізу</div>
                    <p className="text-[11px] mt-0.5">{compilationError}</p>
                  </div>
                </div>
              )}

              {/* Deployed Success Banner */}
              {deployedRelease && (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-950 space-y-2 animate-fadeIn">
                  <div className="flex items-center gap-2 font-bold text-emerald-900">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Реліз {deployedRelease.version} успішно скомпільовано та активовано!</span>
                  </div>
                  <p className="text-[11px] text-slate-700">
                    Статус User Story оновлено на <strong className="text-emerald-800">&quot;approved_and_deployed&quot;</strong>. Модифікація автоматично зафіксована в публічному журналі релізів платформи.
                  </p>
                </div>
              )}

              {/* Compilation Logs Terminal */}
              {compilationLogs.length > 0 && (
                <div className="bg-slate-900 text-emerald-400 p-3 rounded-xl font-mono text-[11px] space-y-1 max-h-36 overflow-y-auto border border-slate-800 shadow-inner">
                  {compilationLogs.map((log, idx) => (
                    <div key={idx} className="leading-relaxed">
                      {log}
                    </div>
                  ))}
                  {isCompiling && (
                    <div className="flex items-center gap-2 text-amber-300 animate-pulse pt-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Компіляція та розрахунок токенів...</span>
                    </div>
                  )}
                </div>
              )}

              {/* Rejection Form */}
              {showRejectForm && (
                <div className="p-3.5 bg-rose-50/60 border border-rose-200 rounded-xl space-y-2 text-xs">
                  <label className="font-bold text-rose-900 block">
                    Причина відхилення пропозиції (для зворотного зв'язку автору):
                  </label>
                  <textarea
                    rows={2}
                    value={rejectionNotes}
                    onChange={(e) => setRejectionNotes(e.target.value)}
                    placeholder="Вкажіть причину (наприклад: дублює існуючий функціонал або не відповідає регламенту контенту)..."
                    className="w-full p-2.5 rounded-lg border border-rose-300 bg-white text-xs text-slate-900 focus:outline-hidden focus:border-rose-500"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRejectForm(false)}
                      className="px-3 py-1 rounded-lg text-slate-600 hover:bg-slate-200 text-xs font-semibold"
                    >
                      Скасувати
                    </button>
                    <button
                      type="button"
                      onClick={handleReject}
                      className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors"
                    >
                      Підтвердити відхилення
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {story?.status === 'approved_and_deployed' ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Реліз успішно розгорнуто
              </span>
            ) : story?.status === 'rejected' ? (
              <span className="text-rose-700 font-bold">Пропозицію відхилено</span>
            ) : (
              <span>Рішення адміністратора обов'язкове для публікації релізу</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Закрити
            </button>

            {story && story.status !== 'approved_and_deployed' && story.status !== 'rejected' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowRejectForm(!showRejectForm)}
                  disabled={isCompiling}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Відхилити</span>
                </button>

                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isCompiling}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isCompiling ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Компіляція...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Підтвердити реліз (BYOK)</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
