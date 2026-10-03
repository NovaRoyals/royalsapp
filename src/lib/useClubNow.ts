import { useEffect, useState } from 'react';

import { clubNowIso } from '@/lib/datetime';

/**
 * Static web renders on a build machine, so anything that depends on the clock must start
 * from a fixed value and move to the real time after mount. Otherwise the server HTML and
 * the first client render disagree (React hydration error #418, WEB-001).
 *
 * The seed is before the season starts, so first paint shows full-season pricing.
 */
const SEED = '2026-09-12T12:00:00-04:00';

export function useClubNow({ tick = true }: { tick?: boolean } = {}) {
  const [nowIso, setNowIso] = useState(SEED);
  useEffect(() => {
    const sync = () => setNowIso(clubNowIso());
    const first = setTimeout(sync, 0);
    const interval = tick ? setInterval(sync, 60_000) : undefined;
    return () => {
      clearTimeout(first);
      if (interval) clearInterval(interval);
    };
  }, [tick]);
  return nowIso;
}
