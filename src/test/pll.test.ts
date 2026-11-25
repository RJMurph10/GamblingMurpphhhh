import { existsSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/pll-2026.json";
import { fetchPllSeason } from "@/lib/pll/pll.server";
import { pulse, standings } from "@/lib/pll/pll";

afterEach(() => vi.unstubAllGlobals());

describe("PLL from ESPN", () => {
  it("builds the 2026 season: phases, standings, numbers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => (String(url).includes("/teams") ? fixture.teams : fixture.scoreboard),
      })),
    );
    const s = await fetchPllSeason(2026);
    expect(s.teams).toHaveLength(8);
    expect(s.teams.some((t) => /east|west|team /i.test(t.name))).toBe(false);
    const by = (p: string) => s.games.filter((g) => g.phase === p).length;
    expect(by("regular")).toBe(48); // 2026: 12 games a team
    expect(by("champ")).toBe(8); // February / March Championship Series
    expect(by("playoffs")).toBe(5);
    expect(by("allstar")).toBe(2);
    const table = standings(s);
    expect(table).toHaveLength(8);
    expect(table.reduce((n, r) => n + r.w, 0)).toBe(48);
    // the final: Waterdogs 14, Outlaws 4 on Sep 20
    const final = s.games[s.games.length - 1];
    expect(final.phase).toBe("playoffs");
    expect(final.home.score).toBe(14);
    expect(final.home.quarters).toEqual([7, 3, 1, 3]);
    const p = pulse(s.games.filter((g) => g.phase === "regular"));
    expect(p.games).toBe(48);
    expect(p.goalsPerGame).toBeGreaterThan(15);
  });
});

import history from "@/data/pll-2019-2021.json";

describe("PLL 2019-2021 history (Wikipedia)", () => {
  const season = (y: number) => history.games.filter((g) => g.season === y);
  const wins = (y: number) => {
    const w: Record<string, number> = {};
    for (const g of season(y).filter((g) => g.phase === "regular"))
      w[g.homeScore > g.awayScore ? g.home : g.away] =
        (w[g.homeScore > g.awayScore ? g.home : g.away] ?? 0) + 1;
    return w;
  };
  it("has every season's games", () => {
    expect(season(2019)).toHaveLength(37);
    expect(season(2020)).toHaveLength(20);
    expect(season(2021)).toHaveLength(43);
  });
  it("matches the published standings", () => {
    expect(wins(2019)).toMatchObject({ "127634": 7, "127638": 6, "127635": 2 }); // Chaos 7-3, Whipsnakes 6-4
    expect(wins(2021)).toMatchObject({ "127637": 6, "127632": 6, "127635": 2 }); // Waterdogs, Atlas 6-3
  });
  it("has the champions", () => {
    const last = (y: number) =>
      season(y)
        .sort((a, b) => a.date.localeCompare(b.date))
        .at(-1)!;
    const winner = (g: (typeof history.games)[number]) =>
      g.homeScore > g.awayScore ? g.home : g.away;
    expect(winner(last(2019))).toBe("127638"); // Whipsnakes
    expect(last(2019).ot).toBe(true);
    expect(winner(last(2020))).toBe("127638"); // Whipsnakes
    expect(winner(last(2021))).toBe("127634"); // Chaos
  });
});

import { pllTeamSeasons } from "@/lib/pll/use-pll";

describe("pllTeamSeasons", () => {
  it("offers only the seasons a club played", () => {
    expect(pllTeamSeasons("127635")).toEqual([2019, 2020, 2021, 2022, 2023]); // Chrome
    expect(pllTeamSeasons("127637")[0]).toBe(2020); // Waterdogs
    expect(pllTeamSeasons("122997")[0]).toBe(2021); // Cannons
    expect(pllTeamSeasons("122896")[0]).toBe(2024); // Outlaws
    expect(pllTeamSeasons("127631")[0]).toBe(2019); // Archers
  });
});

import { withEraLogos } from "@/lib/pll/pll.server";

describe("withEraLogos", () => {
  const team = (id: string) => ({
    id,
    abbr: "",
    name: id === "127631" ? "Utah Archers" : "Denver Outlaws",
    short: id === "127631" ? "Archers" : "Outlaws",
    location: id === "127631" ? "Utah" : "Denver",
    logo: `espn/${id}`,
  });
  const season = (y: number) => ({ season: y, teams: [team("127631"), team("122896")], games: [] });
  it("uses the original club logos through 2023 and ESPN's after", () => {
    expect(withEraLogos(season(2023)).teams[0].logo).toBe("/logos/pll-archers-original.png");
    expect(withEraLogos(season(2023)).teams[1].logo).toBe("espn/122896");
    expect(withEraLogos(season(2024)).teams[0].logo).toBe("espn/127631");
  });
  it("uses the app icons in 2019-2021, including Chrome's, the Waterdogs' and the Cannons'", () => {
    expect(withEraLogos(season(2019)).teams[0].logo).toBe("/logos/pll-archers-app.png");
    expect(withEraLogos(season(2021)).teams[0].logo).toBe("/logos/pll-archers-app.png");
    expect(withEraLogos(season(2022)).teams[0].logo).toBe("/logos/pll-archers-original.png");
    const chrome = (y: number) =>
      withEraLogos({ season: y, teams: [{ ...team("127635"), id: "127635", logo: "/logos/pll-chrome.png" }], games: [] })
        .teams[0].logo;
    expect(chrome(2019)).toBe("/logos/pll-chrome-app.png");
    expect(chrome(2021)).toBe("/logos/pll-chrome-app.png");
    expect(chrome(2022)).toBe("/logos/pll-chrome.png");
    for (const n of ["archers", "atlas", "cannons", "chaos", "chrome", "redwoods", "whipsnakes", "waterdogs"])
      expect(existsSync(`public/logos/pll-${n}-app.png`), n).toBe(true);
  });
  it("drops the city before 2024", () => {
    expect(withEraLogos(season(2023)).teams[0].name).toBe("Archers Lacrosse Club");
    expect(withEraLogos(season(2023)).teams[0].location).toBe("");
    expect(withEraLogos(season(2024)).teams[0].name).toBe("Utah Archers");
  });
  it("uses the Whipsnakes' gold-trim logo in 2024-2025", () => {
    const whip = (y: number) =>
      withEraLogos({ season: y, teams: [{ ...team("127638"), id: "127638" }], games: [] }).teams[0]
        .logo;
    expect(whip(2025)).toBe("/logos/pll-whipsnakes-2024.png");
    expect(whip(2026)).toBe("espn/127638");
  });
});

import { conferenceOf, conferenceRecords } from "@/lib/pll/pll";

describe("PLL conferences", () => {
  it("East and West from 2024 only", () => {
    expect(conferenceOf("127632", 2024)).toBe("East"); // Atlas
    expect(conferenceOf("127634", 2026)).toBe("West"); // Chaos
    expect(conferenceOf("127632", 2023)).toBeUndefined();
  });
  it("counts conference games in 2026", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => (String(url).includes("/teams") ? fixture.teams : fixture.scoreboard),
      })),
    );
    const s = await fetchPllSeason(2026);
    const r = conferenceRecords(s);
    expect(r.size).toBe(8);
    // every conference game has one winner and one loser
    const all = [...r.values()];
    expect(all.reduce((n, x) => n + x.w, 0)).toBe(all.reduce((n, x) => n + x.l, 0));
    // in-conference opponents twice: 3 opponents x 2 = 6 games each
    for (const x of all) expect(x.w + x.l).toBe(6);
  });
});

describe("games ESPN never recorded", () => {
  it("leaves out a game still 'scheduled' days after its start", async () => {
    const past = structuredClone(fixture.scoreboard) as typeof fixture.scoreboard;
    const e = structuredClone(past.events[0]);
    e.id = "stale1";
    e.date = "2024-02-14T22:30Z";
    (e.status as { type: Record<string, unknown> }).type = {
      name: "STATUS_SCHEDULED",
      state: "pre",
      completed: false,
      shortDetail: "2/14 - 5:30 PM EST",
    };
    past.events.push(e);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => (String(url).includes("/teams") ? fixture.teams : past),
      })),
    );
    const s = await fetchPllSeason(2099);
    expect(s.games.some((g) => g.id === "stale1")).toBe(false);
    expect(s.games.filter((g) => g.status === "scheduled")).toEqual([]);
  });
});

describe("PLL when ESPN doesn't answer", () => {
  const down = () =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })),
    );
  const up = () =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => (String(url).includes("/teams") ? fixture.teams : fixture.scoreboard),
      })),
    );
  it("doesn't cache an empty season: the next request asks ESPN again", async () => {
    down();
    await expect(fetchPllSeason(2031)).rejects.toThrow();
    up();
    const s = await fetchPllSeason(2031);
    expect(s.games.length).toBeGreaterThan(0);
  });
  it("keeps the last good season when ESPN fails later", async () => {
    up();
    const good = await fetchPllSeason(2032);
    const { clearCached } = await import("@/lib/shared/espn-core.server");
    clearCached("pll-season-2032");
    down();
    const s = await fetchPllSeason(2032);
    expect(s.games).toHaveLength(good.games.length);
  });
  it("names 2019-2021 clubs without ESPN's team list (never ESPN ids)", async () => {
    down();
    const s = await fetchPllSeason(2020);
    expect(s.teams.length).toBeGreaterThan(0);
    for (const t of s.teams) expect(t.name).not.toMatch(/^\d+$/);
    expect(s.teams.map((t) => t.short)).toContain("Whipsnakes");
  });
  it("sends a User-Agent to ESPN", async () => {
    const f = vi.fn(async (url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => (String(url).includes("/teams") ? fixture.teams : fixture.scoreboard),
    }));
    vi.stubGlobal("fetch", f);
    await fetchPllSeason(2033);
    expect((f.mock.calls[0][1]?.headers as Record<string, string>)["User-Agent"]).toBeTruthy();
  });
});
