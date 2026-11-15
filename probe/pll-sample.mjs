import { writeFileSync } from "node:fs";
const UA = { headers: { "User-Agent": "GamblingNFL research (github.com/RJMurph10/gamblingnfl)" } };
const out = {};
for (const [k, f] of [["adelphi", "File:Adelphi Panthers current logo.svg"], ["adelphi2", "File:Adelphi univ athletics mark.png"], ["york", "File:York-pa logo from NCAA.svg"]]) {
  await new Promise((r) => setTimeout(r, 1500));
  const j = await (await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(f)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=256&format=json&formatversion=2`, UA)).json();
  const ii = j.query?.pages?.[0]?.imageinfo?.[0];
  console.log("FILE", k, ii?.thumburl, ii?.extmetadata?.LicenseShortName?.value, ii?.extmetadata?.NonFree?.value ?? "");
  if (ii?.thumburl) { const r = await fetch(ii.thumburl, UA); const b = Buffer.from(await r.arrayBuffer()); console.log("IMG", k, r.status, b.length); if (r.ok) out[k] = { b64: b.toString("base64") }; }
}
writeFileSync("pll_sample.json", JSON.stringify(out));
