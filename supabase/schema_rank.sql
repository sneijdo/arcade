-- ARCADE — server-side rank lookup (run once, after schema_scores.sql).
-- Run this in your Supabase project's SQL editor (Database > SQL Editor > New query).
--
-- Why: checkAchievements() and finishGameSession() (src/state.ts) used to find "what rank
-- is this player" by pulling a game's ENTIRE leaderboard (every row, plus a batched
-- playerMeta lookup for names/avatars nobody needed) just to findIndex() one id out of it —
-- for checkAchievements, once per implemented game, every single session. rank_for() does
-- the same computation as a single window-function query against public.scores directly,
-- with no meta fetch at all (a rank number never needed anyone's name/avatar).

-- security definer: score_bounds has RLS enabled with no select policy for normal roles
-- (only submit_score's own SECURITY DEFINER lookup could see it) — without this, the
-- direction lookup below silently sees zero rows, v_direction stays null, and the function
-- returns null for every call regardless of whether a score actually exists. Confirmed live
-- against production before writing this fix.
create or replace function public.rank_for(p_game_id text, p_owner_id uuid, p_week date)
returns int
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_direction text;
  v_rank int;
begin
  select direction into v_direction from public.score_bounds where game_id = p_game_id;
  if v_direction is null then
    return null;
  end if;

  if v_direction = 'asc' then
    select r into v_rank from (
      select owner_id, rank() over (order by score asc) as r
      from public.scores
      where game_id = p_game_id and week = p_week
    ) ranked
    where owner_id = p_owner_id;
  else
    select r into v_rank from (
      select owner_id, rank() over (order by score desc) as r
      from public.scores
      where game_id = p_game_id and week = p_week
    ) ranked
    where owner_id = p_owner_id;
  end if;

  return v_rank;
end;
$$;

grant execute on function public.rank_for(text, uuid, date) to authenticated, anon;
