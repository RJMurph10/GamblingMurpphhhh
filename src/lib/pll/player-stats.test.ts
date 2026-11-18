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
    expect(n("Archers")).toBe(13);
    expect(data.games.filter((g) => g.team === "Cannons" && g.season === 2025).length).toBe(10);
    expect(data.games.filter((g) => g.team === "Cannons" && g.season === 2024).length).toBe(11);
    expect(data.games.filter((g) => g.team === "Redwoods" && g.season === 2024).length).toBe(10);
    expect(data.games.filter((g) => g.team === "Chaos" && g.season === 2024).length).toBe(12);
    expect(data.games.filter((g) => g.team === "Outlaws" && g.season === 2024).length).toBe(11);
    expect(data.games.filter((g) => g.team === "Whipsnakes" && g.season === 2024).length).toBe(13);
    expect(data.games.filter((g) => g.team === "Atlas" && g.season === 2024).length).toBe(11);
    expect(data.games.filter((g) => g.team === "Archers" && g.season === 2024).length).toBe(12);
    expect(data.games.filter((g) => g.team === "Waterdogs" && g.season === 2024).length).toBe(10);
    expect(data.games.filter((g) => g.team === "Archers" && g.season === 2023).length).toBe(12);
    expect(data.games.filter((g) => g.team === "Atlas" && g.season === 2023).length).toBe(11);
    expect(data.games.filter((g) => g.team === "Cannons" && g.season === 2023).length).toBe(12);
    expect(data.games.filter((g) => g.team === "Chaos" && g.season === 2023).length).toBe(11);
    expect(data.games.filter((g) => g.team === "Chrome" && g.season === 2023).length).toBe(10);
    expect(data.games.filter((g) => g.team === "Waterdogs" && g.season === 2023).length).toBe(13);
    expect(data.games.filter((g) => g.team === "Waterdogs" && g.season === 2025).length).toBe(12);
    expect(data.games.filter((g) => g.team === "Archers" && g.season === 2025).length).toBe(10);
  });
  it("every stat line obeys P = 1G + 2*2G + A", () => {
    for (const g of data.games)
      for (const p of g.players) {
        const s = p.stats as unknown as Record<string, number>;
        expect(s.P).toBe(s.G1 + 2 * s.G2 + s.A);
      }
  });
  it("builds players with slugs and kinds", () => {
    expect(pllPlayers().size).toBe(356);
    const h = pllPlayer(playerSlug("Marcus Holman"));
    expect(h?.games.length).toBeGreaterThan(0);
    expect(playerKind(pllPlayer(playerSlug("Colin Kirst"))!)).toBe("goalie");
    expect(pllTeamPlayers("122997", 2026).length).toBe(26);
    expect(pllTeamPlayers("122997", 2025).length).toBe(22);
    expect(pllTeamPlayers("122997", 2024).length).toBe(23);
    expect(pllTeamPlayers("127636", 2024).length).toBe(26);
    expect(pllTeamPlayers("127634", 2024).length).toBe(25);
    expect(pllTeamPlayers("122896", 2024).length).toBe(25);
    expect(pllTeamPlayers("127638", 2024).length).toBe(27);
    expect(pllTeamPlayers("127632", 2024).length).toBe(23);
    expect(pllTeamPlayers("127631", 2024).length).toBe(23);
    expect(pllTeamPlayers("127637", 2024).length).toBe(26);
    expect(pllTeamPlayers("127631", 2023).length).toBe(24);
    expect(pllTeamPlayers("127632", 2023).length).toBe(26);
    expect(pllTeamPlayers("122997", 2023).length).toBe(23);
    expect(pllTeamPlayers("127634", 2023).length).toBe(28);
    expect(pllTeamPlayers("127635", 2023).length).toBe(25);
    expect(pllTeamPlayers("127637", 2023).length).toBe(26);
    expect(pllTeamPlayers("127636", 2025).length).toBe(24);
    expect(pllTeamPlayers("127634", 2025).length).toBe(28);
    expect(pllTeamPlayers("122896", 2025).length).toBe(24);
    expect(pllTeamPlayers("127638", 2025).length).toBe(23);
    expect(pllTeamPlayers("127632", 2025).length).toBe(25);
    expect(pllTeamPlayers("127637", 2025).length).toBe(25);
    expect(pllTeamPlayers("127631", 2025).length).toBe(23);
    expect(pllTeamPlayers("127636", 2026).length).toBe(29);
    expect(pllTeamPlayers("127634", 2026).length).toBe(30);
    expect(pllTeamPlayers("122896", 2026).length).toBe(26);
    expect(pllTeamPlayers("127638", 2026).length).toBe(30);
    expect(pllTeamPlayers("127632", 2026).length).toBe(32);
    expect(pllTeamPlayers("127637", 2026).length).toBe(33);
    expect(pllTeamPlayers("127631", 2026).length).toBe(24);
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
  it("Ryan Conrad (2024): Waterdogs through 8/3, then Whipsnakes from 8/9, M #23", () => {
    const g24 = pllPlayer(playerSlug("Ryan Conrad"))!.games.filter((g) => g.season === 2024);
    expect(g24.filter((g) => g.team === "Waterdogs")).toHaveLength(7);
    expect(g24.filter((g) => g.team === "Whipsnakes")).toHaveLength(4);
    const last = (t: string) =>
      g24
        .filter((g) => g.team === t)
        .map((g) => g.date)
        .sort()
        .pop()!;
    const first = (t: string) =>
      g24
        .filter((g) => g.team === t)
        .map((g) => g.date)
        .sort()[0];
    expect(last("Waterdogs") < first("Whipsnakes")).toBe(true);
  });
});

describe("the full 2024 season", () => {
  it("has both clubs' sheets for every game", () => {
    const g24 = data.games.filter((g) => g.season === 2024);
    expect(g24).toHaveLength(90);
    for (const g of g24)
      expect(
        g24.some((o) => o.team === g.opponent && o.opponent === g.team && o.date === g.date),
      ).toBe(true);
  });
});

describe("the full 2026 season", () => {
  type Line = { stats?: Record<string, number | null> };
  const goals = (ps: Line[]) => ps.reduce((n, p) => n + (p.stats ? p.stats.P! - p.stats.A! : 0), 0);
  const against = (ps: Line[]) => ps.reduce((n, p) => n + (p.stats?.SA ?? 0), 0);
  const games = data.games.filter((g) => g.season === 2026);
  it("has both clubs' sheets for every game, and they agree on the score", () => {
    for (const g of games) {
      const other = games.find(
        (o) => o.team === g.opponent && o.opponent === g.team && o.date === g.date,
      );
      expect(other, `${g.date} ${g.team} vs ${g.opponent}`).toBeDefined();
      expect(goals(g.players as unknown as Line[])).toBe(
        against(other!.players as unknown as Line[]),
      );
    }
  });
});

describe.each([2023, 2024, 2025])("%i sheets", (season) => {
  type Line = { stats?: Record<string, number | null> };
  const goals = (ps: Line[]) => ps.reduce((n, p) => n + (p.stats ? p.stats.P! - p.stats.A! : 0), 0);
  const against = (ps: Line[]) => ps.reduce((n, p) => n + (p.stats?.SA ?? 0), 0);
  it("match ESPN's final scores", async () => {
    const espn = (season === 2023
      ? await import("@/test/fixtures/pll-2023-espn.json")
      : season === 2024
        ? await import("@/test/fixtures/pll-2024-espn.json")
        : await import("@/test/fixtures/pll-2025-espn.json")
    ).default as unknown as {
      date: string;
      sides: [string, string, string, string][];
    }[];
    const games = data.games.filter((g) => g.season === season);
    expect(games.length).toBeGreaterThan(0);
    for (const g of games) {
      const day = Date.parse(g.date);
      const e = espn.find(
        (x) =>
          Math.abs(Date.parse(x.date.slice(0, 10)) - day) <= 86_400_000 &&
          x.sides.some((s) => s[1] === g.team) &&
          x.sides.some((s) => s[1] === g.opponent),
      );
      expect(e, `${g.date} ${g.team} vs ${g.opponent}`).toBeDefined();
      const score = (t: string) => Number(e!.sides.find((s) => s[1] === t)![3]);
      expect(goals(g.players as unknown as Line[])).toBe(score(g.team));
      expect(against(g.players as unknown as Line[])).toBe(score(g.opponent));
    }
  });
});
