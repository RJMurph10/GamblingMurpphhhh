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
  /** Where it was played (2019-2021 tour years, from Wikipedia; 2026 on, from the owner's schedule). */
  venue?: string;
  city?: string;
  /** The PLL's week number (2026 on, from the owner's schedule). */
  week?: number;
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

/**
 * Where the regular season ends among a summer's club games (in date order): after the last game at which
 * every club had played the same number of games. The playoffs never even out again (six of eight clubs
 * make it and the top seeds get byes), and a season still in progress is all regular season. This handles
 * 10-game seasons (2022-2025: 40 games) and 12-game ones (2026: 48).
 */
export function regularSeasonLength(club: Omit<PllGame, "phase">[]): number {
  const played = new Map<string, number>();
  let end = club.length;
  let lastEven = 0;
  club.forEach((g, i) => {
    for (const id of [g.home.teamId, g.away.teamId]) played.set(id, (played.get(id) ?? 0) + 1);
    const counts = [...played.values()];
    if (counts.length >= 6 && counts.every((n) => n === counts[0])) lastEven = i + 1;
  });
  // with no point where clubs were even, or a season still under way, call it all regular season
  if (lastEven >= club.length / 2) end = lastEven;
  return end;
}

/**
 * Tags each game's phase from its date and teams (ESPN calls every PLL game "regular season"):
 * February–April = Championship Series; All-Star teams (East, West, Team …) = All-Star; summer club
 * games = regular season up to regularSeasonLength, then playoffs.
 */
export function tagPhases(games: Omit<PllGame, "phase">[], allStarIds: Set<string>): PllGame[] {
  const sorted = [...games].sort((a, b) => a.date.localeCompare(b.date));
  const isAllStar = (g: Omit<PllGame, "phase">) =>
    allStarIds.has(g.home.teamId) || allStarIds.has(g.away.teamId);
  const month = (g: Omit<PllGame, "phase">) => new Date(g.date).getUTCMonth() + 1;
  const club = sorted.filter((g) => !isAllStar(g) && month(g) > 4);
  const regular = regularSeasonLength(club);
  const playoffIds = new Set(club.slice(regular).map((g) => g.id));
  return sorted.map((g) => ({
    ...g,
    phase: isAllStar(g)
      ? "allstar"
      : month(g) <= 4
        ? "champ"
        : playoffIds.has(g.id)
          ? "playoffs"
          : "regular",
  }));
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

/** The league split into conferences in 2024 (with the move to home cities). */
export const PLL_CONFERENCES_FROM = 2024;
export type PllConference = "East" | "West";
const EAST = new Set(["127632", "122997", "127637", "127638"]); // Atlas, Cannons, Waterdogs, Whipsnakes
const WEST = new Set(["127631", "127634", "122896", "127636"]); // Archers, Chaos, Outlaws, Redwoods

/** A club's conference that season (none before 2024). */
export function conferenceOf(teamId: string, season: number): PllConference | undefined {
  if (season < PLL_CONFERENCES_FROM) return undefined;
  return EAST.has(teamId) ? "East" : WEST.has(teamId) ? "West" : undefined;
}

/** Regular-season records in games against conference opponents. */
export function conferenceRecords(season: PllSeason): Map<string, { w: number; l: number }> {
  const out = new Map<string, { w: number; l: number }>();
  for (const g of season.games) {
    if (
      g.phase !== "regular" ||
      g.status !== "final" ||
      g.home.score == null ||
      g.away.score == null
    )
      continue;
    const ch = conferenceOf(g.home.teamId, season.season);
    if (!ch || ch !== conferenceOf(g.away.teamId, season.season)) continue;
    for (const [me, them] of [
      [g.home, g.away],
      [g.away, g.home],
    ] as const) {
      const r = out.get(me.teamId) ?? { w: 0, l: 0 };
      if ((me.score ?? 0) > (them.score ?? 0)) r.w += 1;
      else r.l += 1;
      out.set(me.teamId, r);
    }
  }
  return out;
}

export interface PllPulse {
  games: number;
  goalsPerGame: number | null;
  homeWinPct: number | null;
  avgMargin: number | null;
  oneGoalPct: number | null;
  /** Average goals (both teams) by quarter (empty when the games have no quarter scores). */
  byQuarter: number[];
}

/** League-wide numbers for a set of finished games. */
export function pulse(games: PllGame[]): PllPulse {
  const done = games.filter(
    (g) => g.status === "final" && g.home.score != null && g.away.score != null,
  );
  const n = done.length;
  const sum = (f: (g: PllGame) => number) => done.reduce((s, g) => s + f(g), 0);
  const withQ = done.filter((g) => g.home.quarters.length >= 4);
  const byQuarter = withQ.length
    ? [0, 1, 2, 3].map(
        (q) =>
          withQ.reduce((s, g) => s + (g.home.quarters[q] ?? 0) + (g.away.quarters[q] ?? 0), 0) /
          withQ.length,
      )
    : [];
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
