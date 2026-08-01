"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Layers,
  Plus,
  Trash2,
  FileText,
  Table2,
  List,
  Check,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
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
  return (
    <Suspense>
      <SheetsPageInner />
    </Suspense>
  );
}

function SheetsPageInner() {
  const searchParams = useSearchParams();
  const urlTabId = searchParams.get("tab");
  const [tabs, setTabs] = useState<CustomTab[]>([]);
  const [entries, setEntries] = useState<TabEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTabId, setActiveTabId] = useState<string | null>(urlTabId);
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
      setActiveTabId((prev) => {
        if (prev) return prev;
        return urlTabId && tabsData.some((t) => t.id === urlTabId)
          ? urlTabId
          : tabsData[0]?.id ?? null;
      });
    }
    setLoading(false);
  }, [urlTabId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync activeTabId when URL tab param changes
  useEffect(() => {
    if (urlTabId && urlTabId !== activeTabId) {
      setActiveTabId(urlTabId);
    }
  }, [urlTabId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  async function createTab(name: string, tabType: CustomTab["tab_type"], schema?: Record<string, unknown>) {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data } = await supabase
      .from("custom_tabs")
      .insert({
        user_id: userData.user.id,
        name,
        tab_type: tabType,
        schema: schema ? { columns: schema.columns } : null,
        sort_order: tabs.length,
      })
      .select()
      .single();

    if (data) {
      setTabs((prev) => [...prev, data]);
      setActiveTabId(data.id);

      // Pre-populate rows for table type
      if (tabType === "table" && schema?.columns && schema?.initialRows) {
        const columns = schema.columns as string[];
        const rowCount = schema.initialRows as number;
        const rows = Array.from({ length: rowCount }, (_, i) => ({
          tab_id: data.id,
          user_id: userData.user!.id,
          data: Object.fromEntries(columns.map((col) => [col, ""])),
          sort_order: i,
        }));

        const { data: insertedRows } = await supabase
          .from("tab_entries")
          .insert(rows)
          .select();

        if (insertedRows) setEntries(insertedRows);
      }
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

  async function renameTab(id: string, name: string) {
    const supabase = createClient();
    setTabs((prev) => prev.map((t) => t.id === id ? { ...t, name } : t));
    await supabase.from("custom_tabs").update({ name }).eq("id", id);
  }

  async function updateTabSchema(id: string, newSchema: Record<string, unknown>) {
    const supabase = createClient();
    setTabs((prev) => prev.map((t) => t.id === id ? { ...t, schema: newSchema } : t));
    await supabase.from("custom_tabs").update({ schema: newSchema }).eq("id", id);
  }

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="mx-auto max-w-3xl p-4 pb-24 md:pb-4 w-full overflow-x-hidden">
      {/* Header + Tab bar — sticky */}
      <div className="sticky top-0 z-10 bg-background pb-2">
        <div className="flex items-center justify-between mb-3 pt-1">
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
          <div className="grid grid-cols-2 gap-1.5">
          {tabs.map((tab) => {
            const TypeIcon = TAB_TYPE_CONFIG[tab.tab_type].icon;
            const displayName = tab.name.length > 20 ? tab.name.slice(0, 18) + "…" : tab.name;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`
                  relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all truncate
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
                <TypeIcon className="h-3.5 w-3.5 relative shrink-0" />
                <span className="relative truncate">{displayName}</span>
              </button>
            );
          })}
          </div>
        )}
      </div>

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
            className="min-w-0 w-full"
          >
            {/* Tab header with rename + delete */}
            <TabHeader
              tab={activeTab}
              onRename={(name) => renameTab(activeTab.id, name)}
              onDelete={() => deleteTab(activeTab.id)}
            />

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
                onSchemaChange={(s) => updateTabSchema(activeTab.id, s)}
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  function handleAdd() {
    if (!newItem.trim()) return;
    onAdd({ text: newItem.trim(), done: false });
    setNewItem("");
  }

  function saveEdit(entryId: string, data: Record<string, unknown>) {
    if (!editText.trim()) return;
    onUpdate(entryId, { ...data, text: editText.trim() });
    setEditingId(null);
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 overflow-hidden">
      <div className="divide-y divide-border/30">
        {entries.map((entry) => {
          const text = (entry.data.text as string) || "";
          const done = !!entry.data.done;
          const isEditing = editingId === entry.id;

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
                  className={`flex-1 text-sm cursor-text ${
                    done ? "line-through text-muted-foreground/50" : ""
                  }`}
                  onClick={() => { setEditingId(entry.id); setEditText(text); }}
                >
                  {text}
                </span>
              )}
              <button
                onClick={() => onDelete(entry.id)}
                className="p-1 rounded hover:bg-destructive/10 transition-all opacity-40 hover:opacity-100"
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
    <div className="rounded-2xl border border-border/50 bg-card/80 p-4 overflow-hidden">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleSave}
        placeholder="Пиши здесь..."
        rows={12}
        className="bg-transparent border-0 resize-none focus-visible:ring-0 text-sm break-words overflow-wrap-anywhere"
        style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
      />
    </div>
  );
}

// ── Formula engine ──
function colLetter(index: number): string {
  let result = "";
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

function parseRef(ref: string): { col: number; row: number } | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  let col = 0;
  for (let i = 0; i < match[1].length; i++) {
    col = col * 26 + (match[1].charCodeAt(i) - 64);
  }
  return { col: col - 1, row: parseInt(match[2]) - 1 };
}

function parseRange(range: string): { col: number; row: number }[] | null {
  const parts = range.split(":");
  if (parts.length !== 2) return null;
  const start = parseRef(parts[0]);
  const end = parseRef(parts[1]);
  if (!start || !end) return null;
  const refs: { col: number; row: number }[] = [];
  for (let r = start.row; r <= end.row; r++) {
    for (let c = start.col; c <= end.col; c++) {
      refs.push({ col: c, row: r });
    }
  }
  return refs;
}

function evaluateFormula(
  formula: string,
  getCellValue: (col: number, row: number) => string
): string {
  try {
    const expr = formula.slice(1).trim().toUpperCase();

    // SUM(A1:A5)
    const sumMatch = expr.match(/^SUM\(([A-Z]+\d+:[A-Z]+\d+)\)$/);
    if (sumMatch) {
      const refs = parseRange(sumMatch[1]);
      if (!refs) return "#REF!";
      const sum = refs.reduce((acc, r) => {
        const v = parseFloat(getCellValue(r.col, r.row));
        return acc + (isNaN(v) ? 0 : v);
      }, 0);
      return String(sum);
    }

    // AVERAGE(A1:A5)
    const avgMatch = expr.match(/^AVERAGE\(([A-Z]+\d+:[A-Z]+\d+)\)$/);
    if (avgMatch) {
      const refs = parseRange(avgMatch[1]);
      if (!refs) return "#REF!";
      const vals = refs.map((r) => parseFloat(getCellValue(r.col, r.row))).filter((v) => !isNaN(v));
      return vals.length > 0 ? String(Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100) : "0";
    }

    // MIN(A1:A5)
    const minMatch = expr.match(/^MIN\(([A-Z]+\d+:[A-Z]+\d+)\)$/);
    if (minMatch) {
      const refs = parseRange(minMatch[1]);
      if (!refs) return "#REF!";
      const vals = refs.map((r) => parseFloat(getCellValue(r.col, r.row))).filter((v) => !isNaN(v));
      return vals.length > 0 ? String(Math.min(...vals)) : "0";
    }

    // MAX(A1:A5)
    const maxMatch = expr.match(/^MAX\(([A-Z]+\d+:[A-Z]+\d+)\)$/);
    if (maxMatch) {
      const refs = parseRange(maxMatch[1]);
      if (!refs) return "#REF!";
      const vals = refs.map((r) => parseFloat(getCellValue(r.col, r.row))).filter((v) => !isNaN(v));
      return vals.length > 0 ? String(Math.max(...vals)) : "0";
    }

    // COUNT(A1:A5)
    const countMatch = expr.match(/^COUNT\(([A-Z]+\d+:[A-Z]+\d+)\)$/);
    if (countMatch) {
      const refs = parseRange(countMatch[1]);
      if (!refs) return "#REF!";
      const vals = refs.map((r) => parseFloat(getCellValue(r.col, r.row))).filter((v) => !isNaN(v));
      return String(vals.length);
    }

    // Simple arithmetic: =A1+B1, =A1*2, =A1-A2, =A1/A2
    const arithmeticExpr = expr.replace(/([A-Z]+\d+)/g, (match) => {
      const ref = parseRef(match);
      if (!ref) return "0";
      const v = parseFloat(getCellValue(ref.col, ref.row));
      return isNaN(v) ? "0" : String(v);
    });

    // Only allow safe characters: digits, +, -, *, /, ., (, ), spaces
    if (/^[\d+\-*/.()\s]+$/.test(arithmeticExpr)) {
      const result = new Function(`return (${arithmeticExpr})`)();
      if (typeof result === "number" && isFinite(result)) {
        return String(Math.round(result * 100) / 100);
      }
    }

    return "#ERR!";
  } catch {
    return "#ERR!";
  }
}

// --- Tab Header with inline rename ---
function TabHeader({ tab, onRename, onDelete }: {
  tab: CustomTab;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tab.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { setName(tab.name); }, [tab.name]);

  return (
    <div className="flex items-center justify-between mb-3 min-w-0">
      <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { if (name.trim()) { onRename(name.trim()); } setEditing(false); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { if (name.trim()) onRename(name.trim()); setEditing(false); }
              if (e.key === "Escape") { setName(tab.name); setEditing(false); }
            }}
            maxLength={40}
            autoFocus
            className="text-sm font-medium bg-transparent border-b border-primary outline-none px-0 py-0 w-full max-w-[200px]"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1.5 group min-w-0"
          >
            <span className="truncate max-w-[200px]">{tab.name}</span>
            <Pencil className="h-3 w-3 shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors" />
          </button>
        )}
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          {TAB_TYPE_CONFIG[tab.tab_type].label}
        </span>
      </div>
      {!tab.is_system && (
        confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Удалить?</span>
            <Button size="sm" variant="destructive" className="h-6 text-xs px-2" onClick={() => { onDelete(); toast.success("Лист удалён"); }}>
              Да
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setConfirmDelete(false)}>
              Нет
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 text-xs"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Удалить
          </Button>
        )
      )}
    </div>
  );
}

// --- Table View (Google Sheets-like) ---
function TableView({
  entries,
  schema,
  onAdd,
  onUpdate,
  onDelete,
  onSchemaChange,
}: {
  entries: TabEntry[];
  schema: Record<string, unknown> | null;
  onAdd: (data: Record<string, unknown>) => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onSchemaChange: (schema: Record<string, unknown>) => void;
}) {
  const colCount = schema?.columns
    ? (schema.columns as string[]).length
    : entries.length > 0
      ? Object.keys(entries[0].data).filter((k) => k !== "_id").length
      : 3;

  const cols = Array.from({ length: colCount }, (_, i) => colLetter(i));

  function addColumn() {
    const newCol = colLetter(colCount);
    const currentCols = schema?.columns ? [...(schema.columns as string[])] : cols;
    onSchemaChange({ ...schema, columns: [...currentCols, newCol] });
    // Add new column to all existing entries
    for (const entry of entries) {
      if (!(newCol in entry.data)) {
        onUpdate(entry.id, { ...entry.data, [newCol]: "" });
      }
    }
  }

  function removeColumn(colIdx: number) {
    if (colCount <= 1) return;
    const colToRemove = cols[colIdx];
    const currentCols = schema?.columns ? [...(schema.columns as string[])] : [...cols];
    currentCols.splice(colIdx, 1);
    onSchemaChange({ ...schema, columns: currentCols });
    // Remove column data from entries
    for (const entry of entries) {
      const newData = { ...entry.data };
      delete newData[colToRemove];
      onUpdate(entry.id, newData);
    }
  }

  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<string | null>(null); // for range selection
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [fillDragging, setFillDragging] = useState(false);
  const [fillTarget, setFillTarget] = useState<number | null>(null);
  const fillTargetRef = useRef<number | null>(null);
  const fillSourceRef = useRef<{ row: number; col: string } | null>(null);

  // Get raw cell value (formula or value)
  function getRawValue(entry: TabEntry, col: string): string {
    return (entry.data[col] as string) || "";
  }

  // Get computed cell value (evaluate formulas)
  function getComputedValue(entryIdx: number, colIdx: number): string {
    if (entryIdx < 0 || entryIdx >= entries.length) return "";
    const col = cols[colIdx];
    if (!col) return "";
    const raw = getRawValue(entries[entryIdx], col);
    if (raw.startsWith("=")) {
      return evaluateFormula(raw, (c, r) => getComputedValue(r, c));
    }
    return raw;
  }

  function getDisplayValue(entry: TabEntry, col: string, rowIdx: number): string {
    const raw = getRawValue(entry, col);
    if (raw.startsWith("=")) {
      const colIdx = cols.indexOf(col);
      return evaluateFormula(raw, (c, r) => getComputedValue(r, c));
    }
    return raw;
  }

  function startEditing(entryId: string, col: string, raw: string) {
    const key = `${entryId}-${col}`;
    setEditingCell(key);
    setEditValue(raw);
  }

  function commitEdit(entryId: string, col: string) {
    const entry = entries.find((e) => e.id === entryId);
    if (entry) {
      onUpdate(entryId, { ...entry.data, [col]: editValue });
    }
    setEditingCell(null);
  }

  // Formula mode: when editing and value starts with "="
  const isFormulaMode = !!(editingCell && editValue.startsWith("="));

  // Get selected cell info for formula bar
  const selectedEntry = selectedCell ? entries.find((e) => selectedCell.startsWith(e.id)) : null;
  const selectedCol = selectedCell?.split("-").pop() || "";
  const selectedRowIdx = selectedEntry ? entries.indexOf(selectedEntry) : -1;
  const selectedCellRef = selectedEntry ? `${selectedCol}${selectedRowIdx + 1}` : "";
  const selectedRaw = selectedEntry && selectedCol ? getRawValue(selectedEntry, selectedCol) : "";

  // Multi-cell selection range
  function getCellCoords(cellKey: string): { row: number; col: number } | null {
    const entry = entries.find((e) => cellKey.startsWith(e.id));
    if (!entry) return null;
    const colName = cellKey.split("-").pop() || "";
    return { row: entries.indexOf(entry), col: cols.indexOf(colName) };
  }

  function isInSelection(rowIdx: number, colIdx: number): boolean {
    if (!selectedCell) return false;
    if (!selectionEnd) return false;
    const start = getCellCoords(selectedCell);
    const end = getCellCoords(selectionEnd);
    if (!start || !end) return false;
    const minR = Math.min(start.row, end.row);
    const maxR = Math.max(start.row, end.row);
    const minC = Math.min(start.col, end.col);
    const maxC = Math.max(start.col, end.col);
    return rowIdx >= minR && rowIdx <= maxR && colIdx >= minC && colIdx <= maxC;
  }

  // Insert a cell reference into the formula being edited
  function insertCellRef(col: string, rowIdx: number) {
    const ref = `${col}${rowIdx + 1}`;
    setEditValue((prev) => prev + ref);
  }

  // Fill handle: auto-fill formula/value down from selected cell
  // Detect date patterns: dd.mm.yyyy, yyyy-mm-dd, dd/mm/yyyy
  function parseDate(val: string): Date | null {
    // dd.mm.yyyy or dd/mm/yyyy
    const dmy = val.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (dmy) {
      const d = new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
      return isNaN(d.getTime()) ? null : d;
    }
    // yyyy-mm-dd
    const ymd = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) {
      const d = new Date(+ymd[1], +ymd[2] - 1, +ymd[3]);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  function formatDateLike(date: Date, pattern: string): string {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    if (pattern.includes("-")) return `${yyyy}-${mm}-${dd}`;
    if (pattern.includes("/")) return `${dd}/${mm}/${yyyy}`;
    return `${dd}.${mm}.${yyyy}`;
  }

  function handleFillDown(sourceRowIdx: number, sourceCol: string, targetRowIdx: number) {
    if (sourceRowIdx === targetRowIdx || targetRowIdx < 0 || targetRowIdx >= entries.length) return;
    const sourceEntry = entries[sourceRowIdx];
    const raw = getRawValue(sourceEntry, sourceCol);

    const startRow = Math.min(sourceRowIdx, targetRowIdx);
    const endRow = Math.max(sourceRowIdx, targetRowIdx);

    // Check if source is a date — auto-increment
    const sourceDate = parseDate(raw);
    // Check if source is a number — auto-increment
    const sourceNum = !raw.startsWith("=") && !sourceDate ? parseFloat(raw) : NaN;
    const isNumber = !isNaN(sourceNum) && raw.trim() !== "";

    for (let r = startRow; r <= endRow; r++) {
      if (r === sourceRowIdx) continue;
      const entry = entries[r];
      let newVal = raw;
      const rowDiff = r - sourceRowIdx;

      if (raw.startsWith("=")) {
        // Formula: adjust row references
        newVal = raw.replace(/([A-Z]+)(\d+)/g, (_, colPart: string, rowPart: string) => {
          return `${colPart}${parseInt(rowPart) + rowDiff}`;
        });
      } else if (sourceDate) {
        // Date: increment by days
        const newDate = new Date(sourceDate);
        newDate.setDate(newDate.getDate() + rowDiff);
        newVal = formatDateLike(newDate, raw);
      } else if (isNumber) {
        // Number: increment by 1
        newVal = String(sourceNum + rowDiff);
      }

      onUpdate(entry.id, { ...entry.data, [sourceCol]: newVal });
    }
  }

  function handleFormulaBarChange(value: string) {
    setEditValue(value);
    if (selectedEntry && selectedCol) {
      const key = `${selectedEntry.id}-${selectedCol}`;
      if (editingCell !== key) {
        setEditingCell(key);
      }
    }
  }

  function handleFormulaBarKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && selectedEntry && selectedCol) {
      commitEdit(selectedEntry.id, selectedCol);
    }
    if (e.key === "Escape") {
      setEditingCell(null);
    }
  }

  // Navigate cells with arrow keys / Tab / Enter
  function handleCellKeyDown(e: React.KeyboardEvent, entryId: string, col: string, rowIdx: number) {
    const colIdx = cols.indexOf(col);

    if (e.key === "Enter") {
      if (editingCell === `${entryId}-${col}`) {
        commitEdit(entryId, col);
        // Move down
        if (rowIdx + 1 < entries.length) {
          const nextEntry = entries[rowIdx + 1];
          setSelectedCell(`${nextEntry.id}-${col}`);
        }
      } else {
        startEditing(entryId, col, getRawValue(entries.find((e) => e.id === entryId)!, col));
      }
      e.preventDefault();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      if (editingCell) commitEdit(entryId, col);
      const nextColIdx = e.shiftKey ? colIdx - 1 : colIdx + 1;
      if (nextColIdx >= 0 && nextColIdx < cols.length) {
        setSelectedCell(`${entryId}-${cols[nextColIdx]}`);
      } else if (!e.shiftKey && rowIdx + 1 < entries.length) {
        setSelectedCell(`${entries[rowIdx + 1].id}-${cols[0]}`);
      }
    }
    if (e.key === "Escape") {
      setEditingCell(null);
    }
    if (!editingCell) {
      if (e.key === "ArrowDown" && rowIdx + 1 < entries.length) {
        setSelectedCell(`${entries[rowIdx + 1].id}-${col}`);
        e.preventDefault();
      }
      if (e.key === "ArrowUp" && rowIdx > 0) {
        setSelectedCell(`${entries[rowIdx - 1].id}-${col}`);
        e.preventDefault();
      }
      if (e.key === "ArrowRight" && colIdx + 1 < cols.length) {
        setSelectedCell(`${entryId}-${cols[colIdx + 1]}`);
        e.preventDefault();
      }
      if (e.key === "ArrowLeft" && colIdx > 0) {
        setSelectedCell(`${entryId}-${cols[colIdx - 1]}`);
        e.preventDefault();
      }
      // Start typing to edit
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        startEditing(entryId, col, "");
        setEditValue(e.key);
        e.preventDefault();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const entry = entries.find((en) => en.id === entryId);
        if (entry) onUpdate(entryId, { ...entry.data, [col]: "" });
        e.preventDefault();
      }
    }
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 overflow-hidden min-w-0" style={{ maxWidth: "calc(100vw - 2rem)" }}>
      {/* Formula bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/30 bg-muted/20 relative">
        <span className="text-[10px] font-mono font-bold text-muted-foreground/60 w-8 text-center shrink-0">
          {selectedCellRef || "—"}
        </span>
        <div className="w-px h-4 bg-border/50" />
        <span className={`text-[10px] shrink-0 font-medium ${isFormulaMode ? "text-primary" : "text-muted-foreground/40"}`}>fx</span>
        <input
          value={editingCell && selectedEntry ? editValue : selectedRaw}
          onChange={(e) => handleFormulaBarChange(e.target.value)}
          onKeyDown={handleFormulaBarKeyDown}
          onFocus={() => {
            if (selectedEntry && selectedCol && !editingCell) {
              startEditing(selectedEntry.id, selectedCol, selectedRaw);
            }
          }}
          placeholder="Выберите ячейку"
          className={`flex-1 bg-transparent border-0 outline-none text-sm h-7 font-mono ${isFormulaMode ? "text-primary" : ""}`}
        />
        {isFormulaMode && (
          <span className="text-[10px] text-primary/60 shrink-0 animate-pulse">
            Кликни на ячейку
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              {/* Row number header */}
              <th className="w-10 px-2 py-2 text-center text-[10px] font-medium text-muted-foreground/50 border-r border-border/30">
                #
              </th>
              {cols.map((col, colIdx) => (
                <th
                  key={col}
                  className="px-1 py-2 text-center text-xs font-semibold text-muted-foreground min-w-[100px] border-r border-border/20 group/col relative"
                >
                  {col}
                  {colCount > 1 && (
                    <button
                      onClick={() => removeColumn(colIdx)}
                      className="absolute top-0.5 right-0.5 h-4 w-4 rounded text-[8px] leading-none text-muted-foreground/0 group-hover/col:text-muted-foreground/40 hover:!text-destructive hover:!bg-destructive/10 transition-all flex items-center justify-center"
                      title="Удалить столбец"
                    >
                      ×
                    </button>
                  )}
                </th>
              ))}
              {/* Add column button */}
              <th className="w-8 px-0">
                <button
                  onClick={addColumn}
                  className="w-full h-full flex items-center justify-center text-muted-foreground/30 hover:text-primary transition-colors"
                  title="Добавить столбец"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, rowIdx) => (
              <tr
                key={entry.id}
                className={`group border-b border-border/15 hover:bg-accent/20 ${
                  fillDragging && fillTarget !== null && fillSourceRef.current
                    ? rowIdx >= Math.min(fillSourceRef.current.row, fillTarget) && rowIdx <= Math.max(fillSourceRef.current.row, fillTarget)
                      ? "bg-primary/5"
                      : ""
                    : ""
                }`}
                onMouseEnter={() => {
                  if (fillDragging) {
                    fillTargetRef.current = rowIdx;
                    setFillTarget(rowIdx);
                  }
                }}
                onMouseUp={() => {
                  if (fillDragging && fillSourceRef.current) {
                    const src = fillSourceRef.current;
                    if (fillTargetRef.current !== null && fillTargetRef.current !== src.row) {
                      handleFillDown(src.row, src.col, fillTargetRef.current);
                    }
                    setFillDragging(false);
                    setFillTarget(null);
                    fillTargetRef.current = null;
                    fillSourceRef.current = null;
                  }
                }}
              >
                {/* Row number */}
                <td className="px-2 py-0 text-center text-[10px] text-muted-foreground/40 font-medium border-r border-border/30 bg-muted/10 select-none">
                  {rowIdx + 1}
                </td>
                {cols.map((col) => {
                  const cellKey = `${entry.id}-${col}`;
                  const colIdx = cols.indexOf(col);
                  const isEditing = editingCell === cellKey;
                  const isSelected = selectedCell === cellKey;
                  const isInRange = isInSelection(rowIdx, colIdx);
                  const raw = getRawValue(entry, col);
                  const display = getDisplayValue(entry, col, rowIdx);
                  const isFormula = raw.startsWith("=");

                  // Check if this cell is referenced in the current formula
                  const isReferenced = isFormulaMode && editValue.toUpperCase().includes(`${col}${rowIdx + 1}`);

                  return (
                    <td
                      key={col}
                      tabIndex={0}
                      className={`px-0 py-0 border-r border-border/15 relative outline-none ${
                        isSelected ? "ring-2 ring-primary/50 ring-inset z-10"
                        : isInRange ? "bg-primary/8 ring-1 ring-primary/20 ring-inset"
                        : isReferenced ? "ring-2 ring-amber-400/50 ring-inset z-5 bg-amber-400/5"
                        : ""
                      }`}
                      onMouseDown={(e) => {
                        // In formula mode, clicking another cell inserts its reference
                        if (isFormulaMode && cellKey !== editingCell) {
                          e.preventDefault(); // prevent blur on editing input
                          insertCellRef(col, rowIdx);
                          return;
                        }
                      }}
                      onClick={(e) => {
                        if (isFormulaMode && cellKey !== editingCell) return; // handled by onMouseDown
                        if (e.shiftKey && selectedCell) {
                          setSelectionEnd(cellKey);
                        } else {
                          setSelectedCell(cellKey);
                          setSelectionEnd(null);
                        }
                      }}
                      onDoubleClick={() => startEditing(entry.id, col, raw)}
                      onKeyDown={(e) => handleCellKeyDown(e, entry.id, col, rowIdx)}
                    >
                      {isEditing ? (
                        <input
                          value={editValue}
                          onChange={(e) => {
                            setEditValue(e.target.value);
                          }}
                          onBlur={() => { commitEdit(entry.id, col); }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { commitEdit(entry.id, col); }
                            if (e.key === "Escape") { setEditingCell(null); }
                            if (e.key === "Tab") {
                              e.preventDefault();
                              commitEdit(entry.id, col);
                              const colIdx = cols.indexOf(col);
                              const nextColIdx = e.shiftKey ? colIdx - 1 : colIdx + 1;
                              if (nextColIdx >= 0 && nextColIdx < cols.length) {
                                setSelectedCell(`${entry.id}-${cols[nextColIdx]}`);
                              }
                            }
                          }}
                          autoFocus
                          className="w-full h-full px-2 py-1.5 bg-white dark:bg-card outline-none text-sm border-0"
                        />
                      ) : (
                        <div
                          className={`px-2 py-1.5 min-h-[32px] text-sm cursor-cell select-none ${
                            isFormula ? "text-primary/80" : ""
                          }`}
                        >
                          {display}
                        </div>
                      )}
                      {/* Fill handle — bottom-right corner dot */}
                      {isSelected && !isEditing && (
                        <div
                          className="absolute -bottom-[3px] -right-[3px] w-[7px] h-[7px] bg-primary border border-white cursor-crosshair z-20 rounded-sm"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setFillDragging(true);
                            fillTargetRef.current = rowIdx;
                            fillSourceRef.current = { row: rowIdx, col };
                            setFillTarget(rowIdx);
                          }}
                        />
                      )}
                    </td>
                  );
                })}
                <td className="px-0">
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

      {/* Add row + formula help */}
      <div className="flex items-center justify-between border-t border-border/30 min-w-0">
        <button
          onClick={() => {
            const data: Record<string, unknown> = {};
            cols.forEach((col) => (data[col] = ""));
            onAdd(data);
          }}
          className="flex items-center gap-1.5 px-4 py-2 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Добавить строку
        </button>
        <span className="text-[10px] text-muted-foreground/30 px-4 truncate">
          =SUM =AVERAGE =MIN =MAX =COUNT
        </span>
      </div>
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
  onCreate: (name: string, type: CustomTab["tab_type"], schema?: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CustomTab["tab_type"]>("list");
  const [colCount, setColCount] = useState(3);
  const [rowCount, setRowCount] = useState(5);
  const [colNames, setColNames] = useState<string[]>(["Название", "Значение", "Заметка"]);

  function updateColCount(n: number) {
    setColCount(n);
    setColNames((prev) => {
      const next = [...prev];
      while (next.length < n) next.push(`Столбец ${next.length + 1}`);
      return next.slice(0, n);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    if (type === "table") {
      const schema = { columns: colNames, initialRows: rowCount };
      onCreate(name.trim(), type, schema);
    } else {
      onCreate(name.trim(), type);
    }

    setName("");
    setType("list");
    setColCount(3);
    setRowCount(5);
    setColNames(["Название", "Значение", "Заметка"]);
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

          {/* Table config: columns + rows */}
          {type === "table" && (
            <div className="space-y-3 rounded-xl border border-border/30 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Столбцов</label>
                  <div className="flex items-center gap-1">
                    {[2, 3, 4, 5, 6].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => updateColCount(n)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                          colCount === n
                            ? "bg-primary/10 text-primary border border-primary/30"
                            : "border border-border/30 text-muted-foreground"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Строк</label>
                  <div className="flex items-center gap-1">
                    {[3, 5, 10, 15, 20].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRowCount(n)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                          rowCount === n
                            ? "bg-primary/10 text-primary border border-primary/30"
                            : "border border-border/30 text-muted-foreground"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Названия столбцов</label>
                <div className="space-y-1.5">
                  {colNames.map((col, i) => (
                    <Input
                      key={i}
                      value={col}
                      onChange={(e) => {
                        const next = [...colNames];
                        next[i] = e.target.value;
                        setColNames(next);
                      }}
                      placeholder={`Столбец ${i + 1}`}
                      className="h-8 text-xs bg-input/50 border-border/50"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

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

