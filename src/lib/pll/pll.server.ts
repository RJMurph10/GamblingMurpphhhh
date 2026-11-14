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

const toTeam = (t: EspnTeam): PllTeam => ({
  id: String(t.id),
  abbr: t.abbreviation ?? "",
  name: t.displayName ?? t.name ?? "",
  short: t.name ?? t.shortDisplayName ?? t.displayName ?? "",
  location: t.location ?? "",
  color: t.color ? `#${t.color}` : undefined,
  logo: t.logos?.[0]?.href ?? t.logo,
});

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
      const id = String(c.team!.id);
      if (isAllStar(c.team)) allStar.add(id);
      else if (!teams.has(id)) teams.set(id, toTeam(c.team!));
    }
    const state = e.status?.type?.state;
    const status = e.status?.type?.completed ? "final" : state === "in" ? "live" : "scheduled";
    const side = (c: EspnCompetitor) => ({
      teamId: String(c.team!.id),
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
  {
    id: "127635",
    abbr: "CHR",
    name: "Chrome Lacrosse Club",
    short: "Chrome",
    location: "",
    // ESPN's logo for this id is now the Denver Outlaws' (Chrome's franchise moved there in 2024), and no
    // source we can use keeps Chrome's own logo, so Chrome shows its CHR badge
  },
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
export async function fetchPllSeason(year: number): Promise<PllSeason> {
  const key = `pll-season-${year}`;
  if (year <= 2021) return cached(key, () => loadHistory(year), 24 * 60 * 60_000);
  const s = await cached(key, () => load(year), 30 * 60_000);
  if (s.games.some((g) => g.status === "live"))
    return cached(`${key}-live`, () => load(year), 60_000);
  return s;
}
