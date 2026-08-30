"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Target,
  Settings,
  ChevronRight,
  Camera,
  HelpCircle,
  Download,
  FileSpreadsheet,
  FileText,
  Braces,
  Check,
  Loader2,
  X,
  Archive,
  Table2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { exportXlsx, exportDocx, exportJson } from "@/lib/export";

const menuGroups = [
  {
    label: "Цели",
    items: [
      { href: "/goals", label: "Канбан", description: "Все цели по направлениям", icon: Target },
    ],
  },
  {
    label: "Записи",
    items: [
      { href: "/photos", label: "Фото-дневник", description: "Фото каждого дня", icon: Camera },
    ],
  },
  {
    label: "Данные",
    items: [
      { href: "/tables", label: "Таблицы", description: "Свои таблицы с произвольными столбцами", icon: Table2 },
    ],
  },
  {
    label: "Система",
    items: [
      { href: "/archive", label: "Архив", description: "Удалённые и выполненные цели", icon: Archive },
      { href: "/faq", label: "Вопросы и ответы", description: "Как пользоваться приложением", icon: HelpCircle },
      { href: "/settings", label: "Настройки", description: "Тема, аккаунт", icon: Settings },
    ],
  },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

const EXPORT_ITEMS = [
  { key: "categories", label: "Категории" },
  { key: "goals", label: "Цели" },
  { key: "tasks", label: "Задачи" },
  { key: "notes", label: "Заметки" },
  { key: "journal", label: "Журнал" },
  { key: "sheets", label: "Листы" },
] as const;

export default function MorePage() {
  const [exportOpen, setExportOpen] = useState(false);
  const [exportItems, setExportItems] = useState<Record<string, boolean>>({
    categories: true, goals: true, tasks: true, notes: true, journal: true, sheets: true,
  });
  const [exporting, setExporting] = useState(false);

  function toggleItem(key: string) {
    setExportItems((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleExport(format: "xlsx" | "docx" | "json") {
    setExporting(true);
    try {
      if (format === "xlsx") await exportXlsx(exportItems);
      else if (format === "docx") await exportDocx(exportItems);
      else await exportJson(exportItems);
    } catch (err) {
      console.error("Export failed:", err);
    }
    setExporting(false);
  }

  return (
    <div className="mx-auto max-w-lg p-4 pb-24 md:pb-4">
      <h1 className="text-xl font-bold gradient-text mb-4">Ещё</h1>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-5"
      >
        {menuGroups.map((group) => (
          <motion.div key={group.label} variants={item}>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40 px-1">
              {group.label}
            </span>
            <div className="mt-1 rounded-2xl border border-border/50 bg-card/80 overflow-hidden divide-y divide-border/30">
              {group.items.map((menuItem) => (
                <Link
                  key={menuItem.href}
                  href={menuItem.href}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                    <menuItem.icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{menuItem.label}</span>
                    <p className="text-xs text-muted-foreground">{menuItem.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                </Link>
              ))}
              {/* Export button in Данные group */}
              {group.label === "Данные" && (
                <button
                  onClick={() => setExportOpen(!exportOpen)}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-accent/50 transition-colors w-full text-left"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                    <Download className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">Выгрузка</span>
                    <p className="text-xs text-muted-foreground">Экспорт данных в файлы</p>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground/40 transition-transform ${exportOpen ? "rotate-90" : ""}`} />
                </button>
              )}
            </div>
          </motion.div>
        ))}

        {/* Export panel */}
        <AnimatePresence>
          {exportOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl border border-border/50 bg-card/80 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Что выгрузить</span>
                  <button onClick={() => setExportOpen(false)} className="p-1 rounded-lg hover:bg-accent/50">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {EXPORT_ITEMS.map((ei) => (
                    <button
                      key={ei.key}
                      onClick={() => toggleItem(ei.key)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${
                        exportItems[ei.key]
                          ? "bg-primary/10 text-primary border border-primary/30"
                          : "bg-accent/30 text-muted-foreground border border-transparent"
                      }`}
                    >
                      <div className={`h-4 w-4 rounded-md border flex items-center justify-center shrink-0 ${
                        exportItems[ei.key] ? "bg-primary border-primary" : "border-border/60"
                      }`}>
                        {exportItems[ei.key] && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      {ei.label}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-10 rounded-xl gradient-primary text-white border-0"
                    onClick={() => handleExport("xlsx")}
                    disabled={exporting}
                  >
                    {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />}
                    Excel
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-10 rounded-xl"
                    onClick={() => handleExport("docx")}
                    disabled={exporting}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                    Word
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 rounded-xl px-3"
                    onClick={() => handleExport("json")}
                    disabled={exporting}
                  >
                    <Braces className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
