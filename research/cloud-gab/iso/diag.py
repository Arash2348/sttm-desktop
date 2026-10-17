# What makes the model hear a sung pangti badly? Per aligned pangti (line-build, Karanbir's model, all GAB clips with
# audio here): the model's own "check" (heard letters vs the pangti, 0..1) against simple, measurable audio conditions.
import json, os, glob, wave, numpy as np, csv, sys
ALIGN='/home/user/gab/lines/align/karanbir'; CLIPS='/home/user/gab/clips'
man={r['id']: r for r in csv.DictReader(open('/home/user/gab/bench/manifest.csv'))}
wavs={os.path.basename(f).split('_')[0]: f for f in glob.glob(CLIPS+'/*.wav')}
SR=16000; rows=[]
def feats(x):
    if len(x) < SR: return None
    rms=np.sqrt(np.mean(x**2))+1e-9
    f=np.abs(np.fft.rfft(x[:len(x)//1024*1024].reshape(-1,1024)*np.hanning(1024),axis=1))**2
    fr=np.fft.rfftfreq(1024,1/SR); P=f.mean(0)+1e-12; tot=P.sum()
    band=lambda a,b: P[(fr>=a)&(fr<b)].sum()/tot
    flat=np.exp(np.mean(np.log(f+1e-12),axis=1))/(np.mean(f,axis=1)+1e-12)
    e=np.log(f.sum(1)+1e-9); flux=np.mean(np.abs(np.diff(e)))
    return dict(loud=20*np.log10(rms), clip=float(np.mean(np.abs(x)>0.98)), low=band(0,250), voice=band(250,3500), high=band(3500,8000), flat=float(np.median(flat)), flux=float(flux))
for f in glob.glob(ALIGN+'/*.json'):
    cid=os.path.basename(f)[:-5]
    if cid not in wavs or cid not in man: continue
    w=wave.open(wavs[cid]); 
    if w.getframerate()!=SR or w.getnchannels()!=1: continue
    x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
    tier=man[cid]['content_folder']; ac=man[cid].get('acoustics','')
    for s in json.load(open(f))['segs']:
        a,b=int(s['start']*SR),int(s['end']*SR); F=feats(x[a:b])
        if F: F.update(check=s['check'], clip=cid, tier=tier, ac=ac, dur=s['end']-s['start'], letters=len(s['text'].replace(' ',''))); F['rate']=F['letters']/max(F['dur'],1); rows.append(F)
print(len(rows),'pangti segments from',len({r['clip'] for r in rows}),'recordings')
import collections
keys=['loud','low','voice','high','flat','flux','rate','dur']
def summary(sel,name):
    good=[r for r in sel if r['check']>=0.5]; bad=[r for r in sel if r['check']<0.35]
    if len(good)<20 or len(bad)<20: return
    print(f'\n{name}: {len(good)} heard clearly vs {len(bad)} heard poorly')
    for k in keys:
        g=np.array([r[k] for r in good]); b=np.array([r[k] for r in bad])
        pooled=np.sqrt((g.var()+b.var())/2)+1e-12; d=(b.mean()-g.mean())/pooled
        c=np.corrcoef([r[k] for r in sel],[r['check'] for r in sel])[0,1]
        print(f'  {k:6s} clear {g.mean():8.3f}  poor {b.mean():8.3f}  effect {d:+.2f}  corr with hearing {c:+.2f}')
summary(rows,'ALL GAB')
for t in sorted({r['tier'] for r in rows}): summary([r for r in rows if r['tier']==t], t)
