import { useState } from "react";
import { Panel, PanelHeader } from "@/components/shared/booth";
import { PllLogo } from "@/components/pll/PllBits";
import { teamOf, type PllGame, type PllSeason } from "@/lib/pll/pll";
import { isGoal, periodLabel, type PllPlay, type PllPlayKind } from "@/lib/pll/play-by-play";
import { usePllPlays } from "@/lib/pll/use-pll-plays";

const FILTERS = [
  ["all", "All plays"],
  ["goals", "Goals"],
  ["shots", "Shots"],
  ["fo", "Faceoffs"],
  ["pen", "Penalties"],
] as const;
type Filter = (typeof FILTERS)[number][0];

const keep = (f: Filter, k: PllPlayKind) =>
  f === "all" ||
  (f === "goals" && isGoal(k)) ||
  (f === "shots" && (k === "shot" || isGoal(k))) ||
  (f === "fo" && k === "fo") ||
  (f === "pen" && (k === "pen" || k === "viol"));

const GOAL_TAG: Partial<Record<PllPlayKind, string>> = {
  goal: "Goal",
  goal2: "2PT",
  goalpp: "PP",
  goal2pp: "PP 2PT",
};

/**
 * The game's play-by-play, from the owner's copies of the PLL game page: the PLL's win probability over
 * the game, then every play by period with the running score on goals. Finished games with a sheet only;
 * shows nothing otherwise.
 */
export function PllPlayByPlay({ game, season }: { game: PllGame; season?: PllSeason }) {
  const plays = usePllPlays(game);
  const [filter, setFilter] = useState<Filter>("all");
  const [period, setPeriod] = useState<number | "all">("all");
  if (!plays?.length) return null;
  const home = teamOf(season, game.home.teamId);
  const away = teamOf(season, game.away.teamId);
  const periods = [...new Set(plays.map((p) => p.period))].sort((a, b) => a - b);
  const shown = plays.filter(
    (p) =>
      p.kind !== "start" &&
      p.kind !== "end" &&
      keep(filter, p.kind) &&
      (period === "all" || p.period === period),
  );
  const chip = (on: boolean) =>
    `rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-wider ring-1 ${on ? "bg-acc/10 text-acc ring-acc/25" : "bg-panel2 text-mute ring-line/10 hover:text-acc"}`;
  return (
    <Panel padded={false}>
      <PanelHeader
        title="Play-by-play"
        aside={<span className="label-mono">{plays.length - 2} plays</span>}
      />
      <div className="space-y-4 p-4">
        <WinProbability plays={plays} homeName={home?.short} awayName={away?.short} />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilter(v)}
              aria-pressed={filter === v}
              className={chip(filter === v)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", ...periods] as (number | "all")[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              aria-pressed={period === p}
              className={chip(period === p)}
            >
              {p === "all" ? "Whole game" : periodLabel(p)}
            </button>
          ))}
        </div>
        <ul className="max-h-[640px] divide-y divide-line/5 overflow-y-auto">
          {shown.map((p, i) => {
            const t = p.teamId ? teamOf(season, p.teamId) : undefined;
            const goal = isGoal(p.kind);
            const newPeriod = i === 0 || shown[i - 1].period !== p.period;
            return (
              <li key={p.i}>
                {newPeriod && period === "all" ? (
                  <div className="bg-panel2 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-faint">
                    {p.period <= 4 ? `Quarter ${p.period}` : periodLabel(p.period)}
                  </div>
                ) : null}
                <div className="flex items-center gap-3 px-2 py-2 text-sm">
                  <span className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-wider text-faint">
                    {periodLabel(p.period)} {p.clock}
                  </span>
                  {t ? <PllLogo team={t} className="size-5" /> : <span className="size-5" />}
                  <span className={`min-w-0 flex-1 ${goal ? "font-semibold" : "text-mute"}`}>
                    {goal ? (
                      <span className="mr-2 rounded bg-acc/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-acc">
                        {GOAL_TAG[p.kind]}
                      </span>
                    ) : null}
                    {p.text}
                  </span>
                  {p.awayScore !== null && p.homeScore !== null ? (
                    <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums">
                      {p.awayScore}–{p.homeScore}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="font-mono text-[10px] text-faint">
          Play-by-play and win probability as the PLL publishes them on its game page. Stat totals
          on this site come from the PLL box score, which can differ by a groundball here and there.
        </p>
      </div>
    </Panel>
  );
}

/** The PLL's win probability for the home club over the game, with the quarters marked. */
function WinProbability({
  plays,
  homeName,
  awayName,
}: {
  plays: PllPlay[];
  homeName?: string;
  awayName?: string;
}) {
  const pts = plays.filter((p) => p.homeWp !== null);
  if (pts.length < 2) return null;
  const end = Math.max(4 * 720, plays[plays.length - 1].elapsed);
  const W = 600;
  const H = 160;
  const x = (s: number) => (s / end) * W;
  const y = (wp: number) => (1 - wp / 100) * H;
  // the final play settles it: the winner at 100%
  const last = plays[plays.length - 1];
  const finalWp =
    last.kind === "end" && pts.length
      ? (() => {
          const g = [...plays].reverse().find((p) => p.homeScore !== null);
          return g ? (g.homeScore! > g.awayScore! ? 100 : 0) : null;
        })()
      : null;
  const line = [
    ...pts.map((p) => `${x(p.elapsed).toFixed(1)},${y(p.homeWp!).toFixed(1)}`),
    ...(finalWp !== null ? [`${x(last.elapsed).toFixed(1)},${y(finalWp).toFixed(1)}`] : []),
  ].join(" ");
  const quarters = Array.from({ length: Math.floor(end / 720) }, (_, i) => (i + 1) * 720).filter(
    (s) => s < end,
  );
  return (
    <div>
      <div className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-wider text-mute">
        <span>Win probability</span>
        <span className="text-faint">PLL model</span>
      </div>
      <div className="flex gap-2">
        <div className="flex w-20 shrink-0 flex-col justify-between py-1 text-right font-mono text-[10px] uppercase tracking-wider text-mute">
          <span className="truncate">{homeName}</span>
          <span className="text-faint">50%</span>
          <span className="truncate">{awayName}</span>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-40 min-w-0 flex-1 rounded-lg bg-panel2"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${homeName ?? "Home"} win probability over the game`}
        >
          {quarters.map((s) => (
            <line
              key={s}
              x1={x(s)}
              x2={x(s)}
              y1="0"
              y2={H}
              stroke="currentColor"
              strokeOpacity="0.1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <line
            x1="0"
            x2={W}
            y1={H / 2}
            y2={H / 2}
            stroke="currentColor"
            strokeOpacity="0.2"
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={line}
            fill="none"
            stroke="var(--acc)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="mt-1 flex gap-2 font-mono text-[10px] uppercase tracking-wider text-faint">
        <span className="w-20 shrink-0" />
        <div className="flex min-w-0 flex-1">
          {[...quarters.map((_, i) => i), quarters.length].map((i) => {
            const from = i * 720;
            const to = Math.min(end, (i + 1) * 720);
            return (
              <span
                key={i}
                className="text-center"
                style={{ width: `${((to - from) / end) * 100}%` }}
              >
                {periodLabel(i + 1)}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
