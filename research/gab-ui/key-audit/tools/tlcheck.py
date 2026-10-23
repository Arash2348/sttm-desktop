# Does the published timeline JSON's "sung" (answer key) agree, second by second, with the HF keys?
import json,glob,os,sys,numpy as np
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from audit import verse, sh_verses, keys_of, norm
TL=os.path.expanduser('~/personal/sttm-ws3/research/gab-ui/site/timeline')
clips=json.load(open('clips.json'))
res={}
for f in glob.glob(TL+'/v905*.json'):
    d=json.load(open(f)); texts=d['texts']
    for c in d['clips']:
        cid=c['id']; k=clips.get(cid)
        if not k or not k.get('keys'): continue
        segs,lines=keys_of(k['keys'])
        agree=dis=0; best={}
        tl={}
        for a,b,st,tr,sh in c["runs"]:
            for t in range(int(a),int(b)):
                if tr is not None and tr>=0: tl[t]=texts[tr]
        def keytext(t):
            ls=[v for v,a,b in lines if a<=t+0.5<b]
            return [norm(verse[v]['text']) for v in ls if v in verse]
        for s in range(-10,11):
            ag=n=0
            for t,txt in tl.items():
                if txt.startswith(('Shabad:','Bani:')) or ' / ' in txt or 'slide' in txt: continue
                kt=keytext(t+s)
                if not kt: continue
                n+=1; ag+= norm(txt) in kt
            best[s]=(ag,n)
        if any(n for a,n in best.values()):
            s0=best[0]; sb=max(best,key=lambda s:best[s][0])
            res[cid]=(c['basis'],s0[0],s0[1],sb,best[sb][0])
bad={k:v for k,v in res.items() if v[2] and v[1]/v[2]<0.9}
print(len(res),'line-keyed timelines checked;', 'agree<90%:',len(bad))
for k,v in sorted(bad.items()): print(k,v)
