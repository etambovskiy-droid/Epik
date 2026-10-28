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
  ShieldCheck,
  Trash2,
  Save,
  RefreshCw,
  Server
} from 'lucide-react';
import {
  epicentrMerchantApi,
  getEpicentrTokenStorageKey
} from '../../services/epicentrMerchantApiService';
import { authService } from '../../services/authService';

interface EpicentrTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTokenUpdated?: (token: string) => void;
}

export const EpicentrTokenModal: React.FC<EpicentrTokenModalProps> = ({
  isOpen,
  onClose,
  onTokenUpdated
}) => {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    categoriesCount?: number;
    source?: string;
  } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const activeStore = authService.getActiveStore();
  const activeStorageKey = getEpicentrTokenStorageKey(activeStore?.id);

  useEffect(() => {
    if (isOpen) {
      const stored = epicentrMerchantApi.getToken(activeStore?.id);
      setToken(stored);
      setTestResult(null);
      setSaveSuccess(false);
    }
  }, [isOpen, activeStore?.id]);

  if (!isOpen) return null;

  const handleSave = () => {
    epicentrMerchantApi.saveToken(token, activeStore?.id);
    setSaveSuccess(true);
    if (onTokenUpdated) {
      onTokenUpdated(token.trim());
    }
    setTimeout(() => {
      setSaveSuccess(false);
    }, 2500);
  };

  const handleClear = () => {
    epicentrMerchantApi.clearToken(activeStore?.id);
    setToken('');
    setTestResult(null);
    if (onTokenUpdated) {
      onTokenUpdated('');
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await epicentrMerchantApi.testConnection(token, activeStore?.id);
      setTestResult(res);
      if (res.success && token.trim()) {
        epicentrMerchantApi.saveToken(token, activeStore?.id);
        if (onTokenUpdated) {
          onTokenUpdated(token.trim());
        }
      }
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                API Token Епіцентру
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  {activeStore?.sellerCode || 'Merchant API'}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Магазин: <strong className="text-slate-200">{activeStore?.name || 'Поточний магазин'}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="mt-4 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300 flex items-start gap-2.5">
          <Server className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <span>
              Токен прив'язано до кабінету <strong className="text-amber-300">{activeStore?.name}</strong> та використовується для запитів до <code className="font-mono text-sky-300">/v2/pim/categories</code> та <code className="font-mono text-sky-300">/v2/pim/attribute-sets</code>.
            </span>
          </div>
        </div>

        {/* Input Field */}
        <div className="mt-4 space-y-2">
          <label className="block text-xs font-medium text-slate-300">
            Bearer Token продавця ({activeStore?.sellerCode || 'Merchant API'}):
          </label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setSaveSuccess(false);
              }}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full pl-3 pr-20 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded transition-colors"
                title={showToken ? 'Сховати' : 'Показати'}
              >
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" /> Зберігається ізольовано ({activeStorageKey})
            </span>
            <a
              href="https://merchant-api.epicentrm.com.ua"
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 hover:text-amber-300 flex items-center gap-1 hover:underline"
            >
              Документація Swagger <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Test Result Feedback */}
        {testResult && (
          <div
            className={`mt-4 p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              testResult.success
                ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300'
                : 'bg-rose-950/40 border-rose-700/60 text-rose-300'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-medium">{testResult.message}</p>
              {testResult.source && (
                <p className="text-[11px] opacity-80 font-mono">
                  Канал з'єднання: {testResult.source === 'direct' ? 'Direct Client Fetch' : 'CORS Proxy Layer'}
                </p>
              )}
            </div>
          </div>
        )}

        {saveSuccess && (
          <div className="mt-4 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-700/60 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Токен успішно збережено у браузері!</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <div>
            {token && (
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Видалити токен
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || !token.trim()}
              className="px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-amber-400' : ''}`} />
              {isTesting ? 'Перевірка...' : 'Перевірити зв\'язок'}
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={!token.trim()}
              className="px-4 py-2 text-xs font-medium rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              Зберегти
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
