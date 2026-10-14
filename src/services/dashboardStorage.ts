import { DashboardTab, WidgetConfig } from '../types/saas.ts';

const DASHBOARDS_STORAGE_KEY = 'epicentr_saas_dashboards_v3';

export const INITIAL_DASHBOARDS: DashboardTab[] = [
  {
    id: 'dash-onboarding',
    title: 'Активність нових мерчантів (БІ)',
    description: 'Онбординг, швидкість перших дій, створення та публікація товарів, перші замовлення з експорту Power BI',
    iconName: 'UserCheck',
    isPreset: true,
    category: 'onboarding',
    updatedAt: new Date().toLocaleDateString('uk-UA'),
    widgets: [
      { id: 'w-kpi-main', type: 'kpi_card', title: 'Основні показники онбордингу', width: 'full' },
      { id: 'w-funnel', type: 'funnel', title: 'Воронка онбордингу мерчанта', width: 'full' },
      { id: 'w-time', type: 'velocity_chart', title: 'Швидкість дій (Time-to-Value)', width: 'full' },
      { id: 'w-table', type: 'registry_table', title: 'Реєстр мерчантів', width: 'full' }
    ]
  }
];

export function loadDashboards(): DashboardTab[] {
  try {
    const raw = localStorage.getItem(DASHBOARDS_STORAGE_KEY);
    if (!raw) return INITIAL_DASHBOARDS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_DASHBOARDS;
  } catch {
    return INITIAL_DASHBOARDS;
  }
}

export function saveDashboards(dashboards: DashboardTab[]) {
  try {
    localStorage.setItem(DASHBOARDS_STORAGE_KEY, JSON.stringify(dashboards));
  } catch (err) {
    console.error('Failed to save dashboards:', err);
  }
}

export function createNewDashboard(
  title: string,
  description: string,
  category: DashboardTab['category'] = 'custom'
): DashboardTab {
  return {
    id: `dash-${Date.now()}`,
    title,
    description,
    iconName: 'Layers',
    isPreset: false,
    category,
    updatedAt: new Date().toLocaleDateString('uk-UA'),
    widgets: [
      { id: `w-${Date.now()}-1`, type: 'kpi_card', title: 'Основні метрики', width: 'full' },
      { id: `w-${Date.now()}-2`, type: 'registry_table', title: 'Зведена таблиця даних', width: 'full' }
    ]
  };
}
