// Verify real standing timber in every graphics tier and on mounted approaches.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const out=path.resolve(process.argv[2]||'output/deadwood');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await page.route('**/ranch3d.html*',async r=>{const res=await r.fetch();await r.fulfill({response:res,body:(await res.text()).replace('const MERGE_STATS=mergeStatics();',`window.__q={THREE,scene,camera,renderer,composer,G,player,groundH,TACK,keys,step(dt){manualStepping=true;tick(dt)},day(t=.34,rain=false){dayT=t;weather.mode=rain?'rain':'clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
 await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(QA.BASE+'/ranch3d.html?qa=deadwood',{timeout:120000});await page.waitForFunction(()=>window.__q?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__q;q.G.save.sync(s=>{s.qualityLocked=true;s.unlocked=s.unlocked||{};for(const rg of q.G.tables.REGIONS)if(rg.unlock)s.unlocked[rg.id]=true;});q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;advanceTime(0);q.G.gfx.apply('high');
  q.read=rt=>{const w=Math.floor(rt.width),h=Math.floor(rt.height),p=new Uint16Array(w*h*4);q.renderer.readRenderTargetPixels(rt,0,0,w,h,p);let invalid=0,minAlphaBits=65535;for(let i=0;i<p.length;i+=4){if([0,1,2].some(c=>(p[i+c]&0x7c00)===0x7c00))invalid++;minAlphaBits=Math.min(minAlphaBits,p[i+3]);}return{invalid,minAlphaBits}};
 });console.log('Deadwood ready');const rows=[];
 for(const c of [{name:'canyon-edge',at:[-124,32]},{name:'amberwood',at:[300,-300]},{name:'willowmere',at:[310,300]},{name:'frostpine',at:[-300,-320]},{name:'ochre',at:[-330,300]},
  {name:'close-bark',at:[-124,32],close:true},{name:'low',at:[-124,32],tier:'low'},{name:'medium',at:[-124,32],tier:'medium'},{name:'rain',at:[-124,32],rain:true},{name:'night',at:[-124,32],time:0},{name:'backlit',at:[-124,32],time:.75}]){
  const row=await page.evaluate(c=>{const q=__q,T=q.THREE,d=q.G.photoscans.deadwood;if(!d)throw Error('Deadwood failed: '+q.G.photoscans.errors.join(','));
   const candidates=d.records.slice().sort((a,b)=>Math.hypot(a.x-c.at[0],a.z-c.at[1])-Math.hypot(b.x-c.at[0],b.z-c.at[1]));const t=candidates[0],floor=q.groundH(t.x,t.z),h=t.height/.92;
   const eye=new T.Vector3(t.x+h*1.1,floor+h*.65,t.z+h*1.4),look=new T.Vector3(t.x,floor+h*.48,t.z);
   if(c.close){eye.set(t.x+1.25,floor+1.45,t.z+1.8);look.set(t.x,floor+1.1,t.z);}
   q.G.gfx.apply(c.tier||'high');q.player.pos.set(eye.x,0,eye.z);q.player.speed=q.player.y=q.player.vy=0;const render=q.renderer.render;q.renderer.render=()=>{};
   try{for(let i=0;i<60;i++){q.day(c.time??.34,c.rain);q.step(.1)}}finally{q.renderer.render=render}
   q.player.mesh.visible=false;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=false;const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=false;
   q.camera.position.copy(eye);q.camera.lookAt(look);q.G.waterReflections.update(performance.now()+100);q.composer.render();
   return{name:c.name,at:[t.x,t.z],buffers:[q.composer.renderTarget1,q.composer.renderTarget2].map(q.read),gl:q.renderer.getContext().getError(),triangles:d.triangles,budget:d.budget,image:q.renderer.domElement.toDataURL('image/webp',.96).split(',')[1]};
  },c);fs.writeFileSync(path.join(out,c.name+'.webp'),Buffer.from(row.image,'base64'));delete row.image;rows.push(row);console.log(c.name);
 }
 const state=await page.evaluate(()=>{const q=__q,T=q.THREE,W=q.G.world,d=q.G.photoscans.deadwood,b=q.G.floraPkg.bank.snag,m=new T.Matrix4(),p=new T.Vector3(),before=d.records.map(t=>t.matrix.toArray()),missing=[],extra=[],baseline=[];
  for(let i=0;i<b.n;i++){b.im.getMatrixAt(i,m);if(Math.abs(m.determinant())<1e-8)continue;p.setFromMatrixPosition(m);baseline.push([i,p.x,p.z]);}
  for(const [index,x,z]of baseline)if(!d.records.some(t=>t.index===index&&t.x===x&&t.z===z))missing.push(index);
  for(const t of d.records)if(!baseline.some(([i])=>i===t.index))extra.push(t.index);
  const levels=[];let finite=true,opaque=true,normalMin=Infinity,nearFarBaseError=0;const variants={};
  for(const mesh of d.root.children){let tri=mesh.geometry.index.count/3;const n=mesh.geometry.attributes.normal;for(const a of Object.values(mesh.geometry.attributes))for(const v of a.array)if(!Number.isFinite(v))finite=false;
   for(let i=0;i<n.count;i++)normalMin=Math.min(normalMin,Math.hypot(n.getX(i),n.getY(i),n.getZ(i)));
   opaque=opaque&&!mesh.material.transparent&&!mesh.material.alphaTest;levels.push({name:mesh.name,triangles:tri,map:mesh.material.map?.image.width,normal:mesh.material.normalMap?.image.width,roughness:mesh.material.roughnessMap?.image.width,receive:mesh.receiveShadow});
   const id=mesh.name.split(' | ')[1],level=mesh.name.split(' | ')[2];((variants[id]??={})[level]??=new T.Box3()).union(mesh.geometry.boundingBox);
  }
  for(const v of Object.values(variants))nearFarBaseError=Math.max(nearFarBaseError,Math.abs(v.near.min.y-v.far.min.y));
  const tiers=[],render=q.renderer.render;q.renderer.render=()=>{};try{for(const tier of['low','medium','high']){
   q.G.gfx.apply(tier);q.player.pos.set(-124,0,32);q.step(.4);d.update();const modes=d.records.map(()=>new Set());
   for(const mesh of d.root.children)if(mesh.visible)for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);p.setFromMatrixPosition(m);const index=d.records.findIndex(t=>Math.hypot(t.x-p.x,t.z-p.z)<.001);if(index>=0)modes[index].add(mesh.name.split(' | ')[2]);}
   tiers.push({tier,near:d.nearTrees,triangles:d.triangles,budget:d.budget,missing:modes.filter(x=>x.size!==1).length});
  }}finally{q.renderer.render=render}
  const stable=d.records.every((t,i)=>t.matrix.toArray().every((v,j)=>v===before[i][j]));
  const colliders=d.records.map(t=>({x:t.x,z:t.z,present:W.colliders.some(c=>Math.hypot(c.x-t.x,c.z-t.z)<.001&&c.r>=.5&&c.height>=t.height),groundError:Math.abs(t.matrix.elements[13]-q.groundH(t.x,t.z)+.04)}));
  const t=d.records.slice().sort((a,b)=>Math.hypot(a.x+124,a.z-32)-Math.hypot(b.x+124,b.z-32))[0],rides=[];
  for(const direction of[1,-1]){
   q.player.pos.set(t.x+direction*5,0,t.z);q.player.heading=-direction*Math.PI/2;q.player.speed=q.player.y=q.player.vy=0;q.player.flying=false;q.player.stam=1;q.G.followCam.reset();q.keys.KeyW=true;
   let closest=Infinity,groundError=0,cameraError=false;q.renderer.render=()=>{};
   try{for(let i=0;i<160;i++){q.day();q.step(1/30);closest=Math.min(closest,Math.hypot(q.player.pos.x-t.x,q.player.pos.z-t.z));groundError=Math.max(groundError,Math.abs(q.player.mesh.position.y-q.groundH(q.player.pos.x,q.player.pos.z)));cameraError||=![...q.camera.position.toArray(),...q.player.pos.toArray()].every(Number.isFinite);}}finally{q.renderer.render=render;q.keys.KeyW=false;}
   rides.push({closest,groundError,cameraError,distance:Math.hypot(q.player.pos.x-(t.x+direction*5),q.player.pos.z-t.z)});
  }
  return{trees:d.trees,legacyVisible:b.im.visible,missing,extra,finite,opaque,normalMin,nearFarBaseError,levels,tiers,stable,colliders,rides,errors:[...q.G.errors,...q.G.photoscans.errors,...q.G.worldDetails.errors]};
 });
 const checks={allSitesReplaced:state.trees>300&&!state.legacyVisible&&!state.missing.length&&!state.extra.length,finiteGeometry:state.finite,validNormals:state.normalMin>.9,opaqueSurfaces:state.opaque,
  detailedSurfaces:state.levels.every(l=>l.map>=1024&&l.normal>=1024&&l.roughness>=512&&l.receive),matchingFooting:state.nearFarBaseError<.012,
  stablePositions:state.stable,allGraphicsTiers:state.tiers.every(t=>t.missing===0&&t.triangles<=t.budget)&&state.tiers[0].near===0&&state.tiers[2].near>0,
  retainedTrunks:state.colliders.every(c=>c.present),groundedBases:state.colliders.every(c=>c.groundError<.001),mountedCollision:state.rides.every(r=>r.closest>=1.04&&r.closest<1.2&&r.distance>3.5&&r.groundError<.01&&!r.cameraError),
  finitePixels:rows.every(r=>r.buffers.every(b=>b.invalid===0)),opaqueOutput:rows.every(r=>r.buffers.every(b=>b.minAlphaBits>=15300)),webGL:rows.every(r=>r.gl===0),noErrors:!errors.length&&!state.errors.length};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,rows,state,errors},null,2));console.log(JSON.stringify({checks,tiers:state.tiers,normalMin:state.normalMin,nearFarBaseError:state.nearFarBaseError,rides:state.rides,errors}));assert(Object.values(checks).every(Boolean),'Deadwood acceptance failed');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
