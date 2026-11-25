import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import fixture from "./fixtures/pll-2026.json";
import pbp2026 from "@/data/pll-pbp-2026.json";
import { fetchPllSeason } from "@/lib/pll/pll.server";
import { isGoal, pbpForGame, pbpQuarters, type PllPbpFile } from "@/lib/pll/play-by-play";
import { PllPlayByPlay } from "@/components/pll/PllPlayByPlay";
import { PLL_CLUB_IDS } from "@/lib/pll/player-stats";
import type { PllGame } from "@/lib/pll/pll";

afterEach(() => vi.unstubAllGlobals());

const file = pbp2026 as unknown as PllPbpFile;

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

describe("PLL play-by-play (2026)", () => {
  it("covers every finished summer game, and its last goal is ESPN's final score", async () => {
    const s = await season2026();
    const summer = s.games.filter(
      (g) => g.status === "final" && (g.phase === "regular" || g.phase === "playoffs"),
    );
    expect(summer.length).toBe(53);
    expect(file.games.length).toBe(53);
    const missing: string[] = [];
    for (const g of summer) {
      const plays = pbpForGame(file, g);
      expect(plays, `${g.date} ${g.home.teamId}-${g.away.teamId}`).not.toBeNull();
      const last = [...plays!].reverse().find((p) => isGoal(p.kind))!;
      expect([last.awayScore, last.homeScore]).toEqual([g.away.score, g.home.score]);
      // goals by quarter add up to ESPN's line score
      // goals by quarter: ESPN's line score, except one game ESPN left at zeros (Outlaws-Archers 7/24)
      const q = pbpQuarters(plays!);
      const espnSum = g.home.quarters.reduce((a, b) => a + b, 0);
      if (espnSum === g.home.score) {
        expect(q.home, g.date).toEqual(g.home.quarters);
        expect(q.away, g.date).toEqual(g.away.quarters);
      } else {
        missing.push(g.date);
        expect(q.home.reduce((a, b) => a + b, 0)).toBe(g.home.score);
        expect(q.away.reduce((a, b) => a + b, 0)).toBe(g.away.score);
      }
    }
    expect(missing).toEqual(["2026-07-25T00:00Z"]);
  });

  it("plays run in game order, oldest first", () => {
    for (const g of file.games) {
      const t = g.plays.map(([p, c]) => {
        const [m, sec] = c.split(":").map(Number);
        return (p - 1) * 720 + 720 - (m * 60 + sec);
      });
      expect(
        t.every((x, i) => i === 0 || x >= t[i - 1]),
        g.file,
      ).toBe(true);
    }
  });

  it("renders the plays and the win probability on a finished game", async () => {
    const s = await season2026();
    const g = s.games.find((x) => x.status === "final" && x.phase === "playoffs")!;
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <PllPlayByPlay game={g} season={s} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Play-by-play")).toBeTruthy();
    expect(screen.getByRole("img", { name: /win probability/ })).toBeTruthy();
    expect(screen.getAllByText(/^Faceoff win/).length).toBeGreaterThan(10);
  });
});

describe("PLL international games (national teams in ESPN's PLL feed)", () => {
  it("tags them International with flags, and keeps them out of the clubs and playoffs", async () => {
    const intl = (await import("./fixtures/pll-2026-intl.json")).default;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          String(url).includes("/teams")
            ? fixture.teams
            : { ...fixture.scoreboard, events: [...fixture.scoreboard.events, ...intl.events] },
      })),
    );
    vi.resetModules(); // the season above is cached in the module
    const { fetchPllSeason: fresh } = await import("@/lib/pll/pll.server");
    const s = await fresh(2026);
    const games = s.games.filter((g) => g.phase === "intl");
    expect(games.length).toBe(8);
    const names = new Set(
      games
        .flatMap((g) => [g.home.teamId, g.away.teamId])
        .map((id) => s.teams.find((t) => t.id === id)?.short),
    );
    expect([...names].sort()).toEqual([
      "Australia Men",
      "Australia Women",
      "Canada Men",
      "Canada Women",
      "Haudenosaunee Men",
      "Haudenosaunee Women",
      "USA Men",
      "USA Women",
    ]);
    for (const t of s.teams.filter((x) => x.id.startsWith("intl-")))
      expect(t.logo).toMatch(/^\/logos\/flags\/(usa|can|aus|hau)\.svg$/);
    // the summer season is untouched: 5 playoff games, none of them international
    expect(s.games.filter((g) => g.phase === "playoffs").length).toBe(5);
  });
});

describe.each([2021, 2024, 2025])("PLL play-by-play (%i)", (season) => {
  it("each sheet matches one ESPN game, and its last goal is that game's final", async () => {
    // 2021 predates ESPN's PLL coverage: the site's results come from Wikipedia (same shape)
    const espn = (
      season === 2021
        ? await import("./fixtures/pll-2021-results.json")
        : await import(`./fixtures/pll-${season}-espn.json`)
    ).default as {
      id: string;
      date: string;
      status: string;
      sides: [string, string, string, string][];
    }[];
    const file = (
      season === 2021
        ? await import("@/data/pll-pbp-2021.json")
        : season === 2024
          ? await import("@/data/pll-pbp-2024.json")
          : await import("@/data/pll-pbp-2025.json")
    ).default as unknown as PllPbpFile;
    const games = espn
      .filter((e) => e.status === "STATUS_FINAL")
      .map((e) => {
        const side = (h: string) => {
          const [, club, , score] = e.sides.find((x) => x[0] === h)!;
          return { teamId: PLL_CLUB_IDS[club], score: Number(score), quarters: [] };
        };
        return {
          id: e.id,
          date: e.date,
          home: side("home"),
          away: side("away"),
        } as unknown as PllGame;
      });
    let matched = 0;
    for (const g of games) {
      const plays = pbpForGame(file, g);
      if (!plays) continue;
      matched++;
      const last = [...plays].reverse().find((p) => isGoal(p.kind))!;
      expect([last.awayScore, last.homeScore], g.date).toEqual([g.away.score, g.home.score]);
    }
    expect(matched).toBe(file.games.length);
  });

  it("plays run in game order, oldest first", async () => {
    const file = (await import(`@/data/pll-pbp-${season}.json`)).default as unknown as PllPbpFile;
    for (const g of file.games) {
      const t = g.plays.map(([p, c]) => {
        const [m, sec] = c.split(":").map(Number);
        return (p - 1) * 720 + 720 - (m * 60 + sec);
      });
      expect(
        t.every((x, i) => i === 0 || x >= t[i - 1]),
        g.file,
      ).toBe(true);
    }
  });
});
