"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { QuickAddSheet } from "@/components/layout/quick-add-sheet";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [fabOpen, setFabOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      <BottomNav onFabClick={() => setFabOpen(true)} />
      <QuickAddSheet open={fabOpen} onOpenChange={setFabOpen} />
    </div>
  );
}
