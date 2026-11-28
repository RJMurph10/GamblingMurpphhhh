import { describe, expect, it } from "vitest";
import {
  bestPrices,
  captureStatus,
  disagreements,
  grade,
  isBest,
  latestByBook,
  mapGameForTest,
  nllSeasonOf,
  nllStandings,
  snapshotsFor,
  type NllLinesFile,
  type NllSeason,
} from "./nll-fixture";

const T = (id: string, name: string, abbr: string) => ({
  id,
  name,
  abbr,
  short: name.split(" ").pop()!,
  color: null,
  logo: null,
});
const season: NllSeason = {
  season: 2026,
  label: "2026-27",
  teams: [
    T("125425", "Georgia Swarm", "GA"),
    T("125429", "Buffalo Bandits", "BUF"),
    T("125435", "San Diego Seals", "SD"),
  ],
  games: [
    mapGameForTest("1", "2026-11-29T00:00Z", "125429", "125425", 12, 11, "final"),
    mapGameForTest("2", "2026-12-05T00:00Z", "125435", "125429", null, null, "scheduled"),
  ],
};
const file: NllLinesFile = {
  league: "NLL",
  season: "2026-27",
  snapshots: [
    {
      captured: "2026-11-28T00:55:00Z",
      book: "fanduel",
      game: "Georgia Swarm @ Buffalo Bandits",
      start: "2026-11-29T00:00:00Z",
      live: false,
      spread: { away: [1.5, -144], home: [-1.5, 118] },
      total: { line: 21.5, over: -110, under: -110 },
      moneyline: { away: -105, home: -115 },
    },
    {
      captured: "2026-11-28T00:55:00Z",
      book: "thescore",
      game: "Georgia Swarm @ Buffalo Bandits",
      start: "2026-11-29T00:00:00Z",
      live: false,
      spread: { away: [-1.5, 120], home: [1.5, -150] },
      total: { line: 22.5, over: -120, under: -105 },
      moneyline: { away: -120, home: -105 },
    },
    {
      captured: "2026-11-28T22:30:00Z",
      book: "fanduel",
      game: "Georgia Swarm @ Buffalo Bandits",
      start: "2026-11-29T00:00:00Z",
      live: false,
      spread: { away: [1.5, -150], home: [-1.5, 122] },
      total: null,
      moneyline: null,
    },
    {
      captured: "2026-11-28T00:55:00Z",
      book: "bet365",
      game: "Saskatchewan Rush @ Oshawa FireWolves",
      start: "2026-11-28T00:30:00Z",
      live: true,
      spread: { away: [-1.5, -125], home: [1.5, -115] },
      total: null,
      moneyline: null,
    },
  ],
};

describe("NLL lines desk", () => {
  it("season year: late November to June belongs to the season that started in the fall", () => {
    expect(nllSeasonOf(new Date("2026-11-28T00:00Z"))).toBe(2026);
    expect(nllSeasonOf(new Date("2027-04-10T00:00Z"))).toBe(2026);
  });

  it("matches saved snapshots to the game by both teams and start (live snapshots left out)", () => {
    expect(snapshotsFor(season.games[0], season, file)).toHaveLength(3);
    expect(snapshotsFor(season.games[1], season, file)).toHaveLength(0);
  });

  it("keeps each book's latest snapshot and marks a closing capture within 3 hours", () => {
    const snaps = snapshotsFor(season.games[0], season, file);
    const latest = latestByBook(snaps);
    expect(latest.map((s) => [s.book, s.captured])).toEqual([
      ["fanduel", "2026-11-28T22:30:00Z"],
      ["thescore", "2026-11-28T00:55:00Z"],
    ]);
    expect(captureStatus(season.games[0], snaps)).toBe("close");
    expect(captureStatus(season.games[0], snaps.slice(0, 2))).toBe("open");
    expect(captureStatus(season.games[1], [])).toBe("none");
  });

  it("grades a one-goal home win: both +1.5 sides win, under 22.5 and over 21.5 split on 23", () => {
    const [fd, sc] = snapshotsFor(season.games[0], season, file);
    const g1 = grade(fd, 12, 11);
    expect(g1.spreadAway).toBe("win"); // Swarm +1.5, lost by 1
    expect(g1.spreadHome).toBe("loss");
    expect(g1.over).toBe("win"); // 23 > 21.5
    expect(g1.mlHome).toBe("win");
    const g2 = grade(sc, 12, 11);
    expect(g2.spreadHome).toBe("win"); // Bandits +1.5
    expect(g2.under).toBe("loss"); // 23 > 22.5
  });

  it("finds the best price per side and number, and flags disagreements", () => {
    const snaps = snapshotsFor(season.games[0], season, file).slice(0, 2);
    const best = bestPrices(snaps);
    expect(isBest(best, "mlAway", null, -105)).toBe(true);
    expect(isBest(best, "mlAway", null, -120)).toBe(false);
    expect(disagreements(snaps)).toEqual([
      "Books disagree on the spread favorite",
      "Totals range 21.5–22.5",
    ]);
  });

  it("standings from finals", () => {
    const st = nllStandings(season);
    expect(st[0].team.abbr).toBe("BUF");
    expect([st[0].w, st[0].l, st[0].gf, st[0].ga]).toEqual([1, 0, 12, 11]);
  });
});

describe("NLL primary line (DraftKings)", () => {
  it("uses DraftKings market by market and falls back to the other books' median", async () => {
    const { primaryLine, latestByBook } = await import("./nll-fixture");
    const base = {
      captured: "2026-11-28T00:55:00Z",
      game: "Georgia Swarm @ Buffalo Bandits",
      start: "2026-11-29T00:00:00Z",
      live: false,
    };
    const dk = {
      ...base,
      book: "draftkings",
      spread: { away: [1.5, -166], home: [-1.5, 130] },
      total: null,
      moneyline: { away: -105, home: -125 },
    } as const;
    const fd = {
      ...base,
      book: "fanduel",
      spread: { away: [1.5, -144], home: [-1.5, 118] },
      total: { line: 21.5, over: -110, under: -110 },
      moneyline: { away: -105, home: -115 },
    } as const;
    const sc = {
      ...base,
      book: "thescore",
      spread: { away: [-1.5, 120], home: [1.5, -150] },
      total: { line: 22.5, over: -120, under: -105 },
      moneyline: { away: -120, home: -105 },
    } as const;
    // @ts-expect-error readonly tuples are fine here
    const line = primaryLine([fd, sc, dk])!;
    expect(line.source).toBe("draftkings");
    expect(line.spread).toBe(-1.5);
    expect(line.mlHome).toBe(-125);
    expect(line.total).toBe(22); // no DK total: median of 21.5 and 22.5
    expect(line.prices?.spreadHome).toBe(130);
    // @ts-expect-error readonly tuples are fine here
    expect(latestByBook([fd, sc, dk]).map((s) => s.book)).toEqual([
      "draftkings",
      "fanduel",
      "thescore",
    ]);
    // @ts-expect-error readonly tuples are fine here
    expect(primaryLine([fd, sc])!.source).toBe("median");
  });
});
