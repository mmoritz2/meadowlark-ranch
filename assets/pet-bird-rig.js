/* Meadowlark Ranch: a skeleton, feathered wings and flight for a bird model that came as a static scan.

   The realistic barn owl is a museum scan (Carnegie Museum of Natural History, CC BY 4.0): one textured
   mesh, perched on a stump, wings folded, head turned to the side, no bones and no clips. The game's owl
   must stand, hop, take off, flap and glide beside a winged horse, bank and land, so this module (reached
   through assets/pet-autorig.js with "autorig": {"template": "bird", ...} in the owl's manifest entry):
     1. bakes the scan into the bird's own frame (+Z forward, +Y up, feet on y=0), cuts the stump away,
        and turns the head back to face forward (a twist spread down the neck, the way an owl turns it);
     2. grafts a pair of feathered wings, the CG Cookie "Feathery Wing" (CC BY 3.0, a copy in
        assets/models/pets/owl-wing.glb): every feather laid behind the arm and widened so the vanes overlap,
        a continuous under-layer beneath them (an owl's wing is broad and rounded, not a comb of cards),
        recoloured barn-owl buff with grey-barred flight feathers above and white below, fitted at the shoulders;
     3. builds the bones (all bind rotations identity): root, body, chest, a three-bone neck and the head
        (the owl's big head turns are shared down the neck so the feathers never pinch), the tail, the legs
        (thigh, tarsus, toes) and each wing (arm, forearm, hand), with smooth skin weights;
     4. bakes the clips the game drives: idle (breathing, the head turning round to look), hop (both feet
        together, the legs put on the ground by two-bone IK through the body's lean, so a planted foot stays
        put), takeoff (from the push itself: the game lifts the bird on its first frame), fly (a fast downstroke,
        the hand half-folding on the way up), glide (wings held out), land (a flare, feet forward, then the wings
        fold and it stands: the pose the idle starts from). At rest each grafted wing is folded tight along the
        flank, under the scan's own folded wing.

   birdRig({THREE, scene, animations, entry, key, options}) -> Promise<{scene, animations}>
   options: {template:'bird', forward:[x,z], crop:{belowY}, headTwistDeg, neck:{base,head,radius},
     joints:{...} (bird frame, metres of the scan, left side; right is mirrored), wing:{file, length, root,...},
     hop:{T, stride, height}, fly:{hz}}
   Bones are named ab_<joint>; scene.userData.birdRig says what was built (for QA). */
const TAU=Math.PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),lerp=(a,b,k)=>a+(b-a)*k,sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const DEF_J={
 body:[0,0.078,-0.012],chest:[0,0.15,0.008],neck1:[0,0.188,0.022],neck2:[0,0.205,0.03],head:[0,0.224,0.038],crown:[0,0.295,0.05],
 tail1:[0,0.07,-0.072],tail2:[0,0.036,-0.118],tailTip:[0,0.006,-0.158],
 thighL:[0.026,0.098,0.004],shankL:[0.027,0.054,-0.002],footL:[0.022,0.01,0.012],toeL:[0.02,0.002,0.04],
 wingL:[0.052,0.19,-0.012]};
export async function birdRig({THREE,scene,animations,entry,key,options}){
 const O=options||{};
 const V=(x,y,z)=>new THREE.Vector3(x,y,z),A=a=>V(+a[0]||0,+a[1]||0,+a[2]||0);
 scene.updateMatrixWorld(true);
 /* ------------------------------------------------ 1. the scan, baked into the bird's frame ---------- */
 const fw=O.forward||[0,0,1],F=V(fw[0],0,fw.length>2?fw[2]:fw[1]).normalize(),U=V(0,1,0),L=V().crossVectors(U,F).normalize();
 const toBird=new THREE.Matrix4().makeBasis(L,U,F).invert();   // scene -> bird (x: the bird's left, y up, z forward)
 const src=[];scene.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh)src.push(o);});
 if(!src.length)throw new Error('bird rig: no static mesh');
 const scan=src.reduce((a,b)=>a.geometry.attributes.position.count>=b.geometry.attributes.position.count?a:b);
 const g0=scan.geometry,M=new THREE.Matrix4().multiplyMatrices(toBird,scan.matrixWorld),NM=new THREE.Matrix3().getNormalMatrix(M);
 const pos0=g0.attributes.position,n0=g0.attributes.normal,uv0=g0.attributes.uv,col0=g0.attributes.color;
 let N=pos0.count,P=new Float32Array(N*3),Nn=new Float32Array(N*3),UV=null,COL=null;const v=V(),nv=V();
 for(let i=0;i<N;i++){v.fromBufferAttribute(pos0,i).applyMatrix4(M);P[3*i]=v.x;P[3*i+1]=v.y;P[3*i+2]=v.z;if(n0){nv.fromBufferAttribute(n0,i).applyMatrix3(NM).normalize();Nn[3*i]=nv.x;Nn[3*i+1]=nv.y;Nn[3*i+2]=nv.z;}}
 /* the stump: every triangle with a corner below the cut goes, then any scrap left floating on its own */
 const idx0=g0.index?Array.from(g0.index.array):[...Array(N).keys()];
 const cutY=O.crop&&O.crop.belowY!=null?+O.crop.belowY:-1e9;
 let tri=[];for(let t=0;t<idx0.length;t+=3){const a=idx0[t],b=idx0[t+1],c=idx0[t+2];if(P[3*a+1]<cutY||P[3*b+1]<cutY||P[3*c+1]<cutY)continue;tri.push(a,b,c);}
 {/* keep the pieces that matter: union by shared (welded) positions, drop pieces under 1.5% of the triangles */
  const par=new Int32Array(N).map((_,i)=>i),f=x=>{while(par[x]!==x){par[x]=par[par[x]];x=par[x];}return x;},un=(a,b)=>{a=f(a);b=f(b);if(a!==b)par[a]=b;};
  const weld=new Map();for(let i=0;i<N;i++){const k=Math.round(P[3*i]*2e4)+','+Math.round(P[3*i+1]*2e4)+','+Math.round(P[3*i+2]*2e4);const w=weld.get(k);if(w==null)weld.set(k,i);else un(i,w);}
  for(let t=0;t<tri.length;t+=3){un(tri[t],tri[t+1]);un(tri[t],tri[t+2]);}
  const cnt=new Map();for(let t=0;t<tri.length;t+=3){const r=f(tri[t]);cnt.set(r,(cnt.get(r)||0)+1);}
  const keep=tri.length/3*0.015,out=[];for(let t=0;t<tri.length;t+=3)if(cnt.get(f(tri[t]))>=keep)out.push(tri[t],tri[t+1],tri[t+2]);tri=out;}
 /* the head turned back to face forward: a twist about the neck, all of it above the neck's top, none
    below its base, and fading out to the side (the shoulders stay where they are) */
 /* only the vertices still used (the stump's would otherwise count in the bounds the game fits to) */
 {const map=new Int32Array(N).fill(-1);let m=0;for(const i of tri)if(map[i]<0)map[i]=m++;
  const P2=new Float32Array(m*3),N2=new Float32Array(m*3),U2=uv0?new Float32Array(m*2):null,C2=col0?new Float32Array(m*3):null;
  for(let i=0;i<N;i++){const j=map[i];if(j<0)continue;for(let k=0;k<3;k++){P2[3*j+k]=P[3*i+k];N2[3*j+k]=Nn[3*i+k];}if(U2){U2[2*j]=uv0.getX(i);U2[2*j+1]=uv0.getY(i);}if(C2){C2[3*j]=col0.getX(i);C2[3*j+1]=col0.getY(i);C2[3*j+2]=col0.getZ(i);}}
  tri=tri.map(i=>map[i]);P=P2;Nn=N2;N=m;UV=U2;COL=C2;}
 const NK=O.neck||{},nb=A(NK.base||[0,0.19,0.025]),nh=A(NK.head||[0,0.245,0.045]),nAx=nh.clone().sub(nb),nLen=nAx.length();nAx.normalize();
 const twist=(+O.headTwistDeg||0)*Math.PI/180,nR=+NK.radius||0.065;
 if(twist){const q=new THREE.Quaternion(),d=V(),along=V();
  for(let i=0;i<N;i++){v.set(P[3*i],P[3*i+1],P[3*i+2]);d.copy(v).sub(nb);const t=d.dot(nAx)/nLen;if(t<=-0.1)continue;
   along.copy(nAx).multiplyScalar(d.dot(nAx));const rr=d.distanceTo(along);
   const w=sstep(-0.1,0.9,t)*(1-sstep(nR*0.8,nR*1.25,rr)*(1-sstep(0.9,1.4,t)));if(w<=0)continue;
   q.setFromAxisAngle(nAx,twist*w);d.applyQuaternion(q).add(nb);P[3*i]=d.x;P[3*i+1]=d.y;P[3*i+2]=d.z;
   nv.set(Nn[3*i],Nn[3*i+1],Nn[3*i+2]).applyQuaternion(q);Nn[3*i]=nv.x;Nn[3*i+1]=nv.y;Nn[3*i+2]=nv.z;}}
 const body=new THREE.BufferGeometry();
 body.setAttribute('position',new THREE.BufferAttribute(P,3));body.setAttribute('normal',new THREE.BufferAttribute(Nn,3));
 if(UV)body.setAttribute('uv',new THREE.BufferAttribute(UV,2));
 if(COL)body.setAttribute('color',new THREE.BufferAttribute(COL,3));
 body.setIndex(tri);
 /* ------------------------------------------------ 3. the joints and bones ---------------------------- */
 const J={};for(const k in DEF_J)J[k]=A((O.joints&&O.joints[k])||DEF_J[k]);
 const mir=p=>V(-p.x,p.y,p.z);
 for(const k of ['thigh','shank','foot','toe','wing'])J[k+'R']=O.joints&&O.joints[k+'R']?A(O.joints[k+'R']):mir(J[k+'L']);
 /* the wing's own joints, laid out from the shoulder along the span (x outwards), set by the graft below */
 const WG=O.wing||{},wLen=+WG.length||0.36;
 const WJ={elbow:+WG.elbow||0.3,wrist:+WG.wrist||0.62};   // share of the wing's length
 const wj=(s,f)=>{const sh=s>0?J.wingL:J.wingR;return V(sh.x+s*f*wLen,sh.y,sh.z);};
 J.wing2L=wj(1,WJ.elbow);J.wing3L=wj(1,WJ.wrist);J.wingTipL=wj(1,1);J.wing2R=wj(-1,WJ.elbow);J.wing3R=wj(-1,WJ.wrist);J.wingTipR=wj(-1,1);
 const DEF=[['root',null],['body','root'],['chest','body'],['neck1','chest'],['neck2','neck1'],['head','neck2'],['tail1','body'],['tail2','tail1'],
  ['thighL','body'],['shankL','thighL'],['footL','shankL'],['thighR','body'],['shankR','thighR'],['footR','shankR'],
  ['wingL','chest'],['wing2L','wingL'],['wing3L','wing2L'],['wingR','chest'],['wing2R','wingR'],['wing3R','wing2R']];
 J.root=V(0,0,0);
 const bones={},list=[];
 for(const [n,p] of DEF){const b=new THREE.Bone();b.name='ab_'+n;bones[n]=b;list.push(b);const w=J[n];if(p){bones[p].add(b);b.position.copy(w).sub(J[p]);}else b.position.copy(w);}
 const names=DEF.map(d=>d[0]),BI=Object.fromEntries(names.map((n,i)=>[n,i]));
 /* segments for the weights: each bone from its joint to its child's */
 const END={body:'chest',chest:'neck1',neck1:'neck2',neck2:'head',head:'crown',tail1:'tail2',tail2:'tailTip',thighL:'shankL',shankL:'footL',footL:'toeL',thighR:'shankR',shankR:'footR',footR:'toeR',
  wingL:'wing2L',wing2L:'wing3L',wing3L:'wingTipL',wingR:'wing2R',wing2R:'wing3R',wing3R:'wingTipR'};
 J.toeR=O.joints&&O.joints.toeR?A(O.joints.toeR):mir(J.toeL);
 const RAD={body:0.07,chest:0.07,tail1:0.03,tail2:0.025,thighL:0.022,shankL:0.012,footL:0.012,thighR:0.022,shankR:0.012,footR:0.012};
 const segD=(p,a,b)=>{const ab=v.copy(b).sub(a),t=clamp(nv.copy(p).sub(a).dot(ab)/Math.max(1e-12,ab.lengthSq()),0,1);return p.distanceTo(nv.copy(a).addScaledVector(ab,t));};
 /* ------------------------------------------------ skin weights of the scan ------------------------- */
 const SI=new Uint16Array(N*4),SW=new Float32Array(N*4),p=V();
 const legTop=Math.max(J.shankL.y,J.shankR.y)+0.012;
 for(let i=0;i<N;i++){p.set(P[3*i],P[3*i+1],P[3*i+2]);const w={};
  /* the neck and head by height along the neck, shared over four joints so a big turn never pinches */
  const d=p.clone().sub(nb),t=d.dot(nAx)/nLen,rr=d.clone().addScaledVector(nAx,-d.dot(nAx)).length();
  const headW=clamp(sstep(-0.15,0.05,t)*(1-sstep(nR*0.85,nR*1.3,rr)*(1-sstep(0.9,1.3,t))),0,1);
  if(headW>0){const s=clamp(t,0,1)*3;const k=[Math.max(0,1-Math.abs(s-0)),Math.max(0,1-Math.abs(s-1)),Math.max(0,1-Math.abs(s-2)),Math.max(0,1-Math.abs(s-3))];if(t>1)k[3]=1;
   const sum=k.reduce((x,y)=>x+y,0)||1;w.chest=(w.chest||0)+headW*k[0]/sum;w.neck1=headW*k[1]/sum;w.neck2=headW*k[2]/sum;w.head=headW*k[3]/sum;}
  const rest=1-headW;
  if(rest>1e-4){
   /* the legs below the belly feathers are all leg; the rest by distance to each bone against its thickness */
   const side=p.x>=0?'L':'R';
   if(p.y<legTop&&Math.abs(p.x-J['shank'+side].x)<0.03&&p.z>J.tail1.z+0.02){
    const a=segD(p,J['shank'+side],J['foot'+side]),b=segD(p,J['foot'+side],J['toe'+side]);const wa=1/Math.pow(a+0.004,4),wb=1/Math.pow(b+0.004,4);
    const up=sstep(legTop-0.012,legTop,p.y);w['shank'+side]=rest*(1-up)*wa/(wa+wb);w['foot'+side]=rest*(1-up)*wb/(wa+wb);w['thigh'+side]=rest*up;}
   else{const c={};let s=0;
    for(const n of ['body','chest','tail1','tail2','thighL','thighR']){if((n==='thighL'&&p.x<0)||(n==='thighR'&&p.x>0))continue;if(n.startsWith('tail')&&p.z>J.tail1.z+0.015)continue;
     const dd=segD(p,J[n],J[END[n]])/(RAD[n]||0.05);let wv=1/Math.pow(dd+0.05,4);if(n.startsWith('thigh'))wv*=0.6;c[n]=wv;s+=wv;}
    for(const n in c)w[n]=(w[n]||0)+rest*c[n]/s;}}
  const top=Object.entries(w).sort((a,b)=>b[1]-a[1]).slice(0,4),tot=top.reduce((x,y)=>x+y[1],0)||1;
  for(let k=0;k<4;k++){SI[4*i+k]=top[k]?BI[top[k][0]]:0;SW[4*i+k]=top[k]?top[k][1]/tot:0;}}
 /* smoothed over the welded surface, a few passes, so no seam shows between the bands */
 smoothWeights(THREE,body,SI,SW,names.length,3);
 body.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(SI,4));body.setAttribute('skinWeight',new THREE.Float32BufferAttribute(SW,4));
 const scanMat=Array.isArray(scan.material)?scan.material[0]:scan.material;scanMat.side=THREE.FrontSide;
 /* ------------------------------------------------ 2. the wings --------------------------------------- */
 const wingURL=new URL('./models/pets/'+(WG.file||'owl-wing.glb'),import.meta.url).href;
 const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
 const wg=await new GLTFLoader().loadAsync(wingURL);
 const wingGeo=buildWing(THREE,wg,WG,J,wLen,WJ,BI);
 const group=new THREE.Group();group.name='owl-rig';group.add(bones.root);group.updateMatrixWorld(true);
 const skel=new THREE.Skeleton(list);   // bone inverses from the bind pose, now that the bones are placed
 const bodyMesh=new THREE.SkinnedMesh(body,scanMat);bodyMesh.name='owl-body';
 const wingMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.9,metalness:0,side:THREE.FrontSide,name:'owl-wing'});
 const wingMesh=new THREE.SkinnedMesh(wingGeo,wingMat);wingMesh.name='owl-wings';
 for(const m of [bodyMesh,wingMesh]){group.add(m);m.bind(skel,new THREE.Matrix4());m.frustumCulled=false;}
 group.updateMatrixWorld(true);
 /* ------------------------------------------------ 4. the clips --------------------------------------- */
 const clips=bakeClips(THREE,bones,names,J,O);
 group.userData.birdRig={bones:list.length,clips:clips.map(c=>c.name),joints:Object.fromEntries(Object.entries(J).map(([k,v])=>[k,v.toArray().map(x=>+x.toFixed(4))])),
  triangles:tri.length/3,wingTriangles:wingGeo.index?wingGeo.index.count/3:wingGeo.attributes.position.count/3,twistDeg:+O.headTwistDeg||0};
 return {scene:group,animations:clips};
}
export default birdRig;

/* a few passes of neighbour averaging over the welded surface (the scan's seams are split vertices) */
function smoothWeights(THREE,geo,SI,SW,nb,passes){
 const pos=geo.attributes.position,N=pos.count,idx=geo.index.array;
 const weld=new Int32Array(N),map=new Map();for(let i=0;i<N;i++){const k=Math.round(pos.getX(i)*2e4)+','+Math.round(pos.getY(i)*2e4)+','+Math.round(pos.getZ(i)*2e4);const w=map.get(k);if(w==null){map.set(k,i);weld[i]=i;}else weld[i]=w;}
 const nbr=Array.from({length:N},()=>new Set());for(let t=0;t<idx.length;t+=3){for(let a=0;a<3;a++){const x=weld[idx[t+a]],y=weld[idx[t+(a+1)%3]];nbr[x].add(y);nbr[y].add(x);}}
 let W=new Float32Array(N*nb);for(let i=0;i<N;i++)for(let k=0;k<4;k++)W[i*nb+SI[4*i+k]]+=SW[4*i+k];
 for(let pz=0;pz<passes;pz++){const W2=new Float32Array(W);for(let i=0;i<N;i++){if(weld[i]!==i)continue;const s=nbr[i];if(!s.size)continue;for(let b=0;b<nb;b++){let a=0;for(const j of s)a+=W[j*nb+b];W2[i*nb+b]=W[i*nb+b]*0.5+0.5*a/s.size;}}W=W2;}
 for(let i=0;i<N;i++){const r=weld[i];const arr=[];for(let b=0;b<nb;b++){const x=W[r*nb+b];if(x>1e-4)arr.push([b,x]);}arr.sort((a,b)=>b[1]-a[1]);const top=arr.slice(0,4),s=top.reduce((x,y)=>x+y[1],0)||1;
  for(let k=0;k<4;k++){SI[4*i+k]=top[k]?top[k][0]:0;SW[4*i+k]=top[k]?top[k][1]/s:0;}}}

/* The CG Cookie wing, remade as a barn owl's: its feathers (the separate pieces of the long-feathers mesh)
   all laid behind the arm (the ones in front mirrored behind it), the cartoon shoulder ball dropped, the
   arm flattened into the wing's leading edge; buff and grey-barred above, white below; fitted to each
   shoulder, spread flat (span along x, trailing edge towards -z), and skinned to arm, forearm and hand. */
function buildWing(THREE,gltf,WG,J,wLen,WJ,BI){
 let fe=null,arm=null;gltf.scene.traverse(o=>{if(!o.isMesh)return;if(o.isSkinnedMesh)arm=o;else if(!fe||o.geometry.attributes.position.count>fe.geometry.attributes.position.count)fe=o;});
 /* the arm's line in the source (its bind pose): forearm root to the tip */
 const A0=[+(WG.srcRoot||[1.3,2.2])[0],+(WG.srcRoot||[1.3,2.2])[1]],A1=[7.75,5.257],A2=[10.2,4.93];
 const sx=A2[0]-A0[0],sy=A2[1]-A0[1],sl=Math.hypot(sx,sy),s=[sx/sl,sy/sl],c=[-s[1],s[0]];   // span, and the side the far feathers point to
 const segs=[[A0,A1],[A1,A2]];
 const near=(x,y)=>{let best=null;for(const [a,b] of segs){const dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy,t=clamp(((x-a[0])*dx+(y-a[1])*dy)/L2,0,1),px=a[0]+dx*t,py=a[1]+dy*t,d=Math.hypot(x-px,y-py);if(!best||d<best.d){const l=Math.sqrt(L2);best={d,px,py,nx:-dy/l,ny:dx/l};}}return best;};
 const tris=[];   // [x,y,z]*3 in source units, laid behind the arm, plus a feather id and whether it is a flight feather
 const fp=fe.geometry.attributes.position,fi=fe.geometry.index?fe.geometry.index.array:[...Array(fp.count).keys()];
 /* pieces by welded position */
 const n=fp.count,par=new Int32Array(n).map((_,i)=>i),f=x=>{while(par[x]!==x){par[x]=par[par[x]];x=par[x];}return x;};
 const wm=new Map();for(let i=0;i<n;i++){const k=Math.round(fp.getX(i)*1e3)+','+Math.round(fp.getY(i)*1e3)+','+Math.round(fp.getZ(i)*1e3);const w=wm.get(k);if(w==null)wm.set(k,i);else par[f(i)]=f(w);}
 for(let t=0;t<fi.length;t+=3){par[f(fi[t])]=f(fi[t+1]);par[f(fi[t+1])]=f(fi[t+2]);}
 const cen=new Map();for(let i=0;i<n;i++){const r=f(i);const e=cen.get(r)||[0,0,0,0,-1e9,0];e[0]+=fp.getX(i);e[1]+=fp.getY(i);e[2]+=fp.getZ(i);e[3]++;cen.set(r,e);}
 /* each feather: its root (the point nearest the arm) and whether it points to the far side */
 const info=new Map();for(const [r,e] of cen){const cx=e[0]/e[3],cy=e[1]/e[3],nr=near(cx,cy);const far=(cx-nr.px)*c[0]+(cy-nr.py)*c[1]>0;info.set(r,{nr,far,len:0});}
 for(let i=0;i<n;i++){const r=f(i),I=info.get(r),d=Math.hypot(fp.getX(i)-I.nr.px,fp.getY(i)-I.nr.py);if(d>I.len)I.len=d;}
 const put=(x,y,z,I)=>{if(I&&I.far){/* mirrored across the arm line at its root */const nx=I.nr.nx,ny=I.nr.ny,dd=(x-I.nr.px)*nx+(y-I.nr.py)*ny;x-=2*dd*nx;y-=2*dd*ny;z+=0.08;}
  const u=(x-A0[0])*s[0]+(y-A0[1])*s[1],w=-((x-A0[0])*c[0]+(y-A0[1])*c[1]);return [u,w,z];};   // u along the span, w behind the arm
 let fid=0;const ids=new Map();
 for(let t=0;t<fi.length;t+=3){const r=f(fi[t]),I=info.get(r);if(!ids.has(r))ids.set(r,fid++);const q=[];for(let k=0;k<3;k++){const i=fi[t+k];q.push(put(fp.getX(i),fp.getY(i),fp.getZ(i),I));}tris.push({q,id:ids.get(r),flight:I.len>1.6,arm:false});}
 /* (the cartoon arm is left out: its cream bar stood proud of the leading edge; the under-layer below makes the edge) */
 /* each feather widened about its own centre line, so neighbouring vanes overlap instead of standing apart
    like the teeth of a comb (never pushed in front of the arm) */
 {const WID=+WG.widen||1.6,byId=new Map();for(const t of tris){let e=byId.get(t.id);if(!e)byId.set(t.id,e=[]);e.push(t);}
  for(const ts of byId.values()){let cu=0,cw=0,n=0;for(const t of ts)for(const q of t.q){cu+=q[0];cw+=q[1];n++;}cu/=n;cw/=n;
   let suu=0,sww=0,suw=0;for(const t of ts)for(const q of t.q){const a=q[0]-cu,b=q[1]-cw;suu+=a*a;sww+=b*b;suw+=a*b;}
   const an=0.5*Math.atan2(2*suw,suu-sww),ax=[Math.cos(an),Math.sin(an)],px=[-ax[1],ax[0]];
   for(const t of ts)for(const q of t.q){const a=q[0]-cu,b=q[1]-cw,al=a*ax[0]+b*ax[1],pp=(a*px[0]+b*px[1])*WID,w0=q[1];q[0]=cu+ax[0]*al+px[0]*pp;q[1]=Math.max(cw+ax[1]*al+px[1]*pp,Math.min(w0,0));}}}
 /* size: the span of what is kept, to the wing's length; the trailing depth a little broader (owl wings are round) */
 let umax=0;for(const t of tris)for(const p of t.q)umax=Math.max(umax,p[0]);
 const k=wLen/umax,chordK=+WG.chord||1.15,thick=+WG.thick||0.6;
 const top=new THREE.Color(WG.top||'#c9955a'),grey=new THREE.Color(WG.grey||'#a59d92'),bar=new THREE.Color(WG.bar||'#6e6256'),under=new THREE.Color(WG.under||'#f4efe6'),edge=new THREE.Color(WG.edge||'#e2c89c');
 const pos=[],nor=[],col=[],si=[],sw=[],tmp=new THREE.Color(),a=new THREE.Vector3(),b=new THREE.Vector3(),cc=new THREE.Vector3(),nn=new THREE.Vector3();
 const hash=x=>{const s=Math.sin(x*127.1+311.7)*43758.5453;return s-Math.floor(s);};
 /* the under-layer's grid, in the feathers' own (u along the span, w behind the arm, z up) source units: NB bins
    along the span, NR rows across it; the outline is each bin's deepest feather point, smoothed twice; each
    grid point sits a little under the lowest feather above it */
 const NB=24,NR=4,wLo=new Float32Array(NB).fill(1e9),wHi=new Float32Array(NB).fill(-1e9);
 const binOf=u=>clamp(Math.floor(u/umax*NB),0,NB-1);
 for(const t of tris)for(const q of t.q){const i=binOf(q[0]);wLo[i]=Math.min(wLo[i],q[1]);wHi[i]=Math.max(wHi[i],q[1]);}
 for(let i=0;i<NB;i++){if(wHi[i]<-1e8){wHi[i]=i?wHi[i-1]:0;wLo[i]=i?wLo[i-1]:0;}wLo[i]=Math.min(wLo[i],0);}
 for(let pz=0;pz<2;pz++){const h=wHi.slice();for(let i=0;i<NB;i++)wHi[i]=(h[Math.max(0,i-1)]+2*h[i]+h[Math.min(NB-1,i+1)])/4;}
 /* feather tips that stood out past that smoothed outline are drawn in to it, so the trailing edge is one soft,
    rounded curve (an owl's), not a saw of separate points */
 {const outAt=u=>{const x=clamp(u/umax*NB-0.5,0,NB-1),i=Math.floor(x),f=x-i;return lerp(wHi[i],wHi[Math.min(NB-1,i+1)],f);};
  for(const t of tris)for(const q of t.q){const o=outAt(q[0])*1.04;if(q[1]>o)q[1]=o;}}
 const zc=Array.from({length:NB},()=>new Float32Array(NR).fill(1e9));
 for(const t of tris)for(const q of t.q){const i=binOf(q[0]),j=clamp(Math.floor((q[1]-wLo[i])/Math.max(1e-6,wHi[i]-wLo[i])*NR),0,NR-1);zc[i][j]=Math.min(zc[i][j],q[2]);}
 {let zAll=1e9;for(const r of zc)for(const z of r)zAll=Math.min(zAll,z);for(const r of zc)for(let j=0;j<NR;j++)if(r[j]>1e8)r[j]=zAll;}
 const zOff=0.0015/(k*thick),gridP=(i,j)=>{const ib=Math.min(NB-1,i),u=i/NB*umax,wl=i<NB?wLo[ib]:wLo[NB-1],wh=i<NB?(i?0.5*(wHi[i-1]+wHi[ib]):wHi[0]):wHi[NB-1]*0.35;
  let z=1e9;for(const a of [i-1,i])for(const b of [j-1,j])if(a>=0&&a<NB&&b>=0&&b<NR)z=Math.min(z,zc[a][b]);return [u,lerp(wl,wh,j/NR),z-zOff,j/NR];};
 const mem=[];for(let i=0;i<NB;i++)for(let j=0;j<NR;j++){const p00=gridP(i,j),p10=gridP(i+1,j),p01=gridP(i,j+1),p11=gridP(i+1,j+1);mem.push([p00,p10,p11],[p00,p11,p01]);}
 for(const side of [1,-1]){const sh=side>0?J.wingL:J.wingR,b1=BI[side>0?'wingL':'wingR'],b2=BI[side>0?'wing2L':'wing2R'],b3=BI[side>0?'wing3L':'wing3R'];
  for(const t of tris){
   const Pw=t.q.map(([u,w,z])=>[sh.x+side*u*k,sh.y+z*k*thick,sh.z-w*k*chordK]);
   a.fromArray(Pw[0]);b.fromArray(Pw[1]);cc.fromArray(Pw[2]);nn.subVectors(b,a).cross(cc.clone().sub(a)).normalize();
   const up=nn.y>=0;   // this face looks up or down
   for(const layer of [0,1]){   // the upper surface (buff) and the lower (white), each facing its own way
    const flip=(layer===0)!==up,off=(layer===0?1:-1)*0.0012;
    const order=flip?[0,2,1]:[0,1,2];
    for(const o of order){const pp=Pw[o],u=t.q[o][0]/umax,w=t.q[o][1];
     pos.push(pp[0],pp[1]+off,pp[2]);const ny=layer===0?1:-1;nor.push(nn.x*0.25*(flip?-1:1),ny,nn.z*0.25*(flip?-1:1));
     if(layer===0){tmp.copy(top).lerp(grey,sstep(0.45,0.95,u)*(t.flight?0.9:0.35));const h=hash(t.id+1);tmp.multiplyScalar(0.9+0.2*h);
      if(t.flight){const bars=Math.sin(w*5.2+h*3)>0.55;if(bars)tmp.lerp(bar,0.55);}if(t.arm)tmp.copy(edge);}
     else{tmp.copy(under);if(t.flight&&u>0.7&&w>2.2)tmp.lerp(bar,0.25);}
     col.push(tmp.r,tmp.g,tmp.b);
     /* arm, forearm, hand by the share of the span, blended across each joint */
     const e1=WJ.elbow,e2=WJ.wrist,bl=0.06;const w1=1-sstep(e1-bl,e1+bl,u),w3=sstep(e2-bl,e2+bl,u),w2=Math.max(0,1-w1-w3);
     si.push(b1,b2,b3,0);sw.push(w1,w2,w3,0);}}}
  /* the under-layer: one continuous surface from the arm to the feathers' own (smoothed) trailing outline, just
     under them, buff above and white below, so the wing reads as an owl's broad, rounded wing and never as
     separate cards with sky between them */
  for(const t of mem){const Pw=t.map(([u,w,z])=>[sh.x+side*u*k,sh.y+z*k*thick,sh.z-w*k*chordK]);
   a.fromArray(Pw[0]);b.fromArray(Pw[1]);cc.fromArray(Pw[2]);nn.subVectors(b,a).cross(cc.clone().sub(a)).normalize();
   const up=nn.y>=0;
   for(const layer of [0,1]){const flip=(layer===0)!==up,off=(layer===0?-0.0004:-0.0016),order=flip?[0,2,1]:[0,1,2];
    for(const o of order){const pp=Pw[o],u=t[o][0]/umax,wr=t[o][3];pos.push(pp[0],pp[1]+off,pp[2]);nor.push(0,layer===0?1:-1,0);
     if(layer===0){tmp.copy(top).lerp(grey,sstep(0.45,0.95,u)*0.5+0.35*sstep(0.55,1,wr)).multiplyScalar(0.8);}else tmp.copy(under);
     col.push(tmp.r,tmp.g,tmp.b);
     const e1=WJ.elbow,e2=WJ.wrist,bl=0.06;const w1=1-sstep(e1-bl,e1+bl,u),w3=sstep(e2-bl,e2+bl,u),w2=Math.max(0,1-w1-w3);
     si.push(b1,b2,b3,0);sw.push(w1,w2,w3,0);}}}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
 g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(sw,4));
 g.computeVertexNormals();
 return g;}

/* ------------------------------------------------ the clips, baked from a pose solver ------------------
   A pose is a local rotation per bone (Euler in the bird's axes: x across, y up, z forward; bind rotations
   are identity, so these compose simply), a scale for the wing roots (folded away) and the root's offset. */
function bakeClips(THREE,bones,names,J,O){
 const Q=()=>new THREE.Quaternion(),E=(x,y,z,o)=>new THREE.Euler(x||0,y||0,z||0,o||'XYZ');
 const qOf=(x,y,z,o)=>Q().setFromEuler(E(x,y,z,o));
 const leg=(J.thighL.y-J.footL.y);
 /* two-bone IK in the bird's side plane: thigh (hip -> ankle) and tarsus (ankle -> foot); returns the two
    pitch angles (about x) that put the foot on (y,z) relative to the hip, knee bent the way a bird's heel bends */
 const La=J.thighL.distanceTo(J.shankL),Lb=J.shankL.distanceTo(J.footL);
 const a0=Math.atan2(J.shankL.z-J.thighL.z,-(J.shankL.y-J.thighL.y)),b0=Math.atan2(J.footL.z-J.shankL.z,-(J.footL.y-J.shankL.y));
 function ik(dy,dz){   // target foot relative to hip (dy down negative)
  const d=clamp(Math.hypot(dy,dz),0.2*(La+Lb),(La+Lb)*0.999),ang=Math.atan2(dz,-dy);
  const cA=Math.acos(clamp((La*La+d*d-Lb*Lb)/(2*La*d),-1,1));
  const th=ang-cA;   // the thigh swings behind the line to the foot: the heel (ankle) sits behind, as a bird's does
  const ax=La*Math.sin(th),ay=-La*Math.cos(th);const tb=Math.atan2(dz-ax,-(dy-ay));
  return [-(th-a0),-(tb-b0)-(-(th-a0))];}   // local x-rotations (negative x = foot forward)
 const HIP=J.thighL.clone(),FOOT=J.footL.clone();
 const FOLDS=+(O.wing&&O.wing.foldScale)||0.02;
 const base=()=>{const p={};for(const n of names)p[n]=[0,0,0];p.wingScale=[FOLDS,FOLDS];p.root=[0,0,0];return p;};
 /* the folded wing: arm swept back and down along the flank, forearm forward, hand back, tucked under the scan's own */
 function fold(p,k){for(const s of ['L','R']){const sg=s==='L'?1:-1;p['wing'+s]=[0.25*k,sg*1.95*k,-sg*0.9*k];p['wing2'+s]=[0,-sg*2.6*k,0];p['wing3'+s]=[0,sg*2.5*k,0];}}
 /* the open wing at a stroke angle (radians, + up), sweep (forward +), the hand's fold (0 open, 1 half) */
 function wings(p,stroke,sweep,handFold,twist,pitchComp){for(const s of ['L','R']){const sg=s==='L'?1:-1;
   p['wing'+s]=[(pitchComp||0)+(twist||0),sg*(sweep||0),sg*stroke];p['wing2'+s]=[0,-sg*0.5*handFold,-sg*0.25*handFold];p['wing3'+s]=[0,sg*0.9*handFold,-sg*0.5*handFold];}p.wingScale=[1,1];}
 const legsTo=(p,dyL,dzL,dyR,dzR)=>{const l=ik(dyL,dzL),r=ik(dyR,dzR);p.thighL=[l[0],0,0];p.shankL=[l[1],0,0];p.thighR=[r[0],0,0];p.shankR=[r[1],0,0];};
 const restDy=FOOT.y-HIP.y,restDz=FOOT.z-HIP.z;
 /* the feet put at a point of the bird's own unpitched frame (offsets from where they stand), whatever the
    body's pitch: the hip is carried round by the pitched body and the target turned into the body's frame */
 const legsWorld=(p,pch,dy,dz)=>{const c=Math.cos(pch),s=Math.sin(pch),hy=HIP.y-J.body.y,hz=HIP.z-J.body.z,hipY=J.body.y+hy*c-hz*s,hipZ=J.body.z+hy*s+hz*c;
  const ty=FOOT.y+dy-hipY,tz=FOOT.z+dz-hipZ,by=ty*c+tz*s,bz=-ty*s+tz*c;legsTo(p,by,bz,by,bz);};
 /* the head's look: yaw shared down the neck (neck1 a fifth, neck2 a third, the head the rest) */
 const look=(p,yaw,pitch,roll)=>{p.neck1[1]+=yaw*0.2;p.neck2[1]+=yaw*0.3;p.head[1]+=yaw*0.5;p.neck2[0]+=pitch*0.4;p.head[0]+=pitch*0.6;p.head[2]+=roll||0;};
 /* poses */
 const idleAt=u=>{const p=base();fold(p,1);const br=Math.sin(TAU*u*4);p.chest[0]=0.012*br;p.root[1]=0.0012*br;
  /* the look round: front, over the left shoulder, front, a tilt, far round over the right, front */
  /* (a barn owl turns its head about 135 degrees each way: the far turns stay well inside that, so the game's
     own look towards you on top of them never takes the face round past it) */
  const keys=[[0,0,0],[0.1,0,0],[0.2,1.1,0],[0.34,1.1,0.05],[0.42,0,0],[0.5,0,0.3],[0.58,0,0.3],[0.64,0,0],[0.72,-1.5,0],[0.86,-1.5,-0.05],[0.95,0,0],[1,0,0]];
  let i=0;while(i<keys.length-2&&keys[i+1][0]<=u)i++;const k0=keys[i],k1=keys[i+1],f=sstep(0,1,(u-k0[0])/Math.max(1e-6,k1[0]-k0[0]));
  look(p,lerp(k0[1],k1[1],f),-0.05,lerp(k0[2],k1[2],f));p.tail1[0]=0.03*Math.sin(TAU*u*2);return p;};
 const H=O.hop||{},hopT=+H.T||0.42,hopS=+H.stride||0.09,hopH=+H.height||0.03;
 const hopAt=u=>{const p=base();fold(p,1);
  /* stance 0..0.45 (the crouch and the push), air 0.45..0.9, landing 0.9..1 */
  const air=u>0.45&&u<0.9,a=air?(u-0.45)/0.45:0;
  const g=u<0.45?0.08*sstep(0.2,0.45,u):u<0.9?0.08+0.92*sstep(0,1,a):1;   // the body's travel through the cycle
  const crouch=u<0.45?Math.sin(Math.PI*u/0.45)*0.012:u>=0.9?Math.sin(Math.PI*(u-0.9)/0.1)*0.008:0;
  const lift=air?Math.sin(Math.PI*a)*hopH:0;
  p.root=[0,lift-crouch,g*hopS];
  /* the feet: planted at the cycle's start, then carried to the next landing spot (both together) */
  const footZ=u<0.45?0:u<0.9?hopS*sstep(0.05,0.95,a):hopS,footY=air?Math.sin(Math.PI*a)*hopH*0.35:0;
  p.body[0]=air?0.12*Math.sin(Math.PI*a):u<0.45?0.1*Math.sin(Math.PI*u/0.45):0;p.neck2[0]=-p.body[0]*0.8;p.head[0]=-p.body[0]*0.2;
  /* (the target is turned into the pitched body's frame, so the lean of the push never drags a planted foot) */
  legsWorld(p,p.body[0],crouch-lift+footY,footZ-g*hopS);
  p.footL[0]=p.footR[0]=air?-0.5*Math.sin(Math.PI*a):0;   // the toes curl in the air
  p.tail1[0]=air?-0.2*Math.sin(Math.PI*a):0;
  /* a half-open flick of the wings for balance at the top of each hop */
  return p;};
 const FL=O.fly||{},pitch=+FL.pitch||1.05;   // the body's forward lean in flight
 const flyBody=(p,pch)=>{p.body[0]=pch;p.root=[0,0.05,0];p.neck1[0]=-pch*0.25;p.neck2[0]=-pch*0.35;p.head[0]=-pch*0.4;
  /* legs trailing back under the tail, toes closed */
  p.thighL[0]=p.thighR[0]=0.1;p.shankL[0]=p.shankR[0]=0.5;p.footL[0]=p.footR[0]=-0.7;p.tail1[0]=-0.15;p.tail2[0]=-0.05;};
 const flyAt=u=>{const p=base();flyBody(p,pitch);
  /* downstroke 0..0.55 (fast and strong), upstroke 0.55..1 with the hand half-folded */
  const down=u<0.55,s=down?Math.cos(Math.PI*u/0.55):-Math.cos(Math.PI*(u-0.55)/0.45);
  const stroke=0.15+0.85*s,hf=down?0.05:0.55*Math.sin(Math.PI*(u-0.55)/0.45);
  wings(p,stroke,down?0.15*Math.sin(Math.PI*u/0.55):-0.1,hf,0,-pitch);
  p.root[1]=0.05-0.012*Math.sin(TAU*u);p.body[0]+=0.04*Math.sin(TAU*u);return p;};
 const glideAt=u=>{const p=base();flyBody(p,pitch*0.95);wings(p,0.12+0.03*Math.sin(TAU*u),0.05,0.05,0,-pitch*0.95);p.root[1]=0.05+0.004*Math.sin(TAU*u);return p;};
 /* one pose laid over another, bone by bone (wing scales and the root offset too) */
 const mixP=(a,b,t)=>{if(t<=0)return a;const L3=(x,y)=>[lerp(x[0],y[0],t),lerp(x[1],y[1],t),lerp(x[2],y[2],t)];for(const n of names)a[n]=L3(a[n],b[n]);a.root=L3(a.root,b.root);a.wingScale=[lerp(a.wingScale[0],b.wingScale[0],t),lerp(a.wingScale[1],b.wingScale[1],t)];return a;};
 const standP=()=>{const p=base();fold(p,1);return p;};
 const takeoffAt=u=>{
  /* the game has the bird off the grass from the very first frame, so there is no crouch here: at u=0 it is the
     push itself (legs straight under it, body tipping forward), the wings come up out of the fold and are out and
     raised by u=0.08, the first downstroke follows at once, and the legs are drawn back into flight by u=0.3 */
  const k=sstep(0,0.35,u),pch=lerp(0.3,pitch*0.8,k);
  const p=base();flyBody(p,pch);
  const ph=u<0.08?0:(((u-0.08)/0.92)*2.4)%1,down=ph<0.5,s=down?Math.cos(Math.PI*ph/0.5):-Math.cos(Math.PI*(ph-0.5)/0.5);
  wings(p,0.2+0.9*s,0.1,down?0.05:0.6*Math.sin(Math.PI*(ph-0.5)/0.5),0,-pch);
  if(u<0.08){const f=standP();for(const n of ['wingL','wing2L','wing3L','wingR','wing2R','wing3R']){const o=sstep(0,0.08,u);p[n]=[lerp(f[n][0],p[n][0],o),lerp(f[n][1],p[n][1],o),lerp(f[n][2],p[n][2],o)];}}
  const sc=lerp(FOLDS,1,sstep(0,0.035,u));p.wingScale=[sc,sc];
  const lg=sstep(0.02,0.3,u),push=base();legsWorld(push,pch,0,0);
  for(const n of ['thighL','shankL','footL','thighR','shankR','footR'])p[n]=[lerp(push[n][0],p[n][0],lg),lerp(push[n][1],p[n][1],lg),lerp(push[n][2],p[n][2],lg)];
  p.root=[0,0.05*lg,0];p.tail1[0]=lerp(0.1,p.tail1[0],lg);
  return p;};
 const landAt=u=>{const p=base();
  /* the flare: body up, wings forward and high, beating short and braking, legs reaching forward for the ground;
     then (u 0.8..1) the wings fold down along the flanks and the bird stands, so the land clip ends in the same
     folded, standing pose the idle and the hop start from (the grafted wings shrink away only once folded) */
  const pch=lerp(pitch*0.6,0.05,sstep(0,0.8,u));p.body[0]=pch;p.neck2[0]=-pch*0.4;p.head[0]=-pch*0.5;p.root=[0,0.02*(1-u),0];
  const ph=(u*1.6)%1,s=Math.cos(TAU*ph);wings(p,0.7+0.35*s,0.35,0.2,0.25,-pch);
  const r=sstep(0.1,0.7,u);legsTo(p,restDy*lerp(0.7,1,r),restDz+0.03*(1-r),restDy*lerp(0.7,1,r),restDz+0.03*(1-r));p.footL[0]=p.footR[0]=0.3*(1-u);
  p.tail1[0]=-0.3*(1-u);
  const f=sstep(0.8,1,u);if(f>0){const sp=standP();sp.wingScale=[1,1];mixP(p,sp,f);const sc=lerp(1,FOLDS,sstep(0.85,1,u));p.wingScale=[sc,sc];}
  return p;};
 /* bake: quaternion tracks for every bone, scale for the wing roots, position for the root */
 const bake=(name,T,n,poseAt)=>{const times=new Float32Array(n+1);const qv={},sv={L:new Float32Array((n+1)*3),R:new Float32Array((n+1)*3)},rp=new Float32Array((n+1)*3);for(const nm of names)qv[nm]=new Float32Array((n+1)*4);
  const q=Q();
  for(let i=0;i<=n;i++){const u=i/n;times[i]=u*T;const pz=poseAt(u%1===0&&i===n?1:u);
   for(const nm of names){const e=pz[nm]||[0,0,0];q.setFromEuler(E(e[0],e[1],e[2],nm.startsWith('wing')?'XZY':'YXZ'));q.toArray(qv[nm],4*i);}
   sv.L.fill(pz.wingScale[0],3*i,3*i+3);sv.R.fill(pz.wingScale[1],3*i,3*i+3);
   rp[3*i]=J.root.x+pz.root[0];rp[3*i+1]=J.root.y+pz.root[1];rp[3*i+2]=J.root.z+pz.root[2];}
  const tracks=names.map(nm=>new THREE.QuaternionKeyframeTrack('ab_'+nm+'.quaternion',times,qv[nm]));
  tracks.push(new THREE.VectorKeyframeTrack('ab_wingL.scale',times,sv.L),new THREE.VectorKeyframeTrack('ab_wingR.scale',times,sv.R),new THREE.VectorKeyframeTrack('ab_root.position',times,rp));
  return new THREE.AnimationClip(name,T,tracks);};
 const out=[bake('bird.idle',12,240,idleAt),bake('bird.hop',hopT,24,hopAt),bake('bird.fly',1/(+FL.hz||3.2),24,flyAt),bake('bird.glide',2,24,glideAt),bake('bird.takeoff',0.7,42,takeoffAt),bake('bird.land',0.6,36,landAt)];
 /* the hop moves its root one stride, which the library measures and strips; the other clips stay put */
 return out;}
