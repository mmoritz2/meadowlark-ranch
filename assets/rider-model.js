/* The rider, built from Quaternius' CC0 Universal Base Characters (assets/models/rider, cut down by
   tools/asset-gen/build-rider.mjs; licence in that folder).

   The old rider was one generated sculpt, modelled seated in a riding helmet, with bones guessed onto
   it afterwards: no face to speak of, no head under the helmet, clothes that were a height band of
   recolour. This one is a real character — an authored body on a 65-bone skeleton, a face with eyes
   and brows, hairstyles made for the head, outfits made for the body, and an animation library on the
   same skeleton — so she walks with a walk and stands with an idle instead of a seated statue re-aimed
   bone by bone.

   WHAT SHE WEARS
     riding kit   the default, painted onto the body itself the way riding clothes actually fit: a shirt
                  with a white stock collar, breeches with suede knee patches and a belt, tall boots with
                  a sole and a shine. Every colour is the wardrobe's (shirt, pants, boots), so every piece
                  the game already sells still means something.
     outfits      the pack's Peasant ("Stable hand") and Ranger ("Trail rider"), loaded when first worn;
                  the body under them is cut back to the head and neck, as the pack intends.
     helmet       a riding helmet built to her head — shell, peak and harness — in the wardrobe's colour.
     hair         the pack's styles (long, space buns; short, crop and a beard for the other body), and
                  ponytail, braid, bun, pigtails and curls built here for this head: hair drawn back over
                  her own scalp with what is tied from it, and ringlets over the long style's shape. Under a
                  helmet the hair above the brim is pressed in under the shell, what is tied sits low below
                  it, and whatever falls below the brim shows.
     face         skin tone, hair colour on the brows, and eye colour.

   HOW SHE PLUGS INTO THE GAME
   Everything in ranch3d.html that poses a rider — the seat, the posting trot, feet into the irons, hands
   to the bit, the emotes — speaks the old rig's language: seventeen role bones (hips, spine, chest, neck,
   head, arm/fore/hand, thigh/shin/foot a side) with no rest rotation, x to the 'R' side, y up, z ahead,
   and a rest pose that is the sculpt's own seat. adoptRider() gives her exactly that rig, invisible,
   standing on her own joints in a seat built from the sculpt's joint directions (RJ). The game poses it
   as it always has; _sync() then turns each of her real bones by the same rotation its role bone has
   made from rest. Because the role bones sit on her joints, her hands land where the IK put them and her
   feet go into the irons. On foot, locomote() hands her to the animation mixer (idle, walk, jog) and
   syncs the other way, so anything that reads the role bones still finds her.

   Pure module: THREE and friends are injected, nothing runs at import time. */

/* ---- tables ------------------------------------------------------------------------------------ */
/* mesh: the pack's own hairstyle. scalp: hair drawn back over her own scalp (buildScalp) with what is tied
   from it (tails: ponytail, bun, braid, pigtails). curls: ringlets over the long style's shape. */
export const RIDER_HAIR=[
 {id:'long',label:'Long',body:['f','m'],mesh:'Hair_Long'},
 {id:'ponytail',label:'Ponytail',body:['f','m'],scalp:true,tail:'ponytail'},
 {id:'braid',label:'Braid',body:['f'],scalp:true,tail:'braid'},
 {id:'bun',label:'Bun',body:['f','m'],scalp:true,tail:'bun'},
 {id:'buns',label:'Space buns',body:['f'],mesh:'Hair_Buns'},
 {id:'pigtails',label:'Pigtails',body:['f'],scalp:true,tail:'pigtails'},
 {id:'curly',label:'Curls',body:['f','m'],mesh:'Hair_Long',curls:true},
 {id:'short',label:'Short',body:['m'],mesh:'Hair_SimpleParted'},
 {id:'crop',label:'Crop',body:['m'],mesh:'Hair_Buzzed'},
 {id:'beard',label:'Short + beard',body:['m'],mesh:'Hair_SimpleParted',extra:'Hair_Beard'},
];
/* styles the old creator saved, and what each becomes (the pack's men's cuts leave a woman's scalp bare) */
const LEGACY_HAIR={loose:'long',bob:'long',quiff:'short'};
export function riderHairId(id,body){
 id=LEGACY_HAIR[id]||id||'long';
 const h=RIDER_HAIR.find(x=>x.id===id);
 if(h&&h.body.includes(body||'f'))return id;
 if(body!=='m'&&(id==='short'||id==='crop'||id==='beard'))return 'ponytail';
 return (body==='m')?'short':'long';
}
export const RIDER_OUTFITS=[
 {id:'riding',label:'Riding kit',icon:'🏇'},
 {id:'peasant',label:'Stable hand',icon:'🧺'},
 {id:'ranger',label:'Trail rider',icon:'🏹'},
];
export const RIDER_EYES=[
 {id:'brown',label:'Brown',col:'#6b3f1f'},{id:'hazel',label:'Hazel',col:'#8a6a2c'},{id:'green',label:'Green',col:'#4f8a4a'},
 {id:'blue',label:'Blue',col:'#4a7ec0'},{id:'grey',label:'Grey',col:'#8d98a4'},{id:'amber',label:'Amber',col:'#b87d24'},
];
/* role bone -> her bone. The role 'R' side is the +x side, which is her _l. */
const ROLE_BONE={hips:'pelvis',spine:'spine_01',chest:'spine_03',neck:'neck_01',head:'Head',
 armR:'upperarm_l',foreR:'lowerarm_l',handR:'hand_l',thighR:'thigh_l',shinR:'calf_l',footR:'foot_l',
 armL:'upperarm_r',foreL:'lowerarm_r',handL:'hand_r',thighL:'thigh_r',shinL:'calf_r',footL:'foot_r'};
const ROLE_PARENT={hips:null,spine:'hips',chest:'spine',neck:'chest',head:'neck',armR:'chest',foreR:'armR',handR:'foreR',
 thighR:'hips',shinR:'thighR',footR:'shinR',armL:'chest',foreL:'armL',handL:'foreL',thighL:'hips',shinL:'thighL',footL:'shinL'};
const ROLES=['hips','spine','chest','neck','head','armR','foreR','handR','thighR','shinR','footR','armL','foreL','handL','thighL','shinL','footL'];
/* the textures' own average skin (linear), measured off each image: the tint keeps her shading and her
   lips and cheeks, and moves only the colour */
const SKIN_REF={f:[0.4029,0.1856,0.0854],m:[0.3880,0.1765,0.0822]};
const HAIR_TEX_LUM=0.275;
const DEF_SKIN='#e2ae88';   // no skin picked: a warm fair tone, near the old rider's
/* the helmet's brim height going round the head (th=0 straight ahead), as GLSL and as JS: the hair is
   pressed under the shell only above it, so long hair still falls out below */
const RIM_GLSL=`float riderRim(float th,float cy){float a=abs(th)/3.14159265;
 return a<0.28?cy+0.041-0.028*(a/0.28):a<0.62?cy+0.013-0.053*((a-0.28)/0.34):cy-0.040-0.020*((a-0.62)/0.38);}`;
const rimAt=(th,cy)=>{const a=Math.abs(th)/Math.PI;return a<0.28?cy+0.041-0.028*(a/0.28):a<0.62?cy+0.013-0.053*((a-0.28)/0.34):cy-0.040-0.020*((a-0.62)/0.38);};
const CLIP={idle:'Idle_Loop',talk:'Idle_Talking_Loop',walk:'Walk_Loop',jog:'Jog_Fwd_Loop',sprint:'Sprint_Loop',
 interact:'Interact',pickup:'PickUp_Table',kneel:'Fixing_Kneeling',dance:'Dance_Loop',sit:'Sitting_Idle_Loop',drive:'Driving_Loop'};

export function createRiderLibrary({THREE,GLTFLoader,clone,RJ}){
 const base=new URL('./models/rider/',import.meta.url);
 const loader=new GLTFLoader();
 const files=new Map();
 const file=name=>{if(!files.has(name))files.set(name,new Promise((res,rej)=>loader.load(new URL(name,base).href,res,undefined,rej)));return files.get(name);};
 const kits={},kitReady={};
 const V=(x,y,z)=>new THREE.Vector3(x,y,z);
 const _q=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_wq=new THREE.Quaternion(),_pq=new THREE.Quaternion();
 const _v=new THREE.Vector3(),_v2=new THREE.Vector3(),_m=new THREE.Matrix4();

 /* ------------------------------------------------------------------ the kit, once per body -- */
 function kit(body){
  body=body==='m'?'m':'f';
  if(!kits[body])kits[body]=Promise.all([file('rider-'+body+'.glb'),file('rider-hair.glb'),file('rider-anims.glb')])
   .then(([g,h,a])=>{const k=prepareKit(body,g,h,a);kitReady[body]=k;return k;});
  return kits[body];
 }
 function prepareKit(body,gBody,gHair,gAnim){
  const scene=gBody.scene; let skin=null,eyes=null,brows=null;
  scene.traverse(o=>{if(!o.isSkinnedMesh)return; if(/superhero/i.test(o.name))skin=o; else if(/^Eyes/.test(o.name))eyes=o; else if(/^Eyebrows/.test(o.name))brows=o;});
  if(!skin)throw new Error('rider body mesh missing');
  const bones={}; skin.skeleton.bones.forEach(b=>{bones[b.name]=b;});
  for(const r of ROLES)if(!bones[ROLE_BONE[r]])throw new Error('rider bone missing: '+ROLE_BONE[r]);
  scene.updateMatrixWorld(true);
  const J=n=>bones[n].getWorldPosition(new THREE.Vector3());
  /* bind-pose landmarks, for the clothes and the slimming (all T-pose, metres) */
  const L={neck:J('neck_01'),pelvis:J('pelvis'),calf:J('calf_l'),hand:J('hand_l'),arm:J('upperarm_l'),elbow:J('lowerarm_l'),thigh:J('thigh_l'),head:J('Head')};
  const zones={neckY:L.neck.y-0.038,neckZ:L.neck.z+0.012,waistY:L.pelvis.y+0.068,bootY:L.calf.y-0.070,cuffX:L.hand.x-0.014,armY:L.arm.y,armZ:L.arm.z,headY:L.head.y-0.02};
  slim(skin.geometry,body,L);
  if(brows)thinBrows(brows.geometry);
  /* ---- the seat, from the sculpt's joint directions ---- */
  const grip=gAnim.animations.find(c=>c.name===CLIP.drive)||gAnim.animations.find(c=>c.name===CLIP.idle);
  const seat=buildSeat(scene,bones,grip);
  /* ---- clips: her bones by name; the pelvis track moved onto her own hip height ---- */
  const clips={};
  let ualPelvis=null; gAnim.scene.traverse(o=>{if(o.name==='pelvis')ualPelvis=o.position.clone();});
  const herPelvis=seat.restLocal.get('pelvis').p;
  for(const c of gAnim.animations){
   const cl=c.clone();
   for(const t of cl.tracks)if(t.name==='pelvis.position'&&ualPelvis){const v=t.values;for(let i=0;i<v.length;i+=3){v[i]+=herPelvis.x-ualPelvis.x;v[i+1]+=herPelvis.y-ualPelvis.y;v[i+2]+=herPelvis.z-ualPelvis.z;}}
   clips[c.name]=cl;
  }
  /* ---- hair meshes, in Head space ---- */
  const hair={};
  gHair.scene.traverse(o=>{if(o.isMesh)hair[o.name]={geometry:o.geometry,material:o.material};});
  /* ---- head: the skull for the helmet ---- */
  const head=headShape(skin,bones.Head);
  /* the top of the brows, in Head space: the hairline is measured from it */
  head.browTop=0.139;
  if(brows){const bp=brows.geometry.attributes.position,hi=brows.skeleton.bones.indexOf(brows.skeleton.bones.find(b=>b.name==='Head')),inv=brows.skeleton.boneInverses[hi];
   let t=-1e9;for(let i=0;i<bp.count;i++){_v.fromBufferAttribute(bp,i).applyMatrix4(inv);if(_v.y>t)t=_v.y;}if(t>-1e8)head.browTop=t;}
  const helmetGeo=buildHelmetGeometry(head);
  return {body,scene,skin,eyes,brows,bones,seat,zones,clips,hair,head,helmetGeo,materials:{body:skin.material,eyes:eyes&&eyes.material,brows:brows&&brows.material},outfits:{}};
 }

 /* She is a superhero body in the source, built for capes: broad in the arm, heavy in the thigh and
    the bust. Riding clothes fit close, so take a little off, once, in the bind pose (the outfits cover
    the body, so they never meet the difference). */
 function slim(geo,body,L){
  if(geo.userData.slimmed)return; geo.userData.slimmed=true;
  const p=geo.attributes.position, sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
  const F=body==='f';
  const armK=F?0.90:0.95, foreK=F?0.93:0.97, thighK=F?0.92:0.97, bustK=F?0.70:1;
  for(let i=0;i<p.count;i++){
   let x=p.getX(i),y=p.getY(i),z=p.getZ(i); const ax=Math.abs(x);
   /* arms: in towards the bone, most in the upper arm, none at the hand */
   if(ax>L.arm.x&&y>L.arm.y-0.16){
    const inArm=sm(L.arm.x,L.arm.x+0.07,ax)*(1-sm(L.hand.x-0.03,L.hand.x+0.01,ax));
    const k=1-(1-(ax<L.elbow.x?armK:foreK))*inArm;
    y=L.arm.y+(y-L.arm.y)*k; z=L.arm.z+(z-L.arm.z)*k;
   }
   /* thighs: towards the leg's axis, fading out at the knee and at the hip */
   if(y<L.thigh.y&&y>L.calf.y&&ax>0.015){
    const t=sm(L.calf.y+0.02,L.calf.y+0.16,y)*(1-sm(L.thigh.y-0.12,L.thigh.y-0.02,y));
    const k=1-(1-thighK)*t, cx=Math.sign(x)*L.thigh.x, cz=-0.045;
    x=cx+(x-cx)*k; z=cz+(z-cz)*k;
   }
   /* bust: the forward swell pulled back towards the chest wall */
   if(bustK<1&&z>0.03&&ax<0.17&&y>L.neck.y-0.30&&y<L.neck.y-0.06){
    const t=sm(L.neck.y-0.30,L.neck.y-0.22,y)*(1-sm(L.neck.y-0.13,L.neck.y-0.06,y))*(1-sm(0.12,0.17,ax));
    z=0.03+(z-0.03)*(1-(1-bustK)*t);
   }
   p.setXYZ(i,x,y,z);
  }
  p.needsUpdate=true; geo.computeBoundingSphere();
 }

 /* The source brows are a superhero's, heavy and low: narrower and a little finer. */
 function thinBrows(geo){
  if(geo.userData.thinned)return; geo.userData.thinned=true;
  const p=geo.attributes.position; let y0=0,n=p.count;
  for(let i=0;i<n;i++)y0+=p.getY(i); y0/=n;
  for(let i=0;i<n;i++){p.setY(i,y0+0.004+(p.getY(i)-y0)*0.70);p.setX(i,p.getX(i)*0.97);}
  p.needsUpdate=true; geo.computeBoundingSphere();
 }
 /* The skull, in the Head bone's space (which is the model's own axes at bind): the helmet is made to
    this, and the drawn-back hair is tied at points on it. */
 function headShape(skin,headBone){
  const g=skin.geometry,p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
  const hi=skin.skeleton.bones.indexOf(headBone), inv=skin.skeleton.boneInverses[hi];
  const lo=V(1e9,1e9,1e9),hiV=V(-1e9,-1e9,-1e9);let top=-1e9;const chin=V(0,1e9,0);
  const cmp=(a,i,k)=>k===0?a.getX(i):k===1?a.getY(i):k===2?a.getZ(i):a.getW(i);
  for(let i=0;i<p.count;i++){let w=0;for(let k=0;k<4;k++)if(cmp(si,i,k)===hi)w+=cmp(sw,i,k);if(w<0.35)continue;
   _v.fromBufferAttribute(p,i).applyMatrix4(inv);
   if(Math.abs(_v.x)<0.02&&_v.z>0.03&&_v.y<chin.y)chin.copy(_v);   // the point of the chin (the jaw is shared with the neck)
   if(w<0.9)continue; lo.min(_v);hiV.max(_v);top=Math.max(top,_v.y);}
  /* the cranium: the part of the head above the ears */
  return {min:lo,max:hiV,top,chin,cx:0,cy:top-0.102,cz:(lo.z+hiV.z)*0.5-0.012,rx:(hiV.x-lo.x)*0.5,ry:0.104,rz:(hiV.z-lo.z)*0.5-0.004};
 }

 /* ---- the seat: her skeleton aimed, bone by bone, along the sculpt's own joint directions -------- */
 function buildSeat(scene,bones,grip){
  const rest=new Map();
  scene.traverse(o=>{if(o.isBone)rest.set(o.name,{q:o.quaternion.clone(),p:o.position.clone()});});
  const P=n=>bones[n].getWorldPosition(new THREE.Vector3());
  const boneY=b=>V(0,1,0).applyQuaternion(b.getWorldQuaternion(_wq)).normalize();
  const aim=(b,from,to)=>{if(from.lengthSq()<1e-12||to.lengthSq()<1e-12)return;_q.setFromUnitVectors(from.clone().normalize(),to.clone().normalize());
   b.getWorldQuaternion(_wq);_wq.premultiply(_q);b.parent.getWorldQuaternion(_pq);b.quaternion.copy(_pq.invert().multiply(_wq));b.updateMatrixWorld(true);};
  const turn=(b,axisW,ang)=>{_q.setFromAxisAngle(axisW.clone().normalize(),ang);b.getWorldQuaternion(_wq);_wq.premultiply(_q);b.parent.getWorldQuaternion(_pq);b.quaternion.copy(_pq.invert().multiply(_wq));b.updateMatrixWorld(true);};
  const d=(a,b,s)=>V((RJ[b][0]-RJ[a][0])*(s||1),RJ[b][1]-RJ[a][1],RJ[b][2]-RJ[a][2]);
  scene.updateMatrixWorld(true);
  /* Fists round the reins: the fingers and thumbs of the library's driving clip, whose hands are closed
     round a wheel — the same grip. (Bending the finger bones by hand closed the bones and left the skin
     in a claw.) */
  const relax=new Map();
  if(grip)for(const t of grip.tracks){const m=/^((?:index|middle|ring|pinky|thumb)_0[123]_[lr])\.quaternion$/.exec(t.name);
   if(m&&bones[m[1]]){const b=bones[m[1]],r0=b.quaternion.clone();b.quaternion.fromArray(t.values,0);
    /* and a hand at rest on foot: half-way between the open T-pose hand and the grip */
    relax.set(m[1],r0.clone().slerp(b.quaternion,0.45));}}
  scene.updateMatrixWorld(true);
  aim(bones.pelvis,P('spine_01').sub(P('pelvis')),d('hips','spine'));
  aim(bones.spine_01,P('spine_03').sub(P('spine_01')),d('spine','chest'));
  aim(bones.spine_03,P('neck_01').sub(P('spine_03')),d('chest','neck'));
  aim(bones.neck_01,P('Head').sub(P('neck_01')),d('neck','head'));
  aim(bones.Head,boneY(bones.Head),d('head','headEnd'));
  for(const s of [1,-1]){const sd=s>0?'l':'r';
   aim(bones['upperarm_'+sd],P('lowerarm_'+sd).sub(P('upperarm_'+sd)),d('shoulder','elbow',s));
   aim(bones['lowerarm_'+sd],P('hand_'+sd).sub(P('lowerarm_'+sd)),d('elbow','wrist',s));
   /* roll the forearm so the fists stand thumbs-up, as a rider holds the reins */
   turn(bones['lowerarm_'+sd],P('hand_'+sd).sub(P('lowerarm_'+sd)),-s*1.05);
   aim(bones['hand_'+sd],P('middle_01_'+sd).sub(P('hand_'+sd)),d('wrist','hand',s));
   aim(bones['thigh_'+sd],P('calf_'+sd).sub(P('thigh_'+sd)),d('legTop','knee',s));
   aim(bones['calf_'+sd],P('foot_'+sd).sub(P('calf_'+sd)),d('knee','ankle',s));
   aim(bones['foot_'+sd],P('ball_'+sd).sub(P('foot_'+sd)),d('ankle','ball',s));
  }
  scene.updateMatrixWorld(true);
  const local=new Map(),world=new Map();
  scene.traverse(o=>{if(!o.isBone)return;local.set(o.name,{q:o.quaternion.clone(),p:o.position.clone()});world.set(o.name,{q:o.getWorldQuaternion(new THREE.Quaternion()),p:o.getWorldPosition(new THREE.Vector3())});});
  /* the role rig's joints: where each role bone stands in the seat */
  const jp={hips:P('pelvis'),spine:P('spine_01'),chest:P('spine_03'),neck:P('neck_01'),head:P('Head')};
  for(const s of [1,-1]){const S=s>0?'R':'L',sd=s>0?'l':'r';
   jp['arm'+S]=P('upperarm_'+sd);jp['fore'+S]=P('lowerarm_'+sd);jp['hand'+S]=P('hand_'+sd);
   jp['thigh'+S]=P('thigh_'+sd);jp['shin'+S]=P('calf_'+sd);jp['foot'+S]=P('foot_'+sd);
   /* the middle of her fist, for the rein to leave from */
   jp['fist'+S]=P('hand_'+sd).lerp(P('middle_02_'+sd),0.62);
  }
  /* back to the T-pose: the kit is what every rider is cloned from */
  scene.traverse(o=>{if(o.isBone){const r=rest.get(o.name);o.quaternion.copy(r.q);o.position.copy(r.p);}});
  scene.updateMatrixWorld(true);
  return {local,world,joints:jp,restLocal:rest,relax};
 }

 /* ---- hair for this head --------------------------------------------------------------------------
    The pack's hairstyles are made for it, but its only tied-back style is a buzz cut with a ragged edge,
    and the old procedural pieces were cut for the sculpt's much bigger head. So the drawn-back styles are
    built here: a cap of hair grown from her own scalp (her head's triangles above a hairline, lifted a few
    millimetres, with the edge carved irregular in the shader and the strands of the pack's hair texture
    running from the tie), and what is tied from it — a ponytail, a bun, a plaited braid, pigtails. Under a
    helmet they sit low, below the brim, as riders wear them. */
 function hairline(kit){
  const bt=kit.head.browTop;
  const K=[[0,bt+0.043],[0.35,bt+0.041],[0.80,bt+0.029],[1.30,bt+0.004],[1.62,bt-0.010],[2.05,bt-0.058],[2.60,bt-0.090],[Math.PI,bt-0.102]];
  return th=>{const a=Math.abs(th);for(let i=1;i<K.length;i++)if(a<=K[i][0]){const t=(a-K[i-1][0])/(K[i][0]-K[i-1][0]),e=t*t*(3-2*t);return K[i-1][1]+(K[i][1]-K[i-1][1])*e;}return K[K.length-1][1];};
 }
 function tiePoint(kit,tie){const H=kit.head;
  if(tie==='crown')return V(H.cx,H.cy+H.ry*0.80,H.cz-H.rz*0.42);
  if(tie==='nape')return V(H.cx,H.cy-0.072,H.cz-H.rz*0.84);
  return V(H.cx,H.cy+0.028,H.cz-H.rz*0.97);
 }
 function scalpGeometry(kit,tie){
  kit.scalps=kit.scalps||{}; if(kit.scalps[tie])return kit.scalps[tie];
  const skin=kit.skin,g=skin.geometry,pos=g.attributes.position,nor=g.attributes.normal,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,idx=g.index;
  const hi=skin.skeleton.bones.indexOf(kit.bones.Head),inv=skin.skeleton.boneInverses[hi],nm=new THREE.Matrix3().getNormalMatrix(inv);
  const H=kit.head,hl=hairline(kit),C=V(H.cx,H.cy,H.cz),td=tiePoint(kit,tie).sub(C).normalize();
  const up=Math.abs(td.y)<0.9?V(0,1,0):V(0,0,-1),ax=up.clone().sub(td.clone().multiplyScalar(up.dot(td))).normalize(),bx=td.clone().cross(ax);
  const cmp=(a,i,k)=>k===0?a.getX(i):k===1?a.getY(i):k===2?a.getZ(i):a.getW(i);
  const n=pos.count,w=new Float32Array(n),loc=new Float32Array(n*3),fade=new Float32Array(n);
  for(let i=0;i<n;i++){let hw=0;for(let k=0;k<4;k++)if(cmp(si,i,k)===hi)hw+=cmp(sw,i,k);w[i]=hw;if(hw<0.5)continue;
   _v.fromBufferAttribute(pos,i).applyMatrix4(inv);loc.set([_v.x,_v.y,_v.z],i*3);fade[i]=(_v.y-hl(Math.atan2(_v.x-H.cx,_v.z-H.cz)))/0.010;}
  const map=new Int32Array(n).fill(-1),P=[],N=[],UV=[],F=[],I=[];
  const vtx=i=>{if(map[i]>=0)return map[i];
   const x=loc[i*3],y=loc[i*3+1],z=loc[i*3+2]; _v2.fromBufferAttribute(nor,i).applyMatrix3(nm).normalize();
   const off=0.0034;P.push(x+_v2.x*off,y+_v2.y*off,z+_v2.z*off);N.push(_v2.x,_v2.y,_v2.z);
   const d=V(x-C.x,y-C.y,z-C.z).normalize(),pol=Math.acos(Math.max(-1,Math.min(1,d.dot(td)))),az=Math.atan2(d.dot(bx),d.dot(ax));
   UV.push(az/(Math.PI*2)*4,pol/Math.PI*1.7);F.push(fade[i]);map[i]=P.length/3-1;return map[i];};
  for(let t=0;t<idx.count;t+=3){const a=idx.getX(t),b=idx.getX(t+1),c=idx.getX(t+2);
   if(w[a]<0.5||w[b]<0.5||w[c]<0.5)continue; if(Math.max(fade[a],fade[b],fade[c])<-1.3)continue;
   I.push(vtx(a),vtx(b),vtx(c));}
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));geo.setAttribute('hairFade',new THREE.Float32BufferAttribute(F,1));
  geo.setIndex(I);geo.computeBoundingSphere();
  kit.scalps[tie]=geo;return geo;
 }
 /* a tapered tube through points, strands running along it */
 function tubeGeo(pts,radii,segs,rad){
  segs=segs||28;rad=rad||12;
  const curve=new THREE.CatmullRomCurve3(pts),geo=new THREE.TubeGeometry(curve,segs,1,rad,false),pa=geo.attributes.position,uv=geo.attributes.uv,cen=V(0,0,0);
  const rAt=t=>{const f=t*(radii.length-1),i=Math.min(radii.length-2,Math.floor(f));return radii[i]+(radii[i+1]-radii[i])*(f-i);};
  for(let i=0;i<=segs;i++){const t=i/segs,rr=rAt(t);curve.getPointAt(t,cen);
   for(let j=0;j<=rad;j++){const k=i*(rad+1)+j;_v.fromBufferAttribute(pa,k).sub(cen).multiplyScalar(rr).add(cen);pa.setXYZ(k,_v.x,_v.y,_v.z);uv.setXY(k,j/rad*2,t*3);}}
  /* close the tip */
  pa.needsUpdate=true;uv.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingSphere();return geo;
 }
 function mergeGeos(list){
  let nv=0,ni=0;for(const g of list){nv+=g.attributes.position.count;ni+=g.index?g.index.count:g.attributes.position.count;}
  const P=new Float32Array(nv*3),N=new Float32Array(nv*3),U=new Float32Array(nv*2),I=[];let o=0;
  for(const g of list){const p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv;
   P.set(p.array,o*3);N.set(n.array,o*3);if(u)U.set(u.array,o*2);
   if(g.index)for(let k=0;k<g.index.count;k++)I.push(g.index.getX(k)+o);else for(let k=0;k<p.count;k++)I.push(k+o);
   o+=p.count;g.dispose();}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(P,3));geo.setAttribute('normal',new THREE.BufferAttribute(N,3));
  geo.setAttribute('uv',new THREE.BufferAttribute(U,2));geo.setIndex(I);geo.computeBoundingSphere();return geo;
 }
 const tieRing=(at,dir,r)=>{const g=new THREE.TorusGeometry(r,0.0052,8,22);_q.setFromUnitVectors(V(0,0,1),dir.clone().normalize());g.applyQuaternion(_q);g.translate(at.x,at.y,at.z);return g;};
 /* what is tied from the cap: [hair geometries], [tie geometries] */
 function tailPieces(kit,tail,helm){
  const H=kit.head,hair=[],ties=[];
  if(tail==='ponytail'){
   const T=tiePoint(kit,helm?'nape':'back');
   const off=helm?[[0,0.004,0.006],[0,-0.012,-0.026],[0,-0.070,-0.040],[0,-0.150,-0.040],[0,-0.215,-0.032]]:[[0,0.004,0.006],[0,-0.008,-0.030],[0,-0.060,-0.050],[0,-0.150,-0.052],[0,-0.235,-0.040],[0,-0.292,-0.030]];
   const pts=off.map(o=>V(T.x+o[0],T.y+o[1],T.z+o[2]));
   hair.push(tubeGeo(pts,helm?[0.015,0.024,0.027,0.018,0.004]:[0.016,0.026,0.031,0.027,0.017,0.004]));
   ties.push(tieRing(pts[0].clone().lerp(pts[1],0.30),pts[1].clone().sub(pts[0]),0.0165));
  }else if(tail==='bun'){
   const T=tiePoint(kit,helm?'nape':'crown'),C0=V(H.cx,H.cy,H.cz),out=T.clone().sub(C0).normalize();
   const r=helm?[0.042,0.034,0.031]:[0.057,0.046,0.052], c=T.clone().addScaledVector(out,helm?0.021:0.034);
   const g=new THREE.SphereGeometry(1,22,16);const uv=g.attributes.uv;for(let k=0;k<uv.count;k++)uv.setXY(k,uv.getX(k)*3,uv.getY(k)*1.4);
   g.scale(r[0],r[1],r[2]);_q.setFromUnitVectors(V(0,1,0),out);g.applyQuaternion(_q);g.translate(c.x,c.y,c.z);hair.push(g);
   ties.push(tieRing(T.clone().addScaledVector(out,0.004),out,helm?0.024:0.028));
  }else if(tail==='braid'){
   const T=tiePoint(kit,helm?'nape':'back').add(V(0,helm?0:-0.018,-0.006)),lobes=[],L=helm?0.22:0.28,NL=helm?9:11;
   for(let k=0;k<NL;k++){const t=k/(NL-1),sz=1-0.42*t,side=k%2?1:-1;
    const c=V(T.x+side*0.0045*sz,T.y-0.018-t*L,T.z-0.030-0.022*Math.sin(t*Math.PI*0.9));
    const g=new THREE.SphereGeometry(1,12,9);g.scale(0.021*sz,0.029*sz,0.017*sz);g.rotateZ(side*0.50);g.rotateX(-0.25);g.translate(c.x,c.y,c.z);lobes.push(g);}
   const end=V(T.x,T.y-0.018-L-0.020,T.z-0.030);
   const tuft=new THREE.ConeGeometry(0.013,0.050,12,1,true);tuft.rotateX(Math.PI);tuft.translate(end.x,end.y-0.026,end.z);lobes.push(tuft);
   hair.push(mergeGeos(lobes));ties.push(tieRing(end,V(0,1,0),0.0115));
   /* the gather at the top of the braid */
   hair.push(tubeGeo([T.clone().add(V(0,0.006,0.008)),T.clone().add(V(0,-0.010,-0.018)),T.clone().add(V(0,-0.024,-0.030))],[0.016,0.022,0.020],8,12));
  }else if(tail==='pigtails'){
   for(const sd of [1,-1]){const T=V(sd*(H.rx+0.001),H.cy-0.040,H.cz-0.036);
    const pts=[[0,0,0],[sd*0.020,-0.030,-0.018],[sd*0.030,-0.100,-0.028],[sd*0.026,-0.178,-0.026],[sd*0.018,-0.232,-0.020]].map(o=>V(T.x+o[0],T.y+o[1],T.z+o[2]));
    hair.push(tubeGeo(pts,[0.015,0.022,0.022,0.016,0.004]));ties.push(tieRing(pts[0].clone().lerp(pts[1],0.35),pts[1].clone().sub(pts[0]),0.0155));}
  }
  return {hair,ties};
 }
 /* curls: ringlets over the long style's own shape (so none of them fall over her face), a few hundred in
    one instanced draw; under a helmet only those below the brim */
 function curlMatrices(kit,helm){
  const src=kit.hair.Hair_Long&&kit.hair.Hair_Long.geometry; if(!src)return [];
  const pos=src.attributes.position,nor=src.attributes.normal,H=kit.head,C=V(H.cx,H.cy,H.cz),hg=kit.helmetGeo,out=[];
  let seed=11;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),sc=V(0,0,0),p=V(0,0,0),n=V(0,0,0);
  for(let i=0;i<pos.count;i++){if(rnd()>0.52)continue;
   p.fromBufferAttribute(pos,i);n.fromBufferAttribute(nor,i);if(n.dot(p.clone().sub(C))<0)continue;
   if(helm){const th=Math.atan2(p.x-hg.cx,p.z-hg.cz);if(p.y>hg.rimY(th)-0.012)continue;}
   const r=0.0082+rnd()*0.0046;p.addScaledVector(n,0.004+rnd()*0.0035);
   q.setFromAxisAngle(V(rnd()-0.5,rnd()-0.5,rnd()-0.5).normalize(),rnd()*6.28);sc.set(r,r*(0.8+0.35*rnd()),r);
   out.push(new THREE.Matrix4().compose(p.clone(),q.clone(),sc.clone()));}
  return out;
 }

 /* ---- the helmet: a shell to her skull, a peak, a harness to the chin --------------------------- */
 function buildHelmetGeometry(h){
  const cx=h.cx,cy=h.cy+0.006,cz=h.cz-0.004, rx=h.rx+0.021, ry=h.ry+0.024, rz=h.rz+0.020;
  /* the brim: just above the brows at the front, over the tops of the ears, low at the back of the skull */
  const rimY=th=>rimAt(th,cy);
  const onShell=(th,y,out)=>{const k=Math.max(0,1-Math.pow((y-cy)/ry,2)),r=Math.sqrt(k)*(1+out);return [cx+Math.sin(th)*rx*r,y,cz+Math.cos(th)*rz*r];};
  const NT=64,NY=20,pos=[],uv=[],idx=[];
  for(let j=0;j<=NY;j++){const v=j/NY;for(let i=0;i<=NT;i++){const u=i/NT,th=(u-0.5)*Math.PI*2;
   const yTop=cy+ry*0.999,y=yTop+(rimY(th)-yTop)*Math.pow(v,0.9);pos.push(...onShell(th,y,0));uv.push(u,v);}}
  for(let j=0;j<NY;j++)for(let i=0;i<NT;i++){const a=j*(NT+1)+i,b=a+NT+1;idx.push(a,b,a+1,b,b+1,a+1);}
  const shell=new THREE.BufferGeometry();shell.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));shell.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));shell.setIndex(idx);shell.computeVertexNormals();
  /* a rolled edge round the brim so it reads as a thing with thickness */
  const rimPts=[];for(let i=0;i<=NT;i++){const th=(i/NT-0.5)*Math.PI*2;rimPts.push(V(...onShell(th,rimY(th),0.004)));}
  const rim=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts,true),NT,0.0042,6,true);
  /* the peak: out from the brim across the front, dipping a little */
  const pk=[],pu=[],pi=[],NP=24,NW=6,span=0.36;
  for(let w=0;w<=NW;w++){const f=w/NW;for(let i=0;i<=NP;i++){const th=(i/NP-0.5)*Math.PI*2*span;const e=onShell(th,rimY(th),0.003);
   const out=0.050*f*Math.pow(Math.cos((i/NP-0.5)*Math.PI),0.6);const nx=Math.sin(th),nz=Math.cos(th);pk.push(e[0]+nx*out,e[1]-0.002-0.006*f*f,e[2]+nz*out);pu.push(i/NP,f);}}
  for(let w=0;w<NW;w++)for(let i=0;i<NP;i++){const a=w*(NP+1)+i,b=a+NP+1;pi.push(a,a+1,b,b,a+1,b+1);}
  const peak=new THREE.BufferGeometry();peak.setAttribute('position',new THREE.Float32BufferAttribute(pk,3));peak.setAttribute('uv',new THREE.Float32BufferAttribute(pu,2));peak.setIndex(pi);peak.computeVertexNormals();
  /* the harness: from the brim behind each ear, down in front of it, to a buckle under the chin */
  const straps=[];
  for(const s of [1,-1]){const th=s*Math.PI*0.60,e=onShell(th,rimY(th),0.002);
   const c=h.chin;   // down in front of the ear, along the jaw, to a buckle under the chin
   const pts=[V(e[0],e[1],e[2]),V(s*(h.rx+0.004),cy-0.075,cz+0.016),V(s*(h.rx-0.010),c.y+0.030,c.z-0.052),V(s*0.034,c.y-0.004,c.z-0.018),V(0,c.y-0.010,c.z-0.012)];
   straps.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),24,0.0032,5,false));}
  return {shell,rim,peak,straps,cx,cy,cz,rx,ry,rz,rimY};
 }

 /* ------------------------------------------------------------------ shaders ------------------- */
 /* One set of uniforms per rider, shared by every material she wears. */
 function riderUniforms(kit){
  const z=kit.zones,ref=SKIN_REF[kit.body];
  return {uSkin:{value:new THREE.Color(DEF_SKIN)},uSkinW:{value:1},uBootMesh:{value:0},uBootRef:{value:0.1},uSkinRef:{value:new THREE.Vector3(...ref)},
   uShirt:{value:new THREE.Color('#3d4a6e')},uPants:{value:new THREE.Color('#cfc6ae')},uBoot:{value:new THREE.Color('#3b2a14')},
   uHair:{value:new THREE.Color('#4a2e1c')},uEye:{value:new THREE.Color('#6b3f1f')},uEyeW:{value:0},uOutfit:{value:0},
   uZ1:{value:new THREE.Vector4(z.neckY,z.neckZ,z.waistY,z.bootY)},uZ2:{value:new THREE.Vector4(z.cuffX,z.armY,z.armZ,z.headY)},
   uHelmet:{value:0},uHelm:{value:new THREE.Vector4(0,0,0,0)},uHelmR:{value:new THREE.Vector4(0,0,0,0)}};
 }
 /* the skin tint: the chosen tone, shaded as the texture is shaded, keeping most of its local colour
    (lips, cheeks, knuckles) as a ratio to the texture's own average */
 const SKIN_GLSL=`
vec3 riderSkin(vec3 t){ if(uSkinW<0.5)return t;
 float L=dot(t,vec3(0.2126,0.7152,0.0722)), Lr=dot(uSkinRef,vec3(0.2126,0.7152,0.0722));
 vec3 ch=(t/max(L,1e-3))/(uSkinRef/Lr);
 /* the source paints hard shadow into the face (a superhero's hollows): take the edge off it */
 return uSkin*pow(L/Lr,0.72)*mix(vec3(1.0),ch,0.50); }`;
 const HEAD_GLSL=`uniform vec3 uSkin,uShirt,uPants,uBoot,uHair,uEye; uniform float uSkinW,uEyeW,uOutfit,uHelmet,uBootMesh,uBootRef; uniform vec3 uSkinRef; uniform vec4 uZ1,uZ2,uHelm,uHelmR;`;
 function patchBody(mat,u){
  mat.onBeforeCompile=sh=>{
   Object.assign(sh.uniforms,u);
   sh.vertexShader=sh.vertexShader
    .replace('#include <common>','#include <common>\n'+HEAD_GLSL+'\nvarying vec3 vBind; varying vec3 vBindN;')
    .replace('#include <begin_vertex>',`#include <begin_vertex>
 vBind=position; vBindN=normal;
 { float ax=abs(position.x);
   float arm=smoothstep(uZ2.y-0.20,uZ2.y-0.14,position.y)*smoothstep(0.17,0.20,ax);
   float boot=(1.0-smoothstep(uZ1.w-0.004,uZ1.w+0.002,position.y))*(1.0-arm)*(1.0-uBootMesh);
   float rim=smoothstep(uZ1.w-0.016,uZ1.w-0.004,position.y)*boot;
   /* boots stand off the leg, and a turned top; breeches and shirt a touch of cloth */
   float cloth=(1.0-step(uZ1.x,position.y))*(1.0-arm*smoothstep(uZ2.x-0.01,uZ2.x,ax));
   transformed+=normal*(boot*(0.0055+rim*0.0022)+(1.0-boot)*cloth*0.0016)*(1.0-uOutfit); }`);
   sh.fragmentShader=sh.fragmentShader
    .replace('#include <common>','#include <common>\n'+HEAD_GLSL+'\nvarying vec3 vBind; varying vec3 vBindN;\n'+SKIN_GLSL+`
float rBand(float x,float a,float b){return step(a,x)*step(x,b);}
float rHash(vec3 p){p=fract(p*0.3183099+vec3(0.1,0.2,0.3));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float rNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(rHash(i),rHash(i+vec3(1,0,0)),f.x),mix(rHash(i+vec3(0,1,0)),rHash(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(rHash(i+vec3(0,0,1)),rHash(i+vec3(1,0,1)),f.x),mix(rHash(i+vec3(0,1,1)),rHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float rwSkinZ,rwBoot,rwSole,rwMetal,rwRough;`)
    .replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
 { float ax=abs(vBind.x), y=vBind.y;
   float rN=length(vec2(vBind.x,vBind.z-uZ1.y));
   float neckY=uZ1.x+0.042*smoothstep(0.0,-0.09,vBind.z-uZ1.y);
   float arm=smoothstep(uZ2.y-0.20,uZ2.y-0.14,y)*smoothstep(0.17,0.20,ax);
   float headZ=max(step(uZ2.w,y)*(1.0-arm),step(neckY,y)*(1.0-smoothstep(0.070,0.080,rN))*(1.0-arm));
   float hand=arm*step(uZ2.x,ax);
   if(uOutfit>0.5&&headZ<0.5)discard;
   if(uBootMesh>0.5&&arm<0.5&&y<uZ1.w-0.085)discard;   // inside the boot shaft
 }`)
    .replace('#include <map_fragment>',`#include <map_fragment>
 { float ax=abs(vBind.x), y=vBind.y;
   float rN=length(vec2(vBind.x,vBind.z-uZ1.y));
   float neckY=uZ1.x+0.042*smoothstep(0.0,-0.09,vBind.z-uZ1.y);
   float arm=smoothstep(uZ2.y-0.20,uZ2.y-0.14,y)*smoothstep(0.17,0.20,ax);
   float headZ=max(step(uZ2.w,y)*(1.0-arm),step(neckY,y)*(1.0-smoothstep(0.070,0.080,rN))*(1.0-arm));
   float hand=arm*step(uZ2.x,ax);
   float skinZ=max(headZ,hand);
   float collar=(1.0-arm)*rBand(y,neckY,neckY+0.030)*(1.0-smoothstep(0.070,0.084,rN))*(1.0-step(uZ2.w,y));
   float bootY=uZ1.w-0.075*uBootMesh;
   float boot=(1.0-step(bootY,y))*(1.0-arm);
   float sole=boot*(1.0-step(0.013,y));
   float bootTop=boot*step(bootY-0.012,y)*(1.0-uBootMesh);
   float belt=(1.0-arm)*rBand(y,uZ1.z-0.016,uZ1.z+0.016)*(1.0-skinZ);
   float buckle=belt*step(0.04,vBind.z)*step(ax,0.026);
   float pants=(1.0-arm)*(1.0-boot)*(1.0-step(uZ1.z-0.016,y));
   float kneeP=pants*rBand(y,uZ1.w+0.02,uZ1.w+0.20)*step(0.25,-sign(vBind.x)*vBindN.x)*step(ax,0.15);
   float grain=rNoise(vBind*vec3(380.0,150.0,380.0));
   vec3 cloth=uShirt;
   cloth=mix(cloth,uPants*(1.0-0.16*kneeP),pants);
   cloth=mix(cloth,uBoot,boot);
   cloth=mix(cloth,uBoot*1.18+0.02,bootTop);
   cloth=mix(cloth,vec3(0.035,0.028,0.024),sole);
   cloth=mix(cloth,vec3(0.10,0.07,0.05),belt);
   cloth=mix(cloth,vec3(0.78,0.70,0.52),buckle);
   cloth=mix(cloth,vec3(0.93,0.92,0.88),collar);
   cloth*=0.95+0.06*grain*(1.0-boot);
   diffuseColor.rgb=mix(cloth,riderSkin(diffuseColor.rgb),skinZ);
   rwSkinZ=skinZ; rwBoot=boot; rwSole=sole; rwMetal=buckle;
   rwRough=mix(mix(mix(0.80,0.34,boot),0.5,belt),0.85,sole);
 }`)
    .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n roughnessFactor=mix(rwRough,roughnessFactor,rwSkinZ);')
    .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\n metalnessFactor=max(metalnessFactor,rwMetal*0.85);')
    .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n normal=normalize(mix(nonPerturbedNormal,normal,rwSkinZ));');
  };
  mat.customProgramCacheKey=()=>'rider-body-v1';
 }
 /* skin parts of an outfit (the Ranger's bare forearms), and an outfit's hands */
 function patchOutfit(mat,u,allSkin){
  mat.onBeforeCompile=sh=>{
   Object.assign(sh.uniforms,u);
   sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vBind;').replace('#include <begin_vertex>','#include <begin_vertex>\n vBind=position;');
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\n'+HEAD_GLSL+'\nvarying vec3 vBind;\n'+SKIN_GLSL)
    .replace('#include <map_fragment>',`#include <map_fragment>
 { float sk=${allSkin?'1.0':'step(uZ2.x+0.004,abs(vBind.x))*step(uZ2.y-0.14,vBind.y)'};
   diffuseColor.rgb=mix(diffuseColor.rgb,riderSkin(diffuseColor.rgb),sk); }`);
  };
  mat.customProgramCacheKey=()=>'rider-outfit-'+(allSkin?1:0);
 }
 /* hair: the grey strand texture takes the chosen colour. Under a helmet everything above the brim is
    pressed in under the shell, so long hair still falls out below it and nothing pokes through. */
 /* hair under a helmet: everything above the brim pressed in under the shell (fully in by the brim, so
    nothing shows through it) — in the shadow pass too, or the hair's tips shade the helmet from inside */
 const squashVerts=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uHelmet; uniform vec4 uHelm,uHelmR;\n'+RIM_GLSL)
  .replace('#include <begin_vertex>',`#include <begin_vertex>
 if(uHelmet>0.5){ vec3 c=uHelm.xyz, r=uHelmR.xyz, q=transformed-c; float rim=riderRim(atan(q.x,q.z),c.y);
   float above=smoothstep(rim-0.024,rim-0.004,transformed.y); vec3 d=q/r; float n=length(d);
   if(n>0.93&&above>0.0){ transformed=mix(transformed,c+d/n*0.93*r,above); } }`);};
 function hairDepth(u){
  const m=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,u);squashVerts(sh);};
  m.customProgramCacheKey=()=>'rider-hair-depth';
  return m;
 }
 function patchHair(mat,u,brows,noSquash){
  mat.onBeforeCompile=sh=>{
   Object.assign(sh.uniforms,u);
   if(!noSquash)squashVerts(sh);
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uHair;')
    .replace('#include <map_fragment>',`#include <map_fragment>
 diffuseColor.rgb=uHair*${brows?'0.72':'1.0'}*(dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722))/${HAIR_TEX_LUM.toFixed(3)});`);
  };
  mat.customProgramCacheKey=()=>'rider-hair-'+(brows?1:0)+(noSquash?'n':'');
 }
 /* the cap of drawn-back hair: tinted like the rest, its edge carved into a hairline of loose strands, the
    roots there a shade darker where the scalp shows through */
 function patchScalp(mat,u){
  mat.alphaTest=0.5; mat.side=THREE.FrontSide;
  mat.onBeforeCompile=sh=>{
   Object.assign(sh.uniforms,u);
   squashVerts(sh);
   sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float hairFade; varying float vFade; varying vec3 vHP;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\n vFade=hairFade; vHP=position;');
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uHair; varying float vFade; varying vec3 vHP;\nfloat sHash(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}')
    .replace('#include <map_fragment>',`#include <map_fragment>
 diffuseColor.rgb=uHair*(dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722))/${HAIR_TEX_LUM.toFixed(3)});
 { float nz=sHash(floor(vHP*vec3(1100.0,420.0,1100.0)))*0.7+sHash(floor(vHP*300.0))*0.5;
   diffuseColor.a=clamp(vFade*0.85+0.5+(nz-0.6)*0.42,0.0,1.0);
   diffuseColor.rgb*=mix(0.80,1.0,smoothstep(-0.5,2.5,vFade)); }`);
  };
  mat.customProgramCacheKey=()=>'rider-scalp';
 }
 function patchBoot(mat,u){
  mat.onBeforeCompile=sh=>{
   Object.assign(sh.uniforms,u);
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uBoot; uniform float uBootRef;')
    .replace('#include <map_fragment>',`#include <map_fragment>
 diffuseColor.rgb=uBoot*clamp(dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722))/uBootRef,0.0,2.4);`)
    .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n roughnessFactor=min(roughnessFactor,0.42);');
  };
  mat.customProgramCacheKey=()=>'rider-boot';
 }
 function patchEyes(mat,u){
  mat.onBeforeCompile=sh=>{
   Object.assign(sh.uniforms,u);
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uEye; uniform float uEyeW;')
    .replace('#include <map_fragment>',`#include <map_fragment>
 #ifdef USE_MAP
 { float r=distance(vMapUv,vec2(0.496,0.496)); float iris=(1.0-smoothstep(0.100,0.114,r))*smoothstep(0.036,0.048,r);
   float L=dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722));
   diffuseColor.rgb=mix(diffuseColor.rgb,uEye*clamp(L*4.2,0.0,1.6),iris*uEyeW); }
 #endif`);
  };
  mat.customProgramCacheKey=()=>'rider-eyes';
 }

 /* ------------------------------------------------------------------ one rider ------------------ */
 function build(kit,fit){
  const root=clone(kit.scene); root.name='rider-model';
  const bones={}; let body=null,eyes=null,brows=null;
  root.traverse(o=>{if(o.isBone)bones[o.name]=o;if(o.isSkinnedMesh){if(/superhero/i.test(o.name))body=o;else if(/^Eyes/.test(o.name))eyes=o;else if(/^Eyebrows/.test(o.name))brows=o;}
   if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
  const u=riderUniforms(kit);
  const mats=[], depthMat=hairDepth(u);
  mats.push(depthMat);
  const own=(m,patch,...a)=>{const c=m.clone();patch(c,u,...a);mats.push(c);return c;};
  body.material=own(kit.materials.body,patchBody);
  if(eyes)eyes.material=own(kit.materials.eyes,patchEyes);
  if(brows){brows.material=own(kit.materials.brows,patchHair,true);brows.castShadow=false;}
  const hb=bones.Head;
  /* helmet: built once per kit, dressed per rider */
  const hg=kit.helmetGeo;
  u.uHelm.value.set(hg.cx,hg.cy,hg.cz,0); u.uHelmR.value.set(hg.rx-0.006,hg.ry-0.006,hg.rz-0.006,hg.rimY(Math.PI*0.5));
  const helmMat=new THREE.MeshStandardMaterial({color:0x2e2e38,roughness:0.5,metalness:0.02,side:THREE.DoubleSide});
  const strapMat=new THREE.MeshStandardMaterial({color:0x17120f,roughness:0.6,metalness:0.05});
  mats.push(helmMat,strapMat);
  const helmet=new THREE.Group();helmet.name='rider-helmet';
  for(const g of [hg.shell,hg.rim,hg.peak]){const m=new THREE.Mesh(g,helmMat);m.castShadow=true;m.receiveShadow=true;helmet.add(m);}
  for(const g of hg.straps){const m=new THREE.Mesh(g,strapMat);m.castShadow=false;helmet.add(m);}
  const mixer=new THREE.AnimationMixer(root), actions={};
  const action=name=>{const c=kit.clips[CLIP[name]||name];if(!c)return null;if(!actions[name]){const a=mixer.clipAction(c);a.enabled=true;a.setEffectiveWeight(0);a.play();actions[name]=a;}return actions[name];};
  const dropHair=g=>g.traverse(o=>{if(!o.isMesh)return;if(o.userData.ownMat)o.material.dispose();if(o.userData.ownGeo)o.geometry.dispose();if(o.isInstancedMesh)o.dispose();});
  const rig={kit,root,bones,body,eyes,brows,u,helmet,mixer,action,actions,mats,hair:null,outfit:null,outfitId:'riding',look:null,disposed:false};

  rig.setHair=(style,color,helmetOn)=>{
   if(rig.hair){hb.remove(rig.hair);dropHair(rig.hair);}
   rig.hair=null;
   let h=RIDER_HAIR.find(x=>x.id===style)||RIDER_HAIR[0];
   const g=new THREE.Group();g.name='hair-'+h.id;
   /* space buns cannot go under a helmet: she wears them as one low bun until it comes off */
   if(helmetOn&&h.id==='buns')h=RIDER_HAIR.find(x=>x.id==='bun');
   const base=(kit.hair.Hair_Long||kit.hair[Object.keys(kit.hair)[0]]).material;   // the pack's strand texture
   const put=(geo,mat,o)=>{const m=o&&o.inst?geo:new THREE.Mesh(geo,mat);m.userData.ownMat=true;m.userData.ownGeo=!!(o&&o.ownGeo);
    if(!(o&&o.noDepth))m.customDepthMaterial=depthMat;m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;g.add(m);return m;};
   const addMesh=(name,dim)=>{const src=kit.hair[name];if(!src)return;const mat=src.material.clone();if(dim)mat.color.setScalar(dim);patchHair(mat,u,false);put(src.geometry,mat);};
   if(h.mesh)addMesh(h.mesh,h.curls?0.72:0); if(h.extra)addMesh(h.extra);
   if(h.scalp){
    const cap=base.clone();patchScalp(cap,u);put(scalpGeometry(kit,'back'),cap);
    const pc=tailPieces(kit,h.tail,helmetOn);
    for(const geo of pc.hair){const mat=base.clone();patchHair(mat,u,false);put(geo,mat,{ownGeo:true});}
    if(pc.ties.length)put(mergeGeos(pc.ties),new THREE.MeshStandardMaterial({color:0x1d1916,roughness:0.55,metalness:0}),{ownGeo:true,noDepth:true});
   }
   if(h.curls){
    const M=curlMatrices(kit,helmetOn),ico=new THREE.IcosahedronGeometry(1,1),mat=base.clone();patchHair(mat,u,false,true);
    const im=new THREE.InstancedMesh(ico,mat,Math.max(1,M.length)),cl=new THREE.Color();let seed=5;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
    M.forEach((m,i)=>{im.setMatrixAt(i,m);im.setColorAt(i,cl.setScalar(0.84+0.24*rnd()));});
    if(!M.length)im.setMatrixAt(0,new THREE.Matrix4().makeScale(0,0,0));
    im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;
    put(im,null,{inst:true,ownGeo:true,noDepth:true});
   }
   hb.add(g);rig.hair=g;
  };
  const dropMeshes=list=>{for(const m of list){m.parent&&m.parent.remove(m);const k=mats.indexOf(m.material);if(k>=0)mats.splice(k,1);m.material.dispose();}};
  const skinned=(s,mat)=>{const m=new THREE.SkinnedMesh(s.geometry,mat);m.name=s.name;
   m.bind(new THREE.Skeleton(s.skeleton.bones.map(b=>bones[b.name]),s.skeleton.boneInverses),s.bindMatrix);
   m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;body.parent.add(m);return m;};
  /* The riding kit's boots are real boots — the Stable outfit's, which are a rider's tall boots — in the
     wardrobe's boot colour. A painted boot on the body kept the shape of a bare foot, toes and all. */
  rig.setBoots=on=>{
   if(!on){if(rig.boots){dropMeshes(rig.boots);rig.boots=null;}u.uBootMesh.value=0;return;}
   if(rig.boots){u.uBootMesh.value=1;return;}
   outfitFor(kit,'peasant').then(src=>{
    if(rig.disposed||rig.boots||rig.outfitId!=='riding')return;
    const feet=src.meshes.filter(m=>/Feet/.test(m.name)); if(!feet.length)return;
    rig.boots=feet.map(sm=>{const mat=sm.material.clone();patchBoot(mat,u);mats.push(mat);return skinned(sm,mat);});
    u.uBootRef.value=src.bootRef||0.1; u.uBootMesh.value=1;
   }).catch(e=>console.warn('rider boots failed to load',e));
  };
  rig.setOutfit=(id,cb)=>{
   id=RIDER_OUTFITS.some(o=>o.id===id)?id:'riding';
   rig.outfitId=id;
   const done=()=>{u.uOutfit.value=rig.outfit?1:0;rig.setBoots(id==='riding');if(cb)cb();};
   if(rig.outfit&&rig.outfit.id===id)return done();
   if(rig.outfit){dropMeshes(rig.outfit.meshes);rig.outfit=null;}
   if(id==='riding')return done();
   outfitFor(kit,id).then(src=>{
    if(rig.disposed||rig.outfitId!==id||rig.outfit)return;
    const meshes=src.meshes.map(sm=>{const mat=sm.material.clone();patchOutfit(mat,u,/Regular/.test(sm.material.name));mats.push(mat);return skinned(sm,mat);});
    rig.outfit={id,meshes};done();
   }).catch(e=>{console.warn('rider outfit failed to load',id,e);rig.outfitId='riding';done();});
  };
  /* the whole look; a helmet or a new style rebuilds the hair, colours only move uniforms */
  rig.setLook=f=>{
   f=f||{};
   const bodyId=kit.body, style=riderHairId(f.hairStyle,bodyId), helm=f.helmet&&f.helmet!=='none'?f.helmet:(f.helmet==='none'?null:'#2e2e38');
   u.uShirt.value.set(f.shirt||'#3d4a6e'); u.uPants.value.set(f.pants||'#cfc6ae'); u.uBoot.value.set(f.boots||'#3b2a14');
   u.uSkin.value.set(f.skin||DEF_SKIN); u.uSkinW.value=1;
   u.uHair.value.set(f.hair||'#4a2e1c');
   const eye=RIDER_EYES.find(e=>e.id===f.eyes); if(eye){u.uEye.value.set(eye.col);u.uEyeW.value=eye.id==='brown'?0:1;}else u.uEyeW.value=0;
   u.uHelmet.value=helm?1:0;
   if(helm){helmMat.color.set(helm);if(helmet.parent!==hb)hb.add(helmet);}else if(helmet.parent)helmet.parent.remove(helmet);
   const key=style+'|'+(helm?1:0);   // the colour is a uniform: only the style and the helmet rebuild her hair
   if(rig.look!==key){rig.setHair(style,f.hair||'#4a2e1c',!!helm);rig.look=key;}
   rig.setOutfit(f.outfit||'riding');
  };
  rig.dispose=()=>{
   rig.disposed=true;
   try{mixer.stopAllAction();mixer.uncacheRoot(root);}catch(e){}
   if(rig.hair)dropHair(rig.hair);
   for(const m of mats){try{m.dispose();}catch(e){}}
  };
  rig.setLook(fit);
  return rig;
 }
 function outfitFor(kit,id){
  if(!kit.outfits[id])kit.outfits[id]=file('outfit-'+id+'-'+kit.body+'.glb').then(g=>{
   /* no hood (she has hair, or a helmet) and no pauldron (a ranch, not a war) */
   const meshes=[];
   g.scene.traverse(o=>{if(o.isSkinnedMesh&&!/Hood|Pauldron/i.test(o.name))meshes.push(o);});
   g.scene.updateMatrixWorld(true);
   /* how bright the boots are in the texture, so a boot colour can replace theirs and keep the stitching */
   let bootRef=0.1;
   try{const f=meshes.find(m=>/Feet/.test(m.name)),img=f&&f.material.map&&f.material.map.image;
    if(img){const c=document.createElement('canvas');c.width=256;c.height=256;const x=c.getContext('2d');x.drawImage(img,0,0,256,256);
     const d=x.getImageData(0,0,256,256).data,uv=f.geometry.attributes.uv,lin=v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
     let t=0,n=0;for(let i=0;i<uv.count;i+=3){const px=Math.min(255,Math.max(0,Math.floor(uv.getX(i)*256))),py=Math.min(255,Math.max(0,Math.floor(uv.getY(i)*256))),o=(py*256+px)*4;
      t+=0.2126*lin(d[o])+0.7152*lin(d[o+1])+0.0722*lin(d[o+2]);n++;}
     if(n)bootRef=Math.max(0.02,t/n);}}catch(e){}
   return {meshes,bootRef};
  });
  return kit.outfits[id];
 }

 /* ------------------------------------------------------------------ the old rig's language ----- */
 /* R is the game's rider object (makeRider). Give it role bones on her joints, the fit, the sync, and
    the walking; leave the seat and the IK to the game. */
 function adoptRider(R,rig,opt){
  opt=opt||{};
  const kit=rig.kit, J=kit.seat.joints;
  const by={},list=[];
  for(const r of ROLES){
   const b=new THREE.Bone();b.name=r;
   const par=ROLE_PARENT[r], jp=J[r];
   if(par){const pp=J[par];b.position.set(jp.x-pp.x,jp.y-pp.y,jp.z-pp.z);by[par].add(b);}else b.position.copy(jp);
   b.userData.rest=b.position.clone(); b.userData.h=[jp.x,jp.y,jp.z];
   by[r]=b;list.push(b);
  }
  R.sk={root:by.hips,by,list,ubc:true};
  R.rig=rig; R.mesh=rig.body; R.walkScale=1;
  /* the legacy uniform bag some callers still poke (tack-wardrobe's old recolour): harmless here */
  rig.body.material.userData.u=rig.body.material.userData.u||{};
  R.fitG.add(rig.root); R.fitG.add(by.hips);
  /* the rein leaves from the middle of each fist */
  for(const s of [1,-1]){const S=s>0?'R':'L',f=J['fist'+S],w=J['hand'+S],anchor=s>0?R.handR:R.handL;
   by['hand'+S].add(anchor);anchor.position.set(f.x-w.x,f.y-w.y,f.z-w.z);}
  /* her bones, parents first, each with its seat pose and its role (if it has one) */
  const order=[];
  const roleOf={};for(const r of ROLES)roleOf[ROLE_BONE[r]]=r;
  rig.root.traverse(o=>{if(!o.isBone)return;const s=kit.seat.local.get(o.name),w=kit.seat.world.get(o.name);
   order.push({bone:o,role:roleOf[o.name]||null,lq:s.q,lp:s.p,wq:w.q,parentBone:o.parent&&o.parent.isBone?o.parent:null});});
  const idx=new Map(order.map((e,i)=>[e.bone,i]));
  for(const e of order)e.pi=e.parentBone?idx.get(e.parentBone):-1;
  const W=order.map(()=>new THREE.Quaternion()), D={};
  const rootParentQ=new THREE.Quaternion();   // the armature node above the root bone: identity in these files
  {let p=order[0].bone.parent;const q=new THREE.Quaternion();while(p&&p!==rig.root){q.premultiply(p.quaternion);p=p.parent;}rootParentQ.copy(q);}
  let mode='seat';
  /* the role rig's rotations from rest, down the chain */
  const roleWorld=()=>{for(const r of ROLES){const b=by[r],p=ROLE_PARENT[r];D[r]=D[r]||new THREE.Quaternion();if(p)D[r].multiplyQuaternions(D[p],b.quaternion);else D[r].copy(b.quaternion);}};
  R._sync=()=>{
   if(mode!=='seat'){mode='seat';for(const k in rig.actions)rig.actions[k].setEffectiveWeight(0);}
   roleWorld();
   for(let i=0;i<order.length;i++){const e=order[i],Wp=e.pi>=0?W[e.pi]:rootParentQ;
    if(e.role){W[i].multiplyQuaternions(D[e.role],e.wq);e.bone.quaternion.copy(_q.copy(Wp).invert().multiply(W[i]));}
    else{e.bone.quaternion.copy(e.lq);W[i].multiplyQuaternions(Wp,e.lq);}
    e.bone.position.copy(e.lp);}
   /* the hips carry the rise out of the saddle: her pelvis goes where the role hips went */
   /* (the root bone sits at the origin in these files, so only its turn stands between the two) */
   const pe=order[idx.get(rig.bones.pelvis)],pp=pe.pi>=0?W[pe.pi]:rootParentQ;
   pe.bone.position.copy(_v.copy(by.hips.position).applyQuaternion(_q.copy(pp).invert()));
   rig.root.updateMatrixWorld(true);
  };
  /* ...and the other way, after the mixer has had her: the role bones follow, for anyone reading them */
  const _mi=new THREE.Matrix4(),_p=new THREE.Vector3(),_s=new THREE.Vector3(),_wqq=new THREE.Quaternion();
  const syncBack=()=>{
   R.fitG.updateMatrixWorld(true); _mi.copy(R.fitG.matrixWorld).invert();
   for(const r of ROLES){const b=rig.bones[ROLE_BONE[r]];_m.multiplyMatrices(_mi,b.matrixWorld);_m.decompose(_p,_wqq,_s);
    const e=order[idx.get(b)];D[r]=D[r]||new THREE.Quaternion();D[r].multiplyQuaternions(_wqq,_q2.copy(e.wq).invert());
    const p=ROLE_PARENT[r],rb=by[r];
    if(p)rb.quaternion.copy(_q.copy(D[p]).invert().multiply(D[r]));else{rb.quaternion.copy(D[r]);rb.position.copy(_p);}}
   R.fitG.updateMatrixWorld(true);
  };
  const turnW=(b,axisW,ang)=>{if(!b||Math.abs(ang)<1e-5)return;_q.setFromAxisAngle(axisW,ang);b.getWorldQuaternion(_wq);_wq.premultiply(_q);
   b.parent.getWorldQuaternion(_pq);b.quaternion.copy(_pq.invert().multiply(_wq));b.updateMatrixWorld(true);};
  /* on foot: idle, walk and jog, weighted by speed, the walk and the jog kept in step */
  R.locomote=(dt,o)=>{
   o=o||{}; const sp=Math.abs(o.speed||0), back=(o.speed||0)<-0.05;
   if(mode!=='clip'){mode='clip';rig.mixer.stopAllAction();for(const k in rig.actions){rig.actions[k].play();rig.actions[k].setEffectiveWeight(0);}}
   const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
   const pose=o.pose||null;
   const idle=rig.action(pose||'idle'),walk=rig.action('walk'),jog=rig.action('jog');
   const mv=sm(0.05,0.55,sp),run=sm(1.9,2.9,sp);
   const w={idle:1-mv,walk:mv*(1-run),jog:mv*run};
   for(const k in rig.actions){const a=rig.actions[k];a.setEffectiveWeight(k===(pose||'idle')?w.idle:k==='walk'?w.walk:k==='jog'?w.jog:0);}
   walk.timeScale=(back?-1:1)*Math.max(0.55,sp/1.30);
   jog.timeScale=Math.max(0.7,sp/3.0);
   if(w.walk>0.01&&w.jog>0.01)jog.time=(walk.time/walk.getClip().duration)*jog.getClip().duration;
   rig.mixer.update(Math.min(dt||0.016,0.1));
   /* The library's idle stands like a fighter: feet wide, arms held off the body, fists. Standing about
      by her horse she should look at ease, so ease it: arms in to her sides, feet a little closer (the
      soles turned back flat), and hands at rest instead of fists, walking too. */
   rig.root.updateMatrixWorld(true);
   const ease=w.idle*(pose?0:1);
   if(ease>0.01){
    rig.root.getWorldQuaternion(_wq); const fwd=V(0,0,1).applyQuaternion(_wq);
    for(const [n,s,a] of [['upperarm_l',1,0.20],['upperarm_r',-1,0.20],['thigh_l',1,0.055],['thigh_r',-1,0.055],['foot_l',1,-0.055],['foot_r',-1,-0.055]])
     turnW(rig.bones[n],fwd,-s*a*ease);
   }
   for(const [n,q] of kit.seat.relax){const b=rig.bones[n];if(b)b.quaternion.slerp(q,0.85);}
   /* a turn of the head when she is standing about */
   if(o.look){const hd=rig.bones.Head;_q.setFromAxisAngle(V(0,1,0),o.look*0.6);hd.quaternion.multiply(_q);}
   rig.root.updateMatrixWorld(true);
   syncBack();
   /* stand her on the ground: the group's origin at her feet */
   R.g.position.set(-R.fitG.position.x,-R.fitG.position.y,-R.fitG.position.z);
  };
  R.play=(name,opt2)=>{const a=rig.action(name);return a;};
  R.setLook=f=>rig.setLook(f);
  /* the fit: her hip at the group's origin, her seat where the sculpt's was */
  const F=opt.fit||{s:0.94,dy:0,dz:0};
  R._fit=()=>{const s=F.s,H=J.hips;R.fitG.scale.setScalar(s);R.fitG.position.set(-H.x*s,-H.y*s+F.dy,-H.z*s+F.dz);if(R._apply)R._apply();};
  R._apply=()=>{if(!R.sk||R._ik){return;}R._rest();R._seat(R.pose.lean,R.pose.side,R.pose.head,R.pose.rise,R.pose.spread);R.fitG.updateMatrixWorld(true);R._sync();};
  R._setHero=hero=>{R._hero=hero;R._fit();};
  R._dispose=()=>rig.dispose();
  R._fit();
  return R;
 }

 return {kit,ready:b=>kitReady[b==='m'?'m':'f']||null,build,adoptRider,outfitFor,
  hairStyles:RIDER_HAIR,outfits:RIDER_OUTFITS,eyes:RIDER_EYES,hairId:riderHairId,file};
}
