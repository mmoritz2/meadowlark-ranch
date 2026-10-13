const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const dir=path.join(__dirname,'fixtures/reviewed-riding-4e346b2');
const load=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
const contract=load('contract.json'),caches=load('cache-changes.json'),observers=load('observer-changes.json'),guide=load('guide-changes.json');
const sha=source=>crypto.createHash('sha256').update(source).digest('hex');
// The existing landscape/camera/cache guards and every old fixture keep their
// exact bytes. This outer compatibility layer reverses only reviewed riding
// and ribbon code before those complete-body preimages run.
for(const [file,hash]of Object.entries(contract.protectedGuardSHA256))assert.equal(sha(fs.readFileSync(path.join(__dirname,'..',file))),hash,'Unchanged incoming/original guard '+file);
const {normalizeRibbonAwardSource}=require('./ribbon-award-source-guard.cjs');
const {normalizeRidingDistanceSource}=require('./riding-distance-source-guard.cjs');
const {normalizeGrassArchSource}=require('./grass-arch-source-guard.cjs');
function normalizeReviewedCacheSource(source,file){
 if(file!=='ranch3d.html'&&file!=='assets/features/index.js')return source;
 const groups=new Map();
 for(const c of caches.filter(c=>c.file===file)){
  const owner=file==='ranch3d.html'?'FEATURES':c.before.slice(0,c.before.indexOf(' from '));
  const group=groups.get(owner)||{values:new Set(),replacements:new Map()};
  group.values.add(c.before);group.values.add(c.after);group.replacements.set(c.after,c.before);groups.set(owner,group);
 }
 // Exact earlier states remain legal subjects of historical positive checks.
 if(file==='ranch3d.html')groups.get('FEATURES').values.add("import {FEATURES} from './assets/features/index.js?v=starter-tack-2';");
 else groups.get('import * as seEvents').values.add("import * as seEvents from './se-events.js?v=event-training-1';");
 for(const [owner,{values,replacements}]of groups){
  const found=[...values].map(value=>({value,count:source.split(value).length-1}));
  assert.equal(found.reduce((n,row)=>n+row.count,0),1,'Exactly one original or declared reviewed-riding import '+file+': '+owner);
  const value=found.find(row=>row.count===1).value;
  if(replacements.has(value))source=source.replace(value,replacements.get(value));
 }
 return source;
}
function normalizeReviewedRuntimeSource(source,file){
 return normalizeReviewedCacheSource(normalizeRidingDistanceSource(normalizeRibbonAwardSource(source,file),file),file);
}
function normalizeReviewedWorldSource(source,file){
 return normalizeGrassArchSource(normalizeReviewedRuntimeSource(source,file),file);
}
function reverseExact(source,file,changes){
 for(const c of changes.toReversed().filter(c=>c.file===file)){
  assert.equal(source.split(c.after).length-1,c.occurrences,'Only exact reviewed observer/guide addition '+file+': '+c.after.slice(0,85));
  source=source.replace(c.after,c.before);
 }
 return source;
}
function normalizeReviewedObserverSource(source,file){
 const expected=contract.observerSHA256[file];if(!expected)return source;
 if(sha(source)!==expected)source=reverseExact(source,file,observers);
 assert.equal(sha(source),expected,'Whole unchanged incoming observer restored '+file);return source;
}
function normalizeReviewedGuideSource(source,file){
 if(file!=='assets/features/course-guide.js')return source;
 if(sha(source)!==contract.guideBeforeSHA256)source=reverseExact(source,file,guide);
 assert.equal(sha(source),contract.guideBeforeSHA256,'Whole pre-flat-race camera guide restored');return source;
}
module.exports={normalizeReviewedCacheSource,normalizeReviewedRuntimeSource,normalizeReviewedWorldSource,normalizeReviewedObserverSource,normalizeReviewedGuideSource,
 // Existing camera test supports an explicit additional main projection.
 normalizeGrassArchSource:normalizeReviewedWorldSource};
