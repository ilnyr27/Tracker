"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Pin } from "lucide-react";
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
      <h1 className="text-2xl font-bold mb-4">Журнал мыслей</h1>

      {/* Notes Feed */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <AnimatePresence>
            {Object.entries(grouped).map(([date, dateNotes]) => (
              <div key={date}>
                <p className="text-xs font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                  {format(new Date(date + "T00:00:00"), "d MMMM yyyy, EEEE", {
                    locale: ru,
                  })}
                </p>
                <div className="space-y-2">
                  {dateNotes.map((note) => (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <Card>
                        <CardContent className="py-3 px-4">
                          <p className="text-sm whitespace-pre-wrap">
                            {note.content}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(note.created_at), "HH:mm")}
                          </p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2 items-end">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Мысль, идея, заметка..."
          className="min-h-[44px] max-h-32 resize-none"
          rows={1}
        />
        <Button
          size="icon"
          onClick={addNote}
          disabled={!newNote.trim()}
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
