export type ColumnDataType = 'number' | 'date' | 'category' | 'text' | 'boolean';

export interface ColumnProfile {
  key: string;
  label: string;
  type: ColumnDataType;
  uniqueCount: number;
  nullCount: number;
  sampleValues: any[];
  // Numeric stats
  sum?: number;
  avg?: number;
  min?: number;
  max?: number;
  // Category stats
  topCategories?: { value: string; count: number; percentage: number }[];
  // Date stats
  minDate?: string;
  maxDate?: string;
}

export type AutoDashboardType = 'merchant_funnel' | 'sales_orders' | 'generic_bi';

export interface DynamicDashboard {
  id: string;
  title: string;
  fileName: string;
  uploadedAt: string;
  recordCount: number;
  columns: ColumnProfile[];
  data: Record<string, any>[];
  detectedType: AutoDashboardType;
  
  // Quick summary stats for KPI cards
  primaryDateColumn?: string;
  primaryCategoryColumn?: string;
  numericMetricColumns: string[];
}
