import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Panel, PanelHeader } from "@/components/shared/booth";
import type { PllGame } from "@/lib/pll/pll";
import { ShowAll } from "@/components/pll/PllPlayers";
import { PLL_CLUB_SHORT, pllChampionships, pllDraft, posAbbr } from "@/lib/pll/players";
import { teamTrends, totalsTrends, type WL } from "@/lib/pll/trends";

const club = (id: string | null) => (id ? (PLL_CLUB_SHORT[id] ?? id) : "—");
const pct = (x: number | null | undefined) => (x == null ? "—" : `${Math.round(x * 100)}%`);
const n1 = (x: number | null | undefined) => (x == null ? "—" : x.toFixed(1));
const rec = (r: WL) => (r.w + r.l ? `${r.w}-${r.l}` : "—");

function Credit({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-2 font-mono text-[10px] text-faint">{children}</p>;
}

/** Every PLL championship game: champion, score, runner-up, title-game MVP, best regular season. */
export function PllChampionships({ season, limit }: { season: number; limit?: number }) {
  const [open, setOpen] = useState(false);
  const all = pllChampionships();
  if (!all.length) return null;
  const cut = limit !== undefined && all.length > limit;
  // cut short, keep the picked season's final in view
  const rows =
    cut && !open ? all.filter((c, i) => i < limit || c.season === season).slice(0, limit + 1) : all;
  return (
    <Panel padded={false}>
      <PanelHeader title="Champions" aside={<span className="label-mono">every season</span>} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[460px] text-sm">
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-faint">
              <th className="px-4 py-2 font-normal">Year</th>
              <th className="px-2 py-2 font-normal">Final</th>
              <th className="px-2 py-2 font-normal">Game MVP</th>
              <th className="px-4 py-2 font-normal">Best record</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/5">
            {rows.map((c) => (
              <tr key={c.season} className={c.season === season ? "bg-acc/5" : "hover:bg-line/5"}>
                <td className="px-4 py-1.5 font-mono tabular-nums text-mute">{c.season}</td>
                <td className="px-2 py-1.5">
                  {c.champion ? (
                    <Link
                      to="/pll/teams/$teamId"
                      params={{ teamId: c.champion }}
                      className="font-semibold hover:text-acc"
                    >
                      {club(c.champion)}
                    </Link>
                  ) : null}{" "}
                  <span className="font-mono tabular-nums">
                    {c.score[0]}–{c.score[1]}
                    {c.ot ? " OT" : ""}
                  </span>{" "}
                  <span className="text-mute">over {club(c.runnerUp)}</span>
                </td>
                <td className="px-2 py-1.5 text-mute">{c.mvp ?? "—"}</td>
                <td className="px-4 py-1.5 text-mute">{club(c.regularSeasonLeader)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cut ? <ShowAll open={open} total={all.length} onToggle={() => setOpen(!open)} /> : null}
      <Credit>
        Finals from Wikipedia&apos;s Premier Lacrosse League page (CC BY-SA 4.0), checked against
        the game scores on this site.
      </Credit>
    </Panel>
  );
}

/** How often the season's games went over common totals, plus average totals and overtime share. */
export function PllTotals({ games }: { games: PllGame[] }) {
  const t = useMemo(() => totalsTrends(games), [games]);
  if (!t.games) return null;
  return (
    <Panel padded={false}>
      <PanelHeader title="Totals" aside={<span className="label-mono">{t.games} games</span>} />
      <div className="grid grid-cols-3 gap-2 px-4 py-3 text-center">
        <div>
          <div className="label-mono">Avg total</div>
          <div className="font-mono text-lg tabular-nums">{n1(t.avgTotal)}</div>
        </div>
        <div>
          <div className="label-mono">Avg 1st half</div>
          <div className="font-mono text-lg tabular-nums">{n1(t.avgFirstHalf)}</div>
        </div>
        <div>
          <div className="label-mono">Went to OT</div>
          <div className="font-mono text-lg tabular-nums">{pct(t.otShare)}</div>
        </div>
      </div>
      <div className="grid grid-cols-5 border-t border-line/5 text-center">
        {t.overs.map((o) => (
          <div key={o.line} className="px-1 py-2">
            <div className="font-mono text-[10px] text-faint">O {o.line}</div>
            <div className="font-mono text-sm tabular-nums">{pct(o.over)}</div>
          </div>
        ))}
      </div>
      <Credit>
        Regular season and playoffs, final scores (2-point goals count 2, as books grade totals).
        First halves need quarter scores (2022 on).
      </Credit>
    </Panel>
  );
}

/** A club's scoring trends for the season: by quarter and half, and records by lead. */
export function PllTeamTrends({ games, teamId }: { games: PllGame[]; teamId: string }) {
  const t = useMemo(() => teamTrends(games, teamId), [games, teamId]);
  if (!t.games)
    return (
      <Panel>
        <p className="font-mono text-xs text-mute">No finished games this season.</p>
      </Panel>
    );
  const rows: [string, string][] = [
    ["Led after Q1", rec(t.ledAfterQ1)],
    ["Trailed after Q1", rec(t.trailedAfterQ1)],
    ["Led at half", rec(t.ledAtHalf)],
    ["Trailed at half", rec(t.trailedAtHalf)],
    ["Overtime", rec(t.overtime)],
    ["One-score games (≤2)", rec(t.close)],
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
                  ["For", t.forByQ, t.firstHalf?.for, t.secondHalf?.for],
                  ["Against", t.againstByQ, t.firstHalf?.against, t.secondHalf?.against],
                ] as const
              ).map(([label, qs, h1, h2]) => (
                <tr key={label}>
                  <td className="px-4 py-1.5 font-sans text-mute">{label}</td>
                  {qs.map((x, i) => (
                    <td key={i} className="px-2 py-1.5 text-right">
                      {n1(x)}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right">{n1(h1)}</td>
                  <td className="px-2 py-1.5 text-right">{n1(h2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Credit>No quarter scores before 2022.</Credit>
        )}
        <Credit>Average total in this team&apos;s games: {n1(t.avgTotal)}.</Credit>
      </Panel>
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
    </div>
  );
}

/** A club's college draft picks that year. */
export function PllDraftClass({ teamId, season }: { teamId: string; season: number }) {
  const picks = pllDraft(teamId, season);
  if (!picks.length) return null;
  return (
    <Panel padded={false}>
      <PanelHeader title={`${season} college draft`} />
      <div className="divide-y divide-line/5">
        {picks.map((p) => (
          <div
            key={`${p.round}-${p.pick}-${p.player}`}
            className="flex items-center gap-3 px-4 py-1.5 text-sm"
          >
            <span className="w-14 font-mono text-[10px] text-faint">
              R{p.round} · #{p.pick}
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold">{p.player}</span>
            <span className="font-mono text-xs text-mute">{posAbbr(p.pos)}</span>
            <span className="w-28 truncate text-right text-xs text-mute">{p.college}</span>
          </div>
        ))}
      </div>
      <Credit>From the team&apos;s Wikipedia page (CC BY-SA 4.0).</Credit>
    </Panel>
  );
}
