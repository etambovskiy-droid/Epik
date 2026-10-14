export type WidgetType =
  | 'kpi_card'
  | 'funnel'
  | 'velocity_chart'
  | 'registry_table'
  | 'distribution_bar'
  | 'cohort_churn'
  | 'custom_kpi';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  subtitle?: string;
  width?: 'full' | 'half' | 'third';
  customValue?: string | number;
  customChange?: string;
  metricTarget?: string;
}

export interface DashboardTab {
  id: string;
  title: string;
  description: string;
  iconName: string;
  isPreset: boolean;
  category: 'onboarding' | 'sales' | 'moderation' | 'custom';
  widgets: WidgetConfig[];
  updatedAt: string;
}

export interface ShareConfig {
  publicUrl: string;
  accessMode: 'view' | 'edit';
  lastUpdated: string;
}
