/* Meadowlark Ranch: a skeleton, feathered wings and flight for a bird model that came as a static scan.

   The realistic barn owl is a museum scan (Carnegie Museum of Natural History, CC BY 4.0): one textured
   mesh, perched on a stump, wings folded, head turned to the side, no bones and no clips. The game's owl
   must stand, hop, take off, flap and glide beside a winged horse, bank and land, so this module (reached
   through assets/pet-autorig.js with "autorig": {"template": "bird", ...} in the owl's manifest entry):
     1. bakes the scan into the bird's own frame (+Z forward, +Y up, feet on y=0), cuts the stump away and caps
        the cut (the scan is drawn from the front only, so an open edge would show the sky through the bird),
        smooths shut the hollow the scan caught under the folded wing's edge on the rump, and turns the head back
        to face forward (a twist spread down the neck, the way an owl turns it); and evens out the photograph's
        exposure (its back and right side were shot in shadow, a dark chocolate beside the golden left side): each
        part lifted to the plumage's own brightness, golden above and white below, the texture's detail kept;
     2. draws a pair of open wings, feather by feather (buildWing, paintWing below): a barn owl's broad, rounded
        wing (ten primaries fanned into a rounded tip, fourteen secondaries along the trailing edge, tertials, the
        covert rows and a thick leading edge), cut from one painted atlas as an opaque alpha cutout, golden buff with
        grey dusting and dark bars above (its small coverts the scan's own covert pattern, sampled from its texture)
        and white below, the two wings the same feathers mirrored, fitted at the shoulders;
     3. builds the bones (all bind rotations identity): root, body, chest, a three-bone neck and the head
        (the owl's big head turns are shared down the neck so the feathers never pinch), the tail, the legs
        (thigh, tarsus, toes) and each wing (arm, forearm, hand), with smooth skin weights;
     4. bakes the clips the game drives: idle (breathing, the head turning round to look), hop (both feet
        together, the legs put on the ground by two-bone IK through the body's lean, so a planted foot stays
        put), takeoff (from the push itself: the game lifts the bird on its first frame), fly (a fast downstroke,
        the hand half-folding on the way up; the legs trailing under the tail and the rump drawn in, as nothing is
        folded over it any more), glide (wings held out), land (a flare, feet forward, then the wings
        fold and it stands: the pose the idle starts from). At rest each drawn wing is folded away under the scan's
        own folded wing; it grows out of the fold and fades in by a dither as it opens (and out as it folds), so the
        change between the scan's folded wings and the open ones is never a pop.

   birdRig({THREE, scene, animations, entry, key, options}) -> Promise<{scene, animations}>
   options: {template:'bird', forward:[x,z], crop:{belowY}, headTwistDeg, neck:{base,head,radius},
     pocket:{box:[[x,y,z],[x,y,z]], dark, grow} (the hollow to smooth shut), exposure:{top, under, max, passes, sky, off},
     joints:{...} (bird frame, metres of the scan, left side; right is mirrored), wing:{length, elbow, wrist, patch:[x,y,w,h]
     (the scan texture's covert patch), colors:{gold,buff,grey,bar,pale,shaft,under,spot,rim}, underGlow},
     hop:{T, stride, height}, fly:{hz, pitch, legs:[thigh,tarsus,toes], adduct:[left,right], tailScale:[x,y,z]}}
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
 /* the cut leaves openings on its plane (under the tail's tip, the soles of the toes), and the scan is drawn from
    the front only: each is closed with a cap, so the sky never shows through the bird */
 const scanMat0=Array.isArray(scan.material)?scan.material[0]:scan.material,TX=texSampler(scanMat0&&scanMat0.map);
 let WELD=null;{const c=capCut(THREE,P,Nn,UV,COL,tri,cutY,TX);if(c){P=c.P;Nn=c.Nn;UV=c.UV;COL=c.COL;tri=c.tri;N=P.length/3;WELD=c.weld;}}
 if(!WELD)WELD=weldOf(P);const ADJ=adjOf(WELD,tri);
 /* the pocket under the folded wing's edge on the rump (a gap the scan caught as a deep, black hollow, which faces up
    and back in flight and looked like a hole from the rider's seat): smoothed shut, its hollow drawn as plumage */
 const PK=O.pocket?fillPocket(P,Nn,UV,tri,TX,O.pocket,WELD,ADJ):null;
 const NK=O.neck||{},nb=A(NK.base||[0,0.19,0.025]),nh=A(NK.head||[0,0.245,0.045]),nAx=nh.clone().sub(nb),nLen=nAx.length();nAx.normalize();
 const twist=(+O.headTwistDeg||0)*Math.PI/180,nR=+NK.radius||0.065;
 if(twist){const q=new THREE.Quaternion(),d=V(),along=V();
  for(let i=0;i<N;i++){v.set(P[3*i],P[3*i+1],P[3*i+2]);d.copy(v).sub(nb);const t=d.dot(nAx)/nLen;if(t<=-0.1)continue;
   along.copy(nAx).multiplyScalar(d.dot(nAx));const rr=d.distanceTo(along);
   const w=sstep(-0.1,0.9,t)*(1-sstep(nR*0.8,nR*1.25,rr)*(1-sstep(0.9,1.4,t)));if(w<=0)continue;
   q.setFromAxisAngle(nAx,twist*w);d.applyQuaternion(q).add(nb);P[3*i]=d.x;P[3*i+1]=d.y;P[3*i+2]=d.z;
   nv.set(Nn[3*i],Nn[3*i+1],Nn[3*i+2]).applyQuaternion(q);Nn[3*i]=nv.x;Nn[3*i+1]=nv.y;Nn[3*i+2]=nv.z;}}
 const body=new THREE.BufferGeometry();
 const EXP=exposure(THREE,P,Nn,UV,tri,TX,O.exposure||{},PK&&PK.fill,WELD,ADJ);
 if(EXP)body.setAttribute('owlLift',new THREE.BufferAttribute(EXP.lift,3));
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
 const WJ={elbow:+WG.elbow||0.2,wrist:+WG.wrist||0.45};   // share of the wing's length (a barn owl's hand and primaries are over half its span)
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
    /* the rump behind the tail's root (the tail, and the folded wings' crossed tips lying on it) goes with the tail,
       so a flying owl can draw it in: its wings are open, and nothing is folded over the tail any more */
    const rr=sstep(J.tail1.z+0.02,J.tail1.z-0.025,p.z);
    if(rr>0){const tw=(c.tail1||0)+(c.tail2||0),tt=sstep(0.35,0.65,clamp((J.tail1.z-p.z)/Math.max(1e-6,J.tail1.z-J.tailTip.z),0,1)),add=rr*(s-tw);
     for(const n in c)if(!n.startsWith('tail'))c[n]*=1-rr;c.tail1=(c.tail1||0)+add*(1-tt);c.tail2=(c.tail2||0)+add*tt;}
    for(const n in c)w[n]=(w[n]||0)+rest*c[n]/s;}}
  const top=Object.entries(w).sort((a,b)=>b[1]-a[1]).slice(0,4),tot=top.reduce((x,y)=>x+y[1],0)||1;
  for(let k=0;k<4;k++){SI[4*i+k]=top[k]?BI[top[k][0]]:0;SW[4*i+k]=top[k]?top[k][1]/tot:0;}}
 /* smoothed over the welded surface, a few passes, so no seam shows between the bands */
 smoothWeights(THREE,body,SI,SW,names.length,3);
 body.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(SI,4));body.setAttribute('skinWeight',new THREE.Float32BufferAttribute(SW,4));
 const scanMat=Array.isArray(scan.material)?scan.material[0]:scan.material;scanMat.side=THREE.FrontSide;
 /* ------------------------------------------------ 2. the wings --------------------------------------- */
 /* drawn here, feather by feather, and painted in the scan's own plumage (its covert pattern sampled from the
    scan's texture): no second model to load */
 const wingGeo=buildWing(THREE,WG,J,wLen,WJ,BI);
 const wingTex=paintWing(THREE,scanMat&&scanMat.map?scanMat.map.image:null,WG);
 const group=new THREE.Group();group.name='owl-rig';group.add(bones.root);group.updateMatrixWorld(true);
 const skel=new THREE.Skeleton(list);   // bone inverses from the bind pose, now that the bones are placed
 /* the scan's own material, as the owl's (its exposure lift, and the underparts lit a little by the sky, as the underwing is) */
 const BM=bodyMaterialClass(THREE),bodyMat=new BM();THREE.MeshStandardMaterial.prototype.copy.call(bodyMat,scanMat);bodyMat.name=scanMat.name||'owl-body';bodyMat.userData.owlUnder=+(O.exposure&&O.exposure.sky!=null?O.exposure.sky:0.3);bodyMat.userData.owlLift=!!EXP;
 const bodyMesh=new THREE.SkinnedMesh(body,bodyMat);bodyMesh.name='owl-body';
 const WM=wingMaterialClass(THREE);
 /* (the under surface lit a little from within: thin white feathers seen from below with the sky behind them are
    never as dark as the ground's bounce alone would leave them) */
 const wingMat=new WM({map:wingTex,vertexColors:true,roughness:0.85,metalness:0,alphaTest:wingTex?0.5:0,side:THREE.FrontSide,name:'owl-wing',
  emissive:new THREE.Color(WG.underGlow||'#2d2b29'),emissiveMap:wingTex?underMask(THREE):null});
 if(!wingTex)wingMat.emissive.setRGB(0,0,0);
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

/* The caps for the cut: the open edges (half-edges with no twin, on the welded surface) walked into loops, and every
   loop lying on the cut plane filled, triangulated in that plane and facing down, on vertices of its own (so the
   lighting and the texture never pull at the scan's edge) that all take one texel from inside the face next to the
   opening (a texel from the edge itself can be the dark fill round the texture's islands): the palest of the faces round
   it, as the underside of a tail and the sole of a foot are. */
function capCut(THREE,P,Nn,UV,COL,tri,cutY,TX){
 if(!(cutY>-1e8))return null;
 const N=P.length/3,weld=weldOf(P);
 const he=new Set();for(let t=0;t<tri.length;t+=3)for(let k=0;k<3;k++)he.add(weld[tri[t+k]]*4194304+weld[tri[t+(k+1)%3]]);
 const nxt=new Map(),face=new Map();
 for(let t=0;t<tri.length;t+=3)for(let k=0;k<3;k++){const a=weld[tri[t+k]],b=weld[tri[t+(k+1)%3]];if(!he.has(b*4194304+a)){nxt.set(a,b);face.set(a,t);}}
 const seen=new Set(),caps=[];
 for(const s of nxt.keys()){if(seen.has(s))continue;const L=[];let c=s,ok=false;
  for(let g=0;g<20000;g++){if(seen.has(c)){ok=c===s;break;}seen.add(c);L.push(c);const n=nxt.get(c);if(n==null)break;c=n;}
  if(ok&&L.length>=3&&L.every(i=>Math.abs(P[3*i+1]-cutY)<0.012))caps.push(L);}
 if(!caps.length)return null;
 const add=caps.reduce((a,L)=>a+L.length,0),P2=new Float32Array((N+add)*3),N2=new Float32Array((N+add)*3),U2=UV?new Float32Array((N+add)*2):null,C2=COL?new Float32Array((N+add)*3):null;
 P2.set(P);N2.set(Nn);if(U2)U2.set(UV);if(C2)C2.set(COL);const W2=new Int32Array(N+add);W2.set(weld);
 let m=N;const out=tri.slice();
 for(const L of caps){
  let t0=face.get(L[0]);
  if(TX&&UV){let best=-1;for(const i of L){const t=face.get(i);const l=TX.lum((UV[2*tri[t]]+UV[2*tri[t+1]]+UV[2*tri[t+2]])/3,(UV[2*tri[t]+1]+UV[2*tri[t+1]+1]+UV[2*tri[t+2]+1])/3);if(l>best){best=l;t0=t;}}}
  const uv=U2?[(UV[2*tri[t0]]+UV[2*tri[t0+1]]+UV[2*tri[t0+2]])/3,(UV[2*tri[t0]+1]+UV[2*tri[t0+1]+1]+UV[2*tri[t0+2]+1])/3]:null,src=tri[t0];
  const base=m;for(const i of L){W2[m]=weld[i];P2[3*m]=P[3*i];P2[3*m+1]=P[3*i+1];P2[3*m+2]=P[3*i+2];N2[3*m]=0;N2[3*m+1]=-1;N2[3*m+2]=0;if(U2){U2[2*m]=uv[0];U2[2*m+1]=uv[1];}if(C2){C2[3*m]=COL[3*src];C2[3*m+1]=COL[3*src+1];C2[3*m+2]=COL[3*src+2];}m++;}
  const fc=THREE.ShapeUtils.triangulateShape(L.map(i=>new THREE.Vector2(P[3*i],P[3*i+2])),[]);
  for(const f of fc){const a=base+f[0],b=base+f[1],c=base+f[2];
   const ux=P2[3*b]-P2[3*a],uz=P2[3*b+2]-P2[3*a+2],vx=P2[3*c]-P2[3*a],vz=P2[3*c+2]-P2[3*a+2],ny=uz*vx-ux*vz;   // (the face's normal, its y)
   if(ny<0)out.push(a,b,c);else out.push(a,c,b);}}
 return {P:P2,Nn:N2,UV:U2,COL:C2,tri:out,weld:W2,caps:caps.map(L=>L.length)};}
/* the welded surface: each vertex's first twin at its position (the scan's seams are split vertices), and the welded
   neighbours as one compact list (an edge is listed from both its faces, so every neighbour counts the same) */
function weldOf(P){const N=P.length/3,w=new Int32Array(N),m=new Map(),q=x=>Math.round(x*2e4)+40000;
 for(let i=0;i<N;i++){const k=q(P[3*i])*6400160001+q(P[3*i+1])*80001+q(P[3*i+2]),r=m.get(k);if(r==null){m.set(k,i);w[i]=i;}else w[i]=r;}return w;}
function adjOf(weld,tri){const N=weld.length,deg=new Int32Array(N+1);
 for(let t=0;t<tri.length;t+=3)for(let k=0;k<3;k++){const a=weld[tri[t+k]],b=weld[tri[t+(k+1)%3]];if(a!==b){deg[a+1]++;deg[b+1]++;}}
 for(let i=0;i<N;i++)deg[i+1]+=deg[i];const nb=new Int32Array(deg[N]),cur=deg.slice(0,N);
 for(let t=0;t<tri.length;t+=3)for(let k=0;k<3;k++){const a=weld[tri[t+k]],b=weld[tri[t+(k+1)%3]];if(a!==b){nb[cur[a]++]=b;nb[cur[b]++]=a;}}
 return {deg,nb};}
/* The pocket, smoothed shut. Its hollow is found by the photograph's own shadow (vertices in the given box whose
   texture is near black, the largest connected patch of them), grown a few rings over its lip; that patch is then
   drawn tight across its edge (each free vertex moved to its neighbours' mean, many times over, the rest held: a
   membrane over the opening, so the hollow is gone and the rump is smooth), and the faces round it get new normals.
   X: {box:[[x,y,z],[x,y,z]] (the bird's frame), dark (texel brightness, 0.1), grow (rings, 3)}.
   -> {fill: Float32Array(N): 1 on the smoothed patch, fading over two rings round it; moved: how many vertices} */
function fillPocket(P,Nn,UV,tri,TX,X,weld,adj){
 const B=X&&X.box;if(!B||!UV||!TX)return null;
 const N=P.length/3,{deg,nb}=adj,S=new Float32Array(N),C=new Float32Array(N);
 for(let t=0;t<tri.length;t+=3){const a=tri[t],b=tri[t+1],c=tri[t+2],l=TX.lum((UV[2*a]+UV[2*b]+UV[2*c])/3,(UV[2*a+1]+UV[2*b+1]+UV[2*c+1])/3);for(let k=0;k<3;k++){const r=weld[tri[t+k]];S[r]+=l;C[r]++;}}
 const inB=r=>P[3*r]>=B[0][0]&&P[3*r]<=B[1][0]&&P[3*r+1]>=B[0][1]&&P[3*r+1]<=B[1][1]&&P[3*r+2]>=B[0][2]&&P[3*r+2]<=B[1][2];
 const dk=+X.dark||0.1,seed=new Uint8Array(N);for(let r=0;r<N;r++)if(weld[r]===r&&C[r]>0&&S[r]/C[r]<dk&&inB(r))seed[r]=1;
 /* the largest connected patch of them */
 let best=[];const vis=new Uint8Array(N);
 for(let s0=0;s0<N;s0++){if(!seed[s0]||vis[s0])continue;const q=[s0],comp=[];vis[s0]=1;while(q.length){const r=q.pop();comp.push(r);for(let j=deg[r];j<deg[r+1];j++){const n=nb[j];if(seed[n]&&!vis[n]){vis[n]=1;q.push(n);}}}if(comp.length>best.length)best=comp;}
 if(best.length<12)return null;
 /* grown over the lip, ring by ring (and two more rings, for the fade of its painting) */
 const grow=X.grow!=null?+X.grow:3,ring=new Int16Array(N).fill(-1);for(const r of best)ring[r]=0;let front=best,free=best.slice();
 for(let g=1;g<=grow+2;g++){const nx=[];for(const r of front)for(let j=deg[r];j<deg[r+1];j++){const n=nb[j];if(ring[n]<0){ring[n]=g;nx.push(n);if(g<=grow)free.push(n);}}front=nx;}
 /* drawn tight: a membrane over the patch's edge */
 for(let it=0;it<400;it++){let mv=0;for(const r of free){const d0=deg[r],d1=deg[r+1];if(d1===d0)continue;let x=0,y=0,z=0;for(let j=d0;j<d1;j++){const n=3*nb[j];x+=P[n];y+=P[n+1];z+=P[n+2];}const k=1/(d1-d0);x*=k;y*=k;z*=k;
  mv=Math.max(mv,Math.abs(x-P[3*r])+Math.abs(y-P[3*r+1])+Math.abs(z-P[3*r+2]));P[3*r]=x;P[3*r+1]=y;P[3*r+2]=z;}if(mv<2e-6)break;}   // (until it has settled: under 2 microns a pass)
 /* new normals over the patch and a ring round it (area-weighted face normals, on the welded surface) */
 const acc=new Float32Array(3*N),near=r=>ring[r]>=0&&ring[r]<=grow+1;
 for(let i=0;i<N;i++){const r=weld[i];if(r!==i&&ring[r]>=0&&ring[r]<=grow){P[3*i]=P[3*r];P[3*i+1]=P[3*r+1];P[3*i+2]=P[3*r+2];}}
 for(let t=0;t<tri.length;t+=3){const a=tri[t],b=tri[t+1],c=tri[t+2],ra=weld[a],rb=weld[b],rc=weld[c];if(!near(ra)&&!near(rb)&&!near(rc))continue;
  const ux=P[3*b]-P[3*a],uy=P[3*b+1]-P[3*a+1],uz=P[3*b+2]-P[3*a+2],vx=P[3*c]-P[3*a],vy=P[3*c+1]-P[3*a+1],vz=P[3*c+2]-P[3*a+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
  for(const r of [ra,rb,rc]){acc[3*r]+=nx;acc[3*r+1]+=ny;acc[3*r+2]+=nz;}}
 for(let i=0;i<N;i++){const r=weld[i];if(!near(r))continue;const l=Math.hypot(acc[3*r],acc[3*r+1],acc[3*r+2])||1;Nn[3*i]=acc[3*r]/l;Nn[3*i+1]=acc[3*r+1]/l;Nn[3*i+2]=acc[3*r+2]/l;}
 const fill=new Float32Array(N);for(let i=0;i<N;i++){const g=ring[weld[i]];if(g<0)continue;fill[i]=g<=grow?1:g===grow+1?0.55:0.2;}
 return {fill,moved:free.length,seed:best.length};}
/* the scan's texture, read back small (512 across) for its brightness at a uv: null where there is no page */
function texSampler(tex){
 const img=tex&&tex.image,fy=!!(tex&&tex.flipY);   // (a glTF texture is not flipped: v runs down the image)
 if(!img||!img.width||typeof document==='undefined')return null;
 try{const W=Math.min(512,img.width),H=Math.max(1,Math.round(W*img.height/img.width)),c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,W,H);const D=x.getImageData(0,0,W,H).data;
  return {lum:(u,v)=>{const px=Math.min(W-1,Math.max(0,Math.floor(u*W))),py=Math.min(H-1,Math.max(0,Math.floor((fy?1-v:v)*H))),k=4*(py*W+px);return (0.299*D[k]+0.587*D[k+1]+0.114*D[k+2])/255;}};}catch(e){return null;}}
/* The scan's exposure, evened out. The museum's photographs left the bird's back and its right side in shadow (the
   texture there is a dark chocolate, about half as bright as its sunlit left side, where the same plumage is golden
   and white), so a flying owl, seen from above and behind, was a dark seed between golden wings. Each vertex gets the
   brightness of its neighbourhood (the texture under the faces round it, spread over the surface until a spot or a
   bar no longer counts, only the light the photograph had there), and a lift that brings a neighbourhood darker than
   the plumage's own up to it: golden above, white on the underparts. The texture's detail is kept (every texel scaled
   by its neighbourhood's lift), and a part already as bright (the face, the left wing) is left as it is.
   -> {lift: Float32Array(N*3): the lift (on the sRGB texel), how far the vertex faces down, and how much of it is the
   smoothed-over pocket (fill, from fillPocket)} */
function exposure(THREE,P,Nn,UV,tri,TX,X,fill,weld,adj){
 if(!UV||!TX||X.off)return null;
 const N=P.length/3;
 const S=new Float64Array(N),A=new Float64Array(N);
 for(let t=0;t<tri.length;t+=3){const a=tri[t],b=tri[t+1],c=tri[t+2];
  const ux=P[3*b]-P[3*a],uy=P[3*b+1]-P[3*a+1],uz=P[3*b+2]-P[3*a+2],vx=P[3*c]-P[3*a],vy=P[3*c+1]-P[3*a+1],vz=P[3*c+2]-P[3*a+2];
  const ar=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)*0.5;if(!(ar>0))continue;
  const l=TX.lum((UV[2*a]+UV[2*b]+UV[2*c])/3,(UV[2*a+1]+UV[2*b+1]+UV[2*c+1])/3);
  S[weld[a]]+=l*ar;A[weld[a]]+=ar;S[weld[b]]+=l*ar;A[weld[b]]+=ar;S[weld[c]]+=l*ar;A[weld[c]]+=ar;}
 /* spread over the surface: neighbour averaging on the welded mesh */
 const {deg,nb}=adj;
 let L=new Float32Array(N),L2=new Float32Array(N);const roots=[];for(let i=0;i<N;i++)if(weld[i]===i){L[i]=A[i]>0?S[i]/A[i]:0.5;roots.push(i);}const RT=Int32Array.from(roots);
 const passes=+X.passes||45;   // (each pass the plain mean of the neighbours: about 4 cm of the scan spread in 45)
 for(let p=0;p<passes;p++){for(let q=0;q<RT.length;q++){const i=RT[q];const d0=deg[i],d1=deg[i+1];if(d1===d0){L2[i]=L[i];continue;}let s=0;for(let j=d0;j<d1;j++)s+=L[nb[j]];L2[i]=s/(d1-d0);}const t=L;L=L2;L2=t;}
 const top=+X.top||0.62,under=+X.under||0.72,gMax=+X.max||3.8,lift=new Float32Array(N*3);
 /* the underparts: what faces down as it stands, and what faces down once it leans into its flight (the breast, the
    belly, the lower flanks where the folded wing's edge lies: a flying barn owl is white below), never the head */
 const fp=+X.flightPitch||1.0,cp=Math.cos(fp),sp=Math.sin(fp),hy=+X.headY||0.185;
 for(let i=0;i<N;i++){const r=weld[i],ny=Nn[3*i+1],nz=Nn[3*i+2],fy=ny*cp-nz*sp;
  const dn=Math.max(sstep(0.15,-0.55,ny),0.85*sstep(-0.25,-0.8,fy))*(1-sstep(hy-0.015,hy+0.01,P[3*i+1])),T=lerp(top,under,dn);
  lift[3*i]=clamp(T/Math.max(0.05,L[r]),1,gMax);lift[3*i+1]=dn;lift[3*i+2]=fill?fill[i]:0;}
 return {lift};}
/* a few passes of neighbour averaging over the welded surface (the scan's seams are split vertices) */
function smoothWeights(THREE,geo,SI,SW,nb,passes){
 const pos=geo.attributes.position,N=pos.count,idx=geo.index.array;
 const weld=new Int32Array(N),map=new Map();for(let i=0;i<N;i++){const k=Math.round(pos.getX(i)*2e4)+','+Math.round(pos.getY(i)*2e4)+','+Math.round(pos.getZ(i)*2e4);const w=map.get(k);if(w==null){map.set(k,i);weld[i]=i;}else weld[i]=w;}
 const nbr=Array.from({length:N},()=>new Set());for(let t=0;t<idx.length;t+=3){for(let a=0;a<3;a++){const x=weld[idx[t+a]],y=weld[idx[t+(a+1)%3]];nbr[x].add(y);nbr[y].add(x);}}
 let W=new Float32Array(N*nb);for(let i=0;i<N;i++)for(let k=0;k<4;k++)W[i*nb+SI[4*i+k]]+=SW[4*i+k];
 for(let pz=0;pz<passes;pz++){const W2=new Float32Array(W);for(let i=0;i<N;i++){if(weld[i]!==i)continue;const s=nbr[i];if(!s.size)continue;for(let b=0;b<nb;b++){let a=0;for(const j of s)a+=W[j*nb+b];W2[i*nb+b]=W[i*nb+b]*0.5+0.5*a/s.size;}}W=W2;}
 for(let i=0;i<N;i++){const r=weld[i];const arr=[];for(let b=0;b<nb;b++){const x=W[r*nb+b];if(x>1e-4)arr.push([b,x]);}arr.sort((a,b)=>b[1]-a[1]);const top=arr.slice(0,4),s=top.reduce((x,y)=>x+y[1],0)||1;
  for(let k=0;k<4;k++){SI[4*i+k]=top[k]?top[k][0]:0;SW[4*i+k]=top[k]?top[k][1]/s:0;}}}

/* ------------------------------------------------ the wings, drawn feather by feather -----------------
   A barn owl's wing, open: broad and rounded. Ten primaries fanned from the hand into a rounded tip, fourteen
   secondaries along the forearm making the long trailing edge, three tertials into the body, and over their
   bases the coverts (primary coverts, greater and median coverts, the alula) and a panel of small coverts that
   makes the thick leading edge. Every feather is a strip (a shallow ridge along its shaft) cut out of one painted
   atlas by its alpha (a cutout, never blended: no sorting, no seams), laid inner-over-outer the way a bird's
   are, arched (the thick leading edge high, the flight feathers sloping down to the trailing edge, so even edge on
   the wing has a shape) and the outer primaries curling up at the tips.
   Each strip is two layers, the upper surface facing up (golden buff, grey-dusted and dark-barred) and the
   under surface facing down (white), both wings the same feathers mirrored. Flight feathers and coverts move
   with the bone they grow from (primaries the hand, secondaries the forearm, tertials the arm); the covert
   panels bend with the wing. Layout units: the wing's length, u out along the span from the shoulder, w back
   from the arm, y up. */
const AW=2048,AH=1024,TM=0.02,SM=0.46;   // the atlas (upper surfaces on the left half, under on the right); a cell's margins
const CELLS={prA:[0,0,1024,128,4.4],prB:[0,128,1024,128,4.0],sec:[0,256,1024,128,4.6],ter:[0,384,1024,128,3.4],
 gcv:[0,512,512,128,2.4],pcv:[512,512,512,128,1.9],mcv:[0,640,512,128,1.7],alu:[512,640,512,128,2.9],les:[0,768,1024,256,4]};   // x, y, w, h, the feather's length over its width
const cellUV=(c,t,s,under)=>{const C=CELLS[c];return [(C[0]+(under?AW/2:0)+(TM+(1-2*TM)*t)*C[2])/AW,1-(C[1]+(0.5+SM*s)*C[3])/AH];};
/* value noise on a fixed table of random numbers (integer lattice; a table look-up, not a sine, per corner: the painter
   visits half a million texels) */
const HT=(()=>{const t=new Float32Array(65536);let a=0x9e3779b9;for(let i=0;i<65536;i++){a^=a<<13;a^=a>>>17;a^=a<<5;t[i]=(a>>>0)/4294967296;}return t;})();
const hsh=(x,y)=>HT[(x&255)|((y&255)<<8)];
const vn=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);return lerp(lerp(hsh(xi,yi),hsh(xi+1,yi),u),lerp(hsh(xi,yi+1),hsh(xi+1,yi+1),u),v);};
/* the line the feathers grow from: the arm angled forward to the wrist (the carpal joint leads the wing), the
   hand sweeping back from it to the tip */
const armLine=(u,e2)=>u<=e2?-0.055*Math.sin(0.5*Math.PI*u/e2):-0.055+0.1*Math.pow((u-e2)/(1-e2),1.2);
function wingLayout(WJ){
 const e2=WJ.wrist,F=[];let id=0;const rnd=k=>{const s=Math.sin(k*57.3+3.7)*43758.5453;return s-Math.floor(s);};
 const R=(u,w)=>[u,w+armLine(u,e2)];
 /* primaries, P10 (outermost, lowest) to P1: rooted along the hand, fanned from nearly along the span to well back,
    the longest (P9 to P7) making a rounded tip */
 for(let i=0;i<10;i++){const k=i/9;F.push({cell:i<5?'prA':'prB',root:R(lerp(e2+0.325,e2+0.02,k),0.006),ang:lerp(3,82,Math.pow(k,0.9)),len:[0.27,0.325,0.355,0.37,0.38,0.39,0.395,0.4,0.4,0.4][i],
  wid:lerp(0.072,0.094,k),y:0.0012*i,droop:-0.04*k,lift:0.05*(1-k),bone:'hand',id:id++});}
 /* secondaries, S1 (at the wrist) to S14, and the tertials: the broad trailing edge into the body */
 for(let j=0;j<14;j++){const k=j/13;F.push({cell:'sec',root:R(lerp(e2-0.005,0.105,k),0.006),ang:lerp(86,97,k),len:0.4-0.012*k,wid:0.08,y:0.013+0.0008*j,droop:-0.05,id:id++});}
 [[0.085,101,0.35],[0.06,109,0.32],[0.035,117,0.27]].forEach(([u,a,l],j)=>F.push({cell:'ter',root:R(u,0.004),ang:a,len:l,wid:0.09,y:0.026+0.001*j,droop:-0.04,id:id++}));
 /* the coverts over their bases, inner over outer again, each row above the one behind it (mirrored at random,
    and a little longer or shorter, so their spots never line up) */
 for(let i=0;i<10;i++){const p=F[i];F.push({cell:'pcv',root:[p.root[0]+0.004,p.root[1]-0.014],ang:p.ang,len:lerp(0.125,0.14,i/9),wid:0.07,y:0.03+0.0009*i,droop:-0.012,bone:'hand',id:id++});}
 for(let j=0;j<14;j++){const p=F[10+j];F.push({cell:'gcv',root:[p.root[0]+0.004,p.root[1]-0.018],ang:p.ang,len:0.18*(0.92+0.16*rnd(id)),wid:0.074,y:0.034+0.0006*j,droop:-0.014,flip:rnd(id+9)>0.5,id:id++});}
 for(let m=0;m<12;m++){const k=m/11;F.push({cell:'mcv',root:R(lerp(e2+0.01,0.06,k),-0.034),ang:lerp(86,96,k),len:0.11*(0.9+0.2*rnd(id)),wid:0.064,y:0.044+0.0005*m,droop:-0.003,flip:rnd(id+5)>0.5,id:id++});}
 F.push({cell:'alu',root:R(e2+0.005,-0.036),ang:4,len:0.1,wid:0.036,y:0.056,droop:0,ridge:0.002,bone:'hand',id:id++});
 return F;}
function buildWing(THREE,WG,J,wLen,WJ,BI){
 const e1=WJ.elbow,e2=WJ.wrist,bl=0.03;
 const wts=(u,bone)=>{if(bone==='hand')return [0,0,1];const w1=1-sstep(e1-bl,e1+bl,u),w3=sstep(e2-bl,e2+bl,u);return [w1,Math.max(0,1-w1-w3),w3];};
 const pos=[],uv=[],col=[],si=[],sw=[],idx=[];
 const rnd=k=>{const s=Math.sin(k*91.7+13.1)*43758.5453;return s-Math.floor(s);};
 const F=wingLayout(WJ);
 for(const side of [1,-1]){const sh=side>0?J.wingL:J.wingR,b1=BI[side>0?'wingL':'wingR'],b2=BI[side>0?'wing2L':'wing2R'],b3=BI[side>0?'wing3L':'wing3R'];
  const P=(u,w,y)=>[sh.x+side*u*wLen,sh.y+y*wLen,sh.z-w*wLen];
  /* two triangles facing up (the upper surface) or down (the under), whichever way the mirror left them */
  const tri=(a,b,c,under)=>{const A=3*a,B=3*b,C=3*c,ux=pos[B]-pos[A],uy=pos[B+1]-pos[A+1],uz=pos[B+2]-pos[A+2],vx=pos[C]-pos[A],vy=pos[C+1]-pos[A+1],vz=pos[C+2]-pos[A+2];
   const ny=uz*vx-ux*vz;if((ny>0)===!under)idx.push(a,b,c);else idx.push(a,c,b);};
  const grid=(NT,SS,at,cell,tint,W,toff)=>{for(const under of [0,1]){const base=pos.length/3;
    for(let i=0;i<=NT;i++){const t=i/NT;for(const s of SS){const q=at(t,s);pos.push(...P(q[0],q[1],q[2]));const c=cellUV(cell,t+(toff||0),s,under);uv.push(c[0],c[1]);col.push(tint,tint,tint);
     const ww=W||wts(q[0]);si.push(b1,b2,b3,0);sw.push(ww[0],ww[1],ww[2],0);}}
    const n=SS.length;for(let i=0;i<NT;i++)for(let j=0;j<n-1;j++){const A=base+i*n+j,B=A+1,C=A+n,D=C+1;tri(A,C,B,under);tri(B,C,D,under);}}};
  for(const f of F){const a=f.ang*Math.PI/180,d=[Math.cos(a),Math.sin(a)],p=[Math.sin(a),-Math.cos(a)],rg=f.ridge!=null?f.ridge:0.003,fs=f.flip?-1:1;
   grid(6,[-1,0,1],(t,s)=>[f.root[0]+d[0]*t*f.len-p[0]*fs*s*f.wid/2,f.root[1]+d[1]*t*f.len-p[1]*fs*s*f.wid/2,f.y+(f.droop||0)*t+(f.lift||0)*t*t+rg*(1-Math.abs(s))],f.cell,0.96+0.06*rnd(f.id+side*0.5),wts(f.root[0],f.bone),(rnd(f.id*3.1+7)-0.5)*0.03);}   // (a feather's tint and its place along the painted cell a little its own, so neighbours never make a grid)
  /* the small coverts: a panel from the leading edge (rolled under, the wing's thick front) back over the roots of
     the median coverts, along the arm to the wrist; then a narrower one along the hand, over the primary coverts' roots */
  const uA=e2+0.03;
  grid(12,[-1,-0.6,-0.2,0.3,1],(t,s)=>{const u=t*uA,o=armLine(u,e2),wf=-0.03-0.02*Math.sin(Math.PI*Math.min(1,t*1.05))+o,wr=0.03+o,k=(s+1)/2;return [u,lerp(wf,wr,k),0.054-0.03*Math.pow(1-sstep(0,0.3,k),2)-0.006*k];},'les',1,null);
  grid(8,[-1,-0.5,0,1],(t,s)=>{const u=lerp(e2-0.02,e2+0.36,t),o=armLine(u,e2),wf=lerp(-0.05,-0.012,t*t)+o,wr=lerp(0.035,0.0,t)+o,k=(s+1)/2;return [u,lerp(wf,wr,k),lerp(0.052,0.036,t)-0.016*Math.pow(1-sstep(0,0.35,k),2)];},'les',0.97,null);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(sw,4));
 g.setIndex(idx);g.computeVertexNormals();
 return g;}
/* The atlas, painted once a page. Upper surfaces: flight feathers golden buff at the base, dusted grey towards
   the tip on the outer vane, crossed by four dark bars, the tips pale; coverts golden with grey-peppered centres
   and the barn owl's small white spot edged in black; the small-covert panel is the scan's own covert patch
   (texture pixels "patch": [x,y,w,h]), matched to the palette's brightness. Under surfaces white, the flight
   feathers faintly barred near the tip, the coverts with a few dark specks. Palette: "colors" in the wing's options. */
let WINGTEX=null;
function paintWing(THREE,img,WG){
 if(typeof document==='undefined')return null;
 if(WINGTEX&&WINGTEX.T===THREE&&WINGTEX.img===img)return WINGTEX.tex;
 const hex=(h,d)=>{const m=/^#?([0-9a-f]{6})$/i.exec(String(h||''))||/^#?([0-9a-f]{6})$/i.exec(d),v=parseInt(m[1],16);return [(v>>16&255)/255,(v>>8&255)/255,(v&255)/255];};   // (plain sRGB, the canvas's own)
 const CO=WG.colors||{},PL={gold:hex(CO.gold,'#cf9a58'),buff:hex(CO.buff,'#d3a86c'),grey:hex(CO.grey,'#b3ada3'),bar:hex(CO.bar,'#4f443c'),pale:hex(CO.pale,'#e6e0d6'),
  shaft:hex(CO.shaft,'#e8dcc4'),under:hex(CO.under,'#f1ebe0'),spot:hex(CO.spot,'#fbf8f1'),rim:hex(CO.rim,'#1c1614')};
 const mix=(a,b,k)=>[lerp(a[0],b[0],k),lerp(a[1],b[1],k),lerp(a[2],b[2],k)],mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
 /* the scan's covert patch */
 let patch=null;
 if(img&&img.width){try{const r=WG.patch||[845,600,110,115],c2=document.createElement('canvas');c2.width=r[2];c2.height=r[3];const x2=c2.getContext('2d');x2.drawImage(img,r[0],r[1],r[2],r[3],0,0,r[2],r[3]);
  const d=x2.getImageData(0,0,r[2],r[3]).data,m=[0,0,0];for(let i=0;i<d.length;i+=4){m[0]+=d[i];m[1]+=d[i+1];m[2]+=d[i+2];}const n=d.length/4,tgt=mix(PL.gold,PL.grey,0.5);
  patch={w:r[2],h:r[3],d,k:[tgt[0]/Math.max(1e-3,m[0]/n/255),tgt[1]/Math.max(1e-3,m[1]/n/255),tgt[2]/Math.max(1e-3,m[2]/n/255)]};}catch(e){patch=null;}}
 const patchAt=(x,y)=>{if(!patch)return null;const mr=(v,n)=>{v=((v%(2*n))+2*n)%(2*n);return v<n?v:2*n-1-v;};const X=Math.floor(mr(x,patch.w)),Y=Math.floor(mr(y,patch.h)),i=4*(Y*patch.w+X);
  return [Math.min(1,patch.d[i]/255*patch.k[0]),Math.min(1,patch.d[i+1]/255*patch.k[1]),Math.min(1,patch.d[i+2]/255*patch.k[2])];};
 const DS=clamp(+WG.texScale||0.5,0.25,1),CW=Math.round(AW*DS),CH=Math.round(AH*DS);   // the canvas, a share of the layout's 2048 by 1024 (half: plenty for a feather on screen)
 const cv=document.createElement('canvas');cv.width=CW;cv.height=CH;const ctx=cv.getContext('2d'),ID=ctx.createImageData(CW,CH),px=ID.data;
 const FLIGHT={prA:1,prB:1,sec:1,ter:1};
 const bars=(ph,list,hw)=>{let b=0;for(const c of list)b=Math.max(b,1-sstep(hw*0.5,hw,Math.abs(ph-c)));return b;};
 const barsSoft=(ph,list)=>{let b=0;for(const c of list)b=Math.max(b,1-sstep(0.024,0.064,Math.abs(ph-c)));return b;};   // (soft-edged: a bar on a feather is never cut square)
 /* a feather's outline: how far inside it (t along from the root, s across, -1..1) */
 const inside=(kind,t,s,K)=>{if(t<0||t>1)return -1;const fl=!!FLIGHT[kind];
  const rt=Math.min(0.45,(kind==='sec'?0.42:0.62)/K),x=t>1-rt?(t-(1-rt))/rt:0,pw=kind==='sec'?4:kind==='ter'?2.6:2,tipK=x>0?Math.pow(Math.max(0,1-Math.pow(x,pw)),1/pw):1;
  let hw=(fl?0.55+0.45*sstep(0,0.1,t):0.6+0.4*sstep(0,0.25,t))*tipK;
  if(kind==='prA')hw*=1-0.22*sstep(0.45,0.9,t);   // the outer primaries narrow towards the tip
  hw*=0.965+0.035*vn(t*K*9,3.3);
  return hw-Math.abs(s);};
 function feather(kind,t,s,K,under){
  const dIn=inside(kind,t,s,K);if(dIn<-0.05)return null;const a=sstep(-0.035,0.035,dIn);
  const S0=kind==='prA'||kind==='prB'?-0.3:kind==='sec'?-0.12:0,ds=Math.abs(s-S0),outer=s<S0,fl=!!FLIGHT[kind];
  const n1=vn(t*K*10,s*5),n2=vn(t*K*40+17,s*20),n3=vn(t*K*90+5,s*45);
  const X=(t-0.78)*K,Y=(s-0.28)*0.5,rs=Math.hypot(X,Y);   // (in widths: a round spot near the tip, off the shaft)
  let c;
  if(!under){
   if(fl){const g0=kind==='prA'?0.22:kind==='prB'?0.35:kind==='sec'?0.42:0.5;
    c=mix(PL.buff,PL.gold,outer?0.15:0.25+0.55*(1-t));
    const gk=sstep(g0,g0+0.42,t)*(outer?0.95:0.72);c=mix(c,PL.grey,gk);
    const list=kind==='ter'?[0.42,0.66]:kind==='sec'?[0.3,0.47,0.64,0.81]:[0.35,0.51,0.67,0.82];
    c=mix(c,PL.bar,barsSoft(t+(kind==='sec'?0.04*Math.abs(s):0.07*s),list)*lerp(0.32,0.78,gk)*(kind==='ter'?0.55:kind==='sec'?0.75:1));   // (a shallow chevron across the secondaries, so the bars run on across the trailing edge)
    c=mix(c,PL.pale,sstep(0.88,0.98,t)*0.5);
    if(n3>0.74)c=mul(c,0.8);c=mul(c,0.88+0.2*n1);
    c=mul(c,0.95+0.07*Math.sin((t*K*2.4-ds*1.2)*70));   // the barbs, running out towards the tip
    c=mix(c,PL.shaft,(1-sstep(0.018,0.04,ds))*0.35*(1-0.6*t));
    c=mix(c,PL.pale,(1-sstep(0,0.14,dIn))*0.18);}
   else{c=PL.gold.slice();
    const ctr=(1-sstep(0.3,0.95,Math.abs(s)))*sstep(0.1,0.55,t);c=mix(c,PL.grey,ctr*(kind==='pcv'||kind==='alu'?0.85:0.68));
    if(kind==='pcv'||kind==='alu')c=mix(c,PL.bar,bars(t,[0.42,0.68],0.06)*0.55);
    if(n2>0.7)c=mix(c,PL.bar,0.45);c=mul(c,0.86+0.24*n1);
    if(kind==='mcv'||kind==='gcv'){const R=kind==='mcv'?0.055:0.045;c=mix(c,PL.rim,1-sstep(R+0.012,R+0.03,rs));c=mix(c,PL.spot,1-sstep(R*0.8,R,rs));}
    c=mix(c,PL.gold,(1-sstep(0,0.12,dIn))*0.35);}}
  else{c=PL.under.slice();if(!fl)c=mix(c,PL.buff,0.14*(1-t));   // (a faint buff wash on the underwing coverts)
   if(fl&&kind!=='ter'){c=mix(c,PL.grey,barsSoft(t+0.07*s,[0.51,0.67,0.82])*0.26*sstep(0.4,0.75,t));c=mix(c,PL.grey,sstep(0.84,1,t)*(kind==='prA'?0.45:0.25));}
   if(!fl&&vn(t*K*14+3,s*7)>0.84&&n3>0.45)c=mix(c,PL.bar,0.55);
   c=mul(c,0.95+0.06*n1);
   /* each feather drawn from below as well: its shaft a faint line, its barbs, and its edge a shade darker (where the next
      feather lies over it), so a raised wing shows its feathers and never reads as a flat white sheet */
   if(fl){c=mix(c,mul(PL.under,0.8),(1-sstep(0.014,0.034,ds))*0.45*(1-0.5*t));c=mul(c,0.975+0.035*Math.sin((t*K*2.4-ds*1.2)*70));}
   c=mul(c,0.86+0.14*sstep(0,0.12,dIn));}
  return [c,a];}
 /* the small-covert panel: t along the span, s from the leading edge (-1) to the covert tips at the back (+1) */
 function panel(t,s,x,y,under){
  const edge=0.72+0.2*Math.sqrt(Math.abs(Math.sin(Math.PI*t*22)));if(s>edge+0.06||t<0||t>1)return null;const a=sstep(-0.05,0.05,edge-s);
  let c;if(!under){c=patchAt(x*0.43,y*0.43)||mix(PL.gold,PL.grey,vn(x*0.05,y*0.05));
   c=mix(c,PL.gold,0.25+0.25*sstep(0.2,1,s));   // golden towards the covert tips
   const gx=Math.floor(x/34),gy=Math.floor(y/34),h=hsh(gx+3,gy+71);
   if(h>0.55){const cx=(gx+0.25+0.5*hsh(gx,gy))*34,cy=(gy+0.25+0.5*hsh(gy,gx+2))*34,r=Math.hypot(x-cx,y-cy);c=mix(c,PL.rim,1-sstep(4.5,6,r));c=mix(c,PL.spot,1-sstep(2.6,3.6,r));}
   c=mul(c,0.93+0.12*vn(x*0.2,y*0.2));}
  else{c=mul(mix(PL.under,PL.buff,0.16),0.95+0.05*vn(x*0.1,y*0.1));if(vn(x*0.09+4,y*0.09)>0.86)c=mix(c,PL.bar,0.45);}
  return [c,a];}
 for(const kind in CELLS){const C=CELLS[kind];
  const cx0=Math.round((C[0])*DS),cy0=Math.round(C[1]*DS),cw=Math.round(C[2]*DS),ch=Math.round(C[3]*DS);
  for(const under of [0,1]){const ox=cx0+(under?CW/2:0);
   for(let py=0;py<ch;py++){const s=((py+0.5)/ch-0.5)/SM;
    for(let pxx=0;pxx<cw;pxx++){const t=((pxx+0.5)/cw-TM)/(1-2*TM);
     const r=kind==='les'?panel(t,s,(pxx+0.5)/DS,(py+0.5)/DS,under):feather(kind,t,s,C[4],under);const i=4*((cy0+py)*CW+ox+pxx);
     if(!r){px[i]=px[i+1]=px[i+2]=0;px[i+3]=0;continue;}
     /* (the colour kept under a zero alpha too, so the mip levels never darken the edge) */
     px[i]=Math.round(clamp(r[0][0],0,1)*255);px[i+1]=Math.round(clamp(r[0][1],0,1)*255);px[i+2]=Math.round(clamp(r[0][2],0,1)*255);px[i+3]=Math.round(clamp(r[1],0,1)*255);}}}}
 ctx.putImageData(ID,0,0);
 const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;tex.name='owl-wing-feathers';
 WINGTEX={T:THREE,img,tex};return tex;}
/* the under half of the atlas, as a mask (nearest texel, no mip levels, so the upper surfaces never catch it) */
let UNDERMASK=null;
function underMask(THREE){if(UNDERMASK&&UNDERMASK.T===THREE)return UNDERMASK.tex;const c=document.createElement('canvas');c.width=64;c.height=8;const x=c.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,32,8);x.fillStyle='#fff';x.fillRect(32,0,32,8);
 const t=new THREE.CanvasTexture(c);t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;t.colorSpace=THREE.SRGBColorSpace;UNDERMASK={T:THREE,tex:t};return t;}
/* The body's material: the scan's, with its exposure lift (the "owlLift" attribute: every texel scaled by its
   neighbourhood's lift, in the texture's own sRGB) and, as on the underwing, the underparts lit a little from below
   (white feathers facing the ground are lit by the sky round them, never as dark as the grass's bounce alone leaves
   them). A class, so the copy each pet instance makes keeps it (the game's own glow lays itself over it). */
let BODYMAT=null;
function bodyMaterialClass(THREE){
 if(BODYMAT&&BODYMAT.T===THREE)return BODYMAT.C;
 const hook=(sh,m)=>{const lift=!!(m.userData&&m.userData.owlLift),sky=(+(m.userData&&m.userData.owlUnder)||0).toFixed(3);
  if(lift){sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 owlLift;\nvarying vec3 vOwlLift;\nvarying vec3 vOwlB;').replace('#include <begin_vertex>','#include <begin_vertex>\nvOwlLift=owlLift;vOwlB=position;');
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vOwlLift;\nvarying vec3 vOwlB;\n'+
    'float owlH(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}\n'+
    'float owlN(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(owlH(i),owlH(i+vec3(1,0,0)),f.x),mix(owlH(i+vec3(0,1,0)),owlH(i+vec3(1,1,0)),f.x),f.y),mix(mix(owlH(i+vec3(0,0,1)),owlH(i+vec3(1,0,1)),f.x),mix(owlH(i+vec3(0,1,1)),owlH(i+vec3(1,1,1)),f.x),f.y),f.z);}')
    .replace('#include <map_fragment>','#include <map_fragment>\n{float oG=pow(max(vOwlLift.x,1.0),2.2);vec3 oc=min(diffuseColor.rgb*oG,vec3(1.0));'+
     /* (what the photograph left black in its deepest shadow, a crease in the lifted parts, becomes a shaded golden brown, not a hole) */
     'float oW=clamp((vOwlLift.x-1.0)/0.8,0.0,1.0),oL=dot(oc,vec3(0.2126,0.7152,0.0722));oc=mix(oc,vec3(0.181,0.087,0.032)*(0.55+0.45*clamp(oL/0.05,0.0,1.0)),oW*(1.0-smoothstep(0.012,0.06,oL)));'+
     /* (the smoothed-over pocket: the brown of the plumage round it, mottled by a fine noise fixed to the bird) */
     'if(vOwlLift.z>0.002){float oM=0.62*owlN(vOwlB*160.0)+0.38*owlN(vOwlB*430.0+7.0);oc=mix(oc,vec3(0.27,0.16,0.075)*(0.5+0.9*oM*oM+0.25*oM),0.9*vOwlLift.z);}'+
     /* (and the lifted parts drawn towards a barn owl's grey-veiled gold: the shadowed photograph had left them a cold, rusty brown) */
     'float oS=0.5*clamp((vOwlLift.x-1.0)/1.4,0.0,1.0);oc=mix(oc,vec3(dot(oc,vec3(0.2126,0.7152,0.0722)))*vec3(1.34,0.98,0.58),oS);'+
     /* (the underparts white: the folded wing's brown edge and the shadowed belly, seen from below in flight, are a flying owl's white front) */
     'float oU=0.7*vOwlLift.y;oc=mix(oc,min(vec3(1.0),vec3(dot(oc,vec3(0.2126,0.7152,0.0722)))*vec3(1.0,0.96,0.88)*1.35+0.04),oU);diffuseColor.rgb=oc;}');}
  sh.fragmentShader=sh.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n{vec3 oN=inverseTransformDirection(normal,viewMatrix);totalEmissiveRadiance+=diffuseColor.rgb*'+sky+'*clamp(-oN.y,0.0,1.0);}');};
 class OwlBodyMaterial extends THREE.MeshStandardMaterial{constructor(p){super(p);this.onBeforeCompile=sh=>hook(sh,this);this.customProgramCacheKey=()=>'owlBody5|'+(this.userData&&this.userData.owlLift?1:0)+'|'+(this.userData&&this.userData.owlUnder);}}
 BODYMAT={T:THREE,C:OwlBodyMaterial};return OwlBodyMaterial;}
/* The wing's material: a standard one that also fades the wing in as it opens and out as it folds, by a dither
   (fragments dropped, never blended, so it stays opaque and needs no sorting), from the wing root's own scale in
   the bone matrices (the clips shrink the folded wing away under the scan's own folded wing): hidden at 0.32 of
   its size and below, whole at 0.7 and above. A class, so the copy each pet instance makes keeps it. */
let WINGMAT=null;
function wingMaterialClass(THREE){
 if(WINGMAT&&WINGMAT.T===THREE)return WINGMAT.C;
 const hook=sh=>{
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vOwlP;\nvarying float vOwlShow;')
   .replace('#include <skinning_vertex>','#include <skinning_vertex>\nvOwlP=position;\n#ifdef USE_SKINNING\n{float sR=length(getBoneMatrix(0.0)[0].xyz),sW=length(getBoneMatrix(skinIndex.x)[0].xyz);vOwlShow=sW/max(sR,1e-6);}\n#else\nvOwlShow=1.0;\n#endif');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vOwlP;\nvarying float vOwlShow;')
   .replace('#include <alphatest_fragment>','{float oS=smoothstep(0.32,0.7,vOwlShow);if(oS<0.999){vec3 oq=floor(vOwlP*1400.0);float oh=fract(sin(dot(oq,vec3(12.9898,78.233,37.719)))*43758.5453);if(oh>=oS)discard;}}\n#include <alphatest_fragment>');};
 class OwlWingMaterial extends THREE.MeshStandardMaterial{constructor(p){super(p);this.onBeforeCompile=hook;this.customProgramCacheKey=()=>'owlWing1';}}
 WINGMAT={T:THREE,C:OwlWingMaterial};return OwlWingMaterial;}

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
 const FOLDS=+(O.wing&&O.wing.foldScale)||0.02,FL0=O.fly||{};
 const base=()=>{const p={};for(const n of names)p[n]=[0,0,0];p.wingScale=[FOLDS,FOLDS];p.tailScale=[1,1,1];p.root=[0,0,0];return p;};
 /* in flight the rump is drawn in (narrower and shorter: the folded wings' crossed tips are not there on a flying owl) */
 const TS=FL0.tailScale||[0.85,0.9,0.72],tsAt=k=>[lerp(1,TS[0],k),lerp(1,TS[1],k),lerp(1,TS[2],k)];
 /* the folded wing: arm swept back and down along the flank, forearm forward, hand back, tucked under the scan's own */
 function fold(p,k){for(const s of ['L','R']){const sg=s==='L'?1:-1;p['wing'+s]=[0.25*k,sg*1.95*k,-sg*0.9*k];p['wing2'+s]=[0,-sg*2.6*k,0];p['wing3'+s]=[0,sg*2.5*k,0];}}
 /* the tuck: on the way into or out of the fold, the wings raised high over the back and swept back, the hands
    half folded (an owl lifts its wings to open them and again as it settles them); the dither has them half gone
    here, and they shrink into the fold from it */
 function tuck(p,pitchComp){for(const s of ['L','R']){const sg=s==='L'?1:-1;p['wing'+s]=[(pitchComp||0)*0.6,sg*0.6,sg*1.25];p['wing2'+s]=[0,-sg*0.3,0];p['wing3'+s]=[0,sg*0.8,0];}}
 const WINGB=['wingL','wing2L','wing3L','wingR','wing2R','wing3R'];
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
 const FL=FL0,pitch=+FL.pitch||1.05;   // the body's forward lean in flight
 const flyBody=(p,pch)=>{p.body[0]=pch;p.root=[0,0.05,0];p.neck1[0]=-pch*0.25;p.neck2[0]=-pch*0.35;p.head[0]=-pch*0.4;
  /* legs trailing under the tail, toes closed */const LG=FL.legs||[0.4,0.85,-0.35];p.thighL[0]=p.thighR[0]=LG[0];p.shankL[0]=p.shankR[0]=LG[1];p.footL[0]=p.footR[0]=LG[2];p.tailScale=tsAt(1);const AD=FL.adduct||[0.1,0.5];p.thighL[2]=-AD[0];p.thighR[2]=AD[1];   /* (drawn in under the body: the scan's right foot stands wide, and trailing it showed through the flank) */
  p.tail1[0]=-0.15;p.tail2[0]=-0.05;};
 const flyAt=u=>{const p=base();flyBody(p,pitch);
  /* downstroke 0..0.55 (fast and strong), upstroke 0.55..1 with the hand half-folded */
  const down=u<0.55,s=down?Math.cos(Math.PI*u/0.55):-Math.cos(Math.PI*(u-0.55)/0.45);
  const stroke=0.15+0.85*s,hf=down?0.05:0.55*Math.sin(Math.PI*(u-0.55)/0.45);
  wings(p,stroke,down?0.15*Math.sin(Math.PI*u/0.55):-0.1,hf,0,-pitch);
  p.root[1]=0.05-0.012*Math.sin(TAU*u);p.body[0]+=0.04*Math.sin(TAU*u);return p;};
 const glideAt=u=>{const p=base();flyBody(p,pitch*0.95);wings(p,0.12+0.03*Math.sin(TAU*u),0.05,0.05,0,-pitch*0.95);p.root[1]=0.05+0.004*Math.sin(TAU*u);return p;};
 /* one pose laid over another, bone by bone (wing scales and the root offset too) */
 const mixP=(a,b,t)=>{if(t<=0)return a;const L3=(x,y)=>[lerp(x[0],y[0],t),lerp(x[1],y[1],t),lerp(x[2],y[2],t)];for(const n of names)a[n]=L3(a[n],b[n]);a.root=L3(a.root,b.root);a.wingScale=[lerp(a.wingScale[0],b.wingScale[0],t),lerp(a.wingScale[1],b.wingScale[1],t)];a.tailScale=L3(a.tailScale,b.tailScale);return a;};
 const standP=()=>{const p=base();fold(p,1);return p;};
 const takeoffAt=u=>{
  /* the game has the bird off the grass from the very first frame, so there is no crouch here: at u=0 it is the
     push itself (legs straight under it, body tipping forward), the wings come up out of the fold and are out and
     raised by u=0.12, the first downstroke follows at once, and the legs are drawn back into flight by u=0.3 */
  const k=sstep(0,0.35,u),pch=lerp(0.3,pitch*0.8,k);
  const p=base();flyBody(p,pch);
  const ph=u<0.12?0:(((u-0.12)/0.88)*2.4)%1,down=ph<0.5,s=down?Math.cos(Math.PI*ph/0.5):-Math.cos(Math.PI*(ph-0.5)/0.5);
  wings(p,0.2+0.8*s,0.1,down?0.05:0.6*Math.sin(Math.PI*(ph-0.5)/0.5),0,-pch);
  /* the wings come out of the fold through the tuck (raised over the back), growing and fading in by the dither as
     they go, and spread into the raised wings of the first stroke: out by u=0.12, over five frames, never a pop */
  if(u<0.12){const f=standP(),t=base();tuck(t,-pch);const o1=sstep(0,0.045,u),o2=sstep(0.045,0.12,u);
   for(const n of WINGB){const a=[lerp(f[n][0],t[n][0],o1),lerp(f[n][1],t[n][1],o1),lerp(f[n][2],t[n][2],o1)];p[n]=[lerp(a[0],p[n][0],o2),lerp(a[1],p[n][1],o2),lerp(a[2],p[n][2],o2)];}}
  const sc=u<0.045?lerp(0.3,0.62,sstep(0,0.045,u)):lerp(0.62,1,sstep(0.045,0.12,u));p.wingScale=[sc,sc];
  const lg=sstep(0.02,0.3,u),push=base();legsWorld(push,pch,0,0);
  for(const n of ['thighL','shankL','footL','thighR','shankR','footR'])p[n]=[lerp(push[n][0],p[n][0],lg),lerp(push[n][1],p[n][1],lg),lerp(push[n][2],p[n][2],lg)];
  p.root=[0,0.05*lg,0];p.tail1[0]=lerp(0.1,p.tail1[0],lg);p.tailScale=tsAt(lg);
  return p;};
 const landAt=u=>{const p=base();
  /* the flare: body up, wings forward and high, beating short and braking, legs reaching forward for the ground;
     then (u 0.62..1) the wings fold down along the flanks and the bird stands, so the land clip ends in the same
     folded, standing pose the idle and the hop start from (the drawn wings dither away as they fold) */
  const pch=lerp(pitch*0.6,0.05,sstep(0,0.8,u));p.body[0]=pch;p.neck2[0]=-pch*0.4;p.head[0]=-pch*0.5;p.root=[0,0.02*(1-u),0];
  const ph=(u*1.6)%1,s=Math.cos(TAU*ph);wings(p,0.7+0.35*s,0.35,0.2,0.25,-pch);
  const r=sstep(0.1,0.7,u);legsTo(p,restDy*lerp(0.7,1,r),restDz+0.03*(1-r),restDy*lerp(0.7,1,r),restDz+0.03*(1-r));p.footL[0]=p.footR[0]=0.3*(1-u);
  p.tail1[0]=-0.3*(1-u);p.tailScale=tsAt(1-r);
  /* the fold: up into the tuck (fading as they shrink), then away into the fold under the scan's own folded wings */
  const f1=sstep(0.62,0.82,u),f2=sstep(0.82,0.96,u);
  if(f1>0){const t=base();tuck(t,-pch);for(const n of WINGB)p[n]=[lerp(p[n][0],t[n][0],f1),lerp(p[n][1],t[n][1],f1),lerp(p[n][2],t[n][2],f1)];p.wingScale=[1,1];}
  if(f2>0){const sp=standP();sp.wingScale=[1,1];mixP(p,sp,f2);}
  if(f1>0){const sc=u<0.82?lerp(1,0.62,f1):lerp(0.62,FOLDS,f2);p.wingScale=[sc,sc];}
  return p;};
 /* bake: quaternion tracks for every bone, scale for the wing roots and the tail's root, position for the root */
 const bake=(name,T,n,poseAt)=>{const times=new Float32Array(n+1);const qv={},sv={L:new Float32Array((n+1)*3),R:new Float32Array((n+1)*3)},ts=new Float32Array((n+1)*3),rp=new Float32Array((n+1)*3);for(const nm of names)qv[nm]=new Float32Array((n+1)*4);
  const q=Q();
  for(let i=0;i<=n;i++){const u=i/n;times[i]=u*T;const pz=poseAt(u%1===0&&i===n?1:u);
   for(const nm of names){const e=pz[nm]||[0,0,0];q.setFromEuler(E(e[0],e[1],e[2],nm.startsWith('wing')?'XZY':'YXZ'));q.toArray(qv[nm],4*i);}
   sv.L.fill(pz.wingScale[0],3*i,3*i+3);sv.R.fill(pz.wingScale[1],3*i,3*i+3);ts.set(pz.tailScale||[1,1,1],3*i);
   rp[3*i]=J.root.x+pz.root[0];rp[3*i+1]=J.root.y+pz.root[1];rp[3*i+2]=J.root.z+pz.root[2];}
  const tracks=names.map(nm=>new THREE.QuaternionKeyframeTrack('ab_'+nm+'.quaternion',times,qv[nm]));
  tracks.push(new THREE.VectorKeyframeTrack('ab_wingL.scale',times,sv.L),new THREE.VectorKeyframeTrack('ab_wingR.scale',times,sv.R),new THREE.VectorKeyframeTrack('ab_tail1.scale',times,ts),new THREE.VectorKeyframeTrack('ab_root.position',times,rp));
  return new THREE.AnimationClip(name,T,tracks);};
 const out=[bake('bird.idle',12,240,idleAt),bake('bird.hop',hopT,24,hopAt),bake('bird.fly',1/(+FL.hz||3.2),24,flyAt),bake('bird.glide',2,24,glideAt),bake('bird.takeoff',0.7,42,takeoffAt),bake('bird.land',0.6,36,landAt)];
 /* the hop moves its root one stride, which the library measures and strips; the other clips stay put */
 return out;}
