import { Link } from "@tanstack/react-router";
import { PllLogo } from "@/components/pll/PllBits";
import { teamOf, type PllSeason } from "@/lib/pll/pll";
import { posAbbr } from "@/lib/pll/players";
import { pllPlayer, playerSlug, pllTeamPlayers, totalsOf } from "@/lib/pll/player-stats";
import { Panel, PanelHeader } from "@/components/shared/booth";

/** A player's name, linked to their page when they have entered stats. */
export function PllPlayerName({ name, className = "" }: { name: string; className?: string }) {
  const slug = playerSlug(name);
  if (!pllPlayer(slug)) return <span className={className}>{name}</span>;
  return (
    <Link
      to="/pll/players/$playerId"
      params={{ playerId: slug }}
      className={`${className} underline decoration-line/30 underline-offset-2 hover:text-acc`}
    >
      {name}
    </Link>
  );
}

/** A club's players with entered stats that season: totals, linked to each player's page. */
export function PllTeamPlayerStats({
  teamId,
  season,
  data,
}: {
  teamId: string;
  season: number;
  data?: PllSeason;
}) {
  const rows = pllTeamPlayers(teamId, season)
    .map((p) => ({
      p,
      t: totalsOf(p.games.filter((g) => g.season === season && g.teamId === teamId)),
    }))
    .sort((a, b) => b.t.P - a.t.P || b.t.GB - a.t.GB);
  if (!rows.length) return null;
  return (
    <Panel padded={false}>
      <PanelHeader
        title="Player stats"
        aside={
          <span className="inline-flex items-center gap-1.5">
            <PllLogo team={teamOf(data, teamId)} className="size-4" />
            <span className="label-mono">
              {season} · from game box scores · — = not in PLL&apos;s stats
            </span>
          </span>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-right font-mono text-[10px] uppercase tracking-wider text-faint">
              <th className="px-4 py-2 text-left font-normal">Player</th>
              <th className="px-2 py-2 text-left font-normal">Pos</th>
              <th className="px-2 py-2 font-normal">GP</th>
              <th className="px-2 py-2 font-normal">P</th>
              <th className="px-2 py-2 font-normal">G</th>
              <th className="px-2 py-2 font-normal">2PG</th>
              <th className="px-2 py-2 font-normal">A</th>
              <th className="px-2 py-2 font-normal">Sh</th>
              <th className="px-2 py-2 font-normal">GB</th>
              <th className="px-2 py-2 font-normal">CT</th>
              <th className="px-4 py-2 font-normal">FO / Sv</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/5 font-mono tabular-nums">
            {rows.map(({ p, t }) => (
              <tr key={p.slug} className="text-right hover:bg-line/5">
                <td className="px-4 py-1.5 text-left font-sans font-semibold">
                  <PllPlayerName name={p.name} />
                </td>
                <td className="px-2 py-1.5 text-left text-xs text-mute">{posAbbr(p.pos)}</td>
                <td className="px-2 py-1.5 text-mute">{t.gp}</td>
                <td className="px-2 py-1.5 font-semibold">{t.P}</td>
                <td className="px-2 py-1.5">{t.G}</td>
                <td className="px-2 py-1.5">{t.G2}</td>
                <td className="px-2 py-1.5">{t.A}</td>
                <td className="px-2 py-1.5">{t.Sh}</td>
                <td className="px-2 py-1.5">{t.GB}</td>
                <td className="px-2 py-1.5">{t.CT ?? "—"}</td>
                <td className="px-4 py-1.5 text-mute">
                  {t.FOT
                    ? `${t.FOW}/${t.FOT} (${Math.round((t.foPct ?? 0) * 100)}%)`
                    : t.Sv
                      ? `${t.Sv} sv (${((t.svPct ?? 0) * 100).toFixed(1)}%)`
                      : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
