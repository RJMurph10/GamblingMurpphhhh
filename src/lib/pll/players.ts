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
export type PllRoster = { season: number | null; page: string; players: PllRosterPlayer[] };
export type PllLeader = {
  stat: string;
  player: string;
  value: string;
  team: string | null;
  rank: number;
  note?: string;
};
export type PllLeaderGroup = { stat: string; rows: PllLeader[] };

const rosters = data.rosters as Record<string, PllRoster>;
const leaders = data.leaders as Record<string, { page: string; rows: PllLeader[] }>;

/** A club's latest roster on Wikipedia, if it has one. */
export function pllRoster(teamId: string): PllRoster | undefined {
  return rosters[teamId];
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
