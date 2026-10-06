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
export function calmAfter(calm,{distance,speed,dt}){
 if(!Number.isFinite(dt)||dt<=0||dt>.25)return Math.max(0,Math.min(100,calm||0));
 const delta=distance<9&&speed>5?-35*dt:distance<5.5&&speed<1.6?25*dt:-3*dt;
 return Math.max(0,Math.min(100,(calm||0)+delta));
}
export function isTravelJump(distance,dt,speed=0){
 return !Number.isFinite(distance)||distance>Math.max(8,(Math.abs(speed)+12)*Math.min(.25,Math.max(0,dt))*2);
}
