-- ARCADE — Live activity feed schema (run once, after schema.sql).
-- Run this in your Supabase project's SQL editor (Database > SQL Editor > New query).
--
-- An append-only event log — unlike the `kv` leaderboard rows (one row per
-- player+game+week, overwritten on every play, see storage.ts), each
-- finished session gets its own row here so the Activity page can show a
-- real "who just did what" feed instead of only current standings.
-- Denormalizes name/avatar/frame at insert time (same reasoning as
-- pushLeaderboardEntry() in state.ts): a reader has no way to join across
-- other players' private rows, only shared/public ones.

create table if not exists public.activity (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('session', 'personal_best')),
  game_id text not null,
  score numeric not null,
  name text not null,
  avatar text,
  frame text,
  created_at timestamptz not null default now()
);

create index if not exists activity_created_at_idx on public.activity (created_at desc);

alter table public.activity enable row level security;

-- Same shape as kv's "shared" rows: anyone can read (it's a public feed),
-- but you can only ever insert rows you own.
drop policy if exists "activity_select_all" on public.activity;
create policy "activity_select_all"
  on public.activity for select
  using (true);

drop policy if exists "activity_insert_own" on public.activity;
create policy "activity_insert_own"
  on public.activity for insert
  with check (owner_id = auth.uid());

-- Streams new rows to subscribed clients in real time (see subscribeActivity()
-- in src/activity.ts). Guarded so re-running this script doesn't error on an
-- already-enabled table.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity'
  ) then
    alter publication supabase_realtime add table public.activity;
  end if;
end $$;
