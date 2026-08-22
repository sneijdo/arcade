-- ARCADE — correct Linnet's Odd One Out score for this week.
-- Run ONCE in the Supabase SQL Editor, AFTER re-running schema_scores.sql (which raises
-- oddoneout's bound from 200 to 2000 and fixes validate_score_bounds()/rank_for() to
-- actually see score_bounds — both were silently no-ops until now, see that file's updated
-- comments). Her real 247-round run was rejected by the old (too-tight) bound, so only a
-- stale 75 made it into public.scores; her private profile/playerMeta already correctly
-- show 247 (those writes were never actually validated — the whole reason this needed fixing).

update public.scores
set score = 247, achieved_at = now(), updated_at = now()
where owner_id = '7afeb7ea-6656-4030-90bd-545d8873047c'
  and game_id = 'oddoneout'
  and week = '2026-08-16';
