/**
 * Conference championship games ESPN still lists as "TBD": who has clinched a spot, who is still alive,
 * and (once every conference game that matters is final) the matchup itself, so the site can fill the
 * game in Saturday night instead of waiting for ESPN.
 *
 * Only certain outcomes are filled in. A spot decided by a tie is settled here only when two teams tie and
 * played each other (head-to-head is every conference's first tiebreaker); three-way ties and ties between
 * teams that didn't meet go to the conference's own rules (some use rankings), so those stay open and
 * listed until ESPN posts the teams. Browser-safe and pure: the server feeds it standings and games.
 */

export interface TitlePool {
  /** ESPN team ids in this race (the whole conference, or one division). */
  teamIds: string[];
  /** Title-game spots this pool sends: 2 for a conference without divisions, 1 per division. */
  spots: number;
}

export interface TitleConference {
  name: string;
  pools: TitlePool[];
}

export interface ConfGame {
  away: string;
  home: string;
  /** Final scores; absent while the game is still to be played. */
  awayScore?: number;
  homeScore?: number;
}

export interface TitleRace {
  conference: string;
  /** Every spot is decided: the teams in seed order (first = higher seed / host where the site is a campus). */
  set?: string[];
  /** Whether set[0] is known to be the higher seed (false: two division winners or co-leaders not yet ordered). */
  seeded?: boolean;
  /** Teams sure of a spot. */
  clinched: string[];
  /** Teams still able to reach a spot (clinched teams included), best record first. */
  alive: string[];
  /**
   * Before it's set: the clinched teams to fill in now, best conference record first, whether the first
   * has the best record of everyone still alive (so likely hosts / is the higher seed), and whether that's
   * locked (nobody can catch it).
   */
  partial?: { teams: string[]; leads: boolean; locked: boolean };
}

interface Rec {
  id: string;
  w: number;
  l: number;
  left: number;
}

const pct = (w: number, n: number) => (n ? w / n : 0);
const worst = (r: Rec) => pct(r.w, r.w + r.l + r.left);
const best = (r: Rec) => pct(r.w + r.left, r.w + r.l + r.left);
const now = (r: Rec) => pct(r.w, r.w + r.l);

function records(pool: TitlePool, games: ConfGame[]): Map<string, Rec> {
  const recs = new Map(pool.teamIds.map((id) => [id, { id, w: 0, l: 0, left: 0 }]));
  for (const g of games) {
    const sides = [g.away, g.home].filter((t) => recs.has(t));
    if (!sides.length) continue;
    const done = g.awayScore !== undefined && g.homeScore !== undefined;
    for (const t of sides) {
      const r = recs.get(t)!;
      if (!done) {
        r.left += 1;
        continue;
      }
      const mine = t === g.away ? g.awayScore! : g.homeScore!;
      const theirs = t === g.away ? g.homeScore! : g.awayScore!;
      if (mine > theirs) r.w += 1;
      else if (mine < theirs) r.l += 1;
    }
  }
  return recs;
}

/** Who won when a and b met (undefined: they didn't, or it isn't final). */
function headToHead(a: string, b: string, games: ConfGame[]): string | undefined {
  const met = games.filter(
    (g) =>
      ((g.away === a && g.home === b) || (g.away === b && g.home === a)) &&
      g.awayScore !== undefined &&
      g.homeScore !== undefined &&
      g.awayScore !== g.homeScore,
  );
  const wins = (t: string) =>
    met.filter((g) => (g.away === t ? g.awayScore! > g.homeScore! : g.homeScore! > g.awayScore!))
      .length;
  if (!met.length || wins(a) === wins(b)) return undefined;
  return wins(a) > wins(b) ? a : b;
}

interface PoolResult {
  clinched: string[];
  alive: string[];
  /** The pool's spots, best first, when they're decided. */
  set?: string[];
  /** Whether that order is decided too. */
  ordered?: boolean;
}

function racePool(pool: TitlePool, games: ConfGame[]): PoolResult {
  const recs = [...records(pool, games).values()];
  const k = pool.spots;
  const byNow = [...recs].sort((a, b) => now(b) - now(a) || b.w - a.w);
  // Clinched: at most k-1 others can finish level with or ahead of this team's worst case (a tie counts
  // as a threat, since tiebreakers decide it).
  const clinched = byNow
    .filter((t) => recs.filter((u) => u !== t && best(u) >= worst(t)).length <= k - 1)
    .map((t) => t.id);
  // Eliminated: k others are already sure to finish ahead of this team's best case.
  const alive = byNow
    .filter((t) => recs.filter((u) => u !== t && worst(u) > best(t)).length < k)
    .map((t) => t.id);
  if (recs.some((r) => r.left > 0)) return { clinched, alive };

  // Every game is final: rank by conference win percentage, settling a tie across the cut only when
  // it's two teams who met.
  const tiers: Rec[][] = [];
  for (const r of byNow) {
    const last = tiers[tiers.length - 1];
    if (last && now(last[0]) === now(r)) last.push(r);
    else tiers.push([r]);
  }
  const order: string[] = [];
  let ordered = true;
  for (const tier of tiers) {
    if (order.length >= k) break;
    const room = k - order.length;
    if (tier.length === 1) {
      order.push(tier[0].id);
      continue;
    }
    if (tier.length === 2) {
      const w = headToHead(tier[0].id, tier[1].id, games);
      if (w) {
        order.push(w, ...tier.map((t) => t.id).filter((id) => id !== w));
        continue;
      }
      if (room >= 2) {
        // both in, but which is the higher seed is left to the conference
        order.push(tier[0].id, tier[1].id);
        ordered = false;
        continue;
      }
    }
    if (tier.length <= room) {
      order.push(...tier.map((t) => t.id));
      ordered = false;
      continue;
    }
    // a tie the rules here can't settle
    return { clinched, alive };
  }
  return { clinched: order.slice(0, k), alive, set: order.slice(0, k), ordered };
}

/** One conference's title race from its pools and conference games. */
export function titleRace(conf: TitleConference, games: ConfGame[]): TitleRace {
  const results = conf.pools.map((p) => racePool(p, games));
  const clinched = results.flatMap((r) => r.clinched);
  const alive = results.flatMap((r) => r.alive);
  if (!results.every((r) => r.set)) {
    if (!clinched.length) return { conference: conf.name, clinched, alive };
    const all = new Map<string, Rec>();
    for (const p of conf.pools) for (const [id, r] of records(p, games)) all.set(id, r);
    const teams = [...clinched].sort((a, b) => now(all.get(b)!) - now(all.get(a)!));
    const top = all.get(teams[0])!;
    const others = alive.filter((id) => id !== top.id).map((id) => all.get(id)!);
    const leads = others.every((u) => now(top) >= now(u));
    const locked = others.every((u) => best(u) < worst(top));
    return { conference: conf.name, clinched, alive, partial: { teams, leads, locked } };
  }
  if (conf.pools.length === 1) {
    const r = results[0];
    return { conference: conf.name, set: r.set, seeded: r.ordered, clinched, alive };
  }
  // division winners: the better conference record hosts / is the higher seed; a tie needs head-to-head
  const winners = results.map((r) => r.set![0]);
  const recs = records({ teamIds: winners, spots: 1 }, games);
  const [a, b] = winners;
  const ra = recs.get(a)!;
  const rb = recs.get(b)!;
  if (now(ra) !== now(rb)) {
    const set = now(ra) > now(rb) ? [a, b] : [b, a];
    return { conference: conf.name, set, seeded: true, clinched, alive };
  }
  const w = headToHead(a, b, games);
  if (w) return { conference: conf.name, set: [w, w === a ? b : a], seeded: true, clinched, alive };
  return { conference: conf.name, set: [a, b], seeded: false, clinched, alive };
}

/** Which conference a title game's ESPN note names ("Edward Jones Big 12 Championship" → Big 12). */
export function conferenceOfNote(note: string, names: string[]): string | undefined {
  const n = note.toLowerCase();
  if (!n.includes("championship")) return undefined;
  const keys: [string, (name: string) => boolean][] = [
    ["sec ", (x) => x.startsWith("Southeastern")],
    ["acc ", (x) => x.startsWith("Atlantic Coast")],
    ["big ten", (x) => x.startsWith("Big Ten")],
    ["big 12", (x) => x.startsWith("Big 12")],
    ["mountain west", (x) => x.startsWith("Mountain West")],
    ["sun belt", (x) => x.startsWith("Sun Belt")],
    ["conference usa", (x) => x.startsWith("Conference USA")],
    ["mac ", (x) => x.startsWith("Mid-American")],
    ["mid-american", (x) => x.startsWith("Mid-American")],
    ["pac-12", (x) => x.startsWith("Pac-12")],
    ["american", (x) => x.startsWith("American")],
  ];
  const padded = `${n} `;
  for (const [key, match] of keys) {
    if (padded.startsWith(key) || padded.includes(` ${key}`)) return names.find(match);
  }
  return undefined;
}

/** FBS conferences by ESPN group id (logos live at ESPN's ncaa_conf/<id>.png). */
const CONFERENCE_IDS: Record<string, string> = {
  "American Conference": "151",
  "Atlantic Coast Conference": "1",
  "Big 12 Conference": "4",
  "Big Ten Conference": "5",
  "Conference USA": "12",
  "Mid-American Conference": "15",
  "Mountain West Conference": "17",
  "Pac-12 Conference": "9",
  "Southeastern Conference": "8",
  "Sun Belt Conference": "37",
};

/** Conference logos kept in public/logos/conferences (Conference USA, Mountain West, Sun Belt). */
const OWN_LOGOS = new Set(["12", "17", "37"]);

/** A conference title game's conference and logo, from ESPN's note ("Edward Jones Big 12 Championship"). */
export function titleGameConference(
  note: string | undefined,
): { name: string; logo: string; logoLight: string } | undefined {
  const name = note ? conferenceOfNote(note, Object.keys(CONFERENCE_IDS)) : undefined;
  if (!name) return undefined;
  const id = CONFERENCE_IDS[name];
  return {
    name,
    // ESPN's dark-background logo is missing or doesn't show for these; the owner supplied current ones
    logo: OWN_LOGOS.has(id)
      ? `/logos/conferences/${id}.png`
      : `https://a.espncdn.com/i/teamlogos/ncaa_conf/500-dark/${id}.png`,
    logoLight: `https://a.espncdn.com/i/teamlogos/ncaa_conf/500/${id}.png`,
  };
}
