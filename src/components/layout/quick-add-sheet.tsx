"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ListTodo, StickyNote, Camera } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";

type QuickAddSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const actions = [
  {
    href: "/today?add=task",
    icon: ListTodo,
    label: "Задача",
    color: "#3b82f6",
  },
  {
    href: "/journal?add=note",
    icon: StickyNote,
    label: "Заметка",
    color: "#8b5cf6",
  },
  {
    href: "/photos?add=photo",
    icon: Camera,
    label: "Фото",
    color: "#ec4899",
  },
];

export function QuickAddSheet({ open, onOpenChange }: QuickAddSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-border/30 bg-card/95 backdrop-blur-xl">
        <SheetHeader>
          <SheetTitle className="text-base">Быстрое добавление</SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-3 gap-3 py-4">
          {actions.map((action, i) => (
            <Link
              key={action.href}
              href={action.href}
              onClick={() => onOpenChange(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex h-24 flex-col items-center justify-center gap-2.5 rounded-2xl border border-border/30 bg-accent/30 hover:bg-accent/50 transition-colors"
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${action.color}20` }}
                >
                  <action.icon
                    className="h-5 w-5"
                    style={{ color: action.color }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {action.label}
                </span>
              </motion.div>
            </Link>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
