-- ============================================================
-- TU DU — Reminders & Push Notifications (Phase 10A)
-- Run this whole file in: Supabase Dashboard → SQL Editor → New query
-- Idempotent: safe to re-run on any environment state.
-- ============================================================

-- ------------------------------------------------------------
-- 1) task_reminders table — multiple reminders per task
-- ------------------------------------------------------------
create table if not exists public.task_reminders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.progress_tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.progress_projects (id) on delete cascade,
  remind_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'cancelled')),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for hot paths
create index if not exists idx_reminders_due
  on public.task_reminders (remind_at, status)
  where status = 'pending';

create index if not exists idx_reminders_task on public.task_reminders (task_id);
create index if not exists idx_reminders_user on public.task_reminders (user_id);
create index if not exists idx_reminders_project on public.task_reminders (project_id);

-- ------------------------------------------------------------
-- 2) push_subscriptions table — VAPID subscriptions per device
-- ------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  device_label text,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions (user_id);
create index if not exists idx_push_subscriptions_endpoint on public.push_subscriptions (endpoint);

-- ------------------------------------------------------------
-- 3) updated_at triggers (reuse existing function)
-- ------------------------------------------------------------
drop trigger if exists set_updated_at_task_reminders on public.task_reminders;
create trigger set_updated_at_task_reminders
  before update on public.task_reminders
  for each row execute function public.update_updated_at_column();

drop trigger if exists set_updated_at_push_subscriptions on public.push_subscriptions;
create trigger set_updated_at_push_subscriptions
  before update on public.push_subscriptions
  for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- 4) RLS policies
-- ------------------------------------------------------------
alter table public.task_reminders enable row level security;
alter table public.push_subscriptions enable row level security;

-- task_reminders policies
drop policy if exists "reminders_select_own" on public.task_reminders;
create policy "reminders_select_own" on public.task_reminders
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "reminders_insert_own" on public.task_reminders;
create policy "reminders_insert_own" on public.task_reminders
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "reminders_update_own" on public.task_reminders;
create policy "reminders_update_own" on public.task_reminders
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reminders_delete_own" on public.task_reminders;
create policy "reminders_delete_own" on public.task_reminders
  for delete to authenticated using (auth.uid() = user_id);

-- push_subscriptions policies
drop policy if exists "push_sub_select_own" on public.push_subscriptions;
create policy "push_sub_select_own" on public.push_subscriptions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "push_sub_insert_own" on public.push_subscriptions;
create policy "push_sub_insert_own" on public.push_subscriptions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "push_sub_update_own" on public.push_subscriptions;
create policy "push_sub_update_own" on public.push_subscriptions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push_sub_delete_own" on public.push_subscriptions;
create policy "push_sub_delete_own" on public.push_subscriptions
  for delete to authenticated using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 5) Grants
-- ------------------------------------------------------------
grant select, insert, update, delete on public.task_reminders to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- ------------------------------------------------------------
-- 6) Helper function: create_reminder_for_task
--    Creates a reminder row when a task's due_datetime is set.
--    Called from client after task create/update, or can be called from DB trigger.
-- ------------------------------------------------------------
create or replace function public.create_reminder_for_task(
  p_task_id uuid,
  p_remind_at timestamptz
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_project_id uuid;
  v_reminder_id uuid;
begin
  select user_id, project_id into v_user_id, v_project_id
  from public.progress_tasks
  where id = p_task_id;

  if not found then
    raise exception 'Task not found: %', p_task_id;
  end if;

  -- Idempotent: if a reminder already exists for this task at this instant, return it
  select id into v_reminder_id
  from public.task_reminders
  where task_id = p_task_id and remind_at = p_remind_at and status != 'cancelled'
  limit 1;

  if found then
    return v_reminder_id;
  end if;

  insert into public.task_reminders (task_id, user_id, project_id, remind_at, status)
  values (p_task_id, v_user_id, v_project_id, p_remind_at, 'pending')
  returning id into v_reminder_id;

  return v_reminder_id;
end;
$$;

-- ------------------------------------------------------------
-- 7) Optional: pg_cron + pg_net scheduled job for send-reminders
--    Requires extensions: pg_cron, pg_net (enable in Supabase Dashboard → Extensions)
--    The Edge Function must be deployed first, then run:
--    select cron.schedule(
--      'send-reminders-cron',
--      '* * * * *',  -- every minute
--      $$
--      select net.http_post(
--        url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
--        headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
--        body := '{}'::jsonb
--      );
--      $$
--    );
--    Replace <PROJECT_REF> and <SERVICE_ROLE_KEY> with actual values.
--    The SERVICE_ROLE_KEY should be the same one used in create-owner script.
--    Alternatively, set a CRON_SECRET in Supabase Vault and have the function check it.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 8) Cleanup function: mark reminders cancelled when task completed/deleted
--    (Called from client or can be a DB trigger; here's the function for client use)
-- ------------------------------------------------------------
create or replace function public.cancel_reminders_for_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.task_reminders
  set status = 'cancelled', updated_at = now()
  where task_id = p_task_id and status = 'pending';
end;
$$;

create or replace function public.cancel_reminders_for_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.task_reminders
  set status = 'cancelled', updated_at = now()
  where project_id = p_project_id and status = 'pending';
end;
$$;

-- ------------------------------------------------------------
-- 9) Grant execute on helper functions
-- ------------------------------------------------------------
grant execute on function public.create_reminder_for_task(uuid, timestamptz) to authenticated;
grant execute on function public.cancel_reminders_for_task(uuid) to authenticated;
grant execute on function public.cancel_reminders_for_project(uuid) to authenticated;