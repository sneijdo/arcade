-- ARCADE — final cleanup after the Hall of Fame duplication bug (two concurrent calls to
-- creditMyHallOfFameWins() racing — see src/state.ts's creditHofInFlight fix). Run in the
-- Supabase SQL Editor once the fixed code has been confirmed live and stable (no further growth).

-- 1) IMPORTANT — check first: has Linnet's account already SPENT any of the inflated legendary
-- slots (4 credited instead of the real 1) in the shop? Run this and eyeball the *legendary*-rarity
-- ids against art/manifest.json / src/shop.ts's AVATARS/FRAMES/TITLES/NAME_EFFECTS/SOUND_PACKS/
-- TAUNTS catalogs (ids ending things like -void, -diamond, -golden, -neon-legend, -rainbow, etc,
-- or check unlockLevel-less items). If she owns more than 1 legendary item total, some were bought
-- with slots she shouldn't have had — decide with her whether to let her keep them or roll back.
select
  value->'unlockedAvatars' as avatars,
  value->'unlockedFrames' as frames,
  value->'unlockedTitles' as titles,
  value->'unlockedNameEffects' as name_effects,
  value->'unlockedSoundPacks' as sound_packs,
  value->'unlockedTaunts' as taunts
from public.kv
where shared = false and key = 'profile' and owner_id = '7afeb7ea-6656-4030-90bd-545d8873047c';

-- 2) Reset both players' Hall of Fame tallies back to what they actually earned (see the earlier
-- manual audit against public.scores for week 2026-08-16: Linnet was #1 in aim/dropzone/reaction/
-- tactical/oddoneout/ruleswitch — 6 games, 1 dominant week; Sneijdo in pulse/tetris/wordrush — 3
-- games, below the 4-game legendary threshold).
update public.kv
set value = jsonb_build_object(
  'id', '7afeb7ea-6656-4030-90bd-545d8873047c',
  'wins', jsonb_build_object('aim', 1, 'dropzone', 1, 'reaction', 1, 'tactical', 1, 'oddoneout', 1, 'ruleswitch', 1),
  'totalWins', 6,
  'legendaryWeeks', 1
)
where shared = true and key = 'hof:7afeb7ea-6656-4030-90bd-545d8873047c';

update public.kv
set value = jsonb_build_object(
  'id', '6ae6eb08-ec49-43dc-aa69-0dee5b5479b1',
  'wins', jsonb_build_object('pulse', 1, 'tetris', 1, 'wordrush', 1),
  'totalWins', 3,
  'legendaryWeeks', 0
)
where shared = true and key = 'hof:6ae6eb08-ec49-43dc-aa69-0dee5b5479b1';

-- 3) Clear this week's (2026-08-23) reaction scores for both — they currently hold each player's
-- old ALL-TIME best (157.34ms / 156.74ms), wrongly re-submitted by the pushLeaderboardEntry bug
-- (see the "Submit the session's own score..." fix), not the real, worse run each of them actually
-- played this week (~197ms / ~384ms per the report). Deleting lets the next genuine play insert
-- fresh, now that the submission bug is fixed — a real (if worse) score should always be reflected,
-- and submit_score() would otherwise reject it as "not an improvement" over the wrongly-stored one.
delete from public.scores
where game_id = 'reaction'
  and week = '2026-08-23'
  and owner_id in ('7afeb7ea-6656-4030-90bd-545d8873047c', '6ae6eb08-ec49-43dc-aa69-0dee5b5479b1');

-- 4) Worth asking Linnet/Sneijdo to replay one reaction round each afterward so this week's
-- leaderboard actually reflects their real result instead of showing nobody.
