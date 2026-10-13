const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {undoMeadowReliefWallSource,normalizeMeadowReliefWallTestSource}=require('./meadow-relief-wall-source-guard.cjs');
const {normalizeLashCacheSource,normalizeLashObserverSource}=require('./lash-cache-source-guard.cjs');
const directory=path.join(__dirname,'fixtures/progression-grass-9c9ae98');
const contract=JSON.parse(fs.readFileSync(path.join(directory,'contract.json'),'utf8'));
const changes=JSON.parse(fs.readFileSync(path.join(directory,'observer-changes.json'),'utf8'));
const historical=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/grass-ribbon-d9b168e/contract.json'),'utf8')).testAdapterPreimages;
const {normalizeProgressionLoopCacheSource}=require('./progression-loop-cache-source-guard.cjs');
const {normalizeProgressionHintsSource}=require('./progression-hints-source-guard.cjs');
const sha=source=>crypto.createHash('sha256').update(source).digest('hex');
// Keep the incoming grass graph, owner bodies, observers and dependency SHA
// values fixed. Only exact separately reviewed progression imports/predicate
// differ before those original complete-source assertions are evaluated.
function normalizeProgressionSource(source,file){
 source=undoMeadowReliefWallSource(source,file);
 source=normalizeLashCacheSource(source,file);
 return normalizeProgressionHintsSource(normalizeProgressionLoopCacheSource(source,file),file);
}
function normalizeProgressionGuardSource(source,file){
 source=normalizeMeadowReliefWallTestSource(source,file);
 source=normalizeLashObserverSource(source,file);
 const hash=contract.preimageSHA256[file],actual=sha(source);
 // The incoming suite explicitly round-trips its fixed original d9 observers.
 // Permit only that exact complete-body SHA, never a partial adapter state.
 if(!hash||actual===hash||actual===historical[file])return source;
 for(const c of changes.toReversed().filter(c=>c.file===file)){
  assert.equal(source.split(c.after).length-1,c.occurrences,'Exact progression/grass observer compatibility '+file+': '+c.after.slice(0,95));
  source=source.replace(c.after,c.before);
 }
 assert.equal(sha(source),hash,'Complete original incoming grass observer/guard restored '+file);
 return source;
}
module.exports={normalizeProgressionSource,normalizeProgressionGuardSource};
