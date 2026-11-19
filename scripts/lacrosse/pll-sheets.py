"""PLL box scores from the user's game sheets (copied from the PLL site into Google Sheets, one .xlsx per game).

Usage: python3 scripts/lacrosse/pll-sheets.py <team> <season> <dir of .xlsx> <out.json>
       (merges into out.json: other teams' games already there are kept)

Each sheet is one column: section titles (Offensive, Defensive, Faceoff, Goalie), a header row, then per
player a name, a "POS · #" line (sometimes missing) and the stat line with its numbers run together:
  Offensive  P 1G 2G A Sh Sh% GB TO TCH PAS   "6113922.2%324130"
  Defensive  CT GB P Pen Sh TCH                300002.0 (stored as a number: leading zeros are lost)
  Faceoff    FO FO% P A GB Sh TCH              "17 - 2568%00919"
  Goalie     SA Sv% Sv CSv% CSv                "1435%742.9%3"
The numbers are split by trying every way of cutting the digits and keeping the cuts that obey the stats'
own rules (P = 1G + 2*2G + A; Sh% = goals/shots; FO% = won/taken; CSv% = CSv/Sv), then the same player's
lines in other sections must agree (P, Sh, GB, TCH). A line that still has more than one reading is
reported, never guessed silently.
"""
import itertools, json, re, sys
from pathlib import Path

import openpyxl

SECTIONS = ("Offensive", "Defensive", "Faceoff", "Goalie")
# jersey numbers the PLL's box score leaves off (the owner supplied these)
NUM_FIX = {"Blaze Riorden": "0", "Graham Bundy": "0", "Will Manny": "0", "Brendan Krebs": "0", "Koby Smith": "0"}
# the most any player has had in a game: a cut that goes past these isn't a real stat line
MAX = dict(Sh=30, GB=40, TO=12, TCH=150, CT=10, SA=45, A=10, FOT=60)


def plausibility(o, d, pos=None):
    """Higher = more like a real line. Used only to pick between readings that all obey the rules."""
    score = 0
    if d:
        score -= d.get("lead", 0)  # each zero assumed lost from the front of the number
        if d["GB"] >= 10 and pos != "FO": score -= 3  # double-digit ground balls: faceoff men only
        if d["TCH"] >= 60: score -= 3
    for x in (o, d):
        if not x: continue
        if x.get("TO", 0) >= 10: score -= 3
        if x.get("Pen", 0) >= 3: score -= 2
        if x.get("CT", 0) >= 8: score -= 2
    if o and o["GB"] >= 10 and pos != "FO": score -= 3
    if o and o["TCH"]:
        r = (o["PAS"] or 0) / o["TCH"]
        if r < 0.45: score -= 3  # passes are usually half to all of a player's touches
    return score


def splits(digits, widths):
    """Every way to cut a digit string into len(widths) numbers, each 1..w digits (no leading zero unless 0)."""
    out = []

    if not digits.isdigit(): return []

    def rec(i, k, acc):
        if k == len(widths):
            if i == len(digits): out.append(tuple(acc))
            return
        for w in range(1, widths[k] + 1):
            part = digits[i:i + w]
            if len(part) < w: break
            if len(part) > 1 and part[0] == "0": break
            rec(i + w, k + 1, acc + [int(part)])

    rec(0, 0, [])
    return out


def pct_ok(text, num, den):
    if den == 0: return float(text) == 0
    return abs(float(text) - 100 * num / den) < 0.06


def offensive(s):
    """P 1G 2G A Sh Sh% | GB TO TCH PAS -> list of readings.

    Assists > passes is ruled out only as a tie-break: the PLL does credit an assist with no pass now and
    then (Chris Sabia, Waterdogs 7/2/2022: 1 A, 0 PAS is the line's only reading)."""
    strict = _offensive(s, assists_within_passes=True)
    return strict or _offensive(s, assists_within_passes=False)


def _offensive(s, assists_within_passes):
    pre, post = s.split("%")
    out = []
    for cut in range(1, len(pre)):
        head, pct = pre[:cut], pre[cut:]
        if not re.fullmatch(r"(?:0|[1-9]\d?|100)(?:\.\d)?", pct): continue
        for P, g1, g2, A, Sh in splits(head, [2, 2, 1, 2, 2]):
            if P != g1 + 2 * g2 + A or A > MAX["A"] or g1 + g2 > Sh or Sh > MAX["Sh"] or not pct_ok(pct, g1 + g2, Sh):
                continue
            for GB, TO, TCH, PAS in splits(post, [2, 2, 3, 3]):
                # touches don't count ground balls (a faceoff man can have 5 GB and 3 touches)
                if PAS > TCH or (assists_within_passes and A > PAS) or TO > TCH or GB > MAX["GB"] or TO > MAX["TO"] or TCH > MAX["TCH"]: continue
                # every touch ends in a pass, a shot or a turnover (held on all 2,281 lines through Nov 2026)
                if TCH != PAS + Sh + TO: continue
                out.append(dict(P=P, G1=g1, G2=g2, A=A, Sh=Sh, GB=GB, TO=TO, TCH=TCH, PAS=PAS))
    return out


def defensive(v):
    """CT GB P Pen Sh TCH, stored as a number (leading zeros dropped) -> readings."""
    digits = str(int(round(float(v)))) if isinstance(v, (int, float)) else str(v).split(".")[0]
    out = []
    for lead in range(0, 5):
        for CT, GB, P, Pen, Sh, TCH in splits("0" * lead + digits, [2, 2, 2, 1, 2, 3]):
            if CT > MAX["CT"] or GB > MAX["GB"] or Sh > MAX["Sh"] or TCH > MAX["TCH"]: continue
            out.append(dict(CT=CT, GB=GB, P=P, Pen=Pen, Sh=Sh, TCH=TCH, lead=lead))
    return out


def faceoff(s):
    """'W - T' then FO% then P A GB Sh TCH -> readings."""
    m = re.fullmatch(r"(\d+) - (\d+?)(\d{1,3}(?:\.\d)?)%(\d+)", s.replace("–", "-"))
    out = []
    if not m: return out
    w = int(m.group(1))
    rest = m.group(2) + m.group(3)
    for cut in range(1, len(rest)):
        if not rest[:cut].isdigit(): continue
        t, pct = int(rest[:cut]), rest[cut:]
        if t < w or t > MAX["FOT"] or not re.fullmatch(r"(?:0|[1-9]\d?|100)(?:\.\d)?", pct) or not pct_ok(pct, w, t): continue
        for P, A, GB, Sh, TCH in splits(m.group(4), [2, 2, 2, 2, 3]):
            if GB > MAX["GB"] or Sh > MAX["Sh"] or TCH > MAX["TCH"]: continue
            out.append(dict(FOW=w, FOT=t, P=P, A=A, GB=GB, Sh=Sh, TCH=TCH))
    return out


def goalie(s):
    """SA Sv% | Sv CSv% | CSv -> readings. SA = scores against (2-point goals count 2)."""
    a, b, c = s.split("%")
    out = []
    CSv = int(c)
    for cut in range(1, len(b)):
        Sv, cpct = b[:cut], b[cut:]
        if not Sv.isdigit() or (len(Sv) > 1 and Sv[0] == "0"): continue
        Sv = int(Sv)
        if not re.fullmatch(r"(?:0|[1-9]\d?|100)(?:\.\d)?", cpct) or not pct_ok(cpct, CSv, Sv): continue
        for cut2 in range(1, len(a)):
            SA, spct = a[:cut2], a[cut2:]
            if not SA.isdigit() or (len(SA) > 1 and SA[0] == "0"): continue
            SA = int(SA)
            if SA > MAX["SA"]: continue
            if not re.fullmatch(r"(?:0|[1-9]\d?|100)(?:\.\d)?", spct): continue
            # Sv% = Sv / (Sv + goals against), goals against between SA/2 and SA
            ga = [g for g in range((SA + 1) // 2, SA + 1) if Sv + g and pct_ok(spct, Sv, Sv + g)]
            if (Sv + SA == 0 and float(spct) == 0) or ga:
                out.append(dict(SA=SA, SvPct=float(spct), Sv=Sv, GA=ga[0] if len(ga) == 1 else None, CSv=CSv))
    return out


def read_sheet(path):
    ws = openpyxl.load_workbook(path, data_only=True).worksheets[0]
    vals = [r[0] for r in ws.iter_rows(values_only=True) if r and r[0] is not None]
    rows, sec, i = [], None, 0
    while i < len(vals):
        v = vals[i]
        if v in SECTIONS:
            sec = v; i += 2; continue  # skip the header row
        name = str(v).strip()
        pos = num = None
        nxt = vals[i + 1] if i + 1 < len(vals) else None
        if isinstance(nxt, str) and "·" in nxt:
            pos, num = [x.strip() for x in nxt.split("·")]
            i += 1
        elif isinstance(nxt, str) and re.fullmatch(r"[A-Z]{1,4}", nxt.strip()):
            pos = nxt.strip()  # position with no jersey number listed (e.g. "G")
            i += 1
        line = vals[i + 1]
        rows.append(dict(section=sec, name=name, pos=pos, num=num, line=line))
        i += 2
    return rows


def parse_game(path):
    rows = read_sheet(path)
    players = {}
    for r in rows:
        p = players.setdefault(r["name"], dict(name=r["name"], pos=None, num=None, raw={}))
        p["pos"] = p["pos"] or r["pos"]; p["num"] = p["num"] or r["num"]
        p["raw"][r["section"]] = r["line"]
    problems = []
    for p in players.values():
        raw = p["raw"]
        off = offensive(str(raw["Offensive"])) if "Offensive" in raw else [None]
        dfn = defensive(raw["Defensive"]) if "Defensive" in raw else [None]
        fo = faceoff(str(raw["Faceoff"])) if "Faceoff" in raw else [None]
        gl = goalie(str(raw["Goalie"])) if "Goalie" in raw else [None]
        good = []
        for o, d, f in itertools.product(off, dfn, fo):
            # the same stat must agree across sections; a player with no offensive line had no points/shots
            P = o["P"] if o else 0
            Sh = o["Sh"] if o else 0
            if d and (d["P"] != P or d["Sh"] != Sh): continue
            if o and d and (o["GB"] != d["GB"] or o["TCH"] != d["TCH"]): continue
            if f:
                if f["P"] != P or f["Sh"] != Sh: continue
                if o and (f["A"] != o["A"] or f["GB"] != o["GB"] or f["TCH"] != o["TCH"]): continue
                if d and (f["GB"] != d["GB"] or f["TCH"] != d["TCH"]): continue
            good.append((o, d, f))
        uniq = list({json.dumps([o, d, f], sort_keys=True): (o, d, f) for o, d, f in good}.values())
        # several readings obey every rule: keep the most realistic one, and report it unless it clearly wins
        pl = lambda r: plausibility(r[0], r[1], p["pos"])
        uniq.sort(key=lambda r: -pl(r))
        best = [r for r in uniq if pl(r) == pl(uniq[0])] if uniq else []
        if len(best) != 1 or (raw.get("Goalie") is not None and len(gl) != 1):
            problems.append(dict(player=p["name"], raw={k: str(v) for k, v in raw.items()},
                                 readings=[list(r) for r in best], goalie_readings=gl if raw.get("Goalie") is not None else None))
            if not uniq: continue
        o, d, f = uniq[0]
        p["picked"] = len(uniq) > 1
        g = gl[0] if raw.get("Goalie") is not None and gl else None
        p["stats"] = dict(
            P=(o or {}).get("P", 0), G1=(o or {}).get("G1", 0), G2=(o or {}).get("G2", 0), A=(o or {}).get("A", 0),
            Sh=(o or {}).get("Sh", 0), GB=(o or d or f or {}).get("GB", 0),
            # turnovers and passes are only in the offensive section, caused turnovers and penalties only
            # in the defensive one: a player missing from a section has those stats unknown (None), not 0
            TO=o["TO"] if o else None, PAS=o["PAS"] if o else None,
            TCH=(o or d or f or {}).get("TCH", 0), CT=d["CT"] if d else None, Pen=d["Pen"] if d else None,
            **({"FOW": f["FOW"], "FOT": f["FOT"]} if f else {}),
            **({"SA": g["SA"], "Sv": g["Sv"], "SvPct": g["SvPct"], "CSv": g["CSv"], "GA": g["GA"]} if g else {}),
        )
    return players, problems


def main():
    team, season, src, out = sys.argv[1], int(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4])
    data = json.loads(out.read_text()) if out.exists() else {"source": "", "games": []}
    data["source"] = "PLL game box scores, entered by the site owner from the PLL website (Google Sheets)"
    data["games"] = [g for g in data["games"] if not (g["team"] == team and g["season"] == season)]
    all_problems = []
    for f in sorted(src.glob("*.xlsx")):
        m = re.match(r"(\d{1,2})_(\d{1,2}) vs (.+)\.xlsx$", f.name)
        if not m:
            print("skip (name):", f.name); continue
        date = f"{season}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
        opp = m.group(3).strip().title()
        players, problems = parse_game(f)
        if not players:
            print("EMPTY SHEET, skipped:", f.name); continue
        for pr in problems: pr["game"] = f.name
        all_problems += problems
        data["games"].append(dict(team=team, season=season, date=date, opponent=opp, file=f.name, players=[
            dict(name=p["name"], pos=p["pos"], num=p["num"] or NUM_FIX.get(p["name"]), **({"stats": p["stats"]} if "stats" in p else {}))
            for p in players.values()]))
    data["games"].sort(key=lambda g: (g["team"], g["date"]))
    out.write_text(json.dumps(data, indent=0, ensure_ascii=False))
    n = sum(len(g["players"]) for g in data["games"] if g["team"] == team)
    print(f"{team} {season}: {sum(1 for g in data['games'] if g['team'] == team)} games, {n} player lines, "
          f"{len(all_problems)} lines with more than one reading")
    for pr in all_problems: print("  CHECK", pr)


if __name__ == "__main__":
    main()
