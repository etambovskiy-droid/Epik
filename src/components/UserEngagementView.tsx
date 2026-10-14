import { useState } from 'react';
import {
  TimeSeriesPoint,
  UserEngagementData,
  LiveUserEvent
} from '../types/metrics.ts';
import { AreaTimeSeriesChart } from './charts/AreaTimeSeriesChart.tsx';
import { DonutChart } from './charts/DonutChart.tsx';
import {
  Users,
  Timer,
  MousePointerClick,
  TrendingUp,
  Globe2,
  Smartphone,
  Compass,
  FileText,
  Filter,
  CheckCircle2,
  Search,
  Zap,
  ShoppingBag,
  UserPlus
} from 'lucide-react';

interface UserEngagementViewProps {
  history: TimeSeriesPoint[];
  engagement: UserEngagementData;
}

export function UserEngagementView({
  history,
  engagement
}: UserEngagementViewProps) {
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');

  const latest = history[history.length - 1] || {
    activeUsers: engagement.activeUsers
  };

  // Device donut segments
  const deviceSegments = engagement.deviceBreakdown.map((d) => ({
    id: d.device.toLowerCase(),
    label: d.device,
    value: d.sharePercent,
    color: d.device === 'Desktop' ? '#38bdf8' : d.device === 'Mobile' ? '#818cf8' : '#34d399'
  }));

  // Browser donut segments
  const browserSegments = engagement.browserBreakdown.map((b) => ({
    id: b.browser.toLowerCase(),
    label: b.browser,
    value: b.sharePercent,
    color:
      b.browser === 'Chrome' ? '#38bdf8' :
      b.browser === 'Safari' ? '#f59e0b' :
      b.browser === 'Firefox' ? '#f43f5e' : '#a855f7'
  }));

  const filteredEvents = engagement.liveEventFeed.filter((evt) => {
    const matchesType = selectedEventType === 'all' || evt.eventType === selectedEventType;
    const matchesSearch =
      searchFilter === '' ||
      evt.details.toLowerCase().includes(searchFilter.toLowerCase()) ||
      evt.userAlias.toLowerCase().includes(searchFilter.toLowerCase()) ||
      evt.location.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* 4 User Engagement KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Concurrent Users */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Active Concurrent Users</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white">
              {latest.activeUsers.toLocaleString()}
            </div>
            <span className="text-xs font-medium text-emerald-400">
              +{engagement.usersDeltaPercent}% vs last hr
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Peak Today: {engagement.peakUsersToday.toLocaleString()}</span>
            <span>{engagement.pageviewsPerMinute.toLocaleString()} views/min</span>
          </div>
        </div>

        {/* Avg Session Duration */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Avg Session Duration</span>
            <Timer className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white">
              {Math.floor(engagement.sessionDurationAvgSec / 60)}m {engagement.sessionDurationAvgSec % 60}s
            </div>
            <span className="text-xs font-mono text-slate-400">+18s vs avg</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Median: 4m 12s</span>
            <span>P90: 12m 40s</span>
          </div>
        </div>

        {/* Interaction / Engagement Rate */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Interaction Rate</span>
            <MousePointerClick className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white">
              {engagement.interactionRatePercent}%
            </div>
            <span className="text-xs font-medium text-emerald-400">High intent</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Clicks/session: 6.8</span>
            <span>API calls/usr: 14</span>
          </div>
        </div>

        {/* Bounce Rate */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Bounce Rate</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white">
              {engagement.bounceRatePercent}%
            </div>
            <span className="text-xs font-mono text-emerald-400">-2.4% reduction</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Direct: 19.8%</span>
            <span>Referrals: 27.2%</span>
          </div>
        </div>
      </div>

      {/* Primary Engagement Velocity Chart */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Real-Time User Velocity &amp; Concurrency</h3>
            <p className="text-xs text-slate-400 mt-0.5">Continuous concurrent visitor flow streaming over time</p>
          </div>
          <div className="text-xs font-mono text-indigo-400">
            Active: {latest.activeUsers.toLocaleString()} concurrent
          </div>
        </div>

        <AreaTimeSeriesChart
          data={history}
          timeKey="timeLabel"
          height={240}
          series={[
            {
              id: 'users',
              name: 'Active Users',
              dataKey: 'activeUsers',
              color: '#818cf8',
              unit: 'users',
              fillOpacity: 0.25
            }
          ]}
          valueFormatter={(val) => val.toLocaleString()}
        />
      </div>

      {/* Engagement Funnel & Device/Browser Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Engagement Funnel */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Live Session Conversion Funnel</h3>
              <p className="text-xs text-slate-400 mt-0.5">User journey from entry to retained engagement</p>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-semibold">18.6% Total Retention</span>
          </div>

          <div className="space-y-4">
            {engagement.funnelStages.map((stage, idx) => (
              <div key={stage.stage} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-mono text-[10px] font-semibold">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-slate-200">{stage.stage}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span className="text-slate-300">{stage.count.toLocaleString()} sessions</span>
                    <span className="text-sky-400 font-semibold">{stage.conversionPercent}%</span>
                  </div>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-500"
                    style={{ width: `${stage.conversionPercent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Device & Platform Breakdown */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm lg:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-sky-400" />
                <span>Device Split</span>
              </h3>
              <span className="text-xs font-mono text-slate-400">Desktop Lead</span>
            </div>

            <DonutChart
              segments={deviceSegments}
              size={130}
              strokeWidth={16}
              centerValue="58.4%"
              centerLabel="Desktop"
            />
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800/70">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-indigo-400" />
                Browsers
              </span>
              <span className="text-slate-400 font-mono text-[11px]">Engine share</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {engagement.browserBreakdown.map((b) => (
                <div key={b.browser} className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/60 font-mono">
                  <div className="text-[10px] text-slate-400">{b.browser}</div>
                  <div className="text-sm font-bold text-slate-200">{b.sharePercent}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Pages Visited & Real-Time Event Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Active Pages */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-400" />
                <span>Top Active Application Paths</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Most frequented screens &amp; views</p>
            </div>
            <span className="text-xs font-mono text-slate-400">{engagement.topPages.length} routes</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <th className="pb-2.5 font-medium">Path</th>
                  <th className="pb-2.5 font-medium text-right">Views</th>
                  <th className="pb-2.5 font-medium text-right">Unique Users</th>
                  <th className="pb-2.5 font-medium text-right">Dwell Time</th>
                  <th className="pb-2.5 font-medium text-right">Bounce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {engagement.topPages.map((page) => (
                  <tr key={page.path} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 font-semibold text-slate-200">{page.path}</td>
                    <td className="py-2.5 text-right text-sky-400">{page.views.toLocaleString()}</td>
                    <td className="py-2.5 text-right text-slate-300">{page.uniqueVisitors.toLocaleString()}</td>
                    <td className="py-2.5 text-right text-emerald-400">{page.avgTimeSec}s</td>
                    <td className="py-2.5 text-right text-slate-400">{page.bounceRatePercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Interactive Real-Time Event Feed */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-3.5">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Real-Time Activity Stream</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Live user interaction webhooks and events</p>
              </div>

              {/* Event filter tabs */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                {(['all', 'checkout', 'signup', 'api_call'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedEventType(t)}
                    className={`px-2 py-0.5 rounded text-[11px] capitalize transition-colors ${
                      selectedEventType === t
                        ? 'bg-slate-800 text-sky-300 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t === 'all' ? 'All' : t.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Event list */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {filteredEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/70 text-xs hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-slate-800 text-sky-300 border border-slate-700">
                        {evt.eventType.replace('_', ' ')}
                      </span>
                      <span className="font-mono text-slate-300 font-medium">{evt.userAlias}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{evt.timeAgo}</span>
                  </div>
                  <p className="text-slate-200 text-xs truncate">
                    {evt.details}
                  </p>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>{evt.location}</span>
                    {evt.durationMs && <span className="text-amber-400">{evt.durationMs}ms</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800/60 text-[11px] text-slate-400 font-mono flex items-center justify-between">
            <span>Buffer: 15 events retained</span>
            <span className="text-emerald-400">WebSocket: Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
