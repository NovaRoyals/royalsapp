-- Coach session recaps and individual notes.
-- Recipients are guardian households for attending children, never child logins.

create type public.recap_status as enum ('draft', 'ready', 'sent', 'failed');
create type public.recap_polish_mode as enum ('cleanup', 'warm', 'verbatim');
create type public.coach_update_kind as enum ('session_recap', 'private_note', 'practice_suggestion');

create table public.session_recaps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  team_id uuid not null,
  created_by uuid not null references public.profiles(id),
  original_text text not null default '',
  generated_text text not null default '',
  approved_text text not null default '',
  polish_mode public.recap_polish_mode,
  status public.recap_status not null default 'draft',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.session_recap_notes (
  id uuid primary key default gen_random_uuid(),
  recap_id uuid not null references public.session_recaps(id) on delete cascade,
  participant_id uuid not null references public.participants(id),
  tags text[] not null default '{}',
  original_text text not null default '',
  approved_text text not null default '',
  created_at timestamptz not null default now()
);

create table public.coach_updates (
  id uuid primary key default gen_random_uuid(),
  recap_id uuid not null references public.session_recaps(id) on delete cascade,
  event_id uuid not null,
  household_id uuid not null references public.households(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete cascade,
  kind public.coach_update_kind not null,
  body text not null,
  sent_at timestamptz not null default now()
);

create table public.coach_polish_logs (
  id uuid primary key default gen_random_uuid(),
  recap_id uuid references public.session_recaps(id) on delete set null,
  coach_id uuid not null references public.profiles(id),
  original_text text not null,
  generated_text text not null,
  approved_text text,
  mode public.recap_polish_mode not null,
  created_at timestamptz not null default now()
);

alter table public.session_recaps enable row level security;
alter table public.session_recap_notes enable row level security;
alter table public.coach_updates enable row level security;
alter table public.coach_polish_logs enable row level security;

-- Coach: drafts and sends for assigned teams only.
-- Team manager: select status; insert/update send only if membership_grants.send_session_recap.
-- Guardian: own household updates only (coach_updates).
-- Club admin: audit polish logs and delivery.
-- Child player profiles: no SELECT on coach_updates / session_recap_notes.

create policy recaps_assigned_coach on public.session_recaps
  for all to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.team_memberships tm
      where tm.team_id = session_recaps.team_id
        and tm.user_id = auth.uid()
        and tm.role in ('coach', 'club_admin')
    )
  )
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.team_memberships tm
      where tm.team_id = session_recaps.team_id
        and tm.user_id = auth.uid()
        and tm.role in ('coach', 'club_admin')
    )
  );

create policy updates_guardian_read on public.coach_updates
  for select to authenticated
  using (
    exists (
      select 1 from public.household_guardians hg
      where hg.household_id = coach_updates.household_id
        and hg.guardian_id = auth.uid()
    )
  );

create policy polish_logs_admin_read on public.coach_polish_logs
  for select to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'club_admin'
    )
  );

-- TODO(server): Edge Function coach-polish uses service role after verifying
-- team assignment. OpenRouter secret stays in function secrets, never the client.
-- Set with: supabase secrets set OPENROUTER_API_KEY=...
-- Never send recaps from the polish function; send is coach-approved only.
