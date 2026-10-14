import { useState } from 'react';
import { X, Plus, Layers, Sparkles, CheckCircle2 } from 'lucide-react';
import { DashboardTab } from '../../types/saas.ts';

interface CreateDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, description: string, category: DashboardTab['category']) => void;
}

export function CreateDashboardModal({
  isOpen,
  onClose,
  onCreate
}: CreateDashboardModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<DashboardTab['category']>('custom');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate(title.trim(), description.trim() || 'Користувацький аналітичний зріз', category);
    setTitle('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg flex flex-col bg-[#0b1b3d] border border-blue-900/60 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header with Epicentr branding */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-900/60 bg-[#08142c]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#004BB7] flex items-center justify-center text-white font-bold shadow-md shadow-blue-900/50">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Створити новий дашборд</h3>
              <p className="text-xs text-blue-300">Додати нову вкладку у ваш аналітичний простір</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-blue-950 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
              Назва дашборду *
            </label>
            <input
              type="text"
              required
              placeholder="наприклад: Продажі у категоріях, ТОП нових постачальників..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#08142c] border border-blue-900/70 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#004BB7] focus:ring-1 focus:ring-[#004BB7]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
              Короткий опис
            </label>
            <textarea
              rows={2}
              placeholder="Опишіть призначення дашборду та ключові цілі аналітики..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#08142c] border border-blue-900/70 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#004BB7] focus:ring-1 focus:ring-[#004BB7]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
              Категорія / Тематика
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full bg-[#08142c] border border-blue-900/70 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#004BB7]"
            >
              <option value="custom">Власна аналітика</option>
              <option value="onboarding">Онбординг та мерчанти</option>
              <option value="sales">Продажі та замовлення</option>
              <option value="moderation">Контент та модерація</option>
            </select>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-blue-900/40">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#FF7A00] hover:bg-[#ff8a1a] text-white shadow-lg shadow-orange-950/40 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Створити вкладку</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
