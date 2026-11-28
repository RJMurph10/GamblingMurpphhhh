import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageTitle, Panel, PanelHeader, StatCard } from "@/components/shared/booth";
import { NllLogo } from "@/components/nll/NllBits";
import { getNllLines, getNllSeason } from "@/lib/nll/nll.functions";
import {
  american,
  bestPrices,
  bookName,
  captureStatus,
  disagreements,
  grade,
  isBest,
  latestByBook,
  nllSeasonLabel,
  nllSeasonOf,
  nllStandings,
  signed,
  snapshotsFor,
  teamOf,
  type NllGame,
  type NllSeason,
  type NllSnapshot,
  type Result,
} from "@/lib/nll/nll";

export const Route = createFileRoute("/nll/")({
  head: () => ({
    meta: [
      { title: "Lines desk — GamblingNLL" },
      {
        name: "description",
        content:
          "NLL schedule with which games still need sportsbook lines captured, every saved line by book with the best price, results graded against the lines, and standings.",
      },
    ],
  }),
  component: NllDashboard,
});

const DAY = 86_400_000;
const when = (iso: string) =>
  new Date(iso).toLocaleString([], {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const dayKey = (iso: string) =>
  new Date(iso).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

const STATUS: Record<"none" | "open" | "close", { label: string; cls: string }> = {
  none: { label: "No lines yet", cls: "bg-loss/15 text-loss" },
  open: { label: "Opening saved", cls: "bg-acc/15 text-acc" },
  close: { label: "Closing saved", cls: "bg-win/15 text-win" },
};

const tone = (r: Result | null) =>
  r === "win" ? "text-win" : r === "loss" ? "text-loss" : r === "push" ? "text-mute" : "";

function Cell({
  line,
  price,
  best,
  result,
}: {
  line?: string;
  price: number;
  best: boolean;
  result: Result | null;
}) {
  return (
    <td className={`px-2 py-1.5 text-right font-mono text-[12px] tabular-nums ${tone(result)}`}>
      {line ? <span className="text-mute">{line} </span> : null}
      <span className={best ? "rounded bg-acc/15 px-1 font-semibold text-acc" : ""}>
        {american(price)}
      </span>
    </td>
  );
}

function LinesTable({
  game,
  season,
  snaps,
}: {
  game: NllGame;
  season: NllSeason;
  snaps: NllSnapshot[];
}) {
  const latest = latestByBook(snaps);
  const best = bestPrices(latest);
  const final = game.status === "final" && game.home.score != null && game.away.score != null;
  const a = teamOf(season, game.away.teamId);
  const h = teamOf(season, game.home.teamId);
  const flags = disagreements(latest);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-sm">
        <thead>
          <tr className="text-right font-mono text-[10px] uppercase tracking-wider text-faint">
            <th className="px-4 py-1.5 text-left font-normal">Book</th>
            <th className="px-2 py-1.5 font-normal">{a?.abbr} spread</th>
            <th className="px-2 py-1.5 font-normal">{h?.abbr} spread</th>
            <th className="px-2 py-1.5 font-normal">Over</th>
            <th className="px-2 py-1.5 font-normal">Under</th>
            <th className="px-2 py-1.5 font-normal">{a?.abbr} ML</th>
            <th className="px-4 py-1.5 font-normal">{h?.abbr} ML</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/5">
          {latest.map((s) => {
            const g = final ? grade(s, game.home.score!, game.away.score!) : null;
            const none = (
              <td className="px-2 py-1.5 text-right font-mono text-[12px] text-faint">—</td>
            );
            return (
              <tr key={s.book}>
                <td className="px-4 py-1.5">
                  {bookName(s.book)}
                  <span className="block font-mono text-[10px] text-faint" suppressHydrationWarning>
                    {when(s.captured)}
                  </span>
                </td>
                {s.spread ? (
                  <>
                    <Cell
                      line={signed(s.spread.away[0])}
                      price={s.spread.away[1]}
                      best={isBest(best, "spreadAway", s.spread.away[0], s.spread.away[1])}
                      result={g?.spreadAway ?? null}
                    />
                    <Cell
                      line={signed(s.spread.home[0])}
                      price={s.spread.home[1]}
                      best={isBest(best, "spreadHome", s.spread.home[0], s.spread.home[1])}
                      result={g?.spreadHome ?? null}
                    />
                  </>
                ) : (
                  <>
                    {none}
                    {none}
                  </>
                )}
                {s.total ? (
                  <>
                    <Cell
                      line={`o${s.total.line}`}
                      price={s.total.over}
                      best={isBest(best, "over", s.total.line, s.total.over)}
                      result={g?.over ?? null}
                    />
                    <Cell
                      line={`u${s.total.line}`}
                      price={s.total.under}
                      best={isBest(best, "under", s.total.line, s.total.under)}
                      result={g?.under ?? null}
                    />
                  </>
                ) : (
                  <>
                    {none}
                    {none}
                  </>
                )}
                {s.moneyline ? (
                  <>
                    <Cell
                      price={s.moneyline.away}
                      best={isBest(best, "mlAway", null, s.moneyline.away)}
                      result={g?.mlAway ?? null}
                    />
                    <Cell
                      price={s.moneyline.home}
                      best={isBest(best, "mlHome", null, s.moneyline.home)}
                      result={g?.mlHome ?? null}
                    />
                  </>
                ) : (
                  <>
                    {none}
                    {none}
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {flags.length ? (
        <p className="px-4 pb-2 font-mono text-[10px] text-acc">⚑ {flags.join(" · ")}</p>
      ) : null}
    </div>
  );
}

function GameCard({
  game,
  season,
  snaps,
}: {
  game: NllGame;
  season: NllSeason;
  snaps: NllSnapshot[];
}) {
  const a = teamOf(season, game.away.teamId);
  const h = teamOf(season, game.home.teamId);
  const st = STATUS[captureStatus(game, snaps)];
  const final = game.status === "final";
  return (
    <div className="border-b border-line/10 last:border-b-0">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <NllLogo team={a} className="size-6" />
          <span className="truncate">{a?.short ?? "?"}</span>
          {game.away.score != null ? (
            <span className="font-mono tabular-nums">{game.away.score}</span>
          ) : null}
          <span className="text-faint">@</span>
          {game.home.score != null ? (
            <span className="font-mono tabular-nums">{game.home.score}</span>
          ) : null}
          <span className="truncate">{h?.short ?? "?"}</span>
          <NllLogo team={h} className="size-6" />
        </span>
        <span className="font-mono text-[11px] text-mute" suppressHydrationWarning>
          {final
            ? `${game.detail || "Final"}`
            : game.status === "live"
              ? game.detail
              : when(game.date)}
        </span>
        {!final ? (
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${st.cls}`}
          >
            {st.label}
          </span>
        ) : null}
      </div>
      {snaps.length ? <LinesTable game={game} season={season} snaps={snaps} /> : null}
    </div>
  );
}

function NllDashboard() {
  const [season] = useState(nllSeasonOf());
  const s = useQuery({
    queryKey: ["nll-season", season],
    queryFn: () => getNllSeason({ data: { season } }),
    staleTime: 5 * 60_000,
    refetchInterval: (q) =>
      q.state.data?.games.some((g) => g.status === "live") ? 60_000 : 10 * 60_000,
    retry: 1,
  });
  const l = useQuery({
    queryKey: ["nll-lines", season],
    queryFn: () => getNllLines({ data: { season } }),
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: 1,
  });
  const data = s.data;
  const file = l.data;

  const view = useMemo(() => {
    if (!data) return null;
    const now = Date.now();
    const withSnaps = data.games.map((g) => ({ g, snaps: snapshotsFor(g, data, file) }));
    const upcoming = withSnaps.filter(
      ({ g }) => g.status !== "final" && new Date(g.date).getTime() < now + 10 * DAY,
    );
    const recent = withSnaps
      .filter(({ g }) => g.status === "final" && new Date(g.date).getTime() > now - 14 * DAY)
      .reverse();
    const finals = data.games.filter((g) => g.status === "final");
    const lined = withSnaps.filter(({ g, snaps }) => g.status === "final" && snaps.length);
    const closing = withSnaps.filter(({ g, snaps }) => captureStatus(g, snaps) === "close").length;
    const oneGoal = finals.filter(
      (g) => Math.abs((g.home.score ?? 0) - (g.away.score ?? 0)) === 1,
    ).length;
    const next = data.games.find(
      (g) => g.status === "scheduled" && new Date(g.date).getTime() > now,
    );
    const books = new Set((file?.snapshots ?? []).map((x) => x.book));
    return { upcoming, recent, finals, lined, closing, oneGoal, next, books };
  }, [data, file]);

  const standings = useMemo(() => (data ? nllStandings(data) : []), [data]);
  const byDay = useMemo(() => {
    const m = new Map<string, { g: NllGame; snaps: NllSnapshot[] }[]>();
    for (const x of view?.upcoming ?? []) {
      const k = dayKey(x.g.date);
      m.set(k, [...(m.get(k) ?? []), x]);
    }
    return [...m.entries()];
  }, [view]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 sm:px-5">
      <PageTitle eyebrow={`NLL · ${nllSeasonLabel(season)}`} title="Lines desk" />
      {s.isError ? (
        <Panel>
          <p className="font-mono text-xs text-loss">
            Couldn't reach ESPN for the NLL schedule. Try again in a minute.
          </p>
        </Panel>
      ) : null}
      {view ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Next game"
            value={
              view.next
                ? new Date(view.next.date).toLocaleDateString([], {
                    weekday: "short",
                    month: "numeric",
                    day: "numeric",
                  })
                : "—"
            }
            note={
              view.next
                ? `${teamOf(data, view.next.away.teamId)?.abbr} @ ${teamOf(data, view.next.home.teamId)?.abbr} · ${new Date(view.next.date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                : "No games scheduled"
            }
          />
          <StatCard
            label="Finished games with lines"
            value={`${view.lined.length}`}
            unit={` / ${view.finals.length}`}
            note={`${view.books.size} book${view.books.size === 1 ? "" : "s"} saved`}
          />
          <StatCard
            label="Closing lines captured"
            value={String(view.closing)}
            note="Within 3 hours of the start"
          />
          <StatCard
            label="One-goal games"
            value={
              view.finals.length ? `${Math.round((100 * view.oneGoal) / view.finals.length)}%` : "—"
            }
            note={`${view.oneGoal} of ${view.finals.length} this season · ~25% the last two`}
          />
        </div>
      ) : null}

      <Panel padded={false}>
        <PanelHeader
          title="Capture next"
          aside={
            <span className="label-mono">
              Next 10 days · opening when posted, closing within 3 h of the start
            </span>
          }
        />
        {s.isLoading ? (
          <p className="px-4 py-6 text-center font-mono text-xs text-mute">Loading…</p>
        ) : byDay.length ? (
          byDay.map(([day, games]) => (
            <div key={day}>
              <p
                className="label-mono border-b border-line/10 bg-line/5 px-4 py-1.5"
                suppressHydrationWarning
              >
                {day}
              </p>
              {games.map(({ g, snaps }) => (
                <GameCard key={g.id} game={g} season={data!} snaps={snaps} />
              ))}
            </div>
          ))
        ) : (
          <p className="px-4 py-6 text-center font-mono text-xs text-mute">
            No NLL games in the next 10 days.
          </p>
        )}
      </Panel>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_380px]">
        <Panel padded={false}>
          <PanelHeader
            title="Results vs the lines"
            aside={<span className="label-mono">Last 14 days · green = that side won</span>}
          />
          {view?.recent.length ? (
            view.recent.map(({ g, snaps }) => (
              <GameCard key={g.id} game={g} season={data!} snaps={snaps} />
            ))
          ) : (
            <p className="px-4 py-6 text-center font-mono text-xs text-mute">
              No finished games in the last two weeks.
            </p>
          )}
        </Panel>
        <Panel padded={false}>
          <PanelHeader
            title="Standings"
            aside={<span className="label-mono">W-L · goal diff</span>}
          />
          <div className="divide-y divide-line/5">
            {standings.map((r, i) => {
              const diff = r.gf - r.ga;
              return (
                <div key={r.team.id} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-4 font-mono text-[10px] text-faint">{i + 1}</span>
                  <NllLogo team={r.team} className="size-5" />
                  <span className="min-w-0 flex-1 truncate text-sm">{r.team.name}</span>
                  <span className="font-mono text-xs tabular-nums text-mute">
                    {r.w}-{r.l}
                  </span>
                  <span
                    className={`w-8 text-right font-mono text-[11px] tabular-nums ${diff > 0 ? "text-win" : diff < 0 ? "text-loss" : "text-mute"}`}
                  >
                    {diff > 0 ? "+" : ""}
                    {diff}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
      <p className="font-mono text-[10px] text-faint">
        Schedule and scores from ESPN. Lines are saved by hand from sportsbook screenshots (no odds
        feed carries the NLL); highlighted prices are the best on offer for that side and number.
      </p>
    </div>
  );
}
