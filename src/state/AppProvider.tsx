import AsyncStorage from '@react-native-async-storage/async-storage';
import { haptic } from '@/lib/haptics';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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
import { ACTIVE_COACH, demoDraftRecap, parentUpdatesFromRecap, recapBody } from '@/lib/coachRecap';
import { hydrateTrace, hydrateTraceEffect } from '@/lib/hydrateTrace';
import { COACH_TEAM_ID } from '@/lib/membership';
import { clearRegistrationDraft } from '@/lib/registrationDraft';
import type {
  Announcement,
  AnnouncementReply,
  AppNotification,
  AttendanceMark,
  AttendanceStatus,
  CoachUpdate,
  DirectMessage,
  FieldStatus,
  Household,
  HouseholdDocument,
  NoticeUrgency,
  NotificationPrefs,
  Person,
  Registration,
  RegistrationStatus,
  ScheduleEvent,
  SessionRecap,
  UserRole,
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
  setSupporter: (eventId: string, going: boolean) => void;
  setFieldStatus: (eventId: string, status: FieldStatus, reason?: string) => void;
  recordCheckIn: (eventId: string, mark: AttendanceMark) => void;
  recordAllPresent: (eventId: string, people: Person[]) => void;
  updateRegistrationStatus: (registrationId: string, status: RegistrationStatus) => void;
  assignRegistrationTeam: (registrationId: string, teamId: string, coachName: string) => void;
  updateEventResult: (eventId: string, result: string) => void;
  upsertEvent: (event: ScheduleEvent) => void;
  createAnnouncement: (announcement: Pick<Announcement, 'title' | 'body' | 'audience' | 'scopeLabel'> & {
    urgency?: NoticeUrgency;
    teamId?: string;
    programId?: string;
    eventId?: string;
  }) => void;
  replyToAnnouncement: (announcementId: string, body: string) => void;
  sendDirectMessage: (threadId: string, body: string) => void;
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
      };
    }),
    ...extra,
  ].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

function mergeFollowedIds(ids?: string[]) {
  return [...new Set([...(ids?.length ? ids : defaultFollowedIds), 'nova-royals-35plus', 'veterans-soccer'])];
}

function keepClubComms(next: PersistedState, current: PersistedState): PersistedState {
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
      followedIds: mergeFollowedIds(parsed.followedIds),
      household: householdForRole(role),
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
    registrations: (parsed.registrations ?? []).filter((item) => !item.demo),
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
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedState>(initialState);
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
      if (role === 'guest') return { ...visitorSeed('guest'), introCompleted: true, schedule };
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
      body: `${registration.participantNames.join(', ')} ${registration.participantNames.length > 1 ? 'are' : 'is'} pending review.`,
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
    setState((current) => ({
      ...current,
      schedule: mergeClubSchedule(current.schedule).map((event) => {
        if (event.id !== eventId) return event;
        const prev = event.attendance;
        let goingCount = event.goingCount ?? 0;
        if (status === 'going' && prev !== 'going') goingCount += 1;
        if (prev === 'going' && status !== 'going') goingCount = Math.max(0, goingCount - 1);
        return { ...event, attendance: status, goingCount };
      }),
    }));
    track('rsvp_completed', { eventId });
  }, []);

  const setSupporter = useCallback((eventId: string, going: boolean) => {
    setState((current) => ({
      ...current,
      schedule: mergeClubSchedule(current.schedule).map((event) => {
        if (event.id !== eventId) return event;
        const base = event.supporterCount ?? 0;
        const was = Boolean(event.supporterGoing);
        let count = base;
        if (going && !was) count += 1;
        if (!going && was) count = Math.max(0, count - 1);
        return { ...event, supporterGoing: going, supporterCount: count };
      }),
    }));
  }, []);

  const setFieldStatus = useCallback((eventId: string, status: FieldStatus, reason?: string) => {
    setState((current) => {
      const schedule = mergeClubSchedule(current.schedule).map((event) =>
        event.id === eventId
          ? {
              ...event,
              fieldStatus: status,
              status: status === 'closed' ? 'cancelled' : event.status === 'cancelled' && status === 'open' ? 'scheduled' : event.status,
            }
          : event,
      );
      const event = schedule.find((item) => item.id === eventId);
      const urgent = status === 'closed';
      const alert = event
        ? notice({
            type: 'weather',
            title: urgent ? `${event.venue} closed` : `Field update · ${event.title}`,
            body: reason || (urgent ? 'Do not travel. We will post the makeup plan.' : `Status is now ${status}.`),
            route: `/event/${eventId}`,
            urgency: urgent ? 'urgent' : 'high',
            wouldPush: true,
          })
        : null;
      return {
        ...current,
        schedule,
        notifications: alert ? [alert, ...current.notifications] : current.notifications,
      };
    });
    haptic(status === 'closed' ? 'warning' : 'light');
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
        return {
          ...event,
          checkIns: people.map((person) => ({
            personId: person.id,
            personName: person.displayName,
            present: true,
            status: 'present' as const,
          })),
        };
      }),
    }));
    track('attendance_recorded', { eventId });
    haptic('success');
  }, []);

  const updateRegistrationStatus = useCallback((registrationId: string, status: RegistrationStatus) => {
    setState((current) => ({
      ...current,
      registrations: current.registrations.map((registration) =>
        registration.id === registrationId ? { ...registration, status } : registration,
      ),
    }));
    hapticLight();
  }, []);

  const assignRegistrationTeam = useCallback((registrationId: string, teamId: string, coachName: string) => {
    setState((current) => ({
      ...current,
      registrations: current.registrations.map((registration) =>
        registration.id === registrationId ? { ...registration, teamId, coachName, status: 'approved' } : registration,
      ),
    }));
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

  const createAnnouncement = useCallback(
    (
      announcement: Pick<Announcement, 'title' | 'body' | 'audience' | 'scopeLabel'> & {
        urgency?: NoticeUrgency;
        teamId?: string;
        programId?: string;
        eventId?: string;
      },
    ) => {
      setState((current) => {
        if (!can(current.role, 'send_announcement')) return current;
        const scoped =
          announcement.audience === 'club' && !can(current.role, 'send_club_announcement')
            ? {
                ...announcement,
                audience: 'team' as const,
                teamId: announcement.teamId ?? COACH_TEAM_ID,
                scopeLabel: 'U8 training',
              }
            : announcement;
        const created: Announcement = {
          ...scoped,
          id: `announcement-${Date.now()}`,
          publishedAt: new Date().toISOString(),
          urgency: scoped.urgency ?? 'normal',
          replies: [],
        };
        const urgency = created.urgency ?? 'normal';
        const alert = notice({
          type: 'announcement',
          title: created.title,
          body: created.body,
          route: `/message/${created.id}`,
          urgency,
          wouldPush: urgency !== 'low',
        });
        return {
          ...current,
          announcements: [created, ...current.announcements],
          notifications: [alert, ...current.notifications],
        };
      });
      hapticLight();
    },
    [],
  );

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

  const sendDirectMessage = useCallback((threadId: string, body: string) => {
    setState((current) => ({
      ...current,
      messages: [
        ...current.messages,
        {
          id: `dm-${Date.now()}`,
          threadId,
          fromRole: current.role,
          fromName: current.role === 'coach' || current.role === 'admin' ? 'Staff' : current.household.guardianName,
          body,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    hapticLight();
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
      const sentAt = new Date().toISOString();
      const notes = recap.notes.map((note) => ({
        ...note,
        approvedText: note.approvedText.trim() || note.originalText.trim(),
      }));
      const sentRecap: SessionRecap = {
        ...recap,
        coachName: ACTIVE_COACH.displayName,
        notes,
        status: 'sent',
        sentAt,
        deliveryStatus: 'delivered',
        updatedAt: sentAt,
      };
      const updates = parentUpdatesFromRecap(sentRecap, event, sentAt);
      const alerts: AppNotification[] = updates
        .filter((item) => item.kind === 'session_recap' || item.childId === 'child-maya')
        .map((item) =>
          notice({
            type: 'coach_update',
            title: item.kind === 'session_recap' ? 'New session recap' : item.title,
            body: item.kind === 'session_recap' ? `${item.coachName} shared Sunday’s training note.` : item.body,
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
    await Promise.all([STORAGE_KEY, ...LEGACY_STORAGE_KEYS].map((key) => AsyncStorage.removeItem(key)));
    await resetAnalytics();
    await clearRegistrationDraft();
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(SPLASH_SESSION_KEY);
    } catch {
      undefined;
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
      setSupporter,
      setFieldStatus,
      recordCheckIn,
      recordAllPresent,
      updateRegistrationStatus,
      assignRegistrationTeam,
      updateEventResult,
      upsertEvent,
      createAnnouncement,
      replyToAnnouncement,
      sendDirectMessage,
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
      setSupporter,
      setFieldStatus,
      recordCheckIn,
      recordAllPresent,
      updateRegistrationStatus,
      assignRegistrationTeam,
      updateEventResult,
      upsertEvent,
      createAnnouncement,
      replyToAnnouncement,
      sendDirectMessage,
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
