"use client";

import { ComingSoon } from "@/components/layout/coming-soon";
import { Table2 } from "lucide-react";

export default function TablePage() {
  return (
    <ComingSoon
      icon={Table2}
      title="Таблица"
      description="Полный вид как в Excel — все дни и категории. Скоро."
    />
  );
}
