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
const RADII={quadruped:{torso:0.36,neck:0.26,head:0.24,upper:0.15,thigh:0.2,lower:0.085,shank:0.085,foot:0.06,tail:0.1},hare:{torso:0.4,neck:0.3,head:0.3,upper:0.12,thigh:0.26,lower:0.1,shank:0.1,foot:0.07,tail:0.12}};
const GAITS={
 quadruped:{
  walk:{T:0.8,off:{hL:0,fL:0.25,hR:0.5,fR:0.75},duty:0.64,stride:1.3,lift:0.13,bob:0.018,sway:0.012,pitch:0,flex:0.02,tailSwing:0.1,neckBob:0.03},
  trot:{T:0.42,off:{hL:0,fR:0,hR:0.5,fL:0.5},duty:0.42,stride:2.3,lift:0.2,bob:0.03,sway:0.006,pitch:0,flex:0.03,tailSwing:0.06,neckBob:0.04},
  run:{T:0.3,off:{hL:0,hR:0.08,fR:0.42,fL:0.52},duty:0.26,stride:3.9,lift:0.3,bob:0.05,sway:0,pitch:0.06,flex:0.16,tailSwing:0.05,neckBob:0.06,crouch:0.06}},
 hare:{walk:null,trot:null,run:null}};
export function autorig({THREE,scene,animations,entry,key,options}){
 const O=options||{},tpl=O.template==='hare'?'hare':'quadruped';
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
   p.g.setIndex(keep);p.g.clearGroups();}}
 /* the fennec: the fox's ears grown and splayed in the geometry (tapering to the tip, root kept) */
 if(O.ears&&Array.isArray(O.ears.sides)){const E=O.ears,sc=+E.scale||1.6,rad=+E.radius||0.3,spl=(+E.splayDeg||0)*Math.PI/180;
  const sides=E.sides.slice(0,2).map(s=>({b:arr(s.base),ax:arr(s.tip).sub(arr(s.base))}));const mid=sides.reduce((a,s)=>a.add(s.b),V(0,0,0)).multiplyScalar(1/sides.length);
  for(const s of sides){const up=s.ax.clone().normalize(),out=s.b.clone().sub(mid);out.addScaledVector(up,-out.dot(up));s.k=out.lengthSq()>1e-10?V(0,0,0).crossVectors(up,out.normalize()).normalize():V(1,0,0);}
  const ss=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);},p=V(0,0,0),d=V(0,0,0),v=V(0,0,0),c=V(0,0,0);
  for(const P of parts){const pos=P.g.attributes.position;for(let i=0;i<pos.count;i++){p.fromBufferAttribute(pos,i);for(const s of sides){d.copy(p).sub(s.b);const L2=Math.max(1e-9,s.ax.lengthSq()),u=d.dot(s.ax)/L2,rr=d.clone().addScaledVector(s.ax,-u).length(),lim=rad*(1-0.55*Math.min(1,Math.max(0,u)))+rad*0.12;
    const w=ss(0,0.42,u)*(1-ss(lim*0.8,lim*1.15,rr))*(1-ss(1.25,1.45,u));if(w<=0)continue;v.copy(d).multiplyScalar(1+(sc-1)*w);const a=spl*w,k=s.k;c.crossVectors(k,v);v.multiplyScalar(Math.cos(a)).add(c.multiplyScalar(Math.sin(a))).addScaledVector(k,k.dot(d.copy(v))*(1-Math.cos(a)));p.copy(s.b).add(v);}
   pos.setXYZ(i,p.x,p.y,p.z);}P.g.computeVertexNormals();}}
 /* the points to analyse and weight: the vertices still used by a triangle */
 const used=parts.map(p=>{const u=new Uint8Array(p.g.attributes.position.count);const ix=p.g.index?p.g.index.array:null;if(ix)for(let i=0;i<ix.length;i++)u[ix[i]]=1;else u.fill(1);return u;});
 const box=new THREE.Box3();parts.forEach((p,j)=>{const pos=p.g.attributes.position;for(let i=0;i<pos.count;i++)if(used[j][i])box.expandByPoint(V(pos.getX(i),pos.getY(i),pos.getZ(i)));});
 const up=V(0,1,0),ground=box.min.y,Hs=box.max.y-box.min.y;
 /* ---------------------------------------------------------------- 2. the joints ---------------------- */
 const sample=[];{let tot=0;parts.forEach((p,j)=>{tot+=p.g.attributes.position.count;});const step=Math.max(1,Math.floor(tot/9000));parts.forEach((p,j)=>{const pos=p.g.attributes.position;for(let i=0;i<pos.count;i+=step)if(used[j][i])sample.push(V(pos.getX(i),pos.getY(i),pos.getZ(i)));});}
 let fwd;
 if(O.forward)fwd=arr(O.forward).setY(0).normalize();
 else{/* the body axis: the long way of the points seen from above; the head is the end that stands higher */
  let mx=0,mz=0;for(const p of sample){mx+=p.x;mz+=p.z;}mx/=sample.length;mz/=sample.length;let cxx=0,czz=0,cxz=0;for(const p of sample){const a=p.x-mx,b=p.z-mz;cxx+=a*a;czz+=b*b;cxz+=a*b;}
  const ang=0.5*Math.atan2(2*cxz,cxx-czz);fwd=V(Math.cos(ang),0,Math.sin(ang));let hi=[-Infinity,-Infinity],pr=sample.map(p=>(p.x-mx)*fwd.x+(p.z-mz)*fwd.z),lo=Math.min(...pr),hiP=Math.max(...pr);
  sample.forEach((p,i)=>{const u=(pr[i]-lo)/(hiP-lo);if(u>0.85)hi[1]=Math.max(hi[1],p.y);if(u<0.15)hi[0]=Math.max(hi[0],p.y);});if(hi[0]>hi[1])fwd.negate();}
 const right=V(0,0,0).crossVectors(up,fwd).normalize().negate();   // +X of the animal's own frame is its left: right = fwd x up ... kept as the side the "L" joints are on
 /* body frame helpers: x to the animal's left, y up, z forward */
 const toB=p=>V(p.dot(right),p.y,p.dot(fwd)),fromB=(x,y,z)=>right.clone().multiplyScalar(x).add(fwd.clone().multiplyScalar(z)).setY(y);
 let J={};
 if(O.joints){for(const k in O.joints)J[k]=arr(O.joints[k]);}
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
 const segs=BONES.filter(b=>b[2]).map(([n,par,ch])=>({n,i:list.indexOf(bones[n]),a:J[n],b:J[ch],end:!BONES.some(x=>x[0]===ch)}));
 const torsoL=J.hips.distanceTo(J.spine)+J.spine.distanceTo(J.chest)+J.chest.distanceTo(J.neck);
 const RD=Object.assign({},RADII[tpl],O.radii||{});for(const s of segs)s.r=Math.max(1e-6,(RD[GROUP[s.n]]||0.1)*torsoL);
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
    const v=Math.max(1e-9,fall)/Math.pow(Math.max(0.25,d),5);W[w*nb+s.i]+=v;tot+=v;}
   if(tot>0)for(let k=0;k<nb;k++)W[w*nb+k]/=tot;else W[w*nb+list.indexOf(bones.hips)]=1;}
  /* smoothed over the surface: each welded vertex moves towards the mean of its neighbours */
  const idx=g.index?g.index.array:null;if(idx&&idx.length){const adj=new Map();const addE=(a,b)=>{if(a===b)return;let s=adj.get(a);if(!s){s=new Set();adj.set(a,s);}s.add(b);};
   for(let t=0;t<idx.length;t+=3){const a=wid[idx[t]],b=wid[idx[t+1]],c=wid[idx[t+2]];addE(a,b);addE(b,a);addE(b,c);addE(c,b);addE(a,c);addE(c,a);}
   const nbr=[];for(let w=0;w<nw;w++)nbr.push(adj.has(w)?[...adj.get(w)]:[]);let A=W,B=new Float32Array(W.length);
   for(let it=0;it<(O.smooth!=null?O.smooth:4);it++){for(let w=0;w<nw;w++){const L=nbr[w];if(!L.length){for(let k=0;k<nb;k++)B[w*nb+k]=A[w*nb+k];continue;}for(let k=0;k<nb;k++){let s=0;for(const o of L)s+=A[o*nb+k];B[w*nb+k]=0.5*A[w*nb+k]+0.5*s/L.length;}}const T=A;A=B;B=T;}
   if(A!==W)W.set(A);}
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
 const tilt=deg(+O.headTilt||0),neckDir=standing?rot(restDir('neck'),Rt,tilt*0.5):dirB(Math.cos(neckA),Math.sin(neckA)),headDir=standing?rot(restDir('head'),Rt,tilt):dirB(Math.cos(headA),Math.sin(headA));
 const tailDir=k=>standing?restDir('tail'+k):dirB(-Math.cos(tailA-(k-1)*0.12),Math.sin(tailA-(k-1)*0.12));
 const ss=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
 /* which way each knee and elbow bends: a standing bind keeps its own bend (so the idle is the bind), a model
    stood up bends like a four-legged animal (elbows back, knees forward) */
 const poles={};for(const L in LEGS){const n=LEGS[L],a=rest[n[0]],m=rest[n[1]],c=rest[n[2]],ax=c.clone().sub(a).normalize(),pm=m.clone().sub(a);pm.addScaledVector(ax,-pm.dot(ax));
  poles[L]=standing&&pm.length()>1e-6*torsoL?pm.normalize():(L[0]==='f'?F.clone().negate():F.clone());}
 const poleFor=L=>poles[L].clone();
 /* one frame of a gait at phase ph (0..1), travel is the root's forward distance so far */
 function gaitPose(G,ph,travel){
  const TAU=Math.PI*2,bob=-G.bob*Lleg*Math.cos(TAU*2*ph)-(G.crouch||0)*Lleg,flex=(G.flex||0)*Math.sin(TAU*ph),t=torso(pitch0+(G.pitch||0)*Math.sin(TAU*ph+1),bob,{flex});
  t.root.addScaledVector(F,travel).addScaledVector(Rt,(G.sway||0)*Lleg*Math.sin(TAU*ph));
  const S=G.stride*Lleg,legs={};
  for(const L in LEGS){const u=(((ph+G.off[L])%1)+1)%1,h=home[L],front=L[0]==='f';let z,y=0,fd=fdirHome[L].clone();
   if(u<G.duty){z=h.z+S*G.duty*(0.5-u/G.duty);const k=u/G.duty;if(k>0.7)fd=rot(fd,Rt,(front?-1:-0.6)*0.6*ss(0.7,1,k));}
   else{const s=(u-G.duty)/(1-G.duty);z=h.z+S*G.duty*(-0.5+ss(0,1,s));y=G.lift*Lleg*Math.sin(Math.PI*s)*(front?1:0.85);fd=rot(fd,Rt,(front?-1.2:-0.7)*Math.sin(Math.PI*Math.min(1,s*1.3)));}
   const toe=rest.root.clone().addScaledVector(F,travel+z).addScaledVector(Rt,h.x).add(U.clone().multiplyScalar(y));
   legs[L]={toe,fdir:fd,pole:poleFor(L)};}
  const nb=(G.neckBob||0)*Math.sin(TAU*2*ph+0.6);
  t.dir.neck=rot(neckDir,Rt,-nb);t.dir.head=rot(headDir,Rt,nb*0.8);
  for(let k=1;k<=3;k++)t.dir['tail'+k]=rot(tailDir(k),U,(G.tailSwing||0)*Math.sin(TAU*ph-k*0.7)*k);
  return {root:t.root,dir:t.dir,legs};}
 function idlePose(ph){const TAU=Math.PI*2,br=Math.sin(TAU*ph*2);const t=torso(pitch0,0.004*Lleg*br,{flex:0.01*br});
  const legs={};for(const L in LEGS){const h=home[L];legs[L]={toe:rest.root.clone().addScaledVector(F,h.z).addScaledVector(Rt,h.x),fdir:fdirHome[L].clone(),pole:poleFor(L)};}
  t.dir.neck=rot(rot(neckDir,U,0.12*Math.sin(TAU*ph)),Rt,-0.03*br);t.dir.head=rot(rot(headDir,U,0.15*Math.sin(TAU*ph-0.4)),Rt,0.05*Math.sin(TAU*ph*2+1));
  for(let k=1;k<=3;k++)t.dir['tail'+k]=rot(tailDir(k),U,0.12*Math.sin(TAU*ph-k*0.6)*k);
  return {root:t.root,dir:t.dir,legs};}
 /* the bind pose itself, breathing (a model that sits in its bind pose sits like this) */
 function bindPose(ph){const TAU=Math.PI*2,br=Math.sin(TAU*ph*2);const dir={chest:rot(restDir('chest'),Rt,-0.015*br),neck:rot(restDir('neck'),U,0.1*Math.sin(TAU*ph)),head:rot(rot(restDir('head'),U,0.14*Math.sin(TAU*ph-0.5)),Rt,0.04*br+deg(O.sitHeadTilt!=null?+O.sitHeadTilt:-18))};   // the head a little lower than the bind's, so looking up at the rider stays natural
  for(let k=1;k<=3;k++)dir['tail'+k]=rot(restDir('tail'+k),U,0.06*Math.sin(TAU*ph-k*0.6)*k);return {root:rest.root.clone(),dir};}
 /* the hare's hop, phased like the game's: 0-0.16 the push, 0.16-0.86 in the air, then the landing */
 function hopPose(ph){const TAU=Math.PI*2,u=ph,air=u>0.16&&u<0.86,a=air?(u-0.16)/0.7:0;
  const stretch=u<0.16?u/0.16:air?Math.sin(Math.PI*Math.min(1,a*1.4)):0,gather=air?ss(0.45,1,a):u>=0.86?1-(u-0.86)/0.14:0;
  const t=torso(pitch0+(u<0.16?0.12*stretch:air?0.18*(1-a)-0.1*a:0),-(0.02*Lleg)*(1-stretch),{flex:-0.18*stretch+0.2*gather});
  const legs={};const S=0.55*Lleg;
  for(const L in LEGS){const h=home[L],front=L[0]==='f';let z=h.z,y=0,fd=fdirHome[L].clone();
   if(front){z+=air?S*(0.5*a-0.1):u<0.16?-0.1*S:0;y=air?0.25*Lleg*Math.sin(Math.PI*Math.min(1,a*1.2)):0;fd=rot(fd,Rt,air?-0.6*(1-a):0);}
   else{const hk=O.hopHind!=null?+O.hopHind:1;z+=hk*(u<0.16?-0.45*S*stretch:air?(-0.45*S*(1-a)+0.3*S*gather):0.3*S*(1-(u-0.86)/0.14));y=air?0.12*hk*Lleg*Math.sin(Math.PI*a):0;fd=rot(fd,Rt,u<0.16||air?-0.9*hk*stretch:0);}
   legs[L]={toe:rest.root.clone().addScaledVector(F,z).addScaledVector(Rt,h.x).add(U.clone().multiplyScalar(y)),fdir:fd,pole:poleFor(L)};}
  t.dir.neck=neckDir.clone();t.dir.head=headDir.clone();for(let k=1;k<=3;k++)t.dir['tail'+k]=tailDir(k);
  return {root:t.root,dir:t.dir,legs};}
 const names=BONES.map(b=>b[0]);
 function bake(name,T,N,poseAt,travel){const times=new Float32Array(N+1),qv={},pv=new Float32Array((N+1)*3);for(const n of names)qv[n]=new Float32Array((N+1)*4);
  for(let i=0;i<=N;i++){const ph=i/N;times[i]=ph*T;const s=solve(poseAt(ph%1,(travel||0)*ph));
   for(const n of names){const q=s.loc[n];if(i>0){const o=qv[n];const j=4*(i-1);if(o[j]*q.x+o[j+1]*q.y+o[j+2]*q.z+o[j+3]*q.w<0){q.x=-q.x;q.y=-q.y;q.z=-q.z;q.w=-q.w;}}qv[n].set([q.x,q.y,q.z,q.w],4*i);}
   pv.set([s.P.root.x,s.P.root.y,s.P.root.z],3*i);}
  const tracks=[new THREE.VectorKeyframeTrack('ar_root.position',times,pv)];for(const n of names)if(n!=='root')tracks.push(new THREE.QuaternionKeyframeTrack('ar_'+n+'.quaternion',times,qv[n]));
  return new THREE.AnimationClip(name,T,tracks);}
 const clips=[];const GS=Object.assign({},GAITS.quadruped);if(O.gait)for(const g in O.gait)GS[g]=Object.assign({},GS[g]||GAITS.quadruped.walk,O.gait[g]);
 if(tpl==='hare'){clips.push(bake('autorig.idle',3.2,48,idlePose,0));clips.push(bake('autorig.hop',0.5,30,hopPose,0));if(!standing)clips.push(bake('autorig.sit',4,32,bindPose,0));}
 else{clips.push(bake('autorig.idle',3.2,48,idlePose,0));
  for(const g of ['walk','trot','run']){const G=GS[g];if(!G)continue;clips.push(bake('autorig.'+g,G.T,g==='walk'?32:24,(ph,tr)=>gaitPose(G,ph,tr),G.stride*Lleg));}
  if(!standing)clips.push(bake('autorig.sit',4,32,bindPose,0));}
 out.userData.autorig={template:tpl,bones:list.length,joints:Object.fromEntries(Object.entries(J).map(([k,v])=>[k,v.toArray().map(x=>+x.toFixed(4))])),standingBind:standing,
  ground:+ground.toFixed(4),toesAboveGround:['toeL','toeR','toeHL','toeHR'].map(n=>+(J[n].y-ground).toFixed(4)),legLength:+Lleg.toFixed(4),torsoLength:+torsoL.toFixed(4),pitchDeg:+(pitch0*180/Math.PI).toFixed(1),clips:clips.map(c=>c.name),vertices:meshes.reduce((a,m)=>a+m.geometry.attributes.position.count,0)};
 return {scene:out,animations:clips};
}
export default autorig;
