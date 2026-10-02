import { formatInstantTime, formatInstantWhen, zonedDateTime } from './datetime';
import type { RecapDelivery, RecapPolishMode, ScheduleEvent } from '../types/domain';

export const PAST_DELIVERY_ERROR = 'That delivery time has passed. Choose another option.';
export const UNRECORDED_ATTENDANCE_ERROR =
  'Attendance is still open. Not recorded is not the same as absent, and sending stays off until every player is marked.';
export const ZERO_RECIPIENTS_ERROR = 'Record attendance first. Recaps go only to families of children marked present.';
export const IMMEDIATE_DELIVERY_LABEL = 'Immediately after approval';

export interface DeliveryOption {
  choice: RecapDelivery;
  label: string;
  detail: string;
  at: Date | null;
  available: boolean;
}

function sessionClock(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function deliveryOptions(
  event: Pick<ScheduleEvent, 'startsAt' | 'endsAt'>,
  now = new Date(),
): DeliveryOption[] {
  const end = new Date(event.endsAt ?? event.startsAt);
  const after = new Date(end.getTime() + 120 * 60_000);
  const clock = sessionClock(event.startsAt);
  const tonight = clock ? zonedDateTime(clock.year, clock.month, clock.day, 19, 0) : new Date(NaN);
  const future = (at: Date) => Number.isFinite(at.getTime()) && at.getTime() > now.getTime();
  return [
    {
      choice: 'now',
      label: 'Send now',
      detail: IMMEDIATE_DELIVERY_LABEL,
      at: null,
      available: true,
    },
    {
      choice: 'after_session',
      label: 'Two hours after session',
      detail: Number.isFinite(after.getTime()) ? formatInstantWhen(after) : '',
      at: after,
      available: future(after),
    },
    {
      choice: 'tonight',
      label: 'Tonight',
      detail: Number.isFinite(tonight.getTime()) ? formatInstantWhen(tonight) : '',
      at: tonight,
      available: future(tonight),
    },
  ];
}

export function deliveryOption(
  event: Pick<ScheduleEvent, 'startsAt' | 'endsAt'>,
  choice: RecapDelivery,
  now = new Date(),
) {
  return deliveryOptions(event, now).find((item) => item.choice === choice) ?? deliveryOptions(event, now)[0];
}

export function deliveryApprovalError(option: DeliveryOption) {
  if (!option.available) return PAST_DELIVERY_ERROR;
  return null;
}

export function scheduledInstantIso(option: DeliveryOption, approvedAt: Date) {
  if (option.choice === 'now') return approvedAt.toISOString();
  return option.at?.toISOString();
}

export function deliveryCta(option: DeliveryOption, recipientCount: number) {
  const families = `${recipientCount} ${recipientCount === 1 ? 'family' : 'families'}`;
  if (!option.available) return 'Choose a delivery time';
  if (option.choice === 'now') return `Send to ${families} now`;
  return `Schedule for ${formatInstantTime(option.at!)}`;
}

export function deliveryPreviewWhen(option: DeliveryOption) {
  if (!option.available) return 'Choose a delivery time';
  if (option.choice === 'now') return IMMEDIATE_DELIVERY_LABEL;
  return formatInstantWhen(option.at!);
}

export function attendanceApprovalError(input: { unrecordedCount: number; recipientCount: number }) {
  if (input.unrecordedCount > 0) return UNRECORDED_ATTENDANCE_ERROR;
  if (input.recipientCount <= 0) return ZERO_RECIPIENTS_ERROR;
  return null;
}

export function applyTranscript<T extends { message?: string; transcript?: string; originalText: string }>(
  draft: T,
  outcome: 'ready' | 'failed',
  transcript: string,
): T {
  if (outcome === 'failed') return draft;
  const previous = (draft.transcript || draft.originalText).trim();
  const editor = (draft.message ?? '').trim();
  const keepEditor = Boolean(editor && editor !== previous);
  return {
    ...draft,
    transcript,
    originalText: transcript,
    message: keepEditor ? editor : transcript,
  };
}

export function applyPolish<T extends { message?: string; transcript?: string; originalText: string; polishedText: string; polishMode: RecapPolishMode | null }>(
  draft: T,
  outcome: { ok: true; text: string; mode: RecapPolishMode } | { ok: false },
): T {
  if (!outcome.ok || !outcome.text.trim()) return draft;
  const transcript = (draft.transcript || draft.originalText).trim();
  return {
    ...draft,
    transcript,
    originalText: transcript,
    message: outcome.text,
    polishedText: outcome.text,
    polishMode: outcome.mode,
  };
}
