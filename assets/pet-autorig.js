/* Meadowlark Ranch: a skeleton for a pet model that came without one.

   Some of the licensed pet models have no bones at all (the Animated Fox and the Animated Sheep are baked
   vertex caches, the museum hare and owl are static scans). pet-library.js calls autorig() for an entry
   that carries "autorig": {...} before the model is fitted; this module
     1. bakes the meshes into one frame and drops any vertex-cache frames (they would fight the bones),
        optionally cuts away a scan's pedestal and grows the fennec's ears in the geometry itself;
     2. finds the joints: for a standing four-legged animal by analysing the mesh (the body axis from the
        spread of the points, the four leg columns under it, the belly, the head at the high end, the tail
        at the other), or from joint positions listed in the entry when the model is posed in a way no
        analysis can read (a sitting fox, a crouched hare); a species template (quadruped, hare) gives the
        rough proportions the analysis cannot see;
     3. builds the bones (every bind rotation identity, so a pose is just rotations) and smooth skin
        weights: the nearest bone segments measured against each bone's own thickness (so the belly stays
        with the spine and not the thigh pressed against it), limbs kept to their own side, tails behind
        the hips, then smoothed over the welded surface and cut to four influences;
     4. writes the clips the game drives, baked as keyframes from a pose solver: the torso laid out from
        its bone lengths, every leg put on its paw by two-bone IK (the paw planted while it is on the
        ground, so nothing skates when the game matches the stride to the speed), the head held steady,
        the tail swinging. Four-legged: idle, walk, trot, run (a gallop) and, when the model sits in its
        bind pose, sit. Hare: idle and a hop cycle (as "run", so the game adds its own hop arc).
   Every walk, trot and run clip moves its root forward by one stride, which the library measures and
   strips, so the stride it matches to the pet's speed is the one the paws really take.

   autorig({THREE, scene, animations, entry, key, options}) -> {scene, animations}
   options: {template:'quadruped'|'hare', forward:[x,y,z]?, joints:{name:[x,y,z]}?, standingBind:bool?,
     crop:{belowY?, box?:[[minx,miny,minz],[maxx,maxy,maxz]]}?, ears:{scale,radius,splayDeg,sides:[{base,tip}]}?,
     grow:{head:1.15}?, gait:{walk:{...},trot:{...},run:{...}}?, radii:{...}?, neck:{deg}, head:{deg}, tail:{deg}}
   Joint names (scene frame, what the loader shows before fitting; a left joint alone is mirrored):
     hips spine chest neck head nose  shoulderL elbowL wristL toeL  hipL kneeL hockL toeHL  tail1 tail2 tail3 tailTip
   The scene it returns: one group, a root bone at the ground under the hips, SkinnedMeshes on one skeleton,
   bones named ar_<joint>; scene.userData.autorig says what was found (for QA). */
const LEGS={fL:['shoulderL','elbowL','wristL','toeL'],fR:['shoulderR','elbowR','wristR','toeR'],hL:['hipL','kneeL','hockL','toeHL'],hR:['hipR','kneeR','hockR','toeHR']};
const BONES=[['root',null,null],['hips','root','spine'],['spine','hips','chest'],['chest','spine','neck'],['neck','chest','head'],['head','neck','nose'],
 ['shoulderL','chest','elbowL'],['elbowL','shoulderL','wristL'],['wristL','elbowL','toeL'],['shoulderR','chest','elbowR'],['elbowR','shoulderR','wristR'],['wristR','elbowR','toeR'],
 ['hipL','hips','kneeL'],['kneeL','hipL','hockL'],['hockL','kneeL','toeHL'],['hipR','hips','kneeR'],['kneeR','hipR','hockR'],['hockR','kneeR','toeHR'],
 ['tail1','hips','tail2'],['tail2','tail1','tail3'],['tail3','tail2','tailTip']];
const GROUP={hips:'torso',spine:'torso',chest:'torso',neck:'neck',head:'head',shoulderL:'upper',shoulderR:'upper',hipL:'thigh',hipR:'thigh',elbowL:'lower',elbowR:'lower',kneeL:'shank',kneeR:'shank',
 wristL:'foot',wristR:'foot',hockL:'foot',hockR:'foot',tail1:'tail',tail2:'tail',tail3:'tail'};
/* bone thickness as a share of the torso's length (hips to the base of the neck) */
const RADII={quadruped:{torso:0.36,neck:0.26,head:0.24,upper:0.15,thigh:0.2,lower:0.085,shank:0.085,foot:0.06,tail:0.1},hare:{torso:0.4,neck:0.3,head:0.3,upper:0.12,thigh:0.26,lower:0.1,shank:0.1,foot:0.07,tail:0.12},
 /* the raccoon: a deep, low, furry body on short legs, a big round head that turns as one piece (the mask does not stretch), a thick tail */
 raccoon:{torso:0.42,neck:0.3,head:0.34,upper:0.13,thigh:0.19,lower:0.075,shank:0.075,foot:0.055,tail:0.12}};
const GAITS={
 quadruped:{
  walk:{T:0.8,off:{hL:0,fL:0.25,hR:0.5,fR:0.75},duty:0.64,stride:1.3,lift:0.13,bob:0.018,sway:0.012,pitch:0,flex:0.02,tailSwing:0.1,neckBob:0.03},
  trot:{T:0.42,off:{hL:0,fR:0,hR:0.5,fL:0.5},duty:0.42,stride:2.3,lift:0.2,bob:0.03,sway:0.006,pitch:0,flex:0.03,tailSwing:0.06,neckBob:0.04},
  run:{T:0.3,off:{hL:0,hR:0.08,fR:0.42,fL:0.52},duty:0.26,stride:3.9,lift:0.3,bob:0.05,sway:0,pitch:0.06,flex:0.16,tailSwing:0.05,neckBob:0.06,crouch:0.06}},
 hare:{walk:null,trot:null,run:null},
 /* the raccoon's: an unhurried plantigrade walk on short legs (whole soles down, short quick steps, the head low and nodding, the
    hunched back rolling), a trot, and a bounding gallop where the long back folds and stretches and the hind feet land together.
    The trot and gallop strides are long for the legs (1.7 and 3.0 leg lengths a cycle), so the planted paws keep up with a pet that
    runs beside a horse (its entry's "game": {"realGait"} lets it step faster); the crouch, the gallop's pitch and back flex are
    kept small and the front paws step a little back under the chest (backF), so the low shoulders never drop far enough for a
    reaching foreleg to lie flat along the grass */
 raccoon:{
  walk:{T:0.72,off:{hL:0,fL:0.22,hR:0.5,fR:0.72},duty:0.66,stride:0.78,lift:0.11,bob:0.012,sway:0.014,pitch:0.01,flex:0.025,tailSwing:0.12,neckBob:0.035,crouch:0.045},
  trot:{T:0.4,off:{hL:0,fR:0,hR:0.5,fL:0.5},duty:0.46,stride:1.7,lift:0.16,bob:0.02,sway:0.008,pitch:0,flex:0.03,tailSwing:0.08,neckBob:0.04,crouch:0.02,backF:0.05},
  run:{T:0.32,off:{hL:0,hR:0.06,fL:0.48,fR:0.56},duty:0.3,stride:3.0,lift:0.22,bob:0.035,sway:0,pitch:0.03,flex:0.07,tailSwing:0.06,neckBob:0.05,crouch:0.015,backF:0.1}}};
export function autorig({THREE,scene,animations,entry,key,options}){
 /* ---- bird template (owl lane): a bird is rigged, winged and given its flight clips by assets/pet-bird-rig.js ---- */
 if(options&&options.template==='bird')return import('./pet-bird-rig.js'+new URL(import.meta.url).search).then(M=>(M.birdRig||M.default)({THREE,scene,animations,entry,key,options}));
 /* ---- end bird template ---- */
 const O=options||{},tpl=O.template==='hare'?'hare':'quadruped',kind=O.template==='raccoon'?'raccoon':tpl;   // a raccoon is a quadruped with its own proportions, gaits and sit
 const V=(x,y,z)=>new THREE.Vector3(x,y,z),arr=a=>V(+a[0]||0,+a[1]||0,+a[2]||0);
 scene.updateMatrixWorld(true);
 /* ---------------------------------------------------------------- 1. the meshes in one frame -------- */
 const src=[];scene.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh)src.push(o);});
 if(!src.length)throw new Error('no static mesh to rig');
 const parts=src.map(m=>{const g0=m.geometry,g=new THREE.BufferGeometry();
  for(const nm in g0.attributes){const a=g0.attributes[nm];if(nm==='position'||nm==='normal'){const f=new Float32Array(a.count*3);for(let i=0;i<a.count;i++){f[3*i]=a.getX(i);f[3*i+1]=a.getY(i);f[3*i+2]=a.getZ(i);}g.setAttribute(nm,new THREE.BufferAttribute(f,3));}
   else if(nm==='uv'||nm==='color'||nm==='tangent'){const n=a.itemSize,f=new Float32Array(a.count*n);for(let i=0;i<a.count;i++)for(let k=0;k<n;k++)f[n*i+k]=a.getComponent(i,k);g.setAttribute(nm,new THREE.BufferAttribute(f,n));}}
  if(g0.index)g.setIndex(Array.from(g0.index.array));
  for(const gr of g0.groups)g.addGroup(gr.start,gr.count,gr.materialIndex);
  g.applyMatrix4(m.matrixWorld);return {m,g};});
 /* a scan's pedestal: triangles under a height, or inside a box, are dropped */
 let Hs0=1;{const b0=new THREE.Box3();for(const p of parts){p.g.computeBoundingBox();b0.union(p.g.boundingBox);}Hs0=Math.max(1e-9,b0.max.y-b0.min.y);}
 if(O.crop){const bl=O.crop.belowY,bx=O.crop.box?[arr(O.crop.box[0]),arr(O.crop.box[1])]:null,C=O.crop.colour||null;
  for(const p of parts){const pos=p.g.attributes.position,uv=p.g.attributes.uv,idx=p.g.index?p.g.index.array:Array.from({length:pos.count},(_,i)=>i),keep=[];
   /* the pedestal's own colour (a brown rock or stump under white fur), read from the texture, below a height */
   let px=null,PW=256;const img=C&&p.m.material&&p.m.material.map&&p.m.material.map.image;
   if(img&&uv&&typeof document!=='undefined'){try{const cv=document.createElement('canvas');cv.width=cv.height=PW;const cx=cv.getContext('2d',{willReadFrequently:true});cx.drawImage(img,0,0,PW,PW);px=cx.getImageData(0,0,PW,PW).data;}catch(e){px=null;}}
   const rock=(u,v)=>{if(!px)return false;const x=Math.min(PW-1,Math.max(0,Math.floor((((u%1)+1)%1)*PW))),y=Math.min(PW-1,Math.max(0,Math.floor((((v%1)+1)%1)*PW))),o=4*(y*PW+x),r=px[o]/255,g=px[o+1]/255,b=px[o+2]/255,l=0.299*r+0.587*g+0.114*b;
    return (l<(C.maxLum!=null?C.maxLum:0.5)&&r-b>(C.minWarm!=null?C.minWarm:0.06))||l<(+C.darkLum||0);};
   for(let t=0;t<idx.length;t+=3){let cy=0,cx=0,cz=0,cu=0,cv=0;for(let k=0;k<3;k++){cx+=pos.getX(idx[t+k]);cy+=pos.getY(idx[t+k]);cz+=pos.getZ(idx[t+k]);if(uv){cu+=uv.getX(idx[t+k]);cv+=uv.getY(idx[t+k]);}}cx/=3;cy/=3;cz/=3;cu/=3;cv/=3;
    let drop=bl!=null&&cy<bl;if(bx&&cx>bx[0].x&&cx<bx[1].x&&cy>bx[0].y&&cy<bx[1].y&&cz>bx[0].z&&cz<bx[1].z)drop=true;
    if(!drop&&C&&cy<C.belowY&&rock(cu,cv))drop=true;if(!drop)keep.push(idx[t],idx[t+1],idx[t+2]);}
   /* what is left of the pedestal: small islands not joined to the animal (the biggest piece) are dropped too */
   if(C){const n=pos.count,par=new Int32Array(n).map((_,i)=>i),f=i=>{while(par[i]!==i){par[i]=par[par[i]];i=par[i];}return i;},un=(a,b)=>{a=f(a);b=f(b);if(a!==b)par[a]=b;};
    const q=1e4/Math.max(1e-9,Hs0),key=new Map(),wd=new Int32Array(n);for(let i=0;i<n;i++){const k=Math.round(pos.getX(i)*q)+'_'+Math.round(pos.getY(i)*q)+'_'+Math.round(pos.getZ(i)*q);if(key.has(k)){wd[i]=key.get(k);un(i,wd[i]);}else{key.set(k,i);wd[i]=i;}}
    for(let t=0;t<keep.length;t+=3){un(keep[t],keep[t+1]);un(keep[t+1],keep[t+2]);}const cnt=new Map();for(let t=0;t<keep.length;t+=3){const r=f(keep[t]);cnt.set(r,(cnt.get(r)||0)+1);}
    let big=-1,bc=-1;for(const [r,c] of cnt)if(c>bc){bc=c;big=r;}const k2=[];for(let t=0;t<keep.length;t+=3)if(f(keep[t])===big||cnt.get(f(keep[t]))>bc*0.05)k2.push(keep[t],keep[t+1],keep[t+2]);keep.length=0;for(let i=0;i<k2.length;i++)keep.push(k2[i]);}
   p.g.setIndex(keep);p.g.clearGroups();}
  /* the cut-away vertices are dropped from the buffers too, so nothing measures the pedestal's bounds (the
     library fits the model to its bounding box: the pedestal's stray vertices once left the hare floating) */
  for(const p of parts)compact(p.g);}
 function compact(g){const ix=g.index?g.index.array:null;if(!ix)return;const n=g.attributes.position.count,map=new Int32Array(n).fill(-1);let m=0;
  for(let i=0;i<ix.length;i++)if(map[ix[i]]<0)map[ix[i]]=m++;if(m===n)return;
  for(const nm in g.attributes){const a=g.attributes[nm],k=a.itemSize,f=new Float32Array(m*k);for(let i=0;i<n;i++){const j=map[i];if(j<0)continue;for(let c=0;c<k;c++)f[j*k+c]=a.array[i*k+c];}g.setAttribute(nm,new THREE.BufferAttribute(f,k,a.normalized));}
  const ni=new Uint32Array(ix.length);for(let i=0;i<ix.length;i++)ni[i]=map[ix[i]];g.setIndex(new THREE.BufferAttribute(ni,1));}
 /* the fennec: the fox's ears grown and splayed in the geometry (tapering to the tip, root kept) */
 if(O.ears&&Array.isArray(O.ears.sides)){const E=O.ears,sc=+E.scale||1.6,rad=+E.radius||0.3,spl=(+E.splayDeg||0)*Math.PI/180;
  const sides=E.sides.slice(0,2).map(s=>({b:arr(s.base),ax:arr(s.tip).sub(arr(s.base))}));const mid=sides.reduce((a,s)=>a.add(s.b),V(0,0,0)).multiplyScalar(1/sides.length);
  for(const s of sides){const up=s.ax.clone().normalize(),out=s.b.clone().sub(mid);out.addScaledVector(up,-out.dot(up));s.k=out.lengthSq()>1e-10?V(0,0,0).crossVectors(up,out.normalize()).normalize():V(1,0,0);}
  const ss=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);},p=V(0,0,0),d=V(0,0,0),v=V(0,0,0),c=V(0,0,0);
  for(const P of parts){const pos=P.g.attributes.position;for(let i=0;i<pos.count;i++){p.fromBufferAttribute(pos,i);for(const s of sides){d.copy(p).sub(s.b);const L2=Math.max(1e-9,s.ax.lengthSq()),u=d.dot(s.ax)/L2,rr=d.clone().addScaledVector(s.ax,-u).length(),lim=rad*(1-0.55*Math.min(1,Math.max(0,u)))+rad*0.12;
    const w=ss(0,0.42,u)*(1-ss(lim*0.8,lim*1.15,rr))*(1-ss(1.25,1.45,u));if(w<=0)continue;v.copy(d).multiplyScalar(1+(sc-1)*w);const a=spl*w,k=s.k;c.crossVectors(k,v);v.multiplyScalar(Math.cos(a)).add(c.multiplyScalar(Math.sin(a))).addScaledVector(k,k.dot(d.copy(v))*(1-Math.cos(a)));p.copy(s.b).add(v);}
   pos.setXYZ(i,p.x,p.y,p.z);}P.g.computeVertexNormals();}}
 /* a scan that stood on a sloping rock, turned level about its hips (listed joints turn with it):
    level:{pitchDeg (nose up), rollDeg, pivot:[x,y,z]} */
 let LV=null;
 if(O.level&&O.forward){const f=arr(O.forward).setY(0).normalize(),ax=V(0,0,0).crossVectors(f,V(0,1,0)).normalize(),rd=Math.PI/180;
  const pv=O.level.pivot?arr(O.level.pivot):O.joints&&O.joints.hips?arr(O.joints.hips):V(0,0,0);
  const q=new THREE.Quaternion().setFromAxisAngle(ax,(+O.level.pitchDeg||0)*rd).premultiply(new THREE.Quaternion().setFromAxisAngle(f,(+O.level.rollDeg||0)*rd));
  LV=new THREE.Matrix4().makeTranslation(pv.x,pv.y,pv.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(q)).multiply(new THREE.Matrix4().makeTranslation(-pv.x,-pv.y,-pv.z));
  for(const p of parts)p.g.applyMatrix4(LV);}
 /* soles:{y, dome, rings} the paws cut flat where they stood on the rock: everything below the height (in the
    levelled frame) goes, every triangle that crosses it is cut along it (new points on the line, their texture
    and normal blended), so the rim is a clean line with no teeth, and every opening left on it is closed by a
    sole in the paw's own fur colour (the brightest texel around the opening, its normal up so a lifted paw shows
    fur and not a dark hole). The sole is not one flat fan: rings of points between the rim and the middle, lifted
    a few millimetres into the paw (a shallow dome, dome in the scan's units), are added before the skin weights,
    so it bends with the leg like skin instead of stretching into a sheet */
 if(O.soles&&O.soles.y!=null){const yc=+O.soles.y;
  for(const p of parts){cutAt(p.g,yc);const pos=p.g.attributes.position;
   p.g.setIndex(dropIslands(pos,Array.from(p.g.index.array),0.02));compact(p.g);
   capOpenings(p,yc,O.soles);}}
 /* faceZ: the scan turned about the vertical so the animal faces +Z (listed joints turn with it), so the library measures its
    length and width on a box that lies along the body, not one drawn round a diagonal box */
 let TURN=null;
 if(O.faceZ&&O.forward){const f=arr(O.forward).setY(0).normalize();TURN=new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(f,V(0,0,1)));for(const p of parts)p.g.applyMatrix4(TURN);}
 function cutAt(g,yc){const pos=g.attributes.position,n0=pos.count,ix=g.index?Array.from(g.index.array):Array.from({length:n0},(_,i)=>i),names=Object.keys(g.attributes),extra={};
  for(const nm of names)extra[nm]=[];let n=n0;const made=new Map(),up=i=>pos.getY(i)>=yc;
  /* the crossing point, worked out from the lower end to the upper one, so both sides of a texture seam land on exactly the same point */
  const cross=(a,b)=>{const k=a<b?a*n0+b:b*n0+a;let v=made.get(k);if(v!==undefined)return v;
   let lo=a,hi=b;const ya=pos.getY(a),yb=pos.getY(b);if(ya>yb||(ya===yb&&(pos.getX(a)>pos.getX(b)||(pos.getX(a)===pos.getX(b)&&pos.getZ(a)>pos.getZ(b))))){lo=b;hi=a;}
   const y0=pos.getY(lo),y1=pos.getY(hi),t=y1>y0?(yc-y0)/(y1-y0):0;
   for(const nm of names){const at=g.attributes[nm],s=at.itemSize,E=extra[nm];for(let c=0;c<s;c++){const va=at.array[lo*s+c],vb=at.array[hi*s+c];E.push(va+(vb-va)*t);}
    if(nm==='position')E[E.length-2]=yc;
    if(nm==='normal'){const L=Math.hypot(E[E.length-3],E[E.length-2],E[E.length-1])||1;for(let c=1;c<=3;c++)E[E.length-c]/=L;}}
   v=n++;made.set(k,v);return v;};
  const out=[];
  for(let t=0;t<ix.length;t+=3){const v=[ix[t],ix[t+1],ix[t+2]],u=v.map(up),nu=u[0]+u[1]+u[2];
   if(nu===3){out.push(v[0],v[1],v[2]);continue;}if(nu===0)continue;
   const r=nu===1?u.indexOf(true):u.indexOf(false),A=v[r],B=v[(r+1)%3],C=v[(r+2)%3];
   if(nu===1)out.push(A,cross(A,B),cross(C,A));   // one corner above: the tip that is left
   else{const pAB=cross(A,B),pCA=cross(C,A);out.push(pAB,B,C,pAB,C,pCA);}}   // two above: the quad that is left, in two
  if(n>n0)for(const nm of names){const at=g.attributes[nm],s=at.itemSize,f=new Float32Array(n*s);f.set(at.array.subarray(0,n0*s));f.set(extra[nm],n0*s);g.setAttribute(nm,new THREE.BufferAttribute(f,s));}
  g.setIndex(out);g.clearGroups();}
 function dropIslands(pos,keep,frac){const n=pos.count,par=new Int32Array(n).map((_,i)=>i),f=i=>{while(par[i]!==i){par[i]=par[par[i]];i=par[i];}return i;},un=(a,b)=>{a=f(a);b=f(b);if(a!==b)par[a]=b;};
  const q=1e4/Math.max(1e-9,Hs0),key=new Map();for(let i=0;i<n;i++){const k=Math.round(pos.getX(i)*q)+'_'+Math.round(pos.getY(i)*q)+'_'+Math.round(pos.getZ(i)*q);if(key.has(k))un(i,key.get(k));else key.set(k,i);}
  for(let t=0;t<keep.length;t+=3){un(keep[t],keep[t+1]);un(keep[t+1],keep[t+2]);}const cnt=new Map();for(let t=0;t<keep.length;t+=3){const r=f(keep[t]);cnt.set(r,(cnt.get(r)||0)+1);}
  let bc=0;for(const c of cnt.values())bc=Math.max(bc,c);const out=[];for(let t=0;t<keep.length;t+=3)if(cnt.get(f(keep[t]))>=bc*frac)out.push(keep[t],keep[t+1],keep[t+2]);return out;}
 function texel(m){const img=m&&m.map&&m.map.image;if(!img||typeof document==='undefined')return null;try{const PW=256,cv=document.createElement('canvas');cv.width=cv.height=PW;const cx=cv.getContext('2d',{willReadFrequently:true});cx.drawImage(img,0,0,PW,PW);const px=cx.getImageData(0,0,PW,PW).data;
  return (u,v)=>{const x=Math.min(PW-1,Math.max(0,Math.floor((((u%1)+1)%1)*PW))),y=Math.min(PW-1,Math.max(0,Math.floor((((v%1)+1)%1)*PW))),o=4*(y*PW+x);return [px[o]/255,px[o+1]/255,px[o+2]/255];};}catch(e){return null;}}
 function capOpenings({m,g},yc,SO){SO=SO||{};const pos=g.attributes.position,uv=g.attributes.uv,ix=g.index.array,n=pos.count,eps=1e-6*Hs0+1e-7;
  const q=1e5/Math.max(1e-9,Hs0),key=new Map(),wid=new Int32Array(n);let nw=0;for(let i=0;i<n;i++){const k=Math.round(pos.getX(i)*q)+'_'+Math.round(pos.getY(i)*q)+'_'+Math.round(pos.getZ(i)*q);let w=key.get(k);if(w===undefined){w=nw++;key.set(k,w);}wid[i]=w;}
  const rep=new Int32Array(nw);for(let i=n-1;i>=0;i--)rep[wid[i]]=i;
  const on=w=>Math.abs(pos.getY(rep[w])-yc)<=eps,cnt=new Map(),ek=(a,b)=>a<b?a*nw+b:b*nw+a;
  for(let t=0;t<ix.length;t+=3)for(let k=0;k<3;k++){const a=wid[ix[t+k]],b=wid[ix[t+(k+1)%3]];if(a===b)continue;const e=ek(a,b);cnt.set(e,(cnt.get(e)||0)+1);}
  /* the openings: edges on the cut used by one triangle, followed against the triangles' own winding */
  const nxt=new Map();for(let t=0;t<ix.length;t+=3)for(let k=0;k<3;k++){const a=wid[ix[t+k]],b=wid[ix[t+(k+1)%3]];if(a===b||cnt.get(ek(a,b))!==1||!on(a)||!on(b))continue;if(!nxt.has(b))nxt.set(b,a);}
  const tex=texel(m),loops=[],seen=new Set();
  for(const s of nxt.keys()){if(seen.has(s))continue;const L=[];let c=s,guard=0;while(c!==undefined&&!seen.has(c)&&guard++<20000){seen.add(c);L.push(c);c=nxt.get(c);}if(c===s&&L.length>=3)loops.push(L);}
  if(!loops.length)return;
  /* the rim smoothed along itself on the ground plane (the cut through a scan's nearly flat underside wanders in and out;
     once a heel lifts that shows as teeth), every copy of a rim point (texture seams) moved with it */
  {const byW=new Map();for(let i=0;i<n;i++){const w=wid[i];let a=byW.get(w);if(!a){a=[];byW.set(w,a);}a.push(i);}
   const it=SO.rimSmooth!=null?+SO.rimSmooth:6;
   for(const L of loops){const m0=L.length;let xz=L.map(w=>[pos.getX(rep[w]),pos.getZ(rep[w])]);
    for(let k=0;k<it;k++)xz=xz.map((p,i)=>{const a=xz[(i+m0-1)%m0],b=xz[(i+1)%m0];return [0.5*p[0]+0.25*(a[0]+b[0]),0.5*p[1]+0.25*(a[1]+b[1])];});
    L.forEach((w,i)=>{for(const v of byW.get(w)){pos.setX(v,xz[i][0]);pos.setZ(v,xz[i][1]);}});}
   pos.needsUpdate=true;}
  const P=[],N=[],U=[],I=[],info=[];let base=n;
  const dome=SO.dome!=null?+SO.dome:0.006,K=Math.max(0,Math.round(SO.rings!=null?+SO.rings:3)),ss0=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*(2-t);};
  /* a triangle of the sole, turned to face down (clockwise seen from above) */
  const tri=(a,b,c)=>{const ax=P[3*(a-n)],az=P[3*(a-n)+2],cr=(P[3*(b-n)]-ax)*(P[3*(c-n)+2]-az)-(P[3*(b-n)+2]-az)*(P[3*(c-n)]-ax);if(cr>=0)I.push(a,b,c);else I.push(a,c,b);};
  const addP=(x,y,z,bu)=>{P.push(x,y,z);N.push(0,1,0);U.push(bu[0],bu[1]);return base++;};
  for(const L of loops){let best=rep[L[0]];
   /* the sole's colour: the fur just above the opening (within 3 cm of the cut, over the opening's own footprint), a light
      texel (the 85th brightest in a hundred) rather than the rim's own, which the scan shades dark */
   if(tex&&uv){let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;for(const w of L){const x=pos.getX(rep[w]),z=pos.getZ(rep[w]);x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);}
    const pad=0.01*Hs0/0.4,cand=[];for(let i=0;i<n;i+=1){const y=pos.getY(i);if(y<yc||y>yc+0.03*Hs0/0.4)continue;const x=pos.getX(i),z=pos.getZ(i);if(x<x0-pad||x>x1+pad||z<z0-pad||z>z1+pad)continue;const c=tex(uv.getX(i),uv.getY(i));cand.push([0.299*c[0]+0.587*c[1]+0.114*c[2],i]);}
    if(cand.length){cand.sort((a,b)=>a[0]-b[0]);best=cand[Math.min(cand.length-1,Math.floor(cand.length*0.85))][1];}}
   const bu=uv?[uv.getX(best),uv.getY(best)]:[0,0],pts=L.map(w=>[pos.getX(rep[w]),pos.getZ(rep[w])]),m0=pts.length;
   /* the middle of the outline (its area centroid), and whether every rim point sees it (a star-shaped outline takes rings) */
   let A2=0,cx=0,cz=0;for(let i=0;i<m0;i++){const a=pts[i],b=pts[(i+1)%m0],cr=a[0]*b[1]-b[0]*a[1];A2+=cr;cx+=(a[0]+b[0])*cr;cz+=(a[1]+b[1])*cr;}
   if(Math.abs(A2)>1e-14){cx/=3*A2;cz/=3*A2;}else{cx=pts.reduce((s,p)=>s+p[0],0)/m0;cz=pts.reduce((s,p)=>s+p[1],0)/m0;}
   const sg=Math.sign(A2)||1;let star=K>0;for(let i=0;i<m0&&star;i++){const a=pts[i],b=pts[(i+1)%m0];if(((a[0]-cx)*(b[1]-cz)-(a[1]-cz)*(b[0]-cx))*sg<=0)star=false;}
   const h=Math.min(dome,0.3*Math.sqrt(Math.abs(A2)/2)),rim=pts.map(p=>addP(p[0],yc,p[1],bu));
   if(star){let prev=rim;
    for(let k=1;k<=K;k++){const f=k/(K+1),lift=h*(1-(1-f)*(1-f)),ring=pts.map(p=>addP(p[0]+(cx-p[0])*f,yc+lift,p[1]+(cz-p[1])*f,bu));
     for(let i=0;i<m0;i++){const j=(i+1)%m0;tri(prev[i],prev[j],ring[j]);tri(prev[i],ring[j],ring[i]);}prev=ring;}
    const c=addP(cx,yc+h,cz,bu);for(let i=0;i<m0;i++)tri(prev[i],prev[(i+1)%m0],c);}
   else{/* an outline that folds back on itself (a hind paw with the haunch's underside): clipped into triangles, then every long
       chord split at its middle until none is longer than a fifth of the opening's size, the new inner points relaxed and lifted
       by their distance from the rim, so the sole is a mesh of small pieces that follow the leg */
    const Vt=pts.map(p=>p.slice()),T=earcut(pts).map(t=>t.slice()),isRimE=(a,b)=>a<m0&&b<m0&&(Math.abs(a-b)===1||Math.abs(a-b)===m0-1);
    let rimL=0;for(let i=0;i<m0;i++){const a=pts[i],b=pts[(i+1)%m0];rimL+=Math.hypot(a[0]-b[0],a[1]-b[1]);}
    const Lt=Math.max(3*rimL/m0,Math.sqrt(Math.abs(A2)/2)/5),el=(a,b)=>Math.hypot(Vt[a][0]-Vt[b][0],Vt[a][1]-Vt[b][1]);
    for(let guard=0;guard<6000;guard++){let bi=-1,bk=0,bL=Lt;for(let t=0;t<T.length;t++)for(let k=0;k<3;k++){const a=T[t][k],b=T[t][(k+1)%3];if(isRimE(a,b))continue;const d=el(a,b);if(d>bL){bL=d;bi=t;bk=k;}}
     if(bi<0)break;const a=T[bi][bk],b=T[bi][(bk+1)%3],mi=Vt.length;Vt.push([(Vt[a][0]+Vt[b][0])/2,(Vt[a][1]+Vt[b][1])/2]);
     for(let t=T.length-1;t>=0;t--){const tr=T[t],ka=tr.indexOf(a),kb=tr.indexOf(b);if(ka<0||kb<0)continue;const c=tr[3-ka-kb];
      if((ka+1)%3===kb){T[t]=[a,mi,c];T.push([mi,b,c]);}else{T[t]=[b,mi,c];T.push([mi,a,c]);}}}
    const nb2=Vt.map(()=>new Set());for(const [a,b,c] of T){nb2[a].add(b).add(c);nb2[b].add(a).add(c);nb2[c].add(a).add(b);}
    for(let it=0;it<3;it++)for(let i=m0;i<Vt.length;i++){let sx=0,sz=0;for(const o of nb2[i]){sx+=Vt[o][0];sz+=Vt[o][1];}const k=nb2[i].size||1;Vt[i][0]=0.5*Vt[i][0]+0.5*sx/k;Vt[i][1]=0.5*Vt[i][1]+0.5*sz/k;}
    const dR=p=>{let d=Infinity;for(let i=0;i<m0;i++){const a=pts[i],b=pts[(i+1)%m0],ex=b[0]-a[0],ez=b[1]-a[1],t=Math.min(1,Math.max(0,((p[0]-a[0])*ex+(p[1]-a[1])*ez)/Math.max(1e-18,ex*ex+ez*ez)));d=Math.min(d,Math.hypot(a[0]+ex*t-p[0],a[1]+ez*t-p[1]));}return d;};
    const dI=Vt.map((p,i)=>i<m0?0:dR(p)),dMax=Math.max(1e-9,...dI),ids=Vt.map((p,i)=>i<m0?rim[i]:addP(p[0],yc+h*ss0(0,dMax,dI[i]),p[1],bu));
    for(const [a,b,c] of T)tri(ids[a],ids[b],ids[c]);}
   info.push({points:m0,star,area:+(Math.abs(A2)/2).toExponential(2),at:[+cx.toFixed(4),+cz.toFixed(4)]});}
  const add=P.length/3,grow=(nm,vals,k)=>{const a=g.attributes[nm];if(!a)return;const f=new Float32Array((n+add)*a.itemSize);f.set(a.array.subarray(0,n*a.itemSize));
   for(let i=0;i<add;i++)for(let c=0;c<a.itemSize;c++)f[(n+i)*a.itemSize+c]=vals?vals[i*k+c]:(nm==='color'?1:nm==='tangent'?(c===0||c===3?1:0):0);g.setAttribute(nm,new THREE.BufferAttribute(f,a.itemSize));};
  grow('position',P,3);grow('normal',N,3);grow('uv',U,2);for(const nm in g.attributes)if(!['position','normal','uv'].includes(nm))grow(nm,null,0);
  const ni=new Uint32Array(ix.length+I.length);ni.set(ix);ni.set(I,ix.length);g.setIndex(new THREE.BufferAttribute(ni,1));
  g.userData.soles=(g.userData.soles||0)+loops.length;g.userData.soleLoops=(g.userData.soleLoops||[]).concat(info);}
 /* ear clipping for a sole's outline (points in the ground plane) */
 function earcut(pts){const n=pts.length;let Vx=[...Array(n).keys()],area=0;for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n];area+=a[0]*b[1]-b[0]*a[1];}const s=area>0?1:-1,out=[];
  const cr=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);const inT=(p,a,b,c)=>{const d1=cr(a,b,p)*s,d2=cr(b,c,p)*s,d3=cr(c,a,p)*s;return d1>=0&&d2>=0&&d3>=0;};
  let guard=0;while(Vx.length>3&&guard++<4*n){let cut=false;for(let i=0;i<Vx.length;i++){const i0=Vx[(i+Vx.length-1)%Vx.length],i1=Vx[i],i2=Vx[(i+1)%Vx.length],a=pts[i0],b=pts[i1],c=pts[i2];
    if(cr(a,b,c)*s<=0)continue;let bad=false;for(const j of Vx){if(j===i0||j===i1||j===i2)continue;if(inT(pts[j],a,b,c)){bad=true;break;}}if(bad)continue;out.push([i0,i1,i2]);Vx.splice(i,1);cut=true;break;}
   if(!cut)break;}
  for(let i=1;i+1<Vx.length;i++)out.push([Vx[0],Vx[i],Vx[i+1]]);return out;}
 /* the points to analyse and weight: the vertices still used by a triangle */
 const used=parts.map(p=>{const u=new Uint8Array(p.g.attributes.position.count);const ix=p.g.index?p.g.index.array:null;if(ix)for(let i=0;i<ix.length;i++)u[ix[i]]=1;else u.fill(1);return u;});
 const box=new THREE.Box3();parts.forEach((p,j)=>{const pos=p.g.attributes.position;for(let i=0;i<pos.count;i++)if(used[j][i])box.expandByPoint(V(pos.getX(i),pos.getY(i),pos.getZ(i)));});
 const up=V(0,1,0),ground=box.min.y,Hs=box.max.y-box.min.y;
 /* ---------------------------------------------------------------- 2. the joints ---------------------- */
 const sample=[];{let tot=0;parts.forEach((p,j)=>{tot+=p.g.attributes.position.count;});const step=Math.max(1,Math.floor(tot/9000));parts.forEach((p,j)=>{const pos=p.g.attributes.position;for(let i=0;i<pos.count;i+=step)if(used[j][i])sample.push(V(pos.getX(i),pos.getY(i),pos.getZ(i)));});}
 let fwd;
 if(O.forward)fwd=TURN?V(0,0,1):arr(O.forward).setY(0).normalize();
 else{/* the body axis: the long way of the points seen from above; the head is the end that stands higher */
  let mx=0,mz=0;for(const p of sample){mx+=p.x;mz+=p.z;}mx/=sample.length;mz/=sample.length;let cxx=0,czz=0,cxz=0;for(const p of sample){const a=p.x-mx,b=p.z-mz;cxx+=a*a;czz+=b*b;cxz+=a*b;}
  const ang=0.5*Math.atan2(2*cxz,cxx-czz);fwd=V(Math.cos(ang),0,Math.sin(ang));let hi=[-Infinity,-Infinity],pr=sample.map(p=>(p.x-mx)*fwd.x+(p.z-mz)*fwd.z),lo=Math.min(...pr),hiP=Math.max(...pr);
  sample.forEach((p,i)=>{const u=(pr[i]-lo)/(hiP-lo);if(u>0.85)hi[1]=Math.max(hi[1],p.y);if(u<0.15)hi[0]=Math.max(hi[0],p.y);});if(hi[0]>hi[1])fwd.negate();}
 const right=V(0,0,0).crossVectors(up,fwd).normalize().negate();   // +X of the animal's own frame is its left: right = fwd x up ... kept as the side the "L" joints are on
 /* body frame helpers: x to the animal's left, y up, z forward */
 const toB=p=>V(p.dot(right),p.y,p.dot(fwd)),fromB=(x,y,z)=>right.clone().multiplyScalar(x).add(fwd.clone().multiplyScalar(z)).setY(y);
 let J={};
 if(O.joints){for(const k in O.joints)J[k]=arr(O.joints[k]);if(LV)for(const k in J)J[k].applyMatrix4(LV);if(TURN)for(const k in J)J[k].applyMatrix4(TURN);}
 else J=analyse();
 /* mirror a left joint that has no right one (across the plane through the hips, chest and head) */
 {const c=toB(J.hips||J.chest||V(0,0,0)).x;for(const k of Object.keys(J))if(/L$/.test(k)){const r=k.replace(/L$/,'R');if(!J[r]){const b=toB(J[k]);J[r]=fromB(2*c-b.x,b.y,b.z);}}}
 for(const [n] of BONES)if(n!=='root'&&!J[n])throw new Error('autorig: joint "'+n+'" not found');
 for(const n of ['nose','toeL','toeR','toeHL','toeHR','tailTip'])if(!J[n])throw new Error('autorig: end "'+n+'" not found');
 {const h=toB(J.hips);J.root=fromB(h.x,ground,h.z);}
 function analyse(){
  /* a standing four-legged animal: the legs are the columns of points under the belly */
  const P=sample.map(toB);let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;for(const p of P){x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);z0=Math.min(z0,p.z);z1=Math.max(z1,p.z);}
  const L=z1-z0,cx=(x0+x1)/2,W=x1-x0;
  /* the belly: the lowest body point along the middle, between the leg columns */
  const low=P.filter(p=>p.y<ground+0.22*Hs);if(low.length<20)throw new Error('autorig: no legs under the body');
  /* front and back legs: two groups along the body; left and right by side */
  let zs=low.map(p=>p.z).sort((a,b)=>a-b),zc=[zs[Math.floor(zs.length*0.2)],zs[Math.floor(zs.length*0.8)]];
  for(let it=0;it<12;it++){const s=[0,0],n=[0,0];for(const p of low){const k=Math.abs(p.z-zc[0])<Math.abs(p.z-zc[1])?0:1;s[k]+=p.z;n[k]++;}for(let k=0;k<2;k++)if(n[k])zc[k]=s[k]/n[k];}
  const legs={};
  for(const [nm,front,left] of [['hL',0,1],['hR',0,0],['fL',1,1],['fR',1,0]]){
   const col=low.filter(p=>(Math.abs(p.z-zc[front])<Math.abs(p.z-zc[1-front]))&&((p.x>cx)===!!left));if(col.length<5)throw new Error('autorig: leg '+nm+' not found');
   const lowest=col.slice().sort((a,b)=>a.y-b.y).slice(0,Math.max(3,Math.floor(col.length*0.15)));const foot=lowest.reduce((a,p)=>a.add(p),V(0,0,0)).multiplyScalar(1/lowest.length);
   legs[nm]={foot,col:P.filter(p=>Math.hypot(p.x-foot.x,p.z-foot.z)<0.09*L)};}
  /* belly and back heights at a place along the body */
  const at=(z,band)=>P.filter(p=>Math.abs(p.z-z)<band*L&&Math.abs(p.x-cx)<0.2*W);
  const out={};const J2={};
  for(const nm in legs){const {foot,col}=legs[nm];const s=at(foot.z,0.05);let top=-Infinity,bel=Infinity;for(const p of s){top=Math.max(top,p.y);}
   /* the belly: the lowest point over the middle that is well above the paws */
   for(const p of s)if(p.y>ground+0.25*Hs)bel=Math.min(bel,p.y);if(!isFinite(bel))bel=ground+0.45*Hs;
   const jy=bel+0.4*(top-bel),front=nm[0]==='f';
   const slice=(y,band)=>{const c=col.filter(p=>Math.abs(p.y-y)<band*Hs);if(!c.length)return V(foot.x,y,foot.z);const m=c.reduce((a,p)=>a.add(p),V(0,0,0)).multiplyScalar(1/c.length);return V(m.x,y,m.z);};
   const k1=front?0.28:0.3,k2=front?0.6:0.62;
   const low1=slice(ground+(jy-ground)*k1,0.03),mid=slice(ground+(jy-ground)*k2,0.03),topJ=V((foot.x+cx)/2*0+foot.x*0.7+cx*0.3,jy,foot.z+(front?0:0));
   const toe=V(foot.x,ground,foot.z+0.02*L);
   const n=LEGS[nm];J2[n[0]]=topJ;J2[n[1]]=mid;J2[n[2]]=low1;J2[n[3]]=toe;out[nm]={bel,top};}
  const zh=(legs.hL.foot.z+legs.hR.foot.z)/2,zf=(legs.fL.foot.z+legs.fR.foot.z)/2;
  const mid=z=>{const s=at(z,0.04);let t=-Infinity,b=Infinity;for(const p of s){t=Math.max(t,p.y);if(p.y>ground+0.3*Hs)b=Math.min(b,p.y);}return {t,b:isFinite(b)?b:ground+0.45*Hs};};
  const mh=mid(zh),mf=mid(zf),ms=mid((zh+zf)/2);
  J2.hips=V(cx,mh.b+0.55*(mh.t-mh.b),zh);J2.chest=V(cx,mf.b+0.55*(mf.t-mf.b),zf);J2.spine=V(cx,ms.b+0.58*(ms.t-ms.b),(zh+zf)/2);
  /* the head: the front of the animal above the chest; the neck starts at the front of the chest */
  const front=P.filter(p=>p.z>zf+0.04*L&&p.y>mf.b);let nose=V(cx,0,-Infinity);for(const p of front)if(p.z>nose.z)nose=p.clone();
  const headPts=front.filter(p=>p.z>nose.z-0.14*L);const hc=headPts.reduce((a,p)=>a.add(p),V(0,0,0)).multiplyScalar(1/Math.max(1,headPts.length));
  J2.nose=V(cx,nose.y,nose.z);J2.head=V(cx,hc.y+0.1*(mf.t-mf.b),nose.z-0.14*L);J2.neck=V(cx,mf.b+0.7*(mf.t-mf.b),zf+0.07*L);
  if(J2.head.z<J2.neck.z+0.03*L)J2.head.z=J2.neck.z+0.03*L;
  /* the tail: from the rump to the hindmost point */
  const back=P.filter(p=>p.z<zh-0.06*L&&p.y>mh.b);let tip=V(cx,mh.t,Infinity);for(const p of back)if(p.z<tip.z)tip=p.clone();
  const rump=V(cx,mh.b+0.7*(mh.t-mh.b),zh-0.1*L);if(tip.z>rump.z-0.02*L)tip=V(cx,rump.y-0.05*L,rump.z-0.06*L);
  J2.tail1=rump;J2.tailTip=V(cx,tip.y,tip.z);J2.tail2=rump.clone().lerp(J2.tailTip,0.34);J2.tail3=rump.clone().lerp(J2.tailTip,0.68);
  const R={};for(const k in J2)R[k]=fromB(J2[k].x,J2[k].y,J2[k].z);return R;}
 /* ---------------------------------------------------------------- 3. bones and skin weights --------- */
 const bones={},list=[];
 for(const [n,par] of BONES){const b=new THREE.Bone();b.name='ar_'+n;const p=J[n];if(par){b.position.copy(p).sub(J[par]);bones[par].add(b);}else b.position.copy(p);bones[n]=b;list.push(b);}
 const segs=BONES.filter(b=>b[2]).map(([n,par,ch])=>({n,i:list.indexOf(bones[n]),pi:par?list.indexOf(bones[par]):-1,a:J[n],b:J[ch],end:!BONES.some(x=>x[0]===ch)}));
 /* blend:{thigh:0.5,...}: near its own joint a bone of that group shares its hold with its parent (the hare's big haunch turns
    half with the hips and half with the thigh, so a swinging leg bends the flank instead of folding it like a flap) */
 const BL=O.blend||{},ssW=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
 const torsoL=J.hips.distanceTo(J.spine)+J.spine.distanceTo(J.chest)+J.chest.distanceTo(J.neck);
 const RD=Object.assign({},RADII[kind],O.radii||{});for(const s of segs)s.r=Math.max(1e-6,(RD[GROUP[s.n]]||0.1)*torsoL);
 const cB=toB(J.hips).x,hipZ=toB(J.hips).z;
 const sideL=Math.sign(toB(J.shoulderL).x+toB(J.hipL).x-2*cB)||1,side=n=>/L$/.test(n)?sideL:/R$/.test(n)?-sideL:0;
 const out=new THREE.Group();out.name='autorig';out.add(bones.root);
 const skeleton=new THREE.Skeleton(list);
 const nb=list.length,tmp=V(0,0,0),ab=V(0,0,0),ap=V(0,0,0);
 const meshes=[];
 for(let j=0;j<parts.length;j++){const {m,g}=parts[j],pos=g.attributes.position,n=pos.count;
  /* weld coincident vertices (texture seams) so smoothing never opens a crack */
  const key=new Map(),wid=new Int32Array(n);let nw=0;const q=1e5/Math.max(1e-9,Hs);
  for(let i=0;i<n;i++){const k=Math.round(pos.getX(i)*q)+'_'+Math.round(pos.getY(i)*q)+'_'+Math.round(pos.getZ(i)*q);let w=key.get(k);if(w===undefined){w=nw++;key.set(k,w);}wid[i]=w;}
  const rep=new Int32Array(nw).fill(-1);for(let i=0;i<n;i++)if(rep[wid[i]]<0)rep[wid[i]]=i;
  const W=new Float32Array(nw*nb);
  for(let w=0;w<nw;w++){const i=rep[w];tmp.fromBufferAttribute(pos,i);const b=toB(tmp),sx=b.x-cB;
   let tot=0;for(const s of segs){const sd=side(s.n);if(sd&&sd*sx<-0.04*torsoL)continue;if(GROUP[s.n]==='tail'&&b.z>hipZ+0.02*torsoL)continue;
    ab.copy(s.b).sub(s.a);ap.copy(tmp).sub(s.a);const tr=ap.dot(ab)/Math.max(1e-12,ab.lengthSq()),t=Math.min(1,Math.max(0,tr));const d=ap.addScaledVector(ab,-t).length()/s.r;
    /* past its far joint a bone gives way to the next one (the head beyond the neck), and before its own joint to its parent */
    const fall=(tr>1&&!s.end?Math.exp(-Math.pow((tr-1)/0.3,2)):1)*(tr<0&&s.n!=='hips'?Math.exp(-Math.pow(tr/0.3,2)):1);
    const v=Math.max(1e-9,fall)/Math.pow(Math.max(0.25,d),5),bk=BL[GROUP[s.n]]?+BL[GROUP[s.n]]*(1-ssW(0,0.75,t)):0;W[w*nb+s.i]+=v*(1-bk);if(bk>0&&s.pi>=0)W[w*nb+s.pi]+=v*bk;tot+=v;}
   if(tot>0)for(let k=0;k<nb;k++)W[w*nb+k]/=tot;else W[w*nb+list.indexOf(bones.hips)]=1;}
  /* smoothed over the surface: each welded vertex moves towards the mean of its neighbours */
  const idx=g.index?g.index.array:null;if(idx&&idx.length){const adj=new Map();const addE=(a,b)=>{if(a===b)return;let s=adj.get(a);if(!s){s=new Set();adj.set(a,s);}s.add(b);};
   for(let t=0;t<idx.length;t+=3){const a=wid[idx[t]],b=wid[idx[t+1]],c=wid[idx[t+2]];addE(a,b);addE(b,a);addE(b,c);addE(c,b);addE(a,c);addE(c,a);}
   const nbr=[];for(let w=0;w<nw;w++)nbr.push(adj.has(w)?[...adj.get(w)]:[]);let A=W,B=new Float32Array(W.length);
   for(let it=0;it<(O.smooth!=null?O.smooth:4);it++){for(let w=0;w<nw;w++){const L=nbr[w];if(!L.length){for(let k=0;k<nb;k++)B[w*nb+k]=A[w*nb+k];continue;}for(let k=0;k<nb;k++){let s=0;for(const o of L)s+=A[o*nb+k];B[w*nb+k]=0.5*A[w*nb+k]+0.5*s/L.length;}}const T=A;A=B;B=T;}
   if(A!==W)W.set(A);}
  /* tailChain (the raccoon's default): the tail is its own chain, so the thick tail never drags the haunch and a stepping hind leg
     never pulls the tail: each vertex is held by the tail bones or by the hind leg bones, whichever holds more of it, never both */
  if(O.tailChain!=null?O.tailChain:kind==='raccoon'){const tb=['tail1','tail2','tail3'].map(x=>list.indexOf(bones[x])),lb=['hipL','kneeL','hockL','hipR','kneeR','hockR'].map(x=>list.indexOf(bones[x]));
   for(let w=0;w<nw;w++){let ts=0,ls=0;for(const k of tb)ts+=W[w*nb+k];for(const k of lb)ls+=W[w*nb+k];if(ts<=0||ls<=0)continue;const drop=ts>ls?lb:tb;let s2=0;for(const k of drop){s2+=W[w*nb+k];W[w*nb+k]=0;}
    const left=1-s2;if(left>1e-6)for(let k=0;k<nb;k++)W[w*nb+k]/=left;}}
  const si=new Uint16Array(n*4),sw=new Float32Array(n*4);
  for(let i=0;i<n;i++){const w=wid[i],row=[];for(let k=0;k<nb;k++){const v=W[w*nb+k];if(v>0.004)row.push([k,v]);}row.sort((a,b)=>b[1]-a[1]);const top=row.slice(0,4);let s=0;for(const r of top)s+=r[1];
   if(!top.length){top.push([list.indexOf(bones.hips),1]);s=1;}for(let k=0;k<top.length;k++){si[4*i+k]=top[k][0];sw[4*i+k]=top[k][1]/s;}}
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(sw,4));
  const sm=new THREE.SkinnedMesh(g,m.material);sm.name=(m.name||'body')+'_autorig';sm.castShadow=m.castShadow;sm.receiveShadow=m.receiveShadow;out.add(sm);meshes.push(sm);}
 out.updateMatrixWorld(true);skeleton.calculateInverses();for(const sm of meshes)sm.bind(skeleton,new THREE.Matrix4());
 /* a proportion change baked into the bind shape (the lamb's bigger head): the vertices a bone carries
    scaled about its joint, by their weight */
 if(O.grow){for(const nm in O.grow){const b=bones[nm];if(!b)continue;const f=+O.grow[nm]||1,bi=list.indexOf(b),c=J[nm];
  for(const sm of meshes){const pos=sm.geometry.attributes.position,si=sm.geometry.attributes.skinIndex,sw=sm.geometry.attributes.skinWeight;
   for(let i=0;i<pos.count;i++){let w=0;for(let k=0;k<4;k++)if(si.getComponent(i,k)===bi)w+=sw.getComponent(i,k);
    /* the bone's children ride along, so the weight of everything below it counts too */
    for(let k=0;k<4;k++){let o=list[si.getComponent(i,k)];if(o===b)continue;for(let p=o.parent;p&&p.isBone;p=p.parent)if(p===b){w+=sw.getComponent(i,k);break;}}
    if(w<=0)continue;tmp.fromBufferAttribute(pos,i).sub(c).multiplyScalar(1+(f-1)*Math.min(1,w)).add(c);pos.setXYZ(i,tmp.x,tmp.y,tmp.z);}
   sm.geometry.computeVertexNormals();}}}
 /* ---------------------------------------------------------------- 4. the clips ---------------------- */
 const rest={};for(const k in J)rest[k]=J[k].clone();
 const child={};for(const [n,,c] of BONES)child[n]=c;
 const len=(a,b)=>rest[a].distanceTo(rest[b]);
 const legLen={};for(const L in LEGS){const n=LEGS[L];legLen[L]={l1:len(n[0],n[1]),l2:len(n[1],n[2]),l3:len(n[2],n[3])};}
 const Q=THREE.Quaternion,qI=new Q();
 /* the pose solver: bones in order, each turned from its bind direction to the one the pose asks for,
    starting from its parent's turn (so nothing twists); IK legs worked out when their top joint is known */
 function solve(pose){
  const P={},Rw={},loc={};const ctx={};
  for(const [n,par] of BONES){
   if(!par){P[n]=pose.root.clone();Rw[n]=pose.rootQ?pose.rootQ.clone():new Q();loc[n]=Rw[n].clone();continue;}
   P[n]=rest[n].clone().sub(rest[par]).applyQuaternion(Rw[par]).add(P[par]);
   let d=null;const leg=legOf[n];
   if(leg&&pose.legs&&pose.legs[leg.L]){const T=pose.legs[leg.L],names=LEGS[leg.L],ll=legLen[leg.L];
    if(leg.k===0){const low=T.toe.clone().sub(T.fdir.clone().multiplyScalar(ll.l3)),S=P[n];const dv=low.clone().sub(S);let dist=dv.length();const dn=dv.clone().normalize();
     dist=Math.min(Math.max(dist,Math.abs(ll.l1-ll.l2)+1e-4),ll.l1+ll.l2-1e-4);const a=Math.min(1,Math.max(-1,(ll.l1*ll.l1+dist*dist-ll.l2*ll.l2)/(2*ll.l1*dist)));
     const pp=T.pole.clone().addScaledVector(dn,-T.pole.dot(dn)).normalize();const mid=S.clone().addScaledVector(dn,ll.l1*a).addScaledVector(pp,ll.l1*Math.sqrt(1-a*a));
     ctx[leg.L]={mid,low:S.clone().addScaledVector(dn,dist)};d=mid.sub(S).normalize();}
    else if(leg.k===1)d=ctx[leg.L].low.clone().sub(P[n]).normalize();
    else d=T.toe.clone().sub(P[n]).normalize();}
   else if(pose.dir&&pose.dir[n])d=pose.dir[n].clone().normalize();
   if(!d){Rw[n]=Rw[par].clone();}
   else{const rd=rest[child[n]].clone().sub(rest[n]).normalize().applyQuaternion(Rw[par]);Rw[n]=new Q().setFromUnitVectors(rd,d).multiply(Rw[par]);}
   loc[n]=Rw[par].clone().invert().multiply(Rw[n]);}
  return {P,Rw,loc};}
 const legOf={};for(const L in LEGS)LEGS[L].slice(0,3).forEach((n,k)=>legOf[n]={L,k});
 /* the animal's own frame at rest */
 const B=p=>fromB(p[0],p[1],p[2]);const bR=toB(rest.root),bH=toB(rest.hips);
 const F=fwd.clone(),U=up.clone(),Rt=right.clone();
 const dirB=(z,y,x=0)=>Rt.clone().multiplyScalar(x).add(F.clone().multiplyScalar(z)).add(U.clone().multiplyScalar(y)).normalize();
 const rot=(v,axis,a)=>v.clone().applyAxisAngle(axis,a);
 const standing=O.standingBind!=null?!!O.standingBind:!O.joints;
 const restDir=n=>rest[child[n]].clone().sub(rest[n]).normalize();
 /* the neutral standing layout: hip and shoulder heights from the legs, the back pitched to join them */
 const reach=L=>{const l=legLen[L];return l.l1+l.l2+l.l3*0.9;};
 const Lf=(reach('fL')+reach('fR'))/2,Lh=(reach('hL')+reach('hR'))/2,Lleg=(Lf+Lh)/2;
 const deg=a=>a*Math.PI/180;
 const neckA=deg(O.neck&&O.neck.deg!=null?O.neck.deg:38),headA=deg(O.head&&O.head.deg!=null?O.head.deg:-18),tailA=deg(O.tail&&O.tail.deg!=null?O.tail.deg:-25);
 const hipH=standing?toB(rest.hips).y-ground:Math.min(Lh*(O.hipK||0.84),Lf*(O.shoulderK||0.86)*(O.levelK||1.04));
 /* hips first: with the back pitched by th, where would the shoulders be? */
 function torso(th,bob,extra){extra=extra||{};const root=rest.root.clone().add(U.clone().multiplyScalar(hipH-(bH.y-ground)+(bob||0)));
  const dir={};if(standing){dir.hips=rot(restDir('hips'),Rt,th);dir.spine=rot(restDir('spine'),Rt,th+(extra.flex||0));dir.chest=rot(restDir('chest'),Rt,th+2*(extra.flex||0));}
  else{dir.hips=dirB(Math.cos(th-(extra.flex||0)),-Math.sin(th-(extra.flex||0)));dir.spine=dirB(Math.cos(th),-Math.sin(th));dir.chest=dirB(Math.cos(th+(extra.flex||0)),-Math.sin(th+(extra.flex||0))+0.05);}
  return {root,dir};}
 let pitch0=0;
 if(!standing){const target=Lf*(O.shoulderK||0.86);let lo=-0.6,hi=0.6;for(let it=0;it<24;it++){const m=(lo+hi)/2,t=torso(m),s=solve({root:t.root,dir:t.dir});const y=(s.P.shoulderL.y+s.P.shoulderR.y)/2-ground;if(y>target)lo=m;else hi=m;}pitch0=(lo+hi)/2;}
 /* where each paw stands at rest in the animal's frame, relative to the hips (standing bind: where it is) */
 const t0=torso(pitch0),s0=solve({root:t0.root,dir:t0.dir});
 const home={};for(const L in LEGS){const n=LEGS[L];if(standing){home[L]=toB(rest[n[3]]).sub(toB(rest.root));}
  else{const top=toB(s0.P[n[0]]).sub(toB(rest.root));home[L]=V(top.x*0.95,0,top.z+(L[0]==='f'?0.04:0.02)*Lleg);}}
 const fdirHome={};for(const L in LEGS){const n=LEGS[L];fdirHome[L]=standing?rest[n[3]].clone().sub(rest[n[2]]).normalize():(L[0]==='f'?dirB(0.18,-1):dirB(0.42,-1));}
 /* stance (the raccoon's default): a scan caught mid-stride stands square, each pair of paws side by side at the pair's mean place
    along the body, as far either side of the hips as the pair stood on average, both feet pointing the pair's mean way straight
    ahead; stance:{dzF, dzH (a pair moved along the body, scan units), width (a factor)} */
 const ST=O.stance!=null?O.stance:kind==='raccoon';
 if(ST&&standing){const so=typeof ST==='object'?ST:{};
  for(const [a,b,dz] of [['fL','fR',+so.dzF||0],['hL','hR',+so.dzH||0]]){const A=home[a],C=home[b],z=(A.z+C.z)/2+dz,w=(Math.abs(A.x)+Math.abs(C.x))/2*(so.width!=null?+so.width:1);
   home[a]=V((Math.sign(A.x)||1)*w,A.y,z);home[b]=V((Math.sign(C.x)||-1)*w,C.y,z);
   const da=toB(fdirHome[a]),db=toB(fdirHome[b]),m=fromB(0,(da.y+db.y)/2,(da.z+db.z)/2).normalize();fdirHome[a]=m.clone();fdirHome[b]=m.clone();}}
 /* headYawDeg: a scan whose head is turned to one side faces forward (the neck takes half of the turn); + turns it to the animal's left */
 const tilt=deg(+O.headTilt||0),yawH=deg(+O.headYawDeg||0),neckDir=rot(standing?rot(restDir('neck'),Rt,tilt*0.5):dirB(Math.cos(neckA),Math.sin(neckA)),U,yawH*0.5),headDir=rot(standing?rot(restDir('head'),Rt,tilt):dirB(Math.cos(headA),Math.sin(headA)),U,yawH);
 const tailDir=k=>standing?restDir('tail'+k):dirB(-Math.cos(tailA-(k-1)*0.12),Math.sin(tailA-(k-1)*0.12));
 const ss=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
 /* which way each knee and elbow bends: a standing bind keeps its own bend (so the idle is the bind), a model
    stood up bends like a four-legged animal (elbows back, knees forward) */
 /* poles:'quadruped' (the raccoon's default): elbows back and knees forward whatever the bind shows (a leg caught nearly straight
    in a stride has no bend of its own to keep) */
 const quadPoles=O.poles==='quadruped'||(O.poles==null&&kind==='raccoon');
 const poles={};for(const L in LEGS){const n=LEGS[L],a=rest[n[0]],m=rest[n[1]],c=rest[n[2]],ax=c.clone().sub(a).normalize(),pm=m.clone().sub(a);pm.addScaledVector(ax,-pm.dot(ax));
  poles[L]=!quadPoles&&standing&&pm.length()>1e-6*torsoL?pm.normalize():(L[0]==='f'?F.clone().negate():F.clone());}
 const poleFor=L=>poles[L].clone();
 /* one frame of a gait at phase ph (0..1), travel is the root's forward distance so far */
 function gaitPose(G,ph,travel){
  const TAU=Math.PI*2,bob=-G.bob*Lleg*Math.cos(TAU*2*ph)-(G.crouch||0)*Lleg,flex=(G.flex||0)*Math.sin(TAU*ph),t=torso(pitch0+(G.pitch||0)*Math.sin(TAU*ph+1),bob,{flex});
  t.root.addScaledVector(F,travel).addScaledVector(Rt,(G.sway||0)*Lleg*Math.sin(TAU*ph));
  const S=G.stride*Lleg,legs={};
  for(const L in LEGS){const u=(((ph+G.off[L])%1)+1)%1,h=home[L],front=L[0]==='f';let z,y=0,fd=fdirHome[L].clone();
   if(u<G.duty){z=h.z+S*G.duty*(0.5-u/G.duty);const k=u/G.duty;if(k>0.7)fd=rot(fd,Rt,(front?-1:-0.6)*0.6*ss(0.7,1,k));}
   else{const s=(u-G.duty)/(1-G.duty);z=h.z+S*G.duty*(-0.5+ss(0,1,s));y=G.lift*Lleg*Math.sin(Math.PI*s)*(front?1:0.85);fd=rot(fd,Rt,(front?-1.2:-0.7)*Math.sin(Math.PI*Math.min(1,s*1.3)));}
   if(front&&G.backF)z-=G.backF*Lleg;   // backF (the raccoon's trot and gallop): the front paws' whole step moved back under the chest, so a short foreleg lands under the shoulder instead of reaching flat along the grass
   const toe=rest.root.clone().addScaledVector(F,travel+z).addScaledVector(Rt,h.x).add(U.clone().multiplyScalar(y+h.y));
   legs[L]={toe,fdir:fd,pole:poleFor(L)};}
  const nb=(G.neckBob||0)*Math.sin(TAU*2*ph+0.6);
  t.dir.neck=rot(neckDir,Rt,-nb);t.dir.head=rot(headDir,Rt,nb*0.8);
  for(let k=1;k<=3;k++)t.dir['tail'+k]=rot(tailDir(k),U,(G.tailSwing||0)*Math.sin(TAU*ph-k*0.7)*k);
  return {root:t.root,dir:t.dir,legs};}
 function idlePose(ph){const TAU=Math.PI*2,br=Math.sin(TAU*ph*2);const t=torso(pitch0,0.004*Lleg*br,{flex:0.01*br});
  const legs={};for(const L in LEGS){const h=home[L];legs[L]={toe:rest.root.clone().addScaledVector(F,h.z).addScaledVector(Rt,h.x).add(U.clone().multiplyScalar(h.y)),fdir:fdirHome[L].clone(),pole:poleFor(L)};}   // a standing bind's paw keeps its own height (a sole cut above the grass line)
  t.dir.neck=rot(rot(neckDir,U,0.12*Math.sin(TAU*ph)),Rt,-0.03*br);t.dir.head=rot(rot(headDir,U,0.15*Math.sin(TAU*ph-0.4)),Rt,0.05*Math.sin(TAU*ph*2+1));
  for(let k=1;k<=3;k++)t.dir['tail'+k]=rot(tailDir(k),U,0.12*Math.sin(TAU*ph-k*0.6)*k);
  return {root:t.root,dir:t.dir,legs};}
 /* the bind pose itself, breathing (a model that sits in its bind pose sits like this) */
 function bindPose(ph){const TAU=Math.PI*2,br=Math.sin(TAU*ph*2);const dir={chest:rot(restDir('chest'),Rt,-0.015*br),neck:rot(restDir('neck'),U,0.1*Math.sin(TAU*ph)),head:rot(rot(restDir('head'),U,0.14*Math.sin(TAU*ph-0.5)),Rt,0.04*br+deg(O.sitHeadTilt!=null?+O.sitHeadTilt:-18))};   // the head a little lower than the bind's, so looking up at the rider stays natural
  for(let k=1;k<=3;k++)dir['tail'+k]=rot(restDir('tail'+k),U,0.06*Math.sin(TAU*ph-k*0.6)*k);return {root:rest.root.clone(),dir};}
 /* a standing bind's sit (sit:{hipK, flexK, frontK, hindZ}; the raccoon's by default): the haunches down on the grass (the hips
    joint at hipK of its standing height), the back raised, curled by flexK, until the front legs stand nearly straight (frontK of
    their reach) under the chest, the hind feet flat and forward beside the belly (hindZ leg lengths in front of the hips), the tail
    laid out behind on the grass, the head level and looking about. Baked over the grass like the hare's clips (nothing sinks) */
 const SIT=O.sit!=null?O.sit:(kind==='raccoon'?{}:null);let sitCfg=null;
 if(standing&&SIT){const so=typeof SIT==='object'?SIT:{},hipS=(so.hipK!=null?+so.hipK:0.5)*hipH,bob=-(hipH-hipS),fl=so.flexK!=null?+so.flexK:-0.35;
  const target=Lf*(so.frontK!=null?+so.frontK:0.86);let lo=0,hi=1.4;
  for(let it=0;it<24;it++){const m=(lo+hi)/2,t=torso(m,bob,{flex:fl*m}),s=solve({root:t.root,dir:t.dir});const y=(s.P.shoulderL.y+s.P.shoulderR.y)/2-ground;if(y<target)lo=m;else hi=m;}
  sitCfg={th:(lo+hi)/2,bob,fl,hindZ:so.hindZ!=null?+so.hindZ:0.12};}
 function sitPose(ph){const TAU=Math.PI*2,br=Math.sin(TAU*ph*2),C=sitCfg,t=torso(C.th+0.008*br,C.bob,{flex:C.fl*C.th}),s=solve({root:t.root,dir:t.dir}),r0=toB(rest.root),legs={};
  for(const L in LEGS){const n=LEGS[L],h=home[L],top=toB(s.P[n[0]]).sub(r0),ll=legLen[L];let z,fd;
   if(L[0]==='f'){z=top.z+ll.l3*0.85+0.03*Lleg;fd=fdirHome[L].clone();}   // the wrist under the shoulder, the paw ahead of it
   else{z=top.z+C.hindZ*Lleg+ll.l3;fd=fdirHome[L].clone();}   // the heel just ahead of the hip, the sole flat on the grass as it stands
   legs[L]={toe:rest.root.clone().addScaledVector(F,z).addScaledVector(Rt,h.x*(L[0]==='h'?1.08:1)).add(U.clone().multiplyScalar(h.y)),fdir:fd,pole:poleFor(L)};}
  t.dir.neck=rot(rot(neckDir,U,0.16*Math.sin(TAU*ph)),Rt,0.06+0.03*br);t.dir.head=rot(rot(headDir,U,0.22*Math.sin(TAU*ph-0.5)),Rt,0.1+0.04*Math.sin(TAU*ph*2+1));
  const tl=[-0.3,-0.12,-0.02];for(let k=1;k<=3;k++)t.dir['tail'+k]=rot(dirB(-1,tl[k-1]),U,0.05*Math.sin(TAU*ph-k*0.6)*k);
  return {root:t.root,dir:t.dir,legs};}
 /* the hare's hop, phased like the game's (it adds the flight's height): 0-0.16 the push, 0.16-0.86 in the air, then
    the landing; the game counts 0.86 to 1.16 as on the ground. Both hind feet push together from under the body while
    the back stretches out and the heels lift a little; in the air the hind legs trail, then swing forward as the back
    arches; the body tips forward so the front paws reach the grass first (the left a moment before the right, just after the
    game has begun to count the hare on the ground, coming straight down so they do not skim the grass), and the
    hind feet come down beside them, ready for the next push. Every paw on the grass sweeps back at one rate (R strides
    per cycle), the rate the game moves the body at on the ground (userData.autorig.hopSweep), so nothing slides.
    hopHind scales the hind legs' swing, hopStride the stride, hopFlex the back. The bound (boundStride, boundFlex) is
    the same cycle at a gallop: longer and lower, the back working harder, nose and head down while stretched out. */
 const HOP={S:(O.hopStride!=null?+O.hopStride:0.55)*Lleg,R:0.9,hk:O.hopHind!=null?+O.hopHind:1,FX:O.hopFlex!=null?+O.hopFlex:0.14,zH:0.085,zF:0.09,trail:0.026,airEnd:0.07,
  p0:0.09,p1:-0.09,neck:0,bob:0,crouch:0.012,heel:0.12,fLift:0.09,reach:0.04};
 const BOUND=Object.assign({},HOP,{S:(O.boundStride!=null?+O.boundStride:0.62)*Lleg,R:1.2,FX:O.boundFlex!=null?+O.boundFlex:0.26,zH:0.1,zF:0.17,trail:0.05,airEnd:0.08,
  p0:-0.03,p1:-0.2,neck:-0.34,bob:0.012,heel:0.15,fLift:0.1,reach:0.07});
 function hopPose(ph,HP){HP=HP||HOP;const u=((ph%1)+1)%1,lerp=(a,b,k)=>a+(b-a)*k,hk=HP.hk,S=HP.S,R=HP.R;
  const push=u<0.16?u/0.16:-1,a=u>=0.16&&u<0.86?(u-0.16)/0.7:-1,land=u>=0.86?(u-0.86)/0.14:-1;
  /* flex: + stretches the back out, - arches it; pitch: - is nose down */
  let flex,pitch,bob;
  if(push>=0){flex=lerp(-1,1,ss(0,1,push));pitch=HP.p0*ss(0,1,push);bob=lerp(-HP.crouch,0.02,ss(0,1,push));}
  else if(a>=0){flex=lerp(1,-0.8,ss(0.25,0.95,a));pitch=lerp(HP.p0,HP.p1,ss(0.1,0.9,a));bob=0.02*(1-ss(0,0.6,a));}
  else{flex=lerp(-0.8,-1,ss(0,1,land));pitch=lerp(HP.p1,0,ss(0.2,1,land));bob=-HP.crouch*ss(0,0.7,land);}
  const t=torso(pitch0+pitch,(bob+HP.bob)*Lleg,{flex:flex*HP.FX});
  const legs={};
  for(const L in LEGS){const h=home[L],front=L[0]==='f';let z=0,y=0,fd=fdirHome[L].clone();
   if(front){const uT=L==='fL'?0.89:0.915,uO=L==='fL'?0.035:0.05,Dg=1-uT+uO,g=((u-uT)%1+1)%1,zT=HP.zF-(L==='fL'?0:0.01),zO=zT-R*Dg;
    if(g<Dg)z=(zT-R*g)*S;   // planted from the landing to the push, swept back at the ground rate: the body passes over the paw
    else{const k=(u-uO)/(uT-uO);z=lerp(zO,zT+HP.reach,ss(0,0.6,k))*S-HP.reach*S*ss(0.6,1,k);y=HP.fLift*Lleg*Math.sqrt(Math.max(0,Math.sin(Math.PI*k)));fd=rot(fd,Rt,-0.3*Math.sin(Math.PI*k));}}   // lifts, reaches out and comes down first
   else{const zL=HP.zH-R*0.21,yA=0.045*Lleg*hk;
    if(u>=0.95||u<0.16){const g=((u-0.95)%1+1)%1;z=(HP.zH-R*g)*S;if(push>=0)fd=rot(fd,Rt,-HP.heel*ss(0.15,1,push));}   // planted, the body driven forward over it, the heel rising a little
    else if(a>=0){z=(a<0.3?lerp(zL,zL-HP.trail,a/0.3):lerp(zL-HP.trail,HP.airEnd,ss(0.3,1,a)))*S;y=Lleg*hk*(a<0.3?0.045*a/0.3:lerp(0.045,0.06,ss(0.3,0.7,a))-0.015*ss(0.7,1,a));fd=rot(fd,Rt,-HP.heel*(1-ss(0.1,0.7,a)));}   // trails, then swings forward, still off the grass when the front paws land
    else{const k=ss(0,1,(u-0.86)/0.09);z=lerp(HP.airEnd,HP.zH,k)*S;y=lerp(yA,0,k);}}   // comes down beside the front paws
   legs[L]={toe:rest.root.clone().addScaledVector(F,h.z+z).addScaledVector(Rt,h.x).add(U.clone().multiplyScalar(h.y+y)),fdir:fd,pole:poleFor(L)};}
  t.dir.neck=rot(neckDir,Rt,0.4*pitch+HP.neck);t.dir.head=rot(headDir,Rt,0.5*pitch+0.6*HP.neck);for(let k=1;k<=3;k++)t.dir['tail'+k]=rot(tailDir(k),Rt,0.15*flex*k/3);
  return {root:t.root,dir:t.dir,legs};}
 const names=BONES.map(b=>b[0]);
 /* nothing sinks: a hop's crouch presses the haunch and belly (which sit on the grass in the scan) under it, so each frame of a
    hare's clip is raised by however far its lowest skin point would go below the ground (skinned here from the solved bones,
    on the lower part of the body), and the clip carries its own contact with the grass */
 let lowV=null;const lifts={};
 function lift(s){if(!lowV){lowV=[];for(const sm of meshes){const g=sm.geometry,pos=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
    for(let i=0;i<pos.count;i++){const y=pos.getY(i);if(y>ground+0.3*Hs||(i%3&&y>ground+0.04*Hs))continue;const e=[pos.getX(i),y,pos.getZ(i)];for(let k=0;k<4;k++){const w=sw.getComponent(i,k);if(w>0.01)e.push(names[si.getComponent(i,k)],w);}lowV.push(e);}}}
  let mn=Infinity;const v=V(0,0,0);for(const e of lowV){let y=0;for(let k=3;k<e.length;k+=2){const n=e[k];v.set(e[0],e[1],e[2]).sub(rest[n]).applyQuaternion(s.Rw[n]);y+=e[k+1]*(s.P[n].y+v.y);}if(y<mn)mn=y;}
  return mn<ground?ground-mn:0;}
 function bake(name,T,N,poseAt,travel,floor){const times=new Float32Array(N+1),qv={},pv=new Float32Array((N+1)*3);for(const n of names)qv[n]=new Float32Array((N+1)*4);
  for(let i=0;i<=N;i++){const ph=i/N;times[i]=ph*T;const pz=poseAt(ph%1,(travel||0)*ph);let s=solve(pz);
   if(floor){const l0=lift(s);if(l0>0){pz.root.addScaledVector(U,l0);s=solve(pz);}}   // the body raised over the paws, which stay where they are
   for(const n of names){const q=s.loc[n];if(i>0){const o=qv[n];const j=4*(i-1);if(o[j]*q.x+o[j+1]*q.y+o[j+2]*q.z+o[j+3]*q.w<0){q.x=-q.x;q.y=-q.y;q.z=-q.z;q.w=-q.w;}}qv[n].set([q.x,q.y,q.z,q.w],4*i);}
   const lf=floor?lift(s):0;if(floor)(lifts[name]=lifts[name]||[]).push(+lf.toFixed(4));pv.set([s.P.root.x,s.P.root.y+lf,s.P.root.z],3*i);}
  const tracks=[new THREE.VectorKeyframeTrack('ar_root.position',times,pv)];for(const n of names)if(n!=='root')tracks.push(new THREE.QuaternionKeyframeTrack('ar_'+n+'.quaternion',times,qv[n]));
  return new THREE.AnimationClip(name,T,tracks);}
 const clips=[];const GS=Object.assign({},GAITS[kind==='raccoon'?'raccoon':'quadruped']);if(O.gait)for(const g in O.gait)GS[g]=Object.assign({},GS[g]||GAITS.quadruped.walk,O.gait[g]);
 if(tpl==='hare'){clips.push(bake('autorig.idle',3.2,48,idlePose,0));clips.push(bake('autorig.hop',0.5,30,ph=>hopPose(ph,HOP),0,true));clips.push(bake('autorig.bound',0.3,30,ph=>hopPose(ph,BOUND),0,true));if(!standing)clips.push(bake('autorig.sit',4,32,bindPose,0));}
 else{clips.push(bake('autorig.idle',3.2,48,idlePose,0));
  for(const g of ['walk','trot','run']){const G=GS[g];if(!G)continue;clips.push(bake('autorig.'+g,G.T,g==='walk'?32:24,(ph,tr)=>gaitPose(G,ph,tr),G.stride*Lleg));}
  if(!standing)clips.push(bake('autorig.sit',4,32,bindPose,0));else if(sitCfg)clips.push(bake('autorig.sit',4,32,sitPose,0,true));}
 out.userData.autorig={template:kind,bones:list.length,joints:Object.fromEntries(Object.entries(J).map(([k,v])=>[k,v.toArray().map(x=>+x.toFixed(4))])),standingBind:standing,
  ground:+ground.toFixed(4),hopSweep:tpl==='hare'?+(HOP.R*HOP.S).toFixed(5):undefined,boundSweep:tpl==='hare'?+(BOUND.R*BOUND.S).toFixed(5):undefined,hopGround:[0.86,0.16],lifts,toesAboveGround:['toeL','toeR','toeHL','toeHR'].map(n=>+(J[n].y-ground).toFixed(4)),legLength:+Lleg.toFixed(4),torsoLength:+torsoL.toFixed(4),pitchDeg:+(pitch0*180/Math.PI).toFixed(1),sitPitchDeg:sitCfg?+(sitCfg.th*180/Math.PI).toFixed(1):undefined,clips:clips.map(c=>c.name),vertices:meshes.reduce((a,m)=>a+m.geometry.attributes.position.count,0),
  soles:meshes.reduce((a,m)=>a.concat(m.geometry.userData.soleLoops||[]),[])};
 return {scene:out,animations:clips};
}
export default autorig;
