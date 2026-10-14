// countryside-fields-1: version-aware inverse before the strict C8 authority.
const {normalizeCountrysideFieldsSource,normalizeCountrysideFieldsFixtureChanges}=require('./countryside-fields-source-guard.cjs');
// Exact historical countryside inverse; current runtime tests never use this view.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/countryside-vista-3fa6665/source-contract.json',sha=b=>crypto.createHash('sha256').update(b).digest('hex'),baseRoot=path.join(__dirname,'..');
const declaration=fs.readFileSync(path.join(baseRoot,fixture));assert.equal(sha(declaration),'6b2eba319d6d1cd9866ad5ad360d69b2fe3f2aa64dac1aa457cd19e08ad927d6','Exact countryside source declaration');const contract=JSON.parse(declaration);
function normalizeCountrysideVistaSource(source,file){
 source=normalizeCountrysideFieldsSource(source,file);
 const row=contract.files[file]||contract.observers[file];if(!row)return source;
 const hash=sha(source);if(hash===row.beforeSHA256||(contract.historicalPassThroughSHA256[file]||[]).includes(hash))return source;
 assert.equal(hash,row.afterSHA256,'Whole approved countryside owner '+file);
 const buffer=Buffer.isBuffer(source);let text=buffer?source.toString('utf8'):source;
 for(const change of row.changes.toReversed()){assert.equal(text.split(change.after).length-1,change.occurrences,'Exact countryside inverse '+file);text=text.replaceAll(change.after,change.before);}
 assert.equal(sha(text),row.beforeSHA256,'Whole exact3fa countryside parent '+file);return buffer?Buffer.from(text):text;
}
// read, when supplied, receives repository-relative paths and must return raw bytes/text.
function assertCountrysideVistaSource(read,{rootDir=baseRoot}={}){
 const raw=typeof read==='function'?read:file=>fs.readFileSync(path.join(rootDir,file)),current=file=>normalizeCountrysideFieldsSource(raw(file),file);
 for(const[file,row]of Object.entries({...contract.files,...contract.observers}))assert.equal(sha(current(file)),row.afterSHA256,'Actual current countryside owner '+file);
 for(const[file,row]of Object.entries(contract.addedFiles))assert.equal(sha(current(file)),row.sha256,'Actual added countryside owner '+file);
 for(const[file,hash]of Object.entries(contract.newFixtureSHA256))assert.equal(sha(current(file)),hash,'Actual new countryside fixture '+file);
 for(const[file,hash]of Object.entries(contract.parentFixtureSHA256))assert.equal(sha(current(file)),hash,'Preserved current3fa fixture '+file);
 return true;
}
function normalizeCountrysideVistaFixtureChanges(diff,{rootDir=baseRoot}={}){
 diff=normalizeCountrysideFieldsFixtureChanges(diff,{rootDir});
 const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate countryside fixture paths');
 const allowed={...contract.newFixtureSHA256,[fixture]:sha(declaration)};
 const kept=rows.filter(file=>{if(!Object.hasOwn(allowed,file))return true;assert.equal(sha(fs.readFileSync(path.join(rootDir,file))),allowed[file],'Exact new countryside fixture '+file);return false;});
 return kept.length?kept.join('\n')+'\n':'';
}
module.exports={normalizeCountrysideVistaSource,assertCountrysideVistaSource,normalizeCountrysideVistaFixtureChanges};
