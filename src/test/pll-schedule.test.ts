import { describe, expect, it } from "vitest";
import data from "@/data/pll-2026-schedule.json";
import { pllWeekOf, pllWeeks } from "@/lib/pll/schedule";

describe("PLL 2026 schedule (owner-entered)", () => {
  it("has 13 weeks and every game tied to an ESPN game", () => {
    expect(pllWeeks(2026)).toHaveLength(13);
    const games = data.weeks.flatMap((w) => w.games);
    expect(games).toHaveLength(49); // 48 regular season + the All-Star game
    expect(games.every((g) => g.espnId)).toBe(true);
  });
  it("finds a game's week and host city", () => {
    const g = data.weeks[2].games[0]; // Cannons at Whipsnakes, May 29
    expect(pllWeekOf(g.espnId!)).toMatchObject({ week: 3, city: "Baltimore, MD" });
  });
});
