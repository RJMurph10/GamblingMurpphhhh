import { describe, expect, it } from "vitest";
import data from "@/data/pll-2026-schedule.json";
import s2025 from "@/data/pll-2025-schedule.json";
import { pllTvOf, pllWeekOf, pllWeeks } from "@/lib/pll/schedule";

describe("PLL 2026 schedule (owner-entered)", () => {
  it("has 16 weeks and every game tied to an ESPN game", () => {
    expect(pllWeeks(2026)).toHaveLength(16);
    const games = data.weeks.flatMap((w) => w.games);
    expect(games).toHaveLength(54); // 48 regular season + All-Star + 5 playoff games
    expect(games.every((g) => g.espnId)).toBe(true);
  });
  it("finds a game's week and host city", () => {
    const g = data.weeks[2].games[0]; // Cannons at Whipsnakes, May 29
    expect(pllWeekOf(g.espnId!)).toMatchObject({ week: 3, label: "Week 3", city: "Baltimore, MD" });
  });
  it("labels playoff games by round", () => {
    expect(pllWeekOf("401919201")).toMatchObject({ label: "Championship", city: "New Jersey" });
    expect(pllWeekOf("401916260")).toMatchObject({
      label: "Semifinals",
      city: "Salt Lake City, UT",
    });
  });
});

describe("PLL 2025 schedule (owner-entered)", () => {
  it("has 40 regular-season games, the All-Star game and 5 playoff games, each tied to ESPN", () => {
    const games = s2025.weeks.flatMap((w) => w.games);
    expect(games).toHaveLength(46);
    expect(games.every((g) => g.espnId)).toBe(true);
  });
  it("finds a 2025 game's week and host city", () => {
    expect(pllWeekOf("401774035")).toMatchObject({ round: "All-Star", city: "Kansas City, MO" });
    const g = s2025.weeks[8].games[2]; // Waterdogs at Chaos, Jul 26 (OT)
    expect(g).toMatchObject({ away: "Waterdogs", home: "Chaos", ot: true });
    expect(pllWeekOf(g.espnId)).toMatchObject({ label: "Week 9", city: "Salt Lake City, UT" });
  });
});

describe("PLL 2025 playoffs (owner-entered)", () => {
  it("labels rounds, hosts and TV", () => {
    expect(pllWeeks(2025)).toHaveLength(14);
    expect(pllWeekOf("401809304")).toMatchObject({
      label: "Quarterfinals",
      city: "Minneapolis, MN",
    });
    expect(pllWeekOf("401813930")).toMatchObject({ label: "Semifinals", city: "Philadelphia, PA" });
    expect(pllWeekOf("401819953")).toMatchObject({ label: "Championship", city: "Harrison, NJ" });
    expect(pllTvOf("401819953")).toEqual(["ABC", "ESPN+"]);
    expect(pllTvOf("401774035")).toBeUndefined();
  });
});
