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
  subDays,
  isToday,
  isSameMonth,
  isSameDay,
  startOfDay,
} from "date-fns";
import { ru } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Flame,
  Trophy,
  TrendingUp,
  Check,
  X,
  Camera,
  BookOpen,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Task, Category, Note, Photo } from "@/lib/supabase/types";

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
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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
    setSelectedDate(day);
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

      {/* Dashboard Stats */}
      {!loading && tasks.length > 0 && (
        <>
          <StreakStats tasks={tasks} />
          <CategoryBreakdown tasks={tasks} categories={categories} monthStart={monthStart} monthEnd={monthEnd} />
        </>
      )}

      {/* Day detail dialog */}
      <DayDetailDialog
        date={selectedDate}
        onClose={() => setSelectedDate(null)}
        tasks={tasks}
        categories={categories}
      />
    </div>
  );
}

// ── Day Detail Dialog — Full daily report ──
function DayDetailDialog({
  date,
  onClose,
  tasks,
  categories,
}: {
  date: Date | null;
  onClose: () => void;
  tasks: Task[];
  categories: Category[];
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(false);

  useEffect(() => {
    if (!date) return;
    const dateStr = format(date, "yyyy-MM-dd");
    setLoadingExtra(true);

    const supabase = createClient();
    Promise.all([
      supabase.from("notes").select("*").eq("note_date", dateStr).order("created_at", { ascending: false }),
      supabase.from("photos").select("*").eq("photo_date", dateStr).order("created_at", { ascending: false }),
    ]).then(([notesRes, photosRes]) => {
      if (notesRes.data) setNotes(notesRes.data);
      if (photosRes.data) setPhotos(photosRes.data);
      setLoadingExtra(false);
    });
  }, [date]);

  if (!date) return null;

  const dateStr = format(date, "yyyy-MM-dd");
  const dayTasks = tasks.filter((t) => t.scheduled_date === dateStr);
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const doneTasks = dayTasks.filter((t) => t.is_done);
  const pendingTasks = dayTasks.filter((t) => !t.is_done);

  function getPhotoUrl(path: string) {
    const supabase = createClient();
    const { data } = supabase.storage.from("photos").getPublicUrl(path);
    return data.publicUrl;
  }

  const hasContent = dayTasks.length > 0 || notes.length > 0 || photos.length > 0;

  return (
    <Dialog open={!!date} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {format(date, "d MMMM, EEEE", { locale: ru })}
          </DialogTitle>
        </DialogHeader>

        {!hasContent && !loadingExtra ? (
          <div className="py-8 text-center">
            <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/20 mb-2" />
            <p className="text-sm text-muted-foreground/50">Нет записей за этот день</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Tasks summary */}
            {dayTasks.length > 0 && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-emerald-500 font-medium">
                  ✓ {doneTasks.length} выполнено
                </span>
                {pendingTasks.length > 0 && (
                  <span className="text-muted-foreground">
                    ○ {pendingTasks.length} не выполнено
                  </span>
                )}
              </div>
            )}

            {/* Done tasks */}
            {doneTasks.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Выполнено</h4>
                <div className="space-y-1.5">
                  {doneTasks.map((task) => {
                    const cat = task.category_id ? catMap.get(task.category_id) : null;
                    return (
                      <div key={task.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/5">
                        <div className="h-5 w-5 rounded-md bg-emerald-500/15 flex items-center justify-center shrink-0">
                          <Check className="h-3 w-3 text-emerald-500" strokeWidth={3} />
                        </div>
                        <span className="text-sm flex-1 truncate">{task.title}</span>
                        {cat && (
                          <span className="text-xs text-muted-foreground/50 shrink-0">
                            {getEmoji(cat)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pending tasks */}
            {pendingTasks.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Не выполнено</h4>
                <div className="space-y-1.5">
                  {pendingTasks.map((task) => {
                    const cat = task.category_id ? catMap.get(task.category_id) : null;
                    return (
                      <div key={task.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/5">
                        <div className="h-5 w-5 rounded-md bg-red-500/10 flex items-center justify-center shrink-0">
                          <X className="h-3 w-3 text-red-400/70" strokeWidth={2.5} />
                        </div>
                        <span className="text-sm flex-1 truncate text-muted-foreground/70">{task.title}</span>
                        {cat && (
                          <span className="text-xs text-muted-foreground/50 shrink-0">
                            {getEmoji(cat)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notes */}
            {notes.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  Заметки ({notes.length})
                </h4>
                <div className="space-y-1.5">
                  {notes.map((note) => (
                    <div key={note.id} className="px-3 py-2 rounded-xl bg-blue-500/5 border border-blue-500/10">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed line-clamp-3">{note.content}</p>
                      <p className="text-[10px] text-muted-foreground/40 mt-1">
                        {format(new Date(note.created_at), "HH:mm")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Photos */}
            {photos.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5" />
                  Фото ({photos.length})
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((photo) => (
                    <div key={photo.id} className="aspect-square rounded-xl overflow-hidden bg-muted">
                      <img
                        src={getPhotoUrl(photo.storage_path)}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loadingExtra && (
              <div className="flex items-center justify-center py-4">
                <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
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

function StreakStats({ tasks }: { tasks: Task[] }) {
  // Calculate current streak: consecutive days (ending today or yesterday) where all tasks were completed
  const today = startOfDay(new Date());
  const tasksByDate = new Map<string, { total: number; done: number }>();

  for (const task of tasks) {
    if (!task.scheduled_date) continue;
    const existing = tasksByDate.get(task.scheduled_date) || { total: 0, done: 0 };
    existing.total++;
    if (task.is_done) existing.done++;
    tasksByDate.set(task.scheduled_date, existing);
  }

  let streak = 0;
  let checkDay = today;
  // Allow starting from today or yesterday
  const todayStr = format(today, "yyyy-MM-dd");
  const todayStats = tasksByDate.get(todayStr);
  if (!todayStats || todayStats.done < todayStats.total) {
    checkDay = subDays(today, 1);
  }

  for (let i = 0; i < 60; i++) {
    const dateStr = format(checkDay, "yyyy-MM-dd");
    const stats = tasksByDate.get(dateStr);
    if (stats && stats.total > 0 && stats.done === stats.total) {
      streak++;
      checkDay = subDays(checkDay, 1);
    } else if (stats && stats.total > 0) {
      break;
    } else {
      // No tasks that day — skip (don't break streak for empty days)
      checkDay = subDays(checkDay, 1);
    }
  }

  // Best day this month
  let bestDay = "";
  let bestPercent = 0;
  for (const [date, stats] of tasksByDate) {
    if (stats.total >= 2) {
      const pct = stats.done / stats.total;
      if (pct > bestPercent || (pct === bestPercent && stats.total > (tasksByDate.get(bestDay)?.total || 0))) {
        bestPercent = pct;
        bestDay = date;
      }
    }
  }

  // Total completed this month
  let totalDone = 0;
  for (const stats of tasksByDate.values()) {
    totalDone += stats.done;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mt-6 grid grid-cols-3 gap-3"
    >
      <div className="rounded-2xl border border-border/50 bg-card/80 p-3 text-center">
        <Flame className="h-5 w-5 mx-auto mb-1 text-orange-500" />
        <div className="text-2xl font-bold">{streak}</div>
        <div className="text-[10px] text-muted-foreground">
          {streak === 1 ? "день подряд" : streak >= 2 && streak <= 4 ? "дня подряд" : "дней подряд"}
        </div>
      </div>
      <div className="rounded-2xl border border-border/50 bg-card/80 p-3 text-center">
        <Trophy className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
        <div className="text-2xl font-bold">{totalDone}</div>
        <div className="text-[10px] text-muted-foreground">выполнено</div>
      </div>
      <div className="rounded-2xl border border-border/50 bg-card/80 p-3 text-center">
        <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-500" />
        <div className="text-2xl font-bold">
          {bestDay ? format(new Date(bestDay + "T00:00:00"), "d MMM", { locale: ru }) : "—"}
        </div>
        <div className="text-[10px] text-muted-foreground">лучший день</div>
      </div>
    </motion.div>
  );
}

function CategoryBreakdown({
  tasks,
  categories,
  monthStart,
  monthEnd,
}: {
  tasks: Task[];
  categories: Category[];
  monthStart: Date;
  monthEnd: Date;
}) {
  const startStr = format(monthStart, "yyyy-MM-dd");
  const endStr = format(monthEnd, "yyyy-MM-dd");

  const monthTasks = tasks.filter((t) => {
    if (!t.scheduled_date) return false;
    return t.scheduled_date >= startStr && t.scheduled_date <= endStr;
  });

  // Group by category
  const catStats = new Map<string, { total: number; done: number }>();
  for (const task of monthTasks) {
    const catId = task.category_id || "uncategorized";
    const existing = catStats.get(catId) || { total: 0, done: 0 };
    existing.total++;
    if (task.is_done) existing.done++;
    catStats.set(catId, existing);
  }

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const entries = Array.from(catStats.entries())
    .map(([catId, stats]) => ({
      category: catMap.get(catId),
      ...stats,
    }))
    .filter((e) => e.category)
    .sort((a, b) => b.total - a.total);

  if (entries.length === 0) return null;

  const maxTotal = Math.max(...entries.map((e) => e.total));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-4 rounded-2xl border border-border/50 bg-card/80 p-4"
    >
      <h3 className="text-xs font-medium text-muted-foreground mb-3">
        По категориям
      </h3>
      <div className="space-y-2.5">
        {entries.map(({ category: cat, total, done }) => {
          if (!cat) return null;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const barWidth = (total / maxTotal) * 100;

          return (
            <div key={cat.id}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-medium truncate flex-1">{cat.name}</span>
                <span className="text-[10px] text-muted-foreground ml-2">
                  {done}/{total} · {pct}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden" style={{ width: `${barWidth}%`, minWidth: "40px" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: cat.color || "#666" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5, delay: 0.05 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
