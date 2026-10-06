/* Exercise the same idle through the editor/game controller and directly through
   the mixer used by outfit cards. Guard wrist alignment, stance and loop continuity. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),QA=require('./qa-platform.cjs');
const out=path.resolve(__dirname,'../output/rider-posture/validation');fs.mkdirSync(out,{recursive:true});
const RJ=fs.readFileSync(path.resolve(__dirname,'../ranch3d.html'),'utf8').match(/const RJ=(\{[\s\S]*?\n\});/)[1];
(async()=>{const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/__posture.html',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><script type="importmap">{"imports":{"three":"/assets/vendor/three/build/three.module.js","three/addons/":"/assets/vendor/three/examples/jsm/"}}</script><script>window.RJ=${RJ}</script>`}));
 await page.goto(QA.BASE+'/__posture.html');
 const result=await page.evaluate(async()=>{
  const THREE=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{clone}=await import('three/addons/utils/SkeletonUtils.js'),{createRiderLibrary}=await import('/assets/rider-model.js');
  const angle=(a,b)=>a.clone().normalize().angleTo(b.clone().normalize());
  const lib=createRiderLibrary({THREE,GLTFLoader,clone,RJ:window.RJ}),checks=[],images=[];
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(480,650);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#ddd9cd');scene.add(new THREE.HemisphereLight(0xfff8ec,0x65715f,2));const key=new THREE.DirectionalLight(0xfff3e8,2.3);key.position.set(2,3,4);scene.add(key);
  const cam=new THREE.PerspectiveCamera(28,480/650,.02,20);cam.position.set(0,.95,4.05);cam.lookAt(0,.90,0);
  for(const body of ['f','m']){
   const kit=await lib.kit(body);await lib.outfitFor(kit,'polo');const look={body,outfit:'polo',shirt:'#c98192',pants:'#26354d',boots:'#32241d',helmet:'none',hairStyle:'lowbun'};
   const direct=lib.build(kit,look),rig=lib.build(kit,look),R={g:new THREE.Group(),fitG:new THREE.Group(),handL:new THREE.Object3D(),handR:new THREE.Object3D(),_ik:true};R.g.add(R.fitG);lib.adoptRider(R,rig,{fit:{s:1,dy:0,dz:0}});scene.add(R.g);await new Promise(r=>setTimeout(r,40));
   direct.action('idle').setEffectiveWeight(1);let controllerDelta=0;
   for(let frame=0;frame<90;frame++){
    direct.mixer.update(1/60);R.locomote(1/60,{speed:0});
    for(const name of Object.keys(rig.bones)){const a=rig.bones[name],b=direct.bones[name];controllerDelta=Math.max(controllerDelta,angle(a.quaternion,b.quaternion),a.position.distanceTo(b.position));}
   }
   const point=name=>rig.bones[name].getWorldPosition(new THREE.Vector3()),hands=[];
   for(const side of ['l','r']){
    const shoulder=point('upperarm_'+side),elbow=point('lowerarm_'+side),wrist=point('hand_'+side),middle=point('middle_01_'+side),index=point('index_01_'+side),pinky=point('pinky_01_'+side);
    hands.push({side,elbowBend:shoulder.clone().sub(elbow).angleTo(wrist.clone().sub(elbow))*180/Math.PI,wristBend:wrist.clone().sub(elbow).angleTo(middle.clone().sub(wrist))*180/Math.PI,thumbForward:index.sub(pinky).normalize().z,hipClearance:Math.abs(wrist.x)-Math.abs(point('thigh_'+side).x)});
   }
   const spacing=Math.abs(point('foot_l').x-point('foot_r').x),snapshot=()=>Object.fromEntries(Object.entries(rig.bones).map(([n,b])=>[n,{q:b.quaternion.clone(),p:b.position.clone()}]));
   rig.mixer.stopAllAction();rig.action('idle').play().setEffectiveWeight(1);rig.mixer.setTime(0);const start=snapshot();rig.mixer.setTime(kit.clips.Idle_Loop.duration-1e-5);let loopDelta=0,loopBone='';
   for(const [name,b]of Object.entries(rig.bones)){const d=Math.max(angle(b.quaternion,start[name].q),b.position.distanceTo(start[name].p));if(d>loopDelta){loopDelta=d;loopBone=name;}}
   for(const a of Object.values(rig.actions))a.reset().play().setEffectiveWeight(0);
   let transitionStep=0,transitionFrame=null,previous=null,phaseGap=0,phaseStep=0,previousPhase=null;for(let frame=0;frame<180;frame++){
    const speed=frame<60?frame/60*1.3:frame<120?1.3+(frame-60)/60*1.7:3-(frame-120)/60*3;R.locomote(1/60,{speed});
    const phase=rig.actions.walk.time/rig.actions.walk.getClip().duration,jogPhase=rig.actions.jog.time/rig.actions.jog.getClip().duration;phaseGap=Math.max(phaseGap,Math.abs(phase-jogPhase));if(previousPhase!==null){const d=Math.abs(phase-previousPhase);phaseStep=Math.max(phaseStep,Math.min(d,1-d));}previousPhase=phase;
    const now=point('hand_l');if(previous&&now.distanceTo(previous)>transitionStep){transitionStep=now.distanceTo(previous);transitionFrame={frame,speed,walkTime:rig.actions.walk.time,jogTime:rig.actions.jog.time};}previous=now;
    if([0,45,100,175].includes(frame)){renderer.render(scene,cam);images.push({id:body+'-motion-'+frame,img:renderer.domElement.toDataURL('image/png')});}
    for(const m of rig.outfit.meshes){m.skeleton.update();for(let i=0;i<m.geometry.attributes.position.count;i+=71){const p=m.getVertexPosition(i,new THREE.Vector3());if(![p.x,p.y,p.z].every(Number.isFinite))throw Error('Invalid animated clothing');}}
   }
   for(const [name,p]of kit.seat.local){rig.bones[name].position.copy(p.p);rig.bones[name].quaternion.copy(p.q);}rig.root.rotation.y=1.3;rig.root.updateMatrixWorld(true);renderer.render(scene,cam);images.push({id:body+'-seated',img:renderer.domElement.toDataURL('image/png')});
   checks.push({body,controllerDelta,loopDelta,loopBone,spacing,transitionStep,transitionFrame,phaseGap,phaseStep,hands});scene.remove(R.g);direct.dispose();rig.dispose();
  }
  renderer.dispose();return {checks,images};
 });
 for(const {id,img}of result.images)fs.writeFileSync(path.join(out,id+'.png'),Buffer.from(img.split(',')[1],'base64'));delete result.images;result.errors=errors;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2));
 assert.deepEqual(errors,[]);for(const c of result.checks){assert(c.controllerDelta<1e-6,'Idle differs between preview and game');assert(c.loopDelta<.003,'Idle loop jumps');assert(c.spacing>.16&&c.spacing<.37,'Unnatural idle foot spacing');assert(c.phaseGap<1e-6&&c.phaseStep<.04,'Gait phase jumps during a speed change');assert(c.transitionStep<.08,'Walk transition moves a hand more than 8 cm in one frame');for(const h of c.hands){assert(h.elbowBend>155&&h.elbowBend<179,'Elbow is locked or excessively bent');assert(h.wristBend<12,'Bent wrist');assert(h.thumbForward>.8,'Palm turns away from thigh');assert(h.hipClearance>.07,'Hand overlaps hip');}}
 console.log('PASS: shared idle pose, relaxed elbows/wrists, narrow stance, seamless loop, walk/jog transitions and finite clothing on both bodies. '+out);
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
