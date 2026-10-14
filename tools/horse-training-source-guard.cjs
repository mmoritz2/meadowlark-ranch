const {undoNorthRimSource,undoNorthRimObserverSource}=require('./north-rim-source-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/horse-training-dc405f3/contract.json';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const text=fs.readFileSync(path.join(__dirname,'..',fixture),'utf8');
assert.equal(sha(text),'cae6f4a87d97ad87174a47a874e08365f510c32cf58673d0cde87d785fffd822','Exact reviewed horse-training contract');
const contract=JSON.parse(text);
// Leaf-only: loading this layer cannot initialize any previous mutually dependent
// world guard. Historical inputs retain every unchanged downstream assertion.
function reverse(source,file,rows,label){
 for(const c of rows.toReversed().filter(c=>c.file===file)){
  assert.equal(source.split(c.after).length-1,c.occurrences,'One exact '+label+' addition '+file);
  if(c.before)assert.equal(source.replace(c.after,'').split(c.before).length-1,0,'No mixed previous/'+label+' subject '+file);
  source=source.replace(c.after,c.before);
 }
 return source;
}
function project(source,file,row,rows,label){
 if(!row||sha(source)===row.beforeSHA256)return source;
 // Previous complete subjects have none of this new group's exact additions.
 // They continue to their existing full-body/hash checks; no aliases are invented.
 if(!rows.some(c=>c.file===file&&source.includes(c.after)))return source;
 assert.equal(sha(source),row.afterSHA256,'Complete reviewed '+label+' subject '+file);
 source=reverse(source,file,rows,label);
 assert.equal(sha(source),row.beforeSHA256,'Complete dc405f3 '+label+' preimage restored '+file);
 return source;
}
function normalizeHorseTrainingSource(source,file){return project(undoNorthRimSource(source,file),file,contract.files[file],contract.changes,'training runtime/cache');}
function normalizeHorseTrainingObserverSource(source,file){const row=contract.observers[file];return project(undoNorthRimObserverSource(source,file),file,row,row?.changes||[],'training observer');}
function normalizeHorseTrainingAuditSource(source,file){return normalizeHorseTrainingObserverSource(normalizeHorseTrainingSource(source,file),file);}
function assertHorseTrainingCurrentSource(source,file){
 source=undoNorthRimObserverSource(undoNorthRimSource(source,file),file);
 const row=contract.files[file]||contract.observers[file];assert(row,'Declared horse-training owner '+file);
 assert.equal(sha(source),row.afterSHA256,'Entire current reviewed horse-training owner '+file);return true;
}
function normalizeHorseTrainingFixtureChanges(diff){
 const lines=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(lines).size,lines.length,'No duplicate fixture paths');
 const rest=lines.filter(file=>{
  if(file!==fixture)return true;
  assert.equal(sha(fs.readFileSync(path.join(__dirname,'..',file))),sha(text),'Exactly the named reviewed horse-training fixture');return false;
 });return rest.length?rest.join('\n')+'\n':'';
}
module.exports={normalizeHorseTrainingSource,normalizeHorseTrainingObserverSource,normalizeHorseTrainingAuditSource,assertHorseTrainingCurrentSource,normalizeHorseTrainingFixtureChanges};
