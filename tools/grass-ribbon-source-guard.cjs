const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {normalizeMeadowReliefWallTestSource}=require('./meadow-relief-wall-source-guard.cjs');
const {normalizeProgressionGuardSource}=require('./progression-grass-source-guard.cjs');
const {undoCourseTurfBladesSource}=require('./course-turf-blades-source-guard.cjs');
const directory=path.join(__dirname,'fixtures/grass-ribbon-d9b168e');
const contract=JSON.parse(fs.readFileSync(path.join(directory,'contract.json')));
const changes=JSON.parse(fs.readFileSync(path.join(directory,'source-changes.json')));
const adapters=JSON.parse(fs.readFileSync(path.join(directory,'test-adapter-changes.json')));
const sha=source=>crypto.createHash('sha256').update(source).digest('hex');
for(const [file,hash]of Object.entries(contract.dependencySHA256))assert.equal(sha(normalizeProgressionGuardSource(normalizeMeadowReliefWallTestSource(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),file),file)),hash,'Exact prior wall/published/camera source guard '+file);
const {normalizeFieldstoneWallCacheSource}=require('./fieldstone-wall-cache-source-guard.cjs');
const {normalizePublishedCacheSource}=require('./published-world-import-source-guard.cjs');
const {normalizeAuthoredCameraSource}=require('./authored-camera-source-guard.cjs');
function reverseExactGroup(source,file,group,label){
 const states=[];
 for(const c of group.toReversed().filter(c=>c.file===file)){
  const count=value=>source.split(value).length-1;
  if(source.includes(c.after)){
   assert.equal(count(c.after),1,'Exactly one approved '+label+' '+file);
   const without=source.replace(c.after,'');
   assert.equal(without.split(c.before).length-1,0,'No mixed original/approved '+label+' '+file);
   states.push('approved');source=source.replace(c.after,c.before);
  }else{
   assert.equal(count(c.before),1,'Exact original or approved '+label+' '+file);
   states.push('original');
  }
 }
 assert.equal(new Set(states).size,1,'One complete original or approved '+label+' group '+file);
 return source;
}
// This projection precedes the unchanged wall, publication, camera and d5
// arch projections. It restores only the fifteen exact accepted literals,
// then checks every byte of all six complete approved owners. Previous import
// compatibility states remain subject to their unchanged strict guards.
// Load the reviewed runtime projection only when a function is called.
// Reviewed itself imports Grass, so eager loading here would create a cycle.
const reviewedRuntime=(source,file)=>require('./reviewed-riding-source-guard.cjs').normalizeReviewedRuntimeSource(source,file);
function normalizeGrassRibbonOwnSource(source,file){
 source=undoCourseTurfBladesSource(source,file);
 const row=contract.files[file];if(!row)return source;
 source=reverseExactGroup(source,file,changes,'ribbon/verge source');
 const projected=normalizeAuthoredCameraSource(normalizePublishedCacheSource(normalizeFieldstoneWallCacheSource(reviewedRuntime(source,file),file),file),file);
 assert.equal(sha(projected),row.priorPublishedCameraWallProjectionSHA256,'Entire d9 ribbon/verge owner restored through exact prior wall/published/camera guards '+file);
 return source;
}
function normalizeGrassRibbonSource(source,file){
 return normalizeGrassRibbonOwnSource(reviewedRuntime(source,file),file);
}
// Old observer bodies retain all old assertions and hashes. This exact
// adapter reversal is only for source-reading observers, never runtime.
function normalizeGrassRibbonTestSource(source,file){
 source=normalizeMeadowReliefWallTestSource(source,file);
 source=normalizeProgressionGuardSource(source,file);
 const hash=contract.testAdapterPreimages[file];if(!hash)return source;
 if(sha(source)===hash)return source; // Only the complete pinned original state bypasses dependent adapter steps.
 source=reverseExactGroup(source,file,adapters,'ribbon observer adapter');
 assert.equal(sha(source),hash,'Entire original accepted observer restored '+file);
 return source;
}
module.exports={normalizeGrassRibbonSource,normalizeGrassRibbonOwnSource,normalizeGrassRibbonTestSource};
