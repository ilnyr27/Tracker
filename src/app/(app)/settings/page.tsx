"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Palette, Repeat, ChevronRight, Bell, BellOff } from "lucide-react";
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

  useEffect(() => {
    const supported = isNotificationSupported();
    setNotifSupported(supported);
    if (supported) {
      setNotifPermission(getNotificationPermission());
      registerServiceWorker();
    }
  }, []);

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
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Bell className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Уведомления включены</p>
                <p className="text-xs text-muted-foreground">Ты будешь получать напоминания о задачах</p>
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
            className="flex items-center justify-between py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Повторяющиеся задачи</span>
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
