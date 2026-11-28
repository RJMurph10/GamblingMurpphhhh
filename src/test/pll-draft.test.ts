import { describe, expect, it } from "vitest";
import { pllDraftOf } from "@/lib/pll/players";

describe("pllDraftOf", () => {
  it("finds a player's draft slot and club", () => {
    const [d] = pllDraftOf("Pat Spencer");
    expect(d).toMatchObject({ season: 2019, round: "1", pick: "1", team: "Archers" });
  });
  it("keeps only the latest pick for a player drafted twice", () => {
    expect(pllDraftOf("Jeff Teat").map((d) => [d.season, d.team])).toEqual([[2021, "Atlas"]]);
  });
  it("tells same-named players apart by college, and guesses nothing without one", () => {
    expect(pllDraftOf("Dylan Hess", "Georgetown").map((d) => d.team)).toEqual(["Chaos"]);
    expect(pllDraftOf("Dylan Hess")).toEqual([]);
  });
  it("matches Saint/St spellings as one college", () => {
    expect(pllDraftOf("Levi Anderson").map((d) => d.season)).toEqual([2024]);
  });
});
