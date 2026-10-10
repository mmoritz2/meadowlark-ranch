/* Original one-shot poses for the existing WildMesh horse skeleton. The gait
 * assets, skin weights, inverse binds and every local joint length stay intact.
 * Pose authoring takes place in the horse's +Y-up / +Z-forward source frame;
 * support feet are fitted from actual skinned sole landmarks. */
const cache=new WeakMap();
const D=Math.PI/180,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v);return v*v*v*(10+v*(-15+6*v));};
const envelope=(p,start=.12,end=.80)=>smooth(p/start)*(1-smooth((p-end)/(1-end)));
// C2-eased authored checkpoints give each gesture its own approach and release.
function curve(p,keys){for(let i=1;i<keys.length;i++){const [t,v]=keys[i];if(p<=t){const [a,b]=keys[i-1];return b+(v-b)*smooth((p-a)/(t-a));}}return keys.at(-1)[1];}
const NAMED={
 FL:['clavicle_l_0203','upperarm_l_0204','lowerarm_l_0205','hand_l_0206','fingers_01_l_0187','fingers_02_l_0208'],
 FR:['clavicle_r_0269','upperarm_r_0270','lowerarm_r_0271','hand_r_0272','fingers_01_r_0273','fingers_02_r_0274'],
 HL:['upperleg_l_0405','lowerleg_l_0406','foot_l_0407','toes_01_l_0408','toes_02_l_0409'],
 HR:['upperleg_r_0474','lowerleg_r_0475','foot_r_0476','toes_01_r_0477','toes_02_r_0478']
};
const NECK=['neckOff_01_013','neck_01_014','neck_02_015','neck_03_016','neck_04_017','neck_05_018'];
const BODY=['pelvis_08','spine_01_09','spine_02_010','spine_03_011','spine_04_012'];
const LABELS={nuzzle:'Nuzzle',toss:'Head toss',graze:'Graze',rear:'Rear',bow:'Bow',kick:'Kick',liedown:'Lie down',paw:'Paw ground',look:'Look around'};
const DURATIONS={nuzzle:3.2,toss:2.4,graze:7.2,rear:3.8,bow:4.4,kick:2.9,liedown:8.4,paw:4.6,look:5.4};
const DESCRIPTIONS={nuzzle:'A soft reach and an affectionate rub, then a relaxed return.',toss:'A quick lift and toss of the head.',graze:'Lower the muzzle to graze, chew, then lift back to rest.',rear:'Rock back, lift the forelegs, then settle onto all four feet.',bow:'Fold one foreleg into a quiet bow.',kick:'Glance back, tuck one hind leg, and give a single backward kick.',liedown:'Kneel, rest with quiet breathing, then rise forelegs first.',paw:'Two curious scrapes, then settle back onto all four feet.',look:'An unhurried glance to either side.'};

export function createNativeHorseActionClips({THREE,root,profile}={}){
 const empty={clips:[],actions:{}};
 if(!THREE||!root||!profile?.nativeBreed||profile.nativeKind!=='horse')return empty;
 const objects=[];root.traverse(o=>objects.push(o));const byObject=new Map(objects.map((o,i)=>[o,i])),byName=new Map(objects.map((o,i)=>[o.name,i]));
 const required=[...BODY,...NECK,'head_019','jaw_020','tail_01_0367','tail_02_0368','tail_03_0369',...Object.values(NAMED).flat()];
 const body=objects.find(o=>o.isSkinnedMesh&&o.geometry?.attributes.position.count===16159);
 if(!body||body.skeleton?.bones.length!==677||required.some(n=>!byName.has(n)))return empty;
 const key=(profile.nativeRoster?'roster':profile.id)+'|'+required.map(n=>{const o=objects[byName.get(n)];return [...o.position.toArray(),...o.quaternion.toArray()].map(x=>x.toFixed(5)).join(',');}).join('|');
 let cached=cache.get(body.geometry);if(cached?.has(key))return cached.get(key);
 const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion(),M=()=>new THREE.Matrix4();
 const parents=objects.map(o=>byObject.get(o.parent)??-1),restP=objects.map(o=>o.position.clone()),restQ=objects.map(o=>o.quaternion.clone()),scales=objects.map(o=>o.scale.clone());
 const localP=restP.map(p=>p.clone()),localQ=restQ.map(q=>q.clone()),matrices=objects.map(M),valid=new Uint8Array(objects.length),scratchV=V(),scratchScale=V();
 function invalidate(){valid.fill(0);}
 function world(i){if(valid[i])return matrices[i];const m=matrices[i];if(i===0)m.identity();else {m.compose(localP[i],localQ[i],scales[i]);if(parents[i]>=0)m.premultiply(world(parents[i]));}valid[i]=1;return m;}
 function rotation(i,out=Q()){world(i).decompose(scratchV,out,scratchScale);return out.normalize();}
 const restWorld=objects.map((o,i)=>world(i).clone()),restRot=objects.map((o,i)=>rotation(i)),pelvis=byName.get('pelvis_08');
 const X=new THREE.Vector3(1,0,0),Y=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1);
 function reset(){for(let i=0;i<objects.length;i++){localP[i].copy(restP[i]);localQ[i].copy(restQ[i]);}invalidate();}
 function absolute(i,pitch=0,yaw=0,roll=0){const q=Q().setFromEuler(new THREE.Euler(pitch,yaw,roll,'YXZ')).multiply(restRot[i]);localQ[i].copy(rotation(parents[i]).invert()).multiply(q).normalize();invalidate();}
 function relative(i,angle){const parent=rotation(parents[i]),delta=Q().setFromAxisAngle(X,angle);localQ[i].copy(parent.clone().invert()).multiply(delta).multiply(parent).multiply(restQ[i]).normalize();invalidate();}
 function movePelvis(delta){const p=new THREE.Vector3().setFromMatrixPosition(restWorld[pelvis]).add(delta);localP[pelvis].copy(p.applyMatrix4(world(parents[pelvis]).clone().invert()));invalidate();}
 const pos=body.geometry.attributes.position;

 function landmark(index,mesh=body){const attrs=mesh.geometry.attributes,p=V().fromBufferAttribute(attrs.position,index),influences=[];for(let c=0;c<4;c++){const weight=attrs.skinWeight.getComponent(index,c);if(weight>0){const j=attrs.skinIndex.getComponent(index,c);influences.push({i:byObject.get(mesh.skeleton.bones[j]),weight,p:p.clone().applyMatrix4(mesh.skeleton.boneInverses[j])});}}return {index,influences};}
 function skin(v,out=V()){out.set(0,0,0);for(const s of v.influences)out.addScaledVector(scratchV.copy(s.p).applyMatrix4(world(s.i)),s.weight);return out;}
 const all=Array.from({length:pos.count},(_,i)=>landmark(i)),standing=all.map(l=>skin(l)),floor=Math.min(...standing.map(p=>p.y));
 const headIndex=byName.get('head_019'),muzzleBones=new Set();
 for(let i=0;i<objects.length;i++){let parent=i;while(parent>=0&&parent!==headIndex){if(/lip|jaw|nostril|mouth/i.test(objects[parent].name)){muzzleBones.add(i);break;}parent=parents[parent];}}
 const muzzle=all.filter(l=>l.influences.some(s=>s.weight>.25&&muzzleBones.has(s.i)));
 const muzzleFloor=()=>{let min=Infinity;for(const l of muzzle)min=Math.min(min,skin(l).y);return min;};
 const pelvisRest=new THREE.Vector3().setFromMatrixPosition(restWorld[pelvis]),size=(pelvisRest.y-floor)/1.60;
 const clearance=all.slice();for(const mesh of objects.filter(o=>o.isSkinnedMesh&&[13895,5092,23514].includes(o.geometry.attributes.position.count)))for(let i=0;i<mesh.geometry.attributes.position.count;i++){const l=landmark(i,mesh);if(skin(l).y<floor+1.35*size)clearance.push(l);}
 const feet={};
 for(const [name,names]of Object.entries(NAMED)){
  const ids=names.map(n=>byName.get(n)),marker=new THREE.Vector3().setFromMatrixPosition(restWorld[ids.at(-1)]);
  const candidates=standing.map((p,i)=>({p,i})).filter(({p})=>p.y<floor+.21*size&&Math.abs(p.x-marker.x)<.13*size&&Math.abs(p.z-marker.z)<.24*size);
  if(candidates.length<10)return empty;
  const bottom=Math.min(...candidates.map(({p})=>p.y)),sole=candidates.filter(({p})=>p.y<bottom+.008*size),center=sole.reduce((p,s)=>p.add(s.p),V()).multiplyScalar(1/sole.length);
  const samples=new Set();for(const axis of [X,Y,Z])for(const sign of [-1,1])samples.add(candidates.reduce((a,b)=>a.p.dot(axis)*sign>b.p.dot(axis)*sign?a:b).i);
  for(const axis of [X,Z])for(const sign of [-1,1])samples.add(sole.reduce((a,b)=>a.p.dot(axis)*sign>b.p.dot(axis)*sign?a:b).i);
  const soleSamples=[...samples].filter(i=>standing[i].y<bottom+.012*size);if(soleSamples.length<2)soleSamples.push(...sole.slice(0,3).map(s=>s.i));
  // Solve and target the same sampled sole centroid. A different all-vertex
  // centroid would introduce a small forward slide even in a standing pose.
  center.copy(soleSamples.reduce((p,i)=>p.add(standing[i]),V()).multiplyScalar(1/soleSamples.length));
  feet[name]={name,ids,solve:ids.slice(0,-2),terminal:ids.at(-2),marker:ids.at(-1),samples:[...samples].map(i=>all[i]),sole:soleSamples.map(i=>all[i]),center,bottom,front:name[0]==='F'};
 }
 const changed=[...new Set(required.map(n=>byName.get(n)))];
 // A damped least-squares contact fit uses the actual skinned sole, including
 // its native heel/toe offset. Joint bounds and a pose bias choose a coherent
 // anatomical folding branch while local positions remain unchanged.
 let poseSeeds={},useSeed=false;
 function solveFoot(foot,goal){
  const n=foot.solve.length,front=foot.front,bias=(goal.bias||Array(n).fill(0)).slice(),previous=useSeed?poseSeeds[foot.name]:null,a=previous?previous.angles.map((v,k)=>v+bias[k]-previous.bias[k]):bias.slice(),bounds=front?[[-.5,.5],[-1.25,1.35],[-1.55,1.5],[-.35,2.3]]:[[-1.6,1.5],[-1.75,1.75],[-1.9,1.05]];
  function trial(angles){for(let k=0;k<n;k++)relative(foot.solve[k],angles[k]);absolute(foot.terminal,goal.pitch||0);let y=Infinity,z=0;for(const point of foot.samples)y=Math.min(y,skin(point).y);for(const point of foot.sole)z+=skin(point).z;return [y,z/foot.sole.length];}
  let error=Infinity;
  for(let it=0;it<36;it++){
   const p=trial(a),r=[goal.y-p[0],goal.z-p[1]];error=Math.hypot(...r);if(error<.00035*size)break;
   const J=[];for(let k=0;k<n;k++){const old=a[k];a[k]=old+.0005;const q=trial(a);a[k]=old;J.push([(q[0]-p[0])/.0005,(q[1]-p[1])/.0005]);}
   const lambda=.00008;let steps;for(let pass=0;pass<2;pass++){let aa=lambda,bb=lambda,ab=0;for(const j of J){aa+=j[0]*j[0];bb+=j[1]*j[1];ab+=j[0]*j[1];}const det=Math.max(1e-12,aa*bb-ab*ab),u=(bb*r[0]-ab*r[1])/det,v=(aa*r[1]-ab*r[0])/det;steps=J.map(j=>j[0]*u+j[1]*v);if(pass===0)for(let k=0;k<n;k++)if(a[k]<=bounds[k][0]+.000001&&steps[k]<0||a[k]>=bounds[k][1]-.000001&&steps[k]>0)J[k]=[0,0];}
   for(let k=0;k<n;k++)a[k]=clamp(a[k]+clamp(steps[k],-.18,.18),bounds[k][0],bounds[k][1]);
  }
  poseSeeds[foot.name]={angles:a.slice(),bias};const result=trial(a);return {error:Math.hypot(result[0]-goal.y,result[1]-goal.z),minY:result[0],angles:a};
 }
 function pose(type,p){
  reset();const e=envelope(p,.24,.68),eFast=envelope(p,.22,.65),goals=Object.fromEntries(Object.entries(feet).map(([k,f])=>[k,{y:f.bottom,z:f.center.z,pitch:0,bias:Array(f.solve.length).fill(0),support:true}]));
  let pitch=0,drop=0,shift=0,neck=0,head=0,yaw=0,headYaw=0,tail=0,foldFront=0,foldHind=0,bodyBreath=0;
  // Small, eased living motion during held poses; feet are solved afterward.
  // The windows leave the approach, recovery and exact rest endpoints intact.
  const held=smooth((p-.24)/.08)*(1-smooth((p-.60)/.08));
  const breath=held*Math.sin((p-.24)*Math.PI*2/.70);
  if(type==='nuzzle'){
   const reach=curve(p,[[0,0],[.28,1],[.57,.94],[.72,.74],[1,0]]),rub=envelope(p,.39,.57)*Math.sin(Math.PI*2*clamp((p-.26)/.49));
   neck=20*D*reach;head=26*D*curve(p,[[0,0],[.34,1],[.61,.97],[.79,.66],[1,0]])+1.6*D*rub;
   yaw=10*D*reach+2.4*D*rub;headYaw=3*D*rub;
  }
  if(type==='toss'){const wave=Math.sin(2*Math.PI*clamp((p-.16)/.63));neck=-8*D*eFast*wave;head=-16*D*eFast*wave;yaw=7*D*eFast*Math.sin(3*Math.PI*p);}
  if(type==='graze'){neck=106*D*e;head=40*D*e;}
  if(type==='rear'){
   const gather=curve(p,[[0,0],[.10,1],[.27,0],[1,0]]),land=curve(p,[[0,0],[.73,0],[.88,1],[1,0]]);
   pitch=-37*D*e+.35*D*breath;drop=-.055*size*e-.010*size*gather-.007*size*land+.003*size*breath;shift=-.13*size*e-.014*size*gather+.002*size*breath;neck=pitch-10*D*e+.5*D*breath;head=pitch+3*D*e+.8*D*breath+1.5*D*gather;tail=-18*D*e;
   for(const k of ['FL','FR']){const g=goals[k];g.y+=.88*size*e;g.z-=.24*size*e;g.pitch=78*D*e;g.bias=[-.10,-.38,-.58,1.75].map(v=>v*e);g.support=false;}
   // Slightly different foreleg carriage avoids a mirrored suspended pose.
   goals.FL.y+=.024*size*held;goals.FR.z+=.018*size*held;goals.FL.pitch+=3*D*held;
  }
  if(type==='bow'){
   pitch=4*D*e+.20*D*breath;drop=-.08*size*e+.002*size*breath;shift=-.04*size*e;neck=58*D*e+.45*D*breath;head=50*D*e+.65*D*breath;
   goals.FL.y+=.35*size*e;goals.FL.z-=.30*size*e;goals.FL.pitch=80*D*e;goals.FL.bias=[-.1,-.4,-.5,1.85].map(v=>v*e);goals.FL.support=false;
   goals.FR.z+=.10*size*e;goals.FR.pitch=-5*D*e;goals.FR.bias=[0,-.1,.1,0].map(v=>v*e);
  }
  if(type==='kick'){
   const tuck=smooth(p/.30)*(1-smooth((p-.55)/.25)),extend=smooth((p-.30)/.16)*(1-smooth((p-.61)/.19));
   const check=envelope(p,.20,.52);
   pitch=3*D*e;drop=.025*size*e;shift=.035*size*e;neck=-6*D*e;head=-3*D*e;yaw=-8*D*check;headYaw=-3*D*check;tail=-18*D*e;
   goals.HR.y+=size*(.48*tuck+.13*extend);goals.HR.z-=size*(.12*tuck+.53*extend);goals.HR.pitch=-12*D*tuck;goals.HR.bias=[-.3,.65,-.8].map(v=>v*tuck);goals.HR.support=false;
  }
  if(type==='paw'){
   // Lift, reach, set down lightly and draw back twice. The other three soles
   // stay at their standing contacts throughout; the actor never moves.
   const work=envelope(p,.16,.83),lift=curve(p,[[0,0],[.10,0],[.20,.18],[.29,.012],[.39,.008],[.46,.10],[.51,.11],[.59,.18],[.68,.012],[.78,.008],[.87,.10],[1,0]]);
   const reach=curve(p,[[0,0],[.10,0],[.22,.25],[.29,.26],[.39,-.065],[.48,0],[.61,.25],[.68,.26],[.78,-.065],[.89,0],[1,0]]);
   pitch=-.6*D*work;drop=-.014*size*work;shift=-.018*size*work;
   neck=12*D*work;head=18*D*work;headYaw=2*D*work;
   goals.FL.y+=size*lift;goals.FL.z+=size*reach;
   goals.FL.pitch=D*curve(p,[[0,0],[.10,0],[.20,18],[.29,0],[.39,0],[.48,12],[.59,18],[.68,0],[.78,0],[.87,10],[1,0]]);
   goals.FL.bias=[-.02,-.12,-.12,.42].map(v=>v*work);goals.FL.support=false;
  }
  if(type==='look'){
   const glance=curve(p,[[0,0],[.25,1],[.36,1],[.61,-.85],[.74,-.85],[1,0]]),engage=envelope(p,.22,.77);
   yaw=19*D*glance;headYaw=7*D*glance;
   neck=-2*D*engage;head=-4*D*engage+.8*D*engage*Math.sin(p*Math.PI*2);
  }
  if(type==='liedown'){
   const kneel=smooth(p/.25),settle=smooth((p-.19)/.19);
   if(p<=.66){
    foldFront=kneel;foldHind=settle;pitch=28*D*kneel*(1-settle)+2*D*settle;drop=-size*(.31*kneel+.65*settle);shift=-.04*size*kneel;neck=36*D*kneel-28*D*settle;head=44*D*kneel-35*D*settle;tail=(9*kneel+53*settle)*D;
   }else{
    // Rising is not the kneeling curve played backward: the forelegs extend
    // and raise the chest before the hindquarters push into the standing pose.
    foldFront=1-smooth((p-.66)/.18);foldHind=1-smooth((p-.77)/.23);
    pitch=(2*foldHind-28*(1-foldFront)*foldHind)*D;drop=-.96*size*foldHind;shift=-.04*size*foldHind;
    neck=(8*foldHind-8*(1-foldFront)*foldHind)*D;head=(9*foldHind-6*(1-foldFront)*foldHind)*D;tail=64*D*foldHind-pitch;
   }
   const resting=smooth((p-.38)/.07)*(1-smooth((p-.60)/.06));
   const slowBreath=resting*Math.sin((p-.38)*Math.PI*2/.60);
   bodyBreath=.28*D*slowBreath;neck+=.45*D*slowBreath;head+=.65*D*slowBreath;
  }
  movePelvis(new THREE.Vector3(0,drop,shift));absolute(pelvis,pitch);
  if(bodyBreath){absolute(byName.get('spine_03_011'),pitch+bodyBreath*.5);absolute(byName.get('spine_04_012'),pitch+bodyBreath);}
  // Neck rotations are absolute source-frame angles, distributed gradually
  // over the existing chain instead of compounding one large local bend.
  function poseNeck(factor=1){
   NECK.forEach((name,i)=>absolute(byName.get(name),pitch+(neck-pitch)*factor*(type==='graze'?(i===0?.68:i===1?.92:1):(i+1)/NECK.length),yaw*(i+1)/NECK.length));
   absolute(headIndex,head,yaw+headYaw);
  }
  poseNeck();if(tail)relative(byName.get('tail_01_0367'),tail);if(type==='liedown'){relative(byName.get('tail_02_0368'),-5*D*foldHind);relative(byName.get('tail_03_0369'),-3*D*foldHind);}
  let grazeNeckReductionDeg=0,minMuzzleY=null;
  if(type==='graze'&&e>.01){
   const jaw=byName.get('jaw_020');relative(jaw,2*D*e*(.5+.5*Math.sin(p*48)));
   const target=floor+.003*size;
   // Broader/longer muzzles need slightly less bend. Fit the existing neck
   // rotations to the actual posed lip/jaw skin; never lift the actor or feet.
   minMuzzleY=muzzleFloor();
   if(minMuzzleY<target){let lo=0,hi=1;for(let i=0;i<12;i++){const mid=(lo+hi)*.5;poseNeck(mid);if(muzzleFloor()<target)hi=mid;else lo=mid;}poseNeck(lo);grazeNeckReductionDeg=Math.abs(neck-pitch)*(1-lo)/D;minMuzzleY=muzzleFloor();}
  }
  let maxError=0,minSole=Infinity;const footReport={};for(const [name,foot]of Object.entries(feet)){
   if(type==='liedown'){
    const weight=foot.front?foldFront:foldHind;
    const directions=foot.front?[[-.31,.20],[-.18,-.27],[-.10,.436],[.03,-.363],[.03,-.118]]:[[-.29,.331],[.01,-.385],[.04,.429],[0,.108]];
    for(let k=0;k<foot.ids.length-1;k++){
     const i=foot.ids[k],child=foot.ids[k+1],oldDir=new THREE.Vector3().setFromMatrixPosition(restWorld[child]).sub(new THREE.Vector3().setFromMatrixPosition(restWorld[i])).normalize(),dir=new THREE.Vector3(oldDir.x,directions[k][0],directions[k][1]).normalize();
     const folded=Q().setFromUnitVectors(oldDir,dir).multiply(restRot[i]),target=rotation(i).slerp(folded,weight);localQ[i].copy(rotation(parents[i]).invert()).multiply(target).normalize();invalidate();
    }
    let min=Infinity;for(const point of foot.samples)min=Math.min(min,skin(point).y);const r={error:0,minY:min,angles:[],support:false};minSole=Math.min(minSole,min);footReport[name]=r;
   }else{const r=solveFoot(foot,goals[name]);if(goals[name].support)maxError=Math.max(maxError,r.error);minSole=Math.min(minSole,r.minY);footReport[name]={...r,support:goals[name].support};}
  }
  // The folded rest keeps the actual body skin clear of the ground; this
  // correction belongs to the pose's pelvis track, never the gameplay actor.
  let groundCorrection=0;if(type==='liedown'&&p>0&&p<1){let minimum=Infinity;for(const l of clearance)minimum=Math.min(minimum,skin(l).y);groundCorrection=Math.max(0,floor+.001*size*e-minimum);if(groundCorrection){movePelvis(new THREE.Vector3(0,drop+groundCorrection,shift));minSole+=groundCorrection;for(const [name,rr]of Object.entries(footReport)){rr.minY+=groundCorrection;if(rr.support)maxError=Math.max(maxError,rr.error+groundCorrection);}}}
  return {maxError,minSole,footReport,groundCorrection,grazeNeckReductionDeg,minMuzzleY};
 }
 const clips=[],actions={},diagnostics={source:'Original WildMesh677 one-shot authoring',floorY:floor,clips:{}};
 for(const [type,durationS]of Object.entries(DURATIONS)){
  poseSeeds={};useSeed=type==='bow'||type==='paw';const frames=Math.ceil(durationS*20),times=Array.from({length:frames+1},(_,i)=>i/frames*durationS),quaternions=new Map(changed.map(i=>[i,[]])),positions=[];let maxContactErrorM=0,minSoleY=Infinity,maxGroundCorrectionM=0,maxGrazeNeckReductionDeg=0,minMuzzleY=Infinity;const feetReport={};
  for(let k=0;k<=frames;k++){
   if(k===0||k===frames)reset();else {const r=pose(type,k/frames);maxContactErrorM=Math.max(maxContactErrorM,r.maxError);minSoleY=Math.min(minSoleY,r.minSole);maxGroundCorrectionM=Math.max(maxGroundCorrectionM,r.groundCorrection);maxGrazeNeckReductionDeg=Math.max(maxGrazeNeckReductionDeg,r.grazeNeckReductionDeg);if(r.minMuzzleY!==null)minMuzzleY=Math.min(minMuzzleY,r.minMuzzleY);for(const [name,rr]of Object.entries(r.footReport)){if(!feetReport[name]||rr.error>feetReport[name].error)feetReport[name]={...rr,phase:k/frames};}}
   for(const i of changed){const values=quaternions.get(i),q=localQ[i].clone();if(values.length&&q.dot(new THREE.Quaternion().fromArray(values,values.length-4))<0)q.set(-q.x,-q.y,-q.z,-q.w);values.push(...q.toArray());}positions.push(...localP[pelvis].toArray());
  }
  const name='Native Horse Action | '+LABELS[type],tracks=changed.map(i=>new THREE.QuaternionKeyframeTrack(objects[i].name+'.quaternion',times,quaternions.get(i)));
  tracks.push(new THREE.VectorKeyframeTrack('pelvis_08.position',times,positions));clips.push(new THREE.AnimationClip(name,durationS,tracks));actions[type]={clip:name,durationS,label:LABELS[type],description:DESCRIPTIONS[type],...(type==='liedown'?{dismountedOnly:true}:{})};diagnostics.clips[type]={maxContactErrorM:type==='liedown'?null:maxContactErrorM,contactBasis:type==='liedown'?'Body and low tack clearance; folded hooves are not support contacts':'Skinned sole support targets',minSoleY,frames:frames+1,maxGroundCorrectionM,...(type==='graze'?{maxGrazeNeckReductionDeg,minMuzzleY}:{}),feet:feetReport};
 }
 reset();const result={clips,actions,diagnostics};if(!cached){cached=new Map();cache.set(body.geometry,cached);}cached.set(key,result);return result;
}
