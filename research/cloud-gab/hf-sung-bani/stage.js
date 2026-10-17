// stage.js <main manifest.csv> <stage dir> — the dataset PR's files: the new clip folders (audio, lines.csv, shabads.csv,
// caption_runs.json, contact_sheet.png, meta.json) and manifest.csv with their rows added (base = GAB v1.4 manifest).
// The video's Rehras is already in GAB (test); its other Banis join it in the test split. Every other byte is kept.
const fs=require('fs'),path=require('path');
const V=process.env.HOME+'/personal/sb-video/';const [mainCsv,ST]=process.argv.slice(2);
const clips=JSON.parse(fs.readFileSync(V+'clips.json'));const verdicts=JSON.parse(fs.readFileSync(V+'sheets/verdicts.json'));const recheck=JSON.parse(fs.readFileSync(V+'sheets/recheck/verdicts.json'));
const split=(l)=>{const v=[];let c='',q=false;for(let i=0;i<l.length;i++){const ch=l[i];if(q&&ch==='"'&&l[i+1]==='"'){c+='"';i++;}else if(ch==='"')q=!q;else if(ch===','&&!q){v.push(c);c='';}else c+=ch;}v.push(c);return v;};
const join=(v)=>v.map((x)=>(/[",\n]/.test(x)?`"${x.replace(/"/g,'""')}"`:x)).join(',');
const GUR="YouTube: Brother of Heaven, 'Sikh Daily Prayers: Each Nitnem Read-Along' (2025-04-18)";const SESSION='YouTube-Rt1TyWzPykc';
const SPLIT=process.env.SB_SPLIT||'test';
const SPLIT_NOTE='2026-10-17: this video was already in GAB (ytrehras_Rt1TyWzPykc_4339-6253, Rehras, test split). One video = one session = one split, so these new cuts of its other Banis are test (held back) too; the Rehras part is not added again. Never tune on them.';
const METHOD='caption-change detection on the Gurmukhi row of the 360p caption band (yellow-text mask, 4 fps; a slide = a lit run between fades), Apple Vision OCR (en-US) of the transliteration row, fuzzy match (edit distance on letters) to the STTM DB transliteration of the Bani\'s pangtis: anchors >= 80 with a margin >= 6 over any other text, order fill between anchors (>= 60), a caption that shows only part of a long DB pangti is matched to it (>= 85), a caption not in the DB Bani is searched in the whole DB (>= 80; a Shabad sung inside the Bani gets its own shabads.csv row); a slide with several DB pangtis (Jaap Sahib) is split by text length (times inside such a slide are estimated); the same pangti on consecutive slides is one row; each row starts when its slide appears and ends when it fades; header pangtis (DB header flag) and Banis_Custom rows are left unlabelled; our speech model was not used';
let [head,...rows]=fs.readFileSync(mainCsv,'utf8').split('\n');const k=split(head);const I=(n)=>{const i=k.indexOf(n);if(i<0)throw new Error(n);return i;};
const out=[head];let moved=0;
for(const l of rows){if(!l.trim()){out.push(l);continue;}const v=split(l);
  out.push(l);}

const ids=new Set(rows.filter(l=>l.trim()).map(l=>split(l)[I('id')]));
const added=[];
for(const c of clips.filter(c=>c.chapter!=='rehras')){if(ids.has(c.id))throw new Error(`${c.id} already in the manifest`);
  const vd=verdicts.clips[c.id]||[];const rc=recheck.clips[c.id]||[];const tally=(a)=>a.reduce((m,x)=>(m[x.verdict]=(m[x.verdict]||0)+1,m),{});const first=tally(vd),second=tally(rc);
  // final: first-pass rows (the 'no' rows were re-keyed by the fix and are re-checked in the second pass) + second pass
  const cnt={yes:(first.yes||0)+(second.yes||0),no:(second.no||0),unsure:(first.unsure||0)+(second.unsure||0)};
  const dst=path.join(ST,c.folder,c.id);fs.mkdirSync(dst,{recursive:true});
  for(const f of ['audio.wav','lines.csv','shabads.csv','caption_runs.json','contact_sheet.png'])fs.copyFileSync(path.join(c.dir,f),path.join(dst,f));
  const meta={id:c.id,content_folder:c.folder,bani:c.bani,bani_id:c.bani_id,gurdwara:GUR,reader:`${c.singer} (named in the video description)`,acoustics:'studio',mic_path:'broadcast mix (YouTube upload audio)',
    origin:`https://www.youtube.com/watch?v=Rt1TyWzPykc&t=${Math.floor(c.start)}s`,segment:{start_s:c.start,end_s:c.end,label:`${c.start}-${c.end} s of the source video; edges at the quietest 50 ms within 5 s of a slide change (edge level ${c.edge_db.join(' / ')} dBFS)`},
    source_file:'audio.wav',duration_s:c.dur,split:SPLIT,split_note:SPLIT_NOTE,session:SESSION,suite_jobs:`apaath:${c.id}`,
    runner:'akhand-bench.js (whole clip from t=0, every Bani route on as in the app); scored as Bani sung like kirtan by its folder',
    cache:'no (recorded on x86, GCP vf-record-2, when first scored)',lines_source:'broadcast-caption',lines_n:c.lines,shabads_n:c.shabads,
    shabads_note:c.pieces.length?`bani:${c.bani_id} over the clip, cut out where a Shabad outside the DB Bani is sung (${c.pieces.join(', ')}: own rows)`:`bani:${c.bani_id} over the whole clip`,
    truth_provenance:'burned-in publisher slides (read-along video; one pangti per slide, several short pangtis on a Jaap Sahib slide), matched to the STTM DB',truth_method:METHOD,
    key_rows_by_method:c.how,header_rows_unlabelled:c.headers,read_or_sung:'sung like kirtan (owner: the whole video is Bani sung; the earlier Rehras cut was confirmed by ear 2026-10-13); a ~30 s spoken English reflection precedes each Bani in the video and is outside the clips',
    verification:{date:'2026-10-17',by:verdicts.by||'independent verifier agent (not the labeller)',method:'contact_sheet.png: every row the matcher was less sure of (order fill, partial, whole-DB, OCR score < 85; up to 30) plus random OCR rows, each at 3 frames (0.75 s before the start, 0.5 s after the start, 0.5 s before the end), checked against the DB pangti',first_pass:first,fix:'first pass found 3 rows (Japji Pauri 28 vs 30/31, Salok M9 14 vs 15) keyed to an earlier verse with the same words; matcher fixed to take the occurrence in Bani order (26 caption runs re-keyed in the whole video over two fixes), every re-keyed row re-checked',second_pass:second,result:cnt,not_yes_second_pass:rc.filter(x=>x.verdict!=='yes').map(x=>x.n)},
    notes:'Owner-supplied video (P0 Sung Bani, Oct 17 2026); 5-10 min cuts covering the Bani; ' + (c.chapter==='aarti'?'Aarti as sung here (Bhai Bakshish Singh Ji, Patiala) includes Savaiye and Shabads that the STTM DB Aarti Bani does not hold: those are their own Shabad rows':'')};
  fs.writeFileSync(path.join(dst,'meta.json'),JSON.stringify(meta,null,1));
  const row=Object.fromEntries(k.map(x=>[x,'']));Object.assign(row,{id:c.id,content_folder:c.folder,bani:c.bani,gurdwara:GUR,acoustics:'studio',split:SPLIT,duration_s:String(c.dur),suite_jobs:`apaath:${c.id}`,cache:'no',cache_id:'',lines_n:String(c.lines),lines_source:'broadcast-caption',shabads_n:String(c.shabads),
    truth_provenance:`burned-in publisher slides matched to the STTM DB Bani ${c.bani_id} (caption change + OCR), frame-checked by an independent verifier (${cnt.yes||0} yes / ${cnt.no||0} no / ${cnt.unsure||0} unsure)`,origin:meta.origin,source_file:`${c.id}.wav`,reader:c.singer,audio:`${c.folder}/${c.id}/audio.wav`,
    notes:`Sung Bani, owner's Nitnem video; ${c.bani} part ${c.start}-${c.end} s; one session = one split (${SPLIT}, with the earlier Rehras cut); cache: recorded on x86`,session:SESSION});
  added.push(join(k.map(x=>row[x])));}
const lastBlank=out[out.length-1]==='';const body=lastBlank?out.slice(0,-1):out;
fs.writeFileSync(path.join(ST,'manifest.csv'),[...body,...added].join('\n')+(lastBlank?'\n':''));
// self-check: every old row unchanged
const nb=fs.readFileSync(path.join(ST,'manifest.csv'),'utf8').split('\n');rows.forEach((l,i)=>{if(l.trim()&&nb[i+1]!==l)throw new Error('row changed: '+l.slice(0,40));});
console.log(`staged ${added.length} clips (${SPLIT}); manifest ${rows.filter(l=>l.trim()).length} -> ${nb.filter(l=>l.trim()).length-1} rows`);
