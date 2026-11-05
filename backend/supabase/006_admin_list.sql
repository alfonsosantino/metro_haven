-- METRO HAVEN — 006: admins can see the list of admins (for the Admins tab).
drop policy if exists "admins see self" on public.admins;
drop policy if exists "admins see admins" on public.admins;
create policy "admins see admins" on public.admins for select to authenticated using (public.is_admin());
