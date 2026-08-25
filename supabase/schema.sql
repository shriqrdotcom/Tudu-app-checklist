-- ============================================================
-- TU DU — Supabase schema (idempotent)
-- Run this whole file in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run on an existing project (upgrades in place).
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null default 'Member',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.progress_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  accent_color text not null default '#ff6b00',
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.progress_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.progress_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  is_completed boolean not null default false,
  is_favorite boolean not null default false,
  position int not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  theme text not null default 'light' check (theme in ('light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade path for databases created with the older TU DU schema
alter table public.progress_tasks add column if not exists is_favorite boolean not null default false;

-- Helpful indexes
create index if not exists idx_projects_user on public.progress_projects (user_id);
create index if not exists idx_tasks_user on public.progress_tasks (user_id);
create index if not exists idx_tasks_project on public.progress_tasks (project_id);
create index if not exists idx_profiles_user on public.profiles (user_id);
create index if not exists idx_settings_user on public.user_settings (user_id);

-- Composite indexes matching the app's exact read patterns:
-- tasks are always fetched per user ordered by position/created_at,
-- and filtered per project inside the detail view.
create index if not exists idx_tasks_user_order on public.progress_tasks (user_id, position, created_at desc);
create index if not exists idx_tasks_project_position on public.progress_tasks (project_id, position);
create index if not exists idx_projects_user_created on public.progress_projects (user_id, created_at desc);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Keep updated_at fresh automatically
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_profiles on public.profiles;
create trigger set_updated_at_profiles before update on public.profiles for each row execute function public.update_updated_at_column();

drop trigger if exists set_updated_at_projects on public.progress_projects;
create trigger set_updated_at_projects before update on public.progress_projects for each row execute function public.update_updated_at_column();

drop trigger if exists set_updated_at_tasks on public.progress_tasks;
create trigger set_updated_at_tasks before update on public.progress_tasks for each row execute function public.update_updated_at_column();

drop trigger if exists set_updated_at_settings on public.user_settings;
create trigger set_updated_at_settings before update on public.user_settings for each row execute function public.update_updated_at_column();

-- Auto-create profile + settings when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), 'Member'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (user_id) do nothing;

  insert into public.user_settings (user_id, theme)
  values (new.id, 'light')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- A user can only ever touch rows whose user_id = auth.uid().
-- ============================================================

alter table public.profiles enable row level security;
alter table public.progress_projects enable row level security;
alter table public.progress_tasks enable row level security;
alter table public.user_settings enable row level security;

-- ---------- profiles ----------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- progress_projects ----------
drop policy if exists "projects_select_own" on public.progress_projects;
create policy "projects_select_own" on public.progress_projects
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "projects_insert_own" on public.progress_projects;
create policy "projects_insert_own" on public.progress_projects
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "projects_update_own" on public.progress_projects;
create policy "projects_update_own" on public.progress_projects
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "projects_delete_own" on public.progress_projects;
create policy "projects_delete_own" on public.progress_projects
  for delete to authenticated using (auth.uid() = user_id);

-- ---------- progress_tasks ----------
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

-- ---------- user_settings ----------
drop policy if exists "settings_select_own" on public.user_settings;
create policy "settings_select_own" on public.user_settings
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "settings_insert_own" on public.user_settings;
create policy "settings_insert_own" on public.user_settings
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "settings_update_own" on public.user_settings;
create policy "settings_update_own" on public.user_settings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- STORAGE
-- Buckets are public-read (images render via <img>),
-- but writes are locked to each user's own folder: <uid>/...
-- ============================================================

insert into storage.buckets (id, name, public)
values ('project-images', 'project-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('task-images', 'task-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

do $$
declare
  b text;
begin
  foreach b in array array['project-images', 'task-images', 'avatars'] loop
    -- Anyone can view images (needed for <img> rendering)
    execute format('drop policy if exists "%1$s_public_read" on storage.objects;', b);
    execute format(
      'create policy "%1$s_public_read" on storage.objects for select using (bucket_id = ''%1$s'');',
      b
    );

    -- Authenticated users may upload ONLY into their own folder
    execute format('drop policy if exists "%1$s_owner_insert" on storage.objects;', b);
    execute format(
      'create policy "%1$s_owner_insert" on storage.objects for insert to authenticated with check (bucket_id = ''%1$s'' and (storage.foldername(name))[1] = auth.uid()::text);',
      b
    );

    -- Owners may replace / delete only their own objects
    execute format('drop policy if exists "%1$s_owner_update" on storage.objects;', b);
    execute format(
      'create policy "%1$s_owner_update" on storage.objects for update to authenticated using (bucket_id = ''%1$s'' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = ''%1$s'' and (storage.foldername(name))[1] = auth.uid()::text);',
      b
    );

    execute format('drop policy if exists "%1$s_owner_delete" on storage.objects;', b);
    execute format(
      'create policy "%1$s_owner_delete" on storage.objects for delete to authenticated using (bucket_id = ''%1$s'' and (storage.foldername(name))[1] = auth.uid()::text);',
      b
    );
  end loop;
end;
$$;
