const B = "https://site.api.espn.com/apis/site/v2/sports/lacrosse/pll";
const t = (await (await fetch(`${B}/teams/127635`)).json()).team;
console.log("TEAM", JSON.stringify({ n: t.displayName, loc: t.location, logos: t.logos }));
const c = await (await fetch("https://sports.core.api.espn.com/v2/sports/lacrosse/leagues/pll/seasons/2021/teams/127635")).text();
console.log("CORE2021", c.slice(0, 1500));
for (const v of ["500-dark", "scoreboard", "500/scoreboard"]) {
  const u = `https://a.espncdn.com/i/teamlogos/pll/${v}/127635.png`; const r = await fetch(u); console.log("CDN", u, r.status, (await r.arrayBuffer()).byteLength);
}
const w = await (await fetch("https://en.wikipedia.org/w/api.php?action=query&titles=Chrome_Lacrosse_Club&prop=pageimages|images&piprop=original&format=json&formatversion=2&redirects=1", { headers: { "User-Agent": "GamblingNFL research (github.com/RJMurph10/gamblingnfl)" } })).json();
console.log("WIKI", JSON.stringify(w.query?.pages?.[0]).slice(0, 800));
