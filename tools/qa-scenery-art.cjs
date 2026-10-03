const QA=require('./qa-platform.cjs'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.argv[2]||'output/scenery-art');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('AudioContext encountered an error from the audio device'))errors.push(m.text());});
await page.route('**/ranch3d.html*',async route=>{const response=await route.fetch(),html=await response.text();await route.fulfill({response,body:html.replace('const MERGE_STATS=mergeStatics();',`window.__sceneryQA={THREE,scene,camera,renderer,composer,RIG,player,G,groundH,FALLS,ranchBuilderArt,quality:applyQuality,day(v){dayT=v;weather.mode='clear';weather.timer=99999;},place(x,z){player.pos.set(x,0,z);player.speed=0;player.y=0;},shot(p,t){camera.position.set(...p);camera.lookAt(...t);renderer.info.reset();G.waterReflections.update(performance.now()+100);composer.render();}};const MERGE_STATS=mergeStatics();`)});});
await page.goto(QA.BASE+'/ranch3d.html?qa=scenery',{waitUntil:'load',timeout:120000});await page.waitForFunction(()=>window.__sceneryQA?.RIG.ready&&!__sceneryQA.RIG.loadingBreed,null,{timeout:120000});await page.waitForFunction(()=>!document.getElementById('load'),null,{timeout:90000});await page.evaluate(async()=>{const q=__sceneryQA;q.G.wardrobe?.closeChar();q.G.hidePanels();q.G.save.sync(s=>{s.qualityLocked=true;});q.quality('high');await Promise.all([q.G.worldDetails.ready,q.G.photoscans.ready,q.ranchBuilderArt.ready,q.G.quartersPkg.saplingsReady]);});await page.waitForTimeout(2500);
const views=await page.evaluate(()=>{const q=__sceneryQA,W=q.G.world,P=q.G.worldPkg;const b=P.BALLOON_STATIONS[1],f=P.FERRY,d=f.docks[0],far=f.docks[1],y=W.riverLevel(d.x),r=q.G.waterPkg?.falls;const sm=q.G.quartersPkg.saplings[0],mx=new q.THREE.Matrix4();let sp=new q.THREE.Vector3(),furthest=0;for(let i=0;i<sm.count;i++){sm.getMatrixAt(i,mx);const p=new q.THREE.Vector3().setFromMatrixPosition(mx),d=Math.hypot(p.x+300,p.z+320);if(d>furthest){furthest=d;sp=p;}}const outward=new q.THREE.Vector3(sp.x+300,0,sp.z+320).normalize().multiplyScalar(5);return [
 ['balloon',[b.x+14,W.groundH(b.x,b.z)+8,b.z+18],[b.x,W.groundH(b.x,b.z)+5,b.z]],
 ['ferry',[d.x+10,y+4,d.z+12],[d.x,y+.8,d.z+3]],
 ['far-dock',[far.x+9,W.riverLevel(far.x)+4,far.z+12],[far.x,W.riverLevel(far.x)+1,far.z+far.side*4.6]],
 ['hollowpeak-falls',[-133,q.FALLS.foot+9,-211],[-150,q.FALLS.foot+6,-238]],
 ['ribbon-falls',[354,W.groundH(342,76)+6,86],[342,W.groundH(342,68)+2,68]],
 ['ochre',[-286,W.groundH(-330,300)+15,260],[-343,W.groundH(-330,300)+15,286]],
 ['lake-jetty',q.G.waterPkg.punt.position.clone().add(new q.THREE.Vector3(6,4,7)).toArray(),q.G.waterPkg.punt.position.clone().add(new q.THREE.Vector3(0,.4,0)).toArray()],
 ['frostpine',[sp.x+outward.x,sp.y+2.2,sp.z+outward.z],[sp.x,sp.y+1.3,sp.z]],
 ['trees',[-39,W.groundH(-45,45)+3,49],[-47,W.groundH(-45,45)+4,32]],
 ];});
for(const [name,p,t]of views){await page.evaluate(({p,t})=>{const q=__sceneryQA;q.place(p[0]+12,p[2]+12);q.day(.34);advanceTime(350);q.shot(p,t);},{p,t});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(await page.evaluate(()=>__sceneryQA.renderer.domElement.toDataURL().split(',')[1]),'base64'));}
const report=await page.evaluate(()=>({featureErrors:__sceneryQA.G.errors,keys:Object.keys(__sceneryQA.G).filter(k=>/water|quarter|flora|photo/i.test(k)),balloons:__sceneryQA.G.worldPkg.BALLOON_STATIONS.map(s=>({x:s.x,z:s.z})),ferry:__sceneryQA.G.worldPkg.FERRY.docks.map(({id,x,z,bz,side})=>({id,x,z,bz,side}))}));
report.models=await page.evaluate(()=>{
 const q=__sceneryQA,T=q.THREE,models=[];q.scene.traverse(o=>{if(!o.userData.sceneryArt)return;const m=o.userData.sceneryArt,bb=new T.Box3().setFromObject(o);let finite=true,triangles=0,draws=0;
  o.traverse(mesh=>{if(!mesh.isMesh)return;draws++;const p=mesh.geometry.attributes.position;triangles+=(mesh.geometry.index?.count||p.count)/3;for(const a of Object.values(mesh.geometry.attributes))for(const v of a.array)if(!Number.isFinite(v))finite=false;});
  models.push({name:o.name,...m,size:bb.getSize(new T.Vector3()).toArray(),finite,triangles,draws});});return models;
});
report.landforms=await page.evaluate(()=>{
 const q=__sceneryQA,T=q.THREE,mesas=[];q.scene.traverse(o=>{if(o.isGroup&&o.userData.geology?.kind==='layered mesa'&&[6401,6402,6404].includes(o.userData.geology.seed))mesas.push(o.userData.geology);});
 const arch=q.scene.getObjectByName('Geology | Ochre sandstone arch');arch.updateMatrixWorld(true);const point=arch.localToWorld(new T.Vector3(0,4,20)),dir=new T.Vector3(0,0,-1).transformDirection(arch.matrixWorld);const hits=new T.Raycaster(point,dir,0,40).intersectObject(arch,true);
 const p=q.G.quartersPkg;return {mesas,archPassageClear:!hits.length,scannedSaplingDraws:p.saplings.length,scannedSaplings:p.saplings.reduce((n,m)=>n+m.count,0)/2,scanned:p.saplings.every(m=>m.name==='Frostpine | scanned saplings'),waterfallTime:q.G.world.waterfallArt.time.value,waterfalls:[q.FALLS.surface.userData.waterfallArt,q.G.waterPkg.fallSheet.userData.waterfallArt]};
});
// Exercise the actual interaction callbacks and normal frame hooks, including
// both directions of travel and the rider's attachment to each new floor.
report.rides=await page.evaluate(()=>{
 const q=__sceneryQA,P=q.G.worldPkg,W=q.G.world,res={};q.G.hidePanels();q.day(.34);
 for(const id of['ford','farbank']){
  const d=P.FERRY.docks.find(d=>d.id===id),thing=W.things.find(t=>t.kind==='ferry'&&t.id===id);q.place(d.x,d.bz);thing.use();if(!P.veh)thing.use();advanceTime(150);
  const v=P.veh;res[id]={boarded:v?.kind==='boat',floor:v?q.player.mesh.position.y-v.g.position.y:null};
  if(v){v.t=v.dur*.5;advanceTime(50);res[id].inTransit=v.x>16&&v.x<134;res[id].aligned=Math.abs(q.player.mesh.rotation.y-v.g.rotation.y)<.001;v.t=v.dur-.01;advanceTime(50);const target=P.FERRY.docks[P.FERRY.at];res[id].landed=!P.veh;res[id].boatAtDock=Math.hypot(P.FERRY.g.position.x-target.x,P.FERRY.g.position.z-target.z)<.01;res[id].riderAtBank=Math.hypot(q.player.pos.x-target.x,q.player.pos.z-target.bz)<.2;}
 }
 const st=P.BALLOON_STATIONS[0];q.place(st.x,st.z);W.things.find(t=>t.kind==='balloon'&&t.id===st.id).use();advanceTime(150);
 const v=P.veh;res.balloon={boarded:v?.kind==='balloon',floor:v?q.player.mesh.position.y-v.g.position.y:null};
 if(v){v.t=18;advanceTime(150);res.balloon.altitude=v.alt;res.balloon.burnerAboveRider=v.burner.position.y>3.5;
  q.shot([v.x+16,v.y+7,v.z+18],[v.x,v.y+5,v.z]);}
 return res;
});
fs.writeFileSync(path.join(out,'balloon-flight.png'),Buffer.from(await page.evaluate(()=>__sceneryQA.renderer.domElement.toDataURL().split(',')[1]),'base64'));
report.rides.balloon.landed=await page.evaluate(()=>{const q=__sceneryQA,P=q.G.worldPkg;if(!P.veh)return false;const v=P.veh;v.t=v.dur-.01;advanceTime(50);return !P.veh&&Math.hypot(v.g.position.x-v.st.home.x,v.g.position.z-v.st.home.z)<.01;});
report.waterFlow=await page.evaluate(()=>{const q=__sceneryQA,a=q.G.world.waterfallArt.time.value;advanceTime(100);return q.G.world.waterfallArt.time.value>a;});
await page.setViewportSize({width:900,height:650});
report.frames=await page.evaluate(async()=>{const q=__sceneryQA;q.place(22,139);q.day(.34);advanceTime(150);let last=performance.now(),values=[];resumeGame();for(let i=0;i<48;i++){await new Promise(requestAnimationFrame);const now=performance.now();if(i>10)values.push(now-last);last=now;}advanceTime(0);values.sort((a,b)=>a-b);return {medianMs:values[Math.floor(values.length*.5)],p95Ms:values[Math.floor(values.length*.95)]};});
report.lowQuality=await page.evaluate(()=>{const q=__sceneryQA;q.quality('low');q.day(.80);advanceTime(150);q.shot([-133,q.FALLS.foot+9,-211],[-150,q.FALLS.foot+6,-238]);return {glError:q.renderer.getContext().getError(),geometry:q.FALLS.surface.children[0].geometry.attributes.position.count};});
fs.writeFileSync(path.join(out,'falls-night-low.png'),Buffer.from(await page.evaluate(()=>__sceneryQA.renderer.domElement.toDataURL().split(',')[1]),'base64'));
report.checks={
 noBrowserErrors:!errors.length,noFeatureErrors:!report.featureErrors.length,
 threeDetailedDocks:report.models.filter(m=>m.kind==='dock').length===3,
 supportsInGround:report.models.filter(m=>m.kind==='dock').every(m=>m.supports.every(p=>p.bottom<p.ground-.3)),
 fiveCurvedBoats:report.models.filter(m=>['ferry','rowboat'].includes(m.kind)).length===5,
 threeOpenBalloons:report.models.filter(m=>m.kind==='balloon').length===3&&report.models.filter(m=>m.kind==='balloon').every(m=>m.deckY<m.basketRim),
 finiteGeometry:report.models.every(m=>m.finite&&m.size.every(s=>s>0)),
 threeErodedMesas:report.landforms.mesas.length===3,
 archPassageOpen:report.landforms.archPassageClear,
 scannedSaplings:report.landforms.scanned&&report.landforms.scannedSaplings>30&&report.landforms.scannedSaplingDraws<=8,
 bothWaterfallsFlow:report.landforms.waterfalls.length===2&&report.waterFlow,
 ferryBoardingAndLanding:['ford','farbank'].every(id=>{const r=report.rides[id];return r.boarded&&r.inTransit&&r.aligned&&r.landed&&r.boatAtDock&&r.riderAtBank&&Math.abs(r.floor-.6)<.001;}),
 balloonBoardingAndLanding:report.rides.balloon.boarded&&report.rides.balloon.landed&&report.rides.balloon.altitude===30&&Math.abs(report.rides.balloon.floor-.2)<.001&&report.rides.balloon.burnerAboveRider,
 lowQualityRenders:report.lowQuality.glError===0&&report.lowQuality.geometry>0
};
report.errors=errors;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks,rides:report.rides,frames:report.frames,errors},null,2));if(Object.values(report.checks).some(v=>!v))process.exitCode=1;
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
