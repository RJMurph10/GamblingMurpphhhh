import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageTitle, Panel } from "@/components/shared/booth";
import { PllLogo } from "@/components/pll/PllBits";
import { teamOf } from "@/lib/pll/pll";
import { posAbbr } from "@/lib/pll/players";
import { pllPlayers, totalsOf, type PllTotals } from "@/lib/pll/player-stats";
import { usePllSeason } from "@/lib/pll/use-pll";

export const Route = createFileRoute("/pll/players/")({
  head: () => ({ meta: [{ title: "Players — GamblingPLL" }] }),
  component: PllPlayersPage,
});

type SortKey = "P" | "G" | "A" | "Sh" | "GB" | "CT" | "foPct" | "svPct";
const COLS: [SortKey, string][] = [
  ["P", "P"],
  ["G", "G"],
  ["A", "A"],
  ["Sh", "Sh"],
  ["GB", "GB"],
  ["CT", "CT"],
  ["foPct", "FO%"],
  ["svPct", "Sv%"],
];
const fmt = (k: SortKey, t: PllTotals) => {
  const v = t[k];
  if (v == null) return "—";
  if (k === "foPct" || k === "svPct")
    return t[k === "foPct" ? "FOT" : "Sv"] ? `${(v * 100).toFixed(1)}%` : "—";
  return String(v);
};

function PllPlayersPage() {
  const season = 2026;
  const q = usePllSeason(season);
  const [sort, setSort] = useState<SortKey>("P");
  const rows = useMemo(
    () =>
      [...pllPlayers().values()]
        .map((p) => ({ p, t: totalsOf(p.games.filter((g) => g.season === season)) }))
        .filter((r) => r.t.gp)
        .sort(
          (a, b) => ((b.t[sort] as number) ?? -1) - ((a.t[sort] as number) ?? -1) || b.t.P - a.t.P,
        ),
    [sort],
  );
  const teams = [...new Set(rows.map((r) => r.p.teamId))];
  return (
    <>
      <PageTitle eyebrow={`Premier Lacrosse League · ${season}`} title="Players" />
      <p className="mb-4 font-mono text-[11px] text-mute">
        Game-by-game stats entered from the PLL&apos;s box scores so far:{" "}
        {teams.map((id) => teamOf(q.data, id)?.short ?? id).join(", ") || "none yet"}. Tap a column
        to sort, a player for the game log.
      </p>
      <Panel padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-right font-mono text-[10px] uppercase tracking-wider text-faint">
                <th className="px-4 py-2 text-left font-normal">Player</th>
                <th className="px-2 py-2 text-left font-normal">Pos</th>
                <th className="px-2 py-2 font-normal">GP</th>
                {COLS.map(([k, label]) => (
                  <th key={k} className="px-2 py-2 font-normal">
                    <button
                      type="button"
                      onClick={() => setSort(k)}
                      className={`uppercase ${sort === k ? "text-acc" : "hover:text-foreground"}`}
                    >
                      {label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/5">
              {rows.map(({ p, t }) => (
                <tr key={p.slug} className="text-right hover:bg-line/5">
                  <td className="px-4 py-1.5 text-left">
                    <Link
                      to="/pll/players/$playerId"
                      params={{ playerId: p.slug }}
                      className="inline-flex items-center gap-2 font-semibold hover:text-acc"
                    >
                      <PllLogo team={teamOf(q.data, p.teamId)} className="size-5" />
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5 text-left font-mono text-xs text-mute">
                    {posAbbr(p.pos)}
                  </td>
                  <td className="px-2 py-1.5 font-mono tabular-nums text-mute">{t.gp}</td>
                  {COLS.map(([k]) => (
                    <td
                      key={k}
                      className={`px-2 py-1.5 font-mono tabular-nums ${sort === k ? "font-semibold" : ""}`}
                    >
                      {fmt(k, t)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
