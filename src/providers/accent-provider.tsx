"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const ACCENT_OPTIONS = [
  { id: "blue", label: "Синий", preview: "oklch(0.55 0.2 250)" },
  { id: "purple", label: "Фиолетовый", preview: "oklch(0.55 0.2 290)" },
  { id: "teal", label: "Бирюзовый", preview: "oklch(0.55 0.15 190)" },
  { id: "green", label: "Зелёный", preview: "oklch(0.55 0.18 155)" },
  { id: "amber", label: "Золотой", preview: "oklch(0.55 0.16 50)" },
  { id: "rose", label: "Розовый", preview: "oklch(0.55 0.2 15)" },
] as const;

export type AccentId = (typeof ACCENT_OPTIONS)[number]["id"];

const AccentContext = createContext<{
  accent: AccentId;
  setAccent: (id: AccentId) => void;
}>({ accent: "blue", setAccent: () => {} });

export function useAccent() {
  return useContext(AccentContext);
}

export function AccentProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<AccentId>("blue");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("accent-color") as AccentId | null;
    if (stored && ACCENT_OPTIONS.some((o) => o.id === stored)) {
      setAccentState(stored);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-accent", accent);
    localStorage.setItem("accent-color", accent);
  }, [accent, mounted]);

  function setAccent(id: AccentId) {
    setAccentState(id);
  }

  return (
    <AccentContext.Provider value={{ accent, setAccent }}>
      {children}
    </AccentContext.Provider>
  );
}
