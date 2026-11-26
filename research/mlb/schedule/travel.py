"""Schedule angles: travel, time zones, days off, doubleheaders, getaway days. Totals and moneylines,
closing (2012-2025: SBR to 2021 at -110 totals, DraftKings 2022-25 with prices) and opening (DK 2021-25)."""
import pandas as pd, numpy as np
from math import radians, sin, cos, asin, sqrt
gm = pd.read_parquet('games.parquet')
gm['dt'] = pd.to_datetime(gm.date)
# park city coordinates + UTC offset (standard time); neutral sites keep the home team's city
CITY = {'ANA':(33.80,-117.88,-8),'ARI':(33.45,-112.07,-7),'ATL':(33.89,-84.47,-5),'BAL':(39.28,-76.62,-5),'BOS':(42.35,-71.10,-5),
 'CHA':(41.83,-87.63,-6),'CHN':(41.95,-87.66,-6),'CIN':(39.10,-84.51,-5),'CLE':(41.50,-81.69,-5),'COL':(39.76,-104.99,-7),
 'DET':(42.34,-83.05,-5),'HOU':(29.76,-95.36,-6),'KCA':(39.05,-94.48,-6),'LAN':(34.07,-118.24,-8),'MIA':(25.78,-80.22,-5),
 'FLO':(25.96,-80.24,-5),'MIL':(43.03,-87.97,-6),'MIN':(44.98,-93.28,-6),'NYA':(40.83,-73.93,-5),'NYN':(40.76,-73.85,-5),
 'OAK':(37.75,-122.20,-8),'ATH':(38.58,-121.51,-8),'PHI':(39.91,-75.17,-5),'PIT':(40.45,-80.01,-5),'SDN':(32.71,-117.16,-8),
 'SEA':(47.59,-122.33,-8),'SFN':(37.78,-122.39,-8),'SLN':(38.62,-90.19,-6),'TBA':(27.77,-82.65,-5),'TEX':(32.75,-97.08,-6),
 'TOR':(43.64,-79.39,-5),'WAS':(38.87,-77.01,-5)}
def miles(a, b):
    la1, lo1, _ = CITY[a]; la2, lo2, _ = CITY[b]
    la1, lo1, la2, lo2 = map(radians, (la1, lo1, la2, lo2))
    return 3959 * 2 * asin(sqrt(sin((la2-la1)/2)**2 + cos(la1)*cos(la2)*sin((lo2-lo1)/2)**2))
# team-game log
tg = pd.concat([gm.assign(team=gm.home, opp=gm.away, side='H'), gm.assign(team=gm.away, opp=gm.home, side='A')])
tg = tg.sort_values(['team', 'dt', 'number']).reset_index(drop=True)
tg['city'] = tg.home.where(tg.home.isin(CITY), tg.team)
prev = tg.groupby(['team', 'season']).shift(1)
tg['rest'] = (tg.dt - prev.dt).dt.days - 1            # full days off before this game
tg['miles'] = [miles(a, b) if isinstance(a, str) and a in CITY and b in CITY else np.nan for a, b in zip(prev.city, tg.city)]
tg['tz'] = [CITY[b][2] - CITY[a][2] if isinstance(a, str) and a in CITY and b in CITY else np.nan for a, b in zip(prev.city, tg.city)]
tg['prev_night'] = prev.daynight.eq('night')
tg['dh'] = tg.number.astype(int)
tg['last7'] = tg.groupby(['team', 'season']).dt.transform(lambda s: s.rolling('7D', closed='left').count() if False else 0)
# games in the previous 6 days (fatigue)
out = []
for (t, s), d in tg.groupby(['team', 'season']):
    ds = d.dt.values
    out.append(pd.Series([((ds < x) & (ds >= x - np.timedelta64(6, 'D'))).sum() for x in ds], index=d.index))
tg['g6'] = pd.concat(out)
# road trip length so far (consecutive away games)
tg['away_run'] = tg.groupby(['team', 'season']).side.transform(lambda s: s.eq('A').groupby((s != s.shift()).cumsum()).cumcount() + 1).where(tg.side == 'A', 0)
feat = tg[['game_id', 'team', 'side', 'rest', 'miles', 'tz', 'prev_night', 'dh', 'g6', 'away_run', 'daynight']]
feat.to_parquet('sched.parquet')
print(feat.describe().round(2).to_string())
