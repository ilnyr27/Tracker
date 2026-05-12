"use client";

import { ComingSoon } from "@/components/layout/coming-soon";
import { Camera } from "lucide-react";

export default function PhotosPage() {
  return (
    <ComingSoon
      icon={Camera}
      title="Фото-дневник"
      description="Загружай фото каждый день и выбирай лучшие. Скоро."
    />
  );
}
