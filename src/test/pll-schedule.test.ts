import { describe, expect, it } from "vitest";
import data from "@/data/pll-2026-schedule.json";
import s2022 from "@/data/pll-2022-schedule.json";
import s2023 from "@/data/pll-2023-schedule.json";
import s2024 from "@/data/pll-2024-schedule.json";
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

describe("PLL 2024 schedule (owner-entered)", () => {
  it("has 14 weeks and 45 games (40 regular season, 5 playoffs), each tied to ESPN", () => {
    expect(pllWeeks(2024)).toHaveLength(14);
    const games = s2024.weeks.flatMap((w) => w.games);
    expect(games).toHaveLength(45);
    expect(games.every((g) => g.espnId)).toBe(true);
    expect(pllWeeks(2024)[5]).toMatchObject({ label: "All-Star", city: "Louisville, KY" });
  });
  it("finds a 2024 game's week and host city", () => {
    const g = s2024.weeks[10].games[1]; // Cannons at Chaos, Aug 16 (OT)
    expect(g).toMatchObject({ away: "Cannons", home: "Chaos", ot: true });
    expect(pllWeekOf(g.espnId)).toMatchObject({ label: "Week 11", city: "Salt Lake City, UT" });
  });
  it("labels the 2024 playoffs", () => {
    const [qf, sf, final] = [11, 12, 13].map((i) => s2024.weeks[i]);
    expect(pllWeekOf(qf.games[0].espnId)).toMatchObject({
      label: "Quarterfinals",
      city: "Boston, MA",
    });
    expect(pllWeekOf(sf.games[1].espnId)).toMatchObject({
      label: "Semifinals",
      city: "Long Island, NY",
    });
    expect(final.games[0]).toMatchObject({
      away: "Whipsnakes",
      home: "Archers",
      awayScore: 8,
      homeScore: 12,
    });
    expect(pllWeekOf(final.games[0].espnId)).toMatchObject({
      label: "Championship",
      city: "Philadelphia, PA",
    });
  });
});

describe("PLL 2023 schedule (owner-entered)", () => {
  it("has 14 weeks and 46 games (40 regular season, 6 playoffs), each tied to ESPN", () => {
    expect(pllWeeks(2023)).toHaveLength(14);
    const games = s2023.weeks.flatMap((w) => w.games);
    expect(games).toHaveLength(46);
    expect(games.every((g) => g.espnId)).toBe(true);
    expect(pllWeeks(2023)[5]).toMatchObject({ label: "All-Star", city: "Louisville, KY" });
  });
  it("finds a 2023 game's week and host city", () => {
    const g = s2023.weeks[9].games[2]; // Chrome at Redwoods, Aug 19 (OT)
    expect(g).toMatchObject({ away: "Chrome", home: "Redwoods", ot: true });
    expect(pllWeekOf(g.espnId)).toMatchObject({ label: "Week 10", city: "Seattle, WA" });
  });
  it("labels the 2023 playoffs", () => {
    const [qf, sf, final] = [11, 12, 13].map((i) => s2023.weeks[i]);
    expect(qf.games).toHaveLength(3);
    expect(pllWeekOf(qf.games[2].espnId)).toMatchObject({
      label: "Quarterfinals",
      city: "Boston, MA",
    });
    expect(pllWeekOf(sf.games[0].espnId)).toMatchObject({
      label: "Semifinals",
      city: "Long Island, NY",
    });
    expect(final.games[0]).toMatchObject({
      away: "Waterdogs",
      home: "Archers",
      awayScore: 14,
      homeScore: 15,
    });
    expect(pllWeekOf(final.games[0].espnId)).toMatchObject({
      label: "Championship",
      city: "Philadelphia, PA",
    });
  });
});

describe("PLL 2022 schedule (owner-entered)", () => {
  it("has 14 weeks and 46 games (40 regular season, 6 playoffs), each tied to ESPN", () => {
    expect(pllWeeks(2022)).toHaveLength(14);
    const games = s2022.weeks.flatMap((w) => w.games);
    expect(games).toHaveLength(46);
    expect(games.every((g) => g.espnId)).toBe(true);
    expect(pllWeeks(2022)[5]).toMatchObject({ label: "All-Star", city: "Boston, MA" });
  });
  it("finds a 2022 game's week and host city", () => {
    const g = s2022.weeks[1].games[0]; // Chrome at Redwoods, Jun 10 (12-3)
    expect(g).toMatchObject({ away: "Chrome", home: "Redwoods", awayScore: 12, homeScore: 3 });
    expect(pllWeekOf(g.espnId)).toMatchObject({ label: "Week 2", city: "Charlotte, NC" });
  });
  it("labels the 2022 playoffs; the championship is tied to ESPN although ESPN dates it a day later", () => {
    const [qf, sf, final] = [11, 12, 13].map((i) => s2022.weeks[i]);
    expect(qf.games).toHaveLength(3);
    expect(pllWeekOf(sf.games[0].espnId)).toMatchObject({
      label: "Semifinals",
      city: "Washington, D.C.",
    });
    expect(final.games[0]).toMatchObject({
      date: "2022-09-18",
      away: "Chaos",
      home: "Waterdogs",
      awayScore: 9,
      homeScore: 11,
    });
    expect(pllWeekOf(final.games[0].espnId)).toMatchObject({
      label: "Championship",
      city: "Philadelphia, PA",
    });
  });
});
