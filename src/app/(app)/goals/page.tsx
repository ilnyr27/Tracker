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
  GripVertical,
  ListTodo,
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
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  pointerWithin,
  rectIntersection,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import type { Goal, Category } from "@/lib/supabase/types";

// ── Column config ──
type ColumnId = Goal["status"];

const COLUMNS: { id: ColumnId; label: string; icon: typeof Check; color: string; emptyText: string }[] = [
  { id: "deferred", label: "План", icon: Pause, color: "text-amber-500", emptyText: "Добавь задачи в план" },
  { id: "active", label: "В работе", icon: Clock, color: "text-blue-500", emptyText: "Нет активных задач" },
  { id: "completed", label: "Завершённые", icon: Check, color: "text-green-500", emptyText: "Пока ничего не завершено" },
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

type KanbanMode = "tasks" | "goals";

// ── Kanban page ──
export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [draggedGoal, setDraggedGoal] = useState<Goal | null>(null);
  const [kanbanMode, setKanbanMode] = useState<KanbanMode>("tasks");

  // DnD sensors: pointer (mouse) + touch (mobile)
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [goalsRes, catRes] = await Promise.all([
      supabase.from("goals").select("*").order("sort_order"),
      supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
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

  // ── DnD handlers ──
  function handleDragStart(event: DragStartEvent) {
    const goal = goals.find((g) => g.id === event.active.id);
    if (goal) setDraggedGoal(goal);
  }

  // Custom collision: prefer pointerWithin, fall back to rectIntersection
  const collisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return rectIntersection(args);
  };

  function handleDragEnd(event: DragEndEvent) {
    setDraggedGoal(null);
    const { active, over } = event;
    if (!over) return;

    const goalId = active.id as string;
    const overId = over.id as string;

    // Only columns are droppable — overId is always a column id
    const targetColumn = COLUMNS.find((c) => c.id === overId)?.id ?? null;

    if (targetColumn) {
      const currentGoal = goals.find((g) => g.id === goalId);
      if (currentGoal && currentGoal.status !== targetColumn) {
        moveGoal(goalId, targetColumn);
      }
    }
  }

  // Filter goals by mode: "tasks" = standalone (no category), "goals" = from categories
  const modeGoals = goals.filter((g) => {
    if (kanbanMode === "tasks") return !g.category_id;
    return !!g.category_id;
  });

  // Further filter by category (only relevant in "goals" mode)
  const filteredGoals = modeGoals.filter((g) => {
    if (kanbanMode === "goals" && filterCategory !== "all" && g.category_id !== filterCategory) return false;
    return true;
  });

  // Group by column
  const goalsByColumn = COLUMNS.reduce(
    (acc, col) => {
      let colGoals = filteredGoals.filter((g) => g.status === col.id);
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

  const totalGoals = goals.length;
  const completedGoals = goals.filter((g) => g.status === "completed").length;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] md:h-screen">
      {/* Header */}
      <div className="px-4 py-5 md:px-6 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold gradient-text tracking-tight">Канбан</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {totalGoals > 0
                  ? `${completedGoals} из ${totalGoals} выполнено`
                  : kanbanMode === "tasks" ? "Создавай задачи и двигай по колонкам" : "Цели из категорий на главном экране"}
              </p>
            </div>
            <Button
              className="h-11 gradient-primary text-white border-0 hover:opacity-90 rounded-xl"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4 mr-2" />
              {kanbanMode === "tasks" ? "Задача" : "Цель"}
            </Button>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex rounded-xl border border-border/50 overflow-hidden text-xs">
              <button
                onClick={() => { setKanbanMode("tasks"); setFilterCategory("all"); }}
                className={`flex items-center gap-1.5 px-4 py-2 transition-colors ${
                  kanbanMode === "tasks" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent/50"
                }`}
              >
                <ListTodo className="h-3.5 w-3.5" />
                Мои задачи
              </button>
              <button
                onClick={() => setKanbanMode("goals")}
                className={`flex items-center gap-1.5 px-4 py-2 transition-colors ${
                  kanbanMode === "goals" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent/50"
                }`}
              >
                <Target className="h-3.5 w-3.5" />
                По целям
              </button>
            </div>
          </div>

          {/* Category filter (only in goals mode) */}
          {kanbanMode === "goals" && categories.length > 0 && (
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

{/* No mobile tabs — all columns visible via horizontal scroll */}

      {/* Kanban board with DnD */}
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
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-auto">
            {/* Desktop: all columns */}
            <div className="hidden md:grid md:grid-cols-4 gap-4 p-4 md:p-6 max-w-7xl mx-auto h-full">
              {COLUMNS.map((col) => (
                <DroppableColumn
                  key={col.id}
                  column={col}
                  goals={goalsByColumn[col.id]}
                  catMap={catMap}
                  onMove={moveGoal}
                  onEdit={openEdit}
                  onDelete={deleteGoal}
                  isDragActive={!!draggedGoal}
                  draggedGoalColumn={draggedGoal?.status || null}
                />
              ))}
            </div>

            {/* Mobile: horizontal scroll showing all columns */}
            <div className="md:hidden overflow-x-auto pb-28">
              <div className="flex gap-4 p-4 min-w-max">
                {COLUMNS.map((col) => (
                  <div key={col.id} className="w-[75vw] shrink-0">
                    <DroppableColumn
                      column={col}
                      goals={goalsByColumn[col.id]}
                      catMap={catMap}
                      onMove={moveGoal}
                      onEdit={openEdit}
                      onDelete={deleteGoal}
                      isDragActive={!!draggedGoal}
                      draggedGoalColumn={draggedGoal?.status || null}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Drag overlay — the card that follows cursor */}
          <DragOverlay dropAnimation={null}>
            {draggedGoal ? (
              <DragOverlayCard goal={draggedGoal} catMap={catMap} />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Create/Edit Dialog */}
      <GoalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        goal={editingGoal}
        categories={categories}
        allGoals={goals}
        onSaved={loadData}
        kanbanMode={kanbanMode}
      />
    </div>
  );
}

// ── Droppable Column ──
function DroppableColumn({
  column,
  goals,
  catMap,
  onMove,
  onEdit,
  onDelete,
  isDragActive,
  draggedGoalColumn,
}: {
  column: (typeof COLUMNS)[number];
  goals: Goal[];
  catMap: Map<string, Category>;
  onMove: (id: string, status: ColumnId) => void;
  onEdit: (g: Goal) => void;
  onDelete: (id: string) => void;
  isDragActive: boolean;
  draggedGoalColumn: ColumnId | null;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id });
  const Icon = column.icon;
  const isDropTarget = isDragActive && draggedGoalColumn !== column.id;

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-h-[200px] rounded-2xl transition-all duration-200 ${
        isOver
          ? "bg-primary/5 ring-2 ring-primary/30 ring-inset"
          : isDropTarget
            ? "bg-accent/30 ring-1 ring-border/50 ring-inset ring-dashed"
            : ""
      }`}
      style={{ padding: isDropTarget || isOver ? "8px" : undefined }}
    >
      {/* Column header */}
      {(
        <div className="flex items-center gap-2 mb-3 px-1">
          <Icon className={`h-4 w-4 ${column.color}`} />
          <span className="text-sm font-semibold">{column.label}</span>
          <span className="text-xs text-muted-foreground/60 ml-auto">{goals.length}</span>
        </div>
      )}

      {/* Cards */}
      <div className="space-y-3 flex-1 overflow-y-auto pr-1">
        {goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icon className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-sm text-muted-foreground/40">{column.emptyText}</p>
          </div>
        ) : (
          goals.map((goal) => (
            <DraggableCard
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
      </div>
    </div>
  );
}

// ── Draggable Card ──
function DraggableCard({
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
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: goal.id,
  });

  const cat = goal.category_id ? catMap.get(goal.category_id) : null;
  const isCompleted = goal.status === "completed";
  const isArchived = goal.status === "cancelled";
  const moveTargets = COLUMNS.filter((c) => c.id !== currentColumn);

  // Prevent drag start on interactive elements
  const stopDrag = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      {...attributes}
      {...listeners}
      className={`group rounded-xl border bg-card p-4 transition-all cursor-grab active:cursor-grabbing ${
        isDragging
          ? "opacity-30 scale-95 shadow-none"
          : "hover:shadow-md"
      } ${
        isCompleted
          ? "border-green-500/20 opacity-80"
          : isArchived
            ? "border-border/30 opacity-60"
            : "border-border/40 hover:border-border/70"
      }`}
    >
      {/* Top row */}
      <div className="flex items-center gap-2 mb-2">
        <GripVertical className="h-4 w-4 text-muted-foreground/20 shrink-0" />
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

      {/* Title — clickable to edit */}
      <h3
        className={`text-sm font-medium leading-snug mb-2 cursor-pointer hover:text-primary transition-colors ${
          isCompleted ? "line-through text-muted-foreground/60" : ""
        }`}
        onPointerDown={stopDrag}
        onClick={() => onEdit(goal)}
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
      <div className="flex items-center gap-1 pt-2 border-t border-border/30" onPointerDown={stopDrag}>
        {moveTargets.map((target) => {
          const TIcon = target.icon;
          return (
            <button
              key={target.id}
              onClick={() => onMove(goal.id, target.id)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] transition-all hover:bg-accent/50 ${target.color}`}
              title={`Переместить в "${target.label}"`}
            >
              <TIcon className="h-3 w-3" />
              <span className="hidden sm:inline">{target.label}</span>
            </button>
          );
        })}

        <button
          onClick={() => onDelete(goal.id)}
          className="ml-auto p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all"
          title="Удалить"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Drag Overlay (the floating card) ──
function DragOverlayCard({
  goal,
  catMap,
}: {
  goal: Goal;
  catMap: Map<string, Category>;
}) {
  const cat = goal.category_id ? catMap.get(goal.category_id) : null;

  return (
    <div className="rounded-xl border-2 border-primary/40 bg-card p-4 shadow-2xl shadow-primary/10 rotate-2 w-[280px]">
      <div className="flex items-center gap-2 mb-2">
        <GripVertical className="h-4 w-4 text-primary/50" />
        {cat && (
          <div
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: cat.color || "#666" }}
          />
        )}
        {cat && (
          <span className="text-xs text-muted-foreground truncate">{cat.name}</span>
        )}
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto shrink-0">
          {LEVEL_LABELS[goal.level]}
        </Badge>
      </div>
      <h3 className="text-sm font-medium leading-snug">{goal.title}</h3>
    </div>
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
  kanbanMode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: Goal | null;
  categories: Category[];
  allGoals: Goal[];
  onSaved: () => void;
  kanbanMode: KanbanMode;
}) {
  const isEdit = !!goal;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<Goal["level"]>("year");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [parentGoalId, setParentGoalId] = useState<string>("none");
  const [targetDate, setTargetDate] = useState("");
  const [status, setStatus] = useState<ColumnId>("deferred");
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
        setStatus("deferred");
      }
    }
  }, [open, goal]);

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
            {isEdit ? "Редактировать" : kanbanMode === "tasks" ? "Новая задача" : "Новая цель"}
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

          <div className={`grid ${kanbanMode === "tasks" && !isEdit ? "grid-cols-1" : "grid-cols-2"} gap-3`}>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Уровень</label>
              <Select value={level} onValueChange={(v) => setLevel(v as Goal["level"])}>
                <SelectTrigger className="h-11 bg-input/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVEL_ORDER.map((l) => (
                    <SelectItem key={l} value={l}>{LEVEL_LABELS[l]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(kanbanMode === "goals" || isEdit) && (
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Категория</label>
                <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "none")}>
                  <SelectTrigger className="h-11 bg-input/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без категории</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {isEdit && (
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Статус</label>
              <Select value={status} onValueChange={(v) => setStatus(v as ColumnId)}>
                <SelectTrigger className="h-11 bg-input/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLUMNS.map((col) => (
                    <SelectItem key={col.id} value={col.id}>{col.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {possibleParents.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Родительская цель</label>
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
            <label className="text-xs text-muted-foreground mb-1.5 block">Дедлайн</label>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="h-11 bg-input/50 border-border/50"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" className="flex-1 h-11" onClick={() => onOpenChange(false)}>
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
