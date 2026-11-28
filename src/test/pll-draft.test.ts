import { describe, expect, it } from "vitest";
import { pllDraftNote, pllDraftOf } from "@/lib/pll/players";

describe("pllDraftOf", () => {
  it("finds a player's draft slot and club", () => {
    const [d] = pllDraftOf("Pat Spencer");
    expect(d).toMatchObject({ season: 2019, round: "1", pick: "1", team: "Archers" });
  });
  it("keeps only the latest pick for a player drafted twice", () => {
    expect(pllDraftOf("Jeff Teat").map((d) => [d.season, d.team])).toEqual([[2021, "Atlas"]]);
  });
  it("treats a transfer picked twice as one player (latest pick)", () => {
    expect(pllDraftOf("Dylan Hess").map((d) => [d.season, d.team])).toEqual([[2025, "Waterdogs"]]);
  });
  it("keeps the latest pick when the college is spelled two ways", () => {
    expect(pllDraftOf("Levi Anderson").map((d) => d.season)).toEqual([2024]);
  });
  it("carries hand-written context for a misleading draft slot", () => {
    expect(pllDraftOf("Jared Bernhardt")[0]).toMatchObject({
      season: 2021,
      pick: "19",
      team: "Chaos",
    });
    expect(pllDraftNote("Jared Bernhardt")).toMatch(/football/);
  });
});
