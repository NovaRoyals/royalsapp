import type { FieldStatus, ScheduleEvent } from '@/types/domain';

export type WeatherSnapshot = {
  summary: string;
  detail: string;
  source: 'unconfigured';
};

/**
 * Live weather is not configured. Callers must show this as a placeholder.
 * Do not invent a temperature or a current condition.
 */
export function weatherForEvent(_event?: ScheduleEvent): WeatherSnapshot {
  return {
    summary: 'Weather placeholder',
    detail: 'Live weather is not connected. This is not a current forecast.',
    source: 'unconfigured',
  };
}

export function fieldStatusLabel(status: FieldStatus = 'open') {
  if (status === 'closed') return 'Closed';
  if (status === 'delayed') return 'Delayed';
  if (status === 'inspection_pending') return 'Inspection pending';
  if (status === 'relocated') return 'Relocated';
  return 'Open';
}
