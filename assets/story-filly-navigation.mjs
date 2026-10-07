// Isolated story-filly navigation. Existing obstacle arrays are read once per
// step; precise owners use the world's existing spatial solid query. No scene,
// resource, registry, RNG or actor mutation is performed here.
export const STORY_FILLY_FOOTPRINT=Object.freeze({
 probes:Object.freeze([-.6,-.1,.4,.9].map(z=>Object.freeze({x:0,z}))),
 radius:.39,bottom:.08,top:1.78,
 basis:'Four .39m probes cover 16,159 native grey skinned bind vertices at scene scale .8786846541304494 and story scale .8606896551724138; maximum nearest-probe bind radius .3428444m. Native bench-front body bounds also measured on 4fdc662.'
});
const TAU=Math.PI*2,wrap=a=>{if(Math.abs(a)>TAU*8)a=((a+Math.PI)%TAU+TAU)%TAU-Math.PI;while(a>Math.PI)a-=TAU;while(a<-Math.PI)a+=TAU;return a;};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const finitePose=p=>p&&[p.x,p.z,p.heading].every(Number.isFinite);
const segmentDistance=(x,z,w)=>{const dx=w.x2-w.x1,dz=w.z2-w.z1,l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-w.x1)*dx+(z-w.z1)*dz)/l)):0;return Math.hypot(x-w.x1-dx*t,z-w.z1-dz*t);};
function context(world,poses,shape,options={}){
 if(typeof world?.groundH!=='function')throw new TypeError('Filly navigation requires groundH');
 const extent=Math.max(...shape.probes.map(p=>Math.hypot(p.x,p.z)))+shape.radius;
 const reach=extent+Math.max(6,options.movementReach||0),nearCircle=c=>poses.some(p=>Math.hypot(p.x-c.x,p.z-c.z)<=c.r+reach);
 const circles=[],walls=[];let circleScans=0,wallScans=0;
 for(const c of world.colliders||[]){circleScans++;if(c&&!c.precise&&[c.x,c.z,c.r].every(Number.isFinite)&&c.r>=0&&nearCircle(c))circles.push(c);}
 for(const w of world.walls||[]){wallScans++;if(w&&[w.x1,w.z1,w.x2,w.z2].every(Number.isFinite)&&poses.some(p=>segmentDistance(p.x,p.z,w)<=reach))walls.push(w);}
 return {world,shape,circles,walls,extent,limit:options.maxProbeTests??640,steps:options.maxSubsteps??128,
  stats:{circleScans,wallScans,circles:circles.length,walls:walls.length,probeTests:0,solidQueries:0,sweepSteps:0,budgetExhausted:false}};
}
function clear(p,q){
 if(!finitePose(p))return false;
 const h=q.world.groundH(p.x,p.z);if(!Number.isFinite(h))return false;
 const c=Math.cos(p.heading),s=Math.sin(p.heading),r=q.shape.radius;
 for(const v of q.shape.probes){
  if(++q.stats.probeTests>q.limit){q.stats.budgetExhausted=true;return false;}
  const x=p.x+c*v.x+s*v.z,z=p.z-s*v.x+c*v.z;
  if(q.world.allowsPose&&q.world.allowsPose(x,z)===false)return false;
  for(const obstacle of q.circles){
   const top=obstacle.topY??(Number.isFinite(obstacle.height)?q.world.groundH(obstacle.x,obstacle.z)+obstacle.height:Infinity);
   if(Number.isFinite(top)&&h+q.shape.bottom>=top)continue;
   if(Math.hypot(x-obstacle.x,z-obstacle.z)<obstacle.r+r)return false;
  }
  for(const w of q.walls)if(segmentDistance(x,z,w)<r)return false;
  if(q.world.resolveSolid){
   const probe={x,z};q.stats.solidQueries++;
   const contacts=q.world.resolveSolid(probe,{bottom:h+q.shape.bottom,top:h+q.shape.top,radius:r});
   if(contacts>0||!Number.isFinite(probe.x+probe.z)||Math.hypot(probe.x-x,probe.z-z)>1e-6)return false;
  }
 }
 return true;
}
export function fillyPoseClear(pose,world,footprint=STORY_FILLY_FOOTPRINT){
 return clear(pose,context(world,[pose],footprint));
}
function nearbyClear(p,q){
 if(clear(p,q))return {...p};
 for(const r of [.4,.8,1.2,1.6,2,2.4,2.8])for(const angle of [0,Math.PI/2,-Math.PI/2,Math.PI,Math.PI/4,-Math.PI/4,3*Math.PI/4,-3*Math.PI/4]){
  const a=p.heading+angle,c={x:p.x+Math.sin(a)*r,z:p.z+Math.cos(a)*r,heading:p.heading};
  if(clear(c,q))return c;if(q.stats.budgetExhausted)return null;
 }
 return null;
}
function swept(a,b,q){
 const turn=wrap(b.heading-a.heading),n=Math.max(1,Math.ceil(Math.max(distance(a,b),Math.abs(turn)*q.extent)/.15));
 if(n>q.steps){q.stats.budgetExhausted=true;return false;}
 for(let i=1;i<=n;i++){
  q.stats.sweepSteps++;
  const t=i/n,p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,heading:a.heading+turn*t};
  if(!clear(p,q))return false;
 }
 return true;
}
/** Pure step; caller retains the returned nav on this one actor. target.heading
 * is the rider's requested orientation, never the filly's changing orientation.
 * options: reentry, mode ('follow'|'idle'|'bolt'), footprint, maxProbeTests,
 * maxSubsteps. Phase clocks, rig animation, visibility and bolt removal remain
 * in the existing story controller. A budget failure never commits a candidate.
 */
export function stepStoryFillyNavigation(actor,target,dt,world,navState={},options={}){
 if(!finitePose(actor)||!finitePose(target)||!Number.isFinite(dt)||dt<0)throw new TypeError('Filly step requires finite poses and nonnegative dt');
 const shape=options.footprint||STORY_FILLY_FOOTPRINT,q=context(world,[actor,target],shape,{...options,movementReach:dt*12}),mode=options.mode||'follow';
 const original={x:actor.x,z:actor.z,heading:actor.heading},startClear=clear(original,q);
 let pose=startClear?original:nearbyClear(original,q),nav={...navState},selected=null;
 const finish=(p=pose||original,speed=0,extra={})=>({...p,speed,target:selected,nav,blocked:speed===0,safe:!!pose,relocated:!!pose&&distance(original,pose)>1e-8,stats:q.stats,...extra});
 if(!pose)return finish(original,0,{safe:false,blocked:true});
 if(mode==='idle'||dt===0)return finish();
 if(mode==='bolt')selected={x:pose.x+Math.sin(actor.heading)*44,z:pose.z+Math.cos(actor.heading)*44,heading:actor.heading};
 else{
  const previous=nav.target,anchor=nav.requested;
  // Retain a selected safe shoulder spot while the rider is stationary. Its
  // orientation is fixed to the request, so turning cannot reproject the target.
  if(nav.shifted&&previous&&anchor&&distance(anchor,target)<.25&&Math.abs(wrap(anchor.heading-target.heading))<.12&&clear(previous,q))selected={...previous};
  else{selected=nearbyClear(target,q);if(selected)nav={...nav,requested:{...target},shifted:distance(selected,target)>1e-8};}
  if(!selected)return finish(pose,0,{blocked:true});
  nav={...nav,target:{...selected}};
 }
 const d=distance(pose,selected);
 if(mode!=='bolt'&&(options.reentry||d>90)){
  const heading=options.reentry?target.heading:actor.heading;
  const landing=nearbyClear({...selected,heading},q);if(!landing)return finish(pose,0,{blocked:true});
  pose=landing;return finish(landing,0,{blocked:false,relocated:true});
 }
 if(mode!=='bolt'&&d<=1.2)return finish(pose,0,{blocked:false});
 const want=mode==='bolt'?actor.heading:Math.atan2(selected.x-pose.x,selected.z-pose.z);
 const speed=mode==='bolt'?11:Math.min(12,1.5+d*1.4),turn=Math.min(1,dt*4);
 const advance=heading=>({x:pose.x+Math.sin(heading)*speed*dt,z:pose.z+Math.cos(heading)*speed*dt,heading});
 const directHeading=mode==='bolt'?actor.heading:pose.heading+wrap(want-pose.heading)*turn,direct=advance(directHeading);
 // Exactly the old arithmetic and requested speed in unobstructed travel.
 if(swept(pose,direct,q)){
  const look={x:pose.x+Math.sin(want)*1.2,z:pose.z+Math.cos(want)*1.2,heading:want};
  if(!nav.detourAngle||swept(pose,look,q)){nav={...nav,detourAngle:0};return finish(direct,speed,{blocked:false});}
 }
 if(q.stats.budgetExhausted)return finish(pose,0,{blocked:true});
 const sign=nav.detourSign===-1?-1:1;
 const angles=[sign*.6,sign*1.1,sign*1.6,-sign*.6,-sign*1.1,-sign*1.6];
 const retained=angles.findIndex(a=>Math.abs(a-(nav.detourAngle||0))<1e-6);
 for(const angle of retained<0?angles:angles.slice(retained)){
  const desired=want+angle,look={x:pose.x+Math.sin(desired)*1.2,z:pose.z+Math.cos(desired)*1.2,heading:desired};
  if(!clear(look,q))continue;
  const heading=pose.heading+wrap(desired-pose.heading)*turn,next=advance(heading);
  nav={...nav,detourSign:Math.sign(angle),detourAngle:angle};
  if(swept(pose,next,q))return finish(next,speed,{blocked:false});
  const rotated={...pose,heading};
  if(Math.abs(wrap(desired-pose.heading))>.05&&swept(pose,rotated,q))return finish(rotated,0,{blocked:true});
  if(q.stats.budgetExhausted)break;
 }
 return finish(pose,0,{blocked:true});
}
