/* Artist-authored breed motion. Name-based joint lookup; the solver uses a
 * +X-forward working frame and converts back to the asset's +Z-forward frame.
 * Meshes, inverse bind matrices, bone lengths and all authored materials stay intact. */
export const ARTIST_GAITS={
  stand:{hz:0,speed:0,duty:1,lift:0,drop:0,bob:0},
  walk:{hz:1.02,speed:1.25,duty:.64,lift:.065,drop:.035,bob:.005},
  trot:{hz:1.55,speed:3.25,duty:.42,lift:.18,drop:.060,bob:.021},
  canter:{hz:1.76,speed:4.70,duty:.36,lift:.22,drop:.070,bob:.032},
  gallop:{hz:2.12,speed:7.35,duty:.27,lift:.27,drop:.079,bob:.045},
  jump:{hz:0,speed:0,duty:1,lift:0,drop:0,bob:0}
};
const ORDER=[
 {id:'LF',prefix:'FL',chain:['scapula','upperarm','forearm','cannon','pastern','hoof'],front:true},
 {id:'RF',prefix:'FR',chain:['scapula','upperarm','forearm','cannon','pastern','hoof'],front:true},
 {id:'LH',prefix:'HL',chain:['thigh','shin','cannon','pastern','hoof'],front:false},
 {id:'RH',prefix:'HR',chain:['thigh','shin','cannon','pastern','hoof'],front:false}
];
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),wrap=x=>x-Math.floor(x),TAU=Math.PI*2;
const ease=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};

export function createArtistMotion({THREE,root,skin,heightM=null}){
  if(!skin?.isSkinnedMesh)return null;
  const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion(),bones=skin.skeleton.bones,n=bones.length;
  const jointName=name=>name.replace(/[.\s]/g,'');
  const idsByName=Object.fromEntries(bones.map((b,i)=>[jointName(b.name),i]));
  for(const spec of ORDER)for(const suffix of spec.chain)if(idsByName[spec.prefix+suffix]===undefined)throw new Error('Missing artist joint '+spec.prefix+'.'+suffix);
  const basis=Q().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2),unbasis=basis.clone().invert();
  const originalP=bones.map(b=>b.position.clone()),originalQ=bones.map(b=>b.quaternion.clone());
  const restP=[],restQ=[],localP=[],localQ=[],p=Array.from({length:n},V),q=Array.from({length:n},Q),parents=bones.map(b=>bones.indexOf(b.parent));
  const axisZ=new THREE.Vector3(0,0,1),axisX=new THREE.Vector3(1,0,0),axisY=new THREE.Vector3(0,1,0);
  const temp=V(),temp2=V(),temp3=V(),delta=Q(),inverse=Q(),worldToRoot=new THREE.Matrix4();
  root.updateWorldMatrix(true,true);worldToRoot.copy(root.matrixWorld).invert();worldToRoot.premultiply(new THREE.Matrix4().makeRotationFromQuaternion(basis));const rootQ=basis.clone().multiply(root.getWorldQuaternion(Q()).invert());
  for(const b of bones){restP.push(b.getWorldPosition(V()).applyMatrix4(worldToRoot));restQ.push(rootQ.clone().multiply(b.getWorldQuaternion(Q())));}
  for(let i=0;i<n;i++){const parent=parents[i];inverse.copy(parent<0?Q():restQ[parent]).invert();localP.push(restP[i].clone().sub(parent<0?V():restP[parent]).applyQuaternion(inverse));localQ.push(inverse.clone().multiply(restQ[i]));}
  const geometry=skin.geometry,pos=geometry.attributes.position,si=geometry.attributes.skinIndex,sw=geometry.attributes.skinWeight;
  const rawToRoot=new THREE.Matrix4().multiplyMatrices(worldToRoot,skin.matrixWorld);let groundY=Infinity,topY=-Infinity;
  for(let i=0;i<pos.count;i++){temp.fromBufferAttribute(pos,i).applyMatrix4(rawToRoot);groundY=Math.min(groundY,temp.y);topY=Math.max(topY,temp.y);}
  const metres=heightM ? heightM/(topY-groundY) : 1;
  const size=clamp((topY-groundY)/2.2,.42,1.4);
  const gaits=Object.fromEntries(Object.entries(ARTIST_GAITS).map(([key,g])=>[key,{...g,speed:g.speed*size,lift:g.lift*size,drop:g.drop*size,bob:g.bob*size}]));
  const legs=ORDER.map(spec=>{
    const ids=spec.chain.map(name=>idsByName[spec.prefix+name]),terminal=ids.at(-1),fetlock=ids.at(-2),candidate=[];let low=Infinity;
    for(let i=0;i<pos.count;i++){
      temp.fromBufferAttribute(pos,i).applyMatrix4(rawToRoot);if(temp.y>restP[terminal].y+.01||Math.hypot(temp.x-restP[terminal].x,temp.z-restP[terminal].z)>.15)continue;
      let ownership=0;for(let j=0;j<4;j++)if(ids.includes(si.getComponent(i,j)))ownership+=sw.getComponent(i,j);
      if(ownership<.75)continue;low=Math.min(low,temp.y);candidate.push({index:i,point:temp.clone()});
    }
    const bottom=candidate.filter(v=>v.point.y<low+.009);if(!bottom.length)throw new Error('No sole landmarks for '+spec.id);
    const center=bottom.reduce((v,c)=>v.add(c.point),V()).multiplyScalar(1/bottom.length);center.y=low;
    const soleVertex=bottom.reduce((a,b)=>a.point.distanceToSquared(center)<b.point.distanceToSquared(center)?a:b).index,samples=[soleVertex];
    for(const direction of [new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1),new THREE.Vector3(0,-1,0)]){const v=bottom.reduce((a,b)=>a.point.dot(direction)>b.point.dot(direction)?a:b);if(!samples.includes(v.index))samples.push(v.index);}
    const restSole=V().fromBufferAttribute(pos,soleVertex).applyMatrix4(rawToRoot);
    return {...spec,ids,terminal,fetlock,restSole,soleVertex,samples,soleOffset:restSole.clone().sub(restP[terminal]),pastern:restP[terminal].clone().sub(restP[fetlock]),target:V(),oldTarget:V(),nextTarget:V(),foot:V(),ankle:V(),hinge:V(),middle:V(),contact:true,pitch:0,reachError:0};
  });
  let restMode=false;
  let current={gait:'stand',phase:0,age:0,lead:'left',speed:0},previous=null,transitionAge=1;
  let time=0,distanceRaw=0,speedMps=0,bodyY=0,bodyPitch=0,phase01=0,grounded=true,turn=0;
  const fadeDuration=.32,bodyScratch={y:0,pitch:0,speed:0,phase:0,grounded:true};
  const params=state=>gaits[state.gait]||gaits.stand;
  function strikes(state){
    const left=state.lead!=='right';
    if(state.gait==='walk')return [.75,.25,.5,0];if(state.gait==='trot')return [0,.5,.5,0];
    if(state.gait==='canter')return left?[.54,.27,.27,0]:[.27,.54,0,.27];
    if(state.gait==='gallop')return left?[.61,.43,.14,0]:[.43,.61,0,.14];return [0,0,0,0];
  }
  function sampleBody(state,out){
    const g=params(state),ph=state.phase*TAU;out.phase=state.phase;out.speed=state.speed;out.grounded=true;
    if(state.gait==='jump'){
      const a=state.age,u=clamp((a-.38)/.78),air=a>=.38&&a<=1.16;
      out.y=(a<.38?-.065*Math.sin(Math.PI*clamp(a/.38))**2:0)+(a>1.16?-.043*Math.sin(Math.PI*clamp((a-1.16)/.34))**2:0)+(air?4*.55*u*(1-u):0);
      out.y*=size;out.pitch=air?.13*Math.cos(Math.PI*u):a<.38?.13*ease(a/.38):-.13*(1-ease((a-1.16)/.36));out.grounded=!air;return;
    }
    if(state.gait==='stand'){out.y=size*.0015*Math.sin(time*TAU/4);out.pitch=.0012*Math.sin(time*TAU/8);return;}
    out.y=-g.drop+g.bob*Math.cos(ph*(state.gait==='trot'||state.gait==='walk'?2:1)+.3);
    out.pitch=(state.gait==='walk'?.005:state.gait==='trot'?.007:.025)*Math.sin(ph+.2);
  }
  function targetFor(state,leg,index,out){
    const g=params(state);out.copy(leg.restSole);out.y=groundY;
    if(state.gait==='stand')return {pitch:0,contact:true};
    if(state.gait==='jump'){
      const a=state.age,fore=leg.front,start=fore?.22:.38,end=fore?1.12:1.21,air=a>start&&a<end,u=clamp((a-start)/(end-start)),tuck=Math.sin(Math.PI*u)**2,flight=clamp((a-.38)/.78);
      out.y+=((a>=.38&&a<=1.16?4*.55*flight*(1-flight):0)+(fore?.31:.23)*tuck)*ease((end-a)/.13)*size;out.x+=(fore?.16:-.07)*tuck*size;if(!air)out.y=groundY;
      return {pitch:(fore?-.75:-.43)*tuck,contact:!air};
    }
    // The source's resting hind feet are staggered. Moving strides are centred
    // under the limb roots, rather than preserving that one static pose offset.
    out.x=leg.restSole.x;
    const phase=wrap(state.phase-strikes(state)[index]),duty=g.duty,stance=phase<duty,stride=state.speed/metres/g.hz,span=stride*duty;let pitch=0;
    if(stance)out.x+=span*(.5-phase/duty);
    else{const u=(phase-duty)/(1-duty),s=ease(u),derivative=-stride*(1-duty),arc=Math.sin(Math.PI*u)**(state.gait==='walk'?2.2:1.7),tangent=u*(1+16*u)*(1-u)**16-(1-u)*(1+16*(1-u))*u**16;out.x+=-span*.5+span*s+derivative*tangent;out.y+=(leg.front?1:.84)*g.lift*arc;out.z+=(index===0||index===2?1:-1)*.012*arc*size;pitch=-(leg.front?.56:.38)*arc;}
    return {pitch,contact:stance};
  }
  function fk(){
    const ph=phase01*TAU,intensity=clamp(speedMps/5),air=current.gait==='jump'?ease((current.age-.30)/.16)*(1-ease((current.age-1.10)/.18)):0,secondary=current.gait==='stand'?time*TAU/8:ph;
    for(let i=0;i<n;i++){
      const parent=parents[i];if(parent<0){p[i].copy(localP[i]);p[i].y+=bodyY;q[i].copy(localQ[i]);}else{p[i].copy(localP[i]).applyQuaternion(q[parent]).add(p[parent]);q[i].copy(q[parent]).multiply(localQ[i]);}
      const name=jointName(bones[i].name);let pitch=0;if(name==='ROOT')pitch=bodyPitch;if(name==='spine')pitch=-bodyPitch*.25;if(name==='necklower')pitch=(.006+.016*intensity)*Math.sin(ph+.55)+air*.035;if(name==='neckupper')pitch=-.007*Math.sin(ph+.9)+.008*Math.sin(secondary);if(name==='head')pitch=.003*Math.sin(secondary*2);
      if(pitch)q[i].premultiply(delta.setFromAxisAngle(axisZ,pitch));if(name==='head')q[i].premultiply(delta.setFromAxisAngle(axisY,.009*Math.sin(secondary)));
      if(name.startsWith('tail')){const lag=(Number(name.slice(-1))-1)*.44;q[i].premultiply(delta.setFromAxisAngle(axisX,.025*Math.sin(secondary*2-lag)+.013*intensity*Math.sin(ph-lag)+turn*.022));}
      if(name.startsWith('ear'))q[i].premultiply(delta.setFromAxisAngle(axisY,.025*Math.sin(time*1.7+(name==='earL'?0:2))));
    }
  }
  function hinge(a,b,l1,l2,pole,out){
    temp.copy(b).sub(a);const distance=Math.max(1e-7,temp.length()),d=clamp(distance,Math.abs(l1-l2)+1e-5,l1+l2-1e-5);temp.multiplyScalar(1/distance);
    const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));temp2.set(-temp.y,temp.x,0).normalize().multiplyScalar(pole);out.copy(a).addScaledVector(temp,along).addScaledVector(temp2,height);return Math.max(0,distance-l1-l2);
  }
  function orient(id,child,a,b){temp.copy(restP[child]).sub(restP[id]).normalize();temp2.copy(b).sub(a).normalize();q[id].copy(restQ[id]).premultiply(delta.setFromUnitVectors(temp,temp2));p[id].copy(a);}
  function footTargets(leg){const rotation=delta.setFromAxisAngle(axisZ,leg.pitch);leg.foot.copy(leg.soleOffset).applyQuaternion(rotation).negate().add(leg.target);leg.ankle.copy(leg.pastern).applyQuaternion(rotation).negate().add(leg.foot);}
  function upperReach(leg){const length=restP[leg.ids[0]].distanceTo(restP[leg.ids[2]]),swing=Math.max(0,leg.target.y-groundY-Math.max(0,bodyY));return leg.front?length:length-Math.min(.045,swing*.14);}
  function placeFrontElbow(leg){
    const ids=leg.ids,shoulder=p[ids[1]],elbow=p[ids[2]];
    // The shoulder swings the real upper arm; the elbow remains a separate
    // anatomical joint. Carpal flexion happens below it, at the knee.
    const swing=clamp((leg.target.x-leg.restSole.x)*.95/size,-.42,.42);
    elbow.sub(shoulder).applyQuaternion(delta.setFromAxisAngle(axisZ,swing)).add(shoulder);
  }
  function solveLeg(leg){
    const ids=leg.ids;footTargets(leg);
    if(leg.front){
      const elbow=p[ids[2]],carpus=ids[3];
      leg.reachError=hinge(elbow,leg.ankle,restP[ids[2]].distanceTo(restP[carpus]),restP[carpus].distanceTo(restP[leg.fetlock]),1,leg.hinge);
      p[carpus].copy(leg.hinge);p[leg.fetlock].copy(leg.ankle);p[leg.terminal].copy(leg.foot);
      for(let j=0;j<ids.length-1;j++)orient(ids[j],ids[j+1],p[ids[j]],p[ids[j+1]]);
      q[leg.terminal].copy(restQ[leg.terminal]).premultiply(delta.setFromAxisAngle(axisZ,leg.pitch));return;
    }
    const rootPoint=p[ids[0]],hingeId=ids[2],upper=restP[ids[0]].distanceTo(restP[hingeId]),lower=restP[hingeId].distanceTo(restP[leg.fetlock]);
    const effective=upperReach(leg);
    leg.reachError=hinge(rootPoint,leg.ankle,effective,lower,leg.front?1:-1,leg.hinge);
    if(leg.front){const ratio=restP[ids[0]].distanceTo(restP[ids[1]])/(restP[ids[0]].distanceTo(restP[ids[1]])+restP[ids[1]].distanceTo(restP[ids[2]]));leg.middle.copy(rootPoint).lerp(leg.hinge,ratio);p[ids[1]].copy(leg.middle);const r2=restP[ids[2]].distanceTo(restP[ids[3]])/(restP[ids[2]].distanceTo(restP[ids[3]])+restP[ids[3]].distanceTo(restP[ids[4]]));p[ids[3]].copy(leg.hinge).lerp(leg.ankle,r2);}
    else{hinge(rootPoint,leg.hinge,restP[ids[0]].distanceTo(restP[ids[1]]),restP[ids[1]].distanceTo(restP[ids[2]]),1,leg.middle);p[ids[1]].copy(leg.middle);}
    p[hingeId].copy(leg.hinge);p[leg.fetlock].copy(leg.ankle);p[leg.terminal].copy(leg.foot);for(let j=0;j<ids.length-1;j++)orient(ids[j],ids[j+1],p[ids[j]],p[ids[j+1]]);q[leg.terminal].copy(restQ[leg.terminal]).premultiply(delta.setFromAxisAngle(axisZ,leg.pitch));
  }
  function apply(){
    for(let i=0;i<n;i++){const parent=parents[i];if(parent<0){bones[i].position.copy(p[i]).applyQuaternion(unbasis);bones[i].quaternion.copy(unbasis).multiply(q[i]);}else{inverse.copy(q[parent]).invert();bones[i].position.copy(p[i]).sub(p[parent]).applyQuaternion(inverse);bones[i].quaternion.copy(inverse).multiply(q[i]).normalize();}}
    root.updateMatrixWorld(true);skin.skeleton.update();
  }
  function step(dt){
    time+=dt;current.age+=dt;current.phase=wrap(current.phase+dt*params(current).hz);if(previous&&!previous.hold){previous.age+=dt;previous.phase=wrap(previous.phase+dt*params(previous).hz);}transitionAge+=dt;const blend=ease(transitionAge/fadeDuration);
    sampleBody(current,bodyScratch);bodyY=bodyScratch.y;bodyPitch=bodyScratch.pitch;speedMps=bodyScratch.speed;phase01=current.phase;grounded=bodyScratch.grounded;
    if(previous){const by=bodyY,bp=bodyPitch,sp=speedMps;if(previous.hold){bodyY=previous.y;bodyPitch=previous.pitch;speedMps=previous.speed;}else{sampleBody(previous,bodyScratch);bodyY=bodyScratch.y;bodyPitch=bodyScratch.pitch;speedMps=bodyScratch.speed;}bodyY+=(by-bodyY)*blend;bodyPitch+=(bp-bodyPitch)*blend;speedMps+=(sp-speedMps)*blend;}
    distanceRaw+=speedMps/metres*dt;
    for(let i=0;i<legs.length;i++){
      const leg=legs[i],next=targetFor(current,leg,i,leg.nextTarget);leg.pitch=next.pitch;leg.contact=next.contact;
      if(previous){const old=previous.hold?previous.targets[i]:targetFor(previous,leg,i,leg.oldTarget);leg.target.copy(previous.hold?old.target:leg.oldTarget).lerp(leg.nextTarget,blend);leg.pitch=old.pitch+(next.pitch-old.pitch)*blend;leg.contact=next.contact&&old.contact;}else leg.target.copy(leg.nextTarget);
      const rotation=delta.setFromAxisAngle(axisZ,leg.pitch);let minimum=0;for(const index of leg.samples){temp.fromBufferAttribute(pos,index).applyMatrix4(rawToRoot).sub(leg.restSole).applyQuaternion(rotation);minimum=Math.min(minimum,temp.y);}leg.target.y=Math.max(leg.target.y,groundY-minimum);
    }
    grounded=legs.some(leg=>leg.contact);
    fk();for(const leg of legs)if(leg.front)placeFrontElbow(leg);let supportDrop=0;
    // Retain a slight joint bend instead of passing through the straight-leg
    // singularity, where small hoof movement otherwise snaps the knee/hock.
    for(const leg of legs){footTargets(leg);const ids=leg.ids,hip=p[ids[leg.front?2:0]],reach=leg.front?restP[ids[2]].distanceTo(restP[ids[3]])+restP[ids[3]].distanceTo(restP[leg.fetlock])-.006*size:upperReach(leg)+restP[ids[2]].distanceTo(restP[leg.fetlock])-.014*size,horizontal=(hip.x-leg.ankle.x)**2+(hip.z-leg.ankle.z)**2;const allowed=Math.sqrt(Math.max(.001,reach*reach-horizontal));supportDrop=Math.max(supportDrop,hip.y-leg.ankle.y-allowed);}
    if(supportDrop>0){bodyY-=supportDrop;fk();for(const leg of legs)if(leg.front)placeFrontElbow(leg);}
    for(const leg of legs)solveLeg(leg);apply();if(previous&&blend>=1)previous=null;if(current.gait==='jump'&&current.age>1.72)set('stand');
  }
  function set(gait,{lead=current.lead,speed}={}){
    if(gait==='rest'){restMode=true;for(let i=0;i<n;i++){bones[i].position.copy(originalP[i]);bones[i].quaternion.copy(originalQ[i]);}root.updateMatrixWorld(true);skin.skeleton.update();return;}restMode=false;
    if(!ARTIST_GAITS[gait])gait='stand';lead=lead==='right'?'right':'left';const requestedSpeed=gait==='jump'?0:Math.max(0,Math.min((gaits[gait].speed||0)*1.15,speed??gaits[gait].speed));
    if(current.gait===gait&&current.lead===lead&&Math.abs(current.speed-requestedSpeed)<1e-7&&gait!=='jump')return;
    /* Carry the LEFT FORE across the change: shift the new gait's phase so that foot is at the
       same point of its own cycle it was a moment ago. The other three still re-phase to the
       new pattern, but one leg stays planted through the crossfade instead of none. */
    const carried=wrap(current.phase-strikes(current)[0]+strikes({gait,lead})[0]);
    previous=previous?{hold:true,targets:legs.map(l=>({target:l.target.clone(),pitch:l.pitch,contact:l.contact})),y:bodyY,pitch:bodyPitch,speed:speedMps}:{...current};current={gait,lead,phase:carried,age:0,speed:requestedSpeed};transitionAge=0;
  }
  function reset(){current={gait:'stand',lead:'left',phase:0,age:0,speed:0};previous=null;transitionAge=1;time=0;distanceRaw=0;speedMps=0;bodyY=0;bodyPitch=0;phase01=0;grounded=true;step(0);}
  function actualPoint(index,out){out.fromBufferAttribute(pos,index);skin.applyBoneTransform(index,out);out.applyMatrix4(rawToRoot);out.y-=groundY;out.multiplyScalar(metres);return out;}
  function snapshot(){return {gait:current.gait,requestedGait:current.gait,lead:current.lead,phase01,cycleHz:params(current).hz,speedMps,distanceM:distanceRaw*metres,transitioning:!!previous,grounded,time,age:current.age,metresPerUnit:metres,
    feet:legs.map(leg=>{const sole=actualPoint(leg.soleVertex,V()),target=leg.target.clone();target.y-=groundY;target.multiplyScalar(metres);let minimum=Infinity;for(const index of leg.samples)minimum=Math.min(minimum,actualPoint(index,temp3).y);return{id:leg.id,contact:leg.contact,sole:sole.clone().applyQuaternion(unbasis).toArray(),worldSole:new THREE.Vector3(sole.x+distanceRaw*metres,sole.y,sole.z).applyQuaternion(unbasis).toArray(),targetSole:target.applyQuaternion(unbasis).toArray(),soleMinY:minimum,reachError:leg.reachError*metres};}),
    bonePositions:p.map(v=>new THREE.Vector3(v.x*metres,(v.y-groundY)*metres,v.z*metres).applyQuaternion(unbasis).toArray()),boneQuaternions:q.map(v=>v.toArray()),localPositions:bones.map(b=>b.position.toArray()),localQuaternions:bones.map(b=>b.quaternion.toArray())};}
  reset();return {set,reset,snapshot,gaits,size,get mode(){return restMode?'rest':current.gait;},get state(){return {speedMps,phase01,lead:current.lead,intensity:clamp(speedMps/7.35),grounded,turn,distanceM:distanceRaw*metres,bodyLiftM:bodyY*metres};},setTurn(value){turn=clamp(value,-1,1);},update(dt){if(restMode)return;let remaining=clamp(dt,0,.25);while(remaining>1e-8){const h=Math.min(remaining,1/120);step(h);remaining-=h;}}};
}
