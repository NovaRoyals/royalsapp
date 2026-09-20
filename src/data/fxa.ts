export type SoccerSide = '35plus' | 'open';
export type SoccerMatchStatus = 'scheduled' | 'completed';

export type SoccerMatch = {
  id: string;
  leagueId: number;
  leagueName: string;
  teamId: number;
  canonicalTeam: string;
  side: SoccerSide;
  playedAt: string;
  venue?: string;
  field?: string;
  opponentName: string;
  homeAway?: 'H' | 'V';
  royalsScore?: number;
  opponentScore?: number;
  status: SoccerMatchStatus;
  gamerecapUrl?: string;
};

export type SoccerStanding = {
  leagueId: number;
  teamId?: number;
  division: string;
  teamName: string;
  rank: number;
  wins: number;
  losses: number;
  draws: number;
  pointDiff: number;
  rankingPoints: number;
};

export const FXA = {
  '35plus': {
    side: '35plus' as const,
    leagueId: 105789,
    teamId: 1059849,
    canonical: 'NOVA ROYALS AC 35+',
    leagueName: "Thursday Men's 8v8 (35+) Soccer | Fall '26",
    teamUrl: 'https://fxasports.leaguelab.com/team/1059849/NOVA-ROYALS-AC',
    scheduleUrl: 'https://fxasports.leaguelab.com/league/105789/schedule',
    detailsUrl: 'https://fxasports.leaguelab.com/league/105789/details',
    standingsUrl: 'https://fxasports.leaguelab.com/league/105789/standings',
  },
  open: {
    side: 'open' as const,
    leagueId: 105797,
    teamId: 1059119,
    canonical: 'NOVA ROYALS AC',
    leagueName: "Sunday Night Men's 8v8 Soccer | Fall '26",
    teamUrl: 'https://fxasports.leaguelab.com/team/1059119/NOVA-ROYALS-AC',
    scheduleUrl: 'https://fxasports.leaguelab.com/league/105797/schedule',
    detailsUrl: 'https://fxasports.leaguelab.com/league/105797/details',
    standingsUrl: 'https://fxasports.leaguelab.com/league/105797/standings',
  },
};

const plus = FXA['35plus'];

function venueField(venue: string, field: string) {
  return { venue, field };
}

/** Fall '26 35+ fixtures captured from the FXA team home table on 2026-09-20. */
export const fxa35PlusMatches: SoccerMatch[] = [
  {
    id: 'fxa-35-2026-09-17',
    leagueId: plus.leagueId,
    leagueName: plus.leagueName,
    teamId: plus.teamId,
    canonicalTeam: plus.canonical,
    side: '35plus',
    playedAt: '2026-09-17T20:10:00-04:00',
    ...venueField('Arrowhead Park Turf', 'Field 1A'),
    opponentName: 'Tiki Taka FC ⚽️',
    homeAway: 'H',
    royalsScore: 0,
    opponentScore: 5,
    status: 'completed',
    gamerecapUrl: 'https://fxasports.leaguelab.com/gamerecap/105789/d_2026-09-17_20-10-00_7629_1',
  },
  {
    id: 'fxa-35-2026-09-24',
    leagueId: plus.leagueId,
    leagueName: plus.leagueName,
    teamId: plus.teamId,
    canonicalTeam: plus.canonical,
    side: '35plus',
    playedAt: '2026-09-24T21:00:00-04:00',
    ...venueField('Greenbriar Park', 'Field 5A'),
    opponentName: 'Putt Pirates FC',
    homeAway: 'V',
    status: 'scheduled',
  },
  {
    id: 'fxa-35-2026-10-01',
    leagueId: plus.leagueId,
    leagueName: plus.leagueName,
    teamId: plus.teamId,
    canonicalTeam: plus.canonical,
    side: '35plus',
    playedAt: '2026-10-01T21:00:00-04:00',
    ...venueField('Sully Highlands Park', 'Field 1A'),
    opponentName: 'Mandio-k',
    homeAway: 'H',
    status: 'scheduled',
  },
  {
    id: 'fxa-35-2026-10-08',
    leagueId: plus.leagueId,
    leagueName: plus.leagueName,
    teamId: plus.teamId,
    canonicalTeam: plus.canonical,
    side: '35plus',
    playedAt: '2026-10-08T22:00:00-04:00',
    ...venueField('Greenbriar Park', 'Field 5A'),
    opponentName: '4 Ever Luduena',
    homeAway: 'V',
    status: 'scheduled',
  },
  {
    id: 'fxa-35-2026-10-15',
    leagueId: plus.leagueId,
    leagueName: plus.leagueName,
    teamId: plus.teamId,
    canonicalTeam: plus.canonical,
    side: '35plus',
    playedAt: '2026-10-15T22:00:00-04:00',
    ...venueField('Greenbriar Park', 'Field 5B'),
    opponentName: 'RED TIGER FC',
    homeAway: 'V',
    status: 'scheduled',
  },
  {
    id: 'fxa-35-2026-10-22',
    leagueId: plus.leagueId,
    leagueName: plus.leagueName,
    teamId: plus.teamId,
    canonicalTeam: plus.canonical,
    side: '35plus',
    playedAt: '2026-10-22T21:00:00-04:00',
    ...venueField('Greenbriar Park', 'Field 5A'),
    opponentName: 'ZF',
    homeAway: 'V',
    status: 'scheduled',
  },
  {
    id: 'fxa-35-2026-10-29',
    leagueId: plus.leagueId,
    leagueName: plus.leagueName,
    teamId: plus.teamId,
    canonicalTeam: plus.canonical,
    side: '35plus',
    playedAt: '2026-10-29T21:20:00-04:00',
    ...venueField('Arrowhead Park Turf', 'Field 1A'),
    opponentName: 'Club Atletico',
    homeAway: 'H',
    status: 'scheduled',
  },
  {
    id: 'fxa-35-2026-11-05',
    leagueId: plus.leagueId,
    leagueName: plus.leagueName,
    teamId: plus.teamId,
    canonicalTeam: plus.canonical,
    side: '35plus',
    playedAt: '2026-11-05T20:00:00-05:00',
    ...venueField('Hutchison Park', 'Field 4B'),
    opponentName: 'Fuegoski FC',
    homeAway: 'H',
    status: 'scheduled',
  },
];

/** Competitive division only as posted on FXA 2026-09-20. */
export const fxa35PlusStandings: SoccerStanding[] = [
  { leagueId: 105789, teamId: 1060161, division: 'Competitive', teamName: 'Tiki Taka FC ⚽️', rank: 1, wins: 1, losses: 0, draws: 0, pointDiff: 5, rankingPoints: 3 },
  { leagueId: 105789, teamId: 1054483, division: 'Competitive', teamName: 'RED TIGER FC', rank: 2, wins: 1, losses: 0, draws: 0, pointDiff: 4, rankingPoints: 3 },
  { leagueId: 105789, teamId: 1046162, division: 'Competitive', teamName: '4 Ever Luduena', rank: 3, wins: 0, losses: 0, draws: 1, pointDiff: 0, rankingPoints: 1 },
  { leagueId: 105789, teamId: 1050964, division: 'Competitive', teamName: 'Shiraz - White', rank: 4, wins: 0, losses: 0, draws: 1, pointDiff: 0, rankingPoints: 1 },
  { leagueId: 105789, teamId: 1053316, division: 'Competitive', teamName: 'Putt Pirates FC', rank: 5, wins: 0, losses: 0, draws: 1, pointDiff: 0, rankingPoints: 1 },
  { leagueId: 105789, teamId: 1054024, division: 'Competitive', teamName: 'Mandio-k', rank: 6, wins: 0, losses: 0, draws: 1, pointDiff: 0, rankingPoints: 1 },
  { leagueId: 105789, teamId: 1054533, division: 'Competitive', teamName: 'Club Atletico', rank: 7, wins: 0, losses: 0, draws: 0, pointDiff: 0, rankingPoints: 0 },
  { leagueId: 105789, teamId: 1059953, division: 'Competitive', teamName: 'ZF', rank: 8, wins: 0, losses: 0, draws: 0, pointDiff: 0, rankingPoints: 0 },
  { leagueId: 105789, teamId: 1057628, division: 'Competitive', teamName: 'Fuegoski FC', rank: 9, wins: 0, losses: 1, draws: 0, pointDiff: -4, rankingPoints: 0 },
  { leagueId: 105789, teamId: 1059849, division: 'Competitive', teamName: 'NOVA ROYALS AC', rank: 10, wins: 0, losses: 1, draws: 0, pointDiff: -5, rankingPoints: 0 },
];

export const fxa35PlusHistory = [
  { label: "Thu 35+ Summer '26 · Competitive", detail: 'Nova Royal AC - White · 3-4-1', href: 'https://fxasports.leaguelab.com/team/1033671/Nova-Royal-AC---White' },
  { label: "Thu 35+ Spring '26", detail: 'Nova Royal AC - White · 8 players in common', href: 'https://fxasports.leaguelab.com/team/1031597/Nova-Royal-AC---White' },
];

export function soccerRecord(matches: SoccerMatch[]) {
  const completed = matches.filter((item) => item.status === 'completed' && item.royalsScore != null && item.opponentScore != null);
  let won = 0;
  let lost = 0;
  let drawn = 0;
  for (const item of completed) {
    if (item.royalsScore === item.opponentScore) drawn += 1;
    else if ((item.royalsScore ?? 0) > (item.opponentScore ?? 0)) won += 1;
    else lost += 1;
  }
  return { won, lost, drawn, played: completed.length };
}

export function soccerResultText(match: SoccerMatch) {
  if (match.status !== 'completed' || match.royalsScore == null || match.opponentScore == null) return '';
  if (match.royalsScore === match.opponentScore) return `Tied ${match.royalsScore}–${match.opponentScore}`;
  if (match.royalsScore > match.opponentScore) return `Won ${match.royalsScore}–${match.opponentScore}`;
  return `Lost ${match.royalsScore}–${match.opponentScore}`;
}
