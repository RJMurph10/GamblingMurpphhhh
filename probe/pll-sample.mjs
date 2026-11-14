import { writeFileSync } from "node:fs";
const B = "https://site.api.espn.com/apis/site/v2/sports/lacrosse/pll";
const out = {};
for (const y of [2022, 2023, 2024]) {
  const sb = await (await fetch(`${B}/scoreboard?dates=${y}&limit=1000`)).json();
  const seen = {};
  for (const e of sb.events ?? []) for (const c of e.competitions?.[0]?.competitors ?? []) seen[c.team.id] = `${c.team.displayName}|${c.team.abbreviation}|${c.team.logo}`;
  console.log("YEAR", y, JSON.stringify(seen));
}
for (const u of ["https://a.espncdn.com/i/teamlogos/pll/500/127633.png", "https://web.archive.org/web/2021im_/https://premierlacrosseleague.com/wp-content/uploads/2020/11/cannons_logo.png"]) {
  const r = await fetch(u); const b = Buffer.from(await r.arrayBuffer()); console.log("IMG", u, r.status, b.length);
  if (r.ok) out[u] = { b64: b.toString("base64") };
}
const cdx = await (await fetch("https://web.archive.org/cdx/search/cdx?url=premierlacrosseleague.com/wp-content/uploads/*&filter=original:.*([Cc]annons|[Cc]hrome).*([Ll]ogo|square|primary).*&filter=mimetype:image/png&collapse=urlkey&limit=200")).text();
console.log("CDX", cdx.split("\n").map((l) => l.split(" ").slice(1, 3).join(" ")).join("\n"));
writeFileSync("pll_sample.json", JSON.stringify(out));
