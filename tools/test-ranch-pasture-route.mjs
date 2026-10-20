/* Actual authored-model clearance, not a claim of browser/terrain acceptance.
 * RANCH_PASTURE_SOURCE_ROOT may point at an explicit integration candidate;
 * default is the checked-out production source. No save or scene is mutated. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {register} from 'node:module';
import {pathToFileURL} from 'node:url';
const sourceRoot=process.env.RANCH_PASTURE_SOURCE_ROOT;
const rootURL=sourceRoot?pathToFileURL(sourceRoot.replace(/\/$/,'')+'/'):new URL('../',import.meta.url);
const asset=p=>new URL(p,rootURL).href;
const source=p=>readFileSync(new URL(p,rootURL),'utf8');
const core=source('ranch3d.html'),social=source('assets/features/social-play.js'),pvp=source('assets/features/events-pvp.js');
const T=await import(asset('assets/vendor/three/build/three.module.js'));
const {createRanchArchitecture}=await import(asset('assets/ranch-architecture.js'));
const {createSolidWorld}=await import(asset('assets/solid-collisions.js'));
const {RANCH_PASTURE_ROUTE:ROUTE,RANCH_PASTURE_ROAD:ROAD,RANCH_PASTURE_GATE:GATE,RANCH_GRANDSTAND:STAND,RANCH_PASTURE_TROUGH:TROUGH,ranchPastureReserved}=await import(asset('assets/ranch-pasture-route.mjs'));
const threeURL=asset('assets/vendor/three/build/three.module.js');
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return {url:${JSON.stringify(threeURL)},shortCircuit:true};return n(s,c);}`),import.meta.url);
const {createRanchBuilderArt}=await import(asset('assets/ranch-builder-art.js'));
const {installTackSummonStall,TACK_SUMMON_STALL:TACK}=await import(asset('assets/features/tack-summon-stall.js'));
const {createArrivalArt}=await import(asset('assets/ranch-arrival-art.js'));
const {installEstateOutbuildings}=await import(asset('assets/estate-outbuildings.mjs'));
const {installEstateOpenStalls}=await import(asset('assets/estate-open-stalls.mjs'));
const {buildArrivalStable}=await import(asset('assets/arrival-stable.mjs'));
const textureThree={...T,TextureLoader:class{load(){return new T.Texture();}}};
// Canvas lettering / texture IO only. All measured building geometry is real.
globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:(t,p)=>p in t?t[p]:(()=>{})})})};
function literal(s,name){const m=s.match(new RegExp('(?:const|export const) '+name+'=(?:Object.freeze\\()?((?:\\{)[^;]+?\\})(?:\\))?;'));assert(m,`${name} actual literal`);return Function(`return (${m[1]});`)();}
const pasture=literal(core,'PAST'),horse=literal(core,'SUMMON_STALL'),barn=literal(core,'BARN_ROW');
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function segDist(p,w){const dx=w.x2-w.x1,dz=w.z2-w.z1,t=Math.max(0,Math.min(1,((p.x-w.x1)*dx+(p.z-w.z1)*dz)/(dx*dx+dz*dz)));return Math.hypot(p.x-w.x1-t*dx,p.z-w.z1-t*dz);}
function geometry(){
 const scene=new T.Scene(),solid=createSolidWorld({THREE:T}),architecture=createRanchArchitecture({THREE:T,loadTextures:false});
 assert(core.includes('installEstateOutbuildings({THREE,architecture:ranchArchitecture})'));assert(core.includes('installEstateOpenStalls({THREE,architecture:ranchArchitecture})'));
 installEstateOutbuildings({THREE:T,architecture});installEstateOpenStalls({THREE:T,architecture});
 const art=createRanchBuilderArt({THREE:textureThree,GLTFLoader:class{},architecture,deferModels:true});
 const arrival=createArrivalArt({THREE:textureThree});
 const add=(g,x,z,ry=0,scale=1)=>{g.position.set(x,0,z);g.rotation.y=ry;g.scale.setScalar(scale);scene.add(g);solid.register(g,{primitives:true});return g;};
 const row=new T.Group();for(let i=0;i<barn.n;i++){const stall=architecture.buildOpenStall();stall.position.set(barn.x,0,barn.z0+i*barn.step);row.add(stall);}add(row,0,0);
 const placement=core.match(/b\.position\.set\((-16),0,(-14)\);/);assert(placement,'unchanged real main barn placement');
 const barnA=core.indexOf(' const b=ranchArchitecture.buildBarn();'),barnB=core.indexOf(' b.position.set(-16,0,-14);',barnA);assert(barnA>=0&&barnB>barnA);
 const mainBarn=Function('ranchArchitecture','buildArrivalStable','THREE',core.slice(barnA,barnB)+'return b;')(architecture,buildArrivalStable,T);add(mainBarn,+placement[1],+placement[2]);
 const shellMatch=core.match(/const shell=ranchArchitecture\.buildOutbuilding\((\{width:4\.6[^;]+\})\);/);assert(shellMatch);
 const shell=add(architecture.buildOutbuilding(Function(`return (${shellMatch[1]});`)()),horse.x,horse.z,Math.PI);
 const stand=add(art.create('grandstand'),STAND.x,STAND.z,STAND.rotation);
 const circles=[{...horse,r:2.7},{x:-6,z:-18,r:1.1},{x:TROUGH.x,z:TROUGH.z,r:TROUGH.radius},{x:-21.8,z:-12.25,r:1.2},{x:-50.7,z:-17.5,r:1.4},{x:-46,z:-4,r:.8},{x:-46,z:-6,r:1.1},{x:-36,z:-1,r:1.1}];
 assert(core.includes('colliders.push({x,z,r:2.7})'),'unchanged horse-stall physical radius');
 for(const s of['{x:-21.8,z:-12.25,r:1.2}','{x:-50.7,z:-17.5,r:1.4}','{x:-46,z:-4,r:0.8}','{x:-46,z:-6,s:1,r:0.35}','{x:-36,z:-1,s:1,r:1.6}'])assert(core.includes(s),'unchanged authored obstacle '+s);
 add(art.create('trough'),TROUGH.x,TROUGH.z,0,TROUGH.scale);
 add(art.create('trough'),-46,-6,.35,1.25);add(art.create('trough'),-36,-1,1.6,1.25);add(art.create('trough'),-6,-18,0,1.3);
 for(const [x,z,ry,scale]of[[-21.8,-13,.13,1],[-21.8,-11.5,-.18,1],[-50,-18,.15,1.15],[-51.4,-17,-.24,1]])add(art.create('haybale'),x,z,ry,scale);
 const shelter=art.create('shelter');shelter.scale.x=1.5;shelter.position.set(-59,0,-19);shelter.rotation.y=2.2;scene.add(shelter);solid.register(shelter,{primitives:true});
 // Existing practice fences/planters are not removed to make a route pass.
 const obstacles=[];for(const m of core.matchAll(/^makeJump\(([-.\d]+),([-.\d]+),([-.\d]+)\);/gm)){const x=+m[1],z=+m[2],ry=+m[3],g=arrival.buildPracticeJump();g.position.set(x,0,z);g.rotation.y=ry;g.updateWorldMatrix(true,true);obstacles.push(new T.Box3().setFromObject(g));}
 for(let i=0;i<8;i++){const th=.4+i/8*Math.PI*2,x=Math.cos(th)*24.2,z=Math.sin(th)*19.2;if(Math.abs(x)>24.5||Math.abs(z)>19.5)continue;const g=arrival.buildPlanter({width:.9,depth:.4,height:.34,seed:i+41});g.position.set(x,0,z);g.rotation.y=-th;g.updateWorldMatrix(true,true);obstacles.push(new T.Box3().setFromObject(g));}
 const wallStart=core.indexOf('[[-25,-20,NORTH_GATE.x1,-20]'),wallEnd=core.indexOf('walls.push({x1:-2.1',wallStart);assert(wallStart>=0&&wallEnd>wallStart);
 const walls=[];Function('NORTH_GATE','RANCH_PASTURE_GATE','PAST','walls',core.slice(wallStart,wallEnd))(literal(core,'NORTH_GATE'),GATE,pasture,walls);
 const posts=[{x:pasture.x2,z:-10.5,r:.075},{x:pasture.x2,z:-7.5,r:.075},{x:GATE.x,z:GATE.z1,r:.13},{x:GATE.x,z:GATE.z2,r:.13}];
 const W={groundH:()=>0,solidWorld:solid,colliders:circles,walls,mapMarkers:[],miniMarkers:[],things:[]};
 const a=core.indexOf('function addBuilding(o){'),b=core.indexOf('function mkChest(',a);assert(a>=0&&b>a);
 W.addBuilding=Function('scene','groundH','followCamera','solidWorld','colliders','nameSprite',core.slice(a,b)+'return addBuilding;')(scene,W.groundH,{register:g=>solid.register(g,{primitives:true})},solid,circles,()=>null);W.addThing=t=>{W.things.push(t);return t;};const tack=installTackSummonStall({THREE:T,world:W},()=>true);
 function reason(p,r=.75){const q={...p};if(solid.resolve(q,{bottom:-100,top:100,radius:r})||q.x!==p.x||q.z!==p.z)return 'real solid';if(circles.some(c=>!c.precise&&distance(p,c)<c.r+r))return 'circle';if(walls.some(w=>segDist(p,w)<Math.max(.08,r)))return 'rail';if(posts.some(c=>distance(p,c)<c.r+r))return 'post';if(obstacles.some(b=>p.x>b.min.x-r&&p.x<b.max.x+r&&p.z>b.min.z-r&&p.z<b.max.z+r))return 'practice fence/planter';return null;}
 return {scene,solid,stand,shell,tack,row,mainBarn,shelter,walls,circles,posts,reason};
}
const world=geometry();
function roadMesh(paths=[ROUTE]){
 const a=core.indexOf('  const cr=(p0,p1,p2,p3,t)=>'),b=core.indexOf('  const rg=new THREE.BufferGeometry();',a);assert(a>=0&&b>a,'actual production road builder');
 return Function('PATHS','RANCH_PASTURE_ROUTE','RANCH_PASTURE_ROAD','PATH_W','groundH','THREE','const rp=[],ru=[],rc=[],ri=[];'+core.slice(a,b)+'return {rp,ri};')(paths,ROUTE,ROAD,2.9,()=>0,T);
}
const mesh=roadMesh();
const p=(a,i)=>({x:a[i*3],z:a[i*3+2]});
function triangleSamples(a,b,c,step=.1){const n=Math.max(1,Math.ceil(Math.max(distance(a,b),distance(b,c),distance(c,a))/step)),out=[];for(let i=0;i<=n;i++)for(let j=0;j<=n-i;j++)out.push({x:a.x+(b.x-a.x)*i/n+(c.x-a.x)*j/n,z:a.z+(b.z-a.z)*i/n+(c.z-a.z)*j/n});return out;}

test('only the authored pasture path changes; new sampled road is immutable and reserved inside its control corridor',()=>{
 assert(Object.isFrozen(ROUTE)&&Object.isFrozen(ROAD)&&ROAD.every(Object.isFrozen));assert(ROAD.length>350&&ROAD.length<500);assert.deepEqual(ROUTE[0],[-7,3]);assert.deepEqual(ROUTE.at(-1),[-71,-10]);assert(ROUTE.some(([x,z])=>x===-33&&z===-9));
 const unchanged=['[[0,128],[0,138],[18,150],[47,171],[83,184]]','[[0,10],[13,-11],[28,-30],[44,-46],[50,-53]]','[[2,15],[7,44],[4,72],[1,98],[0,112]]','[[53,-57],[96,-70],[140,-84],[184,-97],[214,-105]]','[[-30,-20],[-33,-38],[-31,-52],[-30,-58]]'];for(const s of unchanged)assert(core.includes(s));assert(core.includes(' RANCH_PASTURE_ROUTE,'));assert(!core.includes('[[-7,3],[-26,7],[-46,2],[-63,-6],[-71,-10]]'));
 for(const [x,z,w]of ROAD){assert(Number.isFinite(x)&&Number.isFinite(z)&&w>=.75&&w<=2.7);const d=Math.min(...ROUTE.slice(1).map((b,i)=>segDist({x,z},{x1:ROUTE[i][0],z1:ROUTE[i][1],x2:b[0],z2:b[1]})));assert(d+w<3.6,'full curved ribbon stays inside existing random-vegetation reservation');}
});

test('full actual Catmull–Rom road ribbon triangles avoid authored solids, walls, gateposts and retained practice props',()=>{
 assert.equal(mesh.rp.length,ROAD.length*9*3);let samples=0;const before=world.solid.stats();
 for(let i=0;i<mesh.ri.length;i+=3){const [a,b,c]=mesh.ri.slice(i,i+3).map(n=>p(mesh.rp,n));for(const q of triangleSamples(a,b,c)){assert.equal(world.reason(q,.04),null,`ribbon at ${JSON.stringify(q)}`);samples++;}}
 assert(samples>25000);assert.deepEqual(world.solid.stats(),before);assert.equal(mesh.rp[1],.025,'road still follows provided ground height');
});

test('same continuous route is rideable in both directions with a .75m capsule and no teleport or collision bypass',()=>{
 for(const path of[ROAD,[...ROAD].reverse()])for(let i=1;i<path.length;i++){const a={x:path[i-1][0],z:path[i-1][1]},b={x:path[i][0],z:path[i][1]},n=Math.max(1,Math.ceil(distance(a,b)/.025));for(let k=0;k<=n;k++){const q={x:a.x+(b.x-a.x)*k/n,z:a.z+(b.z-a.z)*k/n};assert.equal(world.reason(q),null,`mounted centre at ${JSON.stringify(q)}`);}}
 const oldWest={x:-25,z:6.789473684210526};assert(world.walls.some(w=>w.x1===-33&&w.x2===-33),'real pasture east fence retained');assert(world.reason({x:-33,z:4.6}),'old painted road crosses retained closed pasture wall');assert(world.reason({x:-30,z:7.5})===null,'the former pavilion blocker is actually relocated');
 assert(segDist(oldWest,{x1:-25,z1:-20,x2:-25,z2:20})===0,'old route really crossed the former west wall');
});

test('west rendered rails/posts and physical walls share the opening; kickboard pieces cannot visually close it',()=>{
 assert.equal(GATE.x,-25);assert.equal(GATE.z2-GATE.z1,8);assert(core.includes('rail(-X,-Z,-X,RANCH_PASTURE_GATE.z1,y);rail(-X,RANCH_PASTURE_GATE.z2,-X,Z,y)'));assert(core.includes('if(z<RANCH_PASTURE_GATE.z1||z>RANCH_PASTURE_GATE.z2)posts.push([-X,z])'));assert(core.includes('posts.push([RANCH_PASTURE_GATE.x,RANCH_PASTURE_GATE.z1],[RANCH_PASTURE_GATE.x,RANCH_PASTURE_GATE.z2])'));
 assert(world.walls.some(w=>w.x1===GATE.x&&w.z2===GATE.z1));assert(world.walls.some(w=>w.x1===GATE.x&&w.z1===GATE.z2));assert(!world.walls.some(w=>w.x1===-25&&w.x2===-25&&w.z1<3&&w.z2>3));
 const line=core.split('\n').find(s=>s.includes('continue; // keep complete kickboard'));assert(line);const skip=Function('x','z','RANCH_PASTURE_GATE',line.replace('continue; // keep complete kickboard segments clear of all three approaches','return true;')+'return false;');
 for(let i=0;i<40;i++){const th=i/40*Math.PI*2,x=Math.cos(th)*23.2,z=Math.sin(th)*18.2;if(x< -21&&z>-1&&z<8)assert(skip(x,z,GATE),'real kickboard render skip at '+i);}
});

test('pavilion geometry, precise collision, both spectator cameras, interaction and map use the same moved anchor',()=>{
 assert.deepEqual([world.stand.position.x,world.stand.position.z,world.stand.rotation.y],[STAND.x,STAND.z,STAND.rotation]);assert(world.solid.hasParts(world.stand));assert(core.includes('scene.add(bl);followCamera.register(bl)'));assert(core.includes('...[-4.3,0,4.3].map(dz=>({x:RANCH_GRANDSTAND.x-1.5,z:RANCH_GRANDSTAND.z+dz,r:2.6,precise:true}))'));
 assert(pvp.includes('const SEAT=RANCH_GRANDSTAND;'));assert(social.includes('x:RANCH_GRANDSTAND.seatX,y:3.0,z:RANCH_GRANDSTAND.z'));assert(social.includes("id:'arena-stand',x:RANCH_GRANDSTAND.x,z:RANCH_GRANDSTAND.z"));assert(social.includes("W.mapMarkers.push({x:RANCH_GRANDSTAND.x,z:RANCH_GRANDSTAND.z"));
 for(const s of[pvp,social])assert(!s.includes('z:7.5'),'no old local spectator anchor');const box=new T.Box3().setFromObject(world.stand);assert(box.min.z>8);assert(box.max.z<pasture.z2);
});

test('summoning stalls, original ceremony/fast travel and pasture gate remain; trough keeps real matching relocated geometry/collision',()=>{
 assert.deepEqual(horse,{x:-27.5,z:-4.5});assert.equal(TACK.x,-29.8);assert.equal(TACK.z,-9.4);assert.equal(world.tack.root.position.x,TACK.x);assert.equal(world.tack.root.position.z,TACK.z);
 const ceremony=source('assets/features/tack-summon-ceremony.js'),arrival=literal(ceremony,'TACK_STALL_ARRIVAL');assert.deepEqual([arrival.x,arrival.z],[-27.5,-8.2]);assert.equal(world.reason(arrival,.55),null);
 assert(core.includes("placeRanchProp('trough',RANCH_PASTURE_TROUGH.x,RANCH_PASTURE_TROUGH.z,0,RANCH_PASTURE_TROUGH.scale)"));assert(core.includes('{x:RANCH_PASTURE_TROUGH.x,z:RANCH_PASTURE_TROUGH.z,r:RANCH_PASTURE_TROUGH.radius}'));assert(world.reason({x:TROUGH.x,z:TROUGH.z}),'new trough remains collidable');assert(!core.includes("placeRanchProp('trough',-36.5,-9.5"));
 assert(core.includes('prailSeg(PAST.x2,PAST.z1,PAST.x2,-11.2,y)'));assert(core.includes('prailSeg(PAST.x2,-6.8,PAST.x2,PAST.z2,y)'));assert(core.includes('for(const z of[-10.5,-7.5])tube(.065,.075,2.82'));
});

test('unrelated road renderer keeps original Catmull–Rom sample count and width wobble',()=>{
 const path=[[20,50],[24,62],[40,70]],out=roadMesh([path]),n=path.slice(1).reduce((sum,b,i)=>sum+Math.max(3,Math.round(Math.hypot(b[0]-path[i][0],b[1]-path[i][1])/1.6)),1);assert.equal(out.rp.length,n*9*3);const width=Math.hypot(out.rp[0]-out.rp[24],out.rp[2]-out.rp[26]);assert(Math.abs(width-2*2.9*.94)<1e-10);assert.equal(out.ri.length,(n-1)*8*6);
});


test('random scenery reservation protects the curved route and moved pavilion without removing fixed props or changing draw order',()=>{
 for(const [x,z,w] of ROAD)assert(ranchPastureReserved(x,z,w));assert(ranchPastureReserved(STAND.x,STAND.z,1));assert(!ranchPastureReserved(120,120,1));assert(!ranchPastureReserved(NaN,0));
 const a=core.indexOf("for(const name of ['oak','birch','blossom','pine','snowpine','bush','flowerbush','boulder','stump'])"),b=core.indexOf('const PROP_SRC={};',a);assert(a>=0&&b>a);const code=core.slice(a,b);assert(!code.includes('Math.random'));
 const names=['oak','birch','blossom','pine','snowpine','bush','flowerbush','boulder','stump'];const FOLIAGE=Object.fromEntries(names.map(n=>[n,[]]));const tree={x:-60,z:-10,s:1},rock={x:STAND.x,z:STAND.z,s:1},kept={x:120,z:120,s:1},fixed={x:-46,z:-6,s:1};FOLIAGE.oak.push(tree,kept);FOLIAGE.boulder.push(rock);FOLIAGE.trough=[fixed];const colliders=[{...tree,r:.8},{...rock,r:1},{...kept,r:.8}];
 Function('FOLIAGE','colliders','cottonwoodTrackDistance','ranchPastureReserved',code)(FOLIAGE,colliders,()=>Infinity,ranchPastureReserved);assert.deepEqual(FOLIAGE.oak,[kept]);assert.deepEqual(FOLIAGE.boulder,[]);assert.deepEqual(FOLIAGE.trough,[fixed]);assert.deepEqual(colliders,[{...kept,r:.8}]);
 const treeA=core.indexOf('function cheapTree(x,z,s){'),treeB=core.indexOf('for(let g=0;g<8;g++){',treeA);let made=0,added=0;const remaining=[];const cheap=Function('cottonwoodReserved','ranchPastureReserved','makeNaturalTree','THREE','groundH','scene','STATIC_MERGE','colliders',core.slice(treeA,treeB)+'return cheapTree;')(()=>false,ranchPastureReserved,()=>{made++;return {position:{set(){}}};},T,()=>0,{add(){added++;}},[],remaining);cheap(-60,-10,1);assert.equal(made,0);cheap(120,120,1);assert.equal(added,1);assert.equal(remaining.length,1);
 const shrubA=core.indexOf('for(let i=0;i<44;i++){',treeB),shrubB=core.indexOf('const gltfBirds=[];',shrubA);const shrubCode=core.slice(shrubA,shrubB);assert(shrubCode.includes('const shrubScale=.8+Math.random()*.3;'));
 function shrubs(reserved){let draws=0,n=91;const positions=[];const math=Object.create(Math);math.random=()=>{draws++;n=(Math.imul(n,1664525)+1013904223)>>>0;return n/2**32;};Function('Math','inCoyote','inSnow','riverZ','makeNaturalShrub','THREE','groundH','scene','STATIC_MERGE','ranchPastureReserved',shrubCode)(math,()=>false,()=>false,()=>1e6,()=>({position:{set(x,y,z){positions.push([x,z]);}}}),T,()=>0,{add(){}},[],reserved);return {draws,positions};}
 const original=shrubs(()=>false),reserved=shrubs(ranchPastureReserved);assert.equal(reserved.draws,original.draws);assert(reserved.positions.every(p=>original.positions.some(q=>p[0]===q[0]&&p[1]===q[1])));
});


test('current estate model dressers and upstream east/south arena openings survive the west-route repair',()=>{
 assert(world.mainBarn.userData.arrivalStable);assert(world.shell.userData.estateOutbuilding);assert(world.stand.userData.estateGrandstand);assert(world.shelter.userData.estateShelter);assert.equal(world.row.children.length,barn.n);assert(world.row.children.every(g=>g.userData.estateOpenStall));
 assert(core.includes('rail(3,Z,15,Z,y);'));assert(core.includes('rail(X,-Z,X,7.5,y);'));assert(core.includes('if((p[0]===X&&p[1]>7.5)||(p[1]===Z&&p[0]>15))m4.makeScale(0,0,0);'));assert(world.walls.some(w=>w.x1===25&&w.z1===-20&&w.z2===7.5));assert(world.walls.some(w=>w.z1===20&&w.x1===3&&w.x2===15));
 // Current visible replacements may not widen beyond the inherited proxies into
 // the new road. A whole-model XZ box is deliberately stricter than the mesh.
 const boxes=[world.mainBarn,world.row,world.shell,world.stand,world.shelter,world.tack.root].map(g=>new T.Box3().setFromObject(g));
 for(let i=0;i<mesh.rp.length;i+=3){const x=mesh.rp[i],z=mesh.rp[i+2];for(const b of boxes)assert(!(x>b.min.x&&x<b.max.x&&z>b.min.z&&z<b.max.z),`new visible estate model overlaps road at ${x},${z}`);}
});
