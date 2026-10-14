export interface TimeSeriesPoint {
  timestamp: string;
  timeLabel: string;
  cpu: number; // 0 - 100%
  memory: number; // 0 - 100%
  requestsPerSec: number;
  p99Latency: number; // ms
  p50Latency: number; // ms
  activeUsers: number;
  errorRate: number; // % (e.g. 0.12%)
  networkInMb: number; // MB/s
  networkOutMb: number; // MB/s
  diskIops: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memoryMb: number;
  threads: number;
  status: 'running' | 'sleeping' | 'idle';
}

export interface ServerNode {
  id: string;
  name: string;
  region: string;
  role: 'API Gateway' | 'Worker Engine' | 'Database Replica' | 'Auth Service';
  status: 'healthy' | 'degraded' | 'critical';
  cpuPercent: number;
  memoryPercent: number;
  memoryUsedGb: number;
  memoryTotalGb: number;
  diskPercent: number;
  diskUsedGb: number;
  diskTotalGb: number;
  uptimeSeconds: number;
  p99LatencyMs: number;
  requestsPerSec: number;
  errorRatePercent: number;
  loadAverage: [number, number, number]; // 1m, 5m, 15m
  cores: number;
  coreUtilization: number[];
  networkInMb: number;
  networkOutMb: number;
  processes: ProcessInfo[];
}

export interface EndpointMetric {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  rpm: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorRatePercent: number;
  s2xx: number;
  s4xx: number;
  s5xx: number;
  trend: 'up' | 'down' | 'stable';
}

export interface SystemAlert {
  id: string;
  timestamp: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  nodeOrService: string;
  acknowledged: boolean;
  resolved: boolean;
}

export interface GeographicTraffic {
  country: string;
  countryCode: string;
  users: number;
  sharePercent: number;
  avgLatencyMs: number;
  requestsPerSec: number;
}

export interface DeviceBreakdown {
  device: 'Desktop' | 'Mobile' | 'Tablet';
  sharePercent: number;
  activeUsers: number;
  avgSessionDurationSec: number;
}

export interface BrowserBreakdown {
  browser: string;
  sharePercent: number;
}

export interface TopPageVisit {
  path: string;
  views: number;
  uniqueVisitors: number;
  avgTimeSec: number;
  bounceRatePercent: number;
}

export interface LiveUserEvent {
  id: string;
  timestamp: string;
  timeAgo: string;
  eventType: 'signup' | 'checkout' | 'search' | 'api_call' | 'page_view' | 'session_start';
  userAlias: string;
  location: string;
  details: string;
  durationMs?: number;
}

export interface UserEngagementData {
  activeUsers: number;
  peakUsersToday: number;
  usersDeltaPercent: number;
  sessionDurationAvgSec: number;
  interactionRatePercent: number;
  bounceRatePercent: number;
  pageviewsPerMinute: number;
  funnelStages: { stage: string; count: number; conversionPercent: number }[];
  geographicTraffic: GeographicTraffic[];
  deviceBreakdown: DeviceBreakdown[];
  browserBreakdown: BrowserBreakdown[];
  topPages: TopPageVisit[];
  liveEventFeed: LiveUserEvent[];
}

export interface MetricThresholds {
  cpuWarning: number;
  cpuCritical: number;
  latencyWarning: number;
  latencyCritical: number;
  errorRateWarning: number;
  errorRateCritical: number;
}

export type TimeRange = '5m' | '15m' | '1h' | '6h' | '24h';
export type ActiveTab = 'overview' | 'server-performance' | 'user-engagement' | 'cluster-nodes' | 'endpoints-api' | 'incidents-alerts';
