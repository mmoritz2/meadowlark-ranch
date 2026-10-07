const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const out=path.resolve(process.argv[2]||'output/botanical-harvest');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await page.route('**/ranch3d.html*',async r=>{const res=await r.fetch();await r.fulfill({response:res,body:(await res.text()).replace('const MERGE_STATS=mergeStatics();',`window.__qa={THREE,scene,camera,renderer,composer,G,player,groundH,TACK,forage,carrots,nearGrass,keys,step(dt){manualStepping=true;tick(dt)},day(){dayT=.34;weather.mode='clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
 await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(QA.BASE+'/ranch3d.html?qa=botanical',{timeout:120000});await page.waitForFunction(()=>window.__qa?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__qa;q.G.save.sync(s=>s.qualityLocked=true);q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;advanceTime(0);q.G.gfx.apply('high');q.day();});
 const state=await page.evaluate(()=>{
  const q=__qa,plants=[...q.forage.map(f=>({item:f.item,g:f.g})),...q.carrots.map(c=>({item:'carrot',g:c.g}))];
  const gardens=[];q.scene.traverse(o=>{if(o.name==='Cottage | living window boxes'){
   const plants=[],m=new q.THREE.Matrix4();for(const mesh of o.children)for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);const size=mesh.geometry.boundingBox.clone().applyMatrix4(m).getSize(new q.THREE.Vector3());plants.push({size:size.toArray(),alpha:mesh.material.alphaTest,hasMap:!!mesh.material.map,casts:mesh.castShadow});}gardens.push(plants);
  }});
  const terrain=q.scene.getObjectByName('Pasture terrain');terrain.updateMatrixWorld(true);
  return {plants:plants.map(p=>({item:p.item,at:p.g.position.toArray(),heightError:p.g.position.y-q.groundH(p.g.position.x,p.g.position.z),renderedContact:new q.THREE.Raycaster(new q.THREE.Vector3(p.g.position.x,200,p.g.position.z),new q.THREE.Vector3(0,-1,0)).intersectObject(terrain)[0]?.point.y-p.g.position.y,...p.g.userData.harvestArt,draws:p.g.children.length})),gardens,gardenAsset:q.G.worldDetails.gardenAsset,errors:[...q.G.errors,...q.G.worldDetails.errors]};
 });
 const cases=[{name:'village',eye:[29,3,-32],look:[65,4,-70]}];
 const cottage=await page.evaluate(()=>{const q=__qa,root=q.G.worldPkg.LANDMARKS.find(s=>s.id==='cottonwood:clubhouse').grp;root.updateMatrixWorld(true);const eye=root.localToWorld(new q.THREE.Vector3(4.6,2.6,7.2)),look=root.localToWorld(new q.THREE.Vector3(0,2.4,0));return {name:'cottage-gardens',eye:eye.toArray(),look:look.toArray(),absolute:true};});cases.push(cottage);
 for(const item of['strawberry','berries','lettuce','corn','pricklypear','carrot'])cases.push({name:item,item});
 const rows=[];
 for(const view of cases){const row=await page.evaluate(async v=>{
  const q=__qa;let eye=v.eye,look=v.look;if(v.item){const f=v.item==='carrot'?q.carrots[1]:q.forage.find(f=>f.item===v.item),p=f.g.position;f.g.visible=true;f.t=0;const h=new q.THREE.Box3().setFromObject(f.g).getSize(new q.THREE.Vector3()).y;eye=[p.x+1.05,Math.max(.65,h*.85),p.z+1.15];look=[p.x,Math.max(.23,h*.50),p.z];}
  if(!v.absolute){eye=[eye[0],eye[1]+q.groundH(eye[0],eye[2]),eye[2]];look=[look[0],look[1]+q.groundH(look[0],look[2]),look[2]];}
  // Keep the rider outside the 1.5 m collection radius while inspecting plants.
  q.player.pos.set(eye[0]+2,0,eye[2]+2);q.player.speed=0;q.day();const render=q.renderer.render;q.renderer.render=()=>{};
  try{for(let i=0;i<30;i++)q.step(.1);let settled=0;for(let i=0;i<180;i++){q.step(.016);settled=q.G.world.npcCharacters.stats().pending?0:settled+1;if(settled>=2)break;await new Promise(r=>setTimeout(r,40));}}finally{q.renderer.render=render;}
  q.player.mesh.visible=false;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=false;const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=false;
  q.camera.position.set(...eye);q.camera.lookAt(...look);q.composer.render();
  const rt=q.composer.readBuffer,pixels=new Uint16Array(Math.floor(rt.width)*Math.floor(rt.height)*4);q.renderer.readRenderTargetPixels(rt,0,0,Math.floor(rt.width),Math.floor(rt.height),pixels);let invalid=0;for(let i=0;i<pixels.length;i++)if(i%4!==3&&(pixels[i]&0x7c00)===0x7c00)invalid++;
  return {image:q.renderer.domElement.toDataURL('image/webp',.95).split(',')[1],invalid,gl:q.renderer.getContext().getError()};
 },view);fs.writeFileSync(path.join(out,view.name+'.webp'),Buffer.from(row.image,'base64'));delete row.image;rows.push({name:view.name,...row});console.log(view.name,JSON.stringify(row));}
 const gameplay=await page.evaluate(()=>{
  const q=__qa,render=q.renderer.render;q.renderer.render=()=>{};const results=[];
  try{
   // Exercise the normal pickup loop for every food, then its normal timer-based
   // respawn. Isolating other pickups makes inventory deltas unambiguous.
   for(const f of [...q.forage,...q.carrots]){f.g.visible=false;f.t=9999;}
   const kinds=[...new Set(q.forage.map(f=>f.item))];
   for(const item of kinds){
    const f=q.forage.find(f=>f.item===item),before=q.G.save.fresh().items[item]||0;
    f.g.position.set(0,q.groundH(0,30),30);f.g.visible=true;f.t=0;q.player.pos.set(0,0,30);q.player.speed=0;q.player.y=0;q.player.vy=0;q.player.flying=false;q.step(.016);
    const picked=!f.g.visible,delta=(q.G.save.fresh().items[item]||0)-before;
    q.player.pos.set(0,0,0);f.t=.001;q.step(.016);
    const anchored=Math.abs(f.g.position.y-q.groundH(f.g.position.x,f.g.position.z))<1e-6;
    results.push({item,picked,delta,respawned:f.g.visible,anchored});f.g.visible=false;f.t=9999;
   }
   const c=q.carrots[0],before=q.G.save.fresh().items.carrot||0;c.g.visible=true;c.g.position.set(0,q.groundH(0,30),30);q.player.pos.set(0,0,30);q.player.y=0;q.step(.016);
   results.push({item:'carrot',picked:!c.g.visible,delta:(q.G.save.fresh().items.carrot||0)-before,respawned:null});
   q.player.pos.set(0,0,0);c.t=.001;q.step(.016);results.at(-1).respawned=c.g.visible;results.at(-1).anchored=c.g.position.x===c.home[0]&&c.g.position.z===c.home[1]&&Math.abs(c.g.position.y-q.groundH(...c.home))<1e-6;
   const yaw=c.g.rotation.y;q.step(.25);results.at(-1).planted=c.g.rotation.y===yaw;
  }finally{q.renderer.render=render;}return results;
 });
 const checks={allSpecies:new Set(state.plants.map(p=>p.item)).size===20,allReplaced:state.plants.every(p=>p.planted&&p.triangles>0&&p.draws<=3),boundedGeometry:state.plants.reduce((n,p)=>n+p.triangles,0)<500000,
  fittedGardens:state.gardenAsset==='periwinkle_plant'&&state.gardens.length===10&&state.gardens.every(g=>g?.length===24&&g.every(p=>Math.max(p.size[0],p.size[2])<.5&&p.size[1]>.29&&p.size[1]<.51&&p.alpha>0&&p.hasMap&&p.casts)),
  allFoodsCollectAndRegrow:gameplay.length===20&&gameplay.every(p=>p.picked&&p.delta===1&&p.respawned&&p.anchored),carrotsStayPlanted:gameplay.at(-1).planted,terrainContact:state.plants.every(p=>Math.abs(p.renderedContact)<1e-6),
  validPixels:rows.every(r=>r.invalid===0&&r.gl===0),noErrors:!errors.length&&!state.errors.length};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,state,gameplay,rows,errors},null,2));console.log(JSON.stringify(checks));assert(Object.values(checks).every(Boolean),'Botanical acceptance failed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
