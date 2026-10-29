import json,glob,os
W='/Users/asingh02/personal/gab-builds/pc-final'; D=f'{W}/cards'
BUILDS=[('x9020','Experimental 9.0.20'),('v1001','10.0.1'),('v1004','10.0.4'),('c1','10.0.5'),('v1006','10.0.6'),('v1007','10.0.7a'),('v1007b','10.0.7b')]
ROWS=[('GAB-Hard test','hard','test','1-kirtan-shabad'),('GAB-Hard dev','hard','dev','1-kirtan-shabad'),
 ('Kirtan test','main','test','1-kirtan-shabad'),('Kirtan dev','main','dev','1-kirtan-shabad'),
 ('Bani sung test','main','test','3-bani-sung-like-kirtan'),('Bani sung dev','main','dev','3-bani-sung-like-kirtan'),
 ('Paath test','main','test','2-bani-recited'),('Paath dev','main','dev','2-bani-recited'),
 ('Akhand Paath test','main','test','4-akhand-paath'),('Akhand Paath dev','main','dev','4-akhand-paath'),
 ('Akhand Kirtan test','akhand','test','5-akhand-kirtan'),('Akhand Kirtan dev','akhand','dev','5-akhand-kirtan')]
def clips_of(b,t,s,key):
  out={}; rows=[]
  for f in sorted(glob.glob(f'{D}/{b}-*/{t}-{s}.json')):
    c=json.load(open(f))
    r=next((x for x in c['rows'] if x.get('key')==key and x.get('clips')),None)
    if r: rows.append(r)
    for x in c['clips']:
      if x['folder'].split('/')[0]==key: out[x['id']]=x
  return out,rows
def agg(cl):
  h=sum(c['hours'] for c in cl) or 1e-9
  right=sum((c['right_shabad_pct'] or 0)*c['hours'] for c in cl)/h
  wrong=sum(c['wrong_s_per_h']*c['hours'] for c in cl)/h
  pc=[c for c in cl if c.get('pangti_pct') is not None]; ph=sum(c['hours'] for c in pc)
  pang=sum(c['pangti_pct']*c['hours'] for c in pc)/ph if ph else None
  return round(right,1),(round(pang,1) if pang is not None else None),round(wrong,1),round(h,2)
def worse(a,b):  # a worse than b on any of right Shabad / right pangti / wrong s per h
  return a[0]<b[0]-0.05 or (a[1] is not None and b[1] is not None and a[1]<b[1]-0.05) or a[2]>b[2]+0.05
def better(a,b): return (a[0]>b[0]+0.05 or (a[1] is not None and b[1] is not None and a[1]>b[1]+0.05) or a[2]<b[2]-0.05) and not worse(a,b)
def fmt(v): return f"{v[0]} / {v[1] if v[1] is not None else '-'} / {v[2]}"
L=['| Tier / split | clips · hours | '+' | '.join(n for _,n in BUILDS)+' |','|---|---|'+'---|'*len(BUILDS)]
verdict={b:{'worse':[],'better':[],'same':[]} for b,_ in BUILDS[1:]}; clipdiff={b:[] for b,_ in BUILDS[1:]}; notes=[]
for name,t,s,key in ROWS:
  got={b:clips_of(b,t,s,key)[0] for b,_ in BUILDS}
  have={b:set(v) for b,v in got.items() if v}
  if 'x9020' not in have:
    L.append(f'| {name} | - | '+' | '.join('not run' if b not in have else fmt(agg(list(got[b].values()))) for b,_ in BUILDS)+' |'); continue
  common=set.intersection(*have.values())
  vals={b:(agg([got[b][i] for i in common]) if b in have else None) for b,_ in BUILDS}
  if all(have[b]==common for b in have):
    for b in have:
      rs=clips_of(b,t,s,key)[1]
      if len(rs)==1: r=rs[0]; vals[b]=(r['right_shabad_pct'],r.get('pangti_pct'),r['wrong_s_per_h'],vals[b][3])
  cells=[]
  for b,_ in BUILDS:
    v=vals[b]
    if v is None: cells.append('not run'); continue
    mark=''
    if b!='x9020':
      if worse(v,vals['x9020']): mark=' ❌'; verdict[b]['worse'].append(name)
      elif better(v,vals['x9020']): mark=' ✅'; verdict[b]['better'].append(name)
      else: verdict[b]['same'].append(name)
      for i in sorted(common):
        a,e=got[b][i],got['x9020'][i]
        d=((a['right_shabad_pct'] or 0)-(e['right_shabad_pct'] or 0),(a.get('pangti_pct') or 0)-(e.get('pangti_pct') or 0),a['wrong_s_per_h']-e['wrong_s_per_h'])
        if abs(d[0])>=5 or abs(d[1])>=5 or abs(d[2])>=30: clipdiff[b].append((name,i.split('_')[0],d,e,a))
    cells.append(fmt(v)+mark)
  L.append(f"| {name} | {len(common)} · {vals['x9020'][3]:.1f} h | "+' | '.join(cells)+' |')
  miss={b:len(set.union(*have.values())-have[b]) for b in have}
  if any(miss.values()): notes.append(f"{name}: clips not replayed per build (cache miss): "+', '.join(f'{n}: {miss[b]}' for b,n in BUILDS if b in miss))
print('Cells: right Shabad % / right pangti % / wrong Shabad s per h. ✅ better than experimental on at least one and worse on none; ❌ worse on at least one (margins 0.05).\n')
print('\n'.join(L)); print()
for b,n in BUILDS[1:]:
  v=verdict[b]; print(f"**{n} vs experimental 9.0.20:** better on {len(v['better'])} ({', '.join(v['better']) or '-'}); same on {len(v['same'])}; worse on {len(v['worse'])} ({', '.join(v['worse']) or '-'}). Better in all cases with no degradation: {'YES' if v['better'] and not v['worse'] else 'NO'}.")
print(); print('Per-clip differences vs experimental (right Shabad pts, right pangti pts, wrong s/h; only |Shabad| or |pangti| >= 5 pts or |wrong| >= 30 s/h):')
for b,n in BUILDS[1:]:
  print(f'\n{n}:'); print('| tier | clip | Shabad Δ | pangti Δ | wrong Δ | experimental | this build |'); print('|---|---|---|---|---|---|---|')
  for name,i,d,e,a in clipdiff[b]:
    print(f"| {name} | {i} | {d[0]:+.1f} | {d[1]:+.1f} | {d[2]:+.0f} | {e['right_shabad_pct']} / {e.get('pangti_pct')} / {e['wrong_s_per_h']} | {a['right_shabad_pct']} / {a.get('pangti_pct')} / {a['wrong_s_per_h']} |")
if notes: print(); print('\n'.join('- '+x for x in notes))

# ---- per-clip tally: any metric worse / better (tolerance 0.05), over all tiers, vs experimental
print(); print('Per-clip tally vs experimental over all tiers (a clip counts as worse if any of the three metrics is worse by > 0.05; the wrong-Shabad seconds column is the sum of (this build - experimental) over the worse clips):')
print('| build | clips compared | better | same | worse | worse clips (seconds of extra wrong Shabad, pts of Shabad lost) |'); print('|---|---|---|---|---|---|')
for b,n in BUILDS[1:]:
  tb=ts=tw=0; cmp=0; wl=[]
  for name,t,s,key in ROWS:
    A=clips_of('x9020',t,s,key)[0]; B=clips_of(b,t,s,key)[0]
    for i in set(A)&set(B):
      a,e=B[i],A[i]; cmp+=1
      d=((a['right_shabad_pct'] or 0)-(e['right_shabad_pct'] or 0),(a.get('pangti_pct') or 0)-(e.get('pangti_pct') or 0),e['wrong_s_per_h']-a['wrong_s_per_h'])
      if min(d)<-0.05: tw+=1; wl.append(f"{i.split('_')[0]} ({(a['wrong_s_per_h']-e['wrong_s_per_h'])*e['hours']:+.0f} s, {d[0]:+.1f} pt)")
      elif max(d)>0.05: tb+=1
      else: ts+=1
  if cmp: print(f"| {n} | {cmp} | {tb} | {ts} | {tw} | {', '.join(wl) or '-'} |")
