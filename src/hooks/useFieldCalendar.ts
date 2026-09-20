import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useDebounced } from '@/lib/debounce';
import { fetchCoverage, fetchPitchDay } from '@/services/fields';

export function useFieldCoverage() {
  return useQuery({
    queryKey: ['pitch-coverage'],
    queryFn: fetchCoverage,
    staleTime: 30 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 1,
  });
}

export function usePitchDay(date: string, pickupMinutes: number, turfOnly: boolean, enabled = true) {
  const delayedDate = useDebounced(date);
  const delayedMinutes = useDebounced(pickupMinutes);
  const delayedTurf = useDebounced(turfOnly);
  return useQuery({
    queryKey: ['pitch-day', delayedDate, delayedMinutes, delayedTurf],
    queryFn: () => fetchPitchDay(delayedDate, delayedMinutes, delayedTurf),
    enabled: enabled && Boolean(delayedDate && delayedMinutes >= 0),
    staleTime: 5 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
