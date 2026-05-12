"use client";

import { ComingSoon } from "@/components/layout/coming-soon";
import { Target } from "lucide-react";

export default function GoalsPage() {
  return (
    <ComingSoon
      icon={Target}
      title="Цели"
      description="Иерархия целей по категориям с прогресс-трекингом. Скоро."
    />
  );
}
