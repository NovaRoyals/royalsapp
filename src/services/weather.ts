import type { FieldStatus, ScheduleEvent } from '@/types/domain';

export type WeatherSnapshot = {
  summary: string;
  source: 'stub';
};

/** Placeholder until a weather / parks field-status provider is approved. */
export function weatherForEvent(event: ScheduleEvent): WeatherSnapshot {
  if (event.weatherSummary) return { summary: event.weatherSummary, source: 'stub' };
  if (event.fieldStatus === 'closed') return { summary: 'Fields closed · do not travel', source: 'stub' };
  if (event.fieldStatus === 'delayed') return { summary: 'Start delayed · check back before leaving', source: 'stub' };
  return { summary: 'Clear enough to play · stub forecast', source: 'stub' };
}

export function fieldStatusLabel(status: FieldStatus = 'open') {
  if (status === 'closed') return 'Closed';
  if (status === 'delayed') return 'Delayed';
  return 'Open';
}
