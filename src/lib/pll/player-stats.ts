import data from "@/data/pll-player-games.json";
import { pllRoster } from "./players";

/**
 * PLL player game stats entered by the site owner from the PLL website (Google Sheets, one per game),
 * parsed by scripts/lacrosse/pll-sheets.py and checked against ESPN's final scores. Bios from the
 * Lacrosse API pull (college, experience) and the club's Wikipedia roster (height, weight, shot,
 * hometown).
 */
export interface PllStatLine {
  /** Points: 1-point goals + 2 x 2-point goals + assists. */
  P: number;
  G1: number;
  G2: number;
  A: number;
  Sh: number;
  GB: number;
  /** Turnovers and passes are on the sheet's offensive lines only: null when the player had none. */
  TO: number | null;
  /** null in 2019-2021: the PLL kept no touches or passes then. */
  TCH: number | null;
  PAS: number | null;
  /** Caused turnovers and penalties are on the defensive lines only. */
  CT: number | null;
  Pen: number | null;
  FOW?: number;
  FOT?: number;
  /** Goalies: scores against (2-point goals count 2), saves, save %, clean saves, goals against. */
  SA?: number;
  Sv?: number;
  SvPct?: number;
  CSv?: number;
  GA?: number | null;
}

interface SavedPlayer {
  name: string;
  pos: string | null;
  num: string | null;
  stats?: PllStatLine;
}
interface SavedGame {
  team: string;
  season: number;
  date: string;
  opponent: string;
  players: SavedPlayer[];
}
interface SavedBio {
  college?: string;
  experience?: number;
  jersey_number?: number;
  position_name?: string;
}

const saved = data as unknown as { games: SavedGame[]; bios?: Record<string, SavedBio> };

/** Club ids by the short name the sheets use. */
export const PLL_CLUB_IDS: Record<string, string> = {
  Archers: "127631",
  Atlas: "127632",
  Cannons: "122997",
  Chaos: "127634",
  Chrome: "127635",
  Outlaws: "122896",
  Redwoods: "127636",
  Waterdogs: "127637",
  Whipsnakes: "127638",
};

export const playerSlug = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export interface PllPlayerGame {
  season: number;
  date: string;
  team: string;
  teamId: string;
  opponent: string;
  opponentId: string;
  stats: PllStatLine;
}

export interface PllPlayer {
  slug: string;
  name: string;
  pos: string;
  num: string | null;
  team: string;
  teamId: string;
  games: PllPlayerGame[];
  bio: SavedBio & { height?: string; weight?: string; shot?: string; hometown?: string };
}

let cache: Map<string, PllPlayer> | null = null;

/** Every player with entered game stats, by slug. */
export function pllPlayers(): Map<string, PllPlayer> {
  if (cache) return cache;
  const out = new Map<string, PllPlayer>();
  for (const g of [...saved.games].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const p of g.players) {
      if (!p.stats) continue;
      const slug = playerSlug(p.name);
      const teamId = PLL_CLUB_IDS[g.team] ?? g.team;
      const pl =
        out.get(slug) ??
        ({
          slug,
          name: p.name,
          pos: p.pos ?? "",
          num: p.num,
          team: g.team,
          teamId,
          games: [],
          bio: { ...(saved.bios?.[p.name] ?? {}) },
        } satisfies PllPlayer);
      // the latest game decides position, number and club
      if (p.pos) pl.pos = p.pos;
      if (p.num) pl.num = p.num;
      pl.team = g.team;
      pl.teamId = teamId;
      pl.games.push({
        season: g.season,
        date: g.date,
        team: g.team,
        teamId,
        opponent: g.opponent,
        opponentId: PLL_CLUB_IDS[g.opponent] ?? g.opponent,
        stats: p.stats,
      });
      out.set(slug, pl);
    }
  }
  // height, weight, shot and hometown from the club's Wikipedia roster for that season
  for (const pl of out.values()) {
    const season = pl.games[pl.games.length - 1]?.season;
    const w = pllRoster(pl.teamId, season)?.players.find((x) => x.name === pl.name);
    if (w)
      Object.assign(pl.bio, {
        college: w.college ?? pl.bio.college,
        height: w.height,
        weight: w.weight,
        shot: w.shot,
        hometown: w.hometown,
      });
  }
  cache = out;
  return out;
}

export const pllPlayer = (slug: string) => pllPlayers().get(slug);

/** The PLL started keeping touches and passes in 2022; tables for 2019-2021 leave those columns out. */
export const pllTracksTouches = (season: number) => season >= 2022;

/**
 * The one club a player spent a whole season with, for that season's logo on his page: undefined when he
 * played for two clubs that season (a mid-season move), so the page keeps his current club.
 */
export function pllSeasonClub(
  p: PllPlayer,
  season: number,
): { team: string; teamId: string } | undefined {
  const games = p.games.filter((g) => g.season === season);
  const ids = new Set(games.map((g) => g.teamId));
  if (ids.size !== 1) return undefined;
  return { team: games[0].team, teamId: games[0].teamId };
}

/** A club's players with entered stats for a season. */
export const pllTeamPlayers = (teamId: string, season: number) =>
  [...pllPlayers().values()].filter((p) =>
    p.games.some((g) => g.teamId === teamId && g.season === season),
  );

export interface PllTotals {
  gp: number;
  P: number;
  G: number;
  G1: number;
  G2: number;
  A: number;
  Sh: number;
  shPct: number | null;
  GB: number;
  /** null when no game had the stat. */
  TO: number | null;
  CT: number | null;
  /** null when no game had it: the PLL kept no touches before 2022. */
  TCH: number | null;
  FOW: number;
  FOT: number;
  foPct: number | null;
  Sv: number;
  GA: number;
  svPct: number | null;
}

const sumKnown = (xs: (number | null | undefined)[]) =>
  xs.some((x) => x != null) ? xs.reduce<number>((s, x) => s + (x ?? 0), 0) : null;

/** Totals over a set of games (a season, or the last N). */
export function totalsOf(games: PllPlayerGame[]): PllTotals {
  const s = (k: keyof PllStatLine) => games.reduce((n, g) => n + ((g.stats[k] as number) ?? 0), 0);
  const G1 = s("G1");
  const G2 = s("G2");
  const Sh = s("Sh");
  const FOW = s("FOW");
  const FOT = s("FOT");
  const Sv = s("Sv");
  // goals against: the sheet's GA when it pins it down, else from Sv%: Sv / (Sv + GA)
  const GA = games.reduce((n, g) => {
    const st = g.stats;
    if (st.Sv == null) return n;
    if (st.GA != null) return n + st.GA;
    return n + (st.SvPct ? Math.round(st.Sv / (st.SvPct / 100) - st.Sv) : 0);
  }, 0);
  return {
    gp: games.length,
    P: s("P"),
    G: G1 + G2,
    G1,
    G2,
    A: s("A"),
    Sh,
    shPct: Sh ? (G1 + G2) / Sh : null,
    GB: s("GB"),
    TO: sumKnown(games.map((g) => g.stats.TO)),
    CT: sumKnown(games.map((g) => g.stats.CT)),
    TCH: sumKnown(games.map((g) => g.stats.TCH)),
    FOW,
    FOT,
    foPct: FOT ? FOW / FOT : null,
    Sv,
    GA,
    svPct: Sv + GA ? Sv / (Sv + GA) : null,
  };
}

/** Kind of player, for which columns matter. */
export const playerKind = (p: PllPlayer) =>
  p.games.some((g) => g.stats.Sv != null)
    ? "goalie"
    : p.games.some((g) => (g.stats.FOT ?? 0) > 0)
      ? "faceoff"
      : "field";

/**
 * A club's game-day roster straight from the owner's PLL box-score sheets: everyone listed for that
 * game, with the sheet's position and number. Undefined when no sheet was entered for the game.
 */
export function sheetGameRoster(teamId: string, date: string) {
  const t = new Date(date).getTime();
  const g = saved.games.find(
    (x) =>
      (PLL_CLUB_IDS[x.team] ?? x.team) === teamId &&
      Math.abs(new Date(`${x.date}T12:00:00Z`).getTime() - t) <= 1.5 * 86_400_000,
  );
  if (!g) return undefined;
  const players = pllPlayers();
  return g.players.map((p) => ({
    name: p.name,
    num: p.num ? Number(p.num) : null,
    pos: p.pos ?? players.get(playerSlug(p.name))?.pos ?? "",
    college: players.get(playerSlug(p.name))?.bio.college ?? null,
  }));
}
