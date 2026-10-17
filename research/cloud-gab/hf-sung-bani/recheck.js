// sheets.js — contact sheets for the verifier: per clip, sampled rows (every non-OCR / low-score row + random OCR rows),
// 3 caption-band frames each: 0.75 s before the row starts (previous slide), 0.5 s after it starts, 0.5 s before it ends
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const V=process.env.HOME+'/personal/sb-video/';const FF='/Users/asingh02/.local/bin/ffmpeg';const FONT='/System/Library/Fonts/Supplemental/Arial.ttf';
const clips=JSON.parse(fs.readFileSync(V+'clips.json'));const tl=JSON.parse(fs.readFileSync(V+'timeline.json'));
const bani={};for(const f of fs.readdirSync(__dirname).filter(f=>/^bani\d+\.json$/.test(f)))for(const v of JSON.parse(fs.readFileSync(path.join(__dirname,f))))if(v.verseId)bani[v.verseId]=v.g;
const ALL=new Map(JSON.parse(fs.readFileSync(__dirname+'/allverses.json')).map(([id,sh,tr])=>[id,tr]));
let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
const SD=V+'sheets/recheck/';fs.mkdirSync(SD,{recursive:true});const index=[];
for(const c of clips){const rows=tl.filter(r=>r.start>=c.start-0.01&&r.start<c.end&&r.verseId&&!r.header&&!r.customId);
  const CH=new Set(JSON.parse(fs.readFileSync(V+'changed-runs.json')));const must=rows.filter(r=>CH.has(r.run));if(!must.length)continue;const rest=rows.filter(r=>!must.includes(r)).sort(()=>rnd()-0.5);
  const pick=[...must].sort((a,b)=>a.start-b.start).slice(0,30);
  const items=[];const tmp=SD+'tmp/';fs.rmSync(tmp,{recursive:true,force:true});fs.mkdirSync(tmp);
  pick.forEach((r,k)=>{const ts=[r.start-0.75,r.start+0.5,Math.max(r.start+0.6,r.end-0.5)];
    ts.forEach((t,j)=>execFileSync('nice',['-n','19',FF,'-nostdin','-loglevel','error','-ss',String(t.toFixed(2)),'-i',V+'video360.webm','-frames:v','1','-vf',`crop=640:100:0:248,scale=560:88,drawtext=fontfile=${FONT}:text='${k+1}${'abc'[j]}  ${(t-c.start).toFixed(1)}s':x=4:y=2:fontsize=13:fontcolor=red:box=1:boxcolor=white`,'-y',`${tmp}${String(k).padStart(2,'0')}${j}.png`]));
    items.push({n:k+1,clip_start_s:+(r.start-c.start).toFixed(2),clip_end_s:+(r.end-c.start).toFixed(2),verseId:r.verseId,shabadId:r.shabadId,piece:r.piece,gurmukhi:bani[r.verseId]||null,translit:r.tr,how:r.how,score:r.score,frames:{a:'0.75 s before the row starts: should show the PREVIOUS slide (or a fade), not this pangti',b:'0.5 s after the start: should show THIS pangti',c:'0.5 s before the row ends: should still show THIS pangti'}});});
  const n=pick.length;const inputs=[];for(let k=0;k<n;k++)for(let j=0;j<3;j++)inputs.push('-i',`${tmp}${String(k).padStart(2,'0')}${j}.png`);
  const layout=[];for(let k=0;k<n;k++)for(let j=0;j<3;j++)layout.push(`${j*560}_${k*88}`);
  execFileSync(FF,['-nostdin','-loglevel','error',...inputs,'-filter_complex',`xstack=inputs=${n*3}:layout=${layout.join('|')}`,'-y',`${c.dir}/contact_sheet.png`]);
  fs.renameSync(`${c.dir}/contact_sheet.png`,`${SD}${c.id}.png`);fs.writeFileSync(`${SD}${c.id}.json`,JSON.stringify({clip:c.id,bani:c.bani,items},null,1));
  index.push({clip:c.id,rows:n,must:must.length});console.log(c.id,'rows',n,'unsure-type',must.length);}
fs.writeFileSync(SD+'index.json',JSON.stringify(index,null,1));
