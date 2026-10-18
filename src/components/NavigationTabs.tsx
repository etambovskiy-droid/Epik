import {
  ActiveTab,
  TimeRange,
  ServerNode
} from '../types/metrics.ts';
import {
  LayoutDashboard,
  Server,
  Users,
  Cpu,
  Route,
  AlertTriangle,
  Clock,
  Filter,
  FileCode
} from 'lucide-react';

interface NavigationTabsProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  timeRange: TimeRange;
  onChangeTimeRange: (range: TimeRange) => void;
  nodes: ServerNode[];
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  alertCount: number;
}

export function NavigationTabs({
  activeTab,
  onSelectTab,
  timeRange,
  onChangeTimeRange,
  nodes,
  selectedNodeId,
  onSelectNode,
  alertCount
}: NavigationTabsProps) {
  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'overview',
      label: 'Unified Overview',
      icon: <LayoutDashboard className="w-4 h-4" />
    },
    {
      id: 'server-performance',
      label: 'Server Telemetry',
      icon: <Server className="w-4 h-4" />
    },
    {
      id: 'user-engagement',
      label: 'User Engagement',
      icon: <Users className="w-4 h-4" />
    },
    {
      id: 'cluster-nodes',
      label: 'Cluster Nodes',
      icon: <Cpu className="w-4 h-4" />
    },
    {
      id: 'endpoints-api',
      label: 'API Endpoints',
      icon: <Route className="w-4 h-4" />
    },
    {
      id: 'incidents-alerts',
      label: 'Incidents & Alerts',
      icon: <AlertTriangle className="w-4 h-4" />,
      badge: alertCount > 0 ? alertCount : undefined
    },
    {
      id: 'xml-feed-converter',
      label: 'XML Feed Converter',
      icon: <FileCode className="w-4 h-4 text-amber-400" />
    }
  ];

  return (
    <div className="border-b border-slate-800/80 bg-slate-950/60 px-4 lg:px-6 pt-2 pb-0">
      <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-all border ${
                  isActive
                    ? 'bg-slate-800/90 text-sky-400 border-slate-700 shadow-sm'
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Scope Filters: Time Range & Cluster Node Selector */}
        <div className="flex items-center gap-3 pb-2 lg:pb-0">
          {/* Node Scope Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedNodeId}
              onChange={(e) => onSelectNode(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-slate-200">All Nodes (Aggregate)</option>
              {nodes.map((node) => (
                <option key={node.id} value={node.id} className="bg-slate-900 text-slate-200">
                  {node.name}
                </option>
              ))}
            </select>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
            <Clock className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-1 shrink-0" />
            {(['5m', '15m', '1h', '6h', '24h'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => onChangeTimeRange(range)}
                className={`px-2 py-1 rounded font-mono text-[11px] transition-colors ${
                  timeRange === range
                    ? 'bg-slate-800 text-sky-300 font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
