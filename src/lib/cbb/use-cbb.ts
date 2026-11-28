/** Men's college basketball data hooks for the /cbb pages. */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCbbGameDetail, getCbbRankings, getCbbRoster, getCbbSchedule } from "./cbb.functions";
import type { CbbConference, CbbGame, CbbSchedule, CbbTeamRef } from "./cbb";
import { runCbbModel, type CbbModelRow } from "./cbb-model";
import { parseEvent } from "./cbb-parse";

const EMPTY: CbbSchedule = { season: "", games: [], teams: [], conferences: [], updated: null };

/** The season's games, teams and conferences (refreshed every 15 seconds while a game is live). */
export function useCbbSchedule(refetchMs: number | false = 60_000) {
  const query = useQuery({
    queryKey: ["cbb-schedule"],
    queryFn: () => getCbbSchedule(),
    refetchInterval: (q) =>
      refetchMs === false
        ? false
        : (q.state.data as CbbSchedule | undefined)?.games?.some((g) => g.status === "live")
          ? Math.min(refetchMs, 15_000)
          : refetchMs,
    staleTime: 20_000,
    retry: 1,
  });
  const data: CbbSchedule = query.data ?? EMPTY;
  const rankings = useCbbRankings();
  // AP ranks on every game, not just the ESPN scoreboard days
  const games: CbbGame[] = useMemo(() => {
    const r = rankings.data;
    if (!r || !Object.keys(r).length) return data.games;
    return data.games.map((g) =>
      g.status === "final"
        ? g
        : {
            ...g,
            away: { ...g.away, rank: g.away.rank ?? r[g.away.team.id] },
            home: { ...g.home, rank: g.home.rank ?? r[g.home.team.id] },
          },
    );
  }, [data.games, rankings.data]);
  const teams = useMemo(
    () => new Map<string, CbbTeamRef>(data.teams.map((t) => [t.id, t])),
    [data.teams],
  );
  const conferences = useMemo(
    () => new Map<string, CbbConference>(data.conferences.map((c) => [c.id, c])),
    [data.conferences],
  );
  return {
    ...query,
    season: data.season,
    games,
    teams,
    conferences,
    updated: data.updated,
    rankings: rankings.data ?? {},
  };
}

export function useCbbRankings() {
  return useQuery({
    queryKey: ["cbb-rankings"],
    queryFn: () => getCbbRankings(),
    staleTime: 30 * 60_000,
  });
}

/** Model rows for the season (every finished game predicted from earlier games only). */
export function useCbbModel(games: CbbGame[]): CbbModelRow[] {
  return useMemo(() => runCbbModel(games), [games]);
}

/** Box score and play-by-play for one game (refreshed every 15 seconds while it's live). */
export function useCbbGameDetail(gameId: string, live: boolean) {
  return useQuery({
    queryKey: ["cbb-game", gameId],
    queryFn: () => getCbbGameDetail({ data: { gameId } }),
    refetchInterval: live ? 15_000 : false,
    staleTime: 10_000,
    retry: 1,
  });
}

export function useCbbRoster(teamId: string) {
  return useQuery({
    queryKey: ["cbb-roster", teamId],
    queryFn: () => getCbbRoster({ data: { teamId } }),
    staleTime: 60 * 60_000,
    retry: 1,
  });
}

/**
 * Live and upcoming games straight from ESPN in the browser (today through the next week). The dashboard
 * uses this only when the site's server returns no live or upcoming games, so a server that can't reach
 * ESPN's scoreboard doesn't leave the Live and Upcoming panels empty.
 */
export function useCbbBrowserGames(enabled: boolean) {
  return useQuery({
    queryKey: ["cbb-browser-games"],
    enabled,
    staleTime: 15_000,
    refetchInterval: (q) =>
      enabled
        ? (q.state.data as CbbGame[] | undefined)?.some((g) => g.status === "live")
          ? 15_000
          : 60_000
        : false,
    retry: 1,
    queryFn: async () => {
      const pad = (n: number) => String(n).padStart(2, "0");
      const days = Array.from({ length: 8 }, (_, i) => {
        const d = new Date(Date.now() + (i - 1) * 86_400_000);
        return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
      });
      const lists = await Promise.all(
        days.map(async (day) => {
          try {
            const res = await fetch(
              `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${day}&groups=50&limit=1000`,
            );
            if (!res.ok) return [];
            const json = await res.json();
            return (Array.isArray(json?.events) ? json.events : [])
              .map(parseEvent)
              .filter(Boolean) as CbbGame[];
          } catch {
            return [];
          }
        }),
      );
      const byId = new Map<string, CbbGame>();
      for (const g of lists.flat()) byId.set(g.id, g);
      return [...byId.values()].sort((a, b) => a.date.localeCompare(b.date));
    },
  });
}
