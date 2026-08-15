-- ARCADE — password recovery schema
-- Run this once in your Supabase project's SQL editor (Database > SQL Editor > New query),
-- AFTER schema.sql. Requires the pgcrypto extension, which Supabase enables by default.
--
-- Why this exists: accounts here use a synthetic, undeliverable email
-- (username@players.arcade.internal — see src/auth.ts) specifically to avoid
-- Supabase's email rate limits. That means Supabase's normal "reset password
-- by email" flow is impossible — there's no real inbox to send to. Instead,
-- every account gets a one-time recovery code (shown once at signup, the
-- user must save it themselves) that can later be redeemed to set a new
-- password, without needing email or SMS at all.
--
-- This directly writes auth.users.encrypted_password using the same bcrypt
-- scheme Supabase's own auth server (GoTrue) uses via pgcrypto — a
-- well-known community workaround for exactly this "no email" scenario, but
-- it does touch an internal Supabase-managed table rather than a public
-- API, so treat it as "works today, not officially guaranteed forever."

create table if not exists public.recovery_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.recovery_codes enable row level security;
-- Deliberately NO select/insert/update policies here — every read/write to
-- this table happens exclusively through the two SECURITY DEFINER functions
-- below, which bypass RLS internally. That means not even the account owner
-- can query their own code_hash directly; it's write-once (well, replace)
-- and verify-only, never read back out.

-- Called once right after signup (and again after a successful recovery, to
-- issue a fresh code) while the user has an active session. Overwrites any
-- previous code for this user.
create or replace function public.set_recovery_code(p_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.recovery_codes (user_id, code_hash)
  values (auth.uid(), extensions.crypt(p_code, extensions.gen_salt('bf')))
  on conflict (user_id) do update set code_hash = excluded.code_hash, created_at = now();
end;
$$;

-- Called from the logged-out "forgot password" flow: username + the
-- recovery code shown at signup + a new password. Returns true/false so the
-- client can show a generic "wrong username or code" error either way,
-- without revealing which part was wrong or whether the username exists.
create or replace function public.redeem_recovery_code(p_username text, p_code text, p_new_password text)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_slug text;
  v_email text;
  v_user_id uuid;
  v_code_hash text;
begin
  -- Must exactly mirror usernameToEmail()'s transform in src/auth.ts:
  -- trim, lowercase, æ/å→a, ø→o, strip everything but [a-z0-9_].
  v_slug := lower(trim(p_username));
  v_slug := regexp_replace(v_slug, '[æå]', 'a', 'g');
  v_slug := regexp_replace(v_slug, 'ø', 'o', 'g');
  v_slug := regexp_replace(v_slug, '[^a-z0-9_]', '', 'g');
  v_email := v_slug || '@players.arcade.internal';

  select id into v_user_id from auth.users where email = v_email;
  if v_user_id is null then
    return false;
  end if;

  select code_hash into v_code_hash from public.recovery_codes where user_id = v_user_id;
  if v_code_hash is null then
    return false;
  end if;

  if v_code_hash <> extensions.crypt(p_code, v_code_hash) then
    return false;
  end if;

  if length(p_new_password) < 6 then
    raise exception 'password too short';
  end if;

  update auth.users
    set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
        updated_at = now()
    where id = v_user_id;

  -- Burn the used code — rotate it to an unguessable, unreachable value so
  -- it can't be redeemed twice. The client should immediately request a
  -- fresh one via set_recovery_code() once the user is signed back in.
  update public.recovery_codes
    set code_hash = extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), created_at = now()
    where user_id = v_user_id;

  return true;
end;
$$;

-- set_recovery_code needs an active session (checked inside the function);
-- redeem_recovery_code must be callable while signed out, since that's the
-- entire point of a "forgot password" flow.
grant execute on function public.set_recovery_code(text) to authenticated;
grant execute on function public.redeem_recovery_code(text, text, text) to anon, authenticated;
