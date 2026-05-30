"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, HelpCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const FAQ_ITEMS = [
  {
    q: "Как добавить привычку?",
    a: 'На главной странице нажми «+ Привычка» в нужной категории. Укажи название и тип повтора — каждый день, по дням недели или определённое число дней.',
  },
  {
    q: "Как отметить привычку выполненной?",
    a: "На главной странице нажми на кружок рядом с привычкой. Также можно отмечать в Матрице жизни — нажми на ячейку на пересечении привычки и дня.",
  },
  {
    q: "Что такое Матрица жизни?",
    a: "Это таблица, где строки — привычки, а столбцы — дни. Зелёная галочка — выполнено, красный крестик — пропущено. Переключай между неделей и месяцем.",
  },
  {
    q: 'Чем отличаются «Мои задачи» и «По целям» в канбане?',
    a: '«Мои задачи» — самостоятельные задачи без категории (списки дел, проекты). «По целям» — цели, привязанные к категориям на главной странице (здоровье, финансы и т.д.).',
  },
  {
    q: "Как перемещать карточки в канбане?",
    a: 'Зажми карточку и перетащи в нужную колонку (План, В работе, Завершённые, Архив). На мобильном — долгое нажатие и перетаскивание. Также можно нажать кнопки перемещения внизу карточки.',
  },
  {
    q: "Как работает фото-дневник?",
    a: 'Нажми «Загрузить» и выбери фото. Они сгруппируются по дате. Нажми на фото и отметь его как лучшее — «Фото дня», «недели», «месяца» или «года». Вкладка «Лучшие» покажет избранные.',
  },
  {
    q: "Что показывает календарь в Обзоре?",
    a: "Цветные точки на днях показывают активность по категориям. Нажми на день — увидишь все задачи, заметки и фото за этот день.",
  },
  {
    q: "Как настроить уведомления?",
    a: 'Настройки → Уведомления → «Включить». После этого выбери какие уведомления получать: привычки, цели, журнал, серии.',
  },
  {
    q: "Как вести журнал?",
    a: "Открой Журнал и напиши заметку. Она привязывается к текущей дате. Можно редактировать (карандаш) и удалять (корзина) записи.",
  },
  {
    q: 'Что значит «бесконечная» привычка?',
    a: 'Привычка без ограничения по дням. Вместо прогресса в процентах показывает огонёк и количество дней выполнения. Идеально для привычек на всю жизнь.',
  },
  {
    q: "Могу ли я пройти обучение заново?",
    a: 'Да! Нажми кнопку «Пройти обучение заново» внизу этой страницы.',
  },
];

export default function FaqPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  function resetOnboarding() {
    localStorage.removeItem("onboarding_completed");
    window.location.href = "/today";
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24 md:pb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
          <HelpCircle className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold gradient-text">Вопросы и ответы</h1>
          <p className="text-xs text-muted-foreground">
            Как пользоваться Life Tracker
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = openIdx === i;

          return (
            <div
              key={i}
              className="rounded-2xl border border-border/30 bg-card/80 overflow-hidden"
            >
              <button
                onClick={() => setOpenIdx(isOpen ? null : i)}
                className="flex items-center justify-between w-full px-5 py-4 text-left text-sm font-medium hover:bg-accent/30 transition-colors"
              >
                <span>{item.q}</span>
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-4 w-4 text-muted-foreground/50 shrink-0 ml-3" />
                </motion.div>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                      {item.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Restart onboarding */}
      <div className="mt-8 flex justify-center">
        <Button
          variant="outline"
          className="rounded-xl gap-2"
          onClick={resetOnboarding}
        >
          <RotateCcw className="h-4 w-4" />
          Пройти обучение заново
        </Button>
      </div>
    </div>
  );
}
