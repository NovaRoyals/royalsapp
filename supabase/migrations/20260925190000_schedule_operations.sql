-- Schedule, RSVP, and field operations.
-- Client-submitted role claims never grant staff access. Policies read public.user_roles.
-- public.attendance remains the legacy intended-response table.
-- public.session_attendance is what happened at the session.

create type public.field_ops_status as enum (
  'open', 'delayed', 'inspection_pending', 'closed', 'relocated'
);

create type public.event_change_kind as enum (
  'closure', 'relocation', 'cancellation', 'time_change', 'instruction'
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  field_number text not null,
  address text not null,
  arrival text,
  parking_notes text,
  entrance text,
  surface text,
  restrooms text,
  created_at timestamptz not null default now()
);

create table public.field_status_updates (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  status public.field_ops_status not null,
  reason text not null,
  replacement_venue_id uuid references public.venues(id),
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.event_participants (
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  team_id uuid references public.teams(id),
  primary key (event_id, participant_id)
);

create table public.supporter_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  going boolean not null,
  updated_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);

create table public.session_attendance (
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  status text not null check (status in ('present', 'absent', 'late')),
  recorded_by uuid not null references public.profiles(id),
  recorded_at timestamptz not null default now(),
  primary key (event_id, participant_id)
);

create table public.event_changes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  kind public.event_change_kind not null,
  reason text not null,
  previous_venue text,
  next_venue text,
  approval text not null check (approval in ('requested', 'published')),
  notification_status text not null default 'queued' check (notification_status in ('queued', 'delivered')),
  reschedule_pending boolean not null default false,
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.audit_records (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  target_id text not null,
  actor_id uuid not null references public.profiles(id),
  detail text not null,
  created_at timestamptz not null default now()
);

alter table public.notifications
  add column if not exists dedupe_key text,
  add column if not exists event_id uuid references public.events(id) on delete set null,
  add column if not exists urgency text;

create unique index if not exists notifications_dedupe_unread_idx
  on public.notifications (recipient_id, dedupe_key)
  where dedupe_key is not null and read_at is null;

alter table public.events
  add column if not exists venue_id uuid references public.venues(id),
  add column if not exists rsvp_deadline timestamptz,
  add column if not exists instructions text;

alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications
  add constraint notifications_notification_type_check
  check (notification_type in (
    'registration', 'reminder', 'change', 'weather', 'announcement', 'result',
    'coach_update', 'coach_reminder', 'rsvp', 'supporter', 'field'
  ));

alter table public.venues enable row level security;
alter table public.field_status_updates enable row level security;
alter table public.event_participants enable row level security;
alter table public.supporter_rsvps enable row level security;
alter table public.session_attendance enable row level security;
alter table public.event_changes enable row level security;
alter table public.audit_records enable row level security;

create policy venues_read on public.venues for select to anon, authenticated using (true);
create policy venues_write on public.venues for all to authenticated
  using (private.is_club_admin()) with check (private.is_club_admin());

create policy field_status_read on public.field_status_updates for select to anon, authenticated using (true);
create policy field_status_write on public.field_status_updates for insert to authenticated
  with check (private.is_club_admin());

create policy participants_staff on public.event_participants for select to authenticated
  using (
    private.is_club_admin()
    or exists (
      select 1 from public.team_staff
      where team_staff.team_id = event_participants.team_id
        and team_staff.profile_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.participants
      join public.household_guardians on household_guardians.household_id = participants.household_id
      where participants.id = event_participants.participant_id
        and household_guardians.guardian_id = (select auth.uid())
        and household_guardians.can_manage
    )
  );

-- Parents RSVP only for children they manage. Players only for themselves.
-- Staff cannot write a household RSVP by presenting a role from the client.
create policy rsvp_guardian on public.attendance for insert to authenticated
  with check (
    exists (
      select 1
      from public.participants
      join public.household_guardians on household_guardians.household_id = participants.household_id
      where participants.id = attendance.participant_id
        and household_guardians.guardian_id = (select auth.uid())
        and household_guardians.can_manage
        and attendance.responded_by = (select auth.uid())
    )
    or exists (
      select 1 from public.participants
      where participants.id = attendance.participant_id
        and participants.profile_id = (select auth.uid())
        and attendance.responded_by = (select auth.uid())
    )
  );

create policy supporter_own on public.supporter_rsvps for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy supporter_count on public.supporter_rsvps for select to anon, authenticated using (true);

create policy session_attendance_staff on public.session_attendance for all to authenticated
  using (
    private.is_club_admin()
    or exists (
      select 1
      from public.events
      join public.team_staff on team_staff.team_id = events.home_team_id
      where events.id = session_attendance.event_id
        and team_staff.profile_id = (select auth.uid())
        and team_staff.staff_role in ('coach', 'manager')
    )
  )
  with check (
    private.is_club_admin()
    or exists (
      select 1
      from public.events
      join public.team_staff on team_staff.team_id = events.home_team_id
      where events.id = session_attendance.event_id
        and team_staff.profile_id = (select auth.uid())
        and team_staff.staff_role in ('coach', 'manager')
    )
  );

create policy event_changes_read on public.event_changes for select to authenticated using (true);
create policy event_changes_request on public.event_changes for insert to authenticated
  with check (
    approval = 'requested'
    and actor_id = (select auth.uid())
    and exists (
      select 1
      from public.events
      join public.team_staff on team_staff.team_id = events.home_team_id
      where events.id = event_changes.event_id
        and team_staff.profile_id = (select auth.uid())
    )
  );
create policy event_changes_publish on public.event_changes for insert to authenticated
  with check (approval = 'published' and private.is_club_admin() and actor_id = (select auth.uid()));

create policy audit_admin on public.audit_records for select to authenticated
  using (private.is_club_admin());
create policy audit_insert on public.audit_records for insert to authenticated
  with check (actor_id = (select auth.uid()) and (private.is_club_admin() or private.has_role('coach') or private.has_role('team_manager')));
