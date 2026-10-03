import AsyncStorage from '@react-native-async-storage/async-storage';
import { haptic } from '@/lib/haptics';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  demoAnnouncements,
  demoDirectMessages,
  demoDocuments,
  demoNotifications,
  demoRegistrations,
  demoSchedule,
  emptyHousehold,
  householdForRole,
} from '@/data/demo';
import { InkHold } from '@/components/HydrationGate';
import { SPLASH_SESSION_KEY } from '@/components/SplashOverlay';
import { resetAnalytics, track } from '@/lib/analytics';
import { can, canSendSessionRecap } from '@/lib/capabilities';
import { ACTIVE_COACH, demoDraftRecap, parentUpdatesFromRecap, recapAudience, recapBody } from '@/lib/coachRecap';
import { PAST_DELIVERY_ERROR } from '@/lib/deliveryTiming';
import { hydrateTrace, hydrateTraceEffect } from '@/lib/hydrateTrace';
import { canCancelTeam, toAnnouncement, validateDraft, type Draft } from '@/lib/announcements';
import { checkSend, readKey, senderIdFor, viewerFor } from '@/lib/messaging';
import { applyDecision, canWaive, money, normalizeRegistration, waiveFee, type Decision } from '@/lib/registrationFlow';
import { COACH_TEAM_ID } from '@/lib/membership';
import {
  auditEntry,
  canEditEventInstructions,
  canPublishOperations,
  canRemindNonResponders,
  canRequestOperationalChange,
  canRsvpForPerson,
  changeEntry,
  nonResponders,
  pushUnique,
  rosterForEvent,
  venueUpdate,
  withRsvp,
} from '@/lib/operations';
import { venueById, venueTitle } from '@/data/venues';
import { REGISTRATION_DRAFT_KEY, clearRegistrationDraft } from '@/lib/registrationDraft';
import type {
  Announcement,
  AnnouncementReply,
  AppNotification,
  AttendanceMark,
  AttendanceStatus,
  AuditRecord,
  CoachUpdate,
  DirectMessage,
  MessageReport,
  FieldStatus,
  Household,
  HouseholdDocument,
  NotificationPrefs,
  Person,
  Registration,
  MatchStoryOverride,
  ScheduleEvent,
  SessionRecap,
  UserRole,
  VenueStatusUpdate,
  ClubRelationship,
} from '@/types/domain';

const STORAGE_KEY = '@royals/demo-state/v11';
const LEGACY_STORAGE_KEYS = [
  '@royals/demo-state/v1',
  '@royals/demo-state/v2',
  '@royals/demo-state/v3',
  '@royals/demo-state/v4',
  '@royals/demo-state/v5',
  '@royals/demo-state/v6',
  '@royals/demo-state/v7',
  '@royals/demo-state/v8',
  '@royals/demo-state/v9',
  '@royals/demo-state/v10',
];

export const defaultNotificationPrefs: NotificationPrefs = {
  urgent: true,
  team: true,
  community: true,
  locationShare: false,
};

export const defaultFollowedIds = ['fall-kids-2026', 'nova-royals-women', 'nova-royals-men', 'nova-royals-35plus', 'veterans-soccer', 'nova-royals-cricket'];

export type Persona = 'visitor' | 'demo';

type PersistedState = {
  persona: Persona;
  role: UserRole;
  household: Household;
  registrations: Registration[];
  schedule: ScheduleEvent[];
  notifications: AppNotification[];
  announcements: Announcement[];
  messages: DirectMessage[];
  documents: HouseholdDocument[];
  followedIds: string[];
  notificationPrefs: NotificationPrefs;
  onboardingCompleted: boolean;
  introCompleted: boolean;
  pendingStaffRole?: 'coach' | 'competition_manager' | null;
  relationship?: ClubRelationship | null;
  recaps: SessionRecap[];
  coachUpdates: CoachUpdate[];
  managerCanSendRecap: boolean;
  venueUpdates: VenueStatusUpdate[];
  audit: AuditRecord[];
  /** Last time each person opened each thread, keyed `viewerId|threadId`. */
  threadReads: Record<string, string>;
  /** Parent-to-parent chat is off until a parent turns it on. */
  parentChatOn: boolean;
  blockedThreads: string[];
  reports: MessageReport[];
};

type NewRegistration = Omit<Registration, 'id' | 'submittedAt' | 'demo'>;

interface AppState extends PersistedState {
  hydrated: boolean;
  hasHydrated: boolean;
  setRole: (role: UserRole) => void;
  loadDemoPersona: (role: UserRole) => void;
  completeOnboarding: (input: {
    role: UserRole;
    relationship?: ClubRelationship | null;
    children?: Person[];
    followedIds?: string[];
    notificationPrefs: NotificationPrefs;
    guardianName?: string;
    email?: string;
    pendingStaffRole?: 'coach' | 'competition_manager' | null;
  }) => void;
  setFollowedIds: (ids: string[]) => void;
  setNotificationPrefs: (prefs: NotificationPrefs) => void;
  addChild: (child: Omit<Person, 'id' | 'displayName' | 'isMinor'>) => Person;
  submitRegistration: (registration: NewRegistration) => Registration;
  setAttendance: (eventId: string, status: AttendanceStatus) => void;
  setParticipantRsvp: (eventId: string, personId: string, status: AttendanceStatus) => void;
  setSupporter: (eventId: string, going: boolean) => void;
  setMatchStory: (eventId: string, override: MatchStoryOverride | null) => void;
  setFieldStatus: (eventId: string, status: FieldStatus, reason?: string) => void;
  closeVenue: (venueId: string, reason: string) => void;
  relocateEvent: (eventId: string, venueId: string, reason?: string) => void;
  cancelEvent: (eventId: string, reason: string) => void;
  requestOperationalChange: (eventId: string, kind: 'relocation' | 'cancellation', reason: string) => void;
  setEventInstructions: (eventId: string, instructions: string) => void;
  remindNonResponders: (eventId: string) => number;
  recordCheckIn: (eventId: string, mark: AttendanceMark) => void;
  recordAllPresent: (eventId: string, people: Person[]) => void;
  decideRegistration: (registrationId: string, decision: Decision, reason?: string) => void;
  waiveRegistrationFee: (registrationId: string, reason: string) => void;
  assignRegistrationTeam: (registrationId: string, teamId: string, coachName: string) => void;
  updateEventResult: (eventId: string, result: string) => void;
  upsertEvent: (event: ScheduleEvent) => void;
  publishAnnouncement: (draft: Draft) => { ok: boolean; error?: string; id?: string };
  postWeatherWatch: (event: ScheduleEvent, outlook: { level: 'good' | 'watch' | 'risky'; family: string; staff: string }) => void;
  replyToAnnouncement: (announcementId: string, body: string) => void;
  sendDirectMessage: (threadId: string, body: string) => { ok: boolean; error?: string };
  markThreadRead: (threadId: string) => void;
  setParentChat: (on: boolean) => void;
  blockThread: (threadId: string, blocked: boolean) => void;
  reportThread: (threadId: string, reason: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  saveRecapDraft: (recap: SessionRecap) => void;
  sendSessionRecap: (recap: SessionRecap) => { ok: boolean; error?: string };
  setManagerCanSendRecap: (granted: boolean) => void;
  resetDemo: () => Promise<void>;
  completeIntro: () => void;
}

function mergeClubSchedule(overlays: ScheduleEvent[] = []) {
  const catalogIds = new Set(demoSchedule.map((event) => event.id));
  const extra = overlays.filter((item) => !catalogIds.has(item.id) && !item.demo && item.id !== 'club-event-1');
  return [
    ...demoSchedule.map((event) => {
      const overlay = overlays.find((item) => item.id === event.id);
      if (!overlay) return event;
      return {
        ...event,
        attendance: overlay.attendance ?? event.attendance,
        supporterGoing: overlay.supporterGoing ?? event.supporterGoing,
        supporterCount: overlay.supporterCount ?? event.supporterCount,
        goingCount: overlay.goingCount ?? event.goingCount,
        fieldStatus: overlay.fieldStatus ?? event.fieldStatus,
        checkIns: overlay.checkIns ?? event.checkIns,
        result: event.sport === 'cricket' ? event.result : overlay.result ?? event.result,
        status: overlay.status ?? event.status,
        participantRsvps: overlay.participantRsvps ?? event.participantRsvps,
        participantIds: overlay.participantIds ?? event.participantIds,
        venue: overlay.venue ?? event.venue,
        address: overlay.address ?? event.address,
        venueId: overlay.venueId ?? event.venueId,
        previousVenue: overlay.previousVenue ?? event.previousVenue,
        previousAddress: overlay.previousAddress ?? event.previousAddress,
        changes: overlay.changes ?? event.changes,
        pendingChange: overlay.pendingChange ?? event.pendingChange,
        instructions: overlay.instructions ?? event.instructions,
        storyOverride: overlay.storyOverride ?? event.storyOverride,
        storyFacts: overlay.storyFacts ?? event.storyFacts,
        cancellationReason: overlay.cancellationReason ?? event.cancellationReason,
        reschedulePending: overlay.reschedulePending ?? event.reschedulePending,
      };
    }),
    ...extra,
  ].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

function mergeFollowedIds(ids?: string[]) {
  return [...new Set([...(ids?.length ? ids : defaultFollowedIds), 'nova-royals-35plus', 'veterans-soccer'])];
}

function mergeById<T extends { id: string }>(base: T[], extra: T[]) {
  const ids = new Set(base.map((item) => item.id));
  return [...base, ...extra.filter((item) => !ids.has(item.id))];
}

function keepClubComms(next: PersistedState, current: PersistedState): PersistedState {
  const kept = keepRecapComms(next, current);
  // A message you sent as a parent has to be waiting for the coach, and the other way round.
  const messageAlerts = (current.notifications ?? []).filter((item) => item.type === 'message' || Boolean(item.announcementId));
  return {
    ...kept,
    messages: mergeById(next.messages ?? [], current.messages ?? []),
    announcements: mergeById(current.announcements ?? [], next.announcements ?? []),
    threadReads: { ...(next.threadReads ?? {}), ...(current.threadReads ?? {}) },
    parentChatOn: current.parentChatOn ?? next.parentChatOn,
    blockedThreads: current.blockedThreads ?? next.blockedThreads,
    reports: current.reports ?? next.reports,
    notifications: mergeById(messageAlerts, kept.notifications.filter((item) => !messageAlerts.some((alert) => alert.id === item.id))),
  };
}

function keepRecapComms(next: PersistedState, current: PersistedState): PersistedState {
  const sent = (current.coachUpdates ?? []).length > 0;
  return {
    ...next,
    recaps: (current.recaps ?? []).length ? current.recaps : next.recaps,
    coachUpdates: sent ? current.coachUpdates : next.coachUpdates,
    managerCanSendRecap: current.managerCanSendRecap,
    notifications: sent
      ? [
          ...current.notifications.filter((item) => item.type === 'coach_update' || item.type === 'coach_reminder'),
          ...next.notifications.filter((item) => item.type !== 'coach_update' && item.id !== 'notification-coach-recap-sep20'),
        ]
      : (current.recaps ?? []).some((item) => item.status === 'sent')
        ? current.notifications
        : next.notifications,
  };
}

function visitorNotifications() {
  return demoNotifications.filter((item) => item.type === 'announcement' || item.type === 'weather');
}

function mergeRegistrations(saved?: Registration[]) {
  const base = saved ?? [];
  const ids = new Set(base.map((item) => item.id));
  return [...base, ...demoRegistrations.filter((item) => !ids.has(item.id))].map(normalizeRegistration);
}

function visitorSeed(role: UserRole = 'guest'): PersistedState {
  return {
    persona: 'visitor',
    role,
    household: emptyHousehold,
    registrations: [],
    schedule: demoSchedule,
    notifications: visitorNotifications(),
    announcements: demoAnnouncements,
    messages: [],
    documents: [],
    followedIds: [],
    notificationPrefs: defaultNotificationPrefs,
    onboardingCompleted: false,
    introCompleted: false,
    pendingStaffRole: null,
    relationship: null,
    recaps: [],
    coachUpdates: [],
    managerCanSendRecap: false,
    venueUpdates: [],
    audit: [],
    // Both sides had read the September exchange; only newer messages are unread.
    threadReads: {
      'guardian:household-demo|coach-priya': '2026-09-12T20:25:00-04:00',
      'coach:priya|coach-priya': '2026-09-12T20:30:00-04:00',
    },
    parentChatOn: false,
    blockedThreads: [],
    reports: [],
  };
}

function demoSeed(role: UserRole): PersistedState {
  return {
    persona: 'demo',
    role,
    household: householdForRole(role),
    registrations: demoRegistrations,
    schedule: demoSchedule,
    notifications: demoNotifications,
    announcements: demoAnnouncements,
    messages: demoDirectMessages,
    documents: demoDocuments,
    followedIds: defaultFollowedIds,
    notificationPrefs: defaultNotificationPrefs,
    onboardingCompleted: role !== 'guest',
    introCompleted: true,
    pendingStaffRole: null,
    relationship: null,
    recaps: [demoDraftRecap()],
    coachUpdates: [],
    managerCanSendRecap: false,
    venueUpdates: [],
    audit: [],
    threadReads: {},
    parentChatOn: false,
    blockedThreads: [],
    reports: [],
  };
}

const initialState: PersistedState = visitorSeed('guest');

const AppContext = createContext<AppState | null>(null);

function hapticLight() {
  haptic('light');
}

function notice(partial: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): AppNotification {
  return {
    ...partial,
    id: `notification-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    read: false,
  };
}

function readPersistedState(saved: string | null): PersistedState {
  if (!saved) return { ...initialState, schedule: mergeClubSchedule() };
  const parsed = JSON.parse(saved) as Partial<PersistedState>;
  const role = parsed.role ?? 'guest';
  const demoHouseholdLoaded =
    parsed.household?.id === 'household-demo' || parsed.household?.id === 'household-coach';
  const persona: Persona =
    parsed.persona ?? (role !== 'guest' && demoHouseholdLoaded ? 'demo' : 'visitor');
  if (persona === 'demo' && role !== 'guest') {
    return {
      ...demoSeed(role),
      ...parsed,
      persona: 'demo',
      role,
      introCompleted: parsed.introCompleted ?? true,
      schedule: mergeClubSchedule(parsed.schedule),
      registrations: mergeRegistrations(parsed.registrations),
      followedIds: mergeFollowedIds(parsed.followedIds),
      household: householdForRole(role),
      venueUpdates: parsed.venueUpdates ?? [],
      audit: parsed.audit ?? [],
      threadReads: parsed.threadReads ?? {},
      parentChatOn: parsed.parentChatOn ?? false,
      blockedThreads: parsed.blockedThreads ?? [],
      reports: parsed.reports ?? [],
      messages: mergeById(demoDirectMessages, parsed.messages ?? []),
      recaps: (parsed.recaps ?? [demoDraftRecap()]).map((item) => ({ ...item, coachName: ACTIVE_COACH.displayName })),
      coachUpdates: (parsed.coachUpdates ?? []).map((item) => ({ ...item, coachName: ACTIVE_COACH.displayName })),
      managerCanSendRecap: parsed.managerCanSendRecap ?? false,
    };
  }
  return {
    ...visitorSeed(role),
    ...parsed,
    persona: 'visitor',
    role,
    household: demoHouseholdLoaded || !parsed.household ? emptyHousehold : parsed.household,
    registrations: (parsed.registrations ?? []).filter((item) => !item.demo).map(normalizeRegistration),
    documents: parsed.documents ?? [],
    messages: parsed.messages ?? [],
    introCompleted: parsed.introCompleted ?? false,
    notifications: parsed.notifications ?? visitorNotifications(),
    schedule: mergeClubSchedule(parsed.schedule),
    followedIds: parsed.followedIds ?? [],
    relationship: parsed.relationship ?? null,
    recaps: parsed.recaps ?? [],
    coachUpdates: parsed.coachUpdates ?? [],
    managerCanSendRecap: parsed.managerCanSendRecap ?? false,
    venueUpdates: parsed.venueUpdates ?? [],
    audit: parsed.audit ?? [],
    threadReads: parsed.threadReads ?? {},
    parentChatOn: parsed.parentChatOn ?? false,
    blockedThreads: parsed.blockedThreads ?? [],
    reports: parsed.reports ?? [],
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedState>(initialState);
  // The latest state, for actions that must validate before they change anything.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const [hydrated, setHydrated] = useState(false);

  hydrateTrace('AppProvider', {
    hasHydrated: hydrated,
    introCompleted: state.introCompleted,
    role: state.role,
    sentRecaps: state.recaps.filter((item) => item.status === 'sent').length,
    coachUpdates: state.coachUpdates.length,
  });

  useEffect(() => {
    let alive = true;
    Promise.all(LEGACY_STORAGE_KEYS.map((key) => AsyncStorage.removeItem(key)))
      .then(() => AsyncStorage.getItem(STORAGE_KEY))
      .then((saved) => {
        const next = readPersistedState(saved);
        hydrateTraceEffect('AppProvider', {
          hasHydrated: true,
          introCompleted: next.introCompleted,
          role: next.role,
          sentRecaps: next.recaps.filter((item) => item.status === 'sent').length,
          coachUpdates: next.coachUpdates.length,
          hadStorage: Boolean(saved),
        });
        if (!alive) return;
        setState(next);
        setHydrated(true);
      })
      .catch(() => {
        if (!alive) return;
        setState({ ...initialState, schedule: mergeClubSchedule() });
        setHydrated(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (hydrated) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, schedule: mergeClubSchedule(state.schedule) })).catch(
        () => undefined,
      );
    }
  }, [hydrated, state]);

  const setRole = useCallback((role: UserRole) => {
    hapticLight();
    setState((current) => {
      const schedule = mergeClubSchedule(current.schedule);
      if (role === 'guest') {
        // Going back to a guest must not leave a family's half-finished form on the device.
        AsyncStorage.removeItem(REGISTRATION_DRAFT_KEY).catch(() => undefined);
        return { ...visitorSeed('guest'), introCompleted: true, schedule };
      }
      return keepClubComms({ ...demoSeed(role), schedule }, current);
    });
  }, []);

  const completeIntro = useCallback(() => {
    hapticLight();
    setState((current) => ({
      ...visitorSeed('guest'),
      introCompleted: true,
      schedule: mergeClubSchedule(current.schedule),
    }));
  }, []);

  const loadDemoPersona = useCallback((role: UserRole) => {
    hapticLight();
    setState((current) => keepClubComms({ ...demoSeed(role), schedule: mergeClubSchedule(current.schedule) }, current));
  }, []);

  const completeOnboarding = useCallback(
    (input: {
      role: UserRole;
      relationship?: ClubRelationship | null;
      children?: Person[];
      followedIds?: string[];
      notificationPrefs: NotificationPrefs;
      guardianName?: string;
      email?: string;
      pendingStaffRole?: 'coach' | 'competition_manager' | null;
    }) => {
      const name = input.guardianName?.trim() ?? '';
      setState((current) => ({
        ...visitorSeed(input.role),
        persona: 'visitor',
        role: input.role,
        relationship: input.relationship ?? null,
        onboardingCompleted: true,
        introCompleted: true,
        pendingStaffRole: input.pendingStaffRole ?? null,
        followedIds: input.followedIds ?? [],
        notificationPrefs: input.notificationPrefs,
        household: {
          ...emptyHousehold,
          guardianName: name,
          email: input.email?.trim() || '',
          children: input.children ?? [],
        },
        schedule: mergeClubSchedule(current.schedule),
        registrations: [],
        documents: [],
        messages: [],
        recaps: current.recaps,
        coachUpdates: current.coachUpdates,
        managerCanSendRecap: current.managerCanSendRecap,
      }));
      hapticLight();
    },
    [],
  );

  const setFollowedIds = useCallback((ids: string[]) => {
    setState((current) => ({ ...current, followedIds: ids }));
  }, []);

  const setNotificationPrefs = useCallback((prefs: NotificationPrefs) => {
    setState((current) => ({ ...current, notificationPrefs: prefs }));
  }, []);

  const addChild = useCallback((child: Omit<Person, 'id' | 'displayName' | 'isMinor'>) => {
    const created: Person = {
      ...child,
      id: `child-${Date.now()}`,
      displayName: `${child.firstName} ${child.lastName.slice(0, 1)}.`,
      isMinor: true,
    };
    setState((current) => ({
      ...current,
      household: { ...current.household, children: [...current.household.children, created] },
    }));
    track('child_added');
    hapticLight();
    return created;
  }, []);

  const submitRegistration = useCallback((registration: NewRegistration) => {
    const created: Registration = {
      firstSessionEventId: registration.programId === 'fall-kids-2026' ? 'kids-session-1' : undefined,
      waiverVersion: 'placeholder-2026.1',
      ...registration,
      id: `reg-${Date.now()}`,
      submittedAt: new Date().toISOString(),
      demo: true,
    };
    const alert = notice({
      type: 'registration',
      title: 'Registration received',
      body: `${registration.participantNames.join(', ')} ${registration.participantNames.length > 1 ? 'are' : 'is'} with the club for review. Nothing has been charged.`,
      route: `/season/${created.id}`,
      urgency: 'normal',
      wouldPush: true,
    });
    setState((current) => ({
      ...current,
      registrations: [created, ...current.registrations],
      notifications: [alert, ...current.notifications],
      documents: [
        {
          id: `doc-${created.id}`,
          title: 'Participation waiver',
          kind: 'waiver',
          status: 'Signed · placeholder language',
          updatedAt: created.submittedAt,
          registrationId: created.id,
        },
        ...current.documents,
      ],
    }));
    track('registration_completed', { programId: registration.programId });
    haptic('success');
    return created;
  }, []);

  const setAttendance = useCallback((eventId: string, status: AttendanceStatus) => {
    setState((current) => {
      if (current.role !== 'adult_player' && current.role !== 'admin') return current;
      const schedule = mergeClubSchedule(current.schedule).map((event) => {
        if (event.id !== eventId) return event;
        if (current.role === 'adult_player' && event.teamId !== 'nova-royals-men') return event;
        const prev = event.attendance;
        let goingCount = event.goingCount ?? 0;
        if (status === 'going' && prev !== 'going') goingCount += 1;
        if (prev === 'going' && status !== 'going') goingCount = Math.max(0, goingCount - 1);
        return { ...event, attendance: status, goingCount };
      });
      const event = schedule.find((item) => item.id === eventId);
      const alert = event
        ? notice({
            type: 'rsvp',
            title: status === 'going' ? 'You’re going' : status === 'maybe' ? 'Marked as not sure' : 'Can’t make it',
            body: `${event.title} · ${event.venue}`,
            route: `/event/${eventId}`,
            eventId,
            urgency: 'normal',
            dedupeKey: `rsvp-self:${eventId}:${status}`,
          })
        : null;
      return {
        ...current,
        schedule,
        notifications: alert ? pushUnique(current.notifications, alert) : current.notifications,
      };
    });
    track('rsvp_completed', { eventId });
  }, []);

  const setParticipantRsvp = useCallback((eventId: string, personId: string, status: AttendanceStatus) => {
    setState((current) => {
      const child = current.household.children.find((item) => item.id === personId);
      if (!canRsvpForPerson(current.role, personId, current.household.children) || !child) return current;
      const schedule = mergeClubSchedule(current.schedule).map((event) => {
        if (event.id !== eventId) return event;
        if (!event.participantIds?.includes(personId)) return event;
        return withRsvp(event, child, status, new Date().toISOString());
      });
      const event = schedule.find((item) => item.id === eventId);
      const label = status === 'going' ? 'Going' : status === 'maybe' ? 'Not sure' : 'Can’t make it';
      const alert = event
        ? notice({
            type: 'rsvp',
            title: `${child.firstName} — ${label}`,
            body: `${event.title} · ${event.venue}`,
            route: `/event/${eventId}`,
            eventId,
            childId: child.id,
            urgency: 'normal',
            dedupeKey: `rsvp:${eventId}:${personId}:${status}`,
          })
        : null;
      return {
        ...current,
        schedule,
        notifications: alert ? pushUnique(current.notifications, alert) : current.notifications,
        audit: [
          auditEntry({
            action: 'participant_rsvp',
            targetId: eventId,
            actorName: current.household.guardianName || 'Parent',
            actorRole: current.role,
            detail: `${child.firstName} · ${label}`,
          }),
          ...current.audit,
        ],
      };
    });
    track('rsvp_completed', { eventId, personId });
    hapticLight();
  }, []);

  const setSupporter = useCallback((eventId: string, going: boolean) => {
    setState((current) => {
      if (current.role === 'guest') return current;
      const schedule = mergeClubSchedule(current.schedule).map((event) => {
        if (event.id !== eventId) return event;
        const base = event.supporterCount ?? 0;
        const was = Boolean(event.supporterGoing);
        let count = base;
        if (going && !was) count += 1;
        if (!going && was) count = Math.max(0, count - 1);
        return { ...event, supporterGoing: going, supporterCount: count };
      });
      const event = schedule.find((item) => item.id === eventId);
      const alert =
        event && going
          ? notice({
              type: 'supporter',
              title: 'You’re supporting',
              body: `${event.title} · ${event.venue}. This does not add you to the roster.`,
              route: `/event/${eventId}`,
              eventId,
              urgency: 'normal',
              dedupeKey: `support:${eventId}`,
            })
          : null;
      return {
        ...current,
        schedule,
        notifications: alert ? pushUnique(current.notifications, alert) : current.notifications,
      };
    });
    hapticLight();
  }, []);

  const setMatchStory = useCallback((eventId: string, override: MatchStoryOverride | null) => {
    setState((current) => {
      if (current.role !== 'admin' && current.role !== 'competition_manager') return current;
      const schedule = mergeClubSchedule(current.schedule).map((event) =>
        event.id === eventId ? { ...event, storyOverride: override ?? undefined } : event,
      );
      return { ...current, schedule };
    });
  }, []);

  const closeVenue = useCallback((venueId: string, reason: string) => {
    setState((current) => {
      if (!canPublishOperations(current.role)) return current;
      const place = venueById(venueId);
      const placeName = place ? venueTitle(place) : 'Field';
      const schedule = mergeClubSchedule(current.schedule);
      const affected = schedule.filter((event) => event.venueId === venueId && event.status !== 'completed');
      const change = changeEntry({
        kind: 'closure',
        reason,
        actorName: 'Club administrator',
        actorRole: 'admin',
        approval: 'published',
        previousVenue: placeName,
      });
      const next = schedule.map((event) =>
        affected.some((item) => item.id === event.id)
          ? { ...event, fieldStatus: 'closed' as const, changes: [change, ...(event.changes ?? [])] }
          : event,
      );
      const primary = affected[0];
      const alert = notice({
        type: 'field',
        title: `${placeName} is closed`,
        body: reason,
        route: primary ? `/event/${primary.id}` : `/venue/${venueId}`,
        eventId: primary?.id,
        urgency: 'urgent',
        wouldPush: true,
        dedupeKey: `field-closed:${venueId}`,
      });
      const update = venueUpdate({
        venueId,
        status: 'closed',
        reason,
        updatedBy: 'Club administrator',
        actorRole: 'admin',
        affectedEventIds: affected.map((item) => item.id),
      });
      return {
        ...current,
        schedule: next,
        venueUpdates: [update, ...current.venueUpdates],
        notifications: pushUnique(current.notifications, alert),
        audit: [
          auditEntry({
            action: 'field_closure',
            targetId: venueId,
            actorName: 'Club administrator',
            actorRole: 'admin',
            detail: reason,
          }),
          ...current.audit,
        ],
      };
    });
    haptic('warning');
  }, []);

  const setFieldStatus = useCallback((eventId: string, status: FieldStatus, reason?: string) => {
    setState((current) => {
      if (!canPublishOperations(current.role)) return current;
      const base = mergeClubSchedule(current.schedule);
      const target = base.find((item) => item.id === eventId);
      if (!target) return current;
      if (status === 'closed' && target.venueId) {
        const place = venueById(target.venueId);
        const placeName = place ? venueTitle(place) : target.venue;
        const affected = base.filter((event) => event.venueId === target.venueId && event.status !== 'completed');
        const closureReason = reason || `${placeName} is closed due to unsafe conditions.`;
        const change = changeEntry({
          kind: 'closure',
          reason: closureReason,
          actorName: 'Club administrator',
          actorRole: 'admin',
          approval: 'published',
          previousVenue: placeName,
        });
        const schedule = base.map((event) =>
          affected.some((item) => item.id === event.id)
            ? { ...event, fieldStatus: 'closed' as const, changes: [change, ...(event.changes ?? [])] }
            : event,
        );
        const alert = notice({
          type: 'field',
          title: `${placeName} is closed`,
          body: closureReason,
          route: `/event/${eventId}`,
          eventId,
          urgency: 'urgent',
          wouldPush: true,
          dedupeKey: `field-closed:${target.venueId}`,
        });
        return {
          ...current,
          schedule,
          notifications: pushUnique(current.notifications, alert),
          venueUpdates: [
            venueUpdate({
              venueId: target.venueId,
              status: 'closed',
              reason: closureReason,
              updatedBy: 'Club administrator',
              actorRole: 'admin',
              affectedEventIds: affected.map((item) => item.id),
            }),
            ...current.venueUpdates,
          ],
          audit: [
            auditEntry({
              action: 'field_closure',
              targetId: target.venueId,
              actorName: 'Club administrator',
              actorRole: 'admin',
              detail: closureReason,
            }),
            ...current.audit,
          ],
        };
      }
      const reopening = status === 'open' && target.venueId;
      const schedule = base.map((event) => {
        if (reopening && event.venueId === target.venueId && event.fieldStatus === 'closed') {
          return { ...event, fieldStatus: 'open' as const };
        }
        if (event.id === eventId) return { ...event, fieldStatus: status };
        return event;
      });
      return { ...current, schedule };
    });
    haptic(status === 'closed' ? 'warning' : 'light');
  }, []);

  const relocateEvent = useCallback((eventId: string, venueId: string, reason?: string) => {
    setState((current) => {
      if (!canPublishOperations(current.role)) return current;
      const place = venueById(venueId);
      if (!place) return current;
      const nextLabel = venueTitle(place);
      const schedule = mergeClubSchedule(current.schedule).map((event) => {
        if (event.id !== eventId) return event;
        const change = changeEntry({
          kind: 'relocation',
          reason: reason || `Moved to ${nextLabel}.`,
          previousVenue: event.venue,
          previousAddress: event.address,
          nextVenue: nextLabel,
          nextAddress: place.address,
          actorName: 'Club administrator',
          actorRole: 'admin',
          approval: 'published',
        });
        return {
          ...event,
          previousVenue: event.venue,
          previousAddress: event.address,
          venue: nextLabel,
          address: place.address,
          venueId: place.id,
          fieldStatus: 'relocated' as const,
          parkingNotes: place.parkingNotes,
          pendingChange: undefined,
          changes: [change, ...(event.changes ?? [])],
        };
      });
      const event = schedule.find((item) => item.id === eventId);
      const alert = event
        ? notice({
            type: 'field',
            title: `${event.title} moved to ${event.venue}`,
            body: event.previousVenue ? `Previous location: ${event.previousVenue}. Directions now use ${event.venue}.` : `Now at ${event.venue}.`,
            route: `/event/${eventId}`,
            eventId,
            urgency: 'high',
            wouldPush: true,
            dedupeKey: `relocated:${eventId}:${venueId}`,
          })
        : null;
      return {
        ...current,
        schedule,
        notifications: alert ? pushUnique(current.notifications, alert) : current.notifications,
        audit: [
          auditEntry({
            action: 'relocation',
            targetId: eventId,
            actorName: 'Club administrator',
            actorRole: 'admin',
            detail: event ? `${event.previousVenue} → ${event.venue}` : venueId,
          }),
          ...current.audit,
        ],
      };
    });
    haptic('warning');
  }, []);

  const cancelEvent = useCallback((eventId: string, reason: string) => {
    setState((current) => {
      if (!canPublishOperations(current.role)) return current;
      const schedule = mergeClubSchedule(current.schedule).map((event) => {
        if (event.id !== eventId) return event;
        const change = changeEntry({
          kind: 'cancellation',
          reason,
          actorName: 'Club administrator',
          actorRole: 'admin',
          approval: 'published',
          reschedulePending: true,
        });
        return {
          ...event,
          status: 'cancelled' as const,
          cancellationReason: reason,
          reschedulePending: true,
          pendingChange: undefined,
          changes: [change, ...(event.changes ?? [])],
        };
      });
      const event = schedule.find((item) => item.id === eventId);
      const alert = event
        ? notice({
            type: 'change',
            title: `${event.title} is cancelled`,
            body: `${reason} Rescheduling information is pending.`,
            route: `/event/${eventId}`,
            eventId,
            urgency: 'urgent',
            wouldPush: true,
            dedupeKey: `cancelled:${eventId}`,
          })
        : null;
      return {
        ...current,
        schedule,
        notifications: alert ? pushUnique(current.notifications, alert) : current.notifications,
        audit: [
          auditEntry({
            action: 'cancellation',
            targetId: eventId,
            actorName: 'Club administrator',
            actorRole: 'admin',
            detail: reason,
          }),
          ...current.audit,
        ],
      };
    });
    haptic('warning');
  }, []);

  const requestOperationalChange = useCallback((eventId: string, kind: 'relocation' | 'cancellation', reason: string) => {
    setState((current) => {
      const scheduleBase = mergeClubSchedule(current.schedule);
      const target = scheduleBase.find((item) => item.id === eventId);
      if (!target || !canRequestOperationalChange(current.role, target.teamId)) return current;
      const actorName = current.role === 'coach' ? 'Coach Priya Sharma' : 'Team manager';
      const pending = changeEntry({
        kind,
        reason,
        actorName,
        actorRole: current.role,
        approval: 'requested',
        previousVenue: target.venue,
      });
      const schedule = scheduleBase.map((event) => (event.id === eventId ? { ...event, pendingChange: pending } : event));
      const alert = notice({
        type: 'coach_reminder',
        title: kind === 'relocation' ? 'Relocation requested' : 'Cancellation requested',
        body: `${target.title}. ${reason} A club admin still needs to publish this. Families are not notified by this request.`,
        route: `/event/${eventId}`,
        eventId,
        urgency: 'normal',
        wouldPush: false,
        dedupeKey: `request:${eventId}:${kind}`,
      });
      return {
        ...current,
        schedule,
        notifications: pushUnique(current.notifications, alert),
        audit: [
          auditEntry({
            action: `request_${kind}`,
            targetId: eventId,
            actorName,
            actorRole: current.role,
            detail: reason,
          }),
          ...current.audit,
        ],
      };
    });
    hapticLight();
  }, []);

  const setEventInstructions = useCallback((eventId: string, instructions: string) => {
    setState((current) => {
      const target = mergeClubSchedule(current.schedule).find((item) => item.id === eventId);
      if (!target || !canEditEventInstructions(current.role, target.teamId)) return current;
      const actorName = current.role === 'admin' ? 'Club administrator' : current.role === 'coach' ? 'Coach Priya Sharma' : 'Team manager';
      return {
        ...current,
        schedule: mergeClubSchedule(current.schedule).map((event) =>
          event.id === eventId ? { ...event, instructions: instructions.trim() } : event,
        ),
        audit: [
          auditEntry({
            action: 'event_instructions',
            targetId: eventId,
            actorName,
            actorRole: current.role,
            detail: instructions.trim(),
          }),
          ...current.audit,
        ],
      };
    });
    hapticLight();
  }, []);

  const remindNonResponders = useCallback((eventId: string) => {
    let sent = 0;
    setState((current) => {
      const event = mergeClubSchedule(current.schedule).find((item) => item.id === eventId);
      if (!event || !canRemindNonResponders(current.role, event.teamId)) return current;
      const waiting = nonResponders(event, rosterForEvent(event));
      sent = waiting.length;
      if (!waiting.length) return current;
      const familyAlerts = waiting
        .filter((person) => current.household.children.some((child) => child.id === person.id))
        .map((person) =>
          notice({
            type: 'reminder',
            title: 'Coach is waiting for a response',
            body: `${person.firstName} has not responded for ${event.title}.`,
            route: `/event/${eventId}`,
            eventId,
            childId: person.id,
            urgency: 'high',
            dedupeKey: `remind:${eventId}:${person.id}`,
          }),
        );
      const coachAlert = notice({
        type: 'coach_reminder',
        title: 'Reminder queued',
        body: `${waiting.length} ${waiting.length === 1 ? 'family has' : 'families have'} not responded. Families who already replied were not included.`,
        route: `/event/${eventId}`,
        eventId,
        urgency: 'normal',
        dedupeKey: `remind-coach:${eventId}:${waiting.map((person) => person.id).sort().join(',')}`,
      });
      let notifications = current.notifications;
      for (const alert of [coachAlert, ...familyAlerts]) notifications = pushUnique(notifications, alert);
      return { ...current, notifications };
    });
    hapticLight();
    return sent;
  }, []);

  const recordCheckIn = useCallback((eventId: string, mark: AttendanceMark) => {
    const normalized: AttendanceMark = {
      ...mark,
      status: mark.status ?? (mark.present ? 'present' : 'absent'),
      present: mark.status ? mark.status !== 'absent' : mark.present,
    };
    setState((current) => ({
      ...current,
      schedule: mergeClubSchedule(current.schedule).map((event) => {
        if (event.id !== eventId) return event;
        const others = (event.checkIns ?? []).filter((item) => item.personId !== mark.personId);
        return { ...event, checkIns: [...others, normalized] };
      }),
    }));
    track('attendance_recorded', { eventId });
    hapticLight();
  }, []);

  const recordAllPresent = useCallback((eventId: string, people: Person[]) => {
    setState((current) => ({
      ...current,
      schedule: mergeClubSchedule(current.schedule).map((event) => {
        if (event.id !== eventId) return event;
        const existing = event.checkIns ?? [];
        const unrecorded = people.filter((person) => !existing.some((mark) => mark.personId === person.id));
        return {
          ...event,
          checkIns: [
            ...existing,
            ...unrecorded.map((person) => ({
              personId: person.id,
              personName: person.displayName,
              present: true,
              status: 'present' as const,
            })),
          ],
        };
      }),
    }));
    track('attendance_recorded', { eventId });
    haptic('success');
  }, []);

  const decideRegistration = useCallback((registrationId: string, decision: Decision, reason?: string) => {
    setState((current) => {
      if (!can(current.role, 'review_registrations')) return current;
      const target = current.registrations.find((item) => item.id === registrationId);
      if (!target) return current;
      const next = applyDecision(target, decision);
      const who = target.participantNames.join(', ');
      const words: Record<Decision, string> = { approve: 'approved', waitlist: 'waitlisted', reject: 'not approved', cancel: 'cancelled' };
      const owes = next.paymentStatus === 'awaiting_payment';
      const alert = notice({
        type: 'registration',
        title: decision === 'approve' ? 'Registration approved' : decision === 'waitlist' ? 'You’re on the waitlist' : decision === 'reject' ? 'Registration update' : 'Registration cancelled',
        body:
          decision === 'approve'
            ? owes
              ? `${who} ${target.participantNames.length > 1 ? 'are' : 'is'} approved. ${money(next.amountDue)} is due to confirm the spot.`
              : `${who} ${target.participantNames.length > 1 ? 'are' : 'is'} approved and confirmed.`
            : `${who}: ${words[decision]}.${reason ? ` ${reason}` : ''}`,
        route: `/season/${registrationId}`,
        urgency: 'normal',
        wouldPush: true,
        dedupeKey: `registration:${registrationId}:${decision}`,
      });
      return {
        ...current,
        registrations: current.registrations.map((item) => (item.id === registrationId ? next : item)),
        notifications: pushUnique(current.notifications, alert),
        audit: [
          auditEntry({
            action: `registration_${decision}`,
            targetId: registrationId,
            actorName: 'Club administrator',
            actorRole: current.role,
            detail: `${who}: ${target.status} → ${next.status}; payment ${target.paymentStatus} → ${next.paymentStatus}${reason ? `. Reason: ${reason}` : ''}`,
          }),
          ...current.audit,
        ],
      };
    });
    hapticLight();
  }, []);

  const waiveRegistrationFee = useCallback((registrationId: string, reason: string) => {
    setState((current) => {
      if (!can(current.role, 'review_registrations')) return current;
      const target = current.registrations.find((item) => item.id === registrationId);
      if (!target || !canWaive(target) || !reason.trim()) return current;
      const next = waiveFee(target);
      return {
        ...current,
        registrations: current.registrations.map((item) => (item.id === registrationId ? next : item)),
        audit: [
          auditEntry({
            action: 'registration_fee_waived',
            targetId: registrationId,
            actorName: 'Club administrator',
            actorRole: current.role,
            detail: `${target.participantNames.join(', ')}: ${money(target.amountDue)} waived. Reason: ${reason.trim()}`,
          }),
          ...current.audit,
        ],
      };
    });
    hapticLight();
  }, []);

  const assignRegistrationTeam = useCallback((registrationId: string, teamId: string, coachName: string) => {
    setState((current) => {
      if (!can(current.role, 'assign_child_team')) return current;
      return {
        ...current,
        registrations: current.registrations.map((registration) =>
          registration.id === registrationId ? { ...applyDecision(registration, 'approve'), teamId, coachName } : registration,
        ),
        audit: [
          auditEntry({
            action: 'registration_team_assigned',
            targetId: registrationId,
            actorName: 'Club administrator',
            actorRole: current.role,
            detail: `Assigned to ${teamId} with ${coachName}`,
          }),
          ...current.audit,
        ],
      };
    });
    hapticLight();
  }, []);

  const updateEventResult = useCallback((eventId: string, result: string) => {
    setState((current) => ({
      ...current,
      schedule: mergeClubSchedule(current.schedule).map((event) =>
        event.id === eventId ? { ...event, result, status: 'completed' } : event,
      ),
    }));
    hapticLight();
  }, []);

  const upsertEvent = useCallback((event: ScheduleEvent) => {
    setState((current) => {
      const schedule = mergeClubSchedule(current.schedule);
      const exists = schedule.some((item) => item.id === event.id);
      const next = exists ? schedule.map((item) => (item.id === event.id ? { ...item, ...event } : item)) : [...schedule, event];
      const alert = exists
        ? notice({
            type: 'change',
            title: 'Schedule updated',
            body: `${event.title} · ${event.venue}`,
            route: `/event/${event.id}`,
            urgency: 'high',
            wouldPush: true,
          })
        : null;
      return { ...current, schedule: next, notifications: alert ? [alert, ...current.notifications] : current.notifications };
    });
    hapticLight();
  }, []);

  const publishAnnouncement = useCallback((draft: Draft): { ok: boolean; error?: string; id?: string } => {
    const current = stateRef.current;
    const problem = validateDraft(draft, current.role);
    if (problem) return { ok: false, error: problem };
    const schedule = mergeClubSchedule(current.schedule);
    const targets = draft.kind === 'cancellation' ? schedule.filter((event) => draft.eventIds.includes(event.id)) : [];
    if (draft.kind === 'cancellation') {
      if (targets.length !== draft.eventIds.length) return { ok: false, error: 'One of those sessions is no longer on the schedule.' };
      if (targets.some((event) => !draft.teamIds.includes(event.teamId ?? '') || !canCancelTeam(current.role, event.teamId))) {
        return { ok: false, error: 'You can only cancel your own team’s sessions.' };
      }
    }
    const authorName = current.role === 'coach' ? ACTIVE_COACH.displayName : current.role === 'admin' ? 'Club office' : 'Team manager';
    const id = `announcement-${Date.now()}`;
    const publishedAt = new Date().toISOString();
    const created: Announcement = { ...toAnnouncement(draft, { name: authorName, role: current.role }), id, publishedAt, replies: [] };

    setState((latest) => {
      let nextSchedule = mergeClubSchedule(latest.schedule);
      let audit = latest.audit;
      if (draft.kind === 'cancellation') {
        nextSchedule = nextSchedule.map((event) => {
          if (!draft.eventIds.includes(event.id)) return event;
          const change = changeEntry({
            kind: 'cancellation',
            reason: draft.reason,
            actorName: authorName,
            actorRole: latest.role,
            approval: 'published',
            reschedulePending: true,
          });
          return {
            ...event,
            status: 'cancelled' as const,
            cancellationReason: draft.reason,
            reschedulePending: true,
            pendingChange: undefined,
            changes: [change, ...(event.changes ?? [])],
          };
        });
        audit = [
          ...draft.eventIds.map((eventId) =>
            auditEntry({ action: 'cancellation', targetId: eventId, actorName: authorName, actorRole: latest.role, detail: `${draft.reason}. Announced to ${created.scopeLabel}.` }),
          ),
          ...audit,
        ];
      }
      audit = [
        auditEntry({ action: 'announcement_published', targetId: id, actorName: authorName, actorRole: latest.role, detail: `${draft.kind} · ${created.scopeLabel} · ${created.title}` }),
        ...audit,
      ];

      const staff: UserRole[] = ['coach', 'competition_manager', 'admin'];
      const roles: UserRole[] =
        created.audience === 'club'
          ? [
              ...staff,
              ...(draft.groups.includes('youth_families') ? (['guardian'] as UserRole[]) : []),
              ...(draft.groups.includes('adult_players') ? (['adult_player'] as UserRole[]) : []),
              ...(draft.groups.includes('supporters') ? (['guest', 'volunteer'] as UserRole[]) : []),
            ]
          : [...staff, 'guardian', 'adult_player'];
      const first = targets[0];
      const alert = notice({
        type: draft.kind === 'cancellation' ? 'change' : draft.kind === 'weather' ? 'weather' : 'announcement',
        title: created.title,
        body: created.body.length > 140 ? `${created.body.slice(0, 137)}…` : created.body,
        route: `/message/${id}`,
        urgency: created.urgency,
        eventId: first?.id,
        wouldPush: true,
        announcementId: id,
        roles,
        teamIds: created.audience === 'team' ? draft.teamIds : undefined,
        category: draft.kind === 'cancellation' ? 'critical' : draft.kind === 'weather' || draft.kind === 'schedule' || draft.important ? 'important' : 'normal',
        dedupeKey: `announcement:${id}`,
      });
      return {
        ...latest,
        schedule: nextSchedule,
        announcements: [created, ...latest.announcements],
        notifications: pushUnique(latest.notifications, alert),
        audit,
      };
    });
    haptic(draft.kind === 'cancellation' ? 'warning' : 'success');
    return { ok: true, id };
  }, []);

  // A heads-up only appears once per session: reading it must not make it come back.
  const postWeatherWatch = useCallback((event: ScheduleEvent, outlook: { level: 'good' | 'watch' | 'risky'; family: string; staff: string }) => {
    if (outlook.level !== 'risky' || !event.teamId || event.status === 'cancelled') return;
    setState((current) => {
      const key = `weather:${event.id}:${event.startsAt.slice(0, 10)}`;
      if (current.notifications.some((item) => item.dedupeKey === key || item.dedupeKey === `${key}:staff`)) return current;
      const families = notice({
        type: 'weather',
        title: 'Weather watch',
        body: outlook.family,
        route: `/event/${event.id}`,
        eventId: event.id,
        urgency: 'high',
        wouldPush: true,
        roles: ['guardian', 'adult_player'],
        teamIds: [event.teamId as string],
        category: 'important',
        dedupeKey: key,
      });
      const staff = notice({
        type: 'weather',
        title: 'Weather watch for your session',
        body: outlook.staff,
        route: '/announcements/new',
        eventId: event.id,
        urgency: 'high',
        wouldPush: true,
        roles: ['coach', 'competition_manager'],
        teamIds: [event.teamId as string],
        category: 'important',
        dedupeKey: `${key}:staff`,
      });
      return { ...current, notifications: [families, staff, ...current.notifications] };
    });
  }, []);

  const replyToAnnouncement = useCallback((announcementId: string, body: string) => {
    setState((current) => {
      const reply: AnnouncementReply = {
        id: `reply-${Date.now()}`,
        authorName: current.role === 'coach' || current.role === 'admin' ? 'Staff' : current.household.guardianName,
        authorRole: current.role,
        body,
        createdAt: new Date().toISOString(),
      };
      return {
        ...current,
        announcements: current.announcements.map((item) =>
          item.id === announcementId ? { ...item, replies: [...(item.replies ?? []), reply] } : item,
        ),
      };
    });
    hapticLight();
  }, []);

  const sendDirectMessage = useCallback((threadId: string, body: string): { ok: boolean; error?: string } => {
    const current = stateRef.current;
    const viewer = viewerFor(current.role, current.household.id);
    const check = checkSend({ viewer, threadId, body, parentChatOn: current.parentChatOn, blocked: current.blockedThreads });
    if (!check.ok) return { ok: false, error: check.error };
    const sentAt = new Date().toISOString();
    const message: DirectMessage = {
      id: `dm-${Date.now()}-${Math.random().toString(16).slice(2, 5)}`,
      threadId,
      fromRole: current.role,
      fromName: current.role === 'coach' ? ACTIVE_COACH.fullName : current.role === 'guardian' ? current.household.guardianName : 'Staff',
      fromId: senderIdFor(current.role, current.household.id),
      body: body.trim(),
      createdAt: sentAt,
    };
    setState((latest) => {
      // The other side gets an alert, in their own role's feed.
      const toCoach = latest.role === 'guardian' && (threadId === 'coach-priya' || threadId.startsWith('family-'));
      const toParent = latest.role === 'coach' && threadId === 'coach-priya';
      const alert =
        toCoach || toParent
          ? notice({
              type: 'message',
              title: toCoach ? latest.household.guardianName : ACTIVE_COACH.fullName,
              body: message.body.length > 110 ? `${message.body.slice(0, 107)}…` : message.body,
              route: `/message/${threadId}`,
              urgency: 'normal',
              wouldPush: true,
              forRole: toCoach ? 'coach' : 'guardian',
              threadId,
            })
          : null;
      const key = readKey(viewer!, threadId);
      return {
        ...latest,
        messages: [...latest.messages, message],
        // Sending counts as having seen the thread.
        threadReads: { ...latest.threadReads, [key]: sentAt },
        notifications: alert ? [alert, ...latest.notifications] : latest.notifications,
      };
    });
    hapticLight();
    return { ok: true };
  }, []);

  const markThreadRead = useCallback((threadId: string) => {
    setState((current) => {
      const viewer = viewerFor(current.role, current.household.id);
      if (!viewer) return current;
      const key = readKey(viewer, threadId);
      const now = new Date().toISOString();
      const unreadNote = current.notifications.some((item) => item.type === 'message' && item.threadId === threadId && item.forRole === current.role && !item.read);
      return {
        ...current,
        threadReads: { ...current.threadReads, [key]: now },
        notifications: unreadNote
          ? current.notifications.map((item) => (item.type === 'message' && item.threadId === threadId && item.forRole === current.role ? { ...item, read: true } : item))
          : current.notifications,
      };
    });
  }, []);

  const setParentChat = useCallback((on: boolean) => {
    setState((current) => ({ ...current, parentChatOn: on }));
    hapticLight();
  }, []);

  const blockThread = useCallback((threadId: string, blocked: boolean) => {
    setState((current) => ({
      ...current,
      blockedThreads: blocked ? [...new Set([...current.blockedThreads, threadId])] : current.blockedThreads.filter((id) => id !== threadId),
    }));
    hapticLight();
  }, []);

  const reportThread = useCallback((threadId: string, reason: string) => {
    setState((current) => ({
      ...current,
      reports: [{ id: `report-${Date.now()}`, threadId, reason, createdAt: new Date().toISOString() }, ...current.reports],
      blockedThreads: [...new Set([...current.blockedThreads, threadId])],
      audit: [
        auditEntry({
          action: 'message_report',
          targetId: threadId,
          actorName: current.household.guardianName,
          actorRole: current.role,
          detail: `Reported a conversation: ${reason}`,
        }),
        ...current.audit,
      ],
    }));
    haptic('warning');
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      notifications: current.notifications.map((item) => (item.id === id ? { ...item, read: true } : item)),
    }));
    track('notification_opened');
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setState((current) => ({
      ...current,
      notifications: current.notifications.map((item) => ({ ...item, read: true })),
    }));
  }, []);

  const saveRecapDraft = useCallback((recap: SessionRecap) => {
    setState((current) => {
      if (!can(current.role, 'create_session_recap')) return current;
      if (current.role === 'coach' && recap.teamId !== COACH_TEAM_ID) return current;
      const next: SessionRecap = {
        ...recap,
        coachName: ACTIVE_COACH.displayName,
        updatedAt: new Date().toISOString(),
        status: recap.status === 'sent' ? 'sent' : 'draft',
      };
      const others = current.recaps.filter((item) => item.eventId !== recap.eventId);
      return { ...current, recaps: [next, ...others] };
    });
    hapticLight();
  }, []);

  const sendSessionRecap = useCallback((recap: SessionRecap): { ok: boolean; error?: string } => {
    let result: { ok: boolean; error?: string } = { ok: false, error: 'Could not send.' };
    setState((current) => {
      if (!canSendSessionRecap(current.role, current.managerCanSendRecap)) {
        result = { ok: false, error: 'You do not have permission to send this recap.' };
        return current;
      }
      if (current.role === 'coach' && recap.teamId !== COACH_TEAM_ID) {
        result = { ok: false, error: 'This session is not on your assigned team.' };
        return current;
      }
      const body = recapBody(recap);
      if (!body) {
        result = { ok: false, error: 'Add a session recap before sending.' };
        return current;
      }
      const event = mergeClubSchedule(current.schedule).find((item) => item.id === recap.eventId);
      if (!event) {
        result = { ok: false, error: 'Session not found.' };
        return current;
      }
      const audience = recapAudience(rosterForEvent(event), event.checkIns ?? []);
      if (audience.unrecordedCount) {
        result = { ok: false, error: 'Attendance is still open. Not recorded is not the same as absent, and sending stays off until every player is marked.' };
        return current;
      }
      if (!audience.recipients.length) {
        result = { ok: false, error: 'Record attendance first. Recaps go only to families of children marked present.' };
        return current;
      }
      const deliveringNow = (recap.delivery ?? 'now') === 'now';
      const approvedAt = new Date();
      if (!deliveringNow) {
        const at = recap.scheduledFor ? new Date(recap.scheduledFor).getTime() : Number.NaN;
        if (!Number.isFinite(at) || at <= approvedAt.getTime()) {
          result = { ok: false, error: PAST_DELIVERY_ERROR };
          return current;
        }
      }
      const sentAt = deliveringNow ? approvedAt.toISOString() : recap.scheduledFor!;
      const notes = recap.notes
        .filter((note) => audience.recipients.some((person) => person.id === note.childId))
        .map((note) => ({
          ...note,
          approvedText: note.approvedText.trim() || note.originalText.trim(),
        }));
      const sentRecap: SessionRecap = {
        ...recap,
        message: body,
        coachName: ACTIVE_COACH.displayName,
        notes,
        recipientCount: audience.recipients.length,
        status: 'sent',
        sentAt: deliveringNow ? sentAt : undefined,
        scheduledFor: deliveringNow ? undefined : sentAt,
        deliveryStatus: deliveringNow ? 'delivered' : 'queued',
        updatedAt: new Date().toISOString(),
      };
      const updates = deliveringNow ? parentUpdatesFromRecap(sentRecap, event, sentAt) : [];
      const alerts: AppNotification[] = updates
        .filter((item) => item.kind === 'session_recap' || item.childId === 'child-maya')
        .map((item) =>
          notice({
            type: 'coach_update',
            title: item.kind === 'session_recap' ? 'New session recap' : item.title,
            body: item.kind === 'session_recap' ? `${item.coachName} shared a note from ${event.title}.` : item.body,
            route: `/updates/${item.id}`,
            urgency: 'normal',
            wouldPush: true,
            childId: item.childId,
          }),
        );
      result = { ok: true };
      return {
        ...current,
        recaps: [sentRecap, ...current.recaps.filter((item) => item.eventId !== recap.eventId)],
        coachUpdates: [
          ...updates,
          ...current.coachUpdates.filter((item) => item.recapId !== recap.id && item.eventId !== recap.eventId),
        ],
        notifications: [
          ...alerts,
          ...current.notifications.filter((item) => item.type !== 'coach_reminder'),
        ],
      };
    });
    if (result.ok) haptic('success');
    else haptic('warning');
    return result;
  }, []);

  const setManagerCanSendRecap = useCallback((granted: boolean) => {
    setState((current) => {
      if (current.role !== 'admin') return current;
      return { ...current, managerCanSendRecap: granted };
    });
  }, []);

  const resetDemo = useCallback(async () => {
    await Promise.all([STORAGE_KEY, REGISTRATION_DRAFT_KEY, ...LEGACY_STORAGE_KEYS].map((key) => AsyncStorage.removeItem(key)));
    await resetAnalytics();
    await clearRegistrationDraft();
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(SPLASH_SESSION_KEY);
    } catch {
      // sessionStorage is unavailable outside a browser session.
    }
    setState({ ...visitorSeed('guest'), schedule: mergeClubSchedule() });
    hapticLight();
  }, []);

  const schedule = useMemo(() => mergeClubSchedule(state.schedule), [state.schedule]);

  const value = useMemo(
    () => ({
      ...state,
      schedule,
      hydrated,
      hasHydrated: hydrated,
      setRole,
      loadDemoPersona,
      completeIntro,
      completeOnboarding,
      setFollowedIds,
      setNotificationPrefs,
      addChild,
      submitRegistration,
      setAttendance,
      setParticipantRsvp,
      setSupporter,
      setMatchStory,
      setFieldStatus,
      closeVenue,
      relocateEvent,
      cancelEvent,
      requestOperationalChange,
      setEventInstructions,
      remindNonResponders,
      recordCheckIn,
      recordAllPresent,
      decideRegistration,
      waiveRegistrationFee,
      assignRegistrationTeam,
      updateEventResult,
      upsertEvent,
      publishAnnouncement,
      postWeatherWatch,
      replyToAnnouncement,
      sendDirectMessage,
      markThreadRead,
      setParentChat,
      blockThread,
      reportThread,
      markNotificationRead,
      markAllNotificationsRead,
      saveRecapDraft,
      sendSessionRecap,
      setManagerCanSendRecap,
      resetDemo,
    }),
    [
      state,
      schedule,
      hydrated,
      setRole,
      loadDemoPersona,
      completeIntro,
      completeOnboarding,
      setFollowedIds,
      setNotificationPrefs,
      addChild,
      submitRegistration,
      setAttendance,
      setParticipantRsvp,
      setSupporter,
      setMatchStory,
      setFieldStatus,
      closeVenue,
      relocateEvent,
      cancelEvent,
      requestOperationalChange,
      setEventInstructions,
      remindNonResponders,
      recordCheckIn,
      recordAllPresent,
      decideRegistration,
      waiveRegistrationFee,
      assignRegistrationTeam,
      updateEventResult,
      upsertEvent,
      publishAnnouncement,
      postWeatherWatch,
      replyToAnnouncement,
      sendDirectMessage,
      markThreadRead,
      setParentChat,
      blockThread,
      reportThread,
      markNotificationRead,
      markAllNotificationsRead,
      saveRecapDraft,
      sendSessionRecap,
      setManagerCanSendRecap,
      resetDemo,
    ],
  );

  return <AppContext.Provider value={value}>{hydrated ? children : <InkHold />}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
