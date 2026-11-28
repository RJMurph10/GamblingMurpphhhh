/** A team's season trends: scoring by quarter, records by game state, and against the lines. */
import { useMemo } from "react";
import { Panel, PanelHeader } from "@/components/shared/booth";
import { nllTeamTrends, teamLineRecord, type NllLinesFile, type NllSeason } from "@/lib/nll/nll";

const n1 = (x: number | null | undefined) => (x == null ? "—" : x.toFixed(1));
const rec = (r: { w: number; l: number }) => (r.w + r.l ? `${r.w}-${r.l}` : "—");
const Credit = ({ children }: { children: React.ReactNode }) => (
  <p className="border-t border-line/10 px-4 py-2 font-mono text-[10px] text-faint">{children}</p>
);

export function NllTeamTrends({
  season,
  teamId,
  lines,
}: {
  season: NllSeason;
  teamId: string;
  lines?: NllLinesFile | null;
}) {
  const t = useMemo(() => nllTeamTrends(season, teamId, lines), [season, teamId, lines]);
  const lr = useMemo(() => teamLineRecord(season, lines, teamId), [season, lines, teamId]);
  if (!t.games)
    return (
      <Panel>
        <p className="font-mono text-xs text-mute">No finished games this season.</p>
      </Panel>
    );
  const h1 = t.forByQ.length
    ? { for: t.forByQ[0] + t.forByQ[1], against: t.againstByQ[0] + t.againstByQ[1] }
    : null;
  const h2 = t.forByQ.length
    ? { for: t.forByQ[2] + t.forByQ[3], against: t.againstByQ[2] + t.againstByQ[3] }
    : null;
  const rows: [string, string][] = [
    ["Led after Q1", rec(t.ledAfterQ1)],
    ["Trailed after Q1", rec(t.trailedAfterQ1)],
    ["Led at half", rec(t.ledAtHalf)],
    ["Trailed at half", rec(t.trailedAtHalf)],
    ["Led after Q3", rec(t.ledAfterQ3)],
    ["Trailed after Q3", rec(t.trailedAfterQ3)],
    ["Overtime", rec(t.overtime)],
    ["One-goal games", rec(t.oneGoal)],
    ["Decided by 5+", rec(t.blowouts)],
  ];
  const ats = lr.ats.w + lr.ats.l + lr.ats.p;
  const ou = lr.ou.o + lr.ou.u + lr.ou.p;
  const lineRows: [string, string][] = [
    ["Against the spread", ats ? `${lr.ats.w}-${lr.ats.l}${lr.ats.p ? `-${lr.ats.p}` : ""}` : "—"],
    ["Over / under", ou ? `${lr.ou.o}-${lr.ou.u}${lr.ou.p ? `-${lr.ou.p}` : ""}` : "—"],
    ["As the favorite (ML)", rec(t.asFavorite)],
    ["As the underdog (ML)", rec(t.asUnderdog)],
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel padded={false}>
        <PanelHeader
          title="Scoring by quarter"
          aside={<span className="label-mono">per game · {t.withQuarters} games</span>}
        />
        {t.forByQ.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="font-mono text-[10px] uppercase tracking-wider text-faint">
                <th className="px-4 py-2 text-left font-normal" />
                {["Q1", "Q2", "Q3", "Q4", "1H", "2H"].map((h) => (
                  <th key={h} className="px-2 py-2 text-right font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/5 font-mono tabular-nums">
              {(
                [
                  ["For", t.forByQ, h1?.for, h2?.for],
                  ["Against", t.againstByQ, h1?.against, h2?.against],
                ] as const
              ).map(([label, qs, a, b]) => (
                <tr key={label}>
                  <td className="px-4 py-1.5 font-sans text-mute">{label}</td>
                  {qs.map((x, i) => (
                    <td key={i} className="px-2 py-1.5 text-right">
                      {n1(x)}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right">{n1(a)}</td>
                  <td className="px-2 py-1.5 text-right">{n1(b)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Credit>No quarter scores yet.</Credit>
        )}
        <Credit>
          Average total in this team&apos;s games: {n1(t.avgTotal)}
          {t.last5.length
            ? ` · last ${t.last5.length}: ${t.last5.join(" ")} · streak ${t.streak}`
            : ""}
        </Credit>
      </Panel>
      <div className="space-y-6">
        <Panel padded={false}>
          <PanelHeader title="Records" aside={<span className="label-mono">W-L</span>} />
          <div className="divide-y divide-line/5">
            {rows.map(([label, v]) => (
              <div key={label} className="flex justify-between px-4 py-1.5 text-sm">
                <span className="text-mute">{label}</span>
                <span className="font-mono tabular-nums">{v}</span>
              </div>
            ))}
          </div>
          <Credit>Regular season and playoffs; ties after a quarter are left out.</Credit>
        </Panel>
        <Panel padded={false}>
          <PanelHeader
            title="Against the lines"
            aside={<span className="label-mono">DraftKings</span>}
          />
          <div className="divide-y divide-line/5">
            {lineRows.map(([label, v]) => (
              <div key={label} className="flex justify-between px-4 py-1.5 text-sm">
                <span className="text-mute">{label}</span>
                <span className="font-mono tabular-nums">{v}</span>
              </div>
            ))}
          </div>
          <Credit>
            From the lines saved from sportsbook screenshots (2026-27 on); DraftKings first, else
            the other books.
          </Credit>
        </Panel>
      </div>
    </div>
  );
}
