import data from "@/data/pll-players.json";

/**
 * PLL players from Wikipedia (CC BY-SA 4.0): each club's current roster (team pages) and each season's
 * statistical leaders (season pages, which cite the PLL's stats site). Not game-by-game: no box scores,
 * weekly active lists or reserves. Rebuild with scripts/pll-wiki-players.py.
 */
export type PllRosterPlayer = {
  num: string;
  name: string;
  pos: string;
  shot?: string;
  height?: string;
  weight?: string;
  college?: string;
  hometown?: string;
  /** The college's logo: ESPN's, or a public-domain mark stored in public/logos/colleges. */
  collegeLogo?: string;
  captain?: boolean;
  rookie?: boolean;
  /** Lists the player is on per Wikipedia: "Injured", "PUP", "Holdout", "Unavailable to Travel"... */
  status?: string[];
};
export type PllRoster = {
  season: number;
  page: string;
  /** The Wikipedia revision it came from (a past season's page as it stood then). */
  revid?: number;
  players: PllRosterPlayer[];
};
export type PllLeader = {
  stat: string;
  player: string;
  value: string;
  team: string | null;
  rank: number;
  note?: string;
};
export type PllLeaderGroup = { stat: string; rows: PllLeader[] };

const rosters = data.rosters as Record<string, Record<string, Omit<PllRoster, "season">>>;
const leaders = data.leaders as Record<string, { page: string; rows: PllLeader[] }>;

/** The seasons Wikipedia has a roster for, oldest first. */
export const pllRosterSeasons = (teamId: string): number[] =>
  Object.keys(rosters[teamId] ?? {})
    .map(Number)
    .sort((a, b) => a - b);

/**
 * A club's roster for a season; with no season (or one past the latest Wikipedia has), its latest
 * roster, labelled with the season it is from.
 */
export function pllRoster(teamId: string, season?: number): PllRoster | undefined {
  const years = pllRosterSeasons(teamId);
  if (!years.length) return undefined;
  const latest = years[years.length - 1];
  const y = season == null || season > latest ? latest : season;
  const r = rosters[teamId]?.[String(y)];
  return r ? { season: y, ...r } : undefined;
}

/** Short position: A, M, FO, D, G, LSM, SSDM ("Defense/SSDM" -> "D/SSDM"). */
export function posAbbr(pos: string): string {
  const one = (p: string) => {
    const k = p
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "");
    if (k.startsWith("attack")) return "A";
    if (k.startsWith("mid")) return "M";
    if (k.startsWith("faceoff")) return "FO";
    if (k.startsWith("defen")) return "D";
    if (k.startsWith("goal")) return "G";
    return p.trim().toUpperCase();
  };
  return pos.split("/").map(one).join("/");
}

/** Shooting hand as one letter: the first listed ("R/L" -> "R", "Left" -> "L"). */
export const shotAbbr = (shot?: string) => {
  const c = shot?.trim()[0]?.toUpperCase();
  return c === "L" || c === "R" ? c : "";
};

/** Sort key for positions, the way rosters are read: attack to goalie. */
const POS_ORDER = ["Attack", "Midfield", "Face-off", "Faceoff", "SSDM", "LSM", "Defense", "Goalie"];
export const posRank = (pos: string) => {
  const i = POS_ORDER.findIndex((p) => pos.toLowerCase().startsWith(p.toLowerCase()));
  return i < 0 ? POS_ORDER.length : i;
};

/** A season's statistical leaders by stat, in Wikipedia's order (empty for a season without them). */
export function pllLeaders(season: number, teamId?: string): PllLeaderGroup[] {
  const rows = (leaders[String(season)]?.rows ?? []).filter((r) => !teamId || r.team === teamId);
  const groups: PllLeaderGroup[] = [];
  for (const r of rows) {
    const g = groups.find((x) => x.stat === r.stat);
    if (g) g.rows.push(r);
    else groups.push({ stat: r.stat, rows: [r] });
  }
  return groups;
}

export const pllLeadersPage = (season: number) => leaders[String(season)]?.page;

export type PllAward = { award: string; player: string; team: string | null; pos: string };
const awards =
  (data as { awards?: Record<string, { page: string; rows: PllAward[] }> }).awards ?? {};

/** A season's end-of-year awards (MVP first), from its Wikipedia season page. */
export const pllAwards = (season: number) => awards[String(season)];

type Extra = {
  coaches?: Record<string, Record<string, string[]>>;
  drafts?: Record<string, Record<string, PllDraftPick[]>>;
  champions?: PllChampionship[];
};
const extra = data as unknown as Extra;

export type PllDraftPick = {
  round: string;
  pick: string;
  player: string;
  pos: string;
  college: string;
};
export type PllChampionship = {
  season: number;
  champion: string | null;
  runnerUp: string | null;
  score: [number, number];
  ot: boolean;
  /** Best regular-season record. */
  regularSeasonLeader: string | null;
  /** Championship game MVP. */
  mvp: string | null;
};

/** A club's head coach(es) that season, from its Wikipedia page's coaching history. */
export const pllCoaches = (teamId: string, season: number): string[] =>
  extra.coaches?.[teamId]?.[String(season)] ?? [];

/** A club's college draft picks that year. */
export const pllDraft = (teamId: string, season: number): PllDraftPick[] =>
  extra.drafts?.[teamId]?.[String(season)] ?? [];

export type PllDraftEntry = PllDraftPick & { season: number; teamId: string; team: string };

const draftKey = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, "")
    .replace(/[^a-z]/g, "");

let draftIndex: Map<string, PllDraftEntry[]> | null = null;

/**
 * Where a player was drafted (season, club, round, pick), matched on name. A player picked twice (taken,
 * went back to school or transferred, entered again) gets only his latest pick.
 */
export function pllDraftOf(name: string): PllDraftEntry[] {
  if (!draftIndex) {
    draftIndex = new Map();
    for (const [teamId, years] of Object.entries(extra.drafts ?? {}))
      for (const [y, picks] of Object.entries(years))
        for (const pk of picks) {
          const k = draftKey(pk.player);
          const e = { ...pk, season: Number(y), teamId, team: PLL_CLUB_SHORT[teamId] ?? teamId };
          draftIndex.set(k, [...(draftIndex.get(k) ?? []), e]);
        }
  }
  // picked more than once (went back to school or transferred, entered again): only the latest pick counts
  return (draftIndex.get(draftKey(name)) ?? []).sort((x, y) => x.season - y.season).slice(-1);
}

/**
 * Context for a draft slot that doesn't tell the real story (a pick spent on a player headed elsewhere,
 * who later joined a different club outside the draft). Keyed by player name; written by hand.
 */
const DRAFT_NOTES: Record<string, string> = {
  "Jared Bernhardt":
    "Went 19th only because he was headed to football after college; committed to lacrosse, he'd have been a top pick. Never played for the Chaos. Joined the Outlaws in 2025 outside the draft, in effect a free-agent signing.",
};

export const pllDraftNote = (name: string): string | undefined => DRAFT_NOTES[name];

/** Every championship game, newest first. */
export const pllChampionships = (): PllChampionship[] =>
  [...(extra.champions ?? [])].sort((a, b) => b.season - a.season);

/** Clubs by id, for seasons whose team list isn't loaded (names don't change across eras). */
export const PLL_CLUB_SHORT: Record<string, string> = {
  "127631": "Archers",
  "127632": "Atlas",
  "122997": "Cannons",
  "127634": "Chaos",
  "127635": "Chrome",
  "122896": "Outlaws",
  "127636": "Redwoods",
  "127637": "Waterdogs",
  "127638": "Whipsnakes",
};
