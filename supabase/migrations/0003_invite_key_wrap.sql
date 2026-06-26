alter table public.room_invites
  add column if not exists key_wrap_ciphertext text,
  add column if not exists key_wrap_iv text;
