// Exact reviewed appearance/cache inverse before the frozen environment/riding authorities.
// Runtime geometry/material tests always exercise the current, unprojected modules.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/horse-realism-579b5cf/source-contract.json',baseRoot=path.join(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const declaration=fs.readFileSync(path.join(baseRoot,fixture));assert.equal(sha(declaration),'4baad13446cb72024dd5a8cf0f527f72b0e5188b202d281cd51e6b34d99fe709','Exact reviewed horse-realism source declaration');const contract=JSON.parse(declaration);
function normalizeHorseRealismSource(source,file){
 const row=contract.files[file]||contract.observers[file];if(!row)return source;
 const hash=sha(source);if(hash===row.beforeSHA256)return source;
 const buffer=Buffer.isBuffer(source),text=buffer?source.toString('utf8'):source;
 if(hash!==row.afterSHA256&&!row.changes.some(change=>text.includes(change.after)))return source;
 assert.equal(hash,row.afterSHA256,'Whole approved horse-realism owner '+file);let parent=text;
 for(const change of [...row.changes].reverse()){
  assert.equal(parent.split(change.after).length-1,change.occurrences,'Counted horse-realism inverse '+file);
  parent=parent.replaceAll(change.after,change.before);
 }
 assert.equal(sha(parent),row.beforeSHA256,'Whole exact 579b5cf parent '+file);return buffer?Buffer.from(parent):parent;
}
function assertHorseRealismCurrent(read,{rootDir=baseRoot}={}){
 const raw=typeof read==='function'?read:file=>fs.readFileSync(path.join(rootDir,file));
 for(const[file,row]of Object.entries({...contract.files,...contract.observers}))assert.equal(sha(raw(file)),row.afterSHA256,'Actual current horse-realism owner '+file);
 for(const[file,row]of Object.entries(contract.addedFiles))assert.equal(sha(raw(file)),row.sha256,'Actual current horse-realism guard/test '+file);
 for(const[file,hash]of Object.entries({...contract.parentFixtureSHA256,...contract.newFixtureSHA256}))assert.equal(sha(raw(file)),hash,'Unchanged or exactly reviewed fixture '+file);
 return true;
}
function normalizeHorseRealismFixtureChanges(diff,{rootDir=baseRoot}={}){
 const rows=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(rows).size,rows.length,'No duplicate horse-realism fixture paths');
 const known={...contract.newFixtureSHA256,[fixture]:sha(declaration)};
 const kept=rows.filter(file=>{if(!Object.hasOwn(known,file))return true;assert.equal(sha(fs.readFileSync(path.join(rootDir,file))),known[file],'Exact new horse-realism fixture '+file);return false;});return kept.length?kept.join('\n')+'\n':'';
}
module.exports={normalizeHorseRealismSource,assertHorseRealismCurrent,normalizeHorseRealismFixtureChanges};
