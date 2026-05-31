"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  Trash2,
  Repeat,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import type { TaskTemplate, Category } from "@/lib/supabase/types";

const RECURRENCE_LABELS: Record<TaskTemplate["recurrence"], string> = {
  daily: "Каждый день",
  weekdays: "Будни (Пн–Пт)",
  weekly: "Еженедельно",
  monthly: "Ежемесячно",
  custom: "Расширенное",
};

const WEEKDAY_NAMES = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export default function RecurringTasksPage() {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [tmplRes, catRes] = await Promise.all([
      supabase
        .from("task_templates")
        .select("*")
        .order("sort_order"),
      supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    if (tmplRes.data) setTemplates(tmplRes.data);
    if (catRes.data) setCategories(catRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function deleteTemplate(id: string) {
    const supabase = createClient();
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("task_templates").delete().eq("id", id);
  }

  async function toggleActive(tmpl: TaskTemplate) {
    const supabase = createClient();
    const newActive = !tmpl.is_active;
    setTemplates((prev) =>
      prev.map((t) => (t.id === tmpl.id ? { ...t, is_active: newActive } : t))
    );
    await supabase
      .from("task_templates")
      .update({ is_active: newActive })
      .eq("id", tmpl.id);
  }

  const catMap = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24 md:pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/settings"
          className="p-2 -ml-2 rounded-xl hover:bg-accent/50 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold gradient-text">
            Повторяющиеся задачи
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Автоматически создаются каждый день
          </p>
        </div>
        <Button
          size="sm"
          className="gradient-primary text-white border-0"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Добавить
        </Button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <CreateTemplateForm
              categories={categories}
              onCreated={() => {
                setShowForm(false);
                loadData();
              }}
              onCancel={() => setShowForm(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Templates list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-card animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Repeat className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground mb-1">
            Нет повторяющихся задач
          </p>
          <p className="text-xs text-muted-foreground/60">
            Создай шаблон — задачи будут появляться автоматически
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((tmpl) => {
            const cat = tmpl.category_id ? catMap.get(tmpl.category_id) : null;
            return (
              <motion.div
                key={tmpl.id}
                layout
                className={`
                  group relative rounded-2xl border bg-card/80 overflow-hidden transition-all
                  ${tmpl.is_active ? "border-border/50" : "border-border/30 opacity-50"}
                `}
              >
                {cat && (
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                    style={{ backgroundColor: cat.color || "#666" }}
                  />
                )}
                <div className="pl-4 pr-3 py-3 flex items-center gap-3">
                  <button
                    onClick={() => toggleActive(tmpl)}
                    className={`
                      flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all
                      ${tmpl.is_active
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30"
                      }
                    `}
                  >
                    {tmpl.is_active && (
                      <Repeat className="h-3 w-3 text-white" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{tmpl.title}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {RECURRENCE_LABELS[tmpl.recurrence]}
                      </span>
                      {tmpl.recurrence === "weekly" &&
                        tmpl.recurrence_days.length > 0 && (
                          <span className="text-[10px] text-muted-foreground/60">
                            ({tmpl.recurrence_days
                              .map((d) => WEEKDAY_NAMES[d])
                              .join(", ")})
                          </span>
                        )}
                      {cat && (
                        <span
                          className="text-[10px] px-1.5 rounded-md"
                          style={{
                            backgroundColor: `${cat.color}15`,
                            color: cat.color || undefined,
                          }}
                        >
                          {cat.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => deleteTemplate(tmpl.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateTemplateForm({
  categories,
  onCreated,
  onCancel,
}: {
  categories: Category[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [recurrence, setRecurrence] = useState<TaskTemplate["recurrence"]>("daily");
  const [weekDays, setWeekDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  function toggleWeekDay(day: number) {
    setWeekDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    await supabase.from("task_templates").insert({
      user_id: userData.user.id,
      title: title.trim(),
      category_id: categoryId === "none" ? null : categoryId,
      recurrence,
      recurrence_days: recurrence === "weekly" ? weekDays : [],
      sort_order: 0,
    });

    setSaving(false);
    onCreated();
  }

  return (
    <div className="mb-4 rounded-2xl border border-border/50 bg-card/80 p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          placeholder="Название задачи"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
          className="bg-input/50 border-border/50"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Повторение
            </label>
            <Select
              value={recurrence}
              onValueChange={(v) => setRecurrence(v as TaskTemplate["recurrence"])}
            >
              <SelectTrigger className="bg-input/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Каждый день</SelectItem>
                <SelectItem value="weekdays">Будни (Пн–Пт)</SelectItem>
                <SelectItem value="weekly">Еженедельно</SelectItem>
                <SelectItem value="monthly">Ежемесячно</SelectItem>
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

        {/* Weekly day picker */}
        {recurrence === "weekly" && (
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              В какие дни?
            </label>
            <div className="flex gap-1">
              {WEEKDAY_NAMES.map((name, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleWeekDay(i)}
                  className={`
                    h-8 w-8 rounded-lg text-xs font-medium transition-all
                    ${weekDays.includes(i)
                      ? "gradient-primary text-white"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                    }
                  `}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={onCancel}
          >
            Отмена
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={saving || !title.trim()}
            className="flex-1 gradient-primary text-white border-0"
          >
            {saving ? "..." : "Создать"}
          </Button>
        </div>
      </form>
    </div>
  );
}
