import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Panel } from "@/components/shared/booth";
import { getClosedProps, getHalftimeLines } from "@/lib/shared/prop-history.functions";
import type { HalftimeLeague, HalftimeProp, Priced } from "@/lib/shared/halftime.server";

const odds = (p: number | null | undefined) => (p == null ? "—" : p > 0 ? `+${p}` : String(p));
const signed = (x: number) => (x > 0 ? `+${x}` : String(x));
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")
    .replace(/[^a-z]/g, "");
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/**
 * The Props tab of a live game: "Pregame" (the tab as it was) and "Halftime live" (every book's lines at
 * the break). Finished and upcoming games show the pregame view only.
 */
export function LivePropsViews({
  live,
  pregame,
  halftime,
}: {
  live: boolean;
  pregame: ReactNode;
  halftime: ReactNode;
}) {
  const [view, setView] = useState<"pregame" | "halftime">("pregame");
  if (!live) return <>{pregame}</>;
  return (
    <div className="space-y-6">
      <div
        className="grid grid-cols-2 gap-1 rounded-lg border border-line/10 p-1"
        role="tablist"
        aria-label="Props view"
      >
        {(
          [
            ["pregame", "Pregame"],
            ["halftime", "Halftime live"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`rounded-md px-2 py-2.5 font-disp text-xs font-semibold uppercase tracking-wider transition-colors sm:text-sm ${view === v ? "bg-acc text-black" : "text-mute hover:bg-line/5 hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "pregame" ? pregame : halftime}
    </div>
  );
}

function BestCell({ p, own }: { p: Priced; own: number | null }) {
  if (!p) return <span className="text-faint">—</span>;
  const better = own == null || p[0] !== own;
  return (
    <span title={p[1]} className={better ? "text-acc" : "text-mute"}>
      {odds(p[0])} <span className="text-[9px] text-faint">{p[1]}</span>
    </span>
  );
}

/** A live NFL / NBA game's halftime lines: game lines, then every player prop with 1st-half numbers. */
export function HalftimeLines({
  league,
  id,
  home,
  away,
}: {
  league: HalftimeLeague;
  id: string;
  home: string;
  away: string;
}) {
  const q = useQuery({
    queryKey: ["halftime-lines", league, id],
    queryFn: () => getHalftimeLines({ data: { league, id } }),
    // until it's saved, look again every minute
    refetchInterval: (query) => (query.state.data ? false : 60_000),
    staleTime: 60_000,
  });
  const closed = useQuery({
    queryKey: ["closed-props", league, id],
    queryFn: () => getClosedProps({ data: { league, id } }),
    staleTime: 30 * 60_000,
  });
  const pregame = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of closed.data?.props ?? []) m.set(`${norm(r[0])}|${r[2]}`, r[3]);
    return m;
  }, [closed.data]);
  const [market, setMarket] = useState("All");
  const data = q.data;
  const markets = useMemo(
    () => ["All", ...new Set((data?.props ?? []).map((p) => p.market))],
    [data],
  );

  if (q.isLoading) return <Note>Loading halftime lines…</Note>;
  if (!data)
    return (
      <Note>
        Halftime lines appear here about 5 minutes into halftime: every big book&apos;s live game
        lines, 2nd-half lines and player props, next to each player&apos;s 1st-half numbers.
      </Note>
    );

  const rows = data.props.filter((p) => market === "All" || p.market === market);
  const side = (p: HalftimeProp) => (p.side === "home" ? home : p.side === "away" ? away : "");
  return (
    <div className="space-y-6">
      <Panel>
        <h2 className="font-disp text-xl font-semibold uppercase tracking-tight">Halftime lines</h2>
        <p className="label-mono mt-1">
          Saved {clock(data.at)} · {away} {data.score.away}, {home} {data.score.home}
          {data.updated
            ? ` · book prices updated ${clock(data.updated[0])}–${clock(data.updated[1])}`
            : ""}
        </p>
        {data.games.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-right font-mono text-[10px] uppercase tracking-wider text-faint">
                  <th className="py-2 text-left font-normal" />
                  <th className="px-2 py-2 font-normal">Spread ({home})</th>
                  <th className="px-2 py-2 font-normal">Total</th>
                  <th className="px-2 py-2 font-normal">Moneyline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/5 font-mono tabular-nums">
                {data.games.map((g) => (
                  <tr key={g.period} className="text-right">
                    <td className="py-2 text-left font-sans text-mute">{g.period}</td>
                    <td className="px-2 py-2">
                      {g.spread ? (
                        <>
                          {signed(g.spread.line)}{" "}
                          <span className="text-mute">
                            {odds(g.spread.home)} / {odds(g.spread.away)}
                          </span>
                          <div className="text-[9px] text-faint">{g.spread.book}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {g.total ? (
                        <>
                          {g.total.line}{" "}
                          <span className="text-mute">
                            o{odds(g.total.over)} / u{odds(g.total.under)}
                          </span>
                          <div className="text-[9px] text-faint">{g.total.book}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {g.ml ? (
                        <>
                          {home} {odds(g.ml.home)} · {away} {odds(g.ml.away)}
                          <div className="text-[9px] text-faint">{g.ml.book}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 font-mono text-[11px] text-mute">
            No live game lines were open at the break.
          </p>
        )}
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-disp text-xl font-semibold uppercase tracking-tight">
              Live player props
            </h2>
            <p className="label-mono mt-1">
              DraftKings&apos; line where it had one, else the first big book with both sides open ·
              best price across {data.books.length ? data.books.join(", ") : "the books"}
            </p>
          </div>
          <select
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            className="rounded-md border border-line/10 bg-transparent px-2 py-1.5 font-mono text-xs"
            aria-label="Market"
          >
            {markets.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        {rows.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-right font-mono text-[10px] uppercase tracking-wider text-faint">
                  <th className="py-2 text-left font-normal">Player</th>
                  <th className="px-2 py-2 text-left font-normal">Market</th>
                  <th className="px-2 py-2 font-normal" title="1st-half number">
                    1H
                  </th>
                  <th className="px-2 py-2 font-normal" title="1st-half number × 2">
                    1H × 2
                  </th>
                  <th
                    className="px-2 py-2 font-normal"
                    title="DraftKings' closing line before the game"
                  >
                    Pregame
                  </th>
                  <th className="px-2 py-2 font-normal">Live line</th>
                  <th className="px-2 py-2 font-normal">Over</th>
                  <th className="px-2 py-2 font-normal">Under</th>
                  <th className="px-2 py-2 font-normal">Best over</th>
                  <th className="px-2 py-2 font-normal">Best under</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/5 font-mono tabular-nums">
                {rows.map((p) => {
                  const pre = pregame.get(`${norm(p.player)}|${p.market}`);
                  return (
                    <tr key={`${p.player}|${p.market}`} className="text-right hover:bg-line/5">
                      <td className="py-1.5 text-left font-sans">
                        <span className="font-semibold">{p.player}</span>{" "}
                        <span className="font-mono text-[10px] text-faint">{side(p)}</span>
                      </td>
                      <td className="px-2 py-1.5 text-left font-sans text-mute">{p.market}</td>
                      <td className="px-2 py-1.5">{p.firstHalf ?? "—"}</td>
                      <td className="px-2 py-1.5 text-mute">
                        {p.firstHalf != null ? p.firstHalf * 2 : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-mute">{pre ?? "—"}</td>
                      <td className="px-2 py-1.5 font-semibold">
                        {p.line}
                        <div className="text-[9px] font-normal text-faint">{p.book}</div>
                      </td>
                      <td className="px-2 py-1.5">{odds(p.over)}</td>
                      <td className="px-2 py-1.5">{odds(p.under)}</td>
                      <td className="px-2 py-1.5">
                        <BestCell p={p.bestOver} own={p.over} />
                      </td>
                      <td className="px-2 py-1.5">
                        <BestCell p={p.bestUnder} own={p.under} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 font-mono text-[11px] text-mute">
            No live player props were open at the break.
          </p>
        )}
        <p className="mt-3 font-mono text-[10px] text-faint">
          Lines as they stood about 5 minutes into halftime (SportsGameOdds free feed, which can lag
          a few minutes). 1H × 2 is plain pace, not a projection. No edges are flagged yet: halftime
          angles are only graded once enough games are saved.
        </p>
      </Panel>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="glass p-4 text-center font-mono text-[11px] text-mute">{children}</p>;
}
