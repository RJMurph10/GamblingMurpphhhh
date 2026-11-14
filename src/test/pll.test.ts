import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/pll-2026.json";
import { fetchPllSeason } from "@/lib/pll/pll.server";
import { pulse, standings } from "@/lib/pll/pll";

afterEach(() => vi.unstubAllGlobals());

describe("PLL from ESPN", () => {
  it("builds the 2026 season: phases, standings, numbers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => (String(url).includes("/teams") ? fixture.teams : fixture.scoreboard),
      })),
    );
    const s = await fetchPllSeason(2026);
    expect(s.teams).toHaveLength(8);
    expect(s.teams.some((t) => /east|west|team /i.test(t.name))).toBe(false);
    const by = (p: string) => s.games.filter((g) => g.phase === p).length;
    expect(by("regular")).toBe(40);
    expect(by("champ")).toBe(8); // February / March Championship Series
    expect(by("playoffs") + by("allstar")).toBe(63 - 40 - 8);
    const table = standings(s);
    expect(table).toHaveLength(8);
    expect(table.reduce((n, r) => n + r.w, 0)).toBe(40);
    // the final: Waterdogs 14, Outlaws 4 on Sep 20
    const final = s.games[s.games.length - 1];
    expect(final.phase).toBe("playoffs");
    expect(final.home.score).toBe(14);
    expect(final.home.quarters).toEqual([7, 3, 1, 3]);
    const p = pulse(s.games.filter((g) => g.phase === "regular"));
    expect(p.games).toBe(40);
    expect(p.goalsPerGame).toBeGreaterThan(15);
  });
});
