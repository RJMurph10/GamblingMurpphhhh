import json,urllib.request as u
def get(url): return json.load(u.urlopen(u.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30))
B='https://site.api.espn.com/apis/site/v2/sports/football/college-football'
for d in ('20261204','20261205'):
  sb=get(f'{B}/scoreboard?groups=80&dates={d}&limit=200')
  for e in sb['events']:
    c=e['competitions'][0]
    print('EVENT',d,e['id'],e['name'],'|',e.get('week'),e.get('season',{}).get('type'),'| notes',c.get('notes'),'| conf',c.get('conferenceCompetition'),'| neutral',c.get('neutralSite'),'| venue',(c.get('venue') or {}).get('fullName'))
    for t in c['competitors']: print('   ',t['homeAway'],t['team'].get('id'),t['team'].get('displayName'),t['team'].get('abbreviation'),'| keys',sorted(t['team'].keys())[:12])
    print('   groups',c.get('groups'))
st=get(f'https://site.api.espn.com/apis/v2/sports/football/college-football/standings?group=80&season=2026')
ch=st.get('children',[])
print('CONFS',[(x.get('id'),x.get('name'),x.get('abbreviation'),len(x.get('standings',{}).get('entries',[]))) for x in ch])
x=next(c for c in ch if 'Mountain' in c.get('name',''))
e=x['standings']['entries'][0]
print('ENTRY team',e['team'].get('id'),e['team'].get('displayName'))
for s in e['stats']: print('  ',s.get('name'),s.get('type'),s.get('displayName'),s.get('displayValue'),s.get('summary'))
print('CLINCH',[ (en['team']['displayName'],[s.get('displayValue') for s in en['stats'] if 'clinch' in (s.get('name') or '').lower()]) for en in x['standings']['entries']])
for c in ch:
  print('C',c.get('name'),[(en['team']['abbreviation'],next((s.get('summary') or s.get('displayValue') for s in en['stats'] if s.get('type')=='vsconf' or s.get('name')=='vsConf'),None)) for en in c['standings']['entries']])
