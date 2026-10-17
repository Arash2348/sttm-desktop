const path=require('path'),fs=require('fs');
const ROOT='/Users/asingh02/personal/sttm-desktop', APP='/Users/asingh02/Library/Application Support/SikhiToTheMax';
const Realm=require(path.join(ROOT,'node_modules/realm')); const anvaad=require(path.join(ROOT,'node_modules/anvaad-js'));
const sch=JSON.parse(fs.readFileSync(path.join(APP,'realm-schema-evergreen.json')));
const realm=new Realm({path:path.join(APP,'sttmdesktop-evergreen-v2.realm'),schema:sch.schemas,schemaVersion:sch.schemaVersion,readOnly:true});
if(process.argv[2]==='list'){for(const b of realm.objects('Banis').sorted('ID'))console.log(b.ID,b.Token,anvaad.unicode(b.Gurmukhi||''),realm.objects('Banis_Shabad').filtered('Bani.ID == $0',b.ID).length);}
else { const id=+process.argv[2]; const rows=[...realm.objects('Banis_Shabad').filtered('Bani.ID == $0',id).sorted('Seq')].map(r=>{const v=r.Custom||r.Verse; const g=v?anvaad.unicode(v.Gurmukhi||''):''; return {seq:r.Seq,verseId:r.Verse?r.Verse.ID:null,customId:r.Custom?r.Custom.ID:null,header:r.header,taksal:r.existsTaksal,sgpc:r.existsSGPC,medium:r.existsMedium,shabadId:r.Shabad?r.Shabad.ShabadID:null,g,tr:v?anvaad.translit(v.Gurmukhi||''):''};}); fs.writeFileSync(process.argv[3],JSON.stringify(rows)); console.log(id,rows.length);}
realm.close();
