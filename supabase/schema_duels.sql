-- ARCADE — Light Cycles duel schema (run once, after schema.sql and schema_activity.sql).
-- Run this in your Supabase project's SQL editor (Database > SQL Editor > New query).
--
-- One challenge row per invite, driving the whole invite→accept→match lifecycle
-- (see src/duel/challenges.ts). Both participants can read/update a row they're
-- part of — unlike kv/activity's "only the owner writes" model, an invite is
-- inherently a two-party object (the recipient has to be able to accept/decline
-- it, the sender has to be able to cancel it). No transition validation beyond
-- ownership, same posture as every other table in this app (see kv/activity
-- policies) — everything client-computed, RLS only ever checks who you are.

create table if not exists public.duel_challenges (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sender_name text not null,
  sender_avatar text,
  sender_frame text,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled', 'completed')),
  result text check (result in ('sender_win', 'recipient_win', 'draw')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  completed_at timestamptz
);

create index if not exists duel_challenges_recipient_idx on public.duel_challenges (recipient_id);
create index if not exists duel_challenges_sender_idx on public.duel_challenges (sender_id);

alter table public.duel_challenges enable row level security;

drop policy if exists "duel_select_participant" on public.duel_challenges;
create policy "duel_select_participant"
  on public.duel_challenges for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "duel_insert_own" on public.duel_challenges;
create policy "duel_insert_own"
  on public.duel_challenges for insert
  with check (sender_id = auth.uid() and recipient_id <> auth.uid());

drop policy if exists "duel_update_participant" on public.duel_challenges;
create policy "duel_update_participant"
  on public.duel_challenges for update
  using (sender_id = auth.uid() or recipient_id = auth.uid())
  with check (sender_id = auth.uid() or recipient_id = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'duel_challenges'
  ) then
    alter publication supabase_realtime add table public.duel_challenges;
  end if;
end $$;

-- Widen the activity feed (see supabase/schema_activity.sql, src/activity.ts) to carry
-- duel results too — additive, existing 'session'/'personal_best' rows are untouched.
alter table public.activity drop constraint if exists activity_kind_check;
alter table public.activity add constraint activity_kind_check
  check (kind in ('session', 'personal_best', 'duel_result'));

alter table public.activity add column if not exists opponent_name text;
