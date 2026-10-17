// enseg.js <ocr.jsonl> <fps> <bani en json> <out.json> — slides from OCR of the English row every 1/fps s (text-change
// runs), matched to the DB English translations (bdb/ssk/ms) of the Bani's pangtis; outside the Bani -> whole DB
const fs=require('fs');const [OCR,FPS,BANI,OUT]=process.argv.slice(2);const fps=+FPS;
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z]/g,'');
function lev(a,b){if(!a.length||!b.length)return 0;const m=a.length,n=b.length;let p=new Array(n+1).fill(0).map((_,j)=>j);for(let i=1;i<=m;i++){const c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c;}return 100*(1-p[n]/Math.max(m,n));}
const fr=fs.readFileSync(OCR,'utf8').trim().split('\n').map(l=>JSON.parse(l)).sort((a,b)=>a.f.localeCompare(b.f)).map((j,k)=>{const L=j.lines.filter(x=>x[0]>=+(process.env.EN_YMIN||0)).filter(x=>{const t=x[2];const asc=(t.match(/[A-Za-z ,.;:'!?()-]/g)||[]).length/t.length;return asc>0.9&&/[a-z]{3}/.test(t)&&!/JAP ?MANN|youtube|allaboutsikhi/i.test(t);}).sort((a,b)=>a[0]-b[0]);return {t:k/fps,text:L.map(x=>x[2]).join(' ')};});
const runs=[];for(const f of fr){const n=norm(f.text);const last=runs[runs.length-1];if(!n||n.length<8){continue;}
  if(last&&f.t-last.t1<=1.01&&lev(n,norm(last.text))>=75){last.t1=f.t+1/fps;if(n.length>norm(last.text).length)last.text=f.text;}else runs.push({t0:f.t,t1:f.t+1/fps,text:f.text});}
const B=JSON.parse(fs.readFileSync(BANI));const ALL=JSON.parse(fs.readFileSync(__dirname+'/enall.json'));
const part=(o,n)=>{if(n.length<=o.length*1.15)return lev(o,n);let b=0;const L=o.length;for(let i=0;i+L<=n.length+2;i+=Math.max(1,Math.floor(L/8))){b=Math.max(b,lev(o,n.slice(i,i+L)));}return b-3;};
const score=(o,v)=>Math.max(...v.en.map(e=>part(o,norm(e))));
let lastK=0;
for(const r of runs){const o=norm(r.text);r.cands=[];
  B.forEach((v,k)=>{if(!v.en.length)return;const s=score(o,v);if(s>=50)r.cands.push([s,k]);});
  r.cands.sort((a,b)=>b[0]-a[0]);const c=r.cands[0];
  if(c&&c[0]>=70){const same=r.cands.filter(x=>x[0]>=c[0]-0.01);const after=same.filter(x=>x[1]>=lastK).sort((a,b)=>a[1]-b[1]);const p=after[0]||c;r.how='en';r.score=+p[0].toFixed(1);r.v=B[p[1]];lastK=p[1];}
  else{let best=null;if(r.t1-r.t0>=2&&o.length>=20)for(const v of ALL){for(const e of v.en){const n=norm(e);if(n.length<0.7*o.length||n.length>3*o.length)continue;const s=n.length>1.3*o.length?part(o,n):lev(o,n);if(!best||s>best[0])best=[s,v];}}
    if(best&&best[0]>=75){r.how='db-shabad';r.score=+best[0].toFixed(1);r.v={verseId:best[1].verseId,shabadId:best[1].shabadId,header:0};}else r.how='none';}
}
fs.writeFileSync(OUT,JSON.stringify(runs.map(r=>({t0:r.t0,t1:r.t1,text:r.text,how:r.how,score:r.score,verseId:r.v&&r.v.verseId,shabadId:r.v&&r.v.shabadId,header:r.v&&r.v.header,g:r.v&&r.v.g,tr:r.v&&r.v.tr}))));
const c={};for(const r of runs)c[r.how]=(c[r.how]||0)+1;console.log('runs',runs.length,JSON.stringify(c));
for(const r of runs)console.log(r.t0.toFixed(1),r.t1.toFixed(1),r.how,r.score,'|',r.text.slice(0,60),'|',r.v?(r.v.tr||r.v.verseId+':'+r.v.shabadId):'');
