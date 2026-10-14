import { useState } from 'react';
import {
  Activity,
  Play,
  Pause,
  Zap,
  Download,
  FileSpreadsheet,
  FileText,
  Bell,
  RefreshCw,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { SystemAlert } from '../types/metrics.ts';

interface HeaderProps {
  isLive: boolean;
  onToggleLive: () => void;
  intervalMs: number;
  onChangeInterval: (ms: number) => void;
  loadMultiplier: number;
  isAnomalySurge: boolean;
  onToggleSurge: () => void;
  onExportCSV: () => void;
  onOpenReportModal: () => void;
  alerts: SystemAlert[];
  onOpenAlerts: () => void;
}

export function Header({
  isLive,
  onToggleLive,
  intervalMs,
  onChangeInterval,
  loadMultiplier,
  isAnomalySurge,
  onToggleSurge,
  onExportCSV,
  onOpenReportModal,
  alerts,
  onOpenAlerts
}: HeaderProps) {
  const [copiedSnapshot, setCopiedSnapshot] = useState(false);

  const activeAlertsCount = alerts.filter(a => !a.resolved).length;
  const criticalCount = alerts.filter(a => !a.resolved && a.severity === 'critical').length;

  const handleCopySnapshot = () => {
    const text = `PulseOps Telemetry Snapshot - ${new Date().toISOString()}\nStatus: Operational\nActive Unresolved Alerts: ${activeAlertsCount}\nSurge Test Mode: ${isAnomalySurge ? 'ACTIVE' : 'OFF'}`;
    navigator.clipboard.writeText(text);
    setCopiedSnapshot(true);
    setTimeout(() => setCopiedSnapshot(false), 2000);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md px-4 lg:px-6 py-3.5 transition-colors">
      <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Brand & Status */}
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-emerald-400 p-[1px] shadow-lg shadow-sky-950/40">
            <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
              <Activity className="w-5 h-5 text-sky-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                PulseOps
                <span className="text-xs font-normal text-slate-400">| Monitor</span>
              </h1>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-800/50 text-[11px] font-medium text-emerald-300">
                <span className="relative flex h-2 w-2">
                  {isLive && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isLive ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
                </span>
                <span>{isLive ? 'LIVE' : 'PAUSED'}</span>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Real-time Server Performance Telemetry &amp; User Engagement Stream
            </p>
          </div>
        </div>

        {/* Live Controls & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tick Frequency Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
            <span className="px-2 py-1 text-[11px] text-slate-400 font-mono">Rate:</span>
            {[1000, 2000, 5000].map((ms) => (
              <button
                key={ms}
                onClick={() => onChangeInterval(ms)}
                className={`px-2 py-1 rounded font-mono text-[11px] transition-colors ${
                  intervalMs === ms
                    ? 'bg-slate-800 text-sky-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {ms / 1000}s
              </button>
            ))}
          </div>

          {/* Pause / Resume Button */}
          <button
            onClick={onToggleLive}
            title={isLive ? 'Pause live metric streaming' : 'Resume live metric streaming'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isLive
                ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                : 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/60'
            }`}
          >
            {isLive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isLive ? 'Pause' : 'Resume'}</span>
          </button>

          {/* Load Surge Simulator Button */}
          <button
            onClick={onToggleSurge}
            title="Simulate high traffic spike and elevated latency"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              isAnomalySurge
                ? 'bg-amber-950/90 border-amber-600 text-amber-200 ring-2 ring-amber-500/30'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-slate-100'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${isAnomalySurge ? 'text-amber-400 fill-amber-400 animate-pulse' : 'text-slate-400'}`} />
            <span>{isAnomalySurge ? 'Surge Mode (Active)' : 'Simulate Surge'}</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={onExportCSV}
            title="Download real-time metrics dataset as CSV"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          {/* Executive Summary Modal */}
          <button
            onClick={onOpenReportModal}
            title="Generate executive briefing report"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-950/60 border border-sky-800/60 text-sky-300 hover:bg-sky-900/50 hover:text-sky-100 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-sky-400" />
            <span>Executive Brief</span>
          </button>

          {/* Alerts Trigger */}
          <button
            onClick={onOpenAlerts}
            title="View system alerts and incidents"
            className={`relative flex items-center justify-center p-2 rounded-lg border transition-colors ${
              criticalCount > 0
                ? 'bg-rose-950/80 border-rose-700/80 text-rose-300 animate-pulse'
                : activeAlertsCount > 0
                ? 'bg-amber-950/50 border-amber-700/50 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bell className="w-4 h-4" />
            {activeAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center">
                {activeAlertsCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
