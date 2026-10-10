import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as THREE from '../assets/vendor/three/build/three.module.js';
const html=await readFile(new URL('../breeds.html',import.meta.url),'utf8');
const code=html.split('// Studio framing math:')[1].split('// End Studio framing math.')[0];
const context=vm.createContext({THREE});vm.runInContext(code.slice(code.indexOf('\n')+1),context);
const {studioUsableRect,solveStudioFrame,studioBoxPoints,studioActionEnvelope}=context;
const fixtures=[
 {name:'390px phone',stage:{width:390,height:716,top:128},caption:{bottom:242},controls:{top:646}},
 {name:'320px phone',stage:{width:320,height:716,top:128},caption:{bottom:260},controls:{top:632}},
 {name:'desktop',stage:{width:980,height:720,top:0},caption:{bottom:161},controls:{top:518}},
 {name:'phone expanded View',stage:{width:390,height:716,top:128},caption:{bottom:242},controls:{top:494}},
 {name:'short landscape',stage:{width:544,height:390,top:0},caption:{bottom:113},controls:{top:243}}
];
const horseBox=new THREE.Box3(new THREE.Vector3(-.45,0,-1.35),new THREE.Vector3(.45,2.32,1.68));
function project(points,direction,fixture,head=false){
 const rect=studioUsableRect(fixture.stage,fixture.caption,fixture.controls),fit=solveStudioFrame(points,direction,rect,{padding:head?1.1:1.045,minDistance:head?.3:1.1});
 const camera=new THREE.PerspectiveCamera(35,rect.width/rect.height,.03,200);camera.setViewOffset(rect.width,rect.height,fit.offsetX,fit.offsetY,rect.width,rect.height);camera.position.copy(fit.position);camera.lookAt(fit.target);camera.updateMatrixWorld();
 const screen={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
 for(const point of points){const p=point.clone().project(camera),x=(p.x+1)*rect.width/2,y=(1-p.y)*rect.height/2;assert([x,y,p.z].every(Number.isFinite));assert(p.z>-1&&p.z<1);screen.left=Math.min(screen.left,x);screen.right=Math.max(screen.right,x);screen.top=Math.min(screen.top,y);screen.bottom=Math.max(screen.bottom,y);}
 return{rect,fit,camera,screen};
}
function contained(result,label){const {rect,screen}=result;assert(screen.left>=rect.left-1e-5,label+' left');assert(screen.right<=rect.right+1e-5,label+' right');assert(screen.top>=rect.top-1e-5,label+' caption');assert(screen.bottom<=rect.bottom+1e-5,label+' controls');}
test('Actual Three projections fit and center body across phone, desktop, View and landscape rectangles',()=>{
 const points=studioBoxPoints(horseBox);
 for(const fixture of fixtures)for(const direction of [new THREE.Vector3(-.72,.13,.69),new THREE.Vector3(-1,.13,0),new THREE.Vector3(0,.1,1)]){
  const result=project(points,direction,fixture);contained(result,fixture.name);
  const center=result.fit.target.clone().project(result.camera);assert(Math.abs((1-center.y)*result.rect.height/2-(result.rect.top+result.rect.bottom)/2)<1e-8,'orbit target centered in usable viewport');
 }
 const phone=project(points,new THREE.Vector3(-.72,.13,.69),fixtures[0]);assert(phone.screen.bottom-phone.screen.top>240,'390px horse occupies at least240px instead of about125px');
});
test('Head closeup fills usable height and leaves both caption and toolbar clear',()=>{
 const head=new THREE.Box3(new THREE.Vector3(-.22,1.6,.95),new THREE.Vector3(.22,2.3,1.65));
 for(const fixture of fixtures){const result=project(studioBoxPoints(head),new THREE.Vector3(-.78,.10,.78),fixture,true);contained(result,fixture.name);assert((result.screen.bottom-result.screen.top)/(result.rect.bottom-result.rect.top)>.68,'head occupies the free area');}
});
test('Action envelopes include the standing model and fit raised, lowered and sideways motions',()=>{
 for(const type of ['rear','graze','bow','kick','liedown','nuzzle','look','toss','paw']){
  const envelope=studioActionEnvelope(horseBox,type);assert(envelope.containsBox(horseBox));assert.equal(envelope.min.y,0,'ground stays stable');
  for(const fixture of fixtures)contained(project(studioBoxPoints(envelope),new THREE.Vector3(-.72,.13,.69),fixture),fixture.name+' '+type);
 }
 assert(studioActionEnvelope(horseBox,'rear').max.y>3.1);assert(studioActionEnvelope(horseBox,'graze').max.z>1.9);assert(studioActionEnvelope(horseBox,'kick').min.z<-1.75);
});
test('Wide wings and long tails remain visible instead of being limited to the horse zoom cap',()=>{
 const dragon=new THREE.Box3(new THREE.Vector3(-4.8,0,-6),new THREE.Vector3(4.8,3.9,2.2));
 for(const fixture of fixtures){const result=project(studioBoxPoints(dragon),new THREE.Vector3(-.72,.13,.69),fixture);contained(result,fixture.name);assert(result.fit.distance>10);}
});
test('Cramped rectangles stay finite and framing does not mutate inputs',()=>{
 const points=studioBoxPoints(horseBox),before=points.map(p=>p.toArray()),direction=new THREE.Vector3(-1,.13,0),dir=direction.toArray();
 const rect=studioUsableRect({width:320,height:260,top:0},{bottom:125},{top:143}),fit=solveStudioFrame(points,direction,rect);assert.equal(rect.bottom-rect.top,64);assert(fit.position.toArray().every(Number.isFinite));assert.deepEqual(points.map(p=>p.toArray()),before);assert.deepEqual(direction.toArray(),dir);
});

test('Actual native skinned action poses remain inside their fitted envelope',async()=>{
 const {loadNativeHorseFixture}=await import('./test-native-horse-actions.mjs');
 const {createNativeHorseActionClips}=await import('../assets/native-horse-actions.mjs');
 for(const breed of ['white','bay','sporthorse']){
 const {root}=loadNativeHorseFixture('review/native-trot-reference-kit/'+breed+'/model.glb');
 const meshes=[];root.traverse(node=>{if(node.isSkinnedMesh)meshes.push(node);});const point=new THREE.Vector3();
 function bounds(){root.updateMatrixWorld(true);const box=new THREE.Box3();for(const mesh of meshes){for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,point);box.expandByPoint(point.applyMatrix4(mesh.matrixWorld));}}return box;}
 const standing=bounds(),bundle=createNativeHorseActionClips({THREE,root,profile:{id:breed,nativeBreed:true,nativeKind:'horse'}}),mixer=new THREE.AnimationMixer(root);
 for(const [type,record]of Object.entries(bundle.actions)){
  const clip=THREE.AnimationClip.findByName(bundle.clips,record.clip),action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const envelope=studioActionEnvelope(standing,type);
  for(const phase of Array.from({length:21},(_,i)=>i/20)){mixer.setTime(clip.duration*phase);const pose=bounds();assert(envelope.clone().expandByScalar(.002).containsBox(pose),type+' phase '+phase+' actual body/hair/tack exceeds reserved envelope: '+JSON.stringify({pose:[pose.min.toArray(),pose.max.toArray()],envelope:[envelope.min.toArray(),envelope.max.toArray()]}));}
  action.stop();
 }
 mixer.uncacheRoot(root);
 }
});

test('Rest baseline is captured on load before Head view and never grows with action reframing',()=>{
 const load=html.slice(html.indexOf('release();horse=next;'),html.indexOf('function setCredit'));
 assert(load.indexOf('studioRestBounds=bounds.clone()')>=0);assert(load.indexOf('studioRestBounds=bounds.clone()')<load.indexOf('if(headView)focusHead()'),'loading in Head view still caches the standing whole horse');
 const baseline=horseBox.clone(),fitted=[];let currentPoints=studioBoxPoints(horseBox);
 const ctx=vm.createContext({THREE,horse:{},headTracking:{},studioRestBounds:baseline,motion:{action:{type:'look'}},visibleStudioPoints:()=>currentPoints.map(p=>p.clone()),studioBoxPoints,studioActionEnvelope,applyStudioFrame:points=>fitted.push(new THREE.Box3().setFromPoints(points))});
 const bodyFunction=html.slice(html.indexOf('function fitBodyCamera('),html.indexOf('function frameBody('));vm.runInContext(bodyFunction,ctx);
 for(let i=0;i<30;i++){currentPoints=studioBoxPoints(horseBox.clone().translate(new THREE.Vector3(0,Math.sin(i)*.03,Math.cos(i)*.02)));ctx.fitBodyCamera(new THREE.Vector3(-.72,.13,.69));}
 assert.deepEqual(baseline.min.toArray(),horseBox.min.toArray());assert.deepEqual(baseline.max.toArray(),horseBox.max.toArray());
 currentPoints=studioBoxPoints(horseBox);ctx.fitBodyCamera(new THREE.Vector3(-.72,.13,.69));const settled=fitted.at(-1);ctx.fitBodyCamera(new THREE.Vector3(-.72,.13,.69));assert.deepEqual(settled.min.toArray(),fitted.at(-1).min.toArray());assert.deepEqual(settled.max.toArray(),fitted.at(-1).max.toArray());
});
test('Head-follow and jump render offsets restore exact camera state over repeated cycles',()=>{
 const drawSource=html.slice(html.indexOf('const savedCamera=new THREE.Vector3()'),html.indexOf('let last=performance.now()'));
 const horse=new THREE.Group(),bone=new THREE.Object3D();horse.add(bone);const camera=new THREE.PerspectiveCamera(),controls={target:new THREE.Vector3(0,1.6,1)},baseCamera=new THREE.Vector3(-2,2,4),baseTarget=controls.target.clone();camera.position.copy(baseCamera);
 const local=new THREE.Vector3(.2,.3,.1),motion={state:{bodyLiftM:0}},frames=[];
 const ctx=vm.createContext({THREE,camera,controls,horse,headView:true,headTracking:{bone,local,origin:local.clone()},motion,scene:new THREE.Scene(),renderer:{render(){frames.push(camera.position.clone());}}});vm.runInContext(drawSource,ctx);
 for(let i=0;i<200;i++){bone.position.set(Math.sin(i*.1)*.1,Math.cos(i*.1)*.2,Math.sin(i*.13)*.05);bone.rotation.y=Math.sin(i*.1)*.3;ctx.draw();assert.deepEqual(camera.position.toArray(),baseCamera.toArray());assert.deepEqual(controls.target.toArray(),baseTarget.toArray());}
 assert(frames.some(p=>p.distanceTo(baseCamera)>.15),'rendered closeup really follows the moving head');
 ctx.headView=false;for(let i=0;i<100;i++){motion.state.bodyLiftM=Math.max(0,Math.sin(i*.1))*.8;ctx.draw();assert.deepEqual(camera.position.toArray(),baseCamera.toArray());assert.deepEqual(controls.target.toArray(),baseTarget.toArray());}
});
