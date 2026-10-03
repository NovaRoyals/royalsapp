import type { TintName } from '@/theme/tokens';

/** One color per team so a glance down Home tells you whose game it is. */
export function tintFor(event: { teamId?: string; sport?: string }): TintName {
  const team = event.teamId ?? '';
  if (event.sport === 'cricket' || team.includes('cricket')) return 'lilac';
  if (team.includes('kids')) return 'gold';
  if (team.includes('women')) return 'blush';
  if (team.includes('35')) return 'sky';
  return 'mint';
}
