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
  Rocket
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

interface UserStoryReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVersionUpdated?: (newVer: string) => void;
}

export const UserStoryReleaseModal: React.FC<UserStoryReleaseModalProps> = ({
  isOpen,
  onClose,
  onVersionUpdated
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

      // Default select first story if none selected
      if (!selectedStory && s.length > 0) {
        setSelectedStory(s[0]);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle submit new story for evaluation
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
        status: 'clarifying',
        evaluation,
        clarifyingQuestions
      };

      const updated = [newStory, ...stories];
      setStories(updated);
      saveUserStories(updated);
      setSelectedStory(newStory);

      // Initialize answers map
      const initialAns: Record<string, string> = {};
      clarifyingQuestions.forEach(q => {
        initialAns[q.id] = q.userAnswer || '';
      });
      setAnswers(initialAns);

      setIsEvaluating(false);
      setActiveTab('evaluation');
    }, 600);
  };

  // Quick template selection
  const handleSelectTemplate = (templateTitle: string, role: string, want: string, benefit: string) => {
    setTitle(templateTitle);
    setUserRole(role);
    setWantFeature(want);
    setSoThatBenefit(benefit);
  };

  // Handle answering clarifying questions
  const handleSaveAnswers = () => {
    if (!selectedStory) return;

    const updatedQuestions = selectedStory.clarifyingQuestions.map(q => ({
      ...q,
      userAnswer: answers[q.id] || q.userAnswer || 'Підтверджено'
    }));

    const updatedStory: UserStoryProposal = {
      ...selectedStory,
      clarifyingQuestions: updatedQuestions,
      status: 'ready_to_compile'
    };

    const updatedList = stories.map(s => s.id === updatedStory.id ? updatedStory : s);
    setStories(updatedList);
    saveUserStories(updatedList);
    setSelectedStory(updatedStory);
  };

  // Handle Compile and Deploy Release
  const handleRunCompilation = () => {
    if (!selectedStory) return;

    setIsCompiling(true);
    setCompilationLogs([]);
    setCompilationProgress(0);
    setActiveTab('compile');

    const result = compileAndDeployRelease(selectedStory);

    // Animate logs terminal
    result.compilationLogs.forEach((logLine, index) => {
      setTimeout(() => {
        setCompilationLogs(prev => [...prev, logLine]);
        setCompilationProgress(Math.round(((index + 1) / result.compilationLogs.length) * 100));

        if (index === result.compilationLogs.length - 1) {
          setIsCompiling(false);
          setCompiledRelease(result.releaseItem);
          setCurrentVersion(result.newVersion);

          // Update story status
          const updatedStory: UserStoryProposal = {
            ...selectedStory,
            status: 'released',
            releasedVersion: result.newVersion,
            releasedAt: new Date().toISOString(),
            isActiveFeature: true
          };
          const updatedStories = stories.map(s => s.id === updatedStory.id ? updatedStory : s);
          setStories(updatedStories);
          saveUserStories(updatedStories);
          setSelectedStory(updatedStory);

          if (onVersionUpdated) {
            onVersionUpdated(result.newVersion);
          }
        }
      }, (index + 1) * 450);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-[#0b1b36] border border-blue-500/40 rounded-2xl shadow-2xl overflow-hidden text-slate-200 max-h-[92vh] flex flex-col">
        {/* Glow */}
        <div className="absolute -top-28 -right-28 w-56 h-56 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#071329]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Лабораторія покращень & Компілятор релізів</h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Поточна версія: {currentVersion}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Подавайте юзерсторі, відповідайте на уточнюючі питання та компілюйте персональні модифікації
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
            onClick={() => setActiveTab('create')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>1. Подати User Story</span>
          </button>

          <button
            onClick={() => setActiveTab('evaluation')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'evaluation'
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>2. Оцінка & Уточнення</span>
          </button>

          <button
            onClick={() => setActiveTab('compile')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'compile'
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4 text-purple-400" />
            <span>3. Компіляція релізу</span>
          </button>

          <button
            onClick={() => setActiveTab('changelog')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'changelog'
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4 text-slate-400" />
            <span>Історія релізів ({releases.length})</span>
          </button>
        </div>

        {/* Tab 1: Create Story */}
        {activeTab === 'create' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-300">
            {/* Quick Templates */}
            <div className="space-y-2">
              <span className="font-bold text-white block text-xs">
                Популярні пропозиції від селерів (клікніть для вибору):
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
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-blue-500/50 text-left transition-all"
                >
                  <div className="font-bold text-white text-xs">Генератор штрихкодів EAN-13</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Контрольна сума та авто-заповнення</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectTemplate(
                    'ШІ-оптимізація та рерайтинг описів товару',
                    'Як селер маркетплейсу',
                    'скорочувати довгі описи під ліміти символів та виправляти суржик у [ua] колонці',
                    'гарантувати проходження модерації з першого разу'
                  )}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-blue-500/50 text-left transition-all"
                >
                  <div className="font-bold text-white text-xs">ШІ-рерайтинг описів товару</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Видалення стоп-слів та адаптація під мову</div>
                </button>
              </div>
            </div>

            {/* Custom Story Form */}
            <form onSubmit={handleEvaluateNew} className="space-y-3.5 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
              <div>
                <label className="font-bold text-white block mb-1">
                  Назва пропозиції / модифікації:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Наприклад: Підтримка імпорту XML-фіду у форматі Hotline"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-slate-300 block mb-1">
                    Роль користувача (Хто ви?):
                  </label>
                  <input
                    type="text"
                    required
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value)}
                    placeholder="Як контент-менеджер..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="font-medium text-slate-300 block mb-1">
                    Чого саме ви хочете (Я хочу...):
                  </label>
                  <input
                    type="text"
                    required
                    value={wantFeature}
                    onChange={(e) => setWantFeature(e.target.value)}
                    placeholder="щоб сервіс автоматично..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-medium text-slate-300 block mb-1">
                  Чому це важливо для вас (Щоб отримати...):
                </label>
                <textarea
                  rows={2}
                  required
                  value={soThatBenefit}
                  onChange={(e) => setSoThatBenefit(e.target.value)}
                  placeholder="економити 2 години на тиждень при обробці залишків і не робити це вручну..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isEvaluating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold transition-all shadow-md shadow-blue-500/25"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>{isEvaluating ? 'Оцінюю пропозицію...' : 'Оцінити та згенерувати уточнення'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: Evaluation & Clarifying Questions */}
        {activeTab === 'evaluation' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-300">
            {selectedStory ? (
              <div className="space-y-4">
                {/* Story Overview */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono text-blue-400 uppercase font-bold tracking-wider">
                        {selectedStory.userRole}
                      </span>
                      <h4 className="text-base font-bold text-white mt-0.5">
                        {selectedStory.title}
                      </h4>
                      <p className="text-xs text-slate-300 mt-1">
                        Я хочу: <span className="text-white font-medium">{selectedStory.wantFeature}</span>
                      </p>
                      <p className="text-xs text-slate-400">
                        Щоб: <span className="text-slate-200">{selectedStory.soThatBenefit}</span>
                      </p>
                    </div>

                    {selectedStory.evaluation && (
                      <div className="shrink-0 text-right space-y-1">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {selectedStory.evaluation.priority}
                        </span>
                        <div className="text-[11px] text-slate-400 font-mono mt-1">
                          Вплив: <strong className="text-emerald-400">{selectedStory.evaluation.businessImpactScore}/10</strong>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Evaluation Scorecard */}
                {selectedStory.evaluation && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-400 text-[11px] block">Бізнес-вплив (Value):</span>
                      <div className="text-xl font-bold text-emerald-400 mt-1">
                        {selectedStory.evaluation.businessImpactScore} / 10
                      </div>
                      <span className="text-[10px] text-slate-500">Прямий вплив на швидкість імпорту</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-400 text-[11px] block">Технічна реалізованість:</span>
                      <div className="text-xl font-bold text-blue-400 mt-1">
                        {selectedStory.evaluation.implementationFeasibility} / 10
                      </div>
                      <span className="text-[10px] text-slate-500">Сумісність з Excel-схемою</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-400 text-[11px] block">Рівень ризику імпорту:</span>
                      <div className="text-xl font-bold text-amber-300 mt-1">
                        {selectedStory.evaluation.riskLevel}
                      </div>
                      <span className="text-[10px] text-slate-500">Захист ID та коментарів гарантовано</span>
                    </div>
                  </div>
                )}

                {/* Clarifying Questions (The core prompt request) */}
                <div className="p-4 rounded-xl bg-[#071329] border border-blue-900/40 space-y-3">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-amber-400" />
                    <h5 className="font-bold text-white text-sm">
                      Уточнюючі запитання ШІ-агента (Чому це важливо та наскільки важливо):
                    </h5>
                  </div>
                  <p className="text-slate-400 text-xs">
                    Будь ласка, надайте відповіді або підтвердіть деталі перед компіляцією модифікації:
                  </p>

                  <div className="space-y-3 pt-1">
                    {selectedStory.clarifyingQuestions.map((q, idx) => (
                      <div key={q.id} className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1.5">
                        <div className="font-semibold text-white">
                          {idx + 1}. {q.question}
                        </div>
                        <div className="text-[11px] text-slate-400 italic">
                          💡 Контекст: {q.importancePrompt}
                        </div>
                        <input
                          type="text"
                          placeholder="Ваша відповідь або уточнення..."
                          value={answers[q.id] ?? (q.userAnswer || '')}
                          onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-400 mt-1"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleSaveAnswers}
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
                    >
                      Зберегти відповіді
                    </button>

                    <button
                      type="button"
                      onClick={handleRunCompilation}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition-all shadow-md shadow-emerald-500/20"
                    >
                      <Rocket className="w-4 h-4" />
                      <span>Підтвердити та скомпілювати реліз</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                Оберіть або створіть User Story у вкладці 1.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Compile Live Terminal */}
        {activeTab === 'compile' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 shadow-inner space-y-3 min-h-[280px]">
              <div className="flex items-center justify-between text-slate-400 border-b border-slate-800/80 pb-2">
                <span className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-400" />
                  <span>Release Compiler v2.4 (Live Pipeline)</span>
                </span>
                <span className="text-[11px] text-emerald-400">
                  {compilationProgress}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full transition-all duration-300"
                  style={{ width: `${compilationProgress}%` }}
                />
              </div>

              {/* Terminal Logs */}
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

            {compiledRelease && (
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <h5 className="font-bold text-white text-sm">
                      Реліз {compiledRelease.version} успішно скомпільовано та активовано!
                    </h5>
                    <p className="text-slate-300 text-[11px] mt-0.5">
                      Модифікація додана до активного середовища додатка.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('changelog')}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors shrink-0"
                >
                  Переглянути в Changelog
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Changelog & Releases */}
        {activeTab === 'changelog' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-slate-300">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-white text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-blue-400" />
                Історія випущених модифікацій (Release Log)
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Поточна активна версія: <strong className="text-blue-300">{currentVersion}</strong>
              </span>
            </div>

            <div className="space-y-3">
              {releases.map((rel, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-blue-300 px-2 py-0.5 rounded bg-blue-950 border border-blue-800">
                      {rel.version}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(rel.deployedAt).toLocaleDateString('uk-UA')}
                    </span>
                  </div>
                  <h5 className="font-bold text-white text-sm">
                    {rel.title}
                  </h5>
                  <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-[#071329]">
          <span className="text-[11px] text-slate-400">
            Усі підтверджені релізи стають доступними усім користувачам за публічним посиланням
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
};
