import { supabase } from "@/lib/supabase";
import { privacyName } from "@/lib/attendance";
import {
  ccplMatches,
  cricketSquad,
  type CricketMatch,
  type CricketPlayer,
} from "@/data/ccpl";
import type { RealtimeChannel } from "@supabase/supabase-js";

export { seasonRecord, ccplScorecardUrl } from "@/data/ccpl";
export type { CricketMatch, CricketPlayer, CricketBall } from "@/data/ccpl";

export function displayCricketName(fullName: string, signedIn: boolean) {
  const parts = fullName.trim().split(/\s+/);
  const last = parts.at(-1) ?? "";
  const first = parts.slice(0, -1).join(" ") || parts[0];
  return privacyName(
    { firstName: first, lastName: last, displayName: fullName, isMinor: false },
    signedIn,
  );
}

export async function getMatches(): Promise<CricketMatch[]> {
  if (!supabase) {
    return [...ccplMatches].sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  }
  const { data, error } = await supabase.from("cricket_matches").select("*").order("played_at", { ascending: false });
  if (error || !data?.length) {
    return [...ccplMatches].sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  }
  return data.map(mapMatchRow);
}

export async function getMatchDetail(id: string): Promise<CricketMatch | undefined> {
  const local = ccplMatches.find((item) => item.id === id || String(item.ccplMatchId) === id);
  if (!supabase) return local;
  const ccplId = Number(id);
  const query = supabase.from("cricket_matches").select("*");
  const { data: match } = Number.isFinite(ccplId) && ccplId > 0
    ? await query.eq("ccpl_match_id", ccplId).maybeSingle()
    : await query.eq("id", id).maybeSingle();
  if (!match) return local;
  const mapped = mapMatchRow(match);
  const { data: innings } = await supabase.from("cricket_innings").select("*").eq("match_id", match.id).order("innings_no");
  const inningsRows = innings ?? [];
  mapped.innings = await Promise.all(
    inningsRows.map(async (inn) => {
      const [{ data: batting }, { data: bowling }] = await Promise.all([
        supabase!.from("cricket_batting").select("*").eq("innings_id", inn.id).order("batting_order"),
        supabase!.from("cricket_bowling").select("*").eq("innings_id", inn.id),
      ]);
      return {
        inningsNo: inn.innings_no,
        battingSide: inn.batting_side,
        runs: inn.runs,
        wickets: inn.wickets,
        overs: inn.overs,
        extras: inn.extras,
        fow: inn.fow,
        batting: (batting ?? []).map((row) => ({
          playerId: row.player_id ?? undefined,
          playerName: row.player_name,
          battingOrder: row.batting_order,
          runs: row.runs,
          balls: row.balls,
          fours: row.fours,
          sixes: row.sixes,
          dismissal: row.dismissal ?? "",
        })),
        bowling: (bowling ?? []).map((row) => ({
          playerId: row.player_id ?? undefined,
          playerName: row.player_name,
          overs: Number(row.overs),
          maidens: row.maidens,
          runs: row.runs,
          wickets: row.wickets,
          wides: row.wides,
          noBalls: row.no_balls,
        })),
      };
    }),
  );
  const { data: balls } = await supabase.from("cricket_balls").select("*").eq("match_id", match.id).order("innings_no").order("seq");
  mapped.balls = (balls ?? []).map((row) => ({
    inningsNo: row.innings_no,
    seq: row.seq,
    overLabel: row.over_label,
    batter: row.batter,
    bowler: row.bowler,
    runs: row.runs,
    isWicket: row.is_wicket,
    extras: row.extras,
    commentary: row.commentary ?? "",
  }));
  const { data: live } = await supabase.from("cricket_live_state").select("*").eq("match_id", match.id).maybeSingle();
  if (live) {
    mapped.live = {
      scoreText: live.score_text,
      batsmen: typeof live.batsmen === "string" ? live.batsmen : JSON.stringify(live.batsmen ?? ""),
      currentBowler: live.current_bowler,
      updatedAt: live.updated_at,
    };
  }
  return mapped;
}

export async function getPlayerProfile(id: string): Promise<{
  player: CricketPlayer;
  matches: number;
  runs: number;
  average: number | null;
  strikeRate: number | null;
  fifties: number;
  hundreds: number;
  wickets: number;
  log: { matchId: string; opponent: string; date: string; runs?: number; wickets?: number }[];
} | undefined> {
  const player = cricketSquad.find((item) => item.id === id);
  if (!player) return undefined;
  const matches = await getMatches();
  const log: { matchId: string; opponent: string; date: string; runs?: number; wickets?: number }[] = [];
  let runs = 0;
  let outs = 0;
  let balls = 0;
  let fifties = 0;
  let hundreds = 0;
  let wickets = 0;
  let innings = 0;
  for (const match of matches) {
    const detail = match.innings ? match : await getMatchDetail(match.id);
    let batRuns: number | undefined;
    let bowlWkts: number | undefined;
    for (const inn of detail?.innings ?? []) {
      for (const row of inn.batting) {
        if (row.playerId === player.id || row.playerName === player.fullName) {
          batRuns = row.runs;
          runs += row.runs;
          balls += row.balls;
          innings += 1;
          if (!/not out/i.test(row.dismissal)) outs += 1;
          if (row.runs >= 100) hundreds += 1;
          else if (row.runs >= 50) fifties += 1;
        }
      }
      for (const row of inn.bowling) {
        if (row.playerId === player.id || row.playerName === player.fullName) {
          bowlWkts = row.wickets;
          wickets += row.wickets;
        }
      }
    }
    if (batRuns != null || bowlWkts != null) {
      log.push({ matchId: match.id, opponent: match.opponentName, date: match.playedAt, runs: batRuns, wickets: bowlWkts });
    }
  }
  return {
    player,
    matches: log.length,
    runs,
    average: outs ? Math.round((runs / outs) * 10) / 10 : innings ? runs : null,
    strikeRate: balls ? Math.round((runs / balls) * 1000) / 10 : null,
    fifties,
    hundreds,
    wickets,
    log,
  };
}

export function subscribeLive(matchId: string, onChange: () => void): () => void {
  if (!supabase) return () => undefined;
  const channel: RealtimeChannel = supabase
    .channel(`cricket-live-${matchId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "cricket_balls" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "cricket_live_state" }, onChange)
    .subscribe();
  return () => {
    supabase?.removeChannel(channel);
  };
}

function mapMatchRow(row: Record<string, unknown>): CricketMatch {
  return {
    id: String(row.ccpl_match_id || row.id),
    ccplMatchId: Number(row.ccpl_match_id),
    playedAt: String(row.played_at ?? ""),
    venue: row.venue as string | undefined,
    opponentName: String(row.opponent_name ?? ""),
    homeAway: row.home_away as string | undefined,
    toss: row.toss as string | undefined,
    umpires: row.umpires as string | undefined,
    resultText: row.result_text as string | undefined,
    resultType: (row.result_type as CricketMatch["resultType"]) ?? null,
    royalsScore: row.royals_score as string | undefined,
    opponentScore: row.opponent_score as string | undefined,
    playerOfMatch: row.player_of_match as string | undefined,
    status: (row.status as CricketMatch["status"]) ?? "completed",
  };
}
