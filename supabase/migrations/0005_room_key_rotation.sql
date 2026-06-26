alter table public.rooms
  add column current_room_key_id uuid;

create table public.room_keys (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  version integer not null,
  created_by uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (room_id, version)
);

create table public.room_member_keys (
  room_key_id uuid not null references public.room_keys (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  encrypted_room_key text not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (room_key_id, user_id)
);

insert into public.room_keys (room_id, version, created_by, created_at)
select r.id, 1, r.owner_id, r.created_at
from public.rooms r;

update public.rooms r
set current_room_key_id = rk.id
from public.room_keys rk
where rk.room_id = r.id
  and rk.version = 1;

alter table public.rooms
  add constraint rooms_current_room_key_id_fkey
  foreign key (current_room_key_id) references public.room_keys (id) on delete set null;

insert into public.room_member_keys (room_key_id, room_id, user_id, encrypted_room_key, created_at)
select r.current_room_key_id, rm.room_id, rm.user_id, rm.encrypted_room_key, rm.joined_at
from public.room_members rm
join public.rooms r on r.id = rm.room_id;

alter table public.room_members
  add column current_room_key_id uuid references public.room_keys (id) on delete cascade;

update public.room_members rm
set current_room_key_id = r.current_room_key_id
from public.rooms r
where r.id = rm.room_id;

alter table public.room_members
  alter column current_room_key_id set not null;

alter table public.messages
  add column room_key_id uuid references public.room_keys (id) on delete restrict;

update public.messages m
set room_key_id = r.current_room_key_id
from public.rooms r
where r.id = m.room_id;

alter table public.messages
  alter column room_key_id set not null;

alter table public.room_keys enable row level security;
alter table public.room_member_keys enable row level security;

create policy "room_keys_member_select"
  on public.room_keys
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.room_members rm
      where rm.room_id = public.room_keys.room_id and rm.user_id = auth.uid()
    )
  );

create policy "room_keys_admin_insert"
  on public.room_keys
  for insert
  to authenticated
  with check (
    auth.uid() = created_by
    and (
      exists (
        select 1
        from public.rooms r
        where r.id = public.room_keys.room_id and r.owner_id = auth.uid()
      )
      or exists (
        select 1
        from public.room_members rm
        where rm.room_id = public.room_keys.room_id and rm.user_id = auth.uid() and rm.role = 'admin'
      )
    )
  );

create policy "room_member_keys_select_self"
  on public.room_member_keys
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "room_member_keys_insert_admin_or_self"
  on public.room_member_keys
  for insert
  to authenticated
  with check (
    (
      user_id = auth.uid()
      and exists (
        select 1
        from public.room_members rm
        where rm.room_id = public.room_member_keys.room_id and rm.user_id = auth.uid()
      )
    )
    or exists (
      select 1
      from public.room_members rm
      where rm.room_id = public.room_member_keys.room_id and rm.user_id = auth.uid() and rm.role = 'admin'
    )
  );

create policy "room_member_keys_delete_admin_or_self"
  on public.room_member_keys
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.room_members rm
      where rm.room_id = public.room_member_keys.room_id and rm.user_id = auth.uid() and rm.role = 'admin'
    )
  );

drop policy "messages_member_insert" on public.messages;

create policy "messages_member_insert"
  on public.messages
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.room_members rm
      where rm.room_id = public.messages.room_id and rm.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.room_keys rk
      where rk.id = public.messages.room_key_id and rk.room_id = public.messages.room_id
    )
  );
