// Original willow geometry, tier coverage, camera safety and mounted trunk approaches.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const out=path.resolve(process.argv[2]||'output/willows');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await page.route('**/ranch3d.html*',async r=>{const res=await r.fetch();await r.fulfill({response:res,body:(await res.text()).replace('const MERGE_STATS=mergeStatics();',`window.__q={THREE,scene,camera,renderer,composer,G,player,groundH,TACK,keys,step(dt){manualStepping=true;tick(dt)},day(t=.34,rain=false){dayT=t;weather.mode=rain?'rain':'clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
 await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(QA.BASE+'/ranch3d.html?qa=willows',{timeout:120000});await page.waitForFunction(()=>window.__q?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__q;q.G.save.sync(s=>{s.qualityLocked=true;s.unlocked=s.unlocked||{};for(const rg of q.G.tables.REGIONS)if(rg.unlock)s.unlocked[rg.id]=true;});q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;advanceTime(0);q.G.gfx.apply('high');q.tackVisibility=Object.values(q.TACK||{}).filter(o=>o?.isObject3D).map(o=>[o,o.visible]);
  q.read=rt=>{const w=Math.floor(rt.width),h=Math.floor(rt.height),p=new Uint16Array(w*h*4);q.renderer.readRenderTargetPixels(rt,0,0,w,h,p);let invalid=0,minAlphaBits=65535;for(let i=0;i<p.length;i+=4){if([0,1,2].some(c=>(p[i+c]&0x7c00)===0x7c00))invalid++;minAlphaBits=Math.min(minAlphaBits,p[i+3]);}return{invalid,minAlphaBits}};
 });console.log('Willows ready');const rows=[];
 const views=[...Array.from({length:6},(_,i)=>({name:'willow-'+i,index:i})),{name:'bark',index:0,close:true},{name:'low',index:0,tier:'low'},{name:'medium',index:0,tier:'medium'},{name:'rain',index:0,rain:true},{name:'night',index:0,time:0},{name:'backlit',index:0,time:.75},{name:'canopy-interior',index:3,inside:true}];
 for(const c of views){
  const row=await page.evaluate(c=>{const q=__q,T=q.THREE,d=q.G.photoscans.willows;if(!d)throw Error('Willows failed: '+q.G.photoscans.errors.join(','));
   const t=d.records[c.index],floor=q.groundH(t.x,t.z),h=7,offset=c.index===3?[-1.5,1.1]:c.index===4?[-1.1,.9]:[1.1,1.4];
   const eye=new T.Vector3(t.x+h*offset[0],floor+h*.65,t.z+h*offset[1]),look=new T.Vector3(t.x,floor+h*.48,t.z);
   if(c.close){eye.set(t.x+1.7,floor+1.45,t.z+2.5);look.set(t.x,floor+1.5,t.z);}
   if(c.inside){eye.set(t.x+.8,floor+4,t.z+1);look.set(t.x,floor+5,t.z);}
   q.G.gfx.apply(c.tier||'high');q.player.pos.set(eye.x,0,eye.z);q.player.speed=q.player.y=q.player.vy=0;const render=q.renderer.render;q.renderer.render=()=>{};
   try{for(let i=0;i<50;i++){q.day(c.time??.34,c.rain);q.step(.1)}}finally{q.renderer.render=render}
   q.player.mesh.visible=false;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=false;const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=false;
   q.camera.position.copy(eye);q.camera.lookAt(look);q.G.waterReflections.update(performance.now()+100);q.composer.render();
   return{name:c.name,at:[t.x,t.z],buffers:[q.composer.renderTarget1,q.composer.renderTarget2].map(q.read),gl:q.renderer.getContext().getError(),triangles:d.triangles,treeBudget:q.G.photoscans.treeTriangleBudget,activeTreeTriangles:q.G.photoscans.activeTreeTriangles,image:q.renderer.domElement.toDataURL('image/webp',.96).split(',')[1]};
  },c);fs.writeFileSync(path.join(out,c.name+'.webp'),Buffer.from(row.image,'base64'));delete row.image;rows.push(row);console.log(c.name);
 }
 const state=await page.evaluate(()=>{const q=__q,T=q.THREE,W=q.G.world,d=q.G.photoscans.willows,old=q.G.quartersPkg.willowTrees;
  let finite=true,normalMin=Infinity,outwardMin=1,opaque=true,shadow=true,boundsError=0;const trees=d.records.map((t,i)=>{
   const source=t.source,p=source.bark.attributes.position,n=source.bark.attributes.normal;
   // First fifteen bole rings: lighting normals must face the outside, not the hollow interior.
   for(let k=0;k<15;k++){const center=new T.Vector3();for(let j=0;j<13;j++)center.add(new T.Vector3().fromBufferAttribute(p,k*14+j));center.divideScalar(13);
    for(let j=0;j<13;j++){const at=k*14+j;outwardMin=Math.min(outwardMin,new T.Vector3().fromBufferAttribute(p,at).sub(center).normalize().dot(new T.Vector3().fromBufferAttribute(n,at)));}}
   for(const g of[source.bark,source.crown,source.farCrown,t.root.children[0].geometry]){
    for(const a of Object.values(g.attributes))for(const v of a.array)if(!Number.isFinite(v))finite=false;
    const ns=g.attributes.normal;for(let j=0;j<ns.count;j++)normalMin=Math.min(normalMin,Math.hypot(ns.getX(j),ns.getY(j),ns.getZ(j)));
   }
   boundsError=Math.max(boundsError,source.crown.boundingBox.min.distanceTo(source.farCrown.boundingBox.min),source.crown.boundingBox.max.distanceTo(source.farCrown.boundingBox.max));
   for(const mesh of t.root.children){opaque&&=!mesh.material.transparent&&!mesh.material.alphaTest;shadow&&=mesh.castShadow&&mesh.receiveShadow&&!!mesh.customDepthMaterial;}
   const collider=W.colliders.find(c=>Math.hypot(c.x-t.x,c.z-t.z)<.001&&c.r===1);
   return{index:i,x:t.x,z:t.z,yaw:t.yaw,legacyVisible:old[i].visible,positionError:t.root.position.distanceTo(old[i].position),yawError:Math.abs(t.yaw-old[i].rotation.y),leaves:t.leaves,shoots:t.shoots,collider:!!collider&&collider.trunk&&collider.height>=t.height,groundError:Math.abs(t.root.position.y-q.groundH(t.x,t.z))};
  });
  const tiers=[],render=q.renderer.render;q.renderer.render=()=>{};try{for(const tier of['low','medium','high']){
   q.G.gfx.apply(tier);q.player.pos.set(310,0,300);q.step(.4);q.G.photoscans.update();tiers.push({tier,near:d.records.filter(t=>t.near).length,triangles:d.triangles,missing:d.records.filter(t=>!t.root.visible||t.root.children.some(m=>!m.visible||!m.geometry.index.count)).length,active:q.G.photoscans.activeTreeTriangles,budget:q.G.photoscans.treeTriangleBudget});
  }}finally{q.renderer.render=render}
  const rides=[],mounted=[];
  const approachClear=(t,a)=>{
   for(let r=1.65;r<=4.01;r+=.2){const x=t.x+Math.cos(a)*r,z=t.z+Math.sin(a)*r,h=q.groundH(x,z);
    if(W.colliders.some(c=>!c.precise&&Math.hypot(x-c.x,z-c.z)<c.r+.56))return false;
    if(W.solidWorld.resolve({x,z},{bottom:h+.38,top:h+2.65,radius:.55}))return false;
    if(W.walls.some(w=>{const dx=w.x2-w.x1,dz=w.z2-w.z1,f=Math.max(0,Math.min(1,((x-w.x1)*dx+(z-w.z1)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-w.x1-f*dx,z-w.z1-f*dz)<.66}))return false;
   }return true;
  };
  for(const t of d.records)for(const direction of[1,-1]){
   const base=direction===1?0:Math.PI,candidates=Array.from({length:24},(_,i)=>base+(i%2?-1:1)*Math.ceil(i/2)*Math.PI/24),angle=candidates.find(a=>approachClear(t,a));
   if(angle===undefined)throw Error('No clear mounted approach to willow '+t.index+' direction '+direction);
   const startX=t.x+Math.cos(angle)*4,startZ=t.z+Math.sin(angle)*4;
   q.player.pos.set(startX,0,startZ);q.player.heading=Math.atan2(-Math.cos(angle),-Math.sin(angle));q.player.speed=q.player.y=q.player.vy=0;q.player.flying=false;q.player.stam=1;q.G.followCam.reset();q.keys.KeyW=true;
   let closest=Infinity,groundError=0,cameraError=false,maxStep=0;q.renderer.render=()=>{};
   try{for(let i=0;i<140;i++){const before=q.player.pos.clone();q.day();q.step(1/30);maxStep=Math.max(maxStep,before.distanceTo(q.player.pos));closest=Math.min(closest,Math.hypot(q.player.pos.x-t.x,q.player.pos.z-t.z));groundError=Math.max(groundError,Math.abs(q.player.mesh.position.y-q.groundH(q.player.pos.x,q.player.pos.z)));cameraError||=![...q.camera.position.toArray(),...q.player.pos.toArray()].every(Number.isFinite);}}finally{q.renderer.render=render;q.keys.KeyW=false;}
   rides.push({tree:t.index,direction,angle,closest,groundError,maxStep,cameraError,distance:Math.hypot(q.player.pos.x-startX,q.player.pos.z-startZ)});
   if(direction===1&&[0,2,4].includes(t.index)){
    q.player.mesh.visible=true;if(q.player.rider?.g)q.player.rider.g.visible=true;for(const[o,visible]of q.tackVisibility)o.visible=visible;const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=true;
    q.composer.render();mounted.push({name:'mounted-'+t.index,buffers:[q.composer.renderTarget1,q.composer.renderTarget2].map(q.read),gl:q.renderer.getContext().getError(),image:q.renderer.domElement.toDataURL('image/webp',.96).split(',')[1]});
   }
  }
  return{mounted,trees,finite,normalMin,outwardMin,opaque,shadow,boundsError,tiers,rides,sites:q.G.quartersPkg.sites,errors:[...q.G.errors,...q.G.photoscans.errors,...q.G.worldDetails.errors]};
 });
 for(const row of state.mounted){fs.writeFileSync(path.join(out,row.name+'.webp'),Buffer.from(row.image,'base64'));delete row.image;rows.push(row);}delete state.mounted;
 const checks={allSixReplaced:state.trees.length===6&&state.trees.every(t=>!t.legacyVisible),stablePositions:state.trees.every(t=>t.positionError<.001&&t.yawError<.001),finiteGeometry:state.finite,validNormals:state.normalMin>.9,outwardBark:state.outwardMin>.5,opaqueSurfaces:state.opaque,realShadows:state.shadow,
  exactLODBounds:state.boundsError<.00001,treeBudgets:state.tiers.every(t=>t.missing===0&&t.triangles<650000&&t.active<=t.budget)&&state.tiers[0].near===0&&state.tiers[2].near===6,
  retainedTrunks:state.trees.every(t=>t.collider),groundedBases:state.trees.every(t=>t.groundError<.001),mountedCollision:state.rides.every(r=>r.closest>=1.49&&r.closest<1.6&&r.distance>2.3&&r.distance<2.8&&r.maxStep<.6&&r.groundError<.01&&!r.cameraError),
  finitePixels:rows.every(r=>r.buffers.every(b=>b.invalid===0)),opaqueOutput:rows.every(r=>r.buffers.every(b=>b.minAlphaBits>=15300)),webGL:rows.every(r=>r.gl===0),noErrors:!errors.length&&!state.errors.length};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,rows,state,errors},null,2));console.log(JSON.stringify({checks,tiers:state.tiers,outwardMin:state.outwardMin,rides:state.rides,errors}));assert(Object.values(checks).every(Boolean),'Willow acceptance failed');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
