import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageTitle, Panel, PanelHeader, StatCard } from "@/components/shared/booth";
import {
  PllGamesTable,
  PllLinesNote,
  PllLogo,
  PllSeasonPicker,
  PllSourceNote,
} from "@/components/pll/PllBits";
import { PllChampionships, PllTotals } from "@/components/pll/PllHistory";
import { PllAwards, PllLeaders } from "@/components/pll/PllPlayers";
import { linesSummary } from "@/lib/pll/lines";
import {
  conferenceOf,
  PLL_CONFERENCES_FROM,
  pulse,
  standings,
  type PllConference,
  type PllStanding,
} from "@/lib/pll/pll";
import { currentPllSeason, usePllLines, usePllSeason } from "@/lib/pll/use-pll";

export const Route = createFileRoute("/pll/")({
  head: () => ({
    meta: [
      { title: "Season Pulse — GamblingPLL dashboard" },
      {
        name: "description",
        content:
          "PLL dashboard: games with spreads, moneylines and totals, results against the lines, standings, leaders and league history.",
      },
    ],
  }),
  component: PllDashboard,
});

const pct = (r: { w: number; l: number }) => (r.w + r.l ? (r.w / (r.w + r.l)) * 100 : null);
const fmt = (v: number | null) => (v === null ? "—" : v.toFixed(1));
const rec = (r: { w: number; l: number }) => `${r.w}-${r.l}`;
const note = (...parts: (string | undefined | false | null)[]) => parts.filter(Boolean).join(" · ");

function StandingsPanel({ title, rows }: { title: string; rows: PllStanding[] }) {
  return (
    <Panel padded={false}>
      <PanelHeader title={title} aside={<span className="label-mono">W-L · diff</span>} />
      {rows.length ? (
        <div className="divide-y divide-line/5">
          {rows.map((r, i) => {
            const diff = r.gf - r.ga;
            return (
              <Link
                key={r.team.id}
                to="/pll/teams/$teamId"
                params={{ teamId: r.team.id }}
                className="flex items-center gap-3 px-4 py-2 hover:bg-line/5"
              >
                <span className="w-4 font-mono text-[10px] text-faint">{i + 1}</span>
                <PllLogo team={r.team} className="size-5" />
                <span className="min-w-0 flex-1 truncate text-sm">{r.team.short}</span>
                <span className="font-mono text-xs tabular-nums text-mute">
                  {r.w}-{r.l}
                </span>
                <span
                  className={`w-8 text-right font-mono text-[11px] tabular-nums ${diff > 0 ? "text-win" : diff < 0 ? "text-loss" : "text-mute"}`}
                >
                  {diff > 0 ? "+" : ""}
                  {diff}
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="px-4 py-6 text-center font-mono text-xs text-mute">
          No regular-season games yet.
        </p>
      )}
    </Panel>
  );
}

function PllDashboard() {
  const [season, setSeason] = useState(currentPllSeason());
  const q = usePllSeason(season);
  const linesQ = usePllLines();
  const s = q.data;
  const lines = linesQ.data ?? null;
  const table = useMemo(() => (s ? standings(s) : []), [s]);
  const regular = useMemo(() => s?.games.filter((g) => g.phase === "regular") ?? [], [s]);
  const p = useMemo(() => pulse(regular), [regular]);
  const ls = useMemo(() => linesSummary(s, lines), [s, lines]);
  const live = useMemo(() => (s?.games ?? []).filter((g) => g.status === "live"), [s]);
  const upcoming = useMemo(
    () => (s?.games ?? []).filter((g) => g.status === "scheduled").slice(0, 8),
    [s],
  );
  const recent = useMemo(
    () =>
      [...(s?.games ?? [])]
        .filter((g) => g.status === "final")
        .reverse()
        .slice(0, 8),
    [s],
  );
  const conferences = season >= PLL_CONFERENCES_FROM;
  const byConf = (c: PllConference) => table.filter((r) => conferenceOf(r.team.id, season) === c);
  const clubs = (s?.teams ?? []).filter((t) => !t.id.startsWith("as-"));
  const loading = q.isLoading ? "Loading…" : undefined;
  const hasLines = ls.games > 0;

  return (
    <>
      <section className="mb-6">
        <PageTitle
          eyebrow={`Home dashboard · PLL ${season}`}
          title="Season Pulse"
          aside={<PllSeasonPicker season={season} onChange={setSeason} />}
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {hasLines ? (
            <>
              <StatCard
                label="Favorites won"
                value={fmt(pct(ls.favorites))}
                unit={pct(ls.favorites) === null ? undefined : "%"}
                note={loading ?? `${rec(ls.favorites)} on the moneyline`}
              />
              <StatCard
                label="Overs"
                value={fmt(pct(ls.overs))}
                unit={pct(ls.overs) === null ? undefined : "%"}
                note={
                  loading ??
                  note(
                    `${rec(ls.overs)} O/U`,
                    ls.avgLine !== null &&
                      p.goalsPerGame !== null &&
                      `games avg ${p.goalsPerGame.toFixed(1)} vs line ${ls.avgLine.toFixed(1)}`,
                  )
                }
              />
              <StatCard
                label="Home covers"
                value={fmt(pct(ls.homeCovers))}
                unit={pct(ls.homeCovers) === null ? undefined : "%"}
                note={loading ?? `${rec(ls.homeCovers)} ATS`}
              />
            </>
          ) : (
            <>
              <StatCard
                label="Points per game"
                value={fmt(p.goalsPerGame)}
                note={loading ?? note("both teams", `${p.games} regular-season games`)}
              />
              <StatCard
                label="One-score games"
                value={p.oneGoalPct === null ? "—" : String(Math.round(p.oneGoalPct * 100))}
                unit={p.oneGoalPct === null ? undefined : "%"}
                note={
                  loading ??
                  (p.byQuarter.length
                    ? `Q1–Q4: ${p.byQuarter.map((x) => x.toFixed(1)).join(" / ")}`
                    : "decided by one")
                }
              />
              <StatCard
                label="Avg margin"
                value={fmt(p.avgMargin)}
                note={loading ?? "regular season"}
              />
            </>
          )}
          <StatCard
            label="Home teams won"
            value={p.homeWinPct === null ? "—" : String(Math.round(p.homeWinPct * 100))}
            unit={p.homeWinPct === null ? undefined : "%"}
            note={loading ?? `${s?.games.length ?? 0} games in all`}
          />
        </div>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-faint">
          {hasLines
            ? `${ls.games} games graded against the closing consensus line`
            : "Lines start with the next posted PLL games"}{" "}
          ·{" "}
          <Link to="/pll/games" className="text-acc">
            All games →
          </Link>
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="min-w-0 space-y-6 lg:col-span-8">
          {live.length ? (
            <Panel padded={false}>
              <PanelHeader title="Live" aside={<span className="label-mono text-acc">now</span>} />
              <PllGamesTable games={live} season={s} lines={lines} withLines empty="" />
            </Panel>
          ) : null}
          {upcoming.length ? (
            <Panel padded={false}>
              <PanelHeader title="Upcoming games" />
              <PllGamesTable games={upcoming} season={s} lines={lines} withLines empty="" />
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
              lines={lines}
              withLines
              empty={q.isLoading ? "Loading games from ESPN…" : "No games yet."}
            />
            <div className="space-y-1 border-t border-line/5 px-4 py-2">
              <PllLinesNote hasLines={hasLines} />
              <PllSourceNote season={season} />
            </div>
          </Panel>
          <PllTotals games={s?.games ?? []} />
        </section>

        <aside className="min-w-0 space-y-6 lg:col-span-4">
          <Panel>
            <h2 className="font-disp text-xl font-semibold uppercase tracking-tight">Team grid</h2>
            <p className="label-mono mb-3">{clubs.length} clubs · tap to open</p>
            <div className="grid grid-cols-4 gap-2">
              {clubs.map((team) => (
                <Link
                  key={team.id}
                  to="/pll/teams/$teamId"
                  params={{ teamId: team.id }}
                  className="glass grid aspect-square place-items-center rounded-xl hover:glow"
                  title={team.name}
                >
                  <PllLogo team={team} className="size-9" />
                </Link>
              ))}
            </div>
            <Link
              to="/pll/teams"
              className="mt-3 block text-center font-mono text-[10px] uppercase tracking-wider text-acc"
            >
              + all teams
            </Link>
          </Panel>
          {conferences ? (
            <>
              <StandingsPanel title="Eastern Conference" rows={byConf("East")} />
              <StandingsPanel title="Western Conference" rows={byConf("West")} />
            </>
          ) : (
            <StandingsPanel title="Standings" rows={table} />
          )}
        </aside>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <PllLeaders season={season} data={s} />
        <div className="space-y-6">
          <PllAwards season={season} data={s} />
          <PllChampionships season={season} />
        </div>
      </div>
    </>
  );
}
