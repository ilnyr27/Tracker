"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Home,
  Grid3X3,
  Target,
  BookOpen,
  Camera,
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ONBOARDING_KEY = "onboarding_completed";

const STEPS = [
  {
    icon: Sparkles,
    title: "Добро пожаловать!",
    subtitle: "Life Tracker — твой личный трекер жизни",
    description:
      "Отслеживай привычки, ставь цели, веди журнал и фото-дневник. Всё в одном месте.",
    color: "from-primary to-primary/60",
  },
  {
    icon: Home,
    title: "Главная",
    subtitle: "Привычки и задачи на сегодня",
    description:
      'Добавляй привычки по категориям (здоровье, финансы, учёба...). Отмечай выполненные каждый день. Можно настроить повтор — каждый день или по дням недели.',
    color: "from-blue-500 to-blue-400",
  },
  {
    icon: Grid3X3,
    title: "Матрица жизни",
    subtitle: "Таблица привычек по дням",
    description:
      "Наглядная сетка: строки — привычки, столбцы — дни. Зелёная галочка — выполнено, красный крестик — пропущено. Переключай между неделей и месяцем.",
    color: "from-purple-500 to-purple-400",
  },
  {
    icon: Target,
    title: "Канбан",
    subtitle: "Цели и задачи на доске",
    description:
      'Два режима: «Мои задачи» — независимые задачи, «По целям» — цели из категорий. Перетаскивай карточки между колонками: План → В работе → Завершённые.',
    color: "from-orange-500 to-orange-400",
  },
  {
    icon: BookOpen,
    title: "Журнал и Фото",
    subtitle: "Записывай мысли и моменты",
    description:
      "Журнал — быстрые заметки с привязкой к дате. Фото-дневник — загружай фото каждого дня и выбирай лучшие (дня, недели, месяца, года).",
    color: "from-emerald-500 to-emerald-400",
  },
  {
    icon: CalendarDays,
    title: "Обзор",
    subtitle: "Календарь и статистика",
    description:
      "Нажми на любой день в календаре — увидишь задачи, заметки и фото за этот день. Цветные точки показывают активность.",
    color: "from-pink-500 to-pink-400",
  },
];

export function Onboarding() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARDING_KEY)) {
        setShow(true);
      }
    } catch {}
  }, []);

  function complete() {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setShow(false);
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else complete();
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  if (!show) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="w-full max-w-md"
        >
          {/* Skip */}
          <div className="flex justify-end mb-4">
            <button
              onClick={complete}
              className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              Пропустить
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Card */}
          <div className="rounded-3xl border border-border/30 bg-card p-8 text-center shadow-xl">
            {/* Icon */}
            <div
              className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br ${current.color} shadow-lg`}
            >
              <Icon className="h-10 w-10 text-white" />
            </div>

            <h2 className="text-2xl font-bold mb-1">{current.title}</h2>
            <p className="text-sm text-primary font-medium mb-4">
              {current.subtitle}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {current.description}
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === step
                    ? "w-8 bg-primary"
                    : i < step
                      ? "w-2 bg-primary/40"
                      : "w-2 bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3 mt-6">
            {step > 0 && (
              <Button
                variant="ghost"
                className="flex-1 h-12 rounded-xl"
                onClick={prev}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Назад
              </Button>
            )}
            <Button
              className={`flex-1 h-12 rounded-xl gradient-primary text-white border-0 hover:opacity-90 ${
                step === 0 ? "w-full" : ""
              }`}
              onClick={next}
            >
              {isLast ? (
                "Начать!"
              ) : (
                <>
                  Далее
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
