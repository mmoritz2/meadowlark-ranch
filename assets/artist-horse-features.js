// Authored rig fantasy features. All skin indices resolve by joint name.
const DRAGON_TINT={
 ice:   {web:'#8fe4ff',root:'#1d4f6e',bone:'#183848',glow:'#bff0ff',head:'#3f86ad',ridge:'#cdeeff'},
 fire:  {web:'#ff8a3a',root:'#5e1a06',bone:'#2a0e05',glow:'#ffb04a',head:'#8e2a08',ridge:'#ffd24a'},
 galaxy:{web:'#a678ff',root:'#241a52',bone:'#1a1230',glow:'#c6a8ff',head:'#3a2a72',ridge:'#c6a8ff'},
 shadow:{web:'#6a4ad0',root:'#140e26',bone:'#0e0a18',glow:'#8a5ae0',head:'#241a3e',ridge:'#8a5ae0'},
 aurora:{web:'#4fd8b0',root:'#0e3a2e',bone:'#0c2a22',glow:'#9cffd8',head:'#1f7a62',ridge:'#9cffd8'},
 _:     {web:'#9fb4d8',root:'#2b3546',bone:'#222836',glow:'#cfe0ff',head:'#5a6478',ridge:'#cfe0ff'},
};
export function buildArtistDragonBody({THREE,skin,bones,mount,theme,coat}){
 /* ONE mesh, built along ONE curve.

    The old dragon was a collection: a crest strip, a separate row of spine cones, a back
    web, a tail tube, a spade, and fifteen more cones scattered over the head. Every piece
    was positioned near the horse but joined to nothing, so the whole thing read as bits
    floating around an animal rather than as an animal. This builds a single centreline
    from the poll to the tip of the tail, measured off the mesh and the tail bones, and
    then hangs everything off that one line: the tail is a tube on it, the ridge is one
    unbroken membrane along it, and the spikes are the membrane's own upper edge rather
    than cones sitting near it. Nothing is placed by eye and nothing floats. */
 const th=theme||DRAGON_TINT[coat]||DRAGON_TINT._;
 const named=Object.fromEntries(bones.map((b,i)=>[b.name.replace(/[.\s]/g,''),i]));
 const RIG_TAIL=['tail1','tail2','tail3','tail4'].map(name=>named[name]).filter(Number.isInteger);
 const bpos=bones.map(b=>{const v=new THREE.Vector3(); b.getWorldPosition(v); mount.worldToLocal(v); return v;});
 const toSkin=v=>{const w=mount.localToWorld(v.clone()); return skin.worldToLocal(w);};
 const P=[],C=[],SI=[],SW=[],I=[];
 const cBone=new THREE.Color(th.bone), cWeb=new THREE.Color(th.web);
 const cGlow=new THREE.Color(th.glow), cSpike=new THREE.Color(th.ridge||th.web);
 const V=(x,y,z)=>new THREE.Vector3(x,y,z);
 const NECK=['necklower','neckupper','head'].map(name=>named[name]), SPINE=['pelvis','spine','chest','necklower'].map(name=>named[name]), TAILB=RIG_TAIL;
 const near=(v,cands)=>{let bi=cands[0],bd=1e9; for(const i of cands){const b=bpos[i]; if(!b)continue;
  const d=b.distanceToSquared(v); if(d<bd){bd=d;bi=i;}} return bi;};
 const vert=(v,col,cands)=>{const b=near(v,cands),vs=toSkin(v);
  P.push(vs.x,vs.y,vs.z); C.push(col.r,col.g,col.b); SI.push(b,0,0,0); SW.push(1,0,0,0); return P.length/3-1;};
 const tri=(a,b,c)=>{I.push(a,b,c);};

 // ---- measure the animal: the top of the back, straight down the middle ----------------
 const sp=skin.geometry.attributes.position, _v=new THREE.Vector3(), tops=[];
 for(let k=0;k<sp.count;k++){ _v.fromBufferAttribute(sp,k); skin.localToWorld(_v); mount.worldToLocal(_v);
  if(Math.abs(_v.x)<0.18)tops.push([_v.y,_v.z]); }
 const topAt=z=>{let b=null; for(const q of tops)if(Math.abs(q[1]-z)<0.05&&(b===null||q[0]>b))b=q[0]; return b;};

 // ---- the one centreline: poll -> croup measured off the back, then out along the tail --
 const dock=bpos[RIG_TAIL[0]]||V(0,1.5,-0.95);
 const line=[];
 {
  let lastY=1.70;
  const zA=bpos[named.head].z, zB=dock.z, N=20;
  for(let k=0;k<=N;k++){ const t=k/N, z=zA+(zB-zA)*t;
   const y=topAt(z); if(y!==null)lastY=y;
   line.push({p:V(0,lastY-0.008,z), cands:(t<0.45?NECK:SPINE), tube:0});
  }
  const tb=RIG_TAIL.map(i=>bpos[i]).filter(Boolean);
  if(tb.length>=2){
   const last=tb[tb.length-1], prev=tb[tb.length-2];
   const all=tb.concat([last.clone().add(last.clone().sub(prev).multiplyScalar(1.10))]);
   all.forEach((q,j)=>{ line.push({p:q.clone(),cands:TAILB,tube:0.078*(1-j/all.length*0.78)+0.011}); });
  }
 }
 const N1=line.length-1;
 /* A frame at every station. dir is along the line; side is across it; up is the fin's own
    direction. The guard matters: over the back dir is horizontal and up comes out vertical,
    but a tail hangs straight DOWN, and there cross(dir, worldUp) collapses — which is the
    bug that used to throw the tail fin across the paddock. */
 for(let k=0;k<=N1;k++){
  const a=line[Math.max(0,k-1)].p, b=line[Math.min(N1,k+1)].p;
  const dir=b.clone().sub(a); if(dir.lengthSq()<1e-8)dir.set(0,0,-1); dir.normalize();
  const ref=Math.abs(dir.y)>0.88?V(0,0,1):V(0,1,0);
  const side=new THREE.Vector3().crossVectors(dir,ref).normalize();
  const up=new THREE.Vector3().crossVectors(side,dir).normalize();
  if(up.y<0&&Math.abs(dir.y)<=0.88)up.negate();
  line[k].dir=dir; line[k].side=side; line[k].up=up;
 }

 // ---- the tail: a tapering tube on the same line, ring welded to ring ------------------
 const SIDES=7;
 let prevRing=null;
 for(let k=0;k<=N1;k++){
  const L=line[k]; if(!L.tube)continue;
  const ring=[], col=cBone.clone().lerp(cGlow,0.18+0.5*(k/N1));
  for(let j=0;j<SIDES;j++){ const a=j/SIDES*Math.PI*2;
   ring.push(vert(L.p.clone().addScaledVector(L.side,Math.cos(a)*L.tube).addScaledVector(L.up,Math.sin(a)*L.tube),col,L.cands)); }
  if(prevRing)for(let j=0;j<SIDES;j++){const j2=(j+1)%SIDES;
   tri(prevRing[j],ring[j],prevRing[j2]); tri(ring[j],ring[j2],prevRing[j2]); }
  prevRing=ring;
 }

 /* ---- the ridge: one unbroken membrane from the poll to the tip of the tail ------------
    Its upper edge is a sawtooth, so the spikes ARE the membrane and cannot come adrift
    from it. Height follows the animal: a tall crest on the neck, lower over the saddle so
    it does not foul the rider, and rising again into a fin at the end of the tail. */
 const hAt=k=>{
  const t=k/N1;
  let h;
  if(t<0.30)      h=0.085+0.135*Math.sin(Math.PI*(t/0.30));      // the neck crest
  else if(t<0.46) h=0.060;                                        // low across the saddle
  else if(t<0.62) h=0.070+0.070*((t-0.46)/0.16);                  // rising off the croup
  else            h=0.085+0.150*Math.pow(Math.sin(Math.PI*Math.min(1,(t-0.62)/0.38)),1.5); // the tail fin
  return h;
 };
 let pb=null,pt=null;
 for(let k=0;k<=N1;k++){
  const L=line[k];
  const root=L.tube?L.p.clone().addScaledVector(L.up,L.tube*0.92):L.p.clone();
  const spike=(k%2===0);
  const h=hAt(k)*(spike?1.0:0.44);
  const tipP=root.clone().addScaledVector(L.up,h).addScaledVector(L.dir,-h*0.34);  // leaning back
  const b=vert(root,cBone,L.cands);
  const t2=vert(tipP,spike?cSpike:cWeb,L.cands);
  if(pb!==null){ tri(pb,b,pt); tri(b,t2,pt); }
  pb=b; pt=t2;
 }

 /* ---- horns: the only thing on the head, and they grow out of the ridge's first station
    rather than being parked near the skull. Two, swept back along the neck. */
 {
  const L=line[0];
  for(const sg of[-1,1]){
   const base=L.p.clone().addScaledVector(L.side,sg*0.052).addScaledVector(L.dir,0.02);
   const dirH=L.up.clone().multiplyScalar(0.82).addScaledVector(L.dir,-0.62).addScaledVector(L.side,sg*0.34).normalize();
   const s1=new THREE.Vector3().crossVectors(dirH,L.side).normalize();
   const s2=new THREE.Vector3().crossVectors(dirH,s1).normalize();
   const tipH=vert(base.clone().addScaledVector(dirH,0.34),cSpike,NECK), ring=[];
   for(let j=0;j<5;j++){ const a=j/5*Math.PI*2;
    ring.push(vert(base.clone().addScaledVector(s1,Math.cos(a)*0.034).addScaledVector(s2,Math.sin(a)*0.034),cBone,NECK)); }
   for(let j=0;j<5;j++)tri(ring[j],ring[(j+1)%5],tipH);
  }
 }

 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
 g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));
 g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(SI,4));
 g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(SW,4));
 g.setIndex(I); g.computeVertexNormals();
 const m=new THREE.SkinnedMesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.42,
  metalness:0.18,side:THREE.DoubleSide,flatShading:true,emissive:new THREE.Color(th.glow),emissiveIntensity:0.10}));
 m.name='ArtistDragonCrest';m.castShadow=true; m.frustumCulled=false;
 m.position.copy(skin.position); m.quaternion.copy(skin.quaternion); m.scale.copy(skin.scale);
 skin.parent.add(m); m.bind(skin.skeleton,skin.bindMatrix);
 return m;
}
