/**
 * PLL play-by-play from the owner's copies of the PLL game page (built by scripts/lacrosse/pll-pbp.py
 * into src/data/pll-pbp-<season>.json). The box-score sheets stay the source of every stat total; this
 * is the game's event log: who did what, when, the running score and the PLL's win probability.
 */
import { PLL_CLUB_IDS } from "./player-stats";
import type { PllGame } from "./pll";

export type PllPlayKind =
  | "start"
  | "end"
  | "fo"
  | "gb"
  | "shot"
  | "to"
  | "pen"
  | "viol"
  | "timeout"
  | "goal"
  | "goal2"
  | "goalpp"
  | "goal2pp";

/** [period (5 = OT), clock remaining, kind, club, text, home win % or null, home score, away score] */
export type PllRawPlay = [
  number,
  string,
  string,
  string | null,
  string,
  number | null,
  number?,
  number?,
];

export type PllPbpGame = {
  date: string;
  home: string;
  away: string;
  file: string;
  final: [number, number];
  plays: PllRawPlay[];
};

export type PllPbpFile = { season: number; games: PllPbpGame[] };

export type PllPlay = {
  i: number;
  period: number;
  clock: string;
  /** Seconds since the opening faceoff (12-minute quarters and overtime). */
  elapsed: number;
  kind: PllPlayKind;
  /** The acting club's id, null for game start and end. */
  teamId: string | null;
  text: string;
  /** The home club's chance to win after the play, 0-100 (as this game's page orients home). */
  homeWp: number | null;
  /** The score after a goal, as this game's page orients the clubs. */
  homeScore: number | null;
  awayScore: number | null;
};

/** Seasons with play-by-play. Loaded only when a game page asks for it. */
const FILES: Record<number, () => Promise<{ default: unknown }>> = {
  2025: () => import("@/data/pll-pbp-2025.json"),
  2026: () => import("@/data/pll-pbp-2026.json"),
};

export const pllHasPbp = (season: number) => season in FILES;

export async function loadPllPbp(season: number): Promise<PllPbpFile | null> {
  const f = FILES[season];
  return f ? ((await f()).default as PllPbpFile) : null;
}

export const isGoal = (k: PllPlayKind) => k.startsWith("goal");

export const periodLabel = (p: number) => (p <= 4 ? `Q${p}` : p === 5 ? "OT" : `OT${p - 4}`);

const toSeconds = (clock: string) => {
  const [m, s] = clock.split(":").map(Number);
  return m * 60 + s;
};

/**
 * The play-by-play for one game, matched by its two clubs and a date within a day and a half (the sheets
 * carry the local date, ESPN the UTC start). Oriented to the game's own home and away: the sheets list
 * home as the club the PLL names first, which is usually but not always ESPN's home.
 */
export function pbpForGame(file: PllPbpFile | null, game: PllGame): PllPlay[] | null {
  if (!file) return null;
  const t = new Date(game.date).getTime();
  const g = file.games.find((x) => {
    const ids = [PLL_CLUB_IDS[x.home], PLL_CLUB_IDS[x.away]];
    return (
      ids.includes(game.home.teamId) &&
      ids.includes(game.away.teamId) &&
      Math.abs(new Date(`${x.date}T12:00:00Z`).getTime() - t) <= 1.5 * 86_400_000
    );
  });
  if (!g) return null;
  const flipped = PLL_CLUB_IDS[g.home] !== game.home.teamId;
  return g.plays.map(([period, clock, kind, club, text, wp, hs, as], i) => {
    const sheetHome = hs ?? null;
    const sheetAway = as ?? null;
    return {
      i,
      period,
      clock,
      elapsed: (period - 1) * 720 + (720 - toSeconds(clock)),
      kind: kind as PllPlayKind,
      teamId: club ? (PLL_CLUB_IDS[club] ?? null) : null,
      text,
      homeWp: wp == null ? null : flipped ? 100 - wp : wp,
      homeScore: flipped ? sheetAway : sheetHome,
      awayScore: flipped ? sheetHome : sheetAway,
    };
  });
}

/** Goals by period from the play-by-play, as [home, away] per period (OT included when played). */
export function pbpQuarters(plays: PllPlay[]): { home: number[]; away: number[] } {
  const last = Math.max(4, ...plays.map((p) => p.period));
  const home: number[] = [];
  const away: number[] = [];
  let h = 0;
  let a = 0;
  for (let period = 1; period <= last; period++) {
    const end = plays.filter((p) => p.period === period && p.homeScore !== null).at(-1);
    const nh = end ? end.homeScore! : h;
    const na = end ? end.awayScore! : a;
    home.push(nh - h);
    away.push(na - a);
    h = nh;
    a = na;
  }
  return { home, away };
}
