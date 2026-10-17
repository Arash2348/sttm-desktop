// build.js — GAB clip folders for the new Sung Bani recordings of Rt1TyWzPykc (plan.json + timeline.json)
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const V=process.env.HOME+'/personal/sb-video/',OUT=V+'out/';const FF='/Users/asingh02/.local/bin/ffmpeg';
const plan=JSON.parse(fs.readFileSync(V+'plan.json')),tl=JSON.parse(fs.readFileSync(V+'timeline.json')),runs=JSON.parse(fs.readFileSync(V+'runs.json'));
const matched=JSON.parse(fs.readFileSync(V+'matched.json'));
const META={japji:{folder:'japji-sung',pre:'ytjapji',bani:'Japji Sahib',id:2,singer:'Bhai Jagjit Singh Ji (Australia)'},jaap:{folder:'jaap-sung',pre:'ytjaap',bani:'Jaap Sahib',id:4,singer:'Bhai Puran Prem Singh Ji'},
 'tav-prasad-savaiye':{folder:'tav-prasad-savaiye-sung',pre:'yttavprasad',bani:'Tav Prasad Savaiye',id:6,singer:'Bhai Parminder Singh (Australia)'},rehras:{folder:'rehras-sung',pre:'ytrehras',bani:'Rehras Sahib',id:21,singer:'Bhai Gurbir Singh Ji'},
 aarti:{folder:'aarti',pre:'ytaarti',bani:'Aarti',id:22,singer:'Raagi Bhai Bakshish Singh Ji (Patiala)'},'salok-m9':{folder:'saloks-sung',pre:'ytsalokm9',bani:'Salok Mahalla 9',id:30,singer:'Raagi Bhai Amrik Singh Zakhmi Ji'},sohila:{folder:'sohila-sung',pre:'ytsohila',bani:'Kirtan Sohila',id:23,singer:'Bhai Parminder Singh (Australia)'}};
const r2=(x)=>+x.toFixed(2);const clips=[];
for(const p of plan){const m=META[p.chapter];const id=`${m.pre}_Rt1TyWzPykc_${Math.round(p.start)}-${Math.round(p.end)}`;const folder=`3-bani-sung-like-kirtan/${m.folder}`;const dir=path.join(OUT,folder,id);fs.mkdirSync(dir,{recursive:true});
  if(!fs.existsSync(dir+'/audio.wav'))execFileSync('nice',['-n','19',FF,'-nostdin','-loglevel','error','-ss',String(p.start),'-t',String(r2(p.end-p.start)),'-i',V+'full16k.wav','-ac','1','-ar','16000','-c:a','pcm_s16le','-y',dir+'/audio.wav']);
  const dur=r2(p.end-p.start);
  const rows=tl.filter(r=>r.start>=p.start-0.01&&r.start<p.end).map(r=>({...r,s:r2(Math.max(0,r.start-p.start)),e:r2(Math.min(dur,r.end-p.start))}));
  const lab=rows.filter(r=>r.verseId&&!r.header&&!r.customId&&r.e>r.s);
  fs.writeFileSync(dir+'/lines.csv',['verseId,start_s,end_s,confidence,source',...lab.map(r=>`${r.verseId},${r.s},${r.e},${(r.score/100).toFixed(2)},broadcast-caption`)].join('\n')+'\n');
  // Shabad windows: the Bani over the whole clip, cut out where a Shabad outside the DB Bani is sung (its own row)
  const pieces=[];for(const r of rows.filter(r=>r.piece==='shabad')){const l=pieces[pieces.length-1];if(l&&l.id===r.shabadId&&r.s-l.e<20)l.e=r.e;else pieces.push({id:r.shabadId,s:r.s,e:r.e});}
  const sh=[];let t=0;for(const pc of pieces){if(pc.s-t>0.5)sh.push([`bani:${m.id}`,t,pc.s]);sh.push([pc.id,pc.s,pc.e]);t=pc.e;}if(dur-t>0.5)sh.push([`bani:${m.id}`,t,dur]);
  fs.writeFileSync(dir+'/shabads.csv',['shabadId,start_s,end_s,source',...sh.map(([a,b,c])=>`${a},${r2(b)},${r2(c)},broadcast-caption`)].join('\n')+'\n');
  const cr=matched.filter(x=>x.t0>=p.start-1&&x.t0<p.end).map(x=>({i:x.i,t0:r2(x.t0-p.start),t1:r2(x.t1-p.start),ocr:x.ocr,hdr:x.hdr,how:x.how,score:x.score,verseIds:(x.verses||[]).map(v=>v.verseId||`custom:${v.customId}`)}));
  fs.writeFileSync(dir+'/caption_runs.json',JSON.stringify(cr));
  const c={id,folder,dir,chapter:p.chapter,bani:m.bani,bani_id:m.id,start:p.start,end:p.end,dur,lines:lab.length,shabads:sh.length,how:lab.reduce((a,r)=>(a[r.how]=(a[r.how]||0)+1,a),{}),pieces:pieces.map(x=>x.id),edge_db:p.edge_db,singer:m.singer,headers:rows.filter(r=>r.header).length};
  clips.push(c);console.log(id,dur,'lines',lab.length,JSON.stringify(c.how),'pieces',c.pieces.join(' '));}
fs.writeFileSync(V+'clips.json',JSON.stringify(clips,null,1));
