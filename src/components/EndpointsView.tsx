import { useState } from 'react';
import { EndpointMetric } from '../types/metrics.ts';
import {
  Route,
  Search,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity
} from 'lucide-react';

interface EndpointsViewProps {
  endpoints: EndpointMetric[];
}

export function EndpointsView({ endpoints }: EndpointsViewProps) {
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'rpm' | 'latency' | 'errors'>('rpm');

  const filtered = endpoints
    .filter((ep) => {
      const matchSearch = ep.path.toLowerCase().includes(search.toLowerCase());
      const matchMethod = methodFilter === 'all' || ep.method === methodFilter;
      return matchSearch && matchMethod;
    })
    .sort((a, b) => {
      if (sortBy === 'rpm') return b.rpm - a.rpm;
      if (sortBy === 'latency') return b.p99LatencyMs - a.p99LatencyMs;
      if (sortBy === 'errors') return b.errorRatePercent - a.errorRatePercent;
      return 0;
    });

  const methodColors: Record<string, string> = {
    GET: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50',
    POST: 'bg-sky-950/60 text-sky-300 border-sky-800/50',
    PUT: 'bg-amber-950/60 text-amber-300 border-amber-800/50',
    DELETE: 'bg-rose-950/60 text-rose-300 border-rose-800/50',
    PATCH: 'bg-purple-950/60 text-purple-300 border-purple-800/50'
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter toolbar */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter endpoint paths (e.g. /api/v2/stream)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Method Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            {['all', 'GET', 'POST', 'PUT'].map((m) => (
              <button
                key={m}
                onClick={() => setMethodFilter(m)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                  methodFilter === m
                    ? 'bg-slate-800 text-sky-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Sort By selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="rpm" className="bg-slate-900">Highest RPM</option>
              <option value="latency" className="bg-slate-900">Highest P99 Latency</option>
              <option value="errors" className="bg-slate-900">Highest Error Rate</option>
            </select>
          </div>
        </div>
      </div>

      {/* Endpoints Table */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                <th className="pb-3 font-medium">Method</th>
                <th className="pb-3 font-medium">Route Path</th>
                <th className="pb-3 font-medium text-right">Throughput (RPM)</th>
                <th className="pb-3 font-medium text-right">Avg Latency</th>
                <th className="pb-3 font-medium text-right">P95 Latency</th>
                <th className="pb-3 font-medium text-right">P99 Latency</th>
                <th className="pb-3 font-medium text-right">Error Rate</th>
                <th className="pb-3 font-medium pl-6">Status Codes (2xx / 4xx / 5xx)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((ep) => {
                const totalReqs = ep.s2xx + ep.s4xx + ep.s5xx;
                const pct2xx = totalReqs > 0 ? (ep.s2xx / totalReqs) * 100 : 100;
                const pct4xx = totalReqs > 0 ? (ep.s4xx / totalReqs) * 100 : 0;
                const pct5xx = totalReqs > 0 ? (ep.s5xx / totalReqs) * 100 : 0;

                return (
                  <tr key={ep.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${methodColors[ep.method] || 'bg-slate-800 text-slate-200'}`}>
                        {ep.method}
                      </span>
                    </td>
                    <td className="py-3 font-semibold text-slate-200">{ep.path}</td>
                    <td className="py-3 text-right text-sky-400 font-bold">{ep.rpm.toLocaleString()}</td>
                    <td className="py-3 text-right text-slate-300">{ep.avgLatencyMs}ms</td>
                    <td className="py-3 text-right text-slate-300">{ep.p95LatencyMs}ms</td>
                    <td className="py-3 text-right">
                      <span className={ep.p99LatencyMs > 250 ? 'text-amber-400 font-bold' : 'text-slate-200'}>
                        {ep.p99LatencyMs}ms
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <span className={ep.errorRatePercent > 0.2 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                        {ep.errorRatePercent}%
                      </span>
                    </td>
                    <td className="py-3 pl-6">
                      <div className="w-36 space-y-1">
                        <div className="flex h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div style={{ width: `${pct2xx}%` }} className="bg-emerald-400" title={`2xx: ${ep.s2xx}`} />
                          <div style={{ width: `${pct4xx}%` }} className="bg-amber-400" title={`4xx: ${ep.s4xx}`} />
                          <div style={{ width: `${pct5xx}%` }} className="bg-rose-500" title={`5xx: ${ep.s5xx}`} />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="text-emerald-400">{ep.s2xx}</span>
                          <span className="text-amber-400">{ep.s4xx}</span>
                          <span className="text-rose-400">{ep.s5xx}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
