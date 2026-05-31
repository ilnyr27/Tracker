-- Add reminder_date for milestone goals (specific day to send notification)
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS reminder_date date;
