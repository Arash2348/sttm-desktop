import csv,sys,re,collections
D=sys.argv[1]; EX={'pt37','pt42','pt46'}
name={'bani:22':'Aarti','bani:4':'Jaap Sahib','bani:90':'Asa di Vaar','bani:21':'Rehras'}
tot=collections.defaultdict(float); clips=collections.defaultdict(set); unscored=collections.defaultdict(float)
for r in csv.DictReader(open(f'{D}/manifest.csv')):
  f=r['content_folder']
  if not f.startswith('3-'): continue
  scored= r['suite_jobs'] and r['id'] not in EX and 'gab-exclude' not in r['notes'] and 'Fremont (Jaspal)' not in r['gurdwara']
  if not scored: unscored[r['id']]+=float(r['duration_s']); continue
  sh=list(csv.DictReader(open(f"{D}/{f}/{r['id']}/shabads.csv")))
  # keyed seconds by unit, union per unit; Bani rows win over their member Shabads
  per=collections.defaultdict(set)
  banis=[s for s in sh if s['shabadId'].startswith('bani:')]
  for s in sh:
    sid=s['shabadId']; a,b=float(s['start_s']),float(s['end_s'])
    u=name.get(sid) or ('Saloks (Farid)' if sid in('5238','5239','5299','5286') else 'Sukhmani Salok' if sid=='880' else None)
    if u is None:
      if banis: continue  # a piece of the Bani row
      u='Shabad '+sid
    for t in range(int(a),int(b)): per[u].add(t)
  for u,ts in per.items(): tot[(u,r['split'])]+=len(ts); clips[(u,r['split'])].add(r['id'])
for k in sorted(tot): print(k[0],k[1],round(tot[k]/60,1),'min',len(clips[k]),'clips')
print('unscored rows (min):',{k:round(v/60,1) for k,v in unscored.items()})
