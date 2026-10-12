import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as approach from '../assets/roundup-approach.mjs';

const {chooseRoundupApproach}=approach;
const route=options=>{
 assert.equal(typeof approach.chooseRoundupRoute,'function','the production route planner is exported');
 return approach.chooseRoundupRoute(options);
};
const base=(extra={})=>({horse:{x:0,z:0},pen:{x:20,z:0},rider:{x:-24,z:0},bounds:{x1:-30,x2:30,z1:-20,z2:20},...extra});
const wall={x1:-17,z1:-5,x2:-17,z2:5};
const circleChain=[-4,0,4].map(z=>({x:-17,z,r:2}));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function pointToWall(p,w){
 const dx=w.x2-w.x1,dz=w.z2-w.z1,den=dx*dx+dz*dz;
 const u=den?Math.max(0,Math.min(1,((p.x-w.x1)*dx+(p.z-w.z1)*dz)/den)):0;
 return Math.hypot(p.x-w.x1-u*dx,p.z-w.z1-u*dz);
}
function assertRoute(r,o,{clear=()=>true}={}){
 assert(r,'a navigable pressure route exists');
 assert(Object.isFrozen(r),'route snapshots are immutable');
 assert(Array.isArray(r.waypoints)&&r.waypoints.length>0);
 assert.equal(typeof r.detour,'boolean');
 assert(Number.isFinite(r.length)&&r.length>=0);
 for(const p of [r.target,r.pressurePoint,...r.waypoints]){
  assert(p&&Number.isFinite(p.x)&&Number.isFinite(p.z),'every returned point is finite');
 }
 const p=r.pressurePoint,b=o.bounds,dx=o.pen.x-o.horse.x,dz=o.pen.z-o.horse.z;
 const pressureDistance=distance(p,o.horse);
 assert(pressureDistance>=7.5-1e-8&&pressureDistance<=10.5+1e-8,'pressure point keeps the safe flight-zone band');
 assert(pressureDistance<=(o.pressureRadius??12)-1.5+1e-8);
 assert(Math.abs(p.distance-pressureDistance)<1e-8);
 const alignment=((o.horse.x-p.x)*dx+(o.horse.z-p.z)*dz)/(pressureDistance*Math.hypot(dx,dz));
 if(p.reposition)assertReposition(p,o);
 else assert(alignment>.5,'pressure remains behind the horse toward home');
 assert(Math.abs(p.alignment-alignment)<1e-8);
 assert(distance(r.target,r.waypoints[0])<1e-8,'the next marker is the first route waypoint');
 const last=r.waypoints.at(-1);
 assert(distance(last,p)<1e-8,'the route ends at the pressure point');
 let previous=o.rider,total=0;
 for(const [index,next] of r.waypoints.entries()){
  assert(distance(next,o.horse)>=6-1e-8,'waypoints stay outside the horse spook bubble');
  assert(next.x>=b.x1+1-1e-8&&next.x<=b.x2-1+1e-8&&next.z>=b.z1+1-1e-8&&next.z<=b.z2-1+1e-8,'waypoint has one metre of boundary margin');
  for(const c of o.colliders||[])assert(distance(next,c)>=c.r+1-1e-8,'waypoint clears the full circle margin');
  for(const w of o.walls||[])assert(pointToWall(next,w)>=1-1e-8,'waypoint clears the full wall margin');
  const length=distance(previous,next),steps=Math.max(1,Math.ceil(length/.1));total+=length;
  for(let i=0;i<=steps;i++){
   const f=i/steps,q={x:previous.x+(next.x-previous.x)*f,z:previous.z+(next.z-previous.z)*f};
   assert(q.x>=b.x1+1-1e-8&&q.x<=b.x2-1+1e-8&&q.z>=b.z1+1-1e-8&&q.z<=b.z2-1+1e-8,'segment stays inside the pasture');
   for(const c of o.colliders||[]){
    const margin=index===0?Math.min(c.r+.6,distance(o.rider,c)):c.r+.6;
    assert(distance(q,c)>=margin-.0011,`segment ${index} cannot cut through circle at ${c.x},${c.z}`);
   }
   for(const w of o.walls||[]){
    const margin=index===0?Math.min(.6,pointToWall(o.rider,w)):.6;
    assert(pointToWall(q,w)>=margin-.0011,`segment ${index} cannot cross or cut a wall end`);
   }
   const initialInside=index===0&&distance(o.rider,o.horse)<6;
   assert(distance(q,o.horse)>=(initialInside?distance(o.rider,o.horse):6)-1e-8,'no route leg approaches inside the horse spook bubble');
   assert(clear(q.x,q.z),'independent dense sampling finds no solid geometry crossing');
  }
  previous=next;
 }
 assert(Math.abs(total-r.length)<1e-7,'reported distance equals the actual waypoint path');
 return r;
}

test('direct routing preserves the existing pressure selection exactly',()=>{
 for(const o of [base(),base({colliders:[{x:-9,z:0,r:1.8}]}),base({pressureRadius:14})]){
  const legacy=chooseRoundupApproach(o);assert(legacy);
  const r=assertRoute(route(o),o);
  assert.equal(r.detour,false);assert.equal(r.waypoints.length,1);
  assert.deepEqual(r.pressurePoint,legacy);
  assert.deepEqual({x:r.target.x,z:r.target.z},{x:legacy.x,z:legacy.z});
 }
});

test('a finite fence blocking every direct approach is routed around an actual end',()=>{
 const o=base({walls:[wall]});
 assert.equal(chooseRoundupApproach(o),null,'this fixture genuinely requires a detour');
 const r=assertRoute(route(o),o);
 assert.equal(r.detour,true);assert(r.waypoints.length>=2);
 assert(r.waypoints.some(p=>Math.abs(p.z)>=5.6),'route gets beyond the wall end with segment clearance');
 assert(r.length>distance(o.rider,r.pressurePoint));
});

test('several overlapping circle footprints cannot be shortened into a straight crossing',()=>{
 const o=base({colliders:circleChain});
 assert.equal(chooseRoundupApproach(o),null);
 const r=assertRoute(route(o),o);
 assert.equal(r.detour,true);assert(r.waypoints.length>=2);
 assert(r.waypoints.some(p=>Math.abs(p.z)>6),'detour passes around the whole obstacle cluster');
});

test('solid callback geometry alone can force a valid detour',()=>{
 const clear=(x,z)=>!(x>=-18&&x<=-16&&z>=-6&&z<=6);
 const o=base({clearPoint:clear});
 assert.equal(chooseRoundupApproach(o),null);
 const r=assertRoute(route(o),o,{clear});
 assert.equal(r.detour,true);assert(r.waypoints.some(p=>Math.abs(p.z)>6));
});

test('a wall sealing both pasture edges returns no route',()=>{
 const o=base({walls:[{x1:-17,z1:-20,x2:-17,z2:20}]});
 assert.equal(chooseRoundupApproach(o),null);
 assert.equal(route(o),null);
});

test('unreachable solid geometry and blocked pressure destinations return no route',()=>{
 assert.equal(route(base({clearPoint:()=>false})),null);
 assert.equal(route(base({clearPoint:x=>x< -17})),null);
 const boundary=base({horse:{x:-29,z:0},rider:{x:-24,z:10}});
 assert.equal(chooseRoundupApproach(boundary),null,'legacy rear marker remains unavailable at the boundary');
 const recovery=assertRoute(route(boundary),boundary);assert.equal(recovery.pressurePoint.reposition,true,'new side recovery is explicitly labelled');
});

test('only the first segment may escape the rider contact margin',()=>{
 const o=base({walls:[wall],colliders:[{x:-25.55,z:0,r:1}]});
 assert(distance(o.rider,o.colliders[0])<1.6,'rider begins at the physical .55m contact margin');
 const r=assertRoute(route(o),o);
 assert.equal(r.detour,true);
 for(const p of r.waypoints)assert(distance(p,o.colliders[0])>=2-1e-8,'all later waypoints use the full one metre margin');
});

test('route selection is deterministic and never mutates caller geometry',()=>{
 const o=base({walls:[wall],colliders:[{x:-14,z:7,r:1.5}]}),before=structuredClone(o);
 const first=assertRoute(route(o),o);
 for(let i=0;i<4;i++)assert.deepEqual(route(o),first);
 assert.deepEqual(o,before);
});

test('invalid positions, bounds and pressure radii cannot enter route search',()=>{
 for(const o of [{},base({horse:{x:Infinity,z:0}}),base({pen:{x:NaN,z:0}}),base({rider:{x:1e200,z:1e200}}),base({bounds:null}),base({pressureRadius:0}),base({bounds:{x1:30,x2:-30,z1:-20,z2:20}}),base({horse:{x:0,z:0},pen:{x:0,z:0}})]){
  assert.equal(route(o),null);
 }
});


test('fallback work and solid callback probes have a fixed hard budget',()=>{
 let calls=0;
 const o=base({bounds:{x1:-45,x2:45,z1:-35,z2:35},clearPoint:x=>{calls++;assert(calls<=12000,'solid query budget is never exceeded');return x< -18||x> -16;}});
 assert.equal(route(o),null,'the callback wall spans the entire pasture');
 assert(calls>0);assert(calls<=12000);
 let hugeCalls=0;
 const huge=base({bounds:{x1:-1e9,x2:1e9,z1:-1e9,z2:1e9},walls:[wall],clearPoint:()=>{hugeCalls++;return true;}});
 assert.equal(route(huge),null,'huge bounds cannot allocate an unbounded grid');
 assert(hugeCalls<=12000);
});

test('solid geometry is probed along every returned leg at intervals no larger than .75m',()=>{
 for(const walls of [[],[wall]]){
  const probes=[],o=base({walls,clearPoint:(x,z)=>{probes.push({x,z});return true;}});
  const r=assertRoute(route(o),o);let previous=o.rider;
  for(const next of r.waypoints){
   const length=distance(previous,next);if(length<1e-9){previous=next;continue;}
   const ux=(next.x-previous.x)/length,uz=(next.z-previous.z)/length;
   // The initial rider point is allowed to be at contact; every later stretch
   // must be supported by actual callback observations on that returned leg.
   const positions=[0];
   for(const p of probes){
    const dx=p.x-previous.x,dz=p.z-previous.z,along=dx*ux+dz*uz,perpendicular=Math.abs(dx*uz-dz*ux);
    if(perpendicular<1e-7&&along>=-1e-7&&along<=length+1e-7)positions.push(Math.max(0,Math.min(length,along)));
   }
   positions.sort((a,b)=>a-b);
   assert(Math.abs(positions.at(-1)-length)<1e-7,'the waypoint itself was checked against real solids');
   for(let i=1;i<positions.length;i++)assert(positions[i]-positions[i-1]<=.75+1e-7,'no unsampled span exceeds the solid-query spacing');
   previous=next;
  }
 }
});


test('a rider in front circles the horse instead of cutting through its spook bubble',()=>{
 const o=base({rider:{x:24,z:0}}),legacy=chooseRoundupApproach(o);
 assert(legacy,'legacy scenery checks alone permit the unsafe cross-horse approach');
 assert.equal(legacy.z,0);
 const r=assertRoute(route(o),o);
 assert(r.waypoints.some(p=>Math.abs(p.z)>=6),'the route visibly passes around the horse');
 assert(!r.pressurePoint.reposition,'reachable widened guiding pressure takes priority over recovery');
});

test('a rider already four metres away retreats monotonically before circling behind',()=>{
 for(const rider of [{x:4,z:0},{x:0,z:4},{x:-4,z:0}]){
  const o=base({rider}),r=assertRoute(route(o),o),first=r.waypoints[0];
  assert(distance(first,o.horse)>=6-1e-8);
  const steps=Math.max(1,Math.ceil(distance(rider,first)/.05));let prior=4;
  for(let i=1;i<=steps;i++){
   const f=i/steps,p={x:rider.x+(first.x-rider.x)*f,z:rider.z+(first.z-rider.z)*f},d=distance(p,o.horse);
   assert(d>=prior-1e-8,'the first escape leg never closes on the horse');prior=d;
  }
 }
});

const leg=options=>{
 assert.equal(typeof approach.roundupRiderLegClear,'function','the shared rider-leg validator is exported');
 return approach.roundupRiderLegClear(options);
};
const legInput=(o,from,to)=>({from,to,horse:o.horse,bounds:o.bounds,colliders:o.colliders||[],walls:o.walls||[],clearPoint:o.clearPoint});

test('the shared leg validator accepts actual route first legs and every later segment',()=>{
 for(const o of [base(),base({walls:[wall]}),base({colliders:circleChain}),base({rider:{x:24,z:0}}),base({rider:{x:4,z:0}}),base({walls:[wall],colliders:[{x:-25.55,z:0,r:1}]})]){
  const r=assertRoute(route(o),o);let from=o.rider;
  assert.equal(leg(legInput(o,from,r.target)),true,'the displayed next leg is physically valid');
  for(const to of r.waypoints){assert.equal(leg(legInput(o,from,to)),true);from=to;}
 }
});

test('a previously valid next leg is rejected after a prop, rail or solid blocks it',()=>{
 const o=base(),r=route(o),input=legInput(o,o.rider,r.target);
 assert.equal(leg(input),true);
 assert.equal(leg({...input,colliders:[{x:-17,z:0,r:.8}]}),false);
 assert.equal(leg({...input,walls:[{x1:-17,z1:-2,x2:-17,z2:2}]}),false);
 assert.equal(leg({...input,clearPoint:(x,z)=>!(Math.abs(x+17)<.8&&Math.abs(z)<1)}),false);
});

test('a horse drifting into a cached leg invalidates the leg immediately',()=>{
 const o=base(),r=route(o),input=legInput(o,o.rider,r.target);
 assert.equal(leg(input),true);
 assert.equal(leg({...input,horse:{x:-15,z:0}}),false,'the old marker cannot lead the rider through the new horse position');
 assert.equal(leg({...input,horse:{x:-10,z:0}}),false,'a pressure endpoint now inside the bubble is also invalid');
});

test('rider-leg endpoints require a full metre at props, rails and pasture bounds',()=>{
 const input=legInput(base(),{x:-24,z:0},{x:-9,z:0});
 assert.equal(leg({...input,colliders:[{x:-7.3,z:0,r:1}]}),false,'endpoint .7m beyond a circle is insufficient even though the segment clears .6m');
 assert.equal(leg({...input,walls:[{x1:-8.2,z1:-3,x2:-8.2,z2:3}]}),false,'endpoint .8m from a wall is insufficient');
 assert.equal(leg({...input,to:{x:-29.2,z:0}}),false,'endpoint .8m inside the boundary is insufficient');
 assert.equal(leg({...input,to:{x:-29,z:0}}),true,'one metre of boundary clearance is accepted');
});

test('rider legs accept exact tangent clearances but reject paths just inside them',()=>{
 const input=legInput(base(),{x:-24,z:0},{x:-9,z:0});
 assert.equal(leg({...input,colliders:[{x:-17,z:1.6,r:1}]}),true);
 assert.equal(leg({...input,colliders:[{x:-17,z:1.59,r:1}]}),false);
 assert.equal(leg({...input,walls:[{x1:-18,z1:.6,x2:-15,z2:.6}]}),true);
 assert.equal(leg({...input,walls:[{x1:-18,z1:.59,x2:-15,z2:.59}]}),false);
 const tangent={...input,from:{x:-20,z:6},to:{x:20,z:6}};
 assert.equal(leg(tangent),true,'the six-metre horse tangent is safe');
 assert.equal(leg({...tangent,from:{x:-20,z:5.99},to:{x:20,z:5.99}}),false);
});

test('inside-bubble legs must retreat immediately and finish beyond six metres',()=>{
 const input=legInput(base(),{x:4,z:0},{x:8,z:0});
 assert.equal(leg(input),true);
 assert.equal(leg({...input,to:{x:7,z:5}}),true,'a diagonal outward retreat is permitted');
 assert.equal(leg({...input,to:{x:5.99,z:0}}),false,'stopping inside the bubble cannot become a valid waypoint');
 assert.equal(leg({...input,to:{x:0,z:8}}),false,'an outward endpoint cannot excuse first approaching the horse');
 assert.equal(leg({...input,to:{x:-8,z:0}}),false,'an inside rider cannot cross through the horse');
});

test('a rider at physical collider contact may leave but cannot move closer or cut through',()=>{
 const input=legInput(base({colliders:[{x:-25.55,z:0,r:1}]}),{x:-24,z:0},{x:-9,z:0});
 assert.equal(leg(input),true,'outward motion may begin at the .55m physical contact margin');
 assert.equal(leg({...input,to:{x:-28,z:0}}),false,'the same allowance never permits crossing the collider');
 assert.equal(leg({...input,to:{x:-27,z:4}}),false,'a clear endpoint still fails when the leg initially moves closer');
});

test('rider-leg solid checks cover the endpoint and every interval of at most .75m',()=>{
 const probes=[],input={...legInput(base(),{x:-24,z:0},{x:-9,z:0}),clearPoint:(x,z)=>{probes.push({x,z});return true;}};
 assert.equal(leg(input),true);
 assert(probes.some(p=>Math.abs(p.x+9)<1e-8&&Math.abs(p.z)<1e-8));
 const positions=[0,...probes.filter(p=>Math.abs(p.z)<1e-8&&p.x>=-24&&p.x<=-9).map(p=>p.x+24)].sort((a,b)=>a-b);
 assert.equal(positions.at(-1),15);
 for(let i=1;i<positions.length;i++)assert(positions[i]-positions[i-1]<=.75+1e-8);
 assert.equal(leg({...input,clearPoint:(x,z)=>!(x>-17.8&&x< -17&&Math.abs(z)<1)}),false,'a solid between clear endpoints cannot be skipped');
});

test('rider-leg validation rejects malformed coordinates and bounds without mutating inputs',()=>{
 const good=legInput(base(),{x:-24,z:0},{x:-9,z:0}),before=structuredClone(good);
 assert.equal(leg(good),true);assert.deepEqual(good,before);
 for(const input of [{},{...good,from:{x:NaN,z:0}},{...good,to:{x:Infinity,z:0}},{...good,horse:{x:0,z:Infinity}},{...good,bounds:null},{...good,bounds:{x1:30,x2:-30,z1:-20,z2:20}},{...good,bounds:{x1:-30,x2:30,z1:NaN,z2:20}}])assert.equal(leg(input),false);
});


// Captured real world geometry; these assertions prove guidance safety and an
// immediately useful escape direction, not a completed herd or a played run.
const blockedEvidence=JSON.parse(fs.readFileSync(new URL('../review/riding-fairness/full-route-blocked.json',import.meta.url),'utf8'));
function willow(extra={}){
 return {horse:{x:-56.0046,z:21.4712},rider:{x:blockedEvidence.player.x,z:blockedEvidence.player.z},pen:{x:-44,z:-8},
  ...structuredClone(blockedEvidence.roundupGeometry),pressureRadius:14,avoidSide:0,...extra};
}
function assertReposition(p,o){
 assert.equal(p.reposition,true);
 const escape=approach.chooseRoundupEscape({...o,rider:p,side:o.avoidSide||0});
 assert(escape,'standing on this reposition point gives the horse an actual collision-checked escape');
 const dx=o.pen.x-o.horse.x,dz=o.pen.z-o.horse.z,len=Math.hypot(dx,dz);
 const ux=Math.sin(escape.heading),uz=Math.cos(escape.heading),alignment=(ux*dx+uz*dz)/len;
 assert(alignment>.35,'the resulting escape must turn toward home, not just sideways along a fence');
 function clearEscape(length){
  const end={x:o.horse.x+ux*length,z:o.horse.z+uz*length};
  if(end.x<o.bounds.x1+2||end.x>o.bounds.x2-2||end.z<o.bounds.z1+2||end.z>o.bounds.z2-2)return false;
  if(distance(end,o.pen)>=distance(o.horse,o.pen))return false;
  for(let i=1;i<=Math.ceil(length/.02);i++){
   const n=length*i/Math.ceil(length/.02),q={x:o.horse.x+ux*n,z:o.horse.z+uz*n};
   // A horse already at the outer clamp may retreat back into the two-metre
   // lane, but cannot move further outside it during that validated escape.
   if(q.x<Math.min(o.horse.x,o.bounds.x1+2)-1e-8||q.x>Math.max(o.horse.x,o.bounds.x2-2)+1e-8||
      q.z<Math.min(o.horse.z,o.bounds.z1+2)-1e-8||q.z>Math.max(o.horse.z,o.bounds.z2-2)+1e-8)return false;
   for(const c of o.colliders||[])if(distance(q,c)<Math.min(c.r+.7,distance(o.horse,c))-.00011)return false;
   for(const w of o.walls||[])if(pointToWall(q,w)<Math.min(.7,pointToWall(o.horse,w))-.00011)return false;
   if(o.clearPoint&&!o.clearPoint(q.x,q.z,.7))return false;
  }
  return true;
 }
 assert([3,1.5,.6].some(clearEscape),'independent dense geometry checks confirm a real homeward escape at a supported lookahead');
 return escape;
}

test('captured Willow boundary stall has a safe useful route with the real pasture geometry',()=>{
 const o=willow();assert.equal(chooseRoundupApproach(o),null,'the narrow legacy rear marker is genuinely unavailable');
 const r=assertRoute(route(o),o);
 assert(r.pressurePoint.alignment>.5&&r.pressurePoint.alignment<.7,'the widened guiding arc handles the captured stall');
 assert(!r.pressurePoint.reposition,'available guiding pressure is preferred over reposition');
 if(r.pressurePoint.reposition)assertReposition(r.pressurePoint,o);
});

test('both avoidance-side preferences produce independently valid boundary reposition routes',()=>{
 for(const avoidSide of [-1,1]){
  const o=willow({horse:{x:-108,z:23},rider:{x:-93,z:10},avoidSide}),r=assertRoute(route(o),o);
  assert.equal(r.pressurePoint.reposition,true);assertReposition(r.pressurePoint,o);
 }
});

test('a horse in the northwest pasture corner can be repositioned toward home without crossing fences',()=>{
 const o=willow({horse:{x:-108,z:23},rider:{x:-93,z:10}});
 assert.equal(chooseRoundupApproach(o),null);
 const r=assertRoute(route(o),o);assert.equal(r.pressurePoint.reposition,true);assertReposition(r.pressurePoint,o);
});

test('a sealed horse escape cannot be disguised as a reachable reposition marker',()=>{
 const o=willow({horse:{x:-108,z:23},rider:{x:-93,z:10}}),h=o.horse;
 o.walls.push({x1:h.x-1,z1:h.z-1,x2:h.x+1,z2:h.z-1},{x1:h.x+1,z1:h.z-1,x2:h.x+1,z2:h.z+1},
  {x1:h.x+1,z1:h.z+1,x2:h.x-1,z2:h.z+1},{x1:h.x-1,z1:h.z+1,x2:h.x-1,z2:h.z-1});
 assert.equal(route(o),null,'reachable rider space cannot substitute for an actual horse escape');
});


test('reposition prediction preserves the actual .7m horse footprint in solid callbacks',()=>{
 const pads=[],o=willow({horse:{x:-108,z:23},rider:{x:-93,z:10},clearPoint:(x,z,pad)=>{pads.push(pad);return true;}});
 const r=assertRoute(route(o),o);assert.equal(r.pressurePoint.reposition,true);
 assert(pads.includes(.7),'the horse escape is checked with its real body clearance');
 assert(pads.includes(undefined),'rider route queries retain their own default footprint');
 let horseChecks=0;
 assert.equal(route({...o,clearPoint:(x,z,pad)=>{if(pad===.7){horseChecks++;return false;}return true;}}),null,
  'free rider space cannot hide solids that obstruct the larger horse footprint');
 assert(horseChecks>0);
});


test('unreachable guiding goals across a sealed fence still allow useful rider-side recovery',()=>{
 const o=base({rider:{x:15,z:0},walls:[{x1:-5,z1:-20,x2:-5,z2:20}]});
 const guiding=chooseRoundupApproach({...o,rider:{x:-14,z:0}});
 assert(guiding&&guiding.alignment>.5&&guiding.x< -6,'valid guiding endpoints exist in the isolated region');
 assert.equal(chooseRoundupApproach(o),null,'the actual rider cannot reach those guiding endpoints');
 const r=assertRoute(route(o),o);assert.equal(r.pressurePoint.reposition,true);
 assert(r.waypoints.every(p=>p.x>=-4-1e-8),'recovery stays on the rider side of the unbroken wall');
 const escape=assertReposition(r.pressurePoint,o);
 assert(Math.sin(escape.heading)>.35,'the resulting horse escape makes real progress toward the eastern pen');
});
