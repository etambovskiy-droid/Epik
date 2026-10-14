import { useState } from 'react';
import {
  SystemAlert,
  MetricThresholds
} from '../types/metrics.ts';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Sliders,
  PlusCircle,
  Trash2,
  RotateCcw
} from 'lucide-react';

interface AlertsIncidentsViewProps {
  alerts: SystemAlert[];
  thresholds: MetricThresholds;
  onUpdateThresholds: (thresholds: MetricThresholds) => void;
  onAcknowledgeAlert: (alertId: string) => void;
  onResolveAlert: (alertId: string) => void;
  onClearResolved: () => void;
  onTriggerTestAlert: () => void;
}

export function AlertsIncidentsView({
  alerts,
  thresholds,
  onUpdateThresholds,
  onAcknowledgeAlert,
  onResolveAlert,
  onClearResolved,
  onTriggerTestAlert
}: AlertsIncidentsViewProps) {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  const filteredAlerts = alerts.filter((a) => {
    if (filterSeverity === 'all') return true;
    if (filterSeverity === 'unresolved') return !a.resolved;
    return a.severity === filterSeverity;
  });

  const severityIcons: Record<SystemAlert['severity'], React.ReactNode> = {
    critical: <AlertCircle className="w-4 h-4 text-rose-400" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    info: <Info className="w-4 h-4 text-sky-400" />
  };

  const severityBadges: Record<SystemAlert['severity'], string> = {
    critical: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
    warning: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
    info: 'bg-sky-950/60 text-sky-300 border-sky-800/60'
  };

  return (
    <div className="space-y-6">
      {/* Alert Policy & Configurable Thresholds */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-white">Configurable Alert Rules &amp; SLA Thresholds</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Dynamic Evaluation Engine</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* CPU Thresholds */}
          <div className="space-y-3 p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
              <span>Cluster CPU Load Alert</span>
              <span className="font-mono text-emerald-400">{thresholds.cpuWarning}% / {thresholds.cpuCritical}%</span>
            </div>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono mb-1">
                  <span>Warning Threshold</span>
                  <span>{thresholds.cpuWarning}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="90"
                  value={thresholds.cpuWarning}
                  onChange={(e) => onUpdateThresholds({ ...thresholds, cpuWarning: Number(e.target.value) })}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono mb-1">
                  <span>Critical Threshold</span>
                  <span>{thresholds.cpuCritical}%</span>
                </div>
                <input
                  type="range"
                  min="70"
                  max="98"
                  value={thresholds.cpuCritical}
                  onChange={(e) => onUpdateThresholds({ ...thresholds, cpuCritical: Number(e.target.value) })}
                  className="w-full accent-rose-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Latency Thresholds */}
          <div className="space-y-3 p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
              <span>P99 Response Latency Alert</span>
              <span className="font-mono text-amber-400">{thresholds.latencyWarning}ms / {thresholds.latencyCritical}ms</span>
            </div>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono mb-1">
                  <span>Warning Threshold</span>
                  <span>{thresholds.latencyWarning}ms</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="300"
                  value={thresholds.latencyWarning}
                  onChange={(e) => onUpdateThresholds({ ...thresholds, latencyWarning: Number(e.target.value) })}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono mb-1">
                  <span>Critical Threshold</span>
                  <span>{thresholds.latencyCritical}ms</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="800"
                  value={thresholds.latencyCritical}
                  onChange={(e) => onUpdateThresholds({ ...thresholds, latencyCritical: Number(e.target.value) })}
                  className="w-full accent-rose-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Error Rate Thresholds */}
          <div className="space-y-3 p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
              <span>5xx &amp; 4xx Error Rate Alert</span>
              <span className="font-mono text-rose-400">{thresholds.errorRateWarning}% / {thresholds.errorRateCritical}%</span>
            </div>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono mb-1">
                  <span>Warning Threshold</span>
                  <span>{thresholds.errorRateWarning}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={thresholds.errorRateWarning}
                  onChange={(e) => onUpdateThresholds({ ...thresholds, errorRateWarning: Number(e.target.value) })}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono mb-1">
                  <span>Critical Threshold</span>
                  <span>{thresholds.errorRateCritical}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.1"
                  value={thresholds.errorRateCritical}
                  onChange={(e) => onUpdateThresholds({ ...thresholds, errorRateCritical: Number(e.target.value) })}
                  className="w-full accent-rose-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Incident Log & Actions */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">Incident Timeline &amp; Anomaly Log</h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {filteredAlerts.length} recorded
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter buttons */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              {['all', 'unresolved', 'critical', 'warning'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterSeverity(f)}
                  className={`px-2 py-0.5 rounded text-[11px] capitalize transition-colors ${
                    filterSeverity === f
                      ? 'bg-slate-800 text-sky-300 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <button
              onClick={onTriggerTestAlert}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-sky-950/60 border border-sky-800/60 text-sky-300 hover:bg-sky-900/50 transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Simulate Incident</span>
            </button>

            <button
              onClick={onClearResolved}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Resolved</span>
            </button>
          </div>
        </div>

        {/* Alerts list */}
        <div className="space-y-3">
          {filteredAlerts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 font-mono">
              No matching incidents found. All cluster metrics nominal.
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border transition-all ${
                  alert.resolved
                    ? 'bg-slate-950/40 border-slate-800/50 opacity-60'
                    : alert.severity === 'critical'
                    ? 'bg-rose-950/20 border-rose-800/60 shadow-xs'
                    : 'bg-slate-950/70 border-slate-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{severityIcons[alert.severity]}</div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono uppercase font-bold border ${severityBadges[alert.severity]}`}>
                          {alert.severity}
                        </span>
                        <h4 className="text-sm font-semibold text-white">{alert.title}</h4>
                      </div>
                      <p className="text-xs text-slate-300">{alert.description}</p>
                      <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 pt-1">
                        <span>Target: {alert.nodeOrService}</span>
                        <span>Logged: {alert.timestamp}</span>
                        {alert.resolved && <span className="text-emerald-400 font-semibold">&bull; Resolved</span>}
                        {alert.acknowledged && !alert.resolved && <span className="text-amber-400 font-semibold">&bull; Acknowledged</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {!alert.acknowledged && !alert.resolved && (
                      <button
                        onClick={() => onAcknowledgeAlert(alert.id)}
                        className="px-2.5 py-1 text-xs rounded-lg bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 font-medium transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}
                    {!alert.resolved && (
                      <button
                        onClick={() => onResolveAlert(alert.id)}
                        className="px-2.5 py-1 text-xs rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 font-medium transition-colors flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolve</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
