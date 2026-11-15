import { Link } from "@tanstack/react-router";
import { americanText, lineResult, linesFor, spreadText, type PllLinesFile } from "@/lib/pll/lines";
import { useState } from "react";
import {
  PHASE_LABEL,
  pllDate,
  teamOf,
  type PllGame,
  type PllSeason,
  type PllTeam,
} from "@/lib/pll/pll";
import { PLL_SEASONS } from "@/lib/pll/use-pll";

/** A PLL club's logo (ESPN's CDN), falling back to its abbreviation. */
export function PllLogo({ team, className = "size-6" }: { team?: PllTeam; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!team) return null;
  if (!team.logo || failed)
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-line/10 font-mono text-[9px] font-bold ${className}`}
      >
        {team.abbr}
      </span>
    );
  return (
    <img
      src={team.logo}
      alt={team.name}
      title={team.name}
      className={`shrink-0 object-contain ${className}`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/** Season picker (2024 → this year). */
export function PllSeasonPicker({
  season,
  onChange,
  seasons = PLL_SEASONS,
}: {
  season: number;
  onChange: (s: number) => void;
  /** The seasons to offer (a club's page shows only those it played). */
  seasons?: number[];
}) {
  return (
    <div className="flex flex-wrap gap-1" role="tablist" aria-label="Season">
      {seasons.map((s) => (
        <button
          key={s}
          type="button"
          role="tab"
          aria-selected={s === season}
          onClick={() => onChange(s)}
          className={`rounded-md px-2.5 py-1.5 font-mono text-xs font-semibold ${s === season ? "bg-acc text-black" : "text-mute hover:bg-line/5 hover:text-foreground"}`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

/** One game as a row: date, both clubs with scores (winner bold), lines when saved, status. */
export function PllGameRow({
  game,
  season,
  lines,
  showLines = false,
}: {
  game: PllGame;
  season?: PllSeason;
  lines?: PllLinesFile | null;
  showLines?: boolean;
}) {
  const away = teamOf(season, game.away.teamId);
  const home = teamOf(season, game.home.teamId);
  const done = game.status !== "scheduled";
  const awayWon = game.status === "final" && (game.away.score ?? 0) > (game.home.score ?? 0);
  const homeWon = game.status === "final" && (game.home.score ?? 0) > (game.away.score ?? 0);
  const lg = showLines ? linesFor(game, season, lines) : undefined;
  const line = lg?.latest;
  const res = line ? lineResult(game, line) : null;
  const side = (t: PllTeam | undefined, score: number | null, won: boolean, name: string) => (
    <span
      className={`flex min-w-0 items-center gap-2 ${won ? "font-semibold text-foreground" : "text-mute"}`}
    >
      <PllLogo team={t} className="size-5" />
      <span className="truncate">{t?.short ?? name}</span>
      {done ? <span className="ml-auto font-mono tabular-nums">{score ?? "—"}</span> : null}
    </span>
  );
  const mark = (on: boolean | null | undefined) =>
    on ? <span className="ml-1 text-win">✓</span> : null;
  return (
    <tr className="hover:bg-line/5">
      <td
        className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-mute"
        suppressHydrationWarning
      >
        {pllDate(game.date, game.status === "scheduled")}
        <span className="block text-[10px] text-faint">{PHASE_LABEL[game.phase]}</span>
      </td>
      <td className="px-2 py-2.5">
        <Link
          to="/pll/games/$gameId"
          params={{ gameId: game.id }}
          className="block space-y-1 text-sm"
        >
          {side(away, game.away.score, awayWon, "Away")}
          {side(home, game.home.score, homeWon, "Home")}
        </Link>
      </td>
      {showLines ? (
        <>
          <td className="whitespace-nowrap px-2 py-2.5 text-right font-mono text-xs tabular-nums">
            {line ? (
              <span className="block space-y-1">
                <span className="block">
                  {spreadText(line.spread == null ? null : -line.spread)}
                  {mark(res?.cover === "away")}
                </span>
                <span className="block">
                  {spreadText(line.spread)}
                  {mark(res?.cover === "home")}
                </span>
              </span>
            ) : (
              <span className="text-faint">—</span>
            )}
          </td>
          <td className="whitespace-nowrap px-2 py-2.5 text-right font-mono text-xs tabular-nums">
            {line ? (
              <span className="block space-y-1">
                <span className="block">{americanText(line.mlAway)}</span>
                <span className="block">{americanText(line.mlHome)}</span>
              </span>
            ) : (
              <span className="text-faint">—</span>
            )}
          </td>
          <td className="whitespace-nowrap px-2 py-2.5 text-right font-mono text-xs tabular-nums">
            {line?.total != null ? (
              <>
                {line.total}
                {res?.ou ? (
                  <span
                    className={`block text-[10px] uppercase ${res.ou === "over" ? "text-win" : res.ou === "under" ? "text-loss" : "text-mute"}`}
                  >
                    {res.ou}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-faint">—</span>
            )}
          </td>
        </>
      ) : null}
      <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-[11px]">
        <span className={game.status === "live" ? "text-acc" : "text-faint"}>
          {game.status === "final"
            ? game.home.quarters.length > 4
              ? "Final/OT"
              : "Final"
            : game.detail}
        </span>
      </td>
    </tr>
  );
}

/**
 * Games table (date, matchup with scores, status). With lines (saved from The Odds API), adds the
 * consensus spread and moneyline beside each club and the total, with ✓ on the side that covered and
 * over/under for finished games. The line columns show whenever lines are passed in, so the table keeps
 * its shape before the first lines are saved.
 */
export function PllGamesTable({
  games,
  season,
  empty,
  lines,
  withLines = false,
}: {
  games: PllGame[];
  season?: PllSeason;
  empty: string;
  lines?: PllLinesFile | null;
  withLines?: boolean;
}) {
  const cols = withLines ? 6 : 3;
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm ${withLines ? "min-w-[600px]" : "min-w-[420px]"}`}>
        <thead>
          <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-faint">
            <th className="w-[24%] px-4 py-2 font-normal">Date</th>
            <th className="px-2 py-2 font-normal">Matchup</th>
            {withLines ? (
              <>
                <th className="px-2 py-2 text-right font-normal">Spread</th>
                <th className="px-2 py-2 text-right font-normal">ML</th>
                <th className="px-2 py-2 text-right font-normal">Total</th>
              </>
            ) : null}
            <th className="w-[14%] px-4 py-2 text-right font-normal">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/5">
          {games.length ? (
            games.map((g) => (
              <PllGameRow key={g.id} game={g} season={season} lines={lines} showLines={withLines} />
            ))
          ) : (
            <tr>
              <td colSpan={cols} className="px-4 py-6 text-center font-mono text-xs text-mute">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Credit for the 2019-2021 results (Wikipedia, CC BY-SA 4.0); nothing for ESPN seasons. */
export function PllSourceNote({ season }: { season: number }) {
  if (season > 2021) return null;
  return (
    <p className="font-mono text-[10px] text-faint">
      {season} results from Wikipedia&apos;s{" "}
      <a
        className="underline hover:text-mute"
        href={`https://en.wikipedia.org/wiki/${season}_Premier_Lacrosse_League_season`}
        target="_blank"
        rel="noreferrer"
      >
        {season} Premier Lacrosse League season
      </a>{" "}
      (CC BY-SA 4.0): final scores, overtime and venues; no scores by quarter. ESPN covers 2022 on.
    </p>
  );
}

/** Where the lines come from, and why a game may have none. */
export function PllLinesNote({ hasLines = false }: { hasLines?: boolean }) {
  return (
    <p className="font-mono text-[11px] text-faint">
      Lines: consensus of the major US books from The Odds API, saved automatically whenever PLL
      games are posted (spread and moneyline beside each club, then the total; ✓ = covered).
      {hasLines
        ? ""
        : " None saved yet: it's the off-season, so no book has PLL games up. Lines start with the winter Championship Series."}
    </p>
  );
}
