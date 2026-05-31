"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "motion/react";
import { Lock, Check, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Минимум 6 символов");
      return;
    }
    if (password !== confirm) {
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setDone(true);
    toast.success("Пароль обновлён");
    setTimeout(() => {
      window.location.href = "/today";
    }, 1500);
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            {done ? <Check className="h-7 w-7 text-primary" /> : <Lock className="h-7 w-7 text-primary" />}
          </div>
          <h1 className="text-xl font-bold gradient-text">
            {done ? "Готово!" : "Новый пароль"}
          </h1>
          {done && (
            <p className="mt-2 text-sm text-muted-foreground">
              Перенаправляю...
            </p>
          )}
        </div>

        {!done && (
          <div className="rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <div className="glow-ring rounded-lg relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Новый пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="h-12 bg-input/50 border-0 text-base placeholder:text-muted-foreground/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="glow-ring rounded-lg">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Повтори пароль"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="h-12 bg-input/50 border-0 text-base placeholder:text-muted-foreground/50"
                  />
                </div>
                {password.length > 0 && password.length < 6 && (
                  <p className="text-[11px] text-muted-foreground/60 px-1">
                    Минимум 6 символов ({password.length}/6)
                  </p>
                )}
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </motion.p>
              )}

              <Button
                type="submit"
                className="h-12 w-full gradient-primary text-base font-medium text-white border-0 hover:opacity-90 transition-opacity"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Сохранить пароль"}
              </Button>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
}
