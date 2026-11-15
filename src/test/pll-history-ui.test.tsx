import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import fixture from "./fixtures/pll-2026.json";
import { fetchPllSeason } from "@/lib/pll/pll.server";
import { PllDraftClass, PllTeamTrends, PllTotals } from "@/components/pll/PllHistory";
import { teamTrends } from "@/lib/pll/trends";

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

describe("PLL trends on the real 2026 season", () => {
  it("adds up for the champion Waterdogs", async () => {
    const s = await season2026();
    const t = teamTrends(s.games, "127637");
    // 10 regular-season games plus playoffs; every 2026 game has quarter scores
    expect(t.games).toBeGreaterThanOrEqual(12);
    expect(t.withQuarters).toBe(t.games);
    const decided = (r: { w: number; l: number }) => r.w + r.l;
    expect(decided(t.ledAtHalf) + decided(t.trailedAtHalf)).toBeLessThanOrEqual(t.games);
    expect(t.firstHalf!.for + t.secondHalf!.for).toBeGreaterThan(5);
  });
  it("renders the panels", async () => {
    const s = await season2026();
    render(<PllTeamTrends games={s.games} teamId="127637" />);
    expect(screen.getByText("Scoring by quarter")).toBeTruthy();
    expect(screen.getByText("Led at half")).toBeTruthy();
    render(<PllTotals games={s.games} />);
    expect(screen.getByText("Avg total")).toBeTruthy();
    render(<PllDraftClass teamId="127637" season={2025} />);
    expect(screen.getByText("CJ Kirst")).toBeTruthy();
  });
});
