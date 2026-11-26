import { afterEach, describe, expect, it, vi } from "vitest";
import { backfillHistoricalOdds, mapEvent } from "@/lib/shared/espn-core.server";
import type { Game } from "@/data/shared/games";

afterEach(() => vi.unstubAllGlobals());

const event = (completed: boolean, homeScore: string, homeLines: number[] | null) => ({
  id: "401872927",
  date: "2026-09-13T20:25Z",
  competitions: [{
    status: { type: { name: completed ? "STATUS_FINAL" : "STATUS_SCHEDULED", completed } },
    competitors: [
      { homeAway: "home", score: homeScore, team: { id: "16", abbreviation: "MIN" }, ...(homeLines ? { linescores: homeLines.map((value) => ({ value })) } : {}) },
      { homeAway: "away", score: "22", team: { id: "9", abbreviation: "GB" }, linescores: [9, 10, 3, 0].map((value) => ({ value })) },
    ],
  }],
});

describe("finished NFL games keep their score and lines", () => {
  it("uses ESPN's final score when quarter lines are missing or don't add up", () => {
    const sum = (q: number[]) => q.reduce((a, b) => a + b, 0);
    const ok = mapEvent(event(true, "39", [3, 7, 7, 22]), 1)!;
    expect(ok.quarters.home).toEqual([3, 7, 7, 22]);
    const missing = mapEvent(event(true, "39", null), 1)!;
    expect(sum(missing.quarters.home)).toBe(39);
    const wrong = mapEvent(event(true, "39", [0, 0, 0, 0]), 1)!;
    expect(sum(wrong.quarters.home)).toBe(39);
    expect(sum(mapEvent(event(false, "0", null), 1)!.quarters.home)).toBe(0);
  });

  it("fills a finished game's spread and total from the saved closing-lines file", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("closing-lines-2026.json"))
        return new Response(JSON.stringify({ games: { "401872927": { spread: "MIN -2.5", total: 46.5, homeMoneyline: -135, awayMoneyline: 114 } } }));
      return new Response("{}", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const g = { ...mapEvent(event(true, "39", [3, 7, 7, 22]), 1)!, kickoffIso: "2026-09-13T20:25Z" } as Game;
    expect(g.spread).toBe("—");
    await backfillHistoricalOdds([g], "nfl", (x) => x.spread === "—" || !x.total);
    expect(g.spread).toBe("MIN -2.5");
    expect(g.total).toBe(46.5);
    expect(g.odds?.homeMoneyline).toBe(-135);
  });
});
