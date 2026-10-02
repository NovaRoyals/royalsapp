export type SportCode = 'soccer' | 'cricket';
export type UserRole = 'guest' | 'adult_player' | 'guardian' | 'coach' | 'volunteer' | 'competition_manager' | 'admin';
export type ClubRelationship = 'parent' | 'player' | 'supporter' | 'coach' | 'manager';
export type AuthProvider = 'google' | 'apple' | 'email';
export type CompetitionType = 'league' | 'tournament' | 'friendly' | 'pickup' | 'training';
export type EventType = 'league_match' | 'tournament_match' | 'friendly' | 'training' | 'open_play' | 'club_event';
export type RegistrationStatus = 'draft' | 'submitted' | 'pending' | 'approved' | 'waitlisted' | 'rejected' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'refunded';
export type AttendanceStatus = 'going' | 'maybe' | 'not_going';
export type FieldStatus = 'open' | 'delayed' | 'inspection_pending' | 'closed' | 'relocated';
export type NoticeUrgency = 'urgent' | 'high' | 'normal' | 'low';
export type EventChangeKind = 'closure' | 'relocation' | 'cancellation' | 'time_change' | 'instruction';
export type ChangeApproval = 'requested' | 'published';

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
  teamId?: string;
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
  /** False when the club has no parent or guardian linked to this child. */
  familyContact?: boolean;
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

/** Intended participation before a session. Distinct from AttendanceMark. */
export interface ParticipantRsvp {
  personId: string;
  personName: string;
  status: AttendanceStatus;
  updatedAt: string;
}

export interface EventChange {
  id: string;
  kind: EventChangeKind;
  reason: string;
  previousVenue?: string;
  previousAddress?: string;
  nextVenue?: string;
  nextAddress?: string;
  actorName: string;
  actorRole: UserRole;
  createdAt: string;
  approval: ChangeApproval;
  notificationStatus: 'queued' | 'delivered';
  reschedulePending?: boolean;
}

export interface VenuePlace {
  id: string;
  name: string;
  fieldNumber: string;
  address: string;
  arrival: string;
  parkingNotes: string;
  entrance: string;
  surface: string;
  restrooms?: string;
}

export interface VenueStatusUpdate {
  id: string;
  venueId: string;
  status: FieldStatus;
  reason: string;
  updatedAt: string;
  updatedBy: string;
  actorRole: UserRole;
  replacementVenueId?: string;
  affectedEventIds: string[];
}

export interface AuditRecord {
  id: string;
  action: string;
  targetId: string;
  actorName: string;
  actorRole: UserRole;
  at: string;
  detail: string;
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
  venueId?: string;
  participantIds?: string[];
  participantRsvps?: ParticipantRsvp[];
  ageGroup?: string;
  sessionNumber?: number;
  sessionTotal?: number;
  arrivalAt?: string;
  rsvpDeadline?: string;
  opponent?: string;
  competitionLabel?: string;
  rosterStatus?: string;
  division?: string;
  checkInAt?: string;
  tournamentName?: string;
  tournamentRange?: string;
  purpose?: string;
  volunteerNeeds?: string;
  instructions?: string;
  previousVenue?: string;
  previousAddress?: string;
  changes?: EventChange[];
  pendingChange?: EventChange;
  reschedulePending?: boolean;
  cancellationReason?: string;
  /** Verified competition facts. Missing fields must not be inferred. */
  storyFacts?: MatchStoryFacts;
  /** Manager-written Home card. Public viewers are not told which lines were written by hand. */
  storyOverride?: MatchStoryOverride;
}

export type MatchStoryAngle =
  | 'elimination'
  | 'qualification'
  | 'final_group'
  | 'semifinal'
  | 'final'
  | 'opener'
  | 'recent_result'
  | 'ordinary';

export interface MatchStoryFacts {
  angle?: MatchStoryAngle;
  stageLabel?: string;
  matchNumber?: number;
  finalGroup?: boolean;
  /** Set only when a verified rule says a win advances this side. */
  winAdvances?: boolean;
  /** Set only when a verified rule says a loss eliminates this side. */
  lossEliminates?: boolean;
  previousResult?: string;
}

export interface MatchStoryOverride {
  headline: string;
  supporting?: string;
  featured?: boolean;
  showSupporterCta?: boolean;
  source: 'manual';
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
  type: 'registration' | 'reminder' | 'change' | 'weather' | 'announcement' | 'result' | 'coach_update' | 'coach_reminder' | 'rsvp' | 'supporter' | 'field';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  route?: string;
  urgency?: NoticeUrgency;
  wouldPush?: boolean;
  childId?: string;
  eventId?: string;
  /** Skip an identical unread alert. Demo stand-in for a server uniqueness key. */
  dedupeKey?: string;
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

export type CoachNoteTag =
  | 'strong_effort'
  | 'great_teamwork'
  | 'improved_confidence'
  | 'excellent_listening'
  | 'practice_first_touch'
  | 'practice_passing'
  | 'coach_follow_up';

export type RecapPolishMode = 'cleanup' | 'warm' | 'verbatim';
export type RecapStatus = 'draft' | 'ready' | 'sent' | 'failed';
export type RecapDelivery = 'now' | 'after_session' | 'tonight';
export type CoachUpdateKind = 'session_recap' | 'private_note' | 'practice_suggestion';

export interface IndividualCoachNote {
  childId: string;
  childFirstName: string;
  tags: CoachNoteTag[];
  originalText: string;
  approvedText: string;
}

export interface SessionRecap {
  id: string;
  eventId: string;
  teamId: string;
  coachName: string;
  originalText: string;
  /** Voice transcript, kept so the coach can restore it. Families never receive this unless it is the editor text. */
  transcript?: string;
  /** Exactly the shared message families receive. */
  message?: string;
  polishedText: string;
  polishMode: RecapPolishMode | null;
  notes: IndividualCoachNote[];
  status: RecapStatus;
  recipientCount: number;
  delivery?: RecapDelivery;
  scheduledFor?: string;
  sentAt?: string;
  deliveryStatus?: 'queued' | 'delivered' | 'failed';
  updatedAt: string;
}

export interface CoachUpdate {
  id: string;
  recapId: string;
  eventId: string;
  kind: CoachUpdateKind;
  title: string;
  body: string;
  childId?: string;
  childFirstName?: string;
  coachName: string;
  sessionTitle: string;
  sessionStartsAt: string;
  sentAt: string;
}
