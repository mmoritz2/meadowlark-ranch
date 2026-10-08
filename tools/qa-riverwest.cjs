// Full mounted riverwest travel, visible detours, and preserved world geometry.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const baseline=process.env.QA_RIVER_BASELINE==='1',out=path.resolve(process.argv[2]||'output/riverwest');fs.mkdirSync(out,{recursive:true});
const baselineFiles=['ranch3d.html','assets/features/index.js','assets/features/world-paths.js'];
const bodies=baseline?Object.fromEntries(baselineFiles.map(f=>[f,cp.execFileSync('git',['show','911eb78:'+f],{encoding:'utf8',maxBuffer:5e6})])):{};
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/api/me',r=>r.fulfill({contentType:'application/json',body:'null'}));
 await page.route('**/assets/features/index.js*',async r=>r.fulfill({contentType:'text/javascript',body:baseline?bodies['assets/features/index.js']:await(await r.fetch()).text()}));
 await page.route('**/assets/features/world-paths.js*',async r=>{const body=baseline?bodies['assets/features/world-paths.js']:await(await r.fetch()).text();await r.fulfill({contentType:'text/javascript',body:body.replace('const TRACKS=[];',`window.__preRoad={colliders:W.colliders.map(c=>Object.fromEntries(Object.entries(c).filter(([k,v])=>v===null||['number','string','boolean'].includes(typeof v)))),walls:W.walls.map(c=>Object.fromEntries(Object.entries(c).filter(([k,v])=>v===null||['number','string','boolean'].includes(typeof v))))};const TRACKS=[];`)});});
 await page.route('**/ranch3d.html*',async r=>{const body=baseline?bodies['ranch3d.html']:await(await r.fetch()).text();await r.fulfill({contentType:'text/html',body:body.replace('const MERGE_STATS=mergeStatics();',`window.__roadQA={THREE,scene,camera,renderer,composer,G,player,groundH,terrainH,TACK,keys,step(dt){manualStepping=true;tick(dt)},day(t=.34,rain=false){dayT=t;weather.mode=rain?'rain':'clear';weather.timer=99999}};const MERGE_STATS=mergeStatics();`)});});
 await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(QA.BASE+'/ranch3d.html?qa=riverwest',{timeout:120000});await page.waitForFunction(()=>window.__roadQA?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__roadQA;q.G.save.sync(s=>{s.qualityLocked=true;s.unlocked=s.unlocked||{};for(const r of q.G.tables.REGIONS)if(r.unlock)s.unlocked[r.id]=true;});q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;await q.G.undergrowth.ready;await q.G.world.ranchBuilderArt.ready;await new Promise(queueMicrotask);advanceTime(0);q.G.gfx.apply('high');q.day();
  q.read=rt=>{const w=Math.floor(rt.width),h=Math.floor(rt.height),p=new Uint16Array(w*h*4);q.renderer.readRenderTargetPixels(rt,0,0,w,h,p);let invalid=0,minAlpha=1;for(let i=0;i<p.length;i+=4){if([0,1,2].some(c=>(p[i+c]&0x7c00)===0x7c00))invalid++;minAlpha=Math.min(minAlpha,q.THREE.DataUtils.fromHalfFloat(p[i+3]));}return{invalid,minAlpha}};
 });console.log('River Road ready');
 const state=await page.evaluate(()=>{const q=__roadQA,W=q.G.world,T=q.THREE;
  const hash=array=>{if(!array)return null;const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);let h=2166136261;for(const b of bytes)h=Math.imul(h^b,16777619);return(h>>>0).toString(16);};
  const formations=[];q.scene.updateMatrixWorld(true);q.scene.traverse(o=>{const g=o.userData.geology;if(g&&/layered mesa|weathered spire/.test(g.kind))formations.push({kind:g.kind,seed:g.seed,matrix:o.matrixWorld.toArray(),position:hash(o.geometry?.attributes.position?.array),index:hash(o.geometry?.index?.array)});});formations.sort((a,b)=>a.seed-b.seed);
  const fields=W.canyonLandscape.fields.map(({mesh})=>({position:hash(mesh.geometry.attributes.position.array),index:hash(mesh.geometry.index.array)})),ground=[];for(let z=-420;z<=420;z+=35)for(let x=-420;x<=420;x+=35)if(Math.hypot(x,z)<445)ground.push([x,z,q.groundH(x,z)]);
  const tracks=q.G.worldPaths.tracks.map(t=>({id:t.id,pts:t.pts,len:t.len})),track=q.G.worldPaths.tracks.find(t=>t.id==='riverwest'),point=new T.Vector3(),samples=[];let maxSolidContacts=0,maxFootprintContacts=0,minRiverDistance=Infinity,maxGrade=0;
  for(let i=1;i<track.pts.length;i++){const a=track.pts[i-1],b=track.pts[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.35);for(let k=0;k<=n;k++){const x=a[0]+(b[0]-a[0])*k/n,z=a[1]+(b[1]-a[1])*k/n,y=q.groundH(x,z);point.set(x,0,z);const contacts=W.solidWorld.resolve(point,{bottom:y+.05,top:y+2.65,radius:.8});maxSolidContacts=Math.max(maxSolidContacts,contacts);point.set(x,0,z);maxFootprintContacts=Math.max(maxFootprintContacts,W.solidWorld.resolve(point,{bottom:y+.05,top:y+2.65,radius:2.4}));minRiverDistance=Math.min(minRiverDistance,z-W.riverZ(x));maxGrade=Math.max(maxGrade,Math.hypot(q.groundH(x+.5,z)-q.groundH(x-.5,z),q.groundH(x,z+.5)-q.groundH(x,z-.5)));samples.push([x,z,contacts]);}}
  const P=q.G.worldPaths,registryBefore=W.solidWorld.stats();W.solidWorld.registerParts(q.scene);const registryAfter=W.solidWorld.stats();
  let ribbon=null;
  if(P.surfaceRanges?.riverwest){
   const range=P.surfaceRanges.riverwest,g=P.surface.geometry,p=g.attributes.position,u=g.attributes.uv,index=g.index;
   let minUpwardArea=Infinity,minUvDet=Infinity,minCircleClearance=Infinity,minEdgeRiver=Infinity,maxEdgeSolid=0,maxEdgeGrade=0,edgeSamples=0;const tested=new Set(),edgeSet=new Set(),circles=W.colliders.filter(c=>!c.decor&&c.r>0);
   const segmentDistance=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz,t=l2?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l2)):0;return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);};
   for(let i=range.indexStart;i<range.indexStart+range.indexCount;i+=3){
    const [a,b,c]=[index.getX(i),index.getX(i+1),index.getX(i+2)];
    minUpwardArea=Math.min(minUpwardArea,(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a))-(p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a)));
    minUvDet=Math.min(minUvDet,Math.abs((u.getX(b)-u.getX(a))*(u.getY(c)-u.getY(a))-(u.getY(b)-u.getY(a))*(u.getX(c)-u.getX(a))));
    const triangle=[a,b,c].map(v=>[p.getX(v),p.getZ(v)]),minX=Math.min(...triangle.map(p=>p[0])),maxX=Math.max(...triangle.map(p=>p[0])),minZ=Math.min(...triangle.map(p=>p[1])),maxZ=Math.max(...triangle.map(p=>p[1]));
    for(const collider of circles){
     if(Math.hypot(Math.max(0,minX-collider.x,collider.x-maxX),Math.max(0,minZ-collider.z,collider.z-maxZ))-collider.r>=minCircleClearance)continue;
     const inside=triangle.every((a,j)=>{const b=triangle[(j+1)%3];return(b[0]-a[0])*(collider.z-a[1])-(b[1]-a[1])*(collider.x-a[0])<=0;});
     const distance=inside?0:Math.min(...triangle.map((a,j)=>segmentDistance(collider.x,collider.z,a,triangle[(j+1)%3])));
     minCircleClearance=Math.min(minCircleClearance,distance-collider.r);
    }
    for(const [v0,v1]of[[a,b],[b,c],[c,a]]){
     const key=Math.min(v0,v1)+','+Math.max(v0,v1);if(edgeSet.has(key))continue;edgeSet.add(key);
     const x0=p.getX(v0),z0=p.getZ(v0),dx=p.getX(v1)-x0,dz=p.getZ(v1)-z0,n=Math.ceil(Math.hypot(dx,dz)/.25);
     for(let k=0;k<=n;k++){
      const x=x0+dx*k/n,z=z0+dz*k/n,y=q.groundH(x,z);point.set(x,0,z);edgeSamples++;
      maxEdgeSolid=Math.max(maxEdgeSolid,W.solidWorld.resolve(point,{bottom:y+.05,top:y+2.65,radius:.08}));
      minEdgeRiver=Math.min(minEdgeRiver,z-W.riverZ(x));maxEdgeGrade=Math.max(maxEdgeGrade,Math.hypot(q.groundH(x+.5,z)-q.groundH(x-.5,z),q.groundH(x,z+.5)-q.groundH(x,z-.5)));
     }
    }
    for(const v of [a,b,c])if(!tested.has(v)){
     tested.add(v);const x=p.getX(v),z=p.getZ(v),y=q.groundH(x,z);point.set(x,0,z);
     maxEdgeSolid=Math.max(maxEdgeSolid,W.solidWorld.resolve(point,{bottom:y+.05,top:y+2.65,radius:.08}));
     minEdgeRiver=Math.min(minEdgeRiver,z-W.riverZ(x));
     maxEdgeGrade=Math.max(maxEdgeGrade,Math.hypot(q.groundH(x+.5,z)-q.groundH(x-.5,z),q.groundH(x,z+.5)-q.groundH(x,z-.5)));
     for(const collider of W.colliders)if(!collider.decor&&collider.r>0)minCircleClearance=Math.min(minCircleClearance,Math.hypot(x-collider.x,z-collider.z)-collider.r);
    }
   }
   const mask=g.attributes.roadStrokeMask,color=g.attributes.color;let maskIsolated=mask?.count===p.count,interiorCount=0,minInteriorAlpha=Infinity,oldVergeInteriors=0,minOldVergeAlpha=Infinity,duplicateAlphaError=0;const alphaAt=new Map();
   const expectedRoads=['barley','riverwest','ochre','highfell','frostpine','marsh','clover'];
   maskIsolated&&=expectedRoads.every(id=>P.surfaceRanges[id]&&P.ribbonDiagnostics[id])&&Object.keys(P.surfaceRanges).length===expectedRoads.length;
   let nextVertex=0,nextIndex=0;
   for(const [id,r]of Object.entries(P.surfaceRanges)){
    maskIsolated&&=r.vertexStart===nextVertex&&r.indexStart===nextIndex;
    for(let v=r.vertexStart;v<r.vertexStart+r.vertexCount;v++)maskIsolated&&=mask.getX(v)===1;
    nextVertex+=r.vertexCount;nextIndex+=r.indexCount;
   }
   maskIsolated&&=nextVertex===p.count&&nextIndex===g.index.count;
   for(const v of tested){
    const x=p.getX(v),z=p.getZ(v),alpha=color.getW(v),key=x+','+z;if(alphaAt.has(key))duplicateAlphaError=Math.max(duplicateAlphaError,Math.abs(alphaAt.get(key)-alpha));else alphaAt.set(key,alpha);let closest=Infinity,run=0;
    for(let k=1;k<track.pts.length;k++){
     const a=track.pts[k-1],b=track.pts[k],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz,t=l2?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l2)):0,d2=(x-a[0]-dx*t)**2+(z-a[1]-dz*t)**2;
     if(d2<closest){closest=d2;run=track.run[k-1]+(track.run[k]-track.run[k-1])*t;}
    }
    if(run>2.3&&run<track.len-3.6&&z-W.riverZ(x)>10&&Math.abs(x-W.streamX(z))>5){
     if(closest<.7**2){interiorCount++;minInteriorAlpha=Math.min(minInteriorAlpha,alpha);}
     const halfWidth=track.w*(1+.04*Math.sin(run*.12)+.02*Math.sin(run*.047));
     if(Math.sqrt(closest)/halfWidth<.6&&Math.abs(u.getY(v)*2-1)>.9){oldVergeInteriors++;minOldVergeAlpha=Math.min(minOldVergeAlpha,alpha);}
    }
   }
   ribbon={vertices:tested.size,edgeSamples,maskIsolated,interiorCount,minInteriorAlpha,oldVergeInteriors,minOldVergeAlpha,duplicateAlphaError,triangles:range.indexCount/3,minUpwardArea,minUvDet,minCircleClearance,minEdgeRiver,maxEdgeSolid,maxEdgeGrade,diagnostics:P.ribbonDiagnostics?.riverwest};
  }
  const plants={retained:0,minBoundsClearance:Infinity,cleared:P.clearedDryPlants||null},matrix=new T.Matrix4(),worldMatrix=new T.Matrix4(),root=new T.Vector3(),corner=new T.Vector3();
  for(const kind of ['succ','oco']){
   const mesh=q.G.floraPkg.bank[kind].im,geo=W.desertArt.geometry(kind==='succ'?'agave':'ocotillo',0,true);geo.computeBoundingBox();const bounds=geo.boundingBox.clone();
   const coarse=W.desertArt.geometry(kind==='succ'?'agave':'ocotillo',0,false);coarse.computeBoundingBox();bounds.union(coarse.boundingBox);
   for(let i=0;i<mesh.instanceMatrix.count;i++){
    mesh.getMatrixAt(i,matrix);if(Math.abs(matrix.determinant())<1e-8)continue;worldMatrix.multiplyMatrices(mesh.matrixWorld,matrix);root.setFromMatrixPosition(worldMatrix);let radius=0;
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){corner.set(x,y,z).applyMatrix4(worldMatrix);radius=Math.max(radius,Math.hypot(corner.x-root.x,corner.z-root.z));}
    const d=q.G.worldPaths.trackDist(root.x,root.z,'riverwest');if(d<20){plants.retained++;plants.minBoundsClearance=Math.min(plants.minBoundsClearance,d-radius);}
   }
  }
  const render=q.renderer.render,rides=[];q.renderer.render=()=>{};try{for(const direction of[1,-1]){const pts=direction===1?track.pts:track.pts.slice().reverse(),a=pts[0];q.player.pos.set(a[0],0,a[1]);q.player.speed=q.player.y=q.player.vy=0;q.player.flying=q.player.onFoot=false;q.player.stam=1;q.G.followCam.reset();q.G.input.reset();q.G.riding.releaseAll();q.G.riding.selectGait('walk');q.keys.KeyW=true;let target=1,frames=0,maxGroundError=0,minCameraHeight=Infinity,maxDeviation=0,best=Infinity,lastProgress=0,stalled=false,finite=true;const trace=[],maxFrames=Math.ceil(track.len/.9*30)+900;
   for(;frames<maxFrames&&target<pts.length;frames++){const b=pts[target],dx=b[0]-q.player.pos.x,dz=b[1]-q.player.pos.z,d=Math.hypot(dx,dz);if(d<1.15){target++;best=Infinity;lastProgress=frames;continue}if(d<best-.03){best=d;lastProgress=frames;}if(frames-lastProgress>300){stalled=true;break;}q.player.heading=Math.atan2(dx,dz);q.day();q.step(1/30);maxGroundError=Math.max(maxGroundError,Math.abs(q.player.mesh.position.y-q.groundH(q.player.pos.x,q.player.pos.z)));minCameraHeight=Math.min(minCameraHeight,q.camera.position.y-q.groundH(q.camera.position.x,q.camera.position.z));maxDeviation=Math.max(maxDeviation,q.G.worldPaths.trackDist(q.player.pos.x,q.player.pos.z,'riverwest'));finite&&=[...q.player.pos.toArray(),...q.camera.position.toArray()].every(Number.isFinite);if(frames%90===0)trace.push(q.player.pos.toArray());}
   q.keys.KeyW=false;const end=q.player.pos.toArray(),nearest=W.colliders.filter(c=>!c.decor&&!c.precise).map(c=>({x:c.x,z:c.z,r:c.r,clearance:Math.hypot(c.x-end[0],c.z-end[2])-c.r})).sort((a,b)=>a.clearance-b.clearance).slice(0,4);rides.push({direction,complete:target===pts.length,waypoints:target,total:pts.length,frames,maxFrames,stalled,maxGroundError,minCameraHeight,maxDeviation,finite,end,target:pts[target]||null,nearest,trace});
  }}finally{q.renderer.render=render;q.keys.KeyW=false}
  return{preRoad:window.__preRoad,formations,fields,ground,tracks,rides,ribbon,plants,registry:{planning:P.planningSolids,final:registryBefore,after:registryAfter},sampling:{count:samples.length,maxSolidContacts,maxFootprintContacts,minRiverDistance,maxGrade},detours:q.G.worldPaths.clearance||null,crowding:q.G.worldPaths.blocked.filter(p=>p.road==='riverwest'),errors:[...q.G.errors,...q.G.photoscans.errors,...q.G.worldDetails.errors,...q.G.undergrowth.errors]};
 });console.log(JSON.stringify({rides:state.rides.map(({trace,...r})=>r),sampling:state.sampling,detours:state.detours}));
 const rows=[],views=[{name:'bridge-junction',eye:[-5,2.5,140],look:[-48,2,134]},{name:'approach-east',eye:[-168,2.5,120],look:[-192,3,139]},{name:'approach-west',eye:[-214,2.4,130],look:[-191,3,139]},{name:'detour-overview',eye:[-185,42,155],look:[-190,0,126]},{name:'trail-close',eye:[-176,1.8,132],look:[-191,2,139]},...['high','medium','low','rain','golden'].map(n=>({name:'mounted-'+n,horse:[-178,132,-1.1],riding:true,tier:['medium','low'].includes(n)?n:'high',rain:n==='rain',time:n==='golden'?.23:.34}))];
 for(const c of views){const row=await page.evaluate(async c=>{const q=__roadQA;q.G.gfx.apply(c.tier||'high');q.player.pos.set(c.horse?.[0]??c.eye[0],0,c.horse?.[1]??c.eye[2]);q.player.speed=q.player.y=q.player.vy=0;q.player.flying=false;q.player.heading=c.horse?.[2]??0;const render=q.renderer.render;q.renderer.render=()=>{};try{for(let i=0;i<60;i++){q.day(c.time??.34,c.rain);q.step(.1)}let settled=0;for(let i=0;i<180;i++){q.step(.016);settled=q.G.world.npcCharacters.stats().pending?0:settled+1;if(settled>=2)break;await new Promise(r=>setTimeout(r,40));}}finally{q.renderer.render=render}
  q.player.mesh.visible=!!c.riding;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=!!c.riding;const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=!!c.riding;
  if(!c.riding){const eye=c.eye.slice(),look=c.look.slice();eye[1]+=q.groundH(eye[0],eye[2]);look[1]+=q.groundH(look[0],look[2]);q.camera.position.set(...eye);q.camera.lookAt(...look)}q.G.waterReflections.update(performance.now()+100);let source;const pass=q.composer.passes[0],original=pass.render;pass.render=function(renderer,write,read,...rest){original.call(this,renderer,write,read,...rest);source=q.read(read)};try{q.composer.render()}finally{pass.render=original}
  return{name:c.name,source,buffers:[q.composer.renderTarget1,q.composer.renderTarget2].map(q.read),gl:q.renderer.getContext().getError(),image:q.renderer.domElement.toDataURL('image/webp',.96).split(',')[1]};
 },c);fs.writeFileSync(path.join(out,row.name+'.webp'),Buffer.from(row.image,'base64'));delete row.image;rows.push(row);console.log(row.name)}
 const checks={finitePixels:rows.every(r=>[r.source,...r.buffers].every(b=>!b.invalid)),opaqueWorld:rows.every(r=>r.source.minAlpha>=1-1/2048),validWebGL:rows.every(r=>!r.gl),noErrors:!errors.length&&!state.errors.length};
 if(baseline){checks.forwardBlockageProven=state.rides[0].stalled&&!state.rides[0].complete;checks.sufficientWalkAllowance=state.rides.every(r=>r.maxFrames>7000);}
 else{const before=JSON.parse(fs.readFileSync(process.env.QA_RIVER_REFERENCE||path.join(out,'../riverwest-before/report.json')));checks.mountedBothDirections=state.rides.every(r=>r.complete&&r.finite&&!r.stalled&&r.maxGroundError<.1&&r.minCameraHeight>.1&&r.maxDeviation<1.5);checks.terrainPreserved=JSON.stringify(state.ground)===JSON.stringify(before.state.ground);checks.formationsPreserved=state.formations.length>20&&JSON.stringify(state.formations)===JSON.stringify(before.state.formations)&&JSON.stringify(state.fields)===JSON.stringify(before.state.fields);checks.priorSolidsPreserved=JSON.stringify(state.preRoad)===JSON.stringify(before.state.preRoad);checks.otherRoutesPreserved=JSON.stringify(state.tracks.filter(t=>t.id!=='riverwest'))===JSON.stringify(before.state.tracks.filter(t=>t.id!=='riverwest'));checks.endpointsPreserved=JSON.stringify(state.tracks.find(t=>t.id==='riverwest').pts.filter((p,i,a)=>i===0||i===a.length-1))===JSON.stringify(before.state.tracks.find(t=>t.id==='riverwest').pts.filter((p,i,a)=>i===0||i===a.length-1));checks.preciseCorridor=state.sampling.maxSolidContacts===0;checks.finalFullFootprint=state.sampling.maxFootprintContacts===0;checks.dryBank=state.sampling.minRiverDistance>=11-.0001;checks.actualGrade=state.sampling.maxGrade<=.55+.0001;checks.detourApplied=state.detours?.riverwest?.changed&&!state.detours?.riverwest?.failures?.length;checks.sweptDiagnostics=!state.crowding.length;
 checks.completeRegistry=state.registry.planning?.parts>0&&state.registry.final.parts>=state.registry.planning.parts&&JSON.stringify(state.registry.final)===JSON.stringify(state.registry.after);
 checks.upwardRibbon=state.ribbon?.minUpwardArea>1e-9;checks.internalVergeMask=state.ribbon?.maskIsolated&&state.ribbon?.interiorCount>500&&state.ribbon?.minInteriorAlpha>.999&&state.ribbon?.oldVergeInteriors>0&&state.ribbon?.minOldVergeAlpha>.95&&state.ribbon?.duplicateAlphaError<1e-7;checks.finiteRoadUv=state.ribbon?.minUvDet>1e-10;
 checks.fullSurfaceClear=state.ribbon?.minCircleClearance>=.8-.0001&&state.ribbon?.maxEdgeSolid===0;
 checks.dryRoadEdges=state.ribbon?.minEdgeRiver>=9-.0001;checks.boundedRoadGrade=state.ribbon?.maxEdgeGrade<=.55+.0001;
 checks.decorativePlantsClear=state.plants.cleared?.succ>0&&state.plants.minBoundsClearance>=2.4-.0001;
 }
 const report={baseline,checks,state,rows,errors};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks,errors}));assert(Object.values(checks).every(Boolean),'Riverwest acceptance failed');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
