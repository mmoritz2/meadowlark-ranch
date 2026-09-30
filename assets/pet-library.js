/* Realistic pets: rigged, animated glTF bodies for the fifteen companions, listed in
 * assets/models/pets/manifest.json (one entry per pet key; the shipped manifest stays empty until a
 * licensed model has been approved and prepared with tools/prepare-pet-glb.mjs).
 *
 * What the player sees: while a model downloads the drawn pet stays, and the moment it is ready the
 * real animal takes its place, the same size, facing the way it walks, feet on the grass, walking,
 * running, hopping, swimming and flying with the clips its artist made, blended by its speed. If a
 * model is missing or broken the drawn pet simply stays.
 *
 * Geometry, textures and clips are cached per file (the fox and the glimmer fox load once); each pet
 * on screen gets its own skeleton (SkeletonUtils.clone, as the horses do), its own materials and one
 * AnimationMixer. Plain glTF, KHR_mesh_quantization and EXT_texture_webp only: no Draco, KTX2 or
 * meshopt decoder is vendored.
 *
 * createPetLibrary({THREE,GLTFLoader,clone,manifest?,manifestURL?,patch?,warn?}) -> {
 *   ready (manifest promise), has(key), entry(key), load(key,{height}) -> asset, instantiate(asset) -> inst }
 * inst = {root, dims:{h,len,w}, clips:{state:clipName}, has(s), pick(s), dur(s), hz(s), stride(s),
 *   update(dt,{w,phase,phased,speed,restart,fade}), look(yaw,pitch), fade(a), restOnly, info(), dispose()}
 *
 * A model animated by a vertex cache (one morph target per frame, no skeleton: the Animated Fox) plays
 * that clip like any other and is measured in its posed shape. When it is a resting animal only (the fox
 * sits: "restOnly": true in its entry) it has no gait of its own, so the host shows it while the pet rests
 * and keeps the drawn pet for moving; fade(a) dissolves it in and out (a dithered alpha, no sorting).
 * "ears" in an entry enlarges the ears in the vertex shader around their moving roots (the fennec made
 * from the fox): {scale, radius, sides:[{base:[x,y,z], tip:[x,y,z]}, ...]} in the file's scene frame.
 * "boneGait" walks a rigged model that has no walk, trot or run clip with its own bones (feet planted and
 * swung by the game's stride, a two-bone leg solve, body bob, spine, neck and tail): the dog, corgi, cat,
 * piglet and goat. "boneScale" scales bones over the clips (the corgi's legs and ears). "autorig" hands the
 * file to assets/pet-autorig.js first (a model with no usable skeleton). See assets/models/pets/README.md.
 * Native frame after fitting: +Z forward, +Y up, feet on y=0, metres. */
const STATES=['idle','walk','trot','run','hop','swim','sit','lie','eat','jump','takeoff','fly','glide','land'];
const FALLBACK={idle:['idle'],walk:['walk','trot','run'],trot:['trot','run','walk'],run:['run','trot','walk'],hop:['hop','run','walk'],swim:['swim','walk','idle'],
 sit:['sit','idle'],lie:['lie','sit','idle'],eat:['eat','idle'],jump:['jump','idle'],takeoff:['takeoff','fly'],fly:['fly'],glide:['glide','fly'],land:['land','fly','idle']};
const GROUND=new Set(['idle','walk','trot','run','swim','sit','lie','eat']);
const ONCE=new Set(['takeoff','land','jump']);
const norm=s=>String(s||'').toLowerCase().replace(/^.*[|:]/,'').replace(/[^a-z0-9]/g,'');
/* bone-driven gait: the locomotion states it can take over, and where each leg is in its stride (front
   left, front right, hind left, hind right), the same table the drawn pets walk by */
const BONE_STATES=['walk','trot','run'],LEG_IDS=['fl','fr','hl','hr'];
const GAIT_OFF={walk:[0.25,0.75,0,0.5],trot:[0,0.5,0.5,0],run:[0,0.06,0.5,0.56]};
/* a bone by name: exact, as three.js sanitises it, or the shortest bone whose name starts with it once
   case and punctuation are dropped ("R_hip_jnt" finds "R_hip_jnt.14_012") */
function boneFinder(obj){const bones=[];obj.traverse(o=>{if(o.isBone)bones.push(o);});
 return n=>{if(!n)return null;const k=norm(n);let best=null,bl=1e9;for(const b of bones){if(b.name===n)return b;const m=norm(b.name);if(m===k)return b;if(k&&m.startsWith(k)&&m.length<bl){best=b;bl=m.length;}}return best;};}
export function createPetLibrary({THREE,GLTFLoader,clone,manifest=null,manifestURL=new URL('./models/pets/manifest.json',import.meta.url),patch=null,warn=(...a)=>console.warn(...a)}){
 manifestURL=new URL(manifestURL,import.meta.url);
 const base=new URL('./',manifestURL),files=new Map(),assets=new Map();
 let revision='';
 const manager=new THREE.LoadingManager();
 manager.setURLModifier(url=>{if(!revision||!url.startsWith(base.href))return url;const u=new URL(url);if(!u.searchParams.has('build'))u.searchParams.set('build',revision);return u.href;});
 const loader=new GLTFLoader(manager);
 const stamp=m=>{let h=2166136261;for(const c of JSON.stringify(m))h=Math.imul(h^c.charCodeAt(0),16777619);revision=(h>>>0).toString(16);manifest=m;return m;};
 const ready=manifest?Promise.resolve(stamp(manifest)):fetch(manifestURL,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('pet manifest HTTP '+r.status);return r.json();}).then(stamp);
 ready.catch(()=>{});
 /* an entry, with a variant ({base:'fox', tint, fit:{scale}}) laid over the pet it is made from */
 function entry(key){
  const P=(manifest&&manifest.pets)||{};let e=P[key];if(!e||typeof e!=='object')return null;
  const chain=[e],seen=new Set([key]);while(e&&e.base&&!seen.has(e.base)){seen.add(e.base);e=P[e.base];if(e)chain.unshift(e);else return null;}
  const out={};for(const c of chain){for(const k in c){const v=c[k];out[k]=v&&typeof v==='object'&&!Array.isArray(v)&&out[k]&&typeof out[k]==='object'&&k!=='tint'?Object.assign({},out[k],v):v;}}
  delete out.base;out.key=key;return out;
 }
 const has=key=>{const e=entry(key);return !!(e&&e.available!==false&&e.file);};
 /* ---------------------------------------------------------------- once per file and pet ------- */
 const _v=new THREE.Vector3(),_w=new THREE.Vector3(),_m3=new THREE.Matrix3(),_m3i=new THREE.Matrix3();
 function findClip(list,name){if(!name)return null;return list.find(c=>c.name===name)||list.find(c=>norm(c.name)===norm(name))||null;}
 /* the nodes that carry a clip's travel: the top bone and its single-child chain down to the hips, and
    anything above the skeleton (an Armature node, Sketchfab's RootNode) */
 function motionNodes(scene,skins){const set=new Set();
  for(const s of skins)for(const b of s.skeleton.bones){if(b.parent&&b.parent.isBone)continue;let n=b;set.add(n);
   for(let k=0;k<4;k++){const kids=n.children.filter(o=>o.isBone);if(kids.length!==1)break;n=kids[0];set.add(n);}
   for(let p=b.parent;p&&p!==scene;p=p.parent)set.add(p);}
  return set;}
 /* the game moves the pet itself, so a clip's own travel is taken out: the straight-line drift of those
    nodes (measured in world axes, whatever the Armature's rotation and 0.01 scale) is removed and the
    sway round it kept; what was taken out of a loop is its stride, which speed-matching needs */
 function stripRoot(clip,scene,nodes){let stride=0;
  for(const tr of clip.tracks){if(!/\.position$/.test(tr.name))continue;const nm=THREE.PropertyBinding.parseTrackName(tr.name).nodeName;const node=scene.getObjectByName(nm);if(!node||!nodes.has(node))continue;
   const n=tr.times.length;if(n<2)continue;const v=tr.values=tr.values.slice();   // a cloned clip shares its arrays with the cached file: the fox and the glimmer fox each strip their own copy
   _m3.setFromMatrix4(node.parent?node.parent.matrixWorld:new THREE.Matrix4());_m3i.copy(_m3).invert();
   _v.set(v[3*n-3]-v[0],v[3*n-2]-v[1],v[3*n-1]-v[2]).applyMatrix3(_m3);   // drift, world axes
   stride=Math.max(stride,Math.hypot(_v.x,_v.z));
   const T0=tr.times[0],T1=tr.times[n-1]||1;
   for(let i=0;i<n;i++){const u=(tr.times[i]-T0)/Math.max(1e-6,T1-T0);_w.copy(_v).multiplyScalar(u).applyMatrix3(_m3i);v[3*i]-=_w.x;v[3*i+1]-=_w.y;v[3*i+2]-=_w.z;}}
  return stride;}
 function skinVerts(skins,max){const out=[];let tot=0;for(const s of skins)tot+=s.geometry.attributes.position.count;const step=Math.max(1,Math.ceil(tot/max));for(const s of skins){const n=s.geometry.attributes.position.count;for(let i=0;i<n;i+=step)out.push([s,i]);}return out;}
 function lowest(verts,meshes){let mn=Infinity;for(const [s,i] of verts){s.getVertexPosition(i,_v).applyMatrix4(s.matrixWorld);if(_v.y<mn)mn=_v.y;}
  for(const m of meshes){if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();const b=m.geometry.boundingBox;for(let k=0;k<8;k++){_v.set(k&1?b.max.x:b.min.x,k&2?b.max.y:b.min.y,k&4?b.max.z:b.min.z).applyMatrix4(m.matrixWorld);if(_v.y<mn)mn=_v.y;}}
  return mn;}
 const deg=d=>(+d||0)*Math.PI/180;
 /* the ears to enlarge, in the body mesh's own coordinates: each root, the way to its tip, how wide it is,
    and the vertex nearest the root, whose moving position (the head turns) is the centre of the growth */
 function earSetup(scene,x){
  let body=null;scene.traverse(o=>{if(o.isMesh&&(!body||o.geometry.attributes.position.count>body.geometry.attributes.position.count))body=o;});if(!body)return null;
  scene.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(body.matrixWorld).invert(),sc=new THREE.Vector3().setFromMatrixScale(inv),pos=body.geometry.attributes.position;
  const sides=[];for(const sd of x.sides.slice(0,2)){if(!sd||!sd.base||!sd.tip)continue;const b=new THREE.Vector3().fromArray(sd.base).applyMatrix4(inv),tp=new THREE.Vector3().fromArray(sd.tip).applyMatrix4(inv);
   let bi=0,bd=Infinity;for(let i=0;i<pos.count;i++){const d=_v.fromBufferAttribute(pos,i).distanceToSquared(b);if(d<bd){bd=d;bi=i;}}
   sides.push({base:b,axis:tp.clone().sub(b),anchor:bi,anchorRest:_w.fromBufferAttribute(pos,bi).clone()});}
  if(!sides.length)return null;
  /* splayed out from each other: each ear turns away from the middle between them, about its own root */
  const mid=sides.reduce((a,s)=>a.add(s.base),new THREE.Vector3()).multiplyScalar(1/sides.length);
  for(const s of sides){const up=s.axis.clone().normalize(),out=s.base.clone().sub(mid);out.addScaledVector(up,-out.dot(up));s.turn=out.lengthSq()>1e-10?new THREE.Vector3().crossVectors(up,out.normalize()).normalize():new THREE.Vector3(1,0,0);}
  return {mesh:body.name,sides,radius:(+x.radius||0.3)*Math.abs(sc.x),scale:+x.scale||1.6,splay:deg(x.splayDeg||0)};}
 /* "boneScale": {bone: s | [sx,sy,sz]} scales bones on top of whatever the clips do (the corgi's short
    legs and big ears from the Shiba); uniform scales keep the gait's joint maths exact */
 function boneScaler(obj,map){if(!map||typeof map!=='object')return null;const B=boneFinder(obj),list=[];
  for(const n in map){const b=B(n);if(!b){warn('pet models: boneScale bone "'+n+'" not found');continue;}const v=[].concat(map[n]).map(Number);list.push([b,new THREE.Vector3(v[0]||1,v.length>1?v[1]:v[0]||1,v.length>2?v[2]:v[0]||1),b.scale.clone()]);}
  return list.length?{restore(){for(const [b,,r] of list)b.scale.copy(r);},apply(){for(const [b,v] of list)b.scale.multiply(v);}}:null;}
 /* The bone-driven gait ("boneGait" in an entry): a rigged model with no walk, trot or run clip is walked
    by its own bones, the way the drawn pets and the horses walk. Every frame, over the pose its idle clip
    gives: each foot is planted where it stood and swept back under the body through the stance, then
    lifted and carried forward (the game's own stride, duty and leg order for walk, trot and gallop, the
    stride length from the leg's length and the cadence from the pet's speed, so a planted foot keeps pace
    with the ground); a two-bone solve on the upper and lower leg puts the ankle on that point, the foot
    keeps its angle through the stance and curls in the swing; the body dips and bobs (lowered further if a
    foot could not reach), rocks at the gallop, the spine bends into turns, the head nods against the step
    and the tail swings. legs: {fl,fr,hl,hr:[upper, lower, foot]} (more bones may lead the list; the last
    three are used), spine, neck, tail: [bones], head, body (defaults to the bone that carries all four legs),
    reach (1: the drawn pets' stride), lift (1), cadence (1), bob (1), over: states to walk even if a clip exists. */
 function boneGait(model,root,cfg){
  const B=boneFinder(model),legs=[],list=v=>[].concat(v||[]).map(B).filter(Boolean);
  for(let i=0;i<4;i++){const ch=[].concat(cfg.legs[LEG_IDS[i]]).map(B),n=ch.length;legs.push({i,front:i<2,A:ch[n-3],K:ch[n-2],E:ch[n-1],sgn:0,lab:0,lcb:0,base:new THREE.Vector3(),t:new THREE.Vector3(),pw:new THREE.Vector3(),lift:new THREE.Vector3(),planted:false,flex:0});}
  const spine=list(cfg.spine),tail=list(cfg.tail),neck=list(cfg.neck),head=B(cfg.head);
  let body=B(cfg.body);
  if(!body){const anc=b=>{const a=[];for(let p=b.parent;p&&p.isBone;p=p.parent)a.push(p);return a;};const sets=legs.map(l=>anc(l.A));body=sets[0].find(b=>sets.every(x=>x.includes(b)))||null;}
  const touched=new Set();for(const l of legs){touched.add(l.A);touched.add(l.K);touched.add(l.E);}for(const b of [...spine,...tail,...neck,head,body])if(b)touched.add(b);
  const rest=[...touched].map(b=>[b,b.position.clone(),b.quaternion.clone()]);
  const reachK=+cfg.reach||1,liftK=cfg.lift!=null?+cfg.lift:1,cad=+cfg.cadence||1,bobK=cfg.bob!=null?+cfg.bob:1;
  const V=()=>new THREE.Vector3(),a=V(),b=V(),c=V(),t=V(),u1=V(),u2=V(),ax=V(),lat=V(),up=V(),fwd=V(),tmp=V(),tw=V(),inv=new THREE.Matrix4();
  const pq=new THREE.Quaternion(),dq=new THREE.Quaternion(),qE=new THREE.Quaternion(),rq=new THREE.Quaternion();
  let phase=0,Lt=0,measured=false,moving=false,amount=0,last={};
  const clampv=(x,lo,hi)=>Math.max(lo,Math.min(hi,x)),lerp=(x,y,k)=>x+(y-x)*k,ang=(p,q)=>Math.acos(clampv(p.dot(q)/Math.max(1e-12,p.length()*q.length()),-1,1));
  function rotW(bone,axis,an){if(!an||!bone.parent)return;bone.parent.getWorldQuaternion(pq);dq.setFromAxisAngle(axis,an);bone.quaternion.premultiply(pq.clone().invert().multiply(dq).multiply(pq));bone.updateMatrixWorld(true);}
  function moveW(bone,d){if(!bone.parent)return;bone.getWorldPosition(u1);u2.copy(u1).add(d);bone.parent.worldToLocal(u1);bone.parent.worldToLocal(u2);bone.position.add(u2.sub(u1));bone.updateMatrixWorld(true);}
  function restore(){for(const [bn,p,q] of rest){bn.position.copy(p);bn.quaternion.copy(q);}}
  function measure(){for(const l of legs){l.A.getWorldPosition(a);l.K.getWorldPosition(b);l.E.getWorldPosition(c);l.lab=a.distanceTo(b);l.lcb=b.distanceTo(c);
    u1.copy(c).sub(a);u2.copy(b).sub(a);ax.crossVectors(u1,u2);l.sgn=ax.dot(lat)>=0?1:-1;}
   let h=0;for(const l of legs){l.A.getWorldPosition(a);h+=a.applyMatrix4(inv).y;}Lt=Math.max(0.02,h/4);measured=true;}
  /* the ankle (the foot bone's root) put on t by the upper and lower leg; the knee keeps its side */
  function solve(l,tw,flex){
   const A=l.A,K=l.K,E=l.E;E.getWorldQuaternion(qE);
   A.getWorldPosition(a);K.getWorldPosition(b);E.getWorldPosition(c);
   const lab=a.distanceTo(b),lcb=b.distanceTo(c),lat2=clampv(a.distanceTo(tw),1e-5,(lab+lcb)*0.9995);
   u1.copy(c).sub(a);u2.copy(b).sub(a);
   const acab0=ang(u1,u2),babc0=ang(tmp.copy(a).sub(b),t.copy(c).sub(b));
   const acab1=Math.acos(clampv((lcb*lcb-lab*lab-lat2*lat2)/(-2*lab*lat2),-1,1)),babc1=Math.acos(clampv((lat2*lat2-lab*lab-lcb*lcb)/(-2*lab*lcb),-1,1));
   ax.crossVectors(u1,u2);if(ax.lengthSq()<1e-10*u1.lengthSq()*u2.lengthSq()||ax.dot(lat)*l.sgn<0)ax.copy(lat).multiplyScalar(l.sgn);ax.normalize();
   rotW(A,ax,acab1-acab0);rotW(K,ax,babc1-babc0);
   E.getWorldPosition(c);A.getWorldPosition(a);u1.copy(c).sub(a);u2.copy(tw).sub(a);ax.crossVectors(u1,u2);
   if(ax.lengthSq()>1e-14){ax.normalize();rotW(A,ax,ang(u1,u2));}
   if(flex)qE.premultiply(dq.setFromAxisAngle(lat,flex));
   E.parent.getWorldQuaternion(pq);E.quaternion.copy(pq.invert().multiply(qE));E.updateMatrixWorld(true);}
  /* w: the eased weights of walk, trot and run; o.mps the pet's speed, o.turn its turning rate (rad/s) */
  function apply(dt,w,o){
   const wW=w.walk||0,wT=w.trot||0,wR=w.run||0,m=Math.min(1,wW+wT+wR);amount=m;
   if(m<0.004){moving=false;for(const l of legs)l.planted=false;return;}
   root.updateWorldMatrix(true,true);inv.copy(root.matrixWorld).invert();root.getWorldQuaternion(rq);   // the pet's group may have moved since its matrices were last made
   lat.set(1,0,0).applyQuaternion(rq);up.set(0,1,0).applyQuaternion(rq);fwd.set(0,0,1).applyQuaternion(rq);
   if(!measured)measure();
   if(!moving){for(const l of legs){l.E.getWorldPosition(l.base);l.base.applyMatrix4(inv);l.lift.copy(l.base);l.t.copy(l.base);l.planted=false;}moving=true;}   // the feet start from where they stood
   const sum=Math.max(1e-3,wW+wT+wR),gT=(wT+wR)/sum,gG=wR/sum,spd=Math.max(0,+o.mps||0),turn=+o.turn||0;
   /* the game's own stride (assets/features/pet-models.js quadGait): swing angle, duty, reach, cadence */
   const amp=lerp(lerp(0.5,0.55,gT),0.8,gG);let duty=lerp(lerp(0.62,0.46,gT),0.3,gG);
   const reach=Lt*Math.sin(amp)*reachK*lerp(lerp(0.55,0.7,gT),0.78,gG),k=clampv(spd/0.6,0,1),s0=reach*Math.max(k,0.35);
   let freq=spd>0.03?spd*duty/(2*Math.max(s0,reach*0.25)):1.2;
   const cap=6*Math.sqrt(cad)*Math.sqrt(0.3/Math.max(0.12,Lt));
   if(freq>cap){freq=cap;duty=Math.max(0.12,Math.min(0.7,2*s0*cap/Math.max(0.01,spd)));}
   phase=(phase+freq*dt)%4096;const cyc=phase,hl=lerp(0.2,0.3,gG)*Lt*Math.max(k,0.35)*liftK;
   /* the body: down a little into the stride, a bob twice a stride (once at the gallop), rocking at the gallop */
   const bob=0.5-0.5*Math.cos(4*Math.PI*(cyc-duty/2)),rock=Math.sin(2*Math.PI*cyc);
   let dy=-m*Lt*(0.025+0.03*gT)+m*bobK*bob*Lt*(0.012*(1-gG)+0.035*gG),pitch=m*rock*0.07*gG;
   /* a foot on the ground stays where it landed, in the world (the body turning or changing pace over it
      does not drag it); a foot in the air goes from where it left the ground to where it will land */
   for(const l of legs){const off=lerp(lerp(GAIT_OFF.walk[l.i],GAIT_OFF.trot[l.i],gT),GAIT_OFF.run[l.i],gG);let u=cyc+off;u-=Math.floor(u);
    let lift=0,fl=0;l.stance=u<duty;
    if(u<duty){const zf=s0*(1-2*u/duty);
     if(!l.planted){l.planted=true;l.fresh=true;l.pw.set(l.base.x,l.base.y,l.base.z+zf*m).applyMatrix4(root.matrixWorld);}
     l.t.copy(l.pw).applyMatrix4(inv);l.t.y=l.base.y;
     /* never further than a little from where the stride would have it (the pet swerving or changing pace
        faster than a step): it slips that little rather than overreach */
     const px=l.base.x,pz=l.base.z+zf*m,dx=l.t.x-px,dz=l.t.z-pz,d=Math.hypot(dx,dz),tol=0.7*s0+0.02*Lt;
     if(d>tol){const k2=tol/d;l.t.x=px+dx*k2;l.t.z=pz+dz*k2;l.pw.copy(l.t).applyMatrix4(root.matrixWorld);}
     l.lift.copy(l.t);}
    else{const q=(u-duty)/(1-duty),sm=q*q*(3-2*q);if(l.planted){l.planted=false;l.lift.copy(l.t);}
     lift=hl*Math.sin(Math.PI*q);fl=Math.sin(Math.PI*Math.min(1,q*1.3));
     l.t.set(l.lift.x+(l.base.x-l.lift.x)*sm,l.base.y,l.lift.z+(l.base.z+s0*m-l.lift.z)*sm);l.t.y+=lift*m;}
    l.flex=fl*m*(l.front?0.9:0.6);}
   /* a foot that could not reach its point takes the body down to it */
   if(body){body.getWorldPosition(b);let need=0;for(const l of legs){l.A.getWorldPosition(a);a.applyMatrix4(inv);const h2=(a.x-l.t.x)**2+(a.z-l.t.z)**2,L=(l.lab+l.lcb)*0.97/Math.max(1e-6,root.matrixWorld.getMaxScaleOnAxis()),vy=a.y+dy-l.t.y;
     const ok=Math.sqrt(Math.max(0,L*L-h2));if(vy>ok)need=Math.max(need,vy-ok);}
    dy-=Math.min(need,Lt*0.3);
    moveW(body,tmp.copy(up).multiplyScalar(dy*root.matrixWorld.getMaxScaleOnAxis()));if(pitch)rotW(body,lat,pitch);}
   /* the spine into the turn, the head against the step, the tail swinging */
   const bend=clampv(turn*0.1,-0.3,0.3)*m;if(spine.length&&bend)for(const sb of spine)rotW(sb,up,bend/spine.length);
   const nod=m*(Math.sin(4*Math.PI*cyc)*0.03*(1-gG)+Math.sin(2*Math.PI*cyc+0.6)*0.06*gG)-pitch;
   const hb=neck.length?neck:head?[head]:[];for(const hbn of hb)rotW(hbn,lat,nod/hb.length);
   for(let j=0;j<tail.length;j++)rotW(tail[j],up,m*Math.sin(2*Math.PI*cyc-j*0.6)*(0.14-0.08*gG)/Math.sqrt(tail.length));
   /* a foot that touches down short of its point (the leg could not reach it) stays where it did touch */
   for(const l of legs){solve(l,tw.copy(l.t).applyMatrix4(root.matrixWorld),l.flex);if(l.fresh){l.fresh=false;l.E.getWorldPosition(l.pw);const y=l.t.y;l.t.copy(l.pw).applyMatrix4(inv);l.t.y=y;}}
   last={gT:+gT.toFixed(2),gG:+gG.toFixed(2),freq:+freq.toFixed(2),duty:+duty.toFixed(2),reach:+s0.toFixed(3),Lt:+Lt.toFixed(3),dy:+dy.toFixed(3)};}
  /* how far each foot is from where the gait put it (metres, pet frame): QA's sliding and reach check */
  function feet(){inv.copy(root.matrixWorld).invert();return legs.map(l=>{l.E.getWorldPosition(c).applyMatrix4(inv);const w=l.E.getWorldPosition(new THREE.Vector3());return {leg:LEG_IDS[l.i],stance:!!l.stance&&amount>0.004,world:w.toArray(),at:c.toArray().map(v=>+v.toFixed(3)),target:l.t.toArray().map(v=>+v.toFixed(3)),miss:+c.distanceTo(l.t).toFixed(4)};});}
  return {restore,apply,feet,info:()=>Object.assign({amount:+amount.toFixed(2),body:body?body.name:null},last),get phase(){return phase;},get Lt(){return Lt;}};}
 function prepare(gltf,key,e,opts){
  const scene=gltf.scene,skins=[],plain=[];let tris=0,meshes=0;
  scene.updateMatrixWorld(true);
  scene.traverse(o=>{if(!o.isMesh)return;meshes++;o.castShadow=e.castShadow!==false;o.receiveShadow=true;o.frustumCulled=false;(o.isSkinnedMesh?skins:plain).push(o);const g=o.geometry;tris+=(g.index?g.index.count:g.attributes.position.count)/3;});
  if(!meshes)throw new Error('pet model has no mesh: '+key);
  const all=gltf.animations||[],clips={},meta={},nodes=motionNodes(scene,skins),src={};
  for(const s of STATES.concat(Object.keys(e.clips||{}).filter(k=>!STATES.includes(k)))){
   let c0=e.clips&&e.clips[s];if(c0==null)continue;const c=typeof c0==='string'?{name:c0}:c0;
   let clip=c.name==='@rest'?new THREE.AnimationClip(s,1,[]):findClip(all,c.name);if(!clip){warn('pet models: '+key+' has no clip "'+c.name+'" for '+s);continue;}   // "@rest": the model's own bind pose
   clip=clip.clone();
   if(c.from!=null||c.to!=null){const fps=c.fps||30;clip=THREE.AnimationUtils.subclip(clip,s,Math.round((c.from||0)*fps),Math.round((c.to!=null?c.to:clip.duration)*fps),fps);}
   clip.name=s;const stride=c.rootMotion==='keep'?0:stripRoot(clip,scene,nodes);
   clips[s]=clip;src[s]=c.name;meta[s]={speed:c.speed||1,stride,strideM:c.strideM,hz:c.hz,hold:null};}
  /* what a pet cannot be without: something to stand in, and for the flyers something to fly with */
  if(!clips.idle&&!clips.walk)throw new Error('pet model has neither an idle nor a walk clip: '+key);
  /* the gait states a bone-driven gait walks (the ones with no clip of their own, and any listed in "over") */
  let boneStates=null;
  if(e.boneGait&&typeof e.boneGait==='object'){const B=boneFinder(scene),L=e.boneGait.legs||{};
   for(const id of LEG_IDS){const ch=[].concat(L[id]||[]);if(ch.length<3)throw new Error('boneGait leg '+id+' needs at least three bones: '+key);for(const n of ch)if(!B(n))throw new Error('boneGait bone "'+n+'" not found: '+key);}
   const over=[].concat(e.boneGait.over||[]);boneStates=BONE_STATES.filter(s=>!clips[s]||over.includes(s));
   for(const s of boneStates){if(clips[s]){delete clips[s];delete src[s];}meta[s]={speed:1,stride:0,bone:true,hold:null};src[s]='boneGait';}
   if(!boneStates.length)boneStates=null;}
  if(opts.mustFly&&!clips.fly)throw new Error('flying pet model has no fly clip: '+key);
  if(!clips.idle){clips.idle=clips.walk.clone();clips.idle.name='idle';meta.idle={speed:0,stride:0,hold:0};src.idle=src.walk+'@0';}   // the first frame of the walk, held
  if(!clips.glide&&clips.fly){clips.glide=clips.fly.clone();clips.glide.name='glide';meta.glide={speed:0,stride:0,hold:e.clips.fly&&e.clips.fly.glideAt!=null?+e.clips.fly.glideAt:0.3};src.glide=src.fly+'@hold';}   // wings held spread
  /* measure in a real pose (the first frame of the idle), not the bind pose, which is often a T */
  const fit=e.fit||{},probe=clone(scene),fix=new THREE.Group(),turn=new THREE.Group();fix.add(probe);turn.add(fix);
  fix.rotation.set(deg((fit.rotateDeg||[])[0]),deg((fit.rotateDeg||[])[1]),deg((fit.rotateDeg||[])[2]));
  const PS=boneScaler(probe,e.boneScale);
  const mixer=new THREE.AnimationMixer(probe),pose=s=>{mixer.stopAllAction();const a=mixer.clipAction(clips[s]);a.reset().play();a.time=(meta[s].hold||0)*clips[s].duration;if(PS)PS.restore();mixer.update(0);if(PS)PS.apply();turn.updateMatrixWorld(true);};
  pose('idle');
  const bone=re=>{let b=null;probe.traverse(o=>{if(!b&&o.isBone&&re.test(o.name))b=o;});return b;};
  const head=bone(/head(?!.*(end|top|nub))/i),back=bone(/tail/i)||bone(/hips|pelvis/i)||bone(/spine/i);
  let yaw=0;
  if(fit.yawDeg!=null)yaw=deg(fit.yawDeg);
  else if(head&&back){const a=head.getWorldPosition(new THREE.Vector3()),b=back.getWorldPosition(new THREE.Vector3()),dx=a.x-b.x,dz=a.z-b.z;
   const bb=new THREE.Box3().setFromObject(turn);if(Math.hypot(dx,dz)>0.08*Math.max(1e-6,bb.max.y-bb.min.y))yaw=-Math.atan2(dx,dz);}   // head towards +Z
  turn.rotation.y=yaw;turn.updateMatrixWorld(true);
  const morphed=o=>!!(o.geometry&&o.geometry.morphAttributes&&o.geometry.morphAttributes.position&&o.geometry.morphAttributes.position.length);
  const pSkins=[],pPlain=[];let hasMorph=false;probe.traverse(o=>{if(o.isSkinnedMesh){o.computeBoundingBox();pSkins.push(o);}else if(o.isMesh){if(morphed(o)){hasMorph=true;pSkins.push(o);}else pPlain.push(o);}});
  /* a vertex cache's bounds cover every frame at once: measure the shape it has now, vertex by vertex */
  const box=new THREE.Box3().setFromObject(turn,hasMorph),H=Math.max(1e-6,box.max.y-box.min.y);
  const target=+fit.height||+opts.height||0.5,scale=Number.isFinite(+fit.scale)&&+fit.scale>0?+fit.scale:target/H;
  const c=box.getCenter(new THREE.Vector3()),off=fit.offset||[0,0,0];
  const offset=[-c.x*scale+(+off[0]||0),-box.min.y*scale+(+fit.groundOffset||0)+(+off[1]||0),-c.z*scale+(+off[2]||0)];
  const dims={h:+(H*scale).toFixed(3),len:+((box.max.z-box.min.z)*scale).toFixed(3),w:+((box.max.x-box.min.x)*scale).toFixed(3)};
  const ears=e.ears&&Array.isArray(e.ears.sides)&&e.ears.sides.length?earSetup(scene,e.ears):null;
  /* feet on the grass through every ground clip: the lowest point of the body sampled over each cycle,
     so a clip authored on another floor is corrected as it plays: a clip that floats all the way
     through comes down by its constant float, frames that sink are lifted, and a hop or a gallop's
     moment in the air is left alone */
  const verts=skinVerts(pSkins,1200),curves={},N=16,ref=lowest(verts,pPlain);
  if(fit.groundCurves!==false)for(const s in clips){if(!GROUND.has(s)||meta[s].hold!=null)continue;const cv=new Float32Array(N+1);mixer.stopAllAction();const a=mixer.clipAction(clips[s]);a.reset().play();
   for(let i=0;i<=N;i++){a.time=clips[s].duration*i/N;if(PS)PS.restore();mixer.update(0);if(PS)PS.apply();turn.updateMatrixWorld(true);cv[i]=(lowest(verts,pPlain)-ref)*scale;}
   let mn=Infinity;for(const v of cv)mn=Math.min(mn,v);for(let i=0;i<=N;i++)cv[i]=mn>0?mn:Math.min(cv[i],0);
   let mx=0;for(const v of cv)mx=Math.max(mx,Math.abs(v));if(mx>0.003)curves[s]=cv;}
  mixer.stopAllAction();mixer.uncacheRoot(probe);
  for(const s in meta){meta[s].strideM=meta[s].strideM||(meta[s].stride>0.02*H?meta[s].stride*scale:0);}
  const textures=new Set();scene.traverse(o=>{if(!o.isMesh)return;for(const m of [].concat(o.material))for(const k of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap','alphaMap'])if(m&&m[k])textures.add(m[k]);});
  const joints=new Set();for(const s of skins)for(const b of s.skeleton.bones)joints.add(b.uuid);
  let morphFrames=0;scene.traverse(o=>{if(o.isMesh&&morphed(o))morphFrames=Math.max(morphFrames,o.geometry.morphAttributes.position.length);});
  const asset={key,entry:e,scene,skins:skins.length,clips,meta,src,curves,bone:boneStates,scale,yaw,rotate:fix.rotation.clone(),offset,dims,ears,restOnly:!!e.restOnly,morphFrames,
   stats:{triangles:Math.round(tris),meshes,joints:joints.size,textures:[...textures].map(t=>t.image?(t.image.width||0)+'x'+(t.image.height||0):'?'),extensions:(gltf.parser&&gltf.parser.json.extensionsUsed)||[]}};
  return asset;
 }
 /* "autorig" in an entry: a model with no skeleton (or none the game can walk) is given one by
    assets/pet-autorig.js before it is fitted. That module exports autorig (or a default function) taking
    {THREE, clone, gltf, scene, animations, entry, key, options} and returning {scene, animations} (or
    nothing, having changed the copy it was given in place). It works on its own copy of the file, so a
    variant without "autorig" that shares the file is untouched; it runs once per file and options. If the
    module is missing or throws, the load fails and the drawn pet stays. */
 const rigged=new Map();let autorigMod=null;
 function autorig(g,key,e,href){
  const rk=href+'|'+JSON.stringify(e.autorig);if(rigged.has(rk))return rigged.get(rk);
  if(!autorigMod)autorigMod=import('./pet-autorig.js'+(revision?'?build='+revision:'')).catch(err=>{autorigMod=null;throw new Error('autorig module did not load ('+err.message+')');});
  const p=autorigMod.then(M=>{const fn=typeof M.autorig==='function'?M.autorig:typeof M.default==='function'?M.default:null;if(!fn)throw new Error('pet-autorig.js exports no autorig function');
   const copy={scene:clone(g.scene),animations:(g.animations||[]).map(c=>c.clone()),parser:g.parser,userData:Object.assign({},g.userData)};
   return Promise.resolve(fn({THREE,clone,gltf:copy,scene:copy.scene,animations:copy.animations,entry:e,key,options:e.autorig===true?{}:e.autorig})).then(r=>{
    const out=r&&r.scene?{scene:r.scene,animations:r.animations||copy.animations,parser:g.parser,userData:copy.userData}:copy;
    let meshes=0;out.scene.traverse(o=>{if(o.isMesh)meshes++;});if(!meshes)throw new Error('autorig returned no mesh');return out;});})
   .catch(err=>{rigged.delete(rk);throw new Error('autorig failed for '+key+': '+(err&&err.message||err));});
  rigged.set(rk,p);return p;}
 async function load(key,opts={}){
  await ready;const e=entry(key);
  if(!e)throw new Error('no realistic model listed for '+key);
  if(e.available===false||!e.file)throw new Error('realistic model not available yet: '+key);
  const ck=key+'|'+(opts.height||0);if(assets.has(ck))return assets.get(ck);
  const url=new URL(e.file,base);if(e.sha256)url.searchParams.set('build',e.sha256.slice(0,16));
  if(!files.has(url.href))files.set(url.href,loader.loadAsync(url.href).catch(err=>{files.delete(url.href);throw err;}));
  const p=files.get(url.href).then(g=>e.autorig?autorig(g,key,e,url.href):g).then(g=>prepare(g,key,e,opts)).catch(err=>{assets.delete(ck);throw err;});
  assets.set(ck,p);return p;
 }
 /* ---------------------------------------------------------------- one pet on screen ------------ */
 function tintMaterial(m,t){
  if(typeof t==='string'){if(m.color)m.color.multiply(new THREE.Color(t));return;}
  const D=new THREE.Color(t.dark||'#7b7ff0'),M=new THREE.Color(t.mid||'#bfe9ff'),L=new THREE.Color(t.light||'#ffffff'),K=t.deep?new THREE.Color(t.deep):null;
  if(t.emissive&&m.emissive){m.emissive.set(t.emissive);m.emissiveIntensity=t.emissiveIntensity!=null?t.emissiveIntensity:0.3;}
  const prev=m.onBeforeCompile;
  /* the coat recoloured by its own brightness (every hair and stripe of the texture kept): dark tips and
     socks to the first colour, the middle of the coat to the second, the lightest fur to the third */
  /* "deep" (optional) is a fourth colour for the very darkest texels (eyes, nose, lips), so "dark" can be a
     coat colour: a golden dog's shaded fur stays golden while its eyes stay black */
  const ramp=K?'tL<0.16?mix(uTintK,uTintD,tL/0.16):tL<0.55?mix(uTintD,uTintM,(tL-0.16)/0.39):mix(uTintM,uTintL,(tL-0.55)/0.45)':'tL<0.5?mix(uTintD,uTintM,tL*2.0):mix(uTintM,uTintL,tL*2.0-1.0)';
  m.onBeforeCompile=(sh,r)=>{if(prev)prev.call(m,sh,r);sh.uniforms.uTintD={value:D};sh.uniforms.uTintM={value:M};sh.uniforms.uTintL={value:L};sh.uniforms.uTintK={value:K||D};
   sh.fragmentShader='uniform vec3 uTintD;uniform vec3 uTintM;uniform vec3 uTintL;uniform vec3 uTintK;\n'+sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n{float tL=dot(diffuseColor.rgb,vec3(0.299,0.587,0.114));tL=clamp((tL-0.08)/0.62,0.0,1.0);diffuseColor.rgb='+ramp+';}');};   // after the vertex colours too (the piglet is painted by them)
  const k0=Object.prototype.hasOwnProperty.call(m,'customProgramCacheKey')?m.customProgramCacheKey.bind(m):()=>'';m.customProgramCacheKey=()=>k0()+'|tint'+D.getHexString()+M.getHexString()+L.getHexString()+(K?K.getHexString():'');
 }
 function tweak(m,x){if(!x)return m;
  if((x.sheen!=null||x.clearcoat!=null)&&m.isMeshStandardMaterial&&!m.isMeshPhysicalMaterial){const p=new THREE.MeshPhysicalMaterial();THREE.MeshStandardMaterial.prototype.copy.call(p,m);p.defines={STANDARD:'',PHYSICAL:''};p.name=m.name;m.dispose();m=p;}
  for(const k of ['roughness','metalness','envMapIntensity','sheen','sheenRoughness','clearcoat','clearcoatRoughness','emissiveIntensity','alphaTest','specularIntensity'])if(x[k]!=null&&k in m)m[k]=+x[k];
  for(const k of ['color','sheenColor','emissive'])if(x[k]!=null&&m[k]&&m[k].isColor)m[k].set(x[k]);
  if(x.side==='double')m.side=THREE.DoubleSide;
  return m;}
 /* the ears grown around their moving roots, after the vertex cache has posed the mesh: a vertex's share
    comes from where it sits at rest (up the ear from its root, inside its width, tapering to the tip), so
    the same fur grows whatever the head is doing; the tip of a fennec's ear stays a fennec's */
 function earMaterial(m,E,U){
  const prev=m.onBeforeCompile,k0=Object.prototype.hasOwnProperty.call(m,'customProgramCacheKey')?m.customProgramCacheKey.bind(m):()=>'';
  m.onBeforeCompile=(sh,r)=>{if(prev)prev.call(m,sh,r);Object.assign(sh.uniforms,U);
   sh.vertexShader='uniform vec3 uEarRest[2];uniform vec3 uEarAxis[2];uniform vec3 uEarNow[2];uniform vec3 uEarTurn[2];uniform float uEarRad;uniform float uEarScale;uniform float uEarSplay;uniform int uEarN;\n'+sh.vertexShader.replace('#include <morphtarget_vertex>','#include <morphtarget_vertex>\n'+
    '{for(int i=0;i<2;i++){if(i>=uEarN)break;vec3 d=position-uEarRest[i];float L2=max(1e-6,dot(uEarAxis[i],uEarAxis[i]));float u=dot(d,uEarAxis[i])/L2;float rr=length(d-uEarAxis[i]*u);float lim=uEarRad*(1.0-0.55*clamp(u,0.0,1.0))+uEarRad*0.12;'+
    'float w=smoothstep(0.0,0.42,u)*(1.0-smoothstep(lim*0.8,lim*1.15,rr))*(1.0-smoothstep(1.25,1.45,u));vec3 v=(transformed-uEarNow[i])*mix(1.0,uEarScale,w);'+
    'float a=uEarSplay*w;vec3 k=uEarTurn[i];v=v*cos(a)+cross(k,v)*sin(a)+k*dot(k,v)*(1.0-cos(a));transformed=uEarNow[i]+v;}}');};
  m.customProgramCacheKey=()=>k0()+'|ears'+E.sides.length;}
 function instantiate(asset){
  const e=asset.entry,model=clone(asset.scene),fix=new THREE.Group(),fit=new THREE.Group(),root=new THREE.Group();
  root.name='pet-real';fit.name='pet-real-fit';fix.rotation.copy(asset.rotate);fix.add(model);fit.add(fix);root.add(fit);
  fit.position.set(asset.offset[0],asset.offset[1],asset.offset[2]);fit.rotation.y=asset.yaw;fit.scale.setScalar(asset.scale);
  /* materials are the pet's own (a tint or the pair glow never reaches another pet); geometry and textures stay shared */
  const materials=[],copies=new Map(),mt=e.materials||{};
  const E=asset.ears,EU=E?{uEarRest:{value:E.sides.map(s=>s.base.clone()).concat([new THREE.Vector3(),new THREE.Vector3()]).slice(0,2)},uEarAxis:{value:E.sides.map(s=>s.axis.clone()).concat([new THREE.Vector3(0,1,0),new THREE.Vector3(0,1,0)]).slice(0,2)},
   uEarNow:{value:E.sides.map(s=>s.base.clone()).concat([new THREE.Vector3(),new THREE.Vector3()]).slice(0,2)},uEarTurn:{value:E.sides.map(s=>s.turn.clone()).concat([new THREE.Vector3(1,0,0),new THREE.Vector3(1,0,0)]).slice(0,2)},uEarRad:{value:E.radius},uEarScale:{value:E.scale},uEarSplay:{value:E.splay},uEarN:{value:E.sides.length}}:null;
  const copy=m=>{if(copies.has(m))return copies.get(m);let n=m.clone();n=tweak(n,mt.all||mt);if(mt.byName&&mt.byName[m.name])n=tweak(n,mt.byName[m.name]);
   if(e.tint&&!(e.tintSkip||[]).includes(m.name))tintMaterial(n,e.tint);if(E)earMaterial(n,E,EU);if(asset.restOnly)n.alphaHash=true;   // dissolved in and out: a dither, so it needs no sorting against the drawn pet
   if(patch)patch(n,e);copies.set(m,n);materials.push(n);return n;};
  const skins=[];let body=null;
  model.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);if(o.isSkinnedMesh){skins.push(o);if(!body||o.geometry.attributes.position.count>body.geometry.attributes.position.count)body=o;}}});
  let earMesh=null;if(E)model.traverse(o=>{if(!earMesh&&o.isMesh&&o.name===E.mesh)earMesh=o;});
  const earAnchor=()=>{if(!earMesh)return;for(let i=0;i<E.sides.length;i++){const sd=E.sides[i],v=EU.uEarNow.value[i];earMesh.getVertexPosition(sd.anchor,v);v.sub(sd.anchorRest).add(sd.base);}};   // the root moves as the anchor vertex moves
  const mixer=new THREE.AnimationMixer(model),actions={},weights={};
  for(const s in asset.clips){const a=mixer.clipAction(asset.clips[s]);if(ONCE.has(s)){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;}a.enabled=true;a.setEffectiveWeight(0);a.play();actions[s]=a;weights[s]=0;}
  const bs=asset.bone||[],isB=s=>bs.includes(s),BG=bs.length?boneGait(model,root,e.boneGait):null,SC=boneScaler(model,e.boneScale);
  for(const s of bs)weights[s]=0;
  const has=s=>isB(s)||!!asset.clips[s]&&asset.meta[s].hold==null||(s==='idle'&&!!asset.clips.idle);
  const pick=s=>{for(const k of (FALLBACK[s]||[s])){if(isB(k))return k;if(asset.clips[k]&&(asset.meta[k].hold==null||k==='idle'||k===s))return k;}return asset.clips.idle?'idle':null;};
  const dur=s=>asset.clips[s]?asset.clips[s].duration:isB(s)?0.5:1;
  const hz=s=>asset.meta[s]&&asset.meta[s].hz?asset.meta[s].hz:1/Math.max(0.05,dur(s));
  const stride=s=>asset.meta[s]&&asset.meta[s].strideM||0;
  const find=re=>{let b=null;model.traverse(o=>{if(!b&&o.isBone&&re.test(o.name))b=o;});return b;};
  const bn=e.bones||{},byName=n=>n?model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n)):null;
  const head=byName(bn.head)||find(/head(?!.*(end|top|nub))/i),neck=byName(bn.neck)||find(/neck/i);
  const lookBones=[neck&&neck!==head?[neck,0.4]:null,head?[head,neck&&neck!==head?0.6:1]:null].filter(Boolean),saved=lookBones.map(([b])=>b.quaternion.clone());
  let lastState='idle',frozen=false;
  const _pq=new THREE.Quaternion(),_rq=new THREE.Quaternion(),_dq=new THREE.Quaternion(),_e=new THREE.Euler(0,0,0,'YXZ');
  /* each frame: the weights asked for (eased so states cross-fade), the locomotion clips all at one
     phase of the stride so blended gaits never scissor their legs, the rest at their own speed */
  function update(dt,o={}){
   for(let i=0;i<lookBones.length;i++)lookBones[i][0].quaternion.copy(saved[i]);
   if(BG)BG.restore();if(SC)SC.restore();
   let W=o.w||{};const fade=o.fade||0.25,k=1-Math.exp(-dt/Math.max(0.02,fade));
   /* a bone-walked state eases in like a clip; under it the body is posed by the idle clip */
   if(bs.length){let add=0;for(const s of bs){const tw=W[s]||0;weights[s]+=(tw-weights[s])*(o.snap?1:k);if(weights[s]<1e-3&&tw===0)weights[s]=0;add+=tw;}if(add>0){W=Object.assign({},W);W.idle=(W.idle||0)+add;for(const s of bs)delete W[s];}}
   if(o.restart)for(const s of [].concat(o.restart))if(actions[s]){actions[s].reset().play();weights[s]=Math.max(weights[s],0);}
   let best=null,bw=-1;
   for(const s in actions){const a=actions[s],m=asset.meta[s],tw=W[s]||0;weights[s]+= (tw-weights[s])*(o.snap?1:k);if(weights[s]<1e-3&&tw===0)weights[s]=0;a.setEffectiveWeight(weights[s]);
    if(m.hold!=null){a.timeScale=0;a.time=m.hold*dur(s);}
    else if(o.phased&&o.phased.includes(s)&&o.phase!=null){a.timeScale=0;a.time=(((o.phase%1)+1)%1)*dur(s);}
    else a.timeScale=(o.speed&&o.speed[s]!=null?o.speed[s]:1)*(m.speed||1);
    if(weights[s]>bw){bw=weights[s];best=s;}}
   mixer.update(dt);if(SC)SC.apply();
   if(BG){const gw={};let tot=0,top=0,bb=null;for(const s of bs){gw[s]=weights[s];tot+=weights[s];if(weights[s]>top){top=weights[s];bb=s;}}if(tot>0.5)best=bb;BG.apply(dt,gw,o);}
   earAnchor();
   /* ground correction for the clips on the grass, weighted as they are blended */
   let y=0;for(const s in asset.curves){const wv=weights[s];if(!wv)continue;const cv=asset.curves[s],u=(((actions[s].time/dur(s))%1)+1)%1*(cv.length-1),i=Math.floor(u),f=u-i;y-=wv*(cv[i]+(cv[Math.min(cv.length-1,i+1)]-cv[i])*f);}
   root.position.y=y;lastState=best||lastState;
  }
  /* the head turned toward the camera or the rider, in the pet's own frame, split between neck and head */
  function look(yaw,pitch){if(!lookBones.length||(!yaw&&!pitch))return;root.getWorldQuaternion(_rq);
   for(const [b,share] of lookBones){_e.set(-pitch*share,yaw*share,0,'YXZ');_dq.setFromEuler(_e);_dq.premultiply(_rq).multiply(_pq.copy(_rq).invert());
    b.parent.getWorldQuaternion(_pq);const inv=_pq.clone().invert();b.quaternion.premultiply(inv.multiply(_dq).multiply(_pq));}}
  /* a resting-only body dissolves in over the drawn pet and out again; its shadow comes with it */
  let shown=1;
  function fade(a){a=Math.max(0,Math.min(1,+a||0));if(a===shown)return;shown=a;for(const m of materials)m.opacity=a;root.visible=a>0.004;model.traverse(o=>{if(o.isMesh)o.castShadow=a>0.5&&e.castShadow!==false;});}
  function info(){return {key:asset.key,state:lastState,clips:Object.assign({},asset.src),dims:asset.dims,scale:+asset.scale.toFixed(4),yaw:+asset.yaw.toFixed(3),...asset.stats,materials:materials.length,restOnly:asset.restOnly,morphFrames:asset.morphFrames,ears:E?E.sides.length:0,shown:+shown.toFixed(2),
   gait:BG?BG.info():null,weights:Object.fromEntries(Object.entries(weights).filter(([,v])=>v>0.01).map(([k,v])=>[k,+v.toFixed(2)])),strides:Object.fromEntries(Object.keys(asset.meta).map(s=>[s,+(stride(s)||0).toFixed(3)]))};}
  function dispose(){mixer.stopAllAction();mixer.uncacheRoot(model);for(const s of skins)if(s.skeleton)s.skeleton.dispose();for(const m of materials)m.dispose();if(root.parent)root.parent.remove(root);}
  return {root,model,body,mixer,actions,weights,materials,dims:asset.dims,clips:asset.src,asset,has,pick,dur,hz,stride,update,look,fade,info,dispose,gait:BG,restOnly:asset.restOnly,get shown(){return shown;},get state(){return lastState;},bones:{head,neck}};
 }
 return {ready,has,entry,load,instantiate,get manifest(){return manifest;},base};
}
