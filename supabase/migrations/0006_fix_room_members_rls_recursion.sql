create or replace function public.is_room_member(check_room_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members
    where room_id = check_room_id
      and user_id = check_user_id
  );
$$;

create or replace function public.is_room_admin(check_room_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members
    where room_id = check_room_id
      and user_id = check_user_id
      and role = 'admin'
  );
$$;

create or replace function public.is_room_owner(check_room_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rooms
    where id = check_room_id
      and owner_id = check_user_id
  );
$$;

create or replace function public.shares_room_with_user(target_user_id uuid, viewer_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members viewer
    join public.room_members peer on peer.room_id = viewer.room_id
    where viewer.user_id = viewer_user_id
      and peer.user_id = target_user_id
  );
$$;

drop policy if exists "users_select_self_or_room_member" on public.users;
create policy "users_select_self_or_room_member"
  on public.users
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.shares_room_with_user(id)
  );

drop policy if exists "rooms_public_or_member_select" on public.rooms;
create policy "rooms_public_or_member_select"
  on public.rooms
  for select
  using (
    is_public = true
    or public.is_room_member(id)
  );

drop policy if exists "rooms_admin_update" on public.rooms;
create policy "rooms_admin_update"
  on public.rooms
  for update
  to authenticated
  using (public.is_room_admin(id))
  with check (public.is_room_admin(id));

drop policy if exists "room_members_member_select" on public.room_members;
create policy "room_members_member_select"
  on public.room_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_room_member(room_id)
  );

drop policy if exists "room_members_admin_insert" on public.room_members;
create policy "room_members_admin_insert"
  on public.room_members
  for insert
  to authenticated
  with check (
    public.is_room_admin(room_id)
    or user_id = auth.uid()
  );

drop policy if exists "room_members_admin_update" on public.room_members;
create policy "room_members_admin_update"
  on public.room_members
  for update
  to authenticated
  using (public.is_room_admin(room_id))
  with check (public.is_room_admin(room_id));

drop policy if exists "room_members_admin_delete" on public.room_members;
create policy "room_members_admin_delete"
  on public.room_members
  for delete
  to authenticated
  using (public.is_room_admin(room_id));

drop policy if exists "messages_member_select" on public.messages;
create policy "messages_member_select"
  on public.messages
  for select
  to authenticated
  using (public.is_room_member(room_id));

drop policy if exists "messages_member_insert" on public.messages;
create policy "messages_member_insert"
  on public.messages
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.is_room_member(room_id)
    and exists (
      select 1
      from public.room_channels rc
      where rc.id = public.messages.channel_id
        and rc.room_id = public.messages.room_id
    )
    and exists (
      select 1
      from public.room_keys rk
      where rk.id = public.messages.room_key_id
        and rk.room_id = public.messages.room_id
    )
  );

drop policy if exists "files_member_select" on public.files;
create policy "files_member_select"
  on public.files
  for select
  to authenticated
  using (public.is_room_member(room_id));

drop policy if exists "files_member_insert" on public.files;
create policy "files_member_insert"
  on public.files
  for insert
  to authenticated
  with check (public.is_room_member(room_id));

drop policy if exists "reactions_member_rw" on public.reactions;
create policy "reactions_member_rw"
  on public.reactions
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.messages m
      where m.id = public.reactions.message_id
        and public.is_room_member(m.room_id)
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.messages m
      where m.id = public.reactions.message_id
        and public.is_room_member(m.room_id)
    )
  );

drop policy if exists "room_invites_admin_rw" on public.room_invites;
create policy "room_invites_admin_rw"
  on public.room_invites
  for all
  to authenticated
  using (public.is_room_admin(room_id))
  with check (public.is_room_admin(room_id));

drop policy if exists "room_channels_member_select" on public.room_channels;
create policy "room_channels_member_select"
  on public.room_channels
  for select
  to authenticated
  using (public.is_room_member(room_id));

drop policy if exists "room_channels_admin_insert" on public.room_channels;
create policy "room_channels_admin_insert"
  on public.room_channels
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.is_room_admin(room_id)
  );

drop policy if exists "room_channels_admin_update" on public.room_channels;
create policy "room_channels_admin_update"
  on public.room_channels
  for update
  to authenticated
  using (public.is_room_admin(room_id))
  with check (public.is_room_admin(room_id));

drop policy if exists "room_channels_admin_delete" on public.room_channels;
create policy "room_channels_admin_delete"
  on public.room_channels
  for delete
  to authenticated
  using (public.is_room_admin(room_id));

drop policy if exists "room_keys_member_select" on public.room_keys;
create policy "room_keys_member_select"
  on public.room_keys
  for select
  to authenticated
  using (public.is_room_member(room_id));

drop policy if exists "room_keys_admin_insert" on public.room_keys;
create policy "room_keys_admin_insert"
  on public.room_keys
  for insert
  to authenticated
  with check (
    auth.uid() = created_by
    and (
      public.is_room_owner(room_id)
      or public.is_room_admin(room_id)
    )
  );

drop policy if exists "room_member_keys_select_self" on public.room_member_keys;
create policy "room_member_keys_select_self"
  on public.room_member_keys
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "room_member_keys_insert_admin_or_self" on public.room_member_keys;
create policy "room_member_keys_insert_admin_or_self"
  on public.room_member_keys
  for insert
  to authenticated
  with check (
    (
      user_id = auth.uid()
      and (
        public.is_room_member(room_id)
        or public.is_room_owner(room_id)
      )
    )
    or public.is_room_admin(room_id)
  );

drop policy if exists "room_member_keys_delete_admin_or_self" on public.room_member_keys;
create policy "room_member_keys_delete_admin_or_self"
  on public.room_member_keys
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_room_admin(room_id)
  );

drop policy if exists "room_files_storage_select" on storage.objects;
create policy "room_files_storage_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'room-files'
    and public.is_room_member((split_part(name, '/', 1))::uuid)
  );

drop policy if exists "room_files_storage_insert" on storage.objects;
create policy "room_files_storage_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'room-files'
    and owner = auth.uid()
    and public.is_room_member((split_part(name, '/', 1))::uuid)
  );
