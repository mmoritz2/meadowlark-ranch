// Rescue rewards are earned by a completed physical escort. These rules keep a replay,
// a repeated finish callback, and a second adoption click from granting duplicates.
export const RESCUE_DEFINITION=Object.freeze({id:'clover',name:'Bring Clover Home',
 description:'Follow the hoofprints, earn Clover’s trust, and lead her safely home.',minutes:'2–3 min',
 reward:Object.freeze({c:180,xp:60}),adoption:Object.freeze({name:'Clover',breed:'pinto'}),
 route:Object.freeze([[-60,16],[-105,14],[-105,-41],[-70,-41],[-42,-34],[-40,2],[-60,16]].map(Object.freeze))});
const count=n=>Number.isFinite(n)?Math.max(0,Math.min(1000000,Math.floor(n))):0;
export function sanitizeRescueSave(value){
 const s=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const completions=count(s.completions),t=Number.isFinite(s.bestTime)&&s.bestTime>0?s.bestTime:null;
 return {version:1,completions,bestTime:completions?t:null,adopted:!!s.adopted,
  lastRunId:typeof s.lastRunId==='string'?s.lastRunId.slice(0,100):'',
  adoptedHorseId:typeof s.adoptedHorseId==='number'||typeof s.adoptedHorseId==='string'?s.adoptedHorseId:null};
}
export function recordRescueFinish(value,run){
 const save=sanitizeRescueSave(value);
 if(!run||typeof run.runId!=='string'||!run.runId||run.runId===save.lastRunId||run.stage!=='escort'||run.clues!==2||run.returnStep!==3||!Number.isFinite(run.elapsed)||run.elapsed<8)return {save,recorded:false};
 const time=Math.round(run.elapsed*100)/100,newBest=save.bestTime===null||time<save.bestTime,firstCompletion=save.completions===0;
 save.completions++;save.lastRunId=run.runId;if(newBest)save.bestTime=time;
 return {save,recorded:true,result:{id:RESCUE_DEFINITION.id,name:RESCUE_DEFINITION.name,runId:run.runId,
  time,pay:{...RESCUE_DEFINITION.reward},newBest,firstCompletion,canAdopt:!save.adopted}};
}
export function canAdoptClover(value){const s=sanitizeRescueSave(value);return s.completions>0&&!s.adopted;}
export const RESCUE_APPROACH=Object.freeze({reach:5.5,stopSpeed:1.2,spookDistance:9,spookSpeed:5,settleSeconds:.65,retreatRadius:14,retreatSpeed:4.6});
export function rescueInteraction({distance,speed,retreating=false,settling=0,blocked=false}={}){
 const cooldown=Number.isFinite(settling)?Math.max(0,settling):RESCUE_APPROACH.settleSeconds;
 const inReach=Number.isFinite(distance)&&distance<RESCUE_APPROACH.reach;
 let status='ready',reason='Clover has settled. Reassure her, then lead her home.';
 if(blocked){status='paused';reason='Return to riding to reassure Clover.';}
 else if(retreating){status='retreating';reason='Clover is stepping away. Give her room to settle.';}
 else if(!inReach){status='far';reason='Walk toward Clover, then stop beside her.';}
 else if(!Number.isFinite(speed)||Math.abs(speed)>RESCUE_APPROACH.spookSpeed){status='too-fast';reason='Too fast — slow down and give Clover room.';}
 else if(Math.abs(speed)>=RESCUE_APPROACH.stopSpeed){status='moving';reason='Come to a gentle stop before reassuring Clover.';}
 else if(cooldown>0){status='settling';reason='Stay still for a moment while Clover settles.';}
 return {eligible:status==='ready',inReach,status,reason,label:'Reassure Clover',cooldown};
}
export function insideRescueRetreat(point,anchor){
 return !!point&&!!anchor&&[point.x,point.z,anchor.x,anchor.z].every(Number.isFinite)&&
  point.x>=-108&&point.x<=-35&&point.z>=-43&&point.z<=23&&Math.hypot(point.x-anchor.x,point.z-anchor.z)<=RESCUE_APPROACH.retreatRadius;
}
// Ranked escape choices stay in the home pasture. The live controller also checks
// every segment against its actual fences/props before and after steering.
export function rescueRetreatCandidates(horse,rider,anchor){
 if(!horse||!rider||![horse.x,horse.z,rider.x,rider.z].every(Number.isFinite))return [];
 const distance=Math.hypot(horse.x-rider.x,horse.z-rider.z),away=distance>.01?Math.atan2(horse.x-rider.x,horse.z-rider.z):0;
 const candidates=[];
 for(const radius of [8,5,3])for(const turn of [0,Math.PI/6,-Math.PI/6,Math.PI/3,-Math.PI/3,Math.PI/2,-Math.PI/2]){
  const p={x:horse.x+Math.sin(away+turn)*radius,z:horse.z+Math.cos(away+turn)*radius};
  const separation=Math.hypot(p.x-rider.x,p.z-rider.z);
  if(insideRescueRetreat(p,anchor)&&separation>distance+.5)candidates.push({...p,separation});
 }
 return candidates.sort((a,b)=>b.separation-a.separation).map(({x,z})=>({x,z}));
}
export function calmAfter(calm,{distance,speed,dt}){
 if(!Number.isFinite(dt)||dt<=0||dt>.25)return Math.max(0,Math.min(100,calm||0));
 const delta=distance<RESCUE_APPROACH.spookDistance&&speed>RESCUE_APPROACH.spookSpeed?-35*dt:distance<RESCUE_APPROACH.reach&&speed<RESCUE_APPROACH.stopSpeed?40*dt:-3*dt;
 // Patient positioning visibly calms her, but trust needs the rider's explicit
 // reassurance. Waiting alone can never move the mission into its escort stage.
 return Math.max(0,Math.min(60,(calm||0)+delta));
}
export function isTravelJump(distance,dt,speed=0){
 return !Number.isFinite(distance)||distance>Math.max(8,(Math.abs(speed)+12)*Math.min(.25,Math.max(0,dt))*2);
}
