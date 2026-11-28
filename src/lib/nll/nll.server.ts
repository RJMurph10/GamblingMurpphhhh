/**
 * NLL schedule and scores from ESPN's lacrosse scoreboard. ESPN refuses date ranges for the NLL, but a
 * month (`dates=202612`) returns that month's games, so a season is eight monthly requests (Nov–Jun).
 */
import { cached } from "@/lib/shared/espn-core.server";
import { nllSeasonLabel, type NllGame, type NllSeason, type NllTeam } from "./nll";

const BASE = "https://site.api.espn.com/apis/site/v2/sports/lacrosse/nll";

async function get<T>(url: string): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "GamblingNFL/1.0", Accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });
      if (res.ok) return (await res.json()) as T;
    } catch {
      // timed out or refused: try once more
    }
  }
  return null;
}

class EspnUnavailable extends Error {}

type EspnTeam = {
  id: string;
  abbreviation?: string;
  displayName?: string;
  shortDisplayName?: string;
  color?: string;
  logos?: { href?: string }[];
  logo?: string;
};
type EspnEvent = {
  id: string;
  date: string;
  season?: { type?: number };
  status?: {
    period?: number;
    type?: { state?: string; completed?: boolean; shortDetail?: string };
  };
  competitions?: {
    venue?: { fullName?: string; address?: { city?: string; state?: string } };
    competitors?: {
      homeAway?: string;
      score?: string;
      team?: EspnTeam;
      linescores?: { value?: number }[];
      records?: { summary?: string }[];
    }[];
  }[];
};

const toTeam = (t: EspnTeam): NllTeam => ({
  id: t.id,
  abbr: t.abbreviation ?? "",
  name: t.displayName ?? t.id,
  short: t.shortDisplayName ?? t.displayName ?? t.id,
  color: t.color ? `#${t.color}` : null,
  logo: t.logos?.[0]?.href ?? t.logo ?? null,
});

export function mapNllEvent(e: EspnEvent): NllGame | null {
  const c0 = e.competitions?.[0];
  const comp = c0?.competitors ?? [];
  const home = comp.find((c) => c.homeAway === "home");
  const away = comp.find((c) => c.homeAway === "away");
  if (!home?.team || !away?.team) return null;
  const state = e.status?.type?.state;
  const status = e.status?.type?.completed ? "final" : state === "in" ? "live" : "scheduled";
  const score = (s?: string) =>
    status === "scheduled" || s == null || s === "" ? null : Number(s);
  const side = (c: typeof home) => ({
    teamId: c.team!.id,
    score: score(c.score),
    quarters: (c.linescores ?? []).map((q) => q.value ?? 0),
    record: c.records?.[0]?.summary,
  });
  return {
    id: e.id,
    date: e.date,
    status,
    detail: e.status?.type?.shortDetail ?? "",
    phase: e.season?.type === 3 ? "playoffs" : "regular",
    home: side(home),
    away: side(away),
    ot: (e.status?.period ?? 4) > 4 || (home.linescores?.length ?? 0) > 4,
    venue: c0?.venue?.fullName,
    city:
      [c0?.venue?.address?.city, c0?.venue?.address?.state].filter(Boolean).join(", ") || undefined,
  };
}

export async function fetchNllSeason(season: number): Promise<NllSeason> {
  return cached(
    `nll-season-${season}`,
    async () => {
      const months = [11, 12, 1, 2, 3, 4, 5, 6].map((m) =>
        m >= 11 ? `${season}${m}` : `${season + 1}${String(m).padStart(2, "0")}`,
      );
      const [teamsRes, ...monthRes] = await Promise.all([
        get<{ sports?: { leagues?: { teams?: { team: EspnTeam }[] }[] }[] }>(`${BASE}/teams`),
        ...months.map((m) =>
          get<{ events?: EspnEvent[] }>(`${BASE}/scoreboard?dates=${m}&limit=300`),
        ),
      ]);
      if (!teamsRes || monthRes.every((r) => r === null))
        throw new EspnUnavailable("ESPN didn't answer");
      const teams = (teamsRes.sports?.[0]?.leagues?.[0]?.teams ?? []).map((x) => toTeam(x.team));
      const seen = new Map<string, NllGame>();
      for (const r of monthRes)
        for (const e of r?.events ?? []) {
          const g = mapNllEvent(e);
          if (g) seen.set(g.id, g);
        }
      const games = [...seen.values()].sort((a, b) => a.date.localeCompare(b.date));
      return { season, label: nllSeasonLabel(season), teams, games };
    },
    5 * 60_000,
  );
}
