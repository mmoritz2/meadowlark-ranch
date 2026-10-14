const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture='tools/fixtures/formal-approach-resume-5e173bf/contract.json';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const text=fs.readFileSync(path.join(__dirname,'..',fixture),'utf8');
assert.equal(sha(text),'ce3842a217c8ecaf4ba4da5b73c6399296a0235755de683d32ff6add4dd6e9cd','Exact reviewed formal-approach/resume contract');
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
 assert.equal(sha(source),row.beforeSHA256,'Complete 5e173bf '+label+' preimage restored '+file);
 return source;
}
function normalizeFormalApproachResumeSource(source,file){return project(source,file,contract.files[file],contract.changes,'formal-approach/resume runtime/cache');}
function normalizeFormalApproachResumeObserverSource(source,file){const row=contract.observers[file];return project(source,file,row,row?.changes||[],'formal-approach/resume observer');}
function normalizeFormalApproachResumeAuditSource(source,file){return normalizeFormalApproachResumeObserverSource(normalizeFormalApproachResumeSource(source,file),file);}
function assertFormalApproachResumeCurrentSource(source,file){
 const row=contract.files[file]||contract.observers[file],added=contract.addedFiles[file];assert(row||added,'Declared formal-approach/resume owner '+file);
 assert.equal(sha(source),row?.afterSHA256||added.sha256,'Entire current reviewed formal-approach/resume owner '+file);return true;
}
function normalizeFormalApproachResumeFixtureChanges(diff){
 const lines=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(lines).size,lines.length,'No duplicate fixture paths');
 const rest=lines.filter(file=>{
  if(file!==fixture)return true;
  assert.equal(sha(fs.readFileSync(path.join(__dirname,'..',file))),sha(text),'Exactly the named reviewed formal-approach/resume fixture');return false;
 });return rest.length?rest.join('\n')+'\n':'';
}
module.exports={normalizeFormalApproachResumeSource,normalizeFormalApproachResumeObserverSource,normalizeFormalApproachResumeAuditSource,assertFormalApproachResumeCurrentSource,normalizeFormalApproachResumeFixtureChanges};
