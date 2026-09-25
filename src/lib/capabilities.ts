import type { UserRole } from '@/types/domain';

/** Client-side capability map for demo. Production authorization remains RLS. */
export type Capability =
  | 'browse_programs'
  | 'register_child'
  | 'register_self'
  | 'rsvp_own'
  | 'supporter_rsvp'
  | 'record_attendance'
  | 'send_announcement'
  | 'urgent_field_closure'
  | 'edit_schedules'
  | 'assign_child_team'
  | 'view_own_child_dob'
  | 'view_authorized_child_dob'
  | 'club_admin'
  | 'reply_coach'
  | 'review_registrations'
  | 'send_club_announcement'
  | 'create_session_recap'
  | 'send_session_recap'
  | 'view_recap_status'
  | 'audit_coach_updates';

const matrix: Record<Capability, UserRole[]> = {
  browse_programs: ['guest', 'adult_player', 'guardian', 'coach', 'volunteer', 'competition_manager', 'admin'],
  register_child: ['guardian', 'admin'],
  register_self: ['adult_player', 'admin'],
  rsvp_own: ['adult_player', 'guardian', 'coach', 'admin'],
  supporter_rsvp: ['guest', 'adult_player', 'guardian', 'coach', 'volunteer', 'admin'],
  record_attendance: ['coach', 'admin'],
  send_announcement: ['coach', 'competition_manager', 'admin'],
  send_club_announcement: ['admin'],
  create_session_recap: ['coach', 'admin'],
  send_session_recap: ['coach', 'admin'],
  view_recap_status: ['coach', 'competition_manager', 'admin'],
  audit_coach_updates: ['admin'],
  review_registrations: ['competition_manager', 'admin'],
  urgent_field_closure: ['admin'],
  edit_schedules: ['competition_manager', 'admin'],
  assign_child_team: ['admin'],
  view_own_child_dob: ['guardian', 'admin'],
  view_authorized_child_dob: ['coach', 'admin'],
  club_admin: ['admin'],
  reply_coach: ['guardian', 'adult_player', 'coach', 'admin'],
};

export function can(role: UserRole, action: Capability) {
  return matrix[action].includes(role);
}

/** Managers send recaps only when an admin grants send_session_recap. */
export function canSendSessionRecap(role: UserRole, managerGranted = false) {
  if (role === 'coach' || role === 'admin') return true;
  return role === 'competition_manager' && managerGranted;
}

export function canCreateSessionRecap(role: UserRole, teamId?: string, assignedTeamId = 'nova-royals-kids-u8') {
  if (!can(role, 'create_session_recap')) return false;
  if (role === 'admin') return true;
  return Boolean(teamId) && teamId === assignedTeamId;
}

export function isStaff(role: UserRole) {
  return role === 'coach' || role === 'competition_manager' || role === 'admin';
}
