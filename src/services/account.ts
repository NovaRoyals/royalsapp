import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { createAuthService, type AuthClient } from '@/lib/authService';
import { supabase } from '@/lib/supabase';

// Lets the browser window that Google opens close itself and hand the result back (web popups).
WebBrowser.maybeCompleteAuthSession();

/**
 * The app's sign-in. `supabase` is null in demo mode, and every method then answers
 * "Accounts aren't switched on in this version of the app." instead of doing anything.
 */
export const account = createAuthService(supabase as unknown as AuthClient | null, {
  isWeb: Platform.OS === 'web',
  // Email links and Google come back here. On the web this is the site's own address; in the app
  // it is the royals:// link (or the Expo Go link while testing).
  redirectUrl: () => Linking.createURL('/auth/callback'),
  openBrowser: (url, returnTo) => WebBrowser.openAuthSessionAsync(url, returnTo),
  googleEnabled: async () => {
    const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!base || !key) return null;
    const response = await fetch(`${base}/auth/v1/settings`, { headers: { apikey: key } });
    if (!response.ok) return null;
    const settings = (await response.json()) as { external?: { google?: boolean } };
    return settings.external?.google === true;
  },
});
