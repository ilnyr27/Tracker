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
  Target as Logo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

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
    <aside className="hidden md:flex md:w-60 lg:w-64 flex-col border-r bg-sidebar h-screen sticky top-0">
      <div className="flex items-center gap-2 p-4 border-b">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Logo className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-semibold text-lg">Life Tracker</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/today" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3 space-y-1">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
            pathname === "/settings"
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
          )}
        >
          <Settings className="h-4 w-4" />
          Настройки
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Выйти
        </button>
      </div>
    </aside>
  );
}
