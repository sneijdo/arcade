-- ARCADE — fix silently-stuck profile saves for Linnet and Sneijdo, plus the Hall of
-- Fame duplication that cascaded from it. Run ONCE in the Supabase SQL Editor.
--
-- Root cause: both players have a `bestReaction` value below score_bounds' 80ms floor
-- (Linnet: ~12.8ms, Sneijdo: ~10.4ms) — a physically-impossible artifact left over from
-- before validate_score_bounds() (see schema_scores.sql) started validating every write
-- to the `profile`/`playerMeta:*` kv rows. Since that field can never legitimately improve
-- (nothing beats an impossible time), every single save of their whole profile blob has
-- been silently rejected by the trigger ever since it was deployed — with the app never
-- surfacing that failure (fixed separately in src/state.ts's saveProfile()).
--
-- Confirmed live symptoms, all from this one stuck field:
--  - Linnet: shop purchases never persisted (XP spent client-side, nothing saved) —
--    "butikken virker ikke, men jeg mister min EXP".
--  - Sneijdo: personal-best updates (bestScores/bestAvg/bestReaction) never persisted —
--    "mine rekorder opdaterer ikke".
--  - Sneijdo: profile.hofCheckedThroughWeek (the "already credited" bookmark used by
--    creditMyHallOfFameWins() in state.ts) never persisted either, so every fresh page
--    load reprocessed the same week from scratch. The wins tally itself lives under a
--    DIFFERENT kv key (hof:<id>) that isn't covered by this same trigger, so it kept
--    saving fine on every one of those repeated reloads — inflating a real 1x win in
--    pulse/tetris/wordrush to 10x (totalWins 30 instead of 3). Confirmed against
--    public.scores: he only has a row for these three games in ONE week (2026-08-16).
--
-- Setting bestReaction to null (rather than guessing a "real" value) is deliberate — we
-- don't know their actual best tap time, and null cleanly falls out of the trigger's
-- `v is not null` bounds check, so it stops blocking future saves without fabricating data.
-- It'll repopulate itself the next time either of them sets a genuine reaction personal best.

update public.kv
set value = value - 'bestReaction'
where shared = false
  and key = 'profile'
  and owner_id in ('7afeb7ea-6656-4030-90bd-545d8873047c', '6ae6eb08-ec49-43dc-aa69-0dee5b5479b1')
  and (value->>'bestReaction')::numeric < 80;

update public.kv
set value = value - 'bestReaction'
where shared = true
  and key in ('playerMeta:7afeb7ea-6656-4030-90bd-545d8873047c', 'playerMeta:6ae6eb08-ec49-43dc-aa69-0dee5b5479b1')
  and (value->>'bestReaction')::numeric < 80;

-- Collapse Sneijdo's inflated Hall of Fame tally back to the one real week it came from.
update public.kv
set value = jsonb_build_object(
  'id', '6ae6eb08-ec49-43dc-aa69-0dee5b5479b1',
  'wins', jsonb_build_object('pulse', 1, 'tetris', 1, 'wordrush', 1),
  'totalWins', 3,
  'legendaryWeeks', 0
)
where shared = true
  and key = 'hof:6ae6eb08-ec49-43dc-aa69-0dee5b5479b1';

-- Diagnostic — run this separately afterward to check whether any OTHER player has the
-- same class of stuck-forever value (any bestReaction/bestAvg/bestScores.<game> outside
-- score_bounds), so this doesn't need to be rediscovered one bug report at a time:
--
-- select k.owner_id, k.key, b.game_id, b.min_value, b.max_value,
--        coalesce((k.value->>'bestReaction')::numeric, (k.value #>> array['bestScores', b.game_id])::numeric) as stuck_value
-- from public.kv k
-- cross join public.score_bounds b
-- where k.shared = false and k.key = 'profile'
--   and (
--     (b.game_id = 'reaction' and (
--       ((k.value->>'bestReaction')::numeric is not null and ((k.value->>'bestReaction')::numeric < b.min_value or (k.value->>'bestReaction')::numeric > b.max_value))
--       or ((k.value->>'bestAvg')::numeric is not null and ((k.value->>'bestAvg')::numeric < b.min_value or (k.value->>'bestAvg')::numeric > b.max_value))
--     ))
--     or (b.game_id <> 'reaction' and (k.value #>> array['bestScores', b.game_id]) is not null
--         and ((k.value #>> array['bestScores', b.game_id])::numeric < b.min_value or (k.value #>> array['bestScores', b.game_id])::numeric > b.max_value))
--   );
