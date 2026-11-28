import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, PanelHeader } from "@/components/shared/booth";
import { NllLogo, NllSourceNote } from "@/components/nll/NllBits";
import { NllBookLines } from "@/components/nll/NllBookLines";
import { getNllSeason } from "@/lib/nll/nll.functions";
import {
  american,
  lineResult,
  nllSeasonLabel,
  primaryLine,
  signed,
  snapshotsFor,
  teamOf,
  type NllGame,
  type NllSide,
} from "@/lib/nll/nll";
import { NLL_SEASONS, useNllGameMedia, useNllLines } from "@/lib/nll/use-nll";
import { NllHighlights, NllNewsPanel } from "@/components/nll/NllMedia";

export const Route = createFileRoute("/nll/games/$gameId")({
  head: () => ({ meta: [{ title: "Game — GamblingNLL" }] }),
  component: NllGamePage,
});

/** Finds the game in the seasons on offer, newest first. */
function useGame(id: string) {
  const seasons = [...NLL_SEASONS].reverse();
  const qs = useQueries({
    queries: seasons.map((season) => ({
      queryKey: ["nll-season", season],
      queryFn: () => getNllSeason({ data: { season } }),
      staleTime: 5 * 60_000,
      // a live game refreshes every 15 s
      refetchInterval: (q: { state: { data?: { games: NllGame[] } } }) =>
        q.state.data?.games.some((g) => g.id === id && g.status === "live") ? 15_000 : false,
    })),
  });
  return useMemo(() => {
    for (const q of qs) {
      const g = q.data?.games.find((x) => x.id === id);
      if (g) return { game: g, season: q.data, loading: false };
    }
    return {
      game: undefined as NllGame | undefined,
      season: undefined,
      loading: qs.some((q) => q.isLoading),
    };
  }, [qs, id]);
}

function NllGamePage() {
  const { gameId } = Route.useParams();
  const { game, season, loading } = useGame(gameId);
  const linesQ = useNllLines(season?.season ?? NLL_SEASONS[NLL_SEASONS.length - 1]);
  const media = useNllGameMedia(gameId, Boolean(game));
  if (!game || !season)
    return (
      <Panel>
        <p className="py-8 text-center font-mono text-xs text-mute">
          {loading ? "Loading game…" : "Game not found."}
        </p>
      </Panel>
    );
  const away = teamOf(season, game.away.teamId);
  const home = teamOf(season, game.home.teamId);
  const started = game.status !== "scheduled";
  const isFinal = game.status === "final";
  const snaps = snapshotsFor(game, season, linesQ.data);
  const line = primaryLine(snaps);
  const res = line ? lineResult(game, line) : null;
  const fav = line?.spread == null ? undefined : line.spread <= 0 ? home : away;
  const club = (side: NllSide) => (
    <Link
      to="/nll/teams/$teamId"
      params={{ teamId: side.teamId }}
      className="group flex flex-col items-center gap-1 text-center"
    >
      <NllLogo
        team={teamOf(season, side.teamId)}
        className="size-10 transition-transform group-hover:scale-105 sm:size-14"
      />
      <span className="font-mono text-xs text-mute group-hover:text-acc">
        {teamOf(season, side.teamId)?.abbr}
        {side.record ? ` · ${side.record}` : ""}
      </span>
    </Link>
  );
  const score = (n: number | null, won: boolean) => (
    <span
      className={`font-mono text-3xl font-bold tabular-nums sm:text-5xl ${won ? "text-acc" : ""}`}
    >
      {started ? (n ?? "") : ""}
    </span>
  );
  const awayWon = isFinal && (game.away.score ?? 0) > (game.home.score ?? 0);
  const homeWon = isFinal && (game.home.score ?? 0) > (game.away.score ?? 0);
  const nq = Math.max(4, game.home.quarters?.length ?? 0, game.away.quarters?.length ?? 0);
  const cols = Array.from({ length: nq }, (_, i) =>
    i < 4 ? `Q${i + 1}` : nq > 5 ? `OT${i - 3}` : "OT",
  );
  return (
    <div className="space-y-6">
      <Panel className="p-4 sm:p-6">
        <div className="mb-3 text-center font-mono text-[10px] uppercase tracking-wider text-faint">
          {game.phase === "playoffs" ? "Playoffs" : "Regular season"} ·{" "}
          {nllSeasonLabel(season.season)}
        </div>
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-6">
            {club(game.away)}
            {score(game.away.score, awayWon)}
          </div>
          <div className="flex flex-col items-center justify-center px-2 text-center">
            {game.status === "live" ? (
              <span className="flex items-center gap-1.5 font-mono text-xs font-semibold tracking-wider text-win sm:text-sm">
                <span className="size-2 animate-pulse rounded-full bg-win" />
                {game.detail || "Live"}
              </span>
            ) : (
              <span
                className={`font-disp font-bold tracking-wider ${isFinal ? "text-lg text-acc sm:text-xl" : "text-base text-mute sm:text-lg"}`}
              >
                {isFinal ? (game.ot ? "FINAL/OT" : "FINAL") : "VS"}
              </span>
            )}
            <span className="font-mono text-[11px] text-mute" suppressHydrationWarning>
              {new Date(game.date).toLocaleString([], {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            {game.broadcast ? (
              <span className="font-mono text-[10px] text-acc">📺 {game.broadcast}</span>
            ) : null}
            {game.venue ? (
              <span
                className="mt-0.5 max-w-[12rem] truncate font-mono text-[10px] text-faint"
                title={[game.venue, game.city].filter(Boolean).join(", ")}
              >
                {game.venue}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            {score(game.home.score, homeWon)}
            {club(game.home)}
          </div>
        </div>
        {line ? (
          <div className="mt-4 flex justify-center gap-6 font-mono text-xs">
            <span
              className={
                res?.cover && res.cover !== "push"
                  ? (res.cover === "home") === (line.spread ?? 0) <= 0
                    ? "text-win"
                    : "text-loss"
                  : "text-mute"
              }
            >
              Spread{" "}
              {line.spread == null ? (
                "split"
              ) : (
                <span className="inline-flex items-center gap-1 align-middle">
                  <NllLogo team={fav} className="size-4" />
                  {signed(-Math.abs(line.spread))}
                </span>
              )}
            </span>
            {line.total != null ? (
              <span
                className={
                  res?.ou === "over" ? "text-win" : res?.ou === "under" ? "text-loss" : "text-mute"
                }
              >
                O/U {line.total}
              </span>
            ) : null}
            <span className="text-faint">
              median of {line.books} book{line.books === 1 ? "" : "s"}
            </span>
          </div>
        ) : null}
      </Panel>

      {started && (game.home.quarters?.length || game.away.quarters?.length) ? (
        <Panel padded={false}>
          <PanelHeader title="Goals by quarter" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-wider text-faint">
                  <th className="px-4 py-2 text-left font-normal">Team</th>
                  {cols.map((c) => (
                    <th key={c} className="px-2 py-2 text-right font-normal">
                      {c}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-right font-normal">T</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/5">
                {[
                  [away, game.away],
                  [home, game.home],
                ].map(([t, side]) => {
                  const sd = side as NllSide;
                  return (
                    <tr key={sd.teamId}>
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-2">
                          <NllLogo team={t as typeof away} className="size-5" />
                          {(t as typeof away)?.short}
                        </span>
                      </td>
                      {cols.map((c, i) => (
                        <td
                          key={c}
                          className="px-2 py-2 text-right font-mono tabular-nums text-mute"
                        >
                          {sd.quarters?.[i] ?? "—"}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right font-mono font-semibold tabular-nums">
                        {sd.score ?? ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <NllBookLines game={game} season={season} snaps={snaps} />
      <NllHighlights videos={media.data?.videos ?? []} />
      {media.data?.news.length ? <NllNewsPanel items={media.data.news} title="Stories" /> : null}
      <NllSourceNote />
    </div>
  );
}
