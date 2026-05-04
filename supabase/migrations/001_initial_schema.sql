-- ============================================
-- PROFILES
-- ============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  display_name text,
  avatar_url text,
  timezone text default 'Europe/Moscow',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- CATEGORIES (10 life categories)
-- ============================================
create table public.categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  icon text,
  color text,
  sort_order int not null default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ============================================
-- GOALS (hierarchical: decade > year > month > week > day)
-- ============================================
create table public.goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete set null,
  parent_goal_id uuid references public.goals(id) on delete set null,
  title text not null,
  description text,
  level text not null check (level in ('decade', 'year', 'month', 'week', 'day')),
  target_date date,
  start_date date,
  year int,
  month int,
  week int,
  status text default 'active' check (status in ('active', 'completed', 'deferred', 'cancelled')),
  priority text check (priority in ('low', 'medium', 'high', 'critical')),
  image_url text,
  sort_order int default 0,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_goals_user_level on public.goals(user_id, level, year, month, week);
create index idx_goals_parent on public.goals(parent_goal_id);

-- ============================================
-- DAILY ENTRIES (freeform text per category per day)
-- ============================================
create table public.daily_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  entry_date date not null,
  category_id uuid references public.categories(id) on delete cascade not null,
  content text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, entry_date, category_id)
);

create index idx_daily_entries_date on public.daily_entries(user_id, entry_date);

-- ============================================
-- TASKS (checkable items)
-- ============================================
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  goal_id uuid references public.goals(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  is_done boolean default false,
  scheduled_date date,
  original_date date,
  priority text check (priority in ('low', 'medium', 'high', 'critical')),
  sort_order int default 0,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_tasks_date on public.tasks(user_id, scheduled_date);

-- ============================================
-- NOTES / THOUGHTS
-- ============================================
create table public.notes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  note_date date not null default current_date,
  content text not null,
  category_id uuid references public.categories(id) on delete set null,
  pinned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_notes_date on public.notes(user_id, note_date desc);

-- ============================================
-- PHOTOS
-- ============================================
create table public.photos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  photo_date date not null,
  storage_path text not null,
  thumbnail_path text,
  caption text,
  is_photo_of_day boolean default false,
  is_photo_of_week boolean default false,
  is_photo_of_month boolean default false,
  is_photo_of_season boolean default false,
  is_photo_of_year boolean default false,
  year int not null,
  month int not null,
  week int not null,
  season text check (season in ('winter', 'spring', 'summer', 'autumn')),
  sort_order int default 0,
  created_at timestamptz default now()
);

create index idx_photos_date on public.photos(user_id, photo_date desc);

-- ============================================
-- CUSTOM TABS (flexible sheets like Excel)
-- ============================================
create table public.custom_tabs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  icon text,
  tab_type text default 'freeform' check (tab_type in ('freeform', 'table', 'list')),
  schema jsonb,
  sort_order int default 0,
  is_system boolean default false,
  created_at timestamptz default now()
);

-- ============================================
-- TAB ENTRIES (rows in custom tabs)
-- ============================================
create table public.tab_entries (
  id uuid default gen_random_uuid() primary key,
  tab_id uuid references public.custom_tabs(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  data jsonb not null default '{}',
  entry_date date,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_tab_entries_tab on public.tab_entries(tab_id, sort_order);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.goals enable row level security;
alter table public.daily_entries enable row level security;
alter table public.tasks enable row level security;
alter table public.notes enable row level security;
alter table public.photos enable row level security;
alter table public.custom_tabs enable row level security;
alter table public.tab_entries enable row level security;

-- Profiles: user can read/update own profile
create policy "Users manage own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Categories
create policy "Users manage own categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Goals
create policy "Users manage own goals" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Daily entries
create policy "Users manage own daily_entries" on public.daily_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Tasks
create policy "Users manage own tasks" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Notes
create policy "Users manage own notes" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Photos
create policy "Users manage own photos" on public.photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Custom tabs
create policy "Users manage own custom_tabs" on public.custom_tabs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Tab entries
create policy "Users manage own tab_entries" on public.tab_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- SEED DEFAULT CATEGORIES FUNCTION
-- ============================================
create or replace function public.seed_categories_for_user(p_user_id uuid)
returns void as $$
begin
  insert into public.categories (user_id, name, icon, color, sort_order) values
    (p_user_id, 'Здоровье / Спорт', 'heart-pulse', '#ef4444', 1),
    (p_user_id, 'Дом / Быт', 'home', '#f97316', 2),
    (p_user_id, 'Инвестиции', 'trending-up', '#eab308', 3),
    (p_user_id, 'Работа / Карьера', 'briefcase', '#22c55e', 4),
    (p_user_id, 'Семья', 'users', '#14b8a6', 5),
    (p_user_id, 'Друзья / Социум', 'message-circle', '#3b82f6', 6),
    (p_user_id, 'Отдых / Удовольствия', 'smile', '#8b5cf6', 7),
    (p_user_id, 'Обучение / Развитие', 'graduation-cap', '#a855f7', 8),
    (p_user_id, 'Ислам (духовность)', 'moon', '#6366f1', 9),
    (p_user_id, 'Творчество', 'palette', '#ec4899', 10);
end;
$$ language plpgsql security definer;

-- Auto-seed categories when profile is created
create or replace function public.handle_new_profile()
returns trigger as $$
begin
  perform public.seed_categories_for_user(new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_profile();
