-- Add reminder_time to goals and task_templates for push notifications
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS reminder_time time;
ALTER TABLE public.task_templates ADD COLUMN IF NOT EXISTS reminder_time time;

-- Index for quick lookup of goals needing notifications today
CREATE INDEX IF NOT EXISTS idx_goals_reminder
  ON public.goals (user_id, reminder_time)
  WHERE status = 'active' AND reminder_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_templates_reminder
  ON public.task_templates (user_id, reminder_time)
  WHERE is_active = true AND reminder_time IS NOT NULL;
