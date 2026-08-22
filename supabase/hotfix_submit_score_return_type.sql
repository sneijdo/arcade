-- ARCADE — HOTFIX: submit_score has been silently rejecting every score since deploy.
-- Run this NOW in the Supabase SQL Editor (Project > SQL Editor > New query).
--
-- Bug: submit_score was declared `returns table(accepted boolean, week date, score numeric)`.
-- Postgres turns those output-column names into PL/pgSQL variables in scope for the whole
-- function body — and `week`/`score` are also real column names on public.scores, so every
-- call errored with "column reference \"week\" is ambiguous" (42702). The client only ever
-- checks for an error and ignores the return value, so nothing actually needed that table
-- shape — this switches it to a plain boolean. Confirmed via a direct RPC call against
-- production before writing this fix.
--
-- The function's actual validation logic (bounds, rate limit, atomic improvement check) is
-- unchanged — this only fixes the return type that was breaking every single call.

drop function if exists public.submit_score(text, numeric);

create or replace function public.submit_score(p_game_id text, p_score numeric)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bounds record;
  v_today date;
  v_dow int;
  v_week date;
  v_last timestamptz;
  v_existing numeric;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_score is null or p_score <> p_score then
    raise exception 'invalid score';
  end if;

  select * into v_bounds from public.score_bounds where game_id = p_game_id;
  if not found then
    raise exception 'unknown game_id: %', p_game_id;
  end if;
  if p_score < v_bounds.min_value or p_score > v_bounds.max_value then
    raise exception 'score % out of plausible range [%, %] for %', p_score, v_bounds.min_value, v_bounds.max_value, p_game_id;
  end if;

  insert into public.score_rate_limit (owner_id, last_submit_at)
  values (v_uid, now())
  on conflict (owner_id) do update
    set last_submit_at = excluded.last_submit_at
    where public.score_rate_limit.last_submit_at < now() - interval '1 second'
  returning last_submit_at into v_last;
  if v_last is null then
    raise exception 'too many submissions — slow down';
  end if;

  v_today := (now() at time zone 'utc')::date;
  v_dow := extract(dow from v_today)::int;
  v_week := v_today - v_dow;

  select s.score into v_existing from public.scores s
    where s.owner_id = v_uid and s.game_id = p_game_id and s.week = v_week
    for update;

  if v_existing is null
     or (v_bounds.direction = 'asc' and p_score < v_existing)
     or (v_bounds.direction = 'desc' and p_score > v_existing) then
    insert into public.scores (owner_id, game_id, week, score, achieved_at, updated_at)
    values (v_uid, p_game_id, v_week, p_score, now(), now())
    on conflict (owner_id, game_id, week)
    do update set score = excluded.score, achieved_at = now(), updated_at = now();
    return true;
  else
    return false;
  end if;
end;
$$;

grant execute on function public.submit_score(text, numeric) to authenticated;
