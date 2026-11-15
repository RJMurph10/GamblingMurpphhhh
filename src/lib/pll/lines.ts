import type { PllGame, PllSeason } from "./pll";

/**
 * PLL game lines from The Odds API, saved by the extra-lines workflow while games are posted
 * (props-site/lines/pll.json, built by scripts/lacrosse/merge-pll-lines.mjs). Each line is the consensus
 * (median) of the major US books: the home spread, the total and both moneylines.
 */
export interface PllLine {
  /** Home team's spread (negative = home favored). */
  spread: number | null;
  total: number | null;
  mlHome: number | null;
  mlAway: number | null;
  /** Books in the consensus. */
  books: number;
  at: string;
}

export interface PllLinesGame {
  home: string;
  away: string;
  commence: string;
  open: PllLine;
  latest: PllLine;
  books: Record<
    string,
    { spread: number[] | null; total: number[] | null; ml: number[] | null; at: string }
  >;
}

export interface PllLinesFile {
  updated: string;
  games: Record<string, PllLinesGame>;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/** A game's lines: the Odds API game with the same two clubs starting within 12 hours of it. */
export function linesFor(
  game: PllGame,
  season: PllSeason | undefined,
  file: PllLinesFile | null | undefined,
): PllLinesGame | undefined {
  if (!file || !season) return undefined;
  const short = (id: string) => season.teams.find((t) => t.id === id)?.short;
  const h = short(game.home.teamId);
  const a = short(game.away.teamId);
  if (!h || !a) return undefined;
  const t = new Date(game.date).getTime();
  for (const g of Object.values(file.games)) {
    if (Math.abs(new Date(g.commence).getTime() - t) > 12 * 3_600_000) continue;
    if (norm(g.home).endsWith(norm(h)) && norm(g.away).endsWith(norm(a))) return g;
    // listed the other way round: swap the home numbers
    if (norm(g.home).endsWith(norm(a)) && norm(g.away).endsWith(norm(h))) {
      const flip = (l: PllLine): PllLine => ({
        ...l,
        spread: l.spread == null ? null : -l.spread,
        mlHome: l.mlAway,
        mlAway: l.mlHome,
      });
      return { ...g, home: g.away, away: g.home, open: flip(g.open), latest: flip(g.latest) };
    }
  }
  return undefined;
}

export const americanText = (p: number | null | undefined) =>
  p == null ? "—" : p > 0 ? `+${p}` : String(p);
export const spreadText = (s: number | null | undefined) =>
  s == null ? "—" : s === 0 ? "PK" : s > 0 ? `+${s}` : String(s);

/** How a finished game went against its line (latest consensus before the game). */
export function lineResult(game: PllGame, line: PllLine) {
  if (game.status !== "final" || game.home.score == null || game.away.score == null) return null;
  const margin = game.home.score - game.away.score;
  const total = game.home.score + game.away.score;
  const cover =
    line.spread == null
      ? null
      : margin + line.spread > 0
        ? "home"
        : margin + line.spread < 0
          ? "away"
          : "push";
  const ou =
    line.total == null ? null : total > line.total ? "over" : total < line.total ? "under" : "push";
  const favHome = line.mlHome != null && line.mlAway != null ? line.mlHome < line.mlAway : null;
  const favWon = favHome == null || margin === 0 ? null : favHome === margin > 0;
  return { cover, ou, favWon };
}

export interface PllLinesSummary {
  /** Finished summer games with a saved line. */
  games: number;
  overs: { w: number; l: number };
  favorites: { w: number; l: number };
  homeCovers: { w: number; l: number };
  avgLine: number | null;
}

/** How a season's finished games did against their saved lines. */
export function linesSummary(
  season: PllSeason | undefined,
  file: PllLinesFile | null | undefined,
): PllLinesSummary {
  const out: PllLinesSummary = {
    games: 0,
    overs: { w: 0, l: 0 },
    favorites: { w: 0, l: 0 },
    homeCovers: { w: 0, l: 0 },
    avgLine: null,
  };
  const totals: number[] = [];
  for (const g of season?.games ?? []) {
    if (g.phase !== "regular" && g.phase !== "playoffs") continue;
    const lg = linesFor(g, season, file);
    const r = lg ? lineResult(g, lg.latest) : null;
    if (!lg || !r) continue;
    out.games++;
    if (lg.latest.total != null) totals.push(lg.latest.total);
    if (r.ou === "over") out.overs.w++;
    else if (r.ou === "under") out.overs.l++;
    if (r.favWon === true) out.favorites.w++;
    else if (r.favWon === false) out.favorites.l++;
    if (r.cover === "home") out.homeCovers.w++;
    else if (r.cover === "away") out.homeCovers.l++;
  }
  out.avgLine = totals.length ? totals.reduce((s, x) => s + x, 0) / totals.length : null;
  return out;
}
