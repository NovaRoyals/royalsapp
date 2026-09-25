type HydrateRow = {
  at: string;
  component: string;
  hasWindow: boolean;
  details: Record<string, unknown>;
};

function sink(): HydrateRow[] {
  if (typeof globalThis === 'undefined') return [];
  const bag = globalThis as typeof globalThis & { __ROYALS_HYDRATE_LOG?: HydrateRow[] };
  if (!bag.__ROYALS_HYDRATE_LOG) bag.__ROYALS_HYDRATE_LOG = [];
  return bag.__ROYALS_HYDRATE_LOG;
}

/** Temporary hydration diagnostics. Does not filter React errors. */
export function hydrateTrace(component: string, details: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const row: HydrateRow = {
    at: 'browser-render',
    component,
    hasWindow: true,
    details,
  };
  sink().push(row);
  if (details.hasHydrated === true) return;
  console.info(`[hydrate] ${row.at} ${component}`, details);
}

export function hydrateTraceEffect(component: string, details: Record<string, unknown>) {
  const row: HydrateRow = {
    at: 'browser-effect',
    component,
    hasWindow: true,
    details,
  };
  sink().push(row);
  console.info(`[hydrate] browser-effect ${component}`, details);
}
