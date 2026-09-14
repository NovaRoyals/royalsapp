import type { ScheduleEvent } from '@/types/domain';

export interface CalendarGateway {
  add(event: ScheduleEvent): Promise<{ externalId?: string; simulated: boolean }>;
}

class DemoCalendarGateway implements CalendarGateway {
  async add(_event: ScheduleEvent) {
    return { simulated: true };
  }
}

export const calendarGateway: CalendarGateway = new DemoCalendarGateway();

// Replace with an Expo Calendar adapter after native permission copy and
// duplicate-event behavior are approved. Screens depend only on this contract.
