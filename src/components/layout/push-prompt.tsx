"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  registerServiceWorker,
  subscribeToWebPush,
} from "@/lib/notifications";

const STORAGE_KEY = "push_prompt_dismissed";

export function PushPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isNotificationSupported()) return;
    if (getNotificationPermission() !== "default") return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    const t = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(t);
  }, []);

  async function handleEnable() {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "1");
    const result = await requestNotificationPermission();
    if (result === "granted") {
      await registerServiceWorker();
      await subscribeToWebPush();
    }
  }

  function handleDismiss() {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "1");
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="bg-card border border-border/50 rounded-2xl shadow-xl p-4 flex items-center gap-3">
        <div className="h-9 w-9 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bell className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">Включить уведомления?</p>
          <p className="text-xs text-muted-foreground mt-0.5">Напомним о задачах и привычках</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleEnable}
            className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium"
          >
            Включить
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-xl text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
