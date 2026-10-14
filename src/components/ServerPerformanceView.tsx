import { useState } from 'react';
import {
  TimeSeriesPoint,
  ServerNode,
  TimeRange
} from '../types/metrics.ts';
import { AreaTimeSeriesChart } from './charts/AreaTimeSeriesChart.tsx';
import { DonutChart } from './charts/DonutChart.tsx';
import {
  Cpu,
  Database,
  Network,
  HardDrive,
  Activity,
  Layers,
  ArrowDown,
  ArrowUp,
  Server
} from 'lucide-react';

interface ServerPerformanceViewProps {
  history: TimeSeriesPoint[];
  nodes: ServerNode[];
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  timeRange: TimeRange;
}

export function ServerPerformanceView({
  history,
  nodes,
  selectedNodeId,
  onSelectNode,
  timeRange
}: ServerPerformanceViewProps) {
  const activeNode = nodes.find(n => n.id === selectedNodeId) || nodes[0];
  const latest = history[history.length - 1] || {
    cpu: 0,
    memory: 0,
    networkInMb: 0,
    networkOutMb: 0,
    diskIops: 0,
    requestsPerSec: 0,
    p99Latency: 0
  };

  // Memory breakdown segments for Donut chart
  const memorySegments = [
    { id: 'heap', label: 'V8 Active Heap', value: 38, color: '#38bdf8' },
    { id: 'rss', label: 'Resident Set (RSS)', value: 28, color: '#818cf8' },
    { id: 'cache', label: 'OS Buffers & Cache', value: 20, color: '#34d399' },
    { id: 'free', label: 'Available Headroom', value: 14, color: '#475569' }
  ];

  return (
    <div className="space-y-6">
      {/* Node selector banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-950/80 border border-sky-800/60 flex items-center justify-center">
            <Server className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">
              {selectedNodeId === 'all' ? 'All Cluster Nodes (Aggregate)' : activeNode.name}
            </h2>
            <p className="text-xs text-slate-400">
              {selectedNodeId === 'all'
                ? `Monitoring ${nodes.length} production nodes across 4 geographical regions`
                : `${activeNode.role} · ${activeNode.region} · Uptime: ${Math.floor(activeNode.uptimeSeconds / 86400)}d ${Math.floor((activeNode.uptimeSeconds % 86400) / 3600)}h`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {nodes.map(n => (
            <button
              key={n.id}
              onClick={() => onSelectNode(n.id)}
              className={`px-2.5 py-1 text-xs rounded-lg font-mono border transition-all ${
                selectedNodeId === n.id
                  ? 'bg-sky-950/80 border-sky-600 text-sky-300 font-medium'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {n.id.replace('node-', '')}
            </button>
          ))}
          <button
            onClick={() => onSelectNode('all')}
            className={`px-2.5 py-1 text-xs rounded-lg font-mono border transition-all ${
              selectedNodeId === 'all'
                ? 'bg-sky-950/80 border-sky-600 text-sky-300 font-medium'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* 4 Core Infrastructure KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU Utilization */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">CPU Utilization</span>
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white">
              {latest.cpu}%
            </div>
            <span className="text-xs font-mono text-slate-400">
              Load: {activeNode.loadAverage.join(', ')}
            </span>
          </div>
          <div className="mt-2.5 w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                latest.cpu > 80 ? 'bg-rose-500' : latest.cpu > 65 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${latest.cpu}%` }}
            />
          </div>
        </div>

        {/* Memory Allocation */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">RAM Utilization</span>
            <Database className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white">
              {latest.memory}%
            </div>
            <span className="text-xs font-mono text-slate-400">
              {activeNode.memoryUsedGb} / {activeNode.memoryTotalGb} GB
            </span>
          </div>
          <div className="mt-2.5 w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-sky-400 transition-all duration-300"
              style={{ width: `${latest.memory}%` }}
            />
          </div>
        </div>

        {/* Network Throughput */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Network I/O</span>
            <Network className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white">
              {(latest.networkInMb + latest.networkOutMb).toFixed(1)}
              <span className="text-xs font-normal text-slate-400 ml-1">MB/s</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span className="flex items-center text-emerald-400"><ArrowDown className="w-3 h-3" />{latest.networkInMb}</span>
              <span className="flex items-center text-sky-400"><ArrowUp className="w-3 h-3" />{latest.networkOutMb}</span>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Sockets: 14,820</span>
            <span>TCP Drop: 0.00%</span>
          </div>
        </div>

        {/* Disk I/O & IOPS */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Disk Storage &amp; IOPS</span>
            <HardDrive className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white">
              {latest.diskIops.toLocaleString()}
              <span className="text-xs font-normal text-slate-400 ml-1">IOPS</span>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {activeNode.diskUsedGb} / {activeNode.diskTotalGb} GB
            </span>
          </div>
          <div className="mt-2.5 w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-300"
              style={{ width: `${activeNode.diskPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Charts: CPU & Memory vs Network & Disk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* CPU & Memory Time Series */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">CPU &amp; Memory Telemetry</h3>
              <p className="text-xs text-slate-400 mt-0.5">Real-time compute and memory consumption stream</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> CPU {latest.cpu}%
              </span>
              <span className="flex items-center gap-1.5 text-sky-400">
                <span className="w-2 h-2 rounded-full bg-sky-400" /> RAM {latest.memory}%
              </span>
            </div>
          </div>

          <AreaTimeSeriesChart
            data={history}
            timeKey="timeLabel"
            height={230}
            yMin={0}
            yMax={100}
            series={[
              { id: 'cpu', name: 'CPU Load', dataKey: 'cpu', color: '#34d399', unit: '%', fillOpacity: 0.18 },
              { id: 'memory', name: 'Memory', dataKey: 'memory', color: '#38bdf8', unit: '%', fillOpacity: 0.12 }
            ]}
            valueFormatter={(val) => `${val}%`}
          />
        </div>

        {/* Network Ingress/Egress & Disk IOPS Time Series */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Network Bandwidth (In / Out)</h3>
              <p className="text-xs text-slate-400 mt-0.5">Ingress &amp; Egress traffic throughput over time (MB/s)</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> In: {latest.networkInMb} MB/s
              </span>
              <span className="flex items-center gap-1.5 text-indigo-400">
                <span className="w-2 h-2 rounded-full bg-indigo-400" /> Out: {latest.networkOutMb} MB/s
              </span>
            </div>
          </div>

          <AreaTimeSeriesChart
            data={history}
            timeKey="timeLabel"
            height={230}
            series={[
              { id: 'netOut', name: 'Egress (Out)', dataKey: 'networkOutMb', color: '#818cf8', unit: 'MB/s', fillOpacity: 0.2 },
              { id: 'netIn', name: 'Ingress (In)', dataKey: 'networkInMb', color: '#34d399', unit: 'MB/s', fillOpacity: 0.15 }
            ]}
            valueFormatter={(val) => `${val} MB/s`}
          />
        </div>
      </div>

      {/* Per-Core Load Breakdown & Memory Tier Architecture */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Per-Core Load Heatmap / Grid */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Per-Core CPU Distribution</span>
                <span className="text-xs font-normal text-slate-400 font-mono">
                  ({activeNode.coreUtilization.length} vCPUs allocated)
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Core thread affinity and hardware execution balance
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
            {activeNode.coreUtilization.map((load, idx) => {
              const colorClass =
                load > 85 ? 'text-rose-400 bg-rose-950/40 border-rose-800/60' :
                load > 65 ? 'text-amber-400 bg-amber-950/40 border-amber-800/60' :
                'text-emerald-400 bg-emerald-950/30 border-emerald-800/50';

              return (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border text-center font-mono transition-all duration-300 ${colorClass}`}
                >
                  <div className="text-[10px] text-slate-400 mb-0.5">Core {idx}</div>
                  <div className="text-sm font-bold">{load}%</div>
                  <div className="mt-1.5 w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        load > 85 ? 'bg-rose-500' : load > 65 ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${load}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Memory Tier Allocation */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm lg:col-span-1">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="text-sm font-semibold text-white">Memory Tiers</h3>
            <span className="text-[11px] font-mono text-slate-400">
              {activeNode.memoryTotalGb} GB Total
            </span>
          </div>

          <DonutChart
            segments={memorySegments}
            size={130}
            strokeWidth={16}
            centerValue={`${latest.memory}%`}
            centerLabel="Allocated"
          />

          <div className="mt-4 pt-3 border-t border-slate-800/60 space-y-1 text-xs text-slate-400">
            <div className="flex items-center justify-between">
              <span>Garbage Collector Pauses:</span>
              <span className="font-mono text-slate-200">2.4ms (p99)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Memory Leaks Detected:</span>
              <span className="font-mono text-emerald-400 font-semibold">0 (Clean)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Node Processes Table */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h3 className="text-sm font-semibold text-white">Active Node Processes</h3>
            <p className="text-xs text-slate-400 mt-0.5">Top compute and worker threads on {activeNode.name}</p>
          </div>
          <span className="text-xs font-mono text-slate-400">{activeNode.processes.length} daemon processes</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                <th className="pb-2.5 font-medium">PID</th>
                <th className="pb-2.5 font-medium">Process Name</th>
                <th className="pb-2.5 font-medium">CPU Load</th>
                <th className="pb-2.5 font-medium">Memory (RSS)</th>
                <th className="pb-2.5 font-medium">Threads</th>
                <th className="pb-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {activeNode.processes.map((proc) => (
                <tr key={proc.pid} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 text-slate-400">{proc.pid}</td>
                  <td className="py-2.5 font-semibold text-slate-200">{proc.name}</td>
                  <td className="py-2.5 text-emerald-400">{proc.cpu}%</td>
                  <td className="py-2.5 text-sky-400">{proc.memoryMb.toLocaleString()} MB</td>
                  <td className="py-2.5 text-slate-300">{proc.threads}</td>
                  <td className="py-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                      {proc.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
