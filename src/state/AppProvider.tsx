import AsyncStorage from '@react-native-async-storage/async-storage';
import { haptic } from '@/lib/haptics';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  demoAnnouncements,
  demoDirectMessages,
  demoDocuments,
  demoHousehold,
  demoNotifications,
  demoRegistrations,
  demoSchedule,
} from '@/data/demo';
import { resetAnalytics, track } from '@/lib/analytics';
import type {
  Announcement,
  AnnouncementReply,
  AppNotification,
  AttendanceMark,
  AttendanceStatus,
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
  UserRole,
} from '@/types/domain';

const STORAGE_KEY = '@royals/demo-state/v5';
const LEGACY_STORAGE_KEYS = ['@royals/demo-state/v1', '@royals/demo-state/v2', '@royals/demo-state/v3', '@royals/demo-state/v4'];

export const defaultNotificationPrefs: NotificationPrefs = {
  urgent: true,
  team: true,
  community: true,
  locationShare: false,
};

export const defaultFollowedIds = ['fall-kids-2026', 'nova-royals-men', 'nova-royals-cricket'];

type PersistedState = {
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
};

type NewRegistration = Omit<Registration, 'id' | 'submittedAt' | 'demo'>;

interface AppState extends PersistedState {
  hydrated: boolean;
  setRole: (role: UserRole) => void;
  completeOnboarding: (input: {
    role: UserRole;
    children?: Person[];
    followedIds: string[];
    notificationPrefs: NotificationPrefs;
    guardianName?: string;
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
  resetDemo: () => Promise<void>;
}

function mergeClubSchedule(overlays: ScheduleEvent[] = []) {
  const extra = overlays.filter((item) => !demoSchedule.some((event) => event.id === item.id));
  return [
    ...demoSchedule.map((event) => {
      const overlay = overlays.find((item) => item.id === event.id);
      if (!overlay) return event;
      return {
        ...event,
        ...overlay,
        title: event.title,
        subtitle: overlay.subtitle ?? event.subtitle,
        venue: overlay.venue || event.venue,
        startsAt: overlay.startsAt || event.startsAt,
      };
    }),
    ...extra,
  ].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

const initialState: PersistedState = {
  role: 'guest',
  household: demoHousehold,
  registrations: demoRegistrations,
  schedule: demoSchedule,
  notifications: demoNotifications,
  announcements: demoAnnouncements,
  messages: demoDirectMessages,
  documents: demoDocuments,
  followedIds: defaultFollowedIds,
  notificationPrefs: defaultNotificationPrefs,
  onboardingCompleted: false,
};

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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    Promise.all(LEGACY_STORAGE_KEYS.map((key) => AsyncStorage.removeItem(key)))
      .then(() => AsyncStorage.getItem(STORAGE_KEY))
      .then((saved) => {
        if (!saved) {
          setState({ ...initialState, schedule: mergeClubSchedule() });
          return;
        }
        const parsed = JSON.parse(saved) as Partial<PersistedState>;
        setState({
          ...initialState,
          ...parsed,
          household: parsed.household ?? initialState.household,
          notificationPrefs: { ...defaultNotificationPrefs, ...parsed.notificationPrefs },
          followedIds: parsed.followedIds ?? initialState.followedIds,
          messages: parsed.messages ?? initialState.messages,
          documents: parsed.documents ?? initialState.documents,
          schedule: mergeClubSchedule(parsed.schedule),
        });
      })
      .catch(() => setState({ ...initialState, schedule: mergeClubSchedule() }))
      .finally(() => setHydrated(true));
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
    setState((current) => ({ ...current, role }));
  }, []);

  const completeOnboarding = useCallback(
    (input: {
      role: UserRole;
      children?: Person[];
      followedIds: string[];
      notificationPrefs: NotificationPrefs;
      guardianName?: string;
    }) => {
      setState((current) => ({
        ...current,
        role: input.role,
        onboardingCompleted: true,
        followedIds: input.followedIds,
        notificationPrefs: input.notificationPrefs,
        household: {
          ...current.household,
          guardianName: input.guardianName || current.household.guardianName,
          children: input.children?.length ? input.children : current.household.children,
        },
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
      const created: Announcement = {
        ...announcement,
        id: `announcement-${Date.now()}`,
        publishedAt: new Date().toISOString(),
        urgency: announcement.urgency ?? 'normal',
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
      setState((current) => ({
        ...current,
        announcements: [created, ...current.announcements],
        notifications: [alert, ...current.notifications],
      }));
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

  const resetDemo = useCallback(async () => {
    await Promise.all([STORAGE_KEY, ...LEGACY_STORAGE_KEYS].map((key) => AsyncStorage.removeItem(key)));
    await resetAnalytics();
    setState({ ...initialState, schedule: mergeClubSchedule() });
    hapticLight();
  }, []);

  const schedule = useMemo(() => mergeClubSchedule(state.schedule), [state.schedule]);

  const value = useMemo(
    () => ({
      ...state,
      schedule,
      hydrated,
      setRole,
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
      resetDemo,
    }),
    [
      state,
      schedule,
      hydrated,
      setRole,
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
      resetDemo,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
