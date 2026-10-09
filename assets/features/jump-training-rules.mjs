/* Actual jump training: directional rail crossing followed by a grounded landing.
 * No rendering, saves, rewards, game globals or changes to the horse's physics. */
const EPSILON=1e-8;
const freezePoint=p=>Object.freeze({...p});
const makeRail=(id,name,x,z,heading,guide)=>{
 const forward={x:Math.sin(heading),z:Math.cos(heading)};
 return Object.freeze({id,name,x,z,heading,width:4.8,height:.30,
  approach:freezePoint({x:x-forward.x*5.5,z:z-forward.z*5.5,label:'Straight approach'}),
  landing:freezePoint({x:x+forward.x*6,z:z+forward.z*6,label:'Land beyond the rail'}),
  guide:Object.freeze(guide.map(freezePoint))});
};
const checkpoints=Object.freeze([
 makeRail(0,'Rail 1',-6,-7,Math.PI/2,[{x:-12,z:-7,label:'Turn east'},{x:-11.5,z:-7,label:'Straight approach'}]),
 makeRail(1,'Rail 2',12,0,0,[{x:7,z:-7,label:'Continue beyond the first rail'},{x:12,z:-6,label:'Turn north'},{x:12,z:-5.5,label:'Straight approach'}]),
 makeRail(2,'Rail 3',2,11,-Math.PI/2,[{x:12,z:7,label:'Continue beyond the second rail'},{x:10,z:11,label:'Turn west'},{x:7.5,z:11,label:'Straight approach'}]),
 makeRail(3,'Rail 4',-12,2,Math.PI,[{x:-7,z:11,label:'Continue beyond the third rail'},{x:-12,z:9,label:'Turn south'},{x:-12,z:7.5,label:'Straight approach'}]),
]);
export const JUMP_TRAINING=Object.freeze({name:'Arena jump training',unit:'jumps',total:8,laps:2,timeLimit:120,
 railHeight:.30,railWidth:4.8,approachDistance:3,minCrossHeight:.20,groundHeight:.03,
 start:freezePoint({x:-17,z:-7,heading:Math.PI/2}),checkpoints});
export function getJumpObstacle(index){return Number.isInteger(index)&&index>=0&&index<JUMP_TRAINING.total?checkpoints[index%checkpoints.length]:null;}
const validPoint=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const coordinates=(p,rail)=>({forward:(p.x-rail.x)*Math.sin(rail.heading)+(p.z-rail.z)*Math.cos(rail.heading),side:(p.x-rail.x)*Math.cos(rail.heading)-(p.z-rail.z)*Math.sin(rail.heading)});
function snapshot(o){return validPoint(o?.position)&&Number.isFinite(o.height)&&Number.isFinite(o.speed)?{x:o.position.x,z:o.position.z,height:o.height,speed:o.speed,jumpActive:o.jumpActive===true,grounded:o.grounded===true}:null;}
const landed=p=>p.grounded&&!p.jumpActive&&p.height<=JUMP_TRAINING.groundHeight;
export function createJumpAttempt(index=0,position=null){
 if(!getJumpObstacle(index))throw new RangeError('Jump index must be between 0 and 7');
 return {index,phase:'approach',armed:false,pending:null,completed:false,elapsed:0,misses:0,lastReason:'',
  previous:validPoint(position)?{x:position.x,z:position.z,height:0,speed:0,jumpActive:false,grounded:false}:null,
  guideIndex:index===0?1:0,retryGuide:null,retryGuideIndex:0};
}
function aroundRail(rail,position){
 const c=coordinates(position,rail),side=c.side<0?-1:1,width=rail.width/2+2.4;
 const at=(forward,label)=>freezePoint({x:rail.x+Math.sin(rail.heading)*forward+Math.cos(rail.heading)*side*width,z:rail.z+Math.cos(rail.heading)*forward-Math.sin(rail.heading)*side*width,label});
 return [at(Math.max(3,Math.min(6,c.forward)),'Go around the end of the rail'),at(-5.5,'Return behind the rail'),rail.approach];
}
function resetProof(attempt,position,reason){
 attempt.armed=false;attempt.pending=null;attempt.phase='retry';attempt.lastReason=reason;
 attempt.retryGuide=aroundRail(getJumpObstacle(attempt.index),position);attempt.retryGuideIndex=0;
}
function miss(attempt,position,reason){
 if(attempt.phase==='retry')return false;
 attempt.misses++;resetProof(attempt,position,reason);return true;
}
function nearSegment(point,a,b,radius=2){
 if(!a)return distance(point,b)<=radius;
 const dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz;
 const t=len?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/len)):0;
 return Math.hypot(point.x-a.x-dx*t,point.z-a.z-dz*t)<=radius;
}
function advanceGuide(attempt,previous,current){
 const rail=getJumpObstacle(attempt.index);
 if(attempt.phase==='retry'){
  while(attempt.retryGuideIndex<(attempt.retryGuide?.length||0)&&nearSegment(attempt.retryGuide[attempt.retryGuideIndex],previous,current))attempt.retryGuideIndex++;
 }else if(attempt.phase!=='landing'&&attempt.phase!=='complete'){
  while(attempt.guideIndex<rail.guide.length&&nearSegment(rail.guide[attempt.guideIndex],previous,current))attempt.guideIndex++;
 }
}
export function jumpTrainingCue(attempt){
 if(!attempt)return 'Follow the arena jump route.';
 if(attempt.phase==='complete')return 'Jump and landing complete.';
 if(attempt.phase==='landing')return 'Keep riding forward and land beyond the rail.';
 if(attempt.phase==='retry')return (attempt.lastReason||'That pass did not count.')+' Go around the rail and approach again.';
 if(attempt.armed)return 'Follow the approach, jump over the rail, then land beyond it.';
 return 'Approach the next rail straight on from at least 3 metres away.';
}
export function getJumpGuide(index,attempt,position){
 const rail=getJumpObstacle(index);if(!rail)return null;
 if(attempt?.phase==='landing'||attempt?.phase==='complete')return {...rail.landing};
 if(attempt?.phase==='retry')return {...(attempt.retryGuide?.[attempt.retryGuideIndex]||rail.approach)};
 const point=rail.guide[attempt?.guideIndex??(index===0?1:0)];
 return point?{...point}:{x:rail.x,z:rail.z,label:'Jump over '+rail.name.toLowerCase()};
}
export function observeJumpAttempt(attempt,observation={}){
 if(!attempt||!getJumpObstacle(attempt.index))throw new TypeError('A valid jump attempt is required');
 const result={credited:false,missed:false,invalid:false,paused:observation.paused===true,phase:attempt.phase,cue:'',crossing:null};
 const finish=()=>({...result,phase:attempt.phase,cue:jumpTrainingCue(attempt)});
 const previous=attempt.previous,current=snapshot(observation);attempt.previous=current;
 if(attempt.completed)return finish();
 if(!current){attempt.armed=false;attempt.pending=null;attempt.phase='approach';result.invalid=true;return finish();}
 if(result.paused){
  // Native idle/jump clips can continue behind a menu; only horizontal movement breaks the route proof.
  if(previous&&distance(previous,current)>1e-6)resetProof(attempt,current,'Return to a safe approach after moving while paused.');
  return finish();
 }
 const dt=observation.dt,step=previous?distance(previous,current):0;
 // A stationary zero-time render frame preserves proof but cannot advance training.
 if(dt===0&&step<=1e-6)return finish();
 const maxStep=Number.isFinite(dt)&&dt>0?Math.max(.5,(Math.max(Math.abs(previous?.speed||0),Math.abs(current.speed))+2)*Math.min(.25,dt)*1.5+.25):0;
 if(!Number.isFinite(dt)||dt<=0||dt>.25||current.height<-.03||previous&&step>maxStep){
  result.invalid=true;resetProof(attempt,current,'Ride back for a continuous, straight approach.');return finish();
 }
 attempt.elapsed+=dt;
 advanceGuide(attempt,previous,current);
 const rail=getJumpObstacle(attempt.index),now=coordinates(current,rail),before=previous?coordinates(previous,rail):null;
 if(landed(current)&&now.forward<=-JUMP_TRAINING.approachDistance+EPSILON&&Math.abs(now.side)<=rail.width/2+1.5){
  if(attempt.phase==='retry'){attempt.retryGuide=null;attempt.retryGuideIndex=0;attempt.guideIndex=rail.guide.length;}
  attempt.armed=true;attempt.phase='ready';attempt.lastReason='';
 }
 if(attempt.pending){
  if(now.forward<0){result.missed=miss(attempt,current,'Stay beyond the rail until you land.');}
  else if(landed(current)){
   if(now.forward>1e-6){attempt.pending=null;attempt.completed=true;attempt.phase='complete';result.credited=true;}
   else result.missed=miss(attempt,current,'Land beyond the rail.');
  }
  return finish();
 }
 if(before&&before.forward<0&&now.forward>=0){
  if(attempt.phase==='retry')return finish();
  const t=-before.forward/(now.forward-before.forward),side=before.side+(now.side-before.side)*t;
  const height=previous.height+(current.height-previous.height)*t;
  result.crossing={x:previous.x+(current.x-previous.x)*t,z:previous.z+(current.z-previous.z)*t,height,t};
  let reason='';
  if(!attempt.armed)reason='Begin with a straight approach at least 3 metres behind the rail.';
  else if(Math.abs(side)>rail.width/2+EPSILON)reason='Jump between the two standards.';
  else if(!(previous.jumpActive||current.jumpActive)||height<JUMP_TRAINING.minCrossHeight-EPSILON)reason='Leave the ground and jump over the rail.';
  if(reason){result.missed=miss(attempt,current,reason);return finish();}
  attempt.pending=result.crossing;attempt.phase='landing';attempt.armed=false;
  // A continuous step may contain both a valid airborne crossing and its landing.
  if(landed(current)&&now.forward>1e-6){attempt.pending=null;attempt.completed=true;attempt.phase='complete';result.credited=true;}
 }
 return finish();
}
