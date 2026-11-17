import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, PanelHeader } from "@/components/shared/booth";
import { PllLinesNote, PllLogo, PllSourceNote } from "@/components/pll/PllBits";
import { PllGameRosters } from "@/components/pll/PllGameRosters";
import {
  americanText,
  lineResult,
  linesFor,
  spreadText,
  type PllLine,
  type PllLinesFile,
} from "@/lib/pll/lines";

import {
  PHASE_LABEL,
  pllDate,
  teamOf,
  type PllGame,
  type PllSeason,
  type PllTeam,
} from "@/lib/pll/pll";
import { getPllSeason } from "@/lib/pll/pll.functions";
import { PLL_SEASONS, usePllLines } from "@/lib/pll/use-pll";

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
  const linesQ = usePllLines();
  const [tab, setTab] = useState<"game" | "rosters">("game");
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
      <ScoreBox game={game} season={season} lines={linesQ.data} />

      <nav className="grid grid-cols-2 border-b border-line/15" aria-label="Game tabs">
        {(
          [
            ["game", "Game"],
            ["rosters", "Rosters"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setTab(v)}
            aria-pressed={tab === v}
            className={`border-b-2 px-3 py-3 font-disp text-sm font-semibold uppercase tracking-wider transition-colors ${tab === v ? "border-acc text-foreground" : "border-transparent text-mute hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "rosters" ? <PllGameRosters game={game} season={season} /> : null}

      {tab === "game" && started && game.home.quarters.length ? (
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

      {tab === "game" ? <GameLines game={game} season={season} lines={linesQ.data} /> : null}
    </div>
  );
}

/**
 * The score box, laid out like the NFL game page: each club's logo with its name and record, the score
 * beside it (winner highlighted), the status in the middle (FINAL / FINAL/OT with date and place, a live
 * clock, or VS and the start time), and the line underneath (spread, moneyline, total).
 */
function ScoreBox({
  game,
  season,
  lines,
}: {
  game: PllGame;
  season?: PllSeason;
  lines?: PllLinesFile | null;
}) {
  const away = teamOf(season, game.away.teamId);
  const home = teamOf(season, game.home.teamId);
  const started = game.status !== "scheduled";
  const isFinal = game.status === "final";
  const isOT = game.home.quarters.length > 4 || /OT/i.test(game.detail);
  const awayWon = isFinal && (game.away.score ?? 0) > (game.home.score ?? 0);
  const homeWon = isFinal && (game.home.score ?? 0) > (game.away.score ?? 0);
  const lg = linesFor(game, season, lines);
  const line = lg?.latest;
  const res = line ? lineResult(game, line) : null;
  const club = (t: PllTeam | undefined, side: PllGame["home"]) => (
    <Link
      to="/pll/teams/$teamId"
      params={{ teamId: side.teamId }}
      className="group flex flex-col items-center gap-1 text-center"
    >
      <PllLogo team={t} className="size-10 transition-transform group-hover:scale-105 sm:size-14" />
      {side.record ? (
        <span className="font-mono text-xs text-mute group-hover:text-acc">{side.record}</span>
      ) : null}
    </Link>
  );
  const score = (n: number | null, won: boolean) => (
    <span
      className={`font-mono text-3xl font-bold tabular-nums sm:text-5xl ${won ? "text-acc" : ""}`}
    >
      {started ? (n ?? "") : ""}
    </span>
  );
  // the favorite and its spread, as the NFL page shows it: its logo and the number
  const fav = line?.spread == null ? undefined : line.spread <= 0 ? home : away;
  const favNumber =
    line?.spread == null ? null : spreadText(line.spread <= 0 ? line.spread : -line.spread);
  const coverClass =
    res?.cover == null || res.cover === "push"
      ? ""
      : (res.cover === "home") === line!.spread! <= 0
        ? "text-win"
        : "text-loss";
  const ouClass = res?.ou === "over" ? "text-win" : res?.ou === "under" ? "text-loss" : "";
  return (
    <Panel className="p-4 sm:p-6">
      <div className="mb-3 text-center font-mono text-[10px] uppercase tracking-wider text-faint">
        {PHASE_LABEL[game.phase]} · {game.season}
      </div>
      <div className="mx-auto flex max-w-2xl items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-6">
          {club(away, game.away)}
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
              {isFinal ? (isOT ? "FINAL/OT" : "FINAL") : "VS"}
            </span>
          )}
          <span className="font-mono text-[11px] text-mute" suppressHydrationWarning>
            {pllDate(game.date, !isFinal)}
          </span>
          {game.venue || game.city ? (
            <span
              className="mt-0.5 max-w-[12rem] truncate font-mono text-[10px] text-faint"
              title={[game.venue, game.city].filter(Boolean).join(", ")}
            >
              {game.weekLabel ? `${game.weekLabel} · ` : ""}
              {game.city || game.venue}
            </span>
          ) : null}
          {game.tv?.length ? (
            <span className="font-mono text-[10px] text-faint">TV: {game.tv.join(" · ")}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-3 sm:gap-6">
          {score(game.home.score, homeWon)}
          {club(home, game.home)}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-line/10 pt-3 font-mono text-[11px] text-mute">
        <span>Spread:</span>
        <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${coverClass}`}>
          {favNumber ? (
            <>
              <PllLogo team={fav} className="size-4" />
              {favNumber}
            </>
          ) : (
            "—"
          )}
        </span>
        <span>·</span>
        <span>ML:</span>
        <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
          {line?.mlAway != null || line?.mlHome != null ? (
            <>
              <PllLogo team={away} className="size-4" />
              {americanText(line?.mlAway)}
              <span className="text-faint">/</span>
              <PllLogo team={home} className="size-4" />
              {americanText(line?.mlHome)}
            </>
          ) : (
            "—"
          )}
        </span>
        <span>·</span>
        <span>O/U:</span>
        <span className={`font-semibold tabular-nums ${ouClass}`}>{line?.total ?? "—"}</span>
      </div>
    </Panel>
  );
}

const BOOK_NAMES: Record<string, string> = {
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  betmgm: "BetMGM",
  williamhill_us: "Caesars",
  caesars: "Caesars",
  espnbet: "theScore Bet",
  fanatics: "Fanatics",
  hardrockbet: "Hard Rock",
  bet365: "bet365",
  betrivers: "BetRivers",
  ballybet: "Bally Bet",
  bovada: "Bovada",
  betonlineag: "BetOnline",
  mybookieag: "MyBookie",
  lowvig: "LowVig",
  pll_reference: "PLL reference (no-vig)",
  polymarket: "Polymarket",
};

/** The game's lines: consensus opener and latest (spread, moneyline, total), result, and every book. */
function GameLines({
  game,
  season,
  lines,
}: {
  game: PllGame;
  season?: PllSeason;
  lines?: PllLinesFile | null;
}) {
  const lg = linesFor(game, season, lines);
  const home = teamOf(season, game.home.teamId)?.short ?? "Home";
  const away = teamOf(season, game.away.teamId)?.short ?? "Away";
  const res = lg ? lineResult(game, lg.latest) : null;
  const row = (label: string, l: PllLine) => (
    <tr key={label}>
      <td className="px-4 py-1.5 text-mute">{label}</td>
      <td className="px-2 py-1.5 text-right">
        {home} {spreadText(l.spread)}
      </td>
      <td className="px-2 py-1.5 text-right">
        {americanText(l.mlAway)} / {americanText(l.mlHome)}
      </td>
      <td className="px-4 py-1.5 text-right">{l.total ?? "—"}</td>
    </tr>
  );
  const books = lg ? Object.entries(lg.books) : [];
  return (
    <Panel padded={false}>
      <PanelHeader title="Lines" />
      {lg ? (
        <>
          <table className="w-full font-mono text-xs tabular-nums">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-faint">
                <th className="px-4 py-2 font-normal" />
                <th className="px-2 py-2 text-right font-normal">Spread</th>
                <th className="px-2 py-2 text-right font-normal">
                  ML {away} / {home}
                </th>
                <th className="px-4 py-2 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/5">
              {row("Open", lg.open)}
              {row(game.status === "final" ? "Close" : "Latest", lg.latest)}
            </tbody>
          </table>
          {res ? (
            <p className="px-4 py-2 font-mono text-[11px] text-mute">
              {res.cover === "push"
                ? "Spread pushed"
                : `${res.cover === "home" ? home : away} covered`}
              {res.ou ? ` · ${res.ou === "push" ? "total pushed" : `went ${res.ou}`}` : ""}
              {res.favWon == null ? "" : ` · favorite ${res.favWon ? "won" : "lost"}`}
            </p>
          ) : null}
          {books.length ? (
            <div className="overflow-x-auto border-t border-line/5">
              <table className="w-full min-w-[420px] font-mono text-xs tabular-nums">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-faint">
                    <th className="px-4 py-2 font-normal">Book</th>
                    <th className="px-2 py-2 text-right font-normal">{home} spread</th>
                    <th className="px-2 py-2 text-right font-normal">ML</th>
                    <th className="px-4 py-2 text-right font-normal">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/5">
                  {books.map(([k, b]) => (
                    <tr key={k}>
                      <td className="px-4 py-1.5 font-sans text-mute">{BOOK_NAMES[k] ?? k}</td>
                      <td className="px-2 py-1.5 text-right">
                        {b.spread
                          ? `${spreadText(b.spread[0])} (${americanText(b.spread[1])})`
                          : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {b.ml ? `${americanText(b.ml[1])} / ${americanText(b.ml[0])}` : "—"}
                      </td>
                      <td className="px-4 py-1.5 text-right">{b.total ? b.total[0] : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
      <div className="space-y-2 px-4 py-3">
        <PllLinesNote hasLines={Boolean(lg)} />
        <PllSourceNote season={game.season} />
      </div>
    </Panel>
  );
}
