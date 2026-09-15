/* ===== Horse style renderer ==================================================================
   Everything a mastery ladder pays out in looks, on any rigged horse in the game — the mount,
   the pasture herd, a club mate's horse:

     hair(rig,mount,look)   mane/tail LENGTH styling and the fantasy hair effects. One vertex
                            shader injection on the groom materials: every hair vertex learns
                            where its root sits on the bone it is skinned to, and a length
                            factor pulls the strand toward that root (0.35 = roached, 1.25 =
                            flowing). A fragment injection paints the strand from root to tip
                            for the icicle / lava / rainbow manes.
     decor(rig,mount,look)  braids, bands and ribbons: small meshes hung on the neck and dock
                            bones, so they ride the animation for free.
     accessory(def,rig,mount) fly masks, leg wraps, tail bows, quarter sheets, collars, brow
                            charms — likewise hung on bones from the breed's own anchors.
     horn(mesh,on)          the rainbow horn.

   Pure module: THREE is injected, nothing is read from the game at import time, and every
   builder returns a handle with dispose(). The work is per rig, once; per frame it is one
   uniform write. */
export function createHorseStyle({THREE}){
 const _v=new THREE.Vector3(),_w=new THREE.Vector3(),_m=new THREE.Matrix4(),_m2=new THREE.Matrix4();
 const clean=n=>String(n||'').replace(/[.\s_]/g,'').toLowerCase();
 const PART_OF=n=>{n=clean(n);if(/^tail|dock/.test(n))return 2;if(/^neck|^head|^jaw|^ear|poll|crest|skull|forelock/.test(n))return 1;return 0;};
 const FX={
  ice:    {a:'#9fe0ff',b:'#f6ffff',glow:.75,mode:1},
  fire:   {a:'#ff3c0a',b:'#ffd257',glow:1.0,mode:2},
  shadow: {a:'#241238',b:'#b48cff',glow:.65,mode:1},
  galaxy: {a:'#3c2296',b:'#e0ccff',glow:.8,mode:1},
  aurora: {a:'#158a68',b:'#b8ffe8',glow:.75,mode:1},
  corona: {a:'#ff8a1a',b:'#fff3b8',glow:.9,mode:2},
  cloud:  {a:'#dfeeff',b:'#ffffff',glow:.5,mode:1},
  sheen:  {a:'#b9c2cc',b:'#ffffff',glow:.55,mode:1},
  rainbow:{a:'#ff4040',b:'#4040ff',glow:.6,mode:3},
 };
 const uniformSets=new Set();   // every live shader's uniforms, for the per-frame time write

 /* ---- per-vertex root data ---------------------------------------------------------- */
 function bindPos(skel,i,bindInv,out){ _m.copy(skel.boneInverses[i]).invert(); out.set(0,0,0).applyMatrix4(_m).applyMatrix4(bindInv); return out; }
 function childOf(skel,i){const b=skel.bones[i];for(const c of b.children){if(c.isBone){const j=skel.bones.indexOf(c);if(j>=0)return j;}}return -1;}
 function prepareGeometry(mesh,role){
  const g=mesh.geometry; if(!g||!g.attributes.skinIndex||g.userData.hairStyled)return !!g?.userData.hairStyled;
  const skel=mesh.skeleton, si=g.attributes.skinIndex, sw=g.attributes.skinWeight, pos=g.attributes.position, n=pos.count;
  const bindInv=new THREE.Matrix4().copy(mesh.bindMatrix).invert();
  const nb=skel.bones.length, P=[],D=[],L=[],PART=[];
  for(let i=0;i<nb;i++){ const p=bindPos(skel,i,bindInv,new THREE.Vector3()); P.push(p); PART.push(PART_OF(skel.bones[i].name)); }
  for(let i=0;i<nb;i++){ const c=childOf(skel,i); let d;
   if(c>=0)d=P[c].clone().sub(P[i]); else { const par=skel.bones[i].parent, j=par&&par.isBone?skel.bones.indexOf(par):-1; d=j>=0?P[i].clone().sub(P[j]):new THREE.Vector3(0,1,0); }
   const len=d.length(); L.push(c>=0?len:0); D.push(len>1e-6?d.multiplyScalar(1/len):new THREE.Vector3(0,1,0)); }
  const root=new Float32Array(n*3), rootR=new Float32Array(n), span=new Float32Array(n), part=new Float32Array(n), dist=new Float32Array(n), grp=new Int32Array(n);
  const groups=new Map();
  /* the dock: the first tail bone (its parent is not a tail bone). Tail hair hangs from there,
     so a shorter tail contracts toward that one point rather than toward the dock's axis —
     otherwise a banged tail only gets thinner */
  let dock=-1; for(let i=0;i<nb;i++){ if(PART[i]===2){const par=skel.bones[i].parent; const j=par&&par.isBone?skel.bones.indexOf(par):-1; if(j<0||PART[j]!==2){dock=i;break;}} }
  for(let v=0;v<n;v++){
   let bi=si.getX(v),bw=sw.getX(v); const iy=si.getY(v),wy=sw.getY(v); if(wy>bw){bw=wy;bi=iy;} const iz=si.getZ(v),wz=sw.getZ(v); if(wz>bw){bw=wz;bi=iz;} const iw=si.getW(v),ww=sw.getW(v); if(ww>bw){bw=ww;bi=iw;}
   _v.fromBufferAttribute(pos,v);
   const pt=role==='mane'?1:role==='tail'?2:PART[bi];
   if(pt===2&&dock>=0){ _w.copy(P[dock]); }
   else { const p=P[bi],d=D[bi]; const t=Math.max(0,Math.min(L[bi],_w.copy(_v).sub(p).dot(d))); _w.copy(p).addScaledVector(d,t); }
   root[v*3]=_w.x;root[v*3+1]=_w.y;root[v*3+2]=_w.z;
   dist[v]=_v.distanceTo(_w);
   part[v]=pt;
   grp[v]=bi; (groups.get(bi)||groups.set(bi,[]).get(bi)).push(dist[v]);
  }
  const stat=new Map();
  for(const [bi,arr] of groups){ arr.sort((a,b)=>a-b); const lo=arr[Math.floor(arr.length*0.08)], hi=arr[Math.floor(arr.length*0.96)]; stat.set(bi,[lo,Math.max(1e-3,hi-lo)]); }
  for(let v=0;v<n;v++){ const s=stat.get(grp[v]); rootR[v]=s[0]; span[v]=s[1]; }
  g.setAttribute('hairRoot',new THREE.BufferAttribute(root,3));
  g.setAttribute('hairRootR',new THREE.BufferAttribute(rootR,1));
  g.setAttribute('hairSpan',new THREE.BufferAttribute(span,1));
  g.setAttribute('hairPart',new THREE.BufferAttribute(part,1));
  g.userData.hairStyled=true;
  return true;
 }

 /* ---- the shader ---------------------------------------------------------------------- */
 const VS_DECL='attribute vec3 hairRoot;attribute float hairRootR;attribute float hairSpan;attribute float hairPart;uniform float uManeLen;uniform float uTailLen;varying float vHairTip;varying float vHairPart;\n';
 const VS_BODY=`#include <skinning_vertex>
#ifdef USE_SKINNING
{ vec4 hrv=bindMatrix*vec4(hairRoot,1.0);
  vec4 hrs=boneMatX*hrv*skinWeight.x+boneMatY*hrv*skinWeight.y+boneMatZ*hrv*skinWeight.z+boneMatW*hrv*skinWeight.w;
  vec3 axisP=(bindMatrixInverse*hrs).xyz;
  vec3 rad=transformed-axisP; float r=length(rad);
  float L=hairPart>1.5?uTailLen:(hairPart>0.5?uManeLen:1.0);
  vHairTip=hairPart>0.5?clamp((r-hairRootR)/hairSpan,0.0,1.0):0.0; vHairPart=hairPart;
  if(r>1e-5&&hairPart>0.5&&abs(L-1.0)>1e-4){ float nr=max(0.0,hairRootR+(r-hairRootR)*L); transformed=axisP+rad*(nr/r); }
}
#else
 vHairTip=0.0; vHairPart=hairPart;
#endif`;
 const FS_DECL='uniform float uFxOn;uniform float uFxMode;uniform float uFxMask;uniform float uFxGlow;uniform float uFxTime;uniform vec3 uFxA;uniform vec3 uFxB;varying float vHairTip;varying float vHairPart;\nvec3 hsHue(float h){vec3 p=abs(fract(vec3(h)+vec3(0.0,2.0/3.0,1.0/3.0))*6.0-3.0);return clamp(p-1.0,0.0,1.0);}\n';
 const FS_BODY=`#include <emissivemap_fragment>
{ float m=(uFxMask>2.5)?1.0:((uFxMask>1.5)?(vHairPart>1.5?1.0:0.0):(vHairPart>0.5&&vHairPart<1.5?1.0:0.0));
  float on=uFxOn*m*step(0.5,vHairPart);
  if(on>0.0){
   vec3 fx=mix(uFxA,uFxB,vHairTip); float g=uFxGlow;
   if(uFxMode>2.5){ fx=hsHue(fract(vHairTip*1.4+uFxTime*0.07)); }
   else if(uFxMode>1.5){ float fl=0.72+0.28*sin(uFxTime*9.0+vHairTip*22.0)*sin(uFxTime*3.7+vHairTip*9.0); fx*=fl; g*=fl; }
   else { float sp=pow(max(0.0,sin(vHairTip*60.0+uFxTime*2.3)*sin(vHairTip*37.0-uFxTime*1.1)),12.0); fx+=sp*0.6; }
   diffuseColor.rgb=mix(diffuseColor.rgb,fx,0.8*on);
   totalEmissiveRadiance+=fx*g*0.55*on;
  } }`;
 function install(mat){
  if(mat.userData.hairStyle)return mat.userData.hairStyle;
  const st=mat.userData.hairStyle={maneLen:1,tailLen:1,fx:null,fxMask:3,u:null};
  const prev=mat.onBeforeCompile, prevKey=mat.customProgramCacheKey;
  mat.onBeforeCompile=shader=>{ if(prev)prev.call(mat,shader);
   const u=shader.uniforms; u.uManeLen={value:st.maneLen}; u.uTailLen={value:st.tailLen};
   const f=st.fx&&FX[st.fx]||null;
   u.uFxOn={value:f?1:0}; u.uFxMode={value:f?f.mode:0}; u.uFxMask={value:st.fxMask}; u.uFxGlow={value:f?f.glow:0}; u.uFxTime={value:0};
   u.uFxA={value:new THREE.Color(f?f.a:'#ffffff')}; u.uFxB={value:new THREE.Color(f?f.b:'#ffffff')};
   st.u=u; uniformSets.add(u);
   if(shader.vertexShader.includes('#include <skinning_vertex>')){ shader.vertexShader=VS_DECL+shader.vertexShader.replace('#include <skinning_vertex>',VS_BODY); }
   else { shader.vertexShader=VS_DECL+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHairTip=0.0;vHairPart=hairPart;'); }
   shader.fragmentShader=FS_DECL+shader.fragmentShader.replace('#include <emissivemap_fragment>',FS_BODY);
  };
  const base=prevKey?prevKey.call(mat):'';
  mat.customProgramCacheKey=()=>base+'|hair-style-v1';
  mat.needsUpdate=true;
  return st;
 }
 function push(st){ if(!st.u)return; const u=st.u, f=st.fx&&FX[st.fx]||null;
  u.uManeLen.value=st.maneLen; u.uTailLen.value=st.tailLen; u.uFxOn.value=f?1:0; u.uFxMode.value=f?f.mode:0; u.uFxMask.value=st.fxMask; u.uFxGlow.value=f?f.glow:0;
  u.uFxA.value.set(f?f.a:'#ffffff'); u.uFxB.value.set(f?f.b:'#ffffff'); }

 /* Which meshes are hair on this rig: the artist groom (one skinned strand mesh per GLB, plus
    feathering), the hero's fine-strand mane and tail, or the procedural groom's cards. */
 function hairMeshes(rig,mount){
  const out=[]; const seen=new Set();
  const add=(o,role)=>{ if(o&&o.isSkinnedMesh&&!seen.has(o)&&o!==rig.skin){seen.add(o);out.push({mesh:o,role});} };
  const groom=rig.groom||rig.hair;
  if(groom){ for(const [k,role] of [['mane','mane'],['tail','tail']]){ const o=groom[k]; if(!o)continue; if(o.isSkinnedMesh)add(o,role); else if(o.traverse)o.traverse(c=>add(c,role)); } if(groom.feathers)groom.feathers.forEach?.(f=>add(f,'feather')); }
  let root=rig.scene||rig.skin; if(!rig.scene&&rig.skin){root=rig.skin;while(root.parent&&root.parent!==mount)root=root.parent;}
  if(root&&root.traverse)root.traverse(o=>{ if(o.isSkinnedMesh&&o!==rig.skin&&(/groom|mane|tail|forelock|strand|feather/i.test(o.name)||/groom/i.test(o.parent?.name||'')))add(o,null); });
  return out;
 }
 /* look = {maneLen, tailLen, fx:'ice'|null, fxMask:1|2|3} */
 function hair(rig,mount,look){
  const list=hairMeshes(rig,mount); if(!list.length)return null;
  const mats=new Set();
  for(const {mesh,role} of list){ try{ if(!prepareGeometry(mesh,role))continue; }catch(e){continue;} for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])mats.add(m); }
  for(const m of mats){ const st=install(m); st.maneLen=look.maneLen??1; st.tailLen=look.tailLen??1; st.fx=look.fx||null; st.fxMask=look.fxMask??3; m.userData.fx=st.fx; push(st); }
  return {meshes:list.map(x=>x.mesh),materials:[...mats]};
 }
 function tick(t){ for(const u of uniformSets){ if(u.uFxTime)u.uFxTime.value=t; } }

 /* ---- bone frames ------------------------------------------------------------------- */
 function boneByName(rig,re){ const B=rig.bones||rig.skin?.skeleton?.bones||[]; return B.find(b=>re.test(clean(b.name)))||null; }
 function bonesByName(rig,re){ const B=rig.bones||rig.skin?.skeleton?.bones||[]; return B.filter(b=>re.test(clean(b.name))); }
 /* a point given in the model's native anchor space, expressed in a bone's bind-local frame:
    constant for the life of the rig, so a child mesh placed there follows every pose */
 function anchorInBone(rig,bone,pt){
  const skel=rig.skin.skeleton, i=skel.bones.indexOf(bone); if(i<0||!pt)return null;
  const p=Array.isArray(pt[0])?pt[0]:pt; return new THREE.Vector3(p[0],p[1],p[2]).applyMatrix4(rig.skin.bindMatrix).applyMatrix4(skel.boneInverses[i]);
 }
 function boneAxis(bone){ const c=bone.children.find(x=>x.isBone); if(c)return {dir:c.position.clone().normalize(),len:c.position.length()}; return {dir:new THREE.Vector3(0,1,0),len:0.12}; }
 function frameAt(bone,axis,upHint){
  const f=axis.dir.clone(); let u=upHint?upHint.clone():new THREE.Vector3(0,1,0);
  u.sub(f.clone().multiplyScalar(u.dot(f))); if(u.lengthSq()<1e-6)u=Math.abs(f.y)<0.9?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1); u.sub(f.clone().multiplyScalar(u.dot(f))).normalize();
  const r=new THREE.Vector3().crossVectors(u,f).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(r,u,f));
 }
 function crestUp(rig,bone){ const A=rig.profile?.anchors||{}; const pt=anchorInBone(rig,bone,A.crest||A.poll||A.withers); if(!pt)return null; const ax=boneAxis(bone); const t=pt.dot(ax.dir); return pt.clone().sub(ax.dir.clone().multiplyScalar(t)); }
 function mat(col,o){ return new THREE.MeshStandardMaterial(Object.assign({color:col,roughness:.55,metalness:.05},o||{})); }
 function group(name){ const g=new THREE.Group(); g.name=name; g.userData.style=true; return g; }
 function scaleOf(rig){ return rig.fitScale&&rig.profile?.artistBreed?1:1; }

 /* ---- decorations: braids, bands, ribbons --------------------------------------------- */
 /* kind: 'braid' | 'bands' | 'ribbons' | 'knot' | 'bow'; part: 'mane' | 'tail'; col: hex */
 function decor(rig,mount,part,kind,col){
  if(!rig||!rig.skin)return null;
  const g=group('decor:'+part+':'+kind); const handles=[];
  const beadM=mat(col||'#f2ece0',{roughness:.6}), ribM=mat(col||'#e8b4c8',{roughness:.5});
  const s=1;
  const put=(bone,pos,q,mesh)=>{ mesh.position.copy(pos); if(q)mesh.quaternion.copy(q); bone.add(mesh); handles.push(mesh); };
  if(part==='mane'){
   const necks=bonesByName(rig,/^neck/); if(!necks.length)return null;
   for(const bone of necks){
    const ax=boneAxis(bone), up=crestUp(rig,bone); if(!up)continue;
    const upN=up.clone().normalize(), rad=up.length()*0.98, q=frameAt(bone,ax,upN);
    const n=kind==='bands'?3:kind==='ribbons'?4:6;
    for(let i=0;i<n;i++){ const t=ax.len*(i+0.5)/n; const pos=ax.dir.clone().multiplyScalar(t).add(upN.clone().multiplyScalar(rad));
     if(kind==='braid'){ const m=new THREE.Mesh(new THREE.SphereGeometry(.028*s,10,8),beadM); m.scale.set(1,1,1.35); put(bone,pos,q,m); }
     else if(kind==='bands'){ const m=new THREE.Mesh(new THREE.TorusGeometry(.03*s,.008*s,6,14),beadM); put(bone,pos,q,m); }
     else if(kind==='ribbons'){ const m=new THREE.Mesh(new THREE.SphereGeometry(.024*s,10,8),beadM); m.scale.set(1,1,1.3); put(bone,pos,q,m);
      const rb=new THREE.Mesh(new THREE.BoxGeometry(.05*s,.012*s,.03*s),ribM); rb.position.copy(pos).add(upN.clone().multiplyScalar(.02)); rb.quaternion.copy(q); rb.rotation.z+=(i%2?.5:-.5); bone.add(rb); handles.push(rb); }
    }
   }
  }else{
   const tails=bonesByName(rig,/^tail\d?$/).slice(0,3); if(!tails.length)return null;
   if(kind==='knot'){ const bone=tails[Math.min(1,tails.length-1)], ax=boneAxis(bone); const m=new THREE.Mesh(new THREE.SphereGeometry(.075*s,12,10),beadM); m.scale.set(1,1,1.2); put(bone,ax.dir.clone().multiplyScalar(ax.len*0.9),frameAt(bone,ax),m); }
   else if(kind==='bow'){ const bone=tails[0], ax=boneAxis(bone), q=frameAt(bone,ax); for(const sg of [-1,1]){ const m=new THREE.Mesh(new THREE.SphereGeometry(.05*s,10,8),ribM); m.scale.set(1.5,.55,.9); const r=new THREE.Vector3(sg*.06,0,0).applyQuaternion(q); put(bone,ax.dir.clone().multiplyScalar(ax.len*.35).add(r),q,m);} const c=new THREE.Mesh(new THREE.SphereGeometry(.028*s,8,8),beadM); put(bone,ax.dir.clone().multiplyScalar(ax.len*.35),q,c); }
   else { for(const bone of tails){ const ax=boneAxis(bone), q=frameAt(bone,ax); const n=kind==='bands'?2:4; for(let i=0;i<n;i++){ const t=ax.len*(i+0.5)/n; const m=kind==='bands'?new THREE.Mesh(new THREE.TorusGeometry(.045*s,.009*s,6,14),beadM):new THREE.Mesh(new THREE.SphereGeometry(.04*s,10,8),beadM); if(kind!=='bands')m.scale.set(1,1,1.4); put(bone,ax.dir.clone().multiplyScalar(t),q,m); } } }
  }
  if(!handles.length)return null;
  g.userData.handles=handles;
  return {group:g,dispose(){for(const m of handles){m.parent?.remove(m);m.geometry.dispose();} beadM.dispose();ribM.dispose();}};
 }

 /* ---- accessories -------------------------------------------------------------------- */
 /* def: {slot:'mask'|'legs'|'tail'|'blanket'|'neck'|'brow', col, col2?, glow?} */
 function accessory(def,rig,mount){
  if(!rig||!rig.skin)return null;
  const A=rig.profile?.anchors||{}; const handles=[]; const mats=[];
  const M=(c,o)=>{const m=mat(c,o);mats.push(m);return m;};
  const glow=def.glow?{emissive:new THREE.Color(def.glow),emissiveIntensity:.9}:{};
  const put=(bone,pos,q,mesh)=>{ mesh.position.copy(pos); if(q)mesh.quaternion.copy(q); mesh.name='acc:'+def.slot; mesh.castShadow=true; bone.add(mesh); handles.push(mesh); return mesh; };
  const slot=def.slot;
  if(slot==='mask'||slot==='brow'){
   const head=boneByName(rig,/^head$/)||boneByName(rig,/head/); if(!head)return null;
   const eyes=A.eyes&&anchorInBone(rig,head,A.eyes[0]), eyes2=A.eyes&&A.eyes[1]&&anchorInBone(rig,head,A.eyes[1]);
   const poll=anchorInBone(rig,head,A.poll), muzzle=anchorInBone(rig,head,A.muzzle), hd=anchorInBone(rig,head,A.head);
   if(!poll||!muzzle||!hd)return null;
   const fwd=muzzle.clone().sub(poll).normalize();
   const mid=eyes&&eyes2?eyes.clone().add(eyes2).multiplyScalar(.5):hd.clone();
   const side=eyes&&eyes2?eyes2.clone().sub(eyes).normalize():new THREE.Vector3(1,0,0);
   let up=new THREE.Vector3().crossVectors(fwd,side).normalize(); if(up.dot(poll.clone().sub(mid))<0)up.negate();
   const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side.clone().normalize(),up,fwd));
   const w=eyes&&eyes2?eyes.distanceTo(eyes2):.16;
   if(slot==='mask'){
    const m=new THREE.Mesh(new THREE.SphereGeometry(1,18,12,0,Math.PI*2,0,Math.PI*.62),M(def.col||'#3b6fd6',Object.assign({roughness:.7,transparent:true,opacity:.92,side:THREE.DoubleSide},glow)));
    m.scale.set(w*.95,w*.6,w*.85); const q2=q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI*.42));
    put(head,mid.clone().add(fwd.clone().multiplyScalar(w*.18)).add(up.clone().multiplyScalar(w*.12)),q2,m);
    const trim=new THREE.Mesh(new THREE.TorusGeometry(1,.06,6,26),M(def.col2||'#f4efe4')); trim.scale.set(w*.95,w*.62,w*.85); put(head,mid.clone().add(fwd.clone().multiplyScalar(w*.2)).add(up.clone().multiplyScalar(w*.12)),q2,trim);
    for(const ear of bonesByName(rig,/^ear/)){ const ax=boneAxis(ear); const cup=new THREE.Mesh(new THREE.ConeGeometry(.032,.11,10,1,true),M(def.col||'#3b6fd6',Object.assign({side:THREE.DoubleSide,transparent:true,opacity:.9},glow))); const qe=frameAt(ear,ax).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2)); put(ear,ax.dir.clone().multiplyScalar(Math.max(.03,ax.len*.5)),qe,cup); }
   }else{
    const charm=new THREE.Mesh(new THREE.TorusGeometry(w*.55,.012,8,32),M(def.col||'#ffd97a',Object.assign({metalness:.6,roughness:.3},glow)));
    put(head,poll.clone().add(up.clone().multiplyScalar(w*.55)),q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2)),charm);
   }
  }else if(slot==='legs'){
   const cannons=bonesByName(rig,/cannon/); if(cannons.length<2)return null;
   for(const b of cannons){ const ax=boneAxis(b); const L=Math.max(.06,ax.len*.72); const m=new THREE.Mesh(new THREE.CylinderGeometry(.05,.056,L,12,1,true),M(def.col||'#f4efe4',Object.assign({side:THREE.DoubleSide,roughness:.8},glow))); const q=frameAt(b,ax).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2)); put(b,ax.dir.clone().multiplyScalar(ax.len*.5),q,m);
    if(def.col2){ const t=new THREE.Mesh(new THREE.TorusGeometry(.055,.008,6,16),M(def.col2)); put(b,ax.dir.clone().multiplyScalar(ax.len*.8),frameAt(b,ax),t); } }
  }else if(slot==='tail'){
   const d=decor(rig,mount,'tail','bow',def.col||'#e8b4c8'); if(!d)return null; d.group.userData.handles.forEach(m=>{m.name='acc:tail';handles.push(m);});
   return {handles,dispose(){d.dispose();}};
  }else if(slot==='neck'){
   const b=boneByName(rig,/^necklower/)||boneByName(rig,/^neck/); if(!b)return null;
   const ax=boneAxis(b), up=crestUp(rig,b); const r=up?up.length()*.92:.18;
   const m=new THREE.Mesh(new THREE.TorusGeometry(r,.022,8,28),M(def.col||'#c0392b',Object.assign({roughness:.5},glow))); put(b,ax.dir.clone().multiplyScalar(ax.len*.45),frameAt(b,ax),m);
   if(def.col2){ const bell=new THREE.Mesh(new THREE.SphereGeometry(.035,10,8),M(def.col2,{metalness:.7,roughness:.3})); const dn=up?up.clone().normalize().negate():new THREE.Vector3(0,-1,0); put(b,ax.dir.clone().multiplyScalar(ax.len*.45).add(dn.multiplyScalar(r)),null,bell); }
  }else if(slot==='blanket'){
   const b=boneByName(rig,/^spine$/)||boneByName(rig,/spine/); if(!b)return null;
   const sad=anchorInBone(rig,b,A.saddle), tl=anchorInBone(rig,b,A.tail); if(!sad||!tl)return null;
   const ax=boneAxis(b); const proj=ax.dir.clone().multiplyScalar(sad.dot(ax.dir)); const up=sad.clone().sub(proj).normalize();
   const back=tl.clone().sub(sad); const len=back.length()*.72; const dirB=back.clone().normalize();
   const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up,dirB).normalize(),up,dirB));
   const sheet=new THREE.Mesh(new THREE.SphereGeometry(1,20,12,0,Math.PI*2,0,Math.PI*.5),M(def.col||'#7d3c98',Object.assign({side:THREE.DoubleSide,roughness:.85},glow)));
   sheet.scale.set(.30,.16,len*.62); put(b,sad.clone().add(dirB.clone().multiplyScalar(len*.55)).add(up.clone().multiplyScalar(-.06)),q,sheet);
   const trim=new THREE.Mesh(new THREE.TorusGeometry(1,.02,6,24),M(def.col2||'#f4efe4')); trim.scale.set(.30,.16,len*.62); trim.rotation.x=Math.PI/2; const tq=q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2)); put(b,sad.clone().add(dirB.clone().multiplyScalar(len*.55)).add(up.clone().multiplyScalar(-.06)),tq,trim);
  }else return null;
  if(!handles.length)return null;
  return {handles,dispose(){for(const m of handles){m.parent?.remove(m);m.geometry.dispose();} mats.forEach(m=>m.dispose());}};
 }

 /* ---- the rainbow horn ---------------------------------------------------------------- */
 function horn(mesh,on){
  if(!mesh)return;
  if(on){
   if(mesh.userData.rainbowMat){mesh.material=mesh.userData.rainbowMat;return;}
   mesh.userData.baseMat=mesh.userData.baseMat||mesh.material;
   const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.35,metalness:.2,emissive:0x222222});
   const u={uTime:{value:0}}; uniformSets.add(u);
   m.onBeforeCompile=sh=>{ sh.uniforms.uFxTime=u.uTime; sh.vertexShader='varying float vHornY;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHornY=position.y;');
    sh.fragmentShader='uniform float uFxTime;varying float vHornY;\nvec3 hsHue2(float h){vec3 p=abs(fract(vec3(h)+vec3(0.0,2.0/3.0,1.0/3.0))*6.0-3.0);return clamp(p-1.0,0.0,1.0);}\n'+sh.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n{ vec3 c=hsHue2(fract(vHornY*2.2+uFxTime*0.12)); diffuseColor.rgb=mix(diffuseColor.rgb,c,0.85); totalEmissiveRadiance+=c*0.45; }'); };
   m.customProgramCacheKey=()=>'rainbow-horn-v1'; m.userData.fx='rainbow';
   mesh.userData.rainbowMat=m; mesh.material=m;
  }else if(mesh.userData.baseMat){ mesh.material=mesh.userData.baseMat; }
 }
 return {FX,hair,hairMeshes,decor,accessory,horn,tick,prepareGeometry};
}
