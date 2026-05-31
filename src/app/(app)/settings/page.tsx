"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Palette, Repeat, ChevronRight, Bell, BellOff, Archive } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AccentPicker } from "@/components/layout/accent-picker";
import Link from "next/link";
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  registerServiceWorker,
} from "@/lib/notifications";

export default function SettingsPage() {
  const router = useRouter();
  const [notifPermission, setNotifPermission] = useState<string>("default");
  const [notifSupported, setNotifSupported] = useState(false);

  // Granular notification preferences (stored in localStorage)
  const [notifPrefs, setNotifPrefs] = useState({
    habits: true,
    goals: true,
    journal: true,
    streak: true,
  });

  useEffect(() => {
    const supported = isNotificationSupported();
    setNotifSupported(supported);
    if (supported) {
      setNotifPermission(getNotificationPermission());
      registerServiceWorker();
    }
    // Load saved preferences
    try {
      const saved = localStorage.getItem("notif_prefs");
      if (saved) setNotifPrefs(JSON.parse(saved));
    } catch {}
  }, []);

  function updateNotifPref(key: keyof typeof notifPrefs, value: boolean) {
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefs(updated);
    localStorage.setItem("notif_prefs", JSON.stringify(updated));
  }

  async function handleEnableNotifications() {
    const result = await requestNotificationPermission();
    setNotifPermission(result);
    if (result === "granted") {
      await registerServiceWorker();
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-28 md:px-6 md:pb-6 space-y-5">
      <h1 className="text-2xl font-bold gradient-text tracking-tight">Настройки</h1>

      <Card className="border-border/50 bg-card/80 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2.5">
            <Palette className="h-5 w-5 text-primary" />
            Оформление
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Тема</span>
            <ThemeToggle />
          </div>
          <div className="space-y-3">
            <span className="text-sm text-muted-foreground">Цвет акцента</span>
            <AccentPicker />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Уведомления
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!notifSupported ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <BellOff className="h-4 w-4" />
              <span>Уведомления не поддерживаются в этом браузере</span>
            </div>
          ) : notifPermission === "granted" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Bell className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Уведомления включены</p>
                  <p className="text-xs text-muted-foreground">Настрой, какие уведомления получать</p>
                </div>
              </div>
              <div className="space-y-2 pl-1">
                {([
                  { key: "habits" as const, label: "Привычки", desc: "Напоминание выполнить привычку" },
                  { key: "goals" as const, label: "Цели и дедлайны", desc: "Приближающиеся дедлайны целей" },
                  { key: "journal" as const, label: "Журнал", desc: "Вечернее напоминание записать мысли" },
                  { key: "streak" as const, label: "Серии", desc: "Не потеряй серию дней подряд" },
                ]).map((item) => (
                  <label key={item.key} className="flex items-center justify-between py-2 cursor-pointer">
                    <div>
                      <span className="text-sm">{item.label}</span>
                      <p className="text-xs text-muted-foreground/60">{item.desc}</p>
                    </div>
                    <button
                      onClick={() => updateNotifPref(item.key, !notifPrefs[item.key])}
                      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                        notifPrefs[item.key] ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                          notifPrefs[item.key] ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </label>
                ))}
              </div>
            </div>
          ) : notifPermission === "denied" ? (
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-red-500/10 flex items-center justify-center">
                <BellOff className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-500">Уведомления заблокированы</p>
                <p className="text-xs text-muted-foreground">Разреши их в настройках браузера</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Получать напоминания</p>
                <p className="text-xs text-muted-foreground">О задачах и привычках</p>
              </div>
              <Button
                size="sm"
                className="gradient-primary text-white border-0"
                onClick={handleEnableNotifications}
              >
                <Bell className="h-3.5 w-3.5 mr-1.5" />
                Включить
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Repeat className="h-4 w-4 text-primary" />
            Задачи
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            href="/settings/recurring"
            className="flex items-center justify-between py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Повторяющиеся задачи</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            href="/archive"
            className="flex items-center justify-between py-2 text-sm text-muted-foreground hover:text-foreground transition-colors border-t border-border/30"
          >
            <span className="flex items-center gap-2">
              <Archive className="h-3.5 w-3.5" />
              Архив
            </span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Аккаунт</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Выйти
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
