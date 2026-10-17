// per 5 s bucket of a clip's heard text: which keyed unit it matches (prev / main Shabad), or none (talk, jaikaras)
const fs=require('fs'),path=require('path'),os=require('os');const ROOT='/Users/asingh02/personal/sttm-replay';
const Realm=require(ROOT+'/node_modules/realm'),anvaad=require(ROOT+'/node_modules/anvaad-js');
const APP=path.join(os.homedir(),'Library/Application Support/SikhiToTheMax');const sch=JSON.parse(fs.readFileSync(path.join(APP,'realm-schema-evergreen.json')));
const realm=new Realm({path:path.join(APP,'sttmdesktop-evergreen-v2.realm'),schema:sch.schemas,schemaVersion:sch.schemaVersion,readOnly:true});
const norm=s=>(s||'').replace(/[^ਁ-੥ੰ-ੵ ]/g,'').trim();
const words0=id=>{const vs=String(id).startsWith('bani:')?[...realm.objects('Banis_Shabad').filtered('Bani.ID == $0',+String(id).slice(5))].map(r=>r.Custom||r.Verse).filter(Boolean):[...realm.objects('Verse').filtered('ANY Shabads.ShabadID == $0',+id)];const s=new Set();vs.forEach(v=>norm(anvaad.unicode(v.Gurmukhi||'')).split(/\s+/).forEach(w=>w.length>=2&&s.add(w)));return s;};
const words=id=>{const s=new Set();String(id).split("|").filter(x=>x&&(x.startsWith("bani:")||!isNaN(+x))).forEach(x=>words0(x).forEach(w=>s.add(w)));return s;};
function lev(a,b){if(Math.abs(a.length-b.length)>2)return 9;const d=[...Array(b.length+1).keys()];for(let i=1;i<=a.length;i++){let p=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const t=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]===b[j-1]?0:1));p=t;}}return d[b.length];}
const hit=(w,V)=>V.has(w)||(w.length>=3&&[...V].some(x=>lev(w,x)<=1));
const [D,TR]=process.argv.slice(2);const csv=t=>{const [h,...r]=t.trim().split('\n');const k=h.split(',');return r.filter(Boolean).map(l=>Object.fromEntries(l.split(',').map((v,i)=>[k[i],v])));};
const man=csv(fs.readFileSync(D+'/manifest.csv','utf8').replace(/"[^"]*"/g,m=>m.replace(/,/g,';')));
const out={};
for(const r of man.filter(r=>/^rn\d/.test(r.id))){
 const sh=csv(fs.readFileSync(`${D}/${r.content_folder}/${r.id}/shabads.csv`,'utf8'));
 const f=`${TR}/${r.cache_id}.events.jsonl`; if(!fs.existsSync(f)){console.log(r.id,'no trace');continue;}
 const ev=fs.readFileSync(f,'utf8').trim().split('\n').map(JSON.parse).filter(e=>e.type==='transcript');
 const utt=[];let last=null;for(let i=0;i<ev.length;i++){const e=ev[i],n=ev[i+1];const fin=!n||n.audioSec<e.audioSec-0.01;const fresh=!last||e.t-last.t>=e.audioSec*0.95;if(fin||fresh&&e.audioSec>=3.5){if(last&&e.t-last.t<e.audioSec*0.5&&!fresh)continue;utt.push({a:Math.max(last?last.t:0,e.t-e.audioSec),b:e.t,text:e.text});last=e;}}
 const units=[...new Set(sh.map(s=>s.shabadId))]; const V=Object.fromEntries(units.map(u=>[u,words(u)]));
 const hi=Math.min(+r.duration_s, Math.max(60, ...sh.slice(0,1).map(s=>+s.end_s+30)));
 const B=[];for(const u of utt){if(u.b>hi)break;const k=Math.floor(u.b/5);B[k]=B[k]||{n:0,h:Object.fromEntries(units.map(x=>[x,0])),t:[]};const ws=norm(u.text).split(/\s+/).filter(w=>w.length>=2);B[k].n+=ws.length;for(const x of units)B[k].h[x]+=ws.filter(w=>hit(w,V[x])).length;B[k].t.push(u.text);}
 out[r.id]={split:r.split,sh,b:B.map((b,k)=>b&&{t:k*5,n:b.n,h:b.h,text:b.t.join(' / ')}).filter(Boolean)};
}
fs.writeFileSync('detect2.json',JSON.stringify(out,null,1));realm.close();
