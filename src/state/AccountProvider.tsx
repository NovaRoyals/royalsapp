import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { summarizeUser, type AccountUser } from '@/lib/authService';
import { supabase } from '@/lib/supabase';
import { account } from '@/services/account';

type AccountState = {
  /** False in demo mode: there is no project to sign in to. */
  enabled: boolean;
  /** True once the device has said whether someone is already signed in. */
  ready: boolean;
  user: AccountUser | null;
  signOut: () => Promise<void>;
};

const AccountContext = createContext<AccountState>({ enabled: false, ready: true, user: null, signOut: async () => undefined });

/** Who is signed in, remembered across restarts. Sits beside the app's own state, not inside it. */
export function AccountProvider({ children }: { children: ReactNode }) {
  const enabled = Boolean(supabase);
  const [ready, setReady] = useState(!enabled);
  const [user, setUser] = useState<AccountUser | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setUser(data.session?.user ? summarizeUser(data.session.user) : null);
      setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setUser(session?.user ? summarizeUser(session.user) : null);
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await account.signOut();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ enabled, ready, user, signOut }), [enabled, ready, user, signOut]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export const useAccount = () => useContext(AccountContext);
