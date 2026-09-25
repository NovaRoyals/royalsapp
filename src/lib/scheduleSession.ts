export type ScheduleScope = 'mine' | 'club';

let scope: ScheduleScope | undefined;
let childId = 'all';
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeScheduleSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readScheduleScope() {
  return scope;
}

export function writeScheduleScope(next: ScheduleScope) {
  scope = next;
  emit();
}

export function readChildFilter() {
  return childId;
}

export function writeChildFilter(next: string) {
  childId = next;
  emit();
}
