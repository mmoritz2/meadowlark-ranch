const fs=require('fs'),path=require('path');
const assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const out=path.resolve(process.argv[2]||'output/country-world');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
await page.route('**/ranch3d.html*',async r=>{const res=await r.fetch();await r.fulfill({response:res,body:(await res.text()).replace('const MERGE_STATS=mergeStatics();',`window.__qa={THREE,scene,camera,renderer,composer,G,player,groundH,TACK,keys,nearGrass,npcCharacters,step(dt){manualStepping=true;tick(dt)},day(){dayT=.34;weather.mode='clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
await page.goto(QA.BASE+'/ranch3d.html?qa=world',{timeout:120000});
await page.waitForFunction(()=>window.__qa?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
await page.evaluate(async()=>{const q=__qa;q.G.save.sync(s=>{s.qualityLocked=true;s.unlocked=s.unlocked||{};for(const rg of q.G.tables.REGIONS)if(rg.unlock)s.unlocked[rg.id]=true;});q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;await q.G.world.ranchBuilderArt.ready;advanceTime(0);q.day();q.G.gfx.apply('high');});
const shots=[{name:'north-tree-closeup',eye:[2,2.6,199],look:[64,3,239]},{name:'north-meadow',eye:[25,2.6,214],look:[70,3,260]},{name:'eastern-fields',eye:[149,3,17],look:[209,3,52]},{name:'riding-meadow',eye:[-60,2,56],look:[-53,1.5,39],horse:[-55,46,-.4],riding:true},{name:'wildflower-trail',eye:[-60,1.8,56],look:[-53,1.5,39]},{name:'village-rise',eye:[78,1.7,-151],look:[46,2.0,-58]},{name:'ranch',eye:[-5,3.6,15],look:[-40,4,-36]},{name:'pasture',eye:[-83,2.6,-19],look:[-110,2,-60]},{name:'village',eye:[29,3,-32],look:[65,4,-70]},{name:'river',eye:[-20,3,102],look:[12,3,127]},{name:'countryside',eye:[85,4,-150],look:[20,5,-35]},{name:'riding-home',eye:[-83,2.2,-19],look:[-65,2,-38],horse:[-70,-28,-.8]}];
const villageViews=await page.evaluate(()=>{
 const q=__qa,result=[],buildings=[];q.scene.updateMatrixWorld(true);
 q.scene.traverse(o=>{if(o.userData.architecture)buildings.push(o);});
 for(const [id,name]of[['cottonwood:clubhouse','cottage-front'],['cottonwood:store','village-store']]){
  const root=q.G.worldPkg.LANDMARKS.find(s=>s.id===id)?.grp;if(!root)throw Error('Missing village building '+id);
  root.updateMatrixWorld(true);
  const look=root.localToWorld(new q.THREE.Vector3(0,2.4,0)),others=[];let eye=null;
  for(const building of buildings)if(building!==root)building.traverse(o=>{if(o.isMesh)others.push(o);});
  // Town placement can change with nearby scenery. A fixed offset may land
  // inside the neighbouring cottage and produce a misleading clipped image.
  for(const offset of [[4.6,2.6,7.2],[-4.6,2.6,7.2],[0,2.6,6],[3.8,2.6,5.6],[-3.8,2.6,5.6],[6,3,10],[-6,3,10]]){
   const candidate=root.localToWorld(new q.THREE.Vector3(...offset));
   const ray=new q.THREE.Raycaster(look,candidate.clone().sub(look).normalize(),.01,look.distanceTo(candidate)+.35);
   // Cast from the building toward the lens: this also catches a camera inside
   // another closed model, whose back faces could evade the opposite ray.
   const blocked=ray.intersectObjects(others,false).some(h=>{if(!h.object.isMesh)return false;let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return [].concat(h.object.material).some(m=>!m.transparent||m.opacity>.7);});
   if(!blocked){eye=candidate;break;}
  }
  if(!eye)throw Error('No clear architectural review camera for '+id);
  eye.y-=q.groundH(eye.x,eye.z);look.y-=q.groundH(look.x,look.z);
  result.push({name,clear:true,eye:eye.toArray(),look:look.toArray()});
 }
 return result;
});shots.push(...villageViews);
for(const tier of ['medium','low'])shots.push({name:'riding-meadow-'+tier,eye:[-60,2,56],look:[-53,1.5,39],horse:[-55,46,-.4],riding:true,tier});
for(const c of shots){const shot=await page.evaluate(async c=>{const q=__qa,p=q.player;q.G.gfx.apply(c.tier||'high');const eye=c.eye.slice(),look=c.look.slice();eye[1]+=q.groundH(eye[0],eye[2]);look[1]+=q.groundH(look[0],look[2]);p.pos.set(c.horse?.[0]??eye[0],0,c.horse?.[1]??eye[2]);if(c.horse)p.heading=c.horse[2];p.speed=0;q.day();const render=q.renderer.render;q.renderer.render=()=>{};try{for(let i=0;i<30;i++)q.step(.1);
 // Relocation starts asynchronous NPC clothing loads. Let the existing nearby
 // character system settle before taking the reference image.
 let settled=0;for(let i=0;i<180;i++){q.step(.016);settled=q.npcCharacters.stats().pending?0:settled+1;if(settled>=2)break;await new Promise(r=>setTimeout(r,40));}
 }finally{q.renderer.render=render}p.mesh.visible=false;const nativeReins=q.scene.getObjectByName('Native leather split reins');if(nativeReins)nativeReins.visible=!!c.horse;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=false;if(c.horse){p.mesh.visible=true;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=true;}if(!c.riding){q.camera.position.set(...eye);q.camera.lookAt(...look);}else if(p.rider?.g)p.rider.g.visible=true;q.G.waterReflections.update(performance.now()+100);q.composer.render();return q.renderer.domElement.toDataURL('image/webp',.93).split(',')[1]},c);fs.writeFileSync(path.join(out,c.name+'.webp'),Buffer.from(shot,'base64'));console.log(c.name)}

const state=await page.evaluate(async()=>{
 const q=__qa,T=q.THREE,P=q.G.photoscans,tiers=[];const layout=JSON.stringify(P.treePositions);
 const original=q.renderer.render;q.renderer.render=()=>{};
 try{for(const tier of['low','medium','high']){
  q.G.gfx.apply(tier);q.player.pos.set(45,0,-49);for(let i=0;i<6;i++)q.step(.1);
  tiers.push({tier,meadowTriangles:q.nearGrass.meadowDistance.mesh.geometry.index.count/3*q.nearGrass.meadowDistance.mesh.count,trees:P.activeTrees,triangles:P.activeTreeTriangles,budget:P.treeTriangleBudget});
 }}finally{q.renderer.render=original}
 let leafTriangles=0;q.scene.traverse(o=>{if(o.name.startsWith('Photoscan canopy-broadleaf')&&o.material.name.includes('leaves'))leafTriangles=Math.max(leafTriangles,o.geometry.index.count/3)});
 const {FIELD_RISES,FIELD_ANCHORS,pastureRise,MEADOW_OPENINGS,meadowGrazingAt}=await import('./assets/pastoral-fields.mjs?v=grazed-meadows-1');
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
 const near=q.nearGrass.near,nearLayout=Array.from(near.instanceMatrix.array),nearColors=Array.from(near.instanceColor.array);
 const heights=[];for(let i=0;i<near.count;i++){near.getMatrixAt(i,matrix);if(matrix.determinant()!==0)heights.push(Math.hypot(...matrix.elements.slice(4,7)));}
 heights.sort((a,b)=>a-b);
 let originalTrunks=0;const trunks=q.G.floraPkg.bank.trunk;
 for(let i=0;i<trunks.n;i++){trunks.im.getMatrixAt(i,matrix);if(Math.abs(matrix.determinant())>.00001)originalTrunks++;}
 const {alpineSnowAt}=await import('./assets/falls-landscape.js?v=alpine-range-1');
 const blossomTrees=P.treePositions.filter(t=>t.kind==='blossom');
 const blossom={replaced:blossomTrees.length,originalCanopyVisible:q.G.floraPkg.bank.blossom.im.visible,originalTrunks,
  coldSites:blossomTrees.filter(t=>alpineSnowAt(t.x,t.z)>.35).length,
  scanned:blossomTrees.every(t=>t.source.includes(alpineSnowAt(t.x,t.z)>.35?'pine':'broadleaf'))};
 const flowerDraw=flower.count,flowerLayout=Array.from(flower.instanceMatrix.array.slice(0,flowerDraw*16)),flowerColors=Array.from(flower.instanceColor.array.slice(0,flowerDraw*3));
 const middleLayout=Array.from(mid.instanceMatrix.array);q.nearGrass.tick(2,190,30);q.nearGrass.tick(3,-52,44);
 // Hidden slots may retain an unused previous colour; compare visible plants.
 const nearStable=nearLayout.every((v,i)=>v===near.instanceMatrix.array[i])&&nearColors.every((v,i)=>{const base=Math.floor(i/3)*16;return Math.hypot(nearLayout[base],nearLayout[base+1],nearLayout[base+2])===0||v===near.instanceColor.array[i];});
 const middleStable=middleLayout.every((v,i)=>v===mid.instanceMatrix.array[i]);
 const flowerStable=flower.count===flowerDraw&&flowerLayout.every((v,i)=>v===flower.instanceMatrix.array[i])&&flowerColors.every((v,i)=>v===flower.instanceColor.array[i]);
 // Measure actual authored instance heights across all open fields, not only
 // a single favourable camera. Taller margins must survive around low interiors.
 const meadowHeights={interior:[],margin:[]};let interiorFlowers=0,totalFlowers=0;
 const tuftHeight=near.geometry.boundingBox.max.y;
 for(const field of MEADOW_OPENINGS){
  q.nearGrass.tick(4,field.x,field.z);
  for(let i=0;i<near.count;i++){
   near.getMatrixAt(i,matrix);if(matrix.determinant()===0)continue;pos.setFromMatrixPosition(matrix);
   const mask=meadowGrazingAt(pos.x,pos.z),height=Math.hypot(...matrix.elements.slice(4,7))*tuftHeight;
   if(mask>.95)meadowHeights.interior.push(height);else if(mask<.05)meadowHeights.margin.push(height);
  }
  for(let i=0;i<flower.count;i++){flower.getMatrixAt(i,matrix);pos.setFromMatrixPosition(matrix);totalFlowers++;if(meadowGrazingAt(pos.x,pos.z)>.95)interiorFlowers++;}
 }
 const quantile=(a,p)=>{a.sort((a,b)=>a-b);return a[Math.floor((a.length-1)*p)];};
 const grazing={interiorSamples:meadowHeights.interior.length,marginSamples:meadowHeights.margin.length,
  interiorP90:quantile(meadowHeights.interior,.9),marginMedian:quantile(meadowHeights.margin,.5),interiorFlowers,totalFlowers};
 const fields={grazing,nearStable,grassHeightRange:[heights[0],heights[Math.floor(heights.length*.1)],heights[Math.floor(heights.length*.9)],heights.at(-1)],flowerDraw,flowerStable,nearTriangles:q.nearGrass.near.geometry.index.count/3*q.nearGrass.near.count,samples,anchors:FIELD_ANCHORS.every(([x,z])=>pastureRise(x,z)===0),flowerCount,midCount,
  flowerTriangles:flower.geometry.index.count/3,middleTriangles:mid.count*mid.geometry.index.count/3,
  plantError,plantsOnRoad,middleStable};
 const cottages=[];q.scene.traverse(o=>{if(o.userData.architecture?.kind==='cottage')cottages.push(o);});
 const completeGardens=cottages.every(o=>o.getObjectByName('Cottage | living window boxes')?.children.reduce((n,m)=>n+(m.isInstancedMesh?m.count:1),0)===o.userData.architecture.windowBoxes.reduce((n,b)=>n+(b.height>.3?5:7),0));
 const villageShops=q.G.worldPkg.LANDMARKS.filter(s=>s.grp?.userData.architecture?.exterior==='village'&&(s.grp.userData.architecture.kind==='outbuilding'||s.grp.userData.architecture.store)).length;
 const canopies=P.treePositions.filter(t=>t.source==='canopy-broadleaf');
 const hedges=q.scene.getObjectByName('worldPaths:leaves');
 const villageMaterials=new Map();q.scene.traverse(o=>{for(const m of [].concat(o.material||[]))if(m.name?.startsWith('Village | limewashed plaster')||m.name==='Village | blue grey slate')villageMaterials.set(m.name,m);});
 const surfaces=[...villageMaterials.values()].map(m=>({name:m.name,metres:m.userData.patchMetres,
  maps:['map','normalMap','roughnessMap'].map(key=>({key,url:m[key]?.image?.src||'',size:m[key]?.image?.width||0,colorSpace:m[key]?.colorSpace}))}));
 const relief=q.G.vistas.MASSIFS.map(m=>{const g=m.mesh.geometry,p=g.attributes.position;let nearest=Infinity,highest=-Infinity;
  for(let i=0;i<p.count;i++){nearest=Math.min(nearest,Math.hypot(p.getX(i),p.getZ(i)));highest=Math.max(highest,p.getY(i));}
  return {id:m.id,tris:m.tris,nearest,highest,static:!m.mesh.matrixAutoUpdate,finite:Object.values(g.attributes).every(a=>Array.from(a.array).every(Number.isFinite))};});
 return {blossom,surfaces,relief,npcCharacters:q.npcCharacters.stats(),fields,canopies:canopies.length,leafTriangles,tiers,stableLayout:layout===JSON.stringify(P.treePositions),
  trunkAnchors:canopies.every(t=>Number.isFinite(q.groundH(t.x,t.z))),
  completeGardens,villageShops,cottages:cottages.length,gardens:q.G.worldDetails.cottageGardens,hedges:hedges?.count||0,leafHedges:!!hedges?.material.map&&hedges.material.alphaTest>0,
  errors:[...q.G.errors,...P.errors,...q.G.worldDetails.errors],assets:P.assets,gl:q.renderer.getContext().getError()};
});
const checks={
 architecturalViewsUnobstructed:villageViews.every(v=>v.clear),
 villageSurfaces:state.surfaces.length===4&&state.surfaces.every(m=>m.maps.every(t=>t.url.includes('/textures/village/')&&t.size>0&&(t.key==='map'?t.colorSpace==='srgb':t.colorSpace===''))),
 staticReliefOutsideRidingBasin:state.relief.length===6&&state.relief.every(m=>m.finite&&m.static&&m.nearest>550),
 reliefGeometryBudget:state.relief.reduce((n,m)=>n+m.tris,0)<110000,
 npcCharactersLoad:state.npcCharacters.failed.length===0&&state.npcCharacters.active>0,
 terrainAndRidingSurfaceMatch:state.fields.samples.every(p=>p.error<.0001),
 protectedYards:state.fields.anchors,adaptiveGrassBudget:state.tiers[0].meadowTriangles<state.tiers[1].meadowTriangles&&state.tiers[1].meadowTriangles<state.tiers[2].meadowTriangles,modelledFlowerColonies:state.fields.flowerCount>90&&state.fields.flowerTriangles<=150,
 middleMeadow:state.fields.midCount>8000&&state.fields.middleTriangles<=1000000,
 groundedCover:state.fields.plantError<.001&&state.fields.plantsOnRoad===0,
 repeatableMeadow:state.fields.middleStable&&state.fields.flowerStable&&state.fields.nearStable,
 openGrazingInteriors:state.fields.grazing.interiorSamples>1000&&state.fields.grazing.interiorP90<.35,
 tallerFieldMargins:state.fields.grazing.marginSamples>1000&&state.fields.grazing.marginMedian>state.fields.grazing.interiorP90*1.5,
 flowersConcentratedAtMargins:state.fields.grazing.totalFlowers>100&&state.fields.grazing.interiorFlowers/state.fields.grazing.totalFlowers<.05,
 variedGrassHeight:state.fields.grassHeightRange[2]/state.fields.grassHeightRange[1]>1.3,
 oldForkedTreesReplaced:state.blossom.replaced>100&&!state.blossom.originalCanopyVisible&&state.blossom.originalTrunks===0&&state.blossom.scanned,
 compactFlowerDraws:state.fields.flowerDraw===state.fields.flowerCount,
 leafyLowlands:state.canopies>150,allAuthoredLeaves:state.leafTriangles===88336,
 treeBudget:state.tiers.every(t=>t.triangles<=t.budget)&&state.tiers[0].trees===0,
 noSinkingLayout:state.stableLayout&&state.trunkAnchors,cottageGardens:state.gardens===state.cottages&&state.completeGardens&&state.gardens>=8,villageShopfronts:state.villageShops===2,
 botanicalHedges:state.hedges>0&&state.leafHedges,noErrors:errors.length===0&&state.errors.length===0&&state.gl===0};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,state,errors},null,2));
console.log(JSON.stringify({checks,state,errors}));assert(Object.values(checks).every(Boolean),'Country world acceptance failed');

}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
