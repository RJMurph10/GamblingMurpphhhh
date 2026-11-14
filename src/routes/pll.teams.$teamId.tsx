import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageTitle, Panel, PanelHeader, StatCard } from "@/components/shared/booth";
import { PllGamesTable, PllLogo, PllSeasonPicker } from "@/components/pll/PllBits";
import { standings, teamOf } from "@/lib/pll/pll";
import { currentPllSeason, usePllSeason } from "@/lib/pll/use-pll";

export const Route = createFileRoute("/pll/teams/$teamId")({
  head: () => ({ meta: [{ title: "Team — GamblingPLL" }] }),
  component: PllTeamPage,
});

function PllTeamPage() {
  const { teamId } = Route.useParams();
  const [season, setSeason] = useState(currentPllSeason());
  const q = usePllSeason(season);
  const team = teamOf(q.data, teamId);
  const row = useMemo(
    () => (q.data ? standings(q.data).find((r) => r.team.id === teamId) : undefined),
    [q.data, teamId],
  );
  const rank = useMemo(
    () => (q.data ? standings(q.data).findIndex((r) => r.team.id === teamId) + 1 : 0),
    [q.data, teamId],
  );
  const games = useMemo(
    () =>
      [...(q.data?.games ?? [])]
        .filter((g) => g.home.teamId === teamId || g.away.teamId === teamId)
        .reverse(),
    [q.data, teamId],
  );
  const n = row ? row.w + row.l : 0;
  return (
    <>
      <PageTitle
        eyebrow="Premier Lacrosse League"
        title={team?.name ?? (q.isLoading ? "Loading…" : "Team")}
        aside={<PllSeasonPicker season={season} onChange={setSeason} />}
      />
      {team ? (
        <div className="mb-6 flex items-center gap-4">
          <PllLogo team={team} className="size-16" />
          <div className="font-mono text-xs text-mute">{team.location}</div>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Record"
          value={row ? `${row.w}-${row.l}` : "—"}
          note={rank ? `${rank} of ${standings(q.data!).length}` : "regular season"}
        />
        <StatCard label="Goals for / game" value={n ? (row!.gf / n).toFixed(1) : "—"} />
        <StatCard label="Goals against / game" value={n ? (row!.ga / n).toFixed(1) : "—"} />
        <StatCard
          label="Home / away"
          value={row ? `${row.home[0]}-${row.home[1]} / ${row.away[0]}-${row.away[1]}` : "—"}
        />
      </div>
      <Panel padded={false} className="mt-6">
        <PanelHeader title="Games" aside={<span className="label-mono">{games.length}</span>} />
        <PllGamesTable
          games={games}
          season={q.data}
          empty={q.isLoading ? "Loading…" : "No games this season."}
        />
      </Panel>
    </>
  );
}
