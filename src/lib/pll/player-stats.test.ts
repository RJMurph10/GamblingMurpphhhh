import { describe, expect, it } from "vitest";
import data from "@/data/pll-player-games.json";
import {
  playerKind,
  playerSlug,
  pllPlayer,
  pllPlayers,
  pllTeamPlayers,
  totalsOf,
} from "./player-stats";

describe("PLL player stats from the Cannons sheets", () => {
  it("has every entered game", () => {
    const n = (team: string) =>
      data.games.filter((g) => g.team === team && g.season === 2026).length;
    expect(n("Cannons")).toBe(14);
    expect(n("Redwoods")).toBe(13);
    expect(n("Chaos")).toBe(12);
    expect(n("Outlaws")).toBe(15);
    expect(n("Whipsnakes")).toBe(13);
    expect(n("Atlas")).toBe(12);
    expect(n("Waterdogs")).toBe(14);
  });
  it("every stat line obeys P = 1G + 2*2G + A", () => {
    for (const g of data.games)
      for (const p of g.players) {
        const s = p.stats as unknown as Record<string, number>;
        expect(s.P).toBe(s.G1 + 2 * s.G2 + s.A);
      }
  });
  it("builds players with slugs and kinds", () => {
    expect(pllPlayers().size).toBe(201);
    const h = pllPlayer(playerSlug("Marcus Holman"));
    expect(h?.games.length).toBeGreaterThan(0);
    expect(playerKind(pllPlayer(playerSlug("Colin Kirst"))!)).toBe("goalie");
    expect(pllTeamPlayers("122997", 2026).length).toBe(26);
    expect(pllTeamPlayers("127636", 2026).length).toBe(29);
    expect(pllTeamPlayers("127634", 2026).length).toBe(30);
    expect(pllTeamPlayers("122896", 2026).length).toBe(26);
    expect(pllTeamPlayers("127638", 2026).length).toBe(30);
    expect(pllTeamPlayers("127632", 2026).length).toBe(32);
    expect(pllTeamPlayers("127637", 2026).length).toBe(33);
  });
  it("totals add up across games", () => {
    const h = pllPlayer(playerSlug("Marcus Holman"))!;
    const t = totalsOf(h.games);
    expect(t.gp).toBe(h.games.length);
    expect(t.P).toBe(h.games.reduce((n, g) => n + g.stats.P, 0));
  });
});

describe("players traded mid-season", () => {
  it("Matt Rambo: one Whipsnakes game, then Atlas as A #11", () => {
    const p = pllPlayer(playerSlug("Matt Rambo"))!;
    expect(new Set(p.games.map((g) => g.team))).toEqual(new Set(["Whipsnakes", "Atlas"]));
    expect(p.team).toBe("Atlas");
    expect(p.pos).toBe("A");
    expect(p.num).toBe("11");
    const dates = p.games.map((g) => g.date);
    expect(new Set(dates).size).toBe(dates.length);
  });
});
