import { writeFileSync } from "node:fs";
const out = {};
for (const u of ["https://premierlacrosseleague.com/wp-content/uploads/2021/01/500x500_PLL_Teams_square_cannons.png",
  "https://web.archive.org/web/20210711002253im_/https://premierlacrosseleague.com/wp-content/uploads/2021/01/500x500_PLL_Teams_square_cannons.png"]) {
  const r = await fetch(u); const b = Buffer.from(await r.arrayBuffer());
  console.log("IMG", u, r.status, r.headers.get("content-type"), b.length);
  if (r.ok && /image/.test(r.headers.get("content-type") ?? "")) { out.cannons = { b64: b.toString("base64") }; break; }
}
writeFileSync("pll_sample.json", JSON.stringify(out));
