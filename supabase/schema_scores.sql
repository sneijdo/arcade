-- ARCADE — server-validated scores (run once, after schema.sql).
-- Run this in your Supabase project's SQL editor (Database > SQL Editor > New query).
--
-- Why this exists: the shared leaderboard used to live as `lb:<game>:<week>:<id>`
-- rows inside the generic `kv` table (see supabase/schema.sql), whose RLS only
-- checks WHO is writing (owner_id = auth.uid()), never WHAT they write. That let
-- a signed-in client upsert any score it liked — exactly how a player forged a
-- 99999 on Rule Breaker. This file replaces that path with a real `scores` table
-- that can ONLY be written through submit_score() below, which validates the
-- score against a per-game plausibility range before it ever reaches storage.
--
-- Bounds below come from src/scoring.ts's existing per-game rating tiers (the
-- SINDSSYGT/top tier the dev already tuned), given generous headroom — these are
-- a first-line sanity ceiling, not exact anti-cheat, and are meant to be tuned
-- per-row over time. A few games have an exact mechanical cap recoverable from
-- code/comments instead: color_accuracy (0-100, it's a %), dropzone_score
-- (TOTAL_BALLS cap, see dropzone.ts), trajectory_score (8 shots x 30pts max, see
-- trajectory.ts), colossus_damage (boss max HP, see colossus.ts). reaction_ms
-- gets a floor (low values are what get forged), not a ceiling.
--
-- oddoneout_score's original bound (200) turned out too tight and rejected a genuine
-- 247-round run: its difficulty (grid size/round time/angle, see oddoneout.ts) caps out
-- around attempt ~15 and then holds flat forever, so — unlike a fixed-round-count game —
-- there's no natural ceiling, only how long a skilled player keeps their streak going.
-- Raised to 2000; worth remembering for any other game with this same "ramps then caps,
-- keeps going until you slip" shape (survival/endless modes generally, not timed rounds).

create table if not exists public.score_bounds (
  game_id text primary key,
  direction text not null check (direction in ('asc', 'desc')),
  min_value numeric not null,
  max_value numeric not null
);

insert into public.score_bounds (game_id, direction, min_value, max_value) values
  ('reaction', 'asc', 80, 2000),
  ('aim', 'desc', 0, 100),
  ('memory', 'desc', 0, 50),
  ('numberrush', 'desc', 0, 200),
  ('snake', 'desc', 0, 1000),
  ('tactical', 'desc', 0, 100),
  ('stack', 'desc', 0, 500),
  ('color', 'desc', 0, 100),
  ('dash', 'desc', 0, 100000),
  ('merge', 'desc', 0, 200000),
  ('overclock', 'desc', 0, 100000),
  ('glitchgrid', 'desc', 0, 1000),
  ('pulse', 'desc', 0, 1000000),
  ('dropzone', 'desc', 0, 6000),
  ('ruleswitch', 'desc', 0, 100),
  ('wordrush', 'desc', 0, 200),
  ('swerve', 'desc', 0, 600000),
  ('pairs', 'desc', 0, 2000),
  ('oddoneout', 'desc', 0, 2000),
  ('colossus', 'desc', 0, 320),
  ('trajectory', 'desc', 0, 240),
  ('tetris', 'desc', 0, 2000000),
  ('towerdefense', 'desc', 0, 500)
on conflict (game_id) do update set direction = excluded.direction, min_value = excluded.min_value, max_value = excluded.max_value;

-- Real per-player-per-game-per-week leaderboard row. "alltime" isn't a separate
-- row — the client derives it by scanning every week's row per player and
-- keeping the best (see readLeaderboard() in src/state.ts), same as the old
-- kv-based scheme did.
create table if not exists public.scores (
  owner_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null references public.score_bounds(game_id),
  week date not null,
  score numeric not null,
  achieved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, game_id, week)
);

create index if not exists scores_game_week_idx on public.scores (game_id, week);

alter table public.scores enable row level security;

drop policy if exists "scores_select_all" on public.scores;
create policy "scores_select_all"
  on public.scores for select
  using (true);

-- Deliberately NO insert/update/delete policy for client roles — the table can
-- only be written through submit_score() below, which runs as SECURITY DEFINER
-- and bypasses RLS internally after validating the score itself.
revoke insert, update, delete on public.scores from anon, authenticated;
grant select on public.scores to anon, authenticated;

-- One row per player, touched only from inside submit_score() — never exposed
-- to the client directly.
create table if not exists public.score_rate_limit (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  last_submit_at timestamptz not null default now()
);

alter table public.score_rate_limit enable row level security;
revoke all on public.score_rate_limit from anon, authenticated;

-- returns a plain boolean (accepted/improved or not) rather than a table — the client
-- (pushLeaderboardEntry in src/state.ts) only ever checks for an error, never reads the
-- return value, and a `returns table(week date, score numeric, ...)` shape turns those
-- column names into implicit PL/pgSQL variables that collide with public.scores' own
-- `week`/`score` columns ("column reference is ambiguous") — this is exactly what broke
-- every single submission from day one of this function's deployment.
create or replace function public.submit_score(p_game_id text, p_score numeric)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bounds record;
  v_today date;
  v_dow int;
  v_week date;
  v_last timestamptz;
  v_existing numeric;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_score is null or p_score <> p_score then
    raise exception 'invalid score';
  end if;

  select * into v_bounds from public.score_bounds where game_id = p_game_id;
  if not found then
    raise exception 'unknown game_id: %', p_game_id;
  end if;
  if p_score < v_bounds.min_value or p_score > v_bounds.max_value then
    raise exception 'score % out of plausible range [%, %] for %', p_score, v_bounds.min_value, v_bounds.max_value, p_game_id;
  end if;

  -- Rate limit: at most one accepted submission per second per player, across
  -- all games. Real play can never legitimately hit this (a round takes far
  -- longer than a second) — it only stops scripted/console hammering.
  insert into public.score_rate_limit (owner_id, last_submit_at)
  values (v_uid, now())
  on conflict (owner_id) do update
    set last_submit_at = excluded.last_submit_at
    where public.score_rate_limit.last_submit_at < now() - interval '1 second'
  returning last_submit_at into v_last;
  if v_last is null then
    raise exception 'too many submissions — slow down';
  end if;

  -- Sunday-start week bucket, UTC — must exactly mirror weekKey() in
  -- src/state.ts (Date.UTC(...) then subtract getUTCDay()).
  v_today := (now() at time zone 'utc')::date;
  v_dow := extract(dow from v_today)::int;
  v_week := v_today - v_dow;

  select s.score into v_existing from public.scores s
    where s.owner_id = v_uid and s.game_id = p_game_id and s.week = v_week
    for update;

  if v_existing is null
     or (v_bounds.direction = 'asc' and p_score < v_existing)
     or (v_bounds.direction = 'desc' and p_score > v_existing) then
    insert into public.scores (owner_id, game_id, week, score, achieved_at, updated_at)
    values (v_uid, p_game_id, v_week, p_score, now(), now())
    on conflict (owner_id, game_id, week)
    do update set score = excluded.score, achieved_at = now(), updated_at = now();
    return true;
  else
    return false;
  end if;
end;
$$;

grant execute on function public.submit_score(text, numeric) to authenticated;

-- Defense in depth: the `profile`/`playerMeta:*` rows in the generic kv table
-- (see schema.sql) still carry their own bestScores/bestReaction/bestAvg
-- mirrors, written wholesale via saveProfile()'s full-blob upsert — that write
-- path isn't migrated to a validating RPC in this pass (see Phase 2 note in
-- the plan), but this trigger at least stops the specific "bestReaction: 1.8ms"
-- class of impossible value from ever being written again, reusing the same
-- score_bounds table submit_score() uses. It does NOT touch xp/xpBalance,
-- unlocked-item arrays, or duelRating — those have no equivalent physical
-- plausibility bound and are out of scope here.
-- security definer: score_bounds has RLS enabled with no select policy for normal roles, so
-- without this the `for r in select * from public.score_bounds` loops below silently iterate
-- zero times (as the calling role, e.g. authenticated, sees no rows) and this trigger has
-- never actually validated anything since it was first deployed — confirmed live: Linnet's
-- profile/playerMeta happily stored bestScores.oddoneout = 247 despite the (then-200) bound,
-- with no error at all. Same root cause and same fix as rank_for()'s security definer above.
create or replace function public.validate_score_bounds()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v numeric;
begin
  if new.key = 'profile' and new.shared = false then
    for r in select * from public.score_bounds loop
      if r.game_id = 'reaction' then
        v := (new.value->>'bestAvg')::numeric;
        if v is not null and (v < r.min_value or v > r.max_value) then
          raise exception 'bestAvg % out of plausible range [%, %]', v, r.min_value, r.max_value;
        end if;
        v := (new.value->>'bestReaction')::numeric;
        if v is not null and (v < r.min_value or v > r.max_value) then
          raise exception 'bestReaction % out of plausible range [%, %]', v, r.min_value, r.max_value;
        end if;
      else
        v := (new.value #>> array['bestScores', r.game_id])::numeric;
        if v is not null and (v < r.min_value or v > r.max_value) then
          raise exception 'bestScores.% = % out of plausible range [%, %]', r.game_id, v, r.min_value, r.max_value;
        end if;
      end if;
    end loop;
  elsif new.key like 'playerMeta:%' and new.shared = true then
    for r in select * from public.score_bounds loop
      if r.game_id = 'reaction' then
        v := (new.value->>'bestAvg')::numeric;
        if v is not null and (v < r.min_value or v > r.max_value) then
          raise exception 'bestAvg % out of plausible range [%, %]', v, r.min_value, r.max_value;
        end if;
        v := (new.value->>'bestReaction')::numeric;
        if v is not null and (v < r.min_value or v > r.max_value) then
          raise exception 'bestReaction % out of plausible range [%, %]', v, r.min_value, r.max_value;
        end if;
      else
        v := (new.value #>> array['bestScores', r.game_id])::numeric;
        if v is not null and (v < r.min_value or v > r.max_value) then
          raise exception 'bestScores.% = % out of plausible range [%, %]', r.game_id, v, r.min_value, r.max_value;
        end if;
      end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists kv_validate_score_bounds on public.kv;
create trigger kv_validate_score_bounds
  before insert or update on public.kv
  for each row execute function public.validate_score_bounds();

-- Harden the existing kv write policies (schema.sql) so leaderboard keys can
-- no longer be written through the old generic path at all, even if a future
-- client-code regression tried to — only submit_score() (SECURITY DEFINER,
-- bypasses RLS) can write public.scores now.
drop policy if exists "kv_insert_own" on public.kv;
create policy "kv_insert_own"
  on public.kv for insert
  with check (owner_id = auth.uid() and key not like 'lb:%');

drop policy if exists "kv_update_own" on public.kv;
create policy "kv_update_own"
  on public.kv for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and key not like 'lb:%');
