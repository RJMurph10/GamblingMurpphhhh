import { writeFileSync } from "node:fs";
const out = {};
const grab = async (k, u) => {
  try { const r = await fetch(u); const b = Buffer.from(await r.arrayBuffer());
    console.log("IMG", k, u, r.status, r.headers.get("content-type"), b.length);
    if (r.ok && /image/.test(r.headers.get("content-type") ?? "")) out[k] = { u, b64: b.toString("base64") };
  } catch (e) { console.log("IMG", k, u, "ERR", e.message); }
};
await grab("espn", "https://a.espncdn.com/i/teamlogos/pll/500/127638.png");
for (const t of ["whipsnakes", "archers", "atlas", "chaos", "redwoods", "waterdogs", "cannons", "outlaws"])
  await grab(`usal-${t}`, `https://usalacrosse.com/sites/default/files/2024-05/2024_${t}_primary_color.png`);
for (const q of ["usalacrosse.com/sites/default/files/*whipsnakes*", "premierlacrosseleague.com/wp-content/uploads/202*"]) {
  const c = await (await fetch(`https://web.archive.org/cdx/search/cdx?url=${q}&filter=original:.*[Ww]hip.*&filter=mimetype:image/.*&collapse=urlkey&limit=300`)).text();
  console.log("CDX", q, "\n" + c.split("\n").map((l) => l.split(" ").slice(1, 3).join(" ")).filter((l) => !/-\d+x\d+\./.test(l) && /logo|primary|Logo|Primary/.test(l)).join("\n"));
}
writeFileSync("pll_sample.json", JSON.stringify(out));
