-- ============================================
-- HABIT GRID: Goal tracking type + target days
-- ============================================

-- Add tracking_type: 'habit' (daily trackable in grid) vs 'milestone' (one-time)
ALTER TABLE public.goals
  ADD COLUMN tracking_type text DEFAULT 'milestone'
  CHECK (tracking_type IN ('habit', 'milestone'));

-- Target days for progress calculation (e.g. 30 days = 100%)
ALTER TABLE public.goals
  ADD COLUMN target_days int;

-- Fast lookup for habit goals by user and category
CREATE INDEX idx_goals_habits ON public.goals(user_id, tracking_type, category_id)
  WHERE status = 'active';

-- Fast task range queries for the grid
CREATE INDEX IF NOT EXISTS idx_tasks_date_range ON public.tasks(user_id, scheduled_date, template_id);
