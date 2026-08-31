"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  Trash2,
  List,
  Check,
  ChevronDown,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "motion/react";
import type { CustomTab, TabEntry } from "@/lib/supabase/types";
import Link from "next/link";

export default function SheetsPage() {
  return (
    <Suspense>
      <SheetsPageInner />
    </Suspense>
  );
}

function SheetsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTabId = searchParams.get("tab");

  const [tabs, setTabs] = useState<CustomTab[]>([]);
  const [tabEntries, setTabEntries] = useState<Map<string, TabEntry[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedTabId, setExpandedTabId] = useState<string | null>(urlTabId);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && dx > 0) {
        router.push("/journal");
      }
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
    };
  }, [router]);

  const loadTabs = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("custom_tabs").select("*").order("sort_order");
    if (data) setTabs(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTabs();
  }, [loadTabs]);

  // If URL has a tab, expand it and load its entries
  useEffect(() => {
    if (urlTabId) {
      setExpandedTabId(urlTabId);
      loadEntriesForTab(urlTabId);
    }
  }, [urlTabId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadEntriesForTab(tabId: string) {
    if (tabEntries.has(tabId)) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("tab_entries")
      .select("*")
      .eq("tab_id", tabId)
      .order("sort_order");
    if (data) {
      setTabEntries((prev) => new Map(prev).set(tabId, data));
    }
  }

  async function reloadEntriesForTab(tabId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("tab_entries")
      .select("*")
      .eq("tab_id", tabId)
      .order("sort_order");
    if (data) {
      setTabEntries((prev) => new Map(prev).set(tabId, data));
    }
  }

  function toggleExpand(tabId: string) {
    if (expandedTabId === tabId) {
      setExpandedTabId(null);
    } else {
      setExpandedTabId(tabId);
      loadEntriesForTab(tabId);
    }
  }

  async function createTab(name: string) {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data } = await supabase
      .from("custom_tabs")
      .insert({
        user_id: userData.user.id,
        name,
        tab_type: "list",
        sort_order: tabs.length,
      })
      .select()
      .single();

    if (data) {
      setTabs((prev) => [...prev, data]);
      setExpandedTabId(data.id);
      setTabEntries((prev) => new Map(prev).set(data.id, []));
    }
  }

  async function deleteTab(id: string) {
    const supabase = createClient();
    setTabs((prev) => prev.filter((t) => t.id !== id));
    if (expandedTabId === id) setExpandedTabId(null);
    setTabEntries((prev) => { const m = new Map(prev); m.delete(id); return m; });
    await supabase.from("tab_entries").delete().eq("tab_id", id);
    await supabase.from("custom_tabs").delete().eq("id", id);
    toast.success("Список удалён");
  }

  async function renameTab(id: string, name: string) {
    const supabase = createClient();
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
    await supabase.from("custom_tabs").update({ name }).eq("id", id);
  }

  async function addEntry(tabId: string, data: Record<string, unknown> = {}) {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const currentEntries = tabEntries.get(tabId) || [];
    const { data: entry } = await supabase
      .from("tab_entries")
      .insert({ tab_id: tabId, user_id: userData.user.id, data, sort_order: currentEntries.length })
      .select()
      .single();
    if (entry) {
      setTabEntries((prev) => new Map(prev).set(tabId, [...(prev.get(tabId) || []), entry]));
    }
  }

  async function updateEntry(tabId: string, id: string, data: Record<string, unknown>) {
    const supabase = createClient();
    setTabEntries((prev) => {
      const entries = prev.get(tabId) || [];
      return new Map(prev).set(tabId, entries.map((e) => (e.id === id ? { ...e, data } : e)));
    });
    await supabase.from("tab_entries").update({ data }).eq("id", id);
  }

  async function deleteEntry(tabId: string, id: string) {
    const supabase = createClient();
    setTabEntries((prev) => {
      const entries = prev.get(tabId) || [];
      return new Map(prev).set(tabId, entries.filter((e) => e.id !== id));
    });
    await supabase.from("tab_entries").delete().eq("id", id);
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-28 md:pb-6">
      {/* Header + switcher — sticky */}
      <div className="sticky top-0 z-10 bg-background pb-2">
        <div className="flex items-center justify-between mb-3 pt-1">
          <h1 className="text-xl font-bold gradient-text">Журнал</h1>
        </div>

        {/* Журнал / Список switcher */}
        <div className="flex rounded-xl border border-border/50 overflow-hidden text-xs mb-3">
          <Link
            href="/journal"
            className="flex-1 px-3 py-2 text-muted-foreground hover:bg-accent/40 text-center transition-colors flex items-center justify-center gap-1"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Журнал
          </Link>
          <button className="flex-1 px-3 py-2 bg-primary/10 text-primary font-semibold flex items-center justify-center gap-1">
            <List className="h-3.5 w-3.5" />
            Список
          </button>
        </div>
      </div>

      {/* Lists accordion */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 rounded-2xl bg-card animate-pulse" />
          ))}
        </div>
      ) : tabs.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <List className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Создай свой первый список!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tabs.map((tab) => {
            const isExpanded = expandedTabId === tab.id;
            const entries = tabEntries.get(tab.id) || [];
            const doneCount = entries.filter((e) => e.data.done).length;

            return (
              <div
                key={tab.id}
                className="rounded-2xl border border-border/50 bg-card/80 overflow-hidden"
              >
                {/* Tab header row */}
                <button
                  onClick={() => toggleExpand(tab.id)}
                  className="flex items-center gap-3 w-full px-4 py-3.5 text-left hover:bg-accent/30 transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                    <List className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{tab.name}</span>
                    {entries.length > 0 && (
                      <p className="text-[11px] text-muted-foreground/60">
                        {doneCount}/{entries.length} выполнено
                      </p>
                    )}
                  </div>
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="h-4 w-4 text-muted-foreground/40" />
                  </motion.div>
                </button>

                {/* Expanded content */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border/30">
                        <ListViewInline
                          tabId={tab.id}
                          entries={entries}
                          onAdd={(data) => addEntry(tab.id, data)}
                          onUpdate={(id, data) => updateEntry(tab.id, id, data)}
                          onDelete={(id) => deleteEntry(tab.id, id)}
                        />
                        {/* Tab actions */}
                        <TabActions
                          tab={tab}
                          onRename={(name) => renameTab(tab.id, name)}
                          onDelete={() => deleteTab(tab.id)}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Add new list button */}
      <button
        onClick={() => setCreateOpen(true)}
        className="mt-4 flex items-center gap-2 w-full px-4 py-3 rounded-2xl border border-dashed border-border/50 text-muted-foreground/60 hover:border-primary/40 hover:text-primary transition-colors text-sm"
      >
        <Plus className="h-4 w-4" />
        Новый список
      </button>

      {/* Simple create dialog */}
      <CreateListDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={createTab}
      />
    </div>
  );
}

// --- Inline List View ---
function ListViewInline({
  tabId,
  entries,
  onAdd,
  onUpdate,
  onDelete,
}: {
  tabId: string;
  entries: TabEntry[];
  onAdd: (data: Record<string, unknown>) => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  const [newItem, setNewItem] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  function handleAdd() {
    if (!newItem.trim()) return;
    onAdd({ text: newItem.trim(), done: false });
    setNewItem("");
  }

  function saveEdit(entryId: string, data: Record<string, unknown>) {
    if (!editText.trim()) { setEditingId(null); return; }
    onUpdate(entryId, { ...data, text: editText.trim() });
    setEditingId(null);
  }

  return (
    <div>
      {entries.length > 0 && (
        <div className="divide-y divide-border/20">
          {entries.map((entry) => {
            const text = (entry.data.text as string) || "";
            const done = !!entry.data.done;
            const isEditing = editingId === entry.id;

            return (
              <div
                key={entry.id}
                className="group flex items-center gap-3 px-4 py-2.5 hover:bg-accent/20 transition-colors"
              >
                <button
                  onClick={() => onUpdate(entry.id, { ...entry.data, done: !done })}
                  className={`h-4 w-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                    done ? "bg-primary border-primary" : "border-muted-foreground/30"
                  }`}
                >
                  {done && <Check className="h-2.5 w-2.5 text-white" />}
                </button>

                {isEditing ? (
                  <input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(entry.id, entry.data);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => saveEdit(entry.id, entry.data)}
                    autoFocus
                    className="flex-1 text-sm bg-transparent outline-none border-b border-primary/50"
                  />
                ) : (
                  <span
                    className={`flex-1 text-sm cursor-text ${done ? "line-through text-muted-foreground/50" : ""}`}
                    onClick={() => { setEditingId(entry.id); setEditText(text); }}
                  >
                    {text}
                  </span>
                )}

                <button
                  onClick={() => onDelete(entry.id)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground/50 hover:text-destructive" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add item input */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleAdd(); }}
        className="flex items-center gap-3 px-4 py-2.5 border-t border-border/20"
      >
        <div className="h-4 w-4 rounded border-2 border-dashed border-muted-foreground/20 shrink-0" />
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Добавить пункт..."
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/30"
        />
        {newItem.trim() && (
          <button type="submit" className="text-xs text-primary font-medium">
            Добавить
          </button>
        )}
      </form>
    </div>
  );
}

// --- Tab actions (rename + delete) ---
function TabActions({ tab, onRename, onDelete }: {
  tab: CustomTab;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(tab.name);

  useEffect(() => { setName(tab.name); }, [tab.name]);

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/20 bg-muted/20">
      {renaming ? (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => { if (name.trim()) onRename(name.trim()); setRenaming(false); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { if (name.trim()) onRename(name.trim()); setRenaming(false); }
            if (e.key === "Escape") { setName(tab.name); setRenaming(false); }
          }}
          autoFocus
          className="flex-1 text-xs bg-transparent border-b border-primary outline-none mr-2"
        />
      ) : (
        <button
          onClick={() => setRenaming(true)}
          className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          Переименовать
        </button>
      )}

      {confirmDelete ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground/60">Удалить?</span>
          <button onClick={onDelete} className="text-xs text-destructive font-medium">Да</button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted-foreground">Нет</button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="text-xs text-destructive/60 hover:text-destructive transition-colors"
        >
          Удалить список
        </button>
      )}
    </div>
  );
}

// --- Simple Create Dialog ---
function CreateListDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
    setName("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="gradient-text">Новый список</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Название списка"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            className="bg-input/50 border-border/50"
          />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 gradient-primary text-white border-0 hover:opacity-90"
            >
              Создать
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
