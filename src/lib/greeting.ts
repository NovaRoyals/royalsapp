import type { ClubRelationship, UserRole } from '@/types/domain';

export function firstNameFrom(fullName?: string | null) {
  const token = fullName?.trim().split(/\s+/)[0];
  if (!token || token.toLowerCase() === 'your' || token.toLowerCase() === 'household') return '';
  return token;
}

/** Guest, unknown name, and known first name — never "Your household". */
export function homeGreeting(role: UserRole, fullName?: string | null) {
  if (role === 'guest') return 'Welcome to ROYALS.';
  const first = firstNameFrom(fullName);
  return first ? `Good to see you, ${first}.` : 'Good to see you.';
}

export const RELATIONSHIP_TO_ROLE: Record<ClubRelationship, UserRole> = {
  parent: 'guardian',
  player: 'adult_player',
  supporter: 'volunteer',
  coach: 'volunteer',
  manager: 'volunteer',
};
