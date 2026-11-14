import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageTitle, Panel, PanelHeader, StatCard } from "@/components/shared/booth";
import { PllGamesTable, PllLinesNote, PllLogo, PllSeasonPicker } from "@/components/pll/PllBits";
import { pulse, standings } from "@/lib/pll/pll";
import { currentPllSeason, usePllSeason } from "@/lib/pll/use-pll";

export const Route = createFileRoute("/pll/")({
  head: () => ({
    meta: [
      { title: "Dashboard — GamblingPLL" },
      {
        name: "description",
        content: "Premier Lacrosse League scores, standings and season numbers.",
      },
    ],
  }),
  component: PllDashboard,
});

function PllDashboard() {
  const [season, setSeason] = useState(currentPllSeason());
  const q = usePllSeason(season);
  const s = q.data;
  const table = useMemo(() => (s ? standings(s) : []), [s]);
  const regular = useMemo(() => s?.games.filter((g) => g.phase === "regular") ?? [], [s]);
  const p = useMemo(() => pulse(regular), [regular]);
  const upcoming = useMemo(
    () => (s?.games ?? []).filter((g) => g.status !== "final").slice(0, 8),
    [s],
  );
  const recent = useMemo(
    () =>
      [...(s?.games ?? [])]
        .filter((g) => g.status === "final")
        .reverse()
        .slice(0, 10),
    [s],
  );
  const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);
  const num = (x: number | null) => (x == null ? "—" : x.toFixed(1));

  return (
    <>
      <PageTitle
        eyebrow="Premier Lacrosse League"
        title={`${season} season`}
        aside={<PllSeasonPicker season={season} onChange={setSeason} />}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Regular-season games"
          value={String(p.games)}
          note={`${s?.games.length ?? 0} games in all`}
        />
        <StatCard label="Goals per game" value={num(p.goalsPerGame)} note="both teams" />
        <StatCard
          label="Home teams won"
          value={pct(p.homeWinPct)}
          note={`avg margin ${num(p.avgMargin)}`}
        />
        <StatCard
          label="One-goal games"
          value={pct(p.oneGoalPct)}
          note={`Q1–Q4 goals: ${p.byQuarter.map((x) => x.toFixed(1)).join(" / ")}`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Panel padded={false}>
          <PanelHeader
            title="Standings"
            aside={<span className="label-mono">regular season</span>}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-faint">
                  <th className="px-4 py-2 font-normal">Team</th>
                  <th className="px-2 py-2 text-right font-normal">W-L</th>
                  <th className="px-2 py-2 text-right font-normal">GF</th>
                  <th className="px-2 py-2 text-right font-normal">GA</th>
                  <th className="px-2 py-2 text-right font-normal">Diff</th>
                  <th className="px-4 py-2 text-right font-normal">Last 5</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/5">
                {table.map((r, i) => (
                  <tr key={r.team.id} className="hover:bg-line/5">
                    <td className="px-4 py-2">
                      <Link
                        to="/pll/teams/$teamId"
                        params={{ teamId: r.team.id }}
                        className="flex items-center gap-2"
                      >
                        <span className="w-4 font-mono text-[10px] text-faint">{i + 1}</span>
                        <PllLogo team={r.team} className="size-5" />
                        <span className="font-semibold">{r.team.name}</span>
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums">
                      {r.w}-{r.l}
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-mute">
                      {r.gf}
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-mute">
                      {r.ga}
                    </td>
                    <td
                      className={`px-2 py-2 text-right font-mono tabular-nums ${r.gf - r.ga > 0 ? "text-win" : r.gf - r.ga < 0 ? "text-loss" : "text-mute"}`}
                    >
                      {r.gf - r.ga > 0 ? "+" : ""}
                      {r.gf - r.ga}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-[11px] tracking-wider">
                      {r.last.map((x, k) => (
                        <span key={k} className={x === "W" ? "text-win" : "text-loss"}>
                          {x}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
                {!table.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center font-mono text-xs text-mute">
                      {q.isLoading ? "Loading…" : "No regular-season games yet."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-6">
          {upcoming.length ? (
            <Panel padded={false}>
              <PanelHeader title="Upcoming" />
              <PllGamesTable games={upcoming} season={s} empty="" />
            </Panel>
          ) : null}
          <Panel padded={false}>
            <PanelHeader
              title="Recent results"
              aside={
                <Link to="/pll/games" className="font-mono text-[11px] text-acc">
                  All games →
                </Link>
              }
            />
            <PllGamesTable
              games={recent}
              season={s}
              empty={q.isLoading ? "Loading…" : "No games yet."}
            />
          </Panel>
          <Panel>
            <PllLinesNote />
          </Panel>
        </div>
      </div>
    </>
  );
}
