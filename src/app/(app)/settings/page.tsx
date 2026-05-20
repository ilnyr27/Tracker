"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Palette, Repeat, ChevronRight } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import Link from "next/link";

export default function SettingsPage() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="mx-auto max-w-2xl p-4 space-y-4">
      <h1 className="text-xl font-bold gradient-text">Настройки</h1>

      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            Оформление
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Тема</span>
            <ThemeToggle />
          </div>
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
