import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, PanelHeader } from "@/components/shared/booth";
import { PllLinesNote, PllLogo, PllSourceNote } from "@/components/pll/PllBits";
import { PHASE_LABEL, pllDate, teamOf, type PllGame } from "@/lib/pll/pll";
import { getPllSeason } from "@/lib/pll/pll.functions";
import { PLL_SEASONS } from "@/lib/pll/use-pll";

export const Route = createFileRoute("/pll/games/$gameId")({
  head: () => ({ meta: [{ title: "Game — GamblingPLL" }] }),
  component: PllGamePage,
});

/** Finds the game: 2019-2021 ids carry their season ("wiki-2019-…"); ESPN ids are looked up newest first. */
function useGame(id: string) {
  const wiki = /^wiki-(\d{4})-/.exec(id);
  const seasons = wiki ? [Number(wiki[1])] : [...PLL_SEASONS].filter((s) => s >= 2022).reverse();
  const qs = useQueries({
    queries: seasons.map((season) => ({
      queryKey: ["pll-season", season],
      queryFn: () => getPllSeason({ data: { season } }),
      staleTime: 5 * 60_000,
    })),
  });
  return useMemo(() => {
    for (const q of qs) {
      const g = q.data?.games.find((x) => x.id === id);
      if (g) return { game: g, season: q.data, loading: false };
    }
    return {
      game: undefined as PllGame | undefined,
      season: undefined,
      loading: qs.some((q) => q.isLoading),
    };
  }, [qs, id]);
}

function PllGamePage() {
  const { gameId } = Route.useParams();
  const { game, season, loading } = useGame(gameId);
  if (!game)
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
  const n = Math.max(4, game.home.quarters.length, game.away.quarters.length);
  const cols = Array.from({ length: n }, (_, i) =>
    i < 4 ? `Q${i + 1}` : n > 5 ? `OT${i - 3}` : "OT",
  );
  const won = (me: number | null, them: number | null) =>
    game.status === "final" && (me ?? 0) > (them ?? 0);
  return (
    <div className="space-y-6">
      <Panel>
        <div className="text-center font-mono text-[10px] uppercase tracking-wider text-faint">
          {PHASE_LABEL[game.phase]} · {game.season}
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {[
            [away, game.away, game.home, "away"] as const,
            [home, game.home, game.away, "home"] as const,
          ].map(([t, me, them, at], i) => {
            const block = (
              <Link
                key={at}
                to="/pll/teams/$teamId"
                params={{ teamId: me.teamId }}
                className={`flex items-center gap-3 ${i === 1 ? "flex-row-reverse text-right" : ""}`}
              >
                <PllLogo team={t} className="size-12 sm:size-16" />
                <div>
                  <div className="font-disp text-base font-semibold uppercase tracking-tight sm:text-xl">
                    {t?.short}
                  </div>
                  <div className="font-mono text-[10px] text-faint">{me.record ?? ""}</div>
                </div>
                {started ? (
                  <span
                    className={`mx-2 font-mono text-3xl font-bold tabular-nums sm:text-5xl ${won(me.score, them.score) ? "text-acc" : ""}`}
                  >
                    {me.score ?? ""}
                  </span>
                ) : null}
              </Link>
            );
            return i === 0 ? [block, <Center key="c" game={game} />] : block;
          })}
        </div>
      </Panel>

      {started && game.home.quarters.length ? (
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
                ].map(([t, s]) => (
                  <tr key={(s as PllGame["home"]).teamId}>
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2">
                        <PllLogo team={t as never} className="size-5" />
                        {(t as { short?: string } | undefined)?.short}
                      </span>
                    </td>
                    {cols.map((c, i) => (
                      <td key={c} className="px-2 py-2 text-right font-mono tabular-nums text-mute">
                        {(s as PllGame["home"]).quarters[i] ?? ""}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-mono font-semibold tabular-nums">
                      {(s as PllGame["home"]).score ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <Panel padded={false}>
        <PanelHeader title="Lines" />
        <div className="space-y-2 px-4 py-3">
          <PllLinesNote />
          <PllSourceNote season={game.season} />
        </div>
      </Panel>
    </div>
  );
}

function Center({ game }: { game: PllGame }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span
        className={`font-disp text-lg font-bold tracking-wider ${game.status === "live" ? "text-acc" : "text-mute"}`}
      >
        {game.status === "final"
          ? game.home.quarters.length > 4
            ? "FINAL/OT"
            : "FINAL"
          : game.status === "live"
            ? "LIVE"
            : "VS"}
      </span>
      <span className="font-mono text-[11px] text-mute" suppressHydrationWarning>
        {game.status === "live" ? game.detail : pllDate(game.date, game.status === "scheduled")}
      </span>
      {game.venue || game.city ? (
        <span
          className="mt-0.5 max-w-[12rem] truncate font-mono text-[10px] text-faint"
          title={[game.venue, game.city].filter(Boolean).join(", ")}
        >
          {game.city || game.venue}
        </span>
      ) : null}
    </div>
  );
}
