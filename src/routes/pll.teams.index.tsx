import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageTitle, Panel } from "@/components/shared/booth";
import { PllLogo, PllSeasonPicker } from "@/components/pll/PllBits";
import {
  conferenceOf,
  conferenceRecords,
  standings,
  type PllConference,
  type PllStanding,
  type PllTeam,
} from "@/lib/pll/pll";
import { currentPllSeason, usePllSeason } from "@/lib/pll/use-pll";

export const Route = createFileRoute("/pll/teams/")({
  head: () => ({ meta: [{ title: "Teams — GamblingPLL" }] }),
  component: PllTeamsPage,
});

function TeamCard({
  team,
  row,
  conf,
}: {
  team: PllTeam;
  row?: PllStanding;
  conf?: { w: number; l: number };
}) {
  const diff = row ? row.gf - row.ga : 0;
  return (
    <Link
      to="/pll/teams/$teamId"
      params={{ teamId: team.id }}
      className="glass flex items-center gap-3 p-4 hover:glow"
    >
      <PllLogo team={team} className="size-12" />
      <div className="min-w-0">
        <div className="font-disp text-lg font-semibold uppercase leading-tight tracking-tight">
          {team.short}
        </div>
        {team.location ? <div className="truncate text-xs text-mute">{team.location}</div> : null}
        <div className="mt-1 font-mono text-xs tabular-nums">
          {row ? (
            <>
              {row.w}-{row.l}
              <span className={diff > 0 ? "text-win" : diff < 0 ? "text-loss" : "text-mute"}>
                {" "}
                · {diff > 0 ? "+" : ""}
                {diff}
              </span>
            </>
          ) : (
            "—"
          )}
        </div>
        {conf ? (
          <div className="font-mono text-[10px] tabular-nums text-mute">
            {conf.w}-{conf.l} in conference
          </div>
        ) : null}
      </div>
    </Link>
  );
}

function PllTeamsPage() {
  const [season, setSeason] = useState(currentPllSeason());
  const q = usePllSeason(season);
  const table = useMemo(() => (q.data ? standings(q.data) : []), [q.data]);
  const rec = useMemo(() => new Map(table.map((r) => [r.team.id, r])), [table]);
  const confRec = useMemo(() => (q.data ? conferenceRecords(q.data) : new Map()), [q.data]);
  // clubs only (no All-Star teams), in standings order, then any without a game yet
  const teams = useMemo(() => {
    const clubs = (q.data?.teams ?? []).filter((t) => !t.id.startsWith("as-"));
    const rank = (t: PllTeam) => {
      const i = table.findIndex((r) => r.team.id === t.id);
      return i < 0 ? table.length : i;
    };
    return [...clubs].sort((a, b) => rank(a) - rank(b) || a.short.localeCompare(b.short));
  }, [q.data, table]);
  const byConf = useMemo(() => {
    const groups = new Map<PllConference, PllTeam[]>();
    for (const t of teams) {
      const c = conferenceOf(t.id, season);
      if (c) groups.set(c, [...(groups.get(c) ?? []), t]);
    }
    return groups;
  }, [teams, season]);
  const grid = (list: PllTeam[], withConf: boolean) => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {list.map((t) => (
        <TeamCard
          key={t.id}
          team={t}
          row={rec.get(t.id)}
          conf={withConf ? confRec.get(t.id) : undefined}
        />
      ))}
    </div>
  );
  return (
    <>
      <PageTitle
        eyebrow="Premier Lacrosse League"
        title={teams.length ? `All ${teams.length} teams` : "All teams"}
        aside={<PllSeasonPicker season={season} onChange={setSeason} />}
      />
      {!teams.length ? (
        <Panel>
          <p className="py-8 text-center font-mono text-xs text-mute">
            {q.isLoading ? "Loading teams…" : "No teams for this season."}
          </p>
        </Panel>
      ) : byConf.size ? (
        <div className="space-y-6">
          {(["East", "West"] as const).map((c) =>
            byConf.get(c)?.length ? (
              <section key={c}>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="font-disp text-xl font-semibold uppercase tracking-tight">
                    {c}ern Conference
                  </h2>
                  <span className="label-mono">regular season</span>
                </div>
                {grid(byConf.get(c)!, true)}
              </section>
            ) : null,
          )}
        </div>
      ) : (
        grid(teams, false)
      )}
    </>
  );
}
