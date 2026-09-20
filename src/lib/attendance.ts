export type SessionHistoryRow = {
  id: string;
  label: string;
  status: 'present' | 'absent' | 'late' | 'upcoming';
};

export const mayaAttendanceHistory: SessionHistoryRow[] = [
  { id: 'h1', label: 'Jul 12', status: 'present' },
  { id: 'h2', label: 'Jul 19', status: 'present' },
  { id: 'h3', label: 'Jul 26', status: 'present' },
  { id: 'h4', label: 'Aug 2', status: 'present' },
  { id: 'h5', label: 'Aug 9', status: 'absent' },
  { id: 'h6', label: 'Aug 16', status: 'present' },
  { id: 'h7', label: 'Aug 23', status: 'present' },
  { id: 'h8', label: 'Aug 30', status: 'present' },
  { id: 'h9', label: 'Sep 6', status: 'present' },
  { id: 'h10', label: 'Sep 13', status: 'upcoming' },
];

export function completedAttendance(history: SessionHistoryRow[]) {
  const past = history.filter((row) => row.status !== 'upcoming');
  const attended = past.filter((row) => row.status === 'present' || row.status === 'late').length;
  const total = past.length;
  const percent = total ? Math.round((attended / total) * 100) : 0;
  return { attended, total, percent };
}

export function privacyName(
  person: { firstName: string; lastName: string; displayName: string; isMinor?: boolean },
  authorized: boolean,
) {
  if (person.isMinor) {
    return authorized ? person.displayName : `${person.firstName.slice(0, 1)}. ${person.lastName.slice(0, 1)}.`;
  }
  if (authorized) return person.displayName;
  const last = person.lastName?.slice(0, 1) ?? '';
  return last ? `${person.firstName} ${last}.` : person.firstName;
}
