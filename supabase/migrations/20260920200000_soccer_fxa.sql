-- FXA Sports soccer (LeagueLab). Public schedules; writes via service role only.

create table public.soccer_matches (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'fxa',
  league_id int not null,
  league_name text not null,
  division text,
  team_id int not null,
  canonical_team text not null,
  played_at timestamptz not null,
  venue text,
  field text,
  opponent_name text not null,
  home_away text,
  royals_score int,
  opponent_score int,
  status text not null default 'scheduled',
  gamerecap_url text,
  unique (league_id, team_id, opponent_name, played_at)
);

create table public.soccer_standings (
  id uuid primary key default gen_random_uuid(),
  league_id int not null,
  team_id int,
  division text not null,
  team_name text not null,
  rank int,
  wins int,
  losses int,
  draws int,
  point_diff int,
  ranking_points int,
  captured_at timestamptz default now()
);

create table public.soccer_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz default now(),
  finished_at timestamptz,
  league_id int,
  matches_upserted int default 0,
  status text default 'ok',
  error text
);

create index soccer_matches_team_played_idx on public.soccer_matches (canonical_team, played_at desc);
create index soccer_standings_league_div_idx on public.soccer_standings (league_id, division, rank);

alter table public.soccer_matches enable row level security;
alter table public.soccer_standings enable row level security;
alter table public.soccer_sync_runs enable row level security;

create policy soccer_matches_public_read on public.soccer_matches for select to anon, authenticated using (true);
create policy soccer_standings_public_read on public.soccer_standings for select to anon, authenticated using (true);
create policy soccer_sync_runs_public_read on public.soccer_sync_runs for select to anon, authenticated using (true);
