import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageTitle, Panel, StatCard } from "@/components/shared/booth";
import { NllLogo, NllSourceNote } from "@/components/nll/NllBits";
import { NllDashGames } from "@/components/nll/NllDashGames";
import { NllTeamTrends } from "@/components/nll/NllTeamTrends";
import { getNllSeason } from "@/lib/nll/nll.functions";
import { homeArena, nllSeasonLabel, nllSeasonOf, nllStandings, teamOf } from "@/lib/nll/nll";
import { NLL_SEASONS, useNllLines } from "@/lib/nll/use-nll";

export const Route = createFileRoute("/nll/teams/$teamId")({
  head: () => ({ meta: [{ title: "Team — GamblingNLL" }] }),
  component: NllTeamPage,
});

function NllTeamPage() {
  const { teamId } = Route.useParams();
  // every season (cached and shared with the other NLL pages), to offer only the seasons this team played
  const qs = useQueries({
    queries: NLL_SEASONS.map((season) => ({
      queryKey: ["nll-season", season],
      queryFn: () => getNllSeason({ data: { season } }),
      staleTime: 5 * 60_000,
    })),
  });
  const played = NLL_SEASONS.filter((_, i) => qs[i].data?.teams.some((t) => t.id === teamId));
  const [season, setSeason] = useState(nllSeasonOf());
  // open on the team's latest season once we know which it played
  useEffect(() => {
    if (played.length && !played.includes(season)) setSeason(played[played.length - 1]);
  }, [played.join(","), season]); // eslint-disable-line react-hooks/exhaustive-deps
  const data = qs[NLL_SEASONS.indexOf(season)]?.data;
  const loading = qs.some((q) => q.isLoading);
  const linesQ = useNllLines(season);
  const team = teamOf(data, teamId) ?? qs.map((q) => teamOf(q.data, teamId)).find(Boolean);
  const table = useMemo(() => (data ? nllStandings(data) : []), [data]);
  const rank = table.findIndex((r) => r.team.id === teamId) + 1;
  const row = table[rank - 1];
  const games = useMemo(
    () => (data?.games ?? []).filter((g) => g.home.teamId === teamId || g.away.teamId === teamId),
    [data, teamId],
  );
  const finals = games.filter((g) => g.status === "final" && g.phase === "regular");
  const split = (side: "home" | "away") => {
    const gs = finals.filter((g) => g[side].teamId === teamId);
    const other = side === "home" ? "away" : "home";
    const w = gs.filter((g) => (g[side].score ?? 0) > (g[other].score ?? 0)).length;
    return `${w}-${gs.length - w}`;
  };
  const n = row ? row.w + row.l : 0;
  const arena = data ? homeArena(data, teamId) : undefined;
  const [tab, setTab] = useState<"schedule" | "trends">("schedule");
  return (
    <>
      <PageTitle
        eyebrow="National Lacrosse League"
        title={team?.name ?? (loading ? "Loading…" : "Team")}
        aside={
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Season">
            {(played.length ? played : [season]).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={s === season}
                onClick={() => setSeason(s)}
                className={`rounded-md px-2.5 py-1.5 font-mono text-xs font-semibold ${s === season ? "bg-acc text-black" : "text-mute hover:bg-line/5 hover:text-foreground"}`}
              >
                {nllSeasonLabel(s)}
              </button>
            ))}
          </div>
        }
        leading={team ? <NllLogo team={team} className="size-12 shrink-0 sm:size-14" /> : undefined}
      />
      {team && (team.location || arena) ? (
        <div className="mb-6 space-y-0.5 font-mono text-xs text-mute">
          {team.location ? <div>{team.location}</div> : null}
          {arena ? <div>Home arena: {arena}</div> : null}
        </div>
      ) : null}
      {!loading && !played.length ? (
        <Panel>
          <p className="py-8 text-center font-mono text-xs text-mute">
            This team isn&apos;t on any NLL schedule from 2023-24 on.
          </p>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Record"
              value={row ? `${row.w}-${row.l}` : "—"}
              note={rank ? `${rank} of ${table.length}` : "regular season"}
            />
            <StatCard label="Goals for / game" value={n ? (row!.gf / n).toFixed(1) : "—"} />
            <StatCard label="Goals against / game" value={n ? (row!.ga / n).toFixed(1) : "—"} />
            <StatCard label="Home / away" value={`${split("home")} / ${split("away")}`} />
          </div>
          <div
            className="mt-6 grid grid-cols-2 gap-1 rounded-lg border border-line/10 p-1"
            role="tablist"
            aria-label="Team view"
          >
            {(
              [
                ["schedule", "Schedule"],
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
          <div className="mt-4 space-y-4">
            {tab === "schedule" ? (
              <NllDashGames
                title="Schedule"
                games={games}
                season={data}
                lines={linesQ.data}
                emptyText={loading ? "Loading…" : "No games this season."}
                aside={<span className="label-mono">{games.length} games</span>}
              />
            ) : data ? (
              <NllTeamTrends season={data} teamId={teamId} lines={linesQ.data} />
            ) : null}
            <NllSourceNote />
          </div>
        </>
      )}
    </>
  );
}
