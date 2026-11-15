import { describe, expect, it } from "vitest";
import type { PllGame } from "@/lib/pll/pll";
import { teamTrends, totalsTrends } from "@/lib/pll/trends";

const game = (
  id: string,
  home: [string, number[]],
  away: [string, number[]],
  extra: Partial<PllGame> = {},
): PllGame => ({
  id,
  date: "2025-06-01T20:00Z",
  status: "final",
  detail: "Final",
  phase: "regular",
  season: 2025,
  home: { teamId: home[0], score: home[1].reduce((s, x) => s + x, 0), quarters: home[1] },
  away: { teamId: away[0], score: away[1].reduce((s, x) => s + x, 0), quarters: away[1] },
  ...extra,
});

const games = [
  game("1", ["A", [3, 2, 3, 2]], ["B", [1, 2, 2, 3]]), // A 10-8, led after Q1 and at half, won
  game("2", ["B", [4, 3, 1, 1]], ["A", [1, 2, 4, 5]]), // A 12-9 away, trailed Q1 and half, won
  game("3", ["A", [2, 2, 2, 2, 1]], ["C", [2, 2, 2, 2, 0]], { detail: "Final/OT" }), // A 9-8 OT
  game("4", ["A", [1, 1, 1, 1]], ["C", [3, 3, 3, 3]]), // A 4-12, trailed, lost
  game("5", ["A", [5, 5, 5, 5]], ["B", [0, 0, 0, 0]], { phase: "allstar" }), // not counted
];

describe("teamTrends", () => {
  const t = teamTrends(games, "A");
  it("counts summer games only", () => expect(t.games).toBe(4));
  it("records by first-quarter and halftime lead", () => {
    expect(t.ledAfterQ1).toEqual({ w: 1, l: 0 });
    expect(t.trailedAfterQ1).toEqual({ w: 1, l: 1 });
    expect(t.ledAtHalf).toEqual({ w: 1, l: 0 });
    expect(t.trailedAtHalf).toEqual({ w: 1, l: 1 });
  });
  it("overtime and one-score records", () => {
    expect(t.overtime).toEqual({ w: 1, l: 0 });
    expect(t.close).toEqual({ w: 2, l: 0 });
  });
  it("averages by quarter and half", () => {
    expect(t.forByQ[0]).toBeCloseTo((3 + 1 + 2 + 1) / 4);
    expect(t.firstHalf!.for).toBeCloseTo((5 + 3 + 4 + 2) / 4);
    expect(t.avgTotal).toBeCloseTo((18 + 21 + 17 + 16) / 4);
  });
});

describe("totalsTrends", () => {
  const s = totalsTrends(games);
  it("over rates around the average", () => {
    expect(s.games).toBe(4);
    expect(s.avgTotal).toBeCloseTo(18);
    const at = (line: number) => s.overs.find((o) => o.line === line)?.over;
    expect(at(17.5)).toBe(0.5); // 18 and 21
    expect(at(13.5)).toBe(1);
    expect(s.otShare).toBe(0.25);
  });
});
