import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isDemoMode = !url || !publishableKey;

// The web build is pre-rendered on a server, where there is no browser storage. The sign-in
// library must not reach for it there, or the build crashes. A phone or a browser has `window`.
const hasDevice = typeof window !== 'undefined';
const noStorage = { getItem: async () => null, setItem: async () => undefined, removeItem: async () => undefined };

export const supabase = isDemoMode
  ? null
  : createClient(url!, publishableKey!, {
      auth: {
        storage: hasDevice ? AsyncStorage : noStorage,
        autoRefreshToken: hasDevice,
        persistSession: hasDevice,
        detectSessionInUrl: false,
      },
    });

/**
 * Honest wording for the small label in the app. Accounts are real once a project is connected,
 * but the club's data (registrations, messages, announcements) is not on the server yet.
 */
export const DATA_ON_SERVER = false;
export const backendModeLabel = isDemoMode ? 'Demo mode' : DATA_ON_SERVER ? 'Supabase connected' : 'Accounts live · club data on this device';
