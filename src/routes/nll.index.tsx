import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageTitle, Panel, PanelHeader, StatCard } from "@/components/shared/booth";
import { NllLogo, NllSeasonPicker, NllSourceNote } from "@/components/nll/NllBits";
import { NllDashGames } from "@/components/nll/NllDashGames";
import {
  captureStatus,
  nllPulse,
  nllSeasonLabel,
  nllSeasonOf,
  nllStandings,
  snapshotsFor,
  type NllStanding,
} from "@/lib/nll/nll";
import { useNllLines, useNllNews, useNllSeason } from "@/lib/nll/use-nll";
import { NllNewsPanel } from "@/components/nll/NllMedia";

export const Route = createFileRoute("/nll/")({
  head: () => ({
    meta: [
      { title: "Season Pulse — GamblingNLL dashboard" },
      {
        name: "description",
        content:
          "NLL dashboard: upcoming games with which still need lines captured, saved spreads and totals, results against the lines, standings.",
      },
    ],
  }),
  component: NllDashboard,
});

const fmt = (v: number | null) => (v === null ? "—" : v.toFixed(1));
const pct = (v: number | null) => (v === null ? "—" : String(Math.round(v * 100)));

function StandingsPanel({ rows }: { rows: NllStanding[] }) {
  return (
    <Panel padded={false}>
      <PanelHeader title="Standings" aside={<span className="label-mono">W-L · diff</span>} />
      <div className="divide-y divide-line/5">
        {rows.map((r, i) => {
          const diff = r.gf - r.ga;
          return (
            <Link
              key={r.team.id}
              to="/nll/teams/$teamId"
              params={{ teamId: r.team.id }}
              className="flex items-center gap-3 px-4 py-2 hover:bg-line/5"
            >
              <span className="w-4 font-mono text-[10px] text-faint">{i + 1}</span>
              <NllLogo team={r.team} className="size-5" />
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
    </Panel>
  );
}

function NllDashboard() {
  const [season, setSeason] = useState(nllSeasonOf());
  const q = useNllSeason(season);
  const linesQ = useNllLines(season);
  const news = useNllNews();
  const s = q.data;
  const lines = linesQ.data ?? null;
  const p = useMemo(() => nllPulse(s?.games ?? []), [s]);
  const table = useMemo(() => (s ? nllStandings(s) : []), [s]);
  const live = useMemo(() => (s?.games ?? []).filter((g) => g.status === "live"), [s]);
  const upcoming = useMemo(
    () => (s?.games ?? []).filter((g) => g.status === "scheduled").slice(0, 10),
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
  const capture = useMemo(() => {
    if (!s) return { need: 0, open: 0, close: 0, lined: 0 };
    const soon = s.games.filter(
      (g) => g.status === "scheduled" && new Date(g.date).getTime() - Date.now() < 10 * 86_400_000,
    );
    const st = soon.map((g) => captureStatus(g, snapshotsFor(g, s, lines)));
    const lined = s.games.filter(
      (g) => g.status === "final" && snapshotsFor(g, s, lines).length,
    ).length;
    return {
      need: st.filter((x) => x === "none").length,
      open: st.filter((x) => x === "open").length,
      close: st.filter((x) => x === "close").length,
      lined,
    };
  }, [s, lines]);
  const loading = q.isLoading ? "Loading…" : undefined;

  return (
    <>
      <section className="mb-6">
        <PageTitle
          eyebrow={`Home dashboard · NLL ${nllSeasonLabel(season)}`}
          title="Season Pulse"
          aside={<NllSeasonPicker season={season} onChange={setSeason} />}
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Goals per game"
            value={fmt(p.goalsPerGame)}
            note={loading ?? `both teams · ${p.games} regular-season games`}
          />
          <StatCard
            label="One-goal games"
            value={pct(p.oneGoalPct)}
            unit={p.oneGoalPct === null ? undefined : "%"}
            note={loading ?? `OT ${pct(p.otPct)}% · ~25% the last two seasons`}
          />
          <StatCard
            label="Home teams won"
            value={pct(p.homeWinPct)}
            unit={p.homeWinPct === null ? undefined : "%"}
            note={loading ?? `avg margin ${fmt(p.avgMargin)}`}
          />
          {season === nllSeasonOf() ? (
            <StatCard
              label="Lines to capture"
              value={String(capture.need)}
              note={`next 10 days · ${capture.open} opening, ${capture.close} closing saved`}
              tone={capture.need ? "loss" : "win"}
            />
          ) : (
            <StatCard
              label="Games with lines"
              value={String(capture.lined)}
              note="lines saved from 2026-27 on"
            />
          )}
        </div>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-faint">
          {capture.lined} finished game{capture.lined === 1 ? "" : "s"} graded against saved lines ·{" "}
          <Link to="/nll/games" className="text-acc">
            All games →
          </Link>
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="min-w-0 space-y-6 lg:col-span-8">
          {live.length ? (
            <NllDashGames
              title="Live"
              games={live}
              season={s}
              lines={lines}
              emptyText=""
              aside={<span className="label-mono text-acc">now</span>}
            />
          ) : null}
          {upcoming.length ? (
            <NllDashGames
              title="Upcoming games"
              games={upcoming}
              season={s}
              lines={lines}
              emptyText=""
              aside={
                <span className="label-mono">
                  capture opening when posted, closing within 3 h of the start
                </span>
              }
            />
          ) : null}
          <NllDashGames
            title="Recent games"
            games={recent}
            season={s}
            lines={lines}
            emptyText={
              q.isLoading
                ? "Loading games from ESPN…"
                : q.isError
                  ? "Couldn't reach ESPN. Try again in a minute."
                  : "No games yet."
            }
            aside={
              <Link to="/nll/games" className="font-mono text-[11px] text-acc">
                View all →
              </Link>
            }
          />
          <NllSourceNote />
        </section>

        <aside className="min-w-0 space-y-6 lg:col-span-4">
          <Panel>
            <h2 className="font-disp text-xl font-semibold uppercase tracking-tight">Team grid</h2>
            <p className="label-mono mb-3">{s?.teams.length ?? 0} teams · tap to open</p>
            <div className="grid grid-cols-4 gap-2">
              {(s?.teams ?? []).map((team) => (
                <Link
                  key={team.id}
                  to="/nll/teams/$teamId"
                  params={{ teamId: team.id }}
                  className="glass grid aspect-square place-items-center rounded-xl hover:glow"
                  title={team.name}
                >
                  <NllLogo team={team} className="size-9" />
                </Link>
              ))}
            </div>
            <Link
              to="/nll/teams"
              className="mt-3 block text-center font-mono text-[10px] uppercase tracking-wider text-acc"
            >
              + all teams
            </Link>
          </Panel>
          <StandingsPanel rows={table} />
          <NllNewsPanel
            items={(news.data ?? []).slice(0, 6)}
            empty={news.isLoading ? "Loading…" : undefined}
          />
        </aside>
      </div>
    </>
  );
}
