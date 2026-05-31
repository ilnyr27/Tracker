export type RecurrenceRule = {
  type: "nth_weekday" | "biweekly";
  weekday?: number;      // 0=Sun..6=Sat
  nth?: number;          // 1=first, 2=second, 3=third, 4=fourth, -1=last
  anchor_date?: string;  // ISO date string for biweekly calculation
} | null;

export type Category = {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type Goal = {
  id: string;
  user_id: string;
  category_id: string | null;
  parent_goal_id: string | null;
  title: string;
  description: string | null;
  level: "decade" | "year" | "month" | "week" | "day";
  target_date: string | null;
  start_date: string | null;
  year: number | null;
  month: number | null;
  week: number | null;
  status: "active" | "completed" | "deferred" | "cancelled";
  priority: "low" | "medium" | "high" | "critical" | null;
  tracking_type: "habit" | "milestone";
  target_days: number | null;
  reminder_time: string | null;
  image_url: string | null;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DailyEntry = {
  id: string;
  user_id: string;
  entry_date: string;
  category_id: string;
  content: string | null;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  user_id: string;
  goal_id: string | null;
  category_id: string | null;
  template_id: string | null;
  title: string;
  is_done: boolean;
  scheduled_date: string | null;
  original_date: string | null;
  priority: "low" | "medium" | "high" | "critical" | null;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskTemplate = {
  id: string;
  user_id: string;
  category_id: string | null;
  goal_id: string | null;
  title: string;
  priority: "low" | "medium" | "high" | "critical" | null;
  recurrence: "daily" | "weekdays" | "weekly" | "monthly" | "custom";
  recurrence_days: number[];
  recurrence_rule: RecurrenceRule | null;
  reminder_time: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Note = {
  id: string;
  user_id: string;
  note_date: string;
  content: string;
  category_id: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type Photo = {
  id: string;
  user_id: string;
  photo_date: string;
  storage_path: string;
  thumbnail_path: string | null;
  caption: string | null;
  is_photo_of_day: boolean;
  is_photo_of_week: boolean;
  is_photo_of_month: boolean;
  is_photo_of_season: boolean;
  is_photo_of_year: boolean;
  year: number;
  month: number;
  week: number;
  season: "winter" | "spring" | "summer" | "autumn" | null;
  sort_order: number;
  created_at: string;
};

export type CustomTab = {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  tab_type: "freeform" | "table" | "list";
  schema: Record<string, unknown> | null;
  sort_order: number;
  is_system: boolean;
  created_at: string;
};

export type TabEntry = {
  id: string;
  tab_id: string;
  user_id: string;
  data: Record<string, unknown>;
  entry_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
