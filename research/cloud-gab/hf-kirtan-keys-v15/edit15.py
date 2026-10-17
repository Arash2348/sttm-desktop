# GAB v1.5: Renton Finds lead-in keys. The first ~30 s of these clips was keyed as the previous Shabad (the sheet's
# earlier row), but holds talk, jaikaras or instruments (now a gap), or the next Shabad already being sung (its key now
# starts where it is heard). Clip seconds, from the heard text of the replays (detect2.js), whole-utterance boundaries.
import csv,io,json,os,sys
D=sys.argv[1]
FIX={ # id: (new start of the main Shabad, what the lead-in holds)
 'rn09':(8,'0-8 s instruments; Shabad 3025 sung from 8 s'),
 'rn14':(20,'0-20 s instruments and jaikara (Waheguru ji ka Khalsa); Shabad 1839 from 20 s'),
 'rn27':(28,'0-28 s instruments and jaikara (Waheguru ji ka Khalsa); Shabad 3735 from 28 s'),
 'rn52':(20,'0-20 s talk (Guru Ram Das Sahib ji Maharaj); Shabad 266 from 20 s'),
 'rn63':(0,'Shabad 164 already sung from 0 s (not the previous Shabad 1591)'),
 'rn66':(10,'0-10 s instruments; Shabad 2171 sung from 10 s (not the previous Shabad 2782)'),
 'rn67':(0,'Shabad 2819 already sung from 0 s (not the previous Shabad 2171)'),
 'rn77':(28,'0-28 s talk introducing the Shabad; Shabad 1791 from 28 s'),
 'rn80':(20,'0-20 s talk introducing the Shabad; Shabad 499 from 20 s'),
 'rn81':(30,'0-30 s jaikaras (Dhan Guru Arjan Dev ji), not a pangti; Shabad 4725 from 30 s'),
 'rn16':(20,'0-20 s instruments; Shabad 5246 (Birha birha akhiai) sung from 20 s (not the previous Shabad 2885)'),
 'rn38':(5,'Shabad 3294 sung from 5 s (not the previous Shabad 1481; matches the ear check at 20 s)'),
 'rn42':(10,'0-10 s instruments; Shabad 5478 sung from 10 s'),
 'rn43':(18,'0-18 s instruments; Shabad 2311 sung from 18 s'),
 'rn44':(24,'0-24 s instruments; Shabad 3970 sung from 24 s'),
 'rn45':(25,'0-25 s jaikaras and talk introducing the Shabad; Shabad 1452 from 25 s'),
}
raw=open(f'{D}/manifest.csv',newline='').read(); rows=list(csv.reader(io.StringIO(raw))); I={k:i for i,k in enumerate(rows[0])}
def ser(r): b=io.StringIO(); csv.writer(b,lineterminator='\n').writerow(r); return b.getvalue()[:-1]
assert all(ser(r)==l for r,l in zip(rows,raw.split('\n')))
changed=[]
for r in rows[1:]:
  if not r or r[0] not in FIX: continue
  id_=r[0]; t0,why=FIX[id_]; d=f"{D}/{r[I['content_folder']]}/{id_}"
  sh=list(csv.reader(open(f'{d}/shabads.csv'))); h,body=sh[0],sh[1:]
  first,main=body[0],body[1]
  assert float(first[1])==0 and abs(float(first[2])-30)<1 and float(main[1])==30, (id_,first,main)
  main=[main[0],str(t0),main[2],main[3]]
  new=[main]+body[2:]
  open(f'{d}/shabads.csv','w').write(','.join(h)+'\n'+'\n'.join(','.join(x) for x in new)+'\n'); changed.append(f"{r[I['content_folder']]}/{id_}/shabads.csv")
  r[I['shabads_n']]=str(len(new)); n=r[I['notes']]; r[I['notes']]=(n+'; ' if n else '')+f'v1.5 lead-in fix: {why}'
  mp=f'{d}/meta.json'
  if os.path.exists(mp):
    m=json.load(open(mp)); m['shabads_n']=len(new); m['notes']=r[I['notes']]; open(mp,'w').write(json.dumps(m,indent=1,ensure_ascii=False)+'\n'); changed.append(f"{r[I['content_folder']]}/{id_}/meta.json")
open(f'{D}/manifest.csv','w',newline='').write('\n'.join(ser(r) if r else '' for r in rows)+('\n' if raw.endswith('\n') else ''))
changed.append('manifest.csv'); json.dump({'changed':changed,'moved':{}},open(f'{D}.changes.json','w'),indent=1); print(len(changed),'files')
