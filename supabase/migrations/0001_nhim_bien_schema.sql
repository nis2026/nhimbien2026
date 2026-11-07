-- VIP Coach Ms. Nhím Biển — full database setup (run ONCE, safe to re-run)
--
-- Run in the Supabase SQL editor for project dncwwxqzpiobooqvlurc:
-- https://supabase.com/dashboard/project/dncwwxqzpiobooqvlurc/sql/new
--
-- This Supabase project is SHARED with vip-coach-mickey, vip-coach-wendy and
-- ielts-eco-learning-hub, so every table here is prefixed "nhim_bien_".
--
-- Consolidates everything vip-coach-wendy needed four migrations for,
-- including the lessons learned there:
--   * RLS policies alone are NOT enough in this project — PostgREST also needs
--     table-level GRANTs, otherwise every call fails with 42501
--     "permission denied for table ...".
--   * Unit-lock writes are allowed for the admin Gmail straight from the JWT,
--     so they never depend on the admin's nhim_bien_profiles row having been synced.
--   * nhim_bien_unit_locks and nhim_bien_active_sessions are in the realtime publication,
--     so an admin unlock / a second-device login reaches open tabs instantly.

-- ---------------------------------------------------------------- tables

create table if not exists public.nhim_bien_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar text not null,
  email text,
  role text not null default 'student' check (role in ('admin', 'student')),
  created_at timestamptz not null default now()
);

create table if not exists public.nhim_bien_unit_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  unit_slug text not null,
  vocab_viewed_count int not null default 0,
  vocab_mastered_count int not null default 0,
  dialogue_opened boolean not null default false,
  dialogue_turns_read int not null default 0,
  video_watched boolean not null default false,
  match_game_best_score int,
  listen_game_best_score int,
  quiz_best_score int,
  updated_at timestamptz not null default now(),
  primary key (user_id, unit_slug)
);

create table if not exists public.nhim_bien_vocab_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  unit_slug text not null,
  word_no int not null,
  seen boolean not null default false,
  starred boolean not null default false,
  quiz_correct_count int not null default 0,
  quiz_attempt_count int not null default 0,
  last_reviewed_at timestamptz,
  primary key (user_id, unit_slug, word_no)
);

-- Class-wide lesson unlocks (admin-controlled, shared by everyone).
create table if not exists public.nhim_bien_unit_locks (
  unit_slug text primary key,
  unlocked boolean not null default false,
  updated_at timestamptz not null default now()
);

-- One row per user: the device that logged in most recently.
create table if not exists public.nhim_bien_active_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  device_session_id text not null,
  user_agent text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- helpers

-- SECURITY DEFINER so the admin check doesn't recurse into nhim_bien_profiles' own policies.
create or replace function public.nhim_bien_is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.nhim_bien_profiles where id = uid and role = 'admin');
$$;

create or replace function public.nhim_bien_can_manage_locks()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'nguyentoandinh.0511@gmail.com'
      or public.nhim_bien_is_admin(auth.uid());
$$;

grant execute on function public.nhim_bien_is_admin(uuid) to authenticated;
grant execute on function public.nhim_bien_can_manage_locks() to authenticated;

-- ---------------------------------------------------------------- RLS

alter table public.nhim_bien_profiles enable row level security;
alter table public.nhim_bien_unit_progress enable row level security;
alter table public.nhim_bien_vocab_progress enable row level security;
alter table public.nhim_bien_unit_locks enable row level security;
alter table public.nhim_bien_active_sessions enable row level security;

drop policy if exists "own profile select" on public.nhim_bien_profiles;
create policy "own profile select" on public.nhim_bien_profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "own profile insert" on public.nhim_bien_profiles;
create policy "own profile insert" on public.nhim_bien_profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "own or admin profile update" on public.nhim_bien_profiles;
create policy "own or admin profile update" on public.nhim_bien_profiles
  for update to authenticated using (auth.uid() = id or public.nhim_bien_is_admin(auth.uid()));

drop policy if exists "own unit progress" on public.nhim_bien_unit_progress;
create policy "own unit progress" on public.nhim_bien_unit_progress
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own vocab progress" on public.nhim_bien_vocab_progress;
create policy "own vocab progress" on public.nhim_bien_vocab_progress
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "anyone can read unit locks" on public.nhim_bien_unit_locks;
create policy "anyone can read unit locks" on public.nhim_bien_unit_locks
  for select using (true);

drop policy if exists "admin can write unit locks" on public.nhim_bien_unit_locks;
create policy "admin can write unit locks" on public.nhim_bien_unit_locks
  for all to authenticated
  using (public.nhim_bien_can_manage_locks())
  with check (public.nhim_bien_can_manage_locks());

drop policy if exists "own active session select" on public.nhim_bien_active_sessions;
create policy "own active session select" on public.nhim_bien_active_sessions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own active session insert" on public.nhim_bien_active_sessions;
create policy "own active session insert" on public.nhim_bien_active_sessions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "own active session update" on public.nhim_bien_active_sessions;
create policy "own active session update" on public.nhim_bien_active_sessions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------- grants

grant select, insert, update on public.nhim_bien_profiles to authenticated;
grant select, insert, update, delete on public.nhim_bien_unit_progress to authenticated;
grant select, insert, update, delete on public.nhim_bien_vocab_progress to authenticated;
grant select on public.nhim_bien_unit_locks to anon, authenticated;
grant insert, update, delete on public.nhim_bien_unit_locks to authenticated;
grant select, insert, update on public.nhim_bien_active_sessions to authenticated;

-- ---------------------------------------------------------------- realtime

do $$
declare t text;
begin
  foreach t in array array['nhim_bien_unit_locks', 'nhim_bien_active_sessions'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
