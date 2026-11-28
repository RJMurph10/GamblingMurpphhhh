import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageTitle, Panel } from "@/components/shared/booth";
import { NllLogo, NllSeasonPicker } from "@/components/nll/NllBits";
import { nllSeasonOf, nllStandings } from "@/lib/nll/nll";
import { useNllSeason } from "@/lib/nll/use-nll";

export const Route = createFileRoute("/nll/teams/")({
  head: () => ({ meta: [{ title: "Teams — GamblingNLL" }] }),
  component: NllTeamsPage,
});

function NllTeamsPage() {
  const [season, setSeason] = useState(nllSeasonOf());
  const q = useNllSeason(season);
  const rows = useMemo(() => (q.data ? nllStandings(q.data) : []), [q.data]);
  return (
    <>
      <PageTitle
        eyebrow="National Lacrosse League"
        title={rows.length ? `All ${rows.length} teams` : "All teams"}
        aside={<NllSeasonPicker season={season} onChange={setSeason} />}
      />
      {rows.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((r) => {
            const diff = r.gf - r.ga;
            return (
              <Link
                key={r.team.id}
                to="/nll/teams/$teamId"
                params={{ teamId: r.team.id }}
                className="glass flex items-center gap-3 p-4 hover:glow"
              >
                <NllLogo team={r.team} className="size-12" />
                <div className="min-w-0">
                  <div className="font-disp text-lg font-semibold uppercase leading-tight tracking-tight">
                    {r.team.short}
                  </div>
                  <div className="truncate text-xs text-mute">
                    {r.team.name.replace(` ${r.team.short}`, "")}
                  </div>
                  <div className="mt-1 font-mono text-xs tabular-nums">
                    {r.w}-{r.l}
                    <span className={diff > 0 ? "text-win" : diff < 0 ? "text-loss" : "text-mute"}>
                      {" "}
                      · {diff > 0 ? "+" : ""}
                      {diff}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Panel>
          <p className="py-8 text-center font-mono text-xs text-mute">
            {q.isLoading ? "Loading teams…" : "No teams for this season."}
          </p>
        </Panel>
      )}
    </>
  );
}
