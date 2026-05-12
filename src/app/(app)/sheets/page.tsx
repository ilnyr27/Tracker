"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Layers,
  Plus,
  Trash2,
  FileText,
  Table2,
  List,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { motion, AnimatePresence } from "motion/react";
import type { CustomTab, TabEntry } from "@/lib/supabase/types";

const TAB_TYPE_CONFIG = {
  freeform: { icon: FileText, label: "Свободный текст" },
  table: { icon: Table2, label: "Таблица" },
  list: { icon: List, label: "Список" },
} as const;

export default function SheetsPage() {
  const [tabs, setTabs] = useState<CustomTab[]>([]);
  const [entries, setEntries] = useState<TabEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const { data: tabsData } = await supabase
      .from("custom_tabs")
      .select("*")
      .order("sort_order");

    if (tabsData) {
      setTabs(tabsData);
      if (!activeTabId && tabsData.length > 0) {
        setActiveTabId(tabsData[0].id);
      }
    }
    setLoading(false);
  }, [activeTabId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load entries for active tab
  useEffect(() => {
    if (!activeTabId) return;
    const supabase = createClient();
    supabase
      .from("tab_entries")
      .select("*")
      .eq("tab_id", activeTabId)
      .order("sort_order")
      .then(({ data }) => {
        if (data) setEntries(data);
      });
  }, [activeTabId]);

  async function createTab(name: string, tabType: CustomTab["tab_type"]) {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data } = await supabase
      .from("custom_tabs")
      .insert({
        user_id: userData.user.id,
        name,
        tab_type: tabType,
        sort_order: tabs.length,
      })
      .select()
      .single();

    if (data) {
      setTabs((prev) => [...prev, data]);
      setActiveTabId(data.id);
    }
  }

  async function deleteTab(id: string) {
    const supabase = createClient();
    setTabs((prev) => prev.filter((t) => t.id !== id));
    if (activeTabId === id) {
      const remaining = tabs.filter((t) => t.id !== id);
      setActiveTabId(remaining[0]?.id || null);
    }
    await supabase.from("tab_entries").delete().eq("tab_id", id);
    await supabase.from("custom_tabs").delete().eq("id", id);
  }

  async function addEntry(data: Record<string, unknown> = {}) {
    if (!activeTabId) return;
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: entry } = await supabase
      .from("tab_entries")
      .insert({
        tab_id: activeTabId,
        user_id: userData.user.id,
        data,
        sort_order: entries.length,
      })
      .select()
      .single();

    if (entry) setEntries((prev) => [...prev, entry]);
  }

  async function updateEntry(id: string, data: Record<string, unknown>) {
    const supabase = createClient();
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, data } : e))
    );
    await supabase.from("tab_entries").update({ data }).eq("id", id);
  }

  async function deleteEntry(id: string) {
    const supabase = createClient();
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await supabase.from("tab_entries").delete().eq("id", id);
  }

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="mx-auto max-w-3xl p-4 pb-24 md:pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold gradient-text">Листы</h1>
        <Button
          size="sm"
          className="gradient-primary text-white border-0 hover:opacity-90"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Новый лист
        </Button>
      </div>

      {/* Tab bar */}
      {tabs.length > 0 && (
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const TypeIcon = TAB_TYPE_CONFIG[tab.tab_type].icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`
                  relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap
                  ${activeTabId === tab.id
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                  }
                `}
              >
                {activeTabId === tab.id && (
                  <motion.div
                    layoutId="sheet-tab"
                    className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/20"
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                    }}
                  />
                )}
                <TypeIcon className="h-3.5 w-3.5 relative" />
                <span className="relative">{tab.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-card animate-pulse" />
          ))}
        </div>
      ) : !activeTab ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center py-20 text-center"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Layers className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            Создай свой первый лист!
          </p>
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTabId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Tab header with delete */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{activeTab.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {TAB_TYPE_CONFIG[activeTab.tab_type].label}
                </span>
              </div>
              {!activeTab.is_system && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 text-xs"
                  onClick={() => deleteTab(activeTab.id)}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Удалить
                </Button>
              )}
            </div>

            {/* Tab content by type */}
            {activeTab.tab_type === "list" && (
              <ListView
                entries={entries}
                onAdd={addEntry}
                onUpdate={updateEntry}
                onDelete={deleteEntry}
              />
            )}
            {activeTab.tab_type === "freeform" && (
              <FreeformView
                entries={entries}
                onAdd={addEntry}
                onUpdate={updateEntry}
                onDelete={deleteEntry}
              />
            )}
            {activeTab.tab_type === "table" && (
              <TableView
                entries={entries}
                schema={activeTab.schema}
                onAdd={addEntry}
                onUpdate={updateEntry}
                onDelete={deleteEntry}
              />
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Create Dialog */}
      <CreateTabDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={createTab}
      />
    </div>
  );
}

// --- List View ---
function ListView({
  entries,
  onAdd,
  onUpdate,
  onDelete,
}: {
  entries: TabEntry[];
  onAdd: (data: Record<string, unknown>) => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  const [newItem, setNewItem] = useState("");

  function handleAdd() {
    if (!newItem.trim()) return;
    onAdd({ text: newItem.trim(), done: false });
    setNewItem("");
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 overflow-hidden">
      <div className="divide-y divide-border/30">
        {entries.map((entry) => {
          const text = (entry.data.text as string) || "";
          const done = !!entry.data.done;

          return (
            <div
              key={entry.id}
              className="group flex items-center gap-2 px-4 py-2.5 hover:bg-accent/30 transition-colors"
            >
              <button
                onClick={() =>
                  onUpdate(entry.id, { ...entry.data, done: !done })
                }
                className={`h-4 w-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                  done ? "bg-primary border-primary" : "border-muted-foreground/30"
                }`}
              >
                {done && <Check className="h-2.5 w-2.5 text-white" />}
              </button>
              <span
                className={`flex-1 text-sm ${
                  done ? "line-through text-muted-foreground/50" : ""
                }`}
              >
                {text}
              </span>
              <button
                onClick={() => onDelete(entry.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-all"
              >
                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="px-4 py-2 border-t border-border/30">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd();
          }}
          className="flex gap-2"
        >
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Добавить..."
            className="h-8 text-sm bg-transparent border-0 focus-visible:ring-0 px-0"
          />
        </form>
      </div>
    </div>
  );
}

// --- Freeform View ---
function FreeformView({
  entries,
  onAdd,
  onUpdate,
  onDelete,
}: {
  entries: TabEntry[];
  onAdd: (data: Record<string, unknown>) => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  const entry = entries[0];
  const [text, setText] = useState((entry?.data.text as string) || "");

  useEffect(() => {
    setText((entries[0]?.data.text as string) || "");
  }, [entries]);

  function handleSave() {
    if (entry) {
      onUpdate(entry.id, { text });
    } else {
      onAdd({ text });
    }
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 p-4">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleSave}
        placeholder="Пиши здесь..."
        rows={12}
        className="bg-transparent border-0 resize-none focus-visible:ring-0 text-sm"
      />
    </div>
  );
}

// --- Table View ---
function TableView({
  entries,
  schema,
  onAdd,
  onUpdate,
  onDelete,
}: {
  entries: TabEntry[];
  schema: Record<string, unknown> | null;
  onAdd: (data: Record<string, unknown>) => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  // Derive columns from existing entries or schema
  const columns = schema?.columns
    ? (schema.columns as string[])
    : entries.length > 0
      ? Object.keys(entries[0].data).filter((k) => k !== "_id")
      : ["Название", "Значение"];

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              {columns.map((col) => (
                <th
                  key={col}
                  className="text-left px-3 py-2 text-xs font-medium text-muted-foreground"
                >
                  {col}
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="group border-b border-border/20 hover:bg-accent/30"
              >
                {columns.map((col) => (
                  <td key={col} className="px-3 py-1.5">
                    <input
                      value={(entry.data[col] as string) || ""}
                      onChange={(e) =>
                        onUpdate(entry.id, {
                          ...entry.data,
                          [col]: e.target.value,
                        })
                      }
                      className="w-full bg-transparent outline-none text-sm"
                    />
                  </td>
                ))}
                <td>
                  <button
                    onClick={() => onDelete(entry.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-all"
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={() => {
          const data: Record<string, unknown> = {};
          columns.forEach((col) => (data[col] = ""));
          onAdd(data);
        }}
        className="flex items-center gap-1.5 px-4 py-2 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors w-full border-t border-border/30"
      >
        <Plus className="h-3.5 w-3.5" />
        Добавить строку
      </button>
    </div>
  );
}

// --- Create Tab Dialog ---
function CreateTabDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, type: CustomTab["tab_type"]) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CustomTab["tab_type"]>("list");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), type);
    setName("");
    setType("list");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="gradient-text">Новый лист</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Название листа"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            className="bg-input/50 border-border/50"
          />

          <div>
            <label className="text-xs text-muted-foreground mb-2 block">
              Тип
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                Object.entries(TAB_TYPE_CONFIG) as [
                  CustomTab["tab_type"],
                  (typeof TAB_TYPE_CONFIG)[keyof typeof TAB_TYPE_CONFIG],
                ][]
              ).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setType(key)}
                    className={`
                      flex flex-col items-center gap-1 p-3 rounded-xl border transition-all text-xs
                      ${type === key
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border/50 text-muted-foreground hover:border-primary/30"
                      }
                    `}
                  >
                    <Icon className="h-5 w-5" />
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
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

