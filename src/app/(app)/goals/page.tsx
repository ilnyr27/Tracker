"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Target,
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Check,
  Clock,
  Pause,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "motion/react";
import type { Goal, Category } from "@/lib/supabase/types";

const LEVEL_LABELS: Record<Goal["level"], string> = {
  decade: "Десятилетие",
  year: "Год",
  month: "Месяц",
  week: "Неделя",
  day: "День",
};

const LEVEL_ORDER: Goal["level"][] = ["decade", "year", "month", "week", "day"];

const STATUS_CONFIG: Record<
  Goal["status"],
  { label: string; icon: typeof Check; color: string }
> = {
  active: { label: "Активна", icon: Clock, color: "text-blue-500" },
  completed: { label: "Выполнена", icon: Check, color: "text-green-500" },
  deferred: { label: "Отложена", icon: Pause, color: "text-yellow-500" },
  cancelled: { label: "Отменена", icon: X, color: "text-red-500" },
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [filterLevel, setFilterLevel] = useState<Goal["level"] | "all">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [goalsRes, catRes] = await Promise.all([
      supabase
        .from("goals")
        .select("*")
        .order("level")
        .order("sort_order"),
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

  async function deleteGoal(id: string) {
    const supabase = createClient();
    setGoals((prev) => prev.filter((g) => g.id !== id));
    await supabase.from("goals").delete().eq("id", id);
  }

  async function toggleGoalStatus(goal: Goal) {
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

  function openCreate(parentId?: string, level?: Goal["level"]) {
    setEditingGoal(null);
    setDialogOpen(true);
  }

  function openEdit(goal: Goal) {
    setEditingGoal(goal);
    setDialogOpen(true);
  }

  // Build tree: top-level goals grouped by level
  const topLevelGoals = goals.filter((g) => !g.parent_goal_id);

  const filteredGoals = topLevelGoals.filter((g) => {
    if (filterLevel !== "all" && g.level !== filterLevel) return false;
    if (filterCategory !== "all" && g.category_id !== filterCategory)
      return false;
    return true;
  });

  // Group by level
  const groupedByLevel = LEVEL_ORDER.reduce(
    (acc, level) => {
      const levelGoals = filteredGoals.filter((g) => g.level === level);
      if (levelGoals.length > 0) acc.push({ level, goals: levelGoals });
      return acc;
    },
    [] as { level: Goal["level"]; goals: Goal[] }[]
  );

  const catMap = new Map(categories.map((c) => [c.id, c]));

  // Count stats
  const totalGoals = goals.length;
  const completedGoals = goals.filter((g) => g.status === "completed").length;
  const activeGoals = goals.filter((g) => g.status === "active").length;

  // Per-category progress for A→B overview
  const categoryProgress = categories.map((cat) => {
    const catGoals = goals.filter((g) => g.category_id === cat.id);
    const catDone = catGoals.filter((g) => g.status === "completed").length;
    return {
      category: cat,
      total: catGoals.length,
      done: catDone,
      percent: catGoals.length > 0 ? Math.round((catDone / catGoals.length) * 100) : 0,
    };
  });

  return (
    <div className="mx-auto max-w-3xl p-4 pb-24 md:pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold gradient-text">Путь А → Б</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Твои цели по всем направлениям жизни
          </p>
        </div>
        <Button
          size="sm"
          className="gradient-primary text-white border-0 hover:opacity-90"
          onClick={() => openCreate()}
        >
          <Plus className="h-4 w-4 mr-1" />
          Новая цель
        </Button>
      </div>

      {/* A→B Category Overview */}
      {totalGoals > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-2xl border border-border/50 bg-card/80 p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground">
              Прогресс по категориям
            </span>
            <span className="text-xs font-medium text-primary">
              {completedGoals}/{totalGoals} целей
            </span>
          </div>

          {/* Category mini-bars */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {categoryProgress
              .filter((cp) => cp.total > 0)
              .map((cp) => (
                <button
                  key={cp.category.id}
                  onClick={() => setFilterCategory(cp.category.id)}
                  className="flex items-center gap-2 group text-left"
                >
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cp.category.color || "#666" }}
                  />
                  <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors truncate flex-1">
                    {cp.category.name}
                  </span>
                  <div className="h-1 w-10 rounded-full bg-muted overflow-hidden shrink-0">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(cp.percent, 5)}%`,
                        backgroundColor: cp.category.color || "#666",
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 w-6 text-right">
                    {cp.percent}%
                  </span>
                </button>
              ))}
          </div>

          {/* Overall progress bar */}
          <div className="mt-3 pt-3 border-t border-border/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Общий</span>
              <span className="text-[10px] font-medium text-primary">
                {totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full gradient-primary"
                initial={{ width: 0 }}
                animate={{
                  width: `${totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0}%`,
                }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <Select
          value={filterLevel}
          onValueChange={(v) => setFilterLevel(v as Goal["level"] | "all")}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs bg-card/80 border-border/50">
            <SelectValue placeholder="Уровень" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все уровни</SelectItem>
            {LEVEL_ORDER.map((l) => (
              <SelectItem key={l} value={l}>
                {LEVEL_LABELS[l]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterCategory}
          onValueChange={(v) => setFilterCategory(v ?? "all")}
        >
          <SelectTrigger className="w-[160px] h-8 text-xs bg-card/80 border-border/50">
            <SelectValue placeholder="Категория" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все категории</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Goals List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-card animate-pulse"
            />
          ))}
        </div>
      ) : groupedByLevel.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Target className="h-8 w-8 text-primary" />
          </div>
          <p className="text-muted-foreground text-sm mb-1">
            Определи точку Б — куда ты идёшь
          </p>
          <p className="text-muted-foreground/60 text-xs max-w-[240px]">
            Создай цель на десятилетие, год или месяц. Потом разбей на подцели — до ежедневных задач.
          </p>
        </motion.div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {groupedByLevel.map(({ level, goals: levelGoals }) => (
            <motion.div key={level} variants={item}>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                {LEVEL_LABELS[level]}
              </h2>
              <div className="space-y-2">
                {levelGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    allGoals={goals}
                    catMap={catMap}
                    onToggle={toggleGoalStatus}
                    onEdit={openEdit}
                    onDelete={deleteGoal}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Create/Edit Dialog */}
      <GoalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        goal={editingGoal}
        categories={categories}
        allGoals={goals}
        onSaved={loadData}
      />
    </div>
  );
}

// --- GoalCard with expandable children ---

function GoalCard({
  goal,
  allGoals,
  catMap,
  onToggle,
  onEdit,
  onDelete,
  depth = 0,
}: {
  goal: Goal;
  allGoals: Goal[];
  catMap: Map<string, Category>;
  onToggle: (g: Goal) => void;
  onEdit: (g: Goal) => void;
  onDelete: (id: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const children = allGoals.filter((g) => g.parent_goal_id === goal.id);
  const hasChildren = children.length > 0;

  const cat = goal.category_id ? catMap.get(goal.category_id) : null;
  const statusConfig = STATUS_CONFIG[goal.status];
  const StatusIcon = statusConfig.icon;
  const isCompleted = goal.status === "completed";

  // Progress: count completed children
  const childrenDone = children.filter(
    (c) => c.status === "completed"
  ).length;
  const childProgress =
    hasChildren ? Math.round((childrenDone / children.length) * 100) : 0;

  return (
    <div style={{ marginLeft: depth > 0 ? `${depth * 16}px` : undefined }}>
      <div
        className={`
          group relative overflow-hidden rounded-2xl border bg-card/80 backdrop-blur-sm transition-colors hover:bg-card
          ${isCompleted ? "border-green-500/20 opacity-75" : "border-border/50"}
        `}
      >
        {/* Category color bar */}
        {cat && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
            style={{ backgroundColor: cat.color || "#666" }}
          />
        )}

        <div className="pl-4 pr-3 py-3">
          <div className="flex items-start gap-2">
            {/* Expand toggle */}
            {hasChildren ? (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-0.5 p-0.5 rounded-md hover:bg-accent/50 transition-colors"
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            ) : (
              <div className="w-5" />
            )}

            {/* Status toggle */}
            <button
              onClick={() => onToggle(goal)}
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 ${
                isCompleted
                  ? "border-green-500 bg-green-500"
                  : "border-muted-foreground/30"
              }`}
            >
              {isCompleted && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 20,
                  }}
                >
                  <Check className="h-3 w-3 text-white" />
                </motion.div>
              )}
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-sm font-medium ${
                    isCompleted
                      ? "line-through text-muted-foreground/60"
                      : ""
                  }`}
                >
                  {goal.title}
                </span>
                {cat && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0"
                    style={{
                      backgroundColor: `${cat.color}15`,
                      color: cat.color || undefined,
                    }}
                  >
                    {cat.name}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${statusConfig.color}`}
                >
                  {LEVEL_LABELS[goal.level]}
                </Badge>
              </div>

              {goal.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {goal.description}
                </p>
              )}

              {/* Children progress */}
              {hasChildren && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-1 flex-1 max-w-[120px] rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 bg-green-500"
                      style={{ width: `${childProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {childrenDone}/{children.length} подцелей
                  </span>
                </div>
              )}

              {goal.target_date && (
                <p className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  до {goal.target_date}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(goal)}
                className="p-1.5 rounded-md hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
              >
                <Target className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDelete(goal.id)}
                className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Children */}
      <AnimatePresence>
        {expanded && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2 mt-2"
          >
            {children.map((child) => (
              <GoalCard
                key={child.id}
                goal={child}
                allGoals={allGoals}
                catMap={catMap}
                onToggle={onToggle}
                onEdit={onEdit}
                onDelete={onDelete}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Create/Edit Goal Dialog ---

function GoalDialog({
  open,
  onOpenChange,
  goal,
  categories,
  allGoals,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: Goal | null;
  categories: Category[];
  allGoals: Goal[];
  onSaved: () => void;
}) {
  const isEdit = !!goal;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<Goal["level"]>("year");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [parentGoalId, setParentGoalId] = useState<string>("none");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (goal) {
        setTitle(goal.title);
        setDescription(goal.description || "");
        setLevel(goal.level);
        setCategoryId(goal.category_id || "none");
        setParentGoalId(goal.parent_goal_id || "none");
        setTargetDate(goal.target_date || "");
      } else {
        setTitle("");
        setDescription("");
        setLevel("year");
        setCategoryId("none");
        setParentGoalId("none");
        setTargetDate("");
      }
    }
  }, [open, goal]);

  // Possible parents: goals with a higher/same level
  const possibleParents = allGoals.filter((g) => {
    if (goal && g.id === goal.id) return false;
    const parentIdx = LEVEL_ORDER.indexOf(g.level);
    const currentIdx = LEVEL_ORDER.indexOf(level);
    return parentIdx < currentIdx;
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      level,
      category_id: categoryId === "none" ? null : categoryId,
      parent_goal_id: parentGoalId === "none" ? null : parentGoalId,
      target_date: targetDate || null,
    };

    if (isEdit) {
      await supabase.from("goals").update(payload).eq("id", goal.id);
    } else {
      await supabase.from("goals").insert({
        ...payload,
        user_id: userData.user.id,
        sort_order: allGoals.length,
      });
    }

    setSaving(false);
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="gradient-text">
            {isEdit ? "Редактировать цель" : "Новая цель"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Название цели"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            className="bg-input/50 border-border/50"
          />

          <Textarea
            placeholder="Описание (необязательно)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="bg-input/50 border-border/50 resize-none"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Уровень
              </label>
              <Select value={level} onValueChange={(v) => setLevel(v as Goal["level"])}>
                <SelectTrigger className="bg-input/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVEL_ORDER.map((l) => (
                    <SelectItem key={l} value={l}>
                      {LEVEL_LABELS[l]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Категория
              </label>
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "none")}>
                <SelectTrigger className="bg-input/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без категории</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {possibleParents.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Родительская цель
              </label>
              <Select value={parentGoalId} onValueChange={(v) => setParentGoalId(v ?? "none")}>
                <SelectTrigger className="bg-input/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Нет (верхний уровень)</SelectItem>
                  {possibleParents.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      [{LEVEL_LABELS[g.level]}] {g.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Дедлайн
            </label>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="bg-input/50 border-border/50"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex-1 gradient-primary text-white border-0 hover:opacity-90"
            >
              {saving ? "..." : isEdit ? "Сохранить" : "Создать"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
