/**
 * PLL schedule and scores from ESPN's lacrosse scoreboard. A whole year comes back in one request
 * (`dates=2026`; date ranges are refused). Teams from ESPN's team list, minus the All-Star teams.
 */
import { cached } from "@/lib/shared/espn-core.server";
import history from "@/data/pll-2019-2021.json";
import { tagPhases, type PllGame, type PllPhase, type PllSeason, type PllTeam } from "./pll";

const BASE = "https://site.api.espn.com/apis/site/v2/sports/lacrosse/pll";

async function get<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

type EspnTeam = {
  id: string;
  abbreviation?: string;
  displayName?: string;
  shortDisplayName?: string;
  name?: string;
  location?: string;
  color?: string;
  logos?: { href?: string }[];
  logo?: string;
};
type EspnCompetitor = {
  homeAway?: string;
  score?: string;
  team?: EspnTeam;
  linescores?: { value?: number }[];
  records?: { summary?: string }[];
};
type EspnEvent = {
  id: string;
  date: string;
  status?: { type?: { state?: string; completed?: boolean; shortDetail?: string } };
  competitions?: { competitors?: EspnCompetitor[] }[];
};

const isAllStar = (t?: EspnTeam) => /^(east|west|team\b|all-?star)/i.test(t?.displayName ?? "");

/**
 * Chrome (2019-2023; the franchise became the Denver Outlaws, ESPN id 122896, in 2024). ESPN keeps Chrome's
 * id 127635 but its logo now shows the Outlaws' art, so Chrome uses its own logo (from the PLL's site,
 * stored in public/logos).
 */
const CHROME: PllTeam = {
  id: "127635",
  abbr: "CHR",
  name: "Chrome",
  short: "Chrome",
  location: "",
  color: "#8ad8dc",
  logo: "/logos/pll-chrome.png",
};

const toTeam = (t: EspnTeam): PllTeam =>
  String(t.id) === CHROME.id
    ? CHROME
    : {
        id: String(t.id),
        abbr: t.abbreviation ?? "",
        name: t.displayName ?? t.name ?? "",
        short: t.name ?? t.shortDisplayName ?? t.displayName ?? "",
        location: t.location ?? "",
        color: t.color ? `#${t.color}` : undefined,
        logo: t.logos?.[0]?.href ?? t.logo,
      };

/**
 * ESPN ids for the same club under an older entry: the 2021-2023 Cannons (127633, listed only as "CAN",
 * no logo) are today's Boston Cannons (122997), so the club is one team across every season.
 */
const SAME_CLUB: Record<string, string> = { "127633": "122997" };
const clubId = (t: EspnTeam) => SAME_CLUB[String(t.id)] ?? String(t.id);

async function load(year: number): Promise<PllSeason> {
  const [sb, tl] = await Promise.all([
    get<{ events?: EspnEvent[] }>(`${BASE}/scoreboard?dates=${year}&limit=1000`),
    get<{ sports?: { leagues?: { teams?: { team: EspnTeam }[] }[] }[] }>(`${BASE}/teams`),
  ]);
  const teams = new Map<string, PllTeam>();
  const allStar = new Set<string>();
  for (const { team } of tl?.sports?.[0]?.leagues?.[0]?.teams ?? []) {
    if (isAllStar(team)) allStar.add(String(team.id));
    else teams.set(String(team.id), toTeam(team));
  }
  const raw: Omit<PllGame, "phase">[] = [];
  for (const e of sb?.events ?? []) {
    const cs = e.competitions?.[0]?.competitors ?? [];
    const h = cs.find((c) => c.homeAway === "home");
    const a = cs.find((c) => c.homeAway === "away");
    if (!h?.team || !a?.team) continue;
    for (const c of [h, a]) {
      const id = clubId(c.team!);
      if (isAllStar(c.team)) allStar.add(id);
      else if (!teams.has(id)) teams.set(id, { ...toTeam(c.team!), id });
    }
    const state = e.status?.type?.state;
    const status = e.status?.type?.completed ? "final" : state === "in" ? "live" : "scheduled";
    const side = (c: EspnCompetitor) => ({
      teamId: clubId(c.team!),
      score: status === "scheduled" || c.score == null || c.score === "" ? null : Number(c.score),
      quarters: (c.linescores ?? []).map((l) => Number(l.value ?? 0)),
      record: c.records?.[0]?.summary,
    });
    raw.push({
      id: String(e.id),
      date: e.date,
      status,
      detail: e.status?.type?.shortDetail ?? "",
      season: year,
      home: side(h),
      away: side(a),
    });
  }
  // only clubs that played this year (the team list keeps defunct and future clubs)
  const played = new Set(raw.flatMap((g) => [g.home.teamId, g.away.teamId]));
  return {
    season: year,
    teams: [...teams.values()]
      .filter((t) => played.has(t.id))
      .sort((x, y) => x.name.localeCompare(y.name)),
    games: tagPhases(raw, allStar),
  };
}

/** Clubs from 2019-2021 that ESPN no longer lists, and the All-Star teams of those years. */
const OLD_TEAMS: PllTeam[] = [
  CHROME,
  { id: "as-baptiste", abbr: "BAP", name: "Team Baptiste", short: "Team Baptiste", location: "" },
  { id: "as-rambo", abbr: "RAM", name: "Team Rambo", short: "Team Rambo", location: "" },
  { id: "as-adversaries", abbr: "ADV", name: "Adversaries", short: "Adversaries", location: "" },
  { id: "as-defenders", abbr: "DEF", name: "Defenders", short: "Defenders", location: "" },
];

/**
 * 2019-2021 (before ESPN's PLL coverage): final scores, overtime, venue and city from Wikipedia's season
 * pages (src/data/pll-2019-2021.json, CC BY-SA 4.0); no quarter scores. Clubs take ESPN's current names
 * and logos (the same franchises), plus Chrome and the All-Star teams.
 */
async function loadHistory(year: number): Promise<PllSeason> {
  const tl = await get<{ sports?: { leagues?: { teams?: { team: EspnTeam }[] }[] }[] }>(
    `${BASE}/teams`,
  );
  const known = new Map<string, PllTeam>(OLD_TEAMS.map((t) => [t.id, t]));
  for (const { team } of tl?.sports?.[0]?.leagues?.[0]?.teams ?? [])
    known.set(String(team.id), toTeam(team));
  type Row = (typeof history.games)[number];
  const rows = history.games.filter((g: Row) => g.season === year);
  const games: PllGame[] = rows.map((g: Row) => ({
    id: g.id,
    date: g.date,
    status: "final",
    detail: g.ot ? "Final/OT" : "Final",
    phase: g.phase as PllPhase,
    season: year,
    home: { teamId: g.home, score: g.homeScore, quarters: [] },
    away: { teamId: g.away, score: g.awayScore, quarters: [] },
    ...(g.venue ? { venue: g.venue } : {}),
    ...(g.city ? { city: g.city } : {}),
  }));
  const ids = new Set(games.flatMap((g) => [g.home.teamId, g.away.teamId]));
  const teams = [...ids]
    .map((id) => known.get(id) ?? { id, abbr: id, name: id, short: id, location: "" })
    .filter((t) => !t.id.startsWith("as-"))
    .sort((a, b) => a.name.localeCompare(b.name));
  // All-Star teams stay out of the team list but need names on their game
  return {
    season: year,
    teams: [...teams, ...OLD_TEAMS.filter((t) => t.id.startsWith("as-") && ids.has(t.id))],
    games,
  };
}

/** One PLL year's games and teams. Refreshed every minute while a game is on, else every 30 minutes. */
/**
 * Logos by era. The clubs used their original "Lacrosse Club" logos through 2023; the league moved to
 * city/state names and new logos in 2024 (ESPN only has the current ones). The Whipsnakes' 2024-2025
 * logo had gold trim; ESPN's current one has teal. From the PLL's site and TheSportsDB, stored in
 * public/logos.
 */
const ERA_LOGOS: Record<string, [from: number, to: number, logo: string][]> = {
  "127631": [[2019, 2023, "/logos/pll-archers-original.png"]],
  "127632": [[2019, 2023, "/logos/pll-atlas-original.png"]],
  "127634": [[2019, 2023, "/logos/pll-chaos-original.png"]],
  "127636": [[2019, 2023, "/logos/pll-redwoods-original.png"]],
  "127637": [[2019, 2023, "/logos/pll-waterdogs-original.png"]],
  "127638": [
    [2019, 2023, "/logos/pll-whipsnakes-original.png"],
    [2024, 2025, "/logos/pll-whipsnakes-2024.png"],
  ],
  "122997": [[2019, 2023, "/logos/pll-cannons-original.png"]],
};

/**
 * A season's clubs as they were that year: the logo they used, and before 2024 (when the league gave
 * clubs cities or states) just the club name: "Archers", not "Utah Archers".
 */
export function withEraLogos(s: PllSeason): PllSeason {
  const y = s.season;
  return {
    ...s,
    teams: s.teams.map((t) => {
      const logo = ERA_LOGOS[t.id]?.find(([from, to]) => y >= from && y <= to)?.[2];
      const club = y <= 2023 && !t.id.startsWith("as-") && t.location;
      return {
        ...t,
        ...(logo ? { logo } : {}),
        ...(club ? { name: t.short, location: "" } : {}),
      };
    }),
  };
}

export async function fetchPllSeason(year: number): Promise<PllSeason> {
  const key = `pll-season-${year}`;
  if (year <= 2021)
    return withEraLogos(await cached(key, () => loadHistory(year), 24 * 60 * 60_000));
  const s = await cached(key, () => load(year), 30 * 60_000);
  if (s.games.some((g) => g.status === "live"))
    return withEraLogos(await cached(`${key}-live`, () => load(year), 60_000));
  return withEraLogos(s);
}
