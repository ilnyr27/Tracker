"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Target,
  Plus,
  Trash2,
  Check,
  Clock,
  Archive,
  ListTodo,
  Pencil,
  ChevronLeft,
  ChevronRight,
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
import type { Goal, Category } from "@/lib/supabase/types";

// ── Column config ──
type ColumnId = Goal["status"];

const COLUMNS: { id: ColumnId; label: string; icon: typeof Check; color: string; emptyText: string }[] = [
  { id: "deferred", label: "План", icon: ListTodo, color: "text-amber-500", emptyText: "Добавь задачи в план" },
  { id: "active", label: "В работе", icon: Clock, color: "text-blue-500", emptyText: "Нет активных задач" },
  { id: "completed", label: "Готово", icon: Check, color: "text-green-500", emptyText: "Пока ничего не завершено" },
  { id: "cancelled", label: "Архив", icon: Archive, color: "text-muted-foreground", emptyText: "Архив пуст" },
];

const MOBILE_COL_COLORS: Record<ColumnId, { pill: string; container: string }> = {
  deferred: { pill: "bg-amber-500 text-white", container: "bg-amber-500/5 border-amber-500/20" },
  active: { pill: "bg-blue-500 text-white", container: "bg-blue-500/5 border-blue-500/20" },
  completed: { pill: "bg-green-500 text-white", container: "bg-green-500/5 border-green-500/20" },
  cancelled: { pill: "bg-muted-foreground/60 text-white", container: "bg-muted/40 border-border/30" },
};

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
  const [defaultStatus, setDefaultStatus] = useState<ColumnId>("deferred");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [kanbanMode, setKanbanMode] = useState<KanbanMode>("tasks");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<ColumnId | null>(null);
  const [mobileActiveColumn, setMobileActiveColumn] = useState<ColumnId>("active");
  const colContentRef = useRef<HTMLDivElement>(null);

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
    setDefaultStatus("deferred");
    setDialogOpen(true);
  }

  function openCreateInColumn(status: ColumnId) {
    setEditingGoal(null);
    setDefaultStatus(status);
    setDialogOpen(true);
  }

  async function saveRename(id: string, title: string) {
    if (!title.trim()) { setRenamingId(null); return; }
    setGoals((prev) => prev.map((g) => g.id === id ? { ...g, title: title.trim() } : g));
    setRenamingId(null);
    const supabase = createClient();
    await supabase.from("goals").update({ title: title.trim() }).eq("id", id);
  }

  function openEdit(goal: Goal) {
    setEditingGoal(goal);
    setDialogOpen(true);
  }

  // ── Mobile column swipe ──
  const COL_ORDER: ColumnId[] = ["deferred", "active", "completed", "cancelled"];

  useEffect(() => {
    const el = colContentRef.current;
    if (!el) return;
    let startX = 0;
    let startY = 0;
    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        setMobileActiveColumn((prev) => {
          const idx = COL_ORDER.indexOf(prev);
          if (dx < 0 && idx < COL_ORDER.length - 1) return COL_ORDER[idx + 1];
          if (dx > 0 && idx > 0) return COL_ORDER[idx - 1];
          return prev;
        });
      }
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, [loading]); // re-attach after loading (element appears in DOM)

  // ── Native DnD handlers ──
  function handleDragStart(e: React.DragEvent, goalId: string) {
    setDraggingId(goalId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", goalId);
    // Make the drag image semi-transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  }

  function handleDragEnd(e: React.DragEvent) {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDraggingId(null);
    setOverColumn(null);
  }

  function handleColumnDragOver(e: React.DragEvent, columnId: ColumnId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverColumn(columnId);
  }

  function handleColumnDragLeave() {
    setOverColumn(null);
  }

  function handleColumnDrop(e: React.DragEvent, columnId: ColumnId) {
    e.preventDefault();
    const goalId = e.dataTransfer.getData("text/plain");
    if (goalId) {
      const goal = goals.find((g) => g.id === goalId);
      if (goal && goal.status !== columnId) {
        moveGoal(goalId, columnId);
      }
    }
    setDraggingId(null);
    setOverColumn(null);
  }

  // Filter goals by mode
  const modeGoals = goals.filter((g) => {
    if (kanbanMode === "tasks") return !g.category_id;
    return !!g.category_id;
  });

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
    <div className="flex flex-col h-[calc(100vh-80px)] md:h-screen overflow-x-hidden">
      {/* Header */}
      <div className="px-4 py-4 md:px-6 border-b border-border/50 bg-background/80 backdrop-blur-sm overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="mb-3">
            <h1 className="text-xl font-bold gradient-text tracking-tight">Канбан</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalGoals > 0
                ? `${completedGoals} из ${totalGoals} выполнено`
                : kanbanMode === "tasks" ? "Создавай задачи и двигай по колонкам" : "Цели из категорий на главном экране"}
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex rounded-xl border border-border/50 overflow-hidden text-xs">
              <button
                onClick={() => { setKanbanMode("tasks"); setFilterCategory("all"); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                  kanbanMode === "tasks" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent/50"
                }`}
              >
                <ListTodo className="h-3 w-3" />
                Мои задачи
              </button>
              <button
                onClick={() => setKanbanMode("goals")}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                  kanbanMode === "goals" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent/50"
                }`}
              >
                <Target className="h-3 w-3" />
                По целям
              </button>
            </div>
          </div>

          {/* Category filter (only in goals mode) */}
          {kanbanMode === "goals" && categories.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none" style={{ touchAction: 'pan-x' }}>
              <button
                onClick={() => setFilterCategory("all")}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
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
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
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

      {/* Kanban board */}
      {loading ? (
        <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          {COLUMNS.map((col) => (
            <div key={col.id} className="space-y-2">
              <div className="h-7 bg-muted rounded-lg animate-pulse" />
              <div className="h-20 bg-card rounded-xl animate-pulse" />
              <div className="h-20 bg-card rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* Desktop: all columns */}
          <div className="hidden md:grid md:grid-cols-4 gap-3 p-4 md:p-5 max-w-7xl mx-auto h-full">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                goals={goalsByColumn[col.id]}
                catMap={catMap}
                onMove={moveGoal}
                onEdit={openEdit}
                onDelete={deleteGoal}
                onAdd={openCreateInColumn}
                renamingId={renamingId}
                renameValue={renameValue}
                onRenameStart={(g) => { setRenamingId(g.id); setRenameValue(g.title); }}
                onRenameChange={setRenameValue}
                onRenameSave={saveRename}
                onRenameCancel={() => setRenamingId(null)}
                isOver={overColumn === col.id}
                isDragging={!!draggingId}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleColumnDragOver}
                onDragLeave={handleColumnDragLeave}
                onDrop={handleColumnDrop}
              />
            ))}
          </div>

          {/* Mobile: status filter pills + vertical list */}
          <div className="md:hidden flex flex-col h-full">
            {/* Filter pills */}
            <div className="px-4 pt-3 pb-2 flex gap-2 overflow-x-auto shrink-0 scrollbar-none" style={{ touchAction: 'pan-x' }}>
              {COLUMNS.map((col) => {
                const ColIcon = col.icon;
                const count = (goalsByColumn[col.id] || []).length;
                const isActive = mobileActiveColumn === col.id;
                return (
                  <button
                    key={col.id}
                    onClick={() => setMobileActiveColumn(col.id)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isActive
                        ? MOBILE_COL_COLORS[col.id].pill
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <ColIcon className="h-3 w-3" />
                    {col.label}
                    {count > 0 && (
                      <span className={`text-[10px] rounded-full px-1 min-w-[16px] text-center leading-none py-0.5 ${
                        isActive ? "bg-white/25" : "bg-foreground/10"
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active column cards */}
            <div ref={colContentRef} className="flex-1 overflow-y-auto px-4 pb-28">
              {(() => {
                const col = COLUMNS.find((c) => c.id === mobileActiveColumn)!;
                const colGoals = goalsByColumn[mobileActiveColumn] || [];
                return (
                  <div className={`min-h-32 rounded-2xl border p-3 ${MOBILE_COL_COLORS[mobileActiveColumn].container}`}>
                    <div className="flex items-center gap-1.5 mb-3">
                      <col.icon className={`h-3.5 w-3.5 ${col.color}`} />
                      <span className="text-xs font-semibold">{col.label}</span>
                      <span className="text-[10px] text-muted-foreground/50 ml-auto">{colGoals.length}</span>
                      {/* swipe hint arrows */}
                      <div className="flex items-center gap-0.5 text-muted-foreground/20">
                        {COL_ORDER.indexOf(mobileActiveColumn) > 0 && (
                          <ChevronLeft className="h-3.5 w-3.5" />
                        )}
                        {COL_ORDER.indexOf(mobileActiveColumn) < COL_ORDER.length - 1 && (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {colGoals.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <col.icon className="h-6 w-6 text-muted-foreground/15 mb-1.5" />
                          <p className="text-[11px] text-muted-foreground/30">{col.emptyText}</p>
                        </div>
                      ) : (
                        colGoals.map((goal) => (
                          <GoalCard
                            key={goal.id}
                            goal={goal}
                            catMap={catMap}
                            currentColumn={mobileActiveColumn}
                            onMove={moveGoal}
                            onEdit={openEdit}
                            onDelete={deleteGoal}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            renamingId={renamingId}
                            renameValue={renameValue}
                            onRenameStart={(g) => { setRenamingId(g.id); setRenameValue(g.title); }}
                            onRenameChange={setRenameValue}
                            onRenameSave={saveRename}
                            onRenameCancel={() => setRenamingId(null)}
                          />
                        ))
                      )}
                    </div>
                    {mobileActiveColumn !== "cancelled" && (
                      <button
                        onClick={() => openCreateInColumn(mobileActiveColumn)}
                        className="mt-2 flex items-center gap-1.5 px-2 py-1.5 w-full rounded-xl text-[11px] text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                        Добавить
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
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
        kanbanMode={kanbanMode}
        defaultStatus={defaultStatus}
      />
    </div>
  );
}

// ── Column ──
function KanbanColumn({
  column,
  goals,
  catMap,
  onMove,
  onEdit,
  onDelete,
  onAdd,
  renamingId,
  renameValue,
  onRenameStart,
  onRenameChange,
  onRenameSave,
  onRenameCancel,
  isOver,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  column: (typeof COLUMNS)[number];
  goals: Goal[];
  catMap: Map<string, Category>;
  onMove: (id: string, status: ColumnId) => void;
  onEdit: (g: Goal) => void;
  onDelete: (id: string) => void;
  onAdd?: (status: ColumnId) => void;
  renamingId?: string | null;
  renameValue?: string;
  onRenameStart?: (g: Goal) => void;
  onRenameChange?: (v: string) => void;
  onRenameSave?: (id: string, title: string) => void;
  onRenameCancel?: () => void;
  isOver: boolean;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, goalId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, columnId: ColumnId) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, columnId: ColumnId) => void;
}) {
  const Icon = column.icon;

  return (
    <div
      onDragOver={(e) => onDragOver(e, column.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, column.id)}
      className={`flex flex-col min-h-[180px] rounded-2xl transition-all duration-200 p-2 ${
        isOver
          ? "bg-primary/8 ring-2 ring-primary/40 scale-[1.01]"
          : isDragging
            ? "bg-accent/20 ring-1 ring-border/40 ring-dashed"
            : ""
      }`}
    >
      {/* Column header */}
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <Icon className={`h-3.5 w-3.5 ${column.color}`} />
        <span className="text-xs font-semibold">{column.label}</span>
        <span className="text-[10px] text-muted-foreground/50 ml-auto">{goals.length}</span>
      </div>

      {/* Cards */}
      <div className="space-y-2 flex-1 overflow-y-auto">
        {goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Icon className="h-6 w-6 text-muted-foreground/15 mb-1.5" />
            <p className="text-[11px] text-muted-foreground/30">{column.emptyText}</p>
          </div>
        ) : (
          goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              catMap={catMap}
              currentColumn={column.id}
              onMove={onMove}
              onEdit={onEdit}
              onDelete={onDelete}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              renamingId={renamingId}
              renameValue={renameValue}
              onRenameStart={onRenameStart}
              onRenameChange={onRenameChange}
              onRenameSave={onRenameSave}
              onRenameCancel={onRenameCancel}
            />
          ))
        )}
      </div>

      {/* Add button at bottom */}
      {onAdd && column.id !== "cancelled" && (
        <button
          onClick={() => onAdd(column.id)}
          className="mt-2 flex items-center gap-1.5 px-2 py-1.5 w-full rounded-xl text-[11px] text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" />
          Добавить
        </button>
      )}
    </div>
  );
}

// ── Card ──
function GoalCard({
  goal,
  catMap,
  currentColumn,
  onMove,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
  renamingId,
  renameValue,
  onRenameStart,
  onRenameChange,
  onRenameSave,
  onRenameCancel,
}: {
  goal: Goal;
  catMap: Map<string, Category>;
  currentColumn: ColumnId;
  onMove: (id: string, status: ColumnId) => void;
  onEdit: (g: Goal) => void;
  onDelete: (id: string) => void;
  onDragStart: (e: React.DragEvent, goalId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  renamingId?: string | null;
  renameValue?: string;
  onRenameStart?: (g: Goal) => void;
  onRenameChange?: (v: string) => void;
  onRenameSave?: (id: string, title: string) => void;
  onRenameCancel?: () => void;
}) {
  const cat = goal.category_id ? catMap.get(goal.category_id) : null;
  const isCompleted = goal.status === "completed";
  const isArchived = goal.status === "cancelled";
  const isRenaming = renamingId === goal.id;

  const colIndex = COLUMNS.findIndex((c) => c.id === currentColumn);
  const prevCol = colIndex > 0 ? COLUMNS[colIndex - 1] : null;
  const nextCol = colIndex < COLUMNS.length - 1 ? COLUMNS[colIndex + 1] : null;

  return (
    <div
      draggable={!isRenaming}
      onDragStart={(e) => !isRenaming && onDragStart(e, goal.id)}
      onDragEnd={onDragEnd}
      className={`group rounded-xl border bg-card overflow-hidden transition-shadow hover:shadow-md ${
        isCompleted
          ? "border-green-500/20 opacity-80"
          : isArchived
            ? "border-border/30 opacity-60"
            : "border-border/40 hover:border-border/60"
      }`}
    >
      <div className="flex items-stretch">
        {/* Left arrow */}
        <button
          onClick={(e) => { e.stopPropagation(); prevCol && onMove(goal.id, prevCol.id); }}
          disabled={!prevCol}
          className={`flex items-center justify-center w-9 shrink-0 border-r border-border/20 transition-colors ${
            prevCol
              ? "text-muted-foreground/40 hover:bg-accent/60 hover:text-foreground active:bg-accent"
              : "text-muted-foreground/10 cursor-default"
          }`}
          title={prevCol?.label}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Main content */}
        <div className="flex-1 p-3 min-w-0">
          {/* Top row */}
          <div className="flex items-center gap-1.5 mb-1.5">
            {cat && (
              <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color || "#666" }} />
            )}
            {cat && <span className="text-[10px] text-muted-foreground truncate">{cat.name}</span>}
            <Badge variant="outline" className="text-[9px] px-1 py-0 ml-auto shrink-0 leading-tight">
              {LEVEL_LABELS[goal.level]}
            </Badge>
          </div>

          {/* Title */}
          {isRenaming ? (
            <input
              autoFocus
              value={renameValue ?? ""}
              onChange={(e) => onRenameChange?.(e.target.value)}
              onBlur={() => onRenameSave?.(goal.id, renameValue ?? "")}
              onKeyDown={(e) => {
                if (e.key === "Enter") onRenameSave?.(goal.id, renameValue ?? "");
                if (e.key === "Escape") onRenameCancel?.();
              }}
              className="text-[13px] font-medium w-full bg-input/50 border border-border/50 rounded-lg px-2 py-1 mb-1 outline-none focus:ring-1 focus:ring-primary/50"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <h3
              className={`text-[13px] font-medium leading-snug mb-1 cursor-pointer hover:text-primary transition-colors ${
                isCompleted ? "line-through text-muted-foreground/60" : ""
              }`}
              onClick={() => onEdit(goal)}
            >
              {goal.title}
            </h3>
          )}

          {/* Description */}
          {goal.description && (
            <p className="text-[10px] text-muted-foreground/50 line-clamp-2 mb-2">
              {goal.description}
            </p>
          )}

          {/* Date */}
          {(goal.target_date || goal.completed_at) && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40 mb-2">
              <Clock className="h-2.5 w-2.5" />
              {goal.completed_at
                ? new Date(goal.completed_at).toLocaleDateString("ru-RU")
                : `до ${new Date(goal.target_date!).toLocaleDateString("ru-RU")}`}
            </div>
          )}

          {/* Bottom: rename + delete */}
          <div className="flex items-center gap-0.5 pt-1.5 border-t border-border/20">
            {onRenameStart && (
              <button
                onClick={(e) => { e.stopPropagation(); onRenameStart(goal); }}
                className="p-1 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-accent/60 transition-colors"
                title="Переименовать"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(goal.id); }}
                className="ml-auto p-1 rounded-md text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Удалить"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Right arrow */}
          <button
            onClick={(e) => { e.stopPropagation(); nextCol && onMove(goal.id, nextCol.id); }}
            disabled={!nextCol}
            className={`flex items-center justify-center w-9 shrink-0 border-l border-border/20 transition-colors ${
              nextCol
                ? "text-muted-foreground/40 hover:bg-accent/60 hover:text-foreground active:bg-accent"
                : "text-muted-foreground/10 cursor-default"
            }`}
            title={nextCol?.label}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
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
  defaultStatus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: Goal | null;
  categories: Category[];
  allGoals: Goal[];
  onSaved: () => void;
  kanbanMode: KanbanMode;
  defaultStatus?: ColumnId;
}) {
  const isEdit = !!goal;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<Goal["level"]>("year");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [parentGoalId, setParentGoalId] = useState<string>("none");
  const [targetDate, setTargetDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
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
        setReminderTime(goal.reminder_time || "");
        setStatus(goal.status);
      } else {
        setTitle("");
        setDescription("");
        setLevel("year");
        setCategoryId("none");
        setParentGoalId("none");
        setTargetDate("");
        setReminderTime("");
        setStatus(defaultStatus ?? "deferred");
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
      reminder_time: reminderTime || null,
      tracking_type: "milestone" as const,
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Уровень</label>
              <Select value={level} onValueChange={(v) => setLevel(v as Goal["level"])}>
                <SelectTrigger className="h-11 bg-input/50 border-border/50">
                  <span className="truncate">{LEVEL_LABELS[level]}</span>
                </SelectTrigger>
                <SelectContent>
                  {LEVEL_ORDER.map((l) => (
                    <SelectItem key={l} value={l}>{LEVEL_LABELS[l]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Категория</label>
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "none")}>
                <SelectTrigger className="h-11 bg-input/50 border-border/50">
                  <span className="truncate">
                    {categoryId === "none"
                      ? "Без категории"
                      : categories.find((c) => c.id === categoryId)?.name || "Без категории"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без категории</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isEdit && (
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Статус</label>
              <Select value={status} onValueChange={(v) => setStatus(v as ColumnId)}>
                <SelectTrigger className="h-11 bg-input/50 border-border/50">
                  <span className="truncate">
                    {COLUMNS.find((c) => c.id === status)?.label || status}
                  </span>
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
                  <span className="truncate">
                    {parentGoalId === "none"
                      ? "Нет (верхний уровень)"
                      : (() => { const p = allGoals.find((g) => g.id === parentGoalId); return p ? `[${LEVEL_LABELS[p.level]}] ${p.title}` : "Нет"; })()}
                  </span>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Дедлайн</label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="h-11 bg-input/50 border-border/50"
                placeholder="дд.мм.гггг"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Время уведомления</label>
              <Input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="h-11 bg-input/50 border-border/50"
              />
            </div>
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
