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
