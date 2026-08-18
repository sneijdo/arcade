-- ARCADE — fix known leaderboard ties that were awarded to the wrong player.
-- Run ONCE in the Supabase SQL Editor (Project > SQL Editor > New query).
--
-- Leaderboard entries never recorded *when* a score was set (see LeaderboardEntry
-- in src/types.ts before this fix), so a tie was being broken by incidental row
-- order instead of who actually got there first. The app code now stamps a `ts`
-- (epoch ms) on every genuine personal best and breaks ties by it (see
-- pushLeaderboardEntry/readLeaderboard in src/state.ts) — but that only takes
-- effect going forward. This backfills `ts` on the known existing tied rows using
-- the real moments from the append-only activity log (public.activity).

-- 1) Drop Zone, 4000 (the game's cap) — Linnet vs Schwan.
--   Linnet (7afeb7ea-6656-4030-90bd-545d8873047c): 2026-08-17T20:25:07Z → 1786998307238
--   Schwan (ecc4caae-abe9-497b-9fff-44d6017a0989): 2026-08-18T09:21:06Z → 1787044866772
-- Linnet got there first, so this restores her as the rightful #1.

update public.kv
set value = jsonb_set(value, '{ts}', '1786998307238'::jsonb)
where shared = true
  and owner_id = '7afeb7ea-6656-4030-90bd-545d8873047c'
  and key = 'lb:dropzone:2026-08-16:7afeb7ea-6656-4030-90bd-545d8873047c';

update public.kv
set value = jsonb_set(value, '{ts}', '1787044866772'::jsonb)
where shared = true
  and owner_id = 'ecc4caae-abe9-497b-9fff-44d6017a0989'
  and key = 'lb:dropzone:2026-08-16:ecc4caae-abe9-497b-9fff-44d6017a0989';

-- 2) Color Match, 97% — Schwan vs Sneijdo.
--   Schwan (ecc4caae-abe9-497b-9fff-44d6017a0989):  2026-08-16T19:02:06Z → 1786906926489
--   Sneijdo (6ae6eb08-ec49-43dc-aa69-0dee5b5479b1): 2026-08-18T09:02:01Z → 1787043721202
-- Schwan got there first, so this keeps/restores him as the rightful #1.

update public.kv
set value = jsonb_set(value, '{ts}', '1786906926489'::jsonb)
where shared = true
  and owner_id = 'ecc4caae-abe9-497b-9fff-44d6017a0989'
  and key = 'lb:color:2026-08-16:ecc4caae-abe9-497b-9fff-44d6017a0989';

update public.kv
set value = jsonb_set(value, '{ts}', '1787043721202'::jsonb)
where shared = true
  and owner_id = '6ae6eb08-ec49-43dc-aa69-0dee5b5479b1'
  and key = 'lb:color:2026-08-16:6ae6eb08-ec49-43dc-aa69-0dee5b5479b1';

-- (Number Rush was checked too, but Bomadsen has since outright beaten it with 65 —
-- no longer a tie, nothing to backfill there.)

-- 3) Merge, 512 (this week's high tile) — Sbobolo vs Linnet.
--   Sbobolo (0819c62b-3fce-418b-b9ae-b65861777262): no Merge activity-log entry at all
--     (personal_best or otherwise) despite the log running continuously since
--     2026-08-16T15:30:22Z — he set 512 before that window started, so a sentinel
--     just ahead of it is used below (exact moment unknown, only that it's earlier).
--   Linnet (7afeb7ea-6656-4030-90bd-545d8873047c): 2026-08-17T21:06:37Z → 1787000797948
-- Sbobolo got there first, so this makes him the rightful #1.

update public.kv
set value = jsonb_set(value, '{ts}', '1786838400000'::jsonb)
where shared = true
  and owner_id = '0819c62b-3fce-418b-b9ae-b65861777262'
  and key = 'lb:merge:2026-08-16:0819c62b-3fce-418b-b9ae-b65861777262';

update public.kv
set value = jsonb_set(value, '{ts}', '1787000797948'::jsonb)
where shared = true
  and owner_id = '7afeb7ea-6656-4030-90bd-545d8873047c'
  and key = 'lb:merge:2026-08-16:7afeb7ea-6656-4030-90bd-545d8873047c';
