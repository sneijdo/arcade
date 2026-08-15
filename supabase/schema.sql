-- ARCADE — Supabase schema
-- Run this once in your Supabase project's SQL editor (Database > SQL Editor > New query).
--
-- One generic key-value table backs the app's StorageAdapter interface (see
-- src/storage.ts) exactly the way localStorage did locally: `shared=false`
-- rows are private per-user data (profile, settings), `shared=true` rows are
-- publicly readable (leaderboard entries). owner_id defaults to the calling
-- user's auth.uid(), so the client never has to know or send it.

create table if not exists public.kv (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  shared boolean not null default false,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, shared, key)
);

-- Fast prefix scans for storage.list('lb:reaction:', true) etc.
create index if not exists kv_shared_key_idx on public.kv (key) where shared = true;

alter table public.kv enable row level security;

-- Anyone (including signed-out visitors) can read shared rows — that's the
-- public leaderboard. A signed-in user can additionally read their own
-- private rows.
create policy "kv_select_shared_or_own"
  on public.kv for select
  using (shared = true or owner_id = auth.uid());

-- You can only ever write rows you own — shared or not.
create policy "kv_insert_own"
  on public.kv for insert
  with check (owner_id = auth.uid());

create policy "kv_update_own"
  on public.kv for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "kv_delete_own"
  on public.kv for delete
  using (owner_id = auth.uid());
