/**
 * NLL (box lacrosse) shapes and the browser-safe logic for the NLL page: standings from finals, matching
 * the owner's saved sportsbook lines to games, which games still need lines captured, best prices and
 * grading. The lines come from the owner's screenshots (no odds API carries the NLL; see the project doc
 * nll-lines.md), saved to props-site nll/lines-<season>.json.
 */

export interface NllTeam {
  id: string;
  abbr: string;
  name: string;
  short: string;
  color: string | null;
  logo: string | null;
}

export type NllStatus = "scheduled" | "live" | "final";

export interface NllGame {
  id: string;
  date: string;
  status: NllStatus;
  /** "Q3 4:12", "Final/OT", ... */
  detail: string;
  /** Regular season or playoffs. */
  phase: "regular" | "playoffs";
  home: { teamId: string; score: number | null };
  away: { teamId: string; score: number | null };
  /** Went past four quarters. */
  ot: boolean;
}

export interface NllSeason {
  /** Start year: 2026 = the 2026-27 season. */
  season: number;
  label: string;
  teams: NllTeam[];
  games: NllGame[];
}

/** One sportsbook's lines for one game at one moment (an owner screenshot). */
export interface NllSnapshot {
  captured: string;
  book: string;
  /** "Away Team @ Home Team", full names. */
  game: string;
  start: string;
  live: boolean;
  spread: { away: [number, number]; home: [number, number] } | null;
  total: { line: number; over: number; under: number } | null;
  moneyline: { away: number; home: number } | null;
  score?: string;
}

export interface NllLinesFile {
  league: "NLL";
  season: string;
  source?: string;
  notes?: string[];
  snapshots: NllSnapshot[];
}

export const NLL_BOOKS: Record<string, string> = {
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  bet365: "bet365",
  thescore: "theScore Bet",
  betmgm: "BetMGM",
  caesars: "Caesars",
};
export const bookName = (b: string) => NLL_BOOKS[b] ?? b;

/** The NLL season (start year) a date falls in: the season runs late November to June. */
export function nllSeasonOf(d: Date = new Date()): number {
  return d.getUTCMonth() >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}
export const nllSeasonLabel = (season: number) => `${season}-${String(season + 1).slice(2)}`;

export const teamOf = (s: NllSeason | undefined, id: string) => s?.teams.find((t) => t.id === id);

export interface NllStanding {
  team: NllTeam;
  w: number;
  l: number;
  gf: number;
  ga: number;
}

/** Regular-season standings from final scores: wins, then goal difference. */
export function nllStandings(s: NllSeason): NllStanding[] {
  const rows = new Map(s.teams.map((t) => [t.id, { team: t, w: 0, l: 0, gf: 0, ga: 0 }]));
  for (const g of s.games) {
    if (g.status !== "final" || g.phase !== "regular") continue;
    const h = rows.get(g.home.teamId);
    const a = rows.get(g.away.teamId);
    const hs = g.home.score ?? 0;
    const as = g.away.score ?? 0;
    if (h)
      Object.assign(h, { gf: h.gf + hs, ga: h.ga + as, w: h.w + +(hs > as), l: h.l + +(hs < as) });
    if (a)
      Object.assign(a, { gf: a.gf + as, ga: a.ga + hs, w: a.w + +(as > hs), l: a.l + +(as < hs) });
  }
  return [...rows.values()].sort(
    (x, y) =>
      y.w - x.w ||
      x.l - y.l ||
      y.gf - y.ga - (x.gf - x.ga) ||
      x.team.name.localeCompare(y.team.name),
  );
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/** A snapshot's game, matched by both full team names and a start within 36 hours. */
export function snapshotsFor(
  game: NllGame,
  season: NllSeason,
  file: NllLinesFile | null | undefined,
) {
  if (!file) return [];
  const h = teamOf(season, game.home.teamId);
  const a = teamOf(season, game.away.teamId);
  if (!h || !a) return [];
  const t = new Date(game.date).getTime();
  return file.snapshots.filter((x) => {
    const [away, home] = x.game.split(" @ ");
    return (
      !x.live &&
      norm(away ?? "") === norm(a.name) &&
      norm(home ?? "") === norm(h.name) &&
      Math.abs(new Date(x.start).getTime() - t) <= 36 * 3_600_000
    );
  });
}

/** Each book's latest pre-game snapshot (the closest thing to a closing line we have). */
export function latestByBook(snaps: NllSnapshot[]): NllSnapshot[] {
  const by = new Map<string, NllSnapshot>();
  for (const s of snaps) {
    const prev = by.get(s.book);
    if (!prev || s.captured > prev.captured) by.set(s.book, s);
  }
  return [...by.values()].sort((a, b) => a.book.localeCompare(b.book));
}

/** "None" → no lines yet; "open" → captured, but not in the last 3 hours before the start; "close" → captured within 3 hours of the start. */
export function captureStatus(game: NllGame, snaps: NllSnapshot[]): "none" | "open" | "close" {
  if (!snaps.length) return "none";
  const start = new Date(game.date).getTime();
  return snaps.some((s) => start - new Date(s.captured).getTime() <= 3 * 3_600_000)
    ? "close"
    : "open";
}

/** Profit on a 1-unit stake at American odds. */
export const payout = (american: number) => (american > 0 ? american / 100 : 100 / -american);

export type Result = "win" | "loss" | "push";

/** How each side of each market graded for a final score. */
export function grade(snap: NllSnapshot, home: number, away: number) {
  const margin = home - away; // home minus away
  const sideOf = (x: number): Result => (x > 0 ? "win" : x < 0 ? "loss" : "push");
  return {
    spreadAway: snap.spread ? sideOf(-margin + snap.spread.away[0]) : null,
    spreadHome: snap.spread ? sideOf(margin + snap.spread.home[0]) : null,
    over: snap.total ? sideOf(home + away - snap.total.line) : null,
    under: snap.total ? sideOf(snap.total.line - home - away) : null,
    mlAway: snap.moneyline ? sideOf(-margin) : null,
    mlHome: snap.moneyline ? sideOf(margin) : null,
  };
}

/** Best (highest-paying) price on each side across books, for the same line number. */
export function bestPrices(snaps: NllSnapshot[]) {
  const best = new Map<string, { book: string; price: number; line: number | null }>();
  const offer = (key: string, line: number | null, price: number, book: string) => {
    const k = `${key}|${line}`;
    const cur = best.get(k);
    if (!cur || payout(price) > payout(cur.price)) best.set(k, { book, price, line });
  };
  for (const s of snaps) {
    if (s.spread) {
      offer("spreadAway", s.spread.away[0], s.spread.away[1], s.book);
      offer("spreadHome", s.spread.home[0], s.spread.home[1], s.book);
    }
    if (s.total) {
      offer("over", s.total.line, s.total.over, s.book);
      offer("under", s.total.line, s.total.under, s.book);
    }
    if (s.moneyline) {
      offer("mlAway", null, s.moneyline.away, s.book);
      offer("mlHome", null, s.moneyline.home, s.book);
    }
  }
  return best;
}

/** Is this book's price the best one offered for that side and line? */
export function isBest(
  best: ReturnType<typeof bestPrices>,
  key: string,
  line: number | null,
  price: number,
) {
  const b = best.get(`${key}|${line}`);
  return Boolean(b && b.price === price);
}

/**
 * Where the books disagree: different spread favorites, or different total numbers. These are the spots
 * where a middle (both sides at two books winning on one result) can exist.
 */
export function disagreements(snaps: NllSnapshot[]): string[] {
  const out: string[] = [];
  const favs = new Set(
    snaps.filter((s) => s.spread).map((s) => (s.spread!.home[0] < 0 ? "home" : "away")),
  );
  if (favs.size > 1) out.push("Books disagree on the spread favorite");
  const totals = [...new Set(snaps.filter((s) => s.total).map((s) => s.total!.line))].sort(
    (a, b) => a - b,
  );
  if (totals.length > 1) out.push(`Totals range ${totals[0]}–${totals[totals.length - 1]}`);
  return out;
}

/** "+120" / "-150". */
export const american = (n: number) => (n > 0 ? `+${n}` : String(n));
/** "+1.5" / "-1.5". */
export const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
