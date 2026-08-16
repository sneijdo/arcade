-- ARCADE — one-time backfill for PlayerMeta's progress fields.
-- Run ONCE in the Supabase SQL Editor (Project > SQL Editor > New query).
--
-- The player-profile page (src/pages/playerProfile.ts) reads xp/bestScores/
-- achievements/badges from each player's public `playerMeta:<id>` row. Those
-- fields were only added to PlayerMeta after that row already existed for
-- every active player, so anyone who hasn't triggered a saveProfile() since
-- that deploy still has an old-shape playerMeta row — their public profile
-- page shows 0/level 1 even though their real (private) profile is fine.
--
-- This copies the missing fields from each player's private `profile` row
-- into their existing `playerMeta:<id>` row in one pass, so it's correct
-- immediately instead of waiting for that player to next open the app.
-- Safe to re-run — it only ever overwrites these specific keys.

update public.kv as meta
set
  value = meta.value || jsonb_build_object(
    'xp', profile.value->'xp',
    'bestReaction', profile.value->'bestReaction',
    'bestScores', profile.value->'bestScores',
    'sessionsPlayed', profile.value->'sessionsPlayed',
    'currentStreak', profile.value->'currentStreak',
    'longestStreak', profile.value->'longestStreak',
    'unlockedAchievements', profile.value->'unlockedAchievements',
    'unlockedBadges', profile.value->'unlockedBadges'
  ),
  updated_at = now()
from public.kv as profile
where meta.shared = true
  and meta.key like 'playerMeta:%'
  and profile.shared = false
  and profile.key = 'profile'
  and profile.owner_id = meta.owner_id;
