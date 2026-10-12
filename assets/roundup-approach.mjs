// A pressure marker is a playable position, not a nearest-free-point request.
// Keep every candidate behind the horse and comfortably inside its flight zone.
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
function distanceToSegment(p,a,b){
 const x=b.x-a.x,z=b.z-a.z,l=x*x+z*z,t=l?Math.max(0,Math.min(1,((p.x-a.x)*x+(p.z-a.z)*z)/l)):0;
 return Math.hypot(p.x-a.x-t*x,p.z-a.z-t*z);
}
function segmentDistance(a,b,c,d){
 const cross=(p,q,r)=>(q.x-p.x)*(r.z-p.z)-(q.z-p.z)*(r.x-p.x);
 if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;
 return Math.min(distanceToSegment(a,c,d),distanceToSegment(b,c,d),distanceToSegment(c,a,b),distanceToSegment(d,a,b));
}
export function chooseRoundupApproach({horse,pen,rider,bounds,colliders=[],walls=[],pressureRadius=12,clearPoint}={}){
 if(!finite(horse)||!finite(pen)||!finite(rider)||![bounds?.x1,bounds?.x2,bounds?.z1,bounds?.z2,pressureRadius].every(Number.isFinite)||pressureRadius<9)return null;
 const dx=pen.x-horse.x,dz=pen.z-horse.z,len=Math.hypot(dx,dz);if(len<.001)return null;
 const ux=dx/len,uz=dz/len,pad=1,pathPad=.6;
 if(Math.hypot(rider.x-horse.x,rider.z-horse.z)>160)return null;
 // Restrict scans to geometry that can affect a candidate or its approach.
 const near=colliders.filter(c=>finite(c)&&Number.isFinite(c.r)&&c.r>=0&&c.x+c.r>=Math.min(horse.x-12,rider.x)-1&&c.x-c.r<=Math.max(horse.x+12,rider.x)+1&&c.z+c.r>=Math.min(horse.z-12,rider.z)-1&&c.z-c.r<=Math.max(horse.z+12,rider.z)+1);
 const rails=walls.filter(w=>[w?.x1,w?.x2,w?.z1,w?.z2].every(Number.isFinite)).map(w=>[{x:w.x1,z:w.z1},{x:w.x2,z:w.z2}]);
 function open(p){
  if(p.x<bounds.x1+pad||p.x>bounds.x2-pad||p.z<bounds.z1+pad||p.z>bounds.z2-pad)return false;
  if(near.some(c=>Math.hypot(p.x-c.x,p.z-c.z)<c.r+pad))return false;
  if(rails.some(([a,b])=>distanceToSegment(p,a,b)<pad))return false;
  return true;
 }
 function routeOpen(p){
  // A rider already touching a collider may move away from it, but never closer
  // or through it. This preserves escape from the player's .55m contact margin.
  if(near.some(c=>distanceToSegment(c,rider,p)<Math.min(c.r+pathPad,Math.hypot(c.x-rider.x,c.z-rider.z))-.001))return false;
  if(rails.some(([a,b])=>segmentDistance(rider,p,a,b)<Math.min(pathPad,distanceToSegment(rider,a,b))-.001))return false;
  return true;
 }
 const candidates=[];
 for(const angle of [0,.2617993878,-.2617993878,.5235987756,-.5235987756,.7853981634,-.7853981634]){
  const cos=Math.cos(angle),sin=Math.sin(angle);
  for(const distance of [9,8.25,9.75,7.5,10.5]){
   if(distance>pressureRadius-1.5)continue;
   const p={x:horse.x+(-ux*cos-uz*sin)*distance,z:horse.z+(-uz*cos+ux*sin)*distance,distance,alignment:cos};
   if(!open(p)||!routeOpen(p))continue;
   p.cost=Math.abs(angle)*3+Math.abs(distance-9)+Math.hypot(p.x-rider.x,p.z-rider.z)*.025;candidates.push(p);
  }
 }
 candidates.sort((a,b)=>a.cost-b.cost);
 for(const p of candidates){
  if(clearPoint){
   if(!clearPoint(p.x,p.z))continue;
   const steps=Math.ceil(Math.hypot(p.x-rider.x,p.z-rider.z)/.75);let clear=true;
   for(let i=1;i<steps;i++){const t=i/steps;if(!clearPoint(rider.x+(p.x-rider.x)*t,rider.z+(p.z-rider.z)*t)){clear=false;break;}}
   if(!clear)continue;
  }
  return {x:p.x,z:p.z,distance:p.distance,alignment:p.alignment};
 }
 return null;
}


// Shared by the bounded planner and cached-leg validation: generated endpoints
// have one metre clearance; rider travel retains the existing .6m corridor.
function riderRouteClearance({horse,rider,bounds,colliders,walls,solidOpen}){
 function outsideHorse(a,b){
  const initial=a===rider,minimum=initial?Math.min(6,Math.hypot(a.x-horse.x,a.z-horse.z)):6;
  // If already too close, the first leg can only retreat from the horse.
  return distanceToSegment(horse,a,b)>=minimum-1e-8;
 }
 // Use the entire search rectangle, not only the old direct-ray bounding box:
 // a detour must also see props beyond the horse/rider's original corridor.
 const circles=colliders.filter(c=>finite(c)&&Number.isFinite(c.r)&&c.r>=0&&
  c.x+c.r+1>=bounds.x1&&c.x-c.r-1<=bounds.x2&&c.z+c.r+1>=bounds.z1&&c.z-c.r-1<=bounds.z2);
 const rails=walls.filter(w=>[w?.x1,w?.x2,w?.z1,w?.z2].every(Number.isFinite)).map(w=>[{x:w.x1,z:w.z1},{x:w.x2,z:w.z2}]);
 function open(p){
  return p.x>=bounds.x1+1&&p.x<=bounds.x2-1&&p.z>=bounds.z1+1&&p.z<=bounds.z2-1&&Math.hypot(p.x-horse.x,p.z-horse.z)>=6&&
   !circles.some(c=>Math.hypot(p.x-c.x,p.z-c.z)<c.r+1)&&
   !rails.some(([a,b])=>distanceToSegment(p,a,b)<1)&&solidOpen(p.x,p.z);
 }
 function clear(a,b){
  // Only the first point can be at the rider's smaller collision contact
  // margin. Every generated waypoint has the full one-metre endpoint margin.
  const initial=a===rider;if(!outsideHorse(a,b))return false;
  if(circles.some(c=>distanceToSegment(c,a,b)<(initial?Math.min(c.r+.6,Math.hypot(c.x-a.x,c.z-a.z)):c.r+.6)-.001))return false;
  if(rails.some(([c,d])=>segmentDistance(a,b,c,d)<(initial?Math.min(.6,distanceToSegment(a,c,d)):.6)-.001))return false;
  const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.75));
  for(let i=1;i<=steps;i++){const t=i/steps;if(!solidOpen(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))return false;}
  return true;
 }
 return {open,clear,outsideHorse};
}

// Validate a cached next waypoint from the rider's current position. A rider at
// physical contact may retreat, but no cached leg can cut through scenery or
// enter the horse's six-metre spook zone.
export function roundupRiderLegClear({from,to,horse,bounds,colliders=[],walls=[],clearPoint}={}){
 if(!finite(from)||!finite(to)||!finite(horse)||!Array.isArray(colliders)||!Array.isArray(walls)||
    ![bounds?.x1,bounds?.x2,bounds?.z1,bounds?.z2].every(Number.isFinite)||
    bounds.x2<=bounds.x1||bounds.z2<=bounds.z1||Math.hypot(to.x-from.x,to.z-from.z)>160||
    from.x<bounds.x1||from.x>bounds.x2||from.z<bounds.z1||from.z>bounds.z2)return false;
 const checks=riderRouteClearance({horse,rider:from,bounds,colliders,walls,solidOpen:(x,z)=>!clearPoint||!!clearPoint(x,z)});
 return checks.open(to)&&checks.clear(from,to);
}

// A direct pressure marker remains the first choice. When scenery blocks that
// ray, find a bounded rider route without changing horse movement or clearance.
// The caller may cache these waypoints, but must revalidate as the horse moves.
export function chooseRoundupRoute(options={}){
 const {horse,pen,rider,bounds,colliders=[],walls=[],pressureRadius=12,clearPoint}=options;
 if(!finite(horse)||!finite(pen)||!finite(rider)||!Array.isArray(colliders)||!Array.isArray(walls)||
    ![bounds?.x1,bounds?.x2,bounds?.z1,bounds?.z2,pressureRadius].every(Number.isFinite)||
    bounds.x2<=bounds.x1||bounds.z2<=bounds.z1||pressureRadius<9||Math.hypot(rider.x-horse.x,rider.z-horse.z)>160||
    rider.x<bounds.x1||rider.x>bounds.x2||rider.z<bounds.z1||rider.z>bounds.z2)return null;
 const MAX_NODES=1200,MAX_EXPANDED=700,MAX_SOLID_CHECKS=12000,STEP=2.5;
 let solidChecks=0,exhausted=false;
 const solidCache=new Map();
 function solidOpen(x,z){
  if(!clearPoint)return true;
  const key=x+','+z;if(solidCache.has(key))return solidCache.get(key);
  if(solidChecks>=MAX_SOLID_CHECKS){exhausted=true;return false;}
  solidChecks++;const yes=!!clearPoint(x,z);solidCache.set(key,yes);return yes;
 }
 function result(points,pressurePoint){
  const waypoints=points.map(p=>Object.freeze({x:p.x,z:p.z}));let length=0,from=rider;
  for(const p of waypoints){length+=Math.hypot(p.x-from.x,p.z-from.z);from=p;}
  return Object.freeze({waypoints:Object.freeze(waypoints),target:waypoints[0],pressurePoint:Object.freeze({x:pressurePoint.x,z:pressurePoint.z,distance:pressurePoint.distance,alignment:pressurePoint.alignment}),detour:waypoints.length>1,length});
 }
 const {open,clear,outsideHorse}=riderRouteClearance({horse,rider,bounds,colliders,walls,solidOpen});
 const direct=chooseRoundupApproach({...options,clearPoint:solidOpen});
 if(exhausted)return null;
 if(direct&&outsideHorse(rider,direct))return result([direct],direct);
 const dx=pen.x-horse.x,dz=pen.z-horse.z,len=Math.hypot(dx,dz);if(len<.001)return null;
 const ux=dx/len,uz=dz/len;
 const goals=[];
 for(const angle of [0,.2617993878,-.2617993878,.5235987756,-.5235987756,.7853981634,-.7853981634])for(const distance of [9,8.25,9.75,7.5,10.5]){
  if(distance>pressureRadius-1.5)continue;const cos=Math.cos(angle),sin=Math.sin(angle);
  const p={x:horse.x+(-ux*cos-uz*sin)*distance,z:horse.z+(-uz*cos+ux*sin)*distance,distance,alignment:cos,preference:Math.abs(angle)*3+Math.abs(distance-9)};
  if(open(p))goals.push(p);
 }
 if(!goals.length||exhausted)return null;
 // A lower-ranked direct candidate can avoid the horse even when the legacy
 // preferred marker would ask the rider to cut through its flight zone.
 const directGoals=goals.slice().sort((a,b)=>(a.preference+Math.hypot(a.x-rider.x,a.z-rider.z)*.025)-(b.preference+Math.hypot(b.x-rider.x,b.z-rider.z)*.025));
 for(const goal of directGoals){const safe=clear(rider,goal);if(exhausted)return null;if(safe)return result([goal],goal);}
 const nx=Math.floor((bounds.x2-bounds.x1-2)/STEP)+1,nz=Math.floor((bounds.z2-bounds.z1-2)/STEP)+1;
 if(nx<1||nz<1||nx*nz>MAX_NODES)return null;
 const heuristic=p=>Math.min(...goals.map(g=>Math.hypot(g.x-p.x,g.z-p.z)+g.preference));
 const nodes=Array.from({length:nx*nz},(_,id)=>({id,x:bounds.x1+1+Math.floor(id/nz)*STEP,z:bounds.z1+1+(id%nz)*STEP,g:Infinity,parent:-1,closed:false,open:null}));
 const queue=[];
 function push(node,g,parent){
  if(g>=node.g)return;node.g=g;node.parent=parent;
  const entry={id:node.id,g,f:g+heuristic(node)};let i=queue.length;queue.push(entry);
  while(i){const parentIndex=(i-1)>>1;if(queue[parentIndex].f<=entry.f)break;queue[i]=queue[parentIndex];i=parentIndex;}queue[i]=entry;
 }
 function pop(){
  const first=queue[0],tail=queue.pop();if(queue.length){let i=0;
   while(i*2+1<queue.length){let child=i*2+1;if(child+1<queue.length&&queue[child+1].f<queue[child].f)child++;if(queue[child].f>=tail.f)break;queue[i]=queue[child];i=child;}queue[i]=tail;
  }return first;
 }
 const isOpen=node=>node.open??(node.open=open(node));
 for(const node of nodes){const d=Math.hypot(node.x-rider.x,node.z-rider.z);if(d<=STEP*3&&isOpen(node)&&clear(rider,node))push(node,d,-1);}
 const edges=new Map(),neighbours=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
 let best=null,expanded=0;
 while(queue.length&&!exhausted&&expanded<MAX_EXPANDED){
  const entry=pop(),node=nodes[entry.id];if(node.closed||entry.g!==node.g)continue;
  if(best&&entry.f>=best.cost)break;node.closed=true;expanded++;
  for(const goal of goals){const d=Math.hypot(goal.x-node.x,goal.z-node.z),cost=node.g+d+goal.preference;
   if(d<=STEP*3&&(!best||cost<best.cost)&&clear(node,goal))best={node:node.id,goal,cost};
  }
  const ix=Math.floor(node.id/nz),iz=node.id%nz;
  for(const [ox,oz] of neighbours){const x=ix+ox,z=iz+oz;if(x<0||x>=nx||z<0||z>=nz)continue;
   const next=nodes[x*nz+z];if(next.closed||!isOpen(next))continue;
   const key=Math.min(node.id,next.id)+':'+Math.max(node.id,next.id);let safe=edges.get(key);
   if(safe===undefined){safe=clear(node,next);edges.set(key,safe);}
   if(safe)push(next,node.g+Math.hypot(next.x-node.x,next.z-node.z),node.id);
  }
 }
 if(!best||exhausted)return null;
 const route=[best.goal];for(let id=best.node;id!==-1;id=nodes[id].parent)route.unshift(nodes[id]);
 // Remove needless grid corners only when the complete replacement leg passes
 // exactly the same clearance checks. This keeps the displayed route readable.
 const smooth=[];let from=rider,start=0;
 while(start<route.length&&!exhausted){let far=start;
  for(let i=route.length-1;i>start;i--)if(clear(from,route[i])){far=i;break;}
  if(!clear(from,route[far]))return null;smooth.push(route[far]);from=route[far];start=far+1;
 }
 return exhausted?null:result(smooth,best.goal);
}

// Roundup horses retain the shared .7m contact footprint. Unlike the general
// follower's single whisker, this checks the whole proposed short movement.
export function roundupPathClear({from,to,bounds,colliders=[],walls=[],clearPoint,pad=.7}={}){
 if(!finite(from)||!finite(to)||![bounds?.x1,bounds?.x2,bounds?.z1,bounds?.z2].every(Number.isFinite))return false;
 if(to.x<bounds.x1+2||to.x>bounds.x2-2||to.z<bounds.z1+2||to.z>bounds.z2-2)return false;
 for(const c of colliders){
  if(!finite(c)||!Number.isFinite(c.r)||c.r<0)continue;
  if(distanceToSegment(c,from,to)<Math.min(c.r+pad,Math.hypot(c.x-from.x,c.z-from.z))-.0001)return false;
 }
 for(const w of walls){
  if(![w?.x1,w?.z1,w?.x2,w?.z2].every(Number.isFinite))continue;
  const a={x:w.x1,z:w.z1},b={x:w.x2,z:w.z2};
  if(segmentDistance(from,to,a,b)<Math.min(pad,distanceToSegment(from,a,b))-.0001)return false;
 }
 if(clearPoint){
  const distance=Math.hypot(to.x-from.x,to.z-from.z);if(distance>8)return false;
  const steps=Math.max(1,Math.ceil(distance/.4));
  for(let i=1;i<=steps;i++){const t=i/steps;if(!clearPoint(from.x+(to.x-from.x)*t,from.z+(to.z-from.z)*t,pad))return false;}
 }
 return true;
}
export function chooseRoundupEscape({horse,rider,pen,bounds,colliders=[],walls=[],clearPoint,side=0}={}){
 if(!finite(horse)||!finite(rider)||!finite(pen))return null;
 const away=Math.atan2(horse.x-rider.x,horse.z-rider.z),goal=Math.atan2(pen.x-horse.x,pen.z-horse.z);
 const clear=(heading,length)=>roundupPathClear({from:horse,to:{x:horse.x+Math.sin(heading)*length,z:horse.z+Math.cos(heading)*length},bounds,colliders,walls,clearPoint});
 if(clear(away,3))return {heading:away,side:0,detour:false};
 // Prefer the existing bypass side to avoid left/right oscillation at a trunk.
 // Every candidate stays in the away-facing half-plane, never driving at rider.
 const candidates=[];
 for(const sign of [1,-1])for(const angle of [Math.PI/12,Math.PI/6,Math.PI/4,Math.PI/3,Math.PI*5/12,Math.PI/2]){
  const heading=away+sign*angle;
  candidates.push({heading,side:sign,cost:angle+(side&&side!==sign?.65:0)+.15*(1-Math.cos(heading-goal))});
 }
 candidates.sort((a,b)=>a.cost-b.cost);
 for(const length of [3,1.5,.6])for(const p of candidates)if(clear(p.heading,length))return {heading:p.heading,side:p.side,detour:true};
 return null;
}
