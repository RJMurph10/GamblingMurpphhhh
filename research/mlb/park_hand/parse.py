"""Retrosheet 2010-2025 regular-season events -> plate appearances and games.
PA: game_id, season, park, bat_home, batter, bhand (R/L/B), pitcher, phand, eff (batter's effective side),
woba (linear-weight value), hr, runs, slot (batting order 1-9), inn.
Games: game_id, date, season, park, home, away, temp, winddir, windspeed, sky, daynight, home_runs, away_runs,
starting pitchers and their hands, starting lineups (9 batters each, effective sides vs the opposing starter)."""
import glob, re, sys, json
import pandas as pd
ROOT = '/home/claude/mlbdata/retrosheet/seasons'
W = {'BB': .69, 'HBP': .72, '1B': .88, '2B': 1.25, '3B': 1.58, 'HR': 2.03, 'ROE': .88}
NON_PA = re.compile(r'^(SB|CS|PO|POCS|WP|PB|BK|DI|OA|NP|FLE|OBS)')
def outcome(ev):
    e = ev.split('/')[0].split('.')[0]
    if NON_PA.match(e): return None
    if e.startswith('K'): return 'K'
    if e == 'I' or e.startswith('IW') or e.startswith('I+'): return 'IBB'
    if e.startswith('W'): return 'BB'
    if e.startswith('HP'): return 'HBP'
    if e.startswith('HR') or (e.startswith('H') and not e.startswith('HP')): return 'HR'
    if e.startswith('DGR') or e.startswith('D'): return '2B'
    if e.startswith('T'): return '3B'
    if e.startswith('S'): return '1B'
    if e.startswith('E'): return 'ROE'
    return 'OUT'
def runs_on(ev):
    adv = ev.split('.', 1)[1] if '.' in ev else ''
    r = sum(1 for a in adv.split(';') if re.match(r'^[B123]-H', a))
    e = ev.split('/')[0].split('.')[0]
    if (e.startswith('HR') or (e.startswith('H') and not e.startswith('HP'))) and 'B-H' not in adv: r += 1
    return r
pas, games = [], []
for season in [2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2021,2022,2023,2024,2025]:
    hands = {}
    for f in glob.glob(f'{ROOT}/{season}/*{season}.ROS'):
        for line in open(f, encoding='latin-1'):
            p = line.strip().split(',')
            if len(p) >= 5: hands[p[0]] = (p[3], p[4])
    for f in sorted(glob.glob(f'{ROOT}/{season}/{season}???.EV[AN]')):
        g = None
        def flush():
            if g and g.get('pa'):
                games.append({k: v for k, v in g.items() if k not in ('pa', 'cur', 'slot')})
        for line in open(f, encoding='latin-1'):
            p = line.rstrip('\n').split(',')
            t = p[0]
            if t == 'id':
                flush()
                g = {'game_id': p[1], 'season': season, 'cur': {0: None, 1: None}, 'slot': {}, 'pa': 0,
                     'lineup0': [], 'lineup1': [], 'sp0': None, 'sp1': None, 'runs0': 0, 'runs1': 0}
            elif t == 'info':
                k = p[1]
                if k in ('visteam', 'hometeam', 'site', 'date', 'temp', 'winddir', 'windspeed', 'sky', 'daynight', 'number'):
                    g[k] = p[2]
            elif t in ('start', 'sub'):
                pid, team, bpos, fpos = p[1], int(p[3]), int(p[4]), int(p[5])
                if bpos > 0: g['slot'][pid] = bpos
                if fpos == 1:
                    g['cur'][team] = pid
                    if t == 'start': g[f'sp{team}'] = pid
                if t == 'start' and bpos > 0: g[f'lineup{team}'].append((bpos, pid))
            elif t == 'play':
                inn, top, batter, ev = int(p[1]), int(p[2]), p[3], p[6]
                o = outcome(ev)
                r = runs_on(ev)
                g[f'runs{top}'] += r
                if o is None or ev.startswith('NP'): continue
                pit = g['cur'][1 - top]
                bh = hands.get(batter, ('?', '?'))[0]
                ph = hands.get(pit, ('?', '?'))[1]
                eff = bh if bh in ('R', 'L') else ('L' if ph == 'R' else 'R')
                pas.append((g['game_id'], season, g.get('site'), top, batter, bh, pit, ph, eff,
                            W.get(o, 0.0), int(o == 'HR'), r, g['slot'].get(batter, 0), inn))
                g['pa'] += 1
        flush()
    print(season, len(games), len(pas), file=sys.stderr)
pa = pd.DataFrame(pas, columns=['game_id','season','park','bat_home','batter','bhand','pitcher','phand','eff','woba','hr','runs','slot','inn'])
pa.to_parquet('/home/claude/mlbwork/pa.parquet')
gm = pd.DataFrame(games)
gm['lineup0'] = gm.lineup0.map(lambda l: [b for _, b in sorted(l)])
gm['lineup1'] = gm.lineup1.map(lambda l: [b for _, b in sorted(l)])
gm.rename(columns={'visteam': 'away', 'hometeam': 'home', 'site': 'park', 'runs0': 'away_runs', 'runs1': 'home_runs'}, inplace=True)
gm.to_parquet('/home/claude/mlbwork/games.parquet')
hand_rows = []
for season in [2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2021,2022,2023,2024,2025]:
    for f in glob.glob(f'{ROOT}/{season}/*{season}.ROS'):
        for line in open(f, encoding='latin-1'):
            p = line.strip().split(',')
            if len(p) >= 5: hand_rows.append((season, p[0], p[3], p[4]))
pd.DataFrame(hand_rows, columns=['season','pid','bats','throws']).drop_duplicates(['season','pid']).to_parquet('/home/claude/mlbwork/hands.parquet')
