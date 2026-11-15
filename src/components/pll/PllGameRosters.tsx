import { useState } from "react";
import { Panel, PanelHeader } from "@/components/shared/booth";
import { PllLogo } from "@/components/pll/PllBits";
import { collegeLogoFor } from "@/lib/pll/colleges";
import { gameRoster, type PllRosterLine } from "@/lib/pll/game-rosters";
import { pllDate, teamOf, type PllGame, type PllSeason } from "@/lib/pll/pll";
import { posAbbr, posRank } from "@/lib/pll/players";

function CollegeMark({ college }: { college: string | null }) {
  const [failed, setFailed] = useState(false);
  const src = collegeLogoFor(college);
  if (!college) return null;
  if (!src || failed)
    return (
      <span className="font-mono text-[10px] uppercase text-mute" title={college}>
        {college}
      </span>
    );
  return (
    <img
      src={src}
      alt={college}
      title={college}
      className="size-5 object-contain"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

const ORDER = ["A", "M", "FO", "SSDM", "LSM", "D", "G"];

function Side({ game, season, teamId }: { game: PllGame; season?: PllSeason; teamId: string }) {
  const team = teamOf(season, teamId);
  const r = gameRoster(game, season, teamId);
  const players = [...(r?.players ?? [])].sort(
    (a, b) =>
      (ORDER.indexOf(posAbbr(a.pos)) + 1 || 99) - (ORDER.indexOf(posAbbr(b.pos)) + 1 || 99) ||
      posRank(a.pos) - posRank(b.pos) ||
      (a.num ?? 999) - (b.num ?? 999),
  );
  return (
    <Panel padded={false}>
      <PanelHeader
        title={
          <span className="flex items-center gap-2">
            <PllLogo team={team} className="size-6" />
            {team?.short}
          </span>
        }
        aside={<span className="label-mono">{players.length} players</span>}
      />
      {r && !r.exact && r.from ? (
        <p className="border-b border-line/5 px-4 py-2 font-mono text-[10px] text-faint">
          This game&apos;s box score is incomplete in the feed: showing the last full game-day
          roster, from {pllDate(r.from)}.
        </p>
      ) : null}
      {players.length ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-faint">
              <th className="px-4 py-2 font-normal">#</th>
              <th className="px-2 py-2 font-normal">Player</th>
              <th className="px-2 py-2 font-normal">Pos</th>
              <th className="px-4 py-2 font-normal">College</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/5">
            {players.map((p: PllRosterLine) => (
              <tr key={`${p.num}-${p.name}`} className="hover:bg-line/5">
                <td className="px-4 py-1.5 font-mono tabular-nums text-mute">{p.num ?? ""}</td>
                <td className="px-2 py-1.5 font-semibold">{p.name}</td>
                <td className="px-2 py-1.5 font-mono text-xs text-mute">{posAbbr(p.pos)}</td>
                <td className="px-4 py-1">
                  <CollegeMark college={p.college} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="px-4 py-6 text-center font-mono text-xs text-mute">
          No roster for this game.
        </p>
      )}
    </Panel>
  );
}

/** Both clubs' game-day rosters for a game. */
export function PllGameRosters({ game, season }: { game: PllGame; season?: PllSeason }) {
  if (game.season < 2026)
    return (
      <Panel>
        <p className="font-mono text-xs text-mute">
          Game-day rosters start in 2026 (the PLL box scores we have). Team pages have each
          club&apos;s season roster for earlier years.
        </p>
      </Panel>
    );
  return (
    <div className="space-y-2">
      <div className="grid gap-6 lg:grid-cols-2">
        <Side game={game} season={season} teamId={game.away.teamId} />
        <Side game={game} season={season} teamId={game.home.teamId} />
      </div>
      <p className="font-mono text-[10px] text-faint">
        Game-day roster = every player in the game&apos;s box score (Lacrosse API), so it changes
        week to week as clubs activate and scratch players.
      </p>
    </div>
  );
}
