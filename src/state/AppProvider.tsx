import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { demoAnnouncements, demoHousehold, demoNotifications, demoRegistrations, demoSchedule } from '@/data/demo';
import type {
  Announcement,
  AppNotification,
  AttendanceStatus,
  Household,
  Person,
  Registration,
  RegistrationStatus,
  ScheduleEvent,
  UserRole,
} from '@/types/domain';

const STORAGE_KEY = '@royals/demo-state/v3';
const LEGACY_STORAGE_KEYS = ['@royals/demo-state/v1', '@royals/demo-state/v2'];

type PersistedState = {
  role: UserRole;
  household: Household;
  registrations: Registration[];
  schedule: ScheduleEvent[];
  notifications: AppNotification[];
  announcements: Announcement[];
};

type NewRegistration = Omit<Registration, 'id' | 'submittedAt' | 'demo'>;

interface AppState extends PersistedState {
  hydrated: boolean;
  setRole: (role: UserRole) => void;
  addChild: (child: Omit<Person, 'id' | 'displayName' | 'isMinor'>) => Person;
  submitRegistration: (registration: NewRegistration) => Registration;
  setAttendance: (eventId: string, status: AttendanceStatus) => void;
  updateRegistrationStatus: (registrationId: string, status: RegistrationStatus) => void;
  updateEventResult: (eventId: string, result: string) => void;
  createAnnouncement: (announcement: Pick<Announcement, 'title' | 'body' | 'audience' | 'scopeLabel'>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  resetDemo: () => Promise<void>;
}

function mergeClubSchedule(overlays: ScheduleEvent[] = []) {
  return demoSchedule.map((event) => {
    const overlay = overlays.find((item) => item.id === event.id);
    if (!overlay) return event;
    return {
      ...event,
      attendance: overlay.attendance ?? event.attendance,
      result: overlay.result ?? event.result,
      status: overlay.status ?? event.status,
    };
  });
}

const initialState: PersistedState = {
  role: 'guardian',
  household: demoHousehold,
  registrations: demoRegistrations,
  schedule: demoSchedule,
  notifications: demoNotifications,
  announcements: demoAnnouncements,
};

const AppContext = createContext<AppState | null>(null);

function haptic() {
  if (Platform.OS !== 'web') {
    Haptics.selectionAsync().catch(() => undefined);
  }
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
    haptic();
    setState((current) => ({ ...current, role }));
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
    haptic();
    return created;
  }, []);

  const submitRegistration = useCallback((registration: NewRegistration) => {
    const created: Registration = {
      ...registration,
      id: `reg-${Date.now()}`,
      submittedAt: new Date().toISOString(),
      demo: true,
    };
    const notice: AppNotification = {
      id: `notification-${Date.now()}`,
      type: 'registration',
      title: 'Registration received',
      body: `${registration.participantNames.join(', ')} ${registration.participantNames.length > 1 ? 'are' : 'is'} pending review.`,
      createdAt: new Date().toISOString(),
      read: false,
      route: '/profile',
    };
    setState((current) => ({
      ...current,
      registrations: [created, ...current.registrations],
      notifications: [notice, ...current.notifications],
    }));
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    return created;
  }, []);

  const setAttendance = useCallback((eventId: string, status: AttendanceStatus) => {
    setState((current) => ({
      ...current,
      schedule: mergeClubSchedule(current.schedule).map((event) =>
        event.id === eventId ? { ...event, attendance: status } : event,
      ),
    }));
    haptic();
  }, []);

  const updateRegistrationStatus = useCallback((registrationId: string, status: RegistrationStatus) => {
    setState((current) => ({
      ...current,
      registrations: current.registrations.map((registration) =>
        registration.id === registrationId ? { ...registration, status } : registration,
      ),
    }));
    haptic();
  }, []);

  const updateEventResult = useCallback((eventId: string, result: string) => {
    setState((current) => ({
      ...current,
      schedule: mergeClubSchedule(current.schedule).map((event) =>
        event.id === eventId ? { ...event, result, status: 'completed' } : event,
      ),
    }));
    haptic();
  }, []);

  const createAnnouncement = useCallback(
    (announcement: Pick<Announcement, 'title' | 'body' | 'audience' | 'scopeLabel'>) => {
      const created: Announcement = {
        ...announcement,
        id: `announcement-${Date.now()}`,
        publishedAt: new Date().toISOString(),
      };
      setState((current) => ({ ...current, announcements: [created, ...current.announcements] }));
      haptic();
    },
    [],
  );

  const markNotificationRead = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      notifications: current.notifications.map((notice) => (notice.id === id ? { ...notice, read: true } : notice)),
    }));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setState((current) => ({
      ...current,
      notifications: current.notifications.map((notice) => ({ ...notice, read: true })),
    }));
  }, []);

  const resetDemo = useCallback(async () => {
    await Promise.all([STORAGE_KEY, ...LEGACY_STORAGE_KEYS].map((key) => AsyncStorage.removeItem(key)));
    setState({ ...initialState, schedule: mergeClubSchedule() });
    haptic();
  }, []);

  const schedule = useMemo(() => mergeClubSchedule(state.schedule), [state.schedule]);

  const value = useMemo(
    () => ({
      ...state,
      schedule,
      hydrated,
      setRole,
      addChild,
      submitRegistration,
      setAttendance,
      updateRegistrationStatus,
      updateEventResult,
      createAnnouncement,
      markNotificationRead,
      markAllNotificationsRead,
      resetDemo,
    }),
    [
      state,
      schedule,
      hydrated,
      setRole,
      addChild,
      submitRegistration,
      setAttendance,
      updateRegistrationStatus,
      updateEventResult,
      createAnnouncement,
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
