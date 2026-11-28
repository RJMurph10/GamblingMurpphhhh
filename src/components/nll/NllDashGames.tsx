import { Link } from "@tanstack/react-router";
import { Panel, PanelHeader } from "@/components/shared/booth";
import { NllCaptureBadge, NllLogo } from "@/components/nll/NllBits";
import {
  captureStatus,
  consensus,
  lineResult,
  signed,
  snapshotsFor,
  teamOf,
  type NllGame,
  type NllLinesFile,
  type NllSeason,
} from "@/lib/nll/nll";

/**
 * Game tables in the NFL dashboard's layout: Date (city under it for finished games), Time (capture status
 * for upcoming games), a centered matchup, the spread as the favorite's logo and number (green covered, red
 * didn't) and the total (green over, red under).
 */
const WIN = "text-win font-semibold";
const LOSS = "text-loss font-semibold";
const PUSH = "text-acc font-semibold";

function Row({
  game,
  season,
  lines,
}: {
  game: NllGame;
  season?: NllSeason;
  lines?: NllLinesFile | null;
}) {
  const away = teamOf(season, game.away.teamId);
  const home = teamOf(season, game.home.teamId);
  const started = game.status !== "scheduled";
  const d = new Date(game.date);
  const snaps = season ? snapshotsFor(game, season, lines) : [];
  const line = consensus(snaps);
  const res = line ? lineResult(game, line) : null;
  const fav = line?.spread == null ? undefined : line.spread <= 0 ? home : away;
  const favPts = line?.spread == null ? null : signed(-Math.abs(line.spread));
  const spreadClass =
    !res?.cover || line?.spread == null
      ? "text-mute"
      : res.cover === "push"
        ? PUSH
        : (res.cover === "home") === line.spread <= 0
          ? WIN
          : LOSS;
  const totalClass = !res?.ou
    ? "text-mute"
    : res.ou === "over"
      ? WIN
      : res.ou === "under"
        ? LOSS
        : PUSH;
  return (
    <tr className="hover:bg-line/5">
      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-mute" suppressHydrationWarning>
        {d.getMonth() + 1}/{d.getDate()}
        {game.status === "final" && game.city ? (
          <span className="block max-w-[9rem] truncate text-[10px] text-faint" title={game.venue}>
            {game.city}
          </span>
        ) : null}
      </td>
      <td suppressHydrationWarning className="whitespace-nowrap px-2 py-2.5 font-mono text-mute">
        {d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        {game.status === "live" ? (
          <span className="block text-[10px] text-acc">{game.detail || "Live"}</span>
        ) : game.status === "scheduled" && d.getTime() - Date.now() < 10 * 86_400_000 ? (
          <span className="mt-0.5 block">
            <NllCaptureBadge status={captureStatus(game, snaps)} />
          </span>
        ) : null}
      </td>
      <td className="px-2 py-2.5 text-center">
        <Link
          to="/nll/games/$gameId"
          params={{ gameId: game.id }}
          className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-1.5 font-mono font-semibold tabular-nums hover:text-acc"
        >
          <span className="flex justify-end">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-6 text-right">{started ? (game.away.score ?? "") : ""}</span>
              <NllLogo team={away} className="size-6" />
            </span>
          </span>
          <span className="text-center font-sans font-normal text-mute">@</span>
          <span className="flex justify-start">
            <span className="relative inline-flex items-center gap-1.5">
              <NllLogo team={home} className="size-6" />
              <span className="w-6 text-left">{started ? (game.home.score ?? "") : ""}</span>
              {started && game.ot ? (
                <span className="absolute left-full top-1/2 ml-1.5 -translate-y-1/2 whitespace-nowrap font-mono text-[10px] font-normal text-mute">
                  (OT)
                </span>
              ) : null}
            </span>
          </span>
        </Link>
      </td>
      <td
        className={`whitespace-nowrap px-2 py-2.5 text-right font-mono tabular-nums ${spreadClass}`}
      >
        {favPts ? (
          <span className="inline-flex items-center justify-end gap-1">
            <NllLogo team={fav} className="size-4" />
            {favPts}
          </span>
        ) : line && line.spread == null && snaps.some((s) => s.spread) ? (
          <span className="font-mono text-[10px] text-acc" title="Books disagree on the favorite">
            split
          </span>
        ) : (
          "—"
        )}
      </td>
      <td
        className={`whitespace-nowrap px-4 py-2.5 text-right font-mono tabular-nums ${totalClass}`}
      >
        {line?.total ?? "—"}
      </td>
    </tr>
  );
}

export function NllDashGames({
  title,
  games,
  season,
  lines,
  emptyText,
  aside,
}: {
  title: string;
  games: NllGame[];
  season?: NllSeason;
  lines?: NllLinesFile | null;
  emptyText: string;
  aside?: React.ReactNode;
}) {
  return (
    <Panel padded={false}>
      <PanelHeader title={title} aside={aside} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-faint">
              <th className="w-[20%] px-4 py-2 font-normal">Date</th>
              <th className="w-[22%] px-2 py-2 font-normal">Time</th>
              <th className="w-[34%] px-2 py-2 text-center font-normal">Matchup</th>
              <th className="w-[12%] px-2 py-2 text-right font-normal">Spread</th>
              <th className="w-[12%] px-4 py-2 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/5">
            {games.length ? (
              games.map((g) => <Row key={g.id} game={g} season={season} lines={lines} />)
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center font-mono text-xs text-mute">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
