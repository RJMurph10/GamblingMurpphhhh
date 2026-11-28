/** Every book's latest lines for one game, best price per side highlighted, graded once the game is final. */
import { Panel, PanelHeader } from "@/components/shared/booth";
import { NllCaptureBadge } from "@/components/nll/NllBits";
import {
  american,
  bestPrices,
  bookName,
  captureStatus,
  disagreements,
  grade,
  isBest,
  latestByBook,
  signed,
  teamOf,
  type NllGame,
  type NllSeason,
  type NllSnapshot,
  type Result,
} from "@/lib/nll/nll";

const when = (iso: string) =>
  new Date(iso).toLocaleString([], {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

const Dash = () => <td className="px-2 py-1.5 text-right font-mono text-[12px] text-faint">—</td>;

export function NllBookLines({
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
    <Panel padded={false}>
      <PanelHeader
        title="Lines by book"
        aside={
          game.status === "final" ? (
            <span className="label-mono">green = that side won</span>
          ) : (
            <NllCaptureBadge status={captureStatus(game, snaps)} />
          )
        }
      />
      {latest.length ? (
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
                return (
                  <tr key={s.book}>
                    <td className="px-4 py-1.5">
                      {bookName(s.book)}
                      <span
                        className="block font-mono text-[10px] text-faint"
                        suppressHydrationWarning
                      >
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
                        <Dash />
                        <Dash />
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
                        <Dash />
                        <Dash />
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
                        <Dash />
                        <Dash />
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-4 py-2 font-mono text-[10px] text-faint">
            Highlighted = best price for that side and number.
            {flags.length ? <span className="text-acc"> ⚑ {flags.join(" · ")}</span> : null}
          </p>
        </div>
      ) : (
        <p className="px-4 py-6 text-center font-mono text-xs text-mute">
          No lines saved for this game
          {game.status === "final" ? "." : " yet. Send screenshots when the books post them."}
        </p>
      )}
    </Panel>
  );
}
