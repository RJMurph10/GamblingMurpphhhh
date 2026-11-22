import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PllGame } from "./pll";
import { loadPllPbp, pbpForGame, pllHasPbp, type PllPlay } from "./play-by-play";

/** The game's play-by-play once loaded: null while loading, for unfinished games and games without a sheet. */
export function usePllPlays(game: PllGame | undefined): PllPlay[] | null {
  const enabled = Boolean(game && game.status === "final" && pllHasPbp(game.season));
  const q = useQuery({
    queryKey: ["pll-pbp", game?.season],
    queryFn: () => loadPllPbp(game!.season),
    enabled,
    staleTime: Infinity,
  });
  return useMemo(
    () => (enabled && q.data && game ? pbpForGame(q.data, game) : null),
    [enabled, q.data, game],
  );
}
