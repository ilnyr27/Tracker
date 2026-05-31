import type { TaskTemplate, RecurrenceRule } from "@/lib/supabase/types";

/**
 * Check if a template's recurrence pattern matches a given date.
 */
export function matchesDate(template: TaskTemplate, date: Date): boolean {
  const dayOfWeek = date.getDay(); // 0=Sun..6=Sat

  switch (template.recurrence) {
    case "daily":
      return true;

    case "weekdays":
      return dayOfWeek >= 1 && dayOfWeek <= 5;

    case "weekly":
      return template.recurrence_days.includes(dayOfWeek);

    case "monthly":
      return template.recurrence_days.includes(date.getDate());

    case "custom":
      return matchesCustomRule(template.recurrence_rule, date);

    default:
      return false;
  }
}

function matchesCustomRule(rule: RecurrenceRule, date: Date): boolean {
  if (!rule) return false;

  switch (rule.type) {
    case "nth_weekday":
      return matchesNthWeekday(date, rule.weekday ?? 0, rule.nth ?? 1);

    case "biweekly":
      return matchesBiweekly(date, rule.weekday ?? 0, rule.anchor_date);

    default:
      return false;
  }
}

/**
 * Check if `date` is the Nth occurrence of a weekday in its month.
 * E.g., nth=2, weekday=3 → 2nd Wednesday of the month.
 * nth=-1 means "last occurrence".
 */
function matchesNthWeekday(date: Date, weekday: number, nth: number): boolean {
  if (date.getDay() !== weekday) return false;

  const dayOfMonth = date.getDate();

  if (nth === -1) {
    // Last occurrence: check if adding 7 days goes to next month
    const nextWeek = new Date(date);
    nextWeek.setDate(dayOfMonth + 7);
    return nextWeek.getMonth() !== date.getMonth();
  }

  // Nth occurrence: the Nth weekday falls on days (1-7) for 1st, (8-14) for 2nd, etc.
  const occurrence = Math.ceil(dayOfMonth / 7);
  return occurrence === nth;
}

/**
 * Check if `date` falls on a biweekly pattern.
 * Uses anchor_date to determine even/odd weeks.
 */
function matchesBiweekly(date: Date, weekday: number, anchorDate?: string): boolean {
  if (date.getDay() !== weekday) return false;

  const anchor = anchorDate ? new Date(anchorDate) : new Date("2026-01-05"); // default Monday
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  // Calculate week number difference from anchor
  const diffMs = date.getTime() - anchor.getTime();
  const weekDiff = Math.floor(diffMs / msPerWeek);

  return weekDiff % 2 === 0;
}

/**
 * Get a human-readable Russian label for a recurrence pattern.
 */
export function getRecurrenceLabel(template: TaskTemplate): string {
  const dayNames = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const dayNamesFull = ["воскресенье", "понедельник", "вторник", "среду", "четверг", "пятницу", "субботу"];
  const ordinals = ["", "1-ю", "2-ю", "3-ю", "4-ю"];

  switch (template.recurrence) {
    case "daily":
      return "Каждый день";
    case "weekdays":
      return "Будни (Пн-Пт)";
    case "weekly": {
      const names = template.recurrence_days
        .sort((a, b) => a - b)
        .map((d) => dayNames[d]);
      return `Еженедельно: ${names.join(", ")}`;
    }
    case "monthly": {
      const days = template.recurrence_days.sort((a, b) => a - b);
      return `Ежемесячно: ${days.join(", ")} число`;
    }
    case "custom": {
      const rule = template.recurrence_rule;
      if (!rule) return "Расширенное";
      if (rule.type === "nth_weekday") {
        const wd = rule.weekday ?? 0;
        const nth = rule.nth ?? 1;
        if (nth === -1) return `Последняя ${dayNamesFull[wd]} месяца`;
        return `Каждую ${ordinals[nth] || nth + "-ю"} ${dayNamesFull[wd]} месяца`;
      }
      if (rule.type === "biweekly") {
        const wd = rule.weekday ?? 0;
        return `Через неделю: ${dayNames[wd]}`;
      }
      return "Расширенное";
    }
    default:
      return "";
  }
}
