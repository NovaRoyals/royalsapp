-- Coach polish: what the `coach-polish` Edge Function needs from the database, and nothing more.
--
--   * polish_context(team)   confirms the caller may draft for that team, applies a rate limit, and
--                            returns the names that must be hidden before any text reaches a model;
--   * log_polish(...)        writes the audit row as the caller, so the function never needs the
--                            service-role key.
--
-- Polishing only produces text for the coach to review. Sending a recap to families is a separate,
-- coach-approved action (session_recaps / coach_updates), and nothing here can do it.

create or replace function public.polish_context(p_team uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_recent integer;
  v_names jsonb;
  c_limit constant integer := 30;
begin
  if v_user is null then raise exception 'sign in first' using errcode = '28000'; end if;
  if p_team is null or not private.can_manage_team(p_team) then
    raise exception 'only this team’s coaches can polish a recap' using errcode = '42501';
  end if;

  select count(*) into v_recent from public.coach_polish_logs
    where coach_id = v_user and created_at > now() - interval '1 hour';
  if v_recent >= c_limit then
    raise exception 'that is a lot of polishing for one hour, try again shortly' using errcode = 'RL001';
  end if;

  -- Every player on the team and every guardian in their households. Lower-cased, one per word,
  -- and nothing shorter than two letters, so initials never turn "a" into a name.
  select coalesce(jsonb_agg(distinct w), '[]'::jsonb) into v_names
  from (
    select lower(btrim(n)) as w
    from (
      select unnest(array[p.first_name, p.last_name, p.preferred_name]) as n
        from public.participants p
        join public.team_memberships tm on tm.participant_id = p.id
        where tm.team_id = p_team
      union all
      select unnest(array[g.first_name, g.last_name])
        from public.participants p
        join public.team_memberships tm on tm.participant_id = p.id
        join public.household_guardians hg on hg.household_id = p.household_id
        join public.profiles g on g.id = hg.guardian_id
        where tm.team_id = p_team
    ) raw
    where n is not null and char_length(btrim(n)) >= 2
  ) names;

  return jsonb_build_object('names', v_names, 'remaining', c_limit - v_recent);
end;
$$;

create or replace function public.log_polish(p_team uuid, p_recap uuid, p_original text, p_generated text, p_mode public.recap_polish_mode)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null then raise exception 'sign in first' using errcode = '28000'; end if;
  if p_team is null or not private.can_manage_team(p_team) then
    raise exception 'only this team’s coaches can polish a recap' using errcode = '42501';
  end if;
  if char_length(coalesce(p_original, '')) > 4000 or char_length(coalesce(p_generated, '')) > 4000 then
    raise exception 'that text is too long';
  end if;
  insert into public.coach_polish_logs (recap_id, coach_id, original_text, generated_text, mode)
    values (p_recap, v_user, coalesce(p_original, ''), coalesce(p_generated, ''), p_mode)
    returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.polish_context(uuid), public.log_polish(uuid, uuid, text, text, public.recap_polish_mode) from public, anon;
grant execute on function public.polish_context(uuid), public.log_polish(uuid, uuid, text, text, public.recap_polish_mode) to authenticated;
