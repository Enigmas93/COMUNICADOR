create extension if not exists "pgcrypto";

create type public.room_role as enum ('admin', 'member');
create type public.message_type as enum ('text', 'file', 'system');

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  name text not null,
  avatar_url text,
  public_key text not null,
  encrypted_private_key text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  is_public boolean not null default false,
  owner_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.room_role not null default 'member',
  encrypted_room_key text not null,
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (room_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  type public.message_type not null default 'text',
  created_at timestamptz not null default timezone('utc', now())
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  storage_path text not null,
  encrypted boolean not null default true,
  iv text not null,
  size bigint not null,
  type text not null,
  name text not null
);

create table public.reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (message_id, user_id, emoji)
);

create table public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  token text unique not null,
  created_by uuid not null references public.users (id) on delete cascade,
  expires_at timestamptz not null,
  max_uses integer not null default 1,
  uses integer not null default 0
);

alter table public.users enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.messages enable row level security;
alter table public.files enable row level security;
alter table public.reactions enable row level security;
alter table public.room_invites enable row level security;

create policy "users_select_self_or_room_member"
  on public.users
  for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.room_members actor
      join public.room_members peer on peer.room_id = actor.room_id
      where actor.user_id = auth.uid() and peer.user_id = public.users.id
    )
  );

create policy "rooms_public_or_member_select"
  on public.rooms
  for select
  using (
    is_public = true
    or exists (
      select 1 from public.room_members rm
      where rm.room_id = public.rooms.id and rm.user_id = auth.uid()
    )
  );

create policy "rooms_owner_insert"
  on public.rooms
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "rooms_admin_update"
  on public.rooms
  for update
  to authenticated
  using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = public.rooms.id and rm.user_id = auth.uid() and rm.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = public.rooms.id and rm.user_id = auth.uid() and rm.role = 'admin'
    )
  );

create policy "room_members_member_select"
  on public.room_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.room_members rm
      where rm.room_id = public.room_members.room_id and rm.user_id = auth.uid()
    )
  );

create policy "room_members_admin_insert"
  on public.room_members
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = public.room_members.room_id and rm.user_id = auth.uid() and rm.role = 'admin'
    )
    or user_id = auth.uid()
  );

create policy "room_members_admin_update"
  on public.room_members
  for update
  to authenticated
  using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = public.room_members.room_id and rm.user_id = auth.uid() and rm.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = public.room_members.room_id and rm.user_id = auth.uid() and rm.role = 'admin'
    )
  );

create policy "messages_member_select"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = public.messages.room_id and rm.user_id = auth.uid()
    )
  );

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
  );

create policy "files_member_select"
  on public.files
  for select
  to authenticated
  using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = public.files.room_id and rm.user_id = auth.uid()
    )
  );

create policy "files_member_insert"
  on public.files
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = public.files.room_id and rm.user_id = auth.uid()
    )
  );

create policy "reactions_member_rw"
  on public.reactions
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.messages m
      join public.room_members rm on rm.room_id = m.room_id
      where m.id = public.reactions.message_id and rm.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.messages m
      join public.room_members rm on rm.room_id = m.room_id
      where m.id = public.reactions.message_id and rm.user_id = auth.uid()
    )
  );

create policy "room_invites_admin_rw"
  on public.room_invites
  for all
  to authenticated
  using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = public.room_invites.room_id and rm.user_id = auth.uid() and rm.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = public.room_invites.room_id and rm.user_id = auth.uid() and rm.role = 'admin'
    )
  );
