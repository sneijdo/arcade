-- ARCADE — Friends system schema (run once, after schema.sql).
-- Run this in your Supabase project's SQL editor (Database > SQL Editor > New query).
--
-- Two real relational tables (not the generic `kv` store — friend search
-- and requests genuinely need proper queries/joins, unlike simple
-- get/set/list state).

-- Public, searchable directory of just {id, name} — separate from the
-- private profile (XP/history/achievements) stored in `kv`, which stays
-- readable only by its owner. Kept in sync by the client whenever a
-- profile is created.
create table if not exists public.public_profiles (
  id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  updated_at timestamptz not null default now()
);
alter table public.public_profiles enable row level security;

drop policy if exists "public_profiles_select_all" on public.public_profiles;
create policy "public_profiles_select_all"
  on public.public_profiles for select
  using (true);

drop policy if exists "public_profiles_insert_own" on public.public_profiles;
create policy "public_profiles_insert_own"
  on public.public_profiles for insert
  with check (id = auth.uid());

drop policy if exists "public_profiles_update_own" on public.public_profiles;
create policy "public_profiles_update_own"
  on public.public_profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Friendships: a directed request row that becomes 'accepted' once the
-- addressee approves it. Either party can delete a row (cancel a pending
-- request, decline, or unfriend).
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id)
);
alter table public.friendships enable row level security;

drop policy if exists "friendships_select_own" on public.friendships;
create policy "friendships_select_own"
  on public.friendships for select
  using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists "friendships_insert_own" on public.friendships;
create policy "friendships_insert_own"
  on public.friendships for insert
  with check (requester_id = auth.uid() and requester_id <> addressee_id);

drop policy if exists "friendships_update_addressee_accepts" on public.friendships;
create policy "friendships_update_addressee_accepts"
  on public.friendships for update
  using (addressee_id = auth.uid())
  with check (addressee_id = auth.uid());

drop policy if exists "friendships_delete_own" on public.friendships;
create policy "friendships_delete_own"
  on public.friendships for delete
  using (requester_id = auth.uid() or addressee_id = auth.uid());
