import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageTitle, Panel, PanelHeader, StatCard } from "@/components/shared/booth";
import { PllLogo } from "@/components/pll/PllBits";
import { collegeLogoFor } from "@/lib/pll/colleges";
import { teamOf, type PllGame, type PllSeason } from "@/lib/pll/pll";
import { posAbbr } from "@/lib/pll/players";
import {
  playerKind,
  pllPlayer,
  totalsOf,
  type PllPlayer,
  type PllPlayerGame,
} from "@/lib/pll/player-stats";
import { usePllSeason } from "@/lib/pll/use-pll";

export const Route = createFileRoute("/pll/players/$playerId")({
  head: ({ params }) => {
    const p = pllPlayer(params.playerId);
    return { meta: [{ title: `${p?.name ?? "Player"} — PLL stats — GamblingPLL` }] };
  },
  component: PllPlayerPage,
});

const pct = (x: number | null, digits = 1) => (x == null ? "—" : `${(x * 100).toFixed(digits)}%`);
const per = (n: number, gp: number) => (gp ? (n / gp).toFixed(1) : "—");
const dash = (x: number | null | undefined) => (x == null ? "—" : String(x));

/** The site's game for a log row: same opponent, within a day and a half of the sheet's date. */
function findGame(season: PllSeason | undefined, g: PllPlayerGame): PllGame | undefined {
  const t = new Date(`${g.date}T12:00:00Z`).getTime();
  return season?.games.find(
    (x) =>
      Math.abs(new Date(x.date).getTime() - t) <= 1.5 * 86_400_000 &&
      [x.home.teamId, x.away.teamId].includes(g.teamId) &&
      [x.home.teamId, x.away.teamId].includes(g.opponentId),
  );
}

function Bio({ p }: { p: PllPlayer }) {
  const college = p.bio.college;
  const logo = collegeLogoFor(college);
  const bits = [
    p.num ? `#${p.num}` : null,
    posAbbr(p.pos),
    p.bio.experience
      ? `${p.bio.experience}${["th", "st", "nd", "rd"][p.bio.experience] ?? "th"} PLL season`
      : null,
    [p.bio.height, p.bio.weight].filter(Boolean).join(" · ") || null,
    p.bio.shot ? `Shoots ${p.bio.shot[0]}` : null,
    p.bio.hometown ?? null,
  ].filter(Boolean);
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-mute">
      {bits.map((b, i) => (
        <span key={i}>{b}</span>
      ))}
      {college ? (
        <span className="inline-flex items-center gap-1.5">
          {logo ? <img src={logo} alt="" className="size-5 object-contain" /> : null}
          {college}
        </span>
      ) : null}
    </div>
  );
}

function PllPlayerPage() {
  const { playerId } = Route.useParams();
  const p = pllPlayer(playerId);
  const season = p?.games[p.games.length - 1]?.season ?? 2026;
  const q = usePllSeason(season);
  const games = useMemo(() => (p ? p.games.filter((g) => g.season === season) : []), [p, season]);
  const t = useMemo(() => totalsOf(games), [games]);
  const last5 = useMemo(() => totalsOf(games.slice(-5)), [games]);
  if (!p)
    return (
      <Panel>
        <p className="py-8 text-center font-mono text-xs text-mute">
          No stats entered for this player yet.{" "}
          <Link to="/pll/players" className="text-acc">
            All players →
          </Link>
        </p>
      </Panel>
    );
  const kind = playerKind(p);
  const team = teamOf(q.data, p.teamId);
  const rows = [...games].reverse();
  const showFO = games.some((g) => (g.stats.FOT ?? 0) > 0);
  const showSv = kind === "goalie";

  return (
    <>
      <PageTitle
        eyebrow={`PLL ${season} · ${team?.name ?? p.team}`}
        title={p.name}
        leading={
          <Link to="/pll/teams/$teamId" params={{ teamId: p.teamId }}>
            <PllLogo team={team} className="size-12 shrink-0 sm:size-14" />
          </Link>
        }
      />
      <Bio p={p} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kind === "goalie" ? (
          <>
            <StatCard
              label="Save %"
              value={pct(t.svPct)}
              note={`${t.Sv} saves · ${t.GA} goals against`}
            />
            <StatCard label="Saves per game" value={per(t.Sv, t.gp)} note={`${t.gp} games`} />
            <StatCard
              label="Goals against per game"
              value={per(t.GA, t.gp)}
              note="2-point goals count once"
            />
            <StatCard
              label="Ground balls"
              value={String(t.GB)}
              note={`${per(t.GB, t.gp)} per game`}
            />
          </>
        ) : kind === "faceoff" ? (
          <>
            <StatCard
              label="Faceoff %"
              value={pct(t.foPct)}
              note={`${t.FOW}-${t.FOT - t.FOW} on draws`}
            />
            <StatCard
              label="Ground balls"
              value={String(t.GB)}
              note={`${per(t.GB, t.gp)} per game`}
            />
            <StatCard label="Points" value={String(t.P)} note={`${t.G} goals · ${t.A} assists`} />
            <StatCard
              label="Games"
              value={String(t.gp)}
              note={`${per(t.FOW, t.gp)} draws won per game`}
            />
          </>
        ) : (
          <>
            <StatCard
              label="Points"
              value={String(t.P)}
              note={`${per(t.P, t.gp)} per game · ${t.gp} games`}
            />
            <StatCard
              label="Goals"
              value={String(t.G)}
              note={`${t.G1} one-point · ${t.G2} two-point · ${per(t.G, t.gp)}/game`}
            />
            <StatCard label="Assists" value={String(t.A)} note={`${per(t.A, t.gp)} per game`} />
            <StatCard
              label="Shots"
              value={String(t.Sh)}
              note={`${pct(t.shPct)} shooting · ${per(t.Sh, t.gp)}/game`}
            />
          </>
        )}
      </div>

      {games.length >= 5 ? (
        <Panel padded={false} className="mt-6">
          <PanelHeader
            title="Last 5 games vs season"
            aside={<span className="label-mono">per game</span>}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] font-mono text-sm tabular-nums">
              <thead>
                <tr className="text-right text-[10px] uppercase tracking-wider text-faint">
                  <th className="px-4 py-2 text-left font-normal" />
                  {(kind === "goalie"
                    ? ["Saves", "GA", "Sv%"]
                    : ["Points", "Goals", "Assists", "Shots", "GB", ...(showFO ? ["FO%"] : [])]
                  ).map((h) => (
                    <th key={h} className="px-3 py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/5">
                {(
                  [
                    ["Last 5", last5],
                    ["Season", t],
                  ] as const
                ).map(([label, x]) => (
                  <tr key={label}>
                    <td className="px-4 py-1.5 text-left font-sans text-mute">{label}</td>
                    {kind === "goalie" ? (
                      <>
                        <td className="px-3 py-1.5 text-right">{per(x.Sv, x.gp)}</td>
                        <td className="px-3 py-1.5 text-right">{per(x.GA, x.gp)}</td>
                        <td className="px-3 py-1.5 text-right">{pct(x.svPct)}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-1.5 text-right">{per(x.P, x.gp)}</td>
                        <td className="px-3 py-1.5 text-right">{per(x.G, x.gp)}</td>
                        <td className="px-3 py-1.5 text-right">{per(x.A, x.gp)}</td>
                        <td className="px-3 py-1.5 text-right">{per(x.Sh, x.gp)}</td>
                        <td className="px-3 py-1.5 text-right">{per(x.GB, x.gp)}</td>
                        {showFO ? <td className="px-3 py-1.5 text-right">{pct(x.foPct)}</td> : null}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <Panel padded={false} className="mt-6">
        <PanelHeader
          title="Game log"
          aside={<span className="label-mono">{games.length} games</span>}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-right font-mono text-[10px] uppercase tracking-wider text-faint">
                <th className="px-4 py-2 text-left font-normal">Date</th>
                <th className="px-2 py-2 text-left font-normal">Opp</th>
                <th className="px-2 py-2 text-left font-normal">Result</th>
                <th className="px-2 py-2 font-normal">P</th>
                <th className="px-2 py-2 font-normal">G</th>
                <th className="px-2 py-2 font-normal">2PG</th>
                <th className="px-2 py-2 font-normal">A</th>
                <th className="px-2 py-2 font-normal">Sh</th>
                <th className="px-2 py-2 font-normal">GB</th>
                <th className="px-2 py-2 font-normal">TO</th>
                <th className="px-2 py-2 font-normal">CT</th>
                <th className="px-2 py-2 font-normal">TCH</th>
                {showFO ? <th className="px-2 py-2 font-normal">FO</th> : null}
                {showSv ? (
                  <>
                    <th className="px-2 py-2 font-normal">Sv</th>
                    <th className="px-2 py-2 font-normal">Sv%</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/5 font-mono tabular-nums">
              {rows.map((g) => {
                const game = findGame(q.data, g);
                const opp = teamOf(q.data, g.opponentId);
                const home = game?.home.teamId === g.teamId;
                const mine = game ? (home ? game.home.score : game.away.score) : null;
                const theirs = game ? (home ? game.away.score : game.home.score) : null;
                const won = mine != null && theirs != null && mine > theirs;
                const s = g.stats;
                const [mm, dd] = g.date.slice(5).split("-").map(Number);
                return (
                  <tr key={g.date} className="text-right hover:bg-line/5">
                    <td className="px-4 py-1.5 text-left text-mute">
                      {mm}/{dd}
                    </td>
                    <td className="px-2 py-1.5 text-left">
                      <span className="inline-flex items-center gap-1.5 font-sans">
                        <span className="text-[10px] text-faint">{game && !home ? "@" : "vs"}</span>
                        <PllLogo team={opp} className="size-5" />
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-left">
                      {game && mine != null && theirs != null ? (
                        <Link
                          to="/pll/games/$gameId"
                          params={{ gameId: game.id }}
                          className={`hover:text-acc ${won ? "text-win" : "text-loss"}`}
                        >
                          {won ? "W" : "L"} {mine}-{theirs}
                        </Link>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 font-semibold">{s.P}</td>
                    <td className="px-2 py-1.5">{s.G1 + s.G2}</td>
                    <td className="px-2 py-1.5">{s.G2}</td>
                    <td className="px-2 py-1.5">{s.A}</td>
                    <td className="px-2 py-1.5">{s.Sh}</td>
                    <td className="px-2 py-1.5">{s.GB}</td>
                    <td className="px-2 py-1.5">{dash(s.TO)}</td>
                    <td className="px-2 py-1.5">{dash(s.CT)}</td>
                    <td className="px-2 py-1.5 text-mute">{s.TCH}</td>
                    {showFO ? (
                      <td className="px-2 py-1.5">{s.FOT ? `${s.FOW}/${s.FOT}` : "—"}</td>
                    ) : null}
                    {showSv ? (
                      <>
                        <td className="px-2 py-1.5">{dash(s.Sv)}</td>
                        <td className="px-2 py-1.5">{s.SvPct == null ? "—" : `${s.SvPct}%`}</td>
                      </>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2 font-mono text-[10px] text-faint">
          From the PLL&apos;s game box scores, entered by the site owner and checked against every
          game&apos;s final score. G includes 2-point goals (2PG); points count a 2-point goal as 2.
          TO and CT show — where the box score lists the player only in the other section.
        </p>
      </Panel>
    </>
  );
}
