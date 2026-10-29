/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Image as ImageIcon,
  Sparkles,
  Upload,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Wand2,
  Layers,
  PlusCircle
} from 'lucide-react';
import {
  auth,
  FirestoreGeneratedImage,
  saveGeneratedImageToFirestore,
  deleteGeneratedImageFromFirestore,
  subscribeUserImages
} from '../../firebase';
import { generateImageDirect } from '../../services/geminiClientDirect';
import { UploadedPhotoItem } from './FileUploadSection';

interface ImageStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  uploadedPhotos: UploadedPhotoItem[];
  onAddPhotoToCatalog: (photo: UploadedPhotoItem) => void;
}

const PRESET_PROMPTS = [
  'Предметне студійне фото товару на чистому білому фоні (#FFFFFF), м’яке студійне освітлення, висока деталізація, без водяних знаків і написів (стандарт Епіцентр Маркетплейс)',
  'Замінити фон цього товару на ідеально чистий білий студійний фон із легкою природною тінню знизу, зберегти всі деталі та колір товару',
  'Покращити освітлення, контрастність та чіткість текстури товару, прибрати зайві предмети з фону, залишити тільки товар по центру кадру'
];

export const ImageStudioModal: React.FC<ImageStudioModalProps> = ({
  isOpen,
  onClose,
  uploadedPhotos,
  onAddPhotoToCatalog
}) => {
  const [prompt, setPrompt] = useState(PRESET_PROMPTS[0]);
  const [productTitle, setProductTitle] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '3:4' | '4:3' | '9:16' | '16:9'>('1:1');
  const [imageSize, setImageSize] = useState<'512px' | '1K' | '2K'>('1K');

  // Optional source image for editing
  const [sourceImageBase64, setSourceImageBase64] = useState<string | null>(null);
  const [sourceImageMimeType, setSourceImageMimeType] = useState<string>('image/png');
  const [sourceImageName, setSourceImageName] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [latestGenerated, setLatestGenerated] = useState<FirestoreGeneratedImage | null>(null);
  const [savedImages, setSavedImages] = useState<FirestoreGeneratedImage[]>([]);
  const [addedNotice, setAddedNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub = subscribeUserImages(uid, (items) => {
      setSavedImages(items);
    });
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSourceImageBase64(reader.result);
        setSourceImageMimeType(file.type || 'image/png');
        setSourceImageName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const data = await generateImageDirect({
        prompt: prompt.trim(),
        aspectRatio,
        imageSize,
        sourceImageBase64,
        sourceImageMimeType
      });

      if (data.error || !data.imageUrl) {
        setErrorMsg(data.error || 'Не вдалося згенерувати зображення');
        return;
      }

      const newImg: FirestoreGeneratedImage = {
        id: `img_${Date.now()}`,
        uid: auth.currentUser?.uid || 'local',
        prompt: prompt.trim(),
        aspectRatio,
        imageSize,
        imageUrl: data.imageUrl,
        productTitle: productTitle.trim() || (sourceImageName ? `Редаговано: ${sourceImageName}` : 'Студійне фото товару'),
        createdAt: new Date().toISOString()
      };

      setLatestGenerated(newImg);

      if (auth.currentUser) {
        await saveGeneratedImageToFirestore({
          id: newImg.id,
          prompt: newImg.prompt,
          aspectRatio: newImg.aspectRatio,
          imageSize: newImg.imageSize,
          imageUrl: newImg.imageUrl,
          productTitle: newImg.productTitle
        });
      } else {
        setSavedImages((prev) => [newImg, ...prev]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Помилка генерації зображення');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseInCatalog = (img: FirestoreGeneratedImage) => {
    const newPhoto: UploadedPhotoItem = {
      id: img.id,
      name: `${(img.productTitle || 'ai_photo').replace(/\s+/g, '_')}.png`,
      url: img.imageUrl,
      size: Math.round(img.imageUrl.length * 0.75)
    };
    onAddPhotoToCatalog(newPhoto);
    setAddedNotice(`Фото "${img.productTitle}" додано до пулу зображень каталогу!`);
    setTimeout(() => setAddedNotice(null), 3500);
  };

  const handleDeleteImage = async (imgId: string) => {
    if (auth.currentUser) {
      await deleteGeneratedImageFromFirestore(imgId);
    } else {
      setSavedImages((prev) => prev.filter((item) => item.id !== imgId));
    }
    if (latestGenerated?.id === imgId) {
      setLatestGenerated(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-5xl max-h-[90vh] bg-white dark:bg-[#0F1422] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6B00] to-amber-600 flex items-center justify-center text-white shadow-sm">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  ШІ-Фотостудія товарів (Створення та Редагування)
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-orange-500/15 text-[#FF7A00] border border-orange-500/30">
                  gemini-nano-banana-2.1
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Генерація предметних фото на білому фоні та редагування завантажених зображень під регламент Епіцентру
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Controls */}
          <form onSubmit={handleGenerate} className="lg:col-span-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Назва товару / підпис фото:
              </label>
              <input
                type="text"
                value={productTitle}
                onChange={(e) => setProductTitle(e.target.value)}
                placeholder="Напр.: Навушники бездротові Sony WH-1000XM5 Чорний"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF6B00]"
              />
            </div>

            {/* Source Image for Editing */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#004BB7]" />
                  <span>Вихідне зображення для редагування (необов’язково)</span>
                </span>
                {sourceImageBase64 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSourceImageBase64(null);
                      setSourceImageName(null);
                    }}
                    className="text-[11px] font-semibold text-rose-500 hover:underline cursor-pointer"
                  >
                    Очистити (режим генерації з нуля)
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-[#FF7A00]" />
                  <span>Завантажити своє фото</span>
                </button>

                {sourceImageBase64 && (
                  <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                    <img
                      src={sourceImageBase64}
                      alt="Source"
                      className="w-8 h-8 rounded object-cover border border-slate-300"
                    />
                    <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 truncate max-w-[160px]">
                      {sourceImageName || 'Вихідне фото активне'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Prompt & Quick Presets */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Текстовий запит (Prompt для створення або редагування):
                </label>
              </div>
              <textarea
                rows={4}
                required
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Опишіть товар або зміни, які потрібно внести у зображення..."
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF6B00]"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRESET_PROMPTS.map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPrompt(preset)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    Шаблон #{i + 1}: {preset.slice(0, 38)}...
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio & Resolution */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Пропорції (Aspect Ratio):
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                >
                  <option value="1:1">1:1 (Квадрат — Стандарт Епіцентр)</option>
                  <option value="3:4">3:4 (Портрет — Одяг / Взуття)</option>
                  <option value="4:3">4:3 (Альбомна — Меблі / Техніка)</option>
                  <option value="16:9">16:9 (Широкоформатний банер)</option>
                  <option value="9:16">9:16 (Вертикальний мобільний)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Роздільна здатність:
                </label>
                <select
                  value={imageSize}
                  onChange={(e) => setImageSize(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                >
                  <option value="1K">1K (1024x1024 — Рекомендовано)</option>
                  <option value="2K">2K (Висока деталізація)</option>
                  <option value="512px">512px (Швидке прев’ю)</option>
                </select>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {addedNotice && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-600 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{addedNotice}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FF6B00] to-[#FF8800] hover:from-[#e66000] hover:to-[#FF6B00] text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Wand2 className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>
                {isGenerating
                  ? 'Генерація студійного фото (gemini-nano-banana-2.1)...'
                  : sourceImageBase64
                  ? 'Відредагувати зображення за допомогою ШІ'
                  : 'Згенерувати нове фото товару'}
              </span>
            </button>
          </form>

          {/* Right Column: Preview & Saved Gallery */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            {/* Active Result Preview */}
            <div className="flex-1 min-h-[260px] rounded-2xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-4 flex flex-col items-center justify-center relative">
              {latestGenerated ? (
                <div className="w-full flex flex-col items-center gap-3">
                  <img
                    src={latestGenerated.imageUrl}
                    alt={latestGenerated.productTitle}
                    className="max-h-64 rounded-xl object-contain bg-white border border-slate-200 shadow-md"
                  />
                  <div className="w-full flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="text-xs">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {latestGenerated.productTitle}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Формат: {latestGenerated.aspectRatio} • {latestGenerated.imageSize}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUseInCatalog(latestGenerated)}
                        className="px-3 py-1.5 rounded-xl bg-[#004BB7] hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Додати в каталог</span>
                      </button>
                      <a
                        href={latestGenerated.imageUrl}
                        download={`${latestGenerated.productTitle.replace(/\s+/g, '_')}.png`}
                        className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Скачати</span>
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-2 py-8">
                  <Sparkles className="w-8 h-8 text-[#FF7A00] mx-auto opacity-80" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Прев’ю згенерованого або відредагованого фото
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-xs">
                    Опишіть товар або завантажте вихідне фото зліва та натисніть кнопку генерації
                  </p>
                </div>
              )}
            </div>

            {/* Firestore Saved Gallery */}
            {savedImages.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Збережена галерея селера ({savedImages.length})</span>
                  <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                    {auth.currentUser ? 'Синхронізовано з Firestore' : 'Локальна сесія'}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-40 overflow-y-auto pr-1">
                  {savedImages.map((img) => (
                    <div
                      key={img.id}
                      className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 aspect-square cursor-pointer"
                      onClick={() => setLatestGenerated(img)}
                    >
                      <img
                        src={img.imageUrl}
                        alt={img.productTitle}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteImage(img.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 p-1 rounded-lg bg-rose-600/90 text-white transition-opacity cursor-pointer"
                        title="Видалити"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
