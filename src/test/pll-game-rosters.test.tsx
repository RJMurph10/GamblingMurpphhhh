import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import fixture from "./fixtures/pll-2026.json";
import { fetchPllSeason } from "@/lib/pll/pll.server";
import { gameRoster } from "@/lib/pll/game-rosters";
import { PllGameRosters } from "@/components/pll/PllGameRosters";

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

describe("PLL game-day rosters (2026)", () => {
  it("every finished summer game has a roster for both clubs", async () => {
    const s = await season2026();
    const summer = s.games.filter(
      (g) => g.status === "final" && (g.phase === "regular" || g.phase === "playoffs"),
    );
    expect(summer.length).toBe(53);
    let exact = 0;
    for (const g of summer)
      for (const id of [g.home.teamId, g.away.teamId]) {
        const r = gameRoster(g, s, id);
        expect(r?.players.length ?? 0).toBeGreaterThanOrEqual(15);
        if (r?.exact) exact++;
        else expect(new Date(r!.from!).getTime()).toBeLessThan(new Date(g.date).getTime());
      }
    // May to July: the game's own box score
    expect(exact).toBeGreaterThanOrEqual(76);
  });
  it("rosters change week to week", async () => {
    const s = await season2026();
    const wat = s.games.filter(
      (g) => g.phase === "regular" && (g.home.teamId === "127637" || g.away.teamId === "127637"),
    );
    const lists = wat
      .map((g) => gameRoster(g, s, "127637"))
      .filter((r) => r?.exact)
      .map((r) =>
        r!.players
          .map((p) => p.name)
          .sort()
          .join("|"),
      );
    expect(new Set(lists).size).toBeGreaterThan(1);
  });
  it("renders both clubs", async () => {
    const s = await season2026();
    const g = s.games.find((x) => x.phase === "regular" && x.status === "final")!;
    render(<PllGameRosters game={g} season={s} />);
    expect(screen.getAllByText(/players$/).length).toBe(2);
  });
});
