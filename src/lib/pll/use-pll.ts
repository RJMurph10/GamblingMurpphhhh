import { useQuery } from "@tanstack/react-query";
import { getPllSeason } from "./pll.functions";

/** The PLL year shown by default: this year once its games start (February), else last year. */
export function currentPllSeason(now = new Date()): number {
  return now.getUTCMonth() >= 1 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

/** Every PLL season: 2019-2021 from Wikipedia, 2022 on from ESPN. */
export const PLL_SEASONS = Array.from({ length: currentPllSeason() - 2018 }, (_, i) => 2019 + i);

export const usePllSeason = (season: number) =>
  useQuery({
    queryKey: ["pll-season", season],
    queryFn: () => getPllSeason({ data: { season } }),
    staleTime: 5 * 60_000,
    refetchInterval: (q) => (q.state.data?.games.some((g) => g.status === "live") ? 60_000 : false),
    retry: 1,
  });

/**
 * The seasons each club played, by ESPN id: Waterdogs joined in 2020, Cannons in 2021, Chrome played
 * 2019-2023 and became the Denver Outlaws in 2024. Clubs not listed played every season since 2019.
 */
const CLUB_YEARS: Record<string, [number, number?]> = {
  "127637": [2020], // Waterdogs
  "122997": [2021], // Cannons
  "127635": [2019, 2023], // Chrome
  "122896": [2024], // Denver Outlaws
};

/** The seasons a club played (all seasons for one we don't know). */
export function pllTeamSeasons(teamId: string): number[] {
  const [from, to] = CLUB_YEARS[teamId] ?? [2019];
  return PLL_SEASONS.filter((s) => s >= from && (to == null || s <= to));
}
