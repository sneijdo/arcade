-- ARCADE — one-time cleanup of pre-existing impossible scores.
-- Run ONCE in the Supabase SQL Editor (Project > SQL Editor > New query),
-- AFTER schema_scores.sql (this depends on public.score_bounds and
-- public.scores existing already).
--
-- Before schema_scores.sql, nothing validated what got written to the shared
-- leaderboard or to bestScores/bestReaction/bestAvg — that's how a forged
-- 99999 on Rule Breaker, and reaction bestReaction values of 1.8ms/4ms
-- (physically impossible), ended up live. This migrates every legitimate
-- `lb:*` leaderboard row into the new validated public.scores table, drops
-- the impossible ones, and strips the same class of impossible value out of
-- players' own profile/playerMeta records — generically, by bounds, not
-- hardcoded to any one player.

-- 1) PREVIEW — everything this script is about to touch. Read this output
-- before running the statements below; nothing is deleted or changed yet.

-- 1a) Leaderboard rows outside their game's plausible range (skipped by the
-- migration in step 2, deleted in step 4 along with everything else in kv's
-- 'lb:%' namespace since it's fully superseded by public.scores).
select k.owner_id, k.key, (k.value->>'score') as score, b.min_value, b.max_value
from public.kv k
join public.score_bounds b on b.game_id = split_part(k.key, ':', 2)
where k.shared = true
  and k.key like 'lb:%'
  and ((k.value->>'score')::numeric < b.min_value or (k.value->>'score')::numeric > b.max_value);

-- 1b) Profile/playerMeta best-score fields outside their game's plausible
-- range (stripped in step 3).
select
  k.owner_id,
  k.key,
  b.game_id,
  coalesce(k.value->>'bestAvg', k.value->>'bestReaction', k.value #>> array['bestScores', b.game_id]) as offending_value,
  b.min_value,
  b.max_value
from public.kv k
cross join public.score_bounds b
where (k.key = 'profile' or k.key like 'playerMeta:%')
  and (
    (b.game_id = 'reaction' and (
      ((k.value->>'bestAvg') is not null and ((k.value->>'bestAvg')::numeric < b.min_value or (k.value->>'bestAvg')::numeric > b.max_value))
      or ((k.value->>'bestReaction') is not null and ((k.value->>'bestReaction')::numeric < b.min_value or (k.value->>'bestReaction')::numeric > b.max_value))
    ))
    or (b.game_id <> 'reaction'
      and (k.value #>> array['bestScores', b.game_id]) is not null
      and ((k.value #>> array['bestScores', b.game_id])::numeric < b.min_value or (k.value #>> array['bestScores', b.game_id])::numeric > b.max_value)
    )
  );

-- 1c) Rows whose week segment matches neither format below — should be empty,
-- but check before running step 2, since these get silently excluded there.
select k.owner_id, k.key
from public.kv k
where k.shared = true
  and k.key like 'lb:%'
  and split_part(k.key, ':', 3) !~ '^\d{4}-\d{2}-\d{2}$'
  and split_part(k.key, ':', 3) !~ '^\d{4}-W\d{2}$';

-- 2) MIGRATE — every legitimate lb:* row into public.scores. Key shape is
-- `lb:<game_id>:<week>:<owner_id>` (see pushLeaderboardEntry in src/state.ts).
-- weekKey() has written two different formats over this app's history: the
-- current plain YYYY-MM-DD date, and an older ISO-week string like "2026-W33"
-- (see the comment on weekKey() in src/state.ts) — both are parsed to an
-- actual date below; ISO-week rows land on that week's Monday, which is fine
-- for historical/alltime purposes (only NEW scores need the Sunday-bucket
-- weekKey() now uses — see submit_score() in schema_scores.sql). Rows failing
-- the score_bounds join (out-of-range, unknown game_id) or matching neither
-- week format are silently excluded here — they show up in the 1a/1c previews.
insert into public.scores (owner_id, game_id, week, score, achieved_at, updated_at)
select
  parsed.owner_id, parsed.game_id, parsed.week, parsed.score, parsed.achieved_at, parsed.updated_at
from (
  select
    k.owner_id,
    split_part(k.key, ':', 2) as game_id,
    case
      when split_part(k.key, ':', 3) ~ '^\d{4}-\d{2}-\d{2}$' then (split_part(k.key, ':', 3))::date
      when split_part(k.key, ':', 3) ~ '^\d{4}-W\d{2}$' then to_date(split_part(k.key, ':', 3) || '-1', 'IYYY-"W"IW-ID')
      else null
    end as week,
    (k.value->>'score')::numeric as score,
    case when k.value ? 'ts' then to_timestamp((k.value->>'ts')::numeric / 1000) else k.updated_at end as achieved_at,
    k.updated_at
  from public.kv k
  where k.shared = true and k.key like 'lb:%'
) parsed
join public.score_bounds b on b.game_id = parsed.game_id
where parsed.week is not null
  and parsed.score between b.min_value and b.max_value
on conflict (owner_id, game_id, week) do nothing;

-- 3) STRIP — impossible bestScores/bestReaction/bestAvg values from profile
-- (private) and playerMeta (public mirror) rows, one game at a time. This
-- passes cleanly through the validate_score_bounds trigger (schema_scores.sql)
-- since removing a field can never itself violate the bounds check.
do $$
declare
  r record;
begin
  for r in select * from public.score_bounds loop
    if r.game_id = 'reaction' then
      update public.kv
      set value = value - 'bestAvg'
      where (key = 'profile' or key like 'playerMeta:%')
        and (value->>'bestAvg') is not null
        and ((value->>'bestAvg')::numeric < r.min_value or (value->>'bestAvg')::numeric > r.max_value);

      update public.kv
      set value = value - 'bestReaction'
      where (key = 'profile' or key like 'playerMeta:%')
        and (value->>'bestReaction') is not null
        and ((value->>'bestReaction')::numeric < r.min_value or (value->>'bestReaction')::numeric > r.max_value);
    else
      update public.kv
      set value = value #- array['bestScores', r.game_id]
      where (key = 'profile' or key like 'playerMeta:%')
        and (value #>> array['bestScores', r.game_id]) is not null
        and ((value #>> array['bestScores', r.game_id])::numeric < r.min_value or (value #>> array['bestScores', r.game_id])::numeric > r.max_value);
    end if;
  end loop;
end $$;

-- 4) DELETE — the old lb:* kv rows are now fully superseded by public.scores
-- (valid ones migrated in step 2, impossible ones intentionally dropped).
delete from public.kv
where shared = true
  and key like 'lb:%';
