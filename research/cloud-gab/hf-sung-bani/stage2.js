// stage2.js <stage dir> <video config.json> <video meta.json> — add one more video's clips (build2.js output) to a
// stage made by stage.js: copies the clip files, writes meta.json, appends the manifest rows (existing rows untouched)
const fs=require('fs'),path=require('path');const [ST,CFG,VM]=process.argv.slice(2);
const C=JSON.parse(fs.readFileSync(CFG));const M=JSON.parse(fs.readFileSync(VM));const clips=JSON.parse(fs.readFileSync(path.join(C.dir,'clips.json')));
const vd=fs.existsSync(path.join(C.dir,'sheets/verdicts.json'))?JSON.parse(fs.readFileSync(path.join(C.dir,'sheets/verdicts.json'))).clips:{};
const split=(l)=>{const v=[];let c='',q=false;for(let i=0;i<l.length;i++){const ch=l[i];if(q&&ch==='"'&&l[i+1]==='"'){c+='"';i++;}else if(ch==='"')q=!q;else if(ch===','&&!q){v.push(c);c='';}else c+=ch;}v.push(c);return v;};
const join=(v)=>v.map((x)=>(/[",\n]/.test(x)?`"${x.replace(/"/g,'""')}"`:x)).join(',');
const mf=path.join(ST,'manifest.csv');const text=fs.readFileSync(mf,'utf8');const lines=text.split('\n');const k=split(lines[0]);
const ids=new Set(lines.slice(1).filter(l=>l.trim()).map(l=>split(l)[0]));const added=[];
for(const c of clips){if(ids.has(c.id))throw new Error(`${c.id} already in the manifest`);const dst=path.join(ST,c.folder,c.id);fs.mkdirSync(dst,{recursive:true});
  for(const f of ['audio.wav','lines.csv','shabads.csv','contact_sheet.png'])if(fs.existsSync(path.join(c.dir,f)))fs.copyFileSync(path.join(c.dir,f),path.join(dst,f));
  const v=vd[c.id]||[];const cnt=v.reduce((a,x)=>(a[x.verdict]=(a[x.verdict]||0)+1,a),{});
  const meta={id:c.id,content_folder:c.folder,bani:M.bani,gurdwara:M.gurdwara,reader:M.reader,acoustics:M.acoustics,mic_path:M.mic_path,origin:`https://www.youtube.com/watch?v=${C.video}&t=${Math.floor(c.start)}s`,
    segment:{start_s:c.start,end_s:c.end,label:`${c.start}-${c.end} s of the source video; edges at the quietest 50 ms near a slide change or the planned cut (edge level ${c.edge_db.join(' / ')} dBFS)`},
    source_file:'audio.wav',duration_s:c.dur,split:M.split,split_note:M.split_note,session:M.session,suite_jobs:`apaath:${c.id}`,runner:'akhand-bench.js (whole clip from t=0, every Bani route on as in the app); scored as Bani sung like kirtan by its folder',
    cache:'no (recorded on x86, GCP vf-record-2, when first scored)',lines_source:C.source,lines_n:c.lines,shabads_n:c.shabads,truth_provenance:M.truth_provenance,truth_method:M.truth_method,key_rows_by_method:c.how,
    ...(M.verified===false?{verification:{status:'aligned, needs human check',plan:M.check_plan}}:{verification:{date:'2026-10-17',by:'independent verifier agent (not the labeller)',method:'contact_sheet.png: every less-sure row plus random rows, 3 frames each (0.75 s before the start, 0.5 s after, 0.5 s before the end)',result:cnt,not_yes:v.filter(x=>x.verdict!=='yes').map(x=>x.n)}}),
    style:M.style,read_or_sung:M.read_or_sung,notes:M.notes};
  fs.writeFileSync(path.join(dst,'meta.json'),JSON.stringify(meta,null,1));
  const row=Object.fromEntries(k.map(x=>[x,'']));Object.assign(row,{id:c.id,content_folder:c.folder,bani:M.bani,gurdwara:M.gurdwara,acoustics:M.acoustics,split:M.split,duration_s:String(c.dur),suite_jobs:`apaath:${c.id}`,cache:'no',lines_n:String(c.lines),lines_source:C.source,shabads_n:String(c.shabads),
    truth_provenance:M.verified===false?M.truth_provenance:`${M.truth_provenance}; frame-checked by an independent verifier (${cnt.yes||0} yes / ${cnt.no||0} no / ${cnt.unsure||0} unsure)`,origin:meta.origin,source_file:`${c.id}.wav`,reader:M.reader,audio:`${c.folder}/${c.id}/audio.wav`,notes:M.manifest_notes,session:M.session});
  added.push(join(k.map(x=>row[x])));}
const end=text.endsWith('\n');fs.writeFileSync(mf,(end?text.slice(0,-1):text)+'\n'+added.join('\n')+(end?'\n':''));
const nb=fs.readFileSync(mf,'utf8').split('\n');lines.forEach((l,i)=>{if(l.trim()&&nb[i]!==l)throw new Error('row changed: '+l.slice(0,40));});
console.log(`added ${added.length} clips of ${C.video} (${M.split})`);
