-- Advanced recurrence rules for task templates
ALTER TABLE public.task_templates ADD COLUMN IF NOT EXISTS recurrence_rule jsonb;

-- Extend recurrence check to include 'custom'
ALTER TABLE public.task_templates DROP CONSTRAINT IF EXISTS task_templates_recurrence_check;
ALTER TABLE public.task_templates ADD CONSTRAINT task_templates_recurrence_check
  CHECK (recurrence IN ('daily', 'weekdays', 'weekly', 'monthly', 'custom'));

-- recurrence_rule schema:
-- { "type": "nth_weekday", "weekday": 3, "nth": 2 }    -- 2nd Wednesday
-- { "type": "biweekly", "weekday": 3, "anchor_date": "2026-05-31" }  -- every other Wed
