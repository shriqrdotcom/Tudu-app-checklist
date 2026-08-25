-- ============================================================
-- TU DU — Time-Based Alarms & Due Timers (Phase 11)
-- Run this whole file in: Supabase Dashboard → SQL Editor → New query
-- Idempotent: safe to re-run; no-ops if Phase 10 migration already ran.
--
-- COLUMN NAME MAPPING (requested → actual, and why):
--   table `tasks`           → progress_tasks   (existing TU DU table;
--                                              renaming would break RLS,
--                                              FKs and deployed clients)
--   `due_at`                → due_datetime     (same semantics: TIMESTAMPTZ
--                                              nullable deadline)
--   `alert_triggered`       → notified         (same semantics: BOOLEAN
--                                              latch preventing repeat alarms)
--   `is_completed`          → already exists   (BOOLEAN default false)
-- ============================================================

alter table public.progress_tasks
  add column if not exists due_datetime timestamptz;

alter table public.progress_tasks
  add column if not exists snooze_until timestamptz;

alter table public.progress_tasks
  add column if not exists is_completed boolean not null default false;

alter table public.progress_tasks
  add column if not exists notified boolean not null default false;

-- Hot path for the 1-second client checker:
-- "pending tasks with a deadline that have not triggered their alert yet".
create index if not exists idx_tasks_due_tracking
  on public.progress_tasks (due_datetime, is_completed, notified)
  where due_datetime is not null;

-- RLS unchanged: existing per-user policies on progress_tasks cover all
-- new columns automatically.
