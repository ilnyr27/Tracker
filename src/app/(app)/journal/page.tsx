"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Send,
  Trash2,
  Search,
  X,
  Check,
  List,
  BookOpen,
  Plus,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Note, CustomTab, TabEntry } from "@/lib/supabase/types";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ActiveTab = "journal" | "sheets";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function JournalPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("journal");

  // Swipe gesture — changes activeTab state, no router.push
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
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) setActiveTab("sheets");
        else setActiveTab("journal");
      }
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
    };
  }, []);

  return (
    <div className="mx-auto max-w-2xl p-4 flex flex-col h-[calc(100vh-5rem)] md:h-screen overflow-x-hidden">
      {/* Header */}
      <div className="mb-3 shrink-0">
        <h1 className="text-xl font-bold gradient-text">Журнал</h1>
      </div>

      {/* Tab bar */}
      <div className="flex rounded-xl border border-border/50 overflow-hidden text-xs mb-3 shrink-0">
        <button
          onClick={() => setActiveTab("journal")}
          className={`flex-1 px-3 py-2 flex items-center justify-center gap-1 transition-colors ${
            activeTab === "journal"
              ? "bg-primary/10 text-primary font-semibold"
              : "text-muted-foreground hover:bg-accent/40"
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Журнал
        </button>
        <button
          onClick={() => setActiveTab("sheets")}
          className={`flex-1 px-3 py-2 flex items-center justify-center gap-1 transition-colors ${
            activeTab === "sheets"
              ? "bg-primary/10 text-primary font-semibold"
              : "text-muted-foreground hover:bg-accent/40"
          }`}
        >
          <List className="h-3.5 w-3.5" />
          Список
        </button>
      </div>

      {/* Sliding panels container */}
      <div className="flex-1 overflow-hidden relative">
        <motion.div
          className="flex h-full"
          style={{ width: "200%" }}
          animate={{ x: activeTab === "journal" ? "0%" : "-50%" }}
          transition={{ type: "spring", stiffness: 400, damping: 38, mass: 0.8 }}
        >
          {/* Journal panel — 50% of 200% outer = 100% of viewport */}
          <div className="h-full overflow-hidden flex flex-col" style={{ width: "50%" }}>
            <JournalPanel />
          </div>

          {/* Sheets panel */}
          <div className="h-full overflow-y-auto" style={{ width: "50%" }}>
            <SheetsPanel />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Journal Panel ────────────────────────────────────────────────────────────

function JournalPanel() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadNotes();
  }, []);

  async function loadNotes() {
    const supabase = createClient();
    const { data } = await supabase
      .from("notes")
      .select("*")
      .order("note_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setNotes(data);
    setLoading(false);
  }

  async function addNote() {
    if (!newNote.trim() || submitting) return;
    setSubmitting(true);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setSubmitting(false); return; }

    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("notes")
      .insert({ user_id: userData.user.id, note_date: today, content: newNote.trim() })
      .select()
      .single();

    if (data) {
      setNotes((prev) => [data, ...prev]);
      setNewNote("");
    } else {
      toast.error("Не удалось сохранить заметку");
    }
    setSubmitting(false);
  }

  async function deleteNote(id: string) {
    const supabase = createClient();
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setConfirmDeleteId(null);
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) toast.error("Не удалось удалить заметку");
  }

  function startEdit(note: Note) {
    setEditingId(note.id);
    setEditContent(note.content);
  }

  async function saveEdit(id: string) {
    if (!editContent.trim()) return;
    const supabase = createClient();
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content: editContent.trim() } : n)));
    setEditingId(null);
    await supabase.from("notes").update({ content: editContent.trim() }).eq("id", id);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addNote();
    }
  }

  const filteredNotes = searchQuery.trim()
    ? notes.filter((n) => n.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : notes;

  const grouped = filteredNotes.reduce<Record<string, Note[]>>((acc, note) => {
    const date = note.note_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(note);
    return acc;
  }, {});

  return (
    <>
      {/* Search toggle */}
      <div className="flex items-center justify-end mb-2 shrink-0">
        <button
          onClick={() => { setSearching(!searching); if (searching) setSearchQuery(""); }}
          className="p-2 rounded-xl hover:bg-accent/50 transition-colors"
        >
          {searching ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
        </button>
      </div>

      {searching && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-3 shrink-0"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по заметкам..."
              className="w-full rounded-xl border border-border/50 bg-card/60 pl-9 pr-4 py-2 text-sm outline-none placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-primary/30 transition-all"
            />
          </div>
          {searchQuery && (
            <p className="text-[10px] text-muted-foreground/50 mt-1 px-1">
              Найдено: {filteredNotes.length}
            </p>
          )}
        </motion.div>
      )}

      {/* Notes feed */}
      <div className="flex-1 overflow-y-auto space-y-5 mb-4 scrollbar-thin">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-card animate-pulse" />
            ))}
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40">
            <BookOpenSvgIcon className="h-12 w-12 mb-3" />
            <p className="text-sm">Пока пусто. Напиши свою первую мысль</p>
          </div>
        ) : (
          <AnimatePresence>
            {Object.entries(grouped).map(([date, dateNotes]) => (
              <div key={date}>
                <p className="text-xs font-medium text-muted-foreground/60 mb-2 sticky top-0 bg-background/90 backdrop-blur-sm py-1.5 z-10">
                  {format(new Date(date + "T00:00:00"), "d MMMM, EEEE", { locale: ru })}
                </p>
                <div className="space-y-2">
                  {dateNotes.map((note, i) => (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      transition={{ delay: i * 0.03 }}
                      className="group relative rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm px-4 py-3 hover:bg-card/80 transition-colors"
                    >
                      {editingId === note.id ? (
                        <div className="space-y-2">
                          <Textarea
                            autoFocus
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onFocus={(e) => {
                              const len = e.target.value.length;
                              e.target.setSelectionRange(len, len);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(note.id); }
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="min-h-[60px] resize-none border-border/50 bg-background/50 text-sm"
                            rows={2}
                          />
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                              Отмена
                            </Button>
                            <Button size="sm" className="h-7 text-xs gradient-primary text-white border-0" onClick={() => saveEdit(note.id)}>
                              <Check className="h-3 w-3 mr-1" />
                              Сохранить
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p
                            className="text-sm whitespace-pre-wrap leading-relaxed pr-10 cursor-text"
                            onClick={() => startEdit(note)}
                          >
                            {note.content}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-[10px] text-muted-foreground/40">
                              {format(new Date(note.created_at), "HH:mm")}
                            </p>
                          </div>
                          <div className="absolute top-3 right-3 flex gap-1">
                            {confirmDeleteId === note.id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => deleteNote(note.id)} className="px-1.5 py-0.5 text-[10px] rounded bg-destructive text-white">
                                  Да
                                </button>
                                <button onClick={() => setConfirmDeleteId(null)} className="px-1.5 py-0.5 text-[10px] rounded border border-border/50 text-muted-foreground">
                                  Нет
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDeleteId(note.id)} className="p-1 rounded-lg hover:bg-destructive/10 transition-all">
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground/30 hover:text-destructive" />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Note input — only on journal panel */}
      <div className="shrink-0 flex gap-2 items-end rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-2">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Мысль, идея, заметка..."
          className="min-h-[44px] max-h-32 resize-none border-0 bg-transparent focus-visible:ring-0 text-sm placeholder:text-muted-foreground/40"
          rows={1}
        />
        <Button
          size="icon"
          onClick={addNote}
          disabled={!newNote.trim() || submitting}
          className="shrink-0 h-9 w-9 rounded-xl gradient-primary text-white border-0 disabled:opacity-30"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}

// ─── Sheets Panel ─────────────────────────────────────────────────────────────

function SheetsPanel() {
  const [tabs, setTabs] = useState<CustomTab[]>([]);
  const [tabEntries, setTabEntries] = useState<Map<string, TabEntry[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedTabId, setExpandedTabId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const loadTabs = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("custom_tabs")
      .select("*")
      .eq("tab_type", "list")
      .order("sort_order");
    if (data) setTabs(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTabs();
  }, [loadTabs]);

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

  async function createTab(name: string) {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data } = await supabase
      .from("custom_tabs")
      .insert({ user_id: userData.user.id, name, tab_type: "list", sort_order: tabs.length })
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
    <div className="pb-4">
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
              <div key={tab.id} className="rounded-2xl border border-border/50 bg-card/80 overflow-hidden">
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
                      <p className="text-[11px] text-muted-foreground/60">{doneCount}/{entries.length} выполнено</p>
                    )}
                  </div>
                  <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="h-4 w-4 text-muted-foreground/40" />
                  </motion.div>
                </button>

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
                          entries={entries}
                          onAdd={(data) => addEntry(tab.id, data)}
                          onUpdate={(id, data) => updateEntry(tab.id, id, data)}
                          onDelete={(id) => deleteEntry(tab.id, id)}
                        />
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

      <button
        onClick={() => setCreateOpen(true)}
        className="mt-4 flex items-center gap-2 w-full px-4 py-3 rounded-2xl border border-dashed border-border/50 text-muted-foreground/60 hover:border-primary/40 hover:text-primary transition-colors text-sm"
      >
        <Plus className="h-4 w-4" />
        Новый список
      </button>

      <CreateListDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={createTab} />
    </div>
  );
}

// ─── List View Inline ─────────────────────────────────────────────────────────

function ListViewInline({
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
              <div key={entry.id} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-accent/20 transition-colors">
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

// ─── Tab Actions ──────────────────────────────────────────────────────────────

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
        <button onClick={() => setRenaming(true)} className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
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
        <button onClick={() => setConfirmDelete(true)} className="text-xs text-destructive/60 hover:text-destructive transition-colors">
          Удалить список
        </button>
      )}
    </div>
  );
}

// ─── Create List Dialog ───────────────────────────────────────────────────────

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
            <Button type="submit" disabled={!name.trim()} className="flex-1 gradient-primary text-white border-0 hover:opacity-90">
              Создать
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── SVG icon ─────────────────────────────────────────────────────────────────

function BookOpenSvgIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
