-- ARCADE — full competitive reset, KEEPING XP and shop purchases.
-- Run ONCE in the Supabase SQL Editor (Project > SQL Editor > New query),
-- AFTER schema_scores.sql and cleanup_score_bounds.sql have already been run.
-- Irreversible.
--
-- Why: everything found in the recent audit (forged scores, no server
-- validation, race conditions) means every score/rank/Hall-of-Fame record set
-- before today's fix can't be trusted. This resets the whole competitive side
-- back to a clean slate under the new validated system, while explicitly
-- keeping what players earned/bought that isn't in question: XP, level, and
-- every owned/equipped cosmetic (avatars, frames, titles, name effects, sound
-- packs, taunts). This is the same shape as the existing reset_sweep.sql in
-- this folder, except xp/xpBalance are deliberately left untouched this time.
--
-- What this touches:
--   - `public.scores` (the validated leaderboard, see schema_scores.sql): every
--     row deleted.
--   - `kv` rows with key like 'lb:%' or 'hof:%' (shared): deleted — belt and
--     suspenders, should already be empty/cleaned up by cleanup_score_bounds.sql.
--   - `public.duel_challenges` (see schema_duels.sql): every match/invite
--     deleted, same as reset_quiz_duel.sql does on its own.
--   - `profile` rows (private, one per player): bestReaction, bestAvg,
--     sessionsPlayed, history, bestScores, currentStreak, longestStreak,
--     lastPlayedDate, dailyChallengeDate, hofCheckedThroughWeek,
--     unlockedAchievements, unlockedBadges, duelWins/Losses/Draws, and
--     duelRating (back to DUEL_RATING_DEFAULT = 1000, see src/state.ts) are
--     reset. Achievements/badges reset alongside scores since a good few of
--     them are literally score/rank-based and may have been earned off a
--     forged number — but any XP they already paid out stays, per instruction.
--   - `playerMeta:*` rows (shared public mirror of the same fields): same
--     fields reset, so player-profile pages/leaderboards don't keep showing
--     stale pre-reset numbers.
--   - Left completely untouched: xp, xpBalance, unlockedAvatars/Titles/Frames/
--     NameEffects/SoundPacks/Taunts, every equipped* cosmetic, name, id, muted,
--     referredBy, referralRewardsClaimed. The live Activity feed (public.activity)
--     is also left alone — kept as historical record, same as every other
--     reset script in this folder does.

-- 1) The new validated leaderboard table — wipe every row.
truncate table public.scores;

-- 2) Belt-and-suspenders: any leftover shared kv rows from the old scheme.
delete from public.kv
where shared = true
  and (key like 'lb:%' or key like 'hof:%');

-- 3) Quiz Duel match/invite history.
delete from public.duel_challenges;

-- 4) Private profile rows — reset competitive/engagement fields, leave XP and
-- every cosmetic/purchase field untouched.
update public.kv
set value = value || jsonb_build_object(
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
  'unlockedBadges', '[]'::jsonb,
  'duelWins', 0,
  'duelLosses', 0,
  'duelDraws', 0,
  'duelRating', 1000
)
where key = 'profile' and shared = false;

-- 5) ...and their shared public mirror (playerMeta), same field set minus
-- history/lastPlayedDate/dailyChallengeDate/hofCheckedThroughWeek, which
-- PlayerMeta never carried in the first place (see src/types.ts).
update public.kv
set value = value || jsonb_build_object(
  'bestReaction', null,
  'bestAvg', null,
  'sessionsPlayed', 0,
  'bestScores', '{}'::jsonb,
  'currentStreak', 0,
  'longestStreak', 0,
  'unlockedAchievements', '[]'::jsonb,
  'unlockedBadges', '[]'::jsonb,
  'duelWins', 0,
  'duelLosses', 0,
  'duelDraws', 0,
  'duelRating', 1000
)
where key like 'playerMeta:%' and shared = true;
