export type HomePane = 'you' | 'club';

const STORAGE_KEY = 'royals-home-view';
let current: HomePane = 'you';
let hydrated = false;
const listeners = new Set<() => void>();

function remember(next: HomePane) {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, next);
}

function ensure() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  const param = new URLSearchParams(window.location.search).get('view');
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (param === 'club' || param === 'you') current = param;
  else if (stored === 'club' || stored === 'you') current = stored;
}

export function getHomeView(): HomePane {
  ensure();
  return current;
}

export function setHomeView(next: HomePane) {
  ensure();
  current = next;
  remember(next);
  listeners.forEach((listener) => listener());
}

export function subscribeHomeView(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
