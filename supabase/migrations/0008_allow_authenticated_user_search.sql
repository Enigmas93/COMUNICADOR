drop policy if exists "users_select_self_or_room_member" on public.users;
create policy "users_select_authenticated"
  on public.users
  for select
  to authenticated
  using (true);
