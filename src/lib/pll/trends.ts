import type { PllGame } from "./pll";

/**
 * Scoring trends from final scores (ESPN; quarter scores from 2022 on). Scores are points as the books
 * grade them: a 2-point goal counts 2. Only finished summer games (regular season and playoffs) count:
 * the winter Championship Series is sixes and the All-Star game is an exhibition.
 */

const counted = (g: PllGame) =>
  g.status === "final" &&
  (g.phase === "regular" || g.phase === "playoffs") &&
  g.home.score != null &&
  g.away.score != null;

const total = (g: PllGame) => (g.home.score ?? 0) + (g.away.score ?? 0);
const hasQuarters = (g: PllGame) => g.home.quarters.length >= 4 && g.away.quarters.length >= 4;
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : null);

/** A record: wins and losses. */
export type WL = { w: number; l: number };
const wl = (): WL => ({ w: 0, l: 0 });

export interface PllTeamTrends {
  games: number;
  /** Games with quarter scores (2022 on). */
  withQuarters: number;
  /** Average points for and against by quarter (Q1–Q4); empty without quarter scores. */
  forByQ: number[];
  againstByQ: number[];
  /** Average points for and against by half. */
  firstHalf: { for: number; against: number } | null;
  secondHalf: { for: number; against: number } | null;
  /** Record when leading / trailing after Q1 and at halftime (ties left out). */
  ledAfterQ1: WL;
  trailedAfterQ1: WL;
  ledAtHalf: WL;
  trailedAtHalf: WL;
  /** Overtime record. */
  overtime: WL;
  /** One-score games (decided by 1 or 2). */
  close: WL;
  /** Average combined points in the team's games. */
  avgTotal: number | null;
}

/** One team's scoring trends over a season's games. */
export function teamTrends(games: PllGame[], teamId: string): PllTeamTrends {
  const mine = games.filter(
    (g) => counted(g) && (g.home.teamId === teamId || g.away.teamId === teamId),
  );
  const sides = mine.map((g) =>
    g.home.teamId === teamId ? { us: g.home, them: g.away, g } : { us: g.away, them: g.home, g },
  );
  const q = sides.filter((s) => hasQuarters(s.g));
  const byQ = (pick: "us" | "them") =>
    q.length ? [0, 1, 2, 3].map((i) => avg(q.map((s) => s[pick].quarters[i] ?? 0)) ?? 0) : [];
  const half = (from: number, to: number) =>
    q.length
      ? {
          for: avg(q.map((s) => sum(s.us.quarters.slice(from, to))))!,
          against: avg(q.map((s) => sum(s.them.quarters.slice(from, to))))!,
        }
      : null;

  const ledAfterQ1 = wl();
  const trailedAfterQ1 = wl();
  const ledAtHalf = wl();
  const trailedAtHalf = wl();
  const overtime = wl();
  const close = wl();
  for (const s of sides) {
    const won = (s.us.score ?? 0) > (s.them.score ?? 0);
    const add = (r: WL) => (won ? r.w++ : r.l++);
    if (hasQuarters(s.g)) {
      const d1 = s.us.quarters[0] - s.them.quarters[0];
      const dh = sum(s.us.quarters.slice(0, 2)) - sum(s.them.quarters.slice(0, 2));
      if (d1 > 0) add(ledAfterQ1);
      else if (d1 < 0) add(trailedAfterQ1);
      if (dh > 0) add(ledAtHalf);
      else if (dh < 0) add(trailedAtHalf);
    }
    const ot = s.us.quarters.length > 4 || /OT/i.test(s.g.detail);
    if (ot) add(overtime);
    if (Math.abs((s.us.score ?? 0) - (s.them.score ?? 0)) <= 2) add(close);
  }
  return {
    games: mine.length,
    withQuarters: q.length,
    forByQ: byQ("us"),
    againstByQ: byQ("them"),
    firstHalf: half(0, 2),
    secondHalf: half(2, 4),
    ledAfterQ1,
    trailedAfterQ1,
    ledAtHalf,
    trailedAtHalf,
    overtime,
    close,
    avgTotal: avg(mine.map(total)),
  };
}

export interface PllTotalsTrends {
  games: number;
  avgTotal: number | null;
  /** Average combined first-half points (games with quarter scores). */
  avgFirstHalf: number | null;
  /** Share of games over each line, for lines around the season's average. */
  overs: { line: number; over: number }[];
  /** Share of games that went to overtime. */
  otShare: number | null;
}

/** How often a season's games went over common totals. */
export function totalsTrends(games: PllGame[]): PllTotalsTrends {
  const done = games.filter(counted);
  const totals = done.map(total);
  const a = avg(totals);
  const q = done.filter(hasQuarters);
  const base = a == null ? 0 : Math.round(a);
  const lines = a == null ? [] : [-4, -2, 0, 2, 4].map((k) => base + k - 0.5);
  return {
    games: done.length,
    avgTotal: a,
    avgFirstHalf: avg(
      q.map((g) => sum(g.home.quarters.slice(0, 2)) + sum(g.away.quarters.slice(0, 2))),
    ),
    overs: lines.map((line) => ({
      line,
      over: totals.filter((t) => t > line).length / totals.length,
    })),
    otShare: done.length
      ? done.filter((g) => g.home.quarters.length > 4 || /OT/i.test(g.detail)).length / done.length
      : null,
  };
}
