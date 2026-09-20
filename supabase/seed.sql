-- Public catalog seed. Records with metadata.demo=true are invented product
-- demonstrations and must not be presented as current real-world results.

insert into public.seasons (id, name, starts_on, ends_on, status) values
  ('10000000-0000-0000-0000-000000000001', 'Fall 2026', '2026-09-01', '2026-11-30', 'active'),
  ('10000000-0000-0000-0000-000000000002', '2026 Cricket', '2026-04-01', '2026-10-31', 'active');

insert into public.programs (
  id, sport_id, season_id, slug, title, audience_label, description,
  min_age, max_age, session_count, starts_at, ends_at,
  registration_open, is_published, metadata
) values
(
  '20000000-0000-0000-0000-000000000001',
  (select id from public.sports where code = 'soccer'),
  '10000000-0000-0000-0000-000000000001',
  'fall-soccer-training-2026',
  'Fall Soccer Training',
  'Ages 3–16',
  'Twelve fall soccer training sessions for youth players.',
  3, 16, 12, '2026-09-13 16:00:00-04', '2026-11-22 17:15:00-05',
  true, true,
  '{"source":"Nova Royals website","factual":true}'::jsonb
),
(
  '20000000-0000-0000-0000-000000000002',
  (select id from public.sports where code = 'soccer'),
  '10000000-0000-0000-0000-000000000001',
  'womens-soccer', 'Women''s Soccer', 'Adult players',
  'Competitive, welcoming football for women.', null, null, null, null, null,
  true, true, '{"demo":true}'::jsonb
),
(
  '20000000-0000-0000-0000-000000000003',
  (select id from public.sports where code = 'soccer'),
  '10000000-0000-0000-0000-000000000001',
  'mens-soccer', 'Men''s Soccer', 'Adult players',
  'League and tournament football.', null, null, null, null, null,
  true, true, '{"demo":true}'::jsonb
),
(
  '20000000-0000-0000-0000-000000000004',
  (select id from public.sports where code = 'soccer'),
  '10000000-0000-0000-0000-000000000001',
  'veterans-35', 'Veterans 35+', 'Players 35+',
  'Competitive play for experienced players.', 35, null, null, null, null,
  false, true, '{"demo":true}'::jsonb
),
(
  '20000000-0000-0000-0000-000000000005',
  (select id from public.sports where code = 'soccer'),
  '10000000-0000-0000-0000-000000000001',
  'recreational-soccer', 'Recreational Soccer', 'Adults · all levels',
  'Flexible community open play.', null, null, null, null, null,
  true, true, '{"demo":true}'::jsonb
),
(
  '20000000-0000-0000-0000-000000000006',
  (select id from public.sports where code = 'soccer'),
  '10000000-0000-0000-0000-000000000001',
  'travel-competitive', 'Travel / Competitive', 'Youth players',
  'A progressive competitive player pathway.', null, null, null, null, null,
  false, true, '{"demo":true}'::jsonb
),
(
  '20000000-0000-0000-0000-000000000007',
  (select id from public.sports where code = 'cricket'),
  '10000000-0000-0000-0000-000000000002',
  'ccpl-cricket', 'CCPL Cricket', 'Adult players',
  'Royals cricket participation, squad, fixtures and results.', null, null, null, null, null,
  true, true, '{"factual_reference":true,"demo_details":true}'::jsonb
);

insert into public.program_pricing (
  program_id, label, amount_cents, pricing_type, applies_from_participant_number
) values
  ('20000000-0000-0000-0000-000000000001', 'First child', 12000, 'standard', 1),
  ('20000000-0000-0000-0000-000000000001', 'Additional sibling', 6000, 'sibling', 2);

insert into public.competitions (
  id, sport_id, season_id, title, competition_type, organizer_name,
  is_external, description, format, starts_on, ends_on, location_name,
  status, is_published, bracket_config
) values
(
  '30000000-0000-0000-0000-000000000001',
  (select id from public.sports where code = 'soccer'),
  '10000000-0000-0000-0000-000000000001',
  'Men''s Open 8v8', 'league', 'External league · fixtures maintained in ROYALS',
  true, 'Current Nova Royals AC men''s open 8v8 schedule. ROYALS is not the official league operator.', '8v8 Sunday evenings',
  '2026-09-13', '2026-11-15', 'Fairfax County, VA', 'active', true, '{}'::jsonb
),
(
  '30000000-0000-0000-0000-000000000002',
  (select id from public.sports where code = 'soccer'),
  '10000000-0000-0000-0000-000000000001',
  'Royals Autumn Cup · Demo', 'tournament', 'Nova Royals · Demo concept',
  false, 'Invented tournament product demonstration.', '7v7 groups and knockout',
  '2026-10-24', '2026-10-25', 'Fairfax, VA', 'registration_open', true,
  '{"demo":true,"stages":["group","semifinal","final"]}'::jsonb
),
(
  '30000000-0000-0000-0000-000000000003',
  (select id from public.sports where code = 'cricket'),
  '10000000-0000-0000-0000-000000000002',
  'CCPL · Manassas1', 'league', 'Capital Cricket Premier League',
  true, 'External T20 league. Club fixtures and published scorecards only. Aug 16 vs Global Warriors has no recorded result.', 'T20 · Manassas1 · 8 matches',
  '2026-08-02', '2026-09-26', 'Manassas, VA', 'active', true, '{}'::jsonb
);

insert into public.teams (id, sport_id, name, short_name, audience_label) values
  ('40000000-0000-0000-0000-000000000001', (select id from public.sports where code = 'soccer'), 'Nova Royals AC', 'ROYALS', 'Men''s Open 8v8'),
  ('40000000-0000-0000-0000-000000000002', (select id from public.sports where code = 'soccer'), 'Nova Royals Women · Demo', 'ROYALS W', 'Adult women'),
  ('40000000-0000-0000-0000-000000000003', (select id from public.sports where code = 'cricket'), 'Nova Royals Cricket', 'ROYALS CC', 'Adult · CCPL T20'),

insert into public.events (
  sport_id, program_id, competition_id, event_type, title, home_team_id,
  external_opponent_name, starts_at, venue_name, venue_address, status,
  home_score, away_score, source_label, is_published
) values
(
  (select id from public.sports where code = 'soccer'),
  '20000000-0000-0000-0000-000000000001', null, 'training',
  'Fall Soccer Training · Session 1', null, null,
  '2026-09-13 16:00:00-04', 'Royals Training Field · Demo', 'Fairfax, VA',
  'scheduled', null, null, 'Demo field details', true
),
(
  (select id from public.sports where code = 'soccer'),
  null, '30000000-0000-0000-0000-000000000001', 'league_match',
  'Nova Royals AC vs rundown fc', '40000000-0000-0000-0000-000000000001',
  'rundown fc', '2026-09-13 22:00:00-04', 'Nottoway Park · Field 4B', 'Vienna, VA',
  'scheduled', null, null, 'Club-provided fixture', true
),
(
  (select id from public.sports where code = 'soccer'),
  null, '30000000-0000-0000-0000-000000000001', 'league_match',
  'Nova Royals AC vs Fades FC', '40000000-0000-0000-0000-000000000001',
  'Fades FC', '2026-09-20 22:00:00-04', 'Nottoway Park · Field 4A', 'Vienna, VA',
  'scheduled', null, null, 'Club-provided fixture', true
),
(
  (select id from public.sports where code = 'soccer'),
  null, '30000000-0000-0000-0000-000000000001', 'league_match',
  'Nova Royals AC vs UNC International Academy', '40000000-0000-0000-0000-000000000001',
  'UNC International Academy', '2026-10-04 22:00:00-04', 'EC Lawrence Park · Field 3A', 'Chantilly, VA',
  'scheduled', null, null, 'Club-provided fixture', true
),
(
  (select id from public.sports where code = 'soccer'),
  null, '30000000-0000-0000-0000-000000000001', 'league_match',
  'Nova Royals AC vs Ref Do Something FC', '40000000-0000-0000-0000-000000000001',
  'Ref Do Something FC', '2026-10-11 21:00:00-04', 'EC Lawrence Park · Field 3A', 'Chantilly, VA',
  'scheduled', null, null, 'Club-provided fixture', true
),
(
  (select id from public.sports where code = 'soccer'),
  null, '30000000-0000-0000-0000-000000000001', 'league_match',
  'Nova Royals AC vs UNC International Academy', '40000000-0000-0000-0000-000000000001',
  'UNC International Academy', '2026-10-18 21:20:00-04', 'Nottoway Park · Field 4B', 'Vienna, VA',
  'scheduled', null, null, 'Club-provided fixture', true
),
(
  (select id from public.sports where code = 'soccer'),
  null, '30000000-0000-0000-0000-000000000001', 'league_match',
  'Nova Royals AC vs Fades FC', '40000000-0000-0000-0000-000000000001',
  'Fades FC', '2026-11-01 21:00:00-05', 'EC Lawrence Park · Field 3B', 'Chantilly, VA',
  'scheduled', null, null, 'Club-provided fixture', true
),
(
  (select id from public.sports where code = 'soccer'),
  null, '30000000-0000-0000-0000-000000000001', 'league_match',
  'Nova Royals AC vs Ref Do Something FC', '40000000-0000-0000-0000-000000000001',
  'Ref Do Something FC', '2026-11-08 20:10:00-05', 'EC Lawrence Park · Field 3B', 'Chantilly, VA',
  'scheduled', null, null, 'Club-provided fixture', true
),
(
  (select id from public.sports where code = 'soccer'),
  null, '30000000-0000-0000-0000-000000000001', 'league_match',
  'Nova Royals AC vs rundown fc', '40000000-0000-0000-0000-000000000001',
  'rundown fc', '2026-11-15 20:10:00-05', 'Nottoway Park · Field 4B', 'Vienna, VA',
  'scheduled', null, null, 'Club-provided fixture', true
),
(
  (select id from public.sports where code = 'cricket'),
  null, '30000000-0000-0000-0000-000000000003', 'league_match',
  'NOVA Royals vs Golmaal Aces', '40000000-0000-0000-0000-000000000003',
  'Golmaal Aces', '2026-08-02 11:45:00-04', 'Manassas cricket fields', 'Manassas, VA',
  'completed', null, null, 'Lost by 41 runs · Aces 112/6 · Royals 71/10', true
),
(
  (select id from public.sports where code = 'cricket'),
  null, '30000000-0000-0000-0000-000000000003', 'league_match',
  'NOVA Royals vs Blitz', '40000000-0000-0000-0000-000000000003',
  'Blitz', '2026-08-08 11:45:00-04', 'Manassas cricket fields', 'Manassas, VA',
  'completed', null, null, 'Lost by 6 wickets · Royals 69/10 · Blitz 75/4', true
),
(
  (select id from public.sports where code = 'cricket'),
  null, '30000000-0000-0000-0000-000000000003', 'league_match',
  'NOVA Royals vs Global Warriors', '40000000-0000-0000-0000-000000000003',
  'Global Warriors', '2026-08-16 11:45:00-04', 'Manassas cricket fields', 'Manassas, VA',
  'completed', null, null, 'No result recorded · scorecard unpublished', true
),
(
  (select id from public.sports where code = 'cricket'),
  null, '30000000-0000-0000-0000-000000000003', 'league_match',
  'NOVA Royals vs Galaxy Legends', '40000000-0000-0000-0000-000000000003',
  'Galaxy Legends', '2026-08-22 11:45:00-04', 'Manassas cricket fields', 'Manassas, VA',
  'completed', null, null, 'Won by 6 wickets · Legends 56/10 · Royals 57/4', true
),
(
  (select id from public.sports where code = 'cricket'),
  null, '30000000-0000-0000-0000-000000000003', 'league_match',
  'NOVA Royals vs Statesmen', '40000000-0000-0000-0000-000000000003',
  'Statesmen', '2026-08-30 11:45:00-04', 'Manassas cricket fields', 'Manassas, VA',
  'completed', null, null, 'Won by 25 runs · Royals 112/10 · Statesmen all out 18.3 ov', true
),
(
  (select id from public.sports where code = 'cricket'),
  null, '30000000-0000-0000-0000-000000000003', 'league_match',
  'NOVA Royals vs Orange Army', '40000000-0000-0000-0000-000000000003',
  'Orange Army', '2026-09-12 11:45:00-04', 'Manassas cricket fields', 'Manassas, VA',
  'completed', null, null, 'Won by 20 runs · Royals 87/10 · Orange Army 67/8', true
),
(
  (select id from public.sports where code = 'cricket'),
  null, '30000000-0000-0000-0000-000000000003', 'league_match',
  'LM Tigers vs NOVA Royals', '40000000-0000-0000-0000-000000000003',
  'LM Tigers', '2026-09-20 11:45:00-04', 'Manassas Field 2', 'Manassas, VA',
  'scheduled', null, null, 'CCPL T20 Manassas1 · away', true
),
(
  (select id from public.sports where code = 'cricket'),
  null, '30000000-0000-0000-0000-000000000003', 'league_match',
  'NOVA Royals vs Shockers', '40000000-0000-0000-0000-000000000003',
  'Shockers', '2026-09-26 11:45:00-04', 'Manassas Field 1', 'Manassas, VA',
  'scheduled', null, null, 'CCPL T20 Manassas1 · home', true
);

-- Men's Open standings are omitted until verified results exist.

