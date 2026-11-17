import { describe, expect, it } from "vitest";
import { parseGamesCsv } from "@/lib/nfl/nfl-history.server";

const header =
  "game_id,season,game_type,week,gameday,espn,away_team,home_team,away_score,home_score,away_qb_id,home_qb_id,away_qb_name,home_qb_name";
const row = (espn: number, aScore: string, hScore: string) =>
  `x,2026,REG,10,2026-11-16,${espn},LAC,BAL,${aScore},${hScore},00-0036355,00-0035993,Justin Herbert,Tyler Huntley`;

describe("hand-set starting QBs", () => {
  it("replace nflverse's projected starter for an upcoming game", () => {
    const { upcoming } = parseGamesCsv([header, row(401873065, "NA", "NA")].join("\n"), 2026, 2026);
    expect(upcoming[0]).toMatchObject({
      homeQbName: "Jacoby Brissett",
      homeQb: "00-0033119",
      awayQbName: "Justin Herbert",
    });
  });
  it("leave finished games and other games alone", () => {
    const { games, upcoming } = parseGamesCsv(
      [header, row(401873065, "20", "17"), row(401999999, "NA", "NA")].join("\n"),
      2026,
      2026,
    );
    expect(games[0].homeQbName).toBe("Tyler Huntley");
    expect(upcoming[0].homeQbName).toBe("Tyler Huntley");
  });
  it("apply the hourly automatic corrections, with hand-set starters winning", () => {
    const csv = [header, row(401999999, "NA", "NA"), row(401873065, "NA", "NA")].join("\n");
    const { upcoming } = parseGamesCsv(csv, 2026, 2026, new Map(), {
      "401999999": { home: { qbId: "00-0033119", name: "Jacoby Brissett" } },
      "401873065": { home: { qbId: "x", name: "Someone Else" } },
    });
    expect(upcoming[0].homeQbName).toBe("Jacoby Brissett");
    expect(upcoming[1].homeQbName).toBe("Jacoby Brissett"); // the hand-set one wins
  });
});
