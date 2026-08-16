-- ARCADE — full platform reset sweep
-- Run ONCE in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Irreversible. Resets every player's records/XP/level back to fresh, but
-- KEEPS accounts and owned/equipped cosmetics (avatars, frames, titles).
--
-- What this touches:
--   - `profile` rows (private, one per player): XP, level, best scores,
--     session history, streaks, daily-challenge state, achievements and
--     badges are reset. name / id / unlockedAvatars / unlockedTitles /
--     unlockedFrames / equippedAvatar / equippedTitle / equippedFrame /
--     muted are left untouched.
--   - `lb:*` rows (shared leaderboard entries, all games/weeks): deleted.
--   - `hof:*` rows (shared Hall of Fame totals + legendary slots): deleted.
--   - `playerMeta:*` rows are left alone — they just mirror each player's
--     current name/avatar/frame/title, which aren't changing.

update public.kv
set value = value || jsonb_build_object(
  'xp', 0,
  'xpBalance', 0,
  'bestReaction', null,
  'bestAvg', null,
  'sessionsPlayed', 0,
  'history', '[]'::jsonb,
  'bestScores', '{}'::jsonb,
  'currentStreak', 0,
  'longestStreak', 0,
  'lastPlayedDate', null,
  'dailyChallengeDate', null,
  'hofCheckedThroughWeek', null,
  'unlockedAchievements', '[]'::jsonb,
  'unlockedBadges', '[]'::jsonb
)
where key = 'profile' and shared = false;

delete from public.kv where shared = true and (key like 'lb:%' or key like 'hof:%');
