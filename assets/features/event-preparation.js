/* Read-only presentation of the selected event's existing entry rules and purse.
 * Actual entry still runs through the course gate; preparation adds no requirements. */
export function eventPreparation({event,horse,difficulty,stats,gate,venueLock='',entryLock='',featured=false}){
 const ev=event||{},h=horse||{},d=difficulty||{},levels=(ev.lvl||1)+(d.lvlAdd||0),level=h.level||1;
 const requirements=[{key:'level',have:level,need:levels,base:level,tack:0}]
  .concat(Object.entries(ev.req||{}).map(([key,need])=>({key,need,have:stats?.total?.[key]||0,base:stats?.base?.[key]||0,tack:stats?.tack?.[key]||0})))
  .map(row=>({...row,met:row.have>=row.need}));
 const missing=requirements.filter(row=>!row.met),statMissing=missing.filter(row=>row.key!=='level');
 const reason=venueLock||entryLock||(gate?.ok===false?'Horse requirements are not met.':'')||
  (level<levels?(d.label||'This difficulty')+' opens at Lv '+levels:statMissing.length?'Train or equip tack for the missing stats.':'');
 return {ready:!reason&&gate?.ok!==false&&!missing.length,reason,requirements,
  purse:Math.round((ev.reward||0)*(d.rewMul??1)*(featured?1.5:1)),featured,
  judged:!!ev.dressage||ev.kind==='show',prepareTab:statMissing.length?'equipment':'horse',
  prepareHint:statMissing.length?'Compare equipped tack and trained stats in Horse Overview.':
   level<levels?'Choose a horse with the required level, or keep riding to earn horse XP.':
   'Review your horse and equipment, or train stats with food and riding.'};
}
