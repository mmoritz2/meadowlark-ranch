/* The approved3DHaupt dragon, with its real skinned membrane wings. This adapter
 * drives the site's anatomical locomotion core and28 source wing joints. Source
 * geometry, bind matrices and materials are never changed by animation. */
import {createArtistMotion} from './artist-horse-motion.js';

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
const TAU=Math.PI*2;

export function createDragonMotion({THREE,root,skin,heightM,profile}){
 const core=createArtistMotion({THREE,root,skin,heightM,contactEnvelope:profile?.contactEnvelope});
 // Wings and horns make this dragon taller than its limb reach. Use the actual
 // leg scale for stride lengths instead of the full appendage bounding height;
 // the game's speed clock still advances strides according to travel speed.
 for(const gait of Object.values(core.gaits)){gait.speed*=.42;gait.lift*=.82;gait.drop*=.86;gait.bob*=.86;}
 const bones=skin.skeleton.bones,clean=name=>name.replace(/[.\s]/g,''),by=Object.fromEntries(bones.map(b=>[clean(b.name),b])),named=name=>by[clean(name)];
 const wings=profile?.dragonRig?.wings;
 if(!wings?.L||!wings?.R)throw new Error('Dragon requires its source wing branches');
 for(const side of ['L','R'])for(const name of [wings[side].root,...wings[side].branches.flat()])if(!named(name))throw new Error('Missing dragon wing joint '+name);
 const axisX=new THREE.Vector3(1,0,0),axisY=new THREE.Vector3(0,1,0),axisZ=new THREE.Vector3(0,0,1),rotation=new THREE.Quaternion();
 // Exact source wing and tail skin samples provide articulated floor
 // clearance. The original shape, materials and bind skin remain unchanged.
 const guardGroups={L:{bone:named(wings.L.root),samples:[]},R:{bone:named(wings.R.root),samples:[]},tail:{bone:named('tail.1'),samples:[]}};
 root.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;const g=mesh.geometry;
  for(let vertex=0;vertex<g.attributes.position.count;vertex++){
   const weights={L:0,R:0,tail:0};
   for(let k=0;k<4;k++){const index=g.attributes.skinIndex.getComponent(vertex,k),w=g.attributes.skinWeight.getComponent(vertex,k),name=clean(mesh.skeleton.bones[index].name);if(name.startsWith('wingL'))weights.L+=w;else if(name.startsWith('wingR'))weights.R+=w;else if(name.startsWith('tail'))weights.tail+=w;}
   const group=Object.keys(weights).find(k=>weights[k]>.5);if(group)guardGroups[group].samples.push([mesh,vertex]);
  }
 });
 const guardPoint=new THREE.Vector3(),guardWorst=new THREE.Vector3(),guardPivot=new THREE.Vector3(),guardAxis=new THREE.Vector3(),guardRootInverse=new THREE.Matrix4(),guardParentInverse=new THREE.Quaternion(),guardRootRotation=new THREE.Quaternion(),guardWorldScale=new THREE.Vector3();
 function keepAppendagesAboveGround(){
  root.updateMatrixWorld(true);root.getWorldQuaternion(guardRootRotation);root.getWorldScale(guardWorldScale);guardRootInverse.copy(root.matrixWorld).invert();
  const floorY=-input.altitude/Math.max(.001,Math.abs(guardWorldScale.y)),clearance=.005;
  for(const group of Object.values(guardGroups))for(let iteration=0;iteration<5;iteration++){
   let lowest=Infinity;for(const [mesh,vertex]of group.samples){mesh.getVertexPosition(vertex,guardPoint);mesh.localToWorld(guardPoint);guardPoint.applyMatrix4(guardRootInverse);if(guardPoint.y<lowest){lowest=guardPoint.y;guardWorst.copy(guardPoint);}}
   if(lowest>=floorY+clearance)break;
   group.bone.getWorldPosition(guardPivot).applyMatrix4(guardRootInverse);const lever=-(guardWorst.z-guardPivot.z);if(Math.abs(lever)<.1)break;
   const correction=clamp((floorY+clearance-lowest)/lever,-.12,.12);group.bone.parent.getWorldQuaternion(guardParentInverse).invert();guardAxis.copy(axisX).applyQuaternion(guardRootRotation).applyQuaternion(guardParentInverse);group.bone.quaternion.premultiply(rotation.setFromAxisAngle(guardAxis,correction));root.updateMatrixWorld(true);root.traverse(mesh=>{if(mesh.isSkinnedMesh)mesh.skeleton.update();});
  }
 }

 const add=(name,axis,angle)=>{const bone=named(name);if(bone)bone.quaternion.multiply(rotation.setFromAxisAngle(axis,angle));};
 let requested='stand',lead='left',speed,rest=false,time=0,flightAge=0,landAge=10,open=0,beat=0,turn=0;
 let input={flying:false,altitude:0,verticalSpeed:0,speedMps:0},wasFlying=false,stage='ground';
 let currentState=core.state;
 let basePose=null,appliedGait='stand',appliedLead='left',appliedSpeed;
 function applyCore(gait){if(gait===appliedGait&&lead===appliedLead&&speed===appliedSpeed)return;core.set(gait,{lead,speed});appliedGait=gait;appliedLead=lead;appliedSpeed=speed;}
 function set(gait,options={}){
  requested=gait;lead=options.lead||lead;speed=options.speed;rest=gait==='rest';if(rest)basePose=null;
  if(!input.flying)applyCore(gait);
 }
 function setFlight(state={}){
  input={flying:!!state.flying,altitude:Math.max(0,Number(state.altitude)||0),
   verticalSpeed:Number(state.verticalSpeed)||0,speedMps:Math.max(0,Number(state.speedMps)||0)};
 }
 function update(dt){
  dt=clamp(dt,0,.25);time+=dt;
  if(rest){for(const side of ['L','R'])named(wings[side].root).scale.set(1,1,1);applyCore('rest');stage='rest';currentState={...core.state,flightStage:stage,wingOpen:1};return;}
  if(input.flying&&!wasFlying){flightAge=0;landAge=10;}
  if(!input.flying&&wasFlying)landAge=0;
  wasFlying=input.flying;
  if(input.flying)flightAge+=dt;else landAge+=dt;
  const approach=input.flying&&input.verticalSpeed<-.05?ease((2-input.altitude)/2):0;
  stage=input.flying?(approach>.08?'landing':flightAge<1.15?'takeoff':'flight'):(landAge<.6?'touchdown':'ground');
  const targetOpen=input.flying?ease(flightAge/.42):0;
  open+=(targetOpen-open)*(1-Math.exp(-dt*(input.flying?10:4.2)));
  beat=(beat+dt*(input.flying?1.05+clamp(input.speedMps/10)*.5:.45))%1;
  applyCore(input.flying?'stand':requested);core.setTurn(turn);core.update(dt);
  // A paused zero-dt refresh must not add another fold or air pose to the
  // previous pose: the shared core only restores its bones on positive steps.
  if(dt===0&&basePose)for(let i=0;i<bones.length;i++){bones[i].position.copy(basePose[i].p);bones[i].quaternion.copy(basePose[i].q);}
  basePose=bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()}));
  // Folding follows the three actual source wing finger branches. Rotate the
  // shoulder backward, return the elbow, then gather the distal fingers so the
  // real membrane folds along the flank rather than vanishing or being swapped.
  const folded=1-open,shoulderFold=1-ease(open/.40),fingerFold=1-ease((open-.25)/.75),phase=beat*TAU;
  const fold=profile.dragonRig.fold||{shoulder:1.38,elbow:2.10,wrist:.88,webScale:1};
  const lowClearance=clamp(input.altitude/2.5);
  const stroke=input.flying?(.20+Math.sin(phase)*(.18+.38*lowClearance))*(1-approach*.45)*open:.015*Math.sin(requested==='stand'?time*TAU/8:core.state.phase01*TAU);
  for(const side of ['L','R']){
   const sign=side==='L'?1:-1,w=wings[side];
   // The thin membrane's chord gathers between its retained finger branches.
   // This closes the real web along the flank while preserving its skin/UVs;
   // at full extension every source wing axis returns to unit scale.
   named(w.root).scale.set(1,1,1-folded*(1-fold.webScale));
   add(w.root,axisY,sign*shoulderFold*fold.shoulder);
   add(w.root,axisZ,sign*(stroke+fingerFold*(fold.shoulderRoll??-.025)));
   add(w.root,axisX,fingerFold*(fold.shoulderPitch||0));
   for(let n=0;n<w.branches.length;n++){
    const branch=w.branches[n],spread=n===0?1:n===1?.82:.42;
    if(branch[1]){add(branch[1],axisY,-sign*fingerFold*fold.elbow*spread);add(branch[1],axisZ,sign*fingerFold*(fold.elbowRoll||0)*spread);add(branch[1],axisX,fingerFold*(fold.elbowPitch||0)*spread);}
    if(branch[2]){add(branch[2],axisY,sign*fingerFold*fold.wrist*spread);add(branch[2],axisZ,sign*fingerFold*(fold.wristRoll||0)*spread);add(branch[2],axisX,fingerFold*(fold.wristPitch||0)*spread);}
    if(branch[3])add(branch[3],axisY,-sign*folded*.16);
    // Elbow flexion trails the recovery stroke. The main and secondary fingers
    // retain their different lags, which keeps the membrane's actual skin alive.
    if(input.flying&&branch[1])add(branch[1],axisZ,sign*.075*Math.sin(phase-.35-n*.16)*(1-approach*.4)*open);
    if(input.flying&&branch[2])add(branch[2],axisZ,sign*.055*Math.sin(phase-.7-n*.16)*open);
   }
  }
  if(input.flying){
   const launch=1-ease((flightAge-.10)/1.1),land=approach,airBlend=ease(input.altitude/.55);
   const flutter=Math.sin(phase)*.09*(1-land)*(1-launch);
   for(const side of ['L','R']){
    const fore=side==='L'?'FL':'FR',hind=side==='L'?'HL':'HR';
    add(fore+'.upperarm',axisX,(.72+.32*launch-.90*land+flutter)*airBlend);
    add(fore+'.forearm',axisX,(-1.0-.28*launch+.98*land)*airBlend);
    add(fore+'.cannon',axisX,.18*(1-land)*airBlend);
    add(hind+'.thigh',axisX,(-.72-.36*launch+.60*land-flutter)*airBlend);
    add(hind+'.shin',axisX,(.98-.22*launch-.80*land)*airBlend);
    add(hind+'.cannon',axisX,-.30*(1-land)*airBlend);
   }
   add('ROOT',axisX,(-.06*launch+clamp(input.verticalSpeed,-3,3)*.025)*airBlend);
   add('neck.lower',axisX,-.025+.04*land);add('head',axisX,.015*Math.sin(time*.8));
  }else if(landAge<.6){
   const settle=Math.sin(Math.PI*clamp(landAge/.6));
   // Keep the solver's planted claws on the ground while the neck settles.
   // Moving the root after IK would push every foot through the floor.
   add('neck.lower',axisX,.035*settle);
  }
  root.updateMatrixWorld(true);skin.skeleton.update();keepAppendagesAboveGround();
  currentState={...core.state,grounded:!input.flying&&core.state.grounded,flightStage:stage,wingOpen:open,wingBeat:beat,
   speedMps:input.flying?input.speedMps:core.state.speedMps};
 }
 function reset(){
  for(const side of ['L','R'])named(wings[side].root).scale.set(1,1,1);basePose=null;
  core.reset();core.set('stand');appliedGait='stand';appliedLead='left';appliedSpeed=undefined;requested='stand';lead='left';rest=false;time=0;flightAge=0;landAge=10;open=0;beat=0;wasFlying=false;
  input={flying:false,altitude:0,verticalSpeed:0,speedMps:0};stage='ground';update(0);
 }
 function snapshot(){
  const s=core.snapshot(),inverse=new THREE.Matrix4().copy(root.matrixWorld).invert();
  return {...s,flightStage:stage,wingOpen:open,wingBeat:beat,grounded:!input.flying&&core.state.grounded,
   wingTips:Object.fromEntries(['L','R'].map(side=>{const branch=wings[side].branches[0],bone=named(branch.at(-1));return[side,bone.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse).toArray()];})),
   localPositions:bones.map(b=>b.position.toArray()),localQuaternions:bones.map(b=>b.quaternion.toArray())};
 }
 reset();
 return {set,setFlight,reset,snapshot,update,gaits:core.gaits,size:core.size,
  setTurn(v){turn=clamp(v,-1,1);},get mode(){return rest?'rest':input.flying?stage:core.mode;},get state(){return currentState;}};
}
