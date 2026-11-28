/**
 * Browser-safe parsing of ESPN's men's college basketball scoreboard events and odds. Used by the server
 * schedule (cbb.server.ts) and by the dashboard's in-browser fallback when the server returns no live or
 * upcoming games.
 */
import { cbbLogoFor, type CbbGame, type CbbOdds, type CbbStatus, type CbbTeamRef } from "./cbb";

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[,+]/g, ""));
  return Number.isFinite(n) ? n : null;
};
export const lineNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const m = /(-?\d+(?:\.\d+)?)/.exec(String(v).replace(/^\s*[ou]\s*/i, ""));
  return m ? Number(m[1]) : null;
};
export function american(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return american(o.american ?? o.alternateDisplayValue ?? o.value ?? o.odds);
  }
  if (typeof v === "string" && /^\s*even\s*$/i.test(v)) return 100;
  const n = typeof v === "number" ? v : Number(String(v).trim().replace(/^\+/, ""));
  return Number.isFinite(n) && Math.abs(n) >= 100 ? Math.round(n) : null;
}

/* ---------- odds ---------- */

const teamIdOf = (t: any): string | null => {
  if (!t) return null;
  if (t.id != null) return String(t.id);
  const m = /\/teams\/(\d+)/.exec(String(t.$ref ?? ""));
  return m ? m[1] : null;
};

/**
 * True when ESPN's odds list the game's away team as "home". It does this for some neutral-site
 * college games (about 3%), which would put the line on the wrong team (Florida A&M −28.5 against
 * Florida State). Checked by team id, else by the favorite named in "details".
 */
export function oddsSwapped(o: any, home?: { id?: string; abbr?: string }): boolean {
  if (!home?.id && !home?.abbr) return false;
  const hid = teamIdOf(o?.homeTeamOdds?.team);
  const aid = teamIdOf(o?.awayTeamOdds?.team);
  if (home.id && hid) return hid !== String(home.id) && (!aid || aid === String(home.id));
  const m = /^\s*([A-Za-z&.'-]+)\s+-\d/.exec(String(o?.details ?? ""));
  if (m && home.abbr && o?.homeTeamOdds?.favorite != null) {
    const favIsHome = m[1].toUpperCase() === String(home.abbr).toUpperCase();
    return favIsHome !== Boolean(o.homeTeamOdds.favorite);
  }
  return false;
}

/** One ESPN odds object as the game's line; `home` turns around books that list the teams the other way. */
export function parseOdds(o: any, home?: { id?: string; abbr?: string }): CbbOdds | undefined {
  const odds = parseOddsAsListed(o);
  if (!odds || !oddsSwapped(o, home)) return odds;
  return {
    ...odds,
    spread: odds.spread === null ? null : odds.spread === 0 ? 0 : -odds.spread,
    mlHome: odds.mlAway,
    mlAway: odds.mlHome,
    spreadOddsHome: odds.spreadOddsAway,
    spreadOddsAway: odds.spreadOddsHome,
  };
}

function parseOddsAsListed(o: any): CbbOdds | undefined {
  if (!o || typeof o !== "object") return undefined;
  const h = o.homeTeamOdds ?? {};
  const a = o.awayTeamOdds ?? {};
  const mlHome =
    american(h.moneyLine) ??
    american(o.moneyline?.home?.close?.odds ?? o.moneyline?.home?.current?.odds);
  const mlAway =
    american(a.moneyLine) ??
    american(o.moneyline?.away?.close?.odds ?? o.moneyline?.away?.current?.odds);
  let spread = lineNum(
    o.pointSpread?.home?.close?.line ?? o.pointSpread?.home?.current?.line ?? o.spread,
  );
  if (spread !== null && spread !== 0) {
    // ESPN's spread is the home team's; check the sign against the favorite
    if (mlHome !== null && mlAway !== null && mlHome !== mlAway)
      spread = mlHome < mlAway ? -Math.abs(spread) : Math.abs(spread);
    else if (h.favorite === true) spread = -Math.abs(spread);
    else if (a.favorite === true) spread = Math.abs(spread);
  }
  if (spread === null && /^(even|pk|pick)/i.test(String(o.details ?? ""))) spread = 0;
  const total =
    lineNum(o.overUnder) ?? lineNum(o.total?.over?.close?.line ?? o.total?.over?.current?.line);
  const out: CbbOdds = {
    spread,
    total: total !== null && total > 0 ? total : null,
    mlHome,
    mlAway,
    spreadOddsHome:
      american(h.spreadOdds) ??
      american(h.close?.spread) ??
      american(o.pointSpread?.home?.close?.odds),
    spreadOddsAway:
      american(a.spreadOdds) ??
      american(a.close?.spread) ??
      american(o.pointSpread?.away?.close?.odds),
    overOdds: american(o.overOdds) ?? american(o.total?.over?.close?.odds),
    underOdds: american(o.underOdds) ?? american(o.total?.under?.close?.odds),
    ...(o.provider?.name ? { provider: String(o.provider.name) } : {}),
  };
  return out.spread === null && out.total === null && out.mlHome === null ? undefined : out;
}

export function teamRefFrom(t: any, confId = ""): CbbTeamRef {
  const id = String(t?.id ?? "");
  const abbr = String(t?.abbreviation ?? "---");
  const color = String(t?.color ?? "").replace("#", "");
  return {
    id,
    abbr,
    name: String(t?.displayName ?? t?.name ?? abbr),
    short: String(t?.shortDisplayName ?? t?.location ?? abbr),
    nickname: String(t?.name ?? ""),
    color: /^[0-9a-f]{6}$/i.test(color) ? `#${color}` : "#8899aa",
    logo: String(t?.logo ?? t?.logos?.[0]?.href ?? cbbLogoFor(id)),
    confId: t?.conferenceId != null ? String(t.conferenceId) : confId,
  };
}

/* ---------- events from ESPN ---------- */

function statusOf(type: any): CbbStatus {
  const text = `${type?.name ?? ""} ${type?.detail ?? ""} ${type?.description ?? ""}`;
  if (/POSTPONED|CANCELED|CANCELLED|SUSPENDED/i.test(text)) return "postponed";
  if (type?.state === "in") return "live";
  if (type?.state === "post" || type?.completed === true) return "final";
  return "scheduled";
}

/** The team with the ball during a live game, when ESPN says (a competitor flag or the game situation). */
function possession(comp: any, competitors: any[]): string | undefined {
  const flagged = competitors.find((c) => c?.possession === true || c?.possession === "true");
  const id = flagged?.team?.id ?? flagged?.id ?? comp?.situation?.possession;
  return id ? String(id) : undefined;
}

export function parseEvent(e: any): CbbGame | null {
  const comp = e?.competitions?.[0];
  const competitors: any[] = comp?.competitors ?? [];
  const home = competitors.find((c) => c?.homeAway === "home");
  const away = competitors.find((c) => c?.homeAway === "away");
  if (!comp || !home?.team || !away?.team || !e?.id) return null;
  const type = comp.status?.type ?? e.status?.type ?? {};
  const status = statusOf(type);
  const started = status === "live" || status === "final";
  const side = (c: any) => {
    const rank = num(c?.curatedRank?.current);
    return {
      team: teamRefFrom(c.team),
      score: started ? num(c?.score?.value ?? c?.score?.displayValue ?? c?.score) : null,
      ...(rank && rank <= 25 ? { rank } : {}),
      record:
        (c?.records ?? []).find((r: any) => r?.type === "total" || r?.name === "overall")
          ?.summary ?? c?.records?.[0]?.summary,
      periods:
        started && Array.isArray(c?.linescores)
          ? c.linescores.map((l: any) => num(l?.value ?? l?.displayValue) ?? 0)
          : [],
    };
  };
  const st = comp.status ?? e.status ?? {};
  const broadcast = comp.broadcasts?.[0]?.names?.[0] ?? comp.geoBroadcasts?.[0]?.media?.shortName;
  const note = comp.notes?.[0]?.headline ?? e.notes?.[0]?.headline;
  const odds = parseOdds(Array.isArray(comp.odds) ? comp.odds[0] : undefined, {
    id: String(home.team.id ?? ""),
    abbr: String(home.team.abbreviation ?? ""),
  });
  const addr = comp.venue?.address;
  const location = [addr?.city, addr?.state].filter(Boolean).join(", ");
  return {
    id: String(e.id),
    date: String(e.date ?? comp.date ?? ""),
    status,
    statusDetail: String(type?.shortDetail ?? type?.detail ?? type?.description ?? ""),
    period: Number(st.period ?? 0) || 0,
    clock: String(st.displayClock ?? ""),
    ...(status === "live" && possession(comp, competitors)
      ? { possessionTeamId: possession(comp, competitors) }
      : {}),
    part: Number(e?.season?.type ?? comp?.type?.id) === 3 ? "post" : "reg",
    neutral: Boolean(comp.neutralSite),
    conference: Boolean(comp.conferenceCompetition),
    ...(note ? { note: String(note) } : {}),
    ...(comp.venue?.fullName ? { venue: String(comp.venue.fullName) } : {}),
    ...(location ? { location } : {}),
    ...(broadcast ? { broadcast: String(broadcast) } : {}),
    away: side(away),
    home: side(home),
    ...(odds ? { odds } : {}),
  };
}
