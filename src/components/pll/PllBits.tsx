import { Link } from "@tanstack/react-router";
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
}: {
  season: number;
  onChange: (s: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="tablist" aria-label="Season">
      {PLL_SEASONS.map((s) => (
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

/** One game as a row: date, both clubs with scores (winner bold), phase, and a link to the game. */
export function PllGameRow({ game, season }: { game: PllGame; season?: PllSeason }) {
  const away = teamOf(season, game.away.teamId);
  const home = teamOf(season, game.home.teamId);
  const done = game.status !== "scheduled";
  const awayWon = game.status === "final" && (game.away.score ?? 0) > (game.home.score ?? 0);
  const homeWon = game.status === "final" && (game.home.score ?? 0) > (game.away.score ?? 0);
  const side = (t: PllTeam | undefined, score: number | null, won: boolean, name: string) => (
    <span
      className={`flex min-w-0 items-center gap-2 ${won ? "font-semibold text-foreground" : "text-mute"}`}
    >
      <PllLogo team={t} className="size-5" />
      <span className="truncate">{t?.short ?? name}</span>
      {done ? <span className="ml-auto font-mono tabular-nums">{score ?? "—"}</span> : null}
    </span>
  );
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

/** Games table (date, matchup with scores, status). */
export function PllGamesTable({
  games,
  season,
  empty,
}: {
  games: PllGame[];
  season?: PllSeason;
  empty: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-faint">
            <th className="w-[30%] px-4 py-2 font-normal">Date</th>
            <th className="px-2 py-2 font-normal">Matchup</th>
            <th className="w-[18%] px-4 py-2 text-right font-normal">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/5">
          {games.length ? (
            games.map((g) => <PllGameRow key={g.id} game={g} season={season} />)
          ) : (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center font-mono text-xs text-mute">
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

/** The note shown wherever lines will go. */
export function PllLinesNote() {
  return (
    <p className="font-mono text-[11px] text-faint">
      Betting lines aren&apos;t connected yet: the PLL&apos;s moneylines, spreads and totals will
      come from the odds feed (the Odds API), with past seasons&apos; lines added after that.
    </p>
  );
}
