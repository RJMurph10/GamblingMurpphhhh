import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageTitle, Panel } from "@/components/shared/booth";
import { PllLogo, PllSeasonPicker } from "@/components/pll/PllBits";
import { standings } from "@/lib/pll/pll";
import { currentPllSeason, usePllSeason } from "@/lib/pll/use-pll";

export const Route = createFileRoute("/pll/teams/")({
  head: () => ({ meta: [{ title: "Teams — GamblingPLL" }] }),
  component: PllTeamsPage,
});

function PllTeamsPage() {
  const [season, setSeason] = useState(currentPllSeason());
  const q = usePllSeason(season);
  const rec = useMemo(
    () => new Map((q.data ? standings(q.data) : []).map((r) => [r.team.id, r])),
    [q.data],
  );
  const teams = q.data?.teams ?? [];
  return (
    <>
      <PageTitle
        eyebrow="Premier Lacrosse League"
        title={teams.length ? `All ${teams.length} teams` : "All teams"}
        aside={<PllSeasonPicker season={season} onChange={setSeason} />}
      />
      {teams.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {teams.map((t) => {
            const r = rec.get(t.id);
            return (
              <Link
                key={t.id}
                to="/pll/teams/$teamId"
                params={{ teamId: t.id }}
                className="glass flex items-center gap-3 p-4 hover:glow"
              >
                <PllLogo team={t} className="size-12" />
                <div className="min-w-0">
                  <div className="font-disp text-lg font-semibold uppercase leading-tight tracking-tight">
                    {t.short}
                  </div>
                  <div className="truncate text-xs text-mute">{t.location}</div>
                  <div className="mt-1 font-mono text-xs tabular-nums">
                    {r ? `${r.w}-${r.l} · ${r.gf - r.ga > 0 ? "+" : ""}${r.gf - r.ga}` : "—"}
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
