-- CCPL cricket facts. Public scores; writes via service role only.

create table public.cricket_players (
  id uuid primary key default gen_random_uuid(),
  ccpl_player_id int unique,
  full_name text not null unique,
  short_name text,
  role text,
  is_captain boolean not null default false,
  is_vice_captain boolean not null default false,
  is_keeper boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.cricket_matches (
  id uuid primary key default gen_random_uuid(),
  ccpl_match_id int unique not null,
  played_at date,
  venue text,
  opponent_name text,
  home_away text,
  toss text,
  umpires text,
  result_text text,
  result_type text,
  royals_score text,
  opponent_score text,
  player_of_match text,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

create table public.cricket_innings (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.cricket_matches(id) on delete cascade,
  innings_no int not null,
  batting_side text,
  runs int,
  wickets int,
  overs text,
  extras jsonb,
  fow jsonb,
  partnerships jsonb,
  unique (match_id, innings_no)
);

create table public.cricket_batting (
  id uuid primary key default gen_random_uuid(),
  innings_id uuid not null references public.cricket_innings(id) on delete cascade,
  player_id uuid references public.cricket_players(id),
  player_name text not null,
  batting_order int,
  runs int,
  balls int,
  fours int,
  sixes int,
  dismissal text
);

create table public.cricket_bowling (
  id uuid primary key default gen_random_uuid(),
  innings_id uuid not null references public.cricket_innings(id) on delete cascade,
  player_id uuid references public.cricket_players(id),
  player_name text not null,
  overs numeric,
  maidens int,
  runs int,
  wickets int,
  wides int not null default 0,
  no_balls int not null default 0
);

create table public.cricket_balls (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.cricket_matches(id) on delete cascade,
  innings_no int not null,
  seq int not null,
  over_label text,
  batter text,
  bowler text,
  runs int,
  is_wicket boolean,
  extras text,
  commentary text,
  unique (match_id, innings_no, seq)
);

create table public.cricket_live_state (
  match_id uuid primary key references public.cricket_matches(id) on delete cascade,
  score_text text,
  batsmen jsonb,
  current_bowler text,
  updated_at timestamptz not null default now()
);

create table public.cricket_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ccpl_match_id int,
  balls_added int not null default 0,
  status text not null default 'ok',
  error text
);

create index cricket_matches_played_at_idx on public.cricket_matches (played_at desc);
create index cricket_innings_match_id_idx on public.cricket_innings (match_id);
create index cricket_batting_innings_id_idx on public.cricket_batting (innings_id, batting_order);
create index cricket_bowling_innings_id_idx on public.cricket_bowling (innings_id);
create index cricket_balls_match_seq_idx on public.cricket_balls (match_id, innings_no, seq);

alter table public.cricket_live_state replica identity full;
alter table public.cricket_balls replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.cricket_balls';
    execute 'alter publication supabase_realtime add table public.cricket_live_state';
  end if;
exception
  when duplicate_object then null;
end $$;

alter table public.cricket_players enable row level security;
alter table public.cricket_matches enable row level security;
alter table public.cricket_innings enable row level security;
alter table public.cricket_batting enable row level security;
alter table public.cricket_bowling enable row level security;
alter table public.cricket_balls enable row level security;
alter table public.cricket_live_state enable row level security;
alter table public.cricket_sync_runs enable row level security;

create policy cricket_players_public_read on public.cricket_players for select to anon, authenticated using (true);
create policy cricket_matches_public_read on public.cricket_matches for select to anon, authenticated using (true);
create policy cricket_innings_public_read on public.cricket_innings for select to anon, authenticated using (true);
create policy cricket_batting_public_read on public.cricket_batting for select to anon, authenticated using (true);
create policy cricket_bowling_public_read on public.cricket_bowling for select to anon, authenticated using (true);
create policy cricket_balls_public_read on public.cricket_balls for select to anon, authenticated using (true);
create policy cricket_live_state_public_read on public.cricket_live_state for select to anon, authenticated using (true);
create policy cricket_sync_runs_public_read on public.cricket_sync_runs for select to anon, authenticated using (true);

insert into public.cricket_players (full_name, short_name, role, is_captain, is_vice_captain, is_keeper) values
  ('Sujit Khanal', 'Sujit K', 'batter', true, false, false),
  ('Ashim Gautam', 'Ashim G', 'batter', false, false, false),
  ('Ashok Kunwar', 'Ashok K', 'batter', false, false, false),
  ('Binod Bhujel', 'Binod B', 'batter', false, false, false),
  ('Indra Bist', 'Indra B', 'batter', false, false, false),
  ('Janak Dumre', 'Janak D', 'batter', false, false, false),
  ('Krishna Poudel', 'Krishna P', 'batter', false, false, false),
  ('Nishan Prasai', 'Nishan P', 'batter', false, false, false),
  ('Prem Thapa', 'Prem T', 'batter', false, false, false),
  ('Rameshwar Lekhak', 'Rameshwar L', 'batter', false, false, false),
  ('Sandeep Roka', 'Sandeep R', 'batter', false, false, false),
  ('Santosh Ghimire', 'Santosh G', 'batter', false, false, false),
  ('Sarad Singh Hamal', 'Sarad H', 'batter', false, false, false),
  ('Suraj Thapa', 'Suraj T', 'batter', false, false, false),
  ('Suresh Singh', 'Suresh S', 'batter', false, false, true),
  ('Sushant Shrestha', 'Sushant S', 'batter', false, false, false),
  ('Yukesh Sitoula', 'Yukesh S', 'batter', false, false, false),
  ('Yushek Sitoula', 'Yushek S', 'batter', false, false, false),
  ('Biplav Gautam', 'Biplav G', 'all_rounder', false, true, false),
  ('Ashish Khanal', 'Ashish K', 'all_rounder', false, false, false),
  ('Basant Bhatt', 'Basant B', 'all_rounder', false, false, false),
  ('Beni Mahato', 'Beni M', 'all_rounder', false, false, false),
  ('Ehsan Ansari', 'Ehsan A', 'all_rounder', false, false, false),
  ('Ganesh Gautam', 'Ganesh G', 'all_rounder', false, false, false),
  ('Ganesh Giri', 'Ganesh G', 'all_rounder', false, false, false),
  ('Ganesh Pandey', 'Ganesh P', 'all_rounder', false, false, false),
  ('Kavin Parakh', 'Kavin P', 'all_rounder', false, false, false),
  ('Rupesh Phuyal', 'Rupesh P', 'all_rounder', false, false, false),
  ('Suraj Kandel', 'Suraj K', 'all_rounder', false, false, false)
on conflict (full_name) do nothing;

