// Native GPU regression for the tree-normal/bloom black rectangles. Run against
// a local preview with QA_PORT/QA_URL and PLAYWRIGHT_PATH as needed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const QA=require('./qa-platform.cjs');
const out=path.resolve(process.argv[2]||'output/render-artifacts');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 try{
  const page=await browser.newPage({viewport:{width:988,height:859},deviceScaleFactor:2}),errors=[];
  // Match signed-out Pages behavior when this runs on a local static server.
  await page.route('**/api/me',route=>route.fulfill({contentType:'application/json',body:'null'}));
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/ranch3d.html*',async route=>{
   const response=await route.fetch();
   await route.fulfill({response,body:(await response.text()).replace('const MERGE_STATS=mergeStatics();',`window.__artifactQA={THREE,renderer,scene,camera,composer,bloomPass,G,player,groundH,
    step(dt){manualStepping=true;tick(dt);},day(value=.34,rain=false){dayT=value;weather.mode=rain?'rain':'clear';weather.timer=99999;}};
    const MERGE_STATS=mergeStatics();`)});
  });
  // This seed, camera and DPR reproduced four invalid tree pixels which the
  // original bloom expanded to over a million invalid pixels on native Metal.
  await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
  await page.goto(QA.BASE+'/ranch3d.html?qa=render-artifacts',{timeout:120000});
  await page.waitForFunction(()=>window.__artifactQA?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
  await page.evaluate(async()=>{
   const q=__artifactQA;q.G.save.sync(s=>s.qualityLocked=true);q.G.wardrobe?.closeChar();q.G.hidePanels();
   await q.G.photoscans.ready;await q.G.worldDetails.ready;advanceTime(0);
   // GPU storage truncates fractional composer dimensions; read the actual size.
   q.read=(renderer,target)=>{
    const w=Math.floor(target.width),h=Math.floor(target.height),pixels=new Uint16Array(w*h*4);
    renderer.readRenderTargetPixels(target,0,0,w,h,pixels);
    let invalid=0,lit=0;
    for(let i=0;i<pixels.length;i+=4){
     if([0,1,2].some(c=>(pixels[i+c]&0x7c00)===0x7c00))invalid++;
     else if(pixels[i]||pixels[i+1]||pixels[i+2])lit++;
    }
    return {invalid,lit,width:w,height:h};
   };
  });
  console.log('World ready; checking the original failing view and graphics modes.');
  const cases=[
   {name:'original-failing-view',tier:'high'},
   {name:'mountain-left',tier:'high',look:[-150,20,-235]},
   {name:'mountain-right',tier:'high',look:[10,15,-220]},
   {name:'medium',tier:'medium'},{name:'low',tier:'low'},
   {name:'golden-hour',tier:'high',day:.22},
   {name:'night',tier:'high',day:0},{name:'rain',tier:'high',rain:true},
   {name:'trail-garden',tier:'high',garden:true},
   {name:'portrait',tier:'high',viewport:{width:430,height:932}},
  ],rows=[];
  for(const c of cases){
   if(c.viewport)await page.setViewportSize(c.viewport);
   const row=await page.evaluate(c=>{
    const q=__artifactQA;let eye=[-28,5,-52],look=c.look||[-90,25,-260];
    if(c.garden){
     const p=q.G.worldDetails.flowerPositions.slice().sort((a,b)=>Math.hypot(a.x+35,a.z-25)-Math.hypot(b.x+35,b.z-25))[0];
     eye=[p.x+2,q.groundH(p.x+2,p.z+4)+1.3,p.z+4];look=[p.x,q.groundH(p.x,p.z)+.2,p.z];
    }
    q.G.gfx.apply(c.tier);q.day(c.day??.34,c.rain);q.player.pos.set(eye[0],0,eye[2]);q.player.speed=0;q.G.followCam.reset();
    const render=q.renderer.render;q.renderer.render=()=>{};
    try{for(let i=0;i<35;i++)q.step(.1);}finally{q.renderer.render=render;}
    q.player.mesh.visible=false;q.camera.position.set(...eye);q.camera.lookAt(...look);q.G.waterReflections.update(performance.now()+100);
    let source;const pass=q.composer.passes[0],original=pass.render;
    pass.render=function(renderer,write,read,...rest){original.call(this,renderer,write,read,...rest);source=q.read(renderer,read);};
    q.renderer.info.reset();try{q.composer.render();}finally{pass.render=original;}
    const buffers=[q.composer.renderTarget1,q.composer.renderTarget2].map(rt=>q.read(q.renderer,rt));
    const fxaa=q.composer.passes.find(p=>p.material?.name==='FXAAShader'||p.material?.fragmentShader.includes('FXAA_QUALITY'));
    const resolution=fxaa?.uniforms.resolution.value.toArray();
    return {source,buffers,resolution,canvas:[q.renderer.domElement.width,q.renderer.domElement.height],
     glError:q.renderer.getContext().getError(),drawCalls:q.renderer.info.render.calls,triangles:q.renderer.info.render.triangles,
     image:q.renderer.domElement.toDataURL().split(',')[1]};
   },c);
   fs.writeFileSync(path.join(out,c.name+'.png'),Buffer.from(row.image,'base64'));delete row.image;
   rows.push({name:c.name,...row});console.log(c.name,JSON.stringify(row));
  }
  console.log('Testing neutral normals and injected invalid bloom pixels.');
  const fixtures=await page.evaluate(async()=>{
   const q=__artifactQA,T=q.THREE,{treeImpostor}=await import('./assets/tree-impostors.js'),
    {UnrealBloomPass}=await import('three/addons/postprocessing/UnrealBloomPass.js'),
    {FullScreenQuad}=await import('three/addons/postprocessing/Pass.js'),
    {protectBloomInput}=await import('./assets/render-safety.js');
   const renderer=new T.WebGLRenderer(),rt=new T.WebGLRenderTarget(64,64,{type:T.HalfFloatType,depthBuffer:false});
   renderer.setSize(64,64);renderer.setClearColor(0);renderer.toneMapping=T.NoToneMapping;
   const normal=new T.DataTexture(new Float32Array([.5,.5,.5,1]),1,1,T.RGBAFormat,T.FloatType);normal.needsUpdate=true;
   const albedo=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);albedo.needsUpdate=true;
   const {geo,mat}=treeImpostor({THREE:T,albedo,normals:normal,width:2,height:2,bottom:-1});
   const tree=new T.InstancedMesh(geo,mat,1);tree.setMatrixAt(0,new T.Matrix4());tree.instanceMatrix.needsUpdate=true;
   const scene=new T.Scene();scene.add(tree,new T.AmbientLight(0xffffff,1));
   const sun=new T.DirectionalLight(0xffffff,2);sun.position.set(1,3,4);scene.add(sun);
   const camera=new T.PerspectiveCamera(55,1,.1,20);camera.position.set(0,.1,3);camera.lookAt(0,0,0);
   renderer.setRenderTarget(rt);renderer.render(scene,camera);const neutralNormal=q.read(renderer,rt);
   // Fill a real HDR target with a NaN and an infinity alongside ordinary light.
   const data=new Float32Array(64*64*4);for(let i=0;i<data.length;i+=4)data.set([2,2,2,1],i);
   data.set([NaN,NaN,NaN,1],(16*64+16)*4);data.set([Infinity,Infinity,Infinity,1],(48*64+48)*4);
   const input=new T.DataTexture(data,64,64,T.RGBAFormat,T.FloatType);input.needsUpdate=true;
   const material=new T.ShaderMaterial({uniforms:{testTexture:{value:input}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'varying vec2 vUv;uniform sampler2D testTexture;void main(){gl_FragColor=texture2D(testTexture,vUv);}',depthTest:false,depthWrite:false});
   const quad=new FullScreenQuad(material);renderer.setRenderTarget(rt);quad.render(renderer);const injected=q.read(renderer,rt);
   const bloom=new UnrealBloomPass(new T.Vector2(64,64),.05,.85,.72);protectBloomInput(bloom);bloom.render(renderer,null,rt,0,false);
   const blurred=[bloom.renderTargetBright,...bloom.renderTargetsHorizontal,...bloom.renderTargetsVertical].map(t=>q.read(renderer,t));
   const combined=q.read(renderer,rt);
   // Transparent label texels must not occlude the bridleway's later transparent pass.
   // Reproduce the discovered green rectangle with the actual production label material.
   let sourceLabel;q.scene.traverse(o=>{if(o.isSprite&&o.material.name==='World | floating label')sourceLabel=o.material;});
   if(!sourceLabel)throw Error('No production label material');
   const labelScene=new T.Scene();labelScene.background=new T.Color('#387832');
   const labelCamera=new T.OrthographicCamera(-1,1,1,-1,.1,10);labelCamera.position.z=4;
   const pathMaterial=new T.MeshBasicMaterial({color:'#ba985e',transparent:true});
   const pathMesh=new T.Mesh(new T.PlaneGeometry(4,4),pathMaterial);pathMesh.renderOrder=1;labelScene.add(pathMesh);
   const labelMaterial=sourceLabel.clone();labelMaterial.opacity=0;
   const label=new T.Sprite(labelMaterial);label.position.z=1;label.scale.set(1.6,1.6,1);labelScene.add(label);
   const labelTarget=new T.WebGLRenderTarget(64,64);
   const frame=()=>{const pixels=new Uint8Array(64*64*4);renderer.setRenderTarget(labelTarget);renderer.render(labelScene,labelCamera);renderer.readRenderTargetPixels(labelTarget,0,0,64,64,pixels);return pixels;};
   label.visible=false;const reference=frame();label.visible=true;const fixed=frame();labelMaterial.depthWrite=true;const broken=frame();
   const changed=a=>{let n=0;for(let i=0;i<a.length;i+=4)if([0,1,2].some(c=>a[i+c]!==reference[i+c]))n++;return n;};
   const labelDepth={fixedPixels:changed(fixed),reproducedPixels:changed(broken)};
   labelMaterial.dispose();pathMaterial.dispose();pathMesh.geometry.dispose();labelTarget.dispose();
   const glError=renderer.getContext().getError();
   bloom.materialHighPassFilter.dispose();bloom.dispose();quad.dispose();material.dispose();input.dispose();
   rt.dispose();geo.dispose();mat.userData.scanDepth.dispose();mat.dispose();normal.dispose();albedo.dispose();renderer.dispose();renderer.forceContextLoss();
   return {neutralNormal,injected,blurred,combined,labelDepth,glError};
  });
  const details=await page.evaluate(()=>{
   const q=__artifactQA,s=q.G.worldDetails,W=q.G.world;
   return {flowers:s.flowers,errors:s.errors,featureErrors:q.G.errors,
    minPathDistance:Math.min(...s.flowerPositions.map(p=>W.pathDist(p.x,p.z))),
    onArena:s.flowerPositions.filter(p=>(p.x/24.8)**2+(p.z/19.8)**2<1).length};
  });
  const checks={
   invisibleLabelsLeavePathsIntact:fixtures.labelDepth.fixedPixels===0&&fixtures.labelDepth.reproducedPixels>1000,
   sourcePixelsFinite:rows.every(r=>r.source.invalid===0),postProcessedPixelsFinite:rows.every(r=>r.buffers.every(b=>b.invalid===0)),
   renderingHasVisiblePixels:rows.every(r=>r.source.lit>100),
   antialiasMatchesFramebuffer:rows.every(r=>r.resolution?.every((n,i)=>Math.abs(n-1/r.canvas[i])<1e-9)),
   zeroNormalRenders:fixtures.neutralNormal.invalid===0&&fixtures.neutralNormal.lit>100,
   faultsInjected:fixtures.injected.invalid===2,
   bloomContainsFaults:fixtures.blurred.every(b=>b.invalid===0)&&fixtures.combined.invalid===fixtures.injected.invalid,
   bloomStillProducesLight:fixtures.blurred.every(b=>b.lit>0),
   flowersLoaded:details.flowers>100,flowersLeavePathsClear:details.minPathDistance>1.86&&details.onArena===0,
   noAssetFailures:details.errors.length===0,noFeatureErrors:details.featureErrors.length===0,
   noBrowserErrors:errors.length===0,webGLValid:fixtures.glError===0&&rows.every(r=>r.glError===0),
  };
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,rows,fixtures,details,errors},null,2));
  for(const [name,ok]of Object.entries(checks))console.log((ok?'PASS ':'FAIL ')+name);
  assert(Object.values(checks).every(Boolean),'Render artifact regression failed; see report.json');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
