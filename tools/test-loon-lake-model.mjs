import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
const root=process.env.LOON_LAKE_SOURCE_ROOT||new URL('../',import.meta.url).pathname,dep=process.env.LOON_LAKE_DEPENDENCY_ROOT||root,fixture=new URL('./fixtures/loon-lake-0d867b4/',import.meta.url),read=f=>fs.readFileSync(new URL(f,fixture)),sha=b=>createHash('sha256').update(b).digest('hex');
const meta=JSON.parse(read('actual-inputs.json')),recipes=JSON.parse(read('source-edits.json')),html=fs.readFileSync(path.join(root,'ranch3d.html'),'utf8'),waterSource=fs.readFileSync(path.join(root,'assets/features/world-water.js'),'utf8');
const lake=await import(pathToFileURL(path.join(root,'assets/loon-lake.mjs')).href),art=await import(pathToFileURL(path.join(root,'assets/loon-lake-art.mjs')).href),T=await import(pathToFileURL(path.join(dep,'assets/vendor/three/build/three.module.js')).href);
const bytes=read('canonical-terrain.f32'),before=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4),after=Float32Array.from(meta.terrain.rawParentNodeHeights,(h,i)=>lake.loonLakeTerrainHeight((meta.terrain.originIndex[0]+i%meta.terrain.width)*meta.terrain.step-500,(meta.terrain.originIndex[1]+Math.floor(i/meta.terrain.width))*meta.terrain.step-500,h));
function sample(a,x,z){const{originIndex:[ox,oz],width:n,height:m,step}=meta.terrain,gx=(x+500)/step-ox,gz=(z+500)/step-oz,ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,i=iz*n+ix;assert.ok(ix>=0&&iz>=0&&ix<n-1&&iz<m-1,'Within actual canonical tile');return u+v<=1?a[i]+(a[i+1]-a[i])*u+(a[i+n]-a[i])*v:a[i+n+1]+(a[i+n]-a[i+n+1])*(1-u)+(a[i+1]-a[i+n+1])*(1-v);}
const height=(x,z)=>sample(after,x,z),old=(x,z)=>sample(before,x,z),runtime=lake.createLoonLakeRuntime({terrainH:height,groundH:height}),model=art.buildLoonLakeLandscape({terrainH:height});
let parentHtml=html;
for(const e of recipes['ranch3d.html'].changes.slice().reverse())parentHtml=parentHtml.split(e.after).join(e.before);
test('counted functional edits restore both exact production preimages and retain shared plain reflection shader',()=>{
 for(const[name,r]of Object.entries(recipes)){let s=fs.readFileSync(path.join(root,name),'utf8');assert.equal(sha(s),r.afterSHA256);for(const e of r.changes.slice().reverse()){assert.equal(s.split(e.after).length-1,e.occurrences);s=s.split(e.after).join(e.before);}assert.equal(sha(s),r.beforeSHA256);}
 assert.ok(html.indexOf('const loonLake=createLoonLakeRuntime')<html.indexOf('const okGrass='));assert.ok(html.includes('pondMat.onBeforeCompile=waterMat.userData.plainShader'));assert.ok(waterSource.includes('dressRiverBankMaterial(P.lakeShore.material'));assert.ok(html.includes('const gy=lakeSwimSurface??groundH(player.pos.x,player.pos.z)'));assert.ok(html.includes("mc.fill('evenodd')"));
});
test('actual canonical input is bound and the changed physical grid preserves sand, roots, routes and plots',()=>{
 assert.equal(sha(bytes),meta.terrain.sha256);assert.equal(before.length,meta.terrain.width*meta.terrain.height);let changed=0;
 for(let i=0;i<before.length;i++){assert.equal(Math.fround(meta.terrain.rawParentNodeHeights[i]),before[i]);if(after[i]!==before[i]){changed++;const x=(meta.terrain.originIndex[0]+i%meta.terrain.width)*meta.terrain.step-500,z=(meta.terrain.originIndex[1]+Math.floor(i/meta.terrain.width))*meta.terrain.step-500;assert.ok(x>11&&x<52&&z>2&&z<28);}}
 assert.ok(changed>100&&changed<250);for(let a=0;a<360;a++)for(const r of [.8,.9,1]){const x=Math.cos(a*Math.PI/180)*23.5*r,z=Math.sin(a*Math.PI/180)*18.5*r;if(x<8||z<0)continue;assert.equal(height(x,z),old(x,z),'Actual oval triangle footing stays exact');}
 for(const t of meta.trees.filter(t=>t.x>35&&t.x<46&&t.z>5&&t.z<20))assert.equal(height(t.x,t.z),old(t.x,t.z));
 for(const p of meta.route)if(p[0]>=8&&p[0]<68&&p[1]>=0&&p[1]<53)assert.equal(height(...p),old(...p));assert.equal(height(13.5,14.5),old(13.5,14.5));
});
test('every packed face stays within its original canonical triangle and shore clears the entire physical plane',()=>{
 const step=meta.terrain.step;
 for(const[name,g]of Object.entries({water:model.water,shore:model.shore})){
  assert.equal(g.normal.length,g.position.length);assert.equal(g.color.length,g.position.length/3*4);assert.ok(g.position.every(Number.isFinite));
  for(let f=0;f<g.index.length/3;f++){
   const cell=g.sourceCells[f],square=Math.floor(cell/2),ix=square%512,iz=Math.floor(square/512),side=cell%2;const vs=[];
   for(let k=0;k<3;k++){const i=g.index[f*3+k]*3,p=Array.from(g.position.subarray(i,i+3)),u=(p[0]+500)/step-ix,v=(p[2]+500)/step-iz;assert.ok(u>=-3e-6&&v>=-3e-6&&u<=1.000003&&v<=1.000003);assert.ok(side?u+v>=.999997:u+v<=1.000003);assert.ok(g.normal[i+1]>.5);vs.push(p);}
   for(const p of [...vs,vs[0].map((v,k)=>(v+vs[1][k]+vs[2][k])/3)]){const gap=p[1]-height(p[0],p[2]);if(name==='shore')assert.ok(gap>.01798&&gap<.01802);else assert.ok(gap>=-.00001);}
  }
 }
});
test('the new east basin has real depth, unequal island exclusion and a dry actual dock floor',()=>{
 let area=0,newArea=0;const g=model.water;
 for(let i=0;i<g.index.length;i+=3){const p=[0,1,2].map(k=>Array.from(g.position.subarray(g.index[i+k]*3,g.index[i+k]*3+3))),[a,b,c]=p,A=Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))/2;area+=A;if((a[0]+b[0]+c[0])/3>26)newArea+=A;}
 assert.ok(area>250&&area<400&&newArea>180);assert.ok(runtime.waterAt(30,14).depth>.7);assert.equal(runtime.waterAt(38.35271181763609,15.476611638451018),null);assert.equal(runtime.containsWater(38.35271181763609,15.476611638451018),false);
 const dock=meta.owners.find(o=>o.role==='jetty'),e=dock.matrixWorld,cx=e[12],cz=e[14],deck=lake.createLoonLakeRuntime({terrainH:height,groundH:(x,z)=>{const dx=x-cx,dz=z-cz,lx=e[0]*dx+e[2]*dz,lz=e[8]*dx+e[10]*dz;return Math.abs(lx)<=.8&&Math.abs(lz)<=2.5?dock.position[1]:height(x,z);}});assert.ok(height(cx,cz)<dock.position[1]);assert.equal(deck.waterAt(cx,cz),null);
});
test('resident geometry replacement retains owner UUIDs and consumes no global random calls',()=>{
 const mesh=new T.Mesh(new T.CircleGeometry(4.5,28),new T.MeshPhysicalMaterial()),geo=mesh.geometry,uuid=geo.uuid,owner=mesh.uuid,mat=mesh.material.uuid,rnd=Math.random;let calls=0;Math.random=()=>{calls++;return .37;};try{art.replaceLoonLakeGeometry(T,mesh,model.water,{pondLocal:true});assert.equal(calls,0);}finally{Math.random=rnd;}
 assert.equal(mesh.geometry,geo);assert.equal(geo.uuid,uuid);assert.equal(mesh.uuid,owner);assert.equal(mesh.material.uuid,mat);assert.equal(geo.attributes.position.count,geo.attributes.normal.count);assert.equal(geo.attributes.color.itemSize,4);assert.equal(geo.index.count,model.water.index.length);assert.ok(geo.attributes.normal.array.every(Number.isFinite));
});
test('actual retained fence constructors keep their RNG suffix while visible rail endpoints match physical walls',()=>{
 const block=s=>s.slice(s.indexOf('const NORTH_GATE='),s.indexOf('/* ================= show arena detailing'));
 function build(s){const scene=new T.Scene(),mat=new T.MeshStandardMaterial(),original=Math.random;let seed=7,calls=0;Math.random=()=>{calls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};try{new Function('THREE','scene','whitePaintMat',block(s))(T,scene,mat);return{calls,future:Array.from({length:24},()=>Math.random()),scene};}finally{Math.random=original;}}
 const a=build(parentHtml),b=build(html);assert.equal(a.calls,b.calls);assert.deepEqual(a.future,b.future);const rails=b.scene.children.filter(o=>o.isMesh&&!o.isInstancedMesh);assert.equal(rails.length,12);for(const [x,z]of[[15,20],[25,7.5]])assert.ok(rails.some(o=>{o.updateMatrixWorld();const g=o.geometry.attributes.position;for(let i=0;i<g.count;i++){const p=new T.Vector3().fromBufferAttribute(g,i).applyMatrix4(o.matrixWorld);if(Math.hypot(p.x-x,p.z-z)<.11)return true;}return false;}));assert.ok(html.includes('[3,20,15,20]'));assert.ok(html.includes('[25,-20,25,7.5]'));
});
test('every actual low wood-base vertex retains its original canonical terrain support',()=>{
 const b=fs.readFileSync(path.join(dep,'assets/models/world/realism/jacaranda_tree.glb'));assert.equal(sha(b),'8732a74d6f90f768ce8321605bbcee946ff96666f751f0ddc90fb6358f66cf38');const size=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+size)),start=28+size,wood=[];
 for(const p of j.meshes[0].primitives){if(/leaves/i.test(j.materials[p.material].name))continue;const a=j.accessors[p.attributes.POSITION],v=j.bufferViews[a.bufferView],offset=start+(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||12;for(let i=0;i<a.count;i++)wood.push([b.readFloatLE(offset+i*stride),b.readFloatLE(offset+i*stride+4),b.readFloatLE(offset+i*stride+8)]);}
 let witnesses=0;for(const t of meta.trees.filter(t=>[84,101].includes(t.index))){const e=t.matrix,vs=wood.map(([x,y,z])=>[e[0]*x+e[8]*z+e[12],e[5]*y+e[13],e[2]*x+e[10]*z+e[14]]),low=Math.min(...vs.map(v=>v[1]));for(const p of vs.filter(v=>v[1]<=low+.5)){assert.equal(height(p[0],p[2]),old(p[0],p[2]));witnesses++;}}assert.equal(witnesses,1674);
});
test('all actual consumer clearance margins return verified finite bounded dry points without island cycles or RNG',()=>{
 const original=Math.random;Math.random=()=>{throw Error('Ambient RNG touched');};let cases=0;
 try{for(const margin of [.3,.65,1,2,3,5,8.5,10.5])for(let x=12;x<=51;x+=1)for(let z=3;z<=27;z+=1){const p=runtime.dryPoint(x,z,margin);assert.ok(p.every(Number.isFinite));assert.equal(runtime.containsWater(...p,margin),false,JSON.stringify({x,z,margin,p}));assert.ok(Math.hypot(p[0]-x,p[1]-z)<70);cases++;}}finally{Math.random=original;}
 assert.equal(cases,8000);assert.equal(runtime.containsWater(...runtime.dryPoint(29,13.5,8.5),8.5),false);
});
test('actual bounded HTML historical sampler uses four parent Float32 nodes and retains live old deck floor',()=>{
 const start=html.indexOf('function loonLakePlanningH('),brace=html.indexOf('{',start);let end=brace+1,depth=1;for(;depth;end++){if(html[end]==='{')depth++;if(html[end]==='}')depth--;}const body=html.slice(start,end),marker={},surfaces=[];
 const raw=(x,z,...args)=>{assert.equal(args.at(-1),marker);const ix=Math.round((x+500)/meta.terrain.step)-meta.terrain.originIndex[0],iz=Math.round((z+500)/meta.terrain.step)-meta.terrain.originIndex[1];return meta.terrain.rawParentNodeHeights[iz*meta.terrain.width+ix];};
 const parent=new Function('loonLakeContainsWater','TERRAIN_STEP','rawH','fallsTerrainHeight','canyonRelief','riverBankTerrainHeight','legacyLoonLakeTerrainHeight','groundSurfaces',body+';return loonLakePlanningH;')(lake.loonLakeContainsWater,meta.terrain.step,raw,null,null,null,marker,surfaces);
 for(const p of [[20,16],[30,14],[32,18],[43,13],[26,22]])assert.equal(parent(...p),old(...p));assert.ok(Number.isNaN(parent(65,40)));
 let changedHaloSamples=0;for(let x=8;x<=68;x+=.25)for(let z=0;z<=53;z+=.25)if(Math.abs(height(x,z)-old(x,z))>1e-8){assert.equal(parent(x,z),old(x,z),'Every changed canonical cell has exact historical planning, including its halo');changedHaloSamples++;}assert.ok(changedHaloSamples>5000);
 // For every affected whole canonical triangle, a changed vertex is inside the
 // analytic3.5m collar; the signed distance is1-Lipschitz, and the furthest
 // point of that complete triangle is within its diagonal. This certifies the
 // full domain, with boundary/interior barycentric samples checking the source.
 let affectedFaces=0;const w=meta.terrain.width,step=meta.terrain.step;
 for(let iz=0;iz<meta.terrain.height-1;iz++)for(let ix=0;ix<w-1;ix++)for(const offsets of [[0,1,w],[w+1,w,1]]){
  const ids=offsets.map(d=>iz*w+ix+d),changed=ids.find(i=>before[i]!==after[i]);if(changed===undefined)continue;affectedFaces++;
  const vs=ids.map(i=>[(meta.terrain.originIndex[0]+i%w)*step-500,(meta.terrain.originIndex[1]+Math.floor(i/w))*step-500]),at=ids.indexOf(changed),s=lake.loonLakeShoreDistance(...vs[at]);assert.ok(s<3.5);
  assert.ok(s+Math.max(...vs.map(p=>Math.hypot(p[0]-vs[at][0],p[1]-vs[at][1])))<3.5+Math.SQRT2*step);
  for(let u=0;u<=8;u++)for(let v=0;v<=8-u;v++){const a=u/8,b=v/8,x=vs[0][0]*(1-a-b)+vs[1][0]*a+vs[2][0]*b,z=vs[0][1]*(1-a-b)+vs[1][1]*a+vs[2][1]*b;assert.equal(parent(x,z),old(x,z));}
 }
 assert.ok(affectedFaces>300);
 const dock=meta.owners.find(o=>o.role==='jetty'),[x,,z]=dock.position;surfaces.push((px,pz)=>Math.hypot(px-x,pz-z)<.3?dock.position[1]:-Infinity);assert.equal(parent(x,z),dock.position[1]);
});
test('every outer and island water boundary meets the actual bed and all visible faces share exact wet queries',()=>{
 const wet=runtime.wetSurface;assert.equal(wet.contours.length,2);let maxGap=0,boundaryEdges=0;
 for(const contour of wet.contours)for(let i=0;i<contour.length;i++){const a=contour[i],b=contour[(i+1)%contour.length];boundaryEdges++;for(let k=0;k<=8;k++){const t=k/8,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;maxGap=Math.max(maxGap,Math.abs(runtime.level-height(x,z)));}}
 assert.ok(boundaryEdges>80);assert.ok(maxGap<.000002,'Whole outer/island edges lie on their canonical source plane, not10cm over the bed');
 let wetSamples=0;for(let x=14;x<50;x+=.25)for(let z=5;z<25;z+=.25){if(Math.abs(runtime.shoreDistance(x,z))<.00001)continue;assert.equal(runtime.containsWater(x,z),height(x,z)<runtime.level-1e-9);wetSamples++;}assert.ok(wetSamples>10000);
 for(let i=0;i<wet.faces.length;i++){const p=wet.faces[i].map(k=>wet.verts[k]);assert.ok(p.some(q=>q.bed<runtime.level-1e-9),'No flat zero-depth arena face');const x=p.reduce((n,v)=>n+v.x,0)/3,z=p.reduce((n,v)=>n+v.z,0)/3;assert.ok(runtime.containsWater(x,z));}
 assert.equal(runtime.level,0);assert.deepEqual(runtime.bounds,wet.bounds);
});
test('the useful original punt is moored in real water with all captured low wood above the bed at motion extremes',()=>{
 const dock=meta.owners.find(o=>o.role==='jetty'),oldBoat=meta.owners.find(o=>o.role==='punt'),jetty={position:new T.Vector3(...dock.position),rotation:{y:Math.atan2(dock.matrixWorld[8],dock.matrixWorld[10])}},yaw=Math.atan2(oldBoat.matrixWorld[8],oldBoat.matrixWorld[10]),punt={position:new T.Vector3(...oldBoat.position),rotation:{y:yaw}},r=art.seatLoonLakePunt(punt,jetty,runtime),sn=Math.sin(yaw),cs=Math.cos(yaw);assert.ok(r.minimumRectangleDepth>.36);assert.equal(punt.position.y,runtime.level);
 let minimum=Infinity;for(const roll of[-.017,.017])for(const bob of[-.012,.012])for(const [x,y,z]of meta.puntLowWood.points){const rx=x*Math.cos(roll)-y*Math.sin(roll),ry=x*Math.sin(roll)+y*Math.cos(roll),wx=punt.position.x+cs*rx+sn*z,wz=punt.position.z-sn*rx+cs*z;minimum=Math.min(minimum,runtime.level+bob+ry-height(wx,wz));}assert.ok(minimum>.05,'Complete actual low hull clears the real bed through all current bob/roll extrema');
});
