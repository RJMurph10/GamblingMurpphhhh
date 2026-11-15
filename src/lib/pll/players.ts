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
  captain?: boolean;
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
