import test from 'node:test';
import assert from 'node:assert/strict';
import * as approach from '../assets/roundup-approach.mjs';
import * as pressure from '../assets/roundup-pressure.mjs';
import {ROUNDUP_MODES} from '../assets/roundup-rewards.mjs';
const {chooseRoundupApproach}=approach;
const bounds={x1:-110,x2:-33,z1:-45,z2:25},pen={x:-44,z:-8};
const captured={horse:{x:-70.05001037502082,z:-1.0322879349380805},rider:{x:-79.93126458892823,z:6.714969306796876},pen,bounds,
 colliders:[{x:-78.06703661320132,z:-4.849029336761886,r:.8},{x:-81.14037748273948,z:-4.777269400358604,r:.8},{x:-81.41458904821971,z:-2.3796308872720204,r:.8},{x:-70.15581466997632,z:-4.191479997966275,r:.8},{x:-66.13761742858041,z:-15.500166657726039,r:.8},{x:-73.56703661320132,z:-1.7490293367618857,r:1.25},{x:-76.91458904821971,z:.7203691127279797,r:1.25}]};
const input=(extra={})=>({horse:{x:-75,z:-8},rider:{x:-95,z:-8},pen,bounds,...extra});
function viable(p,o){
 assert(p,'a clear pressure position exists');const dx=o.pen.x-o.horse.x,dz=o.pen.z-o.horse.z,l=Math.hypot(dx,dz),rx=o.horse.x-p.x,rz=o.horse.z-p.z,d=Math.hypot(rx,rz);
 assert(d>=7.5-1e-8&&d<=10.5+1e-8,`safe pressure distance ${d}`);assert(d<(o.pressureRadius||12)-1.49);assert((rx*dx+rz*dz)/(d*l)>.7,'behind the shoulder, towards the pen');
 assert(p.x>=o.bounds.x1+1&&p.x<=o.bounds.x2-1&&p.z>=o.bounds.z1+1&&p.z<=o.bounds.z2-1);
 for(const c of o.colliders||[])assert(Math.hypot(p.x-c.x,p.z-c.z)>=c.r+1-1e-8,'marker clears collider');
}

test('captured 87-second Juniper stall now has an unobstructed marker inside pressure range',()=>{
 const old={x:-80.10758643362979,z:7.136317898819636};assert(Math.hypot(old.x-captured.horse.x,old.z-captured.horse.z)>12);
 const p=chooseRoundupApproach(captured);viable(p,captured);assert.equal(p.distance,9.75);
 // Check the continuous approach independently, rather than trusting the helper's result.
 for(let n=0;n<=200;n++){
  const t=n/200,x=captured.rider.x+(p.x-captured.rider.x)*t,z=captured.rider.z+(p.z-captured.rider.z)*t;
  for(const c of captured.colliders)assert(Math.hypot(x-c.x,z-c.z)>=c.r+.59);
 }
});

test('all later captured stall samples remain within the effective flight zone',()=>{
 const samples=[[-69.83581037783925,-.03431914884563199,-79.16739400650293,7.961097552135417],[-70.08964342786652,-2.349876742782647,-79.8493344112151,4.686648131501154],[-69.6669623101906,-2.773374441129292,-80.01879489995244,3.8765896769246004],[-71.25589524136988,-1.7010646164481134,-80.27743283676534,6.27422952621217],[-70.97685238523202,-.34380354912767713,-80.52718989973573,7.3277840931698695],[-70.4189309809541,-.6651175876616158,-80.20311196132351,7.1031733691913965],[-70.3776776543178,-2.102021721132526,-80.03707270185913,5.059648824672828]];
 for(const [hx,hz,px,pz] of samples){const o={...captured,horse:{x:hx,z:hz},rider:{x:px,z:pz}};viable(chooseRoundupApproach(o),o);}
});

test('an open pasture retains the original nine-metre direct pressure position',()=>{
 const o=input(),p=chooseRoundupApproach(o);assert.deepEqual(p,{x:-84,z:-8,distance:9,alignment:1});viable(p,o);
});

test('a blocked ideal position finds an angular alternative instead of jumping out of range',()=>{
 const o=input({colliders:[{x:-84,z:-8,r:1.8}]}),p=chooseRoundupApproach(o);viable(p,o);assert(Math.abs(p.z+8)>1);
});

test('a thin wall between rider and all markers gives no misleading marker',()=>{
 const o=input({walls:[{x1:-90,z1:-45,x2:-90,z2:25}]});assert.equal(chooseRoundupApproach(o),null);
});

test('a point across an internal fence is rejected even when its endpoint is open',()=>{
 const o=input({walls:[{x1:-83,z1:-45,x2:-83,z2:25}]}),p=chooseRoundupApproach(o);viable(p,o);assert(p.x<=-84,'rider stays west of the fence');
});

test('a pasture boundary does not clamp an impossible rear approach into a false marker',()=>{
 const o=input({horse:{x:-108,z:-8},rider:{x:-105,z:12}});assert.equal(chooseRoundupApproach(o),null);
});

test('solid model callback rejects blocked endpoints and routes',()=>{
 const o=input({clearPoint:()=>false});assert.equal(chooseRoundupApproach(o),null);
 const wall=input({clearPoint:(x)=>Math.abs(x+90)>.7});assert.equal(chooseRoundupApproach(wall),null,'thin physical geometry between rider and marker blocks guidance');
 const endpoint=input({clearPoint:(x,z)=>Math.hypot(x+84,z+8)>1.4}),p=chooseRoundupApproach(endpoint);viable(p,endpoint);assert(Math.hypot(p.x+84,p.z+8)>1.4);
});

test('rider may retreat out from a collider contact margin without crossing through it',()=>{
 const o=input({rider:{x:-95,z:-8},colliders:[{x:-96.55,z:-8,r:1}]}),p=chooseRoundupApproach(o);viable(p,o);
});

test('full herd uses the same safe range and never weakens its collider clearance',()=>{
 const o={...captured,pressureRadius:14};viable(chooseRoundupApproach(o),o);
});

test('candidate and geometry sampling remains bounded for malformed or faraway positions',()=>{
 for(const o of [{},input({horse:{x:Infinity,z:0}}),input({pen:{x:NaN,z:0}}),input({rider:{x:1e200,z:1e200}}),input({bounds:null}),input({pressureRadius:0})])assert.equal(chooseRoundupApproach(o),null);
 let calls=0;assert.equal(chooseRoundupApproach(input({clearPoint:()=>{calls++;return false;}})),null);assert(calls<=35,'at most 35 candidate endpoints');
});

test('selection does not mutate input points, collider data, or bounds',()=>{
 const o=structuredClone(captured),before=structuredClone(o);chooseRoundupApproach(o);assert.deepEqual(o,before);
});

// Exercise the actual public state seam as well: a visually valid marker must
// satisfy the very pressure predicate the runtime presents to the rider.
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
const start=source.indexOf('function roundupTarget(){'),end=source.indexOf('function clearRoundupHorse(h){',start);
assert(start>=0&&end>start);
function stateFixture(o=captured){
 let now=1000,solidCalls=0;
 const pos={...o.horse,distanceTo(p){return Math.hypot(this.x-p.x,this.z-p.z);}},player={pos:{...o.rider}};
 const ROUND={on:true,mode:'beginner',horses:[{name:'Juniper',pos}],total:3,penned:0,t:63,elapsed:87,cd:0,runId:'captured',lastResult:null};
 const G={input:{blocked:()=>false},world:{colliders:o.colliders||[],walls:o.walls||[],solidWorld:{resolve(p){solidCalls++;if(o.solid)o.solid(p);}}}};
 const bindings={...approach,...pressure,G,ROUND,ROUND_PEN:o.pen,PAST:o.bounds,ROUND_MODES:ROUNDUP_MODES,player,Date:{now:()=>now},groundH:()=>0,freshSave:()=>({}),freeCam:false,document:{hidden:false}};
 const state=Function(...Object.keys(bindings),source.slice(start,end)+'return roundupState;')(...Object.values(bindings));
 return {state,player,G,advance:n=>now+=n,get solidCalls(){return solidCalls;}};
}

test('actual target state marks a rider on the replacement marker as guiding',()=>{
 const f=stateFixture(),target=f.state().target;assert.equal(target.approachBlocked,false);assert(Number.isFinite(target.standX)&&Number.isFinite(target.standZ));
 Object.assign(f.player.pos,{x:target.standX,z:target.standZ});assert.equal(f.state().target.pressure,'guiding');
});

test('actual state exposes blocked approach with null coordinates and bounded cache lifetime',()=>{
 const f=stateFixture(input({walls:[{x1:-90,z1:-45,x2:-90,z2:25}]}));const t=f.state().target;
 assert.equal(t.approachBlocked,true);assert.equal(t.standX,null);assert.equal(t.standZ,null);
 f.G.world.walls=[];f.advance(200);assert.equal(f.state().target.approachBlocked,false,'a changed world is resampled after the short cache window');
 const calls=f.solidCalls;f.state();f.state();assert.equal(f.solidCalls,calls,'repeated HUD/state reads share geometry work');
});
