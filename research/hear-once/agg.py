import json,glob,os,re,subprocess,sys
from collections import defaultdict
T='/Users/asingh02/personal/sttm-ws4/research/level2-dataset/tools'
INF=['kh12','kh13','kh17','kh19','kh20','kh21','kh26','kh27','kh28','kh29']
rows=defaultdict(dict)
D=os.environ.get('D','e2e')
for lab in sorted(os.listdir(D)):
  for f in glob.glob(f'{D}/{lab}/{lab}/*.json'):
    if f.endswith('sweep.json'): continue
    m=re.match(r'(kh\d+)-([\d.]+)x\.json',os.path.basename(f))
    if not m or m.group(1) not in INF: continue
    out=subprocess.run(['node','-e',f"const {{scoreRun}}=require('{T}/sim-score');console.log(JSON.stringify(scoreRun(JSON.parse(require('fs').readFileSync('{f}')))))"],capture_output=True,text=True).stdout
    try: s=json.loads(out.strip().splitlines()[-1])
    except Exception as e: continue
    rows[(lab,m.group(2))][m.group(1)]=s
def g(s,*ks):
  for k in ks:
    for kk in s:
      if kk.lower().startswith(k): return s[kk]
  return None
print('| run | clips | right % (avg) | wrong Shabad s (sum) | first Shabad s (median) | line lag s (median) | backlog p95 s |')
print('|---|---|---|---|---|---|---|')
import statistics as st
for (lab,sp),d in sorted(rows.items()):
  r=[g(s,'right') for s in d.values()]; w=[g(s,'wrong page','wrong s') for s in d.values()]
  fi=[g(s,'first') for s in d.values()]; lg=[g(s,'lag') for s in d.values()]; bl=[g(s,'backlog p95') for s in d.values()]
  num=lambda xs:[x for x in xs if isinstance(x,(int,float))]
  med=lambda xs:(round(st.median(num(xs)),1) if num(xs) else None)
  print(f"| {lab} @{sp} | {len(d)} | {round(sum(num(r))/max(1,len(num(r))),1)} | {round(sum(num(w)))} | {med(fi)} | {med(lg)} | {med(bl)} |")
if len(sys.argv)>1:
  for (lab,sp),d in sorted(rows.items()):
    print(lab,sp,{k:(g(s,'right'),g(s,'wrong page','wrong s'),g(s,'first'),g(s,'lag')) for k,s in sorted(d.items())})
