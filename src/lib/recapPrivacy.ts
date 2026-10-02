export function familyCanSee(update: { kind: string; childId?: string }, childIds: string[]) {
  return update.kind === 'session_recap' || Boolean(update.childId && childIds.includes(update.childId));
}

export function noteTargets<T extends { id: string }>(present: T[], blockedIds: string[]) {
  const blocked = new Set(blockedIds);
  return present.filter((person) => !blocked.has(person.id));
}
