// Advisory ground alignment for ordinary, unscored formal jumps. The course
// engine alone owns crossings, grades, time, player motion and earned progress.
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clip=(n,a,b)=>Math.max(a,Math.min(b,n));
const point=p=>Object.freeze({x:p.x,z:p.z});
const RECHECK=300, REACH=.85, ARRIVAL=.9, PREPARE_BACK=4.5, MARGIN=1, ALIGN=1.35;
function pointSegmentDistance(p,a,b){const x=b.x-a.x,z=b.z-a.z,l=x*x+z*z,t=l?clip(((p.x-a.x)*x+(p.z-a.z)*z)/l,0,1):0;return Math.hypot(p.x-a.x-t*x,p.z-a.z-t*z);}
function segmentDistance(a,b,c,d){
 const cross=(p,q,r)=>(q.x-p.x)*(r.z-p.z)-(q.z-p.z)*(r.x-p.x);
 if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;
 return Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));
}
export function formalFenceEligible(c){
 const j=c?.jumps?.[c.idx];
 return !!(c&&c.ev&&typeof c.ev.id==='string'&&c.ev.id.length&&!c.done&&!c.dressage&&!c.race&&!c.rush&&!c.xc&&!c.ev.dressage&&!c.ev.race&&!c.ev.rush&&!c.ev.xc&&!c.ev.gauntlet&&!c.ev.kind&&!c.ev.line&&
  c.ce?.kind==='jump'&&!c.ce.line&&Number.isInteger(c.idx)&&c.idx>=0&&Number.isInteger(c.ce.lap??1)&&(c.ce.lap??1)>0&&
  j?.kind==='fence'&&[j.x,j.z,j.rotY??0].every(Number.isFinite));
}
export function createFormalFenceGuidance({clearSegment=()=>false,isJumping=p=>(p.y||0)>.05||Math.abs(p.vy||0)>.05||(p.landT||0)>0}={}){
 let owner=null,fence=null,index=-1,lap=0,pose=[],refusals=0,path=Object.freeze([]),cursor=0,state=null,revision=0,checked=-Infinity,runIn=false,lastNow=-Infinity;
 let rail=null,railTarget=null,entry=null,checkMode=null,approachReady=false;
 const toWorld=(x,z)=>{const sn=Math.sin(fence.rotY||0),cs=Math.cos(fence.rotY||0);return {x:fence.x+x*cs+z*sn,z:fence.z-x*sn+z*cs};};
 const toLocal=p=>{const x=p.x-fence.x,z=p.z-fence.z,sn=Math.sin(fence.rotY||0),cs=Math.cos(fence.rotY||0);return {x:x*cs-z*sn,z:x*sn+z*cs};};
 function reset(){if(owner||state||path.length)revision++;owner=fence=null;index=-1;lap=0;pose=[];refusals=0;path=Object.freeze([]);cursor=0;state=null;checked=-Infinity;lastNow=-Infinity;runIn=false;rail=railTarget=entry=null;checkMode=null;approachReady=false;}
 function publish(phase,target,waypoints=[]){
  const hints={approach:'Approach behind fence',around:'Go around fence',lineup:'Face fence','run-in':'Ride straight to fence',blocked:'Find clear approach',landing:'Finish landing',paused:'Mount horse'};
  if(state?.phase===phase&&state.target?.x===target?.x&&state.target?.z===target?.z&&state.waypoints.length===waypoints.length&&state.waypoints.every((p,i)=>p===waypoints[i]))return state;
  revision++;state=Object.freeze({phase,hint:hints[phase],target:target?point(target):null,waypoints:Object.freeze([...waypoints]),courseId:owner.ev.id,index,lap,fence:Object.freeze({x:fence.x,z:fence.z,rotY:fence.rotY||0,kind:fence.kind}),revision});return state;
 }
 function worldClear(a,b){try{return finitePoint(a)&&finitePoint(b)&&clearSegment(point(a),point(b),owner,fence)===true;}catch{return false;}}
 function railClear(a,b){
  const start=pointSegmentDistance(a,...rail),margin=start<MARGIN?Math.max(.01,start-.001):MARGIN;
  // A post-skimming rider may move away, but never closer or through the rail.
  return start>.025&&segmentDistance(a,b,...rail)>=margin&&pointSegmentDistance(b,...rail)>=Math.min(start,MARGIN)-.001;
 }
 const groundClear=(a,b)=>railClear(a,b)&&worldClear(a,b);
 function validate(p){
  let from=p;
  for(const to of path.slice(cursor)){if(!groundClear(from,to))return false;from=to;}
  return !!path.length&&worldClear(path.at(-1),entry);
 }
 function choose(p,at){
  let best=null,bestCost=Infinity;
  const consider=points=>{
   let from=p,cost=0;const remaining=[];
   for(const to of points){if(distance(from,to)<.05)continue;if(!groundClear(from,to))return;cost+=distance(from,to);remaining.push(point(to));from=to;}
   if(!remaining.length)return;
   if(cost<bestCost){best=remaining;bestCost=cost;}
  };
  const goals=[8,11,6].map(back=>toWorld(0,-back)).filter(goal=>worldClear(goal,entry));
  for(const goal of goals)consider([goal]);
  if(!best)for(const goal of goals)for(const sign of [-1,1])for(const width of [3.5,5.5,8]){
   const local=toLocal(goal),side=sign*width;
   if(at.z<-.95)consider([toWorld(side,local.z),goal]);
   consider([toWorld(side,Math.max(2.7,at.z)),toWorld(side,local.z),goal]);
  }
  path=Object.freeze(best||[]);cursor=0;runIn=false;
 }
 function update(c,player,now=0){
  if(!formalFenceEligible(c)){reset();return null;}
  const j=c.jumps[c.idx],nextLap=c.ce.lap??1;
  if(c!==owner||j!==fence||c.idx!==index||nextLap!==lap||pose[0]!==j.x||pose[1]!==j.z||pose[2]!==j.rotY||now<lastNow){
   reset();owner=c;fence=j;index=c.idx;lap=nextLap;pose=[j.x,j.z,j.rotY];refusals=c.ce.refusals||0;
   rail=[toWorld(-1.8,0),toWorld(1.8,0)];railTarget=point(j);entry=point(toWorld(0,-1.15));
  }
  lastNow=now;
  if(!Number.isFinite(now)||now<0||!finitePoint(player?.pos)||!Number.isFinite(player.heading)||![player.y??0,player.vy??0,player.landT??0].every(Number.isFinite)){path=Object.freeze([]);runIn=false;approachReady=false;checked=-Infinity;checkMode=null;return publish('blocked',null);}
  let airborne=true;try{airborne=!!(player.flying||player.landing||isJumping(player));}catch{}
  if(airborne||player.onFoot){path=Object.freeze([]);cursor=0;runIn=false;approachReady=false;checked=-Infinity;checkMode=null;return publish(player.onFoot?'paused':'landing',null);}
  const p=player.pos,at=toLocal(p),count=c.ce.refusals||0;
  if(count!==refusals){refusals=count;path=Object.freeze([]);cursor=0;runIn=false;approachReady=false;checked=-Infinity;checkMode=null;}
  const arrivalZone=at.z<=-PREPARE_BACK&&Math.abs(at.x)<=1.25;
  if(!arrivalZone)approachReady=false;
  // Reaching a marker is a zone, not a mathematical plane. Retain that physical
  // arrival while the rider brakes and faces the fence; clearance and projected
  // crossing still have to pass before any run-in or jump cue is published.
  if(!approachReady&&arrivalZone&&checkMode==='route'&&path.length&&distance(p,path.at(-1))<=ARRIVAL){approachReady=true;checked=-Infinity;checkMode=null;}
  const angle=player.heading-(fence.rotY||0),forward=Math.cos(angle);
  const projected=forward>0?at.x-Math.tan(angle)*at.z:Infinity;
  const aligned=forward>.95&&Math.abs(projected)<ALIGN,behind=(at.z<=-6+1e-8&&Math.abs(at.x)<=1.25)||(approachReady&&arrivalZone);
  if(behind)approachReady=true;
  const mayRun=(behind||runIn)&&at.z<-1.05&&Math.abs(at.x)<1.8&&aligned;
  const due=now-checked>=RECHECK;
  if(mayRun){
   const geometry=railClear(p,entry);
   if(!geometry){runIn=false;path=Object.freeze([]);cursor=0;return publish('blocked',null);}
   if(due||checkMode!=='runin'){checked=now;checkMode='runin';runIn=groundClear(p,entry);}
   return runIn?publish('run-in',railTarget):publish('blocked',null);
  }else runIn=false;
  if(behind){
   if(due||checkMode!=='face'){checked=now;checkMode='face';path=groundClear(p,entry)?Object.freeze([entry]):Object.freeze([]);cursor=0;}
   return path.length?publish('lineup',railTarget,path):publish('blocked',null);
  }
  if(checkMode!=='route'){path=Object.freeze([]);cursor=0;}
  let advanced=false;
  while(cursor<path.length&&distance(p,path[cursor])<REACH){cursor++;advanced=true;}
  if(path.length&&cursor<path.length&&!railClear(p,path[cursor])){path=Object.freeze([]);cursor=0;return publish('blocked',null);}
  if(due||advanced||checkMode!=='route'){checked=now;checkMode='route';if(!path.length||cursor>=path.length||!validate(p))choose(p,at);}
  // A fresh/rebuilt route can discover that the rider is already in its final
  // arrival zone. Re-enter once for the same frozen observation to validate the
  // straight run-in now, rather than consuming and rechoosing that marker.
  if(arrivalZone&&path.length&&distance(p,path.at(-1))<=ARRIVAL){approachReady=true;checked=-Infinity;checkMode=null;return update(c,player,now);}
  const remaining=path.slice(cursor),target=remaining[0];
  return target?publish(remaining.length>1?'around':'approach',target,remaining):publish('blocked',null);
 }
 return {update,reset,snapshot:()=>state,get path(){return path;},get cursor(){return cursor;},get revision(){return revision;}};
}
