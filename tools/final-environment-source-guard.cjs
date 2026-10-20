// Current horse appearance/cache changes are verified before the frozen environment authority.
const {normalizeHorseRealismSource,normalizeHorseRealismFixtureChanges}=require('./horse-realism-source-guard.cjs');
// Exact current Final environment leaf; no older guard imports and no weak normalization.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/final-environment-a129adc/source-contract.json',sha=b=>crypto.createHash('sha256').update(b).digest('hex'),baseRoot=path.join(__dirname,'..'),declaration=fs.readFileSync(path.join(baseRoot,fixture));
assert.equal(sha(declaration),'71710bb110a40fec5739b6aa61e817103406acb2925fdada2300c315dc292003','Exact Final environment source declaration');const contract=JSON.parse(declaration);
function normalizeFinalEnvironmentSource(source,file){
 source=normalizeHorseRealismSource(source,file);
 const row=contract.files[file]||contract.observers[file];if(!row)return source;const hash=sha(source);if(hash===row.beforeSHA256)return source;
 const buffer=Buffer.isBuffer(source),text=buffer?source.toString('utf8'):source;if(hash!==row.afterSHA256&&!contract.markers.some(m=>text.includes(m)))return source;
 assert.equal(hash,row.afterSHA256,'Whole approved Final environment owner '+file);let parent=text;
 for(const e of [...row.changes].reverse()){assert.equal(parent.split(e.after).length-1,e.occurrences,'Counted Final environment inverse '+file);parent=parent.replaceAll(e.after,e.before);}
 assert.equal(sha(parent),row.beforeSHA256,'Whole exacta129adc parent '+file);return buffer?Buffer.from(parent):parent;
}
function assertFinalEnvironmentCurrent(read,{rootDir=baseRoot}={}){
 const input=typeof read==='function'?read:file=>fs.readFileSync(path.join(rootDir,file)),raw=file=>normalizeHorseRealismSource(input(file),file);
 for(const[f,row]of Object.entries({...contract.files,...contract.observers}))assert.equal(sha(raw(f)),row.afterSHA256,'Actual raw Final environment owner '+f);
 for(const[f,row]of Object.entries(contract.addedFiles))assert.equal(sha(raw(f)),row.sha256,'Actual raw added Final environment helper/test '+f);
 for(const[f,h]of Object.entries({...contract.parentFixtureSHA256,...contract.newFixtureSHA256}))assert.equal(sha(raw(f)),h,'Exact current Final environment fixture '+f);return true;
}
function normalizeFinalEnvironmentFixtureChanges(diff,{rootDir=baseRoot}={}){
 diff=normalizeHorseRealismFixtureChanges(diff,{rootDir});
 const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate Final environment fixture');const allowed={...contract.newFixtureSHA256,[fixture]:sha(declaration)};
 const kept=rows.filter(f=>{if(!Object.hasOwn(allowed,f))return true;assert.equal(sha(fs.readFileSync(path.join(rootDir,f))),allowed[f],'Exact new Final environment fixture '+f);return false;});return kept.length?kept.join('\n')+'\n':'';
}
module.exports={normalizeFinalEnvironmentSource,assertFinalEnvironmentCurrent,normalizeFinalEnvironmentFixtureChanges};
