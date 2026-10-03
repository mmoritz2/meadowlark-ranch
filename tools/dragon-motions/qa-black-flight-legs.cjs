/* Inspect packaged Black Dragon flight leg motion on the unchanged source skin.
 * Paths are measured relative to the torso, removing common body lift/bob. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),QA=require('../qa-platform.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'review/dragon-flight-legs');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 const report={};page.on('pageerror',e=>errors.push(e.message));
 try{
  const responsePromise=page.waitForResponse(r=>r.url().split('?')[0].endsWith('/black-dragon-motion.glb'));
  await page.goto(QA.BASE+'/review/dragon-rigging/black-motion.html?clip=DragonFly&review=flight-legs',{timeout:120000});
  await page.waitForFunction(()=>window.__black,null,{timeout:120000});
  report.motionSha256=crypto.createHash('sha256').update(await(await responsePromise).body()).digest('hex');
  const expected=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'assets/models/dragon-motions/black-dragon-motion.glb'))).digest('hex');
  assert.equal(report.motionSha256,expected,'Preview must load the current packaged asset');
  Object.assign(report,await page.evaluate(()=>{
   const a=__black,T=a.T,body=a.current.body,source=a.current.sourceScene;
   const legs=[
    {name:'front-left',upper:'upper_arm_L_052',lower:'ik_underarm_L_053',ankle:'Hand_L_0133',toe:'front_food_C_1_L_0134'},
    {name:'front-right',upper:'upper_arm_R_054',lower:'ik_underarm_R_055',ankle:'Hand_R_099',toe:'front_food_C_1_R_0100'},
    {name:'hind-left',upper:'Oberschenkel_L_08',lower:'lowerleg_L_09',ankle:'back_food_L_082',toe:'back_food_C_1_L_083'},
    {name:'hind-right',upper:'Oberschenkel_R_012',lower:'lowerleg_R_013',ankle:'back_food_R_0116',toe:'back_food_C_1_R_0117'},
   ];
   const torso=source.getObjectByName('pelvic_2_03'),clip=a.clips.find(c=>c.name==='DragonFly');
   for(const leg of legs)leg.bones=Object.fromEntries(['upper','lower','ankle','toe'].map(k=>[k,source.getObjectByName(leg[k])]));
   const meshes=[];a.current.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
   const rows=[],v=new T.Vector3();let finite=true,minimumSkinY=Infinity;
   a.select('DragonFly');
   for(let i=0;i<=120;i++){
    a.seek(clip.duration*i/120);
    const center=torso.getWorldPosition(new T.Vector3()),inverse=torso.getWorldQuaternion(new T.Quaternion()).invert();
    const samples=legs.map(leg=>({
     name:leg.name,
     ankleTorsoM:leg.bones.ankle.getWorldPosition(new T.Vector3()).sub(center).applyQuaternion(inverse).toArray(),
     localQuaternions:Object.fromEntries(Object.entries(leg.bones).map(([name,b])=>[name,b.quaternion.toArray()])),
     footTorsoQuaternion:inverse.clone().multiply(leg.bones.ankle.getWorldQuaternion(new T.Quaternion())).toArray(),
    }));
    for(const mesh of meshes){
     finite&&=mesh.skeleton.bones.every(b=>b.matrixWorld.elements.every(Number.isFinite));
     for(let j=0;j<mesh.geometry.attributes.position.count;j++){
      v.fromBufferAttribute(mesh.geometry.attributes.position,j);mesh.applyBoneTransform(j,v);v.applyMatrix4(mesh.matrixWorld);
      finite&&=v.toArray().every(Number.isFinite);minimumSkinY=Math.min(minimumSkinY,v.y);
     }
    }
    rows.push({phase:i/120,legs:samples,allBonePositions:body.skeleton.bones.map(b=>b.getWorldPosition(new T.Vector3()).toArray()),allBoneQuaternions:body.skeleton.bones.map(b=>b.quaternion.toArray())});
   }
   const angularDistance=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.reduce((sum,x,i)=>sum+x*b[i],0))/(Math.hypot(...a)*Math.hypot(...b))))*180/Math.PI;
   const angleRange=values=>{let maximum=0;for(let i=0;i<values.length;i++)for(let j=i+1;j<values.length;j++)maximum=Math.max(maximum,angularDistance(values[i],values[j]));return maximum;};
   const summaries=legs.map((leg,index)=>{
    const samples=rows.map(r=>r.legs[index]),points=samples.map(x=>x.ankleTorsoM),rangeM=[0,1,2].map(k=>Math.max(...points.map(p=>p[k]))-Math.min(...points.map(p=>p[k])));
    let diameterM=0;for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)diameterM=Math.max(diameterM,Math.hypot(...points[i].map((x,k)=>x-points[j][k])));
    return {name:leg.name,ankleRangeTorsoM:rangeM,anklePathDiameterM:diameterM,highestAnklePhase:rows[points.findIndex(p=>p[1]===Math.max(...points.map(x=>x[1])))].phase,jointAngularRangeDeg:Object.fromEntries(['upper','lower','ankle','toe'].map(k=>[k,angleRange(samples.map(s=>s.localQuaternions[k]))])),footPitchRangeDeg:angleRange(samples.map(s=>s.footTorsoQuaternion))};
   });
   const correlations=[];
   for(const [left,right]of[[0,1],[2,3],[0,2]]){
    const x=rows.slice(0,120).map(r=>r.legs[left].ankleTorsoM[1]),y=rows.slice(0,120).map(r=>r.legs[right].ankleTorsoM[1]);
    const mx=x.reduce((a,b)=>a+b)/x.length,my=y.reduce((a,b)=>a+b)/y.length,den=Math.sqrt(x.reduce((a,b)=>a+(b-mx)**2,0)*y.reduce((a,b)=>a+(b-my)**2,0));
    const scores=x.map((_,lag)=>x.reduce((sum,v,i)=>sum+(v-mx)*(y[(i+lag)%y.length]-my),0)/den);let best=0;for(let i=1;i<scores.length;i++)if(scores[i]>scores[best])best=i;
    correlations.push({pair:[legs[left].name,legs[right].name],samePhaseCorrelation:scores[0],bestCorrelation:scores[best],lagCycle:best/scores.length});
   }
   const first=rows[0],last=rows.at(-1),loopEndpointPositionErrorM=Math.max(...first.allBonePositions.flatMap((p,i)=>p.map((v,k)=>Math.abs(v-last.allBonePositions[i][k]))));
   const loopEndpointAngleErrorDeg=Math.max(...first.allBoneQuaternions.map((q,i)=>angularDistance(q,last.allBoneQuaternions[i])));
   for(const row of rows){delete row.allBonePositions;delete row.allBoneQuaternions;}
   return {duration:clip.duration,joints:body.skeleton.bones.length,skinVertices:meshes.reduce((sum,m)=>sum+m.geometry.attributes.position.count,0),samples:rows.length,finite,minimumSkinY,loopEndpointPositionErrorM,loopEndpointAngleErrorDeg,legs:summaries,phaseCorrelations:correlations,rows};
  }));
  report.images=[];
  for(const view of ['side','front-quarter'])for(const phase of [0,.25,.5,.75]){
   await page.evaluate(({view,phase})=>{
    const a=__black,T=a.T;a.select('DragonFly');a.seek(a.clips.find(c=>c.name==='DragonFly').duration*phase);
    const names=['paunch_017','pelvic_2_03','Hand_L_0133','Hand_R_099','back_food_L_082','back_food_R_0116'];
    const box=new T.Box3();for(const n of names)box.expandByPoint(a.current.sourceScene.getObjectByName(n).getWorldPosition(new T.Vector3()));
    const center=box.getCenter(new T.Vector3());center.y+=.12;const extent=box.getSize(new T.Vector3()),distance=Math.max(extent.y*1.4,extent.z*1.0)/Math.tan(a.camera.fov*Math.PI/360)*.78;
    a.controls.target.copy(center);a.camera.up.set(0,1,0);a.camera.position.copy(center).add(new T.Vector3(...(view==='side'?[1,.07,0]:[-1,.05,1.15])).normalize().multiplyScalar(Math.max(5,distance)));a.controls.update();a.renderer.render(a.scene,a.camera);
    document.querySelector('nav p').textContent='Flight legs · '+view+' · full cycle '+Math.round(phase*100)+'%';
   },{view,phase});
   const filename='flight-legs-'+view+'-'+Math.round(phase*100)+'.png';await page.screenshot({path:path.join(out,filename)});report.images.push(filename);
  }
  assert.equal(report.joints,232);assert.equal(report.samples,121);assert(Math.abs(report.duration-3.3)<1e-5,'Full flowing flight loop remains 3.3 seconds');
  assert(report.finite,'All original joints and actual skinned vertices stay finite');assert(report.loopEndpointPositionErrorM<1e-5&&report.loopEndpointAngleErrorDeg<.01,'All joints loop continuously');
  for(const leg of report.legs){assert(leg.anklePathDiameterM>.04,leg.name+' needs independent motion beyond torso bob');assert(leg.jointAngularRangeDeg.upper>.5&&leg.jointAngularRangeDeg.lower>.5,leg.name+' upper/lower joints should articulate');assert(leg.footPitchRangeDeg>2,leg.name+' foot angle should vary visibly');}
  assert.equal(errors.length,0,errors.join('\n'));
  console.log(JSON.stringify({...report,rows:report.rows.length},null,2));
 }finally{fs.writeFileSync(path.join(out,'packaged-flight-legs.json'),JSON.stringify({...report,errors},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
