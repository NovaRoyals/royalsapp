-- ROYALS core schema
-- Public discovery data is intentionally separated from household, minor,
-- consent, contact and administrative data.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.app_role as enum (
  'supporter', 'adult_player', 'guardian', 'coach',
  'team_manager', 'competition_manager', 'club_admin'
);
create type public.sport_code as enum ('soccer', 'cricket');
create type public.competition_type as enum ('league', 'tournament', 'friendly', 'pickup', 'training');
create type public.event_type as enum ('league_match', 'tournament_match', 'friendly', 'training', 'open_play', 'club_event');
create type public.registration_status as enum ('draft', 'submitted', 'pending', 'approved', 'waitlisted', 'rejected', 'cancelled');
create type public.payment_status as enum ('unpaid', 'pending', 'paid', 'refunded');
create type public.attendance_status as enum ('going', 'maybe', 'not_going');
create type public.membership_role as enum ('player', 'coach', 'manager', 'staff');
create type public.entry_status as enum ('draft', 'pending', 'approved', 'rejected', 'withdrawn');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  first_name text,
  last_name text,
  avatar_path text,
  phone text,
  date_of_birth date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address_line_1 text,
  address_line_2 text,
  city text,
  region text,
  postal_code text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_guardians (
  household_id uuid not null references public.households(id) on delete cascade,
  guardian_id uuid not null references public.profiles(id) on delete cascade,
  relationship_label text,
  can_manage boolean not null default true,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (household_id, guardian_id)
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  profile_id uuid unique references public.profiles(id) on delete set null,
  first_name text not null,
  last_name text not null,
  preferred_name text,
  date_of_birth date not null,
  medical_notes text,
  emergency_contact_name text,
  emergency_contact_phone text,
  is_minor boolean not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participant_owner_check check (household_id is not null or profile_id is not null)
);

create table public.sports (
  id uuid primary key default gen_random_uuid(),
  code public.sport_code not null unique,
  name text not null,
  active boolean not null default true
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null check (status in ('draft', 'upcoming', 'active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  constraint valid_season_dates check (ends_on >= starts_on)
);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports(id),
  season_id uuid references public.seasons(id),
  slug text not null unique,
  title text not null,
  audience_label text not null,
  description text not null,
  venue_name text,
  venue_address text,
  min_age integer,
  max_age integer,
  capacity integer,
  session_count integer,
  hero_image_path text,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  registration_open boolean not null default false,
  is_published boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_program_ages check (min_age is null or max_age is null or max_age >= min_age),
  constraint valid_program_capacity check (capacity is null or capacity >= 0)
);

create table public.program_pricing (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  label text not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'USD',
  pricing_type text not null check (pricing_type in ('standard', 'sibling', 'early_bird', 'team', 'other')),
  applies_from_participant_number integer check (applies_from_participant_number >= 1),
  active boolean not null default true
);

create table public.waivers (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references public.programs(id),
  title text not null,
  body text not null,
  version text not null,
  waiver_type text not null check (waiver_type in ('participation', 'emergency_treatment', 'media', 'other')),
  required boolean not null default true,
  effective_at timestamptz not null default now(),
  retired_at timestamptz,
  unique (program_id, waiver_type, version)
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id),
  household_id uuid references public.households(id),
  submitted_by uuid not null references public.profiles(id),
  status public.registration_status not null default 'draft',
  participant_count integer not null default 1 check (participant_count > 0),
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  amount_due_cents integer not null default 0 check (amount_due_cents >= 0),
  payment_status public.payment_status not null default 'unpaid',
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.registration_participants (
  registration_id uuid not null references public.registrations(id) on delete cascade,
  participant_id uuid not null references public.participants(id),
  price_cents integer not null check (price_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  status public.registration_status not null default 'pending',
  primary key (registration_id, participant_id)
);

create table public.consent_acceptances (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  participant_id uuid references public.participants(id),
  waiver_id uuid not null references public.waivers(id),
  accepted_by uuid not null references public.profiles(id),
  typed_signature text not null,
  signed_at timestamptz not null,
  signer_ip inet,
  user_agent text,
  waiver_body_snapshot text not null,
  unique (registration_id, participant_id, waiver_id)
);

create table public.payment_records (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id),
  provider text not null,
  provider_reference text,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'USD',
  status public.payment_status not null,
  is_demo boolean not null default false,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint no_demo_provider_reference check (not is_demo or provider_reference is null)
);

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports(id),
  season_id uuid references public.seasons(id),
  title text not null,
  competition_type public.competition_type not null,
  organizer_name text not null,
  is_external boolean not null default false,
  external_url text,
  description text,
  format text,
  eligibility text,
  entry_fee_cents integer check (entry_fee_cents >= 0),
  registration_deadline timestamptz,
  starts_on date,
  ends_on date,
  location_name text,
  location_address text,
  status text not null check (status in ('draft', 'registration_open', 'upcoming', 'active', 'completed', 'archived')),
  bracket_config jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.divisions (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  name text not null,
  rules jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports(id),
  name text not null,
  short_name text,
  audience_label text,
  crest_path text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_staff (
  team_id uuid not null references public.teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  staff_role public.membership_role not null check (staff_role in ('coach', 'manager', 'staff')),
  can_manage_roster boolean not null default false,
  can_manage_schedule boolean not null default false,
  can_publish boolean not null default false,
  primary key (team_id, profile_id, staff_role)
);

create table public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  membership_role public.membership_role not null default 'player',
  jersey_number integer,
  position_label text,
  starts_on date,
  ends_on date,
  status text not null check (status in ('invited', 'active', 'inactive', 'suspended')),
  unique (team_id, participant_id, starts_on)
);

create table public.competition_staff (
  competition_id uuid not null references public.competitions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  can_manage_entries boolean not null default false,
  can_manage_fixtures boolean not null default false,
  can_manage_results boolean not null default false,
  primary key (competition_id, profile_id)
);

create table public.competition_entries (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  division_id uuid references public.divisions(id),
  team_id uuid not null references public.teams(id),
  submitted_by uuid not null references public.profiles(id),
  manager_name text not null,
  manager_email text not null,
  manager_phone text,
  status public.entry_status not null default 'draft',
  fee_cents integer not null default 0 check (fee_cents >= 0),
  payment_status public.payment_status not null default 'unpaid',
  seed integer,
  group_code text,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  unique (competition_id, team_id)
);

create table public.tournament_rosters (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.competition_entries(id) on delete cascade,
  participant_id uuid not null references public.participants(id),
  jersey_number integer,
  eligibility_status text not null default 'pending' check (eligibility_status in ('pending', 'eligible', 'ineligible', 'needs_review')),
  waiver_status text not null default 'pending' check (waiver_status in ('pending', 'complete', 'waived')),
  checked_in_at timestamptz,
  checked_in_by uuid references public.profiles(id),
  unique (entry_id, participant_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid references public.sports(id),
  program_id uuid references public.programs(id) on delete cascade,
  competition_id uuid references public.competitions(id) on delete cascade,
  division_id uuid references public.divisions(id),
  event_type public.event_type not null,
  title text not null,
  home_team_id uuid references public.teams(id),
  away_team_id uuid references public.teams(id),
  external_opponent_name text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'America/New_York',
  venue_name text,
  venue_address text,
  status text not null check (status in ('scheduled', 'live', 'completed', 'cancelled', 'postponed')),
  home_score numeric,
  away_score numeric,
  result_data jsonb not null default '{}'::jsonb,
  source_label text,
  source_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_context_check check (
    program_id is not null or competition_id is not null or event_type = 'club_event'
  )
);

create table public.attendance (
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  response public.attendance_status not null,
  responded_by uuid not null references public.profiles(id),
  note text,
  responded_at timestamptz not null default now(),
  primary key (event_id, participant_id)
);

create table public.standings (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  division_id uuid references public.divisions(id),
  team_id uuid not null references public.teams(id),
  rank integer not null,
  played integer not null default 0,
  won integer not null default 0,
  drawn integer not null default 0,
  lost integer not null default 0,
  points numeric not null default 0,
  scored numeric not null default 0,
  conceded numeric not null default 0,
  sport_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (competition_id, division_id, team_id)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience_type text not null check (audience_type in ('club', 'program', 'team', 'competition')),
  program_id uuid references public.programs(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  competition_id uuid references public.competitions(id) on delete cascade,
  published_by uuid not null references public.profiles(id),
  published_at timestamptz,
  expires_at timestamptz,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null check (notification_type in ('registration', 'reminder', 'change', 'weather', 'announcement', 'result')),
  title text not null,
  body text not null,
  route text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  registration_updates boolean not null default true,
  practice_reminders boolean not null default true,
  game_reminders boolean not null default true,
  field_and_weather_changes boolean not null default true,
  tournament_updates boolean not null default true,
  announcements boolean not null default true,
  results boolean not null default true,
  push_token text,
  updated_at timestamptz not null default now()
);

create index registrations_household_idx on public.registrations(household_id);
create index registrations_program_status_idx on public.registrations(program_id, status);
create index participants_household_idx on public.participants(household_id);
create index memberships_team_idx on public.team_memberships(team_id);
create index events_start_idx on public.events(starts_at);
create index events_team_home_idx on public.events(home_team_id);
create index events_team_away_idx on public.events(away_team_id);
create index attendance_participant_idx on public.attendance(participant_id);
create index announcements_published_idx on public.announcements(published_at desc);
create index notifications_recipient_idx on public.notifications(recipient_id, created_at desc);

create or replace function private.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = required_role
  );
$$;

create or replace function private.is_club_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('club_admin'::public.app_role);
$$;

create or replace function private.can_manage_household(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_club_admin() or exists (
    select 1 from public.household_guardians
    where household_id = target_household
      and guardian_id = (select auth.uid())
      and can_manage
  );
$$;

create or replace function private.can_manage_team(target_team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_club_admin() or exists (
    select 1 from public.team_staff
    where team_id = target_team
      and profile_id = (select auth.uid())
      and (can_manage_roster or can_manage_schedule or can_publish)
  );
$$;

create or replace function private.can_manage_competition(target_competition uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_club_admin() or exists (
    select 1 from public.competition_staff
    where competition_id = target_competition
      and profile_id = (select auth.uid())
      and (can_manage_entries or can_manage_fixtures or can_manage_results)
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.has_role(public.app_role) to authenticated;
grant execute on function private.is_club_admin() to authenticated;
grant execute on function private.can_manage_household(uuid) to authenticated;
grant execute on function private.can_manage_team(uuid) to authenticated;
grant execute on function private.can_manage_competition(uuid) to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  );
  insert into public.user_roles (user_id, role)
  values (new.id, 'supporter'::public.app_role);
  insert into public.notification_preferences (profile_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles','user_roles','households','household_guardians','participants',
    'sports','seasons','programs','program_pricing','waivers','registrations',
    'registration_participants','consent_acceptances','payment_records',
    'competitions','divisions','teams','team_staff','team_memberships',
    'competition_staff','competition_entries','tournament_rosters','events',
    'attendance','standings','announcements','notifications','notification_preferences'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

-- Public discovery policies.
create policy sports_public_read on public.sports for select using (active);
create policy seasons_public_read on public.seasons for select using (status <> 'draft');
create policy programs_public_read on public.programs for select using (is_published);
create policy pricing_public_read on public.program_pricing for select using (
  active and exists (select 1 from public.programs p where p.id = program_id and p.is_published)
);
create policy competitions_public_read on public.competitions for select using (is_published);
create policy divisions_public_read on public.divisions for select using (
  exists (select 1 from public.competitions c where c.id = competition_id and c.is_published)
);
create policy teams_public_read on public.teams for select using (active);
create policy events_public_read on public.events for select using (is_published);
create policy standings_public_read on public.standings for select using (
  exists (select 1 from public.competitions c where c.id = competition_id and c.is_published)
);
create policy club_announcements_public_read on public.announcements for select using (
  audience_type = 'club'
  and published_at <= now()
  and (expires_at is null or expires_at > now())
);

create policy sports_admin_manage on public.sports for all to authenticated
using (private.is_club_admin()) with check (private.is_club_admin());
create policy seasons_admin_manage on public.seasons for all to authenticated
using (private.is_club_admin()) with check (private.is_club_admin());
create policy programs_admin_manage on public.programs for all to authenticated
using (private.is_club_admin()) with check (private.is_club_admin());
create policy pricing_admin_manage on public.program_pricing for all to authenticated
using (private.is_club_admin()) with check (private.is_club_admin());
create policy waivers_admin_manage on public.waivers for all to authenticated
using (private.is_club_admin()) with check (private.is_club_admin());
create policy competitions_admin_manage on public.competitions for all to authenticated
using (private.is_club_admin()) with check (private.is_club_admin());
create policy divisions_competition_manage on public.divisions for all to authenticated
using (private.can_manage_competition(competition_id))
with check (private.can_manage_competition(competition_id));
create policy teams_admin_manage on public.teams for all to authenticated
using (private.is_club_admin()) with check (private.is_club_admin());
create policy events_staff_manage on public.events for all to authenticated
using (
  private.is_club_admin()
  or (competition_id is not null and private.can_manage_competition(competition_id))
  or (home_team_id is not null and private.can_manage_team(home_team_id))
  or (away_team_id is not null and private.can_manage_team(away_team_id))
)
with check (
  private.is_club_admin()
  or (competition_id is not null and private.can_manage_competition(competition_id))
  or (home_team_id is not null and private.can_manage_team(home_team_id))
  or (away_team_id is not null and private.can_manage_team(away_team_id))
);
create policy standings_staff_manage on public.standings for all to authenticated
using (private.can_manage_competition(competition_id))
with check (private.can_manage_competition(competition_id));

-- A user can read/update only their own private profile. Admins may read for operations.
create policy profiles_self_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or private.is_club_admin());
create policy profiles_self_update on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy roles_self_read on public.user_roles for select to authenticated
using (user_id = (select auth.uid()) or private.is_club_admin());
create policy roles_admin_manage on public.user_roles for all to authenticated
using (private.is_club_admin()) with check (private.is_club_admin());

create policy households_guardian_read on public.households for select to authenticated
using (private.can_manage_household(id));
create policy households_guardian_create on public.households for insert to authenticated
with check (created_by = (select auth.uid()));
create policy households_guardian_update on public.households for update to authenticated
using (private.can_manage_household(id)) with check (private.can_manage_household(id));

create policy guardian_links_read on public.household_guardians for select to authenticated
using (guardian_id = (select auth.uid()) or private.can_manage_household(household_id));
create policy guardian_links_create on public.household_guardians for insert to authenticated
with check (guardian_id = (select auth.uid()) or private.is_club_admin());
create policy guardian_links_manage on public.household_guardians for update to authenticated
using (private.can_manage_household(household_id)) with check (private.can_manage_household(household_id));
create policy guardian_links_delete on public.household_guardians for delete to authenticated
using (private.can_manage_household(household_id));

create policy participants_authorized_read on public.participants for select to authenticated
using (
  profile_id = (select auth.uid())
  or (household_id is not null and private.can_manage_household(household_id))
  or private.is_club_admin()
  or exists (
    select 1 from public.team_memberships tm
    join public.team_staff ts on ts.team_id = tm.team_id
    where tm.participant_id = id
      and ts.profile_id = (select auth.uid())
  )
);
create policy participants_guardian_create on public.participants for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    profile_id = (select auth.uid())
    or (household_id is not null and private.can_manage_household(household_id))
  )
);
create policy participants_authorized_update on public.participants for update to authenticated
using (
  profile_id = (select auth.uid())
  or (household_id is not null and private.can_manage_household(household_id))
  or private.is_club_admin()
)
with check (
  profile_id = (select auth.uid())
  or (household_id is not null and private.can_manage_household(household_id))
  or private.is_club_admin()
);

create policy waivers_published_read on public.waivers for select
using (effective_at <= now() and (retired_at is null or retired_at > now()));

create policy registrations_owner_read on public.registrations for select to authenticated
using (
  submitted_by = (select auth.uid())
  or (household_id is not null and private.can_manage_household(household_id))
  or private.is_club_admin()
);
create policy registrations_owner_create on public.registrations for insert to authenticated
with check (
  submitted_by = (select auth.uid())
  and (household_id is null or private.can_manage_household(household_id))
);
create policy registrations_draft_update on public.registrations for update to authenticated
using (
  status = 'draft'
  and submitted_by = (select auth.uid())
)
with check (submitted_by = (select auth.uid()));
create policy registrations_admin_update on public.registrations for update to authenticated
using (private.is_club_admin()) with check (private.is_club_admin());

create policy registration_participants_owner_read on public.registration_participants for select to authenticated
using (
  exists (
    select 1 from public.registrations r
    where r.id = registration_id
      and (r.submitted_by = (select auth.uid())
        or (r.household_id is not null and private.can_manage_household(r.household_id))
        or private.is_club_admin())
  )
);
create policy registration_participants_owner_create on public.registration_participants for insert to authenticated
with check (
  exists (
    select 1 from public.registrations r
    where r.id = registration_id
      and r.submitted_by = (select auth.uid())
      and r.status = 'draft'
  )
  and exists (
    select 1 from public.participants p
    where p.id = participant_id
      and (p.profile_id = (select auth.uid())
        or (p.household_id is not null and private.can_manage_household(p.household_id)))
  )
);

create policy consents_signer_read on public.consent_acceptances for select to authenticated
using (accepted_by = (select auth.uid()) or private.is_club_admin());
create policy consents_signer_create on public.consent_acceptances for insert to authenticated
with check (
  accepted_by = (select auth.uid())
  and exists (
    select 1 from public.registrations r
    where r.id = registration_id and r.submitted_by = (select auth.uid())
  )
);

create policy payments_owner_read on public.payment_records for select to authenticated
using (
  exists (
    select 1 from public.registrations r
    where r.id = registration_id
      and (r.submitted_by = (select auth.uid())
        or (r.household_id is not null and private.can_manage_household(r.household_id))
        or private.is_club_admin())
  )
);

create policy team_staff_self_read on public.team_staff for select to authenticated
using (profile_id = (select auth.uid()) or private.can_manage_team(team_id));
create policy team_staff_admin_manage on public.team_staff for all to authenticated
using (private.is_club_admin()) with check (private.is_club_admin());

create policy memberships_authorized_read on public.team_memberships for select to authenticated
using (
  private.can_manage_team(team_id)
  or exists (
    select 1 from public.participants p
    where p.id = participant_id
      and (p.profile_id = (select auth.uid())
        or (p.household_id is not null and private.can_manage_household(p.household_id)))
  )
);
create policy memberships_manager_manage on public.team_memberships for all to authenticated
using (private.can_manage_team(team_id)) with check (private.can_manage_team(team_id));

create policy competition_staff_self_read on public.competition_staff for select to authenticated
using (profile_id = (select auth.uid()) or private.can_manage_competition(competition_id));
create policy competition_staff_admin_manage on public.competition_staff for all to authenticated
using (private.is_club_admin()) with check (private.is_club_admin());

create policy entries_submitter_read on public.competition_entries for select to authenticated
using (
  submitted_by = (select auth.uid())
  or private.can_manage_team(team_id)
  or private.can_manage_competition(competition_id)
);
create policy entries_team_create on public.competition_entries for insert to authenticated
with check (submitted_by = (select auth.uid()) and private.can_manage_team(team_id));
create policy entries_authorized_update on public.competition_entries for update to authenticated
using (
  (submitted_by = (select auth.uid()) and status = 'draft')
  or private.can_manage_competition(competition_id)
)
with check (
  submitted_by = (select auth.uid())
  or private.can_manage_competition(competition_id)
);

create policy tournament_rosters_authorized_read on public.tournament_rosters for select to authenticated
using (
  exists (
    select 1 from public.competition_entries e
    where e.id = entry_id
      and (e.submitted_by = (select auth.uid())
        or private.can_manage_team(e.team_id)
        or private.can_manage_competition(e.competition_id))
  )
);
create policy tournament_rosters_manager_manage on public.tournament_rosters for all to authenticated
using (
  exists (
    select 1 from public.competition_entries e
    where e.id = entry_id
      and (private.can_manage_team(e.team_id) or private.can_manage_competition(e.competition_id))
  )
)
with check (
  exists (
    select 1 from public.competition_entries e
    where e.id = entry_id
      and (private.can_manage_team(e.team_id) or private.can_manage_competition(e.competition_id))
  )
);

create policy attendance_authorized_read on public.attendance for select to authenticated
using (
  responded_by = (select auth.uid())
  or exists (
    select 1 from public.participants p
    where p.id = participant_id
      and (p.profile_id = (select auth.uid())
        or (p.household_id is not null and private.can_manage_household(p.household_id)))
  )
  or exists (
    select 1 from public.team_memberships tm
    where tm.participant_id = attendance.participant_id and private.can_manage_team(tm.team_id)
  )
);
create policy attendance_authorized_manage on public.attendance for all to authenticated
using (
  responded_by = (select auth.uid())
  or exists (
    select 1 from public.participants p
    where p.id = participant_id
      and (p.profile_id = (select auth.uid())
        or (p.household_id is not null and private.can_manage_household(p.household_id)))
  )
)
with check (
  responded_by = (select auth.uid())
  and exists (
    select 1 from public.participants p
    where p.id = participant_id
      and (p.profile_id = (select auth.uid())
        or (p.household_id is not null and private.can_manage_household(p.household_id)))
  )
);

create policy announcements_member_read on public.announcements for select to authenticated
using (
  (published_at <= now() and (expires_at is null or expires_at > now()))
  and (
    audience_type = 'club'
    or (team_id is not null and (
      private.can_manage_team(team_id)
      or exists (
        select 1 from public.team_memberships tm
        join public.participants p on p.id = tm.participant_id
        where tm.team_id = announcements.team_id
          and (p.profile_id = (select auth.uid())
            or (p.household_id is not null and private.can_manage_household(p.household_id)))
      )
    ))
  )
);
create policy announcements_staff_manage on public.announcements for all to authenticated
using (
  private.is_club_admin()
  or (team_id is not null and private.can_manage_team(team_id))
  or (competition_id is not null and private.can_manage_competition(competition_id))
)
with check (
  published_by = (select auth.uid())
  and (
    private.is_club_admin()
    or (team_id is not null and private.can_manage_team(team_id))
    or (competition_id is not null and private.can_manage_competition(competition_id))
  )
);

create policy notifications_owner_read on public.notifications for select to authenticated
using (recipient_id = (select auth.uid()));
create policy notifications_owner_update on public.notifications for update to authenticated
using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
create policy preferences_owner_all on public.notification_preferences for all to authenticated
using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

-- Discovery grants are read-only. Authenticated mutation is still filtered by RLS.
grant select on public.sports, public.seasons, public.programs, public.program_pricing,
  public.waivers, public.competitions, public.divisions, public.teams, public.events,
  public.standings, public.announcements to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.consent_acceptances, public.payment_records, public.households,
  public.household_guardians, public.participants, public.registrations,
  public.registration_participants, public.tournament_rosters from anon;

insert into public.sports (code, name) values
  ('soccer', 'Soccer'),
  ('cricket', 'Cricket');
