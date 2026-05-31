import { createClient } from "@/lib/supabase/client";

type ExportData = {
  categories?: Record<string, unknown>[];
  goals?: Record<string, unknown>[];
  tasks?: Record<string, unknown>[];
  notes?: Record<string, unknown>[];
  journal?: Record<string, unknown>[];
  sheets?: { tabs: Record<string, unknown>[]; entries: Record<string, unknown>[] };
};

// Fields to exclude from export — internal IDs and system fields
const EXCLUDE_FIELDS = new Set(["id", "user_id", "template_id", "parent_goal_id", "goal_id", "tab_id", "category_id", "image_url", "thumbnail_path", "storage_path", "sort_order", "is_system"]);

function cleanRow(row: Record<string, unknown>, extraExclude?: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    if (EXCLUDE_FIELDS.has(key)) continue;
    if (extraExclude?.has(key)) continue;
    if (val === null || val === undefined) continue;
    out[key] = val;
  }
  return out;
}

// Map to add category names instead of IDs
async function getCategoryMap(): Promise<Map<string, string>> {
  const supabase = createClient();
  const { data } = await supabase.from("categories").select("id, name");
  const map = new Map<string, string>();
  if (data) for (const c of data) map.set(c.id, c.name);
  return map;
}

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
  const catMap = await getCategoryMap();

  if (items.categories) {
    queries.push((async () => {
      const { data } = await supabase.from("categories").select("*").order("sort_order");
      result.categories = (data || []).map((r) => cleanRow(r));
    })());
  }
  if (items.goals) {
    queries.push((async () => {
      const { data } = await supabase.from("goals").select("*").order("created_at");
      result.goals = (data || []).map((r) => {
        const row = cleanRow(r);
        // Add category name
        if (r.category_id) row["category"] = catMap.get(r.category_id as string) || "";
        // Translate status
        if (row.status === "active") row.status = "Активна";
        else if (row.status === "completed") row.status = "Завершена";
        else if (row.status === "cancelled") row.status = "Отменена";
        // Translate tracking_type
        if (row.tracking_type === "habit") row.tracking_type = "Привычка";
        else if (row.tracking_type === "milestone") row.tracking_type = "Веха";
        return row;
      });
    })());
  }
  if (items.tasks) {
    queries.push((async () => {
      const { data } = await supabase.from("tasks").select("*").order("scheduled_date");
      result.tasks = (data || []).map((r) => {
        const row = cleanRow(r);
        if (r.category_id) row["category"] = catMap.get(r.category_id as string) || "";
        if (row.is_done === true) row.is_done = "Да";
        else if (row.is_done === false) row.is_done = "Нет";
        return row;
      });
    })());
  }
  if (items.notes) {
    queries.push((async () => {
      const { data } = await supabase.from("notes").select("*").order("note_date");
      result.notes = (data || []).map((r) => cleanRow(r));
    })());
  }
  if (items.journal) {
    queries.push((async () => {
      const { data } = await supabase.from("daily_entries").select("*").order("entry_date");
      result.journal = (data || []).map((r) => {
        const row = cleanRow(r);
        if (r.category_id) row["category"] = catMap.get(r.category_id as string) || "";
        return row;
      });
    })());
  }
  if (items.sheets) {
    queries.push((async () => {
      const { data: tabs } = await supabase.from("custom_tabs").select("*").order("sort_order");
      const { data: entries } = await supabase.from("tab_entries").select("*").order("sort_order");
      result.sheets = {
        tabs: (tabs || []).map((r) => cleanRow(r)),
        entries: (entries || []).map((r) => cleanRow(r)),
      };
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
  categories: { name: "Название", icon: "Иконка", color: "Цвет", is_active: "Активна", created_at: "Создана" },
  goals: { title: "Название", tracking_type: "Тип", status: "Статус", category: "Категория", level: "Уровень", target_days: "Цель дней", target_date: "Дедлайн", start_date: "Начало", reminder_time: "Напоминание", reminder_date: "Дата напоминания", completed_at: "Завершена", created_at: "Создана", updated_at: "Обновлена" },
  tasks: { title: "Название", is_done: "Выполнена", category: "Категория", scheduled_date: "Дата", priority: "Приоритет", completed_at: "Завершена", created_at: "Создана" },
  notes: { note_date: "Дата", content: "Текст", pinned: "Закреплена", created_at: "Создана" },
  journal: { entry_date: "Дата", content: "Запись", category: "Категория", created_at: "Создана" },
};

export async function exportXlsx(items: Record<string, boolean>) {
  const data = await fetchExportData(items);
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const addSheet = (name: string, rows: Record<string, unknown>[], headerKey?: string) => {
    if (!rows.length) return;
    const headerMap = headerKey ? HEADERS_RU[headerKey] : undefined;
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

  if (data.categories) addSheet("Категории", data.categories, "categories");
  if (data.goals) addSheet("Цели", data.goals, "goals");
  if (data.tasks) addSheet("Задачи", data.tasks, "tasks");
  if (data.notes) addSheet("Заметки", data.notes, "notes");
  if (data.journal) addSheet("Журнал", data.journal, "journal");
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
      const date = String(entry.entry_date || entry.created_at || "");
      const cat = entry.category ? ` (${entry.category})` : "";
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: `${date}${cat}`, bold: true })],
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
        children: [new TextRun({ text: String(note.note_date || note.created_at || ""), bold: true })],
      }));
      children.push(new Paragraph({ children: [new TextRun(String(note.content || ""))] }));
      children.push(new Paragraph({ text: "" }));
    }
  }

  if (data.goals?.length) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Цели", bold: true })] }));
    for (const goal of data.goals) {
      const status = goal.status ? ` [${goal.status}]` : "";
      const cat = goal.category ? ` — ${goal.category}` : "";
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${goal.title}${cat}${status}`, bold: true }),
          ...(goal.target_days ? [new TextRun({ text: ` (${goal.target_days} дней)`, color: "666666" })] : []),
        ],
      }));
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
