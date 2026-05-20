"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ListTodo, StickyNote, Camera, Send, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import type { Category } from "@/lib/supabase/types";

type QuickAddSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Mode = "menu" | "task" | "note";

export function QuickAddSheet({ open, onOpenChange }: QuickAddSheetProps) {
  const [mode, setMode] = useState<Mode>("menu");
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    if (data) setCategories(data);
  }, []);

  useEffect(() => {
    if (open && categories.length === 0) {
      loadCategories();
    }
  }, [open, categories.length, loadCategories]);

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
    // Reload page to show new task
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

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-3xl border-border/30 bg-card/95 backdrop-blur-xl">
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
            {mode === "menu" && "Быстрое добавление"}
            {mode === "task" && "Новая задача"}
            {mode === "note" && "Новая заметка"}
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
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setMode("task")}
                className="flex h-24 flex-col items-center justify-center gap-2.5 rounded-2xl border border-border/30 bg-accent/30 hover:bg-accent/50 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: "#3b82f620" }}>
                  <ListTodo className="h-5 w-5" style={{ color: "#3b82f6" }} />
                </div>
                <span className="text-xs text-muted-foreground">Задача</span>
              </motion.button>

              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setMode("note")}
                className="flex h-24 flex-col items-center justify-center gap-2.5 rounded-2xl border border-border/30 bg-accent/30 hover:bg-accent/50 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: "#8b5cf620" }}>
                  <StickyNote className="h-5 w-5" style={{ color: "#8b5cf6" }} />
                </div>
                <span className="text-xs text-muted-foreground">Заметка</span>
              </motion.button>

              <Link href="/photos" onClick={() => handleClose(false)}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex h-24 flex-col items-center justify-center gap-2.5 rounded-2xl border border-border/30 bg-accent/30 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: "#ec489920" }}>
                    <Camera className="h-5 w-5" style={{ color: "#ec4899" }} />
                  </div>
                  <span className="text-xs text-muted-foreground">Фото</span>
                </motion.div>
              </Link>
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
