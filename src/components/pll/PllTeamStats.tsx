/** Team stats for a finished PLL game, laid out like the PLL game page: away | stat | home, by section. */
import { Panel, PanelHeader } from "@/components/shared/booth";
import { PllLogo } from "@/components/pll/PllBits";
import type { PllTeam } from "@/lib/pll/pll";
import type { PllTeamStatRow, PllTeamStatValue } from "@/lib/pll/team-stats";

const show = (v: PllTeamStatValue, kind: PllTeamStatRow["kind"]) => {
  if (v === null) return "—";
  if (Array.isArray(v)) return `${v[0]} of ${v[1]}`;
  return kind === "pct" ? `${v}%` : String(v);
};

/** The number a row compares on (power plays by goals scored). */
const size = (v: PllTeamStatValue) => (v === null ? 0 : Array.isArray(v) ? v[0] : v);

/** Stats where the smaller number is the better one. */
const LOWER_BETTER = new Set(["to", "pen", "pim"]);

export function PllTeamStats({
  rows,
  away,
  home,
}: {
  rows: PllTeamStatRow[];
  away?: PllTeam;
  home?: PllTeam;
}) {
  const sections = [...new Set(rows.map((r) => r.section))];
  return (
    <Panel padded={false}>
      <PanelHeader title="Team stats" />
      <div className="flex items-center justify-between border-b border-line/10 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-mute">
        <span className="flex items-center gap-2">
          <PllLogo team={away} className="size-5" />
          {away?.short}
        </span>
        <span className="flex items-center gap-2">
          {home?.short}
          <PllLogo team={home} className="size-5" />
        </span>
      </div>
      {sections.map((sec) => (
        <div key={sec} className="border-b border-line/10 last:border-b-0">
          <p className="label-mono px-4 pt-3">{sec}</p>
          <div className="divide-y divide-line/5">
            {rows
              .filter((r) => r.section === sec)
              .map((r) => {
                const a = size(r.away);
                const h = size(r.home);
                const total = a + h;
                const aLead = LOWER_BETTER.has(r.key) ? a < h : a > h;
                const hLead = LOWER_BETTER.has(r.key) ? h < a : h > a;
                return (
                  <div key={r.key} className="px-4 py-2">
                    <div className="flex items-center font-mono text-[12px] tabular-nums">
                      <span
                        className={`w-20 ${aLead ? "font-semibold text-foreground" : "text-mute"}`}
                      >
                        {show(r.away, r.kind)}
                      </span>
                      <span className="flex-1 text-center font-sans text-xs text-mute">
                        {r.label}
                      </span>
                      <span
                        className={`w-20 text-right ${hLead ? "font-semibold text-foreground" : "text-mute"}`}
                      >
                        {show(r.home, r.kind)}
                      </span>
                    </div>
                    {total > 0 ? (
                      <div className="mt-1 flex h-1 gap-0.5 overflow-hidden rounded-full">
                        <div
                          className={aLead ? "bg-acc" : "bg-line/25"}
                          style={{ width: `${(100 * a) / total}%` }}
                        />
                        <div
                          className={hLead ? "bg-acc" : "bg-line/25"}
                          style={{ width: `${(100 * h) / total}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
          </div>
        </div>
      ))}
      <p className="border-t border-line/10 px-4 py-2 font-mono text-[10px] text-faint">
        The PLL&apos;s team totals. Turnovers, passes, touches and caused turnovers include plays no
        player is credited with, so they can be higher than the players&apos; box scores add up to.
      </p>
    </Panel>
  );
}
