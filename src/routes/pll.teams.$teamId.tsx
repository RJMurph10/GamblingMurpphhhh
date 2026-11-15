import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageTitle, StatCard } from "@/components/shared/booth";
import { PllLogo, PllSeasonPicker } from "@/components/pll/PllBits";
import { PllDashGames } from "@/components/pll/PllDashGames";
import { PllDraftClass, PllTeamTrends } from "@/components/pll/PllHistory";
import { PllLeaders, PllRosterPanel } from "@/components/pll/PllPlayers";
import { PllTeamPlayerStats } from "@/components/pll/PllPlayerLink";
import { pllCoaches } from "@/lib/pll/players";
import { standings, teamOf } from "@/lib/pll/pll";
import { currentPllSeason, pllTeamSeasons, usePllLines, usePllSeason } from "@/lib/pll/use-pll";

export const Route = createFileRoute("/pll/teams/$teamId")({
  head: () => ({ meta: [{ title: "Team — GamblingPLL" }] }),
  component: PllTeamPage,
});

function PllTeamPage() {
  const { teamId } = Route.useParams();
  const seasons = useMemo(() => pllTeamSeasons(teamId), [teamId]);
  // open on the club's latest season (Chrome's is 2023)
  const [season, setSeason] = useState(() =>
    seasons.includes(currentPllSeason())
      ? currentPllSeason()
      : (seasons.at(-1) ?? currentPllSeason()),
  );
  const q = usePllSeason(season);
  const linesQ = usePllLines();
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
        // in date order, like a schedule
        .filter((g) => g.home.teamId === teamId || g.away.teamId === teamId),
    [q.data, teamId],
  );
  const n = row ? row.w + row.l : 0;
  const [tab, setTab] = useState<"schedule" | "roster" | "trends">("schedule");
  const coaches = pllCoaches(teamId, season);
  return (
    <>
      <PageTitle
        eyebrow="Premier Lacrosse League"
        title={team?.name ?? (q.isLoading ? "Loading…" : "Team")}
        aside={<PllSeasonPicker season={season} onChange={setSeason} seasons={seasons} />}
        leading={team ? <PllLogo team={team} className="size-12 shrink-0 sm:size-14" /> : undefined}
      />
      {team && (team.location || coaches.length) ? (
        <div className="mb-6 space-y-0.5 font-mono text-xs text-mute">
          {team.location ? <div>{team.location}</div> : null}
          {coaches.length ? <div>Head coach: {coaches.join(", ")}</div> : null}
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
      <div
        className="mt-6 grid grid-cols-3 gap-1 rounded-lg border border-line/10 p-1"
        role="tablist"
        aria-label="Team view"
      >
        {(
          [
            ["schedule", "Schedule"],
            ["roster", "Roster"],
            ["trends", "Trends"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={tab === v}
            onClick={() => setTab(v)}
            className={`rounded-md px-2 py-2.5 font-disp text-xs font-semibold uppercase tracking-wider transition-colors sm:text-sm ${tab === v ? "bg-acc text-black" : "text-mute hover:bg-line/5 hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "schedule" ? (
        <div className="mt-4">
          <PllDashGames
            title="Schedule"
            games={games}
            season={q.data}
            lines={linesQ.data}
            emptyText={q.isLoading ? "Loading…" : "No games this season."}
            aside={<span className="label-mono">{games.length} games</span>}
          />
        </div>
      ) : tab === "roster" ? (
        <div className="mt-4 space-y-6">
          <PllTeamPlayerStats teamId={teamId} season={season} data={q.data} />
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <PllRosterPanel teamId={teamId} season={season} />
            <div className="space-y-6">
              <PllLeaders season={season} data={q.data} teamId={teamId} />
              <PllDraftClass teamId={teamId} season={season} />
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <PllTeamTrends games={q.data?.games ?? []} teamId={teamId} />
        </div>
      )}
    </>
  );
}
