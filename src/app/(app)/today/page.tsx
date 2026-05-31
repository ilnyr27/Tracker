"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  Check,
  Flame,
  Target,
  Trash2,
  Archive,
  Pencil,
  Bell,
  LayoutGrid,
  List,
  ChevronDown,
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

// Custom grip icon: 2 dots top, line middle, 2 dots bottom
function GripIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className}>
      <circle cx="5.5" cy="3" r="1.3" />
      <circle cx="10.5" cy="3" r="1.3" />
      <rect x="4" y="7" width="8" height="2" rx="1" />
      <circle cx="5.5" cy="13" r="1.3" />
      <circle cx="10.5" cy="13" r="1.3" />
    </svg>
  );
}

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
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [catMenuOpen, setCatMenuOpen] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [showGoals, setShowGoals] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("life_os_show_goals");
      return saved !== null ? saved === "true" : true; // default: shown
    }
    return true;
  });
  const [dragCatId, setDragCatId] = useState<string | null>(null);
  const [dragOverCatId, setDragOverCatId] = useState<string | null>(null);
  const [dragOverPos, setDragOverPos] = useState<"above" | "below">("below");
  const [userStatus, setUserStatus] = useState("Баланс — это прогресс");
  const [editingStatus, setEditingStatus] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("life_os_status");
    if (saved) setUserStatus(saved);
  }, []);

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

  async function saveEditCatName(id: string) {
    if (!editCatName.trim()) { setEditingCatId(null); return; }
    const supabase = createClient();
    setCategories((prev) => prev.map((c) => c.id === id ? { ...c, name: editCatName.trim() } : c));
    setEditingCatId(null);
    await supabase.from("categories").update({ name: editCatName.trim() }).eq("id", id);
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

  async function handleDrop(targetId: string) {
    if (!dragCatId || dragCatId === targetId) {
      setDragCatId(null);
      setDragOverCatId(null);
      return;
    }
    const oldIdx = categories.findIndex((c) => c.id === dragCatId);
    let newIdx = categories.findIndex((c) => c.id === targetId);
    if (oldIdx === -1 || newIdx === -1) return;

    // Adjust insert position based on cursor position
    if (dragOverPos === "below") newIdx = Math.min(newIdx + 1, categories.length);
    if (oldIdx < newIdx) newIdx--;

    const reordered = [...categories];
    const [moved] = reordered.splice(oldIdx, 1);
    reordered.splice(newIdx, 0, moved);
    setCategories(reordered);
    setDragCatId(null);
    setDragOverCatId(null);

    // Persist new order
    const supabase = createClient();
    await Promise.all(
      reordered.map((cat, i) =>
        supabase.from("categories").update({ sort_order: i }).eq("id", cat.id)
      )
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-28 md:px-6 md:pb-6">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text tracking-tight">Life OS</h1>
          {editingStatus ? (
            <input
              value={userStatus}
              onChange={(e) => setUserStatus(e.target.value)}
              onBlur={() => { setEditingStatus(false); localStorage.setItem("life_os_status", userStatus); }}
              onKeyDown={(e) => { if (e.key === "Enter") { setEditingStatus(false); localStorage.setItem("life_os_status", userStatus); } }}
              autoFocus
              className="text-sm text-muted-foreground mt-1 bg-transparent border-b border-primary/30 outline-none w-full max-w-[250px]"
              placeholder="Напиши свой статус..."
            />
          ) : (
            <p
              className="text-sm text-muted-foreground mt-1 cursor-pointer hover:text-muted-foreground/80 transition-colors"
              onClick={() => setEditingStatus(true)}
              title="Нажми чтобы изменить"
            >
              {userStatus}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {viewMode === "list" && (
            <button
              onClick={() => { const next = !showGoals; setShowGoals(next); localStorage.setItem("life_os_show_goals", String(next)); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${showGoals ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent/50"}`}
            >
              Все цели
              <ChevronDown className={`h-3 w-3 transition-transform ${showGoals ? "rotate-180" : ""}`} />
            </button>
          )}
          <div className="flex bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Category cards */}
      {loading ? (
        <div className={viewMode === "grid" ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" : "space-y-2"}>
          {[...Array(viewMode === "grid" ? 10 : 5)].map((_, i) => (
            <div key={i} className={viewMode === "grid" ? "h-40 rounded-2xl bg-card animate-pulse" : "h-16 rounded-2xl bg-card animate-pulse"} />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode}
            variants={container}
            initial="hidden"
            animate="show"
            className={viewMode === "grid"
              ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              : "space-y-2"
            }
          >
            {categories.map((cat) => {
              const catGoals = goalsByCategory.get(cat.id) || [];
              const percent = getCategoryPercent(cat.id);
              const emoji = getEmoji(cat);
              const goalsCount = catGoals.length;

              if (viewMode === "list") {
                return (
                  <motion.div
                    key={cat.id}
                    variants={item}
                    draggable
                    onDragStart={() => setDragCatId(cat.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      const rect = e.currentTarget.getBoundingClientRect();
                      setDragOverCatId(cat.id);
                      setDragOverPos(e.clientY < rect.top + rect.height / 2 ? "above" : "below");
                    }}
                    onDragEnd={() => { setDragCatId(null); setDragOverCatId(null); }}
                    onDrop={(e) => { e.preventDefault(); handleDrop(cat.id); }}
                    className={`relative rounded-2xl border bg-card transition-all ${
                      dragCatId === cat.id
                        ? "opacity-50 border-border/30"
                        : "border-border/40 hover:shadow-md hover:border-border/60"
                    }`}
                  >
                    {/* Drag insertion line — above */}
                    {dragOverCatId === cat.id && dragCatId !== cat.id && dragOverPos === "above" && (
                      <div className="absolute -top-1.5 left-2 right-2 h-0.5 bg-primary rounded-full z-10" />
                    )}
                    {/* Drag insertion line — below */}
                    {dragOverCatId === cat.id && dragCatId !== cat.id && dragOverPos === "below" && (
                      <div className="absolute -bottom-1.5 left-2 right-2 h-0.5 bg-primary rounded-full z-10" />
                    )}
                    <div
                      className="w-1 absolute left-0 top-0 bottom-0 rounded-l-2xl"
                      style={{ backgroundColor: cat.color || "#666" }}
                    />
                    <div className="flex items-center">
                      {/* Grip/Menu button: tap=menu, hold=drag */}
                      <div
                        className="pl-3 pr-1 py-3 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors select-none"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          const timer = setTimeout(() => {
                            // Long press — start drag
                            const el = e.currentTarget.closest("[draggable]") as HTMLElement;
                            if (el) el.style.cursor = "grabbing";
                            setDragCatId(cat.id);
                          }, 300);
                          const up = () => {
                            clearTimeout(timer);
                            document.removeEventListener("mouseup", up);
                          };
                          document.addEventListener("mouseup", up);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (dragCatId) return; // was dragging
                          setCatMenuOpen(catMenuOpen === cat.id ? null : cat.id);
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          const timer = setTimeout(() => {
                            setDragCatId(cat.id);
                          }, 400);
                          const end = () => {
                            clearTimeout(timer);
                            document.removeEventListener("touchend", end);
                          };
                          document.addEventListener("touchend", end);
                        }}
                      >
                        <GripIcon className="h-4 w-4" />
                      </div>

                      {/* Context menu */}
                      <AnimatePresence>
                        {catMenuOpen === cat.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-12 left-3 z-20 bg-popover border border-border/50 rounded-xl shadow-lg py-1 min-w-[140px]"
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); setCatMenuOpen(null); setEditingCatId(cat.id); setEditCatName(cat.name); setGoalDialogCatId(cat.id); setGoalDialogOpen(true); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent/50 transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Переименовать
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); archiveCategory(cat.id); setCatMenuOpen(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent/50 text-amber-500 transition-colors"
                            >
                              <Archive className="h-3.5 w-3.5" /> В архив
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id); setCatMenuOpen(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-destructive/10 text-destructive transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Удалить
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Main clickable area */}
                      <button
                        onClick={() => { setCatMenuOpen(null); openAddGoal(cat.id); }}
                        className="flex items-center gap-3 flex-1 pr-4 py-3 text-left min-w-0"
                      >
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
                          style={{ backgroundColor: `${cat.color || "var(--primary)"}15` }}
                        >
                          {emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold block truncate">{cat.name}</span>
                          <span className="text-xs text-muted-foreground/60">
                            {goalsCount} {goalsCount === 1 ? "цель" : goalsCount < 5 ? "цели" : "целей"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden hidden sm:block">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ backgroundColor: cat.color || "var(--primary)" }}
                              initial={{ width: 0 }}
                              animate={{ width: `${percent}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                            />
                          </div>
                          <span
                            className="text-sm font-bold tabular-nums"
                            style={{ color: cat.color || "var(--primary)" }}
                          >
                            {percent}%
                          </span>
                        </div>
                      </button>
                    </div>

                    {/* Expanded goals list */}
                    <AnimatePresence>
                      {showGoals && catGoals.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-border/20 px-4 pl-12 pb-2 pt-1">
                            {catGoals.map((goal, idx) => {
                              const prog = goalProgress.get(goal.id);
                              const isHabit = goal.tracking_type === "habit";
                              const done = prog?.done || 0;
                              const target = goal.target_days || 0;
                              const isInfinite = target >= 99999;
                              return (
                                <div
                                  key={goal.id}
                                  className="flex items-center gap-2 py-1.5 text-sm"
                                >
                                  <span className="text-xs text-muted-foreground/40 w-4 shrink-0">{idx + 1}.</span>
                                  <span className="flex-1 truncate">{goal.title}</span>
                                  {isHabit ? (
                                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                                      {done}/{isInfinite ? "∞" : target}
                                    </span>
                                  ) : (
                                    <span className={`text-[11px] shrink-0 ${goal.status === "completed" ? "text-green-500" : "text-muted-foreground/50"}`}>
                                      {goal.status === "completed" ? "Готово" : "В процессе"}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              }

              // Grid view (default)
              return (
                <motion.div
                  key={cat.id}
                  variants={item}
                  draggable
                  onDragStart={() => setDragCatId(cat.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setDragOverCatId(cat.id);
                    setDragOverPos(e.clientY < rect.top + rect.height / 2 ? "above" : "below");
                  }}
                  onDragEnd={() => { setDragCatId(null); setDragOverCatId(null); }}
                  onDrop={(e) => { e.preventDefault(); handleDrop(cat.id); }}
                  className={`relative rounded-3xl border bg-card p-5 flex flex-col items-start text-left gap-3 transition-all min-h-[160px] ${
                    dragCatId === cat.id
                      ? "opacity-50 border-border/30"
                      : "border-border/40 hover:shadow-lg hover:border-border/60"
                  }`}
                >
                  {/* Drag insertion line */}
                  {dragOverCatId === cat.id && dragCatId !== cat.id && dragOverPos === "above" && (
                    <div className="absolute -top-1.5 left-3 right-3 h-0.5 bg-primary rounded-full z-10" />
                  )}
                  {dragOverCatId === cat.id && dragCatId !== cat.id && dragOverPos === "below" && (
                    <div className="absolute -bottom-1.5 left-3 right-3 h-0.5 bg-primary rounded-full z-10" />
                  )}
                  {/* Grip/Menu button: tap=menu, hold=drag */}
                  <div
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/60 transition-all z-10 select-none"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const timer = setTimeout(() => {
                        setDragCatId(cat.id);
                      }, 300);
                      const up = () => {
                        clearTimeout(timer);
                        document.removeEventListener("mouseup", up);
                      };
                      document.addEventListener("mouseup", up);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (dragCatId) return;
                      setCatMenuOpen(catMenuOpen === cat.id ? null : cat.id);
                    }}
                  >
                    <GripIcon className="h-4 w-4" />
                  </div>

                  {/* Dropdown menu */}
                  <AnimatePresence>
                    {catMenuOpen === cat.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-10 right-2 z-20 bg-popover border border-border/50 rounded-xl shadow-lg py-1 min-w-[140px]"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCatMenuOpen(null);
                            setEditingCatId(cat.id);
                            setEditCatName(cat.name);
                            setGoalDialogCatId(cat.id);
                            setGoalDialogOpen(true);
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent/50 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Переименовать
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); archiveCategory(cat.id); setCatMenuOpen(null); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent/50 text-amber-500 transition-colors"
                        >
                          <Archive className="h-3.5 w-3.5" /> В архив
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id); setCatMenuOpen(null); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-destructive/10 text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Удалить
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Clickable area */}
                  <button
                    onClick={() => { setCatMenuOpen(null); openAddGoal(cat.id); }}
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
              className={viewMode === "grid"
                ? "rounded-2xl border-2 border-dashed border-border/30 flex flex-col items-center justify-center gap-2 text-muted-foreground/40 hover:border-primary/40 hover:text-primary/60 transition-all cursor-pointer min-h-[140px]"
                : "rounded-2xl border-2 border-dashed border-border/30 flex items-center justify-center gap-2 text-muted-foreground/40 hover:border-primary/40 hover:text-primary/60 transition-all cursor-pointer py-4"
              }
            >
              <Plus className={viewMode === "grid" ? "h-7 w-7" : "h-5 w-5"} />
              <span className="text-xs font-medium">Добавить категорию</span>
            </motion.button>
          </motion.div>
        </AnimatePresence>
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
        editingCatId={editingCatId}
        editCatName={editCatName}
        setEditingCatId={setEditingCatId}
        setEditCatName={setEditCatName}
        saveEditCatName={saveEditCatName}
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

// --- Swipeable Goal Card ---

function SwipeableGoalCard({
  goal, isHabit, isInfinite, done, target, percent, cat,
  editingGoalId, editTitle, confirmDeleteId,
  onEditStart, onEditChange, onEditSave, onEditCancel,
  onArchive, onDelete, onConfirmDeleteStart, onConfirmDeleteCancel,
  onToggleMilestone, onTargetDaysChange,
}: {
  goal: Goal;
  isHabit: boolean;
  isInfinite: boolean;
  done: number;
  target: number;
  percent: number;
  cat: Category | undefined;
  editingGoalId: string | null;
  editTitle: string;
  confirmDeleteId: string | null;
  onEditStart: () => void;
  onEditChange: (v: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onConfirmDeleteStart: () => void;
  onConfirmDeleteCancel: () => void;
  onToggleMilestone: () => void;
  onTargetDaysChange: (days: number) => void;
}) {
  const [swipeX, setSwipeX] = useState(0);
  const [editingTarget, setEditingTarget] = useState(false);
  const [editTargetVal, setEditTargetVal] = useState("");
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiping = useRef(false);

  function handleTouchStart(e: React.TouchEvent) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    swiping.current = false;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!touchStart.current) return;
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = e.touches[0].clientY - touchStart.current.y;
    // Only swipe if horizontal movement > vertical
    if (!swiping.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      swiping.current = true;
    }
    if (swiping.current) {
      setSwipeX(dx);
    }
  }

  function handleTouchEnd() {
    if (swipeX < -80) {
      onArchive();
    } else if (swipeX > 80) {
      onConfirmDeleteStart();
    }
    setSwipeX(0);
    touchStart.current = null;
    swiping.current = false;
  }

  const isEditing = editingGoalId === goal.id;
  const isConfirmingDelete = confirmDeleteId === goal.id;

  // Delete confirmation overlay
  if (isConfirmingDelete) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-center mb-3">Удалить «{goal.title}»?</p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={onConfirmDeleteCancel}
            className="px-4 py-2 text-sm rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 text-sm rounded-lg bg-destructive text-white hover:bg-destructive/90 transition-colors"
          >
            Удалить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* Swipe backgrounds */}
      {swipeX !== 0 && (
        <>
          {swipeX < 0 && (
            <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-end pr-4 rounded-xl">
              <Archive className="h-5 w-5 text-amber-500" />
            </div>
          )}
          {swipeX > 0 && (
            <div className="absolute inset-0 bg-destructive/15 flex items-center justify-start pl-4 rounded-xl">
              <Trash2 className="h-5 w-5 text-destructive" />
            </div>
          )}
        </>
      )}

      {/* Card content */}
      <div
        className="relative rounded-xl border border-border/30 p-4 bg-card transition-transform"
        style={{ transform: swipeX !== 0 ? `translateX(${swipeX}px)` : undefined }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Inline edit mode */}
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              value={editTitle}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onEditSave();
                if (e.key === "Escape") onEditCancel();
              }}
              autoFocus
              className="h-9 text-sm flex-1"
            />
            <button
              onClick={onEditSave}
              className="p-1.5 rounded-md text-emerald-500 hover:bg-emerald-500/10"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : isHabit ? (
          isInfinite ? (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium cursor-text" onClick={onEditStart}>{goal.title}</span>
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
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium cursor-text" onClick={onEditStart}>{goal.title}</span>
                {editingTarget ? (
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground tabular-nums">{done}/</span>
                    <input
                      type="number"
                      value={editTargetVal}
                      onChange={(e) => setEditTargetVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const v = parseInt(editTargetVal);
                          if (v > 0) onTargetDaysChange(v);
                          setEditingTarget(false);
                        }
                        if (e.key === "Escape") setEditingTarget(false);
                      }}
                      onBlur={() => {
                        const v = parseInt(editTargetVal);
                        if (v > 0) onTargetDaysChange(v);
                        setEditingTarget(false);
                      }}
                      autoFocus
                      className="w-12 h-6 text-sm text-center rounded border border-primary/50 bg-input/50 outline-none tabular-nums"
                    />
                  </div>
                ) : (
                  <span
                    className="text-sm text-muted-foreground tabular-nums cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => { setEditingTarget(true); setEditTargetVal(String(target)); }}
                    title="Нажми чтобы изменить цель"
                  >
                    {done}/{target}{" "}
                    <span className="font-semibold" style={{ color: cat?.color || "var(--primary)" }}>
                      {percent}%
                    </span>
                  </span>
                )}
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
            onClick={onToggleMilestone}
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
            <span
              className={`text-sm flex-1 ${goal.status === "completed" ? "line-through text-muted-foreground/50" : ""}`}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onEditStart(); }}
            >
              {goal.title}
            </span>
          </button>
        )}

        {/* Desktop action buttons — centered below content */}
        {!isEditing && (
          <div className="hidden md:flex items-center justify-center gap-1 mt-3 pt-2 border-t border-border/20">
            <button
              onClick={onEditStart}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <Pencil className="h-3 w-3" /> Изменить
            </button>
            <button
              onClick={onArchive}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-muted-foreground/60 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
            >
              <Archive className="h-3 w-3" /> Архив
            </button>
            <button
              onClick={onConfirmDeleteStart}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3 w-3" /> Удалить
            </button>
          </div>
        )}
      </div>
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
  editingCatId,
  editCatName,
  setEditingCatId,
  setEditCatName,
  saveEditCatName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string | null;
  categories: Category[];
  goals: Goal[];
  goalProgress: Map<string, { done: number; total: number }>;
  goalsByCategory: Map<string, Goal[]>;
  onDataChanged: () => void;
  editingCatId: string | null;
  editCatName: string;
  setEditingCatId: (id: string | null) => void;
  setEditCatName: (name: string) => void;
  saveEditCatName: (id: string) => Promise<void>;
}) {
  const [addMode, setAddMode] = useState(false);
  const [title, setTitle] = useState("");
  const [trackingType, setTrackingType] = useState<"habit" | "milestone">("habit");
  const [targetDays, setTargetDays] = useState("30");
  const [recurrenceMode, setRecurrenceMode] = useState<"daily" | "weekly" | "advanced">("daily");
  const [weekDays, setWeekDays] = useState<number[]>([]);
  const [advancedType, setAdvancedType] = useState<"nth_weekday" | "biweekly">("nth_weekday");
  const [advancedWeekday, setAdvancedWeekday] = useState(1); // 1=Mon
  const [advancedNth, setAdvancedNth] = useState(1); // 1st occurrence
  const [reminderTime, setReminderTime] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [saving, setSaving] = useState(false);

  const cat = categories.find((c) => c.id === categoryId);
  const catGoals = categoryId ? (goalsByCategory.get(categoryId) || []) : [];

  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAddMode(false);
      setTitle("");
      setTrackingType("habit");
      setTargetDays("30");
      setRecurrenceMode("daily");
      setWeekDays([]);
      setReminderTime("");
      setReminderDate("");
      setEditingGoalId(null);
      setConfirmDeleteId(null);
    }
  }, [open]);

  async function deleteGoal(goalId: string) {
    const supabase = createClient();
    await supabase.from("goals").delete().eq("id", goalId);
    onDataChanged();
  }

  async function archiveGoal(goalId: string) {
    const supabase = createClient();
    await supabase.from("goals").update({ status: "cancelled" }).eq("id", goalId);
    onDataChanged();
  }

  async function saveEditGoal(goalId: string) {
    if (!editTitle.trim()) return;
    const supabase = createClient();
    await supabase.from("goals").update({ title: editTitle.trim() }).eq("id", goalId);
    setEditingGoalId(null);
    onDataChanged();
  }

  async function handleAddGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !categoryId) return;
    setSaving(true);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const goalPayload: Record<string, unknown> = {
      user_id: userData.user.id,
      category_id: categoryId,
      title: title.trim(),
      tracking_type: trackingType,
      target_days: trackingType === "habit" ? (targetDays === "∞" ? 99999 : parseInt(targetDays) || 30) : null,
      level: "month",
      sort_order: 0,
    };
    if (reminderTime) goalPayload.reminder_time = reminderTime;
    if (reminderDate) goalPayload.reminder_date = reminderDate;

    let { data: goalData, error: goalError } = await supabase.from("goals").insert(goalPayload).select().single();

    // If insert failed, retry without optional columns (migration may not be applied)
    if (goalError && (reminderTime || reminderDate)) {
      const fallback = { ...goalPayload };
      delete fallback.reminder_time;
      delete fallback.reminder_date;
      const res = await supabase.from("goals").insert(fallback).select().single();
      goalData = res.data;
      goalError = res.error;
    }

    if (goalError) {
      setSaving(false);
      return;
    }

    // Create task template for non-daily recurrence
    if (trackingType === "habit" && goalData) {
      try {
        if (recurrenceMode === "weekly" && weekDays.length > 0) {
          const tmplPayload: Record<string, unknown> = {
            user_id: userData.user.id,
            goal_id: goalData.id,
            category_id: categoryId,
            title: title.trim(),
            recurrence: "weekly",
            recurrence_days: weekDays,
            sort_order: 0,
          };
          if (reminderTime) tmplPayload.reminder_time = reminderTime;
          await supabase.from("task_templates").insert(tmplPayload);
        } else if (recurrenceMode === "advanced") {
          const tmplPayload: Record<string, unknown> = {
            user_id: userData.user.id,
            goal_id: goalData.id,
            category_id: categoryId,
            title: title.trim(),
            recurrence: "custom",
            recurrence_days: [],
            sort_order: 0,
          };
          tmplPayload.recurrence_rule = {
            type: advancedType,
            weekday: advancedWeekday,
            ...(advancedType === "nth_weekday" ? { nth: advancedNth } : {}),
            ...(advancedType === "biweekly" ? { anchor_date: new Date().toISOString().slice(0, 10) } : {}),
          };
          if (reminderTime) tmplPayload.reminder_time = reminderTime;
          await supabase.from("task_templates").insert(tmplPayload);
        }
      } catch {
        // Template creation may fail if migrations 004/005 not applied — goal still saved
      }
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
            {cat && editingCatId === cat.id ? (
              <Input
                value={editCatName}
                onChange={(e) => setEditCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEditCatName(cat.id);
                  if (e.key === "Escape") setEditingCatId(null);
                }}
                onBlur={() => saveEditCatName(cat.id)}
                autoFocus
                className="h-9 text-lg font-semibold flex-1"
                style={{ color: cat.color || undefined }}
              />
            ) : (
              <span
                className="cursor-text"
                style={{ color: cat?.color || undefined }}
                onClick={() => { if (cat) { setEditingCatId(cat.id); setEditCatName(cat.name); } }}
              >
                {cat?.name || "Цели"}
              </span>
            )}
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
              <SwipeableGoalCard
                key={goal.id}
                goal={goal}
                isHabit={isHabit}
                isInfinite={isInfinite}
                done={done}
                target={target}
                percent={percent}
                cat={cat}
                editingGoalId={editingGoalId}
                editTitle={editTitle}
                confirmDeleteId={confirmDeleteId}
                onEditStart={() => { setEditingGoalId(goal.id); setEditTitle(goal.title); }}
                onEditChange={setEditTitle}
                onEditSave={() => saveEditGoal(goal.id)}
                onEditCancel={() => setEditingGoalId(null)}
                onArchive={() => archiveGoal(goal.id)}
                onDelete={() => deleteGoal(goal.id)}
                onConfirmDeleteStart={() => setConfirmDeleteId(goal.id)}
                onConfirmDeleteCancel={() => setConfirmDeleteId(null)}
                onToggleMilestone={() => toggleMilestone(goal)}
                onTargetDaysChange={async (days) => {
                  const supabase = createClient();
                  await supabase.from("goals").update({ target_days: days }).eq("id", goal.id);
                  onDataChanged();
                }}
              />
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
                  {([
                    { mode: "daily" as const, label: "Каждый день" },
                    { mode: "weekly" as const, label: "По дням" },
                    { mode: "advanced" as const, label: "Расширенное" },
                  ]).map(({ mode, label }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setRecurrenceMode(mode)}
                      className={`flex-1 py-2 transition-colors ${
                        recurrenceMode === mode ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent/50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Weekly day picker */}
                {recurrenceMode === "weekly" && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">В какие дни?</label>
                    <div className="flex gap-1.5">
                      {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((name, i) => {
                        const dayNum = i === 6 ? 0 : i + 1;
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

                {/* Advanced recurrence picker */}
                {recurrenceMode === "advanced" && (
                  <div className="space-y-3">
                    {/* Type selector */}
                    <div className="flex rounded-xl border border-border/50 overflow-hidden text-xs">
                      <button
                        type="button"
                        onClick={() => setAdvancedType("nth_weekday")}
                        className={`flex-1 py-2 transition-colors ${
                          advancedType === "nth_weekday" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent/50"
                        }`}
                      >
                        N-й день месяца
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdvancedType("biweekly")}
                        className={`flex-1 py-2 transition-colors ${
                          advancedType === "biweekly" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent/50"
                        }`}
                      >
                        Через неделю
                      </button>
                    </div>

                    {/* Weekday selector */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">День недели</label>
                      <div className="flex gap-1.5">
                        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((name, i) => {
                          const dayNum = i === 6 ? 0 : i + 1;
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setAdvancedWeekday(dayNum)}
                              className={`flex-1 py-2 text-xs rounded-xl font-medium transition-all ${
                                advancedWeekday === dayNum
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

                    {/* Nth occurrence (only for nth_weekday) */}
                    {advancedType === "nth_weekday" && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">Какой по счёту?</label>
                        <div className="flex gap-1.5">
                          {[
                            { value: 1, label: "1-й" },
                            { value: 2, label: "2-й" },
                            { value: 3, label: "3-й" },
                            { value: 4, label: "4-й" },
                            { value: -1, label: "Послед." },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setAdvancedNth(opt.value)}
                              className={`flex-1 py-2 text-xs rounded-xl font-medium transition-all ${
                                advancedNth === opt.value
                                  ? "gradient-primary text-white"
                                  : "bg-muted text-muted-foreground hover:bg-accent"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Preview label */}
                    <p className="text-[10px] text-muted-foreground/60 italic">
                      {advancedType === "nth_weekday"
                        ? `Каждую ${advancedNth === -1 ? "последнюю" : advancedNth + "-ю"} ${["воскресенье","понедельник","вторник","среду","четверг","пятницу","субботу"][advancedWeekday]} месяца`
                        : `Через неделю: ${["Вс","Пн","Вт","Ср","Чт","Пт","Сб"][advancedWeekday]}`
                      }
                    </p>
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
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { value: "7", label: "1 нед" },
                    { value: "14", label: "2 нед" },
                    { value: "30", label: "1 мес" },
                    { value: "90", label: "3 мес" },
                    { value: "365", label: "1 год" },
                    { value: "∞", label: "∞" },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setTargetDays(preset.value)}
                      className={`flex-1 min-w-[48px] py-1.5 text-xs rounded-lg border transition-all ${
                        targetDays === preset.value
                          ? "border-primary/50 bg-primary/10 text-primary font-medium"
                          : "border-border/30 text-muted-foreground"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Reminder */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Bell className="h-3 w-3" /> Напоминание
              </label>
              <div className="flex items-center gap-2">
                {trackingType === "milestone" && (
                  <input
                    type="date"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className="flex-1 h-11 rounded-xl border border-border/50 bg-input/50 px-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  />
                )}
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="flex-1 h-11 rounded-xl border border-border/50 bg-input/50 px-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
                {(reminderTime || reminderDate) && (
                  <button
                    type="button"
                    onClick={() => { setReminderTime(""); setReminderDate(""); }}
                    className="p-2 rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {reminderTime && (
                <p className="text-[10px] text-muted-foreground/50 mt-1">
                  Уведомление придёт в {reminderTime}
                </p>
              )}
            </div>

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

