"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { QuickAddSheet } from "@/components/layout/quick-add-sheet";
import { Onboarding } from "@/components/layout/onboarding";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [fabOpen, setFabOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white focus:text-sm"
      >
        Перейти к содержимому
      </a>
      <Sidebar />
      <main id="main-content" className="flex-1 pb-20 md:pb-0">{children}</main>
      <BottomNav onFabClick={() => setFabOpen(true)} />
      <QuickAddSheet open={fabOpen} onOpenChange={setFabOpen} />
      <Onboarding />
    </div>
  );
}
