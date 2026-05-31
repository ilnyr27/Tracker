"use client";

import { createClient } from "@/lib/supabase/client";
import { isNotificationSupported } from "@/lib/notifications";

const FIRED_KEY = "notif_fired_today";

function getFiredToday(): Set<string> {
  if (typeof window === "undefined") return new Set();
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (parsed.date !== today) {
      localStorage.removeItem(FIRED_KEY);
      return new Set();
    }
    return new Set(parsed.ids as string[]);
  } catch {
    return new Set();
  }
}

function markFired(id: string) {
  const today = new Date().toISOString().slice(0, 10);
  const existing = getFiredToday();
  existing.add(id);
  localStorage.setItem(FIRED_KEY, JSON.stringify({ date: today, ids: Array.from(existing) }));
}

type GoalReminder = {
  id: string;
  title: string;
  reminder_time: string;
  reminder_date: string | null;
};

let cachedGoals: GoalReminder[] | null = null;
let lastFetch = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;

async function fetchGoals(): Promise<GoalReminder[]> {
  const now = Date.now();
  // Cache for 5 minutes
  if (cachedGoals && now - lastFetch < 5 * 60 * 1000) return cachedGoals;

  const supabase = createClient();
  const { data } = await supabase
    .from("goals")
    .select("id, title, reminder_time, reminder_date")
    .eq("status", "active")
    .not("reminder_time", "is", null);

  cachedGoals = (data as GoalReminder[]) || [];
  lastFetch = now;
  return cachedGoals;
}

async function showNotification(title: string, body: string) {
  try {
    const registration = await navigator.serviceWorker.ready;
    registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      requireInteraction: true,
      tag: `goal-${Date.now()}`,
      data: { url: "/today" },
    } as NotificationOptions);
  } catch {
    // Fallback to Notification API
    new Notification(title, { body, icon: "/icons/icon-192.png" });
  }
}

async function checkAndFire() {
  if (!isNotificationSupported() || Notification.permission !== "granted") return;

  const goals = await fetchGoals();
  if (!goals.length) return;

  const now = new Date();
  const currentHH = String(now.getHours()).padStart(2, "0");
  const currentMM = String(now.getMinutes()).padStart(2, "0");
  const currentTime = `${currentHH}:${currentMM}`;
  const todayStr = now.toISOString().slice(0, 10);
  const fired = getFiredToday();

  for (const goal of goals) {
    if (fired.has(goal.id)) continue;

    // Parse reminder time (HH:MM or HH:MM:SS)
    const goalTime = goal.reminder_time.slice(0, 5); // "HH:MM"

    // For milestone goals with reminder_date — only fire on that date
    if (goal.reminder_date && goal.reminder_date !== todayStr) continue;

    // Check if current time matches (within same minute)
    if (currentTime === goalTime) {
      await showNotification(
        `🔔 ${goal.title}`,
        "Пора! Не забудь выполнить."
      );
      markFired(goal.id);
    }
  }
}

export function startNotificationPolling() {
  if (typeof window === "undefined") return;
  if (!isNotificationSupported() || Notification.permission !== "granted") return;

  // Stop existing interval
  if (intervalId) clearInterval(intervalId);

  // Check immediately
  checkAndFire();

  // Poll every 30 seconds
  intervalId = setInterval(checkAndFire, 30_000);
}

export function stopNotificationPolling() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

// Invalidate cache when goals change
export function invalidateGoalCache() {
  cachedGoals = null;
  lastFetch = 0;
}

// Legacy export for compatibility
export async function scheduleGoalNotifications(): Promise<number> {
  startNotificationPolling();
  return 0;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const result = await Notification.requestPermission();
  return result === "granted";
}
