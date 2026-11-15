import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/pll-2026.json";
import { fetchPllSeason } from "@/lib/pll/pll.server";
import { lineResult, linesFor, linesSummary, type PllLinesFile } from "@/lib/pll/lines";
// @ts-expect-error plain .mjs script, no types
import { consensus, merge } from "../../scripts/lacrosse/merge-pll-lines.mjs";

afterEach(() => vi.unstubAllGlobals());

async function season2026() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (String(url).includes("/teams") ? fixture.teams : fixture.scoreboard),
    })),
  );
  return fetchPllSeason(2026);
}

// The Odds API shape (odds-api-games.mjs output) for the 2026 final, Outlaws at Waterdogs
const snap = (at: string, dkSpread: number, total: number) => ({
  at,
  sport: "lacrosse_pll",
  games: [
    {
      id: "final2026",
      home: "Philadelphia Waterdogs",
      away: "Denver Outlaws",
      commence: "2026-09-20T16:30:00Z",
      books: [
        {
          key: "draftkings",
          spread: [dkSpread, -110, -110],
          total: [total, -110, -110],
          ml: [-150, 125],
        },
        {
          key: "fanduel",
          spread: [dkSpread, -105, -115],
          total: [total, -112, -108],
          ml: [-155, 130],
        },
        { key: "bovada", spread: [-5.5, -110, -110], total: [30.5, -110, -110], ml: [-300, 240] }, // not a major book
      ],
    },
  ],
});

describe("PLL lines", () => {
  it("consensus uses the major books", () => {
    const c = consensus(snap("x", -1.5, 22.5).games[0].books);
    expect(c).toMatchObject({ spread: -1.5, total: 22.5, mlHome: -152, mlAway: 128, books: 2 });
  });
  it("keeps the opener and the latest line", () => {
    const f = merge(null, [
      snap("2026-09-19T12:00:00Z", -1.5, 23.5),
      snap("2026-09-20T15:00:00Z", -2.5, 22.5),
    ]);
    expect(f.games.final2026.open).toMatchObject({ spread: -1.5, total: 23.5 });
    expect(f.games.final2026.latest).toMatchObject({ spread: -2.5, total: 22.5 });
    // a later run with an older snapshot doesn't overwrite the latest
    const again = merge(f, [snap("2026-09-18T12:00:00Z", -0.5, 24.5)]);
    expect(again.games.final2026.latest).toMatchObject({ spread: -2.5 });
  });
  it("matches ESPN's game and grades it", async () => {
    const s = await season2026();
    const file = merge(null, [snap("2026-09-20T15:00:00Z", -2.5, 22.5)]) as PllLinesFile;
    const final = s.games[s.games.length - 1]; // Waterdogs 14, Outlaws 4
    const lg = linesFor(final, s, file)!;
    expect(lg).toBeTruthy();
    expect(lineResult(final, lg.latest)).toEqual({ cover: "home", ou: "under", favWon: true });
    const sum = linesSummary(s, file);
    expect(sum.games).toBe(1);
    expect(sum.overs).toEqual({ w: 0, l: 1 });
    // other games have no line
    expect(linesFor(s.games[20], s, file)).toBeUndefined();
  });
});
