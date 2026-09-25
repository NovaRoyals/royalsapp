import type { ScheduleEvent } from '@/types/domain';

export type CalendarProviderId = 'demo' | 'google' | 'apple' | 'ics';

export interface CalendarDraft {
  uid: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  location: string;
  notes?: string;
}

export interface CalendarWriteResult {
  written: boolean;
  provider: CalendarProviderId;
  reason: string;
  drafts: CalendarDraft[];
}

export interface CalendarAdapter {
  id: CalendarProviderId;
  /** True only when a real provider is configured. Demo mode stays false. */
  connected: boolean;
  preview(drafts: CalendarDraft[]): string;
  write(drafts: CalendarDraft[]): Promise<CalendarWriteResult>;
}

export function draftFromEvent(event: ScheduleEvent, note?: string): CalendarDraft {
  return {
    uid: event.id,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    location: [event.venue, event.address].filter(Boolean).join(', '),
    notes: note ?? event.instructions,
  };
}

class DemoCalendarAdapter implements CalendarAdapter {
  id = 'demo' as const;
  connected = false;

  preview(drafts: CalendarDraft[]) {
    if (drafts.length === 1) return `${drafts[0].title} · ${drafts[0].location}`;
    return `${drafts.length} events`;
  }

  async write(drafts: CalendarDraft[]): Promise<CalendarWriteResult> {
    return {
      written: false,
      provider: 'demo',
      reason: 'Calendar writing is not connected. Google, Apple, and .ics can be added later without changing this screen.',
      drafts,
    };
  }
}

/**
 * Future adapters (not wired):
 * - Google Calendar via an OAuth client on a server
 * - Apple Calendar via Expo Calendar after permission copy is approved
 * - Downloadable .ics built from CalendarDraft
 * None of those write from the client in this slice.
 */
class CompatibleCalendar extends DemoCalendarAdapter {
  /** Existing call sites. Still does not write to a device calendar. */
  async add(event: ScheduleEvent) {
    const result = await this.write([draftFromEvent(event)]);
    return { simulated: true, written: false as const, result };
  }
}

export const calendarGateway: CalendarAdapter & {
  add(event: ScheduleEvent): Promise<{ simulated: boolean; written: false; result: CalendarWriteResult }>;
} = new CompatibleCalendar();

export async function prepareCalendar(events: ScheduleEvent[]) {
  const drafts = events.map((event) => draftFromEvent(event));
  const preview = calendarGateway.preview(drafts);
  const result = await calendarGateway.write(drafts);
  return { preview, result };
}
