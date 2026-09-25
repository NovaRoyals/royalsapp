import { ARROWHEAD_1B_ID, ARROWHEAD_3A_ID, venueById, venueIdForLabel, venueTitle } from '@/data/venues';
import type { AttendanceStatus, Person, ScheduleEvent } from '@/types/domain';

const SEEDED_AT = '2026-09-24T18:00:00-04:00';

const GOING = new Set([
  'u8-ap',
  'u8-jl',
  'u8-sk',
  'u8-em',
  'u8-nw',
  'u8-lc',
  'u8-ob',
  'u8-td',
  'u8-fn',
  'u8-kj',
  'u8-ls',
  'u8-qa',
]);
const UNAVAILABLE = new Set(['u8-ih', 'u8-rk']);
const UNSURE = new Set(['u8-mp']);

function statusFor(personId: string): AttendanceStatus | undefined {
  if (GOING.has(personId)) return 'going';
  if (UNAVAILABLE.has(personId)) return 'not_going';
  if (UNSURE.has(personId)) return 'maybe';
  return undefined;
}

function attachVenue(event: ScheduleEvent): ScheduleEvent {
  const venueId = event.venueId ?? venueIdForLabel(event.venue);
  return venueId ? { ...event, venueId } : event;
}

export function extraOperationalEvents(): ScheduleEvent[] {
  const field1 = venueById(ARROWHEAD_1B_ID);
  const field3 = venueById(ARROWHEAD_3A_ID);
  return [
    {
      id: 'kids-noah-2026-09-27',
      type: 'training',
      sport: 'soccer',
      title: 'Fall Soccer Training',
      subtitle: 'Session 3 · Ages 5–6',
      startsAt: '2026-09-27T09:30:00-04:00',
      endsAt: '2026-09-27T10:30:00-04:00',
      venue: field1 ? venueTitle(field1) : 'Arrowhead Park · Field 1B',
      address: field1?.address,
      venueId: ARROWHEAD_1B_ID,
      programId: 'fall-kids-u6-2026',
      teamId: 'nova-royals-kids-u6',
      participantIds: ['child-noah'],
      ageGroup: 'Ages 5–6',
      sessionNumber: 3,
      sessionTotal: 11,
      arrivalAt: '9:15 AM',
      status: 'scheduled',
      fieldStatus: 'open',
      parkingNotes: field1?.parkingNotes,
      whatToBring: 'Shin guards, water, labeled jacket',
      coachName: 'Coach Priya Sharma',
      rsvpDeadline: '2026-09-26T18:00:00-04:00',
      demo: true,
    },
    {
      id: 'club-volunteer-2026-09-26',
      type: 'club_event',
      sport: 'soccer',
      title: 'Sideline setup',
      subtitle: 'Community · volunteers',
      purpose: 'Set cones and welcome tents before Sunday training.',
      startsAt: '2026-09-26T16:00:00-04:00',
      endsAt: '2026-09-26T17:00:00-04:00',
      venue: field3 ? venueTitle(field3) : 'Arrowhead Park · Field 3A',
      address: field3?.address,
      venueId: ARROWHEAD_3A_ID,
      status: 'scheduled',
      fieldStatus: 'open',
      parkingNotes: field3?.parkingNotes,
      volunteerNeeds: '4 volunteers to set the south sideline',
      volunteerSpots: 4,
      supporterCount: 3,
      demo: true,
    },
    {
      id: 'cup-2026-10-17',
      type: 'tournament_match',
      sport: 'soccer',
      title: 'Fall Kickoff Cup · Group match',
      subtitle: 'Tournament · U8 showcase',
      tournamentName: 'Fall Kickoff Cup',
      tournamentRange: 'Oct 17–18',
      division: 'U8 showcase',
      startsAt: '2026-10-17T09:00:00-04:00',
      endsAt: '2026-10-17T10:00:00-04:00',
      checkInAt: '8:30 AM',
      venue: field3 ? venueTitle(field3) : 'Arrowhead Park · Field 3A',
      address: field3?.address,
      venueId: ARROWHEAD_3A_ID,
      teamId: 'nova-royals-kids-u8',
      rosterStatus: 'Coach confirms the match-day roster',
      status: 'scheduled',
      fieldStatus: 'open',
      parkingNotes: field3?.parkingNotes,
      demo: true,
    },
  ];
}

export function annotateSchedule(events: ScheduleEvent[], roster: Person[]): ScheduleEvent[] {
  return events.map((raw) => {
    const event = attachVenue(raw);
    if (event.id === 'kids-2026-09-27') {
      const sessionMatch = event.subtitle.match(/Session\s+(\d+)\s+of\s+(\d+)/i);
      return {
        ...event,
        participantIds: ['child-maya'],
        ageGroup: 'Ages 7–8',
        sessionNumber: sessionMatch ? Number(sessionMatch[1]) : 3,
        sessionTotal: sessionMatch ? Number(sessionMatch[2]) : undefined,
        arrivalAt: '8:45 AM',
        rsvpDeadline: '2026-09-26T18:00:00-04:00',
        participantRsvps: roster.flatMap((person) => {
          const status = statusFor(person.id);
          if (!status) return [];
          return [{ personId: person.id, personName: person.firstName, status, updatedAt: SEEDED_AT }];
        }),
      };
    }
    if (event.teamId === 'nova-royals-kids-u8' && event.type === 'training') {
      return { ...event, participantIds: ['child-maya'], ageGroup: 'Ages 7–8', arrivalAt: '8:45 AM' };
    }
    if (event.teamId === 'nova-royals-men' && event.type === 'league_match') {
      const opponent = event.title.split(' vs ')[1];
      return {
        ...event,
        opponent,
        competitionLabel: 'Men’s Open 8v8',
        rosterStatus: 'Availability is with the squad',
        rsvpDeadline: event.id === 'mens-2026-10-04' ? '2026-10-02T17:00:00-04:00' : event.rsvpDeadline,
      };
    }
    if (event.sport === 'cricket') {
      const parts = event.title.split(' vs ');
      const opponent = parts.find((part) => !/royals/i.test(part))?.trim();
      return {
        ...event,
        opponent,
        competitionLabel: 'CCPL T20 · Manassas1',
        rosterStatus: 'Squad availability is with the captain',
      };
    }
    if (event.teamId === 'nova-royals-35plus') {
      const opponent = event.title.split(' vs ')[1];
      return { ...event, opponent, competitionLabel: 'FXA 35+ 8v8', rosterStatus: 'Availability is with the squad' };
    }
    return event;
  });
}
