"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  addMonths,
  subMonths,
  isSameMonth,
} from "date-fns";
import { ru } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Check,
  Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import type { Task, Category } from "@/lib/supabase/types";

export default function TablePage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const todayRef = useRef<HTMLTableRowElement>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startStr = format(monthStart, "yyyy-MM-dd");
  const endStr = format(monthEnd, "yyyy-MM-dd");

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [taskRes, catRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .gte("scheduled_date", startStr)
        .lte("scheduled_date", endStr)
        .order("sort_order"),
      supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    if (taskRes.data) setTasks(taskRes.data);
    if (catRes.data) setCategories(catRes.data);
    setLoading(false);
  }, [startStr, endStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!loading && todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading]);

  // Build lookup: dateStr -> categoryId -> tasks
  const taskMap = new Map<string, Map<string, Task[]>>();
  for (const task of tasks) {
    const dateKey = task.scheduled_date || "";
    if (!taskMap.has(dateKey)) taskMap.set(dateKey, new Map());
    const catMap = taskMap.get(dateKey)!;
    const catId = task.category_id || "none";
    if (!catMap.has(catId)) catMap.set(catId, []);
    catMap.get(catId)!.push(task);
  }

  const isCurrentMonth = isSameMonth(currentMonth, new Date());

  // Mobile warning
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Monitor className="h-8 w-8 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">
          Таблица доступна только на компьютере.
          <br />
          Откройте на десктопе для полного Excel-вида.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 md:pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold gradient-text">Таблица</h1>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-xl"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center capitalize">
            {format(currentMonth, "LLLL yyyy", { locale: ru })}
          </span>
          {!isCurrentMonth && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl"
              onClick={() => setCurrentMonth(new Date())}
            >
              <CalendarDays className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-xl"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="h-96 rounded-2xl bg-card animate-pulse" />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-border/50 overflow-auto max-h-[75vh]"
        >
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-card">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground border-b border-border/50 min-w-[80px] sticky left-0 bg-card z-20">
                  Дата
                </th>
                {categories.map((cat) => (
                  <th
                    key={cat.id}
                    className="text-left px-3 py-2.5 font-medium border-b border-border/50 min-w-[120px]"
                    style={{ color: cat.color || undefined }}
                  >
                    {cat.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const today = isToday(day);
                const dayName = format(day, "EEEEEE", { locale: ru });
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const dateTasks = taskMap.get(dateStr);

                return (
                  <tr
                    key={dateStr}
                    ref={today ? todayRef : undefined}
                    className={`
                      border-b border-border/30 transition-colors
                      ${today ? "bg-primary/5" : "hover:bg-accent/30"}
                      ${isWeekend ? "bg-muted/30" : ""}
                    `}
                  >
                    {/* Date cell */}
                    <td className="px-3 py-2 font-medium sticky left-0 bg-inherit z-10 whitespace-nowrap">
                      <span className={today ? "text-primary font-bold" : ""}>
                        {format(day, "d")}
                      </span>
                      <span className="text-muted-foreground ml-1">
                        {dayName}
                      </span>
                    </td>

                    {/* Category cells */}
                    {categories.map((cat) => {
                      const catTasks = dateTasks?.get(cat.id) || [];
                      const done = catTasks.filter((t) => t.is_done).length;

                      return (
                        <td
                          key={cat.id}
                          className="px-3 py-1.5 align-top border-l border-border/20"
                        >
                          {catTasks.length > 0 ? (
                            <div className="space-y-0.5">
                              {catTasks.map((task) => (
                                <div
                                  key={task.id}
                                  className={`flex items-center gap-1 ${
                                    task.is_done
                                      ? "text-muted-foreground/50 line-through"
                                      : ""
                                  }`}
                                >
                                  {task.is_done ? (
                                    <Check
                                      className="h-3 w-3 shrink-0"
                                      style={{ color: cat.color || "#666" }}
                                    />
                                  ) : (
                                    <div
                                      className="h-2 w-2 rounded-full border shrink-0"
                                      style={{
                                        borderColor: cat.color || "#666",
                                      }}
                                    />
                                  )}
                                  <span className="truncate">
                                    {task.title}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/20">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  );
}
