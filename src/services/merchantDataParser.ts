import * as XLSX from 'xlsx';
import {
  MerchantRecord,
  MerchantKpis,
  FunnelStage,
  FilterOptions,
  MerchantStatus
} from '../types/merchant.ts';

// Helper to compute hours between two ISO dates
function diffInHours(startDateStr: string | null, endDateStr: string | null): number | null {
  if (!startDateStr || !endDateStr) return null;
  const start = new Date(startDateStr).getTime();
  const end = new Date(endDateStr).getTime();
  if (isNaN(start) || isNaN(end) || end < start) return null;
  return Number(((end - start) / (1000 * 60 * 60)).toFixed(1));
}

// Helper to compute days between two ISO dates
function diffInDays(startDateStr: string | null, endDateStr: string | null): number | null {
  if (!startDateStr || !endDateStr) return null;
  const start = new Date(startDateStr).getTime();
  const end = new Date(endDateStr).getTime();
  if (isNaN(start) || isNaN(end) || end < start) return null;
  return Number(((end - start) / (1000 * 60 * 60 * 24)).toFixed(1));
}

// Determine merchant status from milestone dates
export function deriveMerchantStatus(record: Partial<MerchantRecord>): MerchantStatus {
  if (record.isTerminated || record.contractTerminatedDate) {
    return 'contract_terminated';
  }
  if (record.firstOrderDate) {
    return 'first_order_received';
  }
  if (record.firstItemPublishedDate) {
    return 'published';
  }
  if (record.firstItemSubmittedDate) {
    return 'under_moderation';
  }
  if (record.firstItemDraftDate) {
    return 'item_drafted';
  }
  return 'contract_signed';
}

// Build normalized MerchantRecord from raw fields
export function createMerchantRecord(raw: any, index: number): MerchantRecord {
  const contractDate = raw.contractDate ? new Date(raw.contractDate).toISOString() : new Date().toISOString();
  const firstItemDraftDate = raw.firstItemDraftDate ? new Date(raw.firstItemDraftDate).toISOString() : null;
  const firstItemSubmittedDate = raw.firstItemSubmittedDate ? new Date(raw.firstItemSubmittedDate).toISOString() : null;
  const firstItemPublishedDate = raw.firstItemPublishedDate ? new Date(raw.firstItemPublishedDate).toISOString() : null;
  const firstOrderDate = raw.firstOrderDate ? new Date(raw.firstOrderDate).toISOString() : null;
  const contractTerminatedDate = raw.contractTerminatedDate ? new Date(raw.contractTerminatedDate).toISOString() : null;
  const isTerminated = Boolean(contractTerminatedDate || raw.isTerminated);

  const timeToFirstDraftHours = diffInHours(contractDate, firstItemDraftDate);
  const timeToFirstSubmittedHours = diffInHours(contractDate, firstItemSubmittedDate);
  const timeToFirstPublishedHours = diffInHours(contractDate, firstItemPublishedDate);
  const moderationDurationHours = diffInHours(firstItemSubmittedDate, firstItemPublishedDate);
  const timeToFirstOrderDays = diffInDays(firstItemPublishedDate, firstOrderDate);

  const status = deriveMerchantStatus({
    isTerminated,
    contractTerminatedDate,
    firstOrderDate,
    firstItemPublishedDate,
    firstItemSubmittedDate,
    firstItemDraftDate
  });

  return {
    id: raw.id || `M-${1000 + index}`,
    merchantName: raw.merchantName || `Мерчант #${1000 + index}`,
    category: raw.category || 'Загальна категорія',
    contractDate,
    contractTimestamp: new Date(contractDate).getTime(),
    firstItemDraftDate,
    firstItemDraftTimestamp: firstItemDraftDate ? new Date(firstItemDraftDate).getTime() : null,
    firstItemSubmittedDate,
    firstItemSubmittedTimestamp: firstItemSubmittedDate ? new Date(firstItemSubmittedDate).getTime() : null,
    firstItemPublishedDate,
    firstItemPublishedTimestamp: firstItemPublishedDate ? new Date(firstItemPublishedDate).getTime() : null,
    firstOrderDate,
    firstOrderTimestamp: firstOrderDate ? new Date(firstOrderDate).getTime() : null,
    contractTerminatedDate,
    isTerminated,
    terminationReason: raw.terminationReason || null,
    totalCreatedItems: Number(raw.totalCreatedItems) || (firstItemDraftDate ? 1 : 0),
    totalPublishedItems: Number(raw.totalPublishedItems) || (firstItemPublishedDate ? 1 : 0),
    manager: raw.manager || 'Олена Ковальчук',
    timeToFirstDraftHours,
    timeToFirstSubmittedHours,
    timeToFirstPublishedHours,
    moderationDurationHours,
    timeToFirstOrderDays,
    status
  };
}

// Generate realistic Ukrainian sample dataset with all requested metrics
export function generateSampleDataset(): MerchantRecord[] {
  const categories = [
    'Одяг та взуття', 'Електроніка та гаджети', 'Товари для дому', 
    'Краса та здоров’я', 'Дитячі товари', 'Автотовари', 'Спорт і відпочинок', 'Зоотовари'
  ];

  const managers = [
    'Олена Ковальчук', 'Максим Бондаренко', 'Юлія Ткаченко', 'Артем Шевченко'
  ];

  const terminationReasons = [
    'Складність інтеграції XML/YML фіду',
    'Не відповідає вимогам якості контенту',
    'Передумав виходити на маркетплейс',
    'Відсутність необхідних сертифікатів',
    'Низька рентабельність за комісією'
  ];

  const merchantNamesPool = [
    'ElectroSmart UA', 'ModaStyle Boutique', 'EcoHome Comfort', 'KidsJoy Toys',
    'AutoDrive Master', 'BeautyGlow Cosmetics', 'SportPro Athletics', 'ZooPet Market',
    'TechOptom Ukraine', 'UrbanTrend Wear', 'CozyHouse Decor', 'BabyNest Store',
    'TurboParts Garage', 'OrganicHerbs UA', 'ActiveLife Fitness', 'PetParadise Shop',
    'GadgetPoint Kyiv', 'DenimWorld Fashion', 'HomeChef Kitchen', 'SuperBaby Goods',
    'MotoSpeed Parts', 'PureSkin Lab', 'CrossFit Gear', 'CatDog Treats',
    'NovaElectronix', 'SilkRoad Clothes', 'LumenLight Studio', 'SmartToyland',
    'TireExpert Auto', 'NaturalCare Pharma', 'RunnersClub UA', 'HappyPaws Market',
    'CyberStore Kyiv', 'VogueChic Dress', 'ScandinavianHome', 'JuniorCamp Toys',
    'CarClean Pro', 'AromaSpa Cosmetics', 'PowerGym Store', 'TailWag PetCare',
    'PrimeTech Ukraine', 'VintageDenim UA', 'SmartKitchen Hub', 'TinySteps Baby',
    'AutoShield Plus', 'BioCosmetics UA', 'CampOutdoor Gear', 'PuppyLove Market',
    'DigitalZone UA', 'CasualWear Hub', 'ComfortSleep Mattresses', 'ToyMaster Kids'
  ];

  const now = Date.now();
  const records: MerchantRecord[] = [];

  for (let i = 0; i < 60; i++) {
    const daysAgo = Math.floor(Math.random() * 45) + 2;
    const contractTime = now - daysAgo * 24 * 3600 * 1000;
    const contractDate = new Date(contractTime).toISOString();

    const category = categories[i % categories.length];
    const manager = managers[i % managers.length];
    const name = merchantNamesPool[i % merchantNamesPool.length] + (i >= merchantNamesPool.length ? ` #${i}` : '');

    // Funnel probability logic
    const willTerminate = Math.random() < 0.12; // 12% termination rate
    const willDraft = !willTerminate || Math.random() < 0.5; // 85% draft first item
    const willSubmit = willDraft && (!willTerminate || Math.random() < 0.3) && Math.random() < 0.88; // 75% submit
    const willPublish = willSubmit && !willTerminate && Math.random() < 0.85; // 65% published
    const willGetOrder = willPublish && Math.random() < 0.72; // 48% get first order

    // Timestamps
    let firstItemDraftDate: string | null = null;
    let firstItemSubmittedDate: string | null = null;
    let firstItemPublishedDate: string | null = null;
    let firstOrderDate: string | null = null;
    let contractTerminatedDate: string | null = null;
    let terminationReason: string | null = null;

    let createdItems = 0;
    let publishedItems = 0;

    if (willDraft) {
      // Drafted after 4 to 72 hours
      const draftHours = Math.round((4 + Math.random() * 68) * 10) / 10;
      const draftTime = contractTime + draftHours * 3600 * 1000;
      firstItemDraftDate = new Date(draftTime).toISOString();
      createdItems = Math.floor(1 + Math.random() * 45);

      if (willSubmit) {
        // Submitted after additional 2 to 48 hours
        const submitHours = Math.round((2 + Math.random() * 46) * 10) / 10;
        const submitTime = draftTime + submitHours * 3600 * 1000;
        firstItemSubmittedDate = new Date(submitTime).toISOString();

        if (willPublish) {
          // Moderation takes 6 to 36 hours
          const modHours = Math.round((6 + Math.random() * 30) * 10) / 10;
          const publishTime = submitTime + modHours * 3600 * 1000;
          firstItemPublishedDate = new Date(publishTime).toISOString();
          publishedItems = Math.max(1, Math.floor(createdItems * (0.6 + Math.random() * 0.4)));

          if (willGetOrder) {
            // First order occurs after 1 to 14 days
            const orderDays = Math.round((1 + Math.random() * 13) * 10) / 10;
            const orderTime = publishTime + orderDays * 24 * 3600 * 1000;
            if (orderTime < now) {
              firstOrderDate = new Date(orderTime).toISOString();
            }
          }
        }
      }
    }

    if (willTerminate) {
      const termDelayHours = Math.round((12 + Math.random() * 120) * 10) / 10;
      contractTerminatedDate = new Date(contractTime + termDelayHours * 3600 * 1000).toISOString();
      terminationReason = terminationReasons[Math.floor(Math.random() * terminationReasons.length)];
    }

    records.push(
      createMerchantRecord(
        {
          id: `M-${2040 + i}`,
          merchantName: name,
          category,
          contractDate,
          firstItemDraftDate,
          firstItemSubmittedDate,
          firstItemPublishedDate,
          firstOrderDate,
          contractTerminatedDate,
          isTerminated: willTerminate,
          terminationReason,
          totalCreatedItems: createdItems,
          totalPublishedItems: publishedItems,
          manager
        },
        i
      )
    );
  }

  // Sort descending by contract date
  return records.sort((a, b) => b.contractTimestamp - a.contractTimestamp);
}

// Calculate all aggregate KPIs and Speed metrics from filtered dataset
export function calculateMerchantKpis(merchants: MerchantRecord[]): MerchantKpis {
  const total = merchants.length;
  if (total === 0) {
    return {
      totalMerchants: 0,
      draftedFirstItemCount: 0,
      draftedFirstItemPct: 0,
      submittedFirstItemCount: 0,
      submittedFirstItemPct: 0,
      publishedFirstItemCount: 0,
      publishedFirstItemPct: 0,
      firstOrderCount: 0,
      firstOrderPct: 0,
      terminatedCount: 0,
      terminatedPct: 0,
      totalCreatedItems: 0,
      totalPublishedItems: 0,
      avgCreatedItemsPerMerchant: 0,
      avgPublishedItemsPerMerchant: 0,
      avgTimeToDraftHours: 0,
      medianTimeToDraftHours: 0,
      avgTimeToSubmitHours: 0,
      medianTimeToSubmitHours: 0,
      avgTimeToPublishHours: 0,
      medianTimeToPublishHours: 0,
      avgTimeToFirstOrderDays: 0,
      medianTimeToFirstOrderDays: 0
    };
  }

  const drafted = merchants.filter(m => m.firstItemDraftDate);
  const submitted = merchants.filter(m => m.firstItemSubmittedDate);
  const published = merchants.filter(m => m.firstItemPublishedDate);
  const withFirstOrder = merchants.filter(m => m.firstOrderDate);
  const terminated = merchants.filter(m => m.isTerminated);

  const totalCreated = merchants.reduce((sum, m) => sum + m.totalCreatedItems, 0);
  const totalPub = merchants.reduce((sum, m) => sum + m.totalPublishedItems, 0);

  // Time arrays
  const draftHours = drafted
    .map(m => m.timeToFirstDraftHours)
    .filter((v): v is number => v !== null && v >= 0)
    .sort((a, b) => a - b);

  const submitHours = submitted
    .map(m => m.timeToFirstSubmittedHours)
    .filter((v): v is number => v !== null && v >= 0)
    .sort((a, b) => a - b);

  const pubHours = published
    .map(m => m.timeToFirstPublishedHours)
    .filter((v): v is number => v !== null && v >= 0)
    .sort((a, b) => a - b);

  const orderDays = withFirstOrder
    .map(m => m.timeToFirstOrderDays)
    .filter((v): v is number => v !== null && v >= 0)
    .sort((a, b) => a - b);

  const avg = (arr: number[]) => arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 0;
  const median = (arr: number[]) => {
    if (!arr.length) return 0;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0 ? arr[mid] : +((arr[mid - 1] + arr[mid]) / 2).toFixed(1);
  };

  return {
    totalMerchants: total,
    draftedFirstItemCount: drafted.length,
    draftedFirstItemPct: +((drafted.length / total) * 100).toFixed(1),
    submittedFirstItemCount: submitted.length,
    submittedFirstItemPct: +((submitted.length / total) * 100).toFixed(1),
    publishedFirstItemCount: published.length,
    publishedFirstItemPct: +((published.length / total) * 100).toFixed(1),
    firstOrderCount: withFirstOrder.length,
    firstOrderPct: +((withFirstOrder.length / total) * 100).toFixed(1),
    terminatedCount: terminated.length,
    terminatedPct: +((terminated.length / total) * 100).toFixed(1),
    totalCreatedItems: totalCreated,
    totalPublishedItems: totalPub,
    avgCreatedItemsPerMerchant: +(totalCreated / total).toFixed(1),
    avgPublishedItemsPerMerchant: published.length ? +(totalPub / published.length).toFixed(1) : 0,
    avgTimeToDraftHours: avg(draftHours),
    medianTimeToDraftHours: median(draftHours),
    avgTimeToSubmitHours: avg(submitHours),
    medianTimeToSubmitHours: median(submitHours),
    avgTimeToPublishHours: avg(pubHours),
    medianTimeToPublishHours: median(pubHours),
    avgTimeToFirstOrderDays: avg(orderDays),
    medianTimeToFirstOrderDays: median(orderDays)
  };
}

// Build 5-step Activation Funnel
export function calculateFunnelStages(merchants: MerchantRecord[]): FunnelStage[] {
  const total = merchants.length;
  if (total === 0) return [];

  const drafted = merchants.filter(m => m.firstItemDraftDate).length;
  const submitted = merchants.filter(m => m.firstItemSubmittedDate).length;
  const published = merchants.filter(m => m.firstItemPublishedDate).length;
  const ordered = merchants.filter(m => m.firstOrderDate).length;

  const kpis = calculateMerchantKpis(merchants);

  return [
    {
      id: 'step_1_contract',
      title: 'Підписання договору',
      shortTitle: 'Договір',
      count: total,
      conversionFromTotal: 100,
      conversionFromPrev: 100,
      dropoffCount: total - drafted,
      avgDurationLabel: 'Старт онбордингу',
      color: '#38bdf8'
    },
    {
      id: 'step_2_draft',
      title: 'Перше додавання товару',
      shortTitle: '1-й товар',
      count: drafted,
      conversionFromTotal: +((drafted / total) * 100).toFixed(1),
      conversionFromPrev: total ? +((drafted / total) * 100).toFixed(1) : 0,
      dropoffCount: drafted - submitted,
      avgDurationLabel: `${kpis.avgTimeToDraftHours} год. сер. (${kpis.medianTimeToDraftHours} год. мед.)`,
      color: '#818cf8'
    },
    {
      id: 'step_3_submit',
      title: 'Відправка на модерацію',
      shortTitle: 'Модерація',
      count: submitted,
      conversionFromTotal: +((submitted / total) * 100).toFixed(1),
      conversionFromPrev: drafted ? +((submitted / drafted) * 100).toFixed(1) : 0,
      dropoffCount: submitted - published,
      avgDurationLabel: `${kpis.avgTimeToSubmitHours} год. сер. від договору`,
      color: '#a855f7'
    },
    {
      id: 'step_4_publish',
      title: 'Перша публікація товару',
      shortTitle: 'Опубліковано',
      count: published,
      conversionFromTotal: +((published / total) * 100).toFixed(1),
      conversionFromPrev: submitted ? +((published / submitted) * 100).toFixed(1) : 0,
      dropoffCount: published - ordered,
      avgDurationLabel: `${kpis.avgTimeToPublishHours} год. сер. (${(kpis.avgTimeToPublishHours / 24).toFixed(1)} дні)`,
      color: '#34d399'
    },
    {
      id: 'step_5_order',
      title: 'Перше отримане замовлення',
      shortTitle: '1-ше замовлення',
      count: ordered,
      conversionFromTotal: +((ordered / total) * 100).toFixed(1),
      conversionFromPrev: published ? +((ordered / published) * 100).toFixed(1) : 0,
      dropoffCount: 0,
      avgDurationLabel: `${kpis.avgTimeToFirstOrderDays} дні від публікації`,
      color: '#f59e0b'
    }
  ];
}

// Parse Excel / CSV file into MerchantRecord[]
export async function parseExcelOrCsvFile(file: File): Promise<MerchantRecord[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

  if (!jsonRows || jsonRows.length === 0) {
    throw new Error('Файл не містить рядків або таблиця порожня.');
  }

  // Column matching logic
  return jsonRows.map((row, index) => {
    const findVal = (possibleKeys: string[]) => {
      for (const k of possibleKeys) {
        for (const rowKey of Object.keys(row)) {
          if (rowKey.trim().toLowerCase() === k.trim().toLowerCase()) {
            return row[rowKey];
          }
        }
      }
      return null;
    };

    const id = findVal(['id', 'merchant id', 'код мерчанта', 'id мерчанта', 'merchant_id']) || `M-${1000 + index}`;
    const merchantName = findVal(['мерчант', 'назва', 'назва мерчанта', 'merchant name', 'магазин', 'company']) || `Мерчант #${index + 1}`;
    const category = findVal(['категорія', 'category', 'товарна категорія', 'група']) || 'Загальна категорія';
    const contractDate = findVal(['дата договору', 'договір', 'contract date', 'registration date', 'дата реєстрації', 'contract_date']);
    const firstItemDraftDate = findVal(['перше додавання товару', 'перший товар', 'дата першого товару', 'first draft date', 'draft_date', 'first item date']);
    const firstItemSubmittedDate = findVal(['перша відправка на модерацію', 'модерація', 'дата модерації', 'first submit date', 'submitted_date', 'відправлено на модерацію']);
    const firstItemPublishedDate = findVal(['перша публікація товару', 'публікація', 'дата публікації', 'first published date', 'published_date', 'перша публікація']);
    const firstOrderDate = findVal(['перше замовлення', 'дата першого замовлення', 'перший продаж', 'first order date', 'first_order_date']);
    const contractTerminatedDate = findVal(['дата припинення договору', 'дата розірвання', 'дата припинення', 'terminated date', 'termination_date']);
    const terminationReason = findVal(['причина припинення', 'причина розірвання', 'причина відтоку', 'termination reason']);
    const totalCreatedItems = findVal(['кількість створених нових товарів', 'створено товарів', 'створені товари', 'created items', 'total_created_items']) || 0;
    const totalPublishedItems = findVal(['кількість опублікованих товарів', 'опубліковано товарів', 'опубліковані товари', 'published items', 'total_published_items']) || 0;
    const manager = findVal(['менеджер', 'manager', 'куратор', 'онбординг менеджер']) || 'Загальний пул';

    return createMerchantRecord({
      id,
      merchantName,
      category,
      contractDate,
      firstItemDraftDate,
      firstItemSubmittedDate,
      firstItemPublishedDate,
      firstOrderDate,
      contractTerminatedDate,
      terminationReason,
      totalCreatedItems,
      totalPublishedItems,
      manager
    }, index);
  });
}

// Generate & Download Excel template file with sample headers for Power BI
export function downloadExcelTemplate() {
  const sampleData = [
    {
      'ID Мерчанта': 'M-101',
      'Назва мерчанта': 'TechnoStore UA',
      'Категорія': 'Електроніка та гаджети',
      'Дата договору': '2026-09-01 10:30',
      'Перше додавання товару': '2026-09-01 18:45',
      'Перша відправка на модерацію': '2026-09-02 11:20',
      'Перша публікація товару': '2026-09-03 09:15',
      'Перше замовлення': '2026-09-06 14:00',
      'Кількість створених товарів': 35,
      'Кількість опублікованих товарів': 32,
      'Дата припинення договору': '',
      'Причина припинення': '',
      'Менеджер': 'Олена Ковальчук'
    },
    {
      'ID Мерчанта': 'M-102',
      'Назва мерчанта': 'FashionStyle Boutique',
      'Категорія': 'Одяг та взуття',
      'Дата договору': '2026-09-03 14:00',
      'Перше додавання товару': '2026-09-04 16:30',
      'Перша відправка на модерацію': '2026-09-05 10:00',
      'Перша публікація товару': '2026-09-06 18:00',
      'Перше замовлення': '',
      'Кількість створених товарів': 18,
      'Кількість опублікованих товарів': 18,
      'Дата припинення договору': '',
      'Причина припинення': '',
      'Менеджер': 'Максим Бондаренко'
    },
    {
      'ID Мерчанта': 'M-103',
      'Назва мерчанта': 'HomeGarden Shop',
      'Категорія': 'Товари для дому',
      'Дата договору': '2026-09-05 09:00',
      'Перше додавання товару': '2026-09-06 12:00',
      'Перша відправка на модерацію': '',
      'Перша публікація товару': '',
      'Перше замовлення': '',
      'Кількість створених товарів': 4,
      'Кількість опублікованих товарів': 0,
      'Дата припинення договору': '2026-09-12 11:00',
      'Причина припинення': 'Складність інтеграції XML/YML фіду',
      'Менеджер': 'Юлія Ткаченко'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Merchants_Activity');
  XLSX.writeFile(workbook, 'powerbi_merchants_template.xlsx');
}

// Local storage management
const STORAGE_KEY = 'marketplace_merchants_data_v1';
const SYNC_CONFIG_KEY = 'marketplace_sync_config_v1';

export function saveMerchantsToStorage(merchants: MerchantRecord[], fileName?: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merchants));
    const config = {
      mode: 'manual_upload',
      dailyTime: '06:00',
      lastSyncDate: new Date().toLocaleString('uk-UA'),
      nextSyncDate: new Date(Date.now() + 24 * 3600 * 1000).toLocaleDateString('uk-UA') + ' 06:00',
      fileName: fileName || 'Power BI Export (.xlsx)',
      sourceType: fileName ? 'Power BI Export (.xlsx)' : 'Sample Dataset'
    };
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

export function loadMerchantsFromStorage(): MerchantRecord[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
