"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Target,
  Plus,
  Trash2,
  Check,
  Clock,
  Pause,
  Archive,
  ArrowRight,
  GripVertical,
  ChevronDown,
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

// ── Column config ──
type ColumnId = Goal["status"];

const COLUMNS: { id: ColumnId; label: string; icon: typeof Check; color: string; emptyText: string }[] = [
  { id: "active", label: "Активные", icon: Clock, color: "text-blue-500", emptyText: "Создай первую цель" },
  { id: "deferred", label: "Отложенные", icon: Pause, color: "text-amber-500", emptyText: "Нет отложенных" },
  { id: "completed", label: "Готово", icon: Check, color: "text-green-500", emptyText: "Пока ничего не завершено" },
  { id: "cancelled", label: "Архив", icon: Archive, color: "text-muted-foreground", emptyText: "Архив пуст" },
];

const LEVEL_LABELS: Record<Goal["level"], string> = {
  decade: "10 лет",
  year: "Год",
  month: "Месяц",
  week: "Неделя",
  day: "День",
};

const LEVEL_ORDER: Goal["level"][] = ["decade", "year", "month", "week", "day"];

// ── Kanban page ──
export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  // Mobile: show one column at a time
  const [activeTab, setActiveTab] = useState<ColumnId>("active");

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [goalsRes, catRes] = await Promise.all([
      supabase
        .from("goals")
        .select("*")
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

  const catMap = new Map(categories.map((c) => [c.id, c]));

  // Move goal to a new status
  async function moveGoal(goalId: string, newStatus: ColumnId) {
    const completedAt = newStatus === "completed" ? new Date().toISOString() : null;

    // Optimistic update
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId ? { ...g, status: newStatus, completed_at: completedAt } : g
      )
    );

    const supabase = createClient();
    await supabase
      .from("goals")
      .update({ status: newStatus, completed_at: completedAt })
      .eq("id", goalId);
  }

  async function deleteGoal(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    const supabase = createClient();
    await supabase.from("goals").delete().eq("id", id);
  }

  function openCreate() {
    setEditingGoal(null);
    setDialogOpen(true);
  }

  function openEdit(goal: Goal) {
    setEditingGoal(goal);
    setDialogOpen(true);
  }

  // Filter goals
  const filteredGoals = goals.filter((g) => {
    if (filterCategory !== "all" && g.category_id !== filterCategory) return false;
    return true;
  });

  // Group by column
  const goalsByColumn = COLUMNS.reduce(
    (acc, col) => {
      let colGoals = filteredGoals.filter((g) => g.status === col.id);
      // Archive: sort by completed_at/updated_at descending
      if (col.id === "cancelled" || col.id === "completed") {
        colGoals = colGoals.sort(
          (a, b) =>
            new Date(b.completed_at || b.updated_at).getTime() -
            new Date(a.completed_at || a.updated_at).getTime()
        );
      }
      acc[col.id] = colGoals;
      return acc;
    },
    {} as Record<ColumnId, Goal[]>
  );

  // Stats
  const totalGoals = goals.length;
  const completedGoals = goals.filter((g) => g.status === "completed").length;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] md:h-screen">
      {/* Header */}
      <div className="px-4 py-5 md:px-6 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold gradient-text tracking-tight">Путь А → Б</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {totalGoals > 0
                  ? `${completedGoals} из ${totalGoals} целей выполнено`
                  : "Определи свои цели и двигайся к ним"}
              </p>
            </div>
            <Button
              className="h-11 gradient-primary text-white border-0 hover:opacity-90 rounded-xl"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4 mr-2" />
              Новая цель
            </Button>
          </div>

          {/* Category filter */}
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <button
                onClick={() => setFilterCategory("all")}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filterCategory === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Все
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setFilterCategory(cat.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    filterCategory === cat.id
                      ? "text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  style={
                    filterCategory === cat.id
                      ? { backgroundColor: cat.color || "var(--primary)" }
                      : undefined
                  }
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden flex border-b border-border/50 bg-background">
        {COLUMNS.map((col) => {
          const count = goalsByColumn[col.id].length;
          const isActive = activeTab === col.id;
          return (
            <button
              key={col.id}
              onClick={() => setActiveTab(col.id)}
              className={`flex-1 py-3 text-xs font-medium transition-all relative ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {col.label}
              {count > 0 && (
                <span className={`ml-1 text-[10px] ${isActive ? "text-primary" : "text-muted-foreground/60"}`}>
                  {count}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="kanban-tab"
                  className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Kanban board */}
      {loading ? (
        <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          {COLUMNS.map((col) => (
            <div key={col.id} className="space-y-3">
              <div className="h-8 bg-muted rounded-lg animate-pulse" />
              <div className="h-24 bg-card rounded-xl animate-pulse" />
              <div className="h-24 bg-card rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* Desktop: all columns side by side */}
          <div className="hidden md:grid md:grid-cols-4 gap-4 p-4 md:p-6 max-w-7xl mx-auto h-full">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                goals={goalsByColumn[col.id]}
                catMap={catMap}
                onMove={moveGoal}
                onEdit={openEdit}
                onDelete={deleteGoal}
              />
            ))}
          </div>

          {/* Mobile: active tab only */}
          <div className="md:hidden p-4 pb-28">
            {COLUMNS.filter((col) => col.id === activeTab).map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                goals={goalsByColumn[col.id]}
                catMap={catMap}
                onMove={moveGoal}
                onEdit={openEdit}
                onDelete={deleteGoal}
                mobile
              />
            ))}
          </div>
        </div>
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

// ── Kanban Column ──
function KanbanColumn({
  column,
  goals,
  catMap,
  onMove,
  onEdit,
  onDelete,
  mobile = false,
}: {
  column: (typeof COLUMNS)[number];
  goals: Goal[];
  catMap: Map<string, Category>;
  onMove: (id: string, status: ColumnId) => void;
  onEdit: (g: Goal) => void;
  onDelete: (id: string) => void;
  mobile?: boolean;
}) {
  const Icon = column.icon;

  return (
    <div className={`flex flex-col ${mobile ? "" : "min-h-0"}`}>
      {/* Column header (desktop only) */}
      {!mobile && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <Icon className={`h-4 w-4 ${column.color}`} />
          <span className="text-sm font-semibold">{column.label}</span>
          <span className="text-xs text-muted-foreground/60 ml-auto">{goals.length}</span>
        </div>
      )}

      {/* Cards */}
      <div className={`space-y-3 ${mobile ? "" : "flex-1 overflow-y-auto pr-1"}`}>
        <AnimatePresence mode="popLayout">
          {goals.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <Icon className="h-8 w-8 text-muted-foreground/20 mb-2" />
              <p className="text-sm text-muted-foreground/40">{column.emptyText}</p>
            </motion.div>
          ) : (
            goals.map((goal) => (
              <KanbanCard
                key={goal.id}
                goal={goal}
                catMap={catMap}
                currentColumn={column.id}
                onMove={onMove}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Kanban Card ──
function KanbanCard({
  goal,
  catMap,
  currentColumn,
  onMove,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  catMap: Map<string, Category>;
  currentColumn: ColumnId;
  onMove: (id: string, status: ColumnId) => void;
  onEdit: (g: Goal) => void;
  onDelete: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const cat = goal.category_id ? catMap.get(goal.category_id) : null;
  const isCompleted = goal.status === "completed";
  const isArchived = goal.status === "cancelled";

  // Available moves (all columns except current)
  const moveTargets = COLUMNS.filter((c) => c.id !== currentColumn);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`group rounded-xl border bg-card p-4 transition-all hover:shadow-md cursor-pointer ${
        isCompleted
          ? "border-green-500/20 opacity-80"
          : isArchived
            ? "border-border/30 opacity-60"
            : "border-border/40 hover:border-border/70"
      }`}
      onClick={() => onEdit(goal)}
    >
      {/* Top row: category + level */}
      <div className="flex items-center gap-2 mb-2">
        {cat && (
          <div
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: cat.color || "#666" }}
          />
        )}
        {cat && (
          <span className="text-xs text-muted-foreground truncate">
            {cat.name}
          </span>
        )}
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto shrink-0">
          {LEVEL_LABELS[goal.level]}
        </Badge>
      </div>

      {/* Title */}
      <h3
        className={`text-sm font-medium leading-snug mb-2 ${
          isCompleted ? "line-through text-muted-foreground/60" : ""
        }`}
      >
        {goal.title}
      </h3>

      {/* Description preview */}
      {goal.description && (
        <p className="text-xs text-muted-foreground/60 line-clamp-2 mb-3">
          {goal.description}
        </p>
      )}

      {/* Date info */}
      {(goal.target_date || goal.completed_at) && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground/50 mb-3">
          <Clock className="h-3 w-3" />
          {goal.completed_at
            ? `Завершена ${new Date(goal.completed_at).toLocaleDateString("ru-RU")}`
            : `до ${new Date(goal.target_date!).toLocaleDateString("ru-RU")}`}
        </div>
      )}

      {/* Actions row */}
      <div className="flex items-center gap-1 pt-2 border-t border-border/30">
        {/* Quick move buttons */}
        {moveTargets.map((target) => {
          const TIcon = target.icon;
          return (
            <button
              key={target.id}
              onClick={(e) => {
                e.stopPropagation();
                onMove(goal.id, target.id);
              }}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] transition-all hover:bg-accent/50 ${target.color}`}
              title={`Переместить в "${target.label}"`}
            >
              <TIcon className="h-3 w-3" />
              <span className="hidden sm:inline">{target.label}</span>
            </button>
          );
        })}

        {/* Delete */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(goal.id);
          }}
          className="ml-auto p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all"
          title="Удалить"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Create/Edit Goal Dialog ──
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
  const [status, setStatus] = useState<ColumnId>("active");
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
        setStatus(goal.status);
      } else {
        setTitle("");
        setDescription("");
        setLevel("year");
        setCategoryId("none");
        setParentGoalId("none");
        setTargetDate("");
        setStatus("active");
      }
    }
  }, [open, goal]);

  // Possible parents: goals with a higher level
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

    const completedAt = status === "completed" ? new Date().toISOString() : null;

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      level,
      category_id: categoryId === "none" ? null : categoryId,
      parent_goal_id: parentGoalId === "none" ? null : parentGoalId,
      target_date: targetDate || null,
      status,
      completed_at: completedAt,
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
      <DialogContent className="sm:max-w-lg bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="text-lg gradient-text">
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
            className="h-12 bg-input/50 border-border/50 text-base"
          />

          <Textarea
            placeholder="Описание (необязательно)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="bg-input/50 border-border/50 resize-none text-sm"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Уровень
              </label>
              <Select value={level} onValueChange={(v) => setLevel(v as Goal["level"])}>
                <SelectTrigger className="h-11 bg-input/50 border-border/50">
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
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Категория
              </label>
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "none")}>
                <SelectTrigger className="h-11 bg-input/50 border-border/50">
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

          {isEdit && (
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Статус
              </label>
              <Select value={status} onValueChange={(v) => setStatus(v as ColumnId)}>
                <SelectTrigger className="h-11 bg-input/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLUMNS.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {possibleParents.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Родительская цель
              </label>
              <Select value={parentGoalId} onValueChange={(v) => setParentGoalId(v ?? "none")}>
                <SelectTrigger className="h-11 bg-input/50 border-border/50">
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
            <label className="text-xs text-muted-foreground mb-1.5 block">
              Дедлайн
            </label>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="h-11 bg-input/50 border-border/50"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              className="flex-1 h-11"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex-1 h-11 gradient-primary text-white border-0 hover:opacity-90"
            >
              {saving ? "..." : isEdit ? "Сохранить" : "Создать"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
