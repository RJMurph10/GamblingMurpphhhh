/**
 * Premier Lacrosse League (PLL): browser-safe types and helpers. Schedule and scores come from ESPN
 * (scripts-free: src/lib/pll/pll.server.ts); ESPN has no box scores or lines for the PLL, so lines will be
 * added from the paid odds feed later (project doc lacrosse-data.md).
 */

export interface PllTeam {
  id: string;
  abbr: string;
  /** "Boston Cannons" */
  name: string;
  /** "Cannons" */
  short: string;
  location: string;
  color?: string;
  logo?: string;
}

/** Part of the PLL year: the winter Championship Series (sixes), the summer season, the All-Star game, the playoffs. */
export type PllPhase = "champ" | "regular" | "allstar" | "playoffs";

export interface PllSide {
  teamId: string;
  score: number | null;
  /** Goals by quarter (overtime as a 5th entry). */
  quarters: number[];
  /** The team's record after this game, as ESPN shows it ("8-6"). */
  record?: string;
}

export interface PllGame {
  id: string;
  date: string;
  status: "scheduled" | "live" | "final";
  /** ESPN's short status ("Final", "Q3 8:12", "7:00 PM ET"). */
  detail: string;
  phase: PllPhase;
  season: number;
  home: PllSide;
  away: PllSide;
}

export interface PllSeason {
  season: number;
  teams: PllTeam[];
  games: PllGame[];
}

export const PHASE_LABEL: Record<PllPhase, string> = {
  champ: "Championship Series",
  regular: "Regular season",
  allstar: "All-Star",
  playoffs: "Playoffs",
};

/** Regular-season games per team (8 teams × 10 games = 40 games). */
export const PLL_REGULAR_GAMES = 40;

/**
 * Tags each game's phase from its date and teams (ESPN calls every PLL game "regular season"):
 * February–April = Championship Series; All-Star teams (East, West, Team …) = All-Star; of the summer club
 * games, the first 40 by date = regular season and the rest = playoffs.
 */
export function tagPhases(games: Omit<PllGame, "phase">[], allStarIds: Set<string>): PllGame[] {
  const out: PllGame[] = [];
  let summer = 0;
  for (const g of [...games].sort((a, b) => a.date.localeCompare(b.date))) {
    const month = new Date(g.date).getUTCMonth() + 1;
    let phase: PllPhase;
    if (allStarIds.has(g.home.teamId) || allStarIds.has(g.away.teamId)) phase = "allstar";
    else if (month <= 4) phase = "champ";
    else phase = summer++ < PLL_REGULAR_GAMES ? "regular" : "playoffs";
    out.push({ ...g, phase });
  }
  return out;
}

export interface PllStanding {
  team: PllTeam;
  w: number;
  l: number;
  gf: number;
  ga: number;
  home: [number, number];
  away: [number, number];
  /** Last five results, newest last ("W" / "L"). */
  last: ("W" | "L")[];
}

/** Regular-season standings: wins, then goal difference, then goals for. */
export function standings(season: PllSeason): PllStanding[] {
  const rows = new Map<string, PllStanding>();
  for (const t of season.teams)
    rows.set(t.id, { team: t, w: 0, l: 0, gf: 0, ga: 0, home: [0, 0], away: [0, 0], last: [] });
  for (const g of season.games) {
    if (
      g.phase !== "regular" ||
      g.status !== "final" ||
      g.home.score == null ||
      g.away.score == null
    )
      continue;
    for (const [me, them, at] of [
      [g.home, g.away, "home"],
      [g.away, g.home, "away"],
    ] as const) {
      const r = rows.get(me.teamId);
      if (!r) continue;
      const won = (me.score ?? 0) > (them.score ?? 0);
      if (won) r.w += 1;
      else r.l += 1;
      r.gf += me.score ?? 0;
      r.ga += them.score ?? 0;
      r[at][won ? 0 : 1] += 1;
      r.last = [...r.last, won ? ("W" as const) : ("L" as const)].slice(-5);
    }
  }
  return [...rows.values()]
    .filter((r) => r.w + r.l > 0)
    .sort((a, b) => b.w - a.w || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf);
}

export interface PllPulse {
  games: number;
  goalsPerGame: number | null;
  homeWinPct: number | null;
  avgMargin: number | null;
  oneGoalPct: number | null;
  /** Average goals (both teams) by quarter. */
  byQuarter: number[];
}

/** League-wide numbers for a set of finished games. */
export function pulse(games: PllGame[]): PllPulse {
  const done = games.filter(
    (g) => g.status === "final" && g.home.score != null && g.away.score != null,
  );
  const n = done.length;
  const sum = (f: (g: PllGame) => number) => done.reduce((s, g) => s + f(g), 0);
  const byQuarter = [0, 1, 2, 3].map((q) =>
    n ? sum((g) => (g.home.quarters[q] ?? 0) + (g.away.quarters[q] ?? 0)) / n : 0,
  );
  return {
    games: n,
    goalsPerGame: n ? sum((g) => g.home.score! + g.away.score!) / n : null,
    homeWinPct: n ? sum((g) => (g.home.score! > g.away.score! ? 1 : 0)) / n : null,
    avgMargin: n ? sum((g) => Math.abs(g.home.score! - g.away.score!)) / n : null,
    oneGoalPct: n ? sum((g) => (Math.abs(g.home.score! - g.away.score!) === 1 ? 1 : 0)) / n : null,
    byQuarter,
  };
}

export const teamOf = (season: PllSeason | undefined, id: string) =>
  season?.teams.find((t) => t.id === id);

/** "Sat, Jul 5" (with the time for upcoming games), in the viewer's time zone. */
export const pllDate = (iso: string, withTime = false) =>
  new Date(iso).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
