/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  Book,
  CodeXml,
  Sparkles,
  CheckCircle,
  FileText,
  AlertCircle,
  FolderOpen,
  ArrowRight,
  ShieldCheck,
  Check,
  Share2,
  Lock,
  Users,
  Camera,
  Image as ImageIcon,
  FolderArchive,
  X,
  FileCheck,
  KeyRound,
  Loader2,
  Database
} from 'lucide-react';
import { SAMPLE_CATEGORIES } from '../../data/sampleEpicentrCategories';
import { EpicentrColumn, EpicentrDictionaryAttribute } from '../../types/epicentr';
import { epicentrMerchantApi } from '../../services/epicentrMerchantApiService';
import { UserProfile, authService } from '../../services/authService';
import { canAccessFeature, getDemoRestrictionMessage } from '../../services/permissionService';
import {
  analyzeEpicentrColumns,
  buildDictionaryIndex,
  buildDictionaryIndexAsync,
  createSampleEpicentrComment,
  parseDictionaryWorkbook,
  parseDictionaryWorkbookAsync,
  parseEpicentrTemplateWorkbook
} from '../../services/epicentrEngine';
import {
  generateDictionaryCacheKey,
  getCachedDictionary,
  saveCachedDictionary
} from '../../services/dictionaryCacheService';

export interface UploadedPhotoItem {
  id: string;
  name: string;
  url: string;
  size?: number;
}

interface FileUploadSectionProps {
  onLoadTemplate: (
    data: Record<string, any>[],
    columns: EpicentrColumn[],
    rawWorkbook: XLSX.WorkBook | null,
    filename: string
  ) => void;
  onLoadDictionary: (
    rawDict: Record<string, string[]>,
    filename: string,
    prebuiltIndex?: Record<string, EpicentrDictionaryAttribute>
  ) => void;
  onLoadXml?: (xmlString: string, filename: string) => void;
  onLoadPhotos?: (photos: UploadedPhotoItem[]) => void;
  templateFileName: string | null;
  dictionaryFileName: string | null;
  xmlFileName: string | null;
  uploadedPhotos?: UploadedPhotoItem[];
  columns: EpicentrColumn[];
  rowCount: number;
  currentUser?: UserProfile | null;
  onProceedToClarification: () => void;
  onOpenShare?: () => void;
  onOpenXmlConverter?: () => void;
  onOpenEpicentrTokenModal?: () => void;
  onDemoRestricted?: (featureName: string) => void;
}

export const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  onLoadTemplate,
  onLoadDictionary,
  onLoadXml,
  onLoadPhotos,
  templateFileName,
  dictionaryFileName,
  xmlFileName,
  uploadedPhotos = [],
  columns,
  rowCount,
  currentUser,
  onProceedToClarification,
  onOpenShare,
  onOpenXmlConverter,
  onOpenEpicentrTokenModal,
  onDemoRestricted
}) => {
  const [dragActiveTemplate, setDragActiveTemplate] = useState(false);
  const [dragActivePhotos, setDragActivePhotos] = useState(false);
  const [dragActiveDict, setDragActiveDict] = useState(false);
  const [dragActiveXml, setDragActiveXml] = useState(false);
  const [selectedSampleId, setSelectedSampleId] = useState<string>('headphones');
  const [demoNotice, setDemoNotice] = useState<string | null>(null);
  const [dictProgress, setDictProgress] = useState<{
    percent: number;
    message: string;
    fromCache?: boolean;
  } | null>(null);

  const canUploadOwnFiles = canAccessFeature('UPLOAD_CUSTOM_FILES', currentUser || authService.getCurrentUser());

  const templateInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);
  const dictInputRef = useRef<HTMLInputElement>(null);
  const xmlInputRef = useRef<HTMLInputElement>(null);

  // Helper to parse dictionary sheets (supports export-attribute-set, 2-column, and horizontal tables)
  const extractDictionaryFromSheets = (wb: XLSX.WorkBook, sheetNames: string[]): Record<string, string[]> => {
    return parseDictionaryWorkbook(wb, sheetNames);
  };

  /**
   * Asynchronous chunked parser for massive attribute sets (50k-90k+ rows)
   * Uses robust PIM column parser and yields every 2,500 rows
   */
  const extractDictionaryFromSheetsAsync = async (
    wb: XLSX.WorkBook,
    sheetNames: string[],
    onProgress?: (progress: { current: number; total: number; percent: number }) => void
  ): Promise<{ dict: Record<string, string[]>; rowCount: number }> => {
    return parseDictionaryWorkbookAsync(wb, sheetNames, onProgress);
  };

  // Handle template file upload preserving exact cell comments, exact header \n, and original sheet names
  const handleTemplateFile = (file: File) => {
    if (!canUploadOwnFiles) {
      if (onDemoRestricted) {
        onDemoRestricted('Завантаження власного прайс-листа Excel');
      } else {
        setDemoNotice(getDemoRestrictionMessage('Завантаження власних прайсів'));
      }
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        // MUST include cellComments: true to preserve exact hidden JSON metadata from Epicentr
        const wb = XLSX.read(buffer, { type: 'array', cellComments: true } as any);
        const { jsonData, columns: analyzedCols } = parseEpicentrTemplateWorkbook(wb);

        if (jsonData.length > 0 || analyzedCols.length > 0) {
          onLoadTemplate(jsonData, analyzedCols, wb, file.name);

          // If the uploaded template workbook also contains a secondary dictionary sheet, load it automatically
          if (wb.SheetNames.length > 1) {
            const embeddedDict = extractDictionaryFromSheets(wb, wb.SheetNames.slice(1));
            if (Object.keys(embeddedDict).length > 0) {
              onLoadDictionary(embeddedDict, `${file.name} (${wb.SheetNames[1]})`);
            }
          }
        }
      } catch (err) {
        console.error('Error reading template Excel:', err);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Handle photos drag & drop (multiple images or ZIP archive)
  const handlePhotosFiles = (files: FileList | File[]) => {
    if (!canUploadOwnFiles) {
      if (onDemoRestricted) {
        onDemoRestricted('Завантаження фотографій або ZIP-архівів');
      } else {
        setDemoNotice(getDemoRestrictionMessage('Завантаження фотографій'));
      }
      return;
    }
    const newPhotos: UploadedPhotoItem[] = [];
    const fileArray = Array.from(files);

    fileArray.forEach((file, index) => {
      if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(file.name)) {
        const url = URL.createObjectURL(file);
        newPhotos.push({
          id: `photo-${Date.now()}-${index}`,
          name: file.name,
          url,
          size: file.size
        });
      } else if (/\.zip$/i.test(file.name)) {
        // Zip archive with photos
        newPhotos.push({
          id: `zip-${Date.now()}`,
          name: file.name,
          url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80',
          size: file.size
        });
      }
    });

    if (newPhotos.length > 0 && onLoadPhotos) {
      onLoadPhotos(newPhotos);
    }
  };

  // Handle dictionary file upload with IndexedDB caching and chunked async execution
  const handleDictFile = async (file: File) => {
    if (!canUploadOwnFiles) {
      if (onDemoRestricted) {
        onDemoRestricted('Завантаження файлу довідника характеристик');
      } else {
        setDemoNotice(getDemoRestrictionMessage('Завантаження довідника характеристик'));
      }
      return;
    }
    try {
      const cacheKey = generateDictionaryCacheKey(file);

      // Step 1: Check IndexedDB Cache first
      setDictProgress({ percent: 10, message: 'Перевірка локального кешу IndexedDB...' });
      const cached = await getCachedDictionary(cacheKey);
      if (cached && cached.dictionaryIndex) {
        setDictProgress({
          percent: 100,
          message: `Завантажено з кешу (${cached.meta.attrCount} характеристик, ${cached.meta.rowCount.toLocaleString()} значень)`,
          fromCache: true
        });
        const rawMap: Record<string, string[]> = {};
        for (const [k, attr] of Object.entries(cached.dictionaryIndex)) {
          rawMap[attr.cleanAttributeName || k] = attr.allowedValues;
        }
        onLoadDictionary(rawMap, file.name, cached.dictionaryIndex);
        setTimeout(() => setDictProgress(null), 3000);
        return;
      }

      setDictProgress({ percent: 15, message: 'Зчитування файлу Excel...' });
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result;
          setDictProgress({ percent: 25, message: 'Розпакування структури книги Excel...' });
          await new Promise(r => setTimeout(r, 0));

          // Memory & read optimization in XLSX.read: dense: true, ignore cell styles/HTML/formulas
          const wb = XLSX.read(buffer, {
            type: 'array',
            dense: true,
            cellStyles: false,
            cellHTML: false,
            cellFormula: false
          });

          setDictProgress({ percent: 35, message: 'Обробка таблиць характеристик...' });
          const { dict, rowCount } = await extractDictionaryFromSheetsAsync(wb, wb.SheetNames, p => {
            setDictProgress({
              percent: Math.min(50, 30 + Math.round(p.percent * 0.2)),
              message: `Зчитування рядків: ${p.current.toLocaleString()}...`
            });
          });

          if (Object.keys(dict).length === 0) {
            setDictProgress(null);
            return;
          }

          setDictProgress({ percent: 55, message: `Індексація ${rowCount.toLocaleString()} значень...` });
          const dictIndex = await buildDictionaryIndexAsync(dict, p => {
            const currentPct = 50 + Math.round(p.percent * 0.45);
            setDictProgress({
              percent: currentPct,
              message: `Обробка довідника: ${currentPct}% (${p.current.toLocaleString()} з ${p.total.toLocaleString()} значень)`
            });
          });

          setDictProgress({ percent: 98, message: 'Збереження в локальний кеш IndexedDB...' });
          await saveCachedDictionary(cacheKey, dictIndex, {
            fileName: file.name,
            rowCount,
            attrCount: Object.keys(dictIndex).length
          });

          setDictProgress({
            percent: 100,
            message: `Готово: ${Object.keys(dictIndex).length} характеристик, ${rowCount.toLocaleString()} значень`
          });

          onLoadDictionary(dict, file.name, dictIndex);
          setTimeout(() => setDictProgress(null), 3500);
        } catch (err: any) {
          console.error('Error processing dictionary Excel:', err);
          setDictProgress({ percent: 0, message: `Помилка: ${err?.message || 'Не вдалося обробити файл'}` });
          setTimeout(() => setDictProgress(null), 4000);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      console.error('Error reading dictionary file:', err);
      setDictProgress(null);
    }
  };

  // Load sample category with 1 click
  const handleSelectSampleCategory = (catId: string) => {
    setSelectedSampleId(catId);
    const cat = SAMPLE_CATEGORIES.find(c => c.id === catId);
    if (!cat) return;

    const headers = Object.keys(cat.defaultData[0]);
    const analyzedCols = analyzeEpicentrColumns(headers);

    // Create a mock original workbook with comments and standard Epicentr sheet name
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(cat.defaultData);

    // Attach authentic Epicentr metadata comments to row 1 (Worksheet)
    analyzedCols.forEach((col, idx) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: idx });
      if (ws[cellRef]) {
        const commentMeta = createSampleEpicentrComment(col, idx);
        col.rawComment = commentMeta;
        ws[cellRef].c = [
          {
            a: 'Epicentr',
            t: commentMeta,
            hidden: true,
            visible: false
          } as any
        ];
        (ws[cellRef].c as any).hidden = true;
      }
    });
    XLSX.utils.book_append_sheet(wb, ws, 'Worksheet');

    onLoadTemplate(cat.defaultData, analyzedCols, wb, `Шаблон_${cat.id}_Епіцентр.xlsx`);
    onLoadDictionary(cat.dictionaryData, `Довідник_${cat.id}_Офіційний.xlsx`);

    // Load sample product photos
    if (onLoadPhotos) {
      const samplePhotos: UploadedPhotoItem[] = [
        {
          id: 'sample-p1',
          name: 'photo_1_front.jpg',
          url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80',
          size: 245000
        },
        {
          id: 'sample-p2',
          name: 'photo_2_cat_ear_pink.jpg',
          url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80',
          size: 198000
        },
        {
          id: 'sample-p3',
          name: 'photo_3_studio_gold.jpg',
          url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
          size: 310000
        },
        {
          id: 'sample-p4',
          name: 'photo_4_wireless_black.jpg',
          url: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&auto=format&fit=crop&q=80',
          size: 220000
        }
      ];
      onLoadPhotos(samplePhotos);
    }
  };

  const mandatoryCount = columns.filter(c => c.isRequired).length;
  const isReadyToProceed = rowCount > 0 && columns.length > 0;

  return (
    <div className="space-y-6">
      {/* Epicentr Marketplace Hero Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-xs relative overflow-hidden">
        {/* Subtle accent top border in Epicentr signature blue & orange */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#004BB7] via-[#004BB7] to-[#FF7A00]" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-[#004BB7] text-xs font-semibold mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-[#FF7A00]" />
              Офіційний алгоритм заповнення за регламентом маркетплейсу Епіцентр
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Автоматизоване заповнення обов'язкових характеристик Excel
            </h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Завантажте шаблон категорії Excel та фотографії товарів. Алгоритм збереже оригінальні службові коментарі (JSON), визначить колір і візерунок за 1-м фото, заповнить виключно поля з зірочкою (<span className="text-[#FF7A00] font-bold">*</span>) за офіційним довідником і сформує регламентні назви без капслоку.
            </p>
          </div>

          {onOpenShare && (
            <div className="shrink-0 flex flex-col gap-2 sm:items-end">
              <button
                type="button"
                onClick={onOpenShare}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF7A00] to-[#ea580c] hover:from-[#ff8a1a] hover:to-[#d94e07] text-white font-bold text-xs shadow-sm transition-all transform hover:scale-[1.01]"
              >
                <Share2 className="w-4 h-4 text-white" />
                <span>Надати доступ селерам</span>
              </button>
              <span className="text-[11px] text-slate-500 font-medium">
                Кабінет маркетплейсу Епіцентр
              </span>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 1: Convenient Drag-and-Drop Area for Excel Template and Photos */}
      <div>
        {/* Demo Restriction Alert Banner */}
        {demoNotice && (
          <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 flex items-start justify-between gap-3 animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-[#FF7A00] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-sm text-[#d96500]">Обмеження демо-доступу:</span>
                <p className="mt-0.5 leading-relaxed">{demoNotice}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDemoNotice(null)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-amber-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF7A00]" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Зона завантаження файлів (Drag-and-drop)
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Підтримуються формати XLSX, XLS, JPG, PNG, WEBP, ZIP
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* 1. Drag & Drop: Excel Category Template */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (canUploadOwnFiles) setDragActiveTemplate(true);
            }}
            onDragLeave={() => setDragActiveTemplate(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActiveTemplate(false);
              if (!canUploadOwnFiles) {
                if (onDemoRestricted) onDemoRestricted('Завантаження власного прайс-листа Excel');
                else setDemoNotice(getDemoRestrictionMessage('Завантаження власних прайсів'));
                return;
              }
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleTemplateFile(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => {
              if (!canUploadOwnFiles) {
                if (onDemoRestricted) onDemoRestricted('Завантаження власного прайс-листа Excel');
                else setDemoNotice(getDemoRestrictionMessage('Завантаження власних прайсів'));
                return;
              }
              templateInputRef.current?.click();
            }}
            className={`p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center min-h-[210px] relative group ${
              !canUploadOwnFiles
                ? 'bg-slate-50/80 border-slate-300 opacity-90 hover:border-amber-400 hover:bg-amber-50/30'
                : dragActiveTemplate
                ? 'bg-blue-50 border-[#004BB7] ring-4 ring-blue-100 scale-[1.01]'
                : templateFileName
                ? 'bg-blue-50/40 border-blue-300 hover:border-[#004BB7]'
                : 'bg-white border-slate-300 hover:border-[#004BB7] hover:bg-slate-50/70 shadow-xs'
            }`}
          >
            {canUploadOwnFiles && (
              <input
                ref={templateInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleTemplateFile(e.target.files[0])}
              />
            )}

            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors ${
              !canUploadOwnFiles
                ? 'bg-amber-100/60 text-[#FF7A00]'
                : templateFileName
                ? 'bg-blue-100 text-[#004BB7]'
                : 'bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-[#004BB7]'
            }`}>
              {!canUploadOwnFiles ? <Lock className="w-6 h-6 text-[#FF7A00]" /> : <FileSpreadsheet className="w-6 h-6" />}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 text-sm">1. Excel-шаблон категорії</span>
              <span className="text-[#FF7A00] font-black">*</span>
            </div>

            <div className="mt-1.5 text-xs text-slate-600 max-w-[210px]">
              {!canUploadOwnFiles ? (
                <span className="text-amber-800 font-medium">
                  Власні файли заблоковано в Демо. Скористайтесь 3 тестовими категоріями нижче ↓
                </span>
              ) : templateFileName ? (
                <div className="space-y-1">
                  <div className="font-semibold text-[#004BB7] flex items-center justify-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="truncate max-w-[170px]">{templateFileName}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {rowCount} товарів • {columns.length} колонок
                  </div>
                </div>
              ) : (
                <span className="text-slate-500">
                  Перетягніть файл <span className="font-semibold text-slate-700">.xlsx</span> або оберіть на диску
                </span>
              )}
            </div>

            <span className={`mt-3 text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${
              !canUploadOwnFiles
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              {!canUploadOwnFiles ? '🔒 Демо-Sandbox' : "Обов'язковий шаблон"}
            </span>
          </div>

          {/* 2. Drag & Drop: Product Photos (Drag & Drop images or ZIP) */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (canUploadOwnFiles) setDragActivePhotos(true);
            }}
            onDragLeave={() => setDragActivePhotos(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActivePhotos(false);
              if (!canUploadOwnFiles) {
                if (onDemoRestricted) onDemoRestricted('Завантаження фотографій або ZIP-архівів');
                else setDemoNotice(getDemoRestrictionMessage('Завантаження фотографій'));
                return;
              }
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handlePhotosFiles(e.dataTransfer.files);
              }
            }}
            onClick={() => {
              if (!canUploadOwnFiles) {
                if (onDemoRestricted) onDemoRestricted('Завантаження фотографій або ZIP-архівів');
                else setDemoNotice(getDemoRestrictionMessage('Завантаження фотографій'));
                return;
              }
              photosInputRef.current?.click();
            }}
            className={`p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center min-h-[210px] relative group ${
              !canUploadOwnFiles
                ? 'bg-slate-50/80 border-slate-300 opacity-90 hover:border-amber-400 hover:bg-amber-50/30'
                : dragActivePhotos
                ? 'bg-amber-50 border-[#FF7A00] ring-4 ring-amber-100 scale-[1.01]'
                : uploadedPhotos.length > 0
                ? 'bg-amber-50/40 border-amber-300 hover:border-[#FF7A00]'
                : 'bg-white border-slate-300 hover:border-[#FF7A00] hover:bg-slate-50/70 shadow-xs'
            }`}
          >
            {canUploadOwnFiles && (
              <input
                ref={photosInputRef}
                type="file"
                accept="image/*,.zip"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handlePhotosFiles(e.target.files)}
              />
            )}

            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors ${
              !canUploadOwnFiles
                ? 'bg-amber-100/60 text-[#FF7A00]'
                : uploadedPhotos.length > 0
                ? 'bg-amber-100 text-[#FF7A00]'
                : 'bg-slate-100 text-slate-600 group-hover:bg-amber-100 group-hover:text-[#FF7A00]'
            }`}>
              {!canUploadOwnFiles ? <Lock className="w-6 h-6 text-[#FF7A00]" /> : <Camera className="w-6 h-6" />}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 text-sm">2. Фото товарів (Drag-and-Drop)</span>
            </div>

            <div className="mt-1.5 text-xs text-slate-600 max-w-[210px]">
              {!canUploadOwnFiles ? (
                <span className="text-amber-800 font-medium">
                  Завантаження фото заблоковано в Демо.
                </span>
              ) : uploadedPhotos.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="font-semibold text-amber-900 flex items-center justify-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Завантажено: {uploadedPhotos.length} фото</span>
                  </div>
                  {/* Photo thumbnails preview */}
                  <div className="flex items-center justify-center gap-1 pt-0.5">
                    {uploadedPhotos.slice(0, 4).map((p, pIdx) => (
                      <img
                        key={p.id || pIdx}
                        src={p.url}
                        alt={p.name}
                        className="w-6 h-6 rounded object-cover border border-amber-300"
                        title={p.name}
                      />
                    ))}
                    {uploadedPhotos.length > 4 && (
                      <span className="text-[10px] text-amber-800 font-bold">
                        +{uploadedPhotos.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-slate-500">
                  Перетягніть <span className="font-semibold text-slate-700">фото</span> або <span className="font-semibold text-slate-700">ZIP-архів</span>
                </span>
              )}
            </div>

            <span className={`mt-3 text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${
              !canUploadOwnFiles
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}>
              {!canUploadOwnFiles ? '🔒 Демо-Sandbox' : 'Колір та візерунок за 1-м фото'}
            </span>
          </div>

          {/* 3. Drag & Drop: Values Dictionary */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (canUploadOwnFiles) setDragActiveDict(true);
            }}
            onDragLeave={() => setDragActiveDict(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActiveDict(false);
              if (!canUploadOwnFiles) {
                if (onDemoRestricted) onDemoRestricted('Завантаження файлу довідника характеристик');
                else setDemoNotice(getDemoRestrictionMessage('Завантаження довідника'));
                return;
              }
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleDictFile(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => {
              if (!canUploadOwnFiles) {
                if (onDemoRestricted) onDemoRestricted('Завантаження файлу довідника характеристик');
                else setDemoNotice(getDemoRestrictionMessage('Завантаження довідника'));
                return;
              }
              dictInputRef.current?.click();
            }}
            className={`p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center min-h-[210px] relative group ${
              !canUploadOwnFiles
                ? 'bg-slate-50/80 border-slate-300 opacity-90 hover:border-amber-400 hover:bg-amber-50/30'
                : dragActiveDict
                ? 'bg-emerald-50 border-emerald-500 ring-4 ring-emerald-100 scale-[1.01]'
                : dictionaryFileName
                ? 'bg-emerald-50/40 border-emerald-300 hover:border-emerald-500'
                : 'bg-white border-slate-300 hover:border-emerald-500 hover:bg-slate-50/70 shadow-xs'
            }`}
          >
            {canUploadOwnFiles && (
              <input
                ref={dictInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleDictFile(e.target.files[0])}
              />
            )}

            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors ${
              !canUploadOwnFiles
                ? 'bg-amber-100/60 text-[#FF7A00]'
                : dictionaryFileName
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700'
            }`}>
              {!canUploadOwnFiles ? <Lock className="w-6 h-6 text-[#FF7A00]" /> : <Book className="w-6 h-6" />}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 text-sm">3. Довідник значень</span>
              <span className="text-[#FF7A00] font-black">*</span>
            </div>

            {!canUploadOwnFiles ? (
              <div className="mt-1.5 text-xs text-amber-800 font-medium max-w-[210px]">
                Довідники вбудовано в демо-вибірку.
              </div>
            ) : dictProgress ? (
              <div className="w-full px-2 space-y-2 mt-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-800">
                  <span className="flex items-center gap-1.5 truncate">
                    {dictProgress.fromCache ? (
                      <Database className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin shrink-0" />
                    )}
                    <span className="truncate">{dictProgress.message}</span>
                  </span>
                  <span className="font-bold shrink-0">{dictProgress.percent}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden shadow-inner">
                  <div
                    className="bg-emerald-600 h-2 rounded-full transition-all duration-200"
                    style={{ width: `${dictProgress.percent}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-1.5 text-xs text-slate-600 max-w-[210px]">
                {dictionaryFileName ? (
                  <div className="font-semibold text-emerald-700 flex items-center justify-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="truncate max-w-[170px]">{dictionaryFileName}</span>
                  </div>
                ) : (
                  <span className="text-slate-500">
                    Допустимі значення списків та характеристик
                  </span>
                )}
              </div>
            )}

            <span className={`mt-3 text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${
              !canUploadOwnFiles
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              {!canUploadOwnFiles ? '🔒 Демо-Sandbox' : "Обов'язковий файл"}
            </span>
          </div>

          {/* 4. Drag & Drop: XML Feed (Optional) */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (canUploadOwnFiles) setDragActiveXml(true);
            }}
            onDragLeave={() => setDragActiveXml(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActiveXml(false);
              if (!canUploadOwnFiles) {
                if (onDemoRestricted) onDemoRestricted('Завантаження XML/YML фідів');
                else setDemoNotice(getDemoRestrictionMessage('Завантаження XML фідів'));
                return;
              }
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                const file = e.dataTransfer.files[0];
                const reader = new FileReader();
                reader.onload = (ev) => {
                  if (onLoadXml && ev.target?.result) {
                    onLoadXml(String(ev.target.result), file.name);
                  }
                };
                reader.readAsText(file);
              }
            }}
            onClick={() => {
              if (!canUploadOwnFiles) {
                if (onDemoRestricted) onDemoRestricted('Завантаження XML/YML фідів');
                else setDemoNotice(getDemoRestrictionMessage('Завантаження XML фідів'));
                return;
              }
              xmlInputRef.current?.click();
            }}
            className={`p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center min-h-[210px] relative group ${
              !canUploadOwnFiles
                ? 'bg-slate-50/80 border-slate-300 opacity-90 hover:border-amber-400 hover:bg-amber-50/30'
                : dragActiveXml
                ? 'bg-purple-50 border-purple-500 ring-4 ring-purple-100 scale-[1.01]'
                : xmlFileName
                ? 'bg-purple-50/40 border-purple-300 hover:border-purple-500'
                : 'bg-white border-slate-300 hover:border-purple-500 hover:bg-slate-50/70 shadow-xs'
            }`}
          >
            {canUploadOwnFiles && (
              <input
                ref={xmlInputRef}
                type="file"
                accept=".xml"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    const file = e.target.files[0];
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      if (onLoadXml && ev.target?.result) {
                        onLoadXml(String(ev.target.result), file.name);
                      }
                    };
                    reader.readAsText(file);
                  }
                }}
              />
            )}

            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors ${
              !canUploadOwnFiles
                ? 'bg-amber-100/60 text-[#FF7A00]'
                : xmlFileName
                ? 'bg-purple-100 text-purple-700'
                : 'bg-slate-100 text-slate-600 group-hover:bg-purple-100 group-hover:text-purple-700'
            }`}>
              {!canUploadOwnFiles ? <Lock className="w-6 h-6 text-[#FF7A00]" /> : <CodeXml className="w-6 h-6" />}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 text-sm">4. XML-фід для збагачення</span>
            </div>

            <div className="mt-1.5 text-xs text-slate-600 max-w-[210px]">
              {!canUploadOwnFiles ? (
                <span className="text-amber-800 font-medium">
                  Збагачення з XML заблоковано в Демо.
                </span>
              ) : xmlFileName ? (
                <div className="font-semibold text-purple-700 flex items-center justify-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="truncate max-w-[170px]">{xmlFileName}</span>
                </div>
              ) : (
                <span className="text-slate-500">
                  Опціонально: автопідтягування описів та параметрів
                </span>
              )}
            </div>

            {/* Quick Merchant API Status Badge */}
            <div className="mt-2.5 flex flex-col items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={onOpenEpicentrTokenModal}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-colors cursor-pointer"
                title="Налаштувати Bearer Token для Merchant API Епіцентр"
              >
                <KeyRound className="w-3 h-3 text-[#FF7A00]" />
                <span>{epicentrMerchantApi.hasToken() ? 'Merchant API: OK' : 'Merchant API: Демо'}</span>
              </button>

              {onOpenXmlConverter && (
                <button
                  type="button"
                  onClick={onOpenXmlConverter}
                  className="text-[11px] font-bold text-[#004BB7] hover:underline cursor-pointer"
                >
                  Відкрити XML конвертер →
                </button>
              )}
            </div>

            <span className={`mt-3 text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${
              !canUploadOwnFiles
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-purple-50 text-purple-800 border border-purple-200'
            }`}>
              {!canUploadOwnFiles ? '🔒 Демо-Sandbox' : 'Додаткове джерело'}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 2: 1-Click Official Sample Categories */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-[#004BB7]" />
              Швидкий запуск на офіційних категоріях Епіцентру
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Тестуйте в один клік із заздалегідь підготовленими Excel-шаблонами, довідниками та реальними фото товарів
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SAMPLE_CATEGORIES.map(cat => {
            const isSelected = selectedSampleId === cat.id && templateFileName?.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelectSampleCategory(cat.id)}
                className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/70 border-[#004BB7] shadow-sm ring-1 ring-[#004BB7]'
                    : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-100 text-[#004BB7]">
                    {cat.badge}
                  </span>
                  {isSelected && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                      <Check className="w-3.5 h-3.5" /> Завантажено
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-slate-900 text-sm group-hover:text-[#004BB7] transition-colors">
                  {cat.title}
                </h4>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  {cat.description}
                </p>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-600 font-mono">
                  <span className="font-semibold text-slate-700">{cat.productsCount} тестових товарів</span>
                  <span>•</span>
                  <span>Шаблон + Довідник + Фото</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: Readiness Banner & Proceed CTA */}
      {isReadyToProceed && (
        <div className="bg-white border-2 border-emerald-500/40 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base">
                Шаблон готовий до аналізу та заповнення
              </h4>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-600">
                <span className="px-2.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-semibold text-slate-700">
                  {rowCount} товарів
                </span>
                <span className="px-2.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-semibold text-slate-700">
                  {columns.length} колонок
                </span>
                <span className="px-2.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[#d96500] font-bold">
                  {mandatoryCount} обов'язкових полів (*)
                </span>
                <span className="px-2.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                  ID та JSON-коментарі захищено
                </span>
                {uploadedPhotos.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-[#004BB7] font-semibold">
                    {uploadedPhotos.length} фото підключено
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onProceedToClarification}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#FF7A00] to-[#ea580c] hover:from-[#ff8a1a] hover:to-[#d94e07] text-white font-bold text-sm shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.01] shrink-0 cursor-pointer"
          >
            <span>Перейти до Кроку 0 (Уточнення та Запуск)</span>
            <ArrowRight className="w-4 h-4 text-white" />
          </button>
        </div>
      )}
    </div>
  );
};
