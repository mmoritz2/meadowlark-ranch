// A permanent riding journey credits existing activity records. Claims are separate
// from activity progress and from gear ownership, so selling a prize cannot reissue it.
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
const rush=id=>({kind:'rush',id});
const roundup=mode=>({kind:'roundup',mode});
const goal=(id,label,metric,target,action)=>({id,label,metric,target,action});
const gear=(slot,legendary=false)=>({rarity:legendary?'Legendary':'Rare',set:legendary?'Aurora':'Silver',slot,style:'western',
 name:`Leaping ${legendary?'Aurora':'Silver'} ${{pad:'Pad',bridle:'Bridle',shoes:'Shoes',saddle:'Saddle'}[slot]} of ${legendary?'Agility':'Stamina'}`,
 bonus:legendary?{jump:5,agility:5,stamina:2}:{jump:3,stamina:1}});
export const JOURNEY_CHAPTERS=freeze([
 {id:'first-partners',number:1,name:'First Partners',description:'Find your stride and earn a lost horse’s trust.',reward:{coins:150,gear:gear('pad')},goals:[
  goal('clover','Bring Clover home','rescues',1,{kind:'rescue',id:'clover'}),goal('pasture','Finish Pasture Dash','pasturePlays',1,rush('rush-pasture'))]},
 {id:'steady-hands',number:2,name:'Steady Hands',description:'Read the herd and keep a clean riding rhythm.',reward:{coins:200,gear:gear('bridle')},goals:[
  goal('three-home','Pen all 3 horses in one beginner roundup','beginnerPenned',3,roundup('beginner')),goal('clean-chain','Build a 4-obstacle chain in any Ranch Rush','bestCombo',4,rush('rush-pasture'))]},
 {id:'river-rhythm',number:3,name:'River Rhythm',description:'Take the river course and ride for a silver medal.',reward:{coins:250,gear:gear('shoes')},goals:[
  goal('river','Finish River Run','riverPlays',1,rush('rush-river')),goal('silver','Earn silver or gold in any Ranch Rush','bestRushMedal',2,rush('rush-pasture'))]},
 {id:'trail-partners',number:4,name:'Trail Partners',description:'Ride the longer trail and bring the whole herd home.',reward:{coins:350,gear:gear('saddle')},goals:[
  goal('trail','Finish Trailblazer','trailPlays',1,rush('rush-trail')),goal('five-home','Pen all 5 horses in one full roundup','fullPenned',5,roundup('full'))]},
 {id:'meadowlark-champion',number:5,name:'Meadowlark Champion',description:'Put everything together: four gold medals and a champion’s saddle.',reward:{coins:750,gear:gear('saddle',true)},goals:[
  goal('pasture-gold','Earn gold in Pasture Dash','pastureGold',1,rush('rush-pasture')),goal('river-gold','Earn gold in River Run','riverGold',1,rush('rush-river')),
  goal('trail-gold','Earn gold in Trailblazer','trailGold',1,rush('rush-trail')),goal('roundup-gold','Earn gold in the 5-horse roundup','fullGold',1,roundup('full'))]},
]);
const byId=new Map(JOURNEY_CHAPTERS.map(c=>[c.id,c]));
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const number=v=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,v):0;
const count=(v,max=1000000)=>Math.min(max,Math.floor(number(v)));
const rank=medal=>medal==='gold'?3:medal==='silver'?2:medal==='bronze'?1:0;
const list=value=>Array.isArray(value)?value.filter(item=>item&&typeof item==='object'&&!Array.isArray(item)):[];
export const journeyGearId=id=>'journey-'+id;
export function sanitizeJourneySave(value){
 const s=object(value),claimed={};
 for(const chapter of JOURNEY_CHAPTERS){const raw=object(object(s.claimed)[chapter.id]);
  if(raw.gearId!==journeyGearId(chapter.id)||!Number.isFinite(raw.at)||raw.at<=0)continue;
  claimed[chapter.id]={at:raw.at,gearId:journeyGearId(chapter.id)};
 }
 const lastClaimId=typeof s.lastClaimId==='string'&&Object.hasOwn(claimed,s.lastClaimId)?s.lastClaimId:null;
 return {version:1,claimed,lastClaimId};
}
export function journeyMetrics(save){
 const s=object(save),r=s.ranchRush?.version===1?object(s.ranchRush.records):{};
 const record=id=>{const v=object(r[id]);return count(v.plays)?v:{};};
 const p=record('rush-pasture'),v=record('rush-river'),t=record('rush-trail'),runs=[p,v,t];
 const b=object(s.roundupBest?.beginner),f=object(s.roundupBest?.full);
 return {rescues:count(s.rescueRides?.completions),pasturePlays:count(p.plays),riverPlays:count(v.plays),trailPlays:count(t.plays),
  bestCombo:Math.max(...runs.map(r=>count(r.bestCombo,32))),bestRushMedal:Math.max(...runs.map(r=>rank(r.medal))),
  beginnerPenned:count(b.plays)?count(b.penned,3):0,fullPenned:count(f.plays)?count(f.penned,5):0,
  pastureGold:rank(p.medal)===3?1:0,riverGold:rank(v.medal)===3?1:0,trailGold:rank(t.medal)===3?1:0,
  fullGold:count(f.plays)&&count(f.penned,5)===5&&rank(f.medal)===3?1:0};
}
function receiptFor(chapter){return {id:chapter.id,name:chapter.name,coins:chapter.reward.coins,gearId:journeyGearId(chapter.id),gearName:chapter.reward.gear.name,bonus:{...chapter.reward.gear.bonus}};}
export function journeySnapshot(save,riddenHorseId=null){
 const s=object(save),state=sanitizeJourneySave(s.riderJourney),metrics=journeyMetrics(s),inventory=list(s.tack),horses=list(s.horses);
 const ridden=horses.find(h=>h.id===riddenHorseId);let unlocked=true;
 const chapters=JOURNEY_CHAPTERS.map(c=>{
  const goals=c.goals.map(g=>({id:g.id,label:g.label,current:Math.min(g.target,metrics[g.metric]||0),target:g.target,done:(metrics[g.metric]||0)>=g.target,action:{...g.action}}));
  const claimed=!!state.claimed[c.id],status=claimed?'claimed':!unlocked?'locked':goals.every(g=>g.done)?'ready':'active';
  if(!claimed)unlocked=false;
  const gearId=journeyGearId(c.id),item=inventory.find(i=>i.id===gearId&&i.slot===c.reward.gear.slot);
  return {id:c.id,number:c.number,name:c.name,description:c.description,goals,reward:{coins:c.reward.coins,gear:{...c.reward.gear,bonus:{...c.reward.gear.bonus}}},status,gearId,owned:!!item,equipped:!!item&&ridden?.gear?.[item.slot]===gearId};
 });
 const current=chapters.find(c=>c.status!=='claimed')||null,claimedCount=chapters.filter(c=>c.status==='claimed').length;
 const nextAction=current?(current.status==='ready'?{kind:'claim',id:current.id}:current.goals.find(g=>!g.done)?.action||null):null;
 return {chapters,current,claimedCount,complete:claimedCount===JOURNEY_CHAPTERS.length,
  title:claimedCount===JOURNEY_CHAPTERS.length?'Meadowlark Champion':null,
  lastClaim:state.lastClaimId?receiptFor(byId.get(state.lastClaimId)):null,nextAction};
}
// Both callbacks must mutate only the supplied save. The caller's save transaction
// persists inventory, money, and the receipt together, without nested save writes.
export function applyJourneyClaim(save,id,{makeGear,payReward,now=Date.now()}={}){
 const chapter=byId.get(id),current=journeySnapshot(save).chapters.find(c=>c.id===id);
 if(!chapter||current?.status!=='ready'||!Number.isFinite(now)||now<=0)return null;
 const inventory=list(save.tack),gearId=journeyGearId(id),existing=inventory.find(i=>i.id===gearId);
 const made=existing||makeGear(chapter.reward.gear);
 if(!made||made.slot!==chapter.reward.gear.slot||made.rarity!==chapter.reward.gear.rarity||made.set!==chapter.reward.gear.set)return null;
 if(!existing){save.tack=inventory;save.tack.push({...made,id:gearId,journeyChapter:id});}
 payReward(save,{c:chapter.reward.coins});
 save.riderJourney=sanitizeJourneySave(save.riderJourney);save.riderJourney.claimed[id]={at:now,gearId};save.riderJourney.lastClaimId=id;
 return receiptFor(chapter);
}
export function equipJourneyReward(save,id,horseId){
 const chapter=byId.get(id),state=sanitizeJourneySave(save.riderJourney);
 if(!chapter||!state.claimed[id])return null;
 const gearId=journeyGearId(id),item=list(save.tack).find(i=>i.id===gearId&&i.slot===chapter.reward.gear.slot),horse=list(save.horses).find(h=>h.id===horseId);
 if(!item||!horse)return null;
 for(const other of list(save.horses))for(const [slot,worn]of Object.entries(object(other.gear)))if(worn===gearId)delete other.gear[slot];
 horse.gear=object(horse.gear);horse.gear[item.slot]=gearId;
 return {id,gearId,horseId,slot:item.slot};
}
