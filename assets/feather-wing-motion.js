import {createArtistMotion} from './artist-horse-motion.js';
/* Articulates the approved CGCookie wing body's source anatomy and its real
 * long feathers. Mount the paired scene at the horse's chest-bound withers. */
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
const TAU=Math.PI*2;
export function createFeatherWingMotion({THREE,root,profile}){
 const rig=profile?.featherWingRig;if(!rig?.chains?.L||!rig?.chains?.R)throw new Error('Articulated source feather wing profile required');
 const bones=[];root.traverse(o=>{if(o.isBone)bones.push(o);});
 const clean=n=>n.replace(/[.\s]/g,''),by=Object.fromEntries(bones.map(b=>[clean(b.name),b])),named=n=>by[clean(n)];
 for(const side of ['L','R'])for(const name of [...rig.chains[side],...rig.feathers[side].map(f=>f.name)])if(!named(name))throw new Error('Missing source feather joint '+name);
 const featherAxis=new THREE.Vector3(),desiredFeather=new THREE.Vector3(),parentRotation=new THREE.Quaternion(),wingWorldRotation=new THREE.Quaternion(),aimFeather=new THREE.Quaternion(),identityFeather=new THREE.Quaternion();
 const rest=bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}));
 const axisX=new THREE.Vector3(1,0,0),axisY=new THREE.Vector3(0,1,0),axisZ=new THREE.Vector3(0,0,1),rotation=new THREE.Quaternion();
 const add=(name,axis,angle)=>named(name).quaternion.multiply(rotation.setFromAxisAngle(axis,angle));
 let time=0,flightAge=0,landAge=10,wasFlying=false,open=0,beat=0,stage='ground',restMode=false;
 let input={flying:false,altitude:0,verticalSpeed:0,speedMps:0};
 function setFlight(s={}){input={flying:!!s.flying,altitude:Math.max(0,Number(s.altitude)||0),verticalSpeed:Number(s.verticalSpeed)||0,speedMps:Math.max(0,Number(s.speedMps)||0)};}
 function update(dt){
  dt=clamp(dt,0,.25);time+=dt;
  for(let i=0;i<bones.length;i++){bones[i].position.copy(rest[i].p);bones[i].quaternion.copy(rest[i].q);bones[i].scale.copy(rest[i].s);}
  if(restMode){stage='rest';root.updateMatrixWorld(true);return;}
  if(input.flying&&!wasFlying){flightAge=0;landAge=10;}if(!input.flying&&wasFlying)landAge=0;wasFlying=input.flying;
  if(input.flying)flightAge+=dt;else landAge+=dt;
  const approach=input.flying&&input.verticalSpeed<-.05?ease((2-input.altitude)/2):0;
  stage=input.flying?(approach>.08?'landing':flightAge<1.15?'takeoff':'flight'):(landAge<.6?'touchdown':'ground');
  const target=input.flying?ease(flightAge/.45):0;open+=(target-open)*(1-Math.exp(-dt*(input.flying?10:4.2)));
  beat=(beat+dt*(input.flying?1.1+clamp(input.speedMps/10)*.35:.45))%1;
  const shoulderFold=1-ease(open/.4),fingerFold=1-ease((open-.25)/.75),folded=1-open;
  const fold=rig.fold,phase=beat*TAU,clearance=clamp(input.altitude/2.5);
  const stroke=input.flying?(.18+Math.sin(phase)*(.16+.32*clearance))*(1-approach*.4)*open:.008*Math.sin(time*.9);
  for(const side of ['L','R']){
   const sign=side==='L'?1:-1,[shoulder,elbow,wrist,tip]=rig.chains[side];
   add(shoulder,axisY,sign*shoulderFold*fold.shoulder);add(shoulder,axisZ,sign*(stroke+fingerFold*(fold.shoulderRoll||0)));add(shoulder,axisX,fingerFold*(fold.shoulderPitch||0));
   add(elbow,axisY,-sign*fingerFold*fold.elbow);add(elbow,axisZ,sign*fingerFold*(fold.elbowRoll||0));add(elbow,axisX,fingerFold*(fold.elbowPitch||0));
   add(wrist,axisY,sign*fingerFold*fold.wrist);add(wrist,axisZ,sign*fingerFold*(fold.wristRoll||0));add(wrist,axisX,fingerFold*(fold.wristPitch||0));
   add(tip,axisY,-sign*fingerFold*(fold.tip||.1));
   if(input.flying){add(elbow,axisZ,sign*.08*Math.sin(phase-.38)*open);add(wrist,axisZ,sign*.05*Math.sin(phase-.72)*open);}
   root.updateMatrixWorld(true);root.getWorldQuaternion(wingWorldRotation);
   for(const feather of rig.feathers[side]){
    const bone=named(feather.name);bone.parent.getWorldQuaternion(parentRotation).invert();
    featherAxis.fromArray(feather.fanAxis);desiredFeather.set(sign*.025,-.12,-1).normalize().applyQuaternion(wingWorldRotation).applyQuaternion(parentRotation);
    aimFeather.setFromUnitVectors(featherAxis,desiredFeather).slerp(identityFeather,open);bone.quaternion.copy(aimFeather);
    const f=feather.index/47;
    // Small individual recovery/fan lags keep each real feather rigid while
    // opening space between the source feather tips during the stroke.
    add(feather.name,axisY,sign*(f-.5)*(.025*folded+.065*open));
    add(feather.name,axisX,.018*Math.sin(phase-.8-f*.35)*open);
   }
  }
  root.updateMatrixWorld(true);root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
 }
 function reset(){time=0;flightAge=0;landAge=10;wasFlying=false;open=0;beat=0;stage='ground';restMode=false;input={flying:false,altitude:0,verticalSpeed:0,speedMps:0};update(0);}
 function snapshot(){return{time,flightStage:stage,wingOpen:restMode?1:open,wingBeat:beat,grounded:!input.flying,localPositions:bones.map(b=>b.position.toArray()),localQuaternions:bones.map(b=>b.quaternion.toArray()),localScales:bones.map(b=>b.scale.toArray())};}
 reset();return {setFlight,update,reset,snapshot,setRest(value=true){restMode=!!value;update(0);},get state(){return {flightStage:stage,wingOpen:restMode?1:open,wingBeat:beat,grounded:!input.flying};}};
}


// The source horse keeps the shared ground solver; flight poses use the same
// named anatomy and do not scale or replace its body, tack or authored groom.
export function createFeatheredHorseMotion({THREE,root,skin,heightM,profile}){
 const core=createArtistMotion({THREE,root,skin,heightM});
 const bones=skin.skeleton.bones,clean=n=>n.replace(/[.\s]/g,''),by=Object.fromEntries(bones.map(b=>[clean(b.name),b]));
 const axisX=new THREE.Vector3(1,0,0),rotation=new THREE.Quaternion();
 const add=(name,angle)=>{const b=by[clean(name)];if(!b)throw new Error('Missing feathered host anatomy '+name);b.quaternion.multiply(rotation.setFromAxisAngle(axisX,angle));};
 let requested='stand',lead='left',speed,restMode=false,time=0,flightAge=0,landAge=10,beat=0,turn=0,wasFlying=false,stage='ground',basePose=null;
 let input={flying:false,altitude:0,verticalSpeed:0,speedMps:0},appliedGait='stand',appliedLead='left',appliedSpeed;
 let currentState=core.state;
 function applyCore(gait){if(gait===appliedGait&&lead===appliedLead&&speed===appliedSpeed)return;core.set(gait,{lead,speed});appliedGait=gait;appliedLead=lead;appliedSpeed=speed;}
 function set(gait,options={}){requested=gait;lead=options.lead||lead;speed=options.speed;restMode=gait==='rest';if(restMode)basePose=null;if(!input.flying)applyCore(gait);}
 function setFlight(s={}){input={flying:!!s.flying,altitude:Math.max(0,Number(s.altitude)||0),verticalSpeed:Number(s.verticalSpeed)||0,speedMps:Math.max(0,Number(s.speedMps)||0)};}
 function update(dt){
  dt=clamp(dt,0,.25);time+=dt;
  if(restMode){applyCore('rest');stage='rest';currentState={...core.state,flightStage:stage};return;}
  if(input.flying&&!wasFlying){flightAge=0;landAge=10;}if(!input.flying&&wasFlying)landAge=0;wasFlying=input.flying;
  if(input.flying)flightAge+=dt;else landAge+=dt;
  const approach=input.flying&&input.verticalSpeed<-.05?ease((2-input.altitude)/2):0;
  stage=input.flying?(approach>.08?'landing':flightAge<1.15?'takeoff':'flight'):(landAge<.6?'touchdown':'ground');
  beat=(beat+dt*(input.flying?1.1+clamp(input.speedMps/10)*.35:.45))%1;
  applyCore(input.flying?'stand':requested);core.setTurn(turn);core.update(dt);
  if(dt===0&&basePose)for(let i=0;i<bones.length;i++){bones[i].position.copy(basePose[i].p);bones[i].quaternion.copy(basePose[i].q);}
  basePose=bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()}));
  if(input.flying){
   const launch=1-ease((flightAge-.1)/1.1),air=ease(input.altitude/.55),land=approach,flutter=Math.sin(beat*TAU)*.05*(1-land)*(1-launch);
   for(const [fore,hind]of [['FL','HL'],['FR','HR']]){
    add(fore+'.upperarm',(.68+.20*launch-.75*land+flutter)*air);
    add(fore+'.forearm',(-2.00-.12*launch+1.95*land)*air);add(fore+'.cannon',.14*(1-land)*air);
    add(hind+'.thigh',(-.96-.18*launch+.86*land-flutter)*air);
    add(hind+'.shin',(1.72-.10*launch-1.62*land)*air);add(hind+'.cannon',-.22*(1-land)*air);
   }
   add('ROOT',(-.04*launch+clamp(input.verticalSpeed,-3,3)*.025)*air);add('neck.lower',-.02+.04*land);add('head',.012*Math.sin(time*.8));
  }else if(landAge<.6)add('neck.lower',.025*Math.sin(Math.PI*clamp(landAge/.6)));
  root.updateMatrixWorld(true);skin.skeleton.update();currentState={...core.state,grounded:!input.flying&&core.state.grounded,flightStage:stage,wingBeat:beat,speedMps:input.flying?input.speedMps:core.state.speedMps};
 }
 function reset(){basePose=null;core.reset();core.set('stand');requested='stand';lead='left';speed=undefined;appliedGait='stand';appliedLead='left';appliedSpeed=undefined;restMode=false;time=0;flightAge=0;landAge=10;beat=0;wasFlying=false;stage='ground';input={flying:false,altitude:0,verticalSpeed:0,speedMps:0};update(0);}
 function snapshot(){return{...core.snapshot(),flightStage:stage,grounded:!input.flying&&core.state.grounded,localPositions:bones.map(b=>b.position.toArray()),localQuaternions:bones.map(b=>b.quaternion.toArray())};}
 reset();return{set,setFlight,update,reset,snapshot,gaits:core.gaits,size:core.size,setTurn(v){turn=clamp(v,-1,1);},get mode(){return restMode?'rest':input.flying?stage:core.mode;},get state(){return currentState;}};
}
