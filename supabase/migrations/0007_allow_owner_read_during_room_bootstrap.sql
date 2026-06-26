drop policy if exists "rooms_public_or_member_select" on public.rooms;
create policy "rooms_public_or_member_select"
  on public.rooms
  for select
  using (
    is_public = true
    or public.is_room_owner(id)
    or public.is_room_member(id)
  );

drop policy if exists "room_keys_member_select" on public.room_keys;
create policy "room_keys_member_select"
  on public.room_keys
  for select
  to authenticated
  using (
    public.is_room_owner(room_id)
    or public.is_room_member(room_id)
  );
