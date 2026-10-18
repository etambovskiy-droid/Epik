/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  Trash2,
  Save,
  RefreshCw,
  Info
} from 'lucide-react';
import {
  getStoredApiKey,
  saveApiKey,
  removeApiKey,
  validateApiKeyFormat,
  testApiKeyConnection,
  AI_STORAGE_KEY
} from '../../services/aiApiKeyService';
import {
  epicentrMerchantApi,
  EPICENTR_TOKEN_STORAGE_KEY
} from '../../services/epicentrMerchantApiService';

interface ApiKeySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved?: (key: string) => void;
  initialWarningMessage?: string | null;
}

export const ApiKeySettingsModal: React.FC<ApiKeySettingsModalProps> = ({
  isOpen,
  onClose,
  onKeySaved,
  initialWarningMessage
}) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    message?: string;
    isWarningOnly?: boolean;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Epicentr Merchant API Token State
  const [activeSettingsTab, setActiveSettingsTab] = useState<'gemini' | 'epicentr'>('gemini');
  const [epicentrToken, setEpicentrToken] = useState('');
  const [showEpicentrToken, setShowEpicentrToken] = useState(false);
  const [isTestingEpicentr, setIsTestingEpicentr] = useState(false);
  const [epicentrTestResult, setEpicentrTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [epicentrSaveSuccess, setEpicentrSaveSuccess] = useState(false);

  // Load existing keys on open
  useEffect(() => {
    if (isOpen) {
      const existing = getStoredApiKey() || '';
      setApiKey(existing);
      setEpicentrToken(epicentrMerchantApi.getToken());
      setTestResult(null);
      setEpicentrTestResult(null);
      setSaveSuccess(false);
      setEpicentrSaveSuccess(false);
      if (existing) {
        setValidationResult(validateApiKeyFormat(existing));
      } else {
        setValidationResult(null);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (val: string) => {
    setApiKey(val);
    setSaveSuccess(false);
    setTestResult(null);
    if (!val.trim()) {
      setValidationResult(null);
      return;
    }
    setValidationResult(validateApiKeyFormat(val));
  };

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      removeApiKey();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      onKeySaved?.('');
      return;
    }

    const check = validateApiKeyFormat(trimmed);
    if (!check.isValid) {
      setValidationResult(check);
      return;
    }

    saveApiKey(trimmed);
    setSaveSuccess(true);
    onKeySaved?.(trimmed);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1200);
  };

  const handleRemove = () => {
    removeApiKey();
    setApiKey('');
    setValidationResult(null);
    setTestResult(null);
    onKeySaved?.('');
  };

  const handleTestConnection = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setValidationResult({ isValid: false, message: 'Будь ласка, введіть ключ для перевірки' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testApiKeyConnection(trimmed);
      setTestResult(res);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveEpicentr = () => {
    epicentrMerchantApi.saveToken(epicentrToken);
    setEpicentrSaveSuccess(true);
    setTimeout(() => {
      setEpicentrSaveSuccess(false);
      onClose();
    }, 1200);
  };

  const handleRemoveEpicentr = () => {
    epicentrMerchantApi.clearToken();
    setEpicentrToken('');
    setEpicentrTestResult(null);
  };

  const handleTestEpicentr = async () => {
    setIsTestingEpicentr(true);
    setEpicentrTestResult(null);
    try {
      const res = await epicentrMerchantApi.testConnection(epicentrToken);
      setEpicentrTestResult(res);
      if (res.success && epicentrToken.trim()) {
        epicentrMerchantApi.saveToken(epicentrToken);
      }
    } finally {
      setIsTestingEpicentr(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-[#f8fafc] via-white to-[#f8fafc] border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#FF7A00] shadow-2xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Налаштування API-ключів</span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-100 text-[#004BB7]">
                  API Settings
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Керування ключами авторизації для Gemini AI та Merchant API Епіцентр
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveSettingsTab('gemini')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeSettingsTab === 'gemini'
                ? 'border-[#004BB7] text-[#004BB7] bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Google AI Studio (Gemini)</span>
            {apiKey && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
          </button>
          <button
            type="button"
            onClick={() => setActiveSettingsTab('epicentr')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeSettingsTab === 'epicentr'
                ? 'border-[#FF7A00] text-[#FF7A00] bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>API Token Епіцентру</span>
            {epicentrToken && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
          </button>
        </div>

        {/* Content */}
        {activeSettingsTab === 'gemini' ? (
          <div className="p-6 space-y-4 overflow-y-auto">
          {/* Soft warning message if triggered by missing key action */}
          {initialWarningMessage && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{initialWarningMessage}</p>
                <p className="text-amber-700 mt-0.5">
                  Введіть ключ нижче, щоб активувати розумні функції обробки та розпізнавання характеристик.
                </p>
              </div>
            </div>
          )}

          {/* Key Input Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>API-ключ Google AI Studio</span>
                <span className="text-slate-400 font-mono font-normal text-[11px]">
                  (localStorage: &quot;{AI_STORAGE_KEY}&quot;)
                </span>
              </label>
              {apiKey && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Очистити</span>
                </button>
              )}
            </div>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="Вставте ваш ключ: AIzaSy..."
                className={`w-full pl-3.5 pr-24 py-2.5 rounded-xl border text-xs font-mono transition-all focus:outline-hidden ${
                  validationResult && !validationResult.isValid
                    ? 'border-rose-400 bg-rose-50/40 text-rose-950 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                    : validationResult?.isWarningOnly
                    ? 'border-amber-400 bg-amber-50/30 text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-200'
                    : 'border-slate-300 bg-white text-slate-900 focus:border-[#004BB7] focus:ring-2 focus:ring-blue-100'
                }`}
              />

              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {/* Visibility Toggle (Eye) */}
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title={showKey ? 'Приховати ключ' : 'Показати ключ'}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Validation Feedback */}
            {validationResult && (
              <div
                className={`mt-2 flex items-start gap-1.5 text-xs ${
                  !validationResult.isValid
                    ? 'text-rose-600'
                    : validationResult.isWarningOnly
                    ? 'text-amber-700'
                    : 'text-emerald-700'
                }`}
              >
                {!validationResult.isValid ? (
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                ) : validationResult.isWarningOnly ? (
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                )}
                <span>
                  {validationResult.message || 'Формат ключа відповідає стандарту Google AI Studio.'}
                </span>
              </div>
            )}
          </div>

          {/* Test Connection Action */}
          <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <div className="text-xs font-bold text-slate-800">Перевірка зв'язку</div>
              <div className="text-[11px] text-slate-500">
                Надіслати тестовий запит до моделі gemini-1.5-flash
              </div>
            </div>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || !apiKey.trim()}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#FF7A00]" />
                  <span>Перевірка...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-[#004BB7]" />
                  <span>Перевірити</span>
                </>
              )}
            </button>
          </div>

          {/* Test Result Message */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 font-medium">{testResult.message}</div>
            </div>
          )}

          {/* Instructions and Privacy Notice */}
          <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2 text-xs text-blue-950">
            <div className="flex items-center gap-1.5 font-bold text-[#004BB7]">
              <ShieldCheck className="w-4 h-4" />
              <span>Безпека та конфіденційність:</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11px]">
              <li>
                Ключ зберігається виключно у вашому браузері в <code className="font-mono bg-blue-100 px-1 py-0.5 rounded text-[#004BB7]">localStorage(&apos;epic_ai_key&apos;)</code>.
              </li>
              <li>
                Він використовується замість дефолтного середовища для всіх прямих запитів до Google AI Studio.
              </li>
              <li>
                Якщо ключ відсутній, застосунок попереджає користувача та працює на основі стандартних евристичних словників Епіцентру.
              </li>
            </ul>

            <div className="pt-1 border-t border-blue-200/60 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Немає власного ключа?</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-bold text-[#004BB7] hover:underline flex items-center gap-1"
              >
                <span>Отримати безкоштовно в Google AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
        ) : (
          <div className="p-6 space-y-4 overflow-y-auto">
            {/* Epicentr Bearer Token Section */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>Bearer Token продавця Епіцентру</span>
                  <span className="text-slate-400 font-mono font-normal text-[11px]">
                    (localStorage: &quot;{EPICENTR_TOKEN_STORAGE_KEY}&quot;)
                  </span>
                </label>
                {epicentrToken && (
                  <button
                    type="button"
                    onClick={handleRemoveEpicentr}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Очистити</span>
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  type={showEpicentrToken ? 'text' : 'password'}
                  value={epicentrToken}
                  onChange={(e) => setEpicentrToken(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full pl-3.5 pr-24 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:border-[#FF7A00] focus:ring-2 focus:ring-amber-100 text-xs font-mono transition-all focus:outline-hidden"
                />

                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowEpicentrToken(!showEpicentrToken)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title={showEpicentrToken ? 'Приховати токен' : 'Показати токен'}
                  >
                    {showEpicentrToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestEpicentr}
                disabled={isTestingEpicentr || !epicentrToken.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingEpicentr ? 'animate-spin text-amber-600' : ''}`} />
                <span>{isTestingEpicentr ? 'Перевірка Merchant API...' : 'Перевірити зв\'язок з PIM'}</span>
              </button>
            </div>

            {epicentrTestResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  epicentrTestResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {epicentrTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{epicentrTestResult.message}</span>
              </div>
            )}

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">Ендпоінти Epicentr PIM API:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] font-mono text-slate-600">
                <li>GET /v2/pim/categories — Каталог категорій</li>
                <li>GET /v2/pim/attribute-sets — Набори атрибутів та фільтрів</li>
              </ul>
              <div className="pt-1">
                <a
                  href="https://merchant-api.epicentrm.com.ua"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#004BB7] hover:underline flex items-center gap-1 font-sans font-semibold text-[11px]"
                >
                  <span>Документація Swagger merchant-api.epicentrm.com.ua</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {saveSuccess || epicentrSaveSuccess ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Збережено в localStorage!
              </span>
            ) : (
              <span>Натисніть &quot;Зберегти&quot; для фіксації змін</span>
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
            <button
              type="button"
              onClick={activeSettingsTab === 'gemini' ? handleSave : handleSaveEpicentr}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004BB7] hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Зберегти</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
