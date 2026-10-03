/* Black Dragon mounted wing separation, tail motion and pre-contact wing fold.
 * Uses a disposable browser save and actual skinned geometry. */
const QA=require('./qa-platform.cjs'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const output=path.join(__dirname,'../review/dragon-wing-tail');
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()}),page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],report={};
 page.on('pageerror',e=>errors.push(e.message));
 const capture=async(name,view)=>{
  await page.evaluate(view=>{const G=__features,p=G.horse.player,r=G.horse.RIG(),box=new G.THREE.Box3().setFromObject(r.scene,true);box.union(new G.THREE.Box3().setFromObject(p.rider.g,true));const size=box.getSize(new G.THREE.Vector3()),center=box.getCenter(new G.THREE.Vector3()),radius=Math.max(size.x,size.y,size.z)*.5,distance=radius/Math.tan(G.camera.fov*Math.PI/360)*1.43;const direction=view==='front'?[0,.16,1]:view==='rear'?[0,.21,-1]:view==='rear-quarter'?[1,.29,-1.3]:[1,.29,1.3];G.camera.position.copy(center).add(new G.THREE.Vector3(...direction).normalize().multiplyScalar(distance));G.camera.lookAt(center);G.camera.updateProjectionMatrix();G.renderer.domElement.setAttribute('data-dragon-qa','true');G.renderer.render(G.scene,G.camera);},view);
  fs.mkdirSync(output,{recursive:true});await page.locator('[data-dragon-qa]').screenshot({path:path.join(output,name+'.png')});return name+'.png';
 };
 try{
  await page.goto(QA.BASE+'/ranch3d.html?qa=dragon-wing-tail',{timeout:120000});await page.waitForFunction(()=>window.__features?.installed?.includes('native-horses')&&__features.horse.RIG().ready,null,{timeout:120000});
  const index=await page.evaluate(()=>{const G=__features;G.save.sync(s=>G.horse.grantHorse(s,'black-dragon-native',{name:'Wing and Tail QA',level:30,stats:{speed:3,accel:3,stamina:3,jump:3,agility:3}}));G.horse.reloadHorses();G.horse.rebuildAll();G.hidePanels();return G.horse.myHorses.findIndex(h=>h.breed==='black-dragon-native');});
  await page.selectOption('#horseSel',String(index),{force:true});await page.waitForFunction(()=>{const G=__features,r=G.horse.RIG();return r.requestedBreed==='black-dragon-native'&&!r.loadingBreed&&r.ready&&r.attachedTo===G.horse.player.mesh;},null,{timeout:120000});
  report.profile=await page.evaluate(()=>{
   const G=__features,T=G.THREE,p=G.horse.player,r=G.horse.RIG();advanceTime(0);G.hidePanels();
   const wallDistance=(x,z,w)=>{const dx=w.x2-w.x1,dz=w.z2-w.z1,t=Math.max(0,Math.min(1,((x-w.x1)*dx+(z-w.z1)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-w.x1-dx*t,z-w.z1-dz*t);};
   const candidates=[];for(let x=-100;x<=100;x+=5)for(let z=-100;z<=100;z+=5)candidates.push({x,z});candidates.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));
   const spot=candidates.find(({x,z})=>{if(G.world.colliders.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+14)||G.world.walls.some(w=>wallDistance(x,z,w)<10))return false;const heights=[];for(let j=0;j<16;j++){const a=j*Math.PI/8;heights.push(G.world.groundH(x+Math.sin(a)*9,z+Math.cos(a)*9));}return Math.max(...heights)-Math.min(...heights)<.03;});
   if(!spot)throw Error('No open flat mounted wing review area');p.pos.set(spot.x,0,spot.z);p.heading=0;p.speed=0;p.y=0;p.vy=0;p.flying=false;p.landing=false;p.stam=1;p.blown=false;p.boostT=0;advanceTime(900);
   const meshes=[];r.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const attr=mesh.geometry.attributes,indices={left:[],right:[]};for(let i=0;i<attr.position.count;i++){let left=0,right=0;for(let k=0;k<4;k++){const index=attr.skinIndex.getComponent(i,k),weight=attr.skinWeight.getComponent(i,k),name=mesh.skeleton.bones[index].name;if(name.startsWith('w')&&name.includes('_L'))left+=weight;if(name.startsWith('w')&&name.includes('_R'))right+=weight;}if(left>.5)indices.left.push(i);if(right>.5)indices.right.push(i);}meshes.push({mesh,indices});});
   const root=r.nativeRoot.getObjectByName('w_C_L_057'),sign=Math.sign(p.mesh.worldToLocal(root.getWorldPosition(new T.Vector3())).x)||1;
   const quantile=(a,f)=>a.length?a[Math.min(a.length-1,Math.floor(a.length*f))]:null;
   window.__wingTailSample=(skin=true)=>{
    r.scene.updateWorldMatrix(true,true);p.rider.g.updateWorldMatrix(true,true);const inverse=new T.Matrix4().copy(p.mesh.matrixWorld).invert(),v=new T.Vector3(),floor=G.world.groundH(p.pos.x,p.pos.z),xs={left:[],right:[]};let minimumY=Infinity,lowest=null;
    if(skin)for(const {mesh,indices}of meshes){const left=new Set(indices.left),right=new Set(indices.right);for(let i=0;i<mesh.geometry.attributes.position.count;i++){v.fromBufferAttribute(mesh.geometry.attributes.position,i);mesh.applyBoneTransform(i,v);v.applyMatrix4(mesh.matrixWorld);const pointFloor=G.world.groundH(v.x,v.z);if(v.y-pointFloor<minimumY){minimumY=v.y-pointFloor;lowest={mesh:mesh.name,index:i,world:v.toArray(),actorLocal:v.clone().applyMatrix4(inverse).toArray(),pointFloor};}if(left.has(i)||right.has(i)){v.applyMatrix4(inverse);if(left.has(i))xs.left.push(sign*v.x);if(right.has(i))xs.right.push(-sign*v.x);}}}
    const sides={};for(const side of ['left','right']){const a=xs[side].sort((x,y)=>x-y);sides[side]={count:a.length,min:a[0],p05:quantile(a,.05),median:quantile(a,.5),p95:quantile(a,.95),max:a.at(-1),wrongSideFraction:a.length?a.filter(x=>x<-.01).length/a.length:0};}
    const seat=r.nativeSeatFollower.getWorldPosition(new T.Vector3()).applyMatrix4(inverse),expected=seat.clone().add(new T.Vector3(0,.11,-.02));
    const tail=r.nativeRoot.getObjectByName('ik_ACT_tail_5_end_0189').getWorldPosition(new T.Vector3()).applyMatrix4(inverse);
    return {y:p.y,flying:p.flying,landing:p.landing,flyAlt:p.flyAlt,nativeLanding:r.nativeLanding,nativeLandingPose:r.nativeLandingPose,nativeAltitude:r.nativeAltitude,nativePoseLiftM:r.nativePoseLiftM||0,gait:r.heroMotion.mode,motion:r.heroMotion.state,minimumY:skin?minimumY:null,lowest,actor:{position:p.pos.toArray(),meshPosition:p.mesh.position.toArray(),rotation:p.mesh.rotation.toArray(),floor},wingSides:sides,wingP05Gap:skin?sides.left.p05+sides.right.p05:null,
     wingPose:['w_C_L_057','w_C_R_069','w2_L_059','w2_R_071'].map(name=>({name,q:r.nativeRoot.getObjectByName(name).quaternion.toArray()})),tail:tail.toArray(),seat:seat.toArray(),riderDelta:p.rider.g.position.clone().sub(expected).toArray(),riderAnchorError:p.rider.g.position.distanceTo(expected),finite:r.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))&&Object.values(p.rider.sk?.by||{}).every(b=>b.matrixWorld.elements.every(Number.isFinite)),bones:r.bones.length};
   };
   return {reviewPosition:spot,groundClearanceBasis:'Pointwise groundH at every actual skinned vertex',motionFile:r.profile.motionFile,motionSha256:r.profile.motionSha256,sourceSha256:r.profile.sha256,landingHeight:r.profile.nativeLandingBlendHeightM,landingBlend:r.profile.nativeLandingBlendS,wingMasks:meshes.map(x=>({vertices:x.mesh.geometry.attributes.position.count,left:x.indices.left.length,right:x.indices.right.length}))};
  });
  report.ground=await page.evaluate(()=>__wingTailSample());if(process.env.QA_GROUND_ONLY==='1')return;report.images=[];
  for(const view of ['front','rear'])report.images.push(await capture('ground-'+view,view));
  await page.locator('#flyBtn').click({force:true});await page.evaluate(()=>advanceTime(1900));
  report.air=await page.evaluate(()=>{const rows=[];for(let i=0;i<35;i++){advanceTime(100);rows.push(__wingTailSample(i%5===0));}return rows;});
  report.images.push(await capture('flight-quarter','rear-quarter'));
  const tailRange=[0,1,2].map(k=>Math.max(...report.air.map(s=>s.tail[k]))-Math.min(...report.air.map(s=>s.tail[k])));
  report.tailRange=tailRange;assert(tailRange[0]>.2,'Flight tail should have a visible lateral wave');
  assert(report.air.every(s=>s.flying&&s.gait==='fly'),'Steady hover keeps flight motion');
  await page.locator('#flyBtn').click({force:true});
  report.approach=await page.evaluate(()=>{const rows=[];for(let i=0;i<80;i++){advanceTime(50);const s=__wingTailSample();rows.push(s);if(s.flying&&s.y<.25)break;}return rows;});
  const folding=report.approach.filter(s=>s.flying&&s.y>.08&&s.gait!=='fly');assert(folding.length,'Wings begin gathering before touchdown');
  assert(folding.every(s=>s.y<=report.profile.landingHeight+.03),'Ground-pose blend begins only near touchdown');
  report.images.push(await capture('landing-quarter','quarter'));
  report.remoteApproach=await page.evaluate(()=>{const G=__features,p=G.horse.player,id='qa-wing-fold-remote';G.net.onMessage('srf1/qa-isolated/pos',JSON.stringify({id,n:'Wing Fold QA',b:'black-dragon-native',x:p.pos.x+4,z:p.pos.z,h:0,sp:0,y:.3,fl:1,ld:1}));advanceTime(200);const remote=G.net.remotes[id],rig=remote.rig;const result={nativeFlying:rig.nativeFlying,nativeLandingPose:rig.nativeLandingPose,gait:rig.heroMotion.mode,altitude:remote.parts.group.position.y-G.world.groundH(remote.x,remote.z),finite:rig.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite))};remote.lastSeen=8;advanceTime(20);return result;});
  assert(report.remoteApproach.nativeFlying&&report.remoteApproach.nativeLandingPose&&report.remoteApproach.gait!=='fly'&&report.remoteApproach.finite,'Remote dragon gathers wings while still airborne near landing');
  assert(Math.abs(report.remoteApproach.altitude-.3)<.025,'Remote approach altitude applied once');
  // Cancel during the gather, then hold a low hover: neither should leave the
  // wings stuck in the ground pose or stop the tail/flight clock.
  await page.locator('#flyBtn').click({force:true});await page.evaluate(()=>advanceTime(1200));report.cancel=await page.evaluate(()=>__wingTailSample());
  assert(report.cancel.flying&&!report.cancel.landing&&report.cancel.gait==='fly'&&report.cancel.flyAlt>=.5,'Cancel landing restores low hover and wingbeat');
  report.lowHover=await page.evaluate(()=>{const p=__features.horse.player;p.flyAlt=.25;p.landing=false;advanceTime(1000);return __wingTailSample();});
  assert(report.lowHover.flying&&!report.lowHover.nativeLandingPose&&report.lowHover.gait==='fly','A genuine .25m hover keeps beating wings');
  await page.locator('#flyBtn').click({force:true});
  report.landing=await page.evaluate(()=>{const rows=[];for(let i=0;i<60;i++){advanceTime(50);rows.push(__wingTailSample());if(!rows.at(-1).flying){advanceTime(900);rows.push(__wingTailSample());break;}}return rows;});
  report.landed=report.landing.at(-1);
  assert(!report.landed.flying&&report.landed.y===0&&report.landed.gait==='stand','Landing completes in the folded idle');
  const all=[report.ground,...report.air,...report.approach,report.cancel,report.lowHover,...report.landing];assert(all.every(s=>s.finite&&s.bones===232),'Native dragon and rider transforms stay finite');assert(all.every(s=>s.riderAnchorError<.025),'Rider remains on the animated seat');
  assert(report.ground.wingP05Gap>.02&&report.landed.wingP05Gap>.02,'Folded left and right wing skins stay separated on their own sides');
  report.minimumSkinY=Math.min(...all.filter(s=>s.minimumY!==null).map(s=>s.minimumY));assert(report.minimumSkinY>-.04,'Actual skin should not penetrate the landing floor');
  assert.equal(errors.length,0,errors.join('\n'));console.log(JSON.stringify({wingGap:report.ground.wingP05Gap,landedGap:report.landed.wingP05Gap,tailRange,minimumSkinY:report.minimumSkinY,preContactFoldSamples:folding.length,images:report.images}));
 }finally{fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,process.env.QA_REPORT||'mounted-report.json'),JSON.stringify({...report,errors},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
