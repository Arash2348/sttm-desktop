// talk detector: heard text (utterance finals from replay traces) vs the clip's keyed Gurbani text
const fs=require('fs'),path=require('path'),os=require('os');
const ROOT='/Users/asingh02/personal/sttm-replay';
const Realm=require(ROOT+'/node_modules/realm'),anvaad=require(ROOT+'/node_modules/anvaad-js');
const APP=path.join(os.homedir(),'Library/Application Support/SikhiToTheMax');
const sch=JSON.parse(fs.readFileSync(path.join(APP,'realm-schema-evergreen.json')));
const realm=new Realm({path:path.join(APP,'sttmdesktop-evergreen-v2.realm'),schema:sch.schemas,schemaVersion:sch.schemaVersion,readOnly:true});
const norm=s=>(s||'').replace(/[^ਁ-੥ੰ-ੵ ]/g,'').trim();
function unitWords(id){ id=String(id); if(!id||id==='undefined'||(!id.startsWith('bani:')&&isNaN(Number(id))))return []; let vs;
 if(id.startsWith('bani:')) vs=[...realm.objects('Banis_Shabad').filtered('Bani.ID == $0',Number(id.slice(5)))].map(r=>r.Custom||r.Verse).filter(Boolean);
 else vs=[...realm.objects('Verse').filtered('ANY Shabads.ShabadID == $0',Number(id))];
 return vs.map(v=>norm(anvaad.unicode(v.Gurmukhi||''))); }
const KEYS=process.argv[2], REPL='/Users/asingh02/personal/live-darbar-venues/cache/replays';
const PREF=(process.env.PREF||'7d5adc505dad5ede,6fcfcb6a953818b5').split(',');
const csv=t=>{const [h,...r]=t.trim().split('\n');const k=h.split(',');return r.filter(Boolean).map(l=>Object.fromEntries(l.split(',').map((v,i)=>[k[i],v])));};
const man=csv(fs.readFileSync(path.join(KEYS,'manifest.csv'),'utf8').replace(/"[^"]*"/g,m=>m.replace(/,/g,';')));
function lev(a,b){if(Math.abs(a.length-b.length)>2)return 9;const d=[...Array(b.length+1).keys()];for(let i=1;i<=a.length;i++){let p=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const t=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]===b[j-1]?0:1));p=t;}}return d[b.length];}
function findTrace(row){const suites=(row.suite_jobs||'').split(';').filter(Boolean).map(s=>s.split(':'));
 for(const p of PREF) for(const [s,id] of suites){const f=path.join(REPL,p,s,'trace',(row.cache_id||id)+'.events.jsonl'); if(fs.existsSync(f))return f; const g=fs.readdirSync(path.join(REPL,p,s,'trace')).find(x=>x.startsWith(id+'_')||x.startsWith(id+'.'));}
 // any dir
 for(const d of fs.readdirSync(REPL)) for(const [s] of suites){const f=path.join(REPL,d,s,'trace',row.cache_id+'.events.jsonl'); if(fs.existsSync(f))return f;}
 return null;}
const out={};
for(const row of man.filter(r=>r.content_folder.startsWith('3-')&&(!process.env.IDS||process.env.IDS.split(',').includes(r.id)))){
 const dir=path.join(KEYS,row.content_folder,row.id); if(!fs.existsSync(dir+'/shabads.csv'))continue;
 const sh=csv(fs.readFileSync(dir+'/shabads.csv','utf8'));
 const vocab=new Set(); for(const s of sh) for(const l of unitWords(s.shabadId)) l.split(/\s+/).forEach(w=>w&&vocab.add(w));
 const V=[...vocab];
 const tf=findTrace(row); if(!tf){out[row.id]={trace:null};console.log(row.id,'NO TRACE');continue;}
 const ev=fs.readFileSync(tf,'utf8').trim().split('\n').map(JSON.parse).filter(e=>e.type==='transcript');
 const utt=[]; let last=null; for(let i=0;i<ev.length;i++){const e=ev[i],n=ev[i+1]; const final=!n||n.audioSec<e.audioSec-0.01; const fresh=!last||e.t-last.t>=e.audioSec*0.95;
   if(final||fresh&&e.audioSec>=3.5){ if(last&&e.t-last.t<e.audioSec*0.5&&!fresh)continue; const a=Math.max(last?last.t:0,e.t-e.audioSec); utt.push({a:+a.toFixed(1),b:e.t,text:e.text,conf:e.confidence}); last=e;} }
 for(const u of utt){const ws=norm(u.text).split(/\s+/).filter(w=>w.length>=2); u.n=ws.length; u.hit=ws.filter(w=>vocab.has(w)||(w.length>=3&&V.some(x=>lev(w,x)<=1))).length; u.m=u.n?u.hit/u.n:null;}
 out[row.id]={trace:tf.replace(REPL+'/',''),dur:+row.duration_s,split:row.split,shabads:sh,utt};
 // 5 s buckets: words heard (utterance finals, by end time) and how many match the keyed text
 const keyed=t=>sh.some(s=>+s.start_s<=t&&t<+s.end_s);
 const B=[]; for(const u of utt){const k=Math.floor(u.b/5); B[k]=B[k]||{n:0,h:0,txt:[]}; B[k].n+=u.n; B[k].h+=u.hit; B[k].txt.push(u.text);}
 const runs=[]; B.forEach((b,k)=>{ if(!b||b.n<(+process.env.MINW||6)||b.h/b.n>=(+process.env.MAXM||0.5))return; const a=k*5,e=a+5; const r=runs[runs.length-1]; if(r&&a-r.b<=5){r.b=e;r.txt.push(...b.txt);r.n+=b.n;r.h+=b.h;} else runs.push({a,b:e,txt:[...b.txt],n:b.n,h:b.h}); });
 out[row.id].runs=runs.filter(r=>r.b-r.a>=(+process.env.MINLEN||10)).map(r=>({a:r.a,b:r.b,keyed:keyed((r.a+r.b)/2),words:r.n,match:+(r.h/r.n).toFixed(2),text:r.txt.join(' / ').slice(0,400)}));
 const words=utt.reduce((a,u)=>a+u.n,0), hits=utt.reduce((a,u)=>a+u.hit,0);
 out[row.id].match=+(hits/Math.max(1,words)).toFixed(2); out[row.id].conf=+(utt.reduce((a,u)=>a+u.conf,0)/Math.max(1,utt.length)).toFixed(3);
 console.log(row.id.padEnd(34),row.split.padEnd(5),'match',out[row.id].match,'conf',out[row.id].conf,'runs',out[row.id].runs.map(r=>`${r.a}-${r.b}${r.keyed?'K':''}`).join(' '));
}
fs.writeFileSync(process.env.OUT||'detect.json',JSON.stringify(out,null,1)); realm.close();
