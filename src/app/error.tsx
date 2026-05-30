"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <div className="mb-6 text-7xl font-bold text-destructive/20">500</div>
      <h1 className="text-xl font-bold mb-2">Что-то пошло не так</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Произошла ошибка. Попробуйте обновить страницу.
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
      >
        Попробовать снова
      </button>
    </div>
  );
}
