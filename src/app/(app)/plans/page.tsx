"use client";

import { ComingSoon } from "@/components/layout/coming-soon";
import { Map } from "lucide-react";

export default function PlansPage() {
  return (
    <ComingSoon
      icon={Map}
      title="Планы"
      description="Планирование на день, неделю, месяц, год и десятилетие. Скоро."
    />
  );
}
