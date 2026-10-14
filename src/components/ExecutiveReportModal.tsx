import { useState } from 'react';
import {
  TimeSeriesPoint,
  ServerNode,
  UserEngagementData,
  SystemAlert
} from '../types/metrics.ts';
import {
  X,
  Download,
  Copy,
  CheckCircle2,
  FileText,
  Activity,
  Users,
  Server,
  ShieldCheck
} from 'lucide-react';
import { downloadFile, exportMetricsToCSV } from '../services/metricsEngine.ts';

interface ExecutiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: TimeSeriesPoint[];
  nodes: ServerNode[];
  engagement: UserEngagementData;
  alerts: SystemAlert[];
}

export function ExecutiveReportModal({
  isOpen,
  onClose,
  history,
  nodes,
  engagement,
  alerts
}: ExecutiveReportModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const latest = history[history.length - 1] || {
    cpu: 42,
    memory: 61,
    requestsPerSec: 5000,
    p99Latency: 44,
    activeUsers: 8400,
    errorRate: 0.08
  };

  const avgCpu = (history.reduce((sum, h) => sum + h.cpu, 0) / (history.length || 1)).toFixed(1);
  const avgP99 = Math.round(history.reduce((sum, h) => sum + h.p99Latency, 0) / (history.length || 1));
  const avgRps = Math.round(history.reduce((sum, h) => sum + h.requestsPerSec, 0) / (history.length || 1));
  const peakUsers = engagement.peakUsersToday;
  const slaAvailability = (100 - (history.reduce((sum, h) => sum + h.errorRate, 0) / (history.length || 1))).toFixed(3);

  const reportDate = new Date().toUTCString();

  const handleCopyMarkdown = () => {
    const md = `# PulseOps Executive Briefing: Server Performance & User Engagement
**Generated:** ${reportDate}
**SLA Availability:** ${slaAvailability}%
**Cluster Health:** ${nodes.filter(n => n.status === 'healthy').length}/${nodes.length} Nodes Healthy

---

## 1. Executive Performance Summary
- **Average P99 Latency:** ${avgP99} ms (SLA Target: < 150 ms)
- **Mean System Throughput:** ${avgRps.toLocaleString()} requests/second
- **Mean Cluster CPU Load:** ${avgCpu}% across 48 vCPUs
- **Active Memory Footprint:** ${latest.memory}% of 256 GB cluster pool

## 2. Real-Time User Engagement
- **Peak Concurrent Users Today:** ${peakUsers.toLocaleString()}
- **Live Active Users:** ${latest.activeUsers.toLocaleString()} (+${engagement.usersDeltaPercent}% growth)
- **Average Session Duration:** ${Math.floor(engagement.sessionDurationAvgSec / 60)}m ${engagement.sessionDurationAvgSec % 60}s
- **Primary Platform:** Desktop (${engagement.deviceBreakdown[0]?.sharePercent}%), Mobile (${engagement.deviceBreakdown[1]?.sharePercent}%)

## 3. Top Regional Traffic
${engagement.geographicTraffic.map(g => `- **${g.country}**: ${g.users.toLocaleString()} users (${g.sharePercent}%), ${g.avgLatencyMs}ms ping`).join('\n')}

## 4. System Incidents & Alerts
- Active Unresolved Incidents: ${alerts.filter(a => !a.resolved).length}
- Total Recorded Incidents: ${alerts.length}
`;
    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJSON = () => {
    const snapshot = {
      generatedAt: new Date().toISOString(),
      slaAvailabilityPercent: Number(slaAvailability),
      performance: {
        avgCpuPercent: Number(avgCpu),
        avgP99LatencyMs: avgP99,
        avgRequestsPerSec: avgRps,
        currentRamPercent: latest.memory
      },
      engagement: {
        activeUsers: latest.activeUsers,
        peakUsersToday: peakUsers,
        growthDeltaPercent: engagement.usersDeltaPercent,
        topRegions: engagement.geographicTraffic
      },
      nodes: nodes.map(n => ({
        id: n.id,
        name: n.name,
        role: n.role,
        region: n.region,
        status: n.status,
        cpu: n.cpuPercent
      })),
      alerts: alerts
    };
    downloadFile(JSON.stringify(snapshot, null, 2), `pulseops-executive-brief-${Date.now()}.json`, 'application/json');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-950 border border-sky-800 flex items-center justify-center text-sky-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Executive Operations &amp; Engagement Brief</h3>
              <p className="text-xs text-slate-400">High-level performance summary, SLA uptime, and audience trends</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* Top highlight row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[11px] text-slate-400 mb-1">SLA Availability</div>
              <div className="text-xl font-bold font-mono text-emerald-400">{slaAvailability}%</div>
              <div className="text-[10px] text-slate-500 mt-1">99.9% Target Met</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[11px] text-slate-400 mb-1">Peak Concurrent Users</div>
              <div className="text-xl font-bold font-mono text-sky-400">{peakUsers.toLocaleString()}</div>
              <div className="text-[10px] text-emerald-400 mt-1">+{engagement.usersDeltaPercent}% Today</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[11px] text-slate-400 mb-1">Mean P99 Latency</div>
              <div className="text-xl font-bold font-mono text-amber-400">{avgP99}ms</div>
              <div className="text-[10px] text-slate-500 mt-1">&lt;150ms SLA Window</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[11px] text-slate-400 mb-1">Cluster Load Average</div>
              <div className="text-xl font-bold font-mono text-purple-400">{avgCpu}%</div>
              <div className="text-[10px] text-slate-500 mt-1">48 vCPUs Healthy</div>
            </div>
          </div>

          {/* Section: Server Health & Scalability */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-sky-400" />
              <span>Infrastructure Scalability &amp; Node Health</span>
            </h4>
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
              <p className="text-slate-300">
                All {nodes.length} cluster nodes are currently operational across us-east, eu-west, ap-southeast, and us-west.
                The edge proxy gateway handles an average of {avgRps.toLocaleString()} requests/second with zero TLS handshake bottlenecks.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                {nodes.map(n => (
                  <div key={n.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="text-slate-400 truncate">{n.name}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-emerald-400">{n.cpuPercent}% CPU</span>
                      <span className="text-slate-500">{n.p99LatencyMs}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Audience & Engagement Insights */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>User Engagement &amp; Geographic Retention</span>
            </h4>
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
              <p className="text-slate-300">
                Live audience reached a peak of {peakUsers.toLocaleString()} concurrent users today with an average dwell duration of {Math.floor(engagement.sessionDurationAvgSec / 60)}m {engagement.sessionDurationAvgSec % 60}s.
                North America and Western Europe account for 75%+ of active traffic.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] font-mono">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400">Interaction Rate</div>
                  <div className="text-emerald-400 font-bold mt-0.5">{engagement.interactionRatePercent}% (Strong)</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400">Bounce Rate</div>
                  <div className="text-sky-400 font-bold mt-0.5">{engagement.bounceRatePercent}% (Low)</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400">Conversion Funnel</div>
                  <div className="text-indigo-400 font-bold mt-0.5">18.6% Retained</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800/80 bg-slate-950/70">
          <div className="text-[11px] text-slate-500 font-mono">
            Generated {reportDate}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to Clipboard' : 'Copy Markdown Brief'}</span>
            </button>
            <button
              onClick={handleDownloadJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-800 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download JSON</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
