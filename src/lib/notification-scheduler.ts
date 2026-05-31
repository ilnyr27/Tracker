"use client";

import { createClient } from "@/lib/supabase/client";
import {
  isNotificationSupported,
  requestNotificationPermission,
  scheduleNotification,
} from "@/lib/notifications";

const SCHEDULED_KEY = "scheduled_notifications";

function getScheduledToday(): Set<string> {
  if (typeof window === "undefined") return new Set();
  const today = new Date().toISOString().slice(0, 10);
  const raw = sessionStorage.getItem(SCHEDULED_KEY);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    if (parsed.date !== today) return new Set();
    return new Set(parsed.ids as string[]);
  } catch {
    return new Set();
  }
}

function markScheduled(id: string) {
  const today = new Date().toISOString().slice(0, 10);
  const existing = getScheduledToday();
  existing.add(id);
  sessionStorage.setItem(
    SCHEDULED_KEY,
    JSON.stringify({ date: today, ids: Array.from(existing) })
  );
}

export async function scheduleGoalNotifications(): Promise<number> {
  if (!isNotificationSupported()) return 0;
  if (Notification.permission !== "granted") return 0;

  const supabase = createClient();
  const { data: goals } = await supabase
    .from("goals")
    .select("id, title, reminder_time, category_id")
    .eq("status", "active")
    .not("reminder_time", "is", null);

  if (!goals || goals.length === 0) return 0;

  const now = new Date();
  const scheduled = getScheduledToday();
  let count = 0;

  for (const goal of goals) {
    if (scheduled.has(goal.id)) continue;
    if (!goal.reminder_time) continue;

    // Parse reminder_time "HH:MM" or "HH:MM:SS"
    const [h, m] = goal.reminder_time.split(":").map(Number);
    const target = new Date(now);
    target.setHours(h, m, 0, 0);

    const delayMs = target.getTime() - now.getTime();
    if (delayMs <= 0) continue; // Already passed today

    await scheduleNotification(
      goal.title,
      "Пора! Не забудь выполнить.",
      delayMs,
      "/today"
    );

    markScheduled(goal.id);
    count++;
  }

  return count;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const result = await requestNotificationPermission();
  return result === "granted";
}
