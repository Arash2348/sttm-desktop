// diffruns.js <video> <crop w:h:x:y> <out.json> — slides on a plain background: frame-difference runs (4 fps)
const {spawn}=require('child_process');const fs=require('fs');const [video,crop,out]=process.argv.slice(2);
const W=160,H=60,FPS=4;const p=spawn('/Users/asingh02/.local/bin/ffmpeg',['-nostdin','-loglevel','error','-i',video,'-vf',`fps=${FPS},crop=${crop},scale=${W}:${H},format=gray`,'-f','rawvideo','-']);
let buf=Buffer.alloc(0);const fr=[];p.stdout.on('data',d=>{buf=Buffer.concat([buf,d]);while(buf.length>=W*H){fr.push(Buffer.from(buf.subarray(0,W*H)));buf=buf.subarray(W*H);}});
p.on('close',()=>{const d=[0];for(let k=1;k<fr.length;k++){let s=0;for(let i=0;i<W*H;i++)s+=Math.abs(fr[k][i]-fr[k-1][i]);d.push(s/(W*H));}
  const runs=[];let s=0;for(let k=1;k<=fr.length;k++){if(k===fr.length||d[k]>(+process.env.THR||4)){if(k-s>=3)runs.push({i:runs.length,t0:s/FPS,t1:k/FPS});s=k;}}
  fs.writeFileSync(out,JSON.stringify(runs));const st=d.slice().sort((a,b)=>a-b);console.log('frames',fr.length,'runs',runs.length,'diff p50/p95/p99',st[Math.floor(st.length*.5)].toFixed(2),st[Math.floor(st.length*.95)].toFixed(2),st[Math.floor(st.length*.99)].toFixed(2));});
