import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageTitle, StatCard } from "@/components/shared/booth";
import { NllLogo, NllSeasonPicker, NllSourceNote } from "@/components/nll/NllBits";
import { NllDashGames } from "@/components/nll/NllDashGames";
import { nllSeasonOf, nllStandings, teamLineRecord, teamOf } from "@/lib/nll/nll";
import { useNllLines, useNllSeason } from "@/lib/nll/use-nll";

export const Route = createFileRoute("/nll/teams/$teamId")({
  head: () => ({ meta: [{ title: "Team — GamblingNLL" }] }),
  component: NllTeamPage,
});

function NllTeamPage() {
  const { teamId } = Route.useParams();
  const [season, setSeason] = useState(nllSeasonOf());
  const q = useNllSeason(season);
  const linesQ = useNllLines(season);
  const team = teamOf(q.data, teamId);
  const table = useMemo(() => (q.data ? nllStandings(q.data) : []), [q.data]);
  const rank = table.findIndex((r) => r.team.id === teamId) + 1;
  const row = table[rank - 1];
  const games = useMemo(
    () => (q.data?.games ?? []).filter((g) => g.home.teamId === teamId || g.away.teamId === teamId),
    [q.data, teamId],
  );
  const lr = useMemo(
    () => (q.data ? teamLineRecord(q.data, linesQ.data, teamId) : null),
    [q.data, linesQ.data, teamId],
  );
  const home = games.filter(
    (g) => g.status === "final" && g.phase === "regular" && g.home.teamId === teamId,
  );
  const away = games.filter(
    (g) => g.status === "final" && g.phase === "regular" && g.away.teamId === teamId,
  );
  const won = (g: (typeof games)[number], me: "home" | "away") =>
    (g[me].score ?? 0) > (g[me === "home" ? "away" : "home"].score ?? 0);
  const n = row ? row.w + row.l : 0;
  return (
    <>
      <PageTitle
        eyebrow="National Lacrosse League"
        title={team?.name ?? (q.isLoading ? "Loading…" : "Team")}
        aside={<NllSeasonPicker season={season} onChange={setSeason} />}
        leading={team ? <NllLogo team={team} className="size-12 shrink-0 sm:size-14" /> : undefined}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Record"
          value={row ? `${row.w}-${row.l}` : "—"}
          note={rank ? `${rank} of ${table.length}` : "regular season"}
        />
        <StatCard
          label="Goals for / against"
          value={n ? `${(row!.gf / n).toFixed(1)} / ${(row!.ga / n).toFixed(1)}` : "—"}
          note="per game"
        />
        <StatCard
          label="Home / away"
          value={`${home.filter((g) => won(g, "home")).length}-${home.filter((g) => !won(g, "home")).length} / ${away.filter((g) => won(g, "away")).length}-${away.filter((g) => !won(g, "away")).length}`}
        />
        <StatCard
          label="Against the lines"
          value={
            lr && lr.ats.w + lr.ats.l + lr.ats.p
              ? `${lr.ats.w}-${lr.ats.l}${lr.ats.p ? `-${lr.ats.p}` : ""}`
              : "—"
          }
          note={
            lr && lr.ou.o + lr.ou.u
              ? `O/U ${lr.ou.o}-${lr.ou.u}${lr.ou.p ? `-${lr.ou.p}` : ""}`
              : "ATS · from saved lines"
          }
        />
      </div>
      <div className="mt-6 space-y-4">
        <NllDashGames
          title="Schedule"
          games={games}
          season={q.data}
          lines={linesQ.data}
          emptyText={q.isLoading ? "Loading…" : "No games this season."}
          aside={<span className="label-mono">{games.length} games</span>}
        />
        <NllSourceNote />
      </div>
    </>
  );
}
