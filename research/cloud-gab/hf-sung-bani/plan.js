// plan.js — clip cut points: each Bani chapter's Gurbani span cut into 5-10 min clips at caption gaps, snapped to the
// quietest 50 ms of the audio within +-5 s of the gap (so no clip edge falls inside a sung word as far as energy shows)
const fs=require('fs');const V=process.env.HOME+'/personal/sb-video/';
const b=fs.readFileSync(V+'full16k.wav');let off=12,data=null;while(off<b.length){const id=b.toString('ascii',off,off+4),sz=b.readUInt32LE(off+4);if(id==='data'){data=b.subarray(off+8,off+8+sz);break;}off+=8+sz;}
const N=data.length/2,H=800;const rms=[];for(let i=0;i+H<=N;i+=H){let s=0;for(let j=0;j<H;j++){const x=data.readInt16LE((i+j)*2);s+=x*x;}rms.push(Math.sqrt(s/H));}
const quiet=(a,z)=>{let best=null;for(let k=Math.max(0,Math.floor(a*20));k<=Math.min(rms.length-1,Math.floor(z*20));k++){const w=(rms[k-1]||rms[k])+rms[k]+(rms[k+1]||rms[k]);if(best===null||w<best[0])best=[w,k];}return {t:+(best[1]/20+0.025).toFixed(2),db:+(20*Math.log10(rms[best[1]]/32768+1e-9)).toFixed(1)};};
const runs=JSON.parse(fs.readFileSync(V+'runs.json'));const tl=JSON.parse(fs.readFileSync(V+'timeline.json')).filter(r=>r.verseId);
const CH={japji:[31,1831],jaap:[1831,3707],'tav-prasad-savaiye':[3707,4201],rehras:[4201,6266],aarti:[6266,8025],'salok-m9':[8025,9898],sohila:[10310,10798]};
const plan=[];
for(const [name,[a,z]] of Object.entries(CH)){
  const mine=tl.filter(r=>r.chapter===name);const s0=mine[0].start,s1=mine[mine.length-1].end;
  const st=quiet(Math.max(a,s0-6),s0-0.5), en=quiet(s1+0.5,Math.min(z+5,s1+6));
  const L=en.t-st.t;const n=Math.max(1,Math.ceil(L/600));const cuts=[st];
  for(let k=1;k<n;k++){const target=st.t+L*k/n; // nearest caption gap
    let g=null;for(let i=1;i<runs.length;i++){const c=(runs[i-1].t1+runs[i].t0)/2;if(c<a||c>z)continue;if(!g||Math.abs(c-target)<Math.abs(g-target))g=c;}
    cuts.push(quiet(g-5,g+5));}
  cuts.push(en);
  for(let k=0;k<n;k++)plan.push({chapter:name,start:cuts[k].t,end:cuts[k+1].t,dur:+(cuts[k+1].t-cuts[k].t).toFixed(1),edge_db:[cuts[k].db,cuts[k+1].db]});
}
fs.writeFileSync(V+'plan.json',JSON.stringify(plan,null,1));for(const p of plan)console.log(p.chapter,p.start,p.end,p.dur,p.edge_db.join(' / '));
console.log('total h',(plan.reduce((a,p)=>a+p.dur,0)/3600).toFixed(2));
