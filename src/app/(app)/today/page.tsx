"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  Check,
  Flame,
  Target,
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
import { useTheme } from "next-themes";
import Image from "next/image";
import type { Goal, Category, Task } from "@/lib/supabase/types";

// Category icon → PNG file mapping (light = gold, dark = purple/blue)
const CATEGORY_ICONS: Record<string, { light: string; dark: string }> = {
  "heart-pulse": { light: "/cat-icons/health-light.png", dark: "/cat-icons/health-dark.png" },
  home: { light: "/cat-icons/home-light.png", dark: "/cat-icons/home-dark.png" },
  "trending-up": { light: "/cat-icons/invest-light.png", dark: "/cat-icons/invest-dark.png" },
  briefcase: { light: "/cat-icons/work-light.png", dark: "/cat-icons/work-dark.png" },
  users: { light: "/cat-icons/family-light.png", dark: "/cat-icons/family-dark.png" },
  "message-circle": { light: "/cat-icons/friends-light.png", dark: "/cat-icons/friends-dark.png" },
  smile: { light: "/cat-icons/rest-light.png", dark: "/cat-icons/rest-dark.png" },
  "graduation-cap": { light: "/cat-icons/education-light.png", dark: "/cat-icons/education-dark.png" },
  moon: { light: "/cat-icons/islam-light.png", dark: "/cat-icons/islam-dark.png" },
  palette: { light: "/cat-icons/creativity-light.png", dark: "/cat-icons/creativity-dark.png" },
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
  const { resolvedTheme } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [goalDialogCatId, setGoalDialogCatId] = useState<string | null>(null);
  const isDark = resolvedTheme === "dark";

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
              const iconPaths = CATEGORY_ICONS[cat.icon || ""];
              const iconSrc = iconPaths
                ? (isDark ? iconPaths.dark : iconPaths.light)
                : null;
              const desc = CATEGORY_DESC[cat.icon || ""] || "";
              const goalsCount = catGoals.length;

              return (
                <motion.button
                  key={cat.id}
                  variants={item}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => openAddGoal(cat.id)}
                  className="relative rounded-3xl border border-border/40 bg-card p-5 flex flex-col items-start text-left gap-3 hover:shadow-lg hover:border-border/60 transition-all min-h-[160px]"
                  aria-label={`${cat.name} — ${percent}%`}
                >
                  {/* Icon + Percent row */}
                  <div className="flex items-center justify-between w-full">
                    {iconSrc ? (
                      <div className="h-14 w-14 rounded-2xl overflow-hidden">
                        <Image
                          src={iconSrc}
                          alt={cat.name}
                          width={56}
                          height={56}
                          className="object-contain"
                        />
                      </div>
                    ) : (
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
                        style={{ backgroundColor: `${cat.color}15` }}
                      >
                        {cat.name.charAt(0)}
                      </div>
                    )}
                    <span
                      className="text-xl font-bold tabular-nums"
                      style={{ color: cat.color || "var(--primary)" }}
                    >
                      {percent}%
                    </span>
                  </div>

                  {/* Name + Description */}
                  <div className="space-y-1">
                    <span className="text-base font-semibold leading-snug line-clamp-1 block">
                      {cat.name}
                    </span>
                    <span className="text-sm text-muted-foreground leading-snug line-clamp-1 block">
                      {desc}
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
                </motion.button>
              );
            })}

            {/* Add category placeholder */}
            <motion.div
              variants={item}
              className="rounded-2xl border-2 border-dashed border-border/30 flex flex-col items-center justify-center gap-2 text-muted-foreground/40 hover:border-primary/40 hover:text-primary/60 transition-all cursor-pointer min-h-[140px]"
            >
              <Plus className="h-7 w-7" />
              <span className="text-xs font-medium">Добавить категорию</span>
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
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
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
      <DialogContent className="sm:max-w-lg bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-3">
            {cat && (() => {
              const iconP = CATEGORY_ICONS[cat.icon || ""];
              return iconP ? (
                <Image src={isDark ? iconP.dark : iconP.light} alt={cat.name} width={40} height={40} className="rounded-xl" />
              ) : (
                <div className="h-10 w-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: `${cat.color}15` }}>
                  {cat.name.charAt(0)}
                </div>
              );
            })()}
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
            const percent = target > 0 ? Math.min(Math.round((done / target) * 100), 100) : 0;

            return (
              <div key={goal.id} className="rounded-xl border border-border/30 p-4">
                {isHabit ? (
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
              <div className="flex gap-2">
                {["7", "14", "30", "60", "90"].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setTargetDays(d)}
                    className={`flex-1 py-2.5 text-sm rounded-xl border transition-all ${
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

