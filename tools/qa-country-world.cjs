const fs=require('fs'),path=require('path');
const assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const out=path.resolve(process.argv[2]||'output/country-world');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
await page.route('**/ranch3d.html*',async r=>{const res=await r.fetch();await r.fulfill({response:res,body:(await res.text()).replace('const MERGE_STATS=mergeStatics();',`window.__qa={THREE,scene,camera,renderer,composer,G,player,groundH,TACK,keys,nearGrass,step(dt){manualStepping=true;tick(dt)},day(){dayT=.34;weather.mode='clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
await page.goto(QA.BASE+'/ranch3d.html?qa=world',{timeout:120000});
await page.waitForFunction(()=>window.__qa?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
await page.evaluate(async()=>{const q=__qa;q.G.save.sync(s=>s.qualityLocked=true);q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;await q.G.world.ranchBuilderArt.ready;advanceTime(0);q.day();q.G.gfx.apply('high');});
const shots=[{name:'riding-meadow',eye:[-60,2,56],look:[-53,1.5,39],horse:[-55,46,-.4],riding:true},{name:'wildflower-trail',eye:[-60,1.8,56],look:[-53,1.5,39]},{name:'village-rise',eye:[78,1.7,-151],look:[46,2.0,-58]},{name:'ranch',eye:[-5,3.6,15],look:[-40,4,-36]},{name:'pasture',eye:[-83,2.6,-19],look:[-110,2,-60]},{name:'village',eye:[29,3,-32],look:[65,4,-70]},{name:'river',eye:[-20,3,102],look:[12,3,127]},{name:'countryside',eye:[85,4,-150],look:[20,5,-35]},{name:'riding-home',eye:[-83,2.2,-19],look:[-65,2,-38],horse:[-70,-28,-.8]}];
const villageViews=await page.evaluate(()=>{
 const q=__qa,result=[];
 for(const [id,name]of[['cottonwood:clubhouse','cottage-front'],['cottonwood:store','village-store']]){
  const root=q.G.worldPkg.LANDMARKS.find(s=>s.id===id)?.grp;if(!root)throw Error('Missing village building '+id);
  root.updateMatrixWorld(true);
  const eye=root.localToWorld(new q.THREE.Vector3(4.6,2.6,7.2)),look=root.localToWorld(new q.THREE.Vector3(0,2.4,0));
  eye.y-=q.groundH(eye.x,eye.z);look.y-=q.groundH(look.x,look.z);
  result.push({name,eye:eye.toArray(),look:look.toArray()});
 }
 return result;
});shots.push(...villageViews);
for(const c of shots){const shot=await page.evaluate(c=>{const q=__qa,p=q.player;const eye=c.eye.slice(),look=c.look.slice();eye[1]+=q.groundH(eye[0],eye[2]);look[1]+=q.groundH(look[0],look[2]);p.pos.set(c.horse?.[0]??eye[0],0,c.horse?.[1]??eye[2]);if(c.horse)p.heading=c.horse[2];p.speed=0;q.day();const render=q.renderer.render;q.renderer.render=()=>{};try{for(let i=0;i<30;i++)q.step(.1)}finally{q.renderer.render=render}p.mesh.visible=false;const nativeReins=q.scene.getObjectByName('Native leather split reins');if(nativeReins)nativeReins.visible=!!c.horse;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=false;if(c.horse){p.mesh.visible=true;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=true;}if(!c.riding){q.camera.position.set(...eye);q.camera.lookAt(...look);}else if(p.rider?.g)p.rider.g.visible=true;q.G.waterReflections.update(performance.now()+100);q.composer.render();return q.renderer.domElement.toDataURL('image/webp',.93).split(',')[1]},c);fs.writeFileSync(path.join(out,c.name+'.webp'),Buffer.from(shot,'base64'));console.log(c.name)}

const state=await page.evaluate(async()=>{
 const q=__qa,T=q.THREE,P=q.G.photoscans,tiers=[];const layout=JSON.stringify(P.treePositions);
 const original=q.renderer.render;q.renderer.render=()=>{};
 try{for(const tier of['low','medium','high']){
  q.G.gfx.apply(tier);q.player.pos.set(45,0,-49);for(let i=0;i<6;i++)q.step(.1);
  tiers.push({tier,meadowTriangles:q.nearGrass.meadowDistance.mesh.geometry.index.count/3*q.nearGrass.meadowDistance.mesh.count,trees:P.activeTrees,triangles:P.activeTreeTriangles,budget:P.treeTriangleBudget});
 }}finally{q.renderer.render=original}
 let leafTriangles=0;q.scene.traverse(o=>{if(o.name.startsWith('Photoscan canopy-broadleaf')&&o.material.name.includes('leaves'))leafTriangles=Math.max(leafTriangles,o.geometry.index.count/3)});
 const {FIELD_RISES,FIELD_ANCHORS,pastureRise}=await import('./assets/pastoral-fields.mjs?v=field-composition-1');
 const terrain=q.scene.getObjectByName('Pasture terrain');terrain.updateMatrixWorld(true);
 const samples=[];
 for(const c of FIELD_RISES)for(const [dx,dz] of[[0,0],[12,0],[-12,0],[0,12],[0,-12]]){
  const x=c.x+dx,z=c.z+dz,ray=new T.Raycaster(new T.Vector3(x,200,z),new T.Vector3(0,-1,0),0,400);
  const hit=ray.intersectObject(terrain)[0];samples.push({x,z,error:hit?Math.abs(hit.point.y-q.G.world.terrainH(x,z)):Infinity});
 }
 q.nearGrass.tick(1,-52,44);
 const matrix=new T.Matrix4(),pos=new T.Vector3(),flower=q.nearGrass.lupin,mid=q.nearGrass.meadowDistance.mesh;
 let flowerCount=0,midCount=0,plantError=0,plantsOnRoad=0;
 for(const [mesh,kind] of[[flower,'flower'],[mid,'middle']])for(let i=0;i<mesh.count;i++){
  mesh.getMatrixAt(i,matrix);if(matrix.determinant()===0)continue;pos.setFromMatrixPosition(matrix);
  if(kind==='flower')flowerCount++;else midCount++;
  plantError=Math.max(plantError,Math.abs(pos.y+.03-q.groundH(pos.x,pos.z)));
  if(q.G.world.pathDist(pos.x,pos.z)<2.6||q.G.worldPaths.trackDist(pos.x,pos.z)<3.2)plantsOnRoad++;
 }
 const middleLayout=Array.from(mid.instanceMatrix.array);q.nearGrass.tick(2,190,30);q.nearGrass.tick(3,-52,44);
 const middleStable=middleLayout.every((v,i)=>v===mid.instanceMatrix.array[i]);
 const fields={samples,anchors:FIELD_ANCHORS.every(([x,z])=>pastureRise(x,z)===0),flowerCount,midCount,
  flowerTriangles:flower.geometry.index.count/3,middleTriangles:mid.count*mid.geometry.index.count/3,
  plantError,plantsOnRoad,middleStable};
 const cottages=[];q.scene.traverse(o=>{if(o.userData.architecture?.kind==='cottage')cottages.push(o);});
 const completeGardens=cottages.every(o=>o.getObjectByName('Cottage | living window boxes')?.children.reduce((n,m)=>n+(m.isInstancedMesh?m.count:1),0)===o.userData.architecture.windowBoxes.length*7);
 const villageShops=q.G.worldPkg.LANDMARKS.filter(s=>s.grp?.userData.architecture?.exterior==='village').length;
 const canopies=P.treePositions.filter(t=>t.source==='canopy-broadleaf');
 const hedges=q.scene.getObjectByName('worldPaths:leaves');
 return {fields,canopies:canopies.length,leafTriangles,tiers,stableLayout:layout===JSON.stringify(P.treePositions),
  trunkAnchors:canopies.every(t=>Number.isFinite(q.groundH(t.x,t.z))),
  completeGardens,villageShops,cottages:cottages.length,gardens:q.G.worldDetails.cottageGardens,hedges:hedges?.count||0,leafHedges:!!hedges?.material.map&&hedges.material.alphaTest>0,
  errors:[...q.G.errors,...P.errors,...q.G.worldDetails.errors],assets:P.assets,gl:q.renderer.getContext().getError()};
});
const checks={
 terrainAndRidingSurfaceMatch:state.fields.samples.every(p=>p.error<.0001),
 protectedYards:state.fields.anchors,adaptiveGrassBudget:state.tiers[0].meadowTriangles<state.tiers[1].meadowTriangles&&state.tiers[1].meadowTriangles<state.tiers[2].meadowTriangles,modelledFlowerColonies:state.fields.flowerCount>90&&state.fields.flowerTriangles<=150,
 middleMeadow:state.fields.midCount>8000&&state.fields.middleTriangles<=1000000,
 groundedCover:state.fields.plantError<.001&&state.fields.plantsOnRoad===0,
 repeatableMeadow:state.fields.middleStable,
 leafyLowlands:state.canopies>150,allAuthoredLeaves:state.leafTriangles===88336,
 treeBudget:state.tiers.every(t=>t.triangles<=t.budget)&&state.tiers[0].trees===0,
 noSinkingLayout:state.stableLayout&&state.trunkAnchors,cottageGardens:state.gardens===state.cottages&&state.completeGardens&&state.gardens>=8,villageShopfronts:state.villageShops===2,
 botanicalHedges:state.hedges>0&&state.leafHedges,noErrors:errors.length===0&&state.errors.length===0&&state.gl===0};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,state,errors},null,2));
console.log(JSON.stringify({checks,state,errors}));assert(Object.values(checks).every(Boolean),'Country world acceptance failed');

}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
