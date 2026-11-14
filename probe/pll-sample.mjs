import { writeFileSync } from "node:fs";
const out = {};
const q = async (u) => { try { const r = await fetch(u); return r.ok ? await r.text() : `ERR ${r.status}`; } catch (e) { return `ERR ${e}`; } };
const cdx = await q("https://web.archive.org/cdx/search/cdx?url=premierlacrosseleague.com/wp-content/uploads/*&filter=original:.*[Cc]hrome.*&filter=mimetype:image/.*&collapse=urlkey&limit=200");
console.log("CDX", cdx.slice(0, 6000));
const urls = [...new Set(cdx.split("\n").map((l) => l.split(" ")).filter((p) => p[2]).map((p) => [p[1], p[2]]).filter(([, u]) => /logo/i.test(u)).map(([ts, u]) => `https://web.archive.org/web/${ts}im_/${u}`))].slice(0, 12);
for (const u of urls) {
  const r = await fetch(u); const b = Buffer.from(await r.arrayBuffer());
  console.log("IMG", u, r.status, r.headers.get("content-type"), b.length);
  if (r.ok) out[u] = { type: r.headers.get("content-type"), b64: b.toString("base64") };
}
writeFileSync("pll_sample.json", JSON.stringify(out));
