import { ColumnProfile, ColumnDataType, AutoDashboardType, DynamicDashboard } from '../types/dynamicDashboard.ts';

// Helper to test if a string represents a valid date
function isValidDate(val: any): boolean {
  if (!val) return false;
  if (val instanceof Date) return !isNaN(val.getTime());
  if (typeof val === 'number') return false; // Avoid pure numbers being treated as epoch
  if (typeof val !== 'string') return false;
  
  // Date patterns: YYYY-MM-DD, DD.MM.YYYY, YYYY/MM/DD, ISO
  const trimmed = val.trim();
  if (trimmed.length < 8 || trimmed.length > 35) return false;
  
  // Check common date delimiters
  if (!/[.\-\/:]/.test(trimmed)) return false;
  
  const parsed = Date.parse(trimmed);
  if (isNaN(parsed)) return false;
  
  const year = new Date(parsed).getFullYear();
  return year >= 2000 && year <= 2035;
}

// Analyze raw array of records from Excel/CSV
export function analyzeDataset(
  rows: Record<string, any>[],
  fileName: string
): DynamicDashboard {
  if (!rows || rows.length === 0) {
    throw new Error('Файл не містить рядків.');
  }

  const recordCount = rows.length;
  const sample = rows.slice(0, 100);
  const allKeys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));

  const columns: ColumnProfile[] = [];

  allKeys.forEach((key) => {
    let nullCount = 0;
    const values: any[] = [];

    rows.forEach((r) => {
      const v = r[key];
      if (v === null || v === undefined || v === '') {
        nullCount++;
      } else {
        values.push(v);
      }
    });

    if (values.length === 0) {
      columns.push({
        key,
        label: key,
        type: 'text',
        uniqueCount: 0,
        nullCount,
        sampleValues: []
      });
      return;
    }

    const uniqueSet = new Set(values);
    const uniqueCount = uniqueSet.size;

    // Detect type
    let numCount = 0;
    let dateCount = 0;
    let boolCount = 0;

    values.forEach((v) => {
      if (typeof v === 'number' || (!isNaN(Number(v)) && typeof v === 'string' && v.trim() !== '')) {
        numCount++;
      } else if (isValidDate(v)) {
        dateCount++;
      } else if (typeof v === 'boolean' || v === 'true' || v === 'false') {
        boolCount++;
      }
    });

    let detectedType: ColumnDataType = 'text';
    const totalValid = values.length;

    if (numCount / totalValid > 0.8) {
      detectedType = 'number';
    } else if (dateCount / totalValid > 0.7) {
      detectedType = 'date';
    } else if (boolCount / totalValid > 0.8) {
      detectedType = 'boolean';
    } else if (uniqueCount <= Math.min(30, Math.ceil(recordCount * 0.4))) {
      detectedType = 'category';
    } else {
      detectedType = 'text';
    }

    const col: ColumnProfile = {
      key,
      label: key,
      type: detectedType,
      uniqueCount,
      nullCount,
      sampleValues: Array.from(uniqueSet).slice(0, 5)
    };

    // Calculate Numeric stats
    if (detectedType === 'number') {
      const numArr = values.map(v => Number(v)).filter(n => !isNaN(n));
      if (numArr.length > 0) {
        const sum = numArr.reduce((a, b) => a + b, 0);
        col.sum = +sum.toFixed(2);
        col.avg = +(sum / numArr.length).toFixed(2);
        col.min = Math.min(...numArr);
        col.max = Math.max(...numArr);
      }
    }

    // Calculate Category stats (frequencies)
    if (detectedType === 'category' || (detectedType === 'text' && uniqueCount <= 20)) {
      const freq: Record<string, number> = {};
      values.forEach((v) => {
        const str = String(v).trim();
        freq[str] = (freq[str] || 0) + 1;
      });

      col.topCategories = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([val, count]) => ({
          value: val,
          count,
          percentage: +((count / totalValid) * 100).toFixed(1)
        }));
    }

    // Calculate Date stats
    if (detectedType === 'date') {
      const dateTimestamps = values.map(v => new Date(v).getTime()).filter(t => !isNaN(t));
      if (dateTimestamps.length > 0) {
        col.minDate = new Date(Math.min(...dateTimestamps)).toLocaleDateString('uk-UA');
        col.maxDate = new Date(Math.max(...dateTimestamps)).toLocaleDateString('uk-UA');
      }
    }

    columns.push(col);
  });

  // Check domain patterns
  const keyNamesLower = allKeys.map(k => k.toLowerCase());
  const hasMerchantMarkers = keyNamesLower.some(k => 
    k.includes('мерчант') || k.includes('merchant') || k.includes('магазин') || k.includes('продавець')
  );
  const hasFunnelMarkers = keyNamesLower.some(k => 
    k.includes('договір') || k.includes('модерац') || k.includes('публікац') || k.includes('перш') || k.includes('draft')
  );

  const hasSalesMarkers = keyNamesLower.some(k => 
    k.includes('сума') || k.includes('виручка') || k.includes('чек') || k.includes('gmv') || k.includes('revenue') || k.includes('ціна') || k.includes('price') || k.includes('замовлен')
  );

  let detectedType: AutoDashboardType = 'generic_bi';
  if (hasMerchantMarkers && hasFunnelMarkers) {
    detectedType = 'merchant_funnel';
  } else if (hasSalesMarkers) {
    detectedType = 'sales_orders';
  }

  // Find primary date & category column
  const primaryDateColumn = columns.find(c => c.type === 'date')?.key;
  const primaryCategoryColumn = columns.find(c => c.type === 'category' && c.uniqueCount >= 2 && c.uniqueCount <= 20)?.key;
  const numericMetricColumns = columns.filter(c => c.type === 'number').map(c => c.key);

  const cleanTitle = fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]/g, ' ')
    .trim();

  return {
    id: `bi-dash-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: cleanTitle ? `Експорт БІ: ${cleanTitle}` : 'Новий дашборд БІ',
    fileName,
    uploadedAt: new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString('uk-UA'),
    recordCount,
    columns,
    data: rows,
    detectedType,
    primaryDateColumn,
    primaryCategoryColumn,
    numericMetricColumns
  };
}
