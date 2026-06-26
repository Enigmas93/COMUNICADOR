create policy "users_insert_self"
  on public.users
  for insert
  to authenticated
  with check (id = auth.uid());

create policy "users_update_self"
  on public.users
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "room_invites_valid_token_select"
  on public.room_invites
  for select
  to anon, authenticated
  using (
    token is not null
    and expires_at > timezone('utc', now())
    and uses < max_uses
  );
