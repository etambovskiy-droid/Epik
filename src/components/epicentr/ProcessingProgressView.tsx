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
      color: 'text-blue-400'
    },
    {
      title: 'Крок 2 — Аналіз першого фото та описів',
      description: 'Визначення базового кольору та візерунка («з візерунком» / «без візерунка») строго за першим фото товару',
      icon: Camera,
      color: 'text-amber-400'
    },
    {
      title: 'Крок 3 — Звірка з довідником та HTML-ентіті',
      description: 'Матчинг значень, збереження &#039;, з\'єднання multiselect через ";", бренди відсутні у довіднику -> "Інше"',
      icon: BookOpen,
      color: 'text-emerald-400'
    },
    {
      title: 'Крок 4 — Формування назв за формулою Епіцентру',
      description: 'Генерація стандартизованих назв UA + RU: Тип + Особливість + Бренд + Модель + Характеристики + Колір + (Артикул)',
      icon: Tag,
      color: 'text-purple-400'
    },
    {
      title: 'Крок 5 — Формування фінального звіту та Excel',
      description: 'Збереження оригінальних JSON-коментарів у комірках заголовків, розрахунок fill-rate та звіт за порожніми полями',
      icon: CheckCircle2,
      color: 'text-teal-400'
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
    <div className="max-w-2xl mx-auto my-12 bg-[#0b1b36] border border-blue-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-blue-950/60 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-500/25 mb-4 animate-pulse">
        <Sparkles className="w-7 h-7" />
      </div>

      <h3 className="text-xl font-bold text-white">
        Агент заповнює обов'язкові характеристики товарів
      </h3>
      <p className="text-xs text-slate-400 mt-1">
        Обробка {productsCount} товарів за офіційним регламентом маркетплейсу Епіцентр...
      </p>

      {/* Progress Bar */}
      <div className="w-full bg-slate-900 rounded-full h-2.5 my-6 overflow-hidden p-0.5 border border-slate-800">
        <div
          className="bg-gradient-to-r from-blue-500 via-amber-400 to-emerald-400 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Stages list */}
      <div className="space-y-3 text-left">
        {stages.map((stage, idx) => {
          const IconComponent = stage.icon;
          const isDone = idx < currentStage;
          const isCurrent = idx === currentStage;
          const isUpcoming = idx > currentStage;

          return (
            <div
              key={idx}
              className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                isCurrent
                  ? 'bg-blue-600/10 border-blue-500/40 text-white'
                  : isDone
                  ? 'bg-slate-900/40 border-slate-800 text-slate-300'
                  : 'bg-slate-950/20 border-slate-900 text-slate-500'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isCurrent ? (
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                ) : isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <IconComponent className="w-4 h-4 text-slate-600" />
                )}
              </div>
              <div>
                <span className={`text-xs font-bold block ${isCurrent ? 'text-white' : isDone ? 'text-slate-200' : 'text-slate-500'}`}>
                  {stage.title}
                </span>
                <span className="text-[11px] text-slate-400 leading-relaxed block mt-0.5">
                  {stage.description}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
