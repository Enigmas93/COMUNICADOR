create table if not exists public.message_reads (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  read_at timestamptz not null default timezone('utc', now()),
  primary key (message_id, user_id)
);

alter table public.message_reads enable row level security;

drop policy if exists "message_reads_member_select" on public.message_reads;
create policy "message_reads_member_select"
  on public.message_reads
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.messages m
      where m.id = public.message_reads.message_id
        and public.is_room_member(m.room_id)
    )
  );

drop policy if exists "message_reads_member_insert_self" on public.message_reads;
create policy "message_reads_member_insert_self"
  on public.message_reads
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.messages m
      where m.id = public.message_reads.message_id
        and public.is_room_member(m.room_id)
    )
  );
