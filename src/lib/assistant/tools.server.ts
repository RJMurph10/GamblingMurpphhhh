/**
 * The assistant's tools: look-ups over the picks the site records (props-site/picks/<league>/season-*.json,
 * written by the picks jobs) and the rule lists. Each returns small JSON the model can quote, so answers
 * come from the site's own numbers.
 */
import { ASSISTANT_LEAGUES, LEAGUE_NAME, rulesText, type AssistantLeague } from "./knowledge";

const PICKS_URL = (league: AssistantLeague) =>
  `https://raw.githubusercontent.com/RJMurph10/gamblingnfl/props-site/picks/${league}/season-2026-27.json`;
const TTL = 5 * 60_000;

export type RecordedPick = {
  id: string;
  day?: string;
  game: string;
  tip: string;
  market: string;
  pick: string;
  line: number | null;
  latest?: number | null;
  close?: number | null;
  model?: number | null;
  edge?: number | null;
  best: boolean;
  tag?: string | null;
  dropped?: boolean;
  score?: [number, number] | null;
  result?: "win" | "loss" | "push" | null;
  clv?: number | null;
};

const cache = new Map<AssistantLeague, { at: number; picks: RecordedPick[] }>();

export async function loadPicks(league: AssistantLeague): Promise<RecordedPick[]> {
  const hit = cache.get(league);
  if (hit && Date.now() - hit.at < TTL) return hit.picks;
  const res = await fetch(PICKS_URL(league));
  if (!res.ok) throw new Error(`picks for ${league}: HTTP ${res.status}`);
  const picks = ((await res.json()) as { picks?: RecordedPick[] }).picks ?? [];
  cache.set(league, { at: Date.now(), picks });
  return picks;
}

const isLeague = (v: unknown): v is AssistantLeague =>
  typeof v === "string" && (ASSISTANT_LEAGUES as readonly string[]).includes(v);

/** 1 unit at -110: a win pays 0.91. */
const units = (p: RecordedPick) => (p.result === "win" ? 0.91 : p.result === "loss" ? -1 : 0);

function record(picks: RecordedPick[]) {
  const w = picks.filter((p) => p.result === "win").length;
  const l = picks.filter((p) => p.result === "loss").length;
  const pu = picks.filter((p) => p.result === "push").length;
  return {
    record: `${w}-${l}${pu ? `-${pu}` : ""}`,
    winPct: w + l ? Math.round((1000 * w) / (w + l)) / 10 : null,
    units: Math.round(picks.reduce((s, p) => s + units(p), 0) * 100) / 100,
    graded: w + l + pu,
  };
}

const short = (p: RecordedPick) => ({
  game: p.game,
  kickoff: p.tip,
  market: p.market,
  pick: p.pick,
  bestBet: p.best,
  rule: p.tag ?? null,
  lineWhenPicked: p.line,
  lineNow: p.latest ?? null,
  closingLine: p.close ?? null,
  modelNumber: p.model ?? null,
  edgePoints: p.edge ?? null,
  result: p.result ?? null,
  finalScore: p.score ?? null,
});

const matchesTeam = (p: RecordedPick, team?: string) =>
  !team || p.game.toLowerCase().includes(team.trim().toLowerCase());

/** Tool declarations (provider-neutral JSON schema). */
export const TOOL_DECLARATIONS = [
  {
    name: "get_picks",
    description:
      "The site's picks for one league: upcoming (not yet played) or recently graded. Each pick says whether it is a ★ best bet, which rule (tag) made it, the line when picked, the line now, the model's number and edge, and the result once graded.",
    parameters: {
      type: "object",
      properties: {
        league: {
          type: "string",
          enum: [...ASSISTANT_LEAGUES],
          description: "nfl, cfb (college football), nba, cbb (men's college basketball)",
        },
        when: {
          type: "string",
          enum: ["upcoming", "recent"],
          description: "upcoming = not played yet; recent = graded in the last 10 days",
        },
        team: {
          type: "string",
          description:
            "Optional team abbreviation as it appears in the game string, e.g. BUF, OSU, LAL",
        },
        bestOnly: { type: "boolean", description: "Only ★ best bets (default false)" },
      },
      required: ["league"],
    },
  },
  {
    name: "get_record",
    description:
      "Graded record this season (since the site started recording picks) for one league, as W-L-push, win %, and units at 1u -110, overall and by rule (tag). Optionally only ★ best bets, one rule, or since a date.",
    parameters: {
      type: "object",
      properties: {
        league: { type: "string", enum: [...ASSISTANT_LEAGUES] },
        bestOnly: { type: "boolean", description: "Only ★ best bets (default true)" },
        rule: {
          type: "string",
          description: "Optional rule tag, e.g. wind, underdog, open-total, star",
        },
        since: {
          type: "string",
          description: "Optional ISO date (YYYY-MM-DD): only games from this day on",
        },
      },
      required: ["league"],
    },
  },
  {
    name: "get_rules",
    description:
      "The rules behind one league's picks: what makes a ★ best bet, what each rule tag means, and the watch list.",
    parameters: {
      type: "object",
      properties: { league: { type: "string", enum: [...ASSISTANT_LEAGUES] } },
      required: ["league"],
    },
  },
] as const;

export async function runTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const league = args.league;
  if (!isLeague(league))
    return { error: `Unknown league. Use one of ${ASSISTANT_LEAGUES.join(", ")}.` };
  if (name === "get_rules") return { league: LEAGUE_NAME[league], rules: rulesText(league) };
  const picks = (await loadPicks(league)).filter((p) => !p.dropped);
  if (name === "get_picks") {
    const now = Date.now();
    const recent = args.when === "recent";
    const list = picks
      .filter((p) => matchesTeam(p, args.team as string | undefined))
      .filter((p) => !args.bestOnly || p.best)
      .filter((p) =>
        recent
          ? p.result && now - Date.parse(p.tip) < 10 * 86_400_000
          : !p.result && Date.parse(p.tip) > now - 4 * 3_600_000,
      )
      .sort((a, b) => (recent ? b.tip.localeCompare(a.tip) : a.tip.localeCompare(b.tip)))
      .slice(0, 40)
      .map(short);
    return {
      league: LEAGUE_NAME[league],
      when: recent ? "recent" : "upcoming",
      count: list.length,
      picks: list,
    };
  }
  if (name === "get_record") {
    const bestOnly = args.bestOnly !== false;
    const since = typeof args.since === "string" ? args.since : "";
    const rule = typeof args.rule === "string" ? args.rule : "";
    const graded = picks
      .filter((p) => p.result)
      .filter((p) => !bestOnly || p.best)
      .filter((p) => !rule || p.tag === rule)
      .filter((p) => !since || p.tip.slice(0, 10) >= since);
    const tags = [...new Set(graded.map((p) => p.tag ?? "none"))];
    const first = graded.map((p) => p.tip).sort()[0] ?? null;
    return {
      league: LEAGUE_NAME[league],
      scope: bestOnly ? "★ best bets" : "every recorded pick",
      recordingSince: first ? first.slice(0, 10) : null,
      overall: record(graded),
      byRule: Object.fromEntries(
        tags.map((t) => [t, record(graded.filter((p) => (p.tag ?? "none") === t))]),
      ),
    };
  }
  return { error: `Unknown tool ${name}` };
}
