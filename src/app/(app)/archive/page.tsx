"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeft, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import Link from "next/link";
import type { Goal, Category } from "@/lib/supabase/types";

export default function ArchivePage() {
  const [archivedCats, setArchivedCats] = useState<Category[]>([]);
  const [archivedGoals, setArchivedGoals] = useState<Goal[]>([]);
  const [activeCats, setActiveCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [catRes, goalRes, activeCatRes] = await Promise.all([
      supabase.from("categories").select("*").eq("is_active", false).order("sort_order"),
      supabase.from("goals").select("*").in("status", ["cancelled", "completed"]).order("updated_at", { ascending: false }),
      supabase.from("categories").select("*").eq("is_active", true).order("sort_order"),
    ]);

    if (catRes.data) setArchivedCats(catRes.data);
    if (goalRes.data) setArchivedGoals(goalRes.data);
    if (activeCatRes.data) setActiveCats(activeCatRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function restoreCategory(id: string) {
    const supabase = createClient();
    setArchivedCats((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("categories").update({ is_active: true }).eq("id", id);
  }

  async function deleteCategory(id: string) {
    const supabase = createClient();
    setArchivedCats((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("categories").delete().eq("id", id);
  }

  async function restoreGoal(id: string) {
    const supabase = createClient();
    setArchivedGoals((prev) => prev.filter((g) => g.id !== id));
    await supabase.from("goals").update({ status: "active", completed_at: null }).eq("id", id);
  }

  async function deleteGoal(id: string) {
    const supabase = createClient();
    setArchivedGoals((prev) => prev.filter((g) => g.id !== id));
    await supabase.from("goals").delete().eq("id", id);
  }

  const allCats = [...activeCats, ...archivedCats];
  const catMap = new Map(allCats.map((c) => [c.id, c]));

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24 md:pb-4">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/settings"
          className="p-2 -ml-2 rounded-xl hover:bg-accent/50 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold gradient-text">Архив</h1>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 rounded-2xl bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Archived categories */}
          {archivedCats.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">
                Категории ({archivedCats.length})
              </h2>
              <div className="space-y-2">
                {archivedCats.map((cat) => (
                  <motion.div
                    key={cat.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card px-4 py-3"
                  >
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-lg"
                      style={{ backgroundColor: `${cat.color || "#666"}15` }}
                    >
                      {cat.icon || cat.name.charAt(0)}
                    </div>
                    <span className="flex-1 text-sm font-medium">{cat.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-primary hover:text-primary"
                      onClick={() => restoreCategory(cat.id)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Восстановить
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => deleteCategory(cat.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Archived goals */}
          {archivedGoals.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">
                Цели ({archivedGoals.length})
              </h2>
              <div className="space-y-2">
                {archivedGoals.map((goal) => {
                  const cat = catMap.get(goal.category_id || "");
                  return (
                    <motion.div
                      key={goal.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card px-4 py-3"
                    >
                      {cat && (
                        <div
                          className="w-1 h-8 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color || "#666" }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm block truncate">{goal.title}</span>
                        <span className="text-[10px] text-muted-foreground/50">
                          {cat?.name || "Без категории"} · {goal.status === "completed" ? "Завершена" : "Отменена"}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-primary hover:text-primary"
                        onClick={() => restoreGoal(goal.id)}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Вернуть
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => deleteGoal(goal.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {archivedCats.length === 0 && archivedGoals.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <p className="text-sm text-muted-foreground">Архив пуст</p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                Архивированные категории и цели появятся здесь
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
