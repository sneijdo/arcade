-- ARCADE — correct Schwan's Snake score for this week.
-- Run once in the Supabase SQL Editor. His public.scores row was stuck at a stale 12
-- (from this morning) despite a genuine, in-bounds 83 achieved later — everything checked
-- out server-side (bounds, direction, rate limit), so this looks like a one-off transient
-- failure on that one submit_score call rather than a systemic bug. His private profile/
-- playerMeta already correctly show 83 (that write succeeded independently).

update public.scores
set score = 83, achieved_at = now(), updated_at = now()
where owner_id = 'ecc4caae-abe9-497b-9fff-44d6017a0989'
  and game_id = 'snake'
  and week = '2026-08-16';
