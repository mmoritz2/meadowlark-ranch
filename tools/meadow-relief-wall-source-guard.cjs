const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {normalizeActivityIncomingSource,normalizeActivityIncomingObserverSource}=require('./activity-landscape-source-guard.cjs');
const dir=path.join(__dirname,'fixtures/meadow-relief-wall-b1a73b1'),load=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
const contract=load('contract.json'),changes=load('source-changes.json'),adapters=load('test-adapter-changes.json');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const {undoCourseTurfBladesSource,normalizeCourseTurfBladesTestSource}=require('./course-turf-blades-source-guard.cjs');
for(const[file,hash]of Object.entries(contract.dependencySHA256))assert.equal(sha(normalizeActivityIncomingObserverSource(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),file)),hash,'Exact preceding projection dependency '+file);
const {normalizeFieldstoneWallCacheSource:F}=require('./fieldstone-wall-cache-source-guard.cjs'),{normalizePublishedCacheSource:P}=require('./published-world-import-source-guard.cjs'),{normalizeAuthoredCameraSource:C}=require('./authored-camera-source-guard.cjs');
const {normalizeRidingDistanceSource:distance}=require('./riding-distance-source-guard.cjs'),{normalizeRibbonAwardSource:awards}=require('./ribbon-award-source-guard.cjs');
const caches=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/reviewed-riding-4e346b2/cache-changes.json'),'utf8'));
const grass=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/grass-ribbon-d9b168e/source-changes.json'),'utf8'));
const functions=load('prior-projection-functions.json');
const {normalizeLashCacheSource:lashCaches}=require('./lash-cache-source-guard.cjs');
const {normalizeProgressionLoopCacheSource:progressCaches}=require('./progression-loop-cache-source-guard.cjs'),{normalizeProgressionHintsSource:progressHints}=require('./progression-hints-source-guard.cjs');
// These two exact prior function bodies are frozen from b1, rather than loading
// the Reviewed/Grass modules recursively while they initialize. They retain
// their complete prior import groups and exact literal reversal assertions.
const prior=new Function('assert','caches','distance','awards','grass','progressCaches','progressHints','lashCaches',functions.cache+functions.reverse+`\nreturn(source,file)=>{source=lashCaches(source,file);source=progressHints(progressCaches(source,file),file);source=normalizeReviewedCacheSource(distance(awards(source,file),file),file);if(grass.some(c=>c.file===file))source=reverseExactGroup(source,file,grass,'prior grass source');return source;};`)(assert,caches,distance,awards,grass,progressCaches,progressHints,lashCaches);
const progression=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/progression-loop-243dbfb/contract.json'),'utf8')).changes;
const lashChanges=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/lash-cache-df065bd/contract.json'),'utf8')).changes;
const featuresBeforeAliases=new Set([...caches,...progression,...lashChanges].filter(c=>c.file==='ranch3d.html'&&c.before.includes("'./assets/features/index.js?v=")).flatMap(c=>[c.before,c.after]));
featuresBeforeAliases.add("import {FEATURES} from './assets/features/index.js?v=starter-tack-2';");
const fieldContract=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/fieldstone-wall-a78ed79/contract.json'),'utf8'));
for(const field of ['before','after'])featuresBeforeAliases.add(fieldContract.files['ranch3d.html'].change[field]);
function undo(source,file,group,label,compatibility=false){
 const relevant=group.filter(c=>c.file===file);if(!relevant.length)return source;
 const states=[];
 for(const c of relevant.toReversed()){
  const count=s=>source.split(s).length-1;
  if(source.includes(c.after)){
   assert.equal(count(c.after),1,'One exact accepted '+label+' '+file);
   assert.equal(source.replace(c.after,'').split(c.before).length-1,0,'No mixed original/accepted '+label+' '+file);
   source=source.replace(c.after,c.before);states.push('accepted');
  }else{
   let values=[c.before];
   const url=value=>value.match(/'[^']+\?v=[^']+'/)?.[0]||value;
   if(compatibility&&file==='ranch3d.html'&&c.before.includes('/features/index.js?v='))values=[...new Set([c.before,...[...featuresBeforeAliases].map(url)])];
   else if(compatibility&&fieldContract.files[file]&&c.before===url(fieldContract.files[file].change.after)){const row=fieldContract.files[file];values=[...new Set([c.before,url(row.change.before),...row.compatibilityAliases.map(url)])];}
   assert.equal(values.reduce((sum,v)=>sum+count(v),0),1,'One exact original/earlier approved '+label+' '+file);states.push('original');
  }
 }
 assert.equal(new Set(states).size,1,'One complete original or accepted '+label+' state '+file);return source;
}
// Used at Reviewed's entry before its physical FEATURES cache is parsed.
// This strictly undoes the eighteen exact new literals; the caller's unchanged
// whole-body chain and the full source gate below still reject unrelated drift.
function undoMeadowReliefWallSource(source,file){source=undoCourseTurfBladesSource(source,file);return undo(normalizeActivityIncomingSource(source,file),file,changes,'meadow/wall source',true);}
function normalizeMeadowReliefWallSource(source,file){
 source=undoCourseTurfBladesSource(source,file);
 const row=contract.files[file];if(!row)return source;
 source=undoMeadowReliefWallSource(source,file);
 assert.equal(sha(C(P(F(prior(source,file),file),file),file)),row.priorCanonicalSHA256,'Entire b1 material/wall/cache owner restored through exact prior source logic '+file);
 return source;
}
function normalizeMeadowReliefWallTestSource(source,file){
 source=normalizeCourseTurfBladesTestSource(source,file);
 source=normalizeActivityIncomingObserverSource(source,file);
 const hash=contract.testAdapterPreimages[file];if(!hash)return source;
 if(sha(source)===hash||(contract.historicalTestSHA256[file]||[]).includes(sha(source)))return source; // Earlier states require their exact complete source SHA.
 source=undo(source,file,adapters,'meadow/wall observer',false);
 assert.equal(sha(source),hash,'Entire original b1 observer/guard restored '+file);return source;
}
module.exports={normalizeMeadowReliefWallSource,undoMeadowReliefWallSource,normalizeMeadowReliefWallTestSource};
