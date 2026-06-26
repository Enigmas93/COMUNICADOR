alter table public.users
  add column if not exists last_seen_at timestamptz not null default timezone('utc', now());
