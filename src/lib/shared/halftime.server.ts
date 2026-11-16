/**
 * Halftime lines for a live NFL or NBA game: every book's live lines at the break and each player's
 * 1st-half numbers, saved by scripts/live/halftime.mjs to props-site halftime/<league>/<espnId>.json.
 * Turned here into what the Props tab's "Halftime live" view shows: game lines (live full game and
 * 2nd half) and player props (DraftKings' line and prices, else the first big book with both sides open,
 * plus the best price on each side at that line).
 */
const BASE = "https://raw.githubusercontent.com/RJMurph10/gamblingnfl/props-site/halftime";
const MINUTE = 60_000;

export type HalftimeLeague = "nfl" | "nba";

/** The main books, in the order a line is taken from when DraftKings has none. */
const BOOKS: [string, string][] = [
  ["draftkings", "DraftKings"],
  ["fanduel", "FanDuel"],
  ["betmgm", "BetMGM"],
  ["caesars", "Caesars"],
  ["espnbet", "theScore"],
  ["fanatics", "Fanatics"],
  ["hardrockbet", "Hard Rock"],
  ["bet365", "bet365"],
  ["pinnacle", "Pinnacle"],
];

/** SportsGameOdds stat id → the props board's market label. */
const NFL_STATS: Record<string, string> = {
  passing_yards: "Pass yds",
  passing_attempts: "Pass att",
  passing_completions: "Completions",
  passing_touchdowns: "Pass TDs",
  passing_interceptions: "Interceptions",
  rushing_yards: "Rush yds",
  rushing_attempts: "Carries",
  receiving_yards: "Rec yds",
  receiving_receptions: "Receptions",
  "rushing+receiving_yards": "Rush+Rec yds",
  "passing+rushing_yards": "Pass+Rush yds",
  receiving_longestReception: "Longest rec",
  rushing_longestRush: "Longest rush",
};
const NBA_STATS: Record<string, string> = {
  points: "Points",
  rebounds: "Rebounds",
  assists: "Assists",
  threePointersMade: "3-pointers",
  "points+rebounds": "Pts+Reb",
  "points+assists": "Pts+Ast",
  "rebounds+assists": "Reb+Ast",
  "points+rebounds+assists": "Pts+Reb+Ast",
  steals: "Steals",
  blocks: "Blocks",
  turnovers: "Turnovers",
};
/** Periods shown: the live full-game line, the 2nd half, the 3rd quarter. */
const PERIOD_PREFIX: Record<string, string> = { game: "", "2h": "2H ", "3q": "3Q " };

/** Book → [price, line, open 1/0, lastUpdatedAt]. */
type BookCell = [string | number | null, string | number | null, number, string | null];
interface RawOdd {
  oddID: string;
  stat: string;
  entity: string;
  period: string;
  bet: string;
  side: string;
  player: string | null;
  fair: [unknown, unknown];
  book: [unknown, unknown];
  books: Record<string, BookCell>;
}
interface RawFile {
  league: string;
  espnId: string;
  at: string;
  home: string;
  away: string;
  espn: {
    status: string | null;
    score: Record<string, number>;
    linescores: Record<string, number[]>;
    players: {
      team: string;
      groups: { name: string; labels: string[]; athletes: [string, string, string[]][] }[];
    }[];
  };
  sgo: {
    teams?: { home?: { teamID?: string }; away?: { teamID?: string } } | null;
    players: Record<string, [string, string | null]>;
    odds: RawOdd[];
  } | null;
}

/** One side of a market: price, the book it's from. */
export type Priced = [number, string] | null;

export interface HalftimeGameLine {
  /** "Full game" (live) or "2nd half". */
  period: string;
  /** Home spread and prices (home, away), from one book. */
  spread: { line: number; home: number | null; away: number | null; book: string } | null;
  total: { line: number; over: number | null; under: number | null; book: string } | null;
  ml: { home: number | null; away: number | null; book: string } | null;
}

export interface HalftimeProp {
  player: string;
  side: "home" | "away" | "";
  market: string;
  line: number;
  over: number | null;
  under: number | null;
  book: string;
  /** The best over / under price across the big books at this same line. */
  bestOver: Priced;
  bestUnder: Priced;
  /** The player's 1st-half number for this market (full-game markets only; null when unknown). */
  firstHalf: number | null;
}

export interface HalftimeLines {
  at: string;
  score: { home: number; away: number };
  /** Oldest and newest book update time among the saved prices (how fresh the free feed was). */
  updated: [string, string] | null;
  games: HalftimeGameLine[];
  props: HalftimeProp[];
  books: string[];
}

const memo = new Map<string, { at: number; value: HalftimeLines | null }>();

const num = (v: unknown) => {
  const n = Number(v);
  return v == null || v === "" || !Number.isFinite(n) ? null : n;
};
export const normName = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")
    .replace(/[^a-z]/g, "");
const pay = (p: number) => (p > 0 ? p / 100 : 100 / -p);

/** 1st-half numbers by "normalized name|market" from ESPN's halftime box score. */
export function firstHalfStats(league: HalftimeLeague, espn: RawFile["espn"]) {
  const out = new Map<string, number>();
  const put = (name: string, market: string, v: number | null) => {
    if (v != null) out.set(`${normName(name)}|${market}`, v);
  };
  const per = new Map<string, Record<string, number>>(); // name → base stats
  const add = (name: string, k: string, v: number | null) => {
    if (v == null) return;
    const r = per.get(name) ?? {};
    r[k] = v;
    per.set(name, r);
  };
  for (const t of espn.players ?? []) {
    for (const g of t.groups ?? []) {
      const at = (lab: string) => g.labels.indexOf(lab);
      for (const [name, , stats] of g.athletes ?? []) {
        if (!name) continue;
        const v = (lab: string) => (at(lab) >= 0 ? num(stats[at(lab)]) : null);
        const made = (lab: string, i: 0 | 1) =>
          at(lab) >= 0 ? num(String(stats[at(lab)] ?? "").split(/[-/]/)[i]) : null;
        if (league === "nba") {
          for (const [lab, k] of [
            ["PTS", "pts"],
            ["REB", "reb"],
            ["AST", "ast"],
            ["STL", "stl"],
            ["BLK", "blk"],
            ["TO", "to"],
          ] as const)
            add(name, k, v(lab));
          add(name, "3pm", made("3PT", 0));
        } else if (g.name === "passing") {
          add(name, "pass_yds", v("YDS"));
          add(name, "comp", made("C/ATT", 0));
          add(name, "att", made("C/ATT", 1));
          add(name, "pass_td", v("TD"));
          add(name, "int", v("INT"));
        } else if (g.name === "rushing") {
          add(name, "rush_yds", v("YDS"));
          add(name, "car", v("CAR"));
          add(name, "long_rush", v("LONG"));
        } else if (g.name === "receiving") {
          add(name, "rec_yds", v("YDS"));
          add(name, "rec", v("REC"));
          add(name, "long_rec", v("LONG"));
        }
      }
    }
  }
  for (const [name, s] of per) {
    const z = (k: string) => s[k] ?? 0;
    if (league === "nba") {
      put(name, "Points", s.pts ?? null);
      put(name, "Rebounds", s.reb ?? null);
      put(name, "Assists", s.ast ?? null);
      put(name, "3-pointers", s["3pm"] ?? null);
      put(name, "Steals", s.stl ?? null);
      put(name, "Blocks", s.blk ?? null);
      put(name, "Turnovers", s.to ?? null);
      if (s.pts != null) {
        put(name, "Pts+Reb", z("pts") + z("reb"));
        put(name, "Pts+Ast", z("pts") + z("ast"));
        put(name, "Pts+Reb+Ast", z("pts") + z("reb") + z("ast"));
        put(name, "Reb+Ast", z("reb") + z("ast"));
      }
    } else {
      put(name, "Pass yds", s.pass_yds ?? null);
      put(name, "Completions", s.comp ?? null);
      put(name, "Pass att", s.att ?? null);
      put(name, "Pass TDs", s.pass_td ?? null);
      put(name, "Interceptions", s.int ?? null);
      put(name, "Rush yds", s.rush_yds ?? null);
      put(name, "Carries", s.car ?? null);
      put(name, "Rec yds", s.rec_yds ?? null);
      put(name, "Receptions", s.rec ?? null);
      put(name, "Longest rec", s.long_rec ?? null);
      put(name, "Longest rush", s.long_rush ?? null);
      if (s.rush_yds != null || s.rec_yds != null)
        put(name, "Rush+Rec yds", z("rush_yds") + z("rec_yds"));
      if (s.pass_yds != null) put(name, "Pass+Rush yds", z("pass_yds") + z("rush_yds"));
    }
  }
  return out;
}

const open = (c: BookCell | undefined) => (c && c[2] !== 0 && num(c[0]) != null ? c : undefined);

/** The live lines file turned into the view's tables. */
export function buildHalftime(league: HalftimeLeague, f: RawFile): HalftimeLines {
  const odds = f.sgo?.odds ?? [];
  const stats = league === "nba" ? NBA_STATS : NFL_STATS;
  const times: string[] = [];
  const booksSeen = new Set<string>();

  // --- game lines: points, home/away/all, full game (live) and 2nd half
  const find = (period: string, bet: string, side: string) =>
    odds.find(
      (o) =>
        !o.player && o.stat === "points" && o.period === period && o.bet === bet && o.side === side,
    );
  const pick = (a: RawOdd | undefined, b: RawOdd | undefined, sameLine: boolean) => {
    for (const [id, name] of BOOKS) {
      const x = open(a?.books[id]);
      const y = open(b?.books[id]);
      if (!x && !y) continue;
      if (sameLine && x && y && num(x[1]) == null) continue;
      return { x, y, name };
    }
    return null;
  };
  const games: HalftimeGameLine[] = [];
  for (const [period, label] of [
    ["game", "Full game (live)"],
    ["2h", "2nd half"],
  ] as const) {
    const sp = pick(find(period, "sp", "home"), find(period, "sp", "away"), true);
    const ou = pick(find(period, "ou", "over"), find(period, "ou", "under"), true);
    const ml = pick(find(period, "ml", "home"), find(period, "ml", "away"), false);
    const line: HalftimeGameLine = {
      period: label,
      spread:
        sp && num(sp.x?.[1] ?? null) != null
          ? { line: num(sp.x![1])!, home: num(sp.x?.[0]), away: num(sp.y?.[0]), book: sp.name }
          : null,
      total:
        ou && num((ou.x ?? ou.y)?.[1] ?? null) != null
          ? {
              line: num((ou.x ?? ou.y)![1])!,
              over: num(ou.x?.[0]),
              under: num(ou.y?.[0]),
              book: ou.name,
            }
          : null,
      ml: ml ? { home: num(ml.x?.[0]), away: num(ml.y?.[0]), book: ml.name } : null,
    };
    if (line.spread || line.total || line.ml) games.push(line);
  }

  // --- player props: pair over / under per player, market and period
  const homeTeam = f.sgo?.teams?.home?.teamID;
  const awayTeam = f.sgo?.teams?.away?.teamID;
  const pairs = new Map<string, { o?: RawOdd; u?: RawOdd; market: string; player: string }>();
  for (const o of odds) {
    if (!o.player || o.bet !== "ou") continue;
    const base = stats[o.stat];
    const pre = PERIOD_PREFIX[o.period];
    if (!base || pre == null) continue;
    const market = `${pre}${base}`;
    const k = `${o.player}|${market}`;
    const p = pairs.get(k) ?? { market, player: o.player };
    if (o.side === "over") p.o = o;
    else if (o.side === "under") p.u = o;
    pairs.set(k, p);
    for (const [id, c] of Object.entries(o.books)) {
      if (c[3]) times.push(c[3]);
      if (open(c)) booksSeen.add(id);
    }
  }
  const half = f.espn ? firstHalfStats(league, f.espn) : new Map<string, number>();
  const props: HalftimeProp[] = [];
  for (const p of pairs.values()) {
    if (!p.o || !p.u) continue;
    let chosen: { line: number; over: number | null; under: number | null; book: string } | null =
      null;
    for (const [id, name] of BOOKS) {
      const x = open(p.o.books[id]);
      const y = open(p.u.books[id]);
      const line = num(x?.[1] ?? y?.[1] ?? null);
      if (!x || !y || line == null || num(x[1]) !== num(y[1])) continue;
      chosen = { line, over: num(x[0]), under: num(y[0]), book: name };
      break;
    }
    if (!chosen) continue;
    const best = (o: RawOdd): Priced => {
      let b: Priced = null;
      for (const [id, name] of BOOKS) {
        const c = open(o.books[id]);
        if (!c || num(c[1]) !== chosen!.line) continue;
        const price = num(c[0])!;
        if (!b || pay(price) > pay(b[0])) b = [price, name];
      }
      return b;
    };
    const [name, team] = f.sgo?.players[p.player] ?? [p.player, null];
    const fh =
      p.market.startsWith("2H ") || p.market.startsWith("3Q ")
        ? null
        : half.get(`${normName(name)}|${p.market}`);
    props.push({
      player: name,
      side: team && team === homeTeam ? "home" : team && team === awayTeam ? "away" : "",
      market: p.market,
      ...chosen,
      bestOver: best(p.o),
      bestUnder: best(p.u),
      firstHalf: fh ?? null,
    });
  }
  props.sort((a, b) => a.player.localeCompare(b.player) || a.market.localeCompare(b.market));
  times.sort();
  return {
    at: f.at,
    score: { home: f.espn?.score?.home ?? 0, away: f.espn?.score?.away ?? 0 },
    updated: times.length ? [times[0], times[times.length - 1]] : null,
    games,
    props,
    books: BOOKS.filter(([id]) => booksSeen.has(id)).map(([, n]) => n),
  };
}

/** A game's halftime lines (null until it's captured, about 5 minutes into halftime). */
export async function fetchHalftime(
  league: HalftimeLeague,
  id: string,
): Promise<HalftimeLines | null> {
  if (!/^\d+$/.test(id)) return null;
  const url = `${BASE}/${league}/${id}.json`;
  const hit = memo.get(url);
  // a saved file never changes; a missing one is re-checked every 2 minutes
  if (hit && (hit.value || Date.now() - hit.at < 2 * MINUTE)) return hit.value;
  let value: HalftimeLines | null = null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) value = buildHalftime(league, (await res.json()) as RawFile);
  } catch {
    value = null;
  }
  memo.set(url, { at: Date.now(), value });
  return value;
}
