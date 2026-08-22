-- ARCADE — player bug reports (run once, after schema.sql).
-- Run this in your Supabase project's SQL editor (Database > SQL Editor > New query).
--
-- A simple inbox for "report a bug" (see the 🐛 button in the header, src/bugReport.ts).
-- Deliberately no select policy for any client role — reports are write-only from the
-- app's side; read them yourself directly in the Supabase table editor or via
-- `select * from public.bug_reports order by created_at desc;` in the SQL editor.

create table if not exists public.bug_reports (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  message text not null check (char_length(message) between 1 and 2000),
  page text,
  created_at timestamptz not null default now()
);

alter table public.bug_reports enable row level security;

drop policy if exists "bug_reports_insert_own" on public.bug_reports;
create policy "bug_reports_insert_own"
  on public.bug_reports for insert
  with check (owner_id = auth.uid());
