// Source-geometry proof only. No browser, live terrain/world claim, player
// control, saved progression or teleport. Root separately rides the real route.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {register} from 'node:module';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createRanchArchitecture} from '../assets/ranch-architecture.js';
import {createSolidWorld} from '../assets/solid-collisions.js';
import {flatRaceSegmentClear} from '../assets/flat-race-guidance.mjs';
const threeURL=new URL('../assets/vendor/three/build/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return {url:${JSON.stringify(threeURL)},shortCircuit:true};return n(s,c);}`),import.meta.url);
const {installTackSummonStall,TACK_SUMMON_STALL:P}=await import('../assets/features/tack-summon-stall.js');
const core=readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8'),ceremony=readFileSync(new URL('../assets/features/tack-summon-ceremony.js',import.meta.url),'utf8');
function literal(source,name){const m=source.match(new RegExp('(?:const|export const) '+name+'=(?:Object.freeze\\()?((?:\\{)[^;]+?\\})(?:\\))?;'));assert(m,`${name} actual source literal`);return Function(`return (${m[1]});`)();}
const barn=literal(core,'BARN_ROW'),pasture=literal(core,'PAST'),horse=literal(core,'SUMMON_STALL'),arrival=literal(ceremony,'TACK_STALL_ARRIVAL');
const point=(x,z)=>({x,z}),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const route=[point(-28.2,-15.2),point(-28.2,-12),point(-31.5,-12),point(-32.2,-10.3),point(-32.2,-9),point(-34.5,-9)];
const starts=[point(-28.419348773777404,-15.26618278305274),point(-28.419348773777404,-16.048033845209105)];
const circlePad=Number(core.match(/rad=c\.r\+([\d.]+)/)?.[1]),wallPad=Number(core.match(/const d2=ox\*ox\+oz\*oz,rad=([\d.]+);/)?.[1]);
assert.equal(circlePad,.55);assert.equal(wallPad,.65);
const horseRadius=Number(core.match(/colliders\.push\(\{x,z,r:([\d.]+)\}\);\n const sp=nameSprite\('✨ The Summoning Stall'/)?.[1]);assert(horseRadius>0);
const postMatch=core.match(/for\(const z of(\[[^\]]+\])\)tube\(([^,]+),([^,]+),[^,]+,[^,]+,-33,/);assert(postMatch,'physical pasture gate posts from source');
const postZ=Function(`return ${postMatch[1]};`)(),postRadius=Math.max(Number(postMatch[2]),Number(postMatch[3]));
const wallSource=core.match(/(\[\[PAST\.x1,PAST\.z1[\s\S]*?\])\n \.forEach\(s=>walls\.push/);assert(wallSource,'actual pasture wall segments');
const pastureWalls=Function('PAST',`return ${wallSource[1]};`)(pasture).map(([x1,z1,x2,z2])=>({x1,z1,x2,z2}));
assert(core.includes('[-25,-20,-25,20]'),'actual arena west rail');
const walls=[...pastureWalls,{x1:-25,z1:-20,x2:-25,z2:20}],posts=postZ.map(z=>({x:pasture.x2,z,r:postRadius}));
function segmentDistance(p,w){const dx=w.x2-w.x1,dz=w.z2-w.z1,t=Math.max(0,Math.min(1,((p.x-w.x1)*dx+(p.z-w.z1)*dz)/(dx*dx+dz*dz)));return Math.hypot(p.x-w.x1-t*dx,p.z-w.z1-t*dz);}
function fixture(){
 const scene=new T.Scene(),solid=createSolidWorld({THREE:T}),architecture=createRanchArchitecture({THREE:T,loadTextures:false}),row=new T.Group();
 for(let k=0;k<barn.n;k++){const stall=architecture.buildOpenStall();stall.position.set(barn.x,0,barn.z0+k*barn.step);row.add(stall);}scene.add(row);solid.register(row,{primitives:true});
 // Use the actual horse summoning shell options and rotation, not a guessed
 // rectangle. Circle collision additionally retains its real legacy footprint.
 const shellMatch=core.match(/const shell=ranchArchitecture\.buildOutbuilding\((\{width:4\.6[^;]+\})\);/);assert(shellMatch);
 const horseShell=architecture.buildOutbuilding(Function(`return (${shellMatch[1]});`)());horseShell.position.set(horse.x,0,horse.z);horseShell.rotation.y=Math.PI;scene.add(horseShell);solid.register(horseShell,{primitives:true});
 const colliders=[{...horse,r:horseRadius},{x:-36.5,z:-9.5,r:1.1}];assert(core.includes('{x:-36.5,z:-9.5,r:1.1}'),'fixed trough footprint from source');
 const W={groundH:()=>0,solidWorld:solid,colliders,walls,mapMarkers:[],miniMarkers:[],things:[]};
 // Execute production addBuilding so precise-vs-circle ownership, placement,
 // rotation and the collider all use the unchanged real building API.
 const a=core.indexOf('function addBuilding(o){'),b=core.indexOf('function mkChest(',a);assert(a>=0&&b>a);
 W.addBuilding=Function('scene','groundH','followCamera','solidWorld','colliders','nameSprite',core.slice(a,b)+'return addBuilding;')(scene,W.groundH,{register:g=>solid.register(g,{primitives:true})},solid,colliders,()=>null);
 W.addThing=t=>{W.things.push(t);return t;};const G={THREE:T,world:W},handle=installTackSummonStall(G,()=>true);
 return {scene,solid,row,horseShell,W,handle};
}
function clearPoint(f,p,override=null){
 const q={...p};if(f.solid.resolve(q,{bottom:-100,top:100,radius:circlePad})!==0||q.x!==p.x||q.z!==p.z)return false;
 const circles=f.W.colliders.map(c=>c.x===P.x&&c.z===P.z&&override?{...c,...override}:c);
 if(circles.some(c=>!c.precise&&distance(p,c)<c.r+circlePad))return false;
 if(walls.some(w=>segmentDistance(p,w)<wallPad))return false;
 if(posts.some(c=>distance(p,c)<c.r+circlePad))return false;
 return true;
}
function proveRoute(f,from,points,override=null){let samples=0,minCircle=Infinity,minWall=Infinity,minPost=Infinity;
 for(const to of points){const n=Math.max(1,Math.ceil(distance(from,to)/.025));
  for(let i=0;i<=n;i++){
   const p=point(from.x+(to.x-from.x)*i/n,from.z+(to.z-from.z)*i/n);assert(clearPoint(f,p,override),`source collision on route at ${JSON.stringify(p)}`);
   for(const c of f.W.colliders)if(!c.precise)minCircle=Math.min(minCircle,distance(p,c)-(c.r+circlePad));
   for(const w of walls)minWall=Math.min(minWall,segmentDistance(p,w)-wallPad);
   for(const c of posts)minPost=Math.min(minPost,distance(p,c)-(c.r+circlePad));samples++;
  }
  from=to;
 }return {samples,minCircle,minWall,minPost};
}
function boundsOfRecordedParts(root){const box=new T.Box3(),v=new T.Vector3();root.updateWorldMatrix(true,true);root.traverse(o=>{for(const p of o.userData.solidParts||[]){const m=new T.Matrix4().fromArray(p.matrix).premultiply(o.matrixWorld);for(const x of[p.min[0],p.max[0]])for(const y of[p.min[1],p.max[1]])for(const z of[p.min[2],p.max[2]])box.expandByPoint(v.set(x,y,z).applyMatrix4(m));}});return box;}

test('the recorded body clamp is an authored barn contact, and the relocated crossing has over one metre of centre room',()=>{
 const f=fixture(),b=boundsOfRecordedParts(f.row);assert(!b.isEmpty());assert.equal(b.max.x+circlePad+.002,starts[0].x,'exact real clamp follows actual proxies plus stock capsule/contact nudge');
 const opening=(P.z-P.radius-circlePad)-(b.max.z+circlePad);assert(opening>1,`mounted centre opening is ${opening}m`);assert.equal(f.W.colliders.find(c=>c.x===P.x&&c.z===P.z)?.precise,false,'the workbench keeps its stock circle collider');
 for(let z=b.max.z+circlePad+.07;z<P.z-P.radius-circlePad-.02;z+=.05)for(let x=-31.5;x<=-28.2;x+=.05)assert(clearPoint(f,point(x,z)),'the opening is a real crossing band, not a single lucky ray');
 assert(distance(P,horse)>P.radius+circlePad+horseRadius+circlePad,'existing horse-stall collision envelope stays separate');
});

test('dense real-part/circle/wall/post checks open the normal mounted route from both recorded rider positions',()=>{
 const f=fixture(),before=f.row.toJSON(),statistics=structuredClone(f.solid.stats());
 for(const start of starts){const result=proveRoute(f,start,route);assert(result.samples>450);assert(result.minCircle>.3);assert(result.minWall>.4);assert(result.minPost>.19);assert.equal(flatRaceSegmentClear(start,route[0],{world:f.W}),false,'the navigator uses a wider .75m safety pad: a rider at the stock .55m contact edge must first step outward normally');for(let i=1;i<route.length;i++)assert.equal(flatRaceSegmentClear(route[i-1],route[i],{world:f.W}),true,'after the ordinary outward step, the actual wider ground validator accepts the source-model legs');}
 assert.deepEqual(f.row.toJSON(),before);assert.deepEqual(f.solid.stats(),statistics,'clearance probes do not rebuild or change the collision world');
 assert.equal(route.at(-1).x<pasture.x2,true);assert.equal(route.at(-1).z,-9,'the route crosses the real gate centre');
});

test('the former tack placement blocks that same approach and the old westward target is still honestly a barn wall',()=>{
 const f=fixture(),old={x:-27.2,z:-11.55},p=point(-28.2,-12);assert.equal(clearPoint(f,p,old),false,'recorded old blocker seals the north crossing');assert.equal(clearPoint(f,p),true,'new physical placement repairs that same point');assert.equal(clearPoint(f,point(-30.3,-16)),false,'no approved route crosses through an open stall back/roof');
 assert.equal(flatRaceSegmentClear(starts[0],point(-30.3,-16),{world:f.W}),false);
});

test('the original ceremony/fast-travel arrival stays outside both blockers and inside the unchanged interaction gates',()=>{
 const f=fixture();assert(clearPoint(f,arrival));assert(distance(arrival,P)>P.radius+circlePad);assert(distance(arrival,horse)>horseRadius+circlePad);assert(distance(arrival,P)<P.reach);assert(distance(arrival,horse)<6);assert(distance(P,horse)<6);
 const line=ceremony.split('\n').find(s=>s.trim().startsWith("const entry=['Summoning Stall'"));assert(line);const entry=Function('TACK_STALL_ARRIVAL',line+'return entry;')(arrival);assert.deepEqual(entry,['Summoning Stall',arrival.x,arrival.z,arrival.heading]);assert(ceremony.includes('>6)return notify('),'the existing horse-stall visit gate remains authoritative');
});

test('one placement owns the actual scenery, physical blocker, E interaction, world map and minimap coordinates',()=>{
 const f=fixture(),h=f.handle,c=f.W.colliders.find(c=>c.x===P.x&&c.z===P.z);assert(c);assert.equal(c.r,P.radius);assert.equal(h.root.position.x,P.x);assert.equal(h.root.position.z,P.z);assert.equal(h.root.rotation.y,P.rotation);
 for(const m of[h.thing,h.marker,...f.W.mapMarkers,...f.W.miniMarkers]){assert.equal(m.x,P.x);assert.equal(m.z,P.z);}assert.equal(h.thing.id,'tack-summon-stall');assert.equal(h.thing.reach,P.reach);assert.equal(h.thing.use(),true);
 const bounds=new T.Box3().setFromObject(h.root);assert(bounds.max.x< -25-circlePad);assert(bounds.min.x>pasture.x2+circlePad);assert(bounds.max.x<horse.x-1.5,'original horse-door approach strip stays open');
});
