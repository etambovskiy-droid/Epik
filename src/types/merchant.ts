export type MerchantStatus =
  | 'contract_signed'
  | 'item_drafted'
  | 'under_moderation'
  | 'published'
  | 'first_order_received'
  | 'contract_terminated';

export interface MerchantRecord {
  id: string;
  merchantName: string;
  category: string;
  contractDate: string; // ISO date string YYYY-MM-DD
  contractTimestamp: number;
  
  // Funnel milestone timestamps (null if not reached)
  firstItemDraftDate: string | null;
  firstItemDraftTimestamp: number | null;
  
  firstItemSubmittedDate: string | null;
  firstItemSubmittedTimestamp: number | null;
  
  firstItemPublishedDate: string | null;
  firstItemPublishedTimestamp: number | null;
  
  firstOrderDate: string | null;
  firstOrderTimestamp: number | null;
  
  // Terminations
  contractTerminatedDate: string | null;
  isTerminated: boolean;
  terminationReason: string | null;
  
  // Product volumes
  totalCreatedItems: number;
  totalPublishedItems: number;
  
  // Manager
  manager: string;
  
  // Computed time metrics
  timeToFirstDraftHours: number | null; // час додавання першого товару
  timeToFirstSubmittedHours: number | null; // час відправки першого товару на модерацію
  timeToFirstPublishedHours: number | null; // час публікації першого товару (від договору)
  moderationDurationHours: number | null; // час самої модерації (від відправки до публікації)
  timeToFirstOrderDays: number | null; // час до першого замовлення (від публікації)
  
  status: MerchantStatus;
}

export interface MerchantKpis {
  totalMerchants: number;
  draftedFirstItemCount: number;
  draftedFirstItemPct: number;
  
  submittedFirstItemCount: number;
  submittedFirstItemPct: number;
  
  publishedFirstItemCount: number;
  publishedFirstItemPct: number;
  
  firstOrderCount: number;
  firstOrderPct: number;
  
  terminatedCount: number;
  terminatedPct: number;
  
  totalCreatedItems: number;
  totalPublishedItems: number;
  avgCreatedItemsPerMerchant: number;
  avgPublishedItemsPerMerchant: number;
  
  // Speed / Time-to-Action KPIs (median and average)
  avgTimeToDraftHours: number;
  medianTimeToDraftHours: number;
  
  avgTimeToSubmitHours: number;
  medianTimeToSubmitHours: number;
  
  avgTimeToPublishHours: number;
  medianTimeToPublishHours: number;
  
  avgTimeToFirstOrderDays: number;
  medianTimeToFirstOrderDays: number;
}

export interface FunnelStage {
  id: string;
  title: string;
  shortTitle: string;
  count: number;
  conversionFromTotal: number; // % від усіх підписаних договорів
  conversionFromPrev: number; // % від попереднього етапу
  dropoffCount: number;
  avgDurationLabel: string;
  color: string;
}

export interface FilterOptions {
  dateRange: 'all' | '7d' | '30d' | '90d' | 'this_month';
  category: string;
  status: string;
  manager: string;
  search: string;
}

export interface DailySyncConfig {
  mode: 'manual_upload' | 'daily_scheduled';
  dailyTime: string; // e.g. "06:00"
  lastSyncDate: string;
  nextSyncDate: string;
  fileName?: string;
  sourceType: 'Power BI Export (.xlsx)' | 'Direct Cloud Sync' | 'Sample Dataset';
}
