import AsyncStorage from '@react-native-async-storage/async-storage';

export type AnalyticsEventName =
  | 'program_viewed'
  | 'registration_started'
  | 'registration_completed'
  | 'child_added'
  | 'rsvp_completed'
  | 'notification_opened'
  | 'attendance_recorded'
  | 're_registration';

export type AnalyticsEvent = {
  name: AnalyticsEventName;
  createdAt: string;
  meta?: Record<string, string>;
};

const STORAGE_KEY = '@royals/analytics/v1';
let cache: AnalyticsEvent[] = [];
let loaded = false;

async function hydrate() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as AnalyticsEvent[]) : [];
  } catch {
    cache = [];
  }
}

export async function track(name: AnalyticsEventName, meta?: Record<string, string>) {
  await hydrate();
  cache = [...cache, { name, createdAt: new Date().toISOString(), meta }];
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache)).catch(() => undefined);
}

export async function getEvents() {
  await hydrate();
  return cache;
}

export function funnelCounts(events: AnalyticsEvent[]) {
  const count = (name: AnalyticsEventName) => events.filter((event) => event.name === name).length;
  return {
    programViewed: count('program_viewed'),
    registrationStarted: count('registration_started'),
    registrationCompleted: count('registration_completed'),
    childAdded: count('child_added'),
    rsvpCompleted: count('rsvp_completed'),
    notificationOpened: count('notification_opened'),
    attendanceRecorded: count('attendance_recorded'),
    reRegistration: count('re_registration'),
  };
}

export async function resetAnalytics() {
  cache = [];
  loaded = true;
  await AsyncStorage.removeItem(STORAGE_KEY);
}
