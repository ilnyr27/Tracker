"use client";

import { ComingSoon } from "@/components/layout/coming-soon";
import { CalendarDays } from "lucide-react";

export default function CalendarPage() {
  return (
    <ComingSoon
      icon={CalendarDays}
      title="Календарь"
      description="Месячный вид с цветовой индикацией прогресса по дням. Скоро."
    />
  );
}
