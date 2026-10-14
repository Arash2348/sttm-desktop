// seq-lag.js <truth.json (research/level2-dataset/seq-truth/<clip>.json)> <paath-seq-bench clip json> [lead]  -- Sehaj Paath line/Shabad lag against forced-aligned truth.
const fs=require('fs');
const [tf,cf,leadArg]=process.argv.slice(2);
const T=JSON.parse(fs.readFileSync(tf)); const B=JSON.parse(fs.readFileSync(cf));
const lead=leadArg!=null?+leadArg:(B.row.start_s-(+B.row.clip.match(/_(\d+)-\d+\.wav$/)[1]));
const corpus=JSON.parse(fs.readFileSync('/Users/asingh02/personal/live-darbar-venues/cache/corpus/97f67774fcf00cdd.json'));
const SH=new Map();for(const r of corpus)SH.set(r.verseId,r.shabadId);
const lines=T.lines.filter(l=>l.check>=0.6).map(l=>({...l,shabadId:SH.get(l.verseId)}));
const ev=B.events.map(e=>({...e,t:e.t+lead})).sort((a,b)=>a.t-b.t); // clip time
// Shabad truth: first confident line start
const shab=[];for(const l of lines){const s=shab.find(x=>x.id===l.shabadId);if(s){s.end=Math.max(s.end,l.end);}else shab.push({id:l.shabadId,start:l.start,end:l.end});}
const shown=ev.filter(e=>e.type==='shabad');
const lags=[];let found=0;
const perShabad=shab.map(s=>{const h=shown.find(e=>e.shabadId===s.id&&e.t>=s.start-5&&e.t<=s.end+30);if(h){found++;lags.push(h.t-s.start);}return `${s.id}:${h?(h.t-s.start).toFixed(1):'-'}`;});
// line lag + exact
const vev=ev.filter(e=>e.type==='verse');
let cur=null,i=0,exact=0,near=0,tot=0;const vidx=new Map(lines.map((l,k)=>[l.verseId,k]));
const llags=[];let reached=0,last=-1e9;
lines.forEach((l,k)=>{const h=vev.find(e=>e.verseId===l.verseId&&e.t>=Math.max(l.start-5,last)&&e.t<=l.start+60);if(h){reached++;llags.push(h.t-l.start);last=h.t;}});
for(const l of lines){for(let t=l.start;t<l.end;t+=0.1){while(i<vev.length&&vev[i].t<=t)cur=vev[i++].verseId;tot++;if(cur===l.verseId)exact++;const ci=vidx.get(cur);if(ci!=null&&Math.abs(ci-vidx.get(l.verseId))<=1)near++;}}
const q=(a,p)=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return +s[Math.min(s.length-1,Math.floor(p*s.length))].toFixed(2)};
console.log(JSON.stringify({clip:B.row.name,shabads:shab.length,shabadsFound:found,shabadLagMedian:q(lags,.5),shabadLagP90:q(lags,.9),shabadLagMax:q(lags,1),lines:lines.length,linesReached:reached,lineLagMedian:q(llags,.5),lineLagP90:q(llags,.9),lineExact:+(100*exact/tot).toFixed(1),lineWithin1:+(100*near/tot).toFixed(1),perShabad:perShabad.join(' ')}));
