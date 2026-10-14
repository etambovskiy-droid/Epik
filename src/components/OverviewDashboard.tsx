import {
  TimeSeriesPoint,
  ServerNode,
  UserEngagementData,
  SystemAlert
} from '../types/metrics.ts';
import { AreaTimeSeriesChart } from './charts/AreaTimeSeriesChart.tsx';
import { Sparkline } from './charts/Sparkline.tsx';
import {
  Users,
  Activity,
  Cpu,
  Clock,
  AlertCircle,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  Radio,
  Server,
  Globe2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface OverviewDashboardProps {
  history: TimeSeriesPoint[];
  nodes: ServerNode[];
  engagement: UserEngagementData;
  alerts: SystemAlert[];
  onNavigateToTab: (tab: any) => void;
}

export function OverviewDashboard({
  history,
  nodes,
  engagement,
  alerts,
  onNavigateToTab
}: OverviewDashboardProps) {
  const latest = history[history.length - 1] || {
    cpu: 0,
    memory: 0,
    requestsPerSec: 0,
    p99Latency: 0,
    activeUsers: 0,
    errorRate: 0,
    networkInMb: 0,
    networkOutMb: 0
  };

  // Sparkline data arrays
  const cpuSpark = history.map(h => h.cpu);
  const rpsSpark = history.map(h => h.requestsPerSec);
  const p99Spark = history.map(h => h.p99Latency);
  const userSpark = history.map(h => h.activeUsers);
  const errorSpark = history.map(h => h.errorRate);
  const memSpark = history.map(h => h.memory);

  return (
    <div className="space-y-6">
      {/* Top Telemetry KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* Active Concurrent Users */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 shadow-sm hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Active Users</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {latest.activeUsers.toLocaleString()}
            </div>
            <div className="flex items-center text-xs font-medium text-emerald-400">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+{engagement.usersDeltaPercent}%</span>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
            <span>Peak: {engagement.peakUsersToday.toLocaleString()}</span>
            <Sparkline data={userSpark} color="#38bdf8" />
          </div>
        </div>

        {/* Global Throughput RPS */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 shadow-sm hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Total Throughput</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {latest.requestsPerSec.toLocaleString()}
              <span className="text-xs font-normal text-slate-400 ml-1">req/s</span>
            </div>
            <span className="text-xs font-mono text-slate-400">~{(latest.requestsPerSec * 60).toLocaleString()}/m</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
            <span>Volume</span>
            <Sparkline data={rpsSpark} color="#818cf8" />
          </div>
        </div>

        {/* Cluster CPU Load */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 shadow-sm hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Cluster CPU Load</span>
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {latest.cpu}%
            </div>
            <span className={`text-xs font-medium ${latest.cpu > 80 ? 'text-rose-400' : latest.cpu > 65 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {latest.cpu > 80 ? 'High' : latest.cpu > 65 ? 'Moderate' : 'Nominal'}
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
            <span>48 Cores</span>
            <Sparkline data={cpuSpark} color={latest.cpu > 80 ? '#fb7185' : '#34d399'} />
          </div>
        </div>

        {/* P99 Response Latency */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 shadow-sm hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">P99 Latency</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {latest.p99Latency}
              <span className="text-xs font-normal text-slate-400 ml-1">ms</span>
            </div>
            <span className="text-xs font-mono text-slate-400">p50: {latest.p50Latency}ms</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
            <span>SLA: &lt;150ms</span>
            <Sparkline data={p99Spark} color="#fbbf24" />
          </div>
        </div>

        {/* Error Rate */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 shadow-sm hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Error Rate</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {latest.errorRate}%
            </div>
            <span className={`text-xs font-medium ${latest.errorRate > 0.5 ? 'text-rose-400 font-semibold' : 'text-emerald-400'}`}>
              {latest.errorRate > 0.5 ? 'Degraded' : '99.9% OK'}
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
            <span>5xx &amp; 4xx</span>
            <Sparkline data={errorSpark} color="#f43f5e" />
          </div>
        </div>

        {/* Memory Allocation */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 shadow-sm hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">RAM Allocation</span>
            <Database className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {latest.memory}%
            </div>
            <span className="text-xs font-mono text-slate-400">173 / 256 GB</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
            <span>Heap + Buffers</span>
            <Sparkline data={memSpark} color="#c084fc" />
          </div>
        </div>
      </div>

      {/* Primary Dual Telemetry Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart 1: Real-Time Server Performance & Latency */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Server Throughput &amp; Response Latency</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time request volume (req/s) correlated against P99 latency SLA
              </p>
            </div>
            <button
              onClick={() => onNavigateToTab('server-performance')}
              className="text-xs text-sky-400 hover:text-sky-300 font-medium transition-colors"
            >
              Detailed Telemetry &rarr;
            </button>
          </div>

          <AreaTimeSeriesChart
            data={history}
            timeKey="timeLabel"
            height={220}
            series={[
              {
                id: 'rps',
                name: 'Throughput',
                dataKey: 'requestsPerSec',
                color: '#38bdf8',
                unit: 'req/s',
                fillOpacity: 0.2
              },
              {
                id: 'p99',
                name: 'P99 Latency',
                dataKey: 'p99Latency',
                color: '#fbbf24',
                unit: 'ms',
                fillOpacity: 0.12
              }
            ]}
            valueFormatter={(val, id) => {
              if (id === 'p99') return `${val}ms`;
              return val >= 1000 ? `${(val / 1000).toFixed(1)}k` : `${val}`;
            }}
          />
        </div>

        {/* Chart 2: Real-Time User Engagement & Live Sessions */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Active User Engagement &amp; Concurrency</span>
                <Users className="w-4 h-4 text-indigo-400" />
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Live authenticated &amp; guest concurrent users streaming sessions
              </p>
            </div>
            <button
              onClick={() => onNavigateToTab('user-engagement')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              Engagement Breakdown &rarr;
            </button>
          </div>

          <AreaTimeSeriesChart
            data={history}
            timeKey="timeLabel"
            height={220}
            series={[
              {
                id: 'users',
                name: 'Active Users',
                dataKey: 'activeUsers',
                color: '#818cf8',
                unit: 'users',
                fillOpacity: 0.25
              },
              {
                id: 'cpu',
                name: 'System Load',
                dataKey: 'cpu',
                color: '#34d399',
                unit: '%',
                fillOpacity: 0.1
              }
            ]}
            valueFormatter={(val, id) => {
              if (id === 'cpu') return `${val}%`;
              return val.toLocaleString();
            }}
          />
        </div>
      </div>

      {/* Cluster Node Status & Real-time Feeds Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Node Health Matrix */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm lg:col-span-1">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-semibold text-white">Cluster Nodes</h3>
            </div>
            <button
              onClick={() => onNavigateToTab('cluster-nodes')}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              View all ({nodes.length})
            </button>
          </div>

          <div className="space-y-3">
            {nodes.map((node) => {
              const isHealthy = node.status === 'healthy';
              return (
                <div
                  key={node.id}
                  className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/70 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-1.5 font-medium text-slate-200 truncate">
                      <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <span className="truncate">{node.name}</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                      {node.role}
                    </span>
                  </div>

                  {/* CPU bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>CPU: {node.cpuPercent}%</span>
                      <span>RAM: {node.memoryPercent}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          node.cpuPercent > 80
                            ? 'bg-rose-500'
                            : node.cpuPercent > 65
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                        }`}
                        style={{ width: `${node.cpuPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>{node.region}</span>
                    <span>P99: {node.p99LatencyMs}ms</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live User Activity Stream */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm lg:col-span-1">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <h3 className="text-sm font-semibold text-white">Live Event Stream</h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Real-time socket</span>
          </div>

          <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
            {engagement.liveEventFeed.slice(0, 6).map((evt) => {
              const badgeColors: Record<string, string> = {
                checkout: 'text-emerald-400 bg-emerald-950/50 border-emerald-800/60',
                signup: 'text-indigo-400 bg-indigo-950/50 border-indigo-800/60',
                search: 'text-amber-400 bg-amber-950/50 border-amber-800/60',
                api_call: 'text-sky-400 bg-sky-950/50 border-sky-800/60',
                page_view: 'text-slate-300 bg-slate-800/60 border-slate-700/60',
                session_start: 'text-cyan-400 bg-cyan-950/50 border-cyan-800/60'
              };

              return (
                <div
                  key={evt.id}
                  className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/60 text-xs hover:border-slate-700/60 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border uppercase tracking-wider ${badgeColors[evt.eventType] || 'text-slate-300'}`}>
                      {evt.eventType.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{evt.timeAgo}</span>
                  </div>
                  <p className="text-slate-200 text-xs truncate font-medium">
                    {evt.details}
                  </p>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>{evt.userAlias}</span>
                    <span>{evt.location}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Global Geographic Traffic Distribution */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm lg:col-span-1">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white">Top Regional Traffic</h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Avg Latency</span>
          </div>

          <div className="space-y-3">
            {engagement.geographicTraffic.slice(0, 5).map((geo) => (
              <div key={geo.countryCode} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-400 text-[11px] w-6">{geo.countryCode}</span>
                    <span className="font-medium text-slate-200">{geo.country}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span className="text-slate-300">{geo.users.toLocaleString()} users</span>
                    <span className="text-emerald-400 font-medium">{geo.avgLatencyMs}ms</span>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${geo.sharePercent * 1.8}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
            <span>Engagement Duration:</span>
            <span className="font-mono text-slate-200 font-medium">{Math.floor(engagement.sessionDurationAvgSec / 60)}m {engagement.sessionDurationAvgSec % 60}s avg</span>
          </div>
        </div>
      </div>
    </div>
  );
}
