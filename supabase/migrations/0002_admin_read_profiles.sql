-- VIP Coach Ms. Miu — let the admin see EVERY student profile (run ONCE, safe to re-run)
--
-- Run in the Supabase SQL editor for project dncwwxqzpiobooqvlurc:
-- https://supabase.com/dashboard/project/dncwwxqzpiobooqvlurc/sql/new
--
-- Before this, the only SELECT policy on miu_profiles was "own profile select"
-- (auth.uid() = id), so the admin page could never list other students' accounts.
-- Policies are OR-ed, so this simply adds "admin may read all rows".
-- miu_can_manage_locks() is true for the admin Gmail straight from the JWT, so it
-- works even before the admin's own miu_profiles row has role = 'admin'.

drop policy if exists "admin can read all profiles" on public.miu_profiles;
create policy "admin can read all profiles" on public.miu_profiles
  for select to authenticated using (public.miu_can_manage_locks());

-- Same reasoning for changing a student's role from the admin page.
drop policy if exists "own or admin profile update" on public.miu_profiles;
create policy "own or admin profile update" on public.miu_profiles
  for update to authenticated
  using (auth.uid() = id or public.miu_can_manage_locks());
