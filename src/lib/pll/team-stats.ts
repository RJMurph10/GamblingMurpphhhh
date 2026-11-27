/**
 * PLL team game stats from the owner's copies of the PLL game page's team-stats tab (built by
 * scripts/lacrosse/pll-team-stats.py into src/data/pll-team-stats-<season>.json). These are the PLL's own
 * team totals, including what no player gets credit for (team turnovers, passes, touches, caused
 * turnovers), so they can run above the sum of the player box scores.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PLL_CLUB_IDS } from "./player-stats";
import type { PllGame } from "./pll";

export type PllTeamStatKind = "n" | "pct" | "of";
export type PllTeamStatValue = number | [number, number] | null;
/** [key, PLL label, section, kind] */
export type PllTeamStatField = [string, string, string, PllTeamStatKind];

export type PllTeamStatsFile = {
  season: number;
  fields: PllTeamStatField[];
  games: {
    date: string;
    home: string;
    away: string;
    file: string;
    /** [home, away] per field, home = the club the PLL lists first */
    stats: [PllTeamStatValue, PllTeamStatValue][];
  }[];
};

export type PllTeamStatRow = {
  key: string;
  label: string;
  section: string;
  kind: PllTeamStatKind;
  home: PllTeamStatValue;
  away: PllTeamStatValue;
};

/** Seasons with team stats. Loaded only when a game page asks for them. */
const FILES: Record<number, () => Promise<{ default: unknown }>> = {
  2026: () => import("@/data/pll-team-stats-2026.json"),
};

export const pllHasTeamStats = (season: number) => season in FILES;

export async function loadPllTeamStats(season: number): Promise<PllTeamStatsFile | null> {
  const f = FILES[season];
  return f ? ((await f()).default as PllTeamStatsFile) : null;
}

/**
 * One game's team stats, matched by its two clubs and a date within a day and a half (the sheets carry the
 * local date, ESPN the UTC start), oriented to the game's own home and away.
 */
export function teamStatsForGame(
  file: PllTeamStatsFile | null,
  game: PllGame,
): PllTeamStatRow[] | null {
  if (!file) return null;
  const t = new Date(game.date).getTime();
  const g = file.games.find((x) => {
    const ids = [PLL_CLUB_IDS[x.home], PLL_CLUB_IDS[x.away]];
    return (
      ids.includes(game.home.teamId) &&
      ids.includes(game.away.teamId) &&
      Math.abs(new Date(`${x.date}T12:00:00Z`).getTime() - t) <= 1.5 * 86_400_000
    );
  });
  if (!g) return null;
  const flipped = PLL_CLUB_IDS[g.home] !== game.home.teamId;
  return file.fields.map(([key, label, section, kind], i) => {
    const [h, a] = g.stats[i] ?? [null, null];
    return { key, label, section, kind, home: flipped ? a : h, away: flipped ? h : a };
  });
}

/** The game's team stats once loaded: null while loading, for unfinished games and games without a sheet. */
export function usePllTeamStats(game: PllGame | undefined): PllTeamStatRow[] | null {
  const enabled = Boolean(game && game.status === "final" && pllHasTeamStats(game.season));
  const q = useQuery({
    queryKey: ["pll-team-stats", game?.season],
    queryFn: () => loadPllTeamStats(game!.season),
    enabled,
    staleTime: Infinity,
  });
  return useMemo(
    () => (enabled && q.data && game ? teamStatsForGame(q.data, game) : null),
    [enabled, q.data, game],
  );
}
