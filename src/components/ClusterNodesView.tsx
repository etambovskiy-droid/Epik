import { useState } from 'react';
import { ServerNode } from '../types/metrics.ts';
import {
  Server,
  Cpu,
  Database,
  HardDrive,
  Activity,
  RotateCw,
  PowerOff,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers
} from 'lucide-react';

interface ClusterNodesViewProps {
  nodes: ServerNode[];
  onRestartNode: (nodeId: string) => void;
  onDrainNode: (nodeId: string) => void;
}

export function ClusterNodesView({
  nodes,
  onRestartNode,
  onDrainNode
}: ClusterNodesViewProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string>(nodes[0]?.id || '');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const activeNode = nodes.find(n => n.id === selectedNodeId) || nodes[0];

  const handleAction = (msg: string, action: () => void) => {
    action();
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Cluster Overview Stats Bar */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>Cluster Topology &amp; Node Health</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
              {nodes.filter(n => n.status === 'healthy').length}/{nodes.length} Healthy
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Multi-region high-availability server instances managing edge routing and background workers
          </p>
        </div>

        {actionFeedback && (
          <div className="px-3 py-1.5 rounded-lg bg-sky-950/80 border border-sky-700 text-sky-200 text-xs font-mono animate-fade-in">
            {actionFeedback}
          </div>
        )}
      </div>

      {/* Nodes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isHealthy = node.status === 'healthy';

          return (
            <div
              key={node.id}
              onClick={() => setSelectedNodeId(node.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-slate-900/95 border-sky-500 ring-1 ring-sky-500/50 shadow-lg shadow-sky-950/20'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isHealthy ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span className="font-semibold text-xs text-white truncate">{node.name}</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-300">
                  {node.role}
                </span>
              </div>

              <div className="text-[11px] text-slate-400 font-mono mb-3">
                {node.region}
              </div>

              {/* CPU bar */}
              <div className="space-y-1 mb-2.5">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">CPU Load</span>
                  <span className={node.cpuPercent > 80 ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                    {node.cpuPercent}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      node.cpuPercent > 80 ? 'bg-rose-500' : node.cpuPercent > 65 ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${node.cpuPercent}%` }}
                  />
                </div>
              </div>

              {/* Memory bar */}
              <div className="space-y-1 mb-3">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Memory</span>
                  <span className="text-slate-200">{node.memoryUsedGb} / {node.memoryTotalGb} GB</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sky-400"
                    style={{ width: `${node.memoryPercent}%` }}
                  />
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>P99: {node.p99LatencyMs}ms</span>
                <span>{node.requestsPerSec.toLocaleString()} req/s</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Node Deep Dive Inspector */}
      {activeNode && (
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm space-y-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-4 border-b border-slate-800/80">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">{activeNode.name}</h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-950/60 text-sky-300 border border-sky-800/50">
                  {activeNode.region}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
                  Uptime: {Math.floor(activeNode.uptimeSeconds / 86400)}d {Math.floor((activeNode.uptimeSeconds % 86400) / 3600)}h
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Unix Load Average: [1m: {activeNode.loadAverage[0]}, 5m: {activeNode.loadAverage[1]}, 15m: {activeNode.loadAverage[2]}] · {activeNode.cores} Dedicated Hardware Cores
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAction(`Restarted worker processes on ${activeNode.name}`, () => onRestartNode(activeNode.id))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Restart Daemons</span>
              </button>
              <button
                onClick={() => handleAction(`Draining inbound traffic away from ${activeNode.name}`, () => onDrainNode(activeNode.id))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 transition-colors"
              >
                <PowerOff className="w-3.5 h-3.5" />
                <span>Drain Node</span>
              </button>
            </div>
          </div>

          {/* Core Allocation Matrix for active node */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
              Core Thread Utilization ({activeNode.coreUtilization.length} vCPUs)
            </h4>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {activeNode.coreUtilization.map((load, idx) => (
                <div key={idx} className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-center font-mono">
                  <div className="text-[10px] text-slate-400">Core {idx}</div>
                  <div className="text-xs font-bold text-slate-200">{load}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* Processes list */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
              Running Host Processes ({activeNode.processes.length})
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                    <th className="pb-2 font-medium">PID</th>
                    <th className="pb-2 font-medium">Binary / Daemon</th>
                    <th className="pb-2 font-medium">CPU %</th>
                    <th className="pb-2 font-medium">Memory</th>
                    <th className="pb-2 font-medium">Threads</th>
                    <th className="pb-2 font-medium">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {activeNode.processes.map((proc) => (
                    <tr key={proc.pid} className="hover:bg-slate-800/30">
                      <td className="py-2 text-slate-400">{proc.pid}</td>
                      <td className="py-2 text-slate-200 font-semibold">{proc.name}</td>
                      <td className="py-2 text-emerald-400">{proc.cpu}%</td>
                      <td className="py-2 text-sky-400">{proc.memoryMb} MB</td>
                      <td className="py-2 text-slate-400">{proc.threads}</td>
                      <td className="py-2">
                        <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
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
      )}
    </div>
  );
}
