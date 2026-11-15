import { writeFileSync } from "node:fs";
for (const y of [2022, 2023, 2024, 2025]) {
  const sb = await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/lacrosse/pll/scoreboard?dates=${y}&limit=1000`)).json();
  const ev = sb.events ?? [];
  const odd = ev.filter((e) => !e.status?.type?.completed);
  console.log("YEAR", y, ev.length, "not completed", odd.length);
  for (const e of odd) console.log("  ", e.date, e.name, JSON.stringify(e.status?.type), e.competitions?.[0]?.competitors?.map((c) => c.score).join("-"));
}
writeFileSync("pll_sample.json", "{}");
