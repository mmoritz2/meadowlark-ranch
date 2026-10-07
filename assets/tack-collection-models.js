import {DISPLAY_REIN_COMPONENTS} from './native-rider.js?v=native-tack-reins-20261007';
/* Fitted collection tack. Every design is geometry, cloth and hardware; the
 * horse's hidden native rig keeps its seat/IK contacts. Equipped pieces
 * share the existing skin, weights and animations without altering any bones.
 * No game globals: also used by the boutique's isolated 3D fitting room. */
const SLOTS=['saddle','pad','bridle','shoes'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hash=value=>{let n=2166136261;for(const c of String(value))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
export function tackDesignFingerprint(piece){return hash(JSON.stringify({slot:piece?.slot,...piece?.design})).toString(16);}

export function createTackCollection({THREE,rig,mount,equippedDesigns={},tack={},nativeVisibility}={}){
 if(!THREE||!rig?.skin?.isSkinnedMesh||!mount)throw new Error('Collection tack needs THREE, a skinned horse rig and its mount');
 const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),M=()=>new THREE.Matrix4();
 const group=new THREE.Group();group.name='FittedTackCollection';group.userData.collectionTack=true;mount.add(group);
 const nativeHorse=!!(rig.profile?.nativeBreed&&rig.profile.nativeKind==='horse'),nativeFoundations=[];
 // Prepared rider geometry has already removed these display triangles.
 // Raw studio/herd geometry retains all 300 source components. Preserve the
 // same authored strip positions/skin rather than inventing a neck route.
 function sourceReinIndices(){
  const mesh=rig.nativeContacts?.tack,g=mesh?.geometry,index=g?.index?.array;if(!nativeHorse||!index)return [];
  const saved=mesh.userData.nativeRestingReinIndices;if(Array.isArray(saved)&&saved.length===4920)return saved;
  if(g.attributes.position.count!==13895||index.length!==17194*3)return [];
  const parent=Array.from({length:13895},(_,i)=>i),find=i=>{while(parent[i]!==i)i=parent[i]=parent[parent[i]];return i;};for(let i=0;i<index.length;i+=3){const r=find(index[i]);parent[find(index[i+1])]=r;parent[find(index[i+2])]=r;}
  const ids=new Map();for(let i=0;i<parent.length;i++){const root=find(i);if(!ids.has(root))ids.set(root,ids.size);}if(ids.size!==300)return [];
  const hidden=new Set(DISPLAY_REIN_COMPONENTS),out=[];for(let i=0;i<index.length;i+=3)if(hidden.has(ids.get(find(index[i]))))out.push(index[i],index[i+1],index[i+2]);return out.length===4920?out:[];
 }
 const nativeReinIndices=sourceReinIndices(),nativeReinVertices=new Set(nativeReinIndices);
 const source=rig.skin,geometry=source.geometry,position=geometry.attributes.position,skinIndex=geometry.attributes.skinIndex,skinWeight=geometry.attributes.skinWeight;
 const nativeBatchSources=new WeakMap();
 const resources=new Set(),textures=new Set(),batches=[],overrides=[],hiddenOriginals=new Map(),slotGroups={},stats={pieces:{},vertices:0,triangles:0,meshes:0,fit:'native-weight-transfer',sourceJoints:source.skeleton.bones.length};
 let skinWeightResolver=null,restingReins=null;
 let disposed=false,key='',current={},state={bareback:false,wild:false,reinsMode:'resting'};
 rig.scene.updateWorldMatrix(true,false);rig.scene.updateMatrixWorld(true);mount.updateWorldMatrix(true,false);source.skeleton.update();
 const mountWorld=mount.matrixWorld.clone(),toSource=source.matrixWorld.clone().invert().multiply(mountWorld),toMount=mountWorld.clone().invert().multiply(source.matrixWorld);
 const bind=source.bindMatrix.clone(),bindInverse=source.bindMatrixInverse.clone();
 const boneMatrices=source.skeleton.bones.map((bone,i)=>M().multiplyMatrices(bone.matrixWorld,source.skeleton.boneInverses[i]));
 const points=[],weights=[],cells=new Map(),cellSize=.07,blendCache=new Map();
 const cellKey=(x,y,z)=>`${x},${y},${z}`;
 const tmp=V();
 for(let i=0;i<position.count;i++){
  source.getVertexPosition(i,tmp);const p=tmp.clone().applyMatrix4(toMount);points.push(p);
  const indices=[],values=[];for(let j=0;j<4;j++){indices.push(skinIndex.getComponent(i,j));values.push(skinWeight.getComponent(i,j));}weights.push({indices,values});
  const key=cellKey(Math.floor(p.x/cellSize),Math.floor(p.y/cellSize),Math.floor(p.z/cellSize));if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);
 }
 function nearest(p){
  const cx=Math.floor(p.x/cellSize),cy=Math.floor(p.y/cellSize),cz=Math.floor(p.z/cellSize);let best=-1,d=Infinity;
  for(let r=1;r<=4;r++){
   for(let x=-r;x<=r;x++)for(let y=-r;y<=r;y++)for(let z=-r;z<=r;z++)for(const i of cells.get(cellKey(cx+x,cy+y,cz+z))||[]){const n=p.distanceToSquared(points[i]);if(n<d){d=n;best=i;}}
   if(best>=0&&d<Math.pow((r-1)*cellSize,2))break;
  }
  if(best<0)for(let i=0;i<points.length;i++){const n=p.distanceToSquared(points[i]);if(n<d){d=n;best=i;}}
  return best;
 }
 function inverseBlend(i){
  const w=typeof i==='number'?weights[i]:i,id=w.indices.join(',')+'|'+w.values.join(',');if(blendCache.has(id))return blendCache.get(id);
  const mix=M();mix.elements.fill(0);for(let j=0;j<4;j++)for(let k=0;k<16;k++)mix.elements[k]+=boneMatrices[w.indices[j]].elements[k]*w.values[j];
  const inv=M().multiplyMatrices(bindInverse,mix).multiply(bind).invert();blendCache.set(id,inv);return inv;
 }
 const tri=[];for(let i=0;i<(geometry.index?.count||position.count);i+=3)tri.push([0,1,2].map(k=>geometry.index?geometry.index.getX(i+k):i+k));
 function profilePoint(name,fallback){const a=rig.profile?.anchors?.[name]?.[0];return a?V(...a).multiplyScalar(rig.fitScale||1).add(V(0,rig.fitY||0,0)):V(...fallback);}
 const nativeBone=name=>rig.boneMap?.[name]||source.skeleton.bones.find(b=>b.name===name),mountBone=bone=>bone?mount.worldToLocal(bone.getWorldPosition(V())):null;
 const nativePoint=(mesh,range,top=false)=>{if(!mesh||!range)return null;mesh.updateMatrixWorld(true);const box=new THREE.Box3();for(let i=range[0];i<=range[1];i++){mesh.getVertexPosition(i,tmp);box.expandByPoint(mount.worldToLocal(mesh.localToWorld(tmp.clone())));}const point=box.getCenter(V());if(top)point.y=box.max.y;return point;};
 // Shared joint indices let generated hardware follow the same authored
 // tread/bit skin as the invisible source contacts used by the rider.
 function contactWeights(range){const mesh=rig.nativeContacts?.tack;if(!mesh||!range)return null;const scores=new Map(),g=mesh.geometry;for(let i=range[0];i<=range[1];i++)for(let k=0;k<4;k++){const joint=g.attributes.skinIndex.getComponent(i,k),weight=g.attributes.skinWeight.getComponent(i,k);scores.set(joint,(scores.get(joint)||0)+weight);}return compactWeights(scores);}
 function compactWeights(scores){const entries=[...scores].filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,4),total=entries.reduce((n,[,v])=>n+v,0);while(entries.length<4)entries.push([0,0]);return {indices:entries.map(([i])=>i),values:entries.map(([,v])=>v/total)};}
 function mixWeights(a,b,t){const scores=new Map();for(const [w,f]of [[a,1-t],[b,t]])for(let k=0;k<4;k++)scores.set(w.indices[k],(scores.get(w.indices[k])||0)+w.values[k]*f);return compactWeights(scores);}
 function withWeights(resolver,build){const previous=skinWeightResolver;skinWeightResolver=resolver;try{return build();}finally{skinWeightResolver=previous;}}
 const nativeTreads=nativeHorse?['left','right'].map(side=>({point:nativePoint(rig.nativeContacts?.tack,rig.nativeContacts?.treadRanges?.[side],true),weights:contactWeights(rig.nativeContacts?.treadRanges?.[side])})):[];
 const seat=(nativeHorse?mountBone(rig.nativeContacts?.seatFollower||rig.nativeSeatFollower):null)||rig.henryContacts?.point('seat',mount,V())?.clone()||profilePoint('saddle',[0,1.4,-.15]);
 const floor=Math.min(...points.map(p=>p.y));
 // Surface sections use the actual deformed triangles, not ellipsoid guesses.
 function section(center,axis,u,v,filter=()=>true,surfacePoints=points,surfaceTriangles=tri,fixedOrigin=false){
  const segments=[];let minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity;
  const projected=surfacePoints.map((p,i)=>{const x=p.x-center.x,y=p.y-center.y,z=p.z-center.z;return [x*axis.x+y*axis.y+z*axis.z,x*u.x+y*u.y+z*u.z,x*v.x+y*v.y+z*v.z,filter(p,i)];});
  for(const ids of surfaceTriangles){if(!ids.some(i=>projected[i][3]))continue;const ps=ids.map(i=>projected[i]),hits=[];
   for(let j=0;j<3;j++){const a=ps[j],b=ps[(j+1)%3],da=a[0],db=b[0];if((da<0)===(db<0)||Math.abs(da-db)<1e-9)continue;const f=da/(da-db);hits.push([a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f]);}
   if(hits.length===2){segments.push(hits);for(const p of hits){minU=Math.min(minU,p[0]);maxU=Math.max(maxU,p[0]);minV=Math.min(minV,p[1]);maxV=Math.max(maxV,p[1]);}}
  }
  if(!segments.length)return null;
  const cu=fixedOrigin?0:(minU+maxU)/2,cv=fixedOrigin?0:(minV+maxV)/2,origin=center.clone().addScaledVector(u,cu).addScaledVector(v,cv);
  return {origin,sample(angle,lift=.013){const dx=Math.sin(angle),dy=Math.cos(angle);let radius=0;
   for(const [a,b]of segments){const ax=a[0]-cu,ay=a[1]-cv,ex=b[0]-a[0],ey=b[1]-a[1],den=dx*ey-dy*ex;if(Math.abs(den)<1e-9)continue;const r=(ax*ey-ay*ex)/den,t=(ax*dy-ay*dx)/den;if(r>0&&t>=0&&t<=1)radius=Math.max(radius,r);}
   if(!radius)radius=1/Math.sqrt(dx*dx/Math.max(.001,(maxU-minU)**2/4)+dy*dy/Math.max(.001,(maxV-minV)**2/4));
   return origin.clone().addScaledVector(u,dx*(radius+lift)).addScaledVector(v,dy*(radius+lift));}};
 }
 const backSections=new Map();
 function back(z,angle,lift=.021){
  const zi=Math.round(z*140)/140;let s=backSections.get(zi);if(!s){s=section(V(0,seat.y-(nativeHorse?.45*clamp(seat.y/1.74,.7,1.25):.30),zi),V(0,0,1),V(1,0,0),V(0,1,0),p=>p.y>seat.y-(nativeHorse?.90:.68)&&Math.abs(p.z-seat.z)<.70,points,tri,nativeHorse);backSections.set(zi,s);}return s?s.sample(angle,lift):V(Math.sin(angle)*.28,seat.y-.27+Math.cos(angle)*.3,zi);
 }
 const nativeBitWeights=nativeHorse?['left','right'].map(side=>contactWeights(rig.nativeContacts?.bitRanges?.[side])):[];
 const nativeBits=nativeHorse?['left','right'].map(side=>nativePoint(rig.nativeContacts?.tack,rig.nativeContacts?.bitRanges?.[side])):[];
 const headPoll=(nativeHorse?mountBone(nativeBone('head_019')):null)||profilePoint('poll',[0,1.72,1.05]),headMuzzle=nativeBits.every(Boolean)&&nativeBits.length===2?nativeBits[0].clone().add(nativeBits[1]).multiplyScalar(.5):profilePoint('muzzle',[0,1.32,1.36]),headAxis=headPoll.clone().sub(headMuzzle).normalize(),headSide=nativeHorse&&nativeBits.every(Boolean)&&nativeBits.length===2?nativeBits[1].clone().sub(nativeBits[0]).normalize():V(1,0,0);
 headSide.addScaledVector(headAxis,-headSide.dot(headAxis)).normalize();if(headSide.x<0)headSide.negate();const headFront=V().crossVectors(headSide,headAxis).normalize();if(headFront.z<0)headFront.negate();
 const nativeFore=nativeHorse?mountBone(nativeBone('upperarm_l_0204')):null,nativeHind=nativeHorse?mountBone(nativeBone('upperleg_l_0405')):null;
 const fitLength=nativeFore&&nativeHind?clamp(Math.abs(nativeFore.z-nativeHind.z)/1.38,.67,1.25):1,fitWidth=nativeHorse?clamp(back(seat.z,Math.PI/2,0).distanceTo(back(seat.z,-Math.PI/2,0))/.62,.74,1.24):1;
 stats.fitProfile={nativeHorse,seat:seat.toArray(),poll:headPoll.toArray(),muzzle:headMuzzle.toArray(),lengthScale:fitLength,widthScale:fitWidth};
 // The native saddle contains disconnected horn, seat, skirt and strap
 // islands. A radial maximum through those parts jumps between surfaces. Keep
 // overlays on a continuous torso envelope; the authored seat remains the fit
 // contact foundation, even when its visible parts are unequipped. Fixed section origins prevent neck/leg
 // islands from moving the cloth coordinate frame from one row to the next.
 function saddleBack(z,angle,lift){return back(z,angle,lift);}
 const headSections=new Map();
 function head(f,angle,lift=.013){const fi=Math.round(f*100)/100;let s=headSections.get(fi);if(!s){const c=headMuzzle.clone().lerp(headPoll,fi);s=section(c,headAxis,headSide,headFront,(p,i)=>p.y>headMuzzle.y-.15&&p.z>headMuzzle.z-.58&&weights[i].indices.some((n,j)=>weights[i].values[j]>.25&&/head|jaw|lip|nose/i.test(source.skeleton.bones[n].name)));headSections.set(fi,s);}return s?s.sample(angle,lift):headMuzzle.clone().lerp(headPoll,fi).addScaledVector(headSide,Math.sin(angle)*.10).addScaledVector(headFront,Math.cos(angle)*.07);}
 // GLTFLoader sanitizes reserved dots in artist joint names (FL.pastern ->
 // FLpastern). Use the same canonical lookup as the artist motion controller.
 const jointKey=name=>name.replace(/[.\s]/g,''),jointMap=new Map(source.skeleton.bones.map(b=>[jointKey(b.name),b]));
 const legSections=new Map(),findBone=names=>names.map(name=>jointMap.get(jointKey(name))).find(Boolean),bonePoint=bone=>bone?mount.worldToLocal(bone.getWorldPosition(V())):null;
 const legFrames=[
  [['fingers_01_l_0187','BN_L_Hand_041_042','FL.pastern'],['hand_l_0206','BN_l_Forearm_040_041','FL.cannon']],
  [['fingers_01_r_0273','BN_R_Hand_046_048','FR.pastern'],['hand_r_0272','BN_R_Forearm_045_047','FR.cannon']],
  [['toes_01_l_0408','BN_L_Foot_054_057','HL.pastern','RL.pastern'],['foot_l_0407','BN_L_HorseLink_053_056','HL.cannon','RL.cannon']],
  [['toes_01_r_0477','BN_R_Foot_00_063','HR.pastern','RR.pastern'],['foot_r_0476','BN_R_HorseLink_058_062','HR.cannon','RR.cannon']],
 ].map(([lower,upper],i)=>{const lowerBone=findBone(lower),upperBone=findBone(upper),low=bonePoint(lowerBone)||V(i%2?-.12:.12,floor+.18,i<2?.45:-.62),high=bonePoint(upperBone)||low.clone().add(V(0,.34,0)),axis=high.clone().sub(low).normalize(),u=V(1,0,0).addScaledVector(axis,-axis.x).normalize(),v=V().crossVectors(u,axis).normalize();const branch=upperBone?.parent,ownedBones=new Set();if(nativeHorse&&branch)branch.traverse(b=>{if(b.isBone)ownedBones.add(source.skeleton.bones.indexOf(b));});return {low,high,axis,u,v,ownedBones,lower:lowerBone?.name||null,upper:upperBone?.name||null};});
 stats.legFit={resolvedEndpoints:legFrames.reduce((n,f)=>n+!!f.lower+!!f.upper,0),frames:legFrames.map(f=>({lower:f.lower,upper:f.upper})),fallbackSections:0};
 function leg(legIndex,t,angle,lift=.012){const f=legFrames[legIndex],ti=Math.round(t*100)/100,id=legIndex+':'+ti;let s=legSections.get(id);if(!legSections.has(id)){const center=f.low.clone().lerp(f.high,ti);s=section(center,f.axis,f.u,f.v,(p,i)=>{const d=p.clone().sub(center);return Math.abs(d.dot(f.u))<(nativeHorse?.105:.13)&&Math.abs(d.dot(f.v))<(nativeHorse?.105:.13)&&(!nativeHorse||weights[i].indices.some((bone,k)=>weights[i].values[k]>.12&&f.ownedBones.has(bone)));});legSections.set(id,s);if(!s)stats.legFit.fallbackSections++;}return s?s.sample(angle,lift):f.low.clone().lerp(f.high,t).addScaledVector(f.u,Math.sin(angle)*.06).addScaledVector(f.v,Math.cos(angle)*.06);}

 // Small reusable material maps add real surface relief. Cloth seams recede into
 // padded cells; leather has finer grain and pressed tooling rather than noise.
 function textile(d,kind,rainbowAxis=null){
  const size=256,color=new Uint8Array(size*size*4),height=new Uint8Array(size*size*4),base=new THREE.Color(kind==='cloth'?d.cloth:d.leather),lining=new THREE.Color(d.lining),seed=hash(d.pattern+d.variant+kind);base.convertLinearToSRGB();lining.convertLinearToSRGB();
  const spectrum=rainbowAxis?(Array.isArray(d.palette)&&d.palette.length===6?d.palette:['#ef4559','#f78d32','#f4cf44','#42b976','#418bed','#9254d9']).map(hex=>new THREE.Color(hex).convertLinearToSRGB()):null;
  const line=t=>{const f=Math.abs(t-Math.round(t));return Math.exp(-f*f/0.0022);};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const u=x/size,v=y/size,noise=((Math.imul(x+seed,374761393)^Math.imul(y+seed,668265263))>>>0)%1000/1000-.5;let seam=0;
   if(d.pattern==='quilt')seam=Math.max(line((u+v)*5),line((u-v)*5));
   else if(d.pattern==='chevron')seam=line((v+Math.abs(u*4%1-.5)*.44)*10);
   else if(d.pattern==='lattice')seam=Math.max(line(u*8),line(v*8));
   else if(d.pattern==='herringbone')seam=line(u*8+(Math.floor(v*12)%2?1:-1)*v*6);
   else seam=Math.pow(Math.abs(Math.sin(u*25+Math.sin(v*20)*1.8)),18);
   const cloth=kind==='cloth',weave=cloth?((x%3===0||y%3===0)?-.022:.008):0,shade=1+noise*(cloth?.042:.065)+weave-seam*(cloth?.14:.11),stitch=seam*(cloth?.075:.035),h=clamp(cloth?.72-seam*.50+noise*.045:.50+noise*.19-seam*.13,0,1);
   // Broad dyed bands retain the fabric grain and recessed stitching. Tiny
   // transitions soften the woven join without washing the six hues together.
   let dyed=base;if(spectrum){const phase=clamp((rainbowAxis==='u'?u:v)*6,0,5.999),band=Math.floor(phase),f=phase-band,blend=clamp((f-.90)/.10,0,1);dyed=spectrum[band].clone().lerp(spectrum[Math.min(5,band+1)],blend);}
   for(let k=0;k<3;k++){const a=[dyed.r,dyed.g,dyed.b][k],b=[lining.r,lining.g,lining.b][k];color[(y*size+x)*4+k]=clamp((a*(1-stitch)+b*stitch)*shade*255,0,255);height[(y*size+x)*4+k]=h*255;}color[(y*size+x)*4+3]=height[(y*size+x)*4+3]=255;
  }
  const make=(bytes,srgb)=>{const tex=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);if(srgb)tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=rainbowAxis?THREE.ClampToEdgeWrapping:THREE.RepeatWrapping;tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.needsUpdate=true;textures.add(tex);return tex;};
  return {map:make(color,true),bumpMap:make(height,false),bumpScale:kind==='cloth'?.007:.0023};
 }
 function materials(d){
  const make=(color,opts={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.67,...opts});resources.add(m);return m;};
  const mat={leather:make('#ffffff',{...textile(d,'leather'),roughness:.49}),cloth:make('#ffffff',{...textile(d,'cloth'),roughness:.89}),lining:make(d.lining,{roughness:.95}),edge:make(d.accent,{roughness:.49}),metal:make(d.metal,{metalness:.8,roughness:.27}),gem:make(d.accent,{metalness:.35,roughness:.18})};
  if(d.rainbow===true){mat.rainbowCloth=make('#ffffff',{...textile(d,'cloth','v'),roughness:.84});mat.rainbowLeather=make('#ffffff',{...textile(d,'leather','u'),roughness:.57});for(const name of ['rainbowCloth','rainbowLeather']){mat[name].name=name;mat[name].userData.collectionRainbow=true;}}
  return mat;
 }
 function skinGeo(geo,material,slot,name){const p=geo.attributes.position,raw=[],indices=[],values=[],v=V();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const j=nearest(v),w=skinWeightResolver?.(v)||weights[j];v.applyMatrix4(toSource).applyMatrix4(inverseBlend(w));raw.push(v.x,v.y,v.z);indices.push(...w.indices);values.push(...w.values);}
  geo.setAttribute('position',new THREE.Float32BufferAttribute(raw,3));geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(values,4));geo.deleteAttribute('normal');geo.computeVertexNormals();geo.computeBoundingSphere();
  const mesh=new THREE.SkinnedMesh(geo,material);mesh.name=name;mesh.bind(source.skeleton,bind);mesh.bindMode=source.bindMode;mesh.matrixAutoUpdate=false;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;slotGroups[slot].add(mesh);batches.push(mesh);resources.add(geo);stats.vertices+=p.count;stats.triangles+=(geo.index?.count||p.count)/3;stats.meshes++;return mesh;
 }
 function mergeSlot(slot){
  const byMaterial=new Map();for(const mesh of slotGroups[slot].children){if(!byMaterial.has(mesh.material))byMaterial.set(mesh.material,[]);byMaterial.get(mesh.material).push(mesh);}
  for(const [material,meshes]of byMaterial){if(meshes.length<2)continue;const total=meshes.reduce((n,m)=>n+m.geometry.attributes.position.count,0),geo=new THREE.BufferGeometry(),attributes={position:[Float32Array,3],normal:[Float32Array,3],uv:[Float32Array,2],skinIndex:[Uint16Array,4],skinWeight:[Float32Array,4]},indices=[];
   for(const [name,[Type,width]]of Object.entries(attributes)){const data=new Type(total*width);let offset=0;for(const m of meshes){const a=m.geometry.attributes[name];if(a)data.set(a.array,offset*width);offset+=m.geometry.attributes.position.count;}geo.setAttribute(name,new THREE.BufferAttribute(data,width));}
   let offset=0;for(const mesh of meshes){const g=mesh.geometry,n=g.attributes.position.count;for(let i=0;i<(g.index?.count||n);i++)indices.push(offset+(g.index?g.index.getX(i):i));offset+=n;mesh.removeFromParent();batches.splice(batches.indexOf(mesh),1);resources.delete(g);g.dispose();}
   geo.setIndex(indices);geo.computeBoundingSphere();resources.add(geo);const merged=new THREE.SkinnedMesh(geo,material);merged.name=slot+' / '+meshes.map(m=>m.name).join(', ');merged.userData.parts=meshes.map(m=>m.name);let partOffset=0;merged.userData.partRanges=meshes.map(m=>{const part={name:m.name,start:partOffset,count:m.geometry.attributes.position.count};partOffset+=part.count;return part;});merged.bind(source.skeleton,bind);merged.bindMode=source.bindMode;merged.matrixAutoUpdate=false;merged.castShadow=merged.receiveShadow=true;merged.frustumCulled=false;slotGroups[slot].add(merged);batches.push(merged);stats.meshes-=meshes.length-1;
  }
 }
 // Close a sampled surface with an inset underside and edge walls. Separate
 // wall vertices preserve the visible leather/cloth thickness at each cut edge.
 function patch(slot,name,material,n,m,sample,thickness=0,flip=false){
  const p=[],uv=[],ix=[];for(let j=0;j<=m;j++)for(let i=0;i<=n;i++){p.push(...sample(i/n,j/m).toArray());uv.push(i/n,j/m);}for(let j=0;j<m;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+n+1;ix.push(...(flip?[a,a+1,b,a+1,b+1,b]:[a,b,a+1,a+1,b,b+1]));}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setIndex(ix);geo.computeVertexNormals();
  if(thickness){const count=p.length/3,normals=geo.attributes.normal.array,front=ix.slice();for(let i=0;i<count;i++){p.push(p[i*3]-normals[i*3]*thickness,p[i*3+1]-normals[i*3+1]*thickness,p[i*3+2]-normals[i*3+2]*thickness);uv.push(uv[i*2],uv[i*2+1]);}for(let i=0;i<front.length;i+=3)ix.push(front[i]+count,front[i+2]+count,front[i+1]+count);
   const rim=[];for(let i=0;i<=n;i++)rim.push(i);for(let j=1;j<=m;j++)rim.push(j*(n+1)+n);for(let i=n-1;i>=0;i--)rim.push(m*(n+1)+i);for(let j=m-1;j>0;j--)rim.push(j*(n+1));
   for(let i=0;i<rim.length;i++){const a=rim[i],b=rim[(i+1)%rim.length],at=p.length/3;for(const j of[a,b,b+count,a+count])p.push(...p.slice(j*3,j*3+3));uv.push(0,0,1,0,1,1,0,1);ix.push(...(flip?[at,at+2,at+1,at,at+3,at+2]:[at,at+1,at+2,at,at+2,at+3]));}
  }
  geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(ix);material.side=THREE.DoubleSide;return skinGeo(geo,material,slot,name);
 }
 function tube(slot,name,points,radius,material,closed=false){if(closed&&points[0].distanceToSquared(points.at(-1))<1e-12)points=points.slice(0,-1);const curve=new THREE.CatmullRomCurve3(points,closed,'centripetal'),geo=new THREE.TubeGeometry(curve,Math.max(8,Math.min(100,points.length*2)),radius,5,closed);return skinGeo(geo,material,slot,name);}
 function placeGeo(slot,name,geo,material,point,normal,size=1,turn=0){const q=new THREE.Quaternion().setFromUnitVectors(V(0,0,1),normal.clone().normalize()),mat=M().compose(point,q,V(size,size,size));if(turn)mat.multiply(M().makeRotationZ(turn));geo.applyMatrix4(mat);return skinGeo(geo,material,slot,name);}
 // Premium collections use the same fitted surfaces and materials. These
 // small raised settings add distinct craft/silhouette without animation loops.
 function premiumEmbellishment(slot,d,mat,point,normal,size){
  const theme=d.premiumTheme;if(!['starlight','dragonfire','blossom','glacier','forestguardian'].includes(theme))return;
  const q=new THREE.Quaternion().setFromUnitVectors(V(0,0,1),normal.clone().normalize()),at=(x,y,z=.23)=>V(x,y,z).multiplyScalar(size).applyQuaternion(q).add(point);
  const plate=(name,shapes,material=mat.metal,depth=.10)=>placeGeo(slot,name,new THREE.ExtrudeGeometry(shapes,{depth,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.025,bevelThickness:.025,curveSegments:5}),material,at(0,0),normal,size);
  if(theme==='starlight'){
   const stars=[[-1.00,.73],[-.12,1.34],[.92,.96]];tube(slot,'Starlight constellation inlay',stars.map(([x,y])=>at(x,y)),size*.024,mat.metal);
   for(const [x,y]of stars)placeGeo(slot,'Starlight moonstone setting',new THREE.OctahedronGeometry(1,0),mat.gem,at(x,y,.29),normal,size*.135);
  }else if(theme==='dragonfire'){
   const flames=[];for(const side of[-1,1]){const shape=new THREE.Shape();shape.moveTo(side*.40,-.55);shape.bezierCurveTo(side*1.34,-.05,side*1.29,.42,side*.72,1.39);shape.bezierCurveTo(side*.92,.31,side*.31,.52,side*.40,-.55);shape.closePath();flames.push(shape);}plate('Dragonfire swept flame crest',flames,mat.metal,.11);
  }else if(theme==='blossom'){
   const petals=[];for(let i=0;i<5;i++){const a=i*Math.PI*2/5,shape=new THREE.Shape(),xy=(x,y)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];shape.moveTo(...xy(0,.09));shape.bezierCurveTo(...xy(-.48,.44),...xy(-.33,.90),...xy(0,.81));shape.bezierCurveTo(...xy(.33,.90),...xy(.48,.44),...xy(0,.09));shape.closePath();petals.push(shape);}plate('Cherry Blossom layered petals',petals,mat.edge,.17);
   placeGeo(slot,'Cherry Blossom gold pollen centre',new THREE.SphereGeometry(1,8,5),mat.metal,at(0,0,.48),normal,size*.17);
  }else if(theme==='glacier'){
   for(const [x,y,height,turn]of[[-.56,.15,.57,-.23],[0,.38,.90,0],[.56,.15,.57,.23]]){const crystal=new THREE.OctahedronGeometry(1,0);crystal.scale(.20,height,.20);placeGeo(slot,'Glacier faceted crystal cluster',crystal,mat.gem,at(x,y,.37),normal,size,turn);}
  }else{
   const leaves=[];for(const side of[-1,1]){const shape=new THREE.Shape();shape.moveTo(side*.60,-.55);shape.bezierCurveTo(side*1.65,-.14,side*1.28,.67,side*.80,.94);shape.bezierCurveTo(side*.49,.12,side*.37,-.02,side*.60,-.55);shape.closePath();leaves.push(shape);tube(slot,'Forest Guardian golden leaf vein',[at(side*.60,-.55,.38),at(side*.82,.13,.38),at(side*.80,.90,.38)],size*.024,mat.metal);}plate('Forest Guardian paired leaf border',leaves,mat.edge,.12);
  }
 }
 function ornament(slot,d,mat,point,normal,size){
  const kind=d.ornament,shape=new THREE.Shape(),outline=[],add=(x,y)=>outline.push([x,y]);let shapes=[shape];
  const radial=(count,inner=.45,phase=Math.PI/2)=>{for(let i=0;i<count*2;i++){const a=phase+i*Math.PI/count,r=i%2?inner:1;add(Math.cos(a)*r,Math.sin(a)*r);}};
  if(kind==='crescent'){shape.absarc(0,0,1,.6,Math.PI*2-.6,false);shape.absarc(.48,0,.79,Math.PI*2-.45,.45,true);}
  else if(['leaf','feather','wisp','flame'].includes(kind)){shape.moveTo(0,-1);shape.bezierCurveTo(-1,-.3,-.8,.4,kind==='flame'?.12:0,1);shape.bezierCurveTo(kind==='wisp'?-.2:.85,.45,1,-.25,0,-1);}
  else if(kind==='bolt')outline.push([.05,1],[-.72,-.12],[-.08,-.12],[-.25,-1],[.74,.18],[.10,.18]);
  else if(kind==='compass'){for(let i=0;i<16;i++){const a=i*Math.PI/8,r=i%2?.18:i%4===0?1:.6;add(Math.sin(a)*r,Math.cos(a)*r);}}
  else if(kind==='snowflake')radial(6,.29);
  else if(kind==='maple')outline.push([0,1],[.2,.53],[.55,.72],[.46,.22],[1,.32],[.72,-.12],[.87,-.39],[.24,-.5],[.09,-1],[-.09,-1],[-.24,-.5],[-.87,-.39],[-.72,-.12],[-1,.32],[-.46,.22],[-.55,.72],[-.2,.53]);
  else if(kind==='thorn')radial(5,.19);
  else if(kind==='star')radial(5,.45);
  else if(kind==='crystal')outline.push([0,1],[.61,.38],[.46,-.55],[0,-1],[-.46,-.55],[-.61,.38]);
  else if(kind==='shell'){shape.moveTo(0,-.8);for(let i=0;i<=12;i++){const a=Math.PI*(i/12),r=1+(i%2?.1:0);shape.lineTo(Math.cos(a)*r,Math.sin(a)*r-.25);}shape.closePath();}
  else if(kind==='moth'||kind==='ribbon'){shape.moveTo(0,.2);shape.bezierCurveTo(-1,1,-1.1,-.6,0,-.2);shape.bezierCurveTo(1.1,-.6,1,1,0,.2);}
  else if(kind==='wave'){for(let i=0;i<=30;i++){const x=i/15-1;add(x,Math.sin(x*5)*.27+.26);}for(let i=30;i>=0;i--){const x=i/15-1;add(x,Math.sin(x*5)*.27-.26);}}
  else if(['rose','orchid','thistle'].includes(kind)){const count=kind==='rose'?9:kind==='orchid'?5:14;for(let i=0;i<80;i++){const a=i/80*Math.PI*2,r=.74+.24*Math.cos(a*count);add(Math.cos(a)*r,Math.sin(a)*r);}}
  else if(kind==='pearl'){placeGeo(slot,'Pearl button',new THREE.SphereGeometry(.82,12,8),mat.gem,point,normal,size);return;}
  else if(['wheat','vine','lavender','reeds','laurel'].includes(kind)){
   shapes=[];const stem=(x,top,bottom=-1)=>{const s=new THREE.Shape();s.moveTo(x-.045,bottom);s.lineTo(x+.045,bottom);s.lineTo(x+.035,top);s.lineTo(x-.035,top);s.closePath();shapes.push(s);};
   const leaf=(x,y,rx,ry,turn=0)=>{const s=new THREE.Shape();for(let i=0;i<=20;i++){const a=i/20*Math.PI*2,px=Math.cos(a)*rx,py=Math.sin(a)*ry,nx=x+px*Math.cos(turn)-py*Math.sin(turn),ny=y+px*Math.sin(turn)+py*Math.cos(turn);if(i)s.lineTo(nx,ny);else s.moveTo(nx,ny);}s.closePath();shapes.push(s);};
   if(kind==='reeds'){for(const [x,top]of[[-.45,.65],[0,1],[.45,.42]]){stem(x,top-.12);leaf(x,top-.12,.11,.30);} }
   else if(kind==='laurel'){for(const side of[-1,1])for(let j=0;j<5;j++){const a=j/5*Math.PI*.75,x=side*(.25+.42*Math.sin(a)),y=-.76+j*.34;leaf(x,y,.14,.27,-side*(.42+j*.16));}}
   else if(kind==='lavender'){stem(0,.92);for(let j=0;j<5;j++)for(const side of[-1,1])leaf(side*(.17-j*.022),-.05+j*.22,.12-j*.010,.145,side*.45);leaf(-.3,-.56,.12,.32,-.7);leaf(.3,-.37,.12,.32,.7);}
   else{stem(0,.96);const count=kind==='wheat'?5:3;for(let j=0;j<count;j++)for(const side of[-1,1])leaf(side*(kind==='wheat'?.22:.34),-.59+j*(kind==='wheat'?.29:.52),kind==='wheat'?.11:.21,kind==='wheat'?.22:.34,-side*.68);}
  }
  else radial(7,.6);
  if(outline.length){shape.moveTo(...outline[0]);for(const p of outline.slice(1))shape.lineTo(...p);shape.closePath();}
  const geo=new THREE.ExtrudeGeometry(shapes,{depth:.15,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.035,bevelThickness:.035,curveSegments:10});placeGeo(slot,kind+' engraved emblem',geo,mat.metal,point,normal,size);
  if(!['wheat','vine','lavender','reeds','laurel','pearl'].includes(kind))placeGeo(slot,'Inset '+kind+' stone',new THREE.OctahedronGeometry(.20,0),mat.gem,point.clone().addScaledVector(normal,size*.20),normal,size);
  premiumEmbellishment(slot,d,mat,point,normal,size);
 }
 function buckle(slot,mat,point,normal,width=.040,height=.048,turn=0){
  const shape=new THREE.Shape(),hole=new THREE.Path(),w=width/2,h=height/2,r=Math.min(w,h)*.22;
  shape.moveTo(-w+r,-h);shape.lineTo(w-r,-h);shape.quadraticCurveTo(w,-h,w,-h+r);shape.lineTo(w,h-r);shape.quadraticCurveTo(w,h,w-r,h);shape.lineTo(-w+r,h);shape.quadraticCurveTo(-w,h,-w,h-r);shape.lineTo(-w,-h+r);shape.quadraticCurveTo(-w,-h,-w+r,-h);
  hole.moveTo(-w*.61,-h*.62);hole.lineTo(-w*.61,h*.62);hole.lineTo(w*.61,h*.62);hole.lineTo(w*.61,-h*.62);hole.closePath();shape.holes.push(hole);
  placeGeo(slot,'Rounded cast buckle',new THREE.ExtrudeGeometry(shape,{depth:.004,bevelEnabled:true,bevelSize:.0014,bevelThickness:.0014,bevelSegments:1,curveSegments:3,steps:1}),mat.metal,point,normal,1,turn);
  placeGeo(slot,'Buckle tongue',new THREE.BoxGeometry(.003,height*.75,.004),mat.metal,point.clone().addScaledVector(normal,.005),normal,1,turn);
 }
 function rim(slot,d,mat,points,r=.007){
  tube(slot,d.trim+' rolled bound edge',points,r,mat.edge,true);
  if(d.trim==='double')tube(slot,'Inner double binding',points.map(p=>p.clone().lerp(seat,.020)),r*.48,mat.metal,true);
  if(d.trim==='studded')for(let i=0;i<points.length;i+=4)placeGeo(slot,'Edge rivet',new THREE.SphereGeometry(r*.72,6,4),mat.metal,points[i],V(0,1,0));
  if(d.trim==='braid')for(const phase of[0,Math.PI])tube(slot,'Braided border strand',points.map((p,i)=>p.clone().add(V(Math.sin(i*2.4+phase)*r*.54,Math.cos(i*2.4+phase)*r*.54,0))),r*.30,mat.leather,true);
  if(d.trim==='scallop')tube(slot,'Scalloped stitched binding',points.map((p,i)=>p.clone().lerp(seat,.012+.008*(1+Math.cos(i*Math.PI/2)))),r*.35,mat.metal,true);
 }
 function pad(d,mat){const profile=d.profile,half=(profile==='round'?.32:profile==='swallowtail'?.40:.365)*fitLength,spread=profile==='shield'?1.36:1.28;
  const sample=(u,v,lift=.039)=>{const a=(u*2-1)*spread,s=Math.abs(u*2-1);let front=half,backHalf=half;
   if(profile==='round'){front*=Math.sqrt(Math.max(.12,1-.56*s*s));backHalf=front;}
   if(profile==='swallowtail')backHalf*=1+.23*s-.16*(1-s);if(profile==='shield')backHalf*=1.1-.36*s;if(profile==='scallop')backHalf+=.025*Math.cos(u*Math.PI*8);
   return back(seat.z-backHalf+(front+backHalf)*v,a,lift);};
  patch('pad','Thick quilted '+profile+' pad',mat.cloth,24,20,(u,v)=>sample(u,v),.017);
  if(mat.rainbowCloth)for(const side of[0,1])patch('pad','Dyed rainbow quilted side panel',mat.rainbowCloth,8,24,(u,v)=>sample(side?1-(.075+u*.23):.075+u*.23,.065+v*.86,.047),.005);
  // Broad contrast binding is a cut fabric band, with a rolled outer finish.
  for(const side of[0,1])patch('pad','Tailored side binding',mat.edge,3,20,(u,v)=>sample(side?1-u*.065:u*.065,v,.044),.006);
  for(const end of[0,1])patch('pad','Tailored end binding',mat.edge,24,2,(u,v)=>sample(u,end?1-v*.046:v*.046,.044),.006);
  const outline=[];for(let i=0;i<=24;i++)outline.push(sample(i/24,0,.047));for(let i=1;i<=20;i++)outline.push(sample(1,i/20,.047));for(let i=23;i>=0;i--)outline.push(sample(i/24,1,.047));for(let i=19;i>=1;i--)outline.push(sample(0,i/20,.047));rim('pad',d,mat,outline,.007);
  for(const side of[0,1]){const p=sample(side,.21,.052);ornament('pad',d,mat,p,V(side?1:-1,.15,0),.049+(d.variant%3)*.003);}
  if(profile==='swallowtail')for(const side of[0,1]){const p=sample(side,0,.045);tube('pad','Short woven corner tassel',[p,p.clone().add(V(0,-.033,0))],.006,mat.edge);}
 }
 function nativeSaddleSupports(d,mat){
  const scale=clamp(seat.y/1.74,.7,1.25),hornZ=seat.z+.20*fitLength;
  placeGeo('saddle','Fitted Western horn',new THREE.CylinderGeometry(.020*scale,.028*scale,.086*scale,12),mat.leather,V(0,seat.y+.086*scale,hornZ),V(0,0,1));const cap=new THREE.SphereGeometry(.034*scale,12,8);cap.scale(1,.42,1);placeGeo('saddle','Fitted horn cap',cap,mat.leather,V(0,seat.y+.132*scale,hornZ),V(0,0,1));
  patch('saddle','Fitted padded girth',mat.leather,3,40,(u,v)=>back(seat.z+.075*fitLength+(u-.5)*.055*scale,.90+v*(Math.PI*2-1.8),.022),.008);
  for(const contact of nativeTreads){if(!contact.point||!contact.weights)continue;const end=contact.point.clone(),side=Math.sign(end.x)||1,top=saddleBack(seat.z+.10*fitLength,side*1.34,.099),ironCenter=end.clone().add(V(0,.044*scale,0)),join=ironCenter.clone().add(V(0,.054*scale,0)),topWeights=weights[nearest(top)],axis=join.clone().sub(top),lengthSq=axis.lengthSq();
   withWeights(p=>mixWeights(topWeights,contact.weights,clamp(p.clone().sub(top).dot(axis)/lengthSq,0,1)),()=>patch('saddle','Fitted stirrup leather',mat.leather,2,12,(u,v)=>top.clone().lerp(join,v).add(V(0,0,(u-.5)*.031*scale)),.008));
   withWeights(()=>contact.weights,()=>{const iron=new THREE.TorusGeometry(.048*scale,.006*scale,7,22);iron.scale(.81,1,1);placeGeo('saddle','Contact-fitted stirrup iron',iron,mat.metal,ironCenter,V(side,0,0));placeGeo('saddle','Contact-fitted stirrup tread',new THREE.BoxGeometry(.020*scale,.012*scale,.071*scale),mat.metal,end.clone().add(V(0,-.006*scale,0)),V(0,0,1));});
  }
 }
 function nativeBridleSupports(d,mat){
  tube('bridle','Fitted crownpiece',Array.from({length:35},(_,i)=>head(.995,(i/34*2-1)*1.66,.021)),.008,mat.leather);
  for(let i=0;i<nativeBits.length;i++){const bit=nativeBits[i],contact= nativeBitWeights[i];if(!bit||!contact)continue;const side=Math.sign(bit.clone().sub(headMuzzle).dot(headSide)),top=head(.98,side*1.62,.025),bottom=head(.35,side*1.54,.027),cheek=Array.from({length:20},(_,j)=>head(.98-j/19*.63,side*1.60,.025));tube('bridle','Fitted headstall strap',cheek,.007,mat.leather);
   const axis=bit.clone().sub(bottom),lengthSq=axis.lengthSq(),topWeights=weights[nearest(bottom)];withWeights(p=>mixWeights(topWeights,contact,clamp(p.clone().sub(bottom).dot(axis)/lengthSq,0,1)),()=>tube('bridle','Fitted bit connector',[bottom,bottom.clone().lerp(bit,.5),bit],.007,mat.leather));
   withWeights(()=>contact,()=>placeGeo('bridle','Contact-fitted bit ring',new THREE.TorusGeometry(.024,.004,7,22),mat.metal,bit,headSide.clone().multiplyScalar(side)));
  }
 }
 function saddle(d,mat){
  const profile=d.profile,length=({trail:.32,roper:.34,endurance:.28,show:.365,barrel:.27}[profile]||.3)*fitLength,spread=profile==='show'?1.10:1.01;
  const sample=(u,v,lift=.081)=>{const s=Math.abs(u*2-1),a=(u*2-1)*spread;let end=length*(1-.14*s*s);if(profile==='show')end+=.017*Math.sin(u*Math.PI*6);if(profile==='barrel')end*=Math.sqrt(Math.max(.16,1-.55*s*s));return saddleBack(seat.z+(v*2-1)*end,a,lift);};
  patch('saddle',profile+' thick tooled leather skirts',mat.leather,20,16,(u,v)=>sample(u,v),.018);
  const outline=[];for(let i=0;i<=20;i++)outline.push(sample(i/20,0,.088));for(let i=1;i<=16;i++)outline.push(sample(1,i/16,.088));for(let i=19;i>=0;i--)outline.push(sample(i/20,1,.088));for(let i=15;i>=1;i--)outline.push(sample(0,i/16,.088));rim('saddle',d,mat,outline,.008);
  for(const side of[0,1]){
   patch('saddle','Inset shaped skirt panel',mat.rainbowLeather||mat.edge,5,10,(u,v)=>sample(side?1-.19*u:.19*u,.12+v*.73,.087),.005);
   const p=sample(side,.27,.100);ornament('saddle',d,mat,p,V(side?1:-1,.35,0),.050);
  }
  // The seat centre stays at the native rider contact height. Raised padded
  // sides, a sculpted rear wall and pommel frame add volume around that seat.
  const seatWidth=(profile==='roper'?.188:profile==='barrel'?.159:.176)*fitWidth,seatLength=(profile==='show'?.237:.218)*fitLength;
  patch('saddle','Inset cushioned Western seat',mat.leather,14,16,(u,v)=>{const x=(u*2-1)*seatWidth,z=(v*2-1)*seatLength;return V(x,seat.y+.012+.033*Math.pow(Math.abs(x/seatWidth),3)+.027*Math.pow(Math.abs(z/seatLength),4),seat.z+z);},.026);
  const cantleHeight={trail:.120,roper:.135,endurance:.105,show:.156,barrel:.132}[profile],cantleZ=seat.z-seatLength+.008;
  const cantle=(u,v)=>{const x=(u*2-1)*seatWidth*1.12,a=u*Math.PI,top=seat.y+.045+cantleHeight*Math.pow(Math.sin(a),.60),y=seat.y+.012+(top-seat.y-.012)*v,z=cantleZ-.035*Math.sin(a)-.017*v;return V(x,y,z);};
  patch('saddle','Sculpted '+profile+' padded cantle',mat.leather,20,6,cantle,.031);
  if(mat.rainbowLeather)patch('saddle','Rainbow cantle inlay',mat.rainbowLeather,24,3,(u,v)=>cantle(.08+u*.84,.49+v*.29).add(V(0,0,-.035)),.004);
  const crest=Array.from({length:25},(_,i)=>cantle(i/24,1));tube('saddle','Rolled cantle cushion',crest,.016,mat.edge);tube('saddle','Cantle inset metal stitching',crest.map(p=>p.clone().add(V(0,-.022,-.018))),.0035,mat.metal);
  ornament('saddle',d,mat,cantle(.5,.60).add(V(0,0,-.037)),V(0,0,-1),.047);
  const pommel=Array.from({length:23},(_,i)=>{const t=i/22,a=t*Math.PI;return V(Math.cos(a)*seatWidth,seat.y+.044+Math.sin(a)*(profile==='roper'?.084:.065),seat.z+seatLength-.008);});
  tube('saddle','Padded swept pommel',pommel,.023,mat.leather);tube('saddle','Pommel rolled trim',pommel.map(p=>p.clone().add(V(0,.011,.014))),.005,mat.rainbowLeather||mat.edge);
  ornament('saddle',d,mat,V(0,seat.y+.074,seat.z+seatLength+.019),V(0,0,1),.029);
  // Broad layered fenders read from the side; the original native stirrups and
  // rider contact remain untouched. The stand-alone artist view gets stirrups.
  for(const side of[-1,1]){
   const fender=(u,v,lift=.091)=>saddleBack(seat.z+.10*fitLength+(u-.5)*(.17-.055*v)*fitLength,side*(.70+v*.68),lift);
   patch('saddle','Layered tapered Western fender',mat.leather,7,12,(u,v)=>fender(u,v),.014);
   patch('saddle','Tooled inset fender plaque',mat.rainbowLeather||mat.edge,6,8,(u,v)=>fender(.5+(u-.5)*(.45+.25*Math.sin(v*Math.PI)),.17+v*.43,.101),.004);
   ornament('saddle',d,mat,fender(.5,.39,.112),V(side,.05,0),.049);
   tube('saddle','Fender rolled edge',Array.from({length:18},(_,i)=>fender(side>0?1:0,i/17,.102)),.0045,mat.edge);
   buckle('saddle',mat,fender(.5,.76,.107),V(side,.10,0),.041,.056);
  }
  if(profile==='trail'||profile==='endurance')for(const side of[-1,1]){const p=sample(side>0?1:0,.13,.113),geo=new THREE.SphereGeometry(1,12,8);geo.scale(.030,.057,.077);placeGeo('saddle','Rounded leather trail pouch',geo,mat.leather,p.clone().add(V(side*.012,-.026,0)),V(0,0,1));buckle('saddle',mat,p.clone().add(V(side*.040,-.018,0)),V(side,0,0),.024,.031);}
  if(nativeHorse)nativeSaddleSupports(d,mat);
  if(!nativeHorse&&!rig.henryRoot&&!tack.saddle){
   placeGeo('saddle','Western horn',new THREE.CylinderGeometry(.021,.033,.105,12),mat.leather,V(0,seat.y+.112,seat.z+.20),V(0,0,1));const cap=new THREE.SphereGeometry(.038,12,8);cap.scale(1,.45,1);placeGeo('saddle','Rounded horn cap',cap,mat.leather,V(0,seat.y+.165,seat.z+.20),V(0,0,1));
   for(const side of[-1,1]){const top=back(seat.z+.13,side*.68,.10),end=V(side*.27,seat.y-.43,seat.z+.17);tube('saddle','Stirrup leather',[top,top.clone().lerp(end,.5).add(V(side*.02,0,0)),end],.012,mat.leather);const iron=new THREE.TorusGeometry(.050,.006,7,22);iron.scale(.80,1,1);placeGeo('saddle','Western stirrup',iron,mat.metal,end,V(side,0,0));placeGeo('saddle','Stirrup tread',new THREE.BoxGeometry(.018,.014,.078),mat.metal,end.clone().add(V(0,-.048,0)),V(0,0,1));}
  }
 }
 function bridle(d,mat){
  const profile=d.profile,n=35,brow=[];for(let i=0;i<n;i++){const t=i/(n-1),a=(t*2-1)*1.52,drop=profile==='crescent'?.12*Math.sin(t*Math.PI):profile==='crown'?-.040*Math.sin(t*Math.PI):0;brow.push(head(.84-drop,a,.026));}
  const normalAt=i=>brow[i].clone().sub(headMuzzle.clone().lerp(headPoll,.84)).normalize();
  patch('bridle',profile+' padded browband',mat.rainbowLeather||mat.leather,n-1,3,(u,v)=>{const i=Math.round(u*(n-1)),width=profile==='crown'?.047:.035;return brow[i].clone().addScaledVector(headAxis,(v-.5)*width);},.006);
  for(const sign of[-1,1])tube('bridle','Browband rolled edge',brow.map(p=>p.clone().addScaledVector(headAxis,sign*.018)),.0038,sign>0?mat.metal:mat.edge);
  if(profile==='plaited')for(const phase of[0,Math.PI])tube('bridle','Plaited brow strand',brow.map((p,i)=>p.clone().addScaledVector(headAxis,Math.sin(i*.8+phase)*.011).addScaledVector(headFront,.006)),.0038,phase?mat.edge:mat.leather);
  const at=profile==='browband'?[7,12,17,22,27]:profile==='crown'?[9,17,25]:[17];for(const i of at)ornament('bridle',d,mat,brow[i].clone().addScaledVector(normalAt(i),.010),normalAt(i),i===17?.028:.018);
  for(const side of[-1,1]){
   patch('bridle','Shaped padded cheekpiece',mat.leather,5,14,(u,v)=>{const f=.38+v*.48,width=.12+.070*Math.sin(v*Math.PI);return head(f,side*(1.47+(u-.5)*width),.029);},.008);
   if(mat.rainbowCloth)patch('bridle','Rainbow cheekpiece inset',mat.rainbowCloth,3,14,(u,v)=>head(.43+v*.30,side*(1.47+(u-.5)*.105),.039),.004);
   tube('bridle','Cheekpiece contrast seam',Array.from({length:20},(_,i)=>head(.38+i/19*.48,side*1.54,.036)),.0033,mat.edge);
   const p=head(.65,side*1.49,.040);ornament('bridle',d,mat,p,V(side,0,0),.026);buckle('bridle',mat,head(.80,side*1.49,.042),V(side,0,0),.024,.033);
  }
  if(nativeHorse)nativeBridleSupports(d,mat);
  if(!nativeHorse&&!rig.henryRoot&&!tack.bridle){
   tube('bridle','Western crownpiece',Array.from({length:35},(_,i)=>head(.995,(i/34*2-1)*1.66,.019)),.009,mat.leather);
   for(const side of[-1,1]){const cheek=Array.from({length:31},(_,i)=>head(.99-i/30*.85,side*1.62,.024));tube('bridle','Fitted cheek strap',cheek,.007,mat.leather);placeGeo('bridle','Bit ring',new THREE.TorusGeometry(.019,.0035,6,20),mat.metal,cheek.at(-1),V(side,0,0));}
  }
 }
 function shoes(d,mat){const profile=d.profile,bottom=profile==='guards'?-.18:.065,height={wraps:.72,boots:.86,guards:.46,ribbon:.80,plated:.89}[profile]||.78;
  for(let k=0;k<4;k++){
   const n=24,m=10,sample=(u,v,lift=.014)=>{const angle=u*Math.PI*2,cut=(profile==='boots'||profile==='plated')?-.095*Math.cos(angle)*(v*v):profile==='guards'?.055*Math.cos(angle)*v:0,t=bottom+height*v+cut;let l=lift;if(profile==='boots')l+=.009*Math.sin(v*Math.PI);if(profile==='guards')l+=.014*(1-v);if(profile==='plated')l+=.004*Math.sin(u*Math.PI*6)**2;return leg(k,t,angle,l);};
   patch('shoes',profile+' shaped padded leg '+(k+1),mat.rainbowCloth||(profile==='boots'||profile==='plated'?mat.leather:mat.cloth),n,m,(u,v)=>sample(u,v),.007,true);
   for(const v of[.015,.985])tube('shoes','Soft rolled leg opening',Array.from({length:25},(_,i)=>sample(i/24,v,.019)),.0038,mat.edge,true);
   if(profile==='wraps'||profile==='ribbon'){
    // Flat overlapping cloth bands, not rigid spiral ropes.
    patch('shoes','Overlapping woven wrap',mat.rainbowCloth?mat.leather:(profile==='ribbon'?mat.edge:mat.cloth),54,2,(u,v)=>sample((u*3.15)%1,.075+u*.81+(v-.5)*.065,.020),.003,true);
    tube('shoes','Fine wrap seam',Array.from({length:76},(_,i)=>sample((i/75*3.15)%1,.075+i/75*.81+.032,.021)),.0016,mat.leather);
   }else{
    patch('shoes','Sculpted front protection panel',profile==='plated'?mat.metal:mat.edge,10,7,(u,v)=>sample((u-.5)*.33,.15+v*.68,.028),.007,true);
    for(const v of[.24,.72])patch('shoes','Broad fitted fastening strap',mat.edge,24,2,(u,w)=>sample(u,v+(w-.5)*.090,.026),.004,true);
   }
   const side=k%2===0?1:-1,outer=side>0?.25:.75,normal=legFrames[k].u.clone().multiplyScalar(side);
   ornament('shoes',d,mat,sample(outer,.48,.036),normal,profile==='guards'?.019:.024);
   buckle('shoes',mat,sample(outer,.78,.034),normal,.026,.032);
  }
 }
 function styledMaterial(mat,d){const copy=mat.clone(),metal=mat.metalness>.5;copy.color.set(metal?d.metal:d.leather);copy.roughness=metal?.27:.49;
   // Preserve the artist's authored wrinkles, UV detail and normal map while
   // removing baked brown pigment. Multiplying another brown tint cannot make
   // the native foundation match an ivory, lilac or teal collection.
   if(mat.map&&!metal){const before=copy.onBeforeCompile;copy.onBeforeCompile=function(shader,renderer){before?.call(this,shader,renderer);shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
    vec4 tackSource = texture2D(map, vMapUv);
    float tackLuminance = dot(tackSource.rgb, vec3(0.2126, 0.7152, 0.0722));
    float tackRelief = clamp(pow(max(tackLuminance, 0.0001), 0.32) * 1.37, 0.26, 1.16);
    diffuseColor *= vec4(vec3(tackRelief), tackSource.a);
    #endif`);};copy.customProgramCacheKey=()=> 'collection-neutral-leather-v2';copy.userData.collectionNeutralLeather=true;}
   resources.add(copy);return copy;}
 function overrideMaterial(object,d,slot){if(!object)return;object.traverse(o=>{if(!o.isMesh)return;const original=o.material,old=Array.isArray(original)?original:[original];if(slot==='saddle'&&old.includes(tack.saddle?.userData.mats?.pad))return;const next=old.map(mat=>styledMaterial(mat,d));o.material=Array.isArray(original)?next:next[0];overrides.push({object:o,original,next,colors:next.map(m=>m.color.clone()),roughness:next.map(m=>m.roughness),slot});});}
 function makeRestingReins(piece){
  if(!nativeHorse||!piece||!slotGroups.bridle||!nativeReinIndices.length)return;const mesh=rig.nativeContacts.tack,sourceGeometry=mesh.geometry,d=piece.design||piece,unique=[...nativeReinVertices],remap=new Map(unique.map((value,i)=>[value,i])),geo=new THREE.BufferGeometry();
  for(const [name,attribute]of Object.entries(sourceGeometry.attributes)){const data=new attribute.array.constructor(unique.length*attribute.itemSize);for(let i=0;i<unique.length;i++)for(let k=0;k<attribute.itemSize;k++)data[i*attribute.itemSize+k]=attribute.array[unique[i]*attribute.itemSize+k];geo.setAttribute(name,new THREE.BufferAttribute(data,attribute.itemSize,attribute.normalized));}
  geo.setIndex(nativeReinIndices.map(i=>remap.get(i)));geo.computeBoundingSphere();const original=Array.isArray(mesh.material)?mesh.material[1]:mesh.material,material=d.nativeOriginal?original.clone():styledMaterial(original,d);material.side=THREE.DoubleSide;resources.add(material);resources.add(geo);
  restingReins=new THREE.SkinnedMesh(geo,material);restingReins.name='Resting leather reins';restingReins.bind(mesh.skeleton,mesh.bindMatrix);restingReins.bindMode=mesh.bindMode;restingReins.matrixAutoUpdate=false;restingReins.castShadow=true;restingReins.receiveShadow=true;restingReins.frustumCulled=false;nativeBatchSources.set(restingReins,mesh);restingReins.userData.sourceVertexIds=unique;restingReins.userData.restingReins=true;slotGroups.bridle.add(restingReins);batches.push(restingReins);
  stats.vertices+=unique.length;stats.triangles+=nativeReinIndices.length/3;stats.meshes++;stats.pieces.bridle.vertices+=unique.length;stats.pieces.bridle.triangles+=nativeReinIndices.length/3;stats.restingReins={triangles:nativeReinIndices.length/3,vertices:unique.length,mode:state.reinsMode};
 }
 // A native source has saddle, bridle and straps in combined meshes. Partition
 // only its current display index (after the rider's rein clone); preserve all
 // source vertices/weights and restore that exact geometry when this kit clears.
 function nativeFoundation(designs){
  if(!nativeHorse)return;const found=[];rig.scene.traverse(o=>{if(o.isSkinnedMesh&&/^M_Saddle[12]$/.test(o.material?.name||''))found.push(o);});
  stats.nativeFoundation={meshes:found.length,saddleTriangles:0,bridleTriangles:0};
  for(const object of found){const original=object.geometry,material=object.material,g=original.clone(),ix=original.index?.array;if(!ix){g.dispose();continue;}
   const count=original.attributes.position.count,parent=Array.from({length:count},(_,i)=>i),find=i=>{while(parent[i]!==i)i=parent[i]=parent[parent[i]];return i;};
   for(let i=0;i<ix.length;i+=3){const r=find(ix[i]);parent[find(ix[i+1])]=r;parent[find(ix[i+2])]=r;}
   const componentIds=new Map();for(let i=0;i<count;i++){const root=find(i);if(!componentIds.has(root))componentIds.set(root,componentIds.size);}
   const scores=new Map(),weights=original.attributes.skinWeight,indices=original.attributes.skinIndex;
   for(let i=0;i<count;i++){const root=find(i),score=scores.get(root)||[0,0];for(let k=0;k<4;k++){const weight=weights.getComponent(i,k),name=object.skeleton.bones[indices.getComponent(i,k)].name;score[/head|jaw|lip|nose|reins/i.test(name)?1:0]+=weight;}scores.set(root,score);}
   // These twelve connected UV islands are the source pad's two faces and
   // bound perimeter. The smaller skirt, fenders and girth belong to saddle.
   // All native roster variants retain this exact 5092-vertex topology.
   const padParts=new Set([12,13,14,15,16,38,46,47,57,58,59,60]);
   const triangles=[[],[],[],[],[]];for(let i=0;i<ix.length;i+=3){const root=find(ix[i]),score=scores.get(root);let slot=score[1]>score[0]?1:0;if(material.name==='M_Saddle1')slot=count===5092&&componentIds.size===65&&padParts.has(componentIds.get(root))?3:2;if(material.name==='M_Saddle2'&&nativeReinVertices.has(ix[i])&&nativeReinVertices.has(ix[i+1])&&nativeReinVertices.has(ix[i+2]))slot=4;triangles[slot].push(ix[i],ix[i+1],ix[i+2]);}
   const roles=['saddle','bridle','saddle','pad','sourceReins'],next=roles.map(()=>{const m=material.clone();resources.add(m);return m;});
   g.setIndex(triangles.flat());g.clearGroups();let offset=0;for(let i=0;i<roles.length;i++){g.addGroup(offset,triangles[i].length,i);offset+=triangles[i].length;}object.geometry=g;object.material=next;resources.add(g);
   const selected=roles.map(slot=>(designs[slot]?.design||designs[slot])?.nativeOriginal===true);
   nativeFoundations.push({object,geometry:original,material,visible:object.visible,next,counts:triangles.map(a=>a.length),selected,roles});stats.nativeFoundation.saddleTriangles+=(triangles[0].length+triangles[2].length)/3;stats.nativeFoundation.bridleTriangles+=triangles[1].length/3;stats.nativeFoundation.padTriangles=(stats.nativeFoundation.padTriangles||0)+triangles[3].length/3;stats.nativeFoundation.hiddenSourceReinTriangles=(stats.nativeFoundation.hiddenSourceReinTriangles||0)+triangles[4].length/3;
   for(let i=0;i<4;i++)if(selected[i]&&stats.pieces[roles[i]])stats.pieces[roles[i]].sourceTriangles=(stats.pieces[roles[i]].sourceTriangles||0)+triangles[i].length/3;

  }
 }
 function clear(){restingReins=null;delete stats.restingReins;for(const e of nativeFoundations){e.object.geometry=e.geometry;e.object.material=e.material;e.object.visible=e.visible;}nativeFoundations.length=0;for(const o of overrides){o.object.material=o.original;}overrides.length=0;for(const [obj,visible]of hiddenOriginals)obj.visible=visible;hiddenOriginals.clear();for(const mesh of batches)mesh.removeFromParent();batches.length=0;for(const r of resources)r.dispose?.();resources.clear();for(const tex of textures)tex.dispose();textures.clear();group.clear();for(const slot of SLOTS)delete slotGroups[slot];stats.vertices=stats.triangles=stats.meshes=0;stats.pieces={};}
 function apply(designs={}){if(disposed)return api;const nextKey=JSON.stringify(SLOTS.map(slot=>designs[slot]?[slot,designs[slot].catalogId||designs[slot].id,designs[slot].design||designs[slot]]:null));if(nextKey===key)return api;clear();key=nextKey;current=designs;
  for(const slot of SLOTS){const piece=designs[slot];if(!piece)continue;const d=piece.design||piece;if(!d.profile)continue;const node=new THREE.Group();node.name='Collection '+slot;node.userData.catalogId=piece.catalogId||piece.id;slotGroups[slot]=node;group.add(node);if(nativeHorse&&d.nativeOriginal===true){stats.pieces[slot]={id:piece.catalogId||piece.id,profile:d.profile,nativeOriginal:true,vertices:0,triangles:0};continue;}const mat=materials(d),before={v:stats.vertices,t:stats.triangles};({saddle,pad,bridle,shoes})[slot](d,mat);mergeSlot(slot);stats.pieces[slot]={id:piece.catalogId||piece.id,profile:d.profile,ornament:d.ornament,fingerprint:tackDesignFingerprint({slot,design:d}),vertices:stats.vertices-before.v,triangles:stats.triangles-before.t};
   if(!nativeHorse&&slot==='saddle')overrideMaterial(rig.henryRoot?.getObjectByName('Object_115')||tack.saddle,d,slot);
   if(!nativeHorse&&slot==='bridle')overrideMaterial(rig.henryRoot?.getObjectByName('Object_12')||tack.bridle,d,slot);
  }
  if(designs.pad&&tack.saddle?.userData.mats?.pad){const material=tack.saddle.userData.mats.pad;tack.saddle.traverse(o=>{if(o.isMesh&&(o.material===material||Array.isArray(o.material)&&o.material.includes(material))){hiddenOriginals.set(o,o.visible);}});}
  makeRestingReins(designs.bridle);nativeFoundation(designs);update(0,state);return api;
 }
 const relative=M();
 function update(_dt=0,{bareback=tack.saddle?.visible===false,wild=false,reinsMode='resting'}={}){if(disposed)return;state={bareback,wild,reinsMode};group.visible=!wild;for(const [slot,node]of Object.entries(slotGroups))node.visible=!(bareback&&(slot==='saddle'||slot==='pad'));
  rig.scene.updateWorldMatrix(true,false);rig.scene.updateMatrixWorld(true);group.updateWorldMatrix(true,false);relative.copy(group.matrixWorld).invert().multiply(source.matrixWorld);
  for(const mesh of batches){if(nativeBatchSources.has(mesh))mesh.matrix.copy(group.matrixWorld).invert().multiply(nativeBatchSources.get(mesh).matrixWorld);else mesh.matrix.copy(relative);mesh.matrixWorldNeedsUpdate=true;mesh.updateMatrixWorld(true);}
  if(restingReins){restingReins.visible=!wild&&reinsMode==='resting';stats.restingReins.mode=reinsMode;}
  for(const entry of overrides)for(let i=0;i<entry.next.length;i++){entry.next[i].color.copy(entry.colors[i]);entry.next[i].roughness=entry.roughness[i];}
  for(const [obj]of hiddenOriginals)obj.visible=false;
  nativeVisibility?.({saddle:!!current.saddle&&!bareback&&!wild,bridle:!!current.bridle&&!wild});
  for(const e of nativeFoundations){for(let i=0;i<e.next.length;i++)e.next[i].visible=!wild&&(e.roles[i]==='bridle'||!bareback)&&e.selected[i];e.object.visible=!wild&&e.next.some((m,i)=>m.visible&&e.counts[i]>0);}


 }
 function dispose(){if(disposed)return;clear();group.removeFromParent();disposed=true;}
 const api={group,root:group,stats,apply,update,dispose,get equipped(){return current;}};apply(equippedDesigns);return api;
}
