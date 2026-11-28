import { useMemo, useState } from "react";
import { Panel, PanelHeader } from "@/components/shared/booth";
import { PllLogo } from "@/components/pll/PllBits";
import { PllPlayerName } from "@/components/pll/PllPlayerLink";
import type { PllSeason } from "@/lib/pll/pll";
import { teamOf } from "@/lib/pll/pll";
import {
  pllAwards,
  pllLeaders,
  pllLeadersPage,
  pllRoster,
  pllRosterSeasons,
  posAbbr,
  posRank,
  shotAbbr,
  type PllRosterPlayer,
} from "@/lib/pll/players";

const wiki = (page: string) => `https://en.wikipedia.org/wiki/${page}`;

/** "Show all N" / "Show fewer" under a list that the dashboard cuts short. */
export function ShowAll({
  open,
  total,
  onToggle,
}: {
  open: boolean;
  total: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="block w-full border-t border-line/5 px-4 py-2 text-center font-mono text-[10px] uppercase tracking-wider text-acc hover:bg-line/5"
    >
      {open ? "Show fewer" : `Show all ${total}`}
    </button>
  );
}

function WikiCredit({ page, what, revid }: { page: string; what: string; revid?: number }) {
  const href = revid ? `https://en.wikipedia.org/w/index.php?oldid=${revid}` : wiki(page);
  return (
    <p className="px-4 py-2 font-mono text-[10px] text-faint">
      {what} from{" "}
      <a className="underline hover:text-mute" href={href} target="_blank" rel="noreferrer">
        Wikipedia
      </a>{" "}
      (CC BY-SA 4.0).
    </p>
  );
}

/** A season's end-of-year awards: MVP, position awards, rookie, coach, championship game MVP. */
export function PllAwards({
  season,
  data,
  limit,
}: {
  season: number;
  data?: PllSeason;
  /** Show only this many awards until "Show all" is tapped (the dashboard). */
  limit?: number;
}) {
  const [open, setOpen] = useState(false);
  const a = pllAwards(season);
  if (!a?.rows.length) return null;
  const cut = limit !== undefined && a.rows.length > limit;
  const rows = cut && !open ? a.rows.slice(0, limit) : a.rows;
  return (
    <Panel padded={false}>
      <PanelHeader title="Awards" aside={<span className="label-mono">{season}</span>} />
      <div className="divide-y divide-line/5">
        {rows.map((r) => {
          const t = r.team ? teamOf(data, r.team) : undefined;
          return (
            <div key={r.award} className="flex items-center gap-2 px-4 py-1.5 text-sm">
              <span className="w-[45%] shrink-0 truncate text-[12px] text-mute" title={r.award}>
                {r.award}
              </span>
              {t ? <PllLogo team={t} className="size-4" /> : null}
              <span className="min-w-0 flex-1 truncate font-semibold">{r.player}</span>
              {t ? <span className="font-mono text-[11px] text-mute">{t.short}</span> : null}
            </div>
          );
        })}
      </div>
      {cut ? <ShowAll open={open} total={a.rows.length} onToggle={() => setOpen(!open)} /> : null}
      <WikiCredit page={a.page} what="Awards" />
    </Panel>
  );
}

/** A season's statistical leaders (league-wide, or one club's players when teamId is given). */
export function PllLeaders({
  season,
  data,
  teamId,
  limit,
  perStat = 5,
}: {
  season: number;
  data?: PllSeason;
  teamId?: string;
  /** Show only this many stat categories until "Show all" is tapped (the dashboard). */
  limit?: number;
  /** Players listed per category. */
  perStat?: number;
}) {
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => pllLeaders(season, teamId), [season, teamId]);
  const page = pllLeadersPage(season);
  if (!groups.length || !page) return null;
  const cut = limit !== undefined && groups.length > limit;
  const shown = cut && !open ? groups.slice(0, limit) : groups;
  return (
    <Panel padded={false}>
      <PanelHeader
        title={teamId ? "League leaders from this team" : "League leaders"}
        aside={<span className="label-mono">regular season</span>}
      />
      <div className="divide-y divide-line/5">
        {shown.map((g) => (
          <div key={g.stat} className="px-4 py-2">
            <div className="label-mono mb-1">{g.stat}</div>
            {g.rows.slice(0, perStat).map((r) => {
              const t = r.team ? teamOf(data, r.team) : undefined;
              return (
                <div
                  key={`${r.player}-${r.rank}`}
                  className="flex items-center gap-2 py-0.5 text-sm"
                >
                  {!teamId && g.rows.length > 1 ? (
                    <span className="w-4 font-mono text-[10px] text-faint">{r.rank}</span>
                  ) : null}
                  {t ? <PllLogo team={t} className="size-4" /> : null}
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-semibold">{r.player}</span>
                    {t ? <span className="text-mute"> · {t.short}</span> : null}
                    {r.note ? (
                      <span className="font-mono text-[10px] text-acc"> · {r.note}</span>
                    ) : null}
                  </span>
                  <span className="font-mono tabular-nums">{r.value}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {cut ? <ShowAll open={open} total={groups.length} onToggle={() => setOpen(!open)} /> : null}
      <WikiCredit page={page} what="Leaders" />
    </Panel>
  );
}

/** A player's college as its logo (name on hover); its name if the logo fails to load. */
function College({ p }: { p: PllRosterPlayer }) {
  const [failed, setFailed] = useState(false);
  if (!p.college) return null;
  if (!p.collegeLogo || failed)
    return (
      <span className="font-mono text-[10px] uppercase text-mute" title={p.college}>
        {p.college}
      </span>
    );
  return (
    <img
      src={p.collegeLogo}
      alt={p.college}
      title={p.college}
      className="size-6 object-contain"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/** A club's latest roster from Wikipedia, shown for that season and later. */
export function PllRosterPanel({ teamId, season }: { teamId: string; season: number }) {
  const roster = pllRoster(teamId, season);
  const players = useMemo(
    () =>
      [...(roster?.players ?? [])].sort(
        (a, b) => posRank(a.pos) - posRank(b.pos) || Number(a.num) - Number(b.num),
      ),
    [roster],
  );
  if (!roster || !players.length) {
    const have = pllRosterSeasons(teamId);
    return (
      <Panel>
        <p className="font-mono text-xs text-mute">
          {have.length
            ? `Wikipedia has no ${season} roster for this club. Rosters: ${have.join(", ")}.`
            : "No roster listed for this club."}
        </p>
      </Panel>
    );
  }
  return (
    <Panel padded={false}>
      <PanelHeader
        title="Roster"
        aside={
          <span className="label-mono">
            {roster.season < season ? `latest listed: ${roster.season}` : `${roster.season} roster`}
          </span>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-faint">
              <th className="px-4 py-2 font-normal">#</th>
              <th className="px-2 py-2 font-normal">Player</th>
              <th className="px-2 py-2 font-normal">Pos</th>
              <th className="px-2 py-2 font-normal">Shot</th>
              <th className="px-2 py-2 font-normal">Ht / Wt</th>
              <th className="px-4 py-2 font-normal">College</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/5">
            {players.map((p) => (
              <tr key={`${p.num}-${p.name}`} className="hover:bg-line/5">
                <td className="px-4 py-1.5 font-mono tabular-nums text-mute">{p.num}</td>
                <td className="px-2 py-1.5">
                  <PllPlayerName name={p.name} className="font-semibold" />
                  {p.captain ? (
                    <span className="ml-1 font-mono text-[10px] text-acc" title="Captain">
                      C
                    </span>
                  ) : null}
                  {p.rookie ? (
                    <span className="ml-1 font-mono text-[10px] text-mute" title="Rookie">
                      R
                    </span>
                  ) : null}
                  {(p.status ?? []).map((st) => (
                    <span
                      key={st}
                      className="ml-1.5 rounded border border-loss/40 px-1 font-mono text-[9px] uppercase text-loss"
                    >
                      {st}
                    </span>
                  ))}
                </td>
                <td className="px-2 py-1.5 font-mono text-xs text-mute" title={p.pos}>
                  {posAbbr(p.pos)}
                </td>
                <td className="px-2 py-1.5 font-mono text-xs text-mute">{shotAbbr(p.shot)}</td>
                <td className="px-2 py-1.5 font-mono text-[11px] text-mute">
                  {[p.height, p.weight].filter(Boolean).join(" · ")}
                </td>
                <td className="px-4 py-1">
                  <College p={p} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <WikiCredit
        page={roster.page}
        revid={roster.revid}
        what={`${roster.season} roster, injuries and PUP/holdout/travel lists as ${roster.revid ? "the team's Wikipedia page listed them at the end of that season" : "last listed on the team's Wikipedia page"}; not week-by-week`}
      />
    </Panel>
  );
}
