/**
 * A team's season record against the betting lines (closing spread and total of each finished game):
 * straight up, against the spread, over/under, and its average margin against the spread.
 */
import { gameScore, type Game } from "@/data/shared/games";
import { homeLine } from "./season-pulse";

export interface TeamLineRecord {
  su: { w: number; l: number; t: number };
  ats: { w: number; l: number; p: number };
  ou: { o: number; u: number; p: number };
  /** Average of (team margin + team's spread) over games with a spread; positive = beat the number. */
  avgVsSpread: number | null;
}

export function teamLineRecord(games: Game[], teamId: string): TeamLineRecord {
  const r: TeamLineRecord = { su: { w: 0, l: 0, t: 0 }, ats: { w: 0, l: 0, p: 0 }, ou: { o: 0, u: 0, p: 0 }, avgVsSpread: null };
  const vs: number[] = [];
  for (const g of games) {
    if (g.status !== "final" || (g.homeTeamId !== teamId && g.awayTeamId !== teamId)) continue;
    const s = gameScore(g);
    const home = g.homeTeamId === teamId;
    const margin = home ? s.home - s.away : s.away - s.home;
    if (margin > 0) r.su.w++;
    else if (margin < 0) r.su.l++;
    else r.su.t++;
    const hl = homeLine(g);
    if (hl !== null) {
      const line = home ? hl : -hl;
      const cover = margin + line;
      vs.push(cover);
      if (cover > 0) r.ats.w++;
      else if (cover < 0) r.ats.l++;
      else r.ats.p++;
    }
    if (g.total > 0) {
      const pts = s.home + s.away;
      if (pts > g.total) r.ou.o++;
      else if (pts < g.total) r.ou.u++;
      else r.ou.p++;
    }
  }
  r.avgVsSpread = vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
  return r;
}
