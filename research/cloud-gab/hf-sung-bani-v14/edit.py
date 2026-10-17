# GAB v1.4 Sung Bani cleanup: edits a local copy of the dataset (csv/meta only) and lists every changed path
import csv,io,json,os,sys
D=sys.argv[1]; SB='3-bani-sung-like-kirtan'; AK='5-akhand-kirtan'
raw=open(f'{D}/manifest.csv',newline='').read()
rows=list(csv.reader(io.StringIO(raw))); head=rows[0]; I={k:i for i,k in enumerate(head)}
def ser(r):
  b=io.StringIO(); csv.writer(b,lineterminator='\n').writerow(r); return b.getvalue()[:-1]
lines=raw.split('\n')
assert all(ser(r)==lines[i] for i,r in enumerate(rows)), 'manifest does not round-trip'
changed=set(); moved={}
def note(r,t): r[I['notes']]=(r[I['notes']]+'; ' if r[I['notes']] else '')+t
def wcsv(path,h,data):
  os.makedirs(os.path.dirname(path),exist_ok=True)
  open(path,'w').write(h+'\n'+'\n'.join(','.join(str(x) for x in d) for d in data)+'\n'); changed.add(os.path.relpath(path,D))
ASA_MOVE=['ytasa1_4IXk2t_Irqo_900-1620','nw11_asa1','nw11_asa2','nw11_session','ytasa2_iB7HUIMltf4_full']
DUP_NEWTON={'nw11_session':'x'}
DROP=json.load(open('tile.json'))['drop']
REKEY={ # clip seconds; whole-pangti boundaries from the heard text (rec 153.2 s = end of Aarti's last pangti, Jaap's Chatr chakr verses follow)
 'aa24':([('bani:22',30,123.2,'human'),('bani:4',123.2,160,'human')],'Aarti; then Jaap Sahib (Chatr chakr verses) from 123 s'),
 'aa25':([('bani:22',30,63.2,'human'),('bani:4',63.2,100,'human')],'Aarti; then Jaap Sahib (Chatr chakr verses) 63-100 s; 100-160 s simran and instruments (no key)'),
 'aa26':([('bani:4',3.2,40,'human'),('880',100,160,'human')],'Jaap Sahib (Chatr chakr verses) 3-40 s; 40-100 s instruments and Waheguru simran (no key); Sukhmani Salok (Deen darad dukh bhanjana, Shabad 880) from 100 s'),
 'aa27':([('880',39,138,'human')],'0-39 s instruments and Waheguru simran (no key); Sukhmani Salok (Deen darad dukh bhanjana, Shabad 880) 39-138 s'),
 'rt11_fareed2':([('5238',18.5,435,'aligned'),('5239',224,299,'human')],'Salok Fareed 28 (5238) sung as kirtan; Salok 29 (5239, Rukhi sukhi khai kai) sung 224-299 s inside it, keyed as a parmaan (either Salok on screen counts, as in rt11_fareed1)'),
}
for r in rows[1:]:
  if not r or not r[0]: continue
  id_=r[0]; cf=r[I['content_folder']]; old=list(r)
  if id_ in REKEY:
    sh,txt=REKEY[id_]; d=f'{D}/{cf}/{id_}'
    wcsv(f'{d}/shabads.csv','shabadId,start_s,end_s,source',sh)
    L=list(csv.DictReader(open(f'{d}/lines.csv')))
    # drop only the aligned lines that sit inside a re-keyed stretch (Jaap / Sukhmani Salok / Salok 29): elsewhere unchanged
    keep=[l for l in L if not any(s not in ('bani:22','5238','5239') and float(l['start_s'])<b and float(l['end_s'])>a for s,a,b,_ in sh)]
    if len(keep)!=len(L): wcsv(f'{d}/lines.csv','verseId,start_s,end_s,confidence,source',[[l['verseId'],l['start_s'],l['end_s'],l['confidence'],l['source']] for l in keep])
    r[I['shabads_n']]=str(len(sh)); r[I['lines_n']]=str(len(keep))
    if not keep: r[I['lines_source']]='none'
    if id_.startswith('aa'): r[I['bani']]={'aa24':'Aarti; Jaap Sahib','aa25':'Aarti; Jaap Sahib','aa26':'Jaap Sahib; Sukhmani Salok','aa27':'Sukhmani Salok'}[id_]
    note(r,f'v1.4 key fix: {txt}')
  if id_=='rt11_fareed1': note(r,"v1.4: 0-34 s is the ragi's spoken introduction in Punjabi (not Bani), left unkeyed (a gap); the Shabad key starts at 34 s")
  if id_ in DROP: note(r,f'gab-exclude: same sung moments as {DROP[id_]} (v1.4: one non-overlapping cut per performance)')
  if id_ in ASA_MOVE:
    r[I['content_folder']]=AK; 
    if r[I['audio']]: r[I['audio']]=f'{AK}/{id_}/audio.wav'
    note(r,'tags: akhand-kirtan (v1.4: Asa di Vaar sung in Akhand Kirtan style, many voices; moved from Sung Bani)')
    moved[id_]=cf
  if id_ in DUP_NEWTON: note(r,'gab-exclude: whole session, scored through its cuts nw11_asa1 and nw11_asa2 (Asa di Vaar) and nw11_kirtan2-4 (kirtan) (v1.4: each sung moment scored once)')
  if r!=old: changed.add('manifest.csv')
# move truth/meta files of moved rows; update meta.json of changed rows
for r in rows[1:]:
  if not r or not r[0]: continue
  id_=r[0]; cf=r[I['content_folder']]; src=moved.get(id_,cf)
  sd=f'{D}/{src}/{id_}'; dd=f'{D}/{cf}/{id_}'
  if id_ in moved:
    os.makedirs(dd,exist_ok=True)
    for f in os.listdir(sd): os.replace(f'{sd}/{f}',f'{dd}/{f}'); changed.add(f'{cf}/{id_}/{f}')
    os.rmdir(sd)
  mp=f'{dd}/meta.json'
  if (id_ in moved or id_ in REKEY or id_ in DROP or id_ in DUP_NEWTON or id_=='rt11_fareed1') and os.path.exists(mp):
    m=json.load(open(mp))
    for k in ['content_folder','bani','lines_n','lines_source','shabads_n','notes']:
      v=r[I[k]]; m[k]=int(v) if k in('lines_n','shabads_n') and v.isdigit() else v
    open(mp,'w').write(json.dumps(m,indent=1,ensure_ascii=False)+'\n'); changed.add(f'{cf}/{id_}/meta.json')
out='\n'.join(ser(r) if r else '' for r in rows)+('\n' if raw.endswith('\n') else '')
open(f'{D}/manifest.csv','w',newline='').write(out)
json.dump({'changed':sorted(changed),'moved':moved},open(f'{D}.changes.json','w'),indent=1)
print(len(changed),'files changed; moved',list(moved))
