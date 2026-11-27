/** ★ NFL best bet: big-play receiver receiving-yards unders in rain or wind (plus tracked QB wind unders). */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Panel, PanelHeader } from "@/components/shared/booth";
import { SeasonTabs } from "@/components/nfl/SeasonTabs";
import { nflSeasonOf, seasonBook } from "@/lib/nfl/prop-seasons";
import { weatherText, type WeatherKind, type WeatherRecord } from "@/lib/nfl/weather-unders";
import { getWeatherUnders } from "@/lib/nfl/weather-unders.functions";

const when = (iso: string) =>
  new Date(iso).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
const price = (p: number | null) => (p === null ? "—" : p > 0 ? `+${p}` : String(p));
const pct = (x: number | null) => (x === null ? "" : `${Math.round(x * 100)}% of catches 20+ yds`);

function recText(r: WeatherRecord | undefined) {
  if (!r || r[0] + r[1] === 0) return "no bets yet";
  const [w, l, p, u] = r;
  return `${w}-${l}${p ? `-${p}` : ""} · ${u > 0 ? "+" : ""}${u.toFixed(1)}u`;
}

const KIND: Record<WeatherKind, string> = { wr: "★ Rec yds", qb: "Pass yds" };

export function WeatherUndersPanel() {
  const [season, setSeason] = useState(nflSeasonOf());
  const current = season === nflSeasonOf();
  const q = useQuery({
    queryKey: ["nfl-weather-unders", season],
    queryFn: () => getWeatherUnders({ data: { season } }),
    staleTime: 15 * 60_000,
    retry: 1,
  });
  const [showHistory, setShowHistory] = useState(false);
  const f = q.data;
  const now = Date.now();
  const upcoming = (f?.upcoming ?? []).filter((u) => Date.parse(u[0]) > now);
  const graded = [...(f?.picks ?? [])].reverse();
  const recent = showHistory ? graded : graded.slice(0, 10);
  const liveLabel = f
    ? new Date(`${f.liveFrom}T12:00:00Z`).toLocaleDateString([], { month: "short", day: "numeric" })
    : "";
  return (
    <Panel padded={false}>
      <PanelHeader
        title="★ Weather · Big-play receivers, under"
        aside={
          <div className="flex flex-wrap items-center gap-2">
            <SeasonTabs season={season} onChange={setSeason} />
            <span className="label-mono">
              {q.isLoading
                ? "Loading…"
                : f
                  ? current
                    ? `Live since ${liveLabel}: ${recText(f.record.wr.live)}`
                    : `${season}: ${recText(f.record.wr.replay)}`
                  : "No data for this season"}
            </span>
          </div>
        }
      />
      <div className="space-y-2 px-4 py-3 text-sm text-mute">
        <p>
          <span className="font-semibold text-foreground">
            ★ The under on a wide receiver&apos;s receiving yards when 18%+ of his catches go for
            20+ yards, his line is 40+, and the game is outdoors with rain (1+ mm) or 15+ mph wind
            in the forecast.
          </span>{" "}
          Deep balls are the first thing bad weather takes away, and the books don&apos;t shade
          these lines enough: 79-31 (71.8%), +37.7u at −115 over 2024–26, ahead every season
          (+14.0u, +17.3u, +6.4u). The same receivers in normal weather hit the under 58–60%.
        </p>
        <p className="font-mono text-[10px] text-faint">
          Picks lock the first time the forecast qualifies (with that forecast and line) and are
          graded live from {liveLabel || "Nov 27"} at DraftKings&apos; under price (−115 when none
          is saved). Earlier games are a replay on the recorded weather. Tracked, not ★: the QB
          passing-yards under in 15+ mph wind (46-20, +20.0u in 2024–26). Rain alone doesn&apos;t
          move passing yards.
        </p>
        {f ? (
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            {(["wr", "qb"] as const).map((k) => (
              <div key={k} className="rounded border border-line/10 px-3 py-2">
                <p className="label-mono">{k === "wr" ? "★ Receivers" : "Tracked · QBs in wind"}</p>
                {current ? (
                  <p className="text-foreground">Live {recText(f.record[k].live)}</p>
                ) : null}
                <p className="text-faint">
                  {current ? `${f.season} replay` : "Full season"} {recText(f.record[k].replay)}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {current ? (
        <div className="border-t border-line/10">
          <p className="label-mono px-4 pt-3">This week</p>
          {upcoming.length ? (
            <div className="divide-y divide-line/5">
              {upcoming.map((u) => (
                <div
                  key={`${u[1]}-${u[2]}-${u[4]}`}
                  className="flex items-center gap-3 px-4 py-2 font-mono text-[12px]"
                >
                  <span className="min-w-0 flex-1 truncate font-sans text-sm">
                    {u[2]}{" "}
                    <span className="font-mono text-[10px] text-faint">
                      {u[3]} · {u[1]} · <span suppressHydrationWarning>{when(u[0])}</span>
                    </span>
                    <span className="block font-mono text-[10px] text-acc">
                      {KIND[u[4]]} · {weatherText(u[8], f?.rule)}
                      {u[9] !== null ? ` · ${pct(u[9])}` : ""}
                    </span>
                  </span>
                  <span className={u[4] === "wr" ? "font-semibold text-foreground" : "text-mute"}>
                    Under {u[7] ?? u[5]}
                  </span>
                  <span className="w-12 text-right text-mute">{price(u[6])}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-3 font-mono text-[11px] text-mute">
              {q.isLoading
                ? "Loading…"
                : "No qualifying spots in this week's forecasts yet. Forecasts are checked every day, so spots can still show up closer to kickoff."}
            </p>
          )}
        </div>
      ) : null}
      {recent.length ? (
        <div className="overflow-x-auto border-t border-line/10">
          <p className="label-mono px-4 pt-3">
            {current ? "This season" : `${season} season`} · graded at {seasonBook(season)}&apos;s
            opening line
          </p>
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-faint">
                <th className="px-4 py-2 font-normal">Date</th>
                <th className="px-2 py-2 font-normal">Player</th>
                <th className="px-2 py-2 text-right font-normal">Line</th>
                <th className="px-2 py-2 text-right font-normal">Price</th>
                <th className="px-4 py-2 text-right font-normal">Yds</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/5">
              {recent.map((p) => (
                <tr key={`${p[1]}-${p[2]}-${p[0]}-${p[4]}`}>
                  <td
                    className="px-4 py-2 font-mono text-[11px] text-mute"
                    suppressHydrationWarning
                  >
                    {new Date(p[0]).toLocaleDateString([], { month: "numeric", day: "numeric" })}
                  </td>
                  <td className="px-2 py-2">
                    {p[2]} <span className="font-mono text-[10px] text-faint">{p[3]}</span>
                    <span className="block font-mono text-[10px] text-acc">
                      {KIND[p[4]]} · {weatherText(p[9], f?.rule)}
                      {p[11] ? " · live" : ""}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">u{p[5]}</td>
                  <td className="px-2 py-2 text-right font-mono text-[11px] text-mute">
                    {price(p[6])}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-mono tabular-nums ${p[8] === "win" ? "text-win" : p[8] === "loss" ? "text-loss" : "text-mute"}`}
                  >
                    {p[7]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {graded.length > 10 ? (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="block w-full border-t border-line/10 px-4 py-2.5 text-center font-mono text-[11px] uppercase tracking-wider text-acc hover:bg-line/5"
            >
              {showHistory ? "Show latest 10" : `Show all ${graded.length} graded picks`}
            </button>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
