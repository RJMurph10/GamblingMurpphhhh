import { describe, expect, it } from "vitest";
import { buildHalftime, firstHalfStats } from "@/lib/shared/halftime.server";

const cell = (price: number, line: number | null, open = 1) => [
  String(price),
  line == null ? null : String(line),
  open,
  "2026-11-17T02:40:00Z",
];

const nflFile = {
  league: "NFL",
  espnId: "401873064",
  at: "2026-11-17T02:45:00Z",
  home: "Cincinnati Bengals",
  away: "Pittsburgh Steelers",
  espn: {
    status: "STATUS_HALFTIME",
    score: { home: 24, away: 3 },
    linescores: { home: [3, 21], away: [0, 3] },
    players: [
      {
        team: "Pittsburgh Steelers",
        groups: [
          {
            name: "rushing",
            labels: ["CAR", "YDS", "AVG", "TD", "LONG"],
            athletes: [["Jaylen Warren", "1", ["5", "21", "4.2", "0", "9"]]],
          },
          {
            name: "receiving",
            labels: ["REC", "YDS", "AVG", "TD", "LONG", "TGTS"],
            athletes: [["Jaylen Warren", "1", ["2", "15", "7.5", "0", "18", "3"]]],
          },
          {
            name: "passing",
            labels: ["C/ATT", "YDS", "AVG", "TD", "INT", "SACKS", "QBR", "RTG"],
            athletes: [["Aaron Rodgers", "2", ["8/15", "70", "4.7", "0", "0", "1-6", "20", "70"]]],
          },
        ],
      },
    ],
  },
  sgo: {
    teams: {
      home: { teamID: "CINCINNATI_BENGALS_NFL" },
      away: { teamID: "PITTSBURGH_STEELERS_NFL" },
    },
    players: {
      JW: ["Jaylen Warren", "PITTSBURGH_STEELERS_NFL"],
      AR: ["Aaron Rodgers", "PITTSBURGH_STEELERS_NFL"],
    },
    odds: [
      {
        oddID: "a",
        stat: "rushing_yards",
        entity: "JW",
        period: "game",
        bet: "ou",
        side: "over",
        player: "JW",
        fair: [null, null],
        book: [null, null],
        books: { draftkings: cell(-115, 44.5), fanduel: cell(-105, 44.5) },
      },
      {
        oddID: "b",
        stat: "rushing_yards",
        entity: "JW",
        period: "game",
        bet: "ou",
        side: "under",
        player: "JW",
        fair: [null, null],
        book: [null, null],
        books: { draftkings: cell(-115, 44.5), fanduel: cell(-125, 44.5) },
      },
      // DraftKings closed on this one: FanDuel's line is used
      {
        oddID: "c",
        stat: "passing_yards",
        entity: "AR",
        period: "game",
        bet: "ou",
        side: "over",
        player: "AR",
        fair: [null, null],
        book: [null, null],
        books: { draftkings: cell(-110, 160.5, 0), fanduel: cell(-112, 165.5) },
      },
      {
        oddID: "d",
        stat: "passing_yards",
        entity: "AR",
        period: "game",
        bet: "ou",
        side: "under",
        player: "AR",
        fair: [null, null],
        book: [null, null],
        books: { draftkings: cell(-110, 160.5, 0), fanduel: cell(-108, 165.5) },
      },
      {
        oddID: "e",
        stat: "points",
        entity: "home",
        period: "2h",
        bet: "sp",
        side: "home",
        player: null,
        fair: [null, null],
        book: [null, null],
        books: { draftkings: cell(-110, -3.5) },
      },
      {
        oddID: "f",
        stat: "points",
        entity: "away",
        period: "2h",
        bet: "sp",
        side: "away",
        player: null,
        fair: [null, null],
        book: [null, null],
        books: { draftkings: cell(-110, 3.5) },
      },
      {
        oddID: "g",
        stat: "points",
        entity: "all",
        period: "game",
        bet: "ou",
        side: "over",
        player: null,
        fair: [null, null],
        book: [null, null],
        books: { draftkings: cell(-110, 44.5) },
      },
      {
        oddID: "h",
        stat: "points",
        entity: "all",
        period: "game",
        bet: "ou",
        side: "under",
        player: null,
        fair: [null, null],
        book: [null, null],
        books: { draftkings: cell(-110, 44.5) },
      },
    ],
  },
};

describe("halftime lines", () => {
  it("builds player props with DraftKings first, best prices and 1st-half numbers", () => {
    const h = buildHalftime("nfl", nflFile as never);
    const warren = h.props.find((p) => p.market === "Rush yds")!;
    expect(warren).toMatchObject({
      player: "Jaylen Warren",
      side: "away",
      line: 44.5,
      over: -115,
      under: -115,
      book: "DraftKings",
      firstHalf: 21,
    });
    expect(warren.bestOver).toEqual([-105, "FanDuel"]);
    expect(warren.bestUnder).toEqual([-115, "DraftKings"]);
    const rodgers = h.props.find((p) => p.market === "Pass yds")!;
    expect(rodgers).toMatchObject({ line: 165.5, book: "FanDuel", firstHalf: 70 });
    expect(h.score).toEqual({ home: 24, away: 3 });
    expect(h.games.find((g) => g.period === "2nd half")?.spread).toMatchObject({
      line: -3.5,
      book: "DraftKings",
    });
    expect(h.games.find((g) => g.period.startsWith("Full"))?.total).toMatchObject({
      line: 44.5,
      over: -110,
    });
  });

  it("reads NBA 1st-half box scores, including made threes and combos", () => {
    const m = firstHalfStats("nba", {
      status: null,
      score: {},
      linescores: {},
      players: [
        {
          team: "x",
          groups: [
            {
              name: "",
              labels: [
                "MIN",
                "PTS",
                "FG",
                "3PT",
                "FT",
                "REB",
                "AST",
                "TO",
                "STL",
                "BLK",
                "OREB",
                "DREB",
                "PF",
                "+/-",
              ],
              athletes: [
                [
                  "Jalen Brunson Jr.",
                  "9",
                  ["18", "14", "5-9", "2-4", "2-2", "3", "5", "1", "0", "0", "1", "2", "1", "+6"],
                ],
              ],
            },
          ],
        },
      ],
    });
    expect(m.get("jalenbrunson|Points")).toBe(14);
    expect(m.get("jalenbrunson|3-pointers")).toBe(2);
    expect(m.get("jalenbrunson|Pts+Reb+Ast")).toBe(22);
  });
});
