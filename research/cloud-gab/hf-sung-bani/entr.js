// entr.js <out.json> [baniId] — English translations (bdb, ssk, ms) of a Bani's verses, or of every DB verse
const path=require('path'),fs=require('fs');const ROOT='/Users/asingh02/personal/sttm-desktop',APP='/Users/asingh02/Library/Application Support/SikhiToTheMax';
const Realm=require(path.join(ROOT,'node_modules/realm'));const anvaad=require(path.join(ROOT,'node_modules/anvaad-js'));
const sch=JSON.parse(fs.readFileSync(path.join(APP,'realm-schema-evergreen.json')));
const realm=new Realm({path:path.join(APP,'sttmdesktop-evergreen-v2.realm'),schema:sch.schemas,schemaVersion:sch.schemaVersion,readOnly:true});
const en=(v)=>{try{const t=JSON.parse(v.Translations||'{}').en||{};return [t.bdb,t.ssk,t.ms].filter(Boolean);}catch(_){return [];}};
const [out,bani]=process.argv.slice(2);const res=[];
if(bani){for(const r of realm.objects('Banis_Shabad').filtered('Bani.ID == $0',+bani).sorted('Seq')){if(!r.Verse)continue;res.push({seq:r.Seq,verseId:r.Verse.ID,header:r.header,shabadId:r.Shabad?r.Shabad.ShabadID:null,g:anvaad.unicode(r.Verse.Gurmukhi||''),tr:anvaad.translit(r.Verse.Gurmukhi||''),en:en(r.Verse)});}}
else for(const v of realm.objects('Verse')){const e=en(v);if(e.length)res.push({verseId:v.ID,shabadId:v.Shabads&&v.Shabads.length?v.Shabads[0].ShabadID:null,en:e});}
fs.writeFileSync(out,JSON.stringify(res));console.log(res.length);realm.close();
