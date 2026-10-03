-- Messaging: parents and coaches, plus opt-in parent-to-parent chat.
--
-- Rules the database enforces (the app only mirrors them):
--   * a conversation is visible only to its members; admins do not read private conversations,
--     they see a report, and the messages of a conversation only after it has been reported;
--   * nobody inserts a message directly: send_message checks membership, blocks, opt-in and, for
--     parent chats, contact details;
--   * a coach thread is between a family (its guardians) and the team's coaches;
--   * a parent chat needs both parents to have switched it on and to have a child on the same team;
--   * children are never members.

-- ---------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('coach', 'parent')),
  team_id uuid not null references public.teams(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint coach_thread_has_household check (kind <> 'coach' or household_id is not null)
);
-- One coach thread per family per team.
create unique index conversations_coach_unique on public.conversations (team_id, household_id) where kind = 'coach';

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null check (member_role in ('guardian', 'coach')),
  last_read_at timestamptz,
  primary key (conversation_id, profile_id)
);
create index conversation_members_profile_idx on public.conversation_members (profile_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.parent_chat_prefs (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.message_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.message_reports (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id),
  reason text not null check (char_length(btrim(reason)) > 0),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.parent_chat_prefs enable row level security;
alter table public.message_blocks enable row level security;
alter table public.message_reports enable row level security;

-- ---------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------
create or replace function private.is_conversation_member(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation and profile_id = (select auth.uid())
  );
$$;

-- A parent chat may not carry a way to leave the app. This catches the obvious cases
-- (emails, links, phone numbers); reporting covers the rest.
create or replace function private.contains_contact_info(p_text text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  run text;
begin
  if p_text ~* '[^\s@]+@[^\s@]+\.[^\s@]+' then return true; end if;
  if p_text ~* '(https?://|www\.)\S+' then return true; end if;
  for run in select m[1] from regexp_matches(p_text, '(\+?\d[\d\s().\-]{7,}\d)', 'g') as m loop
    if btrim(run) ~ '^\d{4}-\d{2}-\d{2}$' then continue; end if;
    if char_length(regexp_replace(run, '\D', '', 'g')) >= 9 then return true; end if;
  end loop;
  return false;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Policies: members read; nobody writes directly
-- ---------------------------------------------------------------------------------------
create policy conversations_member_read on public.conversations for select to authenticated
  using (private.is_conversation_member(id));

create policy members_read_own_conversations on public.conversation_members for select to authenticated
  using (private.is_conversation_member(conversation_id));

create policy messages_member_read on public.messages for select to authenticated
  using (private.is_conversation_member(conversation_id));

-- An admin sees the messages of a conversation only once someone has reported it.
create policy messages_admin_reported_read on public.messages for select to authenticated
  using (
    private.is_club_admin()
    and exists (select 1 from public.message_reports r where r.conversation_id = messages.conversation_id)
  );

create policy prefs_own on public.parent_chat_prefs for select to authenticated using (profile_id = (select auth.uid()));
create policy blocks_own on public.message_blocks for select to authenticated using (blocker_id = (select auth.uid()));
create policy reports_own_or_admin on public.message_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or private.is_club_admin());

-- Grants are explicit so behavior does not depend on default privileges.
revoke all on public.conversations, public.conversation_members, public.messages,
  public.parent_chat_prefs, public.message_blocks, public.message_reports from anon, authenticated;
grant select on public.conversations, public.conversation_members, public.messages,
  public.parent_chat_prefs, public.message_blocks, public.message_reports to authenticated;

-- ---------------------------------------------------------------------------------------
-- Functions: the only way in
-- ---------------------------------------------------------------------------------------

-- Open (or return) a family's thread with the team's coaches.
create or replace function public.open_coach_conversation(p_team uuid, p_household uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_conv uuid;
begin
  if v_user is null then raise exception 'sign in to message the coach' using errcode = '28000'; end if;
  if not exists (
    select 1 from public.household_guardians hg
    where hg.household_id = p_household and hg.guardian_id = v_user
  ) then
    raise exception 'you are not a guardian of this household' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.participants pt
    join public.team_memberships tm on tm.participant_id = pt.id
    where pt.household_id = p_household and tm.team_id = p_team and tm.status = 'active'
  ) then
    raise exception 'none of your children are on this team' using errcode = '42501';
  end if;
  if not exists (select 1 from public.team_staff where team_id = p_team and staff_role = 'coach') then
    raise exception 'this team has no coach yet';
  end if;

  select id into v_conv from public.conversations where kind = 'coach' and team_id = p_team and household_id = p_household;
  if v_conv is null then
    insert into public.conversations (kind, team_id, household_id) values ('coach', p_team, p_household) returning id into v_conv;
    insert into public.conversation_members (conversation_id, profile_id, member_role)
      select v_conv, hg.guardian_id, 'guardian' from public.household_guardians hg where hg.household_id = p_household;
    insert into public.conversation_members (conversation_id, profile_id, member_role)
      select v_conv, ts.profile_id, 'coach' from public.team_staff ts where ts.team_id = p_team and ts.staff_role = 'coach'
      on conflict do nothing;
  end if;
  return v_conv;
end;
$$;

create or replace function public.set_parent_chat(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'sign in first' using errcode = '28000'; end if;
  insert into public.parent_chat_prefs (profile_id, enabled, updated_at) values (v_user, p_enabled, now())
  on conflict (profile_id) do update set enabled = excluded.enabled, updated_at = now();
end;
$$;

-- Parents on a team who have switched parent chat on (and are not you). Shown only to a parent
-- who has also switched it on, and only as a profile id plus a child's first name.
create or replace function public.list_chat_parents(p_team uuid)
returns table (parent_id uuid, child_first_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'sign in first' using errcode = '28000'; end if;
  if not coalesce((select pp.enabled from public.parent_chat_prefs pp where pp.profile_id = v_user), false) then
    raise exception 'turn on parent chat first' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.household_guardians hg
    join public.participants pt on pt.household_id = hg.household_id
    join public.team_memberships tm on tm.participant_id = pt.id and tm.team_id = p_team and tm.status = 'active'
    where hg.guardian_id = v_user
  ) then
    raise exception 'you have no child on this team' using errcode = '42501';
  end if;
  return query
    select distinct on (hg.guardian_id) hg.guardian_id, pt.first_name
    from public.household_guardians hg
    join public.participants pt on pt.household_id = hg.household_id
    join public.team_memberships tm on tm.participant_id = pt.id and tm.team_id = p_team and tm.status = 'active'
    join public.parent_chat_prefs pref on pref.profile_id = hg.guardian_id and pref.enabled
    where hg.guardian_id <> v_user
      and not exists (select 1 from public.message_blocks b where (b.blocker_id = v_user and b.blocked_id = hg.guardian_id) or (b.blocker_id = hg.guardian_id and b.blocked_id = v_user))
    order by hg.guardian_id, pt.first_name;
end;
$$;

create or replace function public.open_parent_conversation(p_team uuid, p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_conv uuid;
begin
  if v_user is null then raise exception 'sign in first' using errcode = '28000'; end if;
  if v_user = p_other then raise exception 'you cannot message yourself'; end if;
  if not coalesce((select enabled from public.parent_chat_prefs where profile_id = v_user), false)
     or not coalesce((select enabled from public.parent_chat_prefs where profile_id = p_other), false) then
    raise exception 'both parents need to have parent chat turned on' using errcode = '42501';
  end if;
  if exists (select 1 from public.message_blocks b where (b.blocker_id = v_user and b.blocked_id = p_other) or (b.blocker_id = p_other and b.blocked_id = v_user)) then
    raise exception 'you can’t message this parent' using errcode = '42501';
  end if;
  -- both must be guardians of a child active on this team
  if (
    select count(distinct hg.guardian_id)
    from public.household_guardians hg
    join public.participants pt on pt.household_id = hg.household_id
    join public.team_memberships tm on tm.participant_id = pt.id and tm.team_id = p_team and tm.status = 'active'
    where hg.guardian_id in (v_user, p_other)
  ) <> 2 then
    raise exception 'both parents need a child on this team' using errcode = '42501';
  end if;

  select c.id into v_conv
  from public.conversations c
  where c.kind = 'parent' and c.team_id = p_team
    and exists (select 1 from public.conversation_members m where m.conversation_id = c.id and m.profile_id = v_user)
    and exists (select 1 from public.conversation_members m where m.conversation_id = c.id and m.profile_id = p_other)
  limit 1;
  if v_conv is null then
    insert into public.conversations (kind, team_id) values ('parent', p_team) returning id into v_conv;
    insert into public.conversation_members (conversation_id, profile_id, member_role) values (v_conv, v_user, 'guardian'), (v_conv, p_other, 'guardian');
  end if;
  return v_conv;
end;
$$;

create or replace function public.send_message(p_conversation uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_kind text;
  v_other uuid;
  v_msg uuid;
begin
  if v_user is null then raise exception 'sign in first' using errcode = '28000'; end if;
  if char_length(btrim(coalesce(p_body, ''))) = 0 then raise exception 'write a message first'; end if;
  if char_length(p_body) > 2000 then raise exception 'that message is too long'; end if;
  if not private.is_conversation_member(p_conversation) then
    raise exception 'you are not in this conversation' using errcode = '42501';
  end if;
  select kind into v_kind from public.conversations where id = p_conversation;

  if v_kind = 'parent' then
    if not coalesce((select enabled from public.parent_chat_prefs where profile_id = v_user), false) then
      raise exception 'turn on parent chat to message other parents' using errcode = '42501';
    end if;
    select m.profile_id into v_other from public.conversation_members m where m.conversation_id = p_conversation and m.profile_id <> v_user;
    if exists (select 1 from public.message_blocks b where (b.blocker_id = v_user and b.blocked_id = v_other) or (b.blocker_id = v_other and b.blocked_id = v_user)) then
      raise exception 'you can’t message this parent' using errcode = '42501';
    end if;
    if private.contains_contact_info(p_body) then
      raise exception 'phone numbers, emails and links can’t be shared in parent chats';
    end if;
  end if;

  insert into public.messages (conversation_id, sender_id, body) values (p_conversation, v_user, btrim(p_body)) returning id into v_msg;
  -- Sending counts as having read the thread.
  update public.conversation_members set last_read_at = now() where conversation_id = p_conversation and profile_id = v_user;
  return v_msg;
end;
$$;

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.conversation_members set last_read_at = now()
  where conversation_id = p_conversation and profile_id = (select auth.uid());
$$;

create or replace function public.block_parent(p_other uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'sign in first' using errcode = '28000'; end if;
  insert into public.message_blocks (blocker_id, blocked_id) values (v_user, p_other) on conflict do nothing;
end;
$$;

create or replace function public.report_conversation(p_conversation uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_report uuid;
  v_other uuid;
begin
  if not private.is_conversation_member(p_conversation) then
    raise exception 'you are not in this conversation' using errcode = '42501';
  end if;
  insert into public.message_reports (conversation_id, reporter_id, reason) values (p_conversation, v_user, btrim(p_reason)) returning id into v_report;
  -- Reporting a parent also blocks them.
  select m.profile_id into v_other from public.conversation_members m
    join public.conversations c on c.id = m.conversation_id
    where m.conversation_id = p_conversation and c.kind = 'parent' and m.profile_id <> v_user;
  if v_other is not null then
    insert into public.message_blocks (blocker_id, blocked_id) values (v_user, v_other) on conflict do nothing;
  end if;
  return v_report;
end;
$$;

revoke all on function public.open_coach_conversation(uuid, uuid), public.set_parent_chat(boolean),
  public.list_chat_parents(uuid), public.open_parent_conversation(uuid, uuid), public.send_message(uuid, text),
  public.mark_conversation_read(uuid), public.block_parent(uuid), public.report_conversation(uuid, text) from public, anon;
grant execute on function public.open_coach_conversation(uuid, uuid), public.set_parent_chat(boolean),
  public.list_chat_parents(uuid), public.open_parent_conversation(uuid, uuid), public.send_message(uuid, text),
  public.mark_conversation_read(uuid), public.block_parent(uuid), public.report_conversation(uuid, text) to authenticated;
