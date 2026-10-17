// build2.js <config.json> — GAB clip folders from a pangti timeline (timeline.json in the video dir: [{verseId,shabadId,
// start,end,how,score,header}]), cut list and per-video meta; also a contact sheet per clip (crop from config)
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');const FF='/Users/asingh02/.local/bin/ffmpeg';const FONT='/System/Library/Fonts/Supplemental/Arial.ttf';
const C=JSON.parse(fs.readFileSync(process.argv[2]));const V=C.dir;const tl=JSON.parse(fs.readFileSync(path.join(V,'timeline.json')));
const b=fs.readFileSync(path.join(V,'full16k.wav'));let off=12,data=null;while(off<b.length){const id=b.toString('ascii',off,off+4),sz=b.readUInt32LE(off+4);if(id==='data'){data=b.subarray(off+8,off+8+sz);break;}off+=8+sz;}
const H=800;const rms=[];for(let i=0;(i+H)*2<=data.length;i+=H){let s=0;for(let j=0;j<H;j++){const x=data.readInt16LE((i+j)*2);s+=x*x;}rms.push(Math.sqrt(s/H));}
const quiet=(a,z)=>{let best=null;for(let k=Math.max(1,Math.floor(a*20));k<=Math.min(rms.length-2,Math.floor(z*20));k++){const w=rms[k-1]+rms[k]+rms[k+1];if(best===null||w<best[0])best=[w,k];}return {t:+(best[1]/20+0.025).toFixed(2),db:+(20*Math.log10(rms[best[1]]/32768+1e-9)).toFixed(1)};};
const r2=(x)=>+x.toFixed(2);const out=[];
let seed=11;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
for(const [a0,z0] of C.cuts){const st=quiet(a0[0],a0[1]),en=quiet(z0[0],z0[1]);const id=`${C.prefix}_${C.video}_${Math.round(st.t)}-${Math.round(en.t)}`;const dir=path.join(C.out,C.folder,id);fs.mkdirSync(dir,{recursive:true});
  const dur=r2(en.t-st.t);execFileSync('nice',['-n','19',FF,'-nostdin','-loglevel','error','-ss',String(st.t),'-t',String(dur),'-i',path.join(V,'full16k.wav'),'-ac','1','-ar','16000','-c:a','pcm_s16le','-y',dir+'/audio.wav']);
  const rows=tl.filter(r=>r.start>=st.t-0.01&&r.start<en.t).map(r=>({...r,s:r2(Math.max(0,r.start-st.t)),e:r2(Math.min(dur,r.end-st.t))}));
  const lab=rows.filter(r=>r.verseId&&!r.header&&r.e>r.s&&!((r.e-r.s)<1&&(r.s<0.01||r.e>=dur-0.01)));
  fs.writeFileSync(dir+'/lines.csv',['verseId,start_s,end_s,confidence,source',...lab.map(r=>`${r.verseId},${r.s},${r.e},${(r.score/100).toFixed(2)},${C.source}`)].join('\n')+'\n');
  const pieces=[];for(const r of rows.filter(r=>r.piece==='shabad')){const l=pieces[pieces.length-1];if(l&&l.id===r.shabadId&&r.s-l.e<20)l.e=r.e;else pieces.push({id:r.shabadId,s:r.s,e:r.e});}
  const sh=[];let t=0;for(const pc of pieces){if(pc.s-t>2)sh.push([C.unit,t,pc.s]);sh.push([pc.id,pc.s,pc.e]);t=pc.e;}if(pieces.length&&dur-t<15&&sh.length){sh[sh.length-1][2]=dur;t=dur;}if(dur-t>2)sh.push([C.unit,t,dur]);
  fs.writeFileSync(dir+'/shabads.csv',['shabadId,start_s,end_s,source',...sh.map(([a,b,c])=>`${a},${r2(b)},${r2(c)},${C.source}`)].join('\n')+'\n');
  const rec={id,folder:C.folder,dir,start:st.t,end:en.t,dur,edge_db:[st.db,en.db],lines:lab.length,shabads:sh.length,how:lab.reduce((a,r)=>(a[r.how]=(a[r.how]||0)+1,a),{})};
  if(C.crop){ // contact sheet: less-sure rows + random rows, 3 frames each
    const must=lab.filter(r=>r.how!=='en'&&r.how!=='ocr'||r.score<85);const rest=lab.filter(r=>!must.includes(r)).sort(()=>rnd()-0.5);
    const pick=[...must,...rest.slice(0,Math.max(10-must.length,4))].sort((a,b)=>a.start-b.start).slice(0,30);const tmp=path.join(V,'tmp/');fs.rmSync(tmp,{recursive:true,force:true});fs.mkdirSync(tmp);const items=[];
    pick.forEach((r,k)=>{[r.start-0.75,r.start+0.5,Math.max(r.start+0.6,r.end-0.5)].forEach((tt,j)=>execFileSync('nice',['-n','19',FF,'-nostdin','-loglevel','error','-ss',String(tt.toFixed(2)),'-i',path.join(V,'video360.webm'),'-frames:v','1','-vf',`crop=${C.crop},scale=560:-2,drawtext=fontfile=${FONT}:text='${k+1}${'abc'[j]}  ${(tt-st.t).toFixed(1)}s':x=4:y=2:fontsize=13:fontcolor=red:box=1:boxcolor=white`,'-y',`${tmp}${String(k).padStart(2,'0')}${j}.png`]));
      items.push({n:k+1,clip_start_s:r.s,clip_end_s:r.e,verseId:r.verseId,shabadId:r.shabadId,gurmukhi:r.g||null,translit:r.tr||null,english_on_screen_ocr:r.text||null,how:r.how,score:r.score});});
    const n=pick.length;const inputs=[];const lay=[];const hh=+C.crop.split(':')[1]*560/+C.crop.split(':')[0];for(let k=0;k<n;k++)for(let j=0;j<3;j++){inputs.push('-i',`${tmp}${String(k).padStart(2,'0')}${j}.png`);lay.push(`${j*560}_${Math.round(k*hh)}`);}
    execFileSync(FF,['-nostdin','-loglevel','error',...inputs,'-filter_complex',`xstack=inputs=${n*3}:layout=${lay.join('|')}:fill=black`,'-y',dir+'/contact_sheet.png']);
    fs.mkdirSync(path.join(V,'sheets'),{recursive:true});fs.copyFileSync(dir+'/contact_sheet.png',path.join(V,'sheets',id+'.png'));fs.writeFileSync(path.join(V,'sheets',id+'.json'),JSON.stringify({clip:id,items},null,1));rec.sheet_rows=n;}
  out.push(rec);console.log(id,dur,'lines',lab.length,JSON.stringify(rec.how),'edges',rec.edge_db.join('/'));}
fs.writeFileSync(path.join(V,'clips.json'),JSON.stringify(out,null,1));
