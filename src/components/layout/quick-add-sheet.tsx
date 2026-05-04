"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ListTodo, StickyNote, Camera } from "lucide-react";
import Link from "next/link";

type QuickAddSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function QuickAddSheet({ open, onOpenChange }: QuickAddSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Быстрое добавление</SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-3 gap-3 py-4">
          <Link href="/today?add=task" onClick={() => onOpenChange(false)}>
            <Button
              variant="outline"
              className="h-20 w-full flex-col gap-2"
            >
              <ListTodo className="h-6 w-6" />
              <span className="text-xs">Задача</span>
            </Button>
          </Link>
          <Link href="/journal?add=note" onClick={() => onOpenChange(false)}>
            <Button
              variant="outline"
              className="h-20 w-full flex-col gap-2"
            >
              <StickyNote className="h-6 w-6" />
              <span className="text-xs">Заметка</span>
            </Button>
          </Link>
          <Link href="/photos?add=photo" onClick={() => onOpenChange(false)}>
            <Button
              variant="outline"
              className="h-20 w-full flex-col gap-2"
            >
              <Camera className="h-6 w-6" />
              <span className="text-xs">Фото</span>
            </Button>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
