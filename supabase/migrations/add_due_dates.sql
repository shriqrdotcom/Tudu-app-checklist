-- ============================================================
-- TU DU — Reminder & Notification Engine (Phase 10)
-- Run this whole file in: Supabase Dashboard → SQL Editor → New query
-- Idempotent: safe to re-run on an existing project.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Deadline-tracking columns on progress_tasks
--    due_datetime : user-scheduled deadline (NULL = no reminder)
--    notified     : latched once the overdue alert fired for the current
--                   deadline — prevents duplicate notifications
--    snooze_until : set when the user snoozes; suppresses re-alerting
--                   until this instant passes (notified resets to false)
-- ------------------------------------------------------------
alter table public.progress_tasks
  add column if not exists due_datetime timestamptz;

alter table public.progress_tasks
  add column if not exists notified boolean not null default false;

alter table public.progress_tasks
  add column if not exists snooze_until timestamptz;

-- ------------------------------------------------------------
-- 2) Performance index for the scheduler's hot query shape:
--    "tasks with a deadline that are pending and not yet notified"
--    Partial composite index: only rows with a deadline are indexed,
--    keeping it small and fast as history accumulates.
-- ------------------------------------------------------------
create index if not exists idx_tasks_due_tracking
  on public.progress_tasks (due_datetime, is_completed, notified)
  where due_datetime is not null;

-- ------------------------------------------------------------
-- RLS is unchanged: every policy already scopes rows by user_id and
-- these columns live on progress_tasks, so existing policies cover them.
-- ------------------------------------------------------------
