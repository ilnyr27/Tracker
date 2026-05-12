"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Note } from "@/lib/supabase/types";

export default function JournalPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);

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
    if (!newNote.trim()) return;
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

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
    }
  }

  async function deleteNote(id: string) {
    const supabase = createClient();
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("notes").delete().eq("id", id);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addNote();
    }
  }

  // Group notes by date
  const grouped = notes.reduce<Record<string, Note[]>>((acc, note) => {
    const date = note.note_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(note);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-2xl p-4 flex flex-col h-[calc(100vh-5rem)] md:h-screen">
      <h1 className="text-xl font-bold mb-4 gradient-text">
        Журнал мыслей
      </h1>

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
                      <p className="text-sm whitespace-pre-wrap leading-relaxed pr-6">
                        {note.content}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-[10px] text-muted-foreground/40">
                          {format(new Date(note.created_at), "HH:mm")}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-destructive/10 transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-destructive" />
                      </button>
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
