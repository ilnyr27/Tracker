"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Map as MapIcon,
  Plus,
  Check,
  ChevronDown,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "motion/react";
import type { Goal, Category } from "@/lib/supabase/types";

type Level = Goal["level"];

const LEVEL_LABELS: Record<Level, string> = {
  decade: "Десятилетие",
  year: "Год",
  month: "Месяц",
  week: "Неделя",
  day: "День",
};

const LEVELS: Level[] = ["decade", "year", "month", "week", "day"];

export default function PlansPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLevel, setActiveLevel] = useState<Level>("year");

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [goalsRes, catRes] = await Promise.all([
      supabase.from("goals").select("*").order("sort_order"),
      supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    if (goalsRes.data) setGoals(goalsRes.data);
    if (catRes.data) setCategories(catRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const levelGoals = goals.filter((g) => g.level === activeLevel);

  // Group goals by category
  const grouped = categories.map((cat) => ({
    category: cat,
    goals: levelGoals.filter((g) => g.category_id === cat.id),
  }));
  const uncategorized = levelGoals.filter((g) => !g.category_id);

  async function addGoal(categoryId: string | null) {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const title = `Новая цель (${LEVEL_LABELS[activeLevel]})`;

    const { data } = await supabase
      .from("goals")
      .insert({
        user_id: userData.user.id,
        title,
        level: activeLevel,
        category_id: categoryId,
        sort_order: goals.length,
      })
      .select()
      .single();

    if (data) setGoals((prev) => [...prev, data]);
  }

  async function updateGoalTitle(id: string, title: string) {
    const supabase = createClient();
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, title } : g)));
    await supabase.from("goals").update({ title }).eq("id", id);
  }

  async function toggleGoal(goal: Goal) {
    const supabase = createClient();
    const newStatus = goal.status === "completed" ? "active" : "completed";
    const completedAt =
      newStatus === "completed" ? new Date().toISOString() : null;

    setGoals((prev) =>
      prev.map((g) =>
        g.id === goal.id
          ? { ...g, status: newStatus, completed_at: completedAt }
          : g
      )
    );

    await supabase
      .from("goals")
      .update({ status: newStatus, completed_at: completedAt })
      .eq("id", goal.id);
  }

  async function deleteGoal(id: string) {
    const supabase = createClient();
    setGoals((prev) => prev.filter((g) => g.id !== id));
    await supabase.from("goals").delete().eq("id", id);
  }

  const totalAtLevel = levelGoals.length;
  const doneAtLevel = levelGoals.filter(
    (g) => g.status === "completed"
  ).length;

  return (
    <div className="mx-auto max-w-3xl p-4 pb-24 md:pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold gradient-text">Планы</h1>
      </div>

      {/* Level tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {LEVELS.map((level) => {
          const count = goals.filter((g) => g.level === level).length;
          return (
            <button
              key={level}
              onClick={() => setActiveLevel(level)}
              className={`
                relative px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap
                ${activeLevel === level
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
                }
              `}
            >
              {activeLevel === level && (
                <motion.div
                  layoutId="plans-tab"
                  className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/20"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative">
                {LEVEL_LABELS[level]}
                {count > 0 && (
                  <span className="ml-1 text-[10px] opacity-60">
                    {count}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Level progress */}
      {totalAtLevel > 0 && (
        <motion.div
          key={activeLevel}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-2xl border border-border/50 bg-card/80 p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              {LEVEL_LABELS[activeLevel]}
            </span>
            <span className="text-xs font-medium text-primary">
              {doneAtLevel}/{totalAtLevel}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full gradient-primary"
              initial={{ width: 0 }}
              animate={{
                width: `${totalAtLevel > 0 ? (doneAtLevel / totalAtLevel) * 100 : 0}%`,
              }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </motion.div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeLevel}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Per-category sections */}
            {grouped.map(({ category, goals: catGoals }) => (
              <CategorySection
                key={category.id}
                category={category}
                goals={catGoals}
                onAdd={() => addGoal(category.id)}
                onToggle={toggleGoal}
                onUpdateTitle={updateGoalTitle}
                onDelete={deleteGoal}
              />
            ))}

            {/* Uncategorized */}
            {uncategorized.length > 0 && (
              <CategorySection
                category={null}
                goals={uncategorized}
                onAdd={() => addGoal(null)}
                onToggle={toggleGoal}
                onUpdateTitle={updateGoalTitle}
                onDelete={deleteGoal}
              />
            )}

            {/* Empty state */}
            {levelGoals.length === 0 && (
              <div className="flex flex-col items-center py-16 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <MapIcon className="h-8 w-8 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Нет планов на {LEVEL_LABELS[activeLevel].toLowerCase()}
                </p>
                <Button
                  size="sm"
                  className="gradient-primary text-white border-0"
                  onClick={() => addGoal(categories[0]?.id || null)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Добавить
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

function CategorySection({
  category,
  goals,
  onAdd,
  onToggle,
  onUpdateTitle,
  onDelete,
}: {
  category: Category | null;
  goals: Goal[];
  onAdd: () => void;
  onToggle: (g: Goal) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const doneCount = goals.filter((g) => g.status === "completed").length;

  if (goals.length === 0 && category) return null;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 overflow-hidden">
      {/* Category header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-accent/30 transition-colors"
      >
        <div
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: category?.color || "#888" }}
        />
        <span className="text-sm font-medium flex-1 text-left">
          {category?.name || "Без категории"}
        </span>
        {goals.length > 0 && (
          <span className="text-xs text-muted-foreground mr-2">
            {doneCount}/{goals.length}
          </span>
        )}
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Goals list */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border/30"
          >
            <div className="px-3 py-2 space-y-1">
              {goals.map((goal) => (
                <PlanGoalItem
                  key={goal.id}
                  goal={goal}
                  onToggle={onToggle}
                  onUpdateTitle={onUpdateTitle}
                  onDelete={onDelete}
                  color={category?.color || "#888"}
                />
              ))}

              <button
                onClick={onAdd}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors rounded-lg w-full"
              >
                <Plus className="h-3.5 w-3.5" />
                Добавить
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlanGoalItem({
  goal,
  onToggle,
  onUpdateTitle,
  onDelete,
  color,
}: {
  goal: Goal;
  onToggle: (g: Goal) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  color: string;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(goal.title);
  const isCompleted = goal.status === "completed";

  function handleSave() {
    if (title.trim() && title.trim() !== goal.title) {
      onUpdateTitle(goal.id, title.trim());
    } else {
      setTitle(goal.title);
    }
    setEditing(false);
  }

  return (
    <div className="group flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-accent/50 transition-colors">
      <button
        onClick={() => onToggle(goal)}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200"
        style={{
          borderColor: isCompleted ? color : "oklch(0.4 0 0)",
          backgroundColor: isCompleted ? color : "transparent",
        }}
      >
        {isCompleted && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
          >
            <Check className="h-3 w-3 text-white" />
          </motion.div>
        )}
      </button>

      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setTitle(goal.title);
              setEditing(false);
            }
          }}
          className="flex-1 bg-transparent text-sm outline-none"
        />
      ) : (
        <span
          onDoubleClick={() => setEditing(true)}
          className={`flex-1 text-sm cursor-default ${
            isCompleted ? "line-through text-muted-foreground/60" : ""
          }`}
        >
          {goal.title}
        </span>
      )}

      {goal.target_date && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {goal.target_date}
        </Badge>
      )}

      <button
        onClick={() => onDelete(goal.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10"
      >
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
      </button>
    </div>
  );
}
