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
