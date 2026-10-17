import csv,re,os,json,itertools
K='keys/3-bani-sung-like-kirtan/aarti'
over={'aa24':[('bani:22',30,120.5),('bani:4',120.5,160)],'aa25':[('bani:22',30,60.5),('bani:4',60.5,100)],'aa26':[('bani:4',0,40),('880',100,160)],'aa27':[('880',39,138)]}
perf={}
for r in csv.DictReader(open('keys/manifest.csv')):
  m=re.match(r'(aa\d+)_(\w+?)_(\d+)-(\d+)\.wav',r['source_file'])
  if not m or not r['suite_jobs']: continue
  sh=over.get(r['id']) or [(x['shabadId'],float(x['start_s']),float(x['end_s'])) for x in csv.DictReader(open(f"{K}/{r['id']}/shabads.csv"))]
  off=float(m.group(3)); a=off+min(s for _,s,_ in sh); b=off+max(e for *_,e in sh)
  perf.setdefault(m.group(2),[]).append((r['id'],a,b))
keep=[];drop={}
for p,cl in perf.items():
  best=(0,[])
  for n in range(1,len(cl)+1):
    for c in itertools.combinations(sorted(cl,key=lambda x:x[1]),n):
      if all(c[i][2]<=c[i+1][1] for i in range(len(c)-1)):
        v=sum(b-a for _,a,b in c)
        if v>best[0]+1e-9: best=(v,c)
  ids=[x[0] for x in best[1]]; keep+=ids
  for x in cl:
    if x[0] not in ids: drop[x[0]]=[k for k in best[1] if not (k[2]<=x[1] or x[2]<=k[1])][0][0] if any(not (k[2]<=x[1] or x[2]<=k[1]) for k in best[1]) else None
  print(p,'keep',[(i,a,b) for i,a,b in best[1]],'keyed s',round(best[0]),'of clips',[(i,a,b) for i,a,b in cl])
print('drop',drop)
json.dump({'keep':keep,'drop':drop},open('tile.json','w'))
