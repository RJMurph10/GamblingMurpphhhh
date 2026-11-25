"""MLB home-run props 2024-2026 -> one row per batter-game with pre-game features.
Prices: 2024-25 ESPN BET 'Total Home Runs Hit' over 0.5 (op = opener, cur = last seen);
2026 DraftKings 'Home Runs Milestones' 1+ (px pair). Features are pre-game: season AVG / ERA from the
player's previous box score (ESPN's box carries season-to-date AVG and ERA), HR and AB / IP counted from
earlier boxes in the file."""
import gzip, json, collections, sys
import pandas as pd
rows = []
for season in (2024, 2025, 2026):
    games = [json.loads(l) for l in gzip.open(f'/tmp/mlbp/{season}.jsonl.gz')]
    games = [g for g in games if str(g.get('seasonType')) == '2']
    games.sort(key=lambda g: g['date'])
    bat = collections.defaultdict(lambda: {'AB': 0, 'H': 0, 'HR': 0, 'BB': 0, 'G': 0, 'avg': None})
    pit = collections.defaultdict(lambda: {'outs': 0, 'HR': 0, 'ER': 0, 'BF': 0, 'GS': 0, 'era': None})
    for g in games:
        home, away = g['home']['abbr'], g['away']['abbr']
        box = g.get('box') or {}
        # opposing starters: pos SP with the most innings, else the pitcher with the most innings
        def ip(v):
            try: a, b = v['s'].get('IP', '0').split('.'); return int(a) * 3 + int(b)
            except Exception: return 0
        sp = {}
        for tm in (home, away):
            ps = [(k, v) for k, v in box.items() if v.get('tm') == tm and 'IP' in v.get('s', {})]
            sps = [kv for kv in ps if kv[1].get('pos') == 'SP'] or ps
            if sps: sp[tm] = max(sps, key=lambda kv: ip(kv[1]))[0]
        # prices per athlete
        price = {}
        for b in g['books'].values():
            for r in b['rows']:
                if r['t'] == 'Total Home Runs Hit' and r.get('op') and r['op'][0] == 0.5 and r['op'][1] is not None:
                    price[r['a']] = (r['op'][1], (r.get('cur') or [None, None])[1], None)
                elif r['t'] == 'Home Runs Milestones' and r.get('op') and r['op'][0] == 1 and r.get('px'):
                    price[r['a']] = (r['px'][0], r['px'][1], None)
        for k, v in box.items():
            s = v.get('s', {})
            if 'AB' not in s or v.get('pos') in ('SP', 'RP', 'P'): continue
            tm = v.get('tm'); opp = away if tm == home else home
            spid = sp.get(opp)
            B = bat[k]; P = pit[spid] if spid else None
            if k in price:
                rows.append(dict(season=season, game=g['id'], date=g['date'][:10], pid=k, name=v['n'], team=tm, opp=opp,
                                 park=home, is_home=int(tm == home), pos=v.get('pos'),
                                 p_open=price[k][0], p_cur=price[k][1], hr=int(s.get('HR', '0') or 0) >= 1,
                                 avg=B['avg'], b_ab=B['AB'], b_hr=B['HR'], b_g=B['G'], b_h=B['H'], b_bb=B['BB'],
                                 sp=spid, sp_name=box[spid]['n'] if spid else None,
                                 sp_era=P['era'] if P else None, sp_outs=P['outs'] if P else 0, sp_hr=P['HR'] if P else 0,
                                 sp_gs=P['GS'] if P else 0))
        # update after the game
        for k, v in box.items():
            s = v.get('s', {})
            try:
                if 'AB' in s and v.get('pos') not in ('SP', 'RP', 'P'):
                    B = bat[k]; B['AB'] += int(s.get('AB', 0) or 0); B['H'] += int(s.get('H', 0) or 0)
                    B['HR'] += int(s.get('HR', 0) or 0); B['BB'] += int(s.get('BB', 0) or 0); B['G'] += 1
                    if s.get('AVG') not in (None, '', '--', '-.---'): B['avg'] = float(s['AVG'])
                if 'IP' in s:
                    P = pit[k]; P['outs'] += ip(v); P['HR'] += int(s.get('HR', 0) or 0); P['ER'] += int(s.get('ER', 0) or 0)
                    if k in sp.values(): P['GS'] += 1
                    if s.get('ERA') not in (None, '', '--', '-.--'): P['era'] = float(s['ERA'])
            except ValueError:
                pass
    print(season, len(games), sum(1 for r in rows if r['season'] == season), file=sys.stderr)
df = pd.DataFrame(rows)
df.to_parquet('/home/claude/hrwork/hr.parquet')
print(df.groupby('season').agg(n=('hr', 'size'), hr_rate=('hr', 'mean'), med_open=('p_open', 'median')))
