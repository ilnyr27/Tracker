"use client";

import { useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Onboarding } from "@/components/layout/onboarding";
import { startNotificationPolling, stopNotificationPolling } from "@/lib/notification-scheduler";
import { PushPrompt } from "@/components/layout/push-prompt";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    startNotificationPolling();

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        startNotificationPolling();
      } else {
        stopNotificationPolling();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopNotificationPolling();
    };
  }, []);

  return (
    <div className="flex min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white focus:text-sm"
      >
        Перейти к содержимому
      </a>
      <Sidebar />
      <main id="main-content" className="flex-1 pb-20 md:pb-0 overflow-x-hidden">{children}</main>
      <BottomNav />
      <Onboarding />
      <PushPrompt />
    </div>
  );
}
