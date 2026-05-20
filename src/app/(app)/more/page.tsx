"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Target,
  Table2,
  Layers,
  Settings,
  ChevronRight,
} from "lucide-react";
import { motion } from "motion/react";

const menuGroups = [
  {
    label: "Цели",
    items: [
      {
        href: "/goals",
        label: "Путь А → Б",
        description: "Все цели по направлениям",
        icon: Target,
      },
    ],
  },
  {
    label: "Записи",
    items: [
      {
        href: "/journal",
        label: "Журнал",
        description: "Мысли и заметки",
        icon: BookOpen,
      },
    ],
  },
  {
    label: "Данные",
    items: [
      {
        href: "/table",
        label: "Таблица",
        description: "Полная таблица как в Excel",
        icon: Table2,
      },
      {
        href: "/sheets",
        label: "Листы",
        description: "Книги, привычки и др.",
        icon: Layers,
      },
    ],
  },
  {
    label: "Система",
    items: [
      {
        href: "/settings",
        label: "Настройки",
        description: "Тема, аккаунт, экспорт",
        icon: Settings,
      },
    ],
  },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

export default function MorePage() {
  return (
    <div className="mx-auto max-w-lg p-4 pb-24 md:pb-4">
      <h1 className="text-xl font-bold gradient-text mb-4">Ещё</h1>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-5"
      >
        {menuGroups.map((group) => (
          <motion.div key={group.label} variants={item}>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40 px-1">
              {group.label}
            </span>
            <div className="mt-1 rounded-2xl border border-border/50 bg-card/80 overflow-hidden divide-y divide-border/30">
              {group.items.map((menuItem) => (
                <Link
                  key={menuItem.href}
                  href={menuItem.href}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                    <menuItem.icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{menuItem.label}</span>
                    <p className="text-xs text-muted-foreground">
                      {menuItem.description}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                </Link>
              ))}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
