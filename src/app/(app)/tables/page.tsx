"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, ChevronDown, X, Check, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "motion/react";
import type { CustomTab, TabEntry } from "@/lib/supabase/types";

type ColDef = { key: string; label: string };

type EditingCell = { tabId: string; entryId: string; colKey: string } | null;

function getSchema(tab: CustomTab): ColDef[] {
  const s = tab.schema as { columns?: ColDef[] } | null;
  return s?.columns ?? [];
}

function getCellValue(colLabel: string, rowIdx: number, entries: TabEntry[], cols: ColDef[]): number {
  const col = cols.find((c) => c.label.toUpperCase() === colLabel.toUpperCase());
  if (!col || rowIdx < 0 || rowIdx >= entries.length) return 0;
  const raw = (entries[rowIdx].data as Record<string, unknown>)[col.key];
  const v = parseFloat(String(raw ?? ""));
  return isNaN(v) ? 0 : v;
}

function evalFormula(formula: string, entries: TabEntry[], cols: ColDef[]): string {
  if (!formula.startsWith("=")) return formula;
  const expr = formula.slice(1).trim().toUpperCase();

  const colByLabel = (label: string) => cols.find((c) => c.label.toUpperCase() === label.trim());

  const getColValues = (labels: string[]): number[] => {
    const values: number[] = [];
    for (const label of labels) {
      const col = colByLabel(label);
      if (!col) continue;
      for (const entry of entries) {
        const raw = (entry.data as Record<string, unknown>)[col.key];
        const v = parseFloat(String(raw ?? ""));
        if (!isNaN(v)) values.push(v);
      }
    }
    return values;
  };

  // SUM/AVG/MAX/MIN/COUNT aggregate functions
  const m = expr.match(/^(SUM|AVG|AVERAGE|MAX|MIN|COUNT)\(([^)]*)\)$/);
  if (m) {
    const [, func, argsStr] = m;
    const args = argsStr.split(",").map((a) => a.trim()).filter(Boolean);
    const values = getColValues(args);
    if (values.length === 0) return "0";
    switch (func) {
      case "SUM": return String(values.reduce((a, b) => a + b, 0));
      case "AVG":
      case "AVERAGE": return String(+(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
      case "MAX": return String(Math.max(...values));
      case "MIN": return String(Math.min(...values));
      case "COUNT": return String(values.length);
    }
  }

  // Cell-reference arithmetic: A1+B1, A1*B2, (A1+B1)/2, etc.
  // Resolve cell refs like A1, B3 → numeric values, then evaluate arithmetic
  if (/[A-Z]\d/.test(expr)) {
    const resolved = expr.replace(/([A-Z]+)(\d+)/g, (_, colLabel, rowStr) => {
      return String(getCellValue(colLabel, parseInt(rowStr, 10) - 1, entries, cols));
    });
    // Only evaluate if result is a safe arithmetic expression
    if (/^[\s\d+\-*/().]+$/.test(resolved)) {
      try {
        // eslint-disable-next-line no-new-func
        const result = new Function(`"use strict"; return (${resolved})`)();
        if (typeof result === "number" && isFinite(result)) {
          // Trim floating point noise
          return String(parseFloat(result.toFixed(10)));
        }
      } catch {
        return "#ERR";
      }
    }
  }

  // Plain number
  const num = parseFloat(expr);
  if (!isNaN(num)) return String(num);
  return `#ERR`;
}

function pluralCols(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return "столбец";
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return "столбца";
  return "столбцов";
}

export default function TablesPage() {
  const [tabs, setTabs] = useState<CustomTab[]>([]);
  const [tabEntries, setTabEntries] = useState<Map<string, TabEntry[]>>(new Map());
  const [expandedTabId, setExpandedTabId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [addRowTabId, setAddRowTabId] = useState<string | null>(null);
  const [addColTabId, setAddColTabId] = useState<string | null>(null);

  // Inline cell editing
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [editingValue, setEditingValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTabs();
  }, []);

  async function loadTabs() {
    const supabase = createClient();
    const { data } = await supabase
      .from("custom_tabs")
      .select("*")
      .eq("tab_type", "table")
      .order("sort_order");
    if (data) setTabs(data);
    setLoading(false);
  }

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

  function toggleExpand(tabId: string) {
    if (expandedTabId === tabId) {
      setExpandedTabId(null);
    } else {
      setExpandedTabId(tabId);
      loadEntriesForTab(tabId);
    }
  }

  async function createTab(name: string, columns: ColDef[], rowCount: number) {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data } = await supabase
      .from("custom_tabs")
      .insert({
        user_id: userData.user.id,
        name: name.trim(),
        tab_type: "table",
        schema: { columns },
        sort_order: tabs.length,
      })
      .select()
      .single();

    if (data) {
      setTabs((prev) => [...prev, data]);
      if (rowCount > 0) {
        const emptyRows = Array.from({ length: rowCount }, (_, i) => ({
          tab_id: data.id,
          user_id: userData.user.id,
          data: {},
          sort_order: i,
        }));
        const { data: rowData } = await supabase.from("tab_entries").insert(emptyRows).select();
        setTabEntries((prev) => new Map(prev).set(data.id, rowData ?? []));
      } else {
        setTabEntries((prev) => new Map(prev).set(data.id, []));
      }
    }
    setCreateOpen(false);
  }

  async function deleteTab(id: string) {
    const supabase = createClient();
    setTabs((prev) => prev.filter((t) => t.id !== id));
    if (expandedTabId === id) setExpandedTabId(null);
    await supabase.from("custom_tabs").delete().eq("id", id);
  }

  async function addRow(tabId: string, rowData: Record<string, string>) {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const entries = tabEntries.get(tabId) ?? [];
    const { data } = await supabase
      .from("tab_entries")
      .insert({ tab_id: tabId, user_id: userData.user.id, data: rowData, sort_order: entries.length })
      .select()
      .single();

    if (data) {
      setTabEntries((prev) => {
        const next = new Map(prev);
        next.set(tabId, [...(prev.get(tabId) ?? []), data]);
        return next;
      });
    }
    setAddRowTabId(null);
  }

  async function deleteRow(tabId: string, entryId: string) {
    const supabase = createClient();
    setTabEntries((prev) => {
      const next = new Map(prev);
      next.set(tabId, (prev.get(tabId) ?? []).filter((e) => e.id !== entryId));
      return next;
    });
    await supabase.from("tab_entries").delete().eq("id", entryId);
  }

  // ── Inline cell editing ─────────────────────────────────────────────────────

  function startEditCell(tabId: string, entryId: string, colKey: string, currentValue: string) {
    setEditingCell({ tabId, entryId, colKey });
    setEditingValue(currentValue);
  }

  async function commitCellEdit() {
    if (!editingCell) return;
    const { tabId, entryId, colKey } = editingCell;
    const supabase = createClient();

    setTabEntries((prev) => {
      const entries = prev.get(tabId) ?? [];
      return new Map(prev).set(
        tabId,
        entries.map((e) =>
          e.id === entryId
            ? { ...e, data: { ...(e.data as Record<string, unknown>), [colKey]: editingValue } }
            : e
        )
      );
    });

    // Find entry and persist
    const entry = tabEntries.get(tabId)?.find((e) => e.id === entryId);
    if (entry) {
      const newData = { ...(entry.data as Record<string, unknown>), [colKey]: editingValue };
      await supabase.from("tab_entries").update({ data: newData }).eq("id", entryId);
    }

    setEditingCell(null);
  }

  // ── Column management ───────────────────────────────────────────────────────

  async function addColumn(tabId: string, label: string) {
    const supabase = createClient();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const cols = getSchema(tab);
    const key = `col_${label.replace(/\s+/g, "_")}_${Date.now()}`;
    const newCols = [...cols, { key, label }];
    const newSchema = { columns: newCols };

    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, schema: newSchema } : t))
    );
    await supabase.from("custom_tabs").update({ schema: newSchema }).eq("id", tabId);
    setAddColTabId(null);
  }

  async function deleteColumn(tabId: string, colKey: string) {
    const supabase = createClient();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    // Remove col from schema
    const cols = getSchema(tab).filter((c) => c.key !== colKey);
    const newSchema = { columns: cols };
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, schema: newSchema } : t))
    );
    await supabase.from("custom_tabs").update({ schema: newSchema }).eq("id", tabId);

    // Strip col from all entries in state
    setTabEntries((prev) => {
      const entries = prev.get(tabId) ?? [];
      return new Map(prev).set(
        tabId,
        entries.map((e) => {
          const d = { ...(e.data as Record<string, unknown>) };
          delete d[colKey];
          return { ...e, data: d };
        })
      );
    });

    // Persist stripped entries to DB (fire and forget, no await loop needed — entries updated in bulk if possible)
    const entries = tabEntries.get(tabId) ?? [];
    for (const e of entries) {
      const d = { ...(e.data as Record<string, unknown>) };
      delete d[colKey];
      supabase.from("tab_entries").update({ data: d }).eq("id", e.id);
    }
  }

  const addRowTab = tabs.find((t) => t.id === addRowTabId);
  const addRowCols = addRowTab ? getSchema(addRowTab) : [];

  return (
    <div className="mx-auto max-w-2xl p-4 pb-28">
      <h1 className="text-xl font-bold gradient-text mb-4">Таблицы</h1>

      {loading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-14 rounded-2xl bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {tabs.map((tab) => {
              const isExpanded = expandedTabId === tab.id;
              const entries = tabEntries.get(tab.id) ?? [];
              const cols = getSchema(tab);

              return (
                <motion.div
                  key={tab.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="rounded-2xl border border-border/40 bg-card/60 overflow-hidden"
                >
                  {/* Table header row */}
                  <div
                    className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-accent/30 transition-colors"
                    onClick={() => toggleExpand(tab.id)}
                  >
                    <Table2 className="h-4 w-4 text-primary/60 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{tab.name}</span>
                      <p className="text-[10px] text-muted-foreground/50">
                        {cols.length} {pluralCols(cols.length)} · {entries.length} строк
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteTab(tab.id); }}
                        className="p-1.5 rounded-lg text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground/40 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border/30">
                          {cols.length === 0 ? (
                            <div className="p-4 text-center">
                              <p className="text-xs text-muted-foreground/40 mb-3">Нет столбцов</p>
                              <button
                                onClick={() => setAddColTabId(tab.id)}
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <Plus className="h-3 w-3" />
                                Добавить столбец
                              </button>
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs min-w-max">
                                <thead>
                                  <tr className="border-b border-border/30 bg-muted/30">
                                    <th className="px-2 py-2 text-center font-medium text-muted-foreground/30 w-8">#</th>
                                    {cols.map((col) => (
                                      <th
                                        key={col.key}
                                        className="px-3 py-2 text-left font-medium text-muted-foreground/60 whitespace-nowrap"
                                      >
                                        <div className="flex items-center gap-1 group/col">
                                          <span>{col.label}</span>
                                          <button
                                            onClick={() => deleteColumn(tab.id, col.key)}
                                            className="p-0.5 rounded opacity-0 group-hover/col:opacity-100 hover:bg-destructive/10 hover:text-destructive text-muted-foreground/30 transition-all"
                                            title={`Удалить столбец ${col.label}`}
                                          >
                                            <X className="h-2.5 w-2.5" />
                                          </button>
                                        </div>
                                      </th>
                                    ))}
                                    {/* Add column button in header */}
                                    <th className="px-2 py-2 w-8">
                                      <button
                                        onClick={() => setAddColTabId(tab.id)}
                                        className="flex items-center justify-center h-5 w-5 rounded border border-dashed border-border/50 text-muted-foreground/40 hover:border-primary/40 hover:text-primary transition-colors"
                                        title="Добавить столбец"
                                      >
                                        <Plus className="h-3 w-3" />
                                      </button>
                                    </th>
                                    <th className="w-8" />
                                  </tr>
                                </thead>
                                <tbody>
                                  {entries.length === 0 ? (
                                    <tr>
                                      <td
                                        colSpan={cols.length + 3}
                                        className="px-3 py-6 text-center text-[11px] text-muted-foreground/30"
                                      >
                                        Строк пока нет
                                      </td>
                                    </tr>
                                  ) : (
                                    entries.map((entry, rowIdx) => (
                                      <tr
                                        key={entry.id}
                                        className="border-b border-border/20 hover:bg-accent/20 transition-colors"
                                      >
                                        <td className="px-2 py-2.5 text-center text-muted-foreground/30 font-mono text-[10px]">
                                          {rowIdx + 1}
                                        </td>
                                        {cols.map((col) => {
                                          const cellData = (entry.data as Record<string, unknown>)[col.key];
                                          const cellStr = cellData != null ? String(cellData) : "";
                                          const isEditing =
                                            editingCell?.tabId === tab.id &&
                                            editingCell?.entryId === entry.id &&
                                            editingCell?.colKey === col.key;

                                          const isFormulaMode = !isEditing && !!editingCell && editingValue.startsWith("=");

                                          return (
                                            <td
                                              key={col.key}
                                              className={`whitespace-nowrap cursor-text hover:bg-primary/5 transition-colors ${isEditing ? 'px-1 py-0.5' : 'px-3 py-2.5'} ${isFormulaMode ? 'ring-1 ring-primary/20 cursor-crosshair' : ''}`}
                                              onMouseDown={(e) => {
                                                if (isFormulaMode) {
                                                  e.preventDefault();
                                                  const ref = `${col.label}${rowIdx + 1}`;
                                                  const input = editInputRef.current;
                                                  const pos = input?.selectionStart ?? editingValue.length;
                                                  const newVal = editingValue.slice(0, pos) + ref + editingValue.slice(pos);
                                                  setEditingValue(newVal);
                                                  setTimeout(() => {
                                                    if (input) {
                                                      input.focus();
                                                      input.setSelectionRange(pos + ref.length, pos + ref.length);
                                                    }
                                                  }, 0);
                                                }
                                              }}
                                              onClick={() => {
                                                if (isFormulaMode) return;
                                                if (!isEditing) startEditCell(tab.id, entry.id, col.key, cellStr);
                                              }}
                                            >
                                              {isEditing ? (
                                                <input
                                                  ref={editInputRef}
                                                  autoFocus
                                                  value={editingValue}
                                                  onChange={(e) => setEditingValue(e.target.value)}
                                                  onBlur={commitCellEdit}
                                                  onKeyDown={(e) => {
                                                    if (e.key === "Enter") commitCellEdit();
                                                    if (e.key === "Escape") setEditingCell(null);
                                                    e.stopPropagation();
                                                  }}
                                                  className="w-full bg-primary/5 rounded px-2 py-1 outline-none border border-primary/40 text-xs text-foreground min-w-[60px]"
                                                />
                                              ) : (
                                                <span className={`text-xs ${cellStr.startsWith("=") ? "text-primary/80 font-mono" : "text-foreground/80"}`}>
                                                  {cellStr.startsWith("=")
                                                    ? evalFormula(cellStr, entries, cols)
                                                    : cellStr || <span className="text-muted-foreground/20 text-[10px]">—</span>
                                                  }
                                                </span>
                                              )}
                                            </td>
                                          );
                                        })}
                                        {/* spacer for add-col header button */}
                                        <td className="w-8" />
                                        <td className="px-2 py-2">
                                          <button
                                            onClick={() => deleteRow(tab.id, entry.id)}
                                            className="p-1 rounded text-muted-foreground/20 hover:text-destructive transition-colors"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          )}
                          <div className="p-2">
                            <button
                              onClick={() => setAddRowTabId(tab.id)}
                              className="flex items-center gap-1.5 px-3 py-2 w-full rounded-xl text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Добавить строку
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>

          <button
            onClick={() => setCreateOpen(true)}
            className="w-full mt-1 py-3 rounded-2xl border-2 border-dashed border-border/40 text-sm text-muted-foreground/50 hover:border-primary/30 hover:text-primary/60 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Новая таблица
          </button>
        </div>
      )}

      <CreateTableDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={(name, cols, rows) => createTab(name, cols, rows)}
      />

      {addRowTabId && addRowCols.length > 0 && (
        <AddRowDialog
          open={!!addRowTabId}
          onOpenChange={(open) => { if (!open) setAddRowTabId(null); }}
          cols={addRowCols}
          onAdd={(data) => addRow(addRowTabId, data)}
        />
      )}

      {addColTabId && (
        <AddColumnDialog
          open={!!addColTabId}
          onOpenChange={(open) => { if (!open) setAddColTabId(null); }}
          onAdd={(label) => addColumn(addColTabId, label)}
        />
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function colName(i: number): string {
  if (i < 26) return String.fromCharCode(65 + i);
  return String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26));
}

function Stepper({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="h-8 w-8 rounded-lg border border-border/50 text-muted-foreground hover:bg-accent/50 transition-colors text-lg font-medium"
      >
        −
      </button>
      <span className="w-6 text-center font-semibold text-sm">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="h-8 w-8 rounded-lg border border-border/50 text-muted-foreground hover:bg-accent/50 transition-colors text-lg font-medium"
      >
        +
      </button>
    </div>
  );
}

// ─── Dialogs ──────────────────────────────────────────────────────────────────

function CreateTableDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, columns: ColDef[], rowCount: number) => void;
}) {
  const [name, setName] = useState("");
  const [colCount, setColCount] = useState(3);
  const [rowCount, setRowCount] = useState(5);

  useEffect(() => {
    if (open) { setName(""); setColCount(3); setRowCount(5); }
  }, [open]);

  const previewCols = Array.from({ length: colCount }, (_, i) => colName(i));

  function handleCreate() {
    if (!name.trim()) return;
    const cols = previewCols.map((label, i) => ({
      key: `col_${label}_${Date.now() + i}`,
      label,
    }));
    onCreate(name, cols, rowCount);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-4 rounded-2xl">
        <DialogHeader>
          <DialogTitle>Новая таблица</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-1">
          <Input
            autoFocus
            placeholder="Название таблицы"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground/60">Столбцы</p>
              <Stepper value={colCount} onChange={setColCount} min={1} max={26} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {previewCols.map((label) => (
                <span key={label} className="px-2 py-0.5 rounded-md bg-muted/60 text-xs font-mono text-muted-foreground">
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground/60">Строки</p>
            <Stepper value={rowCount} onChange={setRowCount} min={1} max={100} />
          </div>

          <Button className="w-full gradient-primary text-white border-0" disabled={!name.trim()} onClick={handleCreate}>
            <Check className="h-4 w-4 mr-1.5" />
            Создать {colCount} × {rowCount}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddRowDialog({
  open,
  onOpenChange,
  cols,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cols: ColDef[];
  onAdd: (data: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const init: Record<string, string> = {};
      cols.forEach((c) => { init[c.key] = ""; });
      setValues(init);
    }
  }, [open, cols]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-4 rounded-2xl">
        <DialogHeader>
          <DialogTitle>Новая строка</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          {cols.map((col, i) => (
            <div key={col.key}>
              <label className="text-xs text-muted-foreground/60 mb-1 block">{col.label}</label>
              <Input
                autoFocus={i === 0}
                value={values[col.key] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [col.key]: e.target.value }))}
                placeholder={col.label}
                className="h-9 text-sm"
              />
            </div>
          ))}
          <Button className="w-full gradient-primary text-white border-0 mt-2" onClick={() => onAdd(values)}>
            <Check className="h-4 w-4 mr-1.5" />
            Добавить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddColumnDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (label: string) => void;
}) {
  const [label, setLabel] = useState("");

  useEffect(() => { if (open) setLabel(""); }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    onAdd(label.trim());
    setLabel("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-4 rounded-2xl">
        <DialogHeader>
          <DialogTitle>Новый столбец</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <Input
            autoFocus
            placeholder="Название столбца"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={!label.trim()} className="flex-1 gradient-primary text-white border-0">
              <Check className="h-4 w-4 mr-1" />
              Добавить
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
