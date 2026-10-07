// Native-GPU coverage for the canyon's sandstone, jointed forms and mounted arch passage.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const out=path.resolve(process.argv[2]||'output/canyon-landforms');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await page.route('**/ranch3d.html*',async r=>{const res=await r.fetch();await r.fulfill({response:res,body:(await res.text()).replace('const MERGE_STATS=mergeStatics();',`window.__canyonQA={THREE,scene,camera,renderer,composer,G,player,groundH,TACK,keys,step(dt){manualStepping=true;tick(dt)},day(t=.34,rain=false){dayT=t;weather.mode=rain?'rain':'clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
 await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(QA.BASE+'/ranch3d.html?qa=canyon-landforms',{timeout:120000});await page.waitForFunction(()=>window.__canyonQA?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__canyonQA;q.G.save.sync(s=>s.qualityLocked=true);q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;advanceTime(0);
  q.read=rt=>{const w=Math.floor(rt.width),h=Math.floor(rt.height),p=new Uint16Array(w*h*4);q.renderer.readRenderTargetPixels(rt,0,0,w,h,p);let invalid=0,lit=0;
   for(let i=0;i<p.length;i+=4){if([0,1,2].some(c=>(p[i+c]&0x7c00)===0x7c00))invalid++;else if(p[i]||p[i+1]||p[i+2])lit++;}return {invalid,lit};};
 });
 console.log('Canyon ready');const rows=[];
 const canyon={eye:[-202,2.2,151],look:[-253,6,179]},ochre={eye:[-286,15,260],look:[-343,15,286]};
 for(const c of [{name:'canyon',...canyon},{name:'ochre',...ochre},{name:'cliff-close',eye:[-224,2.5,153],look:[-242,6,147]},
  {name:'arch',arch:true,eye:[4,3,18],look:[0,5,0]},
  {name:'canyon-medium',...canyon,tier:'medium'},{name:'canyon-low',...canyon,tier:'low'},
  {name:'canyon-rain',...canyon,rain:true},{name:'ochre-night',...ochre,time:0},{name:'arch-golden',arch:true,eye:[4,3,18],look:[0,5,0],time:.22}]){
  const row=await page.evaluate(c=>{const q=__canyonQA,T=q.THREE;q.G.gfx.apply(c.tier||'high');let eye=new T.Vector3(...c.eye),look=new T.Vector3(...c.look);
   if(c.arch){const a=q.scene.getObjectByName('Geology | Ochre sandstone arch');a.updateMatrixWorld(true);eye=a.localToWorld(eye);look=a.localToWorld(look);}else{eye.y+=q.groundH(eye.x,eye.z);look.y+=q.groundH(look.x,look.z);}
   q.player.pos.set(eye.x,0,eye.z);q.player.speed=0;const render=q.renderer.render;q.renderer.render=()=>{};
   try{for(let i=0;i<210;i++){q.day(c.time??.34,c.rain);q.step(1/30);q.scene.onBeforeRender();}}finally{q.renderer.render=render;}
   q.player.mesh.visible=false;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=false;const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=false;
   q.camera.position.copy(eye);q.camera.lookAt(look);q.G.waterReflections.update(performance.now()+100);
   let source;const pass=q.composer.passes[0],original=pass.render;
   pass.render=function(renderer,write,read,...rest){original.call(this,renderer,write,read,...rest);source=q.read(read);};
   try{q.composer.render();}finally{pass.render=original;}
   const scan=q.G.photoscans;return {name:c.name,source,buffers:[q.composer.renderTarget1,q.composer.renderTarget2].map(q.read),gl:q.renderer.getContext().getError(),treeTriangles:scan.activeTreeTriangles,treeBudget:scan.treeTriangleBudget,image:q.renderer.domElement.toDataURL('image/webp',.96).split(',')[1]};
  },c);fs.writeFileSync(path.join(out,c.name+'.webp'),Buffer.from(row.image,'base64'));delete row.image;rows.push(row);console.log(c.name);
 }
 const state=await page.evaluate(()=>{const q=__canyonQA,T=q.THREE,W=q.G.world,forms=[];
  q.scene.traverse(o=>{const d=o.userData.geology;if(!o.isGroup||!d?.radius||!d.height)return;const m=o.children[0],g=m.geometry,ground=g.userData.groundReference,p=g.attributes.position;let finite=true,baseGap=-Infinity;
   for(const a of Object.values(g.attributes))for(const n of a.array)if(!Number.isFinite(n))finite=false;
   if(ground)for(let i=0;i<p.count;i++)if(ground[i*3+1]<0)baseGap=Math.max(baseGap,p.getY(i)+o.position.y-q.groundH(p.getX(i)+o.position.x,p.getZ(i)+o.position.z));
   forms.push({seed:d.seed,kind:d.kind,triangles:g.index.count/3,finite,baseGap,casts:m.castShadow,receives:m.receiveShadow,material:m.material.name,
    maps:['map','normalMap','roughnessMap'].map(k=>({key:k,width:m.material[k]?.image?.width||0})),collision:W.colliders.some(c=>Math.hypot(c.x-o.position.x,c.z-o.position.z)<.01&&c.r>=d.radius*.94)});
  });
  const arch=q.scene.getObjectByName('Geology | Ochre sandstone arch');arch.updateMatrixWorld(true);
  const passage=[1,2.65,4].every(y=>{const point=arch.localToWorld(new T.Vector3(0,y,12)),dir=new T.Vector3(0,0,-1).transformDirection(arch.matrixWorld);return new T.Raycaster(point,dir,0,24).intersectObject(arch,true).length===0;});
  const a=arch.localToWorld(new T.Vector3(0,0,9)),b=arch.localToWorld(new T.Vector3(0,0,-9));
  q.G.gfx.apply('high');q.player.pos.set(a.x,0,a.z);q.player.heading=Math.atan2(b.x-a.x,b.z-a.z);q.player.speed=0;q.player.y=0;q.player.vy=0;q.player.flying=false;q.G.followCam.reset();q.keys.KeyW=true;
  const render=q.renderer.render;q.renderer.render=()=>{};let steps=0,closest=Infinity;const trace=[];
  try{for(;steps<360;steps++){q.day();q.step(1/30);closest=Math.min(closest,Math.hypot(q.player.pos.x-b.x,q.player.pos.z-b.z));if(steps%10===0)trace.push(arch.worldToLocal(new T.Vector3(q.player.pos.x,0,q.player.pos.z)).toArray());if(arch.worldToLocal(new T.Vector3(q.player.pos.x,0,q.player.pos.z)).z<=-9)break;}}finally{q.keys.KeyW=false;q.renderer.render=render;}
  // Crossing the far side within the central four-metre corridor is a completed ride.
  // Small props can deflect the horse slightly; reaching one exact point is not required.
  const ride={localEnd:arch.worldToLocal(new T.Vector3(q.player.pos.x,0,q.player.pos.z)).toArray(),closest,trace,start:a.toArray(),end:b.toArray(),distance:Math.hypot(q.player.pos.x-a.x,q.player.pos.z-a.z),remaining:Math.hypot(q.player.pos.x-b.x,q.player.pos.z-b.z),steps,finite:Number.isFinite(q.player.pos.x+q.player.pos.z+q.camera.position.length())};
  const archMaterial=arch.children[0].material;
  return {forms,passage,ride,archSandstone:archMaterial===q.scene.getObjectByName('Geology | layered mesa').children[0].material,featureErrors:q.G.errors,assetErrors:[...q.G.worldDetails.errors,...q.G.photoscans.errors]};
 });
 const checks={allFormationsPresent:state.forms.length===20,geometryFinite:state.forms.every(f=>f.finite),boundedGeometry:state.forms.every(f=>f.triangles<17000),
  groundedBases:state.forms.every(f=>f.baseGap<=.001),shadowFlags:state.forms.every(f=>f.casts&&f.receives),photoscannedSurfaces:state.forms.every(f=>f.material==='Canyon | scanned stratified sandstone'&&f.maps.every(m=>m.width>=512)),
  solidFormations:state.forms.every(f=>f.collision),archSharesSandstone:state.archSandstone,archPassageOpen:state.passage,mountedArchPassage:state.ride.localEnd[2]<=-9&&Math.abs(state.ride.localEnd[0])<2&&state.ride.distance>17.9&&state.ride.finite,
  sourcePixelsFinite:rows.every(r=>r.source.invalid===0&&r.source.lit>100),postPixelsFinite:rows.every(r=>r.buffers.every(b=>b.invalid===0)),treeBudgets:rows.every(r=>r.treeTriangles<=r.treeBudget),validWebGL:rows.every(r=>r.gl===0),
  noErrors:errors.length===0&&state.featureErrors.length===0&&state.assetErrors.length===0};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,rows,state,errors},null,2));console.log(JSON.stringify({checks,ride:state.ride}));assert(Object.values(checks).every(Boolean),'Canyon acceptance failed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
