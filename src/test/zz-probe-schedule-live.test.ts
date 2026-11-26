import { it } from "vitest";
import { fetchSchedule } from "@/lib/nfl/nfl-schedule.server";
import { fetchGameDetail } from "@/lib/shared/espn-game-detail.server";
import { gameScore } from "@/data/shared/games";
it("game detail + repeated schedule loads", async () => {
  const d: any = await fetchGameDetail("401872927");
  const g = d?.game ?? d;
  console.log("DETAIL keys", Object.keys(d ?? {}).join(","));
  console.log("DETAIL status", g?.status, "score", JSON.stringify(g?.quarters), "spread", g?.spread, "total", g?.total);
  for (let i = 0; i < 6; i++) {
    const games = await fetchSchedule();
    const fin = games.filter((x) => x.status === "final");
    console.log("LOAD", i, "finals missing lines", fin.filter((x) => x.spread === "—" || !x.total).length, "of", fin.length);
    await new Promise((r) => setTimeout(r, 2500));
  }
}, 600_000);
