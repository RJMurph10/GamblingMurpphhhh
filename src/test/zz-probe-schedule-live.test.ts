import { it } from "vitest";
import { fetchSchedule } from "@/lib/nfl/nfl-schedule.server";
import { gameScore } from "@/data/shared/games";
it("live schedule as the site builds it", async () => {
  const games = await fetchSchedule();
  const fin = games.filter((g) => g.status === "final");
  const zero = fin.filter((g) => { const s = gameScore(g); return s.home + s.away === 0; });
  const dash = fin.filter((g) => g.spread === "—" || !g.total);
  console.log("games", games.length, "final", fin.length, "0-0 finals", zero.length, "finals missing lines", dash.length);
  for (const g of games.filter((g) => [g.homeTeamId, g.awayTeamId].some((t) => t === "vikings" || t === "packers")))
    console.log(g.week, g.id, g.awayTeamId, "@", g.homeTeamId, g.status, JSON.stringify(gameScore(g)), g.spread, g.total);
  for (const g of zero.slice(0, 10)) console.log("ZERO", g.week, g.id, g.awayTeamId, g.homeTeamId, JSON.stringify(g.quarters));
}, 300_000);
