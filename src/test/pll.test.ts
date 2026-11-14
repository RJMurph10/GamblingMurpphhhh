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

import history from "@/data/pll-2019-2021.json";

describe("PLL 2019-2021 history (Wikipedia)", () => {
  const season = (y: number) => history.games.filter((g) => g.season === y);
  const wins = (y: number) => {
    const w: Record<string, number> = {};
    for (const g of season(y).filter((g) => g.phase === "regular"))
      w[g.homeScore > g.awayScore ? g.home : g.away] =
        (w[g.homeScore > g.awayScore ? g.home : g.away] ?? 0) + 1;
    return w;
  };
  it("has every season's games", () => {
    expect(season(2019)).toHaveLength(37);
    expect(season(2020)).toHaveLength(20);
    expect(season(2021)).toHaveLength(43);
  });
  it("matches the published standings", () => {
    expect(wins(2019)).toMatchObject({ "127634": 7, "127638": 6, "127635": 2 }); // Chaos 7-3, Whipsnakes 6-4
    expect(wins(2021)).toMatchObject({ "127637": 6, "127632": 6, "127635": 2 }); // Waterdogs, Atlas 6-3
  });
  it("has the champions", () => {
    const last = (y: number) =>
      season(y)
        .sort((a, b) => a.date.localeCompare(b.date))
        .at(-1)!;
    const winner = (g: (typeof history.games)[number]) =>
      g.homeScore > g.awayScore ? g.home : g.away;
    expect(winner(last(2019))).toBe("127638"); // Whipsnakes
    expect(last(2019).ot).toBe(true);
    expect(winner(last(2020))).toBe("127638"); // Whipsnakes
    expect(winner(last(2021))).toBe("127634"); // Chaos
  });
});

import { pllTeamSeasons } from "@/lib/pll/use-pll";

describe("pllTeamSeasons", () => {
  it("offers only the seasons a club played", () => {
    expect(pllTeamSeasons("127635")).toEqual([2019, 2020, 2021, 2022, 2023]); // Chrome
    expect(pllTeamSeasons("127637")[0]).toBe(2020); // Waterdogs
    expect(pllTeamSeasons("122997")[0]).toBe(2021); // Cannons
    expect(pllTeamSeasons("122896")[0]).toBe(2024); // Outlaws
    expect(pllTeamSeasons("127631")[0]).toBe(2019); // Archers
  });
});
