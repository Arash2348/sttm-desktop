// segs.js mask.json out.json — caption runs: frames where the Gurmukhi row is lit, split at fade valleys
const fs=require('fs'); const d=JSON.parse(fs.readFileSync(process.argv[2])); const {fps,cnt,diff}=d; const n=cnt.length;
const med=(a)=>{const s=a.slice().sort((x,y)=>x-y);return s[Math.floor(s.length/2)]||0;};
const lit=cnt.map((c,k)=>{const lo=Math.max(0,k-20),hi=Math.min(n,k+21);const m=med(cnt.slice(lo,hi));return c>=Math.max(120,0.45*m);});
// a hard cut (no fade) also splits: diff > 0.6*cnt
const runs=[];let s=null;
for(let k=0;k<=n;k++){const on=k<n&&lit[k];const cut=on&&s!==null&&diff[k]>0.6*Math.max(cnt[k],cnt[k-1]);
 if(s!==null&&(!on||cut)){runs.push([s,k]);s=null;} if(on&&s===null)s=k;}
const out=runs.filter(([a,b])=>b-a>=3).map(([a,b],i)=>({i,t0:a/fps,t1:b/fps}));
fs.writeFileSync(process.argv[3],JSON.stringify(out));console.log('runs',out.length,'median len',med(out.map(r=>r.t1-r.t0)));
