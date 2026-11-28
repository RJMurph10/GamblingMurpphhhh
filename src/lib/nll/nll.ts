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
  /** City / region ("Buffalo"). */
  location?: string;
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
  home: NllSide;
  away: NllSide;
  /** Went past four quarters. */
  ot: boolean;
  venue?: string;
  city?: string;
  /** TV / streaming ("ESPN+", "TSN"). */
  broadcast?: string;
}

/** An NLL story from ESPN. */
export interface NllNews {
  headline: string;
  description: string;
  published: string;
  link: string | null;
  image: string | null;
}

/** A highlight video for one game, from ESPN. */
export interface NllVideo {
  headline: string;
  link: string | null;
  thumbnail: string | null;
  duration: number | null;
}

export interface NllSide {
  teamId: string;
  score: number | null;
  /** Goals by quarter (overtime after the fourth). */
  quarters?: number[];
  /** Record after the game, "3-1". */
  record?: string;
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
  return [...by.values()].sort(
    (a, b) =>
      +(b.book === "draftkings") - +(a.book === "draftkings") || a.book.localeCompare(b.book),
  );
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

/** The consensus line from each book's latest snapshot: medians of the home spread, the total and both moneylines. */
export interface NllLine {
  /** Home spread (negative = home favored). */
  spread: number | null;
  total: number | null;
  mlHome: number | null;
  mlAway: number | null;
  books: number;
  /** Where the line comes from: DraftKings (the primary book) or the median of the other books. */
  source: "draftkings" | "median";
  /** DraftKings' prices for the shown line, when it's DraftKings'. */
  prices?: {
    spreadHome: number | null;
    spreadAway: number | null;
    over: number | null;
    under: number | null;
  };
}

/** The book whose line the site shows and grades against. */
export const PRIMARY_BOOK = "draftkings";

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const v = [...xs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

export function consensus(snaps: NllSnapshot[]): NllLine | null {
  const latest = latestByBook(snaps);
  if (!latest.length) return null;
  const spreads = latest.filter((s) => s.spread).map((s) => s.spread!.home[0]);
  // books can disagree on the favorite (+1.5 vs -1.5): the median of an even split is 0, so take the majority side
  let spread = median(spreads);
  if (spread === 0 && spreads.length) spread = null;
  return {
    spread,
    total: median(latest.filter((s) => s.total).map((s) => s.total!.line)),
    mlHome: median(latest.filter((s) => s.moneyline).map((s) => s.moneyline!.home)),
    mlAway: median(latest.filter((s) => s.moneyline).map((s) => s.moneyline!.away)),
    books: latest.length,
    source: "median",
  };
}

/**
 * The line the site shows and grades: DraftKings' latest, market by market. A market DraftKings didn't
 * have (or a game with no DraftKings screenshot) falls back to the median of the other books.
 */
export function primaryLine(snaps: NllSnapshot[]): NllLine | null {
  const med = consensus(snaps);
  const dk = latestByBook(snaps).find((s) => s.book === PRIMARY_BOOK);
  if (!dk || !med) return med;
  return {
    spread: dk.spread ? dk.spread.home[0] : med.spread,
    total: dk.total ? dk.total.line : med.total,
    mlHome: dk.moneyline ? dk.moneyline.home : med.mlHome,
    mlAway: dk.moneyline ? dk.moneyline.away : med.mlAway,
    books: med.books,
    source: "draftkings",
    prices: {
      spreadHome: dk.spread?.home[1] ?? null,
      spreadAway: dk.spread?.away[1] ?? null,
      over: dk.total?.over ?? null,
      under: dk.total?.under ?? null,
    },
  };
}

/** Which side covered and whether the total went over, for a final game. */
export function lineResult(game: NllGame, line: NllLine) {
  if (game.status !== "final" || game.home.score == null || game.away.score == null) return null;
  const margin = game.home.score - game.away.score;
  const c = line.spread == null ? null : margin + line.spread;
  const t = line.total == null ? null : game.home.score + game.away.score - line.total;
  return {
    cover:
      c == null ? null : c > 0 ? ("home" as const) : c < 0 ? ("away" as const) : ("push" as const),
    ou:
      t == null ? null : t > 0 ? ("over" as const) : t < 0 ? ("under" as const) : ("push" as const),
  };
}

/** A team's record against the consensus lines: ATS and over/under. */
export function teamLineRecord(
  season: NllSeason,
  file: NllLinesFile | null | undefined,
  teamId: string,
) {
  const ats = { w: 0, l: 0, p: 0 };
  const ou = { o: 0, u: 0, p: 0 };
  for (const g of season.games) {
    if (g.home.teamId !== teamId && g.away.teamId !== teamId) continue;
    const line = primaryLine(snapshotsFor(g, season, file));
    const r = line ? lineResult(g, line) : null;
    if (!r) continue;
    if (r.cover) {
      if (r.cover === "push") ats.p++;
      else if ((r.cover === "home") === (g.home.teamId === teamId)) ats.w++;
      else ats.l++;
    }
    if (r.ou) {
      if (r.ou === "over") ou.o++;
      else if (r.ou === "under") ou.u++;
      else ou.p++;
    }
  }
  return { ats, ou };
}

/** League pulse from regular-season finals. */
export function nllPulse(games: NllGame[]) {
  const f = games.filter(
    (g) => g.status === "final" && g.phase === "regular" && g.home.score != null,
  );
  const n = f.length;
  const goals = f.reduce((a, g) => a + g.home.score! + g.away.score!, 0);
  const margins = f.map((g) => Math.abs(g.home.score! - g.away.score!));
  return {
    games: n,
    goalsPerGame: n ? goals / n : null,
    oneGoalPct: n ? margins.filter((m) => m === 1).length / n : null,
    avgMargin: n ? margins.reduce((a, b) => a + b, 0) / n : null,
    homeWinPct: n ? f.filter((g) => g.home.score! > g.away.score!).length / n : null,
    otPct: n ? f.filter((g) => g.ot).length / n : null,
  };
}

type Rec = { w: number; l: number };

/** A team's season trends from finished games: scoring by quarter, records by game state, lines. */
export function nllTeamTrends(season: NllSeason, teamId: string, file?: NllLinesFile | null) {
  const games = season.games.filter(
    (g) =>
      g.status === "final" &&
      (g.home.teamId === teamId || g.away.teamId === teamId) &&
      g.home.score != null,
  );
  const r = (): Rec => ({ w: 0, l: 0 });
  const out = {
    games: games.length,
    withQuarters: 0,
    forByQ: [0, 0, 0, 0],
    againstByQ: [0, 0, 0, 0],
    ledAfterQ1: r(),
    trailedAfterQ1: r(),
    ledAtHalf: r(),
    trailedAtHalf: r(),
    ledAfterQ3: r(),
    trailedAfterQ3: r(),
    overtime: r(),
    oneGoal: r(),
    blowouts: r(),
    asFavorite: r(),
    asUnderdog: r(),
    totalSum: 0,
    last5: [] as ("W" | "L")[],
    streak: "",
  };
  for (const g of games) {
    const home = g.home.teamId === teamId;
    const me = home ? g.home : g.away;
    const them = home ? g.away : g.home;
    const won = (me.score ?? 0) > (them.score ?? 0);
    const add = (x: Rec) => (won ? x.w++ : x.l++);
    out.totalSum += (me.score ?? 0) + (them.score ?? 0);
    const margin = Math.abs((me.score ?? 0) - (them.score ?? 0));
    if (g.ot) add(out.overtime);
    if (margin === 1) add(out.oneGoal);
    if (margin >= 5) add(out.blowouts);
    const mq = me.quarters ?? [];
    const tq = them.quarters ?? [];
    if (mq.length >= 4 && tq.length >= 4) {
      out.withQuarters++;
      for (let i = 0; i < 4; i++) {
        out.forByQ[i] += mq[i];
        out.againstByQ[i] += tq[i];
      }
      const after = (n: number) =>
        mq.slice(0, n).reduce((a, b) => a + b, 0) - tq.slice(0, n).reduce((a, b) => a + b, 0);
      for (const [n, led, trailed] of [
        [1, out.ledAfterQ1, out.trailedAfterQ1],
        [2, out.ledAtHalf, out.trailedAtHalf],
        [3, out.ledAfterQ3, out.trailedAfterQ3],
      ] as const) {
        const d = after(n);
        if (d > 0) add(led);
        else if (d < 0) add(trailed);
      }
    }
    const line = primaryLine(snapshotsFor(g, season, file));
    if (line?.mlHome != null && line.mlAway != null && line.mlHome !== line.mlAway) {
      const favored = home ? line.mlHome < line.mlAway : line.mlAway < line.mlHome;
      add(favored ? out.asFavorite : out.asUnderdog);
    }
  }
  const n = out.withQuarters || 1;
  const recent = [...games].reverse();
  out.last5 = recent.slice(0, 5).map((g) => {
    const me = g.home.teamId === teamId ? g.home : g.away;
    const them = g.home.teamId === teamId ? g.away : g.home;
    return (me.score ?? 0) > (them.score ?? 0) ? "W" : "L";
  });
  if (out.last5.length) {
    const first = out.last5[0];
    let k = 0;
    for (const g of recent) {
      const me = g.home.teamId === teamId ? g.home : g.away;
      const them = g.home.teamId === teamId ? g.away : g.home;
      if (((me.score ?? 0) > (them.score ?? 0) ? "W" : "L") !== first) break;
      k++;
    }
    out.streak = `${first}${k}`;
  }
  return {
    ...out,
    forByQ: out.withQuarters ? out.forByQ.map((x) => x / n) : [],
    againstByQ: out.withQuarters ? out.againstByQ.map((x) => x / n) : [],
    avgTotal: games.length ? out.totalSum / games.length : null,
  };
}

/** The arena a team plays most of its home games in. */
export function homeArena(season: NllSeason, teamId: string): string | undefined {
  const count = new Map<string, number>();
  for (const g of season.games)
    if (g.home.teamId === teamId && g.venue) count.set(g.venue, (count.get(g.venue) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}
