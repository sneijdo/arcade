-- ARCADE — adds name-effect + taunt support to the live activity feed.
-- Run ONCE in the Supabase SQL Editor (Project > SQL Editor > New query), after schema_activity.sql.
--
-- name_effect: snapshot of the equipped NAME_EFFECTS id (see shop.ts) at push time, same
-- denormalization reasoning as the existing avatar/frame columns.
-- taunt: a TAUNTS id (see shop.ts), only set on the specific activity row that took over a
-- game's all-time #1 spot or won a Quiz Duel, and only if the player had one equipped (see
-- finishGameSession/finishDuelSession in src/state.ts). Resolved to display text client-side
-- via findTaunt() at render time, same pattern as avatar/frame ids.

alter table public.activity add column if not exists name_effect text;
alter table public.activity add column if not exists taunt text;
