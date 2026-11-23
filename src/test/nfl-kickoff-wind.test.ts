import { describe, expect, it } from "vitest";
import { fillKickoffWind } from "@/lib/nfl/nfl-history.server";
import { recordedConditions, type HistoryGame } from "@/lib/nfl/model-history";

const game = (
  espnId: number,
  roof: string,
  wind: number | null,
  temp: number | null = null,
): HistoryGame => ({
  season: 2026,
  week: 9,
  espnId,
  date: "2026-11-01",
  away: "TB",
  home: "ATL",
  awayScore: 20,
  homeScore: 17,
  homeFavoredBy: 3,
  total: 44.5,
  awayMoneyline: null,
  homeMoneyline: null,
  awaySpreadOdds: null,
  homeSpreadOdds: null,
  overOdds: null,
  underOdds: null,
  roof,
  temp,
  wind,
});

describe("kickoff wind filled where nflverse has none", () => {
  const fill = { "1": { wind: 12, temp: 48 }, "2": { wind: 15 }, "3": { wind: 11 } };

  it("fills an outdoor game with no recorded wind, and the wind under can be graded", () => {
    const [g] = fillKickoffWind([game(1, "outdoors", null)], fill);
    expect(g).toMatchObject({ wind: 12, temp: 48, windSource: "open-meteo" });
    expect(recordedConditions(g)).toMatchObject({ outdoor: true, wind: 12 });
  });

  it("never replaces reported wind, and leaves domes alone", () => {
    const [reported, dome] = fillKickoffWind([game(2, "open", 6, 60), game(3, "dome", null)], fill);
    expect(reported.wind).toBe(6);
    expect(reported.windSource).toBeUndefined();
    expect(dome.wind).toBeNull();
  });
});
