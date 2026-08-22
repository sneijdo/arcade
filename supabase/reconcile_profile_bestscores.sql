-- ARCADE — reconcile profile.bestScores / bestAvg / bestReaction from public.scores.
--
-- Root cause: for a while, every saveProfile() write for Linnet and Sneijdo was silently
-- rejected (see fix_stuck_profile_saves.sql) because of a stuck invalid bestReaction value.
-- pushLeaderboardEntry()/submit_score() is a SEPARATE write path, not gated by that same
-- trigger, so it kept succeeding the whole time — meaning public.scores has been the one
-- reliable source of truth throughout. Their profile's own bestScores copy (what the "SPIL"
-- page/game tiles read) could silently freeze at whatever it was mid-save-failure and then
-- keep re-saving that same stale value forever once saves started working again, since
-- nothing else ever corrects it. Confirmed live: Sneijdo's tactical (Breach Protocol) tile
-- showed 30 while public.scores already had a genuine 44 from 2026-08-16.
--
-- This recomputes each game's true best (min for asc-direction games like reaction, max for
-- desc-direction games) straight from public.scores across every week, and patches it into
-- both the private profile row and the public playerMeta mirror — for BOTH players in one
-- pass, since the same underlying bug could have frozen any number of fields for either of
-- them, not just the ones already noticed.

with best_per_game as (
  select
    s.owner_id,
    s.game_id,
    case when b.direction = 'asc' then min(s.score) else max(s.score) end as best_score
  from public.scores s
  join public.score_bounds b on b.game_id = s.game_id
  where s.owner_id in ('7afeb7ea-6656-4030-90bd-545d8873047c', '6ae6eb08-ec49-43dc-aa69-0dee5b5479b1')
    and s.game_id <> 'reaction' -- reaction tracks bestAvg separately below, not bestScores
  group by s.owner_id, s.game_id, b.direction
),
best_scores_patch as (
  select owner_id, jsonb_object_agg(game_id, best_score) as patch
  from best_per_game
  group by owner_id
),
best_reaction_avg as (
  -- Each public.scores row for 'reaction' IS the session average that was submitted (see
  -- pushLeaderboardEntry('reaction', avg) after the earlier fix), so the true all-time best
  -- average is just the minimum across every week.
  select owner_id, min(score) as best_avg
  from public.scores
  where game_id = 'reaction'
    and owner_id in ('7afeb7ea-6656-4030-90bd-545d8873047c', '6ae6eb08-ec49-43dc-aa69-0dee5b5479b1')
  group by owner_id
)
update public.kv k
set value = (k.value || jsonb_build_object('bestScores', coalesce(k.value->'bestScores', '{}'::jsonb) || coalesce(p.patch, '{}'::jsonb)))
  || case when a.best_avg is not null and (k.value->>'bestAvg') is not null and (k.value->>'bestAvg')::numeric > a.best_avg
       then jsonb_build_object('bestAvg', a.best_avg)
       else '{}'::jsonb
     end
from best_scores_patch p
full outer join best_reaction_avg a using (owner_id)
where k.owner_id = coalesce(p.owner_id, a.owner_id)
  and k.shared = false
  and k.key = 'profile';

-- Same patch mirrored onto the public playerMeta:<id> row (what the leaderboard/profile pages
-- actually read for other players — see getPlayerMeta()/getCombinedLeaderboard() in state.ts).
with best_per_game as (
  select
    s.owner_id,
    s.game_id,
    case when b.direction = 'asc' then min(s.score) else max(s.score) end as best_score
  from public.scores s
  join public.score_bounds b on b.game_id = s.game_id
  where s.owner_id in ('7afeb7ea-6656-4030-90bd-545d8873047c', '6ae6eb08-ec49-43dc-aa69-0dee5b5479b1')
    and s.game_id <> 'reaction'
  group by s.owner_id, s.game_id, b.direction
),
best_scores_patch as (
  select owner_id, jsonb_object_agg(game_id, best_score) as patch
  from best_per_game
  group by owner_id
),
best_reaction_avg as (
  select owner_id, min(score) as best_avg
  from public.scores
  where game_id = 'reaction'
    and owner_id in ('7afeb7ea-6656-4030-90bd-545d8873047c', '6ae6eb08-ec49-43dc-aa69-0dee5b5479b1')
  group by owner_id
)
update public.kv k
set value = (k.value || jsonb_build_object('bestScores', coalesce(k.value->'bestScores', '{}'::jsonb) || coalesce(p.patch, '{}'::jsonb)))
  || case when a.best_avg is not null and (k.value->>'bestAvg') is not null and (k.value->>'bestAvg')::numeric > a.best_avg
       then jsonb_build_object('bestAvg', a.best_avg)
       else '{}'::jsonb
     end
from best_scores_patch p
full outer join best_reaction_avg a using (owner_id)
where k.owner_id = coalesce(p.owner_id, a.owner_id)
  and k.shared = true
  and k.key = 'playerMeta:' || k.owner_id::text;

-- Verify afterward:
-- select key, value->'bestScores' as best_scores, value->>'bestAvg' as best_avg
-- from public.kv
-- where shared = true and key like 'playerMeta:%'
--   and owner_id in ('7afeb7ea-6656-4030-90bd-545d8873047c', '6ae6eb08-ec49-43dc-aa69-0dee5b5479b1');
