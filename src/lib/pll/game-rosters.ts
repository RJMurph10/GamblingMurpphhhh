import data from "@/data/pll-game-rosters.json";
import type { PllGame, PllSeason } from "./pll";

/**
 * PLL game-day rosters (2026), from the Lacrosse API's player box scores: everyone with a box-score line
 * dressed that week (scripts/lacrosse/laxapi-rosters.mjs). The feed's box scores from early August on
 * list only a few players, so for those a club's last complete game-day roster stands in, labelled with
 * the game it's from.
 */
export interface PllRosterLine {
  name: string;
  num: number | null;
  pos: string;
  college: string | null;
}
interface SavedGame {
  date: string;
  clubs: string[];
  rosters: Record<string, { complete: boolean; players: PllRosterLine[] }>;
}
export interface PllGameRoster {
  players: PllRosterLine[];
  /** The players are from this game's own box score. */
  exact: boolean;
  /** When standing in: the date of the game the roster is from. */
  from?: string;
}

const games = (data as unknown as { games: SavedGame[] }).games;
const DAY = 24 * 3_600_000;

/** A club's roster for a game: its own game-day list, else its last complete one before the game. */
export function gameRoster(game: PllGame, season: PllSeason | undefined, teamId: string) {
  const club = season?.teams.find((t) => t.id === teamId)?.short;
  if (!club) return undefined;
  const t = new Date(game.date).getTime();
  const near = games
    .filter((g) => g.clubs.includes(club) && Math.abs(new Date(g.date).getTime() - t) <= 1.5 * DAY)
    .sort(
      (a, b) => Math.abs(new Date(a.date).getTime() - t) - Math.abs(new Date(b.date).getTime() - t),
    )[0];
  const own = near?.rosters[club];
  if (own?.complete) return { players: own.players, exact: true } satisfies PllGameRoster;
  // stand-in: the club's latest complete roster up to this game (else its nearest one)
  const complete = games.filter((g) => g.rosters[club]?.complete);
  const before = complete.filter((g) => new Date(g.date).getTime() < t - DAY / 2).at(-1);
  const stand = before ?? complete[0];
  if (!stand)
    return own ? ({ players: own.players, exact: true } satisfies PllGameRoster) : undefined;
  return {
    players: stand.rosters[club].players,
    exact: false,
    from: stand.date,
  } satisfies PllGameRoster;
}
