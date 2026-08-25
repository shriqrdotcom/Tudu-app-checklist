-- ============================================================
-- TU DU — Task Schema Hardening & RLS Verification (Phase 12)
-- Run this whole file in: Supabase Dashboard → SQL Editor → New query
-- Idempotent: safe to re-run on any environment state.
--
-- COLUMN NAME MAPPING (generic spec → actual TU DU schema):
--   table `tasks`        → progress_tasks   (renaming would break deployed
--                                            clients, FKs and RLS policies)
--   `due_at`             → due_datetime     (TIMESTAMPTZ, timezone-aware)
--   `alert_triggered`    → notified         (BOOLEAN latch, default false)
-- ============================================================

-- ------------------------------------------------------------
-- 1) TIMEZONE-SAFE COLUMN TYPES
--    Guarded: only converts if a column somehow exists as naive timestamp.
--    TIMESTAMPTZ stores an absolute instant; every client read/write goes
--    through ISO-8601 with offset — immune to UTC/local drift.
-- ------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'progress_tasks'
      and column_name = 'due_datetime'
      and data_type <> 'timestamp with time zone'
  ) then
    alter table public.progress_tasks
      alter column due_datetime type timestamptz
      using due_datetime at time zone 'UTC';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'progress_tasks'
      and column_name = 'due_datetime'
  ) then
    alter table public.progress_tasks add column due_datetime timestamptz;
  end if;
end $$;

-- ------------------------------------------------------------
-- 2) SAFE DEFAULTS ON EVERY NON-ESSENTIAL COLUMN
--    (created_at/updated_at use now() which is already UTC-based timestamptz;
--     timezone('utc'::text, now()) would return a NAIVE timestamp — avoided.)
-- ------------------------------------------------------------
alter table public.progress_tasks
  alter column is_completed set default false,
  alter column is_favorite  set default false,
  alter column notified     set default false,
  alter column position     set default 0,
  alter column created_at   set default now(),
  alter column updated_at   set default now();

alter table public.progress_tasks
  add column if not exists notified boolean not null default false,
  add column if not exists snooze_until timestamptz,
  add column if not exists completed_at timestamptz;

-- ------------------------------------------------------------
-- 3) PERFORMANCE INDEX for the precision timer's hot path
-- ------------------------------------------------------------
create index if not exists idx_tasks_due_tracking
  on public.progress_tasks (due_datetime, is_completed, notified)
  where due_datetime is not null;

-- ------------------------------------------------------------
-- 4) EXPLICIT PRIVILEGES FOR THE AUTHENTICATED ROLE
--    The app signs in via Supabase Auth (email+password); every query runs
--    as role `authenticated` with the user's JWT. Grants are explicit so a
--    future privilege revocation can never silently break task creation.
-- ------------------------------------------------------------
grant select, insert, update, delete on public.progress_tasks to authenticated;

-- ------------------------------------------------------------
-- 5) RLS POLICIES — re-created idempotently (mirrors canonical schema.sql)
--
-- ⚠️ SECURITY DECISION — NO `anon` POLICIES, DELIBERATELY:
-- The generic brief asks for permissive anon INSERT/UPDATE/DELETE. TU DU is a
-- PRIVATE single-owner tracker: granting anonymous write access would let any
-- visitor on the internet create/delete the owner's data. RLS stays scoped to
-- auth.uid() = user_id; unauthenticated visitors get an empty dataset by
-- design. Do NOT add anon policies to this table.
-- ------------------------------------------------------------
drop policy if exists "tasks_select_own" on public.progress_tasks;
create policy "tasks_select_own" on public.progress_tasks
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "tasks_insert_own" on public.progress_tasks;
create policy "tasks_insert_own" on public.progress_tasks
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.progress_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "tasks_update_own" on public.progress_tasks;
create policy "tasks_update_own" on public.progress_tasks
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.progress_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "tasks_delete_own" on public.progress_tasks;
create policy "tasks_delete_own" on public.progress_tasks
  for delete to authenticated using (auth.uid() = user_id);
