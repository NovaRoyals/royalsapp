export type SportCode = 'soccer' | 'cricket';
export type UserRole = 'guest' | 'adult_player' | 'guardian' | 'coach' | 'competition_manager' | 'admin';
export type CompetitionType = 'league' | 'tournament' | 'friendly' | 'pickup' | 'training';
export type EventType = 'league_match' | 'tournament_match' | 'friendly' | 'training' | 'open_play' | 'club_event';
export type RegistrationStatus = 'draft' | 'submitted' | 'pending' | 'approved' | 'waitlisted' | 'rejected' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'refunded';
export type AttendanceStatus = 'going' | 'maybe' | 'not_going';

export interface Program {
  id: string;
  slug: string;
  title: string;
  sport: SportCode;
  audience: string;
  summary: string;
  description: string;
  dates: string;
  venue: string;
  priceLabel: string;
  registrationOpen: boolean;
  badge?: string;
  heroImage: string;
  facts: { label: string; value: string }[];
  includes: string[];
  factual: boolean;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  dateOfBirth?: string;
  jerseyNumber?: number;
  position?: string;
  isMinor?: boolean;
}

export interface Household {
  id: string;
  guardianName: string;
  email: string;
  phone: string;
  address: string;
  children: Person[];
}

export interface Registration {
  id: string;
  programId: string;
  participantIds: string[];
  participantNames: string[];
  submittedAt: string;
  status: RegistrationStatus;
  amountDue: number;
  discountAmount: number;
  paymentStatus: PaymentStatus;
  demo: boolean;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  sport: SportCode;
  audience: string;
  competitionId: string;
  competitionName: string;
  season: string;
  record: string;
  accent: string;
  memberCount: number;
  roster: Person[];
  managed?: boolean;
}

export interface ScheduleEvent {
  id: string;
  type: EventType;
  sport: SportCode;
  title: string;
  subtitle: string;
  startsAt: string;
  endsAt?: string;
  venue: string;
  address?: string;
  teamId?: string;
  programId?: string;
  competitionId?: string;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled' | 'postponed';
  result?: string;
  attendance?: AttendanceStatus;
  demo?: boolean;
}

export interface StandingRow {
  rank: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  for: number;
  against: number;
  points: number;
  isRoyals?: boolean;
}

export interface Competition {
  id: string;
  title: string;
  type: CompetitionType;
  sport: SportCode;
  season: string;
  organizer: string;
  status: 'upcoming' | 'registration_open' | 'active' | 'completed';
  dates: string;
  location: string;
  format: string;
  eligibility?: string;
  entryFee?: string;
  registrationDeadline?: string;
  description: string;
  externalDisclaimer?: string;
  standings?: StandingRow[];
  teamIds: string[];
  bracketReady?: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: 'club' | 'program' | 'team';
  scopeLabel: string;
  publishedAt: string;
  pinned?: boolean;
}

export interface AppNotification {
  id: string;
  type: 'registration' | 'reminder' | 'change' | 'weather' | 'announcement' | 'result';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  route?: string;
}
