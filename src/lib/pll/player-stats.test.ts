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
  it("has all 14 Cannons games", () => {
    expect(data.games.filter((g) => g.season === 2026).length).toBe(14);
  });
  it("every stat line obeys P = 1G + 2*2G + A", () => {
    for (const g of data.games)
      for (const p of g.players) {
        const s = p.stats as unknown as Record<string, number>;
        expect(s.P).toBe(s.G1 + 2 * s.G2 + s.A);
      }
  });
  it("builds players with slugs and kinds", () => {
    expect(pllPlayers().size).toBe(26);
    const h = pllPlayer(playerSlug("Marcus Holman"));
    expect(h?.games.length).toBeGreaterThan(0);
    expect(playerKind(pllPlayer(playerSlug("Colin Kirst"))!)).toBe("goalie");
    expect(pllTeamPlayers("122997", 2026).length).toBe(26);
  });
  it("totals add up across games", () => {
    const h = pllPlayer(playerSlug("Marcus Holman"))!;
    const t = totalsOf(h.games);
    expect(t.gp).toBe(h.games.length);
    expect(t.P).toBe(h.games.reduce((n, g) => n + g.stats.P, 0));
  });
});
