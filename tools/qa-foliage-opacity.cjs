// Native GPU regression for bright foliage fringes from partial canvas alpha.
// Uses the production tree shader, a controlled MSAA fixture and settled world views.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const QA=require('./qa-platform.cjs');
const out=path.resolve(process.argv[2]||'output/foliage-opacity');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await page.route('**/ranch3d.html*',async r=>{const res=await r.fetch();await r.fulfill({response:res,body:(await res.text()).replace('const MERGE_STATS=mergeStatics();',`window.__foliageQA={THREE,scene,camera,renderer,composer,G,player,groundH,TACK,step(dt){manualStepping=true;tick(dt)},day(value=.34,rain=false){dayT=value;weather.mode=rain?'rain':'clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
 await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(QA.BASE+'/ranch3d.html?qa=foliage-opacity',{timeout:120000});
 await page.waitForFunction(()=>window.__foliageQA?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__foliageQA;q.G.save.sync(s=>s.qualityLocked=true);q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;advanceTime(0);
  q.readCanvas=()=>{const gl=q.renderer.getContext(),w=q.renderer.domElement.width,h=q.renderer.domElement.height,p=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,p);let partial=0,minAlpha=255;for(let i=3;i<p.length;i+=4){if(p[i]<255)partial++;minAlpha=Math.min(minAlpha,p[i]);}return {partial,minAlpha,width:w,height:h};};
  q.readTarget=rt=>{const w=Math.floor(rt.width),h=Math.floor(rt.height),p=new Uint16Array(w*h*4);q.renderer.readRenderTargetPixels(rt,0,0,w,h,p);let invalid=0,partial=0,minAlpha=1;const partialPixels=[];for(let i=0;i<p.length;i+=4){if([0,1,2].some(c=>(p[i+c]&0x7c00)===0x7c00))invalid++;if(p[i+3]<0x3c00){partial++;const alpha=q.THREE.DataUtils.fromHalfFloat(p[i+3]);minAlpha=Math.min(minAlpha,alpha);if(partialPixels.length<5)partialPixels.push({x:i/4%w,y:Math.floor(i/4/w),alpha});}}return {invalid,partial,minAlpha,partialPixels};};
 });
 console.log('World ready; checking leaf opacity.');const rows=[];
 const cases=[
  {name:'rain-high',tier:'high',rain:true,reproduce:true},
  {name:'rain-medium',tier:'medium',rain:true},{name:'rain-low',tier:'low',rain:true},
  {name:'day-high',tier:'high'},{name:'day-medium',tier:'medium'},{name:'day-low',tier:'low'},
  {name:'dawn',tier:'high',time:.15},{name:'night',tier:'high',time:0},
  {name:'near-canopy',tier:'high',near:true},{name:'direct-rain',tier:'high',rain:true,direct:true},
 ];
 if(process.argv.includes('--closeups'))cases.splice(0,cases.length,cases[0],{name:'canopy-close-high',tier:'high',near:true},{name:'canopy-close-low',tier:'low',near:true});
 for(const c of cases){const row=await page.evaluate(c=>{const q=__foliageQA;q.G.gfx.apply(c.tier);
   const tree=c.near?q.G.photoscans.treePositions.filter(t=>t.source==='canopy-broadleaf'&&t.height>8).sort((a,b)=>Math.hypot(a.x+70,a.z-70)-Math.hypot(b.x+70,b.z-70))[0]:null;
   let eye=[85,q.groundH(85,-150)+4,-150],look=[20,q.groundH(20,-35)+5,-35];
   if(tree){const h=tree.height,g=q.groundH(tree.x,tree.z);eye=[tree.x+h*.9,g+h*.35,tree.z+h*1.1];eye[1]=Math.max(eye[1],q.groundH(eye[0],eye[2])+1.5);look=[tree.x,g+h*.55,tree.z];}
   q.player.pos.set(eye[0],0,eye[2]);q.player.speed=0;
   const render=q.renderer.render;q.renderer.render=()=>{};try{for(let i=0;i<210;i++){q.day(c.time??.34,c.rain);q.step(1/30);q.scene.onBeforeRender();}}finally{q.renderer.render=render;}
   q.player.mesh.visible=false;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=false;const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=false;
   q.camera.position.set(...eye);q.camera.lookAt(...look);q.G.waterReflections.update(performance.now()+100);
   let source=null;const pass=q.composer.passes[0],original=pass.render;
   pass.render=function(renderer,write,read,...rest){original.call(this,renderer,write,read,...rest);source=q.readTarget(read);};
   try{if(c.direct){q.renderer.setRenderTarget(null);q.renderer.render(q.scene,q.camera);}else q.composer.render();}finally{pass.render=original;}
   let detailedTarget=false;
   if(tree){const matrix=new q.THREE.Matrix4(),position=new q.THREE.Vector3();q.scene.traverse(o=>{if(!o.isInstancedMesh||!o.geometry.attributes.canopyShade)return;for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);if(matrix.determinant()===0)continue;position.setFromMatrixPosition(matrix);if(Math.hypot(position.x-tree.x,position.z-tree.z)<.01)detailedTarget=true;}});}
   const result={name:c.name,tier:c.tier,...(tree?{tree,detailedTarget}:{}),source,canvas:q.readCanvas(),gl:q.renderer.getContext().getError(),image:q.renderer.domElement.toDataURL('image/webp',.96).split(',')[1]};
   if(c.reproduce){const mats=new Set();q.scene.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.alphaToCoverage&&m.blending===q.THREE.CustomBlending)mats.add(m);});
    for(const m of mats){m.blending=q.THREE.NormalBlending;m.needsUpdate=true;}
    q.composer.render();result.reproduced={materials:mats.size,...q.readCanvas(),image:q.renderer.domElement.toDataURL('image/webp',.96).split(',')[1]};
    for(const m of mats){m.blending=q.THREE.CustomBlending;m.needsUpdate=true;}
   }
   return result;
  },c);
  fs.writeFileSync(path.join(out,c.name+'.webp'),Buffer.from(row.image,'base64'));delete row.image;
  if(row.reproduced){fs.writeFileSync(path.join(out,'rain-before.webp'),Buffer.from(row.reproduced.image,'base64'));delete row.reproduced.image;}
  rows.push(row);console.log(JSON.stringify(row));
 }
 const fixtures=await page.evaluate(async()=>{const T=__foliageQA.THREE,{treeImpostor}=await import('./assets/tree-impostors.js');
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(96,96);renderer.setClearColor('#4f6e78',1);renderer.toneMapping=T.NoToneMapping;
  const data=new Uint8Array(64*32*4);for(let y=0;y<32;y++)for(let x=0;x<64;x++)data.set([50,100,35,Math.round((x%16)/15*255)],(y*64+x)*4);
  const albedo=new T.DataTexture(data,64,32);albedo.magFilter=T.LinearFilter;albedo.minFilter=T.LinearFilter;albedo.needsUpdate=true;
  const normals=new T.DataTexture(new Uint8Array([128,255,128,255]),1,1);normals.needsUpdate=true;
  const {geo,mat}=treeImpostor({THREE:T,albedo,normals,width:2,height:2,bottom:-1});
  const tree=new T.InstancedMesh(geo,mat,1);tree.setMatrixAt(0,new T.Matrix4());tree.instanceMatrix.needsUpdate=true;
  const scene=new T.Scene();scene.add(tree,new T.AmbientLight(0xffffff,1));
  const camera=new T.PerspectiveCamera(55,1,.1,20);camera.position.set(0,.1,3);camera.lookAt(0,0,0);
  const read=rt=>{renderer.setRenderTarget(rt);renderer.render(scene,camera);const p=new Uint16Array(96*96*4);renderer.readRenderTargetPixels(rt,0,0,96,96,p);return p;};
  const stats=p=>{let partial=0,invalid=0;for(let i=0;i<p.length;i+=4){if(p[i+3]<0x3c00)partial++;if([0,1,2].some(c=>(p[i+c]&0x7c00)===0x7c00))invalid++;}return {partial,invalid};};
  const rows=[];for(const samples of [...new Set([0,Math.min(2,renderer.capabilities.maxSamples),Math.min(4,renderer.capabilities.maxSamples)])])for(const fog of [false,true]){
   scene.fog=fog?new T.FogExp2('#a4c3cc',.45):null;mat.needsUpdate=true;
   const rt=new T.WebGLRenderTarget(96,96,{type:T.HalfFloatType,samples});
   mat.blending=T.CustomBlending;mat.needsUpdate=true;const fixed=read(rt);mat.blending=T.NormalBlending;mat.needsUpdate=true;const broken=read(rt);let colorDifference=0;
   for(let i=0;i<fixed.length;i+=4)for(let c=0;c<3;c++)colorDifference=Math.max(colorDifference,Math.abs(T.DataUtils.fromHalfFloat(fixed[i+c])-T.DataUtils.fromHalfFloat(broken[i+c])));
   rows.push({samples,fog,fixed:stats(fixed),broken:stats(broken),colorDifference});rt.dispose();
  }
  const gl=renderer.getContext().getError();geo.dispose();mat.userData.scanDepth.dispose();mat.dispose();albedo.dispose();normals.dispose();renderer.dispose();renderer.forceContextLoss();return {rows,gl};
 });
 // Allow one half-float rounding step in HDR blending; the displayed canvas
 // must still have exactly 255 alpha at every pixel. Keep the raw count in reports.
 const checks={
  visibleDetailedCanopy:rows.filter(r=>r.tree&&r.tier==='high').length>0&&rows.filter(r=>r.tree&&r.tier==='high').every(r=>r.detailedTarget),
  lowUsesDistantCanopy:rows.filter(r=>r.tree&&r.tier==='low').every(r=>!r.detailedTarget),
  worldCanvasOpaque:rows.every(r=>r.canvas.partial===0),worldSourceOpaque:rows.every(r=>!r.source||r.source.minAlpha>=1-1/2048),
  noInvalidPixels:rows.every(r=>!r.source||r.source.invalid===0)&&fixtures.rows.every(r=>r.fixed.invalid===0),
  worldFaultReproduced:rows[0].reproduced.partial>1000,nearAndFarMaterialsChecked:rows[0].reproduced.materials>7,
  multisampleFaultReproduced:fixtures.rows.filter(r=>r.samples>0).length>0&&fixtures.rows.filter(r=>r.samples>0).every(r=>r.broken.partial>0),
  fixtureOpaque:fixtures.rows.every(r=>r.fixed.partial===0),coverageColorUnchanged:fixtures.rows.every(r=>r.colorDifference<=.001),
  singleSampleCutoutOpaque:fixtures.rows.filter(r=>r.samples===0).every(r=>r.broken.partial===0),
  noBrowserErrors:errors.length===0,validWebGL:fixtures.gl===0&&rows.every(r=>r.gl===0),
 };
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,rows,fixtures,errors},null,2));
 console.log(JSON.stringify({checks,fixtures}));assert(Object.values(checks).every(Boolean),'Foliage opacity regression failed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
