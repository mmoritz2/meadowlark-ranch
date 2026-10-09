export const POST_DEFINITION=Object.freeze({id:'cottonwood',managed:'cottonwood-post',name:'Cottonwood Post Run',
 reward:Object.freeze({c:450,g:2,p:28}),starPoints:6,reach:4.5,stopSpeed:1.2,pineRadius:6,
 pines:Object.freeze({x:-30,z:-58,label:'Hollowpeak Pines'}),
 stops:Object.freeze([[0,5],[-30,-58],[47,-50],[0,5]].map(Object.freeze))});
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const number=(v,max=1e9)=>Number.isFinite(v)?Math.max(0,Math.min(max,v)):0;
const count=v=>Math.floor(number(v));
const runId=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v)?v:'';
const round=v=>Math.round(v*100)/100;
export const postDistance=(a,b)=>a&&b&&[a.x,a.z,b.x,b.z].every(Number.isFinite)?Math.hypot(a.x-b.x,a.z-b.z):Infinity;
// Guide pins are advice. Handoffs and the Pines passage remain the only progress gates.
export function createPostGuide(points=[]){return {index:0,points:points.map(p=>({...p}))};}
export function advancePostGuide(guide,position,{paused=false,ready=true}={}){
 if(!guide||paused||!ready)return false;const previous=guide.index;
 while(guide.index<guide.points.length&&postDistance(position,guide.points[guide.index])<(guide.points[guide.index].radius||3))guide.index++;
 return previous!==guide.index;
}
export function isSoloPostRide(r){return !!r&&r.soloExpedition===true&&!r.clubRideId&&r.exped===POST_DEFINITION.id&&
 Array.isArray(r.pts)&&r.pts.length===4&&r.pts.every((p,i)=>Array.isArray(p)&&p[1]===POST_DEFINITION.stops[i][0]&&p[2]===POST_DEFINITION.stops[i][1]);}
export function createPostRun({id,at,position,horseId,horseName}={}){
 if(!runId(id)||!Number.isFinite(at)||at<=0||!Number.isFinite(postDistance(position,position)))return null;
 return {runId:id,at,stage:'collect',elapsed:0,distance:0,picked:false,pines:false,exchanged:false,returned:false,
  horseId:horseId??null,horseName:String(horseName||'Your horse').slice(0,80),previous:{x:position.x,z:position.z}};
}
export function postInteraction(run,{distance,speed,blocked=false,ready=true}={}){
 const action={collect:'collect',deliver:'exchange',return:'return',savePending:'save'}[run?.stage]||null;
 const label={collect:'Collect post',exchange:'Exchange post',return:'Deliver reply',save:'Retry save'}[action]||'Follow the trail';
 const inReach=!!action&&action!=='save'&&Number.isFinite(distance)&&distance<POST_DEFINITION.reach;
 let reason='',status='ready';
 if(!action){status='riding';reason='Ride through the pines with the post.';}
 else if(blocked){status='paused';reason='Return to riding to continue your delivery.';}
 else if(action==='save'){reason='Your delivery is complete. Retry saving your reward.';}
 else if(!ready){status='unready';reason='Mount your horse and let it finish getting ready.';}
 else if(!inReach){status='far';reason=action==='exchange'?'Ride to Ada in Cottonwood.':'Ride to Grandpa Wren beside the arena.';}
 else if(!Number.isFinite(speed)||Math.abs(speed)>=POST_DEFINITION.stopSpeed){status='moving';reason='Come to a gentle stop to hand over the post.';}
 else reason=action==='collect'?'Wren has a pouch of post for Ada.':action==='exchange'?'Give Ada the post and collect her reply.':'Give Wren Ada’s reply to complete your ride.';
 return {action,label,inReach,eligible:!!action&&status==='ready',status,reason};
}
// Only the controller supplies observations; elapsed time never changes during a save retry.
export function observePostRun(run,{position,dt,speed=0,paused=false,ready=true}={}){
 if(!run||run.stage==='savePending')return {changed:false};
 const step=postDistance(run.previous,position),raw=Number.isFinite(dt)?Math.max(0,dt):0;
 run.previous={x:position?.x,z:position?.z};
 if(!Number.isFinite(step)||step>Math.max(8,(Math.abs(speed)+12)*Math.min(.25,raw)*2))return {invalid:true};
 if(paused||!ready)return {changed:false};
 const seconds=Math.min(.25,raw);run.elapsed+=seconds;
 if(run.stage!=='collect')run.distance+=step;
 if(run.stage==='pines'&&postDistance(position,POST_DEFINITION.pines)<POST_DEFINITION.pineRadius){run.pines=true;run.stage='deliver';return {changed:true};}
 return {changed:false};
}
export function actOnPostRun(run,observation){
 const interaction=postInteraction(run,observation);if(!interaction.eligible||interaction.action==='save')return false;
 if(run.stage==='collect'){run.picked=true;run.stage='pines';run.elapsed=0;run.distance=0;}
 else if(run.stage==='deliver'&&run.picked&&run.pines){run.exchanged=true;run.stage='return';}
 else if(run.stage==='return'&&run.picked&&run.pines&&run.exchanged){run.returned=true;run.stage='savePending';}
 else return false;
 return true;
}
export function postFinishProof(run){
 if(!runId(run?.runId)||!Number.isFinite(run.at)||run.at<=0||run.stage!=='savePending'||
  !run.picked||!run.pines||!run.exchanged||!run.returned||!Number.isFinite(run.elapsed)||run.elapsed<=0||
  !Number.isFinite(run.distance)||run.distance<100)return null;
 return Object.freeze({runId:run.runId,at:run.at,time:round(run.elapsed),distance:round(run.distance),horseId:run.horseId,horseName:run.horseName});
}
function cleanReceipt(value){
 const r=object(value);if(!runId(r.runId)||!Number.isFinite(r.at)||r.at<=0||!Number.isFinite(r.time)||r.time<=0||!Number.isFinite(r.distance)||r.distance<100)return null;
 return {runId:r.runId,at:r.at,id:POST_DEFINITION.id,name:POST_DEFINITION.name,time:round(r.time),distance:round(r.distance),
  horseId:typeof r.horseId==='string'||typeof r.horseId==='number'?r.horseId:null,horseName:String(r.horseName||'Your horse').slice(0,80),
  pay:{...POST_DEFINITION.reward},starPoints:POST_DEFINITION.starPoints,newBest:!!r.newBest,completions:count(r.completions)};
}
export function sanitizePostSave(value){
 const s=object(value),receipts=[];for(const raw of Array.isArray(s.receipts)?s.receipts:[]){const r=cleanReceipt(raw);if(r&&!receipts.some(x=>x.runId===r.runId))receipts.push(r);}
 receipts.sort((a,b)=>a.at-b.at);let closedBefore=number(s.closedBefore,Number.MAX_SAFE_INTEGER);
 while(receipts.length>16)closedBefore=Math.max(closedBefore,receipts.shift().at);
 const completions=Math.max(count(s.completions),receipts.length),bestTime=Number.isFinite(s.bestTime)&&s.bestTime>0?round(s.bestTime):null;
 return {version:1,completions,bestTime:completions?bestTime:null,closedBefore,receipts};
}
// Receipts are bounded. The eviction watermark rejects old proofs permanently,
// instead of forgetting an old run and making its reward claimable again.
export function savePostFinish(storage,proof,pay){
 if(!cleanReceipt(proof))return {ok:false,reason:'The completed delivery could not be verified.'};
 let reason='Your reward could not be saved. Keep this tab open and retry.';
 try{storage.sync(s=>{
  if(!s)return;const state=sanitizePostSave(s.cottonwoodPost);
  if(state.receipts.some(r=>r.runId===proof.runId))return;
  if(proof.at<=state.closedBefore){reason='This old delivery has already been closed.';return;}
  const result={...proof,id:POST_DEFINITION.id,name:POST_DEFINITION.name,pay:{...POST_DEFINITION.reward},starPoints:POST_DEFINITION.starPoints,
   newBest:state.bestTime===null||proof.time<state.bestTime,completions:state.completions+1};
  pay(s,result.pay,POST_DEFINITION.starPoints);
  s.stats=object(s.stats);s.stats.trails=count(s.stats.trails)+1;s.stats.expeditions=count(s.stats.expeditions)+1;
  s.expDone=object(s.expDone);s.expDone.cottonwood=count(s.expDone.cottonwood)+1;
  state.completions=result.completions;if(result.newBest)state.bestTime=result.time;state.receipts.push(result);
  s.cottonwoodPost=sanitizePostSave(state);
 });}catch(_){}
 let saved;try{saved=storage.fresh();}catch(_){}
 const state=sanitizePostSave(saved?.cottonwoodPost),result=state.receipts.find(r=>r.runId===proof.runId&&r.at===proof.at&&r.time===proof.time&&r.distance===proof.distance);
 if(!saved||!result||!(saved.stats?.trails>0)||!(saved.stats?.expeditions>0)||!(saved.expDone?.cottonwood>0))return {ok:false,reason};
 return {ok:true,result,saved};
}
