"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  Check,
  Flame,
  Target,
  Star,
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

// Category icon mapping → emoji fallback
const CATEGORY_EMOJI: Record<string, string> = {
  "heart-pulse": "\u2764\ufe0f",
  home: "\ud83c\udfe0",
  "trending-up": "\ud83d\udcb0",
  briefcase: "\ud83d\udcbc",
  users: "\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67",
  "message-circle": "\ud83d\udc65",
  smile: "\ud83c\udf34",
  "graduation-cap": "\ud83d\udcda",
  moon: "\ud83c\udd4c",
  palette: "\ud83c\udfa8",
};

// Short descriptions for categories
const CATEGORY_DESC: Record<string, string> = {
  "heart-pulse": "Физическое и ментальное",
  home: "Уют и порядок",
  "trending-up": "Деньги и инвестиции",
  briefcase: "Профессиональное развитие",
  users: "Отношения и поддержка",
  "message-circle": "Общение и окружение",
  smile: "Восстановление и баланс",
  "graduation-cap": "Знания и навыки",
  moon: "Духовный рост и практика",
  palette: "Творческая реализация",
};

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
        totalDone += prog?.done || 0;
        totalTarget += g.target_days || 0;
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

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24 md:pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Life OS</h1>
          <p className="text-xs text-muted-foreground">
            Твоя жизнь. Твои правила.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl"
          onClick={() => {
            setGoalDialogCatId(null);
            setGoalDialogOpen(true);
          }}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Grid of category cards */}
      {loading ? (
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-3 gap-3 mt-4"
          >
            {categories.map((cat) => {
              const catGoals = goalsByCategory.get(cat.id) || [];
              const percent = getCategoryPercent(cat.id);
              const emoji = CATEGORY_EMOJI[cat.icon || ""] || "\ud83d\udccc";
              const desc = CATEGORY_DESC[cat.icon || ""] || "";

              return (
                <motion.button
                  key={cat.id}
                  variants={item}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => openAddGoal(cat.id)}
                  className="relative aspect-square rounded-2xl border border-border/30 bg-card p-3 flex flex-col items-center justify-center text-center gap-1.5 hover:shadow-md transition-shadow group"
                >
                  {/* Icon */}
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-xl"
                    style={{ backgroundColor: `${cat.color}15` }}
                  >
                    {emoji}
                  </div>

                  {/* Name */}
                  <span className="text-xs font-semibold leading-tight line-clamp-1">
                    {cat.name}
                  </span>

                  {/* Description */}
                  <span className="text-[9px] text-muted-foreground/60 leading-tight line-clamp-2 px-1">
                    {desc}
                  </span>

                  {/* Progress stars */}
                  <div className="flex gap-0.5 mt-0.5">
                    {[...Array(5)].map((_, i) => {
                      const filled = Math.round(percent / 20);
                      return (
                        <Star
                          key={i}
                          className="h-2.5 w-2.5"
                          fill={i < filled ? (cat.color || "#f59e0b") : "transparent"}
                          stroke={i < filled ? (cat.color || "#f59e0b") : "oklch(0.6 0 0)"}
                          strokeWidth={1.5}
                        />
                      );
                    })}
                  </div>

                  {/* Percentage badge */}
                  <span
                    className="absolute top-2 right-2 text-[10px] font-bold"
                    style={{ color: cat.color || "#6366f1" }}
                  >
                    {percent}%
                  </span>
                </motion.button>
              );
            })}

            {/* Add category placeholder */}
            <motion.div
              variants={item}
              className="aspect-square rounded-2xl border-2 border-dashed border-border/30 flex flex-col items-center justify-center gap-1 text-muted-foreground/30 hover:border-border/60 hover:text-muted-foreground/50 transition-colors cursor-pointer"
            >
              <Plus className="h-6 w-6" />
              <span className="text-[10px]">Добавить</span>
              <span className="text-[10px]">категорию</span>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Bottom motivational text */}
      {!loading && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-xs text-muted-foreground/40 mt-6 italic"
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
  const [saving, setSaving] = useState(false);

  const cat = categories.find((c) => c.id === categoryId);
  const catGoals = categoryId ? (goalsByCategory.get(categoryId) || []) : [];

  useEffect(() => {
    if (open) {
      setAddMode(false);
      setTitle("");
      setTrackingType("habit");
      setTargetDays("30");
    }
  }, [open]);

  async function handleAddGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !categoryId) return;
    setSaving(true);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    await supabase.from("goals").insert({
      user_id: userData.user.id,
      category_id: categoryId,
      title: title.trim(),
      tracking_type: trackingType,
      target_days: trackingType === "habit" ? parseInt(targetDays) || 30 : null,
      level: "month",
      sort_order: 0,
    });

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
      <DialogContent className="sm:max-w-md bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            {cat && (
              <div
                className="h-6 w-6 rounded-lg flex items-center justify-center text-sm"
                style={{ backgroundColor: `${cat.color}15` }}
              >
                {CATEGORY_EMOJI[cat.icon || ""] || "\ud83d\udccc"}
              </div>
            )}
            <span style={{ color: cat?.color || undefined }}>{cat?.name || "Цели"}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Goals list */}
        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
          {catGoals.length === 0 && !addMode && (
            <p className="text-sm text-muted-foreground/40 text-center py-4">
              Нет целей. Добавьте первую!
            </p>
          )}
          {catGoals.map((goal) => {
            const isHabit = goal.tracking_type === "habit";
            const prog = goalProgress.get(goal.id);
            const done = prog?.done || 0;
            const target = isHabit ? (goal.target_days || 0) : 0;
            const percent = target > 0 ? Math.min(Math.round((done / target) * 100), 100) : 0;

            return (
              <div key={goal.id} className="rounded-xl border border-border/30 p-3">
                {isHabit ? (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium">{goal.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {done}/{target}{" "}
                        <span className="font-semibold" style={{ color: cat?.color || "#6366f1" }}>
                          {percent}%
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: cat?.color || "#6366f1" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => toggleMilestone(goal)}
                    className="flex items-center gap-2 w-full text-left"
                  >
                    <div
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all"
                      style={{
                        borderColor: goal.status === "completed" ? (cat?.color || "#22c55e") : "oklch(0.5 0 0)",
                        backgroundColor: goal.status === "completed" ? (cat?.color || "#22c55e") : "transparent",
                      }}
                    >
                      {goal.status === "completed" && <Check className="h-3 w-3 text-white" />}
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
          <form onSubmit={handleAddGoal} className="space-y-3 pt-2 border-t border-border/30">
            <Input
              placeholder="Название цели"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="bg-input/50 border-border/50"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTrackingType("habit")}
                className={`flex-1 py-2 rounded-xl text-xs border transition-all ${
                  trackingType === "habit"
                    ? "border-primary/50 bg-primary/10 text-primary font-medium"
                    : "border-border/30 text-muted-foreground"
                }`}
              >
                <Flame className="h-3.5 w-3.5 mx-auto mb-0.5" />
                Привычка
              </button>
              <button
                type="button"
                onClick={() => setTrackingType("milestone")}
                className={`flex-1 py-2 rounded-xl text-xs border transition-all ${
                  trackingType === "milestone"
                    ? "border-primary/50 bg-primary/10 text-primary font-medium"
                    : "border-border/30 text-muted-foreground"
                }`}
              >
                <Target className="h-3.5 w-3.5 mx-auto mb-0.5" />
                Веха
              </button>
            </div>
            {trackingType === "habit" && (
              <div className="flex gap-1.5">
                {["7", "14", "30", "60", "90"].map((d) => (
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
                    {d}д
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setAddMode(false)}>
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={saving || !title.trim()}
                className="flex-1 gradient-primary text-white border-0"
              >
                {saving ? "..." : "Создать"}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="outline"
            className="w-full rounded-xl border-dashed"
            onClick={() => setAddMode(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Добавить цель
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

const CATEGORY_EMOJI_EXPORT = CATEGORY_EMOJI;
