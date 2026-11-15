import { writeFileSync } from "node:fs";
const K = process.env.LACROSSE_API_KEY;
const get = async (p) => { const r = await fetch("https://lacrosseapi.com" + p, { headers: { Authorization: `Bearer ${K}` } }); return [r.status, (await r.text()).slice(0, 1500)]; };
for (const p of [
  "/v1/odds/markets/01a080f8-e1b1-7ca3-8bef-c9d0dae1b2e3",
  "/v1/odds/events/01a080f8-e1a9-7879-9a21-b7ddb99f5af9?include=markets",
  "/v1/odds/markets/019fc6a7-4e4b-791e-98fa-5bbf3c61f328",
  "/v1/openapi.json",
]) { const [s, b] = await get(p); console.log("GET", p, s, b.replace(/\s+/g, " ")); }
writeFileSync("pll_sample.json", "{}");
