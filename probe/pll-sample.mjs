import { writeFileSync } from "node:fs";
const out = {};
const q = async (u) => { try { const r = await fetch(u); return r.ok ? await r.text() : `ERR ${r.status}`; } catch (e) { return `ERR ${e}`; } };
const urls = [
  "https://premierlacrosseleague.com/wp-content/uploads/2020/02/500x500_PLL_Teams_square_chrome-1.png",
  "https://web.archive.org/web/20210711090413im_/https://premierlacrosseleague.com/wp-content/uploads/2020/02/500x500_PLL_Teams_square_chrome-1.png",
  "https://web.archive.org/web/20220702154436im_/https://premierlacrosseleague.com/wp-content/uploads/2021/01/chromeLogoBlock@2x.png",
  "https://web.archive.org/web/20230920224625im_/https://premierlacrosseleague.com/wp-content/uploads/2019/05/chrome-gray.png",
];
for (const u of urls) {
  const r = await fetch(u); const b = Buffer.from(await r.arrayBuffer());
  console.log("IMG", u, r.status, r.headers.get("content-type"), b.length);
  if (r.ok) out[u] = { type: r.headers.get("content-type"), b64: b.toString("base64") };
}
writeFileSync("pll_sample.json", JSON.stringify(out));
