const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const directory=path.join(__dirname,'fixtures/lash-cache-df065bd');
const contract=JSON.parse(fs.readFileSync(path.join(directory,'contract.json'),'utf8'));
const observers=JSON.parse(fs.readFileSync(path.join(directory,'observer-changes.json'),'utf8'));
const sha=source=>crypto.createHash('sha256').update(source).digest('hex');
// Only the complete new per-owner cache group may restore the exact df owner.
// Older subjects pass to their unchanged historical guards; no version regexp
// or generic query stripping may erase an unrelated source change.
function normalizeLashCacheSource(source,file){
 const expected=contract.ownerBeforeSHA256[file];if(!expected)return source;
 const rows=contract.changes.filter(c=>c.file===file);
 if(!source.includes(contract.version))return source;
 for(const c of rows){
  assert.equal(source.split(c.after).length-1,c.occurrences,'Exactly one reviewed lash cache import '+file+': '+c.after);
  assert.equal(source.split(c.before).length-1,0,'No mixed original/reviewed lash cache imports '+file);
  source=source.replace(c.after,c.before);
 }
 assert.equal(sha(source),expected,'Entire df065bd lash cache owner restored '+file);return source;
}
// The old dependency SHA assertions remain authoritative. Reverse only the
// new reader/guard seams, then require their complete independently pinned
// df preimage before existing progression and grass observer reversals run.
function normalizeLashObserverSource(source,file){
 const expected=contract.observerBeforeSHA256[file];if(!expected)return source;
 if(contract.observerApprovedPreimageSHA256[file].includes(sha(source)))return source;
 for(const c of observers.toReversed().filter(c=>c.file===file)){
  assert.equal(source.split(c.after).length-1,c.occurrences,'Exact lash observer compatibility '+file+': '+c.after.slice(0,85));
  source=source.replace(c.after,c.before);
 }
 assert.equal(sha(source),expected,'Complete original df065bd observer restored '+file);return source;
}
module.exports={normalizeLashCacheSource,normalizeLashObserverSource};
