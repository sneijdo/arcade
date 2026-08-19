-- ARCADE — reset Sneijdo's Odd One Out & Swerve pre-launch test scores.
-- Run ONCE in the Supabase SQL Editor (Project > SQL Editor > New query).
--
-- Sneijdo (owner_id 6ae6eb08-ec49-43dc-aa69-0dee5b5479b1) playtested both
-- brand-new games right after each shipped. This clears the resulting
-- leaderboard entries, the personal-best fields those plays wrote into the
-- profile, and the matching Activity-feed rows — just for oddoneout and
-- swerve, just for this one player — so real competitive scores start from
-- a clean slate instead of racing against test data. No one else has any
-- leaderboard entries for these two games yet, so nothing else is touched.

-- 1) Remove the shared leaderboard entries (any week, in case testing spanned a boundary).
delete from public.kv
where shared = true
  and owner_id = '6ae6eb08-ec49-43dc-aa69-0dee5b5479b1'
  and (key like 'lb:oddoneout:%' or key like 'lb:swerve:%');

-- 2) Clear the personal-best fields from the private profile (so the next play
-- is treated as a fresh best instead of comparing against the old test score).
update public.kv
set value = value #- '{bestScores,oddoneout}'::text[] #- '{bestScores,swerve}'::text[]
where shared = false
  and key = 'profile'
  and owner_id = '6ae6eb08-ec49-43dc-aa69-0dee5b5479b1';

-- 3) ...and from its public mirror (see PlayerMeta in src/types.ts), so the
-- read-only player-profile page doesn't show the old test bests either.
update public.kv
set value = value #- '{bestScores,oddoneout}'::text[] #- '{bestScores,swerve}'::text[]
where shared = true
  and key = 'playerMeta:6ae6eb08-ec49-43dc-aa69-0dee5b5479b1';

-- 4) Remove the matching rows from the live Activity feed.
delete from public.activity
where owner_id = '6ae6eb08-ec49-43dc-aa69-0dee5b5479b1'
  and game_id in ('oddoneout', 'swerve');
