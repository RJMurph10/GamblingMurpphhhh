/**
 * Walk-forward backtest of the NFL player-prop projections on nflverse weekly player stats, for
 * calibrating the projected ranges (src/data/nfl/prop-range-calibration.json).
 *
 * Same model as the site (projectStat), with what nflverse has: no game script (ratio 1), every
 * player read as a starter, QB/K/P only in games where they were the main player, last season's
 * per-game numbers as the starting point. Longest-play markets aren't in nflverse's weekly file.
 */
import {
  buildWeekContext,
  projectStat,
  type LeagueRecord,
} from "@/lib/shared/player-projection-model";
import { PROP_MARKETS, isMarketForPosition, normalizePropPosition } from "@/lib/shared/prop-model";
import { summarizeMarket, type PlayerGameInput } from "@/lib/shared/prop-analytics";

export type Point = {
  season: number;
  week: number;
  key: string;
  projected: number;
  actual: number;
};

const COLS: Record<string, string> = {
  "passing.passingYards": "passing_yards",
  "passing.passingTouchdowns": "passing_tds",
  pc: "completions",
  pa: "attempts",
  "passing.interceptions": "passing_interceptions",
  "rushing.rushingYards": "rushing_yards",
  "rushing.rushingAttempts": "carries",
  "rushing.rushingTouchdowns": "rushing_tds",
  "receiving.receivingYards": "receiving_yards",
  "receiving.receivingTouchdowns": "receiving_tds",
  "receiving.receptions": "receptions",
  "receiving.receivingTargets": "targets",
  fgm: "fg_made",
  fga: "fg_att",
  xpm: "pat_made",
  xpa: "pat_att",
  fgLong: "fg_long",
  "punting.punts": "pt_att",
  "punting.puntYards": "pt_yards",
  puntLong: "pt_long",
};
// a stat group only counts when the player did something in it
const GROUP_COLS: [string[], string[]][] = [
  [
    ["pa", "pc", "passing.passingYards", "passing.passingTouchdowns", "passing.interceptions"],
    ["attempts"],
  ],
  [["rushing.rushingYards", "rushing.rushingAttempts", "rushing.rushingTouchdowns"], ["carries"]],
  [
    [
      "receiving.receivingYards",
      "receiving.receivingTouchdowns",
      "receiving.receptions",
      "receiving.receivingTargets",
    ],
    ["targets", "receptions"],
  ],
  [
    ["fgm", "fga", "xpm", "xpa", "fgLong"],
    ["fg_att", "pat_att"],
  ],
  [["punting.punts", "punting.puntYards", "puntLong"], ["pt_att"]],
];

function parseCsv(text: string) {
  const [head, ...lines] = text.trim().split("\n");
  const cols = head.split(",");
  return lines.map((l) => {
    const cells = l.split(",");
    return Object.fromEntries(cols.map((c, i) => [c, cells[i]]));
  });
}

export function recordsOf(csv: string): LeagueRecord[] {
  const out: LeagueRecord[] = [];
  for (const r of parseCsv(csv)) {
    if (r.season_type !== "REG") continue;
    const pos = normalizePropPosition(r.position);
    if (!["QB", "RB", "FB", "WR", "TE", "K", "P"].includes(pos)) continue;
    const flat: Record<string, number> = {};
    for (const [keys, markers] of GROUP_COLS) {
      if (!markers.some((m) => Number(r[m]) > 0)) continue;
      for (const k of keys) flat[k] = Number(r[COLS[k]]) || 0;
    }
    if (!Object.keys(flat).length) continue;
    out.push({
      playerId: r.player_id,
      week: Number(r.week),
      team: r.team,
      opponent: r.opponent_team,
      home: false,
      position: pos,
      flat,
    });
  }
  // the main passer per team-week; K/P always; others need 3+ touches (as the site does)
  const main = new Map<string, LeagueRecord>();
  for (const r of out)
    if (r.position === "QB" && (r.flat.pa ?? 0) > (main.get(`${r.team}|${r.week}`)?.flat.pa ?? -1))
      main.set(`${r.team}|${r.week}`, r);
  for (const r of out) {
    if (r.position === "QB")
      r.primary = main.get(`${r.team}|${r.week}`) === r && (r.flat.pa ?? 0) >= 10;
    else if (r.position === "K" || r.position === "P") r.primary = true;
    else
      r.primary =
        (r.flat["receiving.receivingTargets"] ?? 0) + (r.flat["rushing.rushingAttempts"] ?? 0) >= 3;
  }
  return out;
}

export function backtestSeason(
  season: number,
  records: LeagueRecord[],
  lastSeasonRecords: LeagueRecord[],
): Point[] {
  const ctxs = new Map<number, ReturnType<typeof buildWeekContext>>();
  const ctx = (w: number) => {
    if (!ctxs.has(w)) ctxs.set(w, buildWeekContext(records, w));
    return ctxs.get(w)!;
  };
  const byPlayerLast = new Map<string, LeagueRecord[]>();
  for (const r of lastSeasonRecords)
    if (r.primary !== false)
      byPlayerLast.set(r.playerId, [...(byPlayerLast.get(r.playerId) ?? []), r]);
  const byPlayer = new Map<string, LeagueRecord[]>();
  for (const r of records) byPlayer.set(r.playerId, [...(byPlayer.get(r.playerId) ?? []), r]);
  const points: Point[] = [];
  for (const [id, recs] of byPlayer) {
    const position = recs[0].position;
    const single = ["QB", "K", "P"].includes(position);
    const games: PlayerGameInput[] = recs
      .filter((r) => !single || r.primary)
      .sort((a, b) => a.week - b.week)
      .map((r) => ({
        gameId: String(r.week),
        week: r.week,
        opponent: r.opponent,
        home: r.home,
        flat: r.flat,
      }));
    const lastGames: PlayerGameInput[] = (byPlayerLast.get(id) ?? []).map((r) => ({
      gameId: "",
      week: r.week,
      opponent: r.opponent,
      home: r.home,
      flat: r.flat,
    }));
    for (const market of PROP_MARKETS) {
      if (market.kind === "long" && !["fg_long", "punt_long"].includes(market.key)) continue;
      if (!isMarketForPosition(market.key, position)) continue;
      const ls = summarizeMarket(market.key, lastGames);
      let lastLine: { perGame: number; games: number } | undefined;
      if (ls) {
        const vals = ls.log.map((g) => g.value);
        lastLine = { perGame: vals.reduce((a, b) => a + b, 0) / vals.length, games: vals.length };
      }
      for (const g of games) {
        const actual = summarizeMarket(market.key, [g]);
        if (!actual) continue;
        const prior = games.filter((x) => x.week < g.week);
        const p = projectStat(market.key, position, prior, ctx(g.week), g.opponent, 1, {
          lastSeason: lastLine,
        });
        if (!p || p.projected <= 0) continue;
        points.push({
          season,
          week: g.week,
          key: market.key,
          projected: p.projected,
          actual: actual.log[0].value,
        });
      }
    }
  }
  return points;
}
