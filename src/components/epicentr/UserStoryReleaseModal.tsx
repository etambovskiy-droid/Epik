/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  GitBranch,
  Terminal,
  CheckCircle2,
  Clock,
  HelpCircle,
  ArrowRight,
  TrendingUp,
  Cpu,
  Layers,
  FileCheck,
  Send,
  Check,
  AlertTriangle,
  History,
  Rocket,
  Mail,
  ShieldCheck,
  KeyRound,
  ExternalLink,
  Copy
} from 'lucide-react';
import {
  UserStoryProposal,
  ReleaseLogItem,
  ClarifyingQuestion,
  StoryEvaluation
} from '../../types/userStories';
import {
  getUserStories,
  saveUserStories,
  getReleasesLog,
  getCurrentAppVersion,
  evaluateUserStory,
  compileAndDeployRelease
} from '../../services/userStoryEngine';
import {
  sendModeratorEmailNotification,
  ADMIN_MODERATOR_EMAIL,
  EmailDispatchResult
} from '../../services/moderationService';
import { getStoredApiKey, maskApiKey } from '../../services/aiApiKeyService';

interface UserStoryReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVersionUpdated?: (newVer: string) => void;
  onOpenApprovalModal?: (token: string) => void;
  onOpenApiKeySettings?: () => void;
}

export const UserStoryReleaseModal: React.FC<UserStoryReleaseModalProps> = ({
  isOpen,
  onClose,
  onVersionUpdated,
  onOpenApprovalModal,
  onOpenApiKeySettings
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'evaluation' | 'compile' | 'changelog'>('create');
  const [stories, setStories] = useState<UserStoryProposal[]>(getUserStories());
  const [releases, setReleases] = useState<ReleaseLogItem[]>(getReleasesLog());
  const [currentVersion, setCurrentVersion] = useState<string>(getCurrentAppVersion());

  // Form state
  const [selectedStory, setSelectedStory] = useState<UserStoryProposal | null>(null);
  const [title, setTitle] = useState('');
  const [userRole, setUserRole] = useState('Як селер маркетплейсу Епіцентр');
  const [wantFeature, setWantFeature] = useState('');
  const [soThatBenefit, setSoThatBenefit] = useState('');
  
  // Interactive answers
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Email moderation notification state
  const [emailDispatchResult, setEmailDispatchResult] = useState<EmailDispatchResult | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [compilationError, setCompilationError] = useState<string | null>(null);
  const [byokKey, setByokKey] = useState<string | null>(getStoredApiKey());

  // Compilation live state
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilationLogs, setCompilationLogs] = useState<string[]>([]);
  const [compilationProgress, setCompilationProgress] = useState(0);
  const [compiledRelease, setCompiledRelease] = useState<ReleaseLogItem | null>(null);

  useEffect(() => {
    if (isOpen) {
      const s = getUserStories();
      const r = getReleasesLog();
      const v = getCurrentAppVersion();
      setStories(s);
      setReleases(r);
      setCurrentVersion(v);

      if (!selectedStory && s.length > 0) {
        setSelectedStory(s[0]);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle submit new story for evaluation & automated email dispatch
  const handleEvaluateNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !wantFeature) return;

    setIsEvaluating(true);
    setTimeout(() => {
      const { evaluation, clarifyingQuestions } = evaluateUserStory({
        title,
        userRole,
        wantFeature,
        soThatBenefit
      });

      const newStory: UserStoryProposal = {
        id: `story-${Date.now()}`,
        title,
        userRole,
        wantFeature,
        soThatBenefit,
        createdAt: new Date().toISOString(),
        status: 'pending_approval',
        evaluation,
        clarifyingQuestions
      };

      // 1. Automatic email notification to e.tambovskiy@gmail.com with approval token & link
      const emailResult = sendModeratorEmailNotification(newStory);
      newStory.approvalToken = emailResult.token;
      newStory.approvalEmailSentAt = new Date().toISOString();
      newStory.approvalEmailRecipient = ADMIN_MODERATOR_EMAIL;
      setEmailDispatchResult(emailResult);

      const updated = [newStory, ...stories];
      setStories(updated);
      saveUserStories(updated);
      setSelectedStory(newStory);

      const initialAns: Record<string, string> = {};
      clarifyingQuestions.forEach(q => {
        initialAns[q.id] = q.userAnswer || '';
      });
      setAnswers(initialAns);

      setIsEvaluating(false);
      setActiveTab('evaluation');
    }, 600);
  };

  const handleSelectTemplate = (templateTitle: string, role: string, want: string, benefit: string) => {
    setTitle(templateTitle);
    setUserRole(role);
    setWantFeature(want);
    setSoThatBenefit(benefit);
  };

  const handleSaveAnswers = () => {
    if (!selectedStory) return;

    const updatedQuestions = selectedStory.clarifyingQuestions.map(q => ({
      ...q,
      userAnswer: answers[q.id] || q.userAnswer || 'Підтверджено'
    }));

    const updatedStory: UserStoryProposal = {
      ...selectedStory,
      clarifyingQuestions: updatedQuestions,
      status: selectedStory.status === 'approved_and_deployed' ? 'approved_and_deployed' : 'ready_to_compile'
    };

    const updatedList = stories.map(s => s.id === updatedStory.id ? updatedStory : s);
    setStories(updatedList);
    saveUserStories(updatedList);
    setSelectedStory(updatedStory);
  };

  const handleRunCompilation = () => {
    if (!selectedStory) return;

    setIsCompiling(true);
    setCompilationLogs([]);
    setCompilationProgress(0);
    setCompilationError(null);
    setActiveTab('compile');

    const steps = [
      '1/5 [Pre-flight] Валідація контракту User Story та статусу модератора...',
      '2/5 [BYOK Authentication] Перевірка персонального ключа "epic_ai_key" у localStorage...',
      '3/5 [Engine Synthesis] Синтез правил перевірки характеристик та синонімів довідника...',
      '4/5 [TypeScript Compiler] Збірка та лінтинг компонентів без помилок...',
      '5/5 [Release Ready] Затвердження релізу та оновлення публічного логу...'
    ];

    steps.forEach((step, index) => {
      setTimeout(() => {
        setCompilationLogs(prev => [...prev, step]);
        const progress = Math.round(((index + 1) / steps.length) * 100);
        setCompilationProgress(progress);

        if (index === steps.length - 1) {
          const result = compileAndDeployRelease(selectedStory);

          if (!result.success) {
            setIsCompiling(false);
            setCompilationError(
              result.error === 'MISSING_BYOK_KEY'
                ? 'Увага: у локальному сховищі автора відсутній ключ "epic_ai_key". Запуск збірки релізу зупинено: витрати на токени мають покриватися автором ідеї (BYOK).'
                : 'Помилка компіляції релізу.'
            );
            setCompilationLogs(prev => [...prev, ...result.compilationLogs]);
            return;
          }

          if (result.releaseItem) {
            setCompiledRelease(result.releaseItem);
          }
          if (result.newVersion) {
            setCurrentVersion(result.newVersion);
          }
          setIsCompiling(false);
          setCompilationLogs(prev => [...prev, ...result.compilationLogs]);

          const updatedStory: UserStoryProposal = {
            ...selectedStory,
            status: 'approved_and_deployed',
            releasedVersion: result.newVersion
          };
          const updatedStories = stories.map(s => s.id === selectedStory.id ? updatedStory : s);
          setStories(updatedStories);
          saveUserStories(updatedStories);
          setSelectedStory(updatedStory);

          if (onVersionUpdated && result.newVersion) {
            onVersionUpdated(result.newVersion);
          }
        }
      }, (index + 1) * 400);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-800 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#004BB7] flex items-center justify-center text-white shadow-xs shrink-0">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Лабораторія покращень & Компілятор релізів</h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-[#004BB7]">
                  Поточна версія: {currentVersion}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Подавайте юзерсторі, відповідайте на уточнення та компілюйте персональні модифікації
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
            onClick={() => setActiveTab('create')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'create'
                ? 'border-[#004BB7] text-[#004BB7]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#FF7A00]" />
            <span>1. Подати User Story</span>
          </button>

          <button
            onClick={() => setActiveTab('evaluation')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'evaluation'
                ? 'border-[#004BB7] text-[#004BB7]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>2. Оцінка & Уточнення</span>
          </button>

          <button
            onClick={() => setActiveTab('compile')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'compile'
                ? 'border-[#004BB7] text-[#004BB7]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-4 h-4 text-purple-600" />
            <span>3. Компіляція релізу</span>
          </button>

          <button
            onClick={() => setActiveTab('changelog')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'changelog'
                ? 'border-[#004BB7] text-[#004BB7]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4 text-slate-500" />
            <span>Історія релізів ({releases.length})</span>
          </button>
        </div>

        {/* Tab 1: Create Story */}
        {activeTab === 'create' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-700">
            {/* Quick Templates */}
            <div className="space-y-2">
              <span className="font-bold text-slate-900 block text-xs">
                Популярні пропозиції від мерчантів Епіцентру (клікніть для вибору):
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectTemplate(
                    'Автоматична генерація та валідація штрихкодів EAN-13',
                    'Як контент-менеджер магазину',
                    'перевіряти розряд контрольної суми EAN-13 або генерувати код для товарів без штрихкоду',
                    'уникнути блокувань модераторами та пришвидшити публікацію товарів'
                  )}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-[#004BB7] text-left transition-all cursor-pointer"
                >
                  <div className="font-bold text-slate-900 text-xs">Генератор штрихкодів EAN-13</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Контрольна сума та авто-заповнення</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectTemplate(
                    'ШІ-оптимізація та рерайтинг описів товару',
                    'Як селер маркетплейсу',
                    'скорочувати довгі описи під ліміти символів та виправляти суржик у [ua] колонці',
                    'гарантувати проходження модерації з першого разу'
                  )}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-[#004BB7] text-left transition-all cursor-pointer"
                >
                  <div className="font-bold text-slate-900 text-xs">ШІ-рерайтинг описів товару</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Видалення стоп-слів та адаптація під мову</div>
                </button>
              </div>
            </div>

            {/* Custom Story Form */}
            <form onSubmit={handleEvaluateNew} className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="font-bold text-slate-900 block mb-1">
                  Назва пропозиції / модифікації:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Наприклад: Підтримка імпорту XML-фіду у форматі Hotline"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#004BB7]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Роль користувача (Хто ви?):
                  </label>
                  <input
                    type="text"
                    required
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value)}
                    placeholder="Як контент-менеджер..."
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#004BB7]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Чого саме ви хочете (Я хочу...):
                  </label>
                  <input
                    type="text"
                    required
                    value={wantFeature}
                    onChange={(e) => setWantFeature(e.target.value)}
                    placeholder="щоб сервіс автоматично..."
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#004BB7]"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Чому це важливо для вас (Щоб отримати...):
                </label>
                <textarea
                  rows={2}
                  required
                  value={soThatBenefit}
                  onChange={(e) => setSoThatBenefit(e.target.value)}
                  placeholder="економити 2 години на тиждень при обробці залишків і не робити це вручну..."
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#004BB7]"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isEvaluating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#004BB7] to-[#003d99] hover:from-[#0055cf] hover:to-[#004bb7] text-white font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#FF7A00]" />
                  <span>{isEvaluating ? 'Оцінюю пропозицію...' : 'Оцінити та згенерувати уточнення'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: Evaluation & Clarifying Questions */}
        {activeTab === 'evaluation' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-700">
            {selectedStory ? (
              <div className="space-y-4">
                {/* Story Overview */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono text-[#004BB7] uppercase font-bold tracking-wider">
                        {selectedStory.userRole}
                      </span>
                      <h4 className="text-base font-bold text-slate-900 mt-0.5">
                        {selectedStory.title}
                      </h4>
                      <p className="text-xs text-slate-600 mt-1">
                        Я хочу: <span className="text-slate-900 font-semibold">{selectedStory.wantFeature}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        Щоб: <span className="text-slate-700">{selectedStory.soThatBenefit}</span>
                      </p>
                    </div>

                    {selectedStory.evaluation && (
                      <div className="shrink-0 text-right space-y-1">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-[#d96500] border border-amber-200">
                          {selectedStory.evaluation.priority}
                        </span>
                        <div className="text-[11px] text-slate-500 font-mono mt-1">
                          Вплив: <strong className="text-emerald-700">{selectedStory.evaluation.businessImpactScore}/10</strong>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scorecard */}
                {selectedStory.evaluation && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 text-[11px] block">Бізнес-вплив (Value):</span>
                      <div className="text-xl font-bold text-emerald-700 mt-1">
                        {selectedStory.evaluation.businessImpactScore} / 10
                      </div>
                      <span className="text-[10px] text-slate-500">Швидкість підготовки</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 text-[11px] block">Технічна реалізованість:</span>
                      <div className="text-xl font-bold text-[#004BB7] mt-1">
                        {selectedStory.evaluation.implementationFeasibility} / 10
                      </div>
                      <span className="text-[10px] text-slate-500">Сумісність зі схемою</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 text-[11px] block">Рівень ризику імпорту:</span>
                      <div className="text-xl font-bold text-[#d96500] mt-1">
                        {selectedStory.evaluation.riskLevel}
                      </div>
                      <span className="text-[10px] text-slate-500">Захист ID та коментарів 100%</span>
                    </div>
                  </div>
                )}

                {/* Moderation Email & Approval Token Card */}
                {(emailDispatchResult || selectedStory.approvalToken) && (
                  <div className="p-4 bg-gradient-to-r from-blue-50/90 to-indigo-50/70 border border-blue-200 rounded-xl space-y-2.5 text-xs animate-fadeIn">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-300 flex items-center justify-center text-[#004BB7] shrink-0">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>Автоматичний лист відправлено:</span>
                            <span className="font-mono text-[#004BB7]">{ADMIN_MODERATOR_EMAIL}</span>
                          </div>
                          <p className="text-slate-500 text-[11px]">
                            У листі міститься повний опис та унікальне посилання-токен для схвалення релізу.
                          </p>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          selectedStory.status === 'approved_and_deployed'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : selectedStory.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {selectedStory.status === 'approved_and_deployed'
                          ? '✓ Схвалено та випущено (BYOK)'
                          : selectedStory.status === 'rejected'
                          ? '✕ Відхилено'
                          : '⏳ Очікує схвалення адміністратора'}
                      </span>
                    </div>

                    <div className="p-2.5 bg-white rounded-lg border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-[11px]">
                      <span className="truncate text-slate-600 max-w-sm">
                        Токен: {selectedStory.approvalToken || emailDispatchResult?.token}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => {
                            const token = selectedStory.approvalToken || emailDispatchResult?.token || '';
                            const url = `${window.location.origin}${window.location.pathname}?approval_token=${encodeURIComponent(token)}`;
                            navigator.clipboard.writeText(url);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          }}
                          className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-sans font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedLink ? 'Скопійовано!' : 'Скопіювати посилання'}</span>
                        </button>

                        {onOpenApprovalModal && (
                          <button
                            type="button"
                            onClick={() => onOpenApprovalModal(selectedStory.approvalToken || emailDispatchResult?.token || '')}
                            className="px-3 py-1 rounded-md bg-[#004BB7] hover:bg-blue-700 text-white text-[11px] font-sans font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                            <span>Перевірити як адміністратор</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Clarifying Questions */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-[#FF7A00]" />
                    <h5 className="font-bold text-slate-900 text-sm">
                      Уточнюючі запитання ШІ-агента (Чому це важливо та наскільки важливо):
                    </h5>
                  </div>
                  <p className="text-slate-500 text-xs">
                    Будь ласка, надайте відповіді або підтвердіть деталі перед компіляцією модифікації:
                  </p>

                  <div className="space-y-3 pt-1">
                    {selectedStory.clarifyingQuestions.map((q, idx) => (
                      <div key={q.id} className="p-3 rounded-lg bg-white border border-slate-200 space-y-1.5">
                        <div className="font-bold text-slate-900">
                          {idx + 1}. {q.question}
                        </div>
                        <div className="text-[11px] text-slate-500 italic">
                          💡 Контекст: {q.importancePrompt}
                        </div>
                        <input
                          type="text"
                          placeholder="Ваша відповідь або уточнення..."
                          value={answers[q.id] ?? (q.userAnswer || '')}
                          onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#004BB7] mt-1"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleSaveAnswers}
                      className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold transition-colors cursor-pointer"
                    >
                      Зберегти відповіді
                    </button>

                    <button
                      type="button"
                      onClick={handleRunCompilation}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition-all shadow-xs cursor-pointer"
                    >
                      <Rocket className="w-4 h-4" />
                      <span>Підтвердити та скомпілювати реліз</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                Оберіть або створіть User Story у вкладці 1.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Compile Live Terminal */}
        {activeTab === 'compile' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 shadow-inner space-y-3 min-h-[280px]">
              <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
                <span className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-400" />
                  <span>Release Compiler v2.4 (Live Pipeline)</span>
                </span>
                <span className="text-[11px] text-emerald-400 font-bold">
                  {compilationProgress}%
                </span>
              </div>

              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full transition-all duration-300"
                  style={{ width: `${compilationProgress}%` }}
                />
              </div>

              <div className="space-y-1.5 pt-2 text-[11px] text-slate-300">
                {compilationLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-purple-400 shrink-0">&gt;</span>
                    <span className={log.includes('Успішно') || log.includes('100% OK') || log.includes('Активація') ? 'text-emerald-300 font-bold' : ''}>
                      {log}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* BYOK Error Alert */}
            {compilationError && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-slate-900 text-sm">
                      Компіляцію зупинено: Потрібен ключ BYOK
                    </h5>
                    <p className="text-slate-700 text-[11px] mt-0.5">{compilationError}</p>
                  </div>
                </div>

                {onOpenApiKeySettings && (
                  <button
                    type="button"
                    onClick={onOpenApiKeySettings}
                    className="px-3.5 py-2 rounded-xl bg-[#004BB7] hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs shrink-0 cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Додати Google AI Key</span>
                  </button>
                )}
              </div>
            )}

            {compiledRelease && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <h5 className="font-bold text-slate-900 text-sm">
                      Реліз {compiledRelease.version} успішно скомпільовано та активовано!
                    </h5>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      Модифікація додана до активного середовища додатка за рахунок BYOK. Статус: approved_and_deployed.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('changelog')}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors shrink-0 cursor-pointer"
                >
                  Переглянути в Changelog
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Changelog */}
        {activeTab === 'changelog' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-slate-700">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-[#004BB7]" />
                Історія випущених модифікацій (Release Log)
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Поточна активна версія: <strong className="text-[#004BB7]">{currentVersion}</strong>
              </span>
            </div>

            <div className="space-y-3">
              {releases.map((rel, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-[#004BB7] px-2 py-0.5 rounded bg-blue-100 border border-blue-200">
                      {rel.version}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(rel.deployedAt).toLocaleDateString('uk-UA')}
                    </span>
                  </div>
                  <h5 className="font-bold text-slate-900 text-sm">
                    {rel.title}
                  </h5>
                  <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                    {rel.changesSummary.map((ch, i) => (
                      <li key={i}>{ch}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <span className="text-[11px] text-slate-500">
            Усі підтверджені релізи стають доступними селерам за публічним посиланням
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 transition-colors cursor-pointer"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
};
