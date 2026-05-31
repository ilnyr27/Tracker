import { createClient } from "@/lib/supabase/client";

type ExportData = {
  categories?: Record<string, unknown>[];
  goals?: Record<string, unknown>[];
  tasks?: Record<string, unknown>[];
  notes?: Record<string, unknown>[];
  journal?: Record<string, unknown>[];
  sheets?: { tabs: Record<string, unknown>[]; entries: Record<string, unknown>[] };
};

async function fetchExportData(items: {
  categories?: boolean;
  goals?: boolean;
  tasks?: boolean;
  notes?: boolean;
  journal?: boolean;
  sheets?: boolean;
}): Promise<ExportData> {
  const supabase = createClient();
  const result: ExportData = {};
  const queries: Promise<void>[] = [];

  if (items.categories) {
    queries.push((async () => { const { data } = await supabase.from("categories").select("*").order("sort_order"); result.categories = data || []; })());
  }
  if (items.goals) {
    queries.push((async () => { const { data } = await supabase.from("goals").select("*").order("created_at"); result.goals = data || []; })());
  }
  if (items.tasks) {
    queries.push((async () => { const { data } = await supabase.from("tasks").select("*").order("scheduled_date"); result.tasks = data || []; })());
  }
  if (items.notes) {
    queries.push((async () => { const { data } = await supabase.from("notes").select("*").order("note_date"); result.notes = data || []; })());
  }
  if (items.journal) {
    queries.push((async () => { const { data } = await supabase.from("daily_entries").select("*").order("entry_date"); result.journal = data || []; })());
  }
  if (items.sheets) {
    queries.push((async () => {
      const { data: tabs } = await supabase.from("custom_tabs").select("*").order("sort_order");
      const { data: entries } = await supabase.from("tab_entries").select("*").order("sort_order");
      result.sheets = { tabs: tabs || [], entries: entries || [] };
    })());
  }

  await Promise.all(queries);
  return result;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const HEADERS_RU: Record<string, Record<string, string>> = {
  categories: { id: "ID", name: "Название", icon: "Иконка", color: "Цвет", sort_order: "Порядок", is_active: "Активна", created_at: "Создана" },
  goals: { id: "ID", title: "Название", tracking_type: "Тип", status: "Статус", level: "Уровень", target_days: "Цель дней", created_at: "Создана" },
  tasks: { id: "ID", title: "Название", is_done: "Выполнена", scheduled_date: "Дата", priority: "Приоритет", created_at: "Создана" },
};

export async function exportXlsx(items: Record<string, boolean>) {
  const data = await fetchExportData(items);
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const addSheet = (name: string, rows: Record<string, unknown>[], headerMap?: Record<string, string>) => {
    if (!rows.length) return;
    if (headerMap) {
      const mapped = rows.map((row) => {
        const out: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(row)) {
          out[headerMap[key] || key] = val;
        }
        return out;
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mapped), name);
    } else {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
    }
  };

  if (data.categories) addSheet("Категории", data.categories, HEADERS_RU.categories);
  if (data.goals) addSheet("Цели", data.goals, HEADERS_RU.goals);
  if (data.tasks) addSheet("Задачи", data.tasks, HEADERS_RU.tasks);
  if (data.notes) addSheet("Заметки", data.notes);
  if (data.journal) addSheet("Журнал", data.journal);
  if (data.sheets) {
    addSheet("Листы", data.sheets.tabs);
    addSheet("Данные листов", data.sheets.entries);
  }

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `life-os-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportDocx(items: Record<string, boolean>) {
  const data = await fetchExportData(items);
  const { Document, Paragraph, TextRun, HeadingLevel, Packer } = await import("docx");

  const children: InstanceType<typeof Paragraph>[] = [];

  children.push(new Paragraph({
    heading: HeadingLevel.TITLE,
    children: [new TextRun({ text: "Life OS — Экспорт", bold: true })],
  }));
  children.push(new Paragraph({ children: [new TextRun({ text: `Дата: ${new Date().toLocaleDateString("ru-RU")}`, italics: true, color: "888888" })] }));
  children.push(new Paragraph({ text: "" }));

  if (data.journal?.length) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Журнал", bold: true })] }));
    for (const entry of data.journal) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: String(entry.entry_date || ""), bold: true })],
      }));
      children.push(new Paragraph({ children: [new TextRun(String(entry.content || ""))] }));
      children.push(new Paragraph({ text: "" }));
    }
  }

  if (data.notes?.length) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Заметки", bold: true })] }));
    for (const note of data.notes) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: String(note.note_date || ""), bold: true })],
      }));
      children.push(new Paragraph({ children: [new TextRun(String(note.content || ""))] }));
      children.push(new Paragraph({ text: "" }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const buf = await Packer.toBlob(doc);
  downloadBlob(buf, `life-os-texts-${new Date().toISOString().slice(0, 10)}.docx`);
}

export async function exportJson(items: Record<string, boolean>) {
  const data = await fetchExportData(items);
  const json = JSON.stringify(data, null, 2);
  downloadBlob(new Blob([json], { type: "application/json" }), `life-os-export-${new Date().toISOString().slice(0, 10)}.json`);
}
