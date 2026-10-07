import { formatEventParts, formatEventWhen } from '@/lib/datetime';
import { familyCanSee } from '@/lib/recapPrivacy';
import type { AppNotification, AttendanceMark, CoachNoteTag, CoachUpdate, IndividualCoachNote, Person, ScheduleEvent, SessionRecap } from '@/types/domain';

export const RECAP_EVENT_ID = 'kids-2026-09-20';

/** Single source for the active U8 coach identity in this demo. */
export const ACTIVE_COACH = {
  id: 'coach-priya',
  firstName: 'Priya',
  lastName: 'Sharma',
  fullName: 'Priya Sharma',
  displayName: 'Coach Priya Sharma',
  email: 'infonovaroyals@gmail.com',
} as const;

export const NOTE_TAGS: { id: CoachNoteTag; label: string; kind: 'encourage' | 'practice' | 'follow' }[] = [
  { id: 'strong_effort', label: 'Strong effort', kind: 'encourage' },
  { id: 'great_teamwork', label: 'Great teamwork', kind: 'encourage' },
  { id: 'improved_confidence', label: 'Improved confidence', kind: 'encourage' },
  { id: 'excellent_listening', label: 'Excellent listening', kind: 'encourage' },
  { id: 'practice_first_touch', label: 'Practice first touch', kind: 'practice' },
  { id: 'practice_passing', label: 'Practice passing', kind: 'practice' },
  { id: 'coach_follow_up', label: 'Coach follow-up', kind: 'follow' },
];

export function tagLabel(id: CoachNoteTag) {
  return NOTE_TAGS.find((item) => item.id === id)?.label ?? id;
}

export function noteKind(tags: CoachNoteTag[]): 'private_note' | 'practice_suggestion' {
  const practice = tags.some((tag) => NOTE_TAGS.find((item) => item.id === tag)?.kind === 'practice');
  return practice && tags.every((tag) => NOTE_TAGS.find((item) => item.id === tag)?.kind === 'practice')
    ? 'practice_suggestion'
    : 'private_note';
}

export function noteDraftFromTags(tags: CoachNoteTag[], extra: string) {
  const labels = tags.map(tagLabel);
  const extraText = extra.trim();
  if (labels.length && extraText) return `${labels.join(' · ')}. ${extraText}`;
  if (labels.length) return labels.join(' · ');
  return extraText;
}

export function attendanceCounts(roster: Person[], checkIns: AttendanceMark[]) {
  const present = roster.filter((person) => checkIns.some((row) => row.personId === person.id && row.present));
  const absent = roster.filter((person) => checkIns.some((row) => row.personId === person.id && !row.present));
  const unrecordedCount = roster.length - present.length - absent.length;
  return { present, absent, presentCount: present.length, absentCount: absent.length, unrecordedCount };
}

export function recapForEvent(recaps: SessionRecap[], eventId: string) {
  return recaps.find((item) => item.eventId === eventId);
}

export const MOCK_VOICE_TRANSCRIPT =
  'Okay so today the group worked on first touch and passing in pairs. Energy was high after the water break. We finished with a small-sided game on the far goal. Remind families shin guards and a labeled jacket for next Sunday.';

export const DEMO_POLISHED_RECAP =
  'Today the group worked on first touch and passing in pairs. Energy was high after the water break. We closed with a small-sided game on the far goal. Please remember shin guards and a labeled jacket for next Sunday.';

export const DEMO_RECAP_ID = 'recap-u8-sep20';

export const DEMO_NOTES: IndividualCoachNote[] = [
  {
    childId: 'child-maya',
    childFirstName: 'Maya',
    tags: ['strong_effort', 'great_teamwork'],
    originalText: 'Kept encouraging teammates after the small-sided game.',
    approvedText: 'Strong effort · Great teamwork. Kept encouraging teammates after the small-sided game.',
  },
  {
    childId: 'u8-jl',
    childFirstName: 'Jonah',
    tags: ['practice_first_touch'],
    originalText: '',
    approvedText: 'Practice first touch',
  },
];

export function demoDraftRecap(): SessionRecap {
  return {
    id: DEMO_RECAP_ID,
    eventId: RECAP_EVENT_ID,
    teamId: 'nova-royals-kids-u8',
    coachName: ACTIVE_COACH.displayName,
    originalText: MOCK_VOICE_TRANSCRIPT,
    transcript: MOCK_VOICE_TRANSCRIPT,
    message: DEMO_POLISHED_RECAP,
    polishedText: DEMO_POLISHED_RECAP,
    polishMode: 'warm',
    notes: DEMO_NOTES,
    status: 'draft',
    recipientCount: 14,
    updatedAt: '2026-09-20T12:05:00-04:00',
  };
}

export function demoCoachReminder(): AppNotification {
  return {
    id: 'notification-coach-recap-sep20',
    type: 'coach_reminder',
    title: 'Send families a quick session recap',
    body: 'The session ended two hours ago. Attendance is in. A shared recap is optional and never sends by itself.',
    createdAt: '2026-09-20T12:00:00-04:00',
    read: false,
    route: `/session/${RECAP_EVENT_ID}/recap`,
    urgency: 'normal',
    wouldPush: true,
  };
}

/** The shared message families receive. A stored polish never overrides the editor. */
export function canonicalRecapText(recap: SessionRecap) {
  if (recap.message?.trim()) return recap.message.trim();
  if (recap.polishedText.trim() && recap.polishMode && recap.polishMode !== 'verbatim') return recap.polishedText.trim();
  return recap.originalText.trim();
}

export function recapBody(recap: SessionRecap) {
  return canonicalRecapText(recap);
}

export function recapTranscript(recap: SessionRecap) {
  return (recap.transcript || recap.originalText).trim();
}

export function sessionIdentity(event: Pick<ScheduleEvent, 'title' | 'startsAt' | 'ageGroup' | 'subtitle' | 'competitionLabel'>) {
  const parts = formatEventParts(event.startsAt);
  const group = event.ageGroup || event.competitionLabel || event.subtitle;
  return {
    group,
    weekday: parts.weekday,
    when: formatEventWhen(event.startsAt),
    kicker: [group, parts.weekday].filter(Boolean).join(' · '),
    title: event.title,
  };
}

export function recapAudience(roster: Person[], checkIns: AttendanceMark[]) {
  const counts = attendanceCounts(roster, checkIns);
  const missingContact = counts.present.filter((person) => person.familyContact === false);
  const recipients = counts.present.filter((person) => person.familyContact !== false);
  return { ...counts, missingContact, recipients };
}

export function parentUpdatesFromRecap(
  recap: SessionRecap,
  event: { id: string; title: string; startsAt: string },
  sentAt: string,
): CoachUpdate[] {
  const body = recapBody(recap);
  const shared: CoachUpdate = {
    id: `update-recap-${recap.eventId}`,
    recapId: recap.id,
    eventId: recap.eventId,
    kind: 'session_recap',
    title: 'Session recap',
    body,
    coachName: ACTIVE_COACH.displayName,
    sessionTitle: event.title,
    sessionStartsAt: event.startsAt,
    sentAt,
  };
  const notes = recap.notes
    .filter((note) => note.approvedText.trim() || note.originalText.trim() || note.tags.length)
    .map((note) => {
      const text = note.approvedText.trim() || noteDraftFromTags(note.tags, note.originalText);
      const kind = noteKind(note.tags);
      return {
        id: `update-note-${recap.eventId}-${note.childId}`,
        recapId: recap.id,
        eventId: recap.eventId,
        kind,
        title: kind === 'practice_suggestion' ? 'Practice suggestion' : 'Private note',
        body: text,
        childId: note.childId,
        childFirstName: note.childFirstName,
        coachName: ACTIVE_COACH.displayName,
        sessionTitle: event.title,
        sessionStartsAt: event.startsAt,
        sentAt,
      } satisfies CoachUpdate;
    });
  return [shared, ...notes];
}

export function parentUpdatesFor(updates: CoachUpdate[], childIds: string[]) {
  return updates.filter((item) => familyCanSee(item, childIds));
}

export const KIND_LABEL: Record<CoachUpdate['kind'], string> = {
  session_recap: 'Session recap',
  private_note: 'Private note',
  practice_suggestion: 'Practice suggestion',
};
