"use client";

import { ComingSoon } from "@/components/layout/coming-soon";
import { Layers } from "lucide-react";

export default function SheetsPage() {
  return (
    <ComingSoon
      icon={Layers}
      title="Кастомные листы"
      description="Создавай свои листы как в Excel — книги, заметки, списки. Скоро."
    />
  );
}
