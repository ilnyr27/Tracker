"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  Check,
  Flame,
  Target,
  Trash2,
  Archive,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "motion/react";
import type { Goal, Category, Task } from "@/lib/supabase/types";

// Emoji choices for category picker
const EMOJI_OPTIONS = [
  "❤️", "🏠", "💰", "💼", "👨‍👩‍👧", "👥", "🌴", "📚",
  "🕌", "🎨", "🏋️", "🧘", "🎯", "🚀", "💡", "🎵",
  "🍎", "🌍", "✈️", "📝", "🔬", "🎮", "🐾", "☕",
  "🌟", "🧠", "💪", "🏆", "📸", "🎓", "🌱", "⚡",
];

// Fallback: old lucide icon names → emoji
const ICON_TO_EMOJI: Record<string, string> = {
  "heart-pulse": "❤️",
  home: "🏠",
  "trending-up": "💰",
  briefcase: "💼",
  users: "👨‍👩‍👧",
  "message-circle": "👥",
  smile: "🌴",
  "graduation-cap": "📚",
  moon: "🕌",
  palette: "🎨",
};

function getEmoji(cat: Category): string {
  if (!cat.icon) return cat.name.charAt(0);
  // If it's an old lucide icon name, convert
  if (ICON_TO_EMOJI[cat.icon]) return ICON_TO_EMOJI[cat.icon];
  // Otherwise it's already an emoji
  return cat.icon;
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1 },
};

export default function MainPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [goalDialogCatId, setGoalDialogCatId] = useState<string | null>(null);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#6366f1");
  const [newCatEmoji, setNewCatEmoji] = useState("🎯");
  const [savingCat, setSavingCat] = useState(false);

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
        .order("sort_order"),
      supabase
        .from("tasks")
        .select("*")
        .not("goal_id", "is", null),
    ]);

    if (catRes.data) setCategories(catRes.data);
    if (goalsRes.data) setGoals(goalsRes.data);
    if (tasksRes.data) setTasks(tasksRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build goal progress map: goal_id -> { done, total }
  const goalProgress = new Map<string, { done: number; total: number }>();
  for (const task of tasks) {
    if (!task.goal_id) continue;
    const existing = goalProgress.get(task.goal_id) || { done: 0, total: 0 };
    existing.total++;
    if (task.is_done) existing.done++;
    goalProgress.set(task.goal_id, existing);
  }

  // Group goals by category
  const goalsByCategory = new Map<string, Goal[]>();
  for (const goal of goals) {
    const catId = goal.category_id || "none";
    if (!goalsByCategory.has(catId)) goalsByCategory.set(catId, []);
    goalsByCategory.get(catId)!.push(goal);
  }

  // Calculate category progress %
  function getCategoryPercent(catId: string): number {
    const catGoals = goalsByCategory.get(catId) || [];
    if (catGoals.length === 0) return 0;
    let totalDone = 0;
    let totalTarget = 0;
    for (const g of catGoals) {
      if (g.tracking_type === "habit") {
        const prog = goalProgress.get(g.id);
        const target = g.target_days || 0;
        if (target >= 99999) {
          // Infinite habits: count as 1 target, done if any progress
          totalTarget++;
          if ((prog?.done || 0) > 0) totalDone++;
        } else {
          totalDone += prog?.done || 0;
          totalTarget += target;
        }
      } else {
        totalTarget++;
        if (g.status === "completed") totalDone++;
      }
    }
    return totalTarget > 0 ? Math.round((totalDone / totalTarget) * 100) : 0;
  }

  function openAddGoal(categoryId: string) {
    setGoalDialogCatId(categoryId);
    setGoalDialogOpen(true);
  }

  async function archiveCategory(id: string) {
    const supabase = createClient();
    setCategories((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("categories").update({ is_active: false }).eq("id", id);
  }

  async function deleteCategory(id: string) {
    const supabase = createClient();
    setCategories((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("categories").delete().eq("id", id);
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setSavingCat(true);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    await supabase.from("categories").insert({
      user_id: userData.user.id,
      name: newCatName.trim(),
      icon: newCatEmoji,
      color: newCatColor,
      sort_order: categories.length,
      is_active: true,
    });

    setSavingCat(false);
    setAddCatOpen(false);
    setNewCatName("");
    setNewCatEmoji("🎯");
    loadData();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-28 md:px-6 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold gradient-text tracking-tight">Life OS</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Твоя жизнь. Твои правила.
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-2xl border-border/50"
          onClick={() => {
            setGoalDialogCatId(null);
            setGoalDialogOpen(true);
          }}
          aria-label="Добавить цель"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Grid of category cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {categories.map((cat) => {
              const catGoals = goalsByCategory.get(cat.id) || [];
              const percent = getCategoryPercent(cat.id);
              const emoji = getEmoji(cat);
              const goalsCount = catGoals.length;

              return (
                <motion.div
                  key={cat.id}
                  variants={item}
                  className="relative rounded-3xl border border-border/40 bg-card p-5 flex flex-col items-start text-left gap-3 hover:shadow-lg hover:border-border/60 transition-all min-h-[160px] group"
                >
                  {/* Context menu */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); archiveCategory(cat.id); }}
                      className="p-1.5 rounded-lg hover:bg-accent/60 text-muted-foreground/40 hover:text-amber-500 transition-all"
                      title="В архив"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id); }}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-all"
                      title="Удалить"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Clickable area */}
                  <button
                    onClick={() => openAddGoal(cat.id)}
                    className="flex flex-col items-start text-left gap-3 w-full flex-1"
                  >
                    {/* Emoji + Percent row */}
                    <div className="flex items-center justify-between w-full">
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl"
                        style={{ backgroundColor: `${cat.color || "var(--primary)"}15` }}
                      >
                        {emoji}
                      </div>
                      <span
                        className="text-xl font-bold tabular-nums"
                        style={{ color: cat.color || "var(--primary)" }}
                      >
                        {percent}%
                      </span>
                    </div>

                    {/* Name */}
                    <div className="space-y-1">
                      <span className="text-base font-semibold leading-snug line-clamp-1 block">
                        {cat.name}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full mt-auto">
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: cat.color || "var(--primary)" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground/60 mt-1.5 block">
                        {goalsCount} {goalsCount === 1 ? "цель" : goalsCount < 5 ? "цели" : "целей"}
                      </span>
                    </div>
                  </button>
                </motion.div>
              );
            })}

            {/* Add category placeholder */}
            <motion.button
              variants={item}
              onClick={() => setAddCatOpen(true)}
              className="rounded-2xl border-2 border-dashed border-border/30 flex flex-col items-center justify-center gap-2 text-muted-foreground/40 hover:border-primary/40 hover:text-primary/60 transition-all cursor-pointer min-h-[140px]"
            >
              <Plus className="h-7 w-7" />
              <span className="text-xs font-medium">Добавить категорию</span>
            </motion.button>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Bottom motivational text */}
      {!loading && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-sm text-muted-foreground/40 mt-8 italic"
        >
          Баланс — это прогресс. Работай над собой каждый день.
        </motion.p>
      )}

      {/* Category detail sheet — goals list */}
      <CategoryGoalsDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        categoryId={goalDialogCatId}
        categories={categories}
        goals={goals}
        goalProgress={goalProgress}
        goalsByCategory={goalsByCategory}
        onDataChanged={loadData}
      />

      {/* Add category dialog */}
      <Dialog open={addCatOpen} onOpenChange={setAddCatOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg">Новая категория</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCategory} className="space-y-4">
            <Input
              placeholder="Название категории"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              required
              autoFocus
              className="h-12 bg-input/50 border-border/50 text-base"
            />
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Иконка</label>
              <div className="grid grid-cols-8 gap-1.5 max-h-[160px] overflow-y-auto">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setNewCatEmoji(e)}
                    className={`h-10 w-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                      newCatEmoji === e
                        ? "bg-primary/15 ring-2 ring-primary/40 scale-110"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Цвет</label>
              <div className="flex gap-3 flex-wrap">
                {["#6366f1", "#3b82f6", "#14b8a6", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewCatColor(c)}
                    className="h-9 w-9 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: c,
                      borderColor: newCatColor === c ? c : "transparent",
                      boxShadow: newCatColor === c ? `0 0 0 3px ${c}33` : "none",
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="ghost" className="flex-1 h-11" onClick={() => setAddCatOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={savingCat || !newCatName.trim()} className="flex-1 h-11 gradient-primary text-white border-0">
                {savingCat ? "..." : "Создать"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Category Goals Dialog (tap on a card → see goals + add) ---

function CategoryGoalsDialog({
  open,
  onOpenChange,
  categoryId,
  categories,
  goals,
  goalProgress,
  goalsByCategory,
  onDataChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string | null;
  categories: Category[];
  goals: Goal[];
  goalProgress: Map<string, { done: number; total: number }>;
  goalsByCategory: Map<string, Goal[]>;
  onDataChanged: () => void;
}) {
  const [addMode, setAddMode] = useState(false);
  const [title, setTitle] = useState("");
  const [trackingType, setTrackingType] = useState<"habit" | "milestone">("habit");
  const [targetDays, setTargetDays] = useState("30");
  const [recurrenceMode, setRecurrenceMode] = useState<"daily" | "weekly">("daily");
  const [weekDays, setWeekDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const cat = categories.find((c) => c.id === categoryId);
  const catGoals = categoryId ? (goalsByCategory.get(categoryId) || []) : [];

  useEffect(() => {
    if (open) {
      setAddMode(false);
      setTitle("");
      setTrackingType("habit");
      setTargetDays("30");
      setRecurrenceMode("daily");
      setWeekDays([]);
    }
  }, [open]);

  async function handleAddGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !categoryId) return;
    setSaving(true);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: goalData } = await supabase.from("goals").insert({
      user_id: userData.user.id,
      category_id: categoryId,
      title: title.trim(),
      tracking_type: trackingType,
      target_days: trackingType === "habit" ? (targetDays === "∞" ? 99999 : parseInt(targetDays) || 30) : null,
      level: "month",
      sort_order: 0,
    }).select().single();

    // If weekly recurrence, also create a task template
    if (trackingType === "habit" && recurrenceMode === "weekly" && weekDays.length > 0 && goalData) {
      await supabase.from("task_templates").insert({
        user_id: userData.user.id,
        goal_id: goalData.id,
        category_id: categoryId,
        title: title.trim(),
        recurrence: "weekly",
        recurrence_days: weekDays,
        sort_order: 0,
      });
    }

    setSaving(false);
    setAddMode(false);
    setTitle("");
    onDataChanged();
  }

  async function toggleMilestone(goal: Goal) {
    const supabase = createClient();
    const newStatus = goal.status === "completed" ? "active" : "completed";
    await supabase
      .from("goals")
      .update({
        status: newStatus,
        completed_at: newStatus === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", goal.id);
    onDataChanged();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-3">
            {cat && (
              <div className="h-10 w-10 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${cat.color || "var(--primary)"}15` }}>
                {getEmoji(cat)}
              </div>
            )}
            <span style={{ color: cat?.color || undefined }}>{cat?.name || "Цели"}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Goals list */}
        <div className="space-y-3 max-h-[50vh] overflow-y-auto py-1">
          {catGoals.length === 0 && !addMode && (
            <p className="text-sm text-muted-foreground/50 text-center py-8">
              Нет целей. Добавьте первую!
            </p>
          )}
          {catGoals.map((goal) => {
            const isHabit = goal.tracking_type === "habit";
            const prog = goalProgress.get(goal.id);
            const done = prog?.done || 0;
            const target = isHabit ? (goal.target_days || 0) : 0;
            const isInfinite = target >= 99999;
            const percent = isInfinite ? 0 : (target > 0 ? Math.min(Math.round((done / target) * 100), 100) : 0);

            return (
              <div key={goal.id} className="rounded-xl border border-border/30 p-4">
                {isHabit ? (
                  isInfinite ? (
                    /* Infinite habit — show count + flame instead of progress bar */
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{goal.title}</span>
                        <div className="flex items-center gap-1.5">
                          <Flame className="h-4 w-4 text-orange-500" />
                          <span className="text-lg font-bold tabular-nums" style={{ color: cat?.color || "var(--primary)" }}>
                            {done}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {done === 1 ? "день" : done >= 2 && done <= 4 ? "дня" : "дней"}
                          </span>
                        </div>
                      </div>
                      {/* Infinite progress — animated dots */}
                      <div className="flex items-center gap-1 mt-2">
                        {Array.from({ length: Math.min(done, 30) }).map((_, i) => (
                          <div
                            key={i}
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor: cat?.color || "var(--primary)",
                              opacity: 0.4 + (i / Math.min(done, 30)) * 0.6,
                            }}
                          />
                        ))}
                        {done > 30 && (
                          <span className="text-xs text-muted-foreground ml-1">+{done - 30}</span>
                        )}
                        {done === 0 && (
                          <span className="text-xs text-muted-foreground/40">Начни сегодня!</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Regular habit with target */
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{goal.title}</span>
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {done}/{target}{" "}
                          <span className="font-semibold" style={{ color: cat?.color || "var(--primary)" }}>
                            {percent}%
                          </span>
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: cat?.color || "var(--primary)" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ duration: 0.6 }}
                        />
                      </div>
                    </div>
                  )
                ) : (
                  <button
                    onClick={() => toggleMilestone(goal)}
                    className="flex items-center gap-3 w-full text-left min-h-[44px]"
                  >
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all"
                      style={{
                        borderColor: goal.status === "completed" ? (cat?.color || "#22c55e") : "oklch(0.5 0 0)",
                        backgroundColor: goal.status === "completed" ? (cat?.color || "#22c55e") : "transparent",
                      }}
                    >
                      {goal.status === "completed" && <Check className="h-3.5 w-3.5 text-white" />}
                    </div>
                    <span className={`text-sm ${goal.status === "completed" ? "line-through text-muted-foreground/50" : ""}`}>
                      {goal.title}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Add goal form */}
        {addMode ? (
          <form onSubmit={handleAddGoal} className="space-y-4 pt-4 border-t border-border/30">
            <Input
              placeholder="Название цели"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="h-12 bg-input/50 border-border/50 text-base"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTrackingType("habit")}
                className={`flex-1 py-3 rounded-xl text-sm border transition-all ${
                  trackingType === "habit"
                    ? "border-primary/50 bg-primary/10 text-primary font-medium"
                    : "border-border/30 text-muted-foreground"
                }`}
              >
                <Flame className="h-4 w-4 mx-auto mb-1" />
                Привычка
              </button>
              <button
                type="button"
                onClick={() => setTrackingType("milestone")}
                className={`flex-1 py-3 rounded-xl text-sm border transition-all ${
                  trackingType === "milestone"
                    ? "border-primary/50 bg-primary/10 text-primary font-medium"
                    : "border-border/30 text-muted-foreground"
                }`}
              >
                <Target className="h-4 w-4 mx-auto mb-1" />
                Веха
              </button>
            </div>
            {trackingType === "habit" && (
              <div className="space-y-3">
                {/* Recurrence mode toggle */}
                <div className="flex rounded-xl border border-border/50 overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setRecurrenceMode("daily")}
                    className={`flex-1 py-2 transition-colors ${
                      recurrenceMode === "daily" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent/50"
                    }`}
                  >
                    Каждый день
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecurrenceMode("weekly")}
                    className={`flex-1 py-2 transition-colors ${
                      recurrenceMode === "weekly" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent/50"
                    }`}
                  >
                    По дням недели
                  </button>
                </div>

                {/* Weekly day picker */}
                {recurrenceMode === "weekly" && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">В какие дни?</label>
                    <div className="flex gap-1.5">
                      {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((name, i) => {
                        const dayNum = i === 6 ? 0 : i + 1; // JS: 0=Sun, 1=Mon...
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setWeekDays((prev) => prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum])}
                            className={`flex-1 py-2 text-xs rounded-xl font-medium transition-all ${
                              weekDays.includes(dayNum)
                                ? "gradient-primary text-white"
                                : "bg-muted text-muted-foreground hover:bg-accent"
                            }`}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Target days (always shown) */}
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="365"
                    value={targetDays === "∞" ? "365" : targetDays}
                    onChange={(e) => setTargetDays(e.target.value)}
                    className="flex-1 h-2 rounded-full accent-primary cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min="1"
                      value={targetDays === "∞" ? "" : targetDays}
                      onChange={(e) => setTargetDays(e.target.value || "30")}
                      placeholder="∞"
                      className="w-16 h-9 text-center text-sm bg-input/50 border-border/50"
                    />
                    <span className="text-xs text-muted-foreground">дн</span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {["7", "14", "30", "90", "365"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setTargetDays(d)}
                      className={`flex-1 py-1.5 text-xs rounded-lg border transition-all ${
                        targetDays === d
                          ? "border-primary/50 bg-primary/10 text-primary font-medium"
                          : "border-border/30 text-muted-foreground"
                      }`}
                    >
                      {d === "365" ? "1 год" : `${d}д`}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTargetDays("∞")}
                    className={`flex-1 py-1.5 text-xs rounded-lg border transition-all ${
                      targetDays === "∞"
                        ? "border-primary/50 bg-primary/10 text-primary font-medium"
                        : "border-border/30 text-muted-foreground"
                    }`}
                  >
                    ∞
                  </button>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <Button type="button" variant="ghost" className="flex-1 h-11" onClick={() => setAddMode(false)}>
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={saving || !title.trim()}
                className="flex-1 h-11 gradient-primary text-white border-0"
              >
                {saving ? "..." : "Создать"}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl border-dashed text-sm"
            onClick={() => setAddMode(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Добавить цель
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

