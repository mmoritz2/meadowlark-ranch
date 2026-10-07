import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRoadsideBenchGeometry,fitRoadsideBenchGeometry,ROADSIDE_BENCH_SPEC as S} from '../assets/roadside-prop-geometry.mjs';
const bench=createRoadsideBenchGeometry();
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);};
const local=(p,c)=>c.axes.map(a=>dot(sub(p,c.origin),a));
const vertex=(g,i)=>Array.from(g.positions.slice(i*3,i*3+3));
const near=(a,b,e=2e-7)=>assert.ok(Math.abs(a-b)<=e,`${a} differs from ${b}`);
const yaw=(p,a,origin=[0,0,0])=>[origin[0]+Math.cos(a)*p[0]+Math.sin(a)*p[2],origin[1]+p[1],origin[2]-Math.sin(a)*p[0]+Math.cos(a)*p[2]];
function contains(c,p,eps=1e-7){
 const q=local(p,c),s=c.shape;
 if(s.type==='roundedBox'){
  const inner=s.size.map(v=>v/2-s.bevel),outside=q.map((v,i)=>Math.max(0,Math.abs(v)-inner[i]));
  return Math.hypot(...outside)<=s.bevel+eps;
 }
 if(s.type==='cylinder'){
  if(Math.abs(q[1])>s.height/2+eps)return false;
  let radius=s.radius;
  if(s.bevel){const edge=(s.height/2-Math.abs(q[1]))/s.bevel;radius*=.82+.18*Math.max(0,Math.min(1,edge));}
  return Math.hypot(q[0],q[2])<=radius+eps;
 }
 throw Error('Unknown component shape');
}

test('bench geometry is finite, outward, closed and bounded at riding scale',()=>{
 assert.deepEqual(Object.keys(bench.groups),['wood','aged','iron']);assert.ok(bench.triangles<3000);assert.ok(bench.triangles>1000);
 assert.equal(bench.triangles,2944);assert.ok(bench.footprintRadius<=S.footprintRadius);near(bench.bounds.min[1],0);assert.ok(bench.bounds.max[1]<1.03);
 for(const [material,g]of Object.entries(bench.groups)){
  assert.ok(g.positions instanceof Float32Array&&g.normals instanceof Float32Array&&g.uvs instanceof Float32Array&&g.indices instanceof Uint32Array);
  assert.equal(g.positions.length,g.normals.length);assert.equal(g.uvs.length,g.positions.length/3*2);
  for(const a of [g.positions,g.normals,g.uvs])assert.ok(a.every(Number.isFinite));
  for(let i=0;i<g.normals.length;i+=3)near(Math.hypot(...g.normals.slice(i,i+3)),1);
  for(let i=0;i<g.indices.length;i+=3){
   const [a,b,c]=g.indices.slice(i,i+3);assert.ok([a,b,c].every(v=>v<g.positions.length/3));
   const normal=cross(sub(vertex(g,b),vertex(g,a)),sub(vertex(g,c),vertex(g,a))),area=Math.hypot(...normal);
   assert.ok(area>1e-11,'No degenerate triangle');
   const smooth=[0,1,2].map(k=>g.normals[a*3+k]+g.normals[b*3+k]+g.normals[c*3+k]);
   assert.ok(dot(norm(normal),norm(smooth))>.85,`Outward geometric and authored normals disagree in ${material}`);
   const au=g.uvs[a*2],av=g.uvs[a*2+1],bu=g.uvs[b*2],bv=g.uvs[b*2+1],cu=g.uvs[c*2],cv=g.uvs[c*2+1];
   assert.ok(Math.abs((bu-au)*(cv-av)-(cu-au)*(bv-av))>1e-12,'All faces, including endgrain, need a nonsingular UV area');
  }
 }
 // Position welding exposes actual shape boundaries despite normal/UV seams.
 // Every independent closed timber/fastener volume has two uses per edge.
 for(const c of bench.components){
  const g=bench.groups[c.material],edges=new Map(),key=i=>vertex(g,i).map(v=>Math.round(v*1e6)).join(',');
  for(let i=c.indexStart;i<c.indexStart+c.indexCount;i+=3){const ids=Array.from(g.indices.slice(i,i+3)).map(key);for(let k=0;k<3;k++){const edge=[ids[k],ids[(k+1)%3]].sort().join('|');edges.set(edge,(edges.get(edge)||0)+1);}}
  assert.ok([...edges.values()].every(count=>count===2),`Open/nonmanifold boundary on ${c.id}`);
 }
});

test('all supports and fasteners physically join one connected bench, not detached boxes',()=>{
 const parts=new Map(bench.components.map(c=>[c.id,c])),graph=new Map(bench.components.map(c=>[c.id,[]]));
 assert.equal(bench.components.filter(c=>c.kind==='leg').length,4);assert.equal(bench.components.filter(c=>c.kind==='bearer').length,2);
 assert.equal(bench.components.filter(c=>c.kind==='backPost').length,2);assert.equal(bench.components.filter(c=>c.kind==='brace').length,2);
 assert.equal(bench.components.filter(c=>c.kind==='seatSlat').length,4);assert.equal(bench.components.filter(c=>c.kind==='backSlat').length,2);
 assert.equal(bench.components.filter(c=>c.kind==='boltHead').length,14);
 for(const a of bench.attachments){
  const first=parts.get(a.a),second=parts.get(a.b);assert.ok(first&&second);
  assert.ok(contains(first,a.point),`Joint leaves ${a.a}`);assert.ok(contains(second,a.point),`Joint leaves ${a.b}`);
  graph.get(a.a).push(a.b);graph.get(a.b).push(a.a);
 }
 const seen=new Set(),queue=['leg:left:front'];while(queue.length){const id=queue.shift();if(seen.has(id))continue;seen.add(id);queue.push(...graph.get(id));}
 assert.equal(seen.size,bench.components.length,'Every slat, brace and metal fastener must connect to the foot-supported frame');
 for(const c of bench.components.filter(c=>c.kind==='leg'))near(c.bounds.min[1],0);
 for(const c of bench.components.filter(c=>c.kind==='seatSlat'))near(c.bounds.max[1],S.seatHeight);
 for(const c of bench.components.filter(c=>c.kind==='backSlat'))assert.ok(c.axes[1][2]<0,'A reclined back goes behind the seat as it rises');
});

test('the same local bench fits its existing circle and stays attached at arbitrary authored yaws',()=>{
 const origin=[-202.43818784289377,3.17,-235.45151409810353];
 for(const angle of [0,Math.PI/2,Math.PI,-1.6536755063023536,.37,-2.7,7.4]){
  for(const g of Object.values(bench.groups))for(let i=0;i<g.positions.length/3;i++){
   const p=vertex(g,i),world=yaw(p,angle,origin);assert.ok(Math.hypot(world[0]-origin[0],world[2]-origin[2])<.85+1e-7);near(world[1]-origin[1],p[1]);
  }
  for(const c of bench.components.filter(c=>c.kind==='leg')){
   const root=[c.origin[0],0,c.origin[2]],world=yaw(root,angle,origin);near(world[1],origin[1]);
  }
  for(const a of bench.attachments){
   const world=yaw(a.point,angle,origin),restored=[Math.cos(angle)*(world[0]-origin[0])-Math.sin(angle)*(world[2]-origin[2]),world[1]-origin[1],Math.sin(angle)*(world[0]-origin[0])+Math.cos(angle)*(world[2]-origin[2])];
   assert.ok(contains(bench.components.find(c=>c.id===a.a),restored));assert.ok(contains(bench.components.find(c=>c.id===a.b),restored));
  }
 }
});

test('each board uses metre-scaled grain along its own length and analytic rounded-edge normals',()=>{
 for(const c of bench.components.filter(c=>c.shape.type==='roundedBox')){
  const g=bench.groups[c.material],r=c.shape.bevel,inner=c.shape.size.map(v=>v/2-r);
  for(const f of c.faces)for(let i=f.vertexStart;i<f.vertexStart+f.vertexCount;i++){
   const p=local(vertex(g,i),c),n=c.axes.map(a=>dot(Array.from(g.normals.slice(i*3,i*3+3)),a));
   const closest=p.map((v,k)=>Math.max(-inner[k],Math.min(inner[k],v))),gradient=norm(sub(p,closest));assert.ok(dot(n,gradient)>.999999,'Normal follows the rounded surface, not the original box');
   let expected;
   if(f.grainFace){const across=[0,1,2].find(k=>k!==f.axis&&k!==c.grainAxis);expected=[p[c.grainAxis]/c.grainMetres+c.uvPhase[0],p[across]/c.grainMetres+c.uvPhase[1]];}
   else{const end=[0,1,2].filter(k=>k!==c.grainAxis);expected=[p[end[0]]/c.grainMetres+c.uvPhase[0],p[end[1]]/c.grainMetres+c.uvPhase[1]];}
   near(g.uvs[i*2],expected[0]);near(g.uvs[i*2+1],expected[1]);
  }
  assert.equal(c.grainMetres,c.material==='wood'?.74:1.8);
 }
 const seats=bench.components.filter(c=>c.kind==='seatSlat'),g=bench.groups.wood;
 assert.equal(new Set(seats.map(c=>c.uvPhase.join(','))).size,seats.length,'Seat boards use different authored grain cuts');
 for(const c of seats){const face=c.faces.find(f=>f.axis===1&&f.sign===1),us=Array.from(g.uvs.slice(face.vertexStart*2,(face.vertexStart+face.vertexCount)*2)).filter((_,i)=>i%2===0);assert.ok(Math.max(...us)-Math.min(...us)>2,'Long bench slats must show multiple metres-scaled grain lengths');}
});

test('pure geometry consumes no random stream or resources and callers own independent array data',()=>{
 const source=readFileSync(new URL('../assets/roadside-prop-geometry.mjs',import.meta.url),'utf8');
 assert.ok(!/^\s*import\b/m.test(source));assert.ok(!/\b(?:THREE|Math\.random|recordSolidPart|Texture|Mesh|document|window)\b/.test(source));
 const original=Math.random;Math.random=()=>{throw Error('Geometry consumed world RNG');};let a,b;
 try{a=createRoadsideBenchGeometry();b=createRoadsideBenchGeometry();}finally{Math.random=original;}
 assert.deepEqual(a,b);
 for(const key of Object.keys(a.groups)){
  assert.notEqual(a.groups[key].positions,b.groups[key].positions);assert.notEqual(a.groups[key].indices,b.groups[key].indices);
  const before=b.groups[key].positions[0];a.groups[key].positions[0]=77;assert.equal(b.groups[key].positions[0],before);
 }
 for(const c of bench.components){const g=bench.groups[c.material];assert.ok(c.vertexStart+c.vertexCount<=g.positions.length/3&&c.indexStart+c.indexCount<=g.indices.length);assert.ok(c.matrix.every(Number.isFinite));}
});

const fittingPlacements=heightAt=>[
 {x:-202.43818784289377,z:-235.45151409810353,yaw:-1.6536755063023536},
 {x:236.8769,z:260.2204,yaw:.85},
 {x:83.174,z:-101.76,yaw:3.4},
].map(p=>({...p,y:heightAt(p.x,p.z),visible:true}));
const tiltedGround=(x,z)=>2+.13*x+.04*z;
const curvedGround=(x,z)=>2+.06*Math.sin(x*.31)+.08*Math.cos(z*.37)+.025*Math.sin(x*.72)*Math.sin(z*.57);

test('baked bench feet meet independently sampled tilted and curved ground at all authored yaws',()=>{
 for(const heightAt of [tiltedGround,curvedGround]){
  const placements=fittingPlacements(heightAt),data=fitRoadsideBenchGeometry(bench,placements,heightAt);
  assert.equal(data.stats.visibleSites,3);assert.equal(data.stats.triangles,bench.triangles*3);assert.equal(data.stats.fitHeight,.16);assert.equal(data.stats.embed,.001);
  assert.ok(data.stats.geometryBytes<400000,'Three fitted benches retain a small shared material batch budget');
  assert.ok(data.stats.minVerticalScale>0&&data.stats.maxContactError<1e-5);
  for(const [i,site]of data.sites.entries()){
   const p=placements[i];assert.deepEqual([site.x,site.y,site.z,site.yaw],[p.x,p.y,p.z,p.yaw]);assert.equal(site.footContacts.length,4);assert.ok(site.footprintRadius<.85);
   for(const foot of site.footContacts){
    assert.equal(foot.material,'wood');assert.equal(foot.bottomContactCount,4);assert.ok(foot.minVerticalScale>0);
    for(const index of foot.vertexIndices){
     const world=vertex(data.groups.wood,index);near(world[1]-heightAt(world[0],world[2]),-.001,1e-5);
     const range=site.groups.wood;assert.ok(index>=range.vertexStart&&index<range.vertexStart+range.vertexCount);
    }
   }
   for(const [key,g]of Object.entries(data.groups)){
    const range=g.sites[i];assert.deepEqual([range.x,range.y,range.z,range.yaw],[p.x,p.y,p.z,p.yaw]);assert.ok(range.vertexStart+range.vertexCount<=g.positions.length/3);assert.ok(range.indexStart+range.indexCount<=g.indices.length);
    for(let j=range.indexStart;j<range.indexStart+range.indexCount;j++)assert.ok(g.indices[j]>=range.vertexStart&&g.indices[j]<range.vertexStart+range.vertexCount);
    for(let j=range.vertexStart;j<range.vertexStart+range.vertexCount;j++){
     const world=vertex(g,j);assert.ok(Math.hypot(world[0]-p.x,world[2]-p.z)<.85);near(Math.hypot(...g.normals.slice(j*3,j*3+3)),1);
    }
    for(const a of [g.positions,g.normals,g.uvs])assert.ok(a.every(Number.isFinite));
   }
  }
 }
});

test('fitting preserves every upper support, back, seat, fastener, UV and placement without stretching the upper grain',()=>{
 const snapshot=structuredClone(bench),placements=fittingPlacements(tiltedGround),data=fitRoadsideBenchGeometry(bench,placements,tiltedGround);
 assert.deepEqual(bench,snapshot,'The reusable template must remain owned and unchanged');
 for(const [siteIndex,p]of placements.entries())for(const c of bench.components){
  const source=bench.groups[c.material],g=data.groups[c.material],range=g.sites[siteIndex];
  for(let i=c.vertexStart;i<c.vertexStart+c.vertexCount;i++){
   const before=vertex(source,i),worldIndex=range.vertexStart+i;
   assert.deepEqual(Array.from(g.uvs.slice(worldIndex*2,worldIndex*2+2)),Array.from(source.uvs.slice(i*2,i*2+2)));
   if(c.kind==='leg'&&before[1]<.16-1e-7)continue;
   const expected=yaw(before,p.yaw,[p.x,p.y,p.z]).map(Math.fround);assert.deepEqual(vertex(g,worldIndex),expected);
   const n=Array.from(source.normals.slice(i*3,i*3+3)),rotated=yaw(n,p.yaw).map(Math.fround);for(let k=0;k<3;k++)near(g.normals[worldIndex*3+k],rotated[k],0);
  }
 }
 for(const c of bench.components.filter(c=>c.kind==='leg')){
  const g=bench.groups.wood;let splitVertices=0;
  for(let i=c.vertexStart;i<c.vertexStart+c.vertexCount;i++)if(Math.abs(g.positions[i*3+1]-.16)<1e-7)splitVertices++;
  assert.ok(splitVertices>=16,'A real fixed-height ring bounds the deformation and UV interpolation');
  for(let i=c.indexStart;i<c.indexStart+c.indexCount;i+=3){const ys=Array.from(g.indices.slice(i,i+3),v=>g.positions[v*3+1]);assert.ok(!(Math.min(...ys)<.16-1e-7&&Math.max(...ys)>.16+1e-7),'A side triangle must not spread foot fitting above the fixed ring');}
 }
});

test('fitted timber normals agree with independent finite-difference tangent Jacobians and outward triangle areas',()=>{
 for(const heightAt of [tiltedGround,curvedGround]){
  const placements=fittingPlacements(heightAt),data=fitRoadsideBenchGeometry(bench,placements,heightAt),eps=.0002;
  for(const [siteIndex,p]of placements.entries()){
   const g=data.groups.wood,range=g.sites[siteIndex],phi=world=>{const y=world[1]-p.y,w=1-y/.16;return [world[0],p.y+y+w*(heightAt(world[0],world[2])-p.y-.001),world[2]];};
   for(const leg of bench.components.filter(c=>c.kind==='leg'))for(let i=leg.vertexStart;i<leg.vertexStart+leg.vertexCount;i++){
    const source=vertex(bench.groups.wood,i);if(source[1]>=.16-1e-7)continue;
    const base=yaw(source,p.yaw,[p.x,p.y,p.z]);base[0]=Math.fround(base[0]);base[2]=Math.fround(base[2]);
    const n=yaw(Array.from(bench.groups.wood.normals.slice(i*3,i*3+3)),p.yaw),seed=Math.abs(n[0])<.9?[1,0,0]:[0,0,1],t1=norm(cross(n,seed)),t2=norm(cross(n,t1));
    const transformed=t=>phi(base.map((v,k)=>v+eps*t[k])).map((v,k)=>v-phi(base.map((v,j)=>v-eps*t[j]))[k]);
    const expected=norm(cross(transformed(t1),transformed(t2))),actual=Array.from(g.normals.slice((range.vertexStart+i)*3,(range.vertexStart+i)*3+3));
    assert.ok(dot(expected,actual)>.999999,'Normal must follow the measured world-space fitting Jacobian');
   }
  }
  for(const g of Object.values(data.groups))for(let i=0;i<g.indices.length;i+=3){
   const [a,b,c]=g.indices.slice(i,i+3),area=cross(sub(vertex(g,b),vertex(g,a)),sub(vertex(g,c),vertex(g,a)));
   assert.ok(Math.hypot(...area)>1e-11,'Fitting must not collapse a triangle');
   const normal=[0,1,2].map(k=>g.normals[a*3+k]+g.normals[b*3+k]+g.normals[c*3+k]);assert.ok(dot(norm(area),norm(normal))>.80,'Normals must face the fitted visible surface');
  }
 }
});

test('fitting rejects inverted or invalid feet, keeps hidden sites empty and consumes no randomness',()=>{
 assert.throws(()=>fitRoadsideBenchGeometry(bench,[{x:0,y:0,z:0,yaw:0}],()=>1),/invert/);
 assert.throws(()=>fitRoadsideBenchGeometry(bench,[{x:0,y:0,z:0,yaw:NaN}],()=>0),/Nonfinite/);
 assert.throws(()=>fitRoadsideBenchGeometry(bench,[{x:0,y:0,z:0,yaw:0}],()=>NaN),/Nonfinite/);
 const placements=[{x:10,y:1,z:20,yaw:.8,visible:false}],random=Math.random;Math.random=()=>{throw Error('Fitting consumed world RNG');};let hidden;
 try{hidden=fitRoadsideBenchGeometry(bench,placements,()=>1);}finally{Math.random=random;}
 assert.equal(hidden.sites.length,1);assert.equal(hidden.stats.visibleSites,0);assert.equal(hidden.stats.geometryBytes,0);
 for(const g of Object.values(hidden.groups)){assert.equal(g.positions.length,0);assert.equal(g.indices.length,0);assert.equal(g.sites[0].vertexCount,0);assert.ok([...g.bounds.min,...g.bounds.max].every(Number.isFinite));}
});
