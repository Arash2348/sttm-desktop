// match.js — caption runs + OCR -> verse(s) per run. Out: ~/personal/sb-video/matched.json
const fs=require('fs'); const V=process.env.HOME+'/personal/sb-video/';
const runs=JSON.parse(fs.readFileSync(V+'runs.json')); const ocr=new Map(fs.readFileSync(V+'ocr.jsonl','utf8').trim().split('\n').map(l=>{const j=JSON.parse(l);return [+j.f.slice(0,5),j.lines];}));
const CH=[{bani:2,a:31,b:1831,name:'japji'},{bani:4,a:1831,b:3707,name:'jaap'},{bani:6,a:3707,b:4201,name:'tav-prasad-savaiye'},{bani:21,a:4201,b:6266,name:'rehras'},{bani:22,a:6266,b:8025,name:'aarti'},{bani:30,a:8025,b:9898,name:'salok-m9'},{bani:23,a:10310,b:10800,name:'sohila'}];
const norm=s=>String(s||'').toLowerCase().replace(/\(n\)/g,'n').replace(/\|\|[\d|]*\|\|/g,'').replace(/[^a-z]/g,'');
function lev(a,b){if(!a.length||!b.length)return 0;const m=a.length,n=b.length;let p=new Array(n+1).fill(0).map((_,j)=>j);for(let i=1;i<=m;i++){const c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c;}return 100*(1-p[n]/Math.max(m,n));}
const ALL=JSON.parse(fs.readFileSync(__dirname+'/allverses.json')).map(([id,sh,tr])=>({id,sh,n:norm(tr),tr}));
function globalBest(o){let b=null;for(let k=0;k<ALL.length;k++){for(let w=1;w<=2&&k+w<=ALL.length;w++){const n=w===1?ALL[k].n:ALL[k].n+ALL[k+1].n; if(w===2&&ALL[k+1].sh!==ALL[k].sh)continue; if(Math.abs(n.length-o.length)>0.3*o.length)continue;const s=lev(o,n);if(!b||s>b.s)b={s,k,w};}}return b;}
const out=[];
for(const ch of CH){
  const vs=JSON.parse(fs.readFileSync(`bani${ch.bani}.json`)).filter(v=>v.verseId||v.customId);
  const vn=vs.map(v=>norm(v.tr));
  const rs=runs.filter(r=>r.t0>=ch.a-1&&r.t0<ch.b);
  for(const r of rs){
    const L=(ocr.get(r.i)||[]).slice().sort((x,y)=>x[0]-y[0]);
    const hdr=L.find(l=>l[0]<0.2); const tl=L.find(l=>l[0]>=0.25&&l[0]<0.5);
    r.hdr=hdr?hdr[2]:''; r.ocr=tl?tl[2]:''; const o=norm(r.ocr); r.o=o; r.cands=[];
    if(o.length<6) continue;
    for(let k=0;k<vs.length;k++){let cat='';for(let w=1;w<=6&&k+w<=vs.length;w++){cat+=vn[k+w-1]; if(cat.length>1.4*o.length)break; if(Math.abs(cat.length-o.length)<=0.35*o.length) r.cands.push([lev(o,cat),k,w]);}}
    r.cands.sort((x,y)=>y[0]-x[0]||x[2]-y[2]); r.cands=r.cands.slice(0,10);
  }
  const txt=(c)=>vn.slice(c[1],c[1]+c[2]).join('');
  for(const r of rs){const c=r.cands[0]; r.anchor=false; if(!c)continue; const alt=r.cands.find(x=>txt(x)!==txt(c)); r.margin=alt?c[0]-alt[0]:99; r.anchor=c[0]>=80&&r.margin>=6;}
  // order fill between anchors (a Bani may be sung in another piece order: anchors are not forced into one order)
  let lastK=0; const recent=[];
  rs.forEach((r,i)=>{ let pick=null,how='none';
    if(r.anchor){pick=r.cands[0];how='ocr';
      // the same words close several Pauris / Saloks (Japji 28-31, Salok M9 14/15): among candidates with the same
      // text, take the first at or after the previous pangti's position in the Bani
      const same=r.cands.filter(x=>txt(x)===txt(pick)&&x[0]>=pick[0]-0.01); if(same.length>1){const rec4=recent.slice(-2).find(q=>same.some(x=>x[1]===q[1]&&x[2]===q[2])); const after=same.filter(x=>x[1]>=lastK).sort((a,b)=>a[1]-b[1]); pick=(after[0]&&after[0][1]<=lastK+1)?after[0]:rec4?same.find(x=>x[1]===rec4[1]&&x[2]===rec4[2]):(after[0]||pick);}}
    else if(r.cands.length){ let p=null,n=null; for(let j=i-1;j>=0;j--)if(rs[j].anchor){p=rs[j].cands[0];break;} for(let j=i+1;j<rs.length;j++)if(rs[j].anchor){n=rs[j].cands[0];break;}
      const lo=p?p[1]:0, hi=n?n[1]+n[2]:vs.length;
      if(lo<=hi){const c=r.cands.find(x=>x[1]>=lo&&x[1]+x[2]<=hi&&x[0]>=60); if(c){pick=c;how='order';}} }
    if(!pick&&r.o&&r.o.length>=12){let b=null;for(let k=0;k<vs.length;k++){const n=vn[k];if(n.length<=r.o.length*1.15)continue;for(const part of [n.slice(0,r.o.length),n.slice(n.length-r.o.length)]){const sc=lev(r.o,part);if(!b||sc>b[0])b=[sc,k];}}
      if(b&&b[0]>=85){pick=[b[0],b[1],1];how='part';}}
    if(pick&&(how==='ocr'||how==='order')){lastK=pick[1];recent.push(pick);}
    const rec={i:r.i,t0:r.t0,t1:r.t1,bani:ch.bani,chapter:ch.name,hdr:r.hdr,ocr:r.ocr,how,score:pick?+pick[0].toFixed(1):null,margin:r.margin??null};
    if(pick) rec.verses=vs.slice(pick[1],pick[1]+pick[2]).map(v=>({verseId:v.verseId,customId:v.customId,header:v.header,shabadId:v.shabadId,tr:v.tr}));
    else if(r.o&&r.o.length>=12){const g=globalBest(r.o); if(g&&g.s>=80){rec.how='db-shabad';rec.score=+g.s.toFixed(1);rec.verses=ALL.slice(g.k,g.k+g.w).map(v=>({verseId:v.id,shabadId:v.sh,header:0,tr:v.tr}));}}
    out.push(rec);});
  const c=out.filter(x=>x.chapter===ch.name); console.log(ch.name,'runs',c.length,'ocr',c.filter(x=>x.how==='ocr').length,'order',c.filter(x=>x.how==='order').length,'db-shabad',c.filter(x=>x.how==='db-shabad').length,'part',c.filter(x=>x.how==='part').length,'none',c.filter(x=>x.how==='none').length);
}
fs.writeFileSync(V+'matched.json',JSON.stringify(out));
