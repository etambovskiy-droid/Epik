/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type EpicentrColumnType = 'select' | 'multiselect' | 'text' | 'float' | 'array' | 'string';

export interface EpicentrColumn {
  colIndex: number;
  originalName: string;
  cleanName: string;
  type: EpicentrColumnType;
  isRequired: boolean; // Contains '*' in column header
  isMandatory?: boolean; // Convenience alias
  lang?: 'ua' | 'ru';
  unit?: string;
  rawComment?: string; // Epicentr JSON metadata in cell comment
}

export interface EpicentrDictionaryAttribute {
  attributeName: string;
  cleanAttributeName: string;
  allowedValues: string[]; // Raw values (with HTML entities like &#039;)
  decodedValuesMap: Record<string, string>; // normalized lower/decoded -> raw dictionary value
  synonymsMap: Record<string, string>; // synonym -> raw dictionary value
}

export interface EpicentrValueDiff {
  colIndex: number;
  columnName: string;
  isRequired: boolean;
  type: EpicentrColumnType;
  oldValue: string;
  newValue: string;
  source: 'already_filled' | 'description' | 'photo' | 'internet_search' | 'xml' | 'other_column' | 'manual';
  confidence: number;
  note?: string;
}

export interface EpicentrProductRow {
  rowIdx: number;
  id: string; // Protected ID column
  originalRow: Record<string, any>;
  updatedRow: Record<string, any>;
  diffs: Record<string, EpicentrValueDiff>;
  
  // High level extracted / enriched attributes
  titleOriginal: string;
  titleFormattedUa?: string;
  titleFormattedRu?: string;
  vendorCode?: string;
  brand?: string;
  isBrandOther?: boolean;
  
  // Photos
  firstPhotoUrl?: string;
  allPhotoUrls: string[];
  photoAnalysis?: {
    primaryColor?: string;
    manufacturerColor?: string;
    hasPattern: boolean;
    patternType?: string; // 'з візерунком' | 'без візерунка (однотонний)'
    material?: string;
    features?: string[];
  };

  // Status & Issues
  status: 'valid' | 'has_conflicts' | 'missing_required';
  unfilledRequiredFields: string[];
  conflicts: {
    columnName: string;
    photoValue?: string;
    textValue?: string;
    description: string;
  }[];
  languageCorrections: {
    columnName: string;
    fromLang: 'ua' | 'ru';
    toLang: 'ua' | 'ru';
    originalText: string;
    correctedText: string;
  }[];
}

export interface ProcessSettings {
  reformatTitles: boolean; // Крок 0 обов'язкове запитання
  autoFixLanguages: boolean; // Перевірка [ua] vs [ru]
  photoFirstPriority: boolean; // Перше фото як головне для кольору та візерунка
  enableWebSearch: boolean; // Пошук в інтернеті для відсутніх характеристик
  brandFallbackOther: boolean; // Якщо бренд не в довіднику -> "Інше"
  strictDictionaryOnly: boolean; // Тільки значення з довідника
}

export interface ProcessingReportSummary {
  totalProducts: number;
  totalColumns: number;
  mandatoryColumnsCount: number;
  totalMandatoryFields: number;
  alreadyFilledCount: number;
  newlyFilledCount: number;
  unfilledMandatoryCount: number;
  fillRatePercentage: number;
  
  unfilledFieldsBreakdown: {
    columnName: string;
    unfilledCount: number;
    reason: string;
    affectedProductIds: string[];
  }[];
  
  brandsMarkedOther: {
    rowIdx: number;
    productId: string;
    title: string;
    originalBrand: string;
  }[];

  conflictsFound: {
    rowIdx: number;
    productId: string;
    productTitle: string;
    columnName: string;
    details: string;
  }[];

  languageFixes: {
    rowIdx: number;
    productId: string;
    columnName: string;
    oldText: string;
    newText: string;
    direction: string;
  }[];

  errors: EngineErrorEvent[];
}

export type EngineErrorSeverity = 'critical' | 'warning' | 'info';
export type EngineErrorPhase =
  | 'column_analysis'
  | 'photo_parsing'
  | 'dict_matching'
  | 'language_check'
  | 'title_formatting'
  | 'validation'
  | 'export_packaging';

export interface EngineErrorEvent {
  id: string;
  timestamp: string;
  severity: EngineErrorSeverity;
  phase: EngineErrorPhase;
  rowIdx?: number;
  productId?: string;
  columnName?: string;
  message: string;
  technicalDetails?: string;
  stackTrace?: string;
  remediation?: string;
}

export interface SampleCategory {
  id: string;
  title: string;
  badge: string;
  description: string;
  productsCount: number;
  defaultData: any[];
  dictionaryData: Record<string, string[]>;
}
