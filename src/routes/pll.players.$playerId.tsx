import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageTitle, Panel, PanelHeader, StatCard } from "@/components/shared/booth";
import { PllLogo, PllSeasonPicker } from "@/components/pll/PllBits";
import { collegeLogoFor } from "@/lib/pll/colleges";
import { teamOf, type PllGame, type PllSeason, type PllTeam } from "@/lib/pll/pll";
import { PLL_CLUB_SHORT, pllDraftOf, posAbbr } from "@/lib/pll/players";
import { eraLogo } from "@/lib/pll/era-logos";
import { pllScheduledGame } from "@/lib/pll/schedule";
import { PLL_CLUB_IDS } from "@/lib/pll/player-stats";
import {
  playerKind,
  pllPlayer,
  pllSeasonClub,
  pllTracksTouches,
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

const ordinal = (n: number) =>
  `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? "th"}`;

/** "Drafted 2021 · 1st round, 1st overall · Atlas" (his latest pick if he was drafted twice). */
function Drafted({ p, season }: { p: PllPlayer; season?: PllSeason }) {
  const picks = pllDraftOf(p.name);
  if (!picks.length) return null;
  return (
    <div className="-mt-4 mb-6 space-y-1 font-mono text-xs text-mute">
      {picks.map((d) => (
        <div
          key={`${d.season}-${d.teamId}`}
          className="flex flex-wrap items-center gap-x-2 gap-y-1"
        >
          <span className="label-mono">Drafted {d.season}</span>
          <span>
            {ordinal(Number(d.round))} round, {ordinal(Number(d.pick))} overall
          </span>
          <span>·</span>
          <Link
            to="/pll/teams/$teamId"
            params={{ teamId: d.teamId }}
            className="inline-flex items-center gap-1.5 hover:text-acc"
          >
            <PllLogo team={teamOf(season, d.teamId)} className="size-4" />
            {d.team}
          </Link>
          {d.college && !p.bio.college ? (
            <span className="text-faint">from {d.college}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** A club as it looked that season: that year's logo, falling back to the loaded season's team. */
function clubIn(id: string, season: number, loaded?: PllSeason): PllTeam {
  const base = teamOf(loaded, id);
  const short = base?.short ?? PLL_CLUB_SHORT[id] ?? id;
  return {
    id,
    abbr: base?.abbr ?? short.slice(0, 3).toUpperCase(),
    name: base?.name ?? short,
    short,
    location: base?.location ?? "",
    logo: eraLogo(id, season) ?? base?.logo,
  };
}

/** "11 [logo] @ [logo] 13" like the games tables, his side's score bold when they won; links to the game. */
function Matchup({ g, game, season }: { g: PllPlayerGame; game?: PllGame; season?: PllSeason }) {
  // ESPN's game when loaded, else the owner's saved schedule (home/away and final score)
  const saved = game ? undefined : pllScheduledGame(g.date, g.team, g.opponent);
  const homeId =
    game?.home.teamId ?? (saved ? (PLL_CLUB_IDS[saved.home] ?? saved.home) : g.opponentId);
  const awayId = game?.away.teamId ?? (saved ? (PLL_CLUB_IDS[saved.away] ?? saved.away) : g.teamId);
  const away = clubIn(awayId, g.season, season);
  const home = clubIn(homeId, g.season, season);
  const as = game ? game.away.score : saved?.awayScore;
  const hs = game ? game.home.score : saved?.homeScore;
  const gameId = game?.id ?? saved?.espnId;
  const done = as != null && hs != null;
  const bold = (id: string, mine: number | null | undefined, theirs: number | null | undefined) =>
    done && mine! > theirs!
      ? id === g.teamId
        ? "text-win font-semibold"
        : "font-semibold"
      : "text-mute";
  const inner = (
    <span className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
      <span className="flex items-center justify-end gap-1.5">
        <span className={`w-5 text-right ${bold(awayId, as, hs)}`}>{done ? as : ""}</span>
        <PllLogo team={away} className="size-5" />
      </span>
      <span className="font-sans text-[11px] text-faint">@</span>
      <span className="flex items-center gap-1.5">
        <PllLogo team={home} className="size-5" />
        <span className={`w-5 text-left ${bold(homeId, hs, as)}`}>{done ? hs : ""}</span>
      </span>
    </span>
  );
  return gameId ? (
    <Link to="/pll/games/$gameId" params={{ gameId }} className="block hover:text-acc">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function Bio({ p }: { p: PllPlayer }) {
  const college = p.bio.college;
  const logo = collegeLogoFor(college);
  const bits = [
    p.num ? `#${p.num}` : null,
    posAbbr(p.pos),
    p.bio.experience
      ? `${p.bio.experience}${["th", "st", "nd", "rd"][p.bio.experience] ?? "th"} pro season`
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
  const seasons = useMemo(() => [...new Set((p?.games ?? []).map((g) => g.season))].sort(), [p]);
  const [picked, setPicked] = useState<number | null>(null);
  const season = picked ?? seasons[seasons.length - 1] ?? 2026;
  const q = usePllSeason(season);
  const games = useMemo(() => (p ? p.games.filter((g) => g.season === season) : []), [p, season]);
  const t = useMemo(() => totalsOf(games), [games]);
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
  // a whole season with one club shows that club (and that season's logo); a mid-season move keeps his current club
  const club = pllSeasonClub(p, season) ?? { team: p.team, teamId: p.teamId };
  const team = teamOf(q.data, club.teamId);
  const rows = [...games].reverse();
  const showFO = games.some((g) => (g.stats.FOT ?? 0) > 0);
  const showSv = kind === "goalie";
  // no touches before 2022: leave the column out rather than fill it with dashes
  const showTch = pllTracksTouches(season);

  return (
    <>
      <PageTitle
        eyebrow={`PLL ${season} · ${team?.name ?? club.team}`}
        title={p.name}
        leading={
          <Link to="/pll/teams/$teamId" params={{ teamId: club.teamId }}>
            <PllLogo team={team} className="size-12 shrink-0 sm:size-14" />
          </Link>
        }
      />
      <Bio p={p} />
      <Drafted p={p} season={q.data} />
      {seasons.length > 1 ? (
        <div className="mb-4">
          <PllSeasonPicker season={season} onChange={setPicked} seasons={seasons} />
        </div>
      ) : null}

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

      {seasons.length > 1 ? <SeasonsTable p={p} kind={kind} current={q.data} /> : null}

      <Panel padded={false} className="mt-6">
        <PanelHeader
          title="Game log"
          aside={<span className="label-mono">{games.length} games</span>}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead>
              <tr className="text-right font-mono text-[10px] uppercase tracking-wider text-faint">
                <th className="px-4 py-2 text-left font-normal">Date</th>
                <th className="px-2 py-2 text-center font-normal">Game</th>
                <th className="px-2 py-2 font-normal">P</th>
                <th className="px-2 py-2 font-normal">G</th>
                <th className="px-2 py-2 font-normal">2PG</th>
                <th className="px-2 py-2 font-normal">A</th>
                <th className="px-2 py-2 font-normal">Sh</th>
                <th className="px-2 py-2 font-normal">GB</th>
                <th className="px-2 py-2 font-normal">TO</th>
                <th className="px-2 py-2 font-normal">CT</th>
                {showTch ? <th className="px-2 py-2 font-normal">TCH</th> : null}
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
                const s = g.stats;
                const [mm, dd] = g.date.slice(5).split("-").map(Number);
                return (
                  <tr key={g.date} className="text-right hover:bg-line/5">
                    <td className="px-4 py-1.5 text-left text-mute">
                      {mm}/{dd}
                    </td>
                    <td className="px-2 py-1.5">
                      <Matchup g={g} game={game} season={q.data} />
                    </td>
                    <td className="px-2 py-1.5 font-semibold">{s.P}</td>
                    <td className="px-2 py-1.5">{s.G1 + s.G2}</td>
                    <td className="px-2 py-1.5">{s.G2}</td>
                    <td className="px-2 py-1.5">{s.A}</td>
                    <td className="px-2 py-1.5">{s.Sh}</td>
                    <td className="px-2 py-1.5">{s.GB}</td>
                    <td className="px-2 py-1.5">{dash(s.TO)}</td>
                    <td className="px-2 py-1.5">{dash(s.CT)}</td>
                    {showTch ? <td className="px-2 py-1.5 text-mute">{dash(s.TCH)}</td> : null}
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
          — means missing, not zero: the PLL&apos;s defensive stats leave out attackmen (so no
          caused turnovers for them) and its offensive stats leave out some defenders (so no
          turnovers).
        </p>
      </Panel>
    </>
  );
}

type Totals = ReturnType<typeof totalsOf>;

/** A player's season-by-season totals (one row per season and club), newest first, then his career. */
function SeasonsTable({
  p,
  kind,
  current,
}: {
  p: PllPlayer;
  kind: ReturnType<typeof playerKind>;
  current?: PllSeason;
}) {
  const groups = new Map<string, PllPlayerGame[]>();
  for (const g of p.games) {
    const k = `${g.season}|${g.teamId}`;
    groups.set(k, [...(groups.get(k) ?? []), g]);
  }
  const rows = [...groups.entries()]
    .map(([k, games]) => ({ label: k.split("|")[0], team: k.split("|")[1], t: totalsOf(games) }))
    .reverse();
  rows.push({ label: "Career", team: "", t: totalsOf(p.games) });
  const cols: [string, (t: Totals) => string][] =
    kind === "goalie"
      ? [
          ["Sv", (t) => String(t.Sv)],
          ["GA", (t) => String(t.GA)],
          ["Sv%", (t) => pct(t.svPct)],
          ["GB", (t) => String(t.GB)],
        ]
      : [
          ["P", (t) => String(t.P)],
          ["G", (t) => String(t.G)],
          ["2PG", (t) => String(t.G2)],
          ["A", (t) => String(t.A)],
          ["Sh", (t) => String(t.Sh)],
          ["Sh%", (t) => pct(t.shPct)],
          ["GB", (t) => String(t.GB)],
          ...(kind === "faceoff"
            ? [["FO%", (t: Totals) => pct(t.foPct)] as [string, (t: Totals) => string]]
            : []),
        ];
  return (
    <Panel padded={false} className="mt-6">
      <PanelHeader title="By season" aside={<span className="label-mono">totals</span>} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] font-mono text-sm tabular-nums">
          <thead>
            <tr className="text-right text-[10px] uppercase tracking-wider text-faint">
              <th className="px-4 py-2 text-left font-normal">Season</th>
              <th className="px-2 py-2 text-left font-normal">Team</th>
              <th className="px-2 py-2 font-normal">GP</th>
              {cols.map(([h]) => (
                <th key={h} className="px-2 py-2 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/5">
            {rows.map((r) => (
              <tr
                key={`${r.label}|${r.team}`}
                className={`text-right ${r.label === "Career" ? "font-semibold" : ""}`}
              >
                <td className="px-4 py-1.5 text-left">{r.label}</td>
                <td className="px-2 py-1.5 text-left">
                  {r.team ? (
                    <Link
                      to="/pll/teams/$teamId"
                      params={{ teamId: r.team }}
                      title={PLL_CLUB_SHORT[r.team] ?? r.team}
                      className="inline-flex"
                    >
                      <PllLogo team={clubIn(r.team, Number(r.label), current)} className="size-5" />
                    </Link>
                  ) : null}
                </td>
                <td className="px-2 py-1.5 text-mute">{r.t.gp}</td>
                {cols.map(([h, f]) => (
                  <td key={h} className="px-2 py-1.5">
                    {f(r.t)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
