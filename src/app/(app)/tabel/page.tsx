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
  addDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addYears,
  subYears,
  startOfYear,
  endOfYear,
  isToday,
  isBefore,
  parseISO,
  startOfDay,
} from "date-fns";
import { ru } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Check,
  X,
  Radar,
  PieChart,
  BarChart3,
  NotebookPen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import type { Goal, Category, Task, TaskTemplate } from "@/lib/supabase/types";
import { matchesDate } from "@/lib/recurrence";

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


type BaseMode = "week" | "month" | "year";
type ChartType = "radar" | "donut" | "histogram";

const CHART_TYPES: { id: ChartType; label: string; icon: typeof Radar }[] = [
  { id: "radar", label: "Лепестковая", icon: Radar },
  { id: "donut", label: "Круговая", icon: PieChart },
  { id: "histogram", label: "Гистограмма", icon: BarChart3 },
];

type CatStat = { name: string; color: string; done: number; total: number; pct: number };

export default function MatrixPage() {
  const [baseMode, setBaseMode] = useState<BaseMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("matrix_base_mode") as BaseMode) || "week";
    }
    return "week";
  });
  const [fromToday, setFromToday] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("matrix_from_today") === "true";
    }
    return false;
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<ChartType>("radar");
  const [showNotes, setShowNotes] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("matrix_show_notes") === "true";
    return false;
  });
  type NotePopover = { taskId: string; note: string; goalTitle: string; dateLabel: string };
  const [notePopover, setNotePopover] = useState<NotePopover | null>(null);

  const rangeStart = fromToday
    ? startOfDay(currentDate)
    : baseMode === "year"
      ? startOfYear(currentDate)
      : baseMode === "month"
        ? startOfMonth(currentDate)
        : startOfWeek(currentDate, { weekStartsOn: 1 });
  const rangeEnd = fromToday
    ? addDays(startOfDay(currentDate), baseMode === "year" ? 364 : baseMode === "month" ? 29 : 6)
    : baseMode === "year"
      ? endOfYear(currentDate)
      : baseMode === "month"
        ? endOfMonth(currentDate)
        : endOfWeek(currentDate, { weekStartsOn: 1 });
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

    // Load templates separately — table may not exist if migration 002 not applied
    try {
      const { data: tmplData } = await supabase
        .from("task_templates")
        .select("*")
        .eq("is_active", true);
      if (tmplData) setTemplates(tmplData);
    } catch {
      // task_templates table may not exist yet
    }
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

  // Template lookup by goal_id
  const templateByGoal = new Map<string, TaskTemplate>();
  for (const tmpl of templates) {
    if (tmpl.goal_id) templateByGoal.set(tmpl.goal_id, tmpl);
  }

  function isScheduledDay(goalId: string, date: Date): boolean {
    const tmpl = templateByGoal.get(goalId);
    if (!tmpl) return true; // no template = daily goal
    return matchesDate(tmpl, date);
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
      if (showNotes && existing.is_done) {
        const goal = goals.find((g) => g.id === goalId);
        setNotePopover({
          taskId: existing.id,
          note: existing.completion_note || "",
          goalTitle: goal?.title || "",
          dateLabel: format(parseISO(dateStr), "d MMMM yyyy", { locale: ru }),
        });
        return;
      }
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
        completion_note: null,
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

  async function saveNote(taskId: string, note: string) {
    const supabase = createClient();
    const val = note.trim() || null;
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, completion_note: val } : t));
    await supabase.from("tasks").update({ completion_note: val }).eq("id", taskId);
  }

  function navigateBack() {
    if (baseMode === "year") setCurrentDate(subYears(currentDate, 1));
    else if (baseMode === "month") setCurrentDate(subMonths(currentDate, 1));
    else setCurrentDate(subWeeks(currentDate, 1));
  }

  function navigateForward() {
    if (baseMode === "year") setCurrentDate(addYears(currentDate, 1));
    else if (baseMode === "month") setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(addWeeks(currentDate, 1));
  }

  const periodLabel = baseMode === "year"
    ? format(currentDate, "yyyy")
    : format(currentDate, "LLL yyyy", { locale: ru });

  // Legend counts — only count scheduled days
  let legendDone = 0;
  let legendMissed = 0;
  let legendEmpty = 0;
  for (const cat of activeCats) {
    const catGoals = goalsByCategory.get(cat.id) || [];
    for (const goal of catGoals) {
      const goalStart = startOfDay(parseISO(goal.created_at));
      for (const day of days) {
        if (isBefore(day, goalStart)) continue;
        const ds = format(day, "yyyy-MM-dd");
        const task = taskMap.get(`${goal.id}__${ds}`);
        const past = isBefore(day, new Date()) && !isToday(day);
        const scheduled = isScheduledDay(goal.id, day);
        if (task?.is_done) legendDone++;
        else if (past && scheduled) legendMissed++;
        else if (scheduled) legendEmpty++;
        // unscheduled days are not counted in stats
      }
    }
  }

  // Category stats for charts — only scheduled days
  const catStats: CatStat[] = useMemo(() => {
    return activeCats.map((cat) => {
      const catGoals = goalsByCategory.get(cat.id) || [];
      let done = 0;
      let total = 0;
      for (const goal of catGoals) {
        const goalStart = startOfDay(parseISO(goal.created_at));
        for (const day of days) {
          if (isBefore(day, goalStart)) continue;
          if (!isScheduledDay(goal.id, day)) continue; // skip unscheduled
          const ds = format(day, "yyyy-MM-dd");
          const past = isBefore(day, new Date()) || isToday(day);
          if (!past) continue;
          total++;
          const task = taskMap.get(`${goal.id}__${ds}`);
          if (task?.is_done) done++;
        }
      }
      return {
        name: cat.name,
        color: cat.color || "#888",
        done,
        total,
        pct: total > 0 ? Math.round((done / total) * 100) : 0,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCats, goalsByCategory, days, taskMap, templates]);

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
        <div className="flex items-center gap-2">
          {baseMode !== "year" && (
            <button
              onClick={() => { const n = !showNotes; setShowNotes(n); localStorage.setItem("matrix_show_notes", String(n)); }}
              className={`px-2 py-1.5 rounded-lg text-xs border transition-all flex items-center gap-1 ${
                showNotes ? "bg-blue-500/10 text-blue-500 border-blue-500/30 font-medium" : "text-muted-foreground border-border/50 hover:bg-accent/50"
              }`}
              title="Режим записей — нажми на выполненную ячейку чтобы добавить заметку"
            >
              <NotebookPen className="h-3 w-3" />
              Записи
            </button>
          )}
          <button
            onClick={() => {
              const next = !fromToday;
              setFromToday(next);
              localStorage.setItem("matrix_from_today", String(next));
              if (next) setCurrentDate(new Date());
            }}
            className={`px-2 py-1.5 rounded-lg text-xs border transition-all ${
              fromToday ? "bg-primary/10 text-primary border-primary/30 font-medium" : "text-muted-foreground border-border/50 hover:bg-accent/50"
            }`}
          >
            Сегодня→
          </button>
          <div className="flex rounded-xl border border-border/50 overflow-hidden text-xs" role="tablist" aria-label="Период отображения">
            {([
              { id: "week" as BaseMode, label: "Неделя" },
              { id: "month" as BaseMode, label: "Месяц" },
              { id: "year" as BaseMode, label: "Год" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={baseMode === tab.id}
                onClick={() => {
                  setBaseMode(tab.id);
                  localStorage.setItem("matrix_base_mode", tab.id);
                }}
                className={`px-2.5 py-1.5 transition-colors ${
                  baseMode === tab.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent/50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
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
                  <span className="text-[10px] uppercase tracking-wider">{periodLabel}</span>
                </th>
                {days.map((day) => {
                  const today = isToday(day);
                  const dayName = format(day, "EEEEEE", { locale: ru });
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const isYearView = baseMode === "year";

                  return (
                    <th
                      key={day.toISOString()}
                      className={`text-center font-medium border-b border-border/30 ${
                        isYearView ? "px-0 py-1 min-w-[14px]" : "px-0.5 py-2 min-w-[32px]"
                      } ${
                        today ? "text-primary" : isWeekend ? "text-muted-foreground/30" : "text-muted-foreground/60"
                      }`}
                      title={format(day, "d MMMM, EEEE", { locale: ru })}
                    >
                      {isYearView ? (
                        <span className={`text-[6px] ${today ? "font-bold text-primary" : ""}`}>
                          {day.getDate() === 1 ? format(day, "LLL", { locale: ru }).charAt(0).toUpperCase() : ""}
                        </span>
                      ) : (
                        <div className="flex flex-col items-center leading-tight">
                          <span className="text-[9px] capitalize">{dayName}</span>
                          <span className={`text-[11px] ${today ? "font-bold bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center mx-auto" : ""}`}>
                            {format(day, "d")}
                          </span>
                        </div>
                      )}
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

                    {/* Day cells — green check / red X / empty / faint (unscheduled) */}
                    {days.map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const key = `${goal.id}__${dateStr}`;
                      const task = taskMap.get(key);
                      const today = isToday(day);
                      const isPast = isBefore(day, new Date()) && !today;
                      const isDone = task?.is_done === true;
                      const goalStart = startOfDay(parseISO(goal.created_at));
                      const beforeGoal = isBefore(day, goalStart);
                      const scheduled = isScheduledDay(goal.id, day);

                      const isYearView = baseMode === "year";
                      const isExcel = showNotes && !isYearView;
                      return (
                        <td
                          key={dateStr}
                          className={`text-center ${isYearView ? "px-0 py-0.5" : "px-0.5 py-1.5"} ${today && !isExcel ? "bg-primary/3" : ""}`}
                          style={isExcel ? { verticalAlign: "top" } : undefined}
                        >
                          {beforeGoal ? (
                            <div className={`inline-flex items-center justify-center ${isYearView ? "h-3 w-3" : "h-7 w-7"}`} />
                          ) : isExcel ? (
                            /* ── Excel-style cell ── */
                            <button
                              onClick={() => toggleCell(goal.id, dateStr)}
                              className={`relative flex flex-col rounded-lg overflow-hidden transition-colors min-h-7 w-7 pt-3.5 pb-0.5 px-0.5 border ${
                                isDone
                                  ? "bg-emerald-500/10 border-emerald-500/25 hover:bg-emerald-500/15"
                                  : isPast && scheduled
                                    ? "bg-red-500/10 border-red-400/25 hover:bg-red-500/15"
                                    : "border-border/30 hover:bg-accent/20"
                              }`}
                              title={task?.completion_note || format(day, "d MMMM", { locale: ru })}
                            >
                              {/* Status icon — top right */}
                              <span className="absolute top-0.5 right-0.5">
                                {isDone ? (
                                  <Check className="h-3 w-3 text-emerald-500" strokeWidth={3} />
                                ) : isPast && scheduled ? (
                                  <X className="h-2.5 w-2.5 text-red-400" strokeWidth={2.5} />
                                ) : null}
                              </span>
                              {/* Note text — wraps downward within fixed cell width */}
                              {isDone && task?.completion_note && (
                                <span className="text-[8px] leading-tight text-left break-all text-emerald-700 dark:text-emerald-300/80 w-full">
                                  {task.completion_note}
                                </span>
                              )}
                            </button>
                          ) : (
                            /* ── Compact cell (original) ── */
                            <button
                              onClick={() => toggleCell(goal.id, dateStr)}
                              className={`relative inline-flex items-center justify-center transition-all ${
                                isYearView ? "h-3.5 w-3.5 rounded-sm" : "h-7 w-7 rounded-lg hover:scale-110"
                              }`}
                              aria-label={`${goal.title} — ${format(day, "d MMM", { locale: ru })}${isDone ? " (выполнено)" : ""}`}
                              title={format(day, "d MMMM", { locale: ru })}
                            >
                              {isDone ? (
                                isYearView ? (
                                  <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                                ) : (
                                  <div className="h-5 w-5 rounded-md bg-emerald-500/15 flex items-center justify-center">
                                    <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={3} />
                                  </div>
                                )
                              ) : isPast && scheduled ? (
                                isYearView ? (
                                  <div className="h-2.5 w-2.5 rounded-sm bg-red-400/40" />
                                ) : (
                                  <div className="h-5 w-5 rounded-md bg-red-500/10 flex items-center justify-center">
                                    <X className="h-3 w-3 text-red-400/70" strokeWidth={2.5} />
                                  </div>
                                )
                              ) : !scheduled ? (
                                isYearView ? (
                                  <div className="h-2.5 w-2.5 rounded-sm border border-dashed border-border/15" />
                                ) : (
                                  <div className="h-5 w-5 rounded-md border border-dashed border-border/20 bg-muted/10" />
                                )
                              ) : (
                                isYearView ? (
                                  <div className="h-2.5 w-2.5 rounded-sm border border-border/40 bg-muted/20" />
                                ) : (
                                  <div className="h-5 w-5 rounded-md border-2 border-border/50 bg-muted/30" />
                                )
                              )}
                            </button>
                          )}
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

      {/* Charts */}
      {!loading && catStats.length > 0 && (
        <div className="mt-6">
          {/* Chart type switcher */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground">Прогресс по категориям</h2>
            <div className="flex rounded-xl border border-border/50 overflow-hidden text-xs">
              {CHART_TYPES.map((ct) => (
                <button
                  key={ct.id}
                  onClick={() => setChartType(ct.id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${
                    chartType === ct.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent/50"
                  }`}
                >
                  <ct.icon className="h-3 w-3" />
                  <span className="hidden sm:inline">{ct.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/30 bg-card p-4 md:p-6">
            {chartType === "radar" && <RadarChart stats={catStats} />}
            {chartType === "donut" && <DonutChart stats={catStats} />}
            {chartType === "histogram" && <HistogramChart stats={catStats} />}
          </div>
        </div>
      )}

      {/* Note popover */}
      {notePopover && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => { saveNote(notePopover.taskId, notePopover.note); setNotePopover(null); }}
        >
          <div
            className="bg-card border border-border/50 rounded-2xl p-5 w-80 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold mb-0.5 truncate">{notePopover.goalTitle}</div>
            <div className="text-xs text-muted-foreground mb-3">{notePopover.dateLabel}</div>
            <textarea
              autoFocus
              value={notePopover.note}
              onChange={(e) => setNotePopover((prev) => prev ? { ...prev, note: e.target.value } : null)}
              placeholder="Что сделал? Где остановился?..."
              className="w-full h-24 resize-none text-sm bg-input/50 border border-border/50 rounded-xl p-3 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
              onKeyDown={(e) => {
                if (e.key === "Escape") { saveNote(notePopover.taskId, notePopover.note); setNotePopover(null); }
                if (e.key === "Enter" && e.metaKey) { saveNote(notePopover.taskId, notePopover.note); setNotePopover(null); }
              }}
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { saveNote(notePopover.taskId, notePopover.note); setNotePopover(null); }}
                className="flex-1 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/15 transition-colors"
              >
                Сохранить
              </button>
              {notePopover.note && (
                <button
                  onClick={() => { saveNote(notePopover.taskId, ""); setNotePopover(null); }}
                  className="px-3 py-2 rounded-xl text-red-400/70 text-sm hover:bg-red-500/10 transition-colors"
                  title="Удалить заметку"
                >
                  ✕
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/40 text-center mt-2">Esc или ⌘Enter — сохранить</p>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Radar Chart (SVG) ──
function RadarChart({ stats }: { stats: CatStat[] }) {
  const n = stats.length;
  if (n < 3) return <p className="text-xs text-muted-foreground text-center py-8">Нужно минимум 3 категории</p>;

  const cx = 210, cy = 195, r = 100;
  const angleStep = (2 * Math.PI) / n;

  function polarToXY(angle: number, radius: number) {
    return {
      x: cx + radius * Math.cos(angle - Math.PI / 2),
      y: cy + radius * Math.sin(angle - Math.PI / 2),
    };
  }

  const gridLevels = [0.25, 0.5, 0.75, 1];
  const dataPoints = stats.map((s, i) => polarToXY(i * angleStep, (s.pct / 100) * r));
  const polygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 420 420" className="w-full max-w-[400px] h-auto">
        {/* Grid */}
        {gridLevels.map((lvl) => (
          <polygon
            key={lvl}
            points={stats.map((_, i) => {
              const p = polarToXY(i * angleStep, lvl * r);
              return `${p.x},${p.y}`;
            }).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.08}
            strokeWidth={1}
          />
        ))}
        {/* Axes */}
        {stats.map((_, i) => {
          const end = polarToXY(i * angleStep, r);
          return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="currentColor" strokeOpacity={0.06} />;
        })}
        {/* Data polygon */}
        <polygon points={polygon} fill="oklch(0.65 0.25 270 / 0.15)" stroke="oklch(0.65 0.25 270)" strokeWidth={2} />
        {/* Data dots */}
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill={stats[i].color} stroke="white" strokeWidth={2} />
        ))}
        {/* Labels — name lines + percent inside each petal direction */}
        {stats.map((s, i) => {
          const labelPos = polarToXY(i * angleStep, r + 35);
          // Split name by " / " or " " to show on separate lines
          const parts = s.name.includes("/")
            ? s.name.split(/\s*\/\s*/)
            : s.name.length > 8
              ? s.name.split(/\s+/)
              : [s.name];
          const lineH = 13;
          const totalH = (parts.length + 1) * lineH; // +1 for percent
          const startY = labelPos.y - totalH / 2 + lineH / 2;
          return (
            <g key={i}>
              {parts.map((part, pi) => (
                <text
                  key={pi}
                  x={labelPos.x}
                  y={startY + pi * lineH}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-current"
                  fontSize={10}
                  fontWeight="600"
                >
                  {part}
                </text>
              ))}
              <text
                x={labelPos.x}
                y={startY + parts.length * lineH}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fontWeight="700"
                fill={s.color}
              >
                {s.pct}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Donut Chart (SVG) ──
function DonutChart({ stats }: { stats: CatStat[] }) {
  const total = stats.reduce((sum, s) => sum + s.done, 0);
  if (total === 0) return <p className="text-xs text-muted-foreground text-center py-8">Нет данных за период</p>;

  const cx = 200, cy = 160, outerR = 80, innerR = 50, labelR = 115;
  let currentAngle = -Math.PI / 2;

  const slices = stats.filter((s) => s.done > 0).map((s) => {
    const angle = (s.done / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    const midAngle = startAngle + angle / 2;
    currentAngle = endAngle;

    const largeArc = angle > Math.PI ? 1 : 0;
    const x1o = cx + outerR * Math.cos(startAngle);
    const y1o = cy + outerR * Math.sin(startAngle);
    const x2o = cx + outerR * Math.cos(endAngle);
    const y2o = cy + outerR * Math.sin(endAngle);
    const x1i = cx + innerR * Math.cos(endAngle);
    const y1i = cy + innerR * Math.sin(endAngle);
    const x2i = cx + innerR * Math.cos(startAngle);
    const y2i = cy + innerR * Math.sin(startAngle);

    const d = `M ${x1o} ${y1o} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i} ${y2i} Z`;

    // Label position outside the ring
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);
    const anchor: "start" | "end" | "middle" = lx > cx + 5 ? "start" : lx < cx - 5 ? "end" : "middle";

    return { ...s, d, lx, ly, anchor, midAngle };
  });

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 400 320" className="w-full max-w-[400px] h-auto">
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} opacity={0.85} stroke="var(--card)" strokeWidth={2} />
        ))}
        {/* Labels around the ring */}
        {slices.map((s, i) => {
          const parts = s.name.includes("/")
            ? s.name.split(/\s*\/\s*/)
            : s.name.length > 8
              ? s.name.split(/\s+/)
              : [s.name];
          const lineH = 11;
          const totalH = (parts.length + 1) * lineH;
          const startY = s.ly - totalH / 2 + lineH / 2;
          return (
            <g key={`label-${i}`}>
              {parts.map((part, pi) => (
                <text
                  key={pi}
                  x={s.lx}
                  y={startY + pi * lineH}
                  textAnchor={s.anchor}
                  dominantBaseline="central"
                  className="fill-current"
                  fontSize={9}
                  fontWeight="600"
                >
                  {part}
                </text>
              ))}
              <text
                x={s.lx}
                y={startY + parts.length * lineH}
                textAnchor={s.anchor}
                dominantBaseline="central"
                fontSize={9}
                fill={s.color}
                fontWeight="600"
              >
                {s.done}/{s.total}
              </text>
            </g>
          );
        })}
        {/* Center text */}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-current" fontSize={20} fontWeight="bold">
          {total}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="fill-current text-muted-foreground" fontSize={9}>
          выполнено
        </text>
      </svg>
    </div>
  );
}

// ── Histogram Chart (SVG) ──
function HistogramChart({ stats }: { stats: CatStat[] }) {
  const maxPct = Math.max(...stats.map((s) => s.pct), 1);
  const barW = Math.min(40, Math.max(20, 280 / stats.length));
  const gap = 8;
  const chartW = stats.length * (barW + gap) - gap;
  const chartH = 160;
  const padTop = 20;
  const padBottom = 60;
  const svgW = chartW + 20;
  const svgH = chartH + padTop + padBottom;

  return (
    <div className="flex flex-col items-center overflow-x-auto w-full">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-w-[400px] h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((v) => {
          const y = padTop + chartH - (v / 100) * chartH;
          return (
            <g key={v}>
              <line x1={0} y1={y} x2={svgW} y2={y} stroke="currentColor" strokeOpacity={0.06} />
              <text x={svgW - 2} y={y - 3} textAnchor="end" className="fill-current text-muted-foreground" fontSize={8}>
                {v}%
              </text>
            </g>
          );
        })}
        {/* Bars */}
        {stats.map((s, i) => {
          const barH = (s.pct / 100) * chartH;
          const x = 10 + i * (barW + gap);
          const y = padTop + chartH - barH;
          return (
            <g key={s.name}>
              <rect x={x} y={y} width={barW} height={barH} rx={4} fill={s.color} opacity={0.8} />
              {/* Percent on top */}
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" className="fill-current" fontSize={10} fontWeight="600">
                {s.pct}%
              </text>
              {/* Label below — multi-line */}
              {(() => {
                const parts = s.name.includes("/")
                  ? s.name.split(/\s*\/\s*/)
                  : s.name.length > 6
                    ? s.name.split(/\s+/)
                    : [s.name];
                return parts.map((part, pi) => (
                  <text
                    key={pi}
                    x={x + barW / 2}
                    y={padTop + chartH + 12 + pi * 11}
                    textAnchor="middle"
                    className="fill-current text-muted-foreground"
                    fontSize={9}
                  >
                    {part}
                  </text>
                ));
              })()}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
