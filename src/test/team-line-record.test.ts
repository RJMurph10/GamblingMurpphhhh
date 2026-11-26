import { describe, expect, it } from "vitest";
import { teamLineRecord } from "@/lib/shared/team-record";
import type { Game } from "@/data/shared/games";

const g = (away: string, home: string, as: number, hs: number, spread: string, total: number, status: Game["status"] = "final") =>
  ({ id: `${away}-${home}`, status, awayTeamId: away, homeTeamId: home, quarters: { away: [as], home: [hs] }, spread, total }) as unknown as Game;

describe("team record against the lines", () => {
  it("counts straight up, ATS (from the team's side), over/under and the average margin vs the spread", () => {
    const games = [
      g("packers", "vikings", 22, 39, "MIN -2.5", 46.5), // MIN wins by 17, covers by 14.5, over
      g("vikings", "bears", 9, 3, "CHI -1.5", 40.5), // MIN (away) wins by 6 as +1.5 dog: covers by 7.5, under
      g("vikings", "packers", 10, 13, "GB -3", 42.5), // loses by 3 as +3: push, under
      g("lions", "vikings", 0, 0, "DET -3", 48, "scheduled"), // not played: ignored
    ];
    const r = teamLineRecord(games, "vikings");
    expect(r.su).toEqual({ w: 2, l: 1, t: 0 });
    expect(r.ats).toEqual({ w: 2, l: 0, p: 1 });
    expect(r.ou).toEqual({ o: 1, u: 2, p: 0 });
    expect(r.avgVsSpread).toBeCloseTo((14.5 + 7.5 + 0) / 3, 5);
  });
});
