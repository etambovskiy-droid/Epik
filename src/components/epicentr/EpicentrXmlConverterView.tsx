/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileCode,
  Upload,
  Link as LinkIcon,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Download,
  Eye,
  RefreshCw,
  KeyRound,
  ShieldCheck,
  Check,
  Search,
  ChevronRight,
  ExternalLink,
  Layers,
  Tag,
  Package,
  SlidersHorizontal,
  FileCheck2,
  Zap,
  Info
} from 'lucide-react';
import {
  epicentrMerchantApi,
  EpicentrCategory,
  EpicentrAttributeSet,
  FALLBACK_EPICENTR_CATEGORIES
} from '../../services/epicentrMerchantApiService';
import {
  XmlFeedParserService,
  SourceProduct,
  SAMPLE_SOURCE_XML_FEED
} from '../../services/xmlFeedParserService';
import {
  EpicentrXmlGeneratorService,
  CategoryMappingConfig,
  EpicentrXsdValidationReport
} from '../../services/epicentrXmlGeneratorService';
import {
  GeminiFeedEnrichmentService,
  EnrichmentProgress
} from '../../services/geminiFeedEnrichmentService';
import { getStoredApiKey } from '../../services/aiApiKeyService';
import { EpicentrTokenModal } from './EpicentrTokenModal';
import { XmlPreviewModal } from './XmlPreviewModal';

interface EpicentrXmlConverterViewProps {
  onOpenApiKeyModal?: () => void;
}

export const EpicentrXmlConverterView: React.FC<EpicentrXmlConverterViewProps> = ({
  onOpenApiKeyModal
}) => {
  // Modal states
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Epicentr Merchant API state
  const [hasToken, setHasToken] = useState<boolean>(epicentrMerchantApi.hasToken());
  const [categories, setCategories] = useState<EpicentrCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // Source feed state
  const [sourceType, setSourceType] = useState<'file' | 'url'>('file');
  const [feedUrl, setFeedUrl] = useState('');
  const [feedFileName, setFeedFileName] = useState<string | null>(null);
  const [rawXmlContent, setRawXmlContent] = useState<string>('');
  const [parsedProducts, setParsedProducts] = useState<SourceProduct[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Mapping state
  const [categoryMappings, setCategoryMappings] = useState<CategoryMappingConfig>({});
  const [autoEnrichUa, setAutoEnrichUa] = useState(true);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentProgress, setEnrichmentProgress] = useState<EnrichmentProgress | null>(null);

  // Output generated XML & XSD Validation state
  const [generatedXml, setGeneratedXml] = useState<string>('');
  const [isGenerated, setIsGenerated] = useState(false);
  const [xsdReport, setXsdReport] = useState<EpicentrXsdValidationReport | null>(null);
  const [showXsdDefinition, setShowXsdDefinition] = useState(false);
  const [downloadGateToast, setDownloadGateToast] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Search filter in products preview
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Epicentr Categories on mount
  useEffect(() => {
    loadEpicentrCategories();
  }, []);

  const loadEpicentrCategories = async (forceRefresh = false) => {
    setIsLoadingCategories(true);
    try {
      const cats = await epicentrMerchantApi.getCategories(forceRefresh);
      setCategories(cats);
    } catch {
      setCategories(FALLBACK_EPICENTR_CATEGORIES);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  // Helper to re-evaluate category mappings when parsed products or categories change
  const buildInitialMappings = (products: SourceProduct[], cats: EpicentrCategory[]) => {
    const mappings: CategoryMappingConfig = {};
    const uniqueCategoryMap = new Map<string, string>();

    products.forEach((p) => {
      if (!uniqueCategoryMap.has(p.categoryId)) {
        uniqueCategoryMap.set(p.categoryId, p.categoryName || p.categoryId);
      }
    });

    uniqueCategoryMap.forEach((categoryName, categoryId) => {
      const { matchedCategory } = epicentrMerchantApi.findBestCategoryMatch(categoryName, cats);
      mappings[categoryId] = {
        epicentrCategoryCode: matchedCategory.code,
        epicentrCategoryName: matchedCategory.name_ua || matchedCategory.name,
        attributeSetCode: matchedCategory.attribute_set_code || `attr_set_${matchedCategory.code}`,
        attributeSetName: matchedCategory.attribute_set_name || matchedCategory.name
      };
    });

    return mappings;
  };

  // Handle parsing of XML string
  const handleProcessXmlString = (xmlString: string, filename?: string) => {
    setIsParsing(true);
    setParseError(null);
    setDownloadGateToast(null);
    try {
      const res = XmlFeedParserService.parseXmlString(xmlString);
      setRawXmlContent(xmlString);
      setParsedProducts(res.products);
      if (filename) setFeedFileName(filename);

      // Auto-map categories
      const activeCats = categories.length > 0 ? categories : FALLBACK_EPICENTR_CATEGORIES;
      const initialMappings = buildInitialMappings(res.products, activeCats);
      setCategoryMappings(initialMappings);
      setIsGenerated(false);
      setGeneratedXml('');
      setXsdReport(null);
    } catch (err: any) {
      setParseError(err.message || 'Не вдалося розпарсити вхідний XML/YML фід.');
    } finally {
      setIsParsing(false);
    }
  };

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleProcessXmlString(content, file.name);
      }
    };
    reader.onerror = () => {
      setParseError('Помилка читання файлу.');
    };
    reader.readAsText(file);
  };

  // URL fetch handler
  const handleFetchUrl = async () => {
    if (!feedUrl.trim()) return;
    setIsParsing(true);
    setParseError(null);
    try {
      const content = await XmlFeedParserService.fetchFeedFromUrl(feedUrl);
      const urlFileName = feedUrl.split('/').pop()?.split('?')[0] || 'remote_feed.xml';
      handleProcessXmlString(content, urlFileName);
    } catch (err: any) {
      setParseError(err.message || 'Помилка завантаження фіду за посиланням.');
    } finally {
      setIsParsing(false);
    }
  };

  // Load Built-in Sample Feed
  const handleLoadSampleFeed = () => {
    handleProcessXmlString(SAMPLE_SOURCE_XML_FEED, 'sample_epicentr_source.xml');
  };

  // Category mapping selector change
  const handleCategoryMappingChange = (sourceCatId: string, epicentrCatCode: string) => {
    const targetCat = categories.find((c) => c.code === epicentrCatCode) || FALLBACK_EPICENTR_CATEGORIES[0];
    setCategoryMappings((prev) => ({
      ...prev,
      [sourceCatId]: {
        epicentrCategoryCode: targetCat.code,
        epicentrCategoryName: targetCat.name_ua || targetCat.name,
        attributeSetCode: targetCat.attribute_set_code || `attr_set_${targetCat.code}`,
        attributeSetName: targetCat.attribute_set_name || targetCat.name
      }
    }));
  };

  // Execute XML generation + automatic XSD validation
  const handleGenerateXml = async (openPreviewModal = true): Promise<{
    xml: string;
    report: EpicentrXsdValidationReport;
  } | null> => {
    if (parsedProducts.length === 0) return null;

    let finalProducts = [...parsedProducts];

    // If auto-enrichment enabled, enrich missing UA tags
    if (autoEnrichUa) {
      setIsEnriching(true);
      try {
        finalProducts = await GeminiFeedEnrichmentService.enrichProductsBatch(
          parsedProducts,
          (progress) => setEnrichmentProgress(progress)
        );
        setParsedProducts(finalProducts);
      } finally {
        setIsEnriching(false);
        setEnrichmentProgress(null);
      }
    }

    const xml = EpicentrXmlGeneratorService.generateEpicentrXml(
      finalProducts,
      categories.length > 0 ? categories : FALLBACK_EPICENTR_CATEGORIES,
      { categoryMappings }
    );

    const validationReport = EpicentrXmlGeneratorService.validateXmlAgainstEpicentrXsd(xml);

    setGeneratedXml(xml);
    setXsdReport(validationReport);
    setIsGenerated(true);
    if (openPreviewModal) {
      setIsPreviewModalOpen(true);
    }

    return { xml, report: validationReport };
  };

  // Standalone XSD validation check trigger
  const handleValidateXsdOnly = async () => {
    if (parsedProducts.length === 0) return;
    if (generatedXml) {
      const report = EpicentrXmlGeneratorService.validateXmlAgainstEpicentrXsd(generatedXml);
      setXsdReport(report);
      setDownloadGateToast({
        type: report.isValid ? 'success' : 'error',
        text: report.isValid
          ? `Перевірку XSD успішно пройдено (${report.complianceScore}% відповідність, ${report.offersValidated} товарів).`
          : `Знайдено ${report.errorCount} помилок невідповідності XSD-схемі Епіцентру.`
      });
    } else {
      const res = await handleGenerateXml(false);
      if (res) {
        setDownloadGateToast({
          type: res.report.isValid ? 'success' : 'error',
          text: res.report.isValid
            ? `XML згенеровано та перевірено за XSD (${res.report.complianceScore}% відповідність). Готово до завантаження!`
            : `Знайдено ${res.report.errorCount} помилок невідповідності XSD-схемі Епіцентру.`
        });
      }
    }
  };

  // Pre-download XSD validation gate before downloading XML
  const handleDownload = async () => {
    let xmlToDownload = generatedXml;
    let currentReport = xsdReport;

    if (!xmlToDownload) {
      const res = await handleGenerateXml(false);
      if (!res) return;
      xmlToDownload = res.xml;
      currentReport = res.report;
    } else {
      currentReport = EpicentrXmlGeneratorService.validateXmlAgainstEpicentrXsd(xmlToDownload);
      setXsdReport(currentReport);
    }

    if (!currentReport.isValid) {
      setDownloadGateToast({
        type: 'error',
        text: `Завантаження зупинено XSD-валідатором: виявлено ${currentReport.errorCount} порушень стандарту Епіцентру. Перевірте звіт нижче.`
      });
      return;
    }

    const filename = `epicentr_feed_${new Date().toISOString().split('T')[0]}.xml`;
    EpicentrXmlGeneratorService.downloadXmlFile(xmlToDownload, filename);
    setDownloadGateToast({
      type: 'success',
      text: `XSD-валідація пройдена (${currentReport.complianceScore}%). Файл ${filename} завантажено.`
    });
  };

  // Download official XSD Schema file
  const handleDownloadXsdSchema = () => {
    EpicentrXmlGeneratorService.downloadXmlFile(
      EpicentrXmlGeneratorService.EPICENTR_OFFICIAL_XSD,
      'epicentr_pim_v2_schema.xsd'
    );
  };

  // Unique source categories for mapping UI
  const uniqueSourceCategories = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    parsedProducts.forEach((p) => {
      const existing = map.get(p.categoryId);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(p.categoryId, {
          id: p.categoryId,
          name: p.categoryName || p.categoryId,
          count: 1
        });
      }
    });
    return Array.from(map.values());
  }, [parsedProducts]);

  // Filtered products for inspection
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return parsedProducts;
    const term = searchTerm.toLowerCase();
    return parsedProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.name_ua && p.name_ua.toLowerCase().includes(term)) ||
        (p.brand && p.brand.toLowerCase().includes(term)) ||
        p.id.toLowerCase().includes(term)
    );
  }, [parsedProducts, searchTerm]);

  const hasApiKey = Boolean(getStoredApiKey());

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Top Banner: Merchant API Status & Action Bar */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
            <FileCode className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-100">
                Генератор XML-фідів Епіцентру
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                PIM API v2
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Автоматичний мапінг категорій та генерація строгого вихідного XML за офіційним стандартом маркетплейсу Епіцентр
            </p>
          </div>
        </div>

        {/* Quick status & Token trigger */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
            <span className={`w-2 h-2 rounded-full ${hasToken ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-slate-300 font-mono text-[11px]">
              {hasToken ? 'Merchant API: Авторизовано' : 'Merchant API: Демо-режим'}
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-sky-300 text-[11px] font-mono">
              {isLoadingCategories ? 'Завантаження...' : `${categories.length} категорій PIM`}
            </span>
          </div>

          <button
            onClick={() => setIsTokenModalOpen(true)}
            className="px-3.5 py-1.5 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>API Token Епіцентру</span>
          </button>

          <button
            onClick={() => loadEpicentrCategories(true)}
            disabled={isLoadingCategories}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
            title="Оновити каталог PIM через API"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCategories ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Grid: Step 1 (Source Data) & Step 2 (Mapping & Settings) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Source Feed Input (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold font-mono">
                  1
                </span>
                <h2 className="text-sm font-semibold text-slate-100">
                  Вхідний фід (XML / YML)
                </h2>
              </div>

              <button
                onClick={handleLoadSampleFeed}
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors flex items-center gap-1"
              >
                <Zap className="w-3 h-3" /> Завантажити демо-фід
              </button>
            </div>

            {/* Source tabs: File vs URL */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
              <button
                onClick={() => setSourceType('file')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                  sourceType === 'file'
                    ? 'bg-slate-800 text-amber-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" /> Файл (.xml, .yml)
              </button>
              <button
                onClick={() => setSourceType('url')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                  sourceType === 'url'
                    ? 'bg-slate-800 text-amber-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" /> Пряме URL-посилання
              </button>
            </div>

            {sourceType === 'file' ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700/80 hover:border-amber-500/50 rounded-2xl p-6 text-center cursor-pointer transition-all bg-slate-950/40 hover:bg-slate-950/80 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml,.yml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-medium text-slate-200">
                  Натисніть або перетягніть XML/YML фід сюди
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Підтримуються каталоги Prom, Rozetka, Hotline, OpenCart, WooCommerce
                </p>
                {feedFileName && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
                    <FileCheck2 className="w-3.5 h-3.5" /> {feedFileName}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-slate-400">
                  URL-посилання на фід стороннього сайту:
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="url"
                      value={feedUrl}
                      onChange={(e) => setFeedUrl(e.target.value)}
                      placeholder="https://myshop.com/feed/export.xml"
                      className="w-full pl-3 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <button
                    onClick={handleFetchUrl}
                    disabled={isParsing || !feedUrl.trim()}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium disabled:opacity-50 transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Завантажити
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Запити виконуються через захищений CORS-проксі шар для доступу до сторонніх доменів.
                </p>
              </div>
            )}

            {parseError && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-700/60 text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{parseError}</span>
              </div>
            )}

            {/* Quick Stats after parsing */}
            {parsedProducts.length > 0 && (
              <div className="grid grid-cols-3 gap-2.5 pt-2">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[11px] text-slate-400 block">Товарів (offers)</span>
                  <span className="text-base font-bold font-mono text-amber-400">
                    {parsedProducts.length}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[11px] text-slate-400 block">Категорій</span>
                  <span className="text-base font-bold font-mono text-sky-400">
                    {uniqueSourceCategories.length}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[11px] text-slate-400 block">Наявність</span>
                  <span className="text-base font-bold font-mono text-emerald-400">
                    {parsedProducts.filter((p) => p.available).length} в наявності
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* AI Bilingual Enrichment Config Card */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-semibold text-slate-100">
                  AI-збагачення (name_ua, description_ua)
                </h2>
              </div>
              {hasApiKey ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  BYOK підключено
                </span>
              ) : (
                <button
                  onClick={onOpenApiKeyModal}
                  className="text-[10px] text-amber-400 hover:text-amber-300 font-mono hover:underline"
                >
                  Підключити Gemini API Key
                </button>
              )}
            </div>

            <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={autoEnrichUa}
                onChange={(e) => setAutoEnrichUa(e.target.checked)}
                className="mt-0.5 rounded text-amber-500 focus:ring-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
              />
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-200 block">
                  Автоматично генерувати обов'язкові теги name_ua та description_ua
                </span>
                <p className="text-[11px] text-slate-400">
                  Якщо у вихідному товарі присутня тільки російська назва чи опис, модель створює якісний україномовний контент для маркетплейсу Епіцентр.
                </p>
              </div>
            </label>

            {isEnriching && enrichmentProgress && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-sky-300 font-medium flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                    AI-генерація українського контенту...
                  </span>
                  <span className="font-mono text-slate-400 text-[11px]">
                    {enrichmentProgress.current} / {enrichmentProgress.total}
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-sky-400 h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${(enrichmentProgress.current / enrichmentProgress.total) * 100}%`
                    }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 truncate font-mono">
                  {enrichmentProgress.currentItemName}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Step 2 Mapping & Conversion Workbench (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold font-mono">
                  2
                </span>
                <h2 className="text-sm font-semibold text-slate-100">
                  Мапінг категорій на довідники PIM Епіцентру
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                {uniqueSourceCategories.length} категорій фіду
              </span>
            </div>

            {uniqueSourceCategories.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                <Layers className="w-8 h-8 mx-auto text-slate-600 stroke-[1.5]" />
                <p>Завантажте вхідний XML-файл або відкрийте демо-фід для налаштування мапінгу</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                {uniqueSourceCategories.map((srcCat) => {
                  const currentMapping = categoryMappings[srcCat.id];
                  return (
                    <div
                      key={srcCat.id}
                      className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200">{srcCat.name}</span>
                          <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-slate-800 text-slate-400">
                            {srcCat.count} товарів
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">
                          ID у вихідному фіді: {srcCat.id}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <ChevronRight className="w-4 h-4 text-slate-600 shrink-0 hidden md:block" />
                        <select
                          value={currentMapping?.epicentrCategoryCode || ''}
                          onChange={(e) => handleCategoryMappingChange(srcCat.id, e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 focus:outline-none focus:border-amber-500 max-w-[280px] cursor-pointer"
                        >
                          {categories.map((c) => (
                            <option key={c.code} value={c.code} className="bg-slate-900 text-slate-200">
                              [{c.code}] {c.name_ua || c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>
                  Перед завантаженням виконується обов'язкова валідація за <code>XSD-схемою Епіцентру</code>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isGenerated && (
                  <button
                    onClick={() => setIsPreviewModalOpen(true)}
                    className="px-3 py-2 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Перегляд коду
                  </button>
                )}

                <button
                  onClick={handleValidateXsdOnly}
                  disabled={parsedProducts.length === 0 || isEnriching}
                  className="px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4 text-sky-400" />
                  Перевірити за XSD
                </button>

                <button
                  onClick={() => handleGenerateXml(true)}
                  disabled={parsedProducts.length === 0 || isEnriching}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  <FileCode className="w-4 h-4" />
                  {isEnriching ? 'Збагачення AI...' : 'Сформувати валідний XML'}
                </button>

                {isGenerated && (
                  <button
                    onClick={handleDownload}
                    className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shadow-lg ${
                      xsdReport && !xsdReport.isValid
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                    Завантажити .xml (XSD)
                  </button>
                )}
              </div>
            </div>

            {downloadGateToast && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                  downloadGateToast.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {downloadGateToast.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{downloadGateToast.text}</span>
                </div>
                {downloadGateToast.type === 'error' && generatedXml && (
                  <button
                    onClick={() =>
                      EpicentrXmlGeneratorService.downloadXmlFile(
                        generatedXml,
                        `epicentr_feed_unverified_${new Date().toISOString().split('T')[0]}.xml`
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-[11px] font-medium text-rose-100 border border-rose-700 shrink-0"
                  >
                    Завантажити примусово
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Official Epicentr XSD Schema Validation Panel */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-100">
                      XSD-валідатор структури XML (Стандарт Епіцентру)
                    </h2>
                    {xsdReport && (
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          xsdReport.isValid
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {xsdReport.isValid
                          ? `XSD PASSED • ${xsdReport.complianceScore}%`
                          : `XSD FAILED • ${xsdReport.errorCount} помилок`}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Перевірка структури дерева <code>yml_catalog → offers → offer</code>, типів даних <code>xs:decimal</code>, <code>xs:boolean</code> та обов'язкових <code>paramcode</code> перед експортом
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowXsdDefinition((prev) => !prev)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-mono transition-colors"
                >
                  {showXsdDefinition ? 'Сховати XSD-схему' : 'Переглянути XSD (.xsd)'}
                </button>
                <button
                  onClick={handleDownloadXsdSchema}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-amber-300 border border-slate-800 text-[11px] font-mono transition-colors flex items-center gap-1"
                  title="Завантажити офіційний файл схеми .xsd"
                >
                  <Download className="w-3 h-3" /> .xsd
                </button>
              </div>
            </div>

            {showXsdDefinition && (
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 max-h-56 overflow-y-auto font-mono text-[11px] text-sky-300 leading-5">
                <pre>{EpicentrXmlGeneratorService.EPICENTR_OFFICIAL_XSD}</pre>
              </div>
            )}

            {!xsdReport ? (
              <div className="py-6 text-center text-slate-400 text-xs space-y-2 bg-slate-950/50 rounded-xl border border-slate-800/60">
                <ShieldCheck className="w-7 h-7 mx-auto text-slate-600 stroke-[1.5]" />
                <p>
                  Натисніть <b>«Перевірити за XSD»</b> або <b>«Сформувати валідний XML»</b>, щоб виконати структурну перевірку фіду за XSD-стандартом Епіцентру перед завантаженням.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {xsdReport.checkpoints.map((cp) => (
                    <div
                      key={cp.id}
                      className={`p-3 rounded-xl border text-xs ${
                        cp.passed
                          ? 'bg-slate-950/70 border-slate-800/90'
                          : 'bg-rose-950/25 border-rose-800/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-medium text-slate-200">
                          {cp.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )}
                          <span>{cp.title}</span>
                        </div>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                            cp.passed
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/15 text-rose-400'
                          }`}
                        >
                          {cp.passed ? 'OK' : 'ERR'}
                        </span>
                      </div>
                      <p className="text-[10px] font-mono text-amber-300/80 mt-1 pl-5 truncate" title={cp.xsdRule}>
                        {cp.xsdRule}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 pl-5">{cp.details}</p>
                    </div>
                  ))}
                </div>

                {xsdReport.issues.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center justify-between">
                      <span>Журнал зауважень XSD-схеми ({xsdReport.issues.length})</span>
                      <span>
                        Помилок: <b className="text-rose-400">{xsdReport.errorCount}</b> • Попереджень:{' '}
                        <b className="text-amber-400">{xsdReport.warningCount}</b>
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {xsdReport.issues.map((issue, idx) => (
                        <div
                          key={idx}
                          className={`p-2 rounded-lg border text-xs flex items-start gap-2 ${
                            issue.severity === 'error'
                              ? 'bg-rose-950/30 border-rose-800/50 text-rose-200'
                              : 'bg-amber-950/25 border-amber-800/50 text-amber-200'
                          }`}
                        >
                          <AlertTriangle
                            className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                              issue.severity === 'error' ? 'text-rose-400' : 'text-amber-400'
                            }`}
                          />
                          <div>
                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/40 mr-2">
                              {issue.code}
                            </span>
                            {issue.offerId && (
                              <span className="font-mono text-[10px] text-amber-300 mr-2">
                                [Offer: {issue.offerId}]
                              </span>
                            )}
                            <span>{issue.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Feed Preview Table (Step 3) */}
      {parsedProducts.length > 0 && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-slate-100">
                Товари у фіді ({filteredProducts.length} із {parsedProducts.length})
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Пошук за назвою чи брендом..."
                  className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 w-64"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Фото</th>
                  <th className="px-4 py-3">ID / Артикул</th>
                  <th className="px-4 py-3">Назва (UA / RU)</th>
                  <th className="px-4 py-3">Бренд & Штрихкод</th>
                  <th className="px-4 py-3">Ціна (UAH)</th>
                  <th className="px-4 py-3">Категорія Епіцентру</th>
                  <th className="px-4 py-3">Статус XSD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 font-sans">
                {filteredProducts.map((p) => {
                  const mapping = categoryMappings[p.categoryId];
                  const offerErrors =
                    xsdReport?.issues.filter(
                      (iss) => iss.offerId === p.id && iss.severity === 'error'
                    ) || [];
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <img
                          src={p.picture}
                          alt={p.name}
                          className="w-10 h-10 object-cover rounded-lg border border-slate-800 bg-slate-950"
                          onError={(e) => {
                            (e.target as any).src = 'https://via.placeholder.com/60?text=IMG';
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                        {p.id}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-medium text-slate-200 line-clamp-1">
                          {p.name_ua || p.name}
                        </p>
                        {p.name_ru && (
                          <p className="text-[11px] text-slate-500 line-clamp-1">
                            RU: {p.name_ru}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-slate-300">
                            {p.brand || '—'}
                          </span>
                          <span className="block font-mono text-[10px] text-slate-500">
                            {p.barcode || 'Генерується автоматично'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <span className="font-bold text-amber-300">{p.price} ₴</span>
                        {p.price_old && (
                          <span className="block text-[10px] line-through text-slate-500">
                            {p.price_old} ₴
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-sky-500/10 text-sky-300 border border-sky-500/20">
                          {mapping ? mapping.epicentrCategoryName : 'Електроінструменти'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {offerErrors.length > 0 ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-medium"
                            title={offerErrors.map((e) => e.message).join('\n')}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" /> {offerErrors.length} помилок XSD
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <Check className="w-3.5 h-3.5" /> XSD Валідний
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <EpicentrTokenModal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        onTokenUpdated={(tok) => {
          setHasToken(Boolean(tok));
          loadEpicentrCategories(true);
        }}
      />

      <XmlPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        xmlContent={generatedXml}
        offersCount={parsedProducts.length}
        xsdReport={xsdReport}
      />
    </div>
  );
};

