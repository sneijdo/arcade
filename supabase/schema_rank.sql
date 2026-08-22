-- ARCADE — server-side rank lookup (run once, after schema_scores.sql).
-- Run this in your Supabase project's SQL editor (Database > SQL Editor > New query).
--
-- Why: checkAchievements() and finishGameSession() (src/state.ts) used to find "what rank
-- is this player" by pulling a game's ENTIRE leaderboard (every row, plus a batched
-- playerMeta lookup for names/avatars nobody needed) just to findIndex() one id out of it —
-- for checkAchievements, once per implemented game, every single session. rank_for() does
-- the same computation as a single window-function query against public.scores directly,
-- with no meta fetch at all (a rank number never needed anyone's name/avatar).

create or replace function public.rank_for(p_game_id text, p_owner_id uuid, p_week date)
returns int
language plpgsql
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
