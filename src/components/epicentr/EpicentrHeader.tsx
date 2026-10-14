import { useState } from 'react';
import {
  Layers,
  Plus,
  Share2,
  UploadCloud,
  Download,
  Clock,
  RefreshCw,
  Sparkles,
  Sliders,
  CheckCircle2,
  Globe
} from 'lucide-react';
import { DashboardTab } from '../../types/saas.ts';
import { downloadExcelTemplate } from '../../services/merchantDataParser.ts';

interface EpicentrHeaderProps {
  dashboards: DashboardTab[];
  activeDashboardId: string;
  onSelectDashboard: (id: string) => void;
  onDeleteDashboard?: (id: string) => void;
  onOpenCreateModal: () => void;
  onOpenAddWidgetModal: () => void;
  onOpenUploadModal: () => void;
  onOpenShareModal: () => void;
  onOpenSyncModal: () => void;
  onResetToSample: () => void;
  lastSyncDate: string;
}

export function EpicentrHeader({
  dashboards,
  activeDashboardId,
  onSelectDashboard,
  onDeleteDashboard,
  onOpenCreateModal,
  onOpenAddWidgetModal,
  onOpenUploadModal,
  onOpenShareModal,
  onOpenSyncModal,
  onResetToSample,
  lastSyncDate
}: EpicentrHeaderProps) {
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownloadTemplate = () => {
    downloadExcelTemplate();
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  return (
    <header className="border-b border-blue-900/60 bg-[#061226] sticky top-0 z-40 backdrop-blur-md shadow-xl">
      {/* Top Brand & Actions Bar */}
      <div className="max-w-[1680px] mx-auto px-4 lg:px-6 py-3 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        {/* Epicentr Marketplace Logo */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#004BB7] p-1 flex items-center justify-center shadow-lg shadow-blue-950/60 border border-blue-400/30">
            <span className="text-white font-extrabold text-2xl tracking-tighter select-none">
              Е
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight text-white uppercase">
                Епіцентр
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-extrabold uppercase bg-[#FF7A00] text-white shadow-xs">
                Маркетплейс
              </span>
              <span className="text-xs font-mono text-blue-300 font-semibold hidden sm:inline">
                SaaS Portal
              </span>
            </div>
            <p className="text-[11px] text-blue-200/80">
              Корпоративна аналітична панель моніторингу активності продавців
            </p>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Public Access (Share) Button */}
          <button
            onClick={onOpenShareModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/60 text-emerald-300 transition-colors cursor-pointer"
            title="Отримати публічне посилання на SaaS дашборд"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>Публічний доступ (Share)</span>
          </button>

          {/* Daily Sync Indicator */}
          <button
            onClick={onOpenSyncModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono bg-[#0b1b3d] hover:bg-blue-950 border border-blue-900/80 text-blue-300 transition-colors"
            title="Налаштувати час щоденного оновлення"
          >
            <Clock className="w-3.5 h-3.5 text-[#FF7A00]" />
            <span className="hidden sm:inline">Зріз:</span>
            <span className="text-white font-semibold">{lastSyncDate}</span>
          </button>

          {/* Download Template */}
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-[#0b1b3d] hover:bg-blue-950 border border-blue-900/80 text-slate-200 transition-colors"
            title="Завантажити зразок Excel файлу з правильними стовпчиками для Power BI"
          >
            {downloadSuccess ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Download className="w-3.5 h-3.5 text-blue-400" />
            )}
            <span className="hidden sm:inline">{downloadSuccess ? 'Завантажено!' : 'Шаблон для Power BI'}</span>
          </button>

          {/* Reset Demo Data */}
          <button
            onClick={onResetToSample}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs font-medium bg-[#0b1b3d] hover:bg-blue-950 border border-blue-900/60 text-slate-400 hover:text-slate-200 transition-colors"
            title="Відновити демо-дані"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden md:inline">Демо</span>
          </button>

          {/* Upload Excel from Power BI (Primary Button) */}
          <button
            onClick={onOpenUploadModal}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#FF7A00] hover:bg-[#ff8a1a] text-white shadow-lg shadow-orange-950/40 transition-all cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Завантажити Excel з Power BI</span>
          </button>
        </div>
      </div>

      {/* Dashboards Tabs Navigation Bar */}
      <div className="border-t border-blue-900/40 bg-[#08152e] px-4 lg:px-6 py-2">
        <div className="max-w-[1680px] mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
          {/* Tabs for dashboards */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider mr-1.5 shrink-0">
              Розділи:
            </span>
            {dashboards.map((dash) => {
              const isActive = activeDashboardId === dash.id;
              return (
                <div
                  key={dash.id}
                  className={`flex items-center rounded-xl border transition-all ${
                    isActive
                      ? 'bg-[#004BB7] text-white border-blue-400 shadow-md shadow-blue-950/50'
                      : 'bg-[#0b1b3d]/60 text-blue-200 border-blue-900/50 hover:bg-[#0b1b3d] hover:text-white'
                  }`}
                >
                  <button
                    onClick={() => onSelectDashboard(dash.id)}
                    className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer"
                  >
                    <span>{dash.title}</span>
                    {!dash.isPreset && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF7A00]" />
                    )}
                  </button>
                  {!dash.isPreset && onDeleteDashboard && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Видалити дашборд «${dash.title}»?`)) {
                          onDeleteDashboard(dash.id);
                        }
                      }}
                      className="pr-2.5 text-blue-300 hover:text-rose-400 text-xs transition-colors"
                      title="Видалити цей дашборд"
                    >
                      &times;
                    </button>
                  )}
                </div>
              );
            })}

            {/* "+ Створити дашборд" button */}
            <button
              onClick={onOpenCreateModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap bg-blue-950/70 hover:bg-blue-900 border border-dashed border-blue-600/80 text-blue-300 hover:text-white transition-colors cursor-pointer ml-1"
            >
              <Plus className="w-3.5 h-3.5 text-[#FF7A00]" />
              <span>+ Новий дашборд</span>
            </button>
          </div>

          {/* Customize / Add Widget button */}
          <div className="flex items-center gap-2 self-end md:self-center">
            <button
              onClick={onOpenAddWidgetModal}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#0b1b3d] hover:bg-blue-950 border border-blue-800 text-blue-200 hover:text-white transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-[#FF7A00]" />
              <span>+ Додати віджет</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
