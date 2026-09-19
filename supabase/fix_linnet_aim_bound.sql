-- ARCADE — correct Linnet's Aim Trainer scores after the too-tight bound is fixed.
-- Run ONCE in the Supabase SQL Editor, AFTER re-running schema_scores.sql (which raises
-- aim's bound from 100 to its real mechanical cap of 272 — see that file's updated
-- comment). Everything below was rejected by the old bound and needed a manual correction:
--
-- 1) Today's (2026-09-19) new record, 104 hits, never made it into public.scores at all —
--    no row exists yet for week 2026-09-13. Confirmed via public.activity id 5585
--    (kind=personal_best, score=104, created_at 2026-09-19T17:15:43.821124+00:00).
--
-- 2) Her 103-hit run on 2026-09-09 (public.activity id 5512) hit the same wall and got
--    silently dropped — that week's row (2026-09-06) is stuck at 99, the *next* play
--    that week, not her actual best. Doesn't change who was #1 that week (she already
--    led with 99), but the recorded number is wrong; correcting it for the history.
--
-- 3) Her private profile/playerMeta bestScores.aim is stuck at 100 for the same reason:
--    validate_score_bounds() (schema_scores.sql) now actually enforces score_bounds (see
--    that function's "security definer" fix), so every saveProfile() write carrying
--    bestScores.aim > 100 was rejected outright. Patched directly here rather than
--    waiting for her to replay 104 again client-side.

insert into public.scores (owner_id, game_id, week, score, achieved_at, updated_at)
values ('7afeb7ea-6656-4030-90bd-545d8873047c', 'aim', '2026-09-13', 104, '2026-09-19T17:15:43.821124+00:00', now())
on conflict (owner_id, game_id, week)
do update set score = excluded.score, achieved_at = excluded.achieved_at, updated_at = now();

update public.scores
set score = 103, achieved_at = '2026-09-09T18:30:05.693243+00:00', updated_at = now()
where owner_id = '7afeb7ea-6656-4030-90bd-545d8873047c'
  and game_id = 'aim'
  and week = '2026-09-06';

update public.kv
set value = jsonb_set(value, '{bestScores,aim}', '104', true), updated_at = now()
where owner_id = '7afeb7ea-6656-4030-90bd-545d8873047c'
  and shared = false
  and key = 'profile';

update public.kv
set value = jsonb_set(value, '{bestScores,aim}', '104', true), updated_at = now()
where shared = true
  and key = 'playerMeta:7afeb7ea-6656-4030-90bd-545d8873047c';

-- Verify:
-- select game_id, week, score, achieved_at from public.scores
--   where owner_id = '7afeb7ea-6656-4030-90bd-545d8873047c' and game_id = 'aim' order by week;
-- select value->'bestScores'->'aim' from public.kv
--   where key = 'playerMeta:7afeb7ea-6656-4030-90bd-545d8873047c' and shared = true;
