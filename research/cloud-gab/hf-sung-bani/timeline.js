// timeline.js — matched runs -> pangti timeline (whole video seconds). Rules as GAB's caption keys: a row starts when its
// slide appears and ends at the end of its own slide; a slide with several DB pangtis is split by text length; the same
// pangti on consecutive slides is one row; header pangtis (DB header flag) and Banis_Custom rows are left unlabelled.
const fs=require('fs');const V=process.env.HOME+'/personal/sb-video/';const m=JSON.parse(fs.readFileSync(V+'matched.json'));
const rows=[];
for(const r of m){ if(!r.verses)continue; const vs=r.verses; const len=vs.map(v=>v.tr.replace(/[^a-z]/gi,'').length||1); const tot=len.reduce((a,b)=>a+b,0);
  let t=r.t0; vs.forEach((v,j)=>{const d=(r.t1-r.t0)*len[j]/tot; const row={verseId:v.verseId,customId:v.customId||null,header:v.header||0,shabadId:v.shabadId,tr:v.tr,start:+t.toFixed(2),end:+(t+d).toFixed(2),how:r.how,score:r.score,run:r.i,chapter:r.chapter,bani:r.bani,piece:r.how==='db-shabad'?'shabad':'bani'};t+=d;
    const last=rows[rows.length-1]; if(last&&last.verseId===row.verseId&&last.verseId&&row.start-last.end<2.5){last.end=row.end;last.score=Math.min(last.score,row.score);if(last.how!==row.how)last.how=last.how+'+'+row.how;} else rows.push(row);});}
fs.writeFileSync(V+'timeline.json',JSON.stringify(rows));
const k=rows.filter(r=>r.verseId&&!r.header);console.log('rows',rows.length,'labelled (no header, no custom)',k.length);
