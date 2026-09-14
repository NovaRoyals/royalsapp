export type SportCode = 'soccer' | 'cricket' | 'fitness';
export type UserRole = 'guest' | 'adult_player' | 'guardian' | 'coach' | 'volunteer' | 'competition_manager' | 'admin';
export type CompetitionType = 'league' | 'tournament' | 'friendly' | 'pickup' | 'training';
export type EventType = 'league_match' | 'tournament_match' | 'friendly' | 'training' | 'open_play' | 'club_event' | 'fitness';
export type RegistrationStatus = 'draft' | 'submitted' | 'pending' | 'approved' | 'waitlisted' | 'rejected' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'refunded';
export type AttendanceStatus = 'going' | 'maybe' | 'not_going';
export type FieldStatus = 'open' | 'closed' | 'delayed';
export type NoticeUrgency = 'urgent' | 'high' | 'normal' | 'low';

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
  whatToBring?: string[];
  coachName?: string;
  coachContact?: string;
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
  teamId?: string;
  coachName?: string;
  waiverVersion?: string;
  firstSessionEventId?: string;
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
  coachName?: string;
  coachContact?: string;
}

export interface AttendanceMark {
  personId: string;
  personName: string;
  present: boolean;
  status: 'present' | 'absent' | 'late';
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
  supporterGoing?: boolean;
  supporterCount?: number;
  goingCount?: number;
  fieldStatus?: FieldStatus;
  parkingNotes?: string;
  weatherSummary?: string;
  whatToBring?: string;
  coachName?: string;
  checkIns?: AttendanceMark[];
  volunteerSpots?: number;
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

export interface AnnouncementReply {
  id: string;
  authorName: string;
  authorRole: UserRole;
  body: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: 'club' | 'program' | 'team';
  scopeLabel: string;
  publishedAt: string;
  pinned?: boolean;
  urgency?: NoticeUrgency;
  teamId?: string;
  programId?: string;
  eventId?: string;
  replies?: AnnouncementReply[];
}

export interface DirectMessage {
  id: string;
  threadId: string;
  fromRole: UserRole;
  fromName: string;
  body: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: 'registration' | 'reminder' | 'change' | 'weather' | 'announcement' | 'result';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  route?: string;
  urgency?: NoticeUrgency;
  wouldPush?: boolean;
}

export interface NotificationPrefs {
  urgent: boolean;
  team: boolean;
  community: boolean;
  locationShare: boolean;
}

export interface HouseholdDocument {
  id: string;
  title: string;
  kind: 'waiver' | 'receipt' | 'policy';
  status: string;
  updatedAt: string;
  registrationId?: string;
}
