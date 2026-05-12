"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isToday,
  isSameMonth,
} from "date-fns";
import { ru } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import type { Task, Category } from "@/lib/supabase/types";

type DayStats = {
  total: number;
  done: number;
  categories: { color: string }[];
};

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function getProgressColor(percent: number): string {
  if (percent === 0) return "var(--muted)";
  if (percent < 30) return "oklch(0.65 0.18 25)";
  if (percent < 60) return "oklch(0.7 0.16 80)";
  if (percent < 90) return "oklch(0.6 0.16 145)";
  return "oklch(0.55 0.2 145)";
}

export default function CalendarPage() {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState(0);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = useMemo(
    () => eachDayOfInterval({ start: calendarStart, end: calendarEnd }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calendarStart.getTime(), calendarEnd.getTime()]
  );

  const rangeStartStr = format(calendarStart, "yyyy-MM-dd");
  const rangeEndStr = format(calendarEnd, "yyyy-MM-dd");

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [taskRes, catRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .gte("scheduled_date", rangeStartStr)
        .lte("scheduled_date", rangeEndStr)
        .order("scheduled_date"),
      supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    if (taskRes.data) setTasks(taskRes.data);
    if (catRes.data) setCategories(catRes.data);
    setLoading(false);
  }, [rangeStartStr, rangeEndStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // dateStr -> stats
  const dayStatsMap = useMemo(() => {
    const map = new Map<string, DayStats>();
    const catMap = new Map(categories.map((c) => [c.id, c]));

    for (const task of tasks) {
      const dateKey = task.scheduled_date || "";
      if (!dateKey) continue;

      let stats = map.get(dateKey);
      if (!stats) {
        stats = { total: 0, done: 0, categories: [] };
        map.set(dateKey, stats);
      }
      stats.total++;
      if (task.is_done) stats.done++;

      if (task.category_id) {
        const cat = catMap.get(task.category_id);
        if (cat && !stats.categories.some((c) => c.color === (cat.color || "#666"))) {
          stats.categories.push({ color: cat.color || "#666" });
        }
      }
    }

    return map;
  }, [tasks, categories]);

  function handleDayClick(day: Date) {
    const dateStr = format(day, "yyyy-MM-dd");
    router.push(`/today?date=${dateStr}`);
  }

  function goToPrevMonth() {
    setDirection(-1);
    setCurrentMonth(subMonths(currentMonth, 1));
  }

  function goToNextMonth() {
    setDirection(1);
    setCurrentMonth(addMonths(currentMonth, 1));
  }

  function goToToday() {
    const now = new Date();
    setDirection(now > currentMonth ? 1 : -1);
    setCurrentMonth(now);
  }

  const isCurrentMonth = isSameMonth(currentMonth, new Date());

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24 md:pb-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-xl"
          onClick={goToPrevMonth}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <div className="text-center">
          <h1 className="text-xl font-bold capitalize">
            {isCurrentMonth ? (
              <span className="gradient-text">
                {format(currentMonth, "LLLL yyyy", { locale: ru })}
              </span>
            ) : (
              format(currentMonth, "LLLL yyyy", { locale: ru })
            )}
          </h1>
        </div>

        <div className="flex items-center gap-1">
          {!isCurrentMonth && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl"
              onClick={goToToday}
              title="Текущий месяц"
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl"
            onClick={goToNextMonth}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Month Stats */}
      <MonthSummary tasks={tasks} monthStart={monthStart} monthEnd={monthEnd} />

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="grid grid-cols-7 gap-1">
          {[...Array(35)].map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={format(currentMonth, "yyyy-MM")}
            initial={{ opacity: 0, x: direction * 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -50 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="grid grid-cols-7 gap-1"
          >
            {calendarDays.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const stats = dayStatsMap.get(dateStr);
              const inMonth = isSameMonth(day, currentMonth);
              const today = isToday(day);
              const percent =
                stats && stats.total > 0
                  ? Math.round((stats.done / stats.total) * 100)
                  : -1;

              return (
                <motion.button
                  key={dateStr}
                  onClick={() => handleDayClick(day)}
                  whileTap={{ scale: 0.95 }}
                  className={`
                    relative aspect-square rounded-xl p-1 flex flex-col items-center justify-center gap-0.5
                    transition-all duration-200 border
                    ${inMonth
                      ? "hover:bg-accent/80 cursor-pointer"
                      : "opacity-30 cursor-default"
                    }
                    ${today
                      ? "border-primary/50 bg-primary/5 shadow-sm"
                      : "border-transparent hover:border-border/50"
                    }
                  `}
                >
                  <span
                    className={`
                      text-sm font-medium leading-none
                      ${today ? "text-primary font-bold" : ""}
                      ${!inMonth ? "text-muted-foreground/40" : ""}
                    `}
                  >
                    {format(day, "d")}
                  </span>

                  {percent >= 0 && inMonth && (
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="h-1 w-6 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.max(percent, 8)}%`,
                            backgroundColor: getProgressColor(percent),
                          }}
                        />
                      </div>
                      {stats && stats.categories.length > 0 && (
                        <div className="flex gap-px">
                          {stats.categories.slice(0, 4).map((cat, i) => (
                            <div
                              key={i}
                              className="h-1 w-1 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                          ))}
                          {stats.categories.length > 4 && (
                            <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Legend */}
      <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: "oklch(0.65 0.18 25)" }}
          />
          <span>&lt;30%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: "oklch(0.7 0.16 80)" }}
          />
          <span>30–60%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: "oklch(0.6 0.16 145)" }}
          />
          <span>60–90%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: "oklch(0.55 0.2 145)" }}
          />
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}

function MonthSummary({
  tasks,
  monthStart,
  monthEnd,
}: {
  tasks: Task[];
  monthStart: Date;
  monthEnd: Date;
}) {
  const startStr = format(monthStart, "yyyy-MM-dd");
  const endStr = format(monthEnd, "yyyy-MM-dd");

  const monthTasks = tasks.filter((t) => {
    if (!t.scheduled_date) return false;
    return t.scheduled_date >= startStr && t.scheduled_date <= endStr;
  });

  const total = monthTasks.length;
  const done = monthTasks.filter((t) => t.is_done).length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const daysWithTasks = new Set(monthTasks.map((t) => t.scheduled_date)).size;

  if (total === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 rounded-2xl border border-border/50 bg-card/80 p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">Прогресс месяца</span>
        <span className="text-xs font-medium text-primary">
          {done}/{total} задач
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full gradient-primary"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span>{daysWithTasks} дн. с задачами</span>
        <span>{percent}% выполнено</span>
      </div>
    </motion.div>
  );
}
