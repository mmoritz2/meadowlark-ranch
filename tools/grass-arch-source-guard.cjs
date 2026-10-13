const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {normalizeAuthoredCameraSource}=require('./authored-camera-source-guard.cjs');
const {normalizePublishedCacheSource}=require('./published-world-import-source-guard.cjs');
const {normalizeFieldstoneWallCacheSource}=require('./fieldstone-wall-cache-source-guard.cjs');
const {normalizeGrassRibbonSource}=require('./grass-ribbon-source-guard.cjs');
const {normalizeMeadowReliefWallSource}=require('./meadow-relief-wall-source-guard.cjs');
const directory=path.join(__dirname,'fixtures/grass-arch-d5b9441');
const changes=JSON.parse(fs.readFileSync(path.join(directory,'source-changes.json')));
const preimage=JSON.parse(fs.readFileSync(path.join(directory,'preimage-SHA.json')));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
// Camera undo precedes leaf undo; all six complete d5 bodies are then pinned.
// Geometry/profile changes are deliberate and have separate actual-model gates.
// Nothing else in placement, classifiers, cut fields, shaders or gameplay is skipped.
function normalizeGrassArchSource(source,file){
 source=normalizeMeadowReliefWallSource(source,file);
 source=normalizeGrassRibbonSource(source,file);
 source=normalizeFieldstoneWallCacheSource(source,file);
 source=normalizePublishedCacheSource(source,file);
 source=normalizeAuthoredCameraSource(source,file);
 if(!preimage[file])return source;
 for(const c of changes.toReversed().filter(c=>c.file===file)){
  if(source.includes(c.after)){
   assert.equal(source.split(c.after).length,2,'Exactly one reviewed leaf/cache addition '+file);
   source=source.replace(c.after,c.before);
  }else assert.equal(source.split(c.before).length,2,'Expected original or reviewed leaf/cache source '+file);
 }
 assert.equal(sha(source),preimage[file],'Entire d5 grass/world owner body restored '+file);
 return source;
}
module.exports={normalizeGrassArchSource};
