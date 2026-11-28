import { useQuery } from "@tanstack/react-query";
import { getNllGameMedia, getNllLines, getNllNews, getNllSeason } from "./nll.functions";
import { nllSeasonOf } from "./nll";

/** Seasons offered in the pickers (start years): ESPN has NLL games from 2024-25 (none for 2023-24). */
export const NLL_SEASONS = Array.from({ length: nllSeasonOf() - 2023 }, (_, i) => 2024 + i);

export const useNllSeason = (season: number) =>
  useQuery({
    queryKey: ["nll-season", season],
    queryFn: () => getNllSeason({ data: { season } }),
    staleTime: 5 * 60_000,
    refetchInterval: (q) =>
      q.state.data?.games.some((g) => g.status === "live") ? 60_000 : 10 * 60_000,
    retry: 1,
  });

export const useNllLines = (season: number) =>
  useQuery({
    queryKey: ["nll-lines", season],
    queryFn: () => getNllLines({ data: { season } }),
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: 1,
  });

export const useNllNews = () =>
  useQuery({
    queryKey: ["nll-news"],
    queryFn: () => getNllNews(),
    staleTime: 15 * 60_000,
    retry: 1,
  });

export const useNllGameMedia = (gameId: string, enabled: boolean) =>
  useQuery({
    queryKey: ["nll-media", gameId],
    queryFn: () => getNllGameMedia({ data: { gameId } }),
    staleTime: 10 * 60_000,
    enabled,
    retry: 1,
  });
