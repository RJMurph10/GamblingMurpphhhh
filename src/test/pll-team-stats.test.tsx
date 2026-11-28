import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import fixture from "./fixtures/pll-2026.json";
import ts2026 from "@/data/pll-team-stats-2026.json";
import pbp2026 from "@/data/pll-pbp-2026.json";
import ts2025 from "@/data/pll-team-stats-2025.json";
import pbp2025 from "@/data/pll-pbp-2025.json";
import { fetchPllSeason } from "@/lib/pll/pll.server";
import { teamStatsForGame, type PllTeamStatsFile } from "@/lib/pll/team-stats";
import { PllTeamStats } from "@/components/pll/PllTeamStats";

afterEach(() => vi.unstubAllGlobals());

const file = ts2026 as unknown as PllTeamStatsFile;

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

const val = (rows: ReturnType<typeof teamStatsForGame>, key: string) =>
  rows!.find((r) => r.key === key)!;

describe("PLL team stats (2026)", () => {
  it("covers every finished summer game, with ESPN's final score", async () => {
    const s = await season2026();
    const summer = s.games.filter(
      (g) => g.status === "final" && (g.phase === "regular" || g.phase === "playoffs"),
    );
    expect(summer.length).toBe(53);
    expect(file.games.length).toBe(53);
    for (const g of summer) {
      const rows = teamStatsForGame(file, g);
      expect(rows, `${g.date} ${g.home.teamId}-${g.away.teamId}`).not.toBeNull();
      const score = val(rows, "score");
      expect([score.away, score.home], g.date).toEqual([g.away.score, g.home.score]);
    }
  });

  it.each([
    [2025, ts2025, pbp2025, 45],
    [2026, ts2026, pbp2026, 53],
  ])(
    "%i adds up: 1-point + 2 × 2-point goals = score, the play-by-play's final, the same file names",
    (_, tsFile, pbpFile, games) => {
      const f = tsFile as unknown as PllTeamStatsFile;
      expect(f.games.length).toBe(games);
      const keys = f.fields.map((x) => x[0]);
      const at = (k: string) => keys.indexOf(k);
      const pbp = new Map(
        (pbpFile as { games: { file: string; final: number[] }[] }).games.map((g) => [g.file, g]),
      );
      for (const g of f.games) {
        for (const side of [0, 1]) {
          const n = (k: string) => g.stats[at(k)][side] as number;
          expect(n("g1") + 2 * n("g2"), g.file).toBe(n("score"));
        }
        expect(pbp.has(g.file), g.file).toBe(true);
        expect(g.stats[at("score")], g.file).toEqual(pbp.get(g.file)!.final);
      }
    },
  );

  it("renders a game's team stats", async () => {
    const s = await season2026();
    const g = s.games.find((x) => x.status === "final" && x.phase === "playoffs")!;
    const rows = teamStatsForGame(file, g)!;
    render(<PllTeamStats rows={rows} />);
    expect(screen.getByText("Team stats")).toBeTruthy();
    expect(screen.getByText("Faceoffs Won")).toBeTruthy();
    expect(screen.getAllByText("Power Play").length).toBe(2); // the section and its row
  });
});
