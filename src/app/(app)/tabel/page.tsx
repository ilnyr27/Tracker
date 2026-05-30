"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
  BarChart3,
  Activity,
  PieChart,
  TrendingUp,
  Radar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import type { Goal, Category, Task } from "@/lib/supabase/types";

const ICON_TO_EMOJI: Record<string, string> = {
  "heart-pulse": "❤️", home: "🏠", "trending-up": "💰", briefcase: "💼",
  users: "👨‍👩‍👧", "message-circle": "👥", smile: "🌴", "graduation-cap": "📚",
  moon: "🕌", palette: "🎨",
};
function getEmoji(cat: Category): string {
  if (!cat.icon) return cat.name.charAt(0);
  if (ICON_TO_EMOJI[cat.icon]) return ICON_TO_EMOJI[cat.icon];
  return cat.icon;
}


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
                const emoji = getEmoji(cat);

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

// ── Chart types ──
type ChartType = "bar" | "radar" | "line" | "donut";

const CHART_TYPES: { id: ChartType; label: string; icon: typeof BarChart3 }[] = [
  { id: "bar", label: "Столбцы", icon: BarChart3 },
  { id: "radar", label: "Лепестковый", icon: Radar },
  { id: "line", label: "График", icon: Activity },
  { id: "donut", label: "Кольцевой", icon: PieChart },
];

// ── Category Charts — switchable chart types ──
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
  const [chartType, setChartType] = useState<ChartType>("bar");

  const catStats = useMemo(() => categories.map((cat) => {
    const catGoals = goalsByCategory.get(cat.id) || [];
    const goalIds = new Set(catGoals.map((g) => g.id));
    const catTasks = tasks.filter((t) => t.goal_id && goalIds.has(t.goal_id));
    const done = catTasks.filter((t) => t.is_done).length;
    const actual = catTasks.length;
    const percent = actual > 0 ? Math.round((done / actual) * 100) : 0;

    const dailyRates = days.map((day) => {
      const ds = format(day, "yyyy-MM-dd");
      const dayTasks = catTasks.filter((t) => t.scheduled_date === ds);
      const dayDone = dayTasks.filter((t) => t.is_done).length;
      return dayTasks.length > 0 ? Math.round((dayDone / dayTasks.length) * 100) : -1;
    });

    const validRates = dailyRates.filter((r) => r >= 0);
    const mid = Math.floor(validRates.length / 2);
    const firstHalf = validRates.slice(0, mid);
    const secondHalf = validRates.slice(mid);
    const avgFirst = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
    const avgSecond = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;
    const trend = avgSecond - avgFirst;

    return { cat, percent, done, actual, dailyRates, trend };
  }), [categories, goalsByCategory, tasks, days]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-6 rounded-2xl border border-border/30 bg-card p-4"
    >
      {/* Header with chart type toggle */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Прогресс по категориям</h3>
        <div className="flex rounded-xl border border-border/50 overflow-hidden">
          {CHART_TYPES.map((ct) => {
            const Icon = ct.icon;
            return (
              <button
                key={ct.id}
                onClick={() => setChartType(ct.id)}
                className={`p-1.5 transition-colors ${
                  chartType === ct.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground/40 hover:text-muted-foreground"
                }`}
                title={ct.label}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart content */}
      {chartType === "bar" && <BarChartView catStats={catStats} />}
      {chartType === "radar" && <RadarChartView catStats={catStats} />}
      {chartType === "line" && <LineChartView catStats={catStats} days={days} />}
      {chartType === "donut" && <DonutChartView catStats={catStats} />}

      {/* Trend legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-muted-foreground/50">
        <span className="text-emerald-500">↑ Рост</span>
        <span className="text-muted-foreground/40">→ Стабильно</span>
        <span className="text-red-400">↓ Спад</span>
      </div>
    </motion.div>
  );
}

type CatStat = { cat: Category; percent: number; done: number; actual: number; dailyRates: number[]; trend: number };

// ── Bar chart (original) ──
function BarChartView({ catStats }: { catStats: CatStat[] }) {
  return (
    <div className="space-y-4">
      {catStats.map(({ cat, percent, done, actual, dailyRates, trend }) => {
        const emoji = getEmoji(cat);
        return (
          <div key={cat.id}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-lg">{emoji}</span>
              <span className="text-xs font-medium flex-1 truncate">{cat.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{done}/{actual}</span>
              <span className="text-xs font-semibold tabular-nums" style={{ color: cat.color || "var(--primary)" }}>{percent}%</span>
              {actual > 0 && (
                <span className={`text-xs font-medium ${trend > 5 ? "text-emerald-500" : trend < -5 ? "text-red-400" : "text-muted-foreground/40"}`}>
                  {trend > 5 ? "↑" : trend < -5 ? "↓" : "→"}
                </span>
              )}
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden mb-2">
              <motion.div className="h-full rounded-full" style={{ backgroundColor: cat.color || "var(--primary)" }} initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 0.6 }} />
            </div>
            <div className="flex gap-px items-end h-5">
              {dailyRates.map((rate, i) => (
                <div key={i} className="flex-1 rounded-sm min-w-[2px]" style={{
                  height: rate >= 0 ? `${Math.max(rate * 0.2, 2)}px` : "2px",
                  backgroundColor: rate < 0 ? "var(--muted)" : rate === 100 ? "oklch(0.55 0.2 145)" : rate >= 50 ? (cat.color || "var(--primary)") : "oklch(0.65 0.18 25)",
                  opacity: rate < 0 ? 0.3 : 0.8,
                }} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Radar chart (SVG) ──
function RadarChartView({ catStats }: { catStats: CatStat[] }) {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 30;
  const n = catStats.length;
  if (n < 3) return <p className="text-xs text-muted-foreground text-center py-8">Нужно минимум 3 категории</p>;

  const angleStep = (2 * Math.PI) / n;
  const levels = [25, 50, 75, 100];

  function polarToXY(angle: number, r: number) {
    return { x: cx + r * Math.cos(angle - Math.PI / 2), y: cy + r * Math.sin(angle - Math.PI / 2) };
  }

  const dataPoints = catStats.map((s, i) => {
    const angle = i * angleStep;
    const r = (s.percent / 100) * maxR;
    return polarToXY(angle, r);
  });

  const polygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="flex justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Grid circles */}
        {levels.map((level) => (
          <circle key={level} cx={cx} cy={cy} r={(level / 100) * maxR} fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
        ))}
        {/* Axis lines */}
        {catStats.map((_, i) => {
          const angle = i * angleStep;
          const end = polarToXY(angle, maxR);
          return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="currentColor" strokeOpacity={0.1} strokeWidth={1} />;
        })}
        {/* Data polygon */}
        <polygon points={polygonPoints} fill="var(--primary)" fillOpacity={0.15} stroke="var(--primary)" strokeWidth={2} strokeOpacity={0.6} />
        {/* Data points */}
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill={catStats[i].cat.color || "var(--primary)"} stroke="var(--card)" strokeWidth={2} />
        ))}
        {/* Labels */}
        {catStats.map((s, i) => {
          const angle = i * angleStep;
          const labelPos = polarToXY(angle, maxR + 18);
          return (
            <text key={i} x={labelPos.x} y={labelPos.y} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[10px]">
              {getEmoji(s.cat)} {s.percent}%
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ── Line chart (SVG) ──
function LineChartView({ catStats, days }: { catStats: CatStat[]; days: Date[] }) {
  const width = 320;
  const height = 160;
  const padX = 30;
  const padY = 20;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  return (
    <div className="flex justify-center overflow-x-auto">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="min-w-[280px]">
        {/* Y axis lines */}
        {[0, 25, 50, 75, 100].map((v) => {
          const y = padY + chartH - (v / 100) * chartH;
          return (
            <g key={v}>
              <line x1={padX} y1={y} x2={padX + chartW} y2={y} stroke="currentColor" strokeOpacity={0.06} />
              <text x={padX - 4} y={y + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">{v}</text>
            </g>
          );
        })}
        {/* Lines per category */}
        {catStats.map(({ cat, dailyRates }) => {
          const validPoints = dailyRates
            .map((rate, i) => ({ rate, i }))
            .filter((p) => p.rate >= 0);
          if (validPoints.length < 2) return null;
          const pathD = validPoints
            .map((p, idx) => {
              const x = padX + (p.i / Math.max(dailyRates.length - 1, 1)) * chartW;
              const y = padY + chartH - (p.rate / 100) * chartH;
              return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
            })
            .join(" ");
          return (
            <path key={cat.id} d={pathD} fill="none" stroke={cat.color || "var(--primary)"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.8} />
          );
        })}
      </svg>
    </div>
  );
}

// ── Donut chart (SVG) ──
function DonutChartView({ catStats }: { catStats: CatStat[] }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 80;
  const innerR = 50;

  const totalDone = catStats.reduce((sum, s) => sum + s.done, 0);
  if (totalDone === 0) return <p className="text-xs text-muted-foreground text-center py-8">Нет данных</p>;

  let cumAngle = -Math.PI / 2;
  const arcs = catStats.filter((s) => s.done > 0).map((s) => {
    const fraction = s.done / totalDone;
    const startAngle = cumAngle;
    const sweep = fraction * 2 * Math.PI;
    cumAngle += sweep;
    return { ...s, startAngle, sweep };
  });

  function arcPath(startAngle: number, sweep: number, r1: number, r2: number) {
    const endAngle = startAngle + sweep;
    const largeArc = sweep > Math.PI ? 1 : 0;
    const x1 = cx + r2 * Math.cos(startAngle);
    const y1 = cy + r2 * Math.sin(startAngle);
    const x2 = cx + r2 * Math.cos(endAngle);
    const y2 = cy + r2 * Math.sin(endAngle);
    const x3 = cx + r1 * Math.cos(endAngle);
    const y3 = cy + r1 * Math.sin(endAngle);
    const x4 = cx + r1 * Math.cos(startAngle);
    const y4 = cy + r1 * Math.sin(startAngle);
    return `M ${x1} ${y1} A ${r2} ${r2} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${r1} ${r1} 0 ${largeArc} 0 ${x4} ${y4} Z`;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map((arc) => (
          <path
            key={arc.cat.id}
            d={arcPath(arc.startAngle, arc.sweep - 0.02, innerR, outerR)}
            fill={arc.cat.color || "var(--primary)"}
            fillOpacity={0.8}
            stroke="var(--card)"
            strokeWidth={2}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-foreground text-lg font-bold">{totalDone}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="fill-muted-foreground text-[10px]">выполнено</text>
      </svg>
      <div className="flex flex-wrap justify-center gap-3">
        {arcs.map((arc) => (
          <div key={arc.cat.id} className="flex items-center gap-1.5 text-xs">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: arc.cat.color || "var(--primary)" }} />
            <span>{getEmoji(arc.cat)} {arc.cat.name}</span>
            <span className="text-muted-foreground/50">{arc.done}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
