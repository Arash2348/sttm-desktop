const path=require('path'),fs=require('fs');
const ROOT='/Users/asingh02/personal/sttm-desktop', APP='/Users/asingh02/Library/Application Support/SikhiToTheMax';
const Realm=require(path.join(ROOT,'node_modules/realm')); const anvaad=require(path.join(ROOT,'node_modules/anvaad-js'));
const sch=JSON.parse(fs.readFileSync(path.join(APP,'realm-schema-evergreen.json')));
const realm=new Realm({path:path.join(APP,'sttmdesktop-evergreen-v2.realm'),schema:sch.schemas,schemaVersion:sch.schemaVersion,readOnly:true});
const out=[];for(const v of realm.objects('Verse')){const s=v.Shabads&&v.Shabads.length?v.Shabads[0].ShabadID:null;out.push([v.ID,s,anvaad.translit(v.Gurmukhi||''),v.PageNo,v.Source&&v.Source.SourceID||null]);}
fs.writeFileSync('allverses.json',JSON.stringify(out));console.log(out.length);realm.close();
