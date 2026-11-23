import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs script, no types
import { altGameOf } from "../../scripts/line-history/sgo-alts.mjs";

const event = {
  eventID: "e1",
  status: { startsAt: "2026-11-15T18:00:00.000Z" },
  teams: {
    home: { names: { long: "Detroit Lions" } },
    away: { names: { long: "New England Patriots" } },
  },
  odds: {
    "points-home-game-sp-home": {
      byBookmaker: {
        draftkings: {
          spread: "-3",
          odds: "-110",
          lastUpdatedAt: "2026-11-15T17:00:00.000Z",
          altLines: [
            { spread: "-10.5", odds: "+240", lastUpdatedAt: "2026-11-15T16:00:00.000Z" },
            { spread: "-7.5", odds: "+150", lastUpdatedAt: "2026-11-15T16:00:00.000Z" },
            // updated after kickoff: an in-game price, dropped
            { spread: "-13.5", odds: "+120", lastUpdatedAt: "2026-11-15T19:30:00.000Z" },
          ],
        },
        // only the main line: not a ladder
        fanduel: { spread: "-3", odds: "-108", lastUpdatedAt: "2026-11-15T17:00:00.000Z" },
      },
    },
  },
};

describe("alt-line ladders from SportsGameOdds events", () => {
  it("keeps each book's pregame rungs, sorted by line", () => {
    const g = altGameOf(event);
    expect(g.home).toBe("Detroit Lions");
    expect(g.ladders["home-spread"].draftkings).toEqual([
      [-10.5, 240],
      [-7.5, 150],
      [-3, -110],
    ]);
    expect(g.ladders["home-spread"].fanduel).toBeUndefined();
  });

  it("returns nothing for an event without ladders", () => {
    expect(altGameOf({ ...event, odds: {} })).toBeNull();
  });
});
