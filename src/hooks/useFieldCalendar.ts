import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useDebounced } from '@/lib/debounce';
import { minutesForTime } from '@/lib/fields';
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

export function usePitchDay(date: string, time: string, turfOnly: boolean, enabled = true) {
  const delayedDate = useDebounced(date);
  const delayedTime = useDebounced(time);
  const delayedTurf = useDebounced(turfOnly);
  const minutes = minutesForTime(delayedTime);
  return useQuery({
    queryKey: ['pitch-day', delayedDate, minutes, delayedTurf],
    queryFn: () => fetchPitchDay(delayedDate, minutes, delayedTurf),
    enabled: enabled && Boolean(delayedDate && delayedTime),
    staleTime: 5 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
