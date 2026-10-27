/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  FileSpreadsheet,
  Camera,
  BookOpen,
  Tag,
  CheckCircle2,
  Loader2
} from 'lucide-react';

interface ProcessingProgressViewProps {
  onComplete: () => void;
  productsCount: number;
}

export const ProcessingProgressView: React.FC<ProcessingProgressViewProps> = ({
  onComplete,
  productsCount
}) => {
  const [currentStage, setCurrentStage] = useState(0);

  const stages = [
    {
      title: 'Крок 1 — Аналіз структури шаблону',
      description: 'Зчитування колонок та типів (select, multiselect, float...), виявлення обов\'язкових полів (*), захист ID та коментарів',
      icon: FileSpreadsheet,
      color: 'text-[#004BB7]'
    },
    {
      title: 'Крок 2 — Аналіз фотографій та описів',
      description: 'Визначення кольору та візерунка («з візерунком» / «без візерунка») за фото або описом товару (фото є опціональним)',
      icon: Camera,
      color: 'text-[#FF7A00]'
    },
    {
      title: 'Крок 3 — Звірка з довідником та HTML-ентіті',
      description: 'Матчинг значень, збереження &#039;, з\'єднання multiselect через ";", невідомі бренди -> "Інше"',
      icon: BookOpen,
      color: 'text-emerald-600'
    },
    {
      title: 'Крок 4 — Формування назв за регламентом контенту',
      description: 'Генерація стандартизованих назв UA + RU: Тип + Особливість + Бренд + Модель + Характеристики + Колір + (Артикул)',
      icon: Tag,
      color: 'text-purple-600'
    },
    {
      title: 'Крок 5 — Формування фінального звіту та Excel',
      description: 'Збереження оригінальних JSON-коментарів у комірках заголовків, розрахунок заповненості та звіт за порожніми полями',
      icon: CheckCircle2,
      color: 'text-teal-600'
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStage((prev) => {
        if (prev < stages.length - 1) {
          return prev + 1;
        } else {
          clearInterval(timer);
          setTimeout(() => {
            onComplete();
          }, 600);
          return prev;
        }
      });
    }, 700);

    return () => clearInterval(timer);
  }, [onComplete]);

  const progressPercent = Math.round(((currentStage + 1) / stages.length) * 100);

  return (
    <div className="max-w-2xl mx-auto my-12 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#004BB7] flex items-center justify-center text-white mx-auto shadow-sm mb-4">
        <Sparkles className="w-7 h-7 text-[#FF7A00]" />
      </div>

      <h3 className="text-xl font-extrabold text-slate-900">
        Автоматизоване заповнення обов'язкових характеристик
      </h3>
      <p className="text-xs text-slate-500 mt-1">
        Обробка {productsCount} товарів за офіційним регламентом маркетплейсу Епіцентр...
      </p>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 rounded-full h-2.5 my-6 overflow-hidden p-0.5 border border-slate-200">
        <div
          className="bg-gradient-to-r from-[#004BB7] via-[#FF7A00] to-emerald-500 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Active Stage Indicator */}
      <div className="text-left bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
        {stages.map((stage, idx) => {
          const isDone = idx < currentStage;
          const isCurrent = idx === currentStage;
          const StageIcon = stage.icon;

          return (
            <div
              key={idx}
              className={`flex items-start gap-3 transition-opacity ${
                isCurrent ? 'opacity-100 font-semibold' : isDone ? 'opacity-70' : 'opacity-40'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 ${
                  isDone
                    ? 'bg-emerald-100 text-emerald-700'
                    : isCurrent
                    ? 'bg-[#004BB7] text-white animate-pulse'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {isDone ? '✓' : idx + 1}
              </div>
              <div className="flex-1 text-xs">
                <div className={`font-bold flex items-center gap-1.5 ${isCurrent ? 'text-slate-900' : 'text-slate-700'}`}>
                  <StageIcon className={`w-3.5 h-3.5 ${stage.color}`} />
                  <span>{stage.title}</span>
                </div>
                {isCurrent && (
                  <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed font-normal">
                    {stage.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
