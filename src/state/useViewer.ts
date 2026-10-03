import { useMemo } from 'react';

import { viewerTeamIds } from '@/lib/announcements';
import { useApp } from '@/state/AppProvider';

/** Who is looking: their role and the teams they belong to. Announcements and alerts filter on it. */
export function useViewer() {
  const { role, registrations } = useApp();
  return useMemo(() => {
    const own = registrations.filter((item) => item.status !== 'cancelled' && item.status !== 'rejected' && item.teamId).map((item) => item.teamId as string);
    return { role, teamIds: viewerTeamIds(role, own) };
  }, [registrations, role]);
}
