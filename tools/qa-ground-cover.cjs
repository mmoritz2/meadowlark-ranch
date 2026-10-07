// Native shoreline plants, compact pasture draws, transition coverage and unchanged riding surfaces.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const out=path.resolve(process.argv[2]||'output/ground-cover');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await page.route('**/ranch3d.html*',async r=>{const res=await r.fetch();await r.fulfill({response:res,body:(await res.text()).replace('const MERGE_STATS=mergeStatics();',`window.__q={THREE,scene,camera,renderer,composer,G,player,groundH,TACK,keys,herd,nearGrass,step(dt){manualStepping=true;tick(dt)},day(t=.34,rain=false){dayT=t;weather.mode=rain?'rain':'clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
 await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(QA.BASE+'/ranch3d.html?qa=ground-cover',{timeout:120000});await page.waitForFunction(()=>window.__q?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__q;q.G.save.sync(s=>{s.qualityLocked=true;s.unlocked=s.unlocked||{};for(const rg of q.G.tables.REGIONS)if(rg.unlock)s.unlocked[rg.id]=true;});q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;advanceTime(0);q.G.gfx.apply('high');q.tackVisibility=Object.values(q.TACK||{}).filter(o=>o?.isObject3D).map(o=>[o,o.visible]);
  q.read=rt=>{const w=Math.floor(rt.width),h=Math.floor(rt.height),p=new Uint16Array(w*h*4);q.renderer.readRenderTargetPixels(rt,0,0,w,h,p);let invalid=0,minAlphaBits=65535;for(let i=0;i<p.length;i+=4){if([0,1,2].some(c=>(p[i+c]&0x7c00)===0x7c00))invalid++;minAlphaBits=Math.min(minAlphaBits,p[i+3]);}return{invalid,minAlphaBits}};
 });console.log('Ground cover ready');const rows=[];
 const views=await page.evaluate(()=>{const q=__q,B=q.G.quartersPkg.reedBeds,first=B.records[0];return[
  {name:'river',eye:[-20,3,102],look:[12,3,127],ground:true},
  {name:'lake',eye:[14,1.7,26],look:[20,.7,21],ground:true},
  {name:'meadow-close',eye:[-60,1.6,56],look:[-56,.25,49],ground:true},
  {name:'boardwalk',eye:[291,5,312],look:[310,3,298]},
  {name:'mill-pond',eye:[first.x+2.3,first.matrix.elements[13]+1.7,first.z+3.6],look:[first.x,first.matrix.elements[13]+.6,first.z]},
  ...['high','medium','low','rain','night'].map(name=>({name:'marsh-'+name,eye:[302,5,307],look:[319,4,300],tier:['low','medium'].includes(name)?name:'high',rain:name==='rain',time:name==='night'?0:.34}))
 ];});
 for(const c of views){const row=await page.evaluate(async c=>{const q=__q;q.G.gfx.apply(c.tier||'high');q.player.pos.set(c.eye[0],0,c.eye[2]);q.player.speed=q.player.y=q.player.vy=0;
  const render=q.renderer.render;q.renderer.render=()=>{};try{for(let i=0;i<50;i++){q.day(c.time??.34,c.rain);q.step(.1)}let settled=0;for(let i=0;i<180;i++){q.step(.016);settled=q.G.world.npcCharacters.stats().pending?0:settled+1;if(settled>=2)break;await new Promise(r=>setTimeout(r,40));}}finally{q.renderer.render=render}
  q.player.mesh.visible=false;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=false;const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=false;
  const eye=c.eye.slice(),look=c.look.slice();if(c.ground){eye[1]+=q.groundH(eye[0],eye[2]);look[1]+=q.groundH(look[0],look[2]);}q.camera.position.set(...eye);q.camera.lookAt(...look);q.G.waterReflections.update(performance.now()+100);
  let source;const pass=q.composer.passes[0],original=pass.render;pass.render=function(renderer,write,read,...rest){original.call(this,renderer,write,read,...rest);source=q.read(read)};try{q.composer.render()}finally{pass.render=original}
  const B=q.G.quartersPkg.reedBeds;return{name:c.name,detail:B.detail.count,far:B.far.count,local:q.nearGrass.reed.count,source,buffers:[q.composer.renderTarget1,q.composer.renderTarget2].map(q.read),gl:q.renderer.getContext().getError(),image:q.renderer.domElement.toDataURL('image/webp',.96).split(',')[1]};
 },c);fs.writeFileSync(path.join(out,row.name+'.webp'),Buffer.from(row.image,'base64'));delete row.image;rows.push(row);console.log(row.name);}
 const state=await page.evaluate(()=>{const q=__q,T=q.THREE,P=q.G.quartersPkg,B=P.reedBeds,A=P.willowmereArt,m=new T.Matrix4(),v=new T.Vector3(),cover=[];
  for(const [name,x,z]of[['meadow',-52,44],['river',-20,102],['snow',-150,-208],['desert',-220,130],['marsh',310,300]]){
   q.nearGrass.tick(10,x,z);let invalid=0,reedGround=0;
   for(const mesh of[q.nearGrass.near,q.nearGrass.reed])for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);if(Math.abs(m.determinant())<1e-8||!m.elements.every(Number.isFinite))invalid++;if(mesh===q.nearGrass.reed){v.setFromMatrixPosition(m);reedGround=Math.max(reedGround,Math.abs(v.y+.05-q.groundH(v.x,v.z)));}}
   cover.push({name,grass:q.nearGrass.near.count,reeds:q.nearGrass.reed.count,invalid,reedGround,grassTriangles:q.nearGrass.near.count*q.nearGrass.near.geometry.index.count/3});
  }
  q.nearGrass.tick(11,-20,102);const count=q.nearGrass.near.count,layout=Array.from(q.nearGrass.near.instanceMatrix.array),reeds=Array.from(q.nearGrass.reed.instanceMatrix.array);
  q.nearGrass.setVR(true);const vr=q.nearGrass.near.count;q.nearGrass.tick(12,10,110);q.nearGrass.setVR(false);q.nearGrass.tick(13,-20,102);const returns=count===q.nearGrass.near.count&&layout.every((v,i)=>v===q.nearGrass.near.instanceMatrix.array[i])&&reeds.every((v,i)=>v===q.nearGrass.reed.instanceMatrix.array[i]);
  let pondPlants=0,pondCandidates=0;
  for(const pond of P.ponds){q.nearGrass.tick(15,pond.x,pond.z);for(const mesh of[q.nearGrass.near,q.nearGrass.flow,q.nearGrass.fern,q.nearGrass.lupin,q.nearGrass.meadowDistance.mesh,q.G.world.seedGrass,...['scrub','brack','reed','tuft','petal'].map(k=>q.G.floraPkg?.bank[k]?.im)].filter(Boolean))for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);if(Math.abs(m.determinant())>1e-8){pondCandidates++;if(P.pondContains(m.elements[12],m.elements[14]))pondPlants++;}}}
  const legacy=[];for(const s of B.sources){s.updateWorldMatrix(true,false);for(let i=0;i<s.count;i++){s.getMatrixAt(i,m);if(Math.abs(m.determinant())>1e-8)legacy.push(m.clone().premultiply(s.matrixWorld));}}
  const retained=legacy.length===B.records.length&&legacy.every((m,i)=>m.equals(B.records[i].matrix));
  const marsh=B.records.filter(r=>r.x>180&&r.z>180),roots=marsh.map(r=>({error:Math.abs(r.matrix.elements[13]+.04-q.G.world.terrainH(r.x,r.z)),deck:Number.isFinite(A.deckAt(r.x,r.z,.35)),shore:A.landscape.shore(r.x,r.z)}));
  const tiers=[];q.player.pos.set(310,0,300);for(const tier of['low','medium','high']){q.G.gfx.apply(tier);B.update(.1,20);tiers.push({tier,detail:B.detail.count,far:B.far.count,triangles:B.detail.count*B.stats.detailTriangles});}
  q.player.pos.set(900,0,900);B.update(.1,21);const culled=!B.detail.visible&&!B.far.visible;q.player.pos.set(310,0,300);B.update(.1,22);const returned=B.detail.count>0;
  // The real materials render through a multisampled HDR target, both individually
  // and across the shared distance handover. This catches black/transparent panels.
  const scene=new T.Scene();scene.background=new T.Color('#b1d3d2');scene.add(new T.HemisphereLight(0xe5f1ff,0x7b8064,2));const light=new T.DirectionalLight(0xffedcd,3);light.position.set(2,6,3);scene.add(light);
  const meshes=[B.detail,B.far].map(src=>{const o=new T.InstancedMesh(src.geometry,src.material,1);o.setMatrixAt(0,new T.Matrix4().makeTranslation(315,0,300));o.setColorAt(0,new T.Color());o.frustumCulled=false;scene.add(o);return o;});
  const cam=new T.PerspectiveCamera(30,1,.01,100);cam.position.set(315,1.2,304);cam.lookAt(315,.5,300);const rt=new T.WebGLRenderTarget(160,160,{type:T.HalfFloatType,samples:4}),shader=[];
  for(const dist of[3,10,15,20,25,30,31,32,33,36,50]){q.player.pos.set(315-dist,0,300);B.update(.1,25);q.renderer.setRenderTarget(rt);q.renderer.render(scene,cam);shader.push({distance:dist,...q.read(rt)});}q.renderer.setRenderTarget(null);q.player.pos.set(315,0,300);B.update(.1,25);meshes[1].visible=false;cam.aspect=q.renderer.domElement.width/q.renderer.domElement.height;cam.updateProjectionMatrix();cam.position.set(315,.8,302.2);cam.lookAt(315,.5,300);q.renderer.render(scene,cam);const modelImage=q.renderer.domElement.toDataURL('image/webp',.96).split(',')[1];rt.dispose();meshes.forEach(o=>o.removeFromParent());
  const ground=[];for(let z=-420;z<=420;z+=35)for(let x=-420;x<=420;x+=35)if(Math.hypot(x,z)<445)ground.push([x,z,q.groundH(x,z)]);
  return{modelImage,pondPlants,pondCandidates,pondCoverCleared:P.pondCoverCleared,cover,count,vr,returns,retained,sites:B.stats.sites,roots,tiers,culled,returned,shader,ground,sourceHidden:B.sources.every(s=>!s.visible),detailTriangles:B.stats.detailTriangles,gl:q.renderer.getContext().getError(),errors:[...q.G.errors,...q.G.photoscans.errors,...q.G.worldDetails.errors]};
 });
 fs.writeFileSync(path.join(out,'reed-model.webp'),Buffer.from(state.modelImage,'base64'));delete state.modelImage;
 const expected=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/foothills-protected-ground.json')));state.groundError=Math.max(...expected.map((p,i)=>Math.abs(p[2]-state.ground[i][2])));
 const checks={pondHasNoDryCover:state.pondPlants===0&&state.pondCandidates>1000,compactValidCover:state.cover.every(c=>c.invalid===0),localReedsGrounded:state.cover.some(c=>c.reeds>0)&&state.cover.every(c=>c.reedGround<.001),stableReturn:state.returns,vrRestoresGrass:state.vr===Math.floor(state.count*.5),allOriginalSites:state.retained&&state.sites>1000,legacyHidden:state.sourceHidden,marshReedsGrounded:state.roots.length>500&&state.roots.every(r=>r.error<.001&&!r.deck&&r.shore>=-.55001),tierBudgets:state.tiers.every((r,i)=>r.detail<=[80,180,320][i]&&r.detail>0)&&state.detailTriangles<=350,distanceCullAndReturn:state.culled&&state.returned,finitePixels:rows.every(r=>[r.source,...r.buffers].every(b=>!b.invalid))&&state.shader.every(b=>!b.invalid),opaquePixels:rows.every(r=>r.source.minAlphaBits>=15359)&&state.shader.every(b=>b.minAlphaBits>=15359),protectedGround:state.groundError<.001,validWebGL:state.gl===0&&rows.every(r=>r.gl===0),noErrors:!errors.length&&!state.errors.length};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,rows,state,errors},null,2));console.log(JSON.stringify({checks,rows,cover:state.cover,tiers:state.tiers,sites:state.sites,errors}));assert(Object.values(checks).every(Boolean),'Ground cover acceptance failed');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
