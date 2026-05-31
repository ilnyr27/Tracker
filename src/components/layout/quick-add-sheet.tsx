"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ListTodo, StickyNote, Camera, Send, ChevronLeft, Kanban, BookOpen, Table2, Settings2, Plus, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import type { Category, CustomTab } from "@/lib/supabase/types";

const STORAGE_KEY = "quick_add_items";

// Built-in shortcut definitions
type BuiltinShortcut = {
  id: string;
  label: string;
  icon: string;
  color: string;
  type: "action" | "link";
  action?: "task" | "note";
  href?: string;
};

const BUILTIN_SHORTCUTS: BuiltinShortcut[] = [
  { id: "task", label: "Задача", icon: "list-todo", color: "#3b82f6", type: "action", action: "task" },
  { id: "note", label: "Заметка", icon: "sticky-note", color: "#8b5cf6", type: "action", action: "note" },
  { id: "photo", label: "Фото", icon: "camera", color: "#ec4899", type: "link", href: "/photos" },
  { id: "kanban", label: "Канбан", icon: "kanban", color: "#14b8a6", type: "link", href: "/goals" },
  { id: "journal", label: "Журнал", icon: "book-open", color: "#f59e0b", type: "link", href: "/journal" },
  { id: "sheets", label: "Листы", icon: "table-2", color: "#22c55e", type: "link", href: "/sheets" },
];

const DEFAULT_IDS = ["task", "note", "photo", "kanban", "journal", "sheets"];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  "list-todo": ListTodo,
  "sticky-note": StickyNote,
  "camera": Camera,
  "kanban": Kanban,
  "book-open": BookOpen,
  "table-2": Table2,
};

function getStoredIds(): string[] {
  if (typeof window === "undefined") return DEFAULT_IDS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_IDS;
    return JSON.parse(raw) as string[];
  } catch {
    return DEFAULT_IDS;
  }
}

function saveStoredIds(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

type QuickAddSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Mode = "menu" | "task" | "note" | "edit";

export function QuickAddSheet({ open, onOpenChange }: QuickAddSheetProps) {
  const [mode, setMode] = useState<Mode>("menu");
  const [categories, setCategories] = useState<Category[]>([]);
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeIds, setActiveIds] = useState<string[]>(getStoredIds);

  const loadCategories = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    if (data) setCategories(data);
  }, []);

  const loadCustomTabs = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("custom_tabs")
      .select("*")
      .order("sort_order");
    if (data) setCustomTabs(data);
  }, []);

  useEffect(() => {
    if (open) {
      if (categories.length === 0) loadCategories();
      if (customTabs.length === 0) loadCustomTabs();
    }
  }, [open, categories.length, customTabs.length, loadCategories, loadCustomTabs]);

  // Build the full list of available shortcuts (builtins + custom tabs)
  function getAllShortcuts(): (BuiltinShortcut | { id: string; label: string; icon: string | null; color: string; type: "link"; href: string; tabIcon?: string })[] {
    const all: (BuiltinShortcut | { id: string; label: string; icon: string | null; color: string; type: "link"; href: string; tabIcon?: string })[] = [
      ...BUILTIN_SHORTCUTS,
    ];
    for (const tab of customTabs) {
      all.push({
        id: `tab-${tab.id}`,
        label: tab.name,
        icon: tab.icon,
        color: tab.tab_type === "table" ? "#0ea5e9" : tab.tab_type === "list" ? "#a855f7" : "#6366f1",
        type: "link",
        href: `/sheets?tab=${tab.id}`,
        tabIcon: tab.icon || undefined,
      });
    }
    return all;
  }

  function reset() {
    setMode("menu");
    setTaskTitle("");
    setNoteText("");
    setSelectedCat(null);
    setSaving(false);
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) reset();
    onOpenChange(isOpen);
  }

  async function handleAddTask() {
    if (!taskTitle.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const today = format(new Date(), "yyyy-MM-dd");
    await supabase.from("tasks").insert({
      user_id: userData.user.id,
      category_id: selectedCat,
      title: taskTitle.trim(),
      scheduled_date: today,
      sort_order: 0,
    });

    setTaskTitle("");
    setSaving(false);
    handleClose(false);
    window.location.reload();
  }

  async function handleAddNote() {
    if (!noteText.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const today = format(new Date(), "yyyy-MM-dd");
    await supabase.from("notes").insert({
      user_id: userData.user.id,
      note_date: today,
      content: noteText.trim(),
    });

    setNoteText("");
    setSaving(false);
    handleClose(false);
  }

  function toggleShortcut(id: string) {
    setActiveIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveStoredIds(next);
      return next;
    });
  }

  const allShortcuts = getAllShortcuts();
  const visibleShortcuts = activeIds
    .map((id) => allShortcuts.find((s) => s.id === id))
    .filter(Boolean) as typeof allShortcuts;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-3xl border-border/30 bg-card/95 backdrop-blur-xl" showCloseButton={false}>
        <SheetHeader>
          <SheetTitle className="text-base flex items-center gap-2">
            {mode !== "menu" && (
              <button
                onClick={() => setMode("menu")}
                className="p-1 -ml-1 rounded-lg hover:bg-accent/50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <span className="flex-1">
              {mode === "menu" && "Быстрое добавление"}
              {mode === "task" && "Новая задача"}
              {mode === "note" && "Новая заметка"}
              {mode === "edit" && "Настроить ярлыки"}
            </span>
            {mode === "menu" && (
              <button
                onClick={() => setMode("edit")}
                className="p-1.5 rounded-lg hover:bg-accent/50 transition-colors text-muted-foreground"
              >
                <Settings2 className="h-4 w-4" />
              </button>
            )}
          </SheetTitle>
        </SheetHeader>

        <AnimatePresence mode="wait">
          {mode === "menu" && (
            <motion.div
              key="menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-3 gap-3 py-4"
            >
              {visibleShortcuts.map((shortcut, i) => {
                const isAction = shortcut.type === "action" && "action" in shortcut;
                const IconComp = "icon" in shortcut && shortcut.icon && ICON_MAP[shortcut.icon as string];
                const isCustomTab = shortcut.id.startsWith("tab-");
                const tabEmoji = isCustomTab && shortcut.icon;

                const inner = (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex h-24 flex-col items-center justify-center gap-2.5 rounded-2xl border border-border/30 bg-accent/30 hover:bg-accent/50 transition-colors"
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                      style={{ backgroundColor: `${shortcut.color}20` }}
                    >
                      {tabEmoji ? (
                        <span>{tabEmoji}</span>
                      ) : IconComp ? (
                        <IconComp className="h-5 w-5" style={{ color: shortcut.color }} />
                      ) : (
                        <Table2 className="h-5 w-5" style={{ color: shortcut.color }} />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-1 px-1">{shortcut.label}</span>
                  </motion.div>
                );

                if (isAction) {
                  return (
                    <motion.button
                      key={shortcut.id}
                      onClick={() => setMode((shortcut as BuiltinShortcut).action as Mode)}
                    >
                      {inner}
                    </motion.button>
                  );
                }

                return (
                  <Link key={shortcut.id} href={(shortcut as { href: string }).href} onClick={() => handleClose(false)}>
                    {inner}
                  </Link>
                );
              })}
            </motion.div>
          )}

          {mode === "edit" && (
            <motion.div
              key="edit"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="py-4 space-y-3 max-h-[60vh] overflow-y-auto"
            >
              <p className="text-xs text-muted-foreground">Выберите какие ярлыки показывать</p>

              {/* Active shortcuts */}
              {activeIds.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground/60 uppercase tracking-wide">Активные</span>
                  {activeIds.map((id) => {
                    const s = allShortcuts.find((x) => x.id === id);
                    if (!s) return null;
                    const IconComp = "icon" in s && s.icon && ICON_MAP[s.icon as string];
                    const isTab = s.id.startsWith("tab-");
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-accent/30 border border-border/20"
                      >
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 text-sm"
                          style={{ backgroundColor: `${s.color}20` }}
                        >
                          {isTab && s.icon ? (
                            <span>{s.icon}</span>
                          ) : IconComp ? (
                            <IconComp className="h-4 w-4" style={{ color: s.color }} />
                          ) : (
                            <Table2 className="h-4 w-4" style={{ color: s.color }} />
                          )}
                        </div>
                        <span className="text-sm flex-1">{s.label}</span>
                        <button
                          onClick={() => toggleShortcut(id)}
                          className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Available shortcuts to add */}
              {(() => {
                const inactive = allShortcuts.filter((s) => !activeIds.includes(s.id));
                if (inactive.length === 0) return null;
                return (
                  <div className="space-y-1.5">
                    <span className="text-xs text-muted-foreground/60 uppercase tracking-wide">Доступные</span>
                    {inactive.map((s) => {
                      const IconComp = "icon" in s && s.icon && ICON_MAP[s.icon as string];
                      const isTab = s.id.startsWith("tab-");
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleShortcut(s.id)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/30 border border-dashed border-border/20 w-full text-left transition-colors"
                        >
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 text-sm opacity-60"
                            style={{ backgroundColor: `${s.color}15` }}
                          >
                            {isTab && s.icon ? (
                              <span>{s.icon}</span>
                            ) : IconComp ? (
                              <IconComp className="h-4 w-4" style={{ color: s.color }} />
                            ) : (
                              <Table2 className="h-4 w-4" style={{ color: s.color }} />
                            )}
                          </div>
                          <span className="text-sm flex-1 text-muted-foreground">{s.label}</span>
                          <Plus className="h-4 w-4 text-primary/60" />
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </motion.div>
          )}

          {mode === "task" && (
            <motion.div
              key="task"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="py-4 space-y-3"
            >
              {/* Category selector */}
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCat(selectedCat === cat.id ? null : cat.id)}
                    className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                      selectedCat === cat.id
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-border/30 text-muted-foreground hover:border-border/60"
                    }`}
                    style={selectedCat === cat.id ? { borderColor: cat.color || undefined } : undefined}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Task input */}
              <div className="flex gap-2 items-end">
                <input
                  autoFocus
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && taskTitle.trim()) handleAddTask();
                  }}
                  placeholder="Что нужно сделать?"
                  className="flex-1 rounded-xl border border-border/50 bg-accent/30 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-primary/30 transition-all"
                />
                <Button
                  size="icon"
                  onClick={handleAddTask}
                  disabled={!taskTitle.trim() || saving}
                  className="shrink-0 h-10 w-10 rounded-xl gradient-primary text-white border-0 disabled:opacity-30"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {mode === "note" && (
            <motion.div
              key="note"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="py-4 space-y-3"
            >
              <textarea
                autoFocus
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Мысль, идея, заметка..."
                rows={3}
                className="w-full rounded-xl border border-border/50 bg-accent/30 px-3 py-2.5 text-sm outline-none resize-none placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-primary/30 transition-all"
              />
              <Button
                onClick={handleAddNote}
                disabled={!noteText.trim() || saving}
                className="w-full rounded-xl gradient-primary text-white border-0 disabled:opacity-30"
              >
                <Send className="h-4 w-4 mr-2" />
                {saving ? "Сохраняю..." : "Сохранить заметку"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}
