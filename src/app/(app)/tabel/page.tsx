"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isToday,
  isBefore,
} from "date-fns";
import { ru } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import type { Goal, Category, Task } from "@/lib/supabase/types";


type ViewMode = "week" | "month";

export default function MatrixPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const rangeStart = viewMode === "week"
    ? startOfWeek(currentDate, { weekStartsOn: 1 })
    : startOfMonth(currentDate);
  const rangeEnd = viewMode === "week"
    ? endOfWeek(currentDate, { weekStartsOn: 1 })
    : endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  const startStr = format(rangeStart, "yyyy-MM-dd");
  const endStr = format(rangeEnd, "yyyy-MM-dd");

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [catRes, goalsRes, tasksRes] = await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("goals")
        .select("*")
        .eq("status", "active")
        .eq("tracking_type", "habit")
        .order("sort_order"),
      supabase
        .from("tasks")
        .select("*")
        .gte("scheduled_date", startStr)
        .lte("scheduled_date", endStr)
        .not("goal_id", "is", null),
    ]);

    if (catRes.data) setCategories(catRes.data);
    if (goalsRes.data) setGoals(goalsRes.data);
    if (tasksRes.data) setTasks(tasksRes.data);
    setLoading(false);
  }, [startStr, endStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build task lookup
  const taskMap = new Map<string, Task>();
  for (const task of tasks) {
    if (task.goal_id && task.scheduled_date) {
      taskMap.set(`${task.goal_id}__${task.scheduled_date}`, task);
    }
  }

  // Group goals by category
  const goalsByCategory = new Map<string, Goal[]>();
  for (const goal of goals) {
    const catId = goal.category_id || "none";
    if (!goalsByCategory.has(catId)) goalsByCategory.set(catId, []);
    goalsByCategory.get(catId)!.push(goal);
  }

  const activeCats = categories.filter((cat) => goalsByCategory.has(cat.id));

  async function toggleCell(goalId: string, dateStr: string) {
    const key = `${goalId}__${dateStr}`;
    const existing = taskMap.get(key);

    const supabase = createClient();

    if (existing) {
      const newDone = !existing.is_done;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === existing.id
            ? { ...t, is_done: newDone, completed_at: newDone ? new Date().toISOString() : null }
            : t
        )
      );
      await supabase
        .from("tasks")
        .update({ is_done: newDone, completed_at: newDone ? new Date().toISOString() : null })
        .eq("id", existing.id);
    } else {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const goal = goals.find((g) => g.id === goalId);
      if (!goal) return;

      const optimisticTask: Task = {
        id: `temp-${Date.now()}`,
        user_id: userData.user.id,
        goal_id: goalId,
        category_id: goal.category_id,
        template_id: null,
        title: goal.title,
        is_done: true,
        scheduled_date: dateStr,
        original_date: null,
        priority: null,
        sort_order: 0,
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setTasks((prev) => [...prev, optimisticTask]);

      const { data } = await supabase
        .from("tasks")
        .insert({
          user_id: userData.user.id,
          goal_id: goalId,
          category_id: goal.category_id,
          title: goal.title,
          is_done: true,
          scheduled_date: dateStr,
          completed_at: new Date().toISOString(),
          sort_order: 0,
        })
        .select()
        .single();

      if (data) {
        setTasks((prev) =>
          prev.map((t) => (t.id === optimisticTask.id ? data : t))
        );
      }
    }
  }

  function navigateBack() {
    if (viewMode === "week") setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subMonths(currentDate, 1));
  }

  function navigateForward() {
    if (viewMode === "week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addMonths(currentDate, 1));
  }

  const monthLabel = format(currentDate, "LLL", { locale: ru });

  // Legend counts
  let legendDone = 0;
  let legendMissed = 0;
  let legendEmpty = 0;
  for (const cat of activeCats) {
    const catGoals = goalsByCategory.get(cat.id) || [];
    for (const goal of catGoals) {
      for (const day of days) {
        const ds = format(day, "yyyy-MM-dd");
        const task = taskMap.get(`${goal.id}__${ds}`);
        const past = isBefore(day, new Date()) && !isToday(day);
        if (task?.is_done) legendDone++;
        else if (past) legendMissed++;
        else legendEmpty++;
      }
    }
  }

  return (
    <div className="p-4 pb-24 md:pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Матрица жизни</h1>
          <p className="text-xs text-muted-foreground">
            Отслеживай, как ты уделяешь внимание разным сферам жизни каждый день.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-3 mb-4">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={navigateBack} aria-label="Назад">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCurrentDate(new Date())} aria-label="Сегодня">
            <CalendarDays className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={navigateForward} aria-label="Вперёд">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex rounded-xl border border-border/50 overflow-hidden text-xs" role="tablist" aria-label="Период отображения">
          <button
            role="tab"
            aria-selected={viewMode === "week"}
            onClick={() => setViewMode("week")}
            className={`px-3 py-1.5 transition-colors ${
              viewMode === "week" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent/50"
            }`}
          >
            Неделя
          </button>
          <button
            role="tab"
            aria-selected={viewMode === "month"}
            onClick={() => setViewMode("month")}
            className={`px-3 py-1.5 transition-colors ${
              viewMode === "month" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent/50"
            }`}
          >
            Месяц
          </button>
        </div>
      </div>

      {/* Matrix grid */}
      {loading ? (
        <div className="h-64 rounded-2xl bg-card animate-pulse" />
      ) : activeCats.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted-foreground text-sm">
            Создайте привычки на главной странице
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-border/30 overflow-auto bg-card"
        >
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-card">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground border-b border-border/30 min-w-[160px] sticky left-0 bg-card z-20">
                  <span className="text-[10px] uppercase tracking-wider">{monthLabel}</span>
                </th>
                {days.map((day) => {
                  const today = isToday(day);
                  const dayName = format(day, "EEEEEE", { locale: ru });
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                  return (
                    <th
                      key={day.toISOString()}
                      className={`text-center px-0.5 py-2 font-medium border-b border-border/30 min-w-[32px] ${
                        today ? "text-primary" : isWeekend ? "text-muted-foreground/30" : "text-muted-foreground/60"
                      }`}
                    >
                      <div className="flex flex-col items-center leading-tight">
                        <span className="text-[9px] capitalize">{dayName}</span>
                        <span className={`text-[11px] ${today ? "font-bold bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center mx-auto" : ""}`}>
                          {format(day, "d")}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {activeCats.map((cat) => {
                const catGoals = goalsByCategory.get(cat.id) || [];
                const emoji = cat.icon || cat.name.charAt(0);

                return catGoals.map((goal, goalIdx) => (
                  <tr
                    key={goal.id}
                    className="border-b border-border/15 hover:bg-accent/10 transition-colors"
                  >
                    {/* Category + Goal name */}
                    <td className="px-3 py-2.5 sticky left-0 bg-card z-10">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm"
                          style={{ backgroundColor: `${cat.color}12` }}
                        >
                          {emoji}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium leading-tight truncate">
                            {goal.title}
                          </div>
                          {goalIdx === 0 && (
                            <div className="text-[9px] text-muted-foreground/40 truncate">
                              {cat.name}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Day cells — green check / red X / empty */}
                    {days.map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const key = `${goal.id}__${dateStr}`;
                      const task = taskMap.get(key);
                      const today = isToday(day);
                      const isPast = isBefore(day, new Date()) && !today;
                      const isDone = task?.is_done === true;
                      const isFuture = !isPast && !today;

                      return (
                        <td
                          key={dateStr}
                          className={`text-center px-0.5 py-1.5 ${today ? "bg-primary/3" : ""}`}
                        >
                          <button
                            onClick={() => toggleCell(goal.id, dateStr)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg transition-all hover:scale-110"
                            aria-label={`${goal.title} — ${format(day, "d MMM", { locale: ru })}${isDone ? " (выполнено)" : ""}`}
                          >
                            {isDone ? (
                              <div className="h-5 w-5 rounded-md bg-emerald-500/15 flex items-center justify-center">
                                <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={3} />
                              </div>
                            ) : isPast ? (
                              <div className="h-5 w-5 rounded-md bg-red-500/10 flex items-center justify-center">
                                <X className="h-3 w-3 text-red-400/70" strokeWidth={2.5} />
                              </div>
                            ) : (
                              <div className="h-5 w-5 rounded-md border border-border/30" />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </motion.div>
      )}

      {/* Legend */}
      {!loading && activeCats.length > 0 && (
        <div className="flex items-center justify-center gap-5 mt-4 text-[10px] text-muted-foreground/50">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-emerald-500/15 flex items-center justify-center">
              <Check className="h-2 w-2 text-emerald-500" strokeWidth={3} />
            </div>
            Сделано
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-red-500/10 flex items-center justify-center">
              <X className="h-2 w-2 text-red-400" strokeWidth={2.5} />
            </div>
            Пропущено
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded border border-border/30" />
            Нет данных
          </div>
        </div>
      )}

      {/* Category progress charts */}
      {!loading && activeCats.length > 0 && (
        <CategoryCharts
          categories={activeCats}
          goalsByCategory={goalsByCategory}
          tasks={tasks}
          days={days}
        />
      )}
    </div>
  );
}

// ── Category Charts — progress bars + daily trend ──
function CategoryCharts({
  categories,
  goalsByCategory,
  tasks,
  days,
}: {
  categories: Category[];
  goalsByCategory: Map<string, Goal[]>;
  tasks: Task[];
  days: Date[];
}) {
  // Calculate per-category completion rate for the current period
  const catStats = categories.map((cat) => {
    const catGoals = goalsByCategory.get(cat.id) || [];
    const goalIds = new Set(catGoals.map((g) => g.id));
    const catTasks = tasks.filter((t) => t.goal_id && goalIds.has(t.goal_id));
    const done = catTasks.filter((t) => t.is_done).length;
    const total = catGoals.length * days.length; // max possible
    const actual = catTasks.length;
    const percent = actual > 0 ? Math.round((done / actual) * 100) : 0;

    // Daily trend: completion rate per day
    const dailyRates = days.map((day) => {
      const ds = format(day, "yyyy-MM-dd");
      const dayTasks = catTasks.filter((t) => t.scheduled_date === ds);
      const dayDone = dayTasks.filter((t) => t.is_done).length;
      return dayTasks.length > 0 ? Math.round((dayDone / dayTasks.length) * 100) : -1;
    });

    // Trend: compare last half vs first half
    const validRates = dailyRates.filter((r) => r >= 0);
    const mid = Math.floor(validRates.length / 2);
    const firstHalf = validRates.slice(0, mid);
    const secondHalf = validRates.slice(mid);
    const avgFirst = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
    const avgSecond = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;
    const trend = avgSecond - avgFirst; // positive = growth

    return { cat, percent, done, actual, dailyRates, trend };
  });

  const maxPercent = Math.max(...catStats.map((s) => s.percent), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-6 rounded-2xl border border-border/30 bg-card p-4"
    >
      <h3 className="text-sm font-semibold mb-4">Прогресс по категориям</h3>
      <div className="space-y-4">
        {catStats.map(({ cat, percent, done, actual, dailyRates, trend }) => {
          const emoji = cat.icon || cat.name.charAt(0);

          return (
            <div key={cat.id}>
              {/* Category header row */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg">{emoji}</span>
                <span className="text-xs font-medium flex-1 truncate">{cat.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {done}/{actual}
                </span>
                <span
                  className="text-xs font-semibold tabular-nums"
                  style={{ color: cat.color || "var(--primary)" }}
                >
                  {percent}%
                </span>
                {/* Trend arrow */}
                {actual > 0 && (
                  <span className={`text-xs font-medium ${trend > 5 ? "text-emerald-500" : trend < -5 ? "text-red-400" : "text-muted-foreground/40"}`}>
                    {trend > 5 ? "↑" : trend < -5 ? "↓" : "→"}
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden mb-2">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: cat.color || "var(--primary)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{ duration: 0.6 }}
                />
              </div>

              {/* Mini daily sparkline */}
              <div className="flex gap-px items-end h-5">
                {dailyRates.map((rate, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm min-w-[2px]"
                    style={{
                      height: rate >= 0 ? `${Math.max(rate * 0.2, 2)}px` : "2px",
                      backgroundColor:
                        rate < 0
                          ? "var(--muted)"
                          : rate === 100
                            ? "oklch(0.55 0.2 145)"
                            : rate >= 50
                              ? (cat.color || "var(--primary)")
                              : "oklch(0.65 0.18 25)",
                      opacity: rate < 0 ? 0.3 : 0.8,
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Trend legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-muted-foreground/50">
        <span className="text-emerald-500">↑ Рост</span>
        <span className="text-muted-foreground/40">→ Стабильно</span>
        <span className="text-red-400">↓ Спад</span>
      </div>
    </motion.div>
  );
}
