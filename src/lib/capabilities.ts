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
  | 'reply_coach';

const matrix: Record<Capability, UserRole[]> = {
  browse_programs: ['guest', 'adult_player', 'guardian', 'coach', 'volunteer', 'competition_manager', 'admin'],
  register_child: ['guardian', 'admin'],
  register_self: ['adult_player', 'admin'],
  rsvp_own: ['adult_player', 'guardian', 'coach', 'admin'],
  supporter_rsvp: ['guest', 'adult_player', 'guardian', 'coach', 'volunteer', 'admin'],
  record_attendance: ['coach', 'admin'],
  send_announcement: ['coach', 'admin'],
  urgent_field_closure: ['coach', 'admin'],
  edit_schedules: ['coach', 'admin'],
  assign_child_team: ['admin'],
  view_own_child_dob: ['guardian', 'admin'],
  view_authorized_child_dob: ['coach', 'admin'],
  club_admin: ['admin'],
  reply_coach: ['guardian', 'adult_player', 'coach', 'admin'],
};

export function can(role: UserRole, action: Capability) {
  return matrix[action].includes(role);
}

export function isStaff(role: UserRole) {
  return role === 'coach' || role === 'competition_manager' || role === 'admin';
}
