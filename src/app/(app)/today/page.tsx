"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, addDays, subDays, isToday as checkIsToday } from "date-fns";
import { ru } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
  Check,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import type { Category, Task } from "@/lib/supabase/types";

const CATEGORY_ICONS: Record<string, string> = {
  "heart-pulse": "\u2764\ufe0f",
  home: "\ud83c\udfe0",
  "trending-up": "\ud83d\udcc8",
  briefcase: "\ud83d\udcbc",
  users: "\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67",
  "message-circle": "\ud83d\udcac",
  smile: "\ud83d\ude0a",
  "graduation-cap": "\ud83c\udf93",
  moon: "\ud83c\udf19",
  palette: "\ud83c\udfa8",
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function TodayPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const dateStr = format(currentDate, "yyyy-MM-dd");
  const isToday = checkIsToday(currentDate);

  const loadData = useCallback(async () => {
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
  }, [dateStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function toggleTask(task: Task) {
    const supabase = createClient();
    const newDone = !task.is_done;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              is_done: newDone,
              completed_at: newDone ? new Date().toISOString() : null,
            }
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

  async function deleteTask(taskId: string) {
    const supabase = createClient();
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await supabase.from("tasks").delete().eq("id", taskId);
  }

  // Overall progress
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.is_done).length;
  const progress = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24 md:pb-4">
      {/* Date Navigation */}
      <div className="flex items-center justify-between mb-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-xl"
          onClick={() => setCurrentDate(subDays(currentDate, 1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <motion.div
          key={dateStr}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-xl font-bold">
            {isToday ? (
              <span className="gradient-text">Сегодня</span>
            ) : (
              format(currentDate, "d MMMM", { locale: ru })
            )}
          </h1>
          <p className="text-xs text-muted-foreground">
            {format(currentDate, "EEEE, d MMMM yyyy", { locale: ru })}
          </p>
        </motion.div>

        <div className="flex items-center gap-1">
          {!isToday && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl"
              onClick={() => setCurrentDate(new Date())}
              title="Сегодня"
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl"
            onClick={() => setCurrentDate(addDays(currentDate, 1))}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Overall Progress */}
      {totalTasks > 0 && (
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">
              Прогресс дня
            </span>
            <span className="text-xs font-medium text-primary">
              {doneTasks}/{totalTasks}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full gradient-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </motion.div>
      )}

      {/* Category Cards */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-2xl bg-card animate-pulse"
            />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={dateStr}
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-3"
          >
            {categories.map((cat) => {
              const catTasks = tasks.filter(
                (t) => t.category_id === cat.id
              );
              const doneCount = catTasks.filter((t) => t.is_done).length;

              return (
                <motion.div key={cat.id} variants={item}>
                  <CategoryCard
                    category={cat}
                    tasks={catTasks}
                    doneCount={doneCount}
                    onToggleTask={toggleTask}
                    onAddTask={(title) => addTask(cat.id, title)}
                    onDeleteTask={deleteTask}
                  />
                </motion.div>
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
  onDeleteTask,
}: {
  category: Category;
  tasks: Task[];
  doneCount: number;
  onToggleTask: (task: Task) => void;
  onAddTask: (title: string) => void;
  onDeleteTask: (id: string) => void;
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

  const icon = CATEGORY_ICONS[category.icon || ""] || "\ud83d\udccc";
  const catProgress =
    tasks.length > 0 ? (doneCount / tasks.length) * 100 : 0;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm transition-colors hover:bg-card">
      {/* Color accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ backgroundColor: category.color || "#666" }}
      />

      <div className="pl-4 pr-3 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-base">{icon}</span>
            <span className="text-sm font-medium">{category.name}</span>
          </div>
          {tasks.length > 0 && (
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-medium"
                style={{ color: category.color || "#888" }}
              >
                {doneCount}/{tasks.length}
              </span>
              {/* Mini progress */}
              <div className="h-1 w-10 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${catProgress}%`,
                    backgroundColor: category.color || "#666",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Tasks */}
        {tasks.length > 0 && (
          <div className="space-y-0.5 mt-2">
            <AnimatePresence>
              {tasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0, x: -50 }}
                  className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 group/task hover:bg-accent/50 transition-colors"
                >
                  <button
                    onClick={() => onToggleTask(task)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200"
                    style={{
                      borderColor: task.is_done
                        ? category.color || "#666"
                        : "oklch(0.4 0 0)",
                      backgroundColor: task.is_done
                        ? category.color || "#666"
                        : "transparent",
                    }}
                  >
                    {task.is_done && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 20 }}
                      >
                        <Check className="h-3 w-3 text-white" />
                      </motion.div>
                    )}
                  </button>
                  <span
                    className={`flex-1 text-sm transition-all duration-200 ${
                      task.is_done
                        ? "line-through text-muted-foreground/60"
                        : "text-foreground"
                    }`}
                  >
                    {task.title}
                  </span>
                  <button
                    onClick={() => onDeleteTask(task.id)}
                    className="opacity-0 group-hover/task:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Add task */}
        <div className="mt-1.5">
          {adding ? (
            <form onSubmit={handleSubmit} className="flex items-center gap-2 px-2">
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onBlur={() => {
                  if (!newTitle.trim()) setAdding(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setAdding(false);
                }}
                placeholder="Новая задача..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40 py-1"
              />
            </form>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors rounded-lg"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Добавить</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
