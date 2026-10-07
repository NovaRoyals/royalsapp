import type { DirectMessage, UserRole } from '../types/domain';

/**
 * Who can talk to whom, and who can see what.
 *
 * Three kinds of private thread exist:
 *   - coach     a family's own thread with the coach (the one that matters most)
 *   - family    the coach's side of another family's thread (coach only)
 *   - parent    a thread between two parents on the same team, opt-in on both sides
 *
 * A thread is visible only to the people in it. Admins do not read private threads; they see
 * a report if someone files one. Parent threads never carry phone numbers or emails, and
 * children are never participants.
 */

export const COACH_THREAD = 'coach-priya';
export const COACH_ID = 'coach:priya';

export type ThreadKind = 'coach' | 'family' | 'parent';
export type Viewer = { id: string; role: UserRole };

export function viewerFor(role: UserRole, householdId: string): Viewer | null {
  if (role === 'guardian') return { id: `guardian:${householdId}`, role };
  if (role === 'coach') return { id: COACH_ID, role };
  return null;
}

export function threadKind(threadId: string): ThreadKind | null {
  if (threadId === COACH_THREAD) return 'coach';
  if (threadId.startsWith('family-')) return 'family';
  if (threadId.startsWith('parent-')) return 'parent';
  return null;
}

/** The child whose parent is on the other end of a parent or family thread. */
export function threadChildId(threadId: string) {
  const kind = threadKind(threadId);
  return kind === 'parent' || kind === 'family' ? threadId.slice(kind.length + 1) : null;
}

export function canSeeThread(viewer: Viewer | null, threadId: string) {
  if (!viewer) return false;
  const kind = threadKind(threadId);
  if (kind === 'coach') return viewer.role === 'guardian' || viewer.role === 'coach';
  if (kind === 'family') return viewer.role === 'coach';
  if (kind === 'parent') return viewer.role === 'guardian';
  return false;
}

export function senderIdFor(role: UserRole, householdId: string) {
  return role === 'guardian' ? `guardian:${householdId}` : role === 'coach' || role === 'admin' ? COACH_ID : `${role}:${householdId}`;
}

/** Older saved messages have no sender id; the role says who it was. */
export function messageSenderId(message: DirectMessage) {
  if (message.fromId) return message.fromId;
  return message.fromRole === 'guardian' ? 'guardian:household-demo' : COACH_ID;
}

export function isMine(message: DirectMessage, viewer: Viewer | null) {
  return Boolean(viewer) && messageSenderId(message) === viewer!.id;
}

export function messagesIn(messages: DirectMessage[], threadId: string) {
  return messages
    .filter((message) => message.threadId === threadId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function readKey(viewer: Viewer, threadId: string) {
  return `${viewer.id}|${threadId}`;
}

export function unreadCount(messages: DirectMessage[], threadId: string, viewer: Viewer | null, reads: Record<string, string>) {
  if (!viewer || !canSeeThread(viewer, threadId)) return 0;
  const seenAt = reads[readKey(viewer, threadId)];
  const seen = seenAt ? new Date(seenAt).getTime() : 0;
  return messagesIn(messages, threadId).filter((message) => !isMine(message, viewer) && new Date(message.createdAt).getTime() > seen).length;
}

export function totalUnread(messages: DirectMessage[], viewer: Viewer | null, reads: Record<string, string>, blocked: string[] = [], parentChatOn = true) {
  if (!viewer) return 0;
  const ids = [...new Set(messages.map((message) => message.threadId))];
  return ids.reduce((sum, id) => {
    if (blocked.includes(id)) return sum;
    if (threadKind(id) === 'parent' && !parentChatOn) return sum;
    return sum + unreadCount(messages, id, viewer, reads);
  }, 0);
}

export function lastMessage(messages: DirectMessage[], threadId: string) {
  const list = messagesIn(messages, threadId);
  return list[list.length - 1];
}

export type ContactCheck = { blocked: false } | { blocked: true; reason: string };

/**
 * Parent-to-parent messages may not carry a way to leave the app. This is a nudge that
 * catches the obvious cases (phone numbers, emails, links); it is not a promise that nothing
 * can be spelled around it, which is why reporting exists.
 */
export function checkContactInfo(text: string): ContactCheck {
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(text)) return { blocked: true, reason: 'Email addresses can’t be shared in parent chats.' };
  if (/(https?:\/\/|www\.)\S+/i.test(text)) return { blocked: true, reason: 'Links can’t be shared in parent chats.' };
  for (const run of text.match(/\+?\d[\d\s().-]{7,}\d/g) ?? []) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(run.trim())) continue;
    if (run.replace(/\D/g, '').length >= 9) return { blocked: true, reason: 'Phone numbers can’t be shared in parent chats.' };
  }
  return { blocked: false };
}

export type SendCheck = { ok: true } | { ok: false; error: string };

export function checkSend(input: {
  viewer: Viewer | null;
  threadId: string;
  body: string;
  parentChatOn: boolean;
  blocked: string[];
}): SendCheck {
  const { viewer, threadId, body, parentChatOn, blocked } = input;
  if (!body.trim()) return { ok: false, error: 'Write a message first.' };
  if (!viewer || !canSeeThread(viewer, threadId)) return { ok: false, error: 'You can’t send to this conversation.' };
  if (blocked.includes(threadId)) return { ok: false, error: 'You blocked this conversation. Unblock it to send.' };
  if (threadKind(threadId) === 'parent') {
    if (!parentChatOn) return { ok: false, error: 'Turn on parent chat to message other parents.' };
    const contact = checkContactInfo(body);
    if (contact.blocked) return { ok: false, error: contact.reason };
  }
  return { ok: true };
}

/** "Parent of Elena" — a parent is named by their child's first name, never by contact details. */
export function parentLabel(childFirstName: string) {
  return `Parent of ${childFirstName}`;
}

export function initialsOf(label: string) {
  // A title in front of a name is not part of the initials: "Coach Sakchham Karki" is SK.
  const words = label.replace(/[^A-Za-z ]/g, ' ').trim().replace(/^coach\s+(?=\S+\s+\S)/i, '').split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}

/** Short time for a thread row: time today, "Yesterday", weekday this week, else a date. */
export function threadTime(iso: string, now = new Date()) {
  const date = new Date(iso);
  const day = (value: Date) => new Date(value.toLocaleString('en-US', { timeZone: 'America/New_York' })).setHours(0, 0, 0, 0);
  const diff = Math.round((day(now) - day(date)) / 86_400_000);
  if (diff <= 0) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
}

/** Messages with a date heading before the first message of each day. */
export function withDayBreaks(list: DirectMessage[], now = new Date()) {
  const rows: ({ type: 'day'; key: string; label: string } | { type: 'message'; key: string; message: DirectMessage })[] = [];
  let lastDay = '';
  for (const message of list) {
    const key = new Date(message.createdAt).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    if (key !== lastDay) {
      lastDay = key;
      const diff = Math.round((new Date(now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })).getTime() - new Date(key).getTime()) / 86_400_000);
      const label =
        diff === 0
          ? 'Today'
          : diff === 1
            ? 'Yesterday'
            : new Date(`${key}T12:00:00-04:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/New_York' });
      rows.push({ type: 'day', key: `day-${key}`, label });
    }
    rows.push({ type: 'message', key: message.id, message });
  }
  return rows;
}
