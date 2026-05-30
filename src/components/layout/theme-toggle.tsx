"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "motion/react";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const options = [
    { value: "light", icon: Sun, label: "Светлая" },
    { value: "dark", icon: Moon, label: "Тёмная" },
  ] as const;

  if (compact) {
    const next = theme === "light" ? "dark" : "light";
    const CurrentIcon = theme === "dark" ? Moon : Sun;

    return (
      <button
        onClick={() => setTheme(next)}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors w-full"
        title={`Тема: ${options.find((o) => o.value === theme)?.label}`}
      >
        <CurrentIcon className="h-4 w-4" />
        Тема
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-xl bg-muted/50 p-1">
      {options.map((opt) => {
        const isActive = theme === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className="relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors"
          >
            {isActive && (
              <motion.div
                layoutId="theme-toggle-bg"
                className="absolute inset-0 rounded-lg bg-background shadow-sm border border-border/50"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <opt.icon className="relative h-3.5 w-3.5" />
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
