import {
  TimeSeriesPoint,
  ServerNode,
  EndpointMetric,
  SystemAlert,
  UserEngagementData,
  LiveUserEvent,
  MetricThresholds
} from '../types/metrics.ts';

// Initial baseline clusters
export const INITIAL_NODES: ServerNode[] = [
  {
    id: 'node-us-east-1',
    name: 'gateway-core-us-east-1',
    region: 'us-east (N. Virginia)',
    role: 'API Gateway',
    status: 'healthy',
    cpuPercent: 42.4,
    memoryPercent: 61.2,
    memoryUsedGb: 19.6,
    memoryTotalGb: 32,
    diskPercent: 48.0,
    diskUsedGb: 240,
    diskTotalGb: 500,
    uptimeSeconds: 849200,
    p99LatencyMs: 44.8,
    requestsPerSec: 1420,
    errorRatePercent: 0.08,
    loadAverage: [1.82, 1.65, 1.48],
    cores: 8,
    coreUtilization: [48, 41, 39, 44, 46, 38, 40, 43],
    networkInMb: 112.5,
    networkOutMb: 248.8,
    processes: [
      { pid: 1042, name: 'envoy-proxy', cpu: 18.2, memoryMb: 4120, threads: 32, status: 'running' },
      { pid: 1088, name: 'node-router', cpu: 14.5, memoryMb: 2840, threads: 16, status: 'running' },
      { pid: 1120, name: 'rate-limiter-redis', cpu: 5.2, memoryMb: 1420, threads: 8, status: 'running' },
      { pid: 1156, name: 'otel-collector', cpu: 3.1, memoryMb: 890, threads: 4, status: 'running' },
    ]
  },
  {
    id: 'node-eu-west-1',
    name: 'worker-engine-eu-west-1',
    region: 'eu-west (Ireland)',
    role: 'Worker Engine',
    status: 'healthy',
    cpuPercent: 54.8,
    memoryPercent: 68.4,
    memoryUsedGb: 43.8,
    memoryTotalGb: 64,
    diskPercent: 55.2,
    diskUsedGb: 552,
    diskTotalGb: 1000,
    uptimeSeconds: 612400,
    p99LatencyMs: 62.1,
    requestsPerSec: 980,
    errorRatePercent: 0.12,
    loadAverage: [2.64, 2.45, 2.21],
    cores: 16,
    coreUtilization: [58, 62, 51, 53, 56, 49, 57, 54, 52, 60, 48, 55, 59, 51, 48, 53],
    networkInMb: 84.2,
    networkOutMb: 142.6,
    processes: [
      { pid: 2011, name: 'celery-orchestrator', cpu: 22.4, memoryMb: 8420, threads: 48, status: 'running' },
      { pid: 2045, name: 'event-consumer-kafka', cpu: 18.6, memoryMb: 6120, threads: 32, status: 'running' },
      { pid: 2082, name: 'image-transformer', cpu: 9.8, memoryMb: 4200, threads: 16, status: 'running' },
      { pid: 2110, name: 'cron-scheduler', cpu: 2.1, memoryMb: 980, threads: 6, status: 'running' },
    ]
  },
  {
    id: 'node-ap-southeast-1',
    name: 'db-replica-ap-se-1',
    region: 'ap-southeast (Singapore)',
    role: 'Database Replica',
    status: 'healthy',
    cpuPercent: 36.2,
    memoryPercent: 74.8,
    memoryUsedGb: 95.7,
    memoryTotalGb: 128,
    diskPercent: 68.4,
    diskUsedGb: 1368,
    diskTotalGb: 2000,
    uptimeSeconds: 1420900,
    p99LatencyMs: 28.4,
    requestsPerSec: 1840,
    errorRatePercent: 0.02,
    loadAverage: [1.45, 1.38, 1.30],
    cores: 16,
    coreUtilization: [34, 38, 32, 40, 37, 35, 39, 33, 36, 41, 35, 33, 38, 36, 32, 34],
    networkInMb: 168.4,
    networkOutMb: 390.2,
    processes: [
      { pid: 3001, name: 'postgres-wal-sender', cpu: 16.8, memoryMb: 32400, threads: 64, status: 'running' },
      { pid: 3024, name: 'pg-query-planner', cpu: 12.1, memoryMb: 18600, threads: 32, status: 'running' },
      { pid: 3060, name: 'redis-cache-tier', cpu: 5.4, memoryMb: 8900, threads: 8, status: 'running' },
      { pid: 3089, name: 'exporter-metrics', cpu: 1.2, memoryMb: 640, threads: 4, status: 'running' },
    ]
  },
  {
    id: 'node-us-west-2',
    name: 'auth-session-us-west-2',
    region: 'us-west (Oregon)',
    role: 'Auth Service',
    status: 'healthy',
    cpuPercent: 29.5,
    memoryPercent: 44.1,
    memoryUsedGb: 14.1,
    memoryTotalGb: 32,
    diskPercent: 32.0,
    diskUsedGb: 160,
    diskTotalGb: 500,
    uptimeSeconds: 980200,
    p99LatencyMs: 31.8,
    requestsPerSec: 760,
    errorRatePercent: 0.04,
    loadAverage: [1.12, 1.05, 0.98],
    cores: 8,
    coreUtilization: [31, 28, 30, 29, 32, 27, 30, 29],
    networkInMb: 42.1,
    networkOutMb: 76.5,
    processes: [
      { pid: 4010, name: 'jwt-validator-service', cpu: 14.8, memoryMb: 3100, threads: 24, status: 'running' },
      { pid: 4032, name: 'oauth-token-issuer', cpu: 8.4, memoryMb: 2400, threads: 16, status: 'running' },
      { pid: 4055, name: 'mfa-totp-verify', cpu: 3.9, memoryMb: 1100, threads: 8, status: 'running' },
      { pid: 4070, name: 'audit-logger', cpu: 1.6, memoryMb: 750, threads: 4, status: 'running' },
    ]
  }
];

export const INITIAL_ENDPOINTS: EndpointMetric[] = [
  {
    id: 'ep-1',
    path: '/api/v2/stream/feed',
    method: 'GET',
    rpm: 48200,
    avgLatencyMs: 34.2,
    p95LatencyMs: 82.5,
    p99LatencyMs: 142.0,
    errorRatePercent: 0.04,
    s2xx: 48180,
    s4xx: 18,
    s5xx: 2,
    trend: 'stable'
  },
  {
    id: 'ep-2',
    path: '/api/v2/checkout/order-process',
    method: 'POST',
    rpm: 6420,
    avgLatencyMs: 118.5,
    p95LatencyMs: 245.0,
    p99LatencyMs: 420.0,
    errorRatePercent: 0.32,
    s2xx: 6398,
    s4xx: 16,
    s5xx: 6,
    trend: 'up'
  },
  {
    id: 'ep-3',
    path: '/api/v2/auth/session/verify',
    method: 'POST',
    rpm: 72400,
    avgLatencyMs: 16.4,
    p95LatencyMs: 38.0,
    p99LatencyMs: 65.2,
    errorRatePercent: 0.01,
    s2xx: 72390,
    s4xx: 8,
    s5xx: 2,
    trend: 'stable'
  },
  {
    id: 'ep-4',
    path: '/api/v1/search/predictive',
    method: 'GET',
    rpm: 38900,
    avgLatencyMs: 52.8,
    p95LatencyMs: 112.4,
    p99LatencyMs: 198.5,
    errorRatePercent: 0.08,
    s2xx: 38868,
    s4xx: 24,
    s5xx: 8,
    trend: 'down'
  },
  {
    id: 'ep-5',
    path: '/api/v2/user/profile/sync',
    method: 'PUT',
    rpm: 12400,
    avgLatencyMs: 44.0,
    p95LatencyMs: 95.0,
    p99LatencyMs: 164.0,
    errorRatePercent: 0.14,
    s2xx: 12382,
    s4xx: 15,
    s5xx: 3,
    trend: 'stable'
  },
  {
    id: 'ep-6',
    path: '/api/v2/analytics/telemetry',
    method: 'POST',
    rpm: 89000,
    avgLatencyMs: 12.2,
    p95LatencyMs: 28.0,
    p99LatencyMs: 48.0,
    errorRatePercent: 0.02,
    s2xx: 88980,
    s4xx: 18,
    s5xx: 2,
    trend: 'stable'
  }
];

export const INITIAL_ALERTS: SystemAlert[] = [
  {
    id: 'alert-1',
    timestamp: '13:04:12',
    severity: 'warning',
    title: 'P99 Latency degradation in worker queue',
    description: 'worker-engine-eu-west-1 P99 processing time exceeded 60ms threshold during batch job scheduling.',
    nodeOrService: 'worker-engine-eu-west-1',
    acknowledged: false,
    resolved: false
  },
  {
    id: 'alert-2',
    timestamp: '12:56:40',
    severity: 'info',
    title: 'Cluster auto-scaling group capacity nominal',
    description: 'Scaled node pool from 3 to 4 instances ahead of peak APAC morning window.',
    nodeOrService: 'ap-southeast-1',
    acknowledged: true,
    resolved: true
  },
  {
    id: 'alert-3',
    timestamp: '12:41:18',
    severity: 'warning',
    title: 'TLS handshake pool high connection count',
    description: 'gateway-core-us-east-1 SSL socket pool reached 78% capacity under sudden mobile reconnects.',
    nodeOrService: 'gateway-core-us-east-1',
    acknowledged: true,
    resolved: false
  }
];

export const INITIAL_ENGAGEMENT: UserEngagementData = {
  activeUsers: 8492,
  peakUsersToday: 11240,
  usersDeltaPercent: 14.8,
  sessionDurationAvgSec: 342,
  interactionRatePercent: 68.4,
  bounceRatePercent: 24.1,
  pageviewsPerMinute: 3120,
  funnelStages: [
    { stage: 'Site & App Entry', count: 18400, conversionPercent: 100 },
    { stage: 'Product / Feed Browsing', count: 14200, conversionPercent: 77.2 },
    { stage: 'Search & Item Inspection', count: 9800, conversionPercent: 53.3 },
    { stage: 'Interactive Conversion', count: 4850, conversionPercent: 26.4 },
    { stage: 'Completed Session / Retained', count: 3420, conversionPercent: 18.6 },
  ],
  geographicTraffic: [
    { country: 'United States', countryCode: 'US', users: 3840, sharePercent: 45.2, avgLatencyMs: 38, requestsPerSec: 2240 },
    { country: 'Germany', countryCode: 'DE', users: 1420, sharePercent: 16.7, avgLatencyMs: 54, requestsPerSec: 890 },
    { country: 'United Kingdom', countryCode: 'GB', users: 1180, sharePercent: 13.9, avgLatencyMs: 48, requestsPerSec: 740 },
    { country: 'Japan', countryCode: 'JP', users: 890, sharePercent: 10.5, avgLatencyMs: 72, requestsPerSec: 580 },
    { country: 'Singapore', countryCode: 'SG', users: 680, sharePercent: 8.0, avgLatencyMs: 64, requestsPerSec: 420 },
    { country: 'Canada', countryCode: 'CA', users: 482, sharePercent: 5.7, avgLatencyMs: 42, requestsPerSec: 290 },
  ],
  deviceBreakdown: [
    { device: 'Desktop', sharePercent: 58.4, activeUsers: 4960, avgSessionDurationSec: 412 },
    { device: 'Mobile', sharePercent: 36.2, activeUsers: 3074, avgSessionDurationSec: 245 },
    { device: 'Tablet', sharePercent: 5.4, activeUsers: 458, avgSessionDurationSec: 320 },
  ],
  browserBreakdown: [
    { browser: 'Chrome', sharePercent: 62.5 },
    { browser: 'Safari', sharePercent: 24.1 },
    { browser: 'Firefox', sharePercent: 8.6 },
    { browser: 'Edge', sharePercent: 4.8 },
  ],
  topPages: [
    { path: '/dashboard/realtime', views: 18940, uniqueVisitors: 5420, avgTimeSec: 284, bounceRatePercent: 18.2 },
    { path: '/feed/explore', views: 14200, uniqueVisitors: 4120, avgTimeSec: 195, bounceRatePercent: 26.4 },
    { path: '/checkout/instant', views: 6840, uniqueVisitors: 2890, avgTimeSec: 142, bounceRatePercent: 12.8 },
    { path: '/settings/integrations', views: 4210, uniqueVisitors: 1640, avgTimeSec: 310, bounceRatePercent: 31.0 },
    { path: '/docs/api-reference', views: 3980, uniqueVisitors: 1420, avgTimeSec: 420, bounceRatePercent: 22.5 },
  ],
  liveEventFeed: [
    {
      id: 'evt-1',
      timestamp: '13:08:42',
      timeAgo: '3s ago',
      eventType: 'checkout',
      userAlias: 'usr_89f2a',
      location: 'San Francisco, US',
      details: 'Completed enterprise annual seat license',
      durationMs: 410
    },
    {
      id: 'evt-2',
      timestamp: '13:08:38',
      timeAgo: '7s ago',
      eventType: 'signup',
      userAlias: 'usr_42c91',
      location: 'Berlin, DE',
      details: 'Created developer organization workspace'
    },
    {
      id: 'evt-3',
      timestamp: '13:08:31',
      timeAgo: '14s ago',
      eventType: 'api_call',
      userAlias: 'usr_718e0',
      location: 'Tokyo, JP',
      details: 'Dispatched 5,000 batch ingestion webhooks',
      durationMs: 94
    },
    {
      id: 'evt-4',
      timestamp: '13:08:24',
      timeAgo: '21s ago',
      eventType: 'search',
      userAlias: 'usr_19a3b',
      location: 'London, GB',
      details: 'Executed faceted filter: tag:production status:ok'
    },
    {
      id: 'evt-5',
      timestamp: '13:08:15',
      timeAgo: '30s ago',
      eventType: 'page_view',
      userAlias: 'usr_55d4c',
      location: 'Singapore, SG',
      details: 'Navigated to Live Node Telemetry drilldown'
    }
  ]
};

// Generate realistic 30-point time-series history
export function generateInitialHistory(pointsCount = 30): TimeSeriesPoint[] {
  const points: TimeSeriesPoint[] = [];
  const now = Date.now();
  const stepMs = 6000; // 6 seconds per sample

  for (let i = pointsCount - 1; i >= 0; i--) {
    const time = new Date(now - i * stepMs);
    const timeLabel = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const progress = (pointsCount - i) / pointsCount;
    const wave = Math.sin(progress * Math.PI * 2) * 4;

    const baseCpu = 41.5 + wave + (Math.sin(i * 1.5) * 3);
    const baseMem = 61.0 + (Math.cos(i * 0.8) * 2);
    const baseRps = Math.round(5000 + wave * 45 + (Math.random() * 200 - 100));
    const baseP99 = Math.round(44 + wave * 0.8 + (Math.random() * 6 - 3));
    const baseP50 = Math.round(18 + wave * 0.4 + (Math.random() * 3 - 1.5));
    const baseUsers = Math.round(8400 + wave * 70 + (Math.random() * 80 - 40));
    const baseError = +(0.06 + Math.abs(Math.sin(i * 0.9) * 0.05)).toFixed(3);
    const netIn = +(405 + (Math.sin(i * 1.2) * 25)).toFixed(1);
    const netOut = +(850 + (Math.cos(i * 1.2) * 45)).toFixed(1);
    const diskIops = Math.round(3800 + Math.sin(i * 0.7) * 400);

    points.push({
      timestamp: time.toISOString(),
      timeLabel,
      cpu: +Math.min(98, Math.max(10, baseCpu)).toFixed(1),
      memory: +Math.min(95, Math.max(20, baseMem)).toFixed(1),
      requestsPerSec: baseRps,
      p99Latency: baseP99,
      p50Latency: baseP50,
      activeUsers: baseUsers,
      errorRate: baseError,
      networkInMb: netIn,
      networkOutMb: netOut,
      diskIops
    });
  }
  return points;
}

// Tick function to produce continuous real-time state with spike modifier
export function tickMetrics(
  prevHistory: TimeSeriesPoint[],
  prevNodes: ServerNode[],
  prevEndpoints: EndpointMetric[],
  prevEngagement: UserEngagementData,
  prevAlerts: SystemAlert[],
  loadMultiplier = 1.0,
  isAnomalySurge = false
): {
  history: TimeSeriesPoint[];
  nodes: ServerNode[];
  endpoints: EndpointMetric[];
  engagement: UserEngagementData;
  alerts: SystemAlert[];
} {
  const now = new Date();
  const timeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const lastPoint = prevHistory[prevHistory.length - 1];

  // Random walks with bounded drift
  const cpuDrift = (Math.random() - 0.49) * 2.8 * (isAnomalySurge ? 2.5 : 1);
  const surgeBoost = isAnomalySurge ? 26 : 0;
  const loadBoost = (loadMultiplier - 1.0) * 18;

  const targetCpu = Math.min(96, Math.max(22, 42 + surgeBoost + loadBoost + cpuDrift));
  const newCpu = +(lastPoint.cpu * 0.8 + targetCpu * 0.2).toFixed(1);

  const memDrift = (Math.random() - 0.48) * 0.6;
  const newMem = +(Math.min(88, Math.max(45, lastPoint.memory + memDrift))).toFixed(1);

  const rpsBase = 5000 * loadMultiplier * (isAnomalySurge ? 1.6 : 1.0);
  const rpsNoise = (Math.random() - 0.5) * 350;
  const newRps = Math.round(rpsBase + rpsNoise);

  const latencyMultiplier = isAnomalySurge ? 2.4 : (1 + (loadMultiplier - 1) * 0.4);
  const targetP99 = (42 + (newCpu > 70 ? (newCpu - 70) * 1.8 : 0)) * latencyMultiplier + (Math.random() * 8 - 4);
  const newP99 = Math.round(lastPoint.p99Latency * 0.75 + targetP99 * 0.25);
  const newP50 = Math.round(newP99 * 0.42);

  const usersBase = 8500 * loadMultiplier * (isAnomalySurge ? 1.3 : 1.0);
  const newUsers = Math.round(usersBase + (Math.random() - 0.48) * 140);

  const newErrorRate = isAnomalySurge
    ? +(0.85 + Math.random() * 0.6).toFixed(3)
    : +(0.05 + Math.random() * 0.08).toFixed(3);

  const newNetIn = +(lastPoint.networkInMb * 0.8 + (380 * loadMultiplier + Math.random() * 30) * 0.2).toFixed(1);
  const newNetOut = +(lastPoint.networkOutMb * 0.8 + (820 * loadMultiplier + Math.random() * 60) * 0.2).toFixed(1);
  const newDiskIops = Math.round(3600 * loadMultiplier + (Math.random() - 0.5) * 300);

  const newPoint: TimeSeriesPoint = {
    timestamp: now.toISOString(),
    timeLabel,
    cpu: newCpu,
    memory: newMem,
    requestsPerSec: newRps,
    p99Latency: newP99,
    p50Latency: newP50,
    activeUsers: newUsers,
    errorRate: newErrorRate,
    networkInMb: newNetIn,
    networkOutMb: newNetOut,
    diskIops: newDiskIops
  };

  const newHistory = [...prevHistory.slice(1), newPoint];

  // Update server nodes
  const updatedNodes = prevNodes.map((node) => {
    const nodeCpuDrift = (Math.random() - 0.48) * 3;
    const nodeCpu = Math.min(98, Math.max(18, +(node.cpuPercent + nodeCpuDrift + (isAnomalySurge ? 4 : 0)).toFixed(1)));
    const nodeStatus: ServerNode['status'] = nodeCpu > 88 ? 'critical' : nodeCpu > 75 ? 'degraded' : 'healthy';

    const updatedCores = node.coreUtilization.map((c) =>
      Math.min(99, Math.max(15, Math.round(c + (Math.random() - 0.5) * 5 + (nodeCpu - c) * 0.15)))
    );

    const updatedP99 = Math.round(node.p99LatencyMs * 0.85 + (nodeCpu * 0.9 + Math.random() * 5) * 0.15);

    return {
      ...node,
      cpuPercent: nodeCpu,
      status: nodeStatus,
      p99LatencyMs: updatedP99,
      coreUtilization: updatedCores,
      requestsPerSec: Math.round(node.requestsPerSec + (Math.random() - 0.5) * 40 * loadMultiplier),
    };
  });

  // Update Endpoints
  const updatedEndpoints = prevEndpoints.map((ep) => {
    const delta = (Math.random() - 0.5) * 3;
    const latency = +(Math.max(8, ep.avgLatencyMs + delta * (isAnomalySurge ? 2 : 1))).toFixed(1);
    const p99 = Math.round(latency * 2.8 + (Math.random() * 10 - 5));
    return {
      ...ep,
      avgLatencyMs: latency,
      p99LatencyMs: p99,
      rpm: Math.round(ep.rpm + (Math.random() - 0.5) * 200 * loadMultiplier)
    };
  });

  // Real-time user event feed item generator
  const eventTypes: LiveUserEvent['eventType'][] = ['signup', 'checkout', 'search', 'api_call', 'page_view', 'session_start'];
  const locations = [
    'San Francisco, US', 'New York, US', 'London, GB', 'Berlin, DE', 'Tokyo, JP',
    'Singapore, SG', 'Paris, FR', 'Toronto, CA', 'Sydney, AU', 'Amsterdam, NL'
  ];
  const sampleDetails: Record<LiveUserEvent['eventType'], string[]> = {
    signup: ['Registered enterprise team account', 'Joined via SSO Google Workspace', 'Completed verified developer onboarding'],
    checkout: ['Purchased 100K API capacity pack', 'Renewed annual Pro tier subscription', 'Applied high-volume invoice payment'],
    search: ['Filtered telemetry: node_role == API Gateway', 'Queried endpoint: /api/v2/stream/feed', 'Searched logs: status >= 500'],
    api_call: ['Processed webhook payload: order.completed', 'Dispatched real-time metrics batch', 'Executed batch sync worker invocation'],
    page_view: ['Viewing Cluster Node Topology', 'Drilled into P99 latency flamegraph', 'Inspecting active geographic sessions'],
    session_start: ['New desktop Chrome session initiated', 'Mobile PWA session resumed from background', 'Tablet Safari session authenticated']
  };

  // Maybe push a new user event occasionally
  let updatedEventFeed = [...prevEngagement.liveEventFeed];
  if (Math.random() > 0.3) {
    const pickedType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const detailsPool = sampleDetails[pickedType];
    const pickedDetail = detailsPool[Math.floor(Math.random() * detailsPool.length)];
    const pickedLoc = locations[Math.floor(Math.random() * locations.length)];
    const userHex = Math.floor(Math.random() * 0xfffff).toString(16).padStart(5, '0');

    const newEvent: LiveUserEvent = {
      id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: timeLabel,
      timeAgo: 'Just now',
      eventType: pickedType,
      userAlias: `usr_${userHex}`,
      location: pickedLoc,
      details: pickedDetail,
      durationMs: ['checkout', 'api_call'].includes(pickedType) ? Math.round(40 + Math.random() * 320) : undefined
    };

    updatedEventFeed = [newEvent, ...updatedEventFeed.slice(0, 14)];
  }

  // Update engagement metrics
  const updatedEngagement: UserEngagementData = {
    ...prevEngagement,
    activeUsers: newUsers,
    peakUsersToday: Math.max(prevEngagement.peakUsersToday, newUsers),
    pageviewsPerMinute: Math.round(newUsers * 0.36 + (Math.random() - 0.5) * 40),
    liveEventFeed: updatedEventFeed,
    geographicTraffic: prevEngagement.geographicTraffic.map(geo => ({
      ...geo,
      users: Math.round(newUsers * (geo.sharePercent / 100) + (Math.random() - 0.5) * 15),
      requestsPerSec: Math.round(newRps * (geo.sharePercent / 100) + (Math.random() - 0.5) * 20),
    }))
  };

  // Check alerts
  let updatedAlerts = [...prevAlerts];
  if (isAnomalySurge && !updatedAlerts.some(a => a.title.includes('Surge test anomaly') && !a.resolved)) {
    updatedAlerts.unshift({
      id: `alert-${Date.now()}`,
      timestamp: timeLabel,
      severity: 'critical',
      title: 'Surge test anomaly: High latency & error spikes detected',
      description: `Active traffic surge triggered P99 latency threshold (${newP99}ms) and elevated error rate (${newErrorRate}%).`,
      nodeOrService: 'global-cluster',
      acknowledged: false,
      resolved: false
    });
  }

  return {
    history: newHistory,
    nodes: updatedNodes,
    endpoints: updatedEndpoints,
    engagement: updatedEngagement,
    alerts: updatedAlerts
  };
}

// Export metrics data as formatted CSV string
export function exportMetricsToCSV(history: TimeSeriesPoint[], nodes: ServerNode[], endpoints: EndpointMetric[]): string {
  const lines: string[] = [];

  lines.push('--- REAL-TIME TIME-SERIES METRICS ---');
  lines.push('Timestamp,Time,CPU_Percent,Memory_Percent,Requests_Per_Sec,P99_Latency_ms,P50_Latency_ms,Active_Users,Error_Rate_Percent,Net_In_MBps,Net_Out_MBps,Disk_IOPS');
  history.forEach(p => {
    lines.push(`${p.timestamp},${p.timeLabel},${p.cpu},${p.memory},${p.requestsPerSec},${p.p99Latency},${p.p50Latency},${p.activeUsers},${p.errorRate},${p.networkInMb},${p.networkOutMb},${p.diskIops}`);
  });

  lines.push('\n--- SERVER CLUSTER NODES ---');
  lines.push('Node_ID,Node_Name,Region,Role,Status,CPU_Percent,Memory_Percent,Uptime_Sec,P99_Latency_ms,Requests_Per_Sec,Error_Rate_Percent');
  nodes.forEach(n => {
    lines.push(`${n.id},${n.name},"${n.region}",${n.role},${n.status},${n.cpuPercent},${n.memoryPercent},${n.uptimeSeconds},${n.p99LatencyMs},${n.requestsPerSec},${n.errorRatePercent}`);
  });

  lines.push('\n--- TOP API ENDPOINTS ---');
  lines.push('Endpoint_Path,Method,RPM,Avg_Latency_ms,P95_Latency_ms,P99_Latency_ms,Error_Rate_Percent,Status_2xx,Status_4xx,Status_5xx');
  endpoints.forEach(e => {
    lines.push(`"${e.path}",${e.method},${e.rpm},${e.avgLatencyMs},${e.p95LatencyMs},${e.p99LatencyMs},${e.errorRatePercent},${e.s2xx},${e.s4xx},${e.s5xx}`);
  });

  return lines.join('\n');
}

// Download CSV file to user device
export function downloadFile(content: string, filename: string, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
