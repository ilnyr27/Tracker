"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Trash2, Search, X, Check, List } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Note } from "@/lib/supabase/types";
import { toast } from "sonner";
import Link from "next/link";

export default function JournalPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

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
      .insert({
        user_id: userData.user.id,
        note_date: today,
        content: newNote.trim(),
      })
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

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, content: editContent.trim() } : n))
    );
    setEditingId(null);
    await supabase.from("notes").update({ content: editContent.trim() }).eq("id", id);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addNote();
    }
  }

  // Filter + group notes by date
  const filteredNotes = searchQuery.trim()
    ? notes.filter((n) =>
        n.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : notes;

  const grouped = filteredNotes.reduce<Record<string, Note[]>>((acc, note) => {
    const date = note.note_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(note);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-2xl p-4 flex flex-col h-[calc(100vh-5rem)] md:h-screen">
      {/* Header + tab switcher */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold gradient-text">Журнал</h1>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl"
          onClick={() => {
            setSearching(!searching);
            if (searching) setSearchQuery("");
          }}
        >
          {searching ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {/* Журнал / Список switcher */}
      <div className="flex rounded-xl border border-border/50 overflow-hidden text-xs mb-3">
        <button className="flex-1 px-3 py-2 bg-primary/10 text-primary font-semibold">
          Журнал
        </button>
        <Link
          href="/sheets"
          className="flex-1 px-3 py-2 text-muted-foreground hover:bg-accent/40 text-center transition-colors flex items-center justify-center gap-1"
        >
          <List className="h-3.5 w-3.5" />
          Список
        </Link>
      </div>

      {searching && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-3"
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

      {/* Notes Feed */}
      <div className="flex-1 overflow-y-auto space-y-5 mb-4 scrollbar-thin">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-2xl bg-card animate-pulse"
              />
            ))}
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40">
            <BookOpenIcon className="h-12 w-12 mb-3" />
            <p className="text-sm">Пока пусто. Напиши свою первую мысль</p>
          </div>
        ) : (
          <AnimatePresence>
            {Object.entries(grouped).map(([date, dateNotes]) => (
              <div key={date}>
                <p className="text-xs font-medium text-muted-foreground/60 mb-2 sticky top-0 bg-background/90 backdrop-blur-sm py-1.5 z-10">
                  {format(new Date(date + "T00:00:00"), "d MMMM, EEEE", {
                    locale: ru,
                  })}
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
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                saveEdit(note.id);
                              }
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="min-h-[60px] resize-none border-border/50 bg-background/50 text-sm"
                            rows={2}
                          />
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => setEditingId(null)}
                            >
                              Отмена
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-xs gradient-primary text-white border-0"
                              onClick={() => saveEdit(note.id)}
                            >
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
                                <button
                                  onClick={() => deleteNote(note.id)}
                                  className="px-1.5 py-0.5 text-[10px] rounded bg-destructive text-white"
                                >
                                  Да
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-1.5 py-0.5 text-[10px] rounded border border-border/50 text-muted-foreground"
                                >
                                  Нет
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(note.id)}
                                className="p-1 rounded-lg hover:bg-destructive/10 transition-all"
                              >
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

      {/* Input */}
      <div className="flex gap-2 items-end rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-2">
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
          disabled={!newNote.trim()}
          className="shrink-0 h-9 w-9 rounded-xl gradient-primary text-white border-0 disabled:opacity-30"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function BookOpenIcon({ className }: { className?: string }) {
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
