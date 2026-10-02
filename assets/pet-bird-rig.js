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
     hop:{T, stride, height}, fly:{hz, pitch, legs:[thigh,tarsus,toes], adduct:[left,right], tailScale:[x,y,z]},
     (small birds) meshName, stand, legs, tint, eyes, headRound, neckFill, wing.style 'stub', wing.flyScale, walk 'waddle',
     waddle, run (see assets/models/pets/README.md, "Small birds")}
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
 if(O.rigged)return rigSkinned({THREE,scene,animations,O});   // (small birds) a model that came rigged (the chick): its own skeleton and idle, the rest baked on its bones
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
 /* (small birds) a scan lying on its belly stood up: the cut bottom rounded off (each vertex near the cut drawn in towards the
    cut's middle, more the nearer it is, so the cap shrinks and the belly is round), then the whole scan lifted onto the legs
    the rig draws (stand: {lift, round}; the joints are given in the lifted frame, the ground at the cut) */
 const ST=O.stand||null;
 if(ST&&cutY>-1e8){const R0=+ST.round||0.012,lift=+ST.lift||0;let cx=0,cz=0,cn=0;for(let i=0;i<N;i++)if(P[3*i+1]<cutY+0.002){cx+=P[3*i];cz+=P[3*i+2];cn++;}if(cn){cx/=cn;cz/=cn;}
  for(let i=0;i<N;i++){const y=P[3*i+1];if(y<cutY+R0&&R0>0){const t=clamp((y-cutY)/R0,0,1),k=0.3+0.7*Math.sqrt(Math.max(0,1-(1-t)*(1-t)));P[3*i]=cx+(P[3*i]-cx)*k;P[3*i+2]=cz+(P[3*i+2]-cz)*k;P[3*i+1]=y-R0*0.35*(1-t)*(1-t);}
   P[3*i+1]+=lift;}
  if(R0>0){/* the rounded part's normals again, from its faces */const acc=new Float32Array(3*N);for(let t=0;t<tri.length;t+=3){const a=tri[t],b=tri[t+1],c=tri[t+2];if(Math.min(P[3*a+1],P[3*b+1],P[3*c+1])>cutY+lift+R0)continue;const ux=P[3*b]-P[3*a],uy=P[3*b+1]-P[3*a+1],uz=P[3*b+2]-P[3*a+2],vx=P[3*c]-P[3*a],vy=P[3*c+1]-P[3*a+1],vz=P[3*c+2]-P[3*a+2];const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;for(const r of [a,b,c]){acc[3*r]+=nx;acc[3*r+1]+=ny;acc[3*r+2]+=nz;}}
   const W0=WELD||weldOf(P),A2=new Float32Array(3*N);for(let i=0;i<N;i++){const r=W0[i];A2[3*r]+=acc[3*i];A2[3*r+1]+=acc[3*i+1];A2[3*r+2]+=acc[3*i+2];}
   for(let i=0;i<N;i++){if(P[3*i+1]>cutY+lift+R0)continue;const r=W0[i],l=Math.hypot(A2[3*r],A2[3*r+1],A2[3*r+2]);if(l>0){const w=1-clamp((P[3*i+1]-cutY-lift)/R0,0,1);Nn[3*i]=lerp(Nn[3*i],A2[3*r]/l,w);Nn[3*i+1]=lerp(Nn[3*i+1],A2[3*r+1]/l,w);Nn[3*i+2]=lerp(Nn[3*i+2],A2[3*r+2]/l,w);}}}}
 if(!WELD)WELD=weldOf(P);const ADJ=adjOf(WELD,tri);
 /* (small birds) headRound: {c:[x,y,z], r, k, front}: a scan whose head came out boxy (the AI duckling's, flat-backed and
    flat-topped seen from behind) rounded off: an ellipsoid fitted to the head's points (their extents about c, within r,
    above the neck) and every point of the back of the head outside it drawn in towards it by k (the face, the eyes and the
    bill, ahead of c by front, kept as they are), the moved normals taken again from the faces; (crown: [y0, y1] about c: above
    the eyes, from y0 to y1, the face's keep-out fades, so the forehead's top corners are rounded too and the head is a dome
    seen from behind, not a tall box; nape: [y0, y1] about c: the band behind the head where it meets the neck is eased by the
    smoothing passes as well, softening the ledge the back of the head made over the neck) */
 if(O.headRound&&O.headRound.c){const HR=O.headRound,c=A(HR.c),r=+HR.r||0.03,k=HR.k!=null?+HR.k:0.7,fr=HR.front!=null?+HR.front:0.004,cw=y=>HR.crown?sstep(+HR.crown[0],+HR.crown[1],y):0;
  const mn=V(1e9,1e9,1e9),mx=V(-1e9,-1e9,-1e9);for(let i=0;i<N;i++){const x=P[3*i]-c.x,y=P[3*i+1]-c.y,z=P[3*i+2]-c.z;if(Math.hypot(x,y,z)<r&&y>-0.45*r){mn.min(V(x,y,z));mx.max(V(x,y,z));}}
  const ex=HR.ext?A(HR.ext):V(Math.max(Math.abs(mn.x),mx.x),mx.y,Math.abs(mn.z));const moved=new Uint8Array(N);let nm=0;const R2=+HR.reach||r*1.6;
  for(let i=0;i<N;i++){const x=P[3*i]-c.x,y=P[3*i+1]-c.y,z=P[3*i+2]-c.z;if(Math.hypot(x,y,z)>R2||y<-0.45*r)continue;
   const w=sstep(-0.45*r,-0.1*r,y)*(1-sstep(-fr,fr,z)*(1-cw(y)));if(w<=0)continue;
   const d=Math.hypot(x/ex.x,Math.max(0,y)/ex.y,Math.min(0,z)/ex.z);if(d<=1)continue;const f=lerp(1,1/d,k*w);
   const fy=y>0?f:1,fz=z<0?f:1;P[3*i]=c.x+x*f;P[3*i+1]=c.y+y*fy;P[3*i+2]=c.z+z*fz;moved[i]=1;nm++;}
  /* (smooth: passes of a smoothing that does not shrink (Taubin's: each pass a step towards the neighbours' middle and a slightly
     larger one back) over the back and top of the head, the patch the ellipsoid works on, fading in above the neck, out ahead
     of the ears and towards the edge of the reach, so the flat planes and the creases the scan left there round off; the face,
     the eyes and the bill are not touched) */
  const SMH=+HR.smooth||0;if(SMH>0){const {deg,nb}=ADJ,wS=new Float32Array(N),Q2=new Float32Array(3*N);
   const NP=HR.nape;   // (nape: [y0, y1] about c: the band behind the head where it meets the neck, its ledge eased by the same passes)
   for(let i=0;i<N;i++){if(WELD[i]!==i)continue;const x=P[3*i]-c.x,y=P[3*i+1]-c.y,z=P[3*i+2]-c.z,d=Math.hypot(x,y,z);
    const wn=NP?sstep(+NP[0]-0.004,+NP[0],y)*(1-sstep(+NP[1],+NP[1]+0.004,y))*(1-sstep(-0.012,-0.004,z))*(1-sstep(R2*0.8,R2*1.1,Math.hypot(x,z))):0;if(d>R2&&wn<=0)continue;
    wS[i]=Math.max(d>R2?0:sstep(-0.45*r,-0.15*r,y)*(1-sstep(-fr,fr,z)*(1-cw(y)))*(1-sstep(R2*0.75,R2,d)),wn);}
   for(let it=0;it<2*SMH;it++){const lam=it%2?-0.53:0.5;
    for(let i=0;i<N;i++){if(WELD[i]!==i||wS[i]<=0)continue;const d0=deg[i],d1=deg[i+1];if(d1===d0)continue;let x=0,y=0,z=0;for(let j=d0;j<d1;j++){const q=3*nb[j];x+=P[q];y+=P[q+1];z+=P[q+2];}const n=d1-d0,kk=lam*wS[i];
     Q2[3*i]=P[3*i]+(x/n-P[3*i])*kk;Q2[3*i+1]=P[3*i+1]+(y/n-P[3*i+1])*kk;Q2[3*i+2]=P[3*i+2]+(z/n-P[3*i+2])*kk;}
    for(let i=0;i<N;i++){if(WELD[i]!==i||wS[i]<=0)continue;P[3*i]=Q2[3*i];P[3*i+1]=Q2[3*i+1];P[3*i+2]=Q2[3*i+2];}}
   for(let i=0;i<N;i++){const rq=WELD[i];if(wS[rq]>0){if(rq!==i){P[3*i]=P[3*rq];P[3*i+1]=P[3*rq+1];P[3*i+2]=P[3*rq+2];}if(!moved[i]){moved[i]=1;nm++;}}}}
  if(nm){const acc=new Float32Array(3*N);for(let t=0;t<tri.length;t+=3){const a=tri[t],b=tri[t+1],cc=tri[t+2];if(!moved[a]&&!moved[b]&&!moved[cc])continue;const ux=P[3*b]-P[3*a],uy=P[3*b+1]-P[3*a+1],uz=P[3*b+2]-P[3*a+2],vx=P[3*cc]-P[3*a],vy=P[3*cc+1]-P[3*a+1],vz=P[3*cc+2]-P[3*a+2];const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;for(const q of [a,b,cc]){const rq=WELD[q];acc[3*rq]+=nx;acc[3*rq+1]+=ny;acc[3*rq+2]+=nz;}}
   for(let i=0;i<N;i++){if(!moved[i])continue;const rq=WELD[i],l=Math.hypot(acc[3*rq],acc[3*rq+1],acc[3*rq+2]);if(l>0){Nn[3*i]=acc[3*rq]/l;Nn[3*i+1]=acc[3*rq+1]/l;Nn[3*i+2]=acc[3*rq+2]/l;}}}
  if(HR.debug)console.log('LOG headRound',JSON.stringify({ext:ex.toArray().map(v=>+v.toFixed(4)),mn:mn.toArray().map(v=>+v.toFixed(4)),mx:mx.toArray().map(v=>+v.toFixed(4)),moved:nm}));}
 /* (small birds) neckFill: {y:[y0,y1], w:[w0,w1], z}: a neck pinched thinner than the head above it (the AI duckling's, a peanut
    seen head on) filled out: between y0 and y1 every slice of the scan ahead of z is widened (x only, never narrowed) to a width
    running from w0 (half-width at y0, the breast) to w1 (at y1, under the head), so the head sits on a short thick neck as a
    duckling's does, then (smooth: passes) the chin's ledge eased; the moved normals taken again from the faces */
 if(O.neckFill&&O.neckFill.y){const NF=O.neckFill,y0=+NF.y[0],y1=+NF.y[1],w0=+NF.w[0],w1=+NF.w[1],zm=NF.z!=null?+NF.z:-1,ed=+NF.edge||0.004,bin=0.001;
  const nb0=Math.floor((y0-ed)/bin),nb1=Math.ceil((y1+ed)/bin),cur=new Float32Array(nb1-nb0+1);
  for(let i=0;i<N;i++){const y=P[3*i+1],z=P[3*i+2];if(z<zm||y<y0-ed||y>y1+ed)continue;const b=Math.round(y/bin)-nb0;if(b>=0&&b<cur.length)cur[b]=Math.max(cur[b],Math.abs(P[3*i]));}
  const kOf=new Float32Array(cur.length);for(let b=0;b<cur.length;b++){const y=(b+nb0)*bin,t=clamp((y-y0)/Math.max(1e-6,y1-y0),0,1),tw=lerp(w0,w1,t);kOf[b]=cur[b]>1e-4?Math.max(1,tw/cur[b]):1;}
  const ks=kOf.slice();for(let b=0;b<cur.length;b++){let a=0,n=0;for(let d=-2;d<=2;d++){const q=b+d;if(q>=0&&q<cur.length){a+=kOf[q];n++;}}ks[b]=a/n;}
  const moved=new Uint8Array(N);let nm=0;
  for(let i=0;i<N;i++){const y=P[3*i+1],z=P[3*i+2];if(y<y0-ed||y>y1+ed)continue;const b=clamp(Math.round(y/bin)-nb0,0,cur.length-1);const tp=sstep(y0-ed,y0,y)*(1-sstep(y1,y1+ed,y))*sstep(zm-0.006,zm,z);const k=1+(ks[b]-1)*tp;if(k<=1.0001)continue;P[3*i]*=k;moved[i]=1;nm++;}
  /* (smooth: the ledge where the chin overhangs the neck eased by a few passes of neighbour averaging, across the top of the band) */
  const SMN=+NF.smooth||0;if(SMN>0){const {deg,nb}=ADJ,wS=new Float32Array(N);for(let i=0;i<N;i++){if(WELD[i]!==i)continue;const y=P[3*i+1],z=P[3*i+2];wS[i]=sstep(y1-0.006,y1,y)*(1-sstep(y1+ed,y1+ed+0.006,y))*sstep(zm,zm+0.01,z);}
   const Q2=new Float32Array(3*N);for(let it=0;it<SMN;it++){for(let i=0;i<N;i++){if(WELD[i]!==i||wS[i]<=0)continue;const d0=deg[i],d1=deg[i+1];if(d1===d0)continue;let x=0,y=0,z=0;for(let j=d0;j<d1;j++){const q=3*nb[j];x+=P[q];y+=P[q+1];z+=P[q+2];}Q2[3*i]=P[3*i]+(x/(d1-d0)-P[3*i])*0.5*wS[i];Q2[3*i+1]=P[3*i+1]+(y/(d1-d0)-P[3*i+1])*0.5*wS[i];Q2[3*i+2]=P[3*i+2]+(z/(d1-d0)-P[3*i+2])*0.5*wS[i];}
    for(let i=0;i<N;i++){if(WELD[i]!==i||wS[i]<=0)continue;P[3*i]=Q2[3*i];P[3*i+1]=Q2[3*i+1];P[3*i+2]=Q2[3*i+2];if(!moved[i]){moved[i]=1;nm++;}}}
   for(let i=0;i<N;i++){const r=WELD[i];if(r!==i&&wS[r]>0){P[3*i]=P[3*r];P[3*i+1]=P[3*r+1];P[3*i+2]=P[3*r+2];if(!moved[i]){moved[i]=1;nm++;}}}}
  if(nm){const acc=new Float32Array(3*N);for(let t=0;t<tri.length;t+=3){const a=tri[t],b=tri[t+1],cc=tri[t+2];if(!moved[a]&&!moved[b]&&!moved[cc])continue;const ux=P[3*b]-P[3*a],uy=P[3*b+1]-P[3*a+1],uz=P[3*b+2]-P[3*a+2],vx=P[3*cc]-P[3*a],vy=P[3*cc+1]-P[3*a+1],vz=P[3*cc+2]-P[3*a+2];const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;for(const q of [a,b,cc]){const rq=WELD[q];acc[3*rq]+=nx;acc[3*rq+1]+=ny;acc[3*rq+2]+=nz;}}
   for(let i=0;i<N;i++){if(!moved[i])continue;const rq=WELD[i],l=Math.hypot(acc[3*rq],acc[3*rq+1],acc[3*rq+2]);if(l>0){Nn[3*i]=acc[3*rq]/l;Nn[3*i+1]=acc[3*rq+1]/l;Nn[3*i+2]=acc[3*rq+2]/l;}}}}
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
 const TNT=O.tint?recolor(THREE,P,Nn,UV,tri,TX,O.tint,WELD,ADJ):null;if(TNT){body.setAttribute('birdTint',new THREE.BufferAttribute(TNT,4));body.setAttribute('birdTintK',new THREE.BufferAttribute(TNT.amount,1));body.setAttribute('birdTintD',new THREE.BufferAttribute(TNT.detail,1));}
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
 const legTop=Math.max(J.shankL.y,J.shankR.y)+0.012,LEGD=!!(O.legs&&O.legs.drawn);   // (drawn legs: the scan has none of its own, it is all body)
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
   if(!LEGD&&p.y<legTop&&Math.abs(p.x-J['shank'+side].x)<0.03&&p.z>J.tail1.z+0.02){
    const a=segD(p,J['shank'+side],J['foot'+side]),b=segD(p,J['foot'+side],J['toe'+side]);const wa=1/Math.pow(a+0.004,4),wb=1/Math.pow(b+0.004,4);
    const up=sstep(legTop-0.012,legTop,p.y);w['shank'+side]=rest*(1-up)*wa/(wa+wb);w['foot'+side]=rest*(1-up)*wb/(wa+wb);w['thigh'+side]=rest*up;}
   else{const c={};let s=0;
    for(const n of LEGD?['body','chest','tail1','tail2']:['body','chest','tail1','tail2','thighL','thighR']){if((n==='thighL'&&p.x<0)||(n==='thighR'&&p.x>0))continue;if(n.startsWith('tail')&&p.z>J.tail1.z+0.015)continue;
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
 const STUB=WG.style==='stub';   // (small birds) a duckling's wing: a short downy paddle, not a flight-feathered wing
 const wingGeo=STUB?buildStubWing(THREE,WG,J,wLen,WJ,BI):buildWing(THREE,WG,J,wLen,WJ,BI);
 const wingTex=STUB?paintStubWing(THREE,WG):paintWing(THREE,scanMat&&scanMat.map?scanMat.map.image:null,WG);
 const MN=O.meshName||'owl';   // (the owl's meshes keep their names: owl-body, owl-wings)
 const group=new THREE.Group();group.name=MN+'-rig';group.add(bones.root);group.updateMatrixWorld(true);
 const skel=new THREE.Skeleton(list);   // bone inverses from the bind pose, now that the bones are placed
 /* the scan's own material, as the owl's (its exposure lift, and the underparts lit a little by the sky, as the underwing is) */
 const BM=bodyMaterialClass(THREE),bodyMat=new BM();THREE.MeshStandardMaterial.prototype.copy.call(bodyMat,scanMat);bodyMat.name=scanMat.name||MN+'-body';bodyMat.userData.owlUnder=+(O.exposure&&O.exposure.sky!=null?O.exposure.sky:0.3);bodyMat.userData.owlLift=!!EXP;bodyMat.userData.birdTint=!!TNT;bodyMat.userData.down=+(O.down||0);if(O.roughness!=null)bodyMat.roughness=+O.roughness;bodyMat.metalness=0;
 const bodyMesh=new THREE.SkinnedMesh(body,bodyMat);bodyMesh.name=MN+'-body';
 const WM=wingMaterialClass(THREE);
 /* (the under surface lit a little from within: thin white feathers seen from below with the sky behind them are
    never as dark as the ground's bounce alone would leave them) */
 const wingMat=new WM({map:wingTex,vertexColors:true,roughness:0.85,metalness:0,alphaTest:wingTex?0.5:0,side:THREE.FrontSide,name:MN+'-wing',
  emissive:new THREE.Color(WG.underGlow||'#2d2b29'),emissiveMap:wingTex?underMask(THREE):null});
 if(!wingTex)wingMat.emissive.setRGB(0,0,0);
 const wingMesh=new THREE.SkinnedMesh(wingGeo,wingMat);wingMesh.name=MN+'-wings';
 const meshes=[bodyMesh,wingMesh];
 /* (small birds) legs and webbed feet drawn by the rig, for a scan whose own feet were tucked under it */
 if(LEGD){const lg=buildLegs(THREE,J,O.legs,BI);const lm=new THREE.SkinnedMesh(lg,new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.62,metalness:0,side:THREE.DoubleSide,name:MN+'-legs'}));lm.name=MN+'-legs';meshes.push(lm);}
 /* (small birds) glossy eyes set into the scan's own (a repainted scan's eye has no shine of its own): eyes: {at:[x,y,z] (left), r, color, sink} */
 if(O.eyes&&O.eyes.at){const EY=O.eyes,r=+EY.r||0.003,g0=new THREE.SphereGeometry(r,14,10),parts=[];
  /* (on the scan's surface: the outermost point of the head at the eye's height and place along the head, so a rounded or
     narrow head never leaves the eye standing out of it) */
  const e0=A(EY.at);let sx=-1;for(let i=0;i<N;i++){if(P[3*i]<=0)continue;if(Math.hypot(P[3*i+1]-e0.y,P[3*i+2]-e0.z)<r*0.8)sx=Math.max(sx,P[3*i]);}if(sx>0)e0.x=sx;
  for(const sg of [1,-1]){const g=g0.clone(),c=e0.clone();c.x*=sg;const out=V(c.x,0,0).normalize();c.addScaledVector(out,-(+EY.sink||0.4)*r);g.translate(c.x,c.y,c.z);parts.push(g);}
  const pos=[],idx=[];let off=0;for(const g of parts){const pa=g.attributes.position;for(let i=0;i<pa.count;i++)pos.push(pa.getX(i),pa.getY(i),pa.getZ(i));for(const i of g.index.array)idx.push(i+off);off+=pa.count;}
  const eg=new THREE.BufferGeometry();eg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));eg.setIndex(idx);eg.computeVertexNormals();
  const n=pos.length/3;eg.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Array(n*4).fill(0).map((_,k)=>k%4===0?BI.head:0),4));eg.setAttribute('skinWeight',new THREE.Float32BufferAttribute(new Array(n*4).fill(0).map((_,k)=>k%4===0?1:0),4));
  const em=new THREE.SkinnedMesh(eg,new THREE.MeshStandardMaterial({color:EY.color||'#0c0806',roughness:0.12,metalness:0,envMapIntensity:1.2,name:MN+'-eyes'}));em.name=MN+'-eyes';meshes.push(em);}
 for(const m of meshes){group.add(m);m.bind(skel,new THREE.Matrix4());m.frustumCulled=false;}
 group.updateMatrixWorld(true);
 /* ------------------------------------------------ 4. the clips --------------------------------------- */
 const clips=bakeClips(THREE,bones,names,J,O);
 group.userData.birdRig={bones:list.length,clips:clips.map(c=>c.name),joints:Object.fromEntries(Object.entries(J).map(([k,v])=>[k,v.toArray().map(x=>+x.toFixed(4))])),
  triangles:tri.length/3,wingTriangles:wingGeo.index?wingGeo.index.count/3:wingGeo.attributes.position.count/3,twistDeg:+O.headTwistDeg||0};
 return {scene:group,animations:clips};
}
export default birdRig;

/* ------------------------------------------------ (small birds) a bird that came rigged: the chick ---------------
   kenchoo's chick (after FourthGreen's Animated Chick) has its own skeleton (hips, spine, chest, neck, head, jaw, each
   leg thigh-heel-ankle-toes, each wing scapula-shoulder-elbow-wrist) and one long idle (breathing, blinking, looking
   round, a peck), but nothing that walks or flies. Here the idle is kept as it is and the rest is baked on its own bones,
   posed frame by frame and read back (so its bind rotations, whatever they are, never matter): a scurry (quick short
   steps, each planted foot holding its spot by two-bone IK on thigh and tarsus, the toes kept flat, the body bobbing
   and the head bobbing as a chick's does, the wing stubs held a little out for balance), and a frantic little flight
   (takeoff, fly, land: the stubs raised out of the fold and beaten fast and wide, the body tipped up, the legs paddling,
   then the feet reaching down and the stubs folded as it lands, ending in the idle's first pose). Its smooth peach
   skin becomes yellow down: the texture's detail laid over a chick's yellow (legs, beak and eyes kept), with a soft
   sheen and a fuzz of light at the silhouette (a physical material, so the game's own material settings still apply).
   O: {rigged:true, bones:{hips, spine, chest, neck, head, thighL, heelL, ankleL, toesL, scapL, shoulderL, elbowL, wristL
   (L only: R by name), ...}, forward:[x,z], idle:{clip, from}, scurry:{T, stride, lift, bob, lean, crouch}, run:{the same},
   fly:{hz, amp, raise, scap, pitch (+ forward), wingScale}, reweight:[{from, to, above, xBelow}],
   down:{yellow, sheen, sheenColor, fuzz, keep:{belowY, beak:[x,y,z,r]}, shells:{n, len, density, droop, far}}}
   -> clips bird.idle, bird.scurry, bird.run, bird.takeoff, bird.fly, bird.land */
async function rigSkinned({THREE,scene,animations,O}){
 const V=(x,y,z)=>new THREE.Vector3(x,y,z),Q=()=>new THREE.Quaternion();
 scene.updateMatrixWorld(true);
 let mesh=null;scene.traverse(o=>{if(o.isSkinnedMesh&&(!mesh||o.geometry.attributes.position.count>mesh.geometry.attributes.position.count))mesh=o;});
 if(!mesh)throw new Error('bird rig: no skinned mesh');
 const allB=mesh.skeleton.bones,BN=O.bones||{};
 const find=n=>{if(!n)return null;const k=String(n).toLowerCase();let best=null;for(const b of allB){const m=b.name.toLowerCase();if(m===k||m.startsWith(k+'_')||m.startsWith(k)){if(!best||b.name.length<best.name.length)best=b;}}return best;};
 const sideName=(n,s)=>String(n).replace(/_L(?=_|$)/,'_'+s).replace(/L$/,s);
 const b={};for(const k of ['hips','spine','chest','neck','head'])b[k]=find(BN[k]);
 for(const s of ['L','R'])for(const k of ['thigh','heel','ankle','toes','scap','shoulder','elbow','wrist']){const n=BN[k+'L'];b[k+s]=find(s==='L'?n:sideName(n,'R'));}
 for(const k in b)if(!b[k])throw new Error('bird rig: bone not found for '+k+' ('+(BN[k]||BN[k.replace(/R$/,'L')])+')');
 /* (the chick) skin weights mended: kenchoo's file has about 240 vertices on the body's midline, high on the rump, held by the
    left knee (with no mirror on the right) and the left hip reaching past the midline, so every left stride and any forward tilt
    pulled a thin spike out of the rump. reweight: [{from, to, above (share of the model's height, bind pose), xBelow (share of
    the height, the bird's left being +x)}]: each listed weight on such a vertex is handed to the bone 'to' */
 if(Array.isArray(O.reweight)&&O.reweight.length){const g=mesh.geometry,P=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,bones=mesh.skeleton.bones;
  let yLo=Infinity,yHi=-Infinity;for(let i=0;i<P.count;i++){const y=P.getY(i);if(y<yLo)yLo=y;if(y>yHi)yHi=y;}const HH=yHi-yLo,GC=['getX','getY','getZ','getW'],SC=['setX','setY','setZ','setW'];let moved=0;
  for(const R of O.reweight){const fb=find(R.from),tb=find(R.to);if(!fb||!tb)throw new Error('bird rig: reweight bone not found ('+R.from+' -> '+R.to+')');const fi=bones.indexOf(fb),ti=bones.indexOf(tb);
   for(let i=0;i<P.count;i++){if(R.above!=null&&!(P.getY(i)>yLo+HH*+R.above))continue;if(R.xBelow!=null&&!(P.getX(i)<HH*+R.xBelow))continue;
    let w=0;for(let c=0;c<4;c++)if(si[GC[c]](i)===fi&&sw[GC[c]](i)>0){w+=sw[GC[c]](i);sw[SC[c]](i,0);}if(!(w>0))continue;moved++;
    let done=false;for(let c=0;c<4&&!done;c++)if(si[GC[c]](i)===ti){sw[SC[c]](i,sw[GC[c]](i)+w);done=true;}
    for(let c=0;c<4&&!done;c++)if(sw[GC[c]](i)===0){si[SC[c]](i,ti);sw[SC[c]](i,w);done=true;}}}
  si.needsUpdate=sw.needsUpdate=true;O.__reweighted=moved;}
 /* the idle: the model's own clip, from its first key */
 const src=(O.idle&&O.idle.clip?animations.find(a=>a.name===O.idle.clip):null)||animations[0];if(!src)throw new Error('bird rig: the rigged bird has no clip');
 let t0=Infinity;for(const tr of src.tracks)t0=Math.min(t0,tr.times[0]);if(O.idle&&O.idle.from!=null)t0=+O.idle.from;
 const idle=src.clone();idle.name='bird.idle';for(const tr of idle.tracks){tr.times=tr.times.map(t=>Math.max(0,t-t0));}idle.resetDuration();
 /* the rest pose the baked clips start from: the idle's first frame */
 const mixer=new THREE.AnimationMixer(scene),act=mixer.clipAction(idle);act.play();mixer.setTime(0);scene.updateMatrixWorld(true);
 const rest=new Map();for(const bn of allB)rest.set(bn,{q:bn.quaternion.clone(),p:bn.position.clone(),s:bn.scale.clone()});
 act.stop();mixer.uncacheRoot(scene);
 const toRest=()=>{for(const [bn,r] of rest){bn.quaternion.copy(r.q);bn.position.copy(r.p);bn.scale.copy(r.s);}scene.updateMatrixWorld(true);};
 toRest();
 /* the bird's frame: +Z forward (the head ahead of the hips), +Y up, X to the bird's left */
 const fw=O.forward||[0,0,1],F=V(fw[0],0,fw.length>2?fw[2]:fw[1]).normalize(),U=V(0,1,0),Lx=V().crossVectors(U,F).normalize();
 const wpos=bn=>bn.getWorldPosition(V()),hipsY=wpos(b.hips).y,H=Math.max(1e-6,wpos(b.head).y-Math.min(wpos(b.toesL).y,wpos(b.toesR).y));
 /* a rotation about an axis of the bird's frame, at the bone's own joint (premultiplied in its parent's frame) */
 const _q=Q(),_p=Q();
 const rotW=(bn,axis,ang)=>{if(!ang)return;bn.parent.getWorldQuaternion(_p);_q.setFromAxisAngle(axis,ang);const inv=_p.clone().invert();bn.quaternion.premultiply(inv.multiply(_q).multiply(_p));bn.updateMatrixWorld(true);};
 const moveW=(bn,d)=>{const pm=new THREE.Matrix4().copy(bn.parent.matrixWorld).invert(),o=V().applyMatrix4(pm),t=d.clone().applyMatrix4(pm).sub(o);bn.position.add(t);bn.updateMatrixWorld(true);};
 const AX=V().copy(Lx),AY=U,AZ=F;   // pitch (+ nose down), yaw (+ to the left), roll (+ left side down... about the forward axis)
 /* two-bone IK in the world: thigh (hips -> heel) and tarsus (heel -> ankle) put the ankle on the target, the knee
    bending in the plane it already bends in, then the foot turned back to its rest angle (and curled, in the air) */
 const restW=new Map();for(const bn of allB)restW.set(bn,bn.getWorldQuaternion(Q()));
 const solve=(s,T,curl)=>{const A=b['thigh'+s],Bk=b['heel'+s],C=b['ankle'+s];const pa=wpos(A),pb=wpos(Bk),pc=wpos(C);
  const lab=pa.distanceTo(pb),lbc=pb.distanceTo(pc),lat=clamp(pa.distanceTo(T),Math.abs(lab-lbc)*1.02+1e-6,(lab+lbc)*0.999);
  let n=V().crossVectors(V().subVectors(pb,pa),V().subVectors(pc,pb));if(n.lengthSq()<1e-12)n.copy(AX);n.normalize();
  const cur=V().subVectors(pa,pb).angleTo(V().subVectors(pc,pb)),want=Math.acos(clamp((lab*lab+lbc*lbc-lat*lat)/(2*lab*lbc),-1,1));
  rotW(Bk,n,-(want-cur));
  const pc2=wpos(C),d1=V().subVectors(pc2,pa).normalize(),d2=V().subVectors(T,pa).normalize(),ax=V().crossVectors(d1,d2);const sn=ax.length();
  if(sn>1e-9)rotW(A,ax.normalize(),Math.atan2(sn,d1.dot(d2)));
  /* the foot: its rest angle in the world, curled about the bird's x in the air */
  C.parent.getWorldQuaternion(_p);const want2=restW.get(C).clone();if(curl)want2.premultiply(Q().setFromAxisAngle(AX,curl));C.quaternion.copy(_p.clone().invert().multiply(want2));C.updateMatrixWorld(true);};
 const ank0={L:wpos(b.ankleL),R:wpos(b.ankleR)};
 /* the wings: out of the fold and raised by the shoulder about the forward axis, swept by the scapula about the vertical */
 /* (the axes: the bird's own, or the pitched body's in flight, so a tipped-forward bird beats its wings about its own long axis) */
 const SCR=O.fly&&O.fly.scap!=null?+O.fly.scap:0;   // (a share of the raise taken by the scapula, so the skin at the wing's root is not all stretched at one joint)
 const wing=(s,raise,sweep,twist,fold,ax)=>{const sg=s==='L'?1:-1,a=ax||{x:AX,y:AY,z:AZ};rotW(b['scap'+s],a.y,-sg*(sweep||0));if(SCR)rotW(b['scap'+s],a.z,sg*raise*SCR);rotW(b['shoulder'+s],a.z,sg*raise*(1-SCR));if(twist)rotW(b['shoulder'+s],a.x,twist);if(fold)rotW(b['elbow'+s],a.y,sg*fold);};
 const gaitP=(W,d)=>({T:+W.T||d.T,S:(+W.stride||d.stride)*H,lift:(+W.lift||d.lift)*H,bob:(W.bob!=null?+W.bob:d.bob)*H,lean:W.lean!=null?+W.lean:d.lean,crouch:(W.crouch!=null?+W.crouch:d.crouch)*H});
 const SCP=gaitP(O.scurry||{},{T:0.3,stride:0.3,lift:0.08,bob:0.012,lean:0.12,crouch:0});
 /* (run: the scurry quicker, longer and lower, leaning into it: 'bird.run', for a chick keeping up with a walking horse) */
 const RUNP=gaitP(O.run||{},{T:SCP.T*0.66,stride:SCP.S/H*1.35,lift:SCP.lift/H*0.9,bob:SCP.bob/H*0.7,lean:SCP.lean+0.15,crouch:0.02});
 const FL=O.fly||{},fHz=+FL.hz||10,fAmp=FL.amp!=null?+FL.amp:1.1,fPitch=FL.pitch!=null?+FL.pitch:-0.35,wS=+FL.wingScale||1.35,fRaise=FL.raise!=null?+FL.raise:0;
 /* stance half the cycle; the swing lifts at once and reaches forward only once the foot is up (no drag at lift-off) */
 const dzG=(G,v)=>v<0.5?G.S*(0.25-v):G.S*(0.25+sstep(0.1,0.9,(v-0.5)/0.5)-v),dyG=(G,v)=>v<0.5?0:G.lift*Math.sin(Math.PI*(v-0.5)/0.5);
 const scurryAt=(G,u)=>{toRest();const bob=-G.bob*Math.cos(4*Math.PI*u)-G.crouch;moveW(b.hips,V(0,bob,0).addScaledVector(F,G.S*u));
  rotW(b.hips,AX,G.lean+0.03*Math.sin(4*Math.PI*u));rotW(b.hips,AZ,0.05*Math.sin(TAU*u));rotW(b.hips,AY,0.05*Math.sin(TAU*u-0.6));
  /* the head bobs: thrust forward and held while the body catches up, twice a cycle */
  const hb=Math.sin(4*Math.PI*u+1.2);rotW(b.neck,AX,-G.lean*0.7+0.12*hb);rotW(b.head,AX,-G.lean*0.3-0.08*hb);
  for(const s of ['L','R'])wing(s,0.18+0.05*Math.sin(4*Math.PI*u)+(G.lean-SCP.lean)*0.6,0.05,0,0);
  for(const [s,o] of [['L',0],['R',0.5]]){const v=(u+o)%1,T=ank0[s].clone().addScaledVector(F,G.S*u+dzG(G,v)).add(V(0,dyG(G,v),0));solve(s,T,v<0.5?0:-0.5*Math.sin(Math.PI*(v-0.5)/0.5));}};
 /* the flight: body tipped up (fPitch, + nose down), legs paddling under it, the stubs beaten fast and wide */
 /* the body's pitch in the air, turned about the hips but on the bone above them (kenchoo's chick has a few rump vertices held by
    that bone, which stayed behind as a spike when the hips alone tipped forward); the hips put back where they were */
 const PB=b.hips.parent&&b.hips.parent.isBone?b.hips.parent:b.hips;
 const pitchAt=a=>{if(!a)return;const p0=wpos(b.hips);rotW(PB,AX,a);if(PB!==b.hips){const p1=wpos(b.hips);moveW(PB,p0.sub(p1));}};
 /* (fly.pitch + tips the body forward, a bird's flight; the wings then beat about the tipped body's own long axis, raised from
    fly.raise round it, and the legs are tucked up under the belly, toes curled) */
 const hips0=wpos(b.hips);
 const flyPose=(u,k)=>{const pa=fPitch*k;pitchAt(pa);moveW(b.hips,V(0,0.03*H*Math.sin(TAU*u)*k,0));rotW(b.neck,AX,-pa*0.6);rotW(b.head,AX,-pa*0.35);
  const ax={x:AX,y:U.clone().applyAxisAngle(AX,pa),z:F.clone().applyAxisAngle(AX,pa)};
  const ph=TAU*u,st=Math.cos(ph);for(const s of ['L','R'])wing(s,k*(0.55+fRaise+fAmp*0.5*(st+1)*0.5+fAmp*0.5*st),k*0.35,k*0.25*Math.sin(ph),0,ax);
  const hp=wpos(b.hips);
  for(const [s,o] of [['L',0],['R',0.5]]){const v=(u*0.5+o)%1,c=TAU*v;
   if(fPitch>0){/* tucked: the rest leg turned with the body and drawn up towards the hips, a small paddle */const r=ank0[s].clone().sub(hips0).applyAxisAngle(AX,pa*0.6);const T=ank0[s].clone().lerp(hp.clone().add(r.multiplyScalar(0.55)).addScaledVector(ax.z,-0.05*H+0.015*H*Math.cos(c)),k);solve(s,T,-0.7*k);}
   else{const T=ank0[s].clone();T.y=lerp(T.y,wpos(b['thigh'+s]).y-(wpos(b['thigh'+s]).y-ank0[s].y)*0.72,k);T.addScaledVector(F,k*(-0.06*H+0.05*H*Math.cos(c)));T.y+=k*0.04*H*Math.sin(c);solve(s,T,-0.6*k);}}};
 const flyAt=u=>{toRest();flyPose(u,1);};
 const takeoffAt=u=>{toRest();const k=sstep(0,0.25,u);moveW(b.hips,V(0,0.02*H*(1-k),0));flyPose((u*0.7*fHz)%1,k);if(u<0.2){const c=1-u/0.2;pitchAt(0.25*c);}};
 const landAt=u=>{toRest();const k=1-sstep(0.55,0.95,u);flyPose((u*0.6*fHz)%1,k);
  if(u>0.35&&u<0.9){const r=Math.sin(Math.PI*(u-0.35)/0.55);pitchAt(-0.15*r);}};
 /* bake: read every bone back, each frame */
 const tracksOf=(name,T,n,poseAt,scaleW,travel)=>{const times=new Float32Array(n+1),qv=new Map(),pv=new Float32Array((n+1)*3),sv={L:new Float32Array((n+1)*3),R:new Float32Array((n+1)*3)},pb=new Float32Array((n+1)*3);
  for(const bn of allB)qv.set(bn,new Float32Array((n+1)*4));
  for(let i=0;i<=n;i++){const u=i/n;times[i]=u*T;poseAt(i===n&&name!=='bird.land'&&name!=='bird.takeoff'?0:u);
   for(const bn of allB)bn.quaternion.toArray(qv.get(bn),4*i);b.hips.position.toArray(pv,3*i);PB.position.toArray(pb,3*i);
   const ws=scaleW?scaleW(u):1;sv.L.fill(ws,3*i,3*i+3);sv.R.fill(ws,3*i,3*i+3);}
  if(travel){/* the root's travel: one stride, as measured at the end (the last frame is the first, moved on) */const d=V().addScaledVector(F,travel),pm=new THREE.Matrix4().copy(b.hips.parent.matrixWorld).invert(),o=V().applyMatrix4(pm),t=d.applyMatrix4(pm).sub(o);pv[3*n]+=t.x;pv[3*n+1]+=t.y;pv[3*n+2]+=t.z;}
  const tr=[];for(const bn of allB)tr.push(new THREE.QuaternionKeyframeTrack(bn.name+'.quaternion',times,qv.get(bn)));
  tr.push(new THREE.VectorKeyframeTrack(b.hips.name+'.position',times,pv));if(PB!==b.hips)tr.push(new THREE.VectorKeyframeTrack(PB.name+'.position',times,pb));
  if(scaleW){tr.push(new THREE.VectorKeyframeTrack(b.shoulderL.name+'.scale',times,sv.L),new THREE.VectorKeyframeTrack(b.shoulderR.name+'.scale',times,sv.R));}
  return new THREE.AnimationClip(name,T,tr);};
 const one=()=>1;
 const clips=[idle,tracksOf('bird.scurry',SCP.T,24,u=>scurryAt(SCP,u),one,SCP.S),...(O.run===false?[]:[tracksOf('bird.run',RUNP.T,20,u=>scurryAt(RUNP,u),one,RUNP.S)]),tracksOf('bird.fly',1/fHz,12,flyAt,()=>wS),tracksOf('bird.takeoff',0.6,36,takeoffAt,u=>lerp(1,wS,sstep(0,0.2,u))),tracksOf('bird.land',0.6,36,landAt,u=>lerp(wS,1,sstep(0.55,0.95,u)))];
 toRest();
 /* the down: the texture's detail laid over a chick's yellow, legs, beak and eyes kept as they are */
 const D=O.down||{};
 if(D.yellow!==false){const g=mesh.geometry,pos=g.attributes.position,N=pos.count,mat0=Array.isArray(mesh.material)?mesh.material[0]:mesh.material,TX=texSampler(mat0&&mat0.map);
  const uv=g.attributes.uv;const tint=new Float32Array(N*4),amt=new Float32Array(N);const yc=new THREE.Color(D.yellow||'#f6c431');
  /* where each vertex is in the bird's frame, in its rest pose (the bind pose skinned) */
  const vtx=V(),keep=D.keep||{},legY=keep.belowY!=null?+keep.belowY:0.3,bk=keep.beak||null;
  const lums=new Float32Array(N);for(let i=0;i<N;i++)lums[i]=TX&&uv?TX.lum(uv.getX(i),uv.getY(i)):0.6;
  /* the neighbourhood's brightness: the texel's, averaged over the welded surface */
  const P=new Float32Array(N*3);for(let i=0;i<N;i++){mesh.getVertexPosition(i,vtx).applyMatrix4(mesh.matrixWorld);P[3*i]=vtx.x;P[3*i+1]=vtx.y;P[3*i+2]=vtx.z;}
  const W=weldOf(P),idx=g.index?Array.from(g.index.array):[...Array(N).keys()],AD=adjOf(W,idx);let L=new Float32Array(N),L2=new Float32Array(N);
  for(let i=0;i<N;i++)L[W[i]]=lums[i];
  for(let p=0;p<20;p++){for(let i=0;i<N;i++){if(W[i]!==i)continue;const d0=AD.deg[i],d1=AD.deg[i+1];if(d1===d0){L2[i]=L[i];continue;}let s=0;for(let j=d0;j<d1;j++)s+=L[AD.nb[j]];L2[i]=0.5*L[i]+0.5*s/(d1-d0);}const t=L;L=L2;L2=t;}
  const hy=Math.min(wpos(b.toesL).y,wpos(b.toesR).y);
  for(let i=0;i<N;i++){const y=(P[3*i+1]-hy)/H;let a=sstep(legY-0.02,legY+0.03,y);
   if(bk){const c=V(bk[0],bk[1],bk[2]);const d=Math.hypot(P[3*i]-c.x,P[3*i+1]-c.y,P[3*i+2]-c.z)/H;a*=sstep(bk[3]*0.8,bk[3]*1.2,d);}
   a*=sstep(0.1,0.22,lums[i]);   // (the eyes and their dark rims kept)
   tint[4*i]=yc.r;tint[4*i+1]=yc.g;tint[4*i+2]=yc.b;tint[4*i+3]=Math.pow(clamp(L[W[i]],0.03,1),2.2);amt[i]=a*(D.amount!=null?+D.amount:1);}
  g.setAttribute('birdTint',new THREE.BufferAttribute(tint,4));g.setAttribute('birdTintK',new THREE.BufferAttribute(amt,1));
  const DM=downMaterialClass(THREE),m=new DM();THREE.MeshStandardMaterial.prototype.copy.call(m,mat0);m.defines={STANDARD:'',PHYSICAL:''};m.name=(mat0.name||'chick')+'-down';
  m.sheen=D.sheen!=null?+D.sheen:0.8;m.sheenRoughness=D.sheenRoughness!=null?+D.sheenRoughness:0.55;m.sheenColor=new THREE.Color(D.sheenColor||'#fff1b8');m.roughness=D.roughness!=null?+D.roughness:0.92;m.metalness=0;
  m.userData.fuzz=+(D.fuzz!=null?D.fuzz:0.3);if(D.normalScale!=null&&m.normalScale)m.normalScale.setScalar(+D.normalScale);
  mesh.material=m;
  /* (shells: fine down standing off the skin: a few copies of the skin, each pushed out a little further along its normal and
     drooping a little, cut to strands by a cellular pattern fixed to the bind pose, so each strand runs through every layer,
     thinning to its tip, darker at the root, none on the legs, the beak or the eyes (where the repaint is off);
     shells: {n, len (share of the height), density (strands across the height), droop, far (metres from the camera
     beyond which the layers are dropped, the outer ones first)}) */
  const SH=D.shells;if(SH&&+SH.n>0){let yLo=Infinity,yHi=-Infinity;for(let i=0;i<N;i++){const y=pos.getY(i);if(y<yLo)yLo=y;if(y>yHi)yHi=y;}const HG=yHi-yLo,SM=shellMaterialClass(THREE,DM),n=Math.min(12,+SH.n|0);
   for(let k=1;k<=n;k++){const sm=new SM();THREE.MeshPhysicalMaterial.prototype.copy.call(sm,m);sm.defines={STANDARD:'',PHYSICAL:''};sm.name=m.name+'-shell'+k;
    sm.userData=Object.assign({},m.userData,{shellH:k/n,shellL:(+SH.len||0.02)*HG,shellF:(+SH.density||240)/HG,shellDroop:SH.droop!=null?+SH.droop:0.35,shellFar:+SH.far||7});
    const sk=new (shellMeshClass(THREE))(g,sm);sk.name=mesh.name+'-down'+k;sk.receiveShadow=true;sk.frustumCulled=false;sk.userData.noShadow=true;sk.renderOrder=k;
    mesh.parent.add(sk);sk.position.copy(mesh.position);sk.quaternion.copy(mesh.quaternion);sk.scale.copy(mesh.scale);sk.bind(mesh.skeleton,mesh.bindMatrix);}}}
 scene.userData.birdRig={rigged:true,bones:allB.length,clips:clips.map(c=>c.name),height:+H.toFixed(3),reweighted:O.__reweighted||0};
 return {scene,animations:clips};}
/* the chick's down: a physical material (sheen) with the yellow laid under the texture's detail and a fuzz of light at the
   silhouette, as fine down catches it. A class, so the copy each pet instance makes keeps it. */
let DOWNMAT=null;
function downMaterialClass(THREE){
 if(DOWNMAT&&DOWNMAT.T===THREE)return DOWNMAT.C;
 const hook=(sh,m)=>{const fz=(+(m.userData&&m.userData.fuzz)||0).toFixed(3);
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 birdTint;\nattribute float birdTintK;\nvarying vec4 vBirdTint;\nvarying float vBirdTintK;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBirdTint=birdTint;vBirdTintK=birdTintK;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec4 vBirdTint;\nvarying float vBirdTintK;').replace('#include <map_fragment>','#include <map_fragment>\n{float bL=dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722));float bD=clamp(bL/max(vBirdTint.w,0.004),0.35,1.7);diffuseColor.rgb=mix(diffuseColor.rgb,vBirdTint.rgb*pow(bD,0.8),clamp(vBirdTintK,0.0,1.0));}')
   .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n{float oF=1.0-abs(dot(normal,normalize(vViewPosition)));totalEmissiveRadiance+=diffuseColor.rgb*'+fz+'*oF*oF*clamp(vBirdTintK,0.0,1.0);}');};
 class BirdDownMaterial extends THREE.MeshPhysicalMaterial{constructor(p){super(p);this.onBeforeCompile=sh=>hook(sh,this);this.customProgramCacheKey=()=>'birdDown1|'+(this.userData&&this.userData.fuzz||0);}}
 DOWNMAT={T:THREE,C:BirdDownMaterial};return BirdDownMaterial;}
/* a layer of down never casts a shadow of its own (the skin under it does): whatever sets castShadow on the pet's meshes, and in
   every copy of it (a clone is made by its own constructor) */
let SHELLMESH=null;
function shellMeshClass(THREE){if(SHELLMESH&&SHELLMESH.T===THREE)return SHELLMESH.C;
 class BirdShellMesh extends THREE.SkinnedMesh{get castShadow(){return false;}set castShadow(v){}}
 SHELLMESH={T:THREE,C:BirdShellMesh};return BirdShellMesh;}
let SHELLMAT=null;
function shellMaterialClass(THREE,Down){
 if(SHELLMAT&&SHELLMAT.T===THREE)return SHELLMAT.C;
 const hook=(sh,m)=>{const U=m.userData||{};sh.uniforms.uShellH={value:+U.shellH||0};sh.uniforms.uShellL={value:+U.shellL||0};sh.uniforms.uShellF={value:+U.shellF||1};sh.uniforms.uShellD={value:+U.shellDroop||0};sh.uniforms.uShellFar={value:+U.shellFar||7};
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uShellH;\nuniform float uShellL;\nuniform float uShellD;\nuniform float uShellFar;\nvarying vec3 vShB;')
   .replace('#include <project_vertex>','#include <project_vertex>\nif(-mvPosition.z>uShellFar*(1.0+0.6*(1.0-uShellH)))gl_Position=vec4(2.0,2.0,2.0,1.0);')   // (far off, a strand is under a pixel: the outer layers go first, then the rest, so the far pet costs nothing)
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvShB=position;{float sK=clamp(birdTintK,0.0,1.0);transformed+=(normalize(normal)*(uShellH*uShellL)+vec3(0.0,-1.0,0.0)*(uShellH*uShellH*uShellL*uShellD))*sK;}');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uShellH;\nuniform float uShellF;\nvarying vec3 vShB;\n'+
    'vec3 shH3(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return fract(sin(p)*43758.5453);}\n'+
    'float shW(vec3 p){vec3 i=floor(p),f=fract(p);float d=8.0;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){vec3 g=vec3(float(x),float(y),float(z));vec3 r=g+shH3(i+g)-f;d=min(d,dot(r,r));}return sqrt(d);}')
   .replace('#include <alphatest_fragment>','{if(vBirdTintK<0.7)discard;float sd=shW(vShB*uShellF);if(sd>0.62*(1.0-0.8*uShellH))discard;diffuseColor.rgb*=mix(0.8,1.1,uShellH);}\n#include <alphatest_fragment>');};
 class BirdShellMaterial extends Down{constructor(p){super(p);const base=this.onBeforeCompile;this.onBeforeCompile=sh=>{base(sh);hook(sh,this);};this.customProgramCacheKey=()=>'birdShell1|'+(this.userData&&this.userData.fuzz||0);}}
 SHELLMAT={T:THREE,C:BirdShellMaterial};return BirdShellMaterial;}

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
/* (small birds) The scan's colours repainted as the bird's own (the AI duckling was a rufous brown; a mallard duckling is
   yellow with a dark olive crown and back, a dark stripe through the eye, yellow spots on the back and a dark bill): each
   vertex gets a target colour by where it is on the bird, and its neighbourhood's brightness (the texture under the faces
   round it, spread over the surface), so the shader keeps the texture's own detail (each texel's brightness against its
   neighbourhood's) and lays the target colour under it. The eye keeps the scan's own texels.
   T: {yellow, olive, stripe, bill, under, head:{c:[x,y,z], r}, eye:[x,y,z] (left), eyeR, bill:{z, y}, stripeW, crown, back:[y, tilt],
   soft, spots:[[x,y,z,r],...] (left side, mirrored), amount, passes}
   -> Float32Array(N*4): the target colour (linear) and the neighbourhood's brightness (linear); .amount: Float32Array(N) */
function recolor(THREE,P,Nn,UV,tri,TX,T,weld,adj){
 if(!UV||!TX)return null;
 const N=P.length/3,S=new Float64Array(N),A=new Float64Array(N);
 for(let t=0;t<tri.length;t+=3){const a=tri[t],b=tri[t+1],c=tri[t+2];
  const ux=P[3*b]-P[3*a],uy=P[3*b+1]-P[3*a+1],uz=P[3*b+2]-P[3*a+2],vx=P[3*c]-P[3*a],vy=P[3*c+1]-P[3*a+1],vz=P[3*c+2]-P[3*a+2];
  const ar=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)*0.5;if(!(ar>0))continue;
  const l=TX.lum((UV[2*a]+UV[2*b]+UV[2*c])/3,(UV[2*a+1]+UV[2*b+1]+UV[2*c+1])/3);
  for(const r of [weld[a],weld[b],weld[c]]){S[r]+=l*ar;A[r]+=ar;}}
 const {deg,nb}=adj;let L=new Float32Array(N),L2=new Float32Array(N);const roots=[];for(let i=0;i<N;i++)if(weld[i]===i){L[i]=A[i]>0?S[i]/A[i]:0.5;roots.push(i);}
 for(let pz=0,np=+T.passes||30;pz<np;pz++){for(const i of roots){const d0=deg[i],d1=deg[i+1];if(d1===d0){L2[i]=L[i];continue;}let s=0;for(let j=d0;j<d1;j++)s+=L[nb[j]];L2[i]=0.5*L[i]+0.5*s/(d1-d0);}const t=L;L=L2;L2=t;}
 const C=h=>{const c=new THREE.Color(h);return [c.r,c.g,c.b];},Y=C(T.yellow||'#f0c445'),O=C(T.olive||'#5a4920'),SK=C(T.stripe||'#3b2d14'),BL=C(T.billColor||'#4a463d'),UN=C(T.under||T.yellow||'#f4cf5a');
 const H=T.head||{c:[0,0.06,0.045],r:0.03},hc=H.c,hr=H.r,E=T.eye||[0.02,0.065,0.06],ER=+T.eyeR||0.005,Bk=T.bill||{z:0.078,y:0.058},sw=+T.stripeW||0.0035,crown=+T.crown||0.004,soft=+T.soft||0.004;
 const back=T.back||[0.03,0],spots=T.spots||[],slope=(Bk.y-E[1])/Math.max(1e-6,Bk.z-E[2]);
 const out=new Float32Array(N*4),amt=new Float32Array(N),DET=new Float32Array(N);
 /* (the olive mask follows the surface's smoothed normal, not each vertex's own: the scan's spiky down has strands facing every way,
    which left yellow flecks all over the dark back) */
 let NYs=new Float32Array(N),NY2=new Float32Array(N);for(const i of roots)NYs[i]=0;for(let i=0;i<N;i++)NYs[weld[i]]+=Nn[3*i+1];
 {const cnt=new Float32Array(N);for(let i=0;i<N;i++)cnt[weld[i]]++;for(const i of roots)NYs[i]/=cnt[i]||1;}
 for(let pz=0,np=T.normalPasses!=null?+T.normalPasses:6;pz<np;pz++){for(const i of roots){const d0=deg[i],d1=deg[i+1];if(d1===d0){NY2[i]=NYs[i];continue;}let s=0;for(let j=d0;j<d1;j++)s+=NYs[nb[j]];NY2[i]=0.5*NYs[i]+0.5*s/(d1-d0);}const t=NYs;NYs=NY2;NY2=t;}
 for(let i=0;i<N;i++){const x=P[3*i],y=P[3*i+1],z=P[3*i+2],ax=Math.abs(x),ny=Nn[3*i+1],nys=NYs[weld[i]];
  const dh=Math.hypot(x-hc[0],y-hc[1],z-hc[2]),inHead=1-sstep(hr*0.95,hr*1.2,dh);
  /* the body: olive above a line along the flank (higher towards the breast), yellow below; the underparts paler */
  const yb=back[0]+back[1]*z,nz=Nn[3*i+2];let wO=sstep(yb-soft,yb+soft,y)*sstep(-0.6,-0.1,nys);
  /* (backFront: [z0, z1]: the olive back stops at the shoulders; it never wraps round onto the front of the breast, which a
     mallard duckling has plain yellow) */
  if(T.backFront)wO*=1-sstep(+T.backFront[0],+T.backFront[1],z)*sstep(-0.25,0.35,nz);
  let c=[lerp(Y[0],UN[0],sstep(0,-0.8,ny)),lerp(Y[1],UN[1],sstep(0,-0.8,ny)),lerp(Y[2],UN[2],sstep(0,-0.8,ny))];
  /* the head: crown olive from just above the eye, a stripe through the eye from the bill to the back of the head */
  const yl=E[1]+(z-E[2])*slope;let yc=yl+crown;
  /* (nape: the crown carried down the back of the head into the nape, widest at the middle, as a mallard duckling's is) */
  if(T.nape){const NP=T.nape,bz=Math.max(0,E[2]-(+NP.from||0.01)-z),cen=1-sstep((+NP.w||0.45)*hr,(+NP.w||0.45)*hr+0.45*hr,ax);yc=lerp(yc,Math.min(yc,E[1]+crown-bz*(+NP.slope||0.8)),cen);}
  const wC=sstep(yc-soft*0.6,yc+soft*0.6,y);
  const wS=(1-sstep(sw*0.55,sw,Math.abs(y-yl)))*sstep(0.25*hr,0.5*hr,ax)*sstep(E[2]-hr*0.75,E[2]-hr*0.45,z)*(1-sstep(Bk.z-0.002,Bk.z+0.002,z));
  wO=lerp(wO,wC,inHead);
  for(const sp of spots){const d=Math.hypot(ax-Math.abs(sp[0]),y-sp[1],z-sp[2]);wO*=sstep(sp[3]*0.55,sp[3],d);}
  for(let k=0;k<3;k++){c[k]=lerp(c[k],O[k],wO);c[k]=lerp(c[k],SK[k],wS*inHead);}
  /* the bill (everything ahead of its base on the head) dark slate */
  const wB=sstep(Bk.z-0.0015,Bk.z+0.0015,z)*sstep(hc[1]-hr,hc[1]-hr*0.6,y);for(let k=0;k<3;k++)c[k]=lerp(c[k],BL[k],wB);
  /* (detail: how much of the texture's own light and dark is kept over the colour: the underparts and the rounded belly,
     where the scan's texture is streaked and stretched, are laid on nearly flat; detail: {all, under, front, back, flatBelow}) */
  const DT=T.detail||{},dU=sstep(-0.05,-0.6,ny)*(1-inHead),dB=DT.flatBelow!=null?1-sstep(+DT.flatBelow,+DT.flatBelow+0.008,y):0;
  const dF=DT.front!=null?sstep(0.15,0.55,nz)*(1-inHead):0;   // (front: the breast, seen head on)
  let dd=lerp(DT.all!=null?+DT.all:1,DT.under!=null?+DT.under:1,Math.max(dU,dB));if(dF>0)dd=Math.min(dd,lerp(dd,+DT.front,dF));dd=lerp(dd,DT.back!=null?+DT.back:dd,wO*(1-inHead));DET[i]=dd;
  if(dB>0)for(let k=0;k<3;k++)c[k]=lerp(c[k],UN[k],dB);
  out[4*i]=c[0];out[4*i+1]=c[1];out[4*i+2]=c[2];out[4*i+3]=Math.pow(clamp(L[weld[i]],0.02,1),2.2);
  /* the eye keeps its own texels */
  const de=Math.hypot(ax-Math.abs(E[0]),y-E[1],z-E[2]);amt[i]=(T.amount!=null?+T.amount:1)*sstep(ER*0.7,ER*1.25,de);}
 out.amount=amt;out.detail=DET;return out;}
/* (small birds) Legs and webbed feet, drawn: the feathered top of the leg (from the hip, inside the body, to the heel) in the
   down's colour, the bare tarsus (heel to foot), and three toes fanned forward with the web between them, a little cupped;
   skinned to the thigh, the tarsus and the foot. LG: {r:[top, heel, foot], colors:{down, leg, web, toe}, toes:[len...], spread} */
function buildLegs(THREE,J,LG,BI){
 const pos=[],col=[],si=[],sw=[],idx=[],V=(x,y,z)=>new THREE.Vector3(x,y,z);
 const CL=LG.colors||{},C=h=>{const c=new THREE.Color(h);return [c.r,c.g,c.b];},cDown=C(CL.down||'#e8b840'),cLeg=C(CL.leg||'#b8803e'),cWeb=C(CL.web||'#a2703a'),cToe=C(CL.toe||'#6e5232');
 const R=LG.r||[0.0065,0.0034,0.0027];
 const tube=(a,b,ra,rb,ca,cb,wa,wb,ring=4,seg=8)=>{const ax=V().subVectors(b,a),len=ax.length();ax.normalize();const u=Math.abs(ax.y)<0.9?V(0,1,0):V(1,0,0),e1=V().crossVectors(ax,u).normalize(),e2=V().crossVectors(ax,e1);
  const base=pos.length/3;for(let i=0;i<=ring;i++){const t=i/ring,r=lerp(ra,rb,t),cc=[lerp(ca[0],cb[0],t),lerp(ca[1],cb[1],t),lerp(ca[2],cb[2],t)],w=wa(t);
   for(let j=0;j<seg;j++){const an=j/seg*TAU,o=V().addScaledVector(e1,Math.cos(an)*r).addScaledVector(e2,Math.sin(an)*r);const p=V().copy(a).addScaledVector(ax,len*t).add(o);pos.push(p.x,p.y,p.z);col.push(...cc);si.push(w[0],w[2],0,0);sw.push(w[1],1-w[1],0,0);}}
  for(let i=0;i<ring;i++)for(let j=0;j<seg;j++){const A=base+i*seg+j,B=base+i*seg+(j+1)%seg,Cc=A+seg,D=B+seg;idx.push(A,Cc,B,B,Cc,D);}
  /* the end closed */const ce=pos.length/3,eb=V().copy(b);pos.push(eb.x,eb.y,eb.z);col.push(...cb);const we=wa(1);si.push(we[0],we[2],0,0);sw.push(we[1],1-we[1],0,0);for(let j=0;j<seg;j++)idx.push(base+ring*seg+j,ce,base+ring*seg+(j+1)%seg);};
 for(const s of ['L','R']){const th=J['thigh'+s],sh=J['shank'+s],ft=J['foot'+s],to=J['toe'+s],bT=BI['thigh'+s],bS=BI['shank'+s],bF=BI['foot'+s],sg=s==='L'?1:-1;
  tube(th,sh,R[0],R[0]*0.75,cDown,cDown,t=>t<0.75?[bT,1,bS]:[bT,1-sstep(0.75,1,t),bS]);
  tube(V().lerpVectors(sh,ft,-0.05),ft,R[1],R[2],cLeg,cLeg,t=>[bS,1-sstep(0.8,1,t),bF]);
  /* the toes and the web: fanned from the foot joint along the ground, the middle one along foot -> toe */
  const fwd=V(to.x-ft.x,0,to.z-ft.z).normalize(),sp=(+LG.spread||30)*Math.PI/180,TL=LG.toes||[0.016,0.019,0.016],tips=[];
  for(let k=-1;k<=1;k++){const a=k*sp,d=V(fwd.x*Math.cos(a)+fwd.z*Math.sin(a)*sg,0,-fwd.x*Math.sin(a)*sg+fwd.z*Math.cos(a)).normalize();
   const tip=V().copy(ft).addScaledVector(d,TL[k+1]);tip.y=to.y;tips.push(tip);
   tube(V().copy(ft).setY(ft.y-0.0005),tip,R[2]*0.75,R[2]*0.38,cLeg,cToe,()=>[bF,1,bF],3,6);}
  /* the web: a fan between the toes, its free edge curved back between the tips, a hair above the ground */
  const wb=pos.length/3;const M=6,root=V().copy(ft).setY(to.y+0.0012);
  for(let k=0;k<2;k++){for(let i=0;i<=M;i++){const t=i/M,a=V().lerpVectors(tips[k],tips[k+1],t);const notch=Math.sin(Math.PI*t)*0.32;a.lerp(root,notch);a.y=to.y+0.0008+0.0012*Math.sin(Math.PI*t);
    pos.push(a.x,a.y,a.z);col.push(...cWeb);si.push(bF,0,0,0);sw.push(1,0,0,0);}}
  const rc=pos.length/3;pos.push(root.x,root.y,root.z);col.push(...cWeb);si.push(bF,0,0,0);sw.push(1,0,0,0);
  for(let k=0;k<2;k++)for(let i=0;i<M;i++){const a=wb+k*(M+1)+i;idx.push(rc,a,a+1);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
 g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(sw,4));g.setIndex(idx);g.computeVertexNormals();return g;}
/* (small birds) A duckling's wing (wing.style 'stub'): a short, thick, downy paddle, as a duckling's wing is before its
   flight feathers grow: rounded at the tip, arched over its middle, its leading edge rolled under, drawn as an upper and an
   under surface (each its own face) on the same three bones as the feathered wing, so the same clips beat and fold it.
   Its texture (paintStubWing) is down: olive above with the mallard duckling's pale yellow patch on the trailing edge,
   pale yellow below, every edge a fringe of soft filaments (an alpha cutout). WG: {length, chord (share of the length),
   colors:{gold (the olive), buff, pale (the patch), under, rim}} */
function buildStubWing(THREE,WG,J,wLen,WJ,BI){
 const e1=WJ.elbow,e2=WJ.wrist,bl=0.08;
 const wts=u=>{const w1=1-sstep(e1-bl,e1+bl,u),w3=sstep(e2-bl,e2+bl,u);return [w1,Math.max(0,1-w1-w3),w3];};
 const pos=[],uv=[],col=[],si=[],sw=[],idx=[];const ch=+WG.chord||0.62,NT=10,SS=[-1,-0.75,-0.45,-0.15,0.15,0.45,0.75,1];
 for(const side of [1,-1]){const sh=side>0?J.wingL:J.wingR,b1=BI[side>0?'wingL':'wingR'],b2=BI[side>0?'wing2L':'wing2R'],b3=BI[side>0?'wing3L':'wing3R'];
  const P=(u,w,y)=>[sh.x+side*u*wLen,sh.y+y*wLen,sh.z-w*wLen];
  const tri=(a,b,c,under)=>{const A=3*a,B=3*b,C=3*c,ux=pos[B]-pos[A],uy=pos[B+1]-pos[A+1],uz=pos[B+2]-pos[A+2],vx=pos[C]-pos[A],vy=pos[C+1]-pos[A+1],vz=pos[C+2]-pos[A+2];
   const ny=uz*vx-ux*vz;if((ny>0)===!under)idx.push(a,b,c);else idx.push(a,c,b);};
  for(const under of [0,1]){const base=pos.length/3;
   for(let i=0;i<=NT;i++){const t=i/NT;
    /* the outline: the chord narrows a little to the wrist and rounds off over the last third (the hand) */
    const tip=t>0.62?Math.sqrt(Math.max(0.02,1-Math.pow((t-0.62)/0.4,2))):1,c=ch*(1-0.25*t)*tip,lead=-0.12+0.1*t*t+(1-tip)*c*0.35;
    for(const s of SS){const k=(s+1)/2,w=lead+c*k;
     /* arched: highest a third of the way back, the leading edge rolled down, the tip drooping; the under surface a hair below */
     const arch=0.09*c*Math.sin(Math.PI*Math.min(1,k*1.3))*(1-0.5*t)-0.05*Math.pow(1-k,3)*(1-t*0.5),y=arch-0.06*t*t-(under?0.012*(1-Math.abs(s))*(1-t):0);
     pos.push(...P(t,w,y));uv.push((under?0.52:0.02)+0.46*t,0.04+0.92*k);col.push(1,1,1);
     const ww=wts(t);si.push(b1,b2,b3,0);sw.push(ww[0],ww[1],ww[2],0);}}
   const n=SS.length;for(let i=0;i<NT;i++)for(let j=0;j<n-1;j++){const A=base+i*n+j,B=A+1,C=A+n,D=C+1;tri(A,C,B,under);tri(B,C,D,under);}}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(sw,4));
 g.setIndex(idx);g.computeVertexNormals();return g;}
let STUBTEX=null;
function paintStubWing(THREE,WG){
 if(typeof document==='undefined')return null;
 const WK=JSON.stringify([WG.colors||null,WG.chord||null]);if(STUBTEX&&STUBTEX.T===THREE&&STUBTEX.k===WK)return STUBTEX.tex;
 const hex=(h,d)=>{const m=/^#?([0-9a-f]{6})$/i.exec(String(h||''))||/^#?([0-9a-f]{6})$/i.exec(d),v=parseInt(m[1],16);return [(v>>16&255)/255,(v>>8&255)/255,(v&255)/255];};
 const CO=WG.colors||{},OL=hex(CO.gold,'#5d4d22'),OB=hex(CO.buff,'#6f5c2a'),PA=hex(CO.pale,'#e2c04e'),UN=hex(CO.under,'#f1d266'),RM=hex(CO.rim,'#3a2f16');
 const W=512,H=256,cv=document.createElement('canvas');cv.width=W;cv.height=H;const ctx=cv.getContext('2d'),ID=ctx.createImageData(W,H),px=ID.data;
 const h2=(x,y)=>{const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);};
 const vnz=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);return lerp(lerp(h2(xi,yi),h2(xi+1,yi),u),lerp(h2(xi,yi+1),h2(xi+1,yi+1),u),v);};
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const under=x>=W/2,lx=(x%(W/2))/(W/2),t=clamp((lx-0.04)/0.92,0,1),k=y/(H-1),kk=clamp((k-0.04)/0.92,0,1);
  /* down: fine filaments running back along the chord (streaks across t), soft clumps, a fringe of filaments at every edge */
  const fil=vnz(t*90,kk*7)*0.6+vnz(t*190,kk*15)*0.4,clump=vnz(t*12,kk*5);
  const edge=Math.min(kk,1-kk,(1-t)*1.6,t*6+0.4),fr=0.05+0.06*vnz(t*70,kk*30)+0.04*fil;let a=sstep(fr-0.03,fr+0.01,edge);
  let c;if(!under){c=[lerp(OL[0],OB[0],clump),lerp(OL[1],OB[1],clump),lerp(OL[2],OB[2],clump)];
   /* the pale patch on the trailing edge of the arm (a mallard duckling's yellow wing spot), soft-edged */
   const pt=sstep(0.55,0.75,kk)*(1-sstep(0.45,0.7,t))*sstep(0.05,0.2,t);for(let q=0;q<3;q++)c[q]=lerp(c[q],PA[q],pt*(0.75+0.25*fil));
   const lead=1-sstep(0.0,0.18,kk);for(let q=0;q<3;q++)c[q]=lerp(c[q],RM[q],lead*0.5);}
  else{c=UN.slice();const sh=0.82+0.18*clump;for(let q=0;q<3;q++)c[q]*=sh;}
  const b=0.78+0.32*fil;const i=4*(y*W+x);px[i]=Math.round(clamp(c[0]*b,0,1)*255);px[i+1]=Math.round(clamp(c[1]*b,0,1)*255);px[i+2]=Math.round(clamp(c[2]*b,0,1)*255);px[i+3]=Math.round(a*255);}
 ctx.putImageData(ID,0,0);const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;tex.name='stub-wing-down';
 STUBTEX={T:THREE,tex,k:WK};return tex;}
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
 const WK=JSON.stringify([WG.colors||null,WG.patch,WG.texScale||null]);
 if(WINGTEX&&WINGTEX.T===THREE&&WINGTEX.img===img&&WINGTEX.k===WK)return WINGTEX.tex;
 const hex=(h,d)=>{const m=/^#?([0-9a-f]{6})$/i.exec(String(h||''))||/^#?([0-9a-f]{6})$/i.exec(d),v=parseInt(m[1],16);return [(v>>16&255)/255,(v>>8&255)/255,(v&255)/255];};   // (plain sRGB, the canvas's own)
 const CO=WG.colors||{},PL={gold:hex(CO.gold,'#cf9a58'),buff:hex(CO.buff,'#d3a86c'),grey:hex(CO.grey,'#b3ada3'),bar:hex(CO.bar,'#4f443c'),pale:hex(CO.pale,'#e6e0d6'),
  shaft:hex(CO.shaft,'#e8dcc4'),under:hex(CO.under,'#f1ebe0'),spot:hex(CO.spot,'#fbf8f1'),rim:hex(CO.rim,'#1c1614')};
 const mix=(a,b,k)=>[lerp(a[0],b[0],k),lerp(a[1],b[1],k),lerp(a[2],b[2],k)],mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
 /* the scan's covert patch */
 let patch=null;
 if(img&&img.width&&WG.patch!==false){try{const r=WG.patch||[845,600,110,115],c2=document.createElement('canvas');c2.width=r[2];c2.height=r[3];const x2=c2.getContext('2d');x2.drawImage(img,r[0],r[1],r[2],r[3],0,0,r[2],r[3]);
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
 WINGTEX={T:THREE,img,tex,k:WK};return tex;}
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
  /* (small birds) the repaint: the target colour under the texture's own detail (each texel's brightness against its neighbourhood's) */
  if(m.userData&&m.userData.birdTint){sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 birdTint;\nattribute float birdTintK;\nattribute float birdTintD;\nvarying vec4 vBirdTint;\nvarying float vBirdTintK;\nvarying float vBirdTintD;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBirdTint=birdTint;vBirdTintK=birdTintK;vBirdTintD=birdTintD;');
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec4 vBirdTint;\nvarying float vBirdTintK;\nvarying float vBirdTintD;').replace('#include <map_fragment>','#include <map_fragment>\n{float bL=dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722));float bD=clamp(bL/max(vBirdTint.w,0.004),0.3,1.8);diffuseColor.rgb=mix(diffuseColor.rgb,vBirdTint.rgb*pow(bD,0.85*vBirdTintD),clamp(vBirdTintK,0.0,1.0));}');}
  /* (small birds) down: a soft light at the silhouette, as fine down catches it */
  const dn=(+(m.userData&&m.userData.down)||0).toFixed(3);
  sh.fragmentShader=sh.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n{vec3 oN=inverseTransformDirection(normal,viewMatrix);totalEmissiveRadiance+=diffuseColor.rgb*'+sky+'*clamp(-oN.y,0.0,1.0);'+(+dn>0?'float oF=1.0-abs(dot(normal,normalize(vViewPosition)));totalEmissiveRadiance+=diffuseColor.rgb*'+dn+'*oF*oF;':'')+'}');};
 class OwlBodyMaterial extends THREE.MeshStandardMaterial{constructor(p){super(p);this.onBeforeCompile=sh=>hook(sh,this);this.customProgramCacheKey=()=>'owlBody5|'+(this.userData&&this.userData.owlLift?1:0)+'|'+(this.userData&&this.userData.owlUnder)+'|'+(this.userData&&this.userData.birdTint?1:0)+'|'+(this.userData&&this.userData.down||0);}}
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
   are identity, so these compose simply), a scale for the wing roots (folded away) and the root's offset. The root
   is never turned: its entry is its offset only (it was once read as a rotation too, which rolled a hopping or
   waddling bird a little further each step and snapped it back at the loop). */
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
 const FOLDS=+(O.wing&&O.wing.foldScale)||0.02,FL0=O.fly||{},WSC=+(O.wing&&O.wing.flyScale)||1;   // (small birds: flyScale, the open wing a little larger in the air than the folded one, as down fluffs out)
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
   p['wing'+s]=[(pitchComp||0)+(twist||0),sg*(sweep||0),sg*stroke];p['wing2'+s]=[0,-sg*0.5*handFold,-sg*0.25*handFold];p['wing3'+s]=[0,sg*0.9*handFold,-sg*0.5*handFold];}p.wingScale=[WSC,WSC];}
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
  look(p,lerp(k0[1],k1[1],f)*LK,-0.05,lerp(k0[2],k1[2],f));p.tail1[0]=0.03*Math.sin(TAU*u*2);return p;};
 const LK=O.idle&&O.idle.look!=null?+O.idle.look:1;   // (a duckling turns its head far less than an owl)
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
  const sc=u<0.045?lerp(0.3,0.62,sstep(0,0.045,u)):lerp(0.62,WSC,sstep(0.045,0.12,u));p.wingScale=[sc,sc];
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
  if(f1>0){const t=base();tuck(t,-pch);for(const n of WINGB)p[n]=[lerp(p[n][0],t[n][0],f1),lerp(p[n][1],t[n][1],f1),lerp(p[n][2],t[n][2],f1)];p.wingScale=[WSC,WSC];}
  if(f2>0){const sp=standP();sp.wingScale=[WSC,WSC];mixP(p,sp,f2);}
  if(f1>0){const sc=u<0.82?lerp(WSC,0.62,f1):lerp(0.62,FOLDS,f2);p.wingScale=[sc,sc];}
  return p;};
 /* bake: quaternion tracks for every bone, scale for the wing roots and the tail's root, position for the root */
 const bake=(name,T,n,poseAt)=>{const times=new Float32Array(n+1);const qv={},sv={L:new Float32Array((n+1)*3),R:new Float32Array((n+1)*3)},ts=new Float32Array((n+1)*3),rp=new Float32Array((n+1)*3);for(const nm of names)qv[nm]=new Float32Array((n+1)*4);
  const q=Q();
  for(let i=0;i<=n;i++){const u=i/n;times[i]=u*T;const pz=poseAt(u%1===0&&i===n?1:u);
   for(const nm of names){const e=pz[nm]||[0,0,0];if(nm==='root')q.identity();else if(e.q)q.fromArray(e.q);else q.setFromEuler(E(e[0],e[1],e[2],e[3]||(nm.startsWith('wing')?'XZY':'YXZ')));q.toArray(qv[nm],4*i);}   // (small birds: a pose may give a bone its own Euler order, or a quaternion)
   sv.L.fill(pz.wingScale[0],3*i,3*i+3);sv.R.fill(pz.wingScale[1],3*i,3*i+3);ts.set(pz.tailScale||[1,1,1],3*i);
   rp[3*i]=J.root.x+pz.root[0];rp[3*i+1]=J.root.y+pz.root[1];rp[3*i+2]=J.root.z+pz.root[2];}
  const tracks=names.map(nm=>new THREE.QuaternionKeyframeTrack('ab_'+nm+'.quaternion',times,qv[nm]));
  tracks.push(new THREE.VectorKeyframeTrack('ab_wingL.scale',times,sv.L),new THREE.VectorKeyframeTrack('ab_wingR.scale',times,sv.R),new THREE.VectorKeyframeTrack('ab_tail1.scale',times,ts),new THREE.VectorKeyframeTrack('ab_root.position',times,rp));
  return new THREE.AnimationClip(name,T,tracks);};
 /* (small birds) the waddle: one foot planted while the other swings forward low, the body rolling over the planted foot and
    swaying, the head steadied against the roll; each planted foot holds its spot as the body passes over it (the root moves
    one stride, which the library measures). Each foot is put on the ground in three dimensions (leg3 below): the target is
    a point on the ground of the bird's own unturned frame, carried into the rolled, yawed and pitched body, the leg swung
    out to it at the hip and bent in its own plane, and the foot turned back flat and pointing ahead, so the body's roll and
    sway never move a planted foot or twist its toes. Each foot is down half the cycle; the stride is centred under the hip
    (so the leg never runs out of reach), the swing lifts the foot level, its toes folding down a little, never as far as the height
    under them allows, and it reaches forward only once it is off the grass.
    W: {T, stride, roll, yaw, lift, bob, crouch, lean}; run (the same, quicker and lower, for 'bird.run') */
 const qE=(e,o)=>Q().setFromEuler(E(e[0],e[1],e[2],o||'YXZ'));
 const toeL=Math.max(1e-4,Math.hypot(J.toeL.z-J.footL.z,J.toeL.y-J.footL.y));
 /* the hip's point in the bird's frame, for a body turned by qB and the root moved by ro */
 const hipAt=(s,qB,ro)=>J['thigh'+s].clone().sub(J.body).applyQuaternion(qB).add(J.body).add(new THREE.Vector3(ro[0],ro[1],ro[2]));
 const leg3=(p,s,qB,ro,T,footQ)=>{const H=hipAt(s,qB,ro),d=T.clone().sub(H).applyQuaternion(qB.clone().invert());
  const r0x=J['foot'+s].x-J['thigh'+s].x,ex=d.x-r0x,phi=Math.atan2(ex,-d.y),fy=-Math.hypot(ex,d.y);
  const a=ik(fy,d.z);p['thigh'+s]=[a[0],0,phi,'ZXY'];p['shank'+s]=[a[1],0,0];
  /* the foot: flat (or as footQ has it) in the bird's frame, whatever the leg and the body above it are doing */
  const qc=qB.clone().multiply(qE(p['thigh'+s],'ZXY')).multiply(qE(p['shank'+s]));p['foot'+s]={q:qc.invert().multiply(footQ||Q()).toArray()};};
 const gaitOf=(W,d)=>({S:+W.stride||d.S,T:+W.T||d.T,roll:W.roll!=null?+W.roll:d.roll,yaw:W.yaw!=null?+W.yaw:d.yaw,lift:+W.lift||d.lift,bob:W.bob!=null?+W.bob:d.bob,crouch:W.crouch!=null?+W.crouch:d.crouch,lean:W.lean!=null?+W.lean:d.lean});
 const WD=O.waddle||{},WK=gaitOf(WD,{S:0.05,T:0.32,roll:0.12,yaw:0.06,lift:0.005,bob:0.0015,crouch:0.0015,lean:0});
 const WR=gaitOf(O.run||{},{S:WK.S*1.5,T:WK.T*0.62,roll:WK.roll*0.45,yaw:WK.yaw*0.5,lift:WK.lift*1.2,bob:WK.bob*0.8,crouch:WK.crouch*2,lean:0.16});
 const cz=J.thighL.z-J.footL.z;   // (the stride centred under the hip)
 const gaitAt=(G,u)=>{const p=base();fold(p,1);const bob=G.bob*Math.cos(4*Math.PI*u)*-1-G.crouch;const ro=[0,bob,G.S*u];p.root=ro;
  const roll=G.roll*Math.sin(TAU*u),yaw=G.yaw*Math.sin(TAU*u-0.6);p.body=[G.lean+0.03*Math.sin(4*Math.PI*u),yaw,-roll];
  p.neck1[2]=roll*0.45;p.head[2]=roll*0.35;p.neck1[1]=-yaw*0.5;p.head[1]=-yaw*0.3;p.neck2[0]=0.07*Math.sin(4*Math.PI*u+0.8)-G.lean*0.6;p.head[0]=-G.lean*0.35;p.tail1[1]=-yaw*1.2;
  const qB=qE(p.body);
  for(const [s,o] of [['L',0],['R',0.5]]){const v=(u+o)%1,t=v<0.5?0:(v-0.5)/0.5;
   /* stance: the foot fixed on the ground (the root carries the body over it); swing: up level at once, forward once it is up */
   const dz=v<0.5?G.S*(0.25-v):G.S*(0.25+sstep(0.12,0.88,t)-v),dy=v<0.5?0:G.lift*Math.pow(Math.sin(Math.PI*t),0.8);
   const T=new THREE.Vector3(J['foot'+s].x,J['foot'+s].y+dy,J['foot'+s].z+cz+G.S*u+dz);
   const droop=Math.asin(clamp(0.3*dy/toeL,0,0.3));leg3(p,s,qB,ro,T,droop>0?qOf(droop,0,0):null);}
  return p;};
 const out=[bake('bird.idle',12,240,idleAt),bake('bird.hop',hopT,24,hopAt),bake('bird.fly',1/(+FL.hz||3.2),24,flyAt),bake('bird.glide',2,24,glideAt),bake('bird.takeoff',0.7,42,takeoffAt),bake('bird.land',0.6,36,landAt)];
 if(O.walk==='waddle'){out.push(bake('bird.waddle',WK.T,32,u=>gaitAt(WK,u)));if(O.run!==false)out.push(bake('bird.run',WR.T,24,u=>gaitAt(WR,u)));}
 /* the hop moves its root one stride, which the library measures and strips; the other clips stay put */
 return out;}
