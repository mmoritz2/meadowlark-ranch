// Thunder Oak geometry, lighting buffers, retained landmarks and mounted clearance.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const out=path.resolve(process.argv[2]||'output/thunder-oak');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await page.route('**/ranch3d.html*',async r=>{const res=await r.fetch();await r.fulfill({response:res,body:(await res.text()).replace('const MERGE_STATS=mergeStatics();',`window.__q={THREE,scene,camera,renderer,composer,G,player,groundH,TACK,keys,step(dt){manualStepping=true;tick(dt)},day(t=.34,rain=false){dayT=t;weather.mode=rain?'rain':'clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
 await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(QA.BASE+'/ranch3d.html?qa=thunder-oak',{timeout:120000});await page.waitForFunction(()=>window.__q?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__q;q.G.save.sync(s=>{s.qualityLocked=true;s.unlocked=s.unlocked||{};for(const rg of q.G.tables.REGIONS)if(rg.unlock)s.unlocked[rg.id]=true;});q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;advanceTime(0);q.G.gfx.apply('high');q.tackVisibility=Object.values(q.TACK||{}).filter(o=>o?.isObject3D).map(o=>[o,o.visible]);
  q.read=rt=>{const w=Math.floor(rt.width),h=Math.floor(rt.height),p=new Uint16Array(w*h*4);q.renderer.readRenderTargetPixels(rt,0,0,w,h,p);let invalid=0,minAlphaBits=65535;for(let i=0;i<p.length;i+=4){if([0,1,2].some(c=>(p[i+c]&0x7c00)===0x7c00))invalid++;minAlphaBits=Math.min(minAlphaBits,p[i+3]);}return{invalid,minAlphaBits}};
 });console.log('Thunder Oak ready');const rows=[];
 const views=[
  {name:'front',eye:[15,4,24],look:[0,7,0]}, {name:'split',eye:[0,3,7],look:[0,5,0]},
  {name:'back',eye:[-7,5,-11],look:[0,6,0]}, {name:'leaves',eye:[7,9,8],look:[5.5,8.8,3]},
  {name:'shrine',eye:[7,2,9],look:[3.4,1,2.2]}, {name:'route',eye:[30,2.8,60],look:[0,8,0]},
  {name:'low',tier:'low'}, {name:'medium',tier:'medium'}, {name:'rain',rain:true}, {name:'night',time:0}, {name:'backlit',time:.75},
  {name:'inside',eye:[.1,1.9,.1],look:[0,7,3]}
 ];
 for(const c of views){const row=await page.evaluate(c=>{const q=__q,L=q.G.vistas.LAND.find(l=>l.id==='thunderoak'),d=q.G.photoscans.thunderOak;if(!d)throw Error('Oak failed: '+q.G.photoscans.errors.join(','));
  const eye=(c.eye||[15,4,24]).map((v,i)=>v+[L.x,L.y,L.z][i]),look=(c.look||[0,7,0]).map((v,i)=>v+[L.x,L.y,L.z][i]);q.G.gfx.apply(c.tier||'high');q.player.pos.set(eye[0],0,eye[2]);q.player.speed=q.player.y=q.player.vy=0;
  const render=q.renderer.render;q.renderer.render=()=>{};try{for(let i=0;i<50;i++){q.day(c.time??.34,c.rain);q.step(.1)}}finally{q.renderer.render=render}
  q.player.mesh.visible=false;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=false;const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=false;
  q.camera.position.set(...eye);q.camera.lookAt(...look);q.G.waterReflections.update(performance.now()+100);q.composer.render();
  return{name:c.name,near:d.near,triangles:d.triangles,activeTreeTriangles:q.G.photoscans.activeTreeTriangles,treeBudget:q.G.photoscans.treeTriangleBudget,buffers:[q.composer.renderTarget1,q.composer.renderTarget2].map(q.read),gl:q.renderer.getContext().getError(),image:q.renderer.domElement.toDataURL('image/webp',.96).split(',')[1]};
 },c);fs.writeFileSync(path.join(out,c.name+'.webp'),Buffer.from(row.image,'base64'));delete row.image;rows.push(row);console.log(c.name);}
 const state=await page.evaluate(async()=>{const q=__q,T=q.THREE,W=q.G.world,d=q.G.photoscans.thunderOak,L=q.G.vistas.LAND.find(l=>l.id==='thunderoak'),source=d.source;
  const {createSolidWorld}=await import('./assets/solid-collisions.js'),{createFollowCamera}=await import('./assets/follow-camera.js'),isolated=createSolidWorld({THREE:T}),cam=createFollowCamera({THREE:T,groundHeight:q.groundH});isolated.register(d.root);cam.register(d.cameraParts);
  let finite=true,normalMin=1,outwardMin=1,cutNormalMin=1,opaque=true,shadow=true,loaded=true;
  for(const g of[source.bark,source.heart,source.leaves,source.farLeaves]){for(const a of Object.values(g.attributes))for(const v of a.array)finite&&=Number.isFinite(v);const n=g.attributes.normal;for(let i=0;i<n.count;i++)normalMin=Math.min(normalMin,Math.hypot(n.getX(i),n.getY(i),n.getZ(i)));}
  for(const base of[0,47*26])for(let k=1;k<45;k++){const i=base+k*26+13;outwardMin=Math.min(outwardMin,source.bark.attributes.normal.getX(i)*(base===0?-1:1));}
  // The second cut follows the first cut's 517 vertices and its 36-vertex tip.
  for(const base of[0,47*11+36])for(let k=1;k<44;k++)cutNormalMin=Math.min(cutNormalMin,source.heart.attributes.normal.getX(base+k*11+5)*(base===0?1:-1));
  d.root.traverse(m=>{if(!m.isMesh)return;opaque&&=!m.material.transparent&&!m.material.alphaTest;shadow&&=m.castShadow&&m.receiveShadow;if(m.material.map)loaded&&=m.material.map.image?.width>0;});
  const boundsError=source.leaves.boundingBox.min.distanceTo(source.farLeaves.boundingBox.min)+source.leaves.boundingBox.max.distanceTo(source.farLeaves.boundingBox.max),wind=d.root.children.filter(o=>o.customDepthMaterial).map(o=>o.name);
  const V=(x,y,z)=>new T.Vector3(x+L.x,y+L.y,z+L.z),cameraClear=cam.isClear(V(0,6,4),V(0,6,-4)),cameraBlocks=!cam.isClear(V(-1.4,3,5),V(-1.4,3,-5));
  const seams=[];for(let side=0;side<2;side++)for(let k=0;k<47;k++)for(const j of[0,1]){const a=side*47*26+k*26+j*25,b=side*(47*11+36)+k*11+j*10;seams.push(new T.Vector3().fromBufferAttribute(source.bark.attributes.position,a).distanceTo(new T.Vector3().fromBufferAttribute(source.heart.attributes.position,b)));}
  const tiers=[],render=q.renderer.render;q.renderer.render=()=>{};try{for(const tier of['low','medium','high']){q.G.gfx.apply(tier);q.player.pos.set(L.x+9,0,L.z+10);q.step(.4);q.G.photoscans.update();tiers.push({tier,near:d.near,triangles:d.triangles,active:q.G.photoscans.activeTreeTriangles,budget:q.G.photoscans.treeTriangleBudget});}}finally{q.renderer.render=render}
  const rides=[],mounted=[];q.G.gfx.apply('high');
  for(const direction of[0,Math.PI/2,Math.PI,Math.PI*1.5]){
   const angle=direction,tx=L.x+(Math.cos(angle)>=0?1.1:-1.1),tz=L.z+.1,startX=tx+Math.cos(angle)*5.5,startZ=tz+Math.sin(angle)*5.5;
   q.player.pos.set(startX,0,startZ);q.player.heading=Math.atan2(-Math.cos(angle),-Math.sin(angle));q.player.speed=q.player.y=q.player.vy=0;q.player.onFoot=false;q.player.flying=false;q.player.stam=1;q.G.followCam.reset();q.keys.KeyW=true;
   let groundError=0,cameraError=false,maxStep=0,travel=0;q.renderer.render=()=>{};
   try{for(let i=0;i<180;i++){const before=q.player.pos.clone();q.day();q.step(1/30);const delta=before.distanceTo(q.player.pos);maxStep=Math.max(maxStep,delta);travel+=delta;groundError=Math.max(groundError,Math.abs(q.player.mesh.position.y-q.groundH(q.player.pos.x,q.player.pos.z)));cameraError||=![...q.camera.position.toArray(),...q.player.pos.toArray()].every(Number.isFinite);}}finally{q.renderer.render=render;q.keys.KeyW=false;}
   const final={x:q.player.pos.x,z:q.player.pos.z},probe={x:final.x-Math.cos(angle)*.18,z:final.z-Math.sin(angle)*.18},h=q.groundH(probe.x,probe.z),contact=isolated.resolve(probe,{bottom:h+.38,top:h+2.65,radius:.55});
   rides.push({direction,contact,final,groundError,cameraError,maxStep,travel,displacement:Math.hypot(final.x-startX,final.z-startZ),distanceToStem:Math.hypot(final.x-tx,final.z-tz)});
   q.player.mesh.visible=true;if(q.player.rider?.g)q.player.rider.g.visible=true;for(const[o,visible]of q.tackVisibility)o.visible=visible;const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=true;q.composer.render();mounted.push({name:'mounted-'+rides.length,buffers:[q.composer.renderTarget1,q.composer.renderTarget2].map(q.read),gl:q.renderer.getContext().getError(),image:q.renderer.domElement.toDataURL('image/webp',.96).split(',')[1]});
  }
  // A real ride alongside the shrine must remain clear of the trunk and its camera bounds.
  q.player.pos.set(L.x-5,0,L.z+6.5);q.player.heading=Math.PI/2;q.player.speed=q.player.y=q.player.vy=0;q.player.stam=1;q.G.followCam.reset();q.keys.KeyW=true;let bypassGroundError=0;q.renderer.render=()=>{};
  try{for(let i=0;i<160;i++){q.day();q.step(1/30);bypassGroundError=Math.max(bypassGroundError,Math.abs(q.player.mesh.position.y-q.groundH(q.player.pos.x,q.player.pos.z)));}}finally{q.renderer.render=render;q.keys.KeyW=false;}
  return{finite,normalMin,outwardMin,cutNormalMin,opaque,shadow,loaded,boundsError,wind,cameraClear,cameraBlocks,seamError:Math.max(...seams),tiers,rides,mounted,bypass:{x:q.player.pos.x-L.x,z:q.player.pos.z-L.z,groundError:bypassGroundError},stats:d.stats,legacyVisible:L.mesh.visible,landmarks:q.G.vistas.LAND.map(l=>({id:l.id,x:l.x,y:l.y,z:l.z})),siteError:d.root.getWorldPosition(new T.Vector3()).distanceTo(V(0,0,0)),registered:W.solidWorld.hasParts(d.root),marker:W.mapMarkers.some(m=>m.id==='thunderoak'&&m.x===L.x&&m.z===L.z),errors:[...q.G.errors,...q.G.photoscans.errors,...q.G.worldDetails.errors]};
 });
 for(const row of state.mounted){fs.writeFileSync(path.join(out,row.name+'.webp'),Buffer.from(row.image,'base64'));delete row.image;rows.push(row);}delete state.mounted;
 const checks={replacementVisible:!state.legacyVisible&&state.siteError<.001,landmarkMarkerPreserved:state.marker,finiteGeometry:state.finite,unitNormals:state.normalMin>.9,outwardBark:state.outwardMin>.5,outwardCutFaces:state.cutNormalMin>.5,sealedSplit:state.seamError<.00001,opaqueMaterials:state.opaque,realShadows:state.shadow,animatedLeafAndRibbonShadows:state.wind.length===2,texturesLoaded:state.loaded,exactLeafLODBounds:state.boundsError<.00001,allLeavesRetained:state.stats.leaves===2700,treeBudgets:state.tiers.every(t=>t.active<=t.budget)&&!state.tiers[0].near&&state.tiers[2].near,cameraClearance:state.cameraClear&&state.cameraBlocks,collisionRegistered:state.registered,
  mountedCollision:state.rides.every(r=>r.contact>0&&r.displacement>1&&r.displacement<5.5&&r.maxStep<.6&&!r.cameraError&&r.groundError<.01),shrineBypass:state.bypass.x>6&&state.bypass.groundError<.01,finitePixels:rows.every(r=>r.buffers.every(b=>!b.invalid)),opaqueOutput:rows.every(r=>r.buffers.every(b=>b.minAlphaBits>=15300)),webGL:rows.every(r=>!r.gl),noErrors:!errors.length&&!state.errors.length};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,rows,state,errors},null,2));console.log(JSON.stringify({checks,rides:state.rides,bypass:state.bypass,stats:state.stats,errors}));assert(Object.values(checks).every(Boolean),'Thunder Oak acceptance failed');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
