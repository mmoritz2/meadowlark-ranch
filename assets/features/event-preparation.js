/* Read-only presentation of the selected event's existing entry rules and purse.
 * Actual entry still runs through the course gate; preparation adds no requirements. */
const STAT_NAMES={speed:'Speed',stamina:'Stamina',jump:'Jump',accel:'Acceleration',agility:'Agility'};
// A projection of the existing horse-level rules, never a reward or saved level.
// The live stat-cap callback determines when this horse can train further.
export function horseLevelPreparation({horse,entryLevel,training=[],trainingCaps={},statCapAtLevel,maxLevel=50}={}){
 const h=horse||{},level=h.level,xp=h.xp;
 if(!Number.isSafeInteger(level)||level<1||!Number.isSafeInteger(maxLevel)||maxLevel<level||level>=maxLevel||!Number.isFinite(xp)||xp<0||xp>=50+level*50||!Number.isSafeInteger(entryLevel)||entryLevel<1||entryLevel>maxLevel)return null;
 const milestones=[],capStats=[],breedBlocked=[];
 let targetLevel=Math.max(level,entryLevel);
 if(entryLevel>level)milestones.push(level+1);
 for(const row of training){
  const limits=trainingCaps[row.key]||{};
  if(!Number.isFinite(limits.level)||!Number.isFinite(limits.breed)||!Number.isFinite(row.target))continue;
  if(row.target>limits.breed){breedBlocked.push(row.label);continue;}
  if(row.target<=limits.level)continue;
  if(typeof statCapAtLevel!=='function')continue;
  let next=null,target=null;
  for(let candidate=level+1;candidate<=maxLevel;candidate++){
   let cap;try{cap=statCapAtLevel(candidate);}catch{return null;}
   if(!Number.isFinite(cap))return null;
   if(next===null&&cap>limits.level)next=candidate;
   if(cap>=row.target){target=candidate;break;}
  }
  if(target!==null){capStats.push(row.label);targetLevel=Math.max(targetLevel,target);milestones.push(next);}
 }
 if(!milestones.length)return null;
 const nextLevel=Math.min(...milestones),neededTo=target=>{
  let needed=-xp;for(let candidate=level;candidate<target;candidate++)needed+=50+candidate*50;return needed;
 };
 return {horseId:h.id,level,xp,xpNeed:50+level*50,nextLevel,nextXp:neededTo(nextLevel),targetLevel,targetXp:neededTo(targetLevel),capStats,breedBlocked};
}

export function eventPreparation({event,horse,difficulty,stats,gate,venueLock='',entryLock='',featured=false,trainingCaps={},statCapAtLevel,maxLevel=50,hasReadyAlternative=false}){

 const ev=event||{},h=horse||{},d=difficulty||{},levels=(ev.lvl||1)+(d.lvlAdd||0),level=h.level||1;
 const requirements=[{key:'level',have:level,need:levels,base:level,tack:0}]
  .concat(Object.entries(ev.req||{}).map(([key,need])=>({key,need,have:stats?.total?.[key]||0,base:stats?.base?.[key]||0,tack:stats?.tack?.[key]||0})))
  .map(row=>({...row,met:row.have>=row.need}));
 const missing=requirements.filter(row=>!row.met),statMissing=missing.filter(row=>row.key!=='level');
 // A tack bonus already contributes to entry, so only train the remaining base
 // deficit. Unknown caps never become a promise that another drill can help.
 const training=statMissing.filter(row=>STAT_NAMES[row.key]).map(row=>{
  const {key,base,tack,need}=row,label=STAT_NAMES[key],limits=trainingCaps[key]||{};
  const known=Number.isFinite(limits.level)&&Number.isFinite(limits.breed);
  const cap=known?Math.max(0,Math.min(limits.level,limits.breed)):null,target=Math.max(0,Math.ceil(need-tack));
  const canTrain=known&&base<Math.min(target,cap),canMeet=known&&target<=cap;
  let hint=known?(canTrain?'Train base '+label+' from '+base+' toward '+Math.min(target,cap)+'. ':'Base '+label+' '+base+' has no training room at the current cap of '+cap+'. '):'Check this horse’s training cap in Horse Overview. ';
  if(canMeet)hint+='Base '+target+(tack?' + '+tack+' equipped tack':'')+' meets this stat requirement.';
  else if(known&&target>limits.breed)hint+='This breed’s '+label+' ceiling is '+limits.breed+'; more horse levels cannot reach base '+target+'. Compare tack'+(hasReadyAlternative?' or choose a qualifying horse.':'.');
  else if(known)hint+='At Lv '+level+', the training cap is '+cap+'; this event needs base '+target+(tack?' with the current tack':'')+'. Raise the horse’s level or compare tack'+(hasReadyAlternative?', or choose a qualifying horse.':'.');
  return {...row,label,target,cap,canTrain,canMeet,hint};
 });
 const levelMissing=level<levels;
 const levelHint=levelMissing?'This event also needs horse Lv '+levels+'. Stat drills do not remove that level requirement. '+(hasReadyAlternative?'Choose a qualifying horse, or ride to earn horse XP.':'Ride this horse to earn horse XP.'):'';
 const growth=horseLevelPreparation({horse:h,entryLevel:levels,training,trainingCaps,statCapAtLevel,maxLevel});
 const reason=venueLock||entryLock||(gate?.ok===false?'Horse requirements are not met.':'')||
  (level<levels?(d.label||'This difficulty')+' opens at Lv '+levels:statMissing.length?'Train or equip tack for the missing stats.':'');
 return {ready:!reason&&gate?.ok!==false&&!missing.length,reason,requirements,training,levelMissing,levelHint,growth,hasReadyAlternative,
  purse:Math.round((ev.reward||0)*(d.rewMul??1)*(featured?1.5:1)),featured,
  judged:!!ev.dressage||ev.kind==='show',prepareTab:statMissing.length?'equipment':'horse',
  prepareHint:statMissing.length?(training.some(plan=>plan.canTrain)?'Use the training button to work on a missing stat, or compare equipped tack'+(hasReadyAlternative?' and choose a qualifying horse.':'.'):'Compare equipped tack and trained stats in Horse Overview.'):
   level<levels?(hasReadyAlternative?'Choose a qualifying horse, or keep riding to earn horse XP.':'Keep riding this horse to earn horse XP.'):
   'Review your horse and equipment, or train stats with food and riding.'};
}
