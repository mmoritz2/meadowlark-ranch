const {undoNorthRimSource,undoNorthRimObserverSource}=require('./north-rim-source-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/programme-regroup-05421c6/contract.json';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const text=fs.readFileSync(path.join(__dirname,'..',fixture),'utf8');
assert.equal(sha(text),'671c6d08f0ce12c2c0aa300807b3d1e41ef6b49dccba566bc73bd732e35d9996','Exact reviewed programme/regroup contract');
const contract=JSON.parse(text);
// Leaf-only: source projection never initializes the older mutually dependent
// landscape guards. Historical inputs retain their complete original checks.
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
 // A historical subject without the new exact markers passes unchanged to
 // its existing downstream full-body assertions. This is not current approval.
 if(!rows.some(c=>c.file===file&&source.includes(c.after)))return source;
 assert.equal(sha(source),row.afterSHA256,'Entire reviewed '+label+' subject '+file);
 source=reverse(source,file,rows,label);
 assert.equal(sha(source),row.beforeSHA256,'Complete 05421c6 '+label+' preimage restored '+file);
 return source;
}
function normalizeProgrammeRegroupSource(source,file){return project(undoNorthRimSource(source,file),file,contract.files[file],contract.changes,'programme/regroup runtime/cache');}
function normalizeProgrammeRegroupObserverSource(source,file){const row=contract.observers[file];return project(undoNorthRimObserverSource(source,file),file,row,row?.changes||[],'programme/regroup observer');}
function normalizeProgrammeRegroupAuditSource(source,file){return normalizeProgrammeRegroupObserverSource(normalizeProgrammeRegroupSource(source,file),file);}
function assertProgrammeRegroupCurrentSource(source,file){
 source=undoNorthRimObserverSource(undoNorthRimSource(source,file),file);
 const row=contract.files[file]||contract.observers[file],added=contract.addedFiles[file];assert(row||added,'Declared programme/regroup owner '+file);
 assert.equal(sha(source),row?.afterSHA256||added.sha256,'Entire current reviewed programme/regroup owner '+file);return true;
}
function normalizeProgrammeRegroupFixtureChanges(diff){
 const lines=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(lines).size,lines.length,'No duplicate fixture paths');
 const rest=lines.filter(file=>{
  if(file!==fixture)return true;
  assert.equal(sha(fs.readFileSync(path.join(__dirname,'..',file))),sha(text),'Exactly the named reviewed programme/regroup fixture');return false;
 });return rest.length?rest.join('\n')+'\n':'';
}
module.exports={normalizeProgrammeRegroupSource,normalizeProgrammeRegroupObserverSource,normalizeProgrammeRegroupAuditSource,assertProgrammeRegroupCurrentSource,normalizeProgrammeRegroupFixtureChanges};
