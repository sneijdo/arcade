-- ARCADE — wipe all Quiz Duel records (every player).
-- Run ONCE in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Irreversible. Resets Quiz Duel back to a clean slate for everyone. Does NOT
-- touch XP/level, other games' scores, or any non-duel profile data.
--
-- What this touches:
--   - `duel_challenges` rows (see supabase/schema_duels.sql): every match/invite,
--     any status (pending/accepted/declined/expired/cancelled/completed) — deleted.
--   - `profile` rows (private, one per player): duelWins/duelLosses/duelDraws
--     reset to 0. Everything else (XP, other games' bests, cosmetics, etc.)
--     left untouched.
--   - `playerMeta:*` rows (shared public mirror of the same three fields, see
--     PlayerMeta in src/types.ts): duelWins/duelLosses/duelDraws reset to 0.
--   - `activity` rows with kind = 'duel_result': deleted, so the live feed
--     doesn't keep showing old duel results. 'session'/'personal_best' rows
--     for other games are untouched.

-- 1) Wipe all duel match/invite history.
delete from public.duel_challenges;

-- 2) Zero out every player's private duel counters.
update public.kv
set value = value || jsonb_build_object('duelWins', 0, 'duelLosses', 0, 'duelDraws', 0)
where shared = false and key = 'profile';

-- 3) ...and their shared public mirror (Leaderboard's Quiz Duel tab, player-profile pages).
update public.kv
set value = value || jsonb_build_object('duelWins', 0, 'duelLosses', 0, 'duelDraws', 0)
where shared = true and key like 'playerMeta:%';

-- 4) Remove duel results from the live Activity feed.
delete from public.activity where kind = 'duel_result';
