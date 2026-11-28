import { fetchCfbSchedule } from "@/lib/cfb/cfb-espn.server";
import { teamById } from "@/data/shared/teams";
const games = await fetchCfbSchedule();
for (const g of games.filter((g) => /championship/i.test(g.note ?? "") && !g.postseason)) {
  const n = (id: string) => teamById(id)?.abbr ?? id;
  console.log("CCG", g.kickoffIso, g.note, "|", n(g.awayTeamId), "@", n(g.homeTeamId), "| neutral", !!g.neutralSite, "| hint", JSON.stringify(g.tbdHint ?? null), "|", JSON.stringify(g.titleRace ?? null));
}
