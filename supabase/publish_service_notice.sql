-- ARCADE — publish (or update) the sitewide service notice banner.
-- Run in the Supabase SQL Editor (Project > SQL Editor > New query) any time you want to
-- push a new message, or edit the text of the current one.
--
-- The banner (src/serviceNotice.ts, rendered under #header on every page) reads this one
-- shared `service_notice` row from `public.kv` on app boot. No redeploy needed — editing
-- the text below and re-running this script is enough to change what every player sees.
--
-- IMPORTANT — the `id` field controls whether a player sees this as "new":
--   * Editing the text but keeping the same `id` (e.g. fixing a typo) does NOT re-show the
--     banner to anyone who already dismissed it.
--   * Changing `id` to a new value makes EVERY player see it again, even those who
--     dismissed a previous notice — use a new id whenever this is genuinely a new
--     announcement, not just a wording tweak to the current one.
-- A good default is today's date, e.g. '2026-08-19' — bump it (or append '-2') if you
-- publish more than once on the same day and want the new version to re-surface.

insert into public.kv (owner_id, shared, key, value)
values (
  '6ae6eb08-ec49-43dc-aa69-0dee5b5479b1', -- Sneijdo — see reset_sneijdo_oddoneout_swerve.sql for the same id
  true,
  'service_notice',
  jsonb_build_object(
    'id', '2026-08-22-hard-refresh',
    'text', 'Vigtigt: hvis dine rekorder ikke dukker op på leaderboardet, skyldes det højst sandsynligt at din browser stadig kører en gammel udgave af appen. Luk appen helt ned og åbn den igen, eller lav et hard refresh (Ctrl+Shift+R på PC, Cmd+Shift+R på Mac) — så er du opdateret. 🔄',
    'publishedAt', extract(epoch from now()) * 1000
  )
)
on conflict (owner_id, shared, key)
do update set value = excluded.value, updated_at = now();

-- To take the banner down entirely without publishing a replacement message, run instead:
--   delete from public.kv where shared = true and key = 'service_notice'
--     and owner_id = '6ae6eb08-ec49-43dc-aa69-0dee5b5479b1';
