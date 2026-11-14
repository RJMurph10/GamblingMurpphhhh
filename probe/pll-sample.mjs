import { writeFileSync } from "node:fs";
const out = {};
const cdx = await (await fetch("https://web.archive.org/cdx/search/cdx?url=premierlacrosseleague.com/wp-content/uploads/*&filter=original:.*(square|LogoBlock|[Pp]rimary|team_logo|Team_Logo).*&filter=mimetype:image/png&collapse=urlkey&limit=500")).text();
const rows = cdx.split("\n").map((l) => l.split(" ")).filter((p) => p[2] && !/-\d+x\d+\.png$/i.test(p[2]));
console.log("CDX\n" + rows.map((p) => `${p[1]} ${p[2]}`).join("\n"));
const teams = ["archers", "atlas", "chaos", "redwoods", "whipsnakes", "waterdogs", "cannons"];
for (const t of teams) {
  for (const f of [`2020/02/500x500_PLL_Teams_square_${t}-1.png`, `2020/02/500x500_PLL_Teams_square_${t}.png`]) {
    const u = `https://premierlacrosseleague.com/wp-content/uploads/${f}`;
    const r = await fetch(u); const b = Buffer.from(await r.arrayBuffer());
    console.log("IMG", t, u, r.status, r.headers.get("content-type"), b.length);
    if (r.ok && /image/.test(r.headers.get("content-type") ?? "")) { out[u] = { b64: b.toString("base64") }; break; }
  }
}
const r = await fetch("https://a.espncdn.com/i/teamlogos/pll/500/127633.png"); out.espn127633 = { b64: Buffer.from(await r.arrayBuffer()).toString("base64") };
writeFileSync("pll_sample.json", JSON.stringify(out));
