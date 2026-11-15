import { describe, expect, it } from "vitest";
import history from "@/data/pll-2019-2021.json";
import {
  pllAwards,
  pllChampionships,
  pllCoaches,
  pllDraft,
  pllLeaders,
  pllRoster,
  pllRosterSeasons,
  posAbbr,
  shotAbbr,
} from "@/lib/pll/players";

const top = (season: number, stat: string) =>
  pllLeaders(season).find((g) => g.stat === stat)?.rows[0];

describe("PLL players from Wikipedia", () => {
  // each checked against an independent source (league awards coverage, USA Lacrosse, StatsCrew)
  it("has the points leaders the league announced", () => {
    expect(top(2019, "Points")).toMatchObject({
      player: "Matt Rambo",
      value: "42",
      team: "127638",
    });
    expect(top(2022, "Points")).toMatchObject({
      player: "Lyle Thompson",
      value: "44",
      team: "122997",
    });
    expect(top(2024, "Points")).toMatchObject({ player: "Jeff Teat", value: "64", team: "127632" });
    expect(top(2025, "Points")).toMatchObject({ player: "Connor Shellenberger", value: "46" });
    expect(top(2026, "Points")).toMatchObject({
      player: "Michael Sowers",
      value: "51",
      team: "127637",
    });
  });
  it("marks records and has no leaders for 2020", () => {
    expect(top(2024, "Points")?.note).toBe("PLL single-season record");
    expect(pllLeaders(2020)).toEqual([]);
  });
  it("filters leaders to one club", () => {
    const atlas = pllLeaders(2024, "127632");
    expect(atlas.length).toBeGreaterThan(0);
    expect(atlas.every((g) => g.rows.every((r) => r.team === "127632"))).toBe(true);
  });
  it("has a roster for every current club", () => {
    for (const id of [
      "127631",
      "127632",
      "122997",
      "127634",
      "122896",
      "127636",
      "127637",
      "127638",
    ])
      expect(pllRoster(id)?.players.length).toBeGreaterThan(20);
    expect(pllRoster("127635")?.season).toBe(2023); // Chrome's last season
  });
});

describe("roster formatting", () => {
  it("abbreviates positions", () => {
    expect(
      ["Attack", "Midfield", "Faceoff", "Face-off", "Defense", "Goalie", "LSM", "SSDM"].map(
        posAbbr,
      ),
    ).toEqual(["A", "M", "FO", "FO", "D", "G", "LSM", "SSDM"]);
    expect(posAbbr("Defense/SSDM")).toBe("D/SSDM");
  });
  it("shows one shooting hand", () => {
    expect(["Right", "Left", "R/L", "L/R", "R", undefined].map(shotAbbr)).toEqual([
      "R",
      "L",
      "R",
      "L",
      "R",
      "",
    ]);
  });
  it("turns Wikipedia's markers into clean names and statuses", () => {
    const all = Object.values(["127631", "127632", "122997", "127634"]).flatMap(
      (id) => pllRoster(id)!.players,
    );
    expect(all.every((p) => !/[*^{|]|px/.test(p.name))).toBe(true);
    expect(all.find((p) => p.name === "Gannon Matthews")?.status).toEqual(["PUP"]);
    expect(all.find((p) => p.name === "Grant Ament")?.status).toEqual(["Injured"]);
    expect(all.find((p) => p.name === "Kieran McArdle")).toBeUndefined(); // Waterdogs, checked below
    expect(pllRoster("127637")!.players.find((p) => p.name === "Kieran McArdle")?.shot).toBe("L/R");
  });
});

describe("college logos", () => {
  it("has a logo for every rostered player's college", () => {
    const ids = ["127631", "127632", "122997", "127634", "122896", "127636", "127637", "127638"];
    const missing = ids
      .flatMap((id) => pllRoster(id)!.players)
      .filter((p) => p.college && !p.collegeLogo)
      .map((p) => p.college);
    expect(missing).toEqual([]);
  });
});

describe("past rosters and awards", () => {
  it("has rosters back to each club's first season", () => {
    expect(pllRosterSeasons("127638")[0]).toBe(2019); // Whipsnakes
    expect(pllRosterSeasons("127637")[0]).toBe(2020); // Waterdogs joined in 2020
    expect(pllRosterSeasons("122997")[0]).toBe(2021); // Cannons joined in 2021
    expect(pllRosterSeasons("127635").at(-1)).toBe(2023); // Chrome ended in 2023
  });
  it("gives the season asked for, and the latest for a newer season", () => {
    expect(pllRoster("127638", 2019)?.season).toBe(2019);
    expect(pllRoster("127638", 2019)?.players.some((p) => p.name === "Matt Rambo")).toBe(true);
    const latest = pllRosterSeasons("127634").at(-1)!;
    expect(pllRoster("127634", latest + 1)?.season).toBe(latest);
  });
  it("has each season's MVP, checked against the league's announcements", () => {
    const mvp = (y: number) =>
      pllAwards(y)?.rows.find((r) => r.award.includes("Most Valuable Player"));
    expect(mvp(2019)).toMatchObject({ player: "Matt Rambo", team: "127638" });
    expect(mvp(2021)).toMatchObject({ player: "Blaze Riorden", team: "127634" });
    expect(mvp(2022)).toMatchObject({ player: "Trevor Baptiste", team: "127632" });
    expect(mvp(2023)).toMatchObject({ player: "Tom Schreiber", team: "127631" });
    expect(mvp(2025)).toMatchObject({ player: "Connor Shellenberger", team: "127632" });
    expect(mvp(2026)).toMatchObject({ player: "CJ Kirst", team: "127637" });
  });
});

describe("league history", () => {
  const champs = pllChampionships();
  it("has every final, matching the game scores on the site", () => {
    expect(champs.map((c) => c.season)).toEqual([2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019]);
    for (const y of [2019, 2020, 2021]) {
      const last = history.games
        .filter((g) => g.season === y)
        .sort((a, b) => a.date.localeCompare(b.date))
        .at(-1)!;
      const c = champs.find((x) => x.season === y)!;
      const winner = last.homeScore > last.awayScore ? last.home : last.away;
      expect(c.champion).toBe(winner);
      expect(c.score).toEqual([
        Math.max(last.homeScore, last.awayScore),
        Math.min(last.homeScore, last.awayScore),
      ]);
      expect(c.ot).toBe(last.ot);
    }
    expect(champs[0]).toMatchObject({ champion: "127637", score: [14, 4], runnerUp: "122896" }); // ESPN's 2026 final
    expect(champs.find((c) => c.season === 2025)).toMatchObject({
      champion: "127632",
      score: [14, 13],
      mvp: "Jeff Teat",
    });
  });
  it("has each club's coaches by season", () => {
    expect(pllCoaches("127635", 2019)).toEqual(["Dom Starsia"]); // Chrome
    expect(pllCoaches("127635", 2022)).toEqual(["Tim Soudan"]);
    expect(pllCoaches("127637", 2023)).toEqual(["Andy Copelan"]);
    expect(pllCoaches("127637", 2024)).toEqual(["Bill Tierney"]);
    expect(pllCoaches("127634", 2025)).toEqual(["Roy Colsey"]);
  });
  it("has college draft classes, not entry or expansion drafts", () => {
    expect(pllDraft("127637", 2025)[0]).toMatchObject({
      round: "1",
      pick: "1",
      player: "CJ Kirst",
    });
    expect(pllDraft("127637", 2020).some((p) => p.player === "Zach Currier")).toBe(false); // 2020 entry draft
    expect(pllDraft("127631", 2019)[0]).toMatchObject({ pick: "1", player: "Pat Spencer" });
  });
});
