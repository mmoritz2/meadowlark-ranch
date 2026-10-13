const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {normalizeFormalApproachResumeSource,normalizeFormalApproachResumeObserverSource,normalizeFormalApproachResumeFixtureChanges}=require('./formal-approach-resume-source-guard.cjs');
const {normalizeProgrammeRegroupSource,normalizeProgrammeRegroupObserverSource,normalizeProgrammeRegroupFixtureChanges}=require('./programme-regroup-source-guard.cjs');
const {normalizeHorseTrainingSource,normalizeHorseTrainingObserverSource,normalizeHorseTrainingFixtureChanges}=require('./horse-training-source-guard.cjs');
const fixture='tools/fixtures/activity-landscape-6a82f3f/contract.json';
const text=fs.readFileSync(path.join(__dirname,'..',fixture),'utf8'),contract=JSON.parse(text);
const activity=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/activity-runtime-df065bd/contract.json'),'utf8'));
const sha=source=>crypto.createHash('sha256').update(source).digest('hex');
// Leaf-only: never load the mutually initializing Meadow/Reviewed/Grass guards.
// All projections are explicit, independently pinned parent source views.
function reverse(source,file,changes,label){
 for(const c of changes.toReversed().filter(c=>!c.file||c.file===file)){
  assert.equal(source.split(c.after).length-1,c.occurrences,'One exact '+label+' literal '+file+': '+c.after.slice(0,85));
  if(c.before)assert.equal(source.replace(c.after,'').split(c.before).length-1,0,'No mixed parent/'+label+' literal '+file);
  source=source.replace(c.after,c.before);
 }
 return source;
}
function normalizeActivityIncomingSource(source,file){
 source=normalizeFormalApproachResumeSource(source,file);
 source=normalizeProgrammeRegroupSource(source,file);
 source=normalizeHorseTrainingSource(source,file);
 const row=contract.files[file];if(!row)return source;
 let group=contract.toIncoming.filter(c=>c.file===file);
 // The activity parent is also an exact supported historical subject. Its
 // parent FEATURES tag reaches df rather than the incoming wall/lash owner.
 if(file==='ranch3d.html'&&!group.some(c=>source.includes(c.after)))group=activity.changes.filter(c=>c.file===file);
 if(!group.some(c=>source.includes(c.after)))return source;
 source=reverse(source,file,group,'merged activity');
 assert([row.incomingSHA256,row.baselineSHA256].includes(sha(source)),'Complete incoming or df owner restored '+file);return source;
}
function normalizeActivityParentSource(source,file){
 source=normalizeFormalApproachResumeSource(source,file);
 source=normalizeProgrammeRegroupSource(source,file);
 source=normalizeHorseTrainingSource(source,file);
 const row=contract.files[file],group=contract.toActivity.filter(c=>c.file===file);if(!row||!group.length||sha(source)===row.activitySHA256)return source;
 if(!group.some(c=>source.includes(c.after)))return source;
 source=reverse(source,file,group,'incoming wall/lash');
 assert.equal(sha(source),row.activitySHA256,'Complete frozen activity owner restored '+file);return source;
}
function observer(source,file,view){
 const row=contract.observers[file]?.[view];if(!row)return source;
 const hash=sha(source);if(hash===row.beforeSHA256)return source;
 if(hash===row.afterSHA256){source=reverse(source,file,row.changes,'merged observer');assert.equal(sha(source),row.beforeSHA256,'Complete '+view+' observer restored '+file);return source;}
 // Exact older complete subjects retain their original downstream pin checks.
 if((contract.historicalObserverSHA256[file]||[]).includes(hash))return source;
 source=reverse(source,file,row.changes,'merged observer');assert.equal(sha(source),row.beforeSHA256,'Complete '+view+' observer restored '+file);return source;
}
function normalizeActivityIncomingObserverSource(source,file){
 source=normalizeFormalApproachResumeObserverSource(source,file);
 source=normalizeProgrammeRegroupObserverSource(source,file);
 source=normalizeHorseTrainingObserverSource(source,file);
 const prior=activity.observers[file];
 if(prior&&sha(source)===prior.afterSHA256){
  source=reverse(source,file,activity.observerChanges.filter(c=>c.file===file),'original activity observer');
  assert.equal(sha(source),prior.beforeSHA256,'Complete df activity observer restored '+file);return source;
 }
 return observer(source,file,'incoming');
}
function normalizeActivityParentObserverSource(source,file){
 source=normalizeFormalApproachResumeObserverSource(source,file);
 source=normalizeProgrammeRegroupObserverSource(source,file);
 source=normalizeHorseTrainingObserverSource(source,file);return observer(source,file,'activity');}
// The original assertion still rejects any original fixture drift. The only
// added files omitted from its diff are the exact new parent declarations and
// this explicitly named new composition contract; unknown additions remain.
function normalizeActivityFixtureChanges(diff,baseline){
 diff=normalizeFormalApproachResumeFixtureChanges(diff);
 diff=normalizeProgrammeRegroupFixtureChanges(diff);
 diff=normalizeHorseTrainingFixtureChanges(diff);
 assert.equal(baseline,contract.baseline,'Exact original fixture baseline');
 const lines=diff.trim()?diff.trim().split('\n'):[];assert.equal(new Set(lines).size,lines.length,'No duplicate fixture diff rows');
 const allowed={...contract.approvedAddedFixtures,[fixture]:sha(text)};
 const rest=lines.filter(file=>{
  if(!Object.hasOwn(allowed,file))return true;
  assert.equal(sha(fs.readFileSync(path.join(__dirname,'..',file))),allowed[file],'Exact declared added fixture '+file);return false;
 });return rest.length?rest.join('\n')+'\n':'';
}
module.exports={normalizeActivityIncomingSource,normalizeActivityParentSource,normalizeActivityIncomingObserverSource,normalizeActivityParentObserverSource,normalizeActivityFixtureChanges};
