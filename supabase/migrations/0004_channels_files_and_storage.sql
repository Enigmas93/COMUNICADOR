create type public.channel_kind as enum ('general', 'announcement', 'topic');

create table public.room_channels (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  kind public.channel_kind not null default 'topic',
  position integer not null default 0,
  created_by uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (room_id, slug)
);

alter table public.room_channels enable row level security;

alter table public.messages
  add column if not exists channel_id uuid references public.room_channels (id) on delete cascade;

insert into public.room_channels (room_id, name, slug, description, kind, position, created_by)
select r.id, 'geral', 'geral', 'Canal principal da sala.', 'general', 0, r.owner_id
from public.rooms r
where not exists (
  select 1 from public.room_channels rc
  where rc.room_id = r.id and rc.slug = 'geral'
);

insert into public.room_channels (room_id, name, slug, description, kind, position, created_by)
select r.id, 'anuncios', 'anuncios', 'Avisos oficiais da sala.', 'announcement', 1, r.owner_id
from public.rooms r
where not exists (
  select 1 from public.room_channels rc
  where rc.room_id = r.id and rc.slug = 'anuncios'
);

update public.messages m
set channel_id = rc.id
from public.room_channels rc
where m.channel_id is null
  and rc.room_id = m.room_id
  and rc.slug = 'geral';

create index if not exists idx_messages_room_channel_created_at
  on public.messages (room_id, channel_id, created_at);

create policy "room_channels_member_select"
  on public.room_channels
  for select
  to authenticated
  using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = public.room_channels.room_id and rm.user_id = auth.uid()
    )
  );

create policy "room_channels_admin_insert"
  on public.room_channels
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.room_members rm
      where rm.room_id = public.room_channels.room_id and rm.user_id = auth.uid() and rm.role = 'admin'
    )
  );

create policy "room_channels_admin_update"
  on public.room_channels
  for update
  to authenticated
  using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = public.room_channels.room_id and rm.user_id = auth.uid() and rm.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = public.room_channels.room_id and rm.user_id = auth.uid() and rm.role = 'admin'
    )
  );

create policy "room_channels_admin_delete"
  on public.room_channels
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = public.room_channels.room_id and rm.user_id = auth.uid() and rm.role = 'admin'
    )
  );

drop policy if exists "messages_member_insert" on public.messages;

create policy "messages_member_insert"
  on public.messages
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.room_members rm
      where rm.room_id = public.messages.room_id and rm.user_id = auth.uid()
    )
    and exists (
      select 1 from public.room_channels rc
      where rc.id = public.messages.channel_id and rc.room_id = public.messages.room_id
    )
  );

insert into storage.buckets (id, name, public)
values ('room-files', 'room-files', false)
on conflict (id) do nothing;

create policy "room_files_storage_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'room-files'
    and exists (
      select 1
      from public.room_members rm
      where rm.room_id::text = split_part(name, '/', 1) and rm.user_id = auth.uid()
    )
  );

create policy "room_files_storage_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'room-files'
    and owner = auth.uid()
    and exists (
      select 1
      from public.room_members rm
      where rm.room_id::text = split_part(name, '/', 1) and rm.user_id = auth.uid()
    )
  );

create policy "room_files_storage_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'room-files'
    and owner = auth.uid()
  );
