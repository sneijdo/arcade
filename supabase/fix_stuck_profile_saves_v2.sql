-- Isolated re-run/diagnostic for fix_stuck_profile_saves.sql — the original didn't seem to take
-- (both playerMeta rows still show the old bestReaction value on re-check). Run each statement
-- ONE AT A TIME and note the "UPDATE N" row count Supabase prints after each — that tells us
-- whether the WHERE clause is even matching anything, rather than guessing.

-- 1) Does the row exist and what does it currently hold?
select key, value->>'bestReaction' as best_reaction, updated_at
from public.kv
where shared = true
  and key in ('playerMeta:7afeb7ea-6656-4030-90bd-545d8873047c', 'playerMeta:6ae6eb08-ec49-43dc-aa69-0dee5b5479b1');

-- 2) The actual fix — run this next and note "UPDATE N":
update public.kv
set value = (value - 'bestReaction') || jsonb_build_object('updated_at_marker', now()::text)
where shared = true
  and key in ('playerMeta:7afeb7ea-6656-4030-90bd-545d8873047c', 'playerMeta:6ae6eb08-ec49-43dc-aa69-0dee5b5479b1');

-- 3) Same for the private profile rows (can't be read back outside the SQL editor — no select
-- policy for anon/authenticated on shared=false rows belonging to someone else):
update public.kv
set value = value - 'bestReaction'
where shared = false
  and key = 'profile'
  and owner_id in ('7afeb7ea-6656-4030-90bd-545d8873047c', '6ae6eb08-ec49-43dc-aa69-0dee5b5479b1');

-- 4) Verify (1) again — bestReaction should now be null/absent for both rows:
select key, value->>'bestReaction' as best_reaction, value ? 'updated_at_marker' as marker_present
from public.kv
where shared = true
  and key in ('playerMeta:7afeb7ea-6656-4030-90bd-545d8873047c', 'playerMeta:6ae6eb08-ec49-43dc-aa69-0dee5b5479b1');
