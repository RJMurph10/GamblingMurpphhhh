import { describe, expect, it } from "vitest";
import { NBA_RANGE_TARGET, projectStat, propRange } from "@/lib/nba/nba-model";
import { rangeHits } from "@/components/nba/NbaPropsBoard";
import type { NbaLogRow } from "@/lib/nba/nba";

const row = (i: number, pts: number, reb: number): NbaLogRow =>
  ({
    gameId: `g${i}`, date: `2026-11-${String(20 - i).padStart(2, "0")}T00:00Z`, opp: "BOS", home: true, result: "W", score: "",
    min: 34, pts, reb, ast: 5, stl: 1, blk: 0, tov: 2, pf: 2, fgm: 0, fga: 0, fg3m: 2, fg3a: 0, ftm: 0, fta: 0, part: "regular",
  }) as NbaLogRow;

describe("NBA calibrated prop ranges", () => {
  it("targets 70% and covers every board stat", () => {
    expect(NBA_RANGE_TARGET).toBe(0.7);
    for (const k of ["pts", "reb", "ast", "fg3m", "stl", "blk", "tov", "pra", "pr", "pa", "ra"] as const) {
      const r = propRange(k, 10);
      expect(r, k).not.toBeNull();
      expect(r!.lo).toBeLessThanOrEqual(10);
      expect(r!.hi).toBeGreaterThanOrEqual(r!.lo);
    }
    expect(propRange("min", 30)).toBeNull();
  });

  it("scales points with the projection and keeps the range around it", () => {
    const small = propRange("pts", 8)!;
    const big = propRange("pts", 28)!;
    expect(big.hi - big.lo).toBeGreaterThan(small.hi - small.lo);
    expect(big.lo).toBeLessThan(28);
    expect(big.hi).toBeGreaterThan(28);
  });

  it("projectStat carries lo/hi and rangeHits counts finished lines", () => {
    const log = Array.from({ length: 15 }, (_, i) => row(i, 20 + (i % 5), 8));
    const p = projectStat(log, [], "pts")!;
    expect(p.lo).toBeLessThan(p.mean);
    expect(p.hi).toBeGreaterThan(p.mean);
    const inRange = rangeHits([{ proj: { pts: p }, actual: row(99, Math.round(p.mean), 8) }], ["pts"]);
    expect(inRange).toEqual({ inside: 1, total: 1 });
    const miss = rangeHits([{ proj: { pts: p }, actual: row(99, p.hi + 10, 8) }, { proj: { pts: p }, actual: null }], ["pts"]);
    expect(miss).toEqual({ inside: 0, total: 1 });
  });
});
