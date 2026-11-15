import { describe, expect, it } from "vitest";
import { pllLeaders, pllRoster } from "@/lib/pll/players";

const top = (season: number, stat: string) =>
  pllLeaders(season).find((g) => g.stat === stat)?.rows[0];

describe("PLL players from Wikipedia", () => {
  // each checked against an independent source (league awards coverage, USA Lacrosse, StatsCrew)
  it("has the points leaders the league announced", () => {
    expect(top(2019, "Points")).toMatchObject({
      player: "Matt Rambo",
      value: "42",
      team: "127638",
    });
    expect(top(2022, "Points")).toMatchObject({
      player: "Lyle Thompson",
      value: "44",
      team: "122997",
    });
    expect(top(2024, "Points")).toMatchObject({ player: "Jeff Teat", value: "64", team: "127632" });
    expect(top(2025, "Points")).toMatchObject({ player: "Connor Shellenberger", value: "46" });
    expect(top(2026, "Points")).toMatchObject({
      player: "Michael Sowers",
      value: "51",
      team: "127637",
    });
  });
  it("marks records and has no leaders for 2020", () => {
    expect(top(2024, "Points")?.note).toBe("PLL single-season record");
    expect(pllLeaders(2020)).toEqual([]);
  });
  it("filters leaders to one club", () => {
    const atlas = pllLeaders(2024, "127632");
    expect(atlas.length).toBeGreaterThan(0);
    expect(atlas.every((g) => g.rows.every((r) => r.team === "127632"))).toBe(true);
  });
  it("has a roster for every current club", () => {
    for (const id of [
      "127631",
      "127632",
      "122997",
      "127634",
      "122896",
      "127636",
      "127637",
      "127638",
    ])
      expect(pllRoster(id)?.players.length).toBeGreaterThan(20);
    expect(pllRoster("127635")).toBeUndefined(); // Chrome
  });
});
