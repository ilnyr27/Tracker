"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, addDays, subDays } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, AnimatePresence } from "motion/react";
import type { Category, Task } from "@/lib/supabase/types";

const CATEGORY_ICONS: Record<string, string> = {
  "heart-pulse": "❤️",
  home: "🏠",
  "trending-up": "📈",
  briefcase: "💼",
  users: "👨‍👩‍👧",
  "message-circle": "💬",
  smile: "😊",
  "graduation-cap": "🎓",
  moon: "🌙",
  palette: "🎨",
};

export default function TodayPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const dateStr = format(currentDate, "yyyy-MM-dd");

  useEffect(() => {
    loadData();
  }, [dateStr]);

  async function loadData() {
    setLoading(true);
    const supabase = createClient();

    const [catRes, taskRes] = await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("tasks")
        .select("*")
        .eq("scheduled_date", dateStr)
        .order("sort_order"),
    ]);

    if (catRes.data) setCategories(catRes.data);
    if (taskRes.data) setTasks(taskRes.data);
    setLoading(false);
  }

  async function toggleTask(task: Task) {
    const supabase = createClient();
    const newDone = !task.is_done;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, is_done: newDone, completed_at: newDone ? new Date().toISOString() : null }
          : t
      )
    );

    await supabase
      .from("tasks")
      .update({
        is_done: newDone,
        completed_at: newDone ? new Date().toISOString() : null,
      })
      .eq("id", task.id);
  }

  async function addTask(categoryId: string, title: string) {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data } = await supabase
      .from("tasks")
      .insert({
        user_id: userData.user.id,
        category_id: categoryId,
        title,
        scheduled_date: dateStr,
        sort_order: tasks.filter((t) => t.category_id === categoryId).length,
      })
      .select()
      .single();

    if (data) setTasks((prev) => [...prev, data]);
  }

  const isToday = format(new Date(), "yyyy-MM-dd") === dateStr;

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Date Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentDate(subDays(currentDate, 1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <div className="text-center">
          <h1 className="text-lg font-semibold">
            {isToday
              ? "Сегодня"
              : format(currentDate, "d MMMM", { locale: ru })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {format(currentDate, "EEEE, d MMMM yyyy", { locale: ru })}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {!isToday && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentDate(new Date())}
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentDate(addDays(currentDate, 1))}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Category Cards */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-muted animate-pulse"
            />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={dateStr}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {categories.map((cat) => {
              const catTasks = tasks.filter(
                (t) => t.category_id === cat.id
              );
              const doneCount = catTasks.filter((t) => t.is_done).length;

              return (
                <CategoryCard
                  key={cat.id}
                  category={cat}
                  tasks={catTasks}
                  doneCount={doneCount}
                  onToggleTask={toggleTask}
                  onAddTask={(title) => addTask(cat.id, title)}
                />
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

function CategoryCard({
  category,
  tasks,
  doneCount,
  onToggleTask,
  onAddTask,
}: {
  category: Category;
  tasks: Task[];
  doneCount: number;
  onToggleTask: (task: Task) => void;
  onAddTask: (title: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newTitle.trim()) {
      onAddTask(newTitle.trim());
      setNewTitle("");
      setAdding(false);
    }
  }

  const icon = CATEGORY_ICONS[category.icon || ""] || "📌";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-md text-xs"
              style={{ backgroundColor: `${category.color}20` }}
            >
              {icon}
            </span>
            {category.name}
          </CardTitle>
          {tasks.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {doneCount}/{tasks.length}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        {tasks.length > 0 && (
          <div className="space-y-1 mb-2">
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
              >
                <button
                  onClick={() => onToggleTask(task)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all ${
                    task.is_done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30"
                  }`}
                >
                  {task.is_done && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-xs"
                    >
                      ✓
                    </motion.span>
                  )}
                </button>
                <span
                  className={`text-sm ${
                    task.is_done
                      ? "line-through text-muted-foreground"
                      : ""
                  }`}
                >
                  {task.title}
                </span>
              </motion.div>
            ))}
          </div>
        )}

        {adding ? (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onBlur={() => !newTitle && setAdding(false)}
              placeholder="Новая задача..."
              className="flex-1 bg-transparent text-sm outline-none border-b border-muted-foreground/20 pb-1"
            />
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            + Добавить
          </button>
        )}
      </CardContent>
    </Card>
  );
}
