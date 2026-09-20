export const CCPL_CLUB_ID = 88;
export const CCPL_TEAM_ID = 1393;
export const CCPL_BASE = "https://www.ccplt20.net/CCPLT20";

export function ccplScorecardUrl(matchId: number) {
  return `${CCPL_BASE}/viewScorecard.do?matchId=${matchId}&clubId=${CCPL_CLUB_ID}`;
}

export type CricketMatchStatus = "scheduled" | "live" | "completed";
export type CricketResultType = "win" | "loss" | "tie" | "no_result" | null;

export type CricketPlayer = {
  id: string;
  ccplPlayerId?: number;
  fullName: string;
  shortName: string;
  role: "batter" | "all_rounder" | "bowler";
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  isKeeper?: boolean;
};

export type CricketBattingRow = {
  playerId?: string;
  playerName: string;
  battingOrder: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  dismissal: string;
};

export type CricketBowlingRow = {
  playerId?: string;
  playerName: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  wides?: number;
  noBalls?: number;
};

export type CricketInnings = {
  inningsNo: number;
  battingSide?: string;
  runs?: number;
  wickets?: number;
  overs?: string;
  extras?: { text?: string; runs?: number };
  fow?: { playerName: string; wicket?: number; runs?: number; over?: string; text?: string }[];
  batting: CricketBattingRow[];
  bowling: CricketBowlingRow[];
};

export type CricketBall = {
  inningsNo: number;
  seq: number;
  overLabel?: string;
  batter?: string;
  bowler?: string;
  runs?: number;
  isWicket?: boolean;
  extras?: string;
  commentary: string;
};

export type CricketMatch = {
  id: string;
  rowId?: string;
  ccplMatchId: number;
  playedAt: string;
  venue?: string;
  opponentName: string;
  homeAway?: string;
  toss?: string;
  umpires?: string;
  resultText?: string;
  resultType?: CricketResultType;
  royalsScore?: string;
  opponentScore?: string;
  playerOfMatch?: string;
  status: CricketMatchStatus;
  innings?: CricketInnings[];
  balls?: CricketBall[];
  live?: { scoreText?: string; batsmen?: string; currentBowler?: string; updatedAt?: string };
};

function p(
  fullName: string,
  role: CricketPlayer["role"],
  flags?: Partial<CricketPlayer>,
): CricketPlayer {
  const parts = fullName.split(" ");
  const shortName = parts.length === 1 ? fullName : `${parts[0]} ${parts.at(-1)![0]}`;
  return { id: fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-"), fullName, shortName, role, ...flags };
}

export const cricketSquad: CricketPlayer[] = [
  p("Sujit Khanal", "batter", { isCaptain: true }),
  p("Ashim Gautam", "batter"),
  p("Ashok Kunwar", "batter"),
  p("Binod Bhujel", "batter"),
  p("Indra Bist", "batter"),
  p("Janak Dumre", "batter"),
  p("Krishna Poudel", "batter"),
  p("Nishan Prasai", "batter"),
  p("Prem Thapa", "batter"),
  p("Rameshwar Lekhak", "batter"),
  p("Sandeep Roka", "batter"),
  p("Santosh Ghimire", "batter"),
  p("Sarad Singh Hamal", "batter"),
  p("Suraj Thapa", "batter"),
  p("Suresh Singh", "batter", { isKeeper: true }),
  p("Sushant Shrestha", "batter"),
  p("Yukesh Sitoula", "batter"),
  p("Yushek Sitoula", "batter"),
  p("Biplav Gautam", "all_rounder", { isViceCaptain: true }),
  p("Ashish Khanal", "all_rounder"),
  p("Basant Bhatt", "all_rounder"),
  p("Beni Mahato", "all_rounder"),
  p("Ehsan Ansari", "all_rounder"),
  p("Ganesh Gautam", "all_rounder"),
  p("Ganesh Giri", "all_rounder"),
  p("Ganesh Pandey", "all_rounder"),
  p("Kavin Parakh", "all_rounder"),
  p("Rupesh Phuyal", "all_rounder"),
  p("Suraj Kandel", "all_rounder"),
];

/** Verbatim CCPL results only. No live snapshot, no unpublished fixtures. */
export const ccplMatches: CricketMatch[] = [
  {
    id: "4806",
    ccplMatchId: 4806,
    playedAt: "2026-09-20",
    venue: "Manassas Field 2",
    opponentName: "LM Tigers",
    homeAway: "away",
    status: "scheduled",
  },
  {
    id: "4777",
    ccplMatchId: 4777,
    playedAt: "2026-09-12",
    opponentName: "Orange Army",
    resultText: "Won by 20 runs",
    resultType: "win",
    status: "completed",
  },
  {
    id: "4762",
    ccplMatchId: 4762,
    playedAt: "2026-08-30",
    opponentName: "Statesmen",
    resultText: "Won by 12 runs",
    resultType: "win",
    status: "completed",
  },
  {
    id: "4721",
    ccplMatchId: 4721,
    playedAt: "2026-08-22",
    opponentName: "Galaxy Legends",
    resultText: "Lost — Galaxy Legends won by 28 runs",
    resultType: "loss",
    status: "completed",
  },
  {
    id: "blitz",
    ccplMatchId: 0,
    playedAt: "2026-08-08",
    opponentName: "Blitz",
    resultText: "Tied — Blitz won the super over",
    resultType: "tie",
    status: "completed",
  },
  {
    id: "aces",
    ccplMatchId: 0,
    playedAt: "2026-08-02",
    opponentName: "Golmaal Aces",
    resultText: "Lost — Golmaal Aces won by 15 runs",
    resultType: "loss",
    status: "completed",
  },
  {
    id: "shockers",
    ccplMatchId: 0,
    playedAt: "2026-09-26",
    venue: "Manassas Field 1",
    opponentName: "Shockers",
    homeAway: "home",
    status: "scheduled",
  },
];

export function seasonRecord(matches: CricketMatch[]) {
  const done = matches.filter((item) => item.status === "completed" && item.resultType && item.resultType !== "no_result");
  return {
    won: done.filter((item) => item.resultType === "win").length,
    lost: done.filter((item) => item.resultType === "loss").length,
    tied: done.filter((item) => item.resultType === "tie").length,
    form: done
      .slice()
      .sort((a, b) => a.playedAt.localeCompare(b.playedAt))
      .map((item) => (item.resultType === "win" ? "W" : item.resultType === "tie" ? "T" : "L")),
  };
}

export function isPublishedMatch(match: CricketMatch) {
  if (match.resultType === "no_result") return false;
  if (match.status === "completed" && !match.resultText) return false;
  return true;
}

const LIVE_FRESH_MS = 120_000;

export function isTrustedLive(match: CricketMatch, now = Date.now()) {
  if (match.status !== "live" || !match.ccplMatchId) return false;
  const updated = match.live?.updatedAt;
  const score = match.live?.scoreText?.trim();
  if (!updated || !score) return false;
  const ts = Date.parse(updated);
  if (!Number.isFinite(ts)) return false;
  return now - ts <= LIVE_FRESH_MS;
}
