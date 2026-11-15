/**
 * College logos for PLL players: ESPN team ids (a.espncdn.com/i/teamlogos/ncaa/500/<id>.png), and public-domain
 * marks stored in public/logos/colleges for schools ESPN doesn't list. Same map as scripts/pll-wiki-players.py.
 */
const ESPN: Record<string, string> = {
  Albany: "399",
  Army: "349",
  Bellarmine: "91",
  Brown: "225",
  Bryant: "2803",
  Colgate: "2142",
  Cornell: "172",
  Delaware: "48",
  Denver: "2172",
  "Detroit Mercy": "2174",
  Drexel: "2182",
  Duke: "150",
  Florida: "57",
  Georgetown: "46",
  Harvard: "108",
  "High Point": "2272",
  Ithaca: "175",
  Jacksonville: "294",
  "Johns Hopkins": "118",
  Lafayette: "322",
  Lehigh: "2329",
  Loyola: "2352",
  Marist: "2368",
  Marquette: "269",
  Maryland: "120",
  Mercyhurst: "2385",
  Michigan: "130",
  "North Carolina": "153",
  "Notre Dame": "87",
  "Ohio State": "194",
  Penn: "219",
  "Penn State": "213",
  Princeton: "163",
  Providence: "2507",
  Richmond: "257",
  Rutgers: "164",
  "Saint Joseph's": "2603",
  Salisbury: "2532",
  "St. Bonaventure": "179",
  "St. John's": "2599",
  Syracuse: "183",
  Towson: "119",
  Tufts: "112",
  UMass: "113",
  Utah: "254",
  Vermont: "261",
  Villanova: "222",
  Virginia: "258",
  Wingate: "351",
  Yale: "43",
  Hobart: "174",
  Wesleyan: "336",
  "LIU Post": "2341",
};
const LOCAL: Record<string, string> = {
  Adelphi: "/logos/colleges/adelphi.png",
  York: "/logos/colleges/york.png",
};
// other names the feeds use for the same schools
const ALIAS: Record<string, string> = {
  "Long Island Post": "LIU Post",
  LIU: "LIU Post",
  Massachusetts: "UMass",
  Pennsylvania: "Penn",

  "St. Joseph's": "Saint Joseph's",
  UAlbany: "Albany",
  "Loyola Maryland": "Loyola",
  "Loyola (MD)": "Loyola",
  "Albany (NY)": "Albany",
  "Ithaca College": "Ithaca",
  "Notre Dame/Holy Cross": "Notre Dame",
};

/** A college's logo URL, if we have one. */
export function collegeLogoFor(college: string | null | undefined): string | undefined {
  if (!college) return undefined;
  const name = ALIAS[college.trim()] ?? college.trim();
  if (ESPN[name]) return `https://a.espncdn.com/i/teamlogos/ncaa/500/${ESPN[name]}.png`;
  return LOCAL[name];
}
