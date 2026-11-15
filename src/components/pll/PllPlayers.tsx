import { useMemo } from "react";
import { Panel, PanelHeader } from "@/components/shared/booth";
import { PllLogo } from "@/components/pll/PllBits";
import type { PllSeason } from "@/lib/pll/pll";
import { teamOf } from "@/lib/pll/pll";
import { pllLeaders, pllLeadersPage, pllRoster, posRank } from "@/lib/pll/players";

const wiki = (page: string) => `https://en.wikipedia.org/wiki/${page}`;

function WikiCredit({ page, what }: { page: string; what: string }) {
  return (
    <p className="px-4 py-2 font-mono text-[10px] text-faint">
      {what} from{" "}
      <a className="underline hover:text-mute" href={wiki(page)} target="_blank" rel="noreferrer">
        Wikipedia
      </a>{" "}
      (CC BY-SA 4.0).
    </p>
  );
}

/** A season's statistical leaders (league-wide, or one club's players when teamId is given). */
export function PllLeaders({
  season,
  data,
  teamId,
}: {
  season: number;
  data?: PllSeason;
  teamId?: string;
}) {
  const groups = useMemo(() => pllLeaders(season, teamId), [season, teamId]);
  const page = pllLeadersPage(season);
  if (!groups.length || !page) return null;
  return (
    <Panel padded={false}>
      <PanelHeader
        title={teamId ? "League leaders from this team" : "League leaders"}
        aside={<span className="label-mono">regular season</span>}
      />
      <div className="divide-y divide-line/5">
        {groups.map((g) => (
          <div key={g.stat} className="px-4 py-2">
            <div className="label-mono mb-1">{g.stat}</div>
            {g.rows.slice(0, 5).map((r) => {
              const t = r.team ? teamOf(data, r.team) : undefined;
              return (
                <div
                  key={`${r.player}-${r.rank}`}
                  className="flex items-center gap-2 py-0.5 text-sm"
                >
                  {!teamId && g.rows.length > 1 ? (
                    <span className="w-4 font-mono text-[10px] text-faint">{r.rank}</span>
                  ) : null}
                  {t ? <PllLogo team={t} className="size-4" /> : null}
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-semibold">{r.player}</span>
                    {t ? <span className="text-mute"> · {t.short}</span> : null}
                    {r.note ? (
                      <span className="font-mono text-[10px] text-acc"> · {r.note}</span>
                    ) : null}
                  </span>
                  <span className="font-mono tabular-nums">{r.value}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <WikiCredit page={page} what="Leaders" />
    </Panel>
  );
}

/** A club's latest roster from Wikipedia, shown for that season and later. */
export function PllRosterPanel({ teamId, season }: { teamId: string; season: number }) {
  const roster = pllRoster(teamId);
  const players = useMemo(
    () =>
      [...(roster?.players ?? [])].sort(
        (a, b) => posRank(a.pos) - posRank(b.pos) || Number(a.num) - Number(b.num),
      ),
    [roster],
  );
  if (!roster || !players.length || (roster.season != null && season < roster.season))
    return (
      <Panel>
        <p className="font-mono text-xs text-mute">
          {roster?.season
            ? `No ${season} roster. Wikipedia lists this club's ${roster.season} roster; pick ${roster.season} or later to see it.`
            : "No roster listed for this club."}
        </p>
      </Panel>
    );
  return (
    <Panel padded={false}>
      <PanelHeader
        title="Roster"
        aside={<span className="label-mono">{roster.season ?? ""} season roster</span>}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-faint">
              <th className="px-4 py-2 font-normal">#</th>
              <th className="px-2 py-2 font-normal">Player</th>
              <th className="px-2 py-2 font-normal">Pos</th>
              <th className="px-2 py-2 font-normal">Shot</th>
              <th className="px-2 py-2 font-normal">Ht / Wt</th>
              <th className="px-4 py-2 font-normal">College</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/5">
            {players.map((p) => (
              <tr key={`${p.num}-${p.name}`} className="hover:bg-line/5">
                <td className="px-4 py-1.5 font-mono tabular-nums text-mute">{p.num}</td>
                <td className="px-2 py-1.5 font-semibold">
                  {p.name}
                  {p.captain ? (
                    <span className="ml-1 font-mono text-[10px] text-acc">C</span>
                  ) : null}
                </td>
                <td className="px-2 py-1.5 text-mute">{p.pos}</td>
                <td className="px-2 py-1.5 text-mute">{p.shot ?? ""}</td>
                <td className="px-2 py-1.5 font-mono text-[11px] text-mute">
                  {[p.height, p.weight].filter(Boolean).join(" · ")}
                </td>
                <td className="px-4 py-1.5 text-mute">{p.college ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <WikiCredit
        page={roster.page}
        what={`Roster as listed on the team's Wikipedia page (${roster.season ?? "latest"}); not week-by-week, reserves not marked`}
      />
    </Panel>
  );
}
