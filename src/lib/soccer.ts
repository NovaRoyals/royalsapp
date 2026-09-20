import { supabase } from '@/lib/supabase';
import {
  FXA,
  fxa35PlusHistory,
  fxa35PlusMatches,
  fxa35PlusStandings,
  soccerRecord,
  soccerResultText,
  type SoccerMatch,
  type SoccerSide,
  type SoccerStanding,
} from '@/data/fxa';

export { FXA, fxa35PlusHistory, soccerRecord, soccerResultText };
export type { SoccerMatch, SoccerSide, SoccerStanding };

function canonicalFor(side: SoccerSide) {
  return FXA[side].canonical;
}

function demoMatches(side: SoccerSide): SoccerMatch[] {
  if (side !== '35plus') return [];
  return [...fxa35PlusMatches].sort((a, b) => b.playedAt.localeCompare(a.playedAt));
}

function demoStandings(side: SoccerSide): SoccerStanding[] {
  if (side !== '35plus') return [];
  return fxa35PlusStandings.filter((item) => item.division === 'Competitive');
}

function mapMatch(row: Record<string, unknown>, side: SoccerSide): SoccerMatch {
  return {
    id: String(row.id),
    leagueId: Number(row.league_id),
    leagueName: String(row.league_name),
    teamId: Number(row.team_id),
    canonicalTeam: String(row.canonical_team),
    side,
    playedAt: String(row.played_at),
    venue: row.venue ? String(row.venue) : undefined,
    field: row.field ? String(row.field) : undefined,
    opponentName: String(row.opponent_name),
    homeAway: row.home_away === 'H' || row.home_away === 'V' ? row.home_away : undefined,
    royalsScore: row.royals_score == null ? undefined : Number(row.royals_score),
    opponentScore: row.opponent_score == null ? undefined : Number(row.opponent_score),
    status: row.status === 'completed' ? 'completed' : 'scheduled',
    gamerecapUrl: row.gamerecap_url ? String(row.gamerecap_url) : undefined,
  };
}

export async function getMatches(side: SoccerSide): Promise<SoccerMatch[]> {
  if (!supabase) return demoMatches(side);
  const { data, error } = await supabase
    .from('soccer_matches')
    .select('*')
    .eq('canonical_team', canonicalFor(side))
    .order('played_at', { ascending: false });
  if (error || !data?.length) return demoMatches(side);
  return data.map((row) => mapMatch(row, side));
}

export async function getUpcoming(side: SoccerSide): Promise<SoccerMatch[]> {
  const matches = await getMatches(side);
  return matches.filter((item) => item.status === 'scheduled').sort((a, b) => a.playedAt.localeCompare(b.playedAt));
}

export async function getStandings(leagueId: number, division = 'Competitive'): Promise<SoccerStanding[]> {
  const side = leagueId === FXA.open.leagueId ? 'open' : '35plus';
  if (!supabase) return demoStandings(side).filter((item) => item.leagueId === leagueId && item.division === division);
  const { data, error } = await supabase
    .from('soccer_standings')
    .select('*')
    .eq('league_id', leagueId)
    .eq('division', division)
    .order('rank');
  if (error || !data?.length) return demoStandings(side).filter((item) => item.division === division);
  return data.map((row) => ({
    leagueId: Number(row.league_id),
    teamId: row.team_id == null ? undefined : Number(row.team_id),
    division: String(row.division),
    teamName: String(row.team_name),
    rank: Number(row.rank),
    wins: Number(row.wins),
    losses: Number(row.losses),
    draws: Number(row.draws),
    pointDiff: Number(row.point_diff),
    rankingPoints: Number(row.ranking_points),
  }));
}
