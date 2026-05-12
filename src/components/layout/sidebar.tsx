"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun,
  CalendarDays,
  Target,
  Map,
  BookOpen,
  Camera,
  Table2,
  Layers,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  { href: "/today", label: "Сегодня", icon: Sun },
  { href: "/calendar", label: "Календарь", icon: CalendarDays },
  { href: "/goals", label: "Цели", icon: Target },
  { href: "/plans", label: "Планы", icon: Map },
  { href: "/journal", label: "Журнал", icon: BookOpen },
  { href: "/photos", label: "Фото", icon: Camera },
  { href: "/table", label: "Таблица", icon: Table2 },
  { href: "/sheets", label: "Листы", icon: Layers },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="hidden md:flex md:w-60 lg:w-64 flex-col border-r border-border/50 bg-sidebar h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 p-5 border-b border-border/50">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-md shadow-primary/20">
          <Target className="h-5 w-5 text-white" />
        </div>
        <span className="font-bold text-lg gradient-text">Life Tracker</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-3 mt-1">
        {navItems.map((navItem) => {
          const isActive =
            pathname === navItem.href ||
            (navItem.href !== "/today" && pathname.startsWith(navItem.href));

          return (
            <Link
              key={navItem.href}
              href={navItem.href}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
                isActive
                  ? "text-primary font-medium"
                  : "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/20"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <navItem.icon className="relative h-4.5 w-4.5" />
              <span className="relative">{navItem.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border/50 p-3 space-y-0.5">
        <ThemeToggle compact />
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
            pathname === "/settings"
              ? "text-primary font-medium bg-primary/10"
              : "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          )}
        >
          <Settings className="h-4 w-4" />
          Настройки
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/40 hover:text-destructive hover:bg-destructive/5 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Выйти
        </button>
      </div>
    </aside>
  );
}
