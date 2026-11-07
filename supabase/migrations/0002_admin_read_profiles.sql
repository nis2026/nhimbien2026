-- VIP Coach Ms. Nhím Biển — let the admin see EVERY student profile (run ONCE, safe to re-run)
--
-- Run in the Supabase SQL editor for project dncwwxqzpiobooqvlurc:
-- https://supabase.com/dashboard/project/dncwwxqzpiobooqvlurc/sql/new
--
-- Before this, the only SELECT policy on nhim_bien_profiles was "own profile select"
-- (auth.uid() = id), so the admin page could never list other students' accounts.
-- Policies are OR-ed, so this simply adds "admin may read all rows".
-- nhim_bien_can_manage_locks() is true for the admin Gmail straight from the JWT, so it
-- works even before the admin's own nhim_bien_profiles row has role = 'admin'.

drop policy if exists "admin can read all profiles" on public.nhim_bien_profiles;
create policy "admin can read all profiles" on public.nhim_bien_profiles
  for select to authenticated using (public.nhim_bien_can_manage_locks());

-- Same reasoning for changing a student's role from the admin page.
drop policy if exists "own or admin profile update" on public.nhim_bien_profiles;
create policy "own or admin profile update" on public.nhim_bien_profiles
  for update to authenticated
  using (auth.uid() = id or public.nhim_bien_can_manage_locks());
