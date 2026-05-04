"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  BookOpen,
  LayoutGrid,
  Sun,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/today", label: "Сегодня", icon: Sun },
  { href: "/calendar", label: "Календарь", icon: CalendarDays },
  { href: "/_fab", label: "", icon: Plus, isFab: true },
  { href: "/journal", label: "Журнал", icon: BookOpen },
  { href: "/more", label: "Ещё", icon: LayoutGrid },
];

type BottomNavProps = {
  onFabClick: () => void;
};

export function BottomNav({ onFabClick }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          if (item.isFab) {
            return (
              <button
                key="fab"
                onClick={onFabClick}
                className="flex h-12 w-12 -mt-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform"
              >
                <Plus className="h-6 w-6" />
              </button>
            );
          }

          const isActive =
            pathname === item.href ||
            (item.href !== "/today" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href === "/more" ? "/goals" : item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
