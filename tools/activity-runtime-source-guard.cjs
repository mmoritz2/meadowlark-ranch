const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const contract=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/activity-runtime-df065bd/contract.json'),'utf8'));
const sha=source=>crypto.createHash('sha256').update(source).digest('hex');
// This outer layer reverses only reviewed activity cache and region literals.
// Historical subjects with no new literals continue into their unchanged
// whole-source/import guards; unknown versions are never stripped generically.
function normalizeActivityRuntimeSource(source,file){
 const changes=contract.changes.filter(c=>c.file===file);
 if(!changes.some(c=>source.includes(c.after)))return source;
 for(const c of changes.toReversed()){
  assert.equal(source.split(c.after).length-1,c.occurrences,'Exactly one complete reviewed activity/region literal '+file+': '+c.after.slice(0,90));
  const without=source.replace(c.after,'');
  if(c.before)assert.equal(without.split(c.before).length-1,0,'No mixed original/reviewed activity/region literal '+file);
  source=source.replace(c.after,c.before);
 }
 // New world/story behavior has no cache aliases of its own. Reconstruct the
 // entire pinned df source before older historical body checks are applied.
 if(file==='assets/features/world.js'||file==='assets/features/story-quests.js')assert.equal(sha(source),contract.files[file].beforeSHA256,'Complete pre-region source restored '+file);
 return source;
}
function normalizeActivityObserverSource(source,file){
 const row=contract.observers[file];if(!row||sha(source)===row.beforeSHA256)return source;
 for(const c of contract.observerChanges.toReversed().filter(c=>c.file===file)){
  assert.equal(source.split(c.after).length-1,c.occurrences,'Exact outer activity observer compatibility '+file);
  source=source.replace(c.after,c.before);
 }
 assert.equal(sha(source),row.beforeSHA256,'Complete unchanged prior observer restored '+file);return source;
}
module.exports={normalizeActivityRuntimeSource,normalizeActivityObserverSource};
