-- ============================================
-- TASK TEMPLATES (recurring tasks)
-- ============================================
create table public.task_templates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete set null,
  goal_id uuid references public.goals(id) on delete set null,
  title text not null,
  priority text check (priority in ('low', 'medium', 'high', 'critical')),
  -- Recurrence pattern: daily, weekdays, weekly, monthly
  recurrence text not null check (recurrence in ('daily', 'weekdays', 'weekly', 'monthly')),
  -- For weekly: which day(s) of week (0=Sun, 1=Mon, ..., 6=Sat)
  -- For monthly: which day(s) of month (1-31)
  -- Stored as JSON array, e.g. [1,3,5] for Mon/Wed/Fri
  recurrence_days jsonb default '[]',
  is_active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_task_templates_user on public.task_templates(user_id, is_active);

-- RLS
alter table public.task_templates enable row level security;

create policy "Users can view own task templates"
  on public.task_templates for select
  using (auth.uid() = user_id);

create policy "Users can insert own task templates"
  on public.task_templates for insert
  with check (auth.uid() = user_id);

create policy "Users can update own task templates"
  on public.task_templates for update
  using (auth.uid() = user_id);

create policy "Users can delete own task templates"
  on public.task_templates for delete
  using (auth.uid() = user_id);

-- Add template_id to tasks so we know which task came from which template
alter table public.tasks add column template_id uuid references public.task_templates(id) on delete set null;
