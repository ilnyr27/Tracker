"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Grid3X3,
  CalendarDays,
  MoreHorizontal,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

const navItems = [
  { href: "/journal", label: "Журнал", icon: BookOpen },
  { href: "/tabel", label: "Матрица", icon: Grid3X3 },
  { href: "/today", label: "Трекер", icon: Home },
  { href: "/calendar", label: "Обзор", icon: CalendarDays },
  { href: "/more", label: "Ещё", icon: MoreHorizontal },
];

// Пути которые подсвечивают "Журнал"
const journalPaths = ["/journal", "/sheets"];
// Пути которые подсвечивают "Ещё"
const morePagePaths = ["/goals", "/photos", "/faq", "/table", "/settings", "/more", "/archive"];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Навигация" className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/90 backdrop-blur-xl md:hidden pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/journal"
              ? journalPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))
              : item.href === "/more"
                ? morePagePaths.some((p) => pathname === p || pathname.startsWith(p + "/"))
                : pathname === item.href ||
                  (item.href !== "/today" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] transition-colors",
                isActive ? "text-primary" : "text-muted-foreground/60"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-px left-2 right-2 h-0.5 rounded-full gradient-primary"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
