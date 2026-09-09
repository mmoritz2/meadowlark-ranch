/* Fit tack to the authored head surface, then carry it in the head joint's
 * bind-local frame. Profile head landmarks describe the face, not its pivot. */
export function createArtistBridle(THREE,rig){
 const {skin,profile}=rig,bones=skin.skeleton.bones,headIndex=bones.findIndex(b=>b.name==='head');
 if(headIndex<0)throw new Error('Artist bridle requires the named head joint');
 const V=(...p)=>new THREE.Vector3(...p),A=profile.anchors;
 const muzzle=V(...A.muzzle[0]),poll=V(...A.poll[0]),axis=poll.clone().sub(muzzle),length=axis.length();axis.normalize();
 const side=V(1,0,0),dorsal=new THREE.Vector3().crossVectors(side,axis).normalize();if(dorsal.y<0)dorsal.negate();
 const bindToHead=new THREE.Matrix4().multiplyMatrices(skin.skeleton.boneInverses[headIndex],skin.bindMatrix);
 const size=(profile.withersM||1.55)/1.55,clearance=.008*size;
 const geo=skin.geometry,pos=geo.attributes.position,si=geo.attributes.skinIndex,sw=geo.attributes.skinWeight,index=geo.index;
 const projected=[],ownership=[],neck=[],ear=[];
 for(let i=0;i<pos.count;i++){
  const p=V().fromBufferAttribute(pos,i).sub(muzzle);projected.push([p.dot(side),p.dot(dorsal),p.dot(axis)]);
  let h=0,e=0,n=0;for(let k=0;k<4;k++){const name=bones[si.getComponent(i,k)]?.name.replace(/[.\s]/g,''),w=sw.getComponent(i,k);if(name==='head'||name==='jaw')h+=w;if(name==='neckupper')n+=w;if(name?.startsWith('ear'))e+=w;}ownership.push(h);neck.push(n);ear.push(e);
 }
 const triangles=[];
 for(let i=0;i<(index?.count||pos.count);i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k),headWeight=ids.reduce((n,j)=>n+ownership[j],0),headNeckWeight=ids.reduce((n,j)=>n+ownership[j]+neck[j],0);if(headNeckWeight<1.35||ids.reduce((n,j)=>n+ear[j],0)>.7)continue;triangles.push({points:ids.map(j=>projected[j]),headWeight});}
 const sections=new Map(),fit={rawPaths:[],rawBits:[],fallbackRays:0,sectionCount:0,clearance,bindToHead:bindToHead.toArray()};
 function section(f){
  const key=f.toFixed(6);if(sections.has(key))return sections.get(key);
  const t=f*length,segments=[];let u0=Infinity,u1=-Infinity,v0=Infinity,v1=-Infinity;
  for(const entry of triangles){if(f<.85&&entry.headWeight<1.35)continue;const tri=entry.points,hits=[];for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3];if((a[2]<t)===(b[2]<t)||Math.abs(b[2]-a[2])<1e-10)continue;const q=(t-a[2])/(b[2]-a[2]),p=[a[0]+q*(b[0]-a[0]),a[1]+q*(b[1]-a[1])];hits.push(p);}
   if(hits.length===2){segments.push(hits);for(const p of hits){u0=Math.min(u0,p[0]);u1=Math.max(u1,p[0]);v0=Math.min(v0,p[1]);v1=Math.max(v1,p[1]);}}
  }
  if(!segments.length)throw new Error(`No head surface for ${profile.id} bridle section ${f}`);
  const uc=(u0+u1)/2,vc=(v0+v1)/2,center=muzzle.clone().addScaledVector(axis,t).addScaledVector(side,uc).addScaledVector(dorsal,vc);
  const sample=(angle,extra=0)=>{
   const dx=Math.cos(angle),dy=Math.sin(angle);let radius=0;
   for(const [a,b]of segments){const ax=a[0]-uc,ay=a[1]-vc,ex=b[0]-a[0],ey=b[1]-a[1],den=dx*ey-dy*ex;if(Math.abs(den)<1e-10)continue;const r=(ax*ey-ay*ex)/den,s=(ax*dy-ay*dx)/den;if(r>0&&s>=-1e-6&&s<=1.000001)radius=Math.max(radius,r);}
   if(!radius){fit.fallbackRays++;const ru=(u1-u0)/2,rv=(v1-v0)/2;radius=1/Math.sqrt(dx*dx/(ru*ru)+dy*dy/(rv*rv));}
   const normal=side.clone().multiplyScalar(dx).addScaledVector(dorsal,dy);
   return {point:center.clone().addScaledVector(normal,radius+clearance+extra),normal};
  };
  const result={sample,center};sections.set(key,result);fit.sectionCount++;return result;
 }
 const g=new THREE.Group();g.name='Artist fitted bridle';
 const leather=new THREE.MeshStandardMaterial({color:0x38271c,roughness:.7}),iron=new THREE.MeshStandardMaterial({color:0xb8bcc2,metalness:.75,roughness:.3}),gold=new THREE.MeshStandardMaterial({color:0xd8b24a,metalness:.7,roughness:.35});
 function lateral(point,sign,extra=0){
  const p=point.clone().sub(muzzle),v=p.dot(dorsal),t=p.dot(axis);let edge=-Infinity;
  for(const {points:[a,b,c]}of triangles){const bv=b[1]-a[1],bt=b[2]-a[2],cv=c[1]-a[1],ct=c[2]-a[2],den=bv*ct-bt*cv;if(Math.abs(den)<1e-12)continue;const av=v-a[1],at=t-a[2],u=(av*ct-at*cv)/den,w=(bv*at-bt*av)/den;if(u<0||w<0||u+w>1)continue;edge=Math.max(edge,sign*(a[0]+u*(b[0]-a[0])+w*(c[0]-a[0])));}
  const result=point.clone();if(Number.isFinite(edge))result.addScaledVector(side,sign*(edge+clearance+extra)-p.dot(side));return {point:result,normal:side.clone().multiplyScalar(sign)};
 }
 function strap(name,rawSamples,width,closed=false,pins=[]){
  // Leather bridges small sculpt facets. Low-pass the path, then lift the
  // smoothed envelope outside the measured surface; preserve its junctions.
  const n=rawSamples.length,pinned=new Set(closed?pins:[0,n-1,...pins]);let points=rawSamples.map(s=>s.point.clone());
  for(let pass=0;pass<7;pass++)points=points.map((p,i)=>pinned.has(i)?p.clone():p.clone().multiplyScalar(2).add(points[(i-1+n)%n]).add(points[(i+1)%n]).multiplyScalar(.25));
  let lift=0;for(let i=0;i<n;i++)lift=Math.max(lift,rawSamples[i].point.clone().sub(points[i]).dot(rawSamples[i].normal));
  const samples=rawSamples.map((s,i)=>({normal:s.normal,point:points[i].addScaledVector(s.normal,(lift+.001*size)*(pinned.size?Math.min(1,...Array.from(pinned,j=>Math.abs(j-i)/3)):1))}));
  fit.rawPaths.push({name,points:samples.map(s=>s.point.toArray())});
  const verts=[],indices=[],half=width*.5,thick=.0016*size;
  for(let i=0;i<n;i++){
   const prev=samples[(i-1+n)%n],next=samples[(i+1)%n],s=samples[i];
   const tangent=closed?next.point.clone().sub(prev.point):i===0?next.point.clone().sub(s.point):i===n-1?s.point.clone().sub(prev.point):next.point.clone().sub(prev.point);
   tangent.normalize();const across=new THREE.Vector3().crossVectors(tangent,s.normal).normalize(),normal=new THREE.Vector3().crossVectors(across,tangent).normalize();
   for(const[a,b]of[[-1,-1],[1,-1],[1,1],[-1,1]])verts.push(...s.point.clone().addScaledVector(across,a*half).addScaledVector(normal,b*thick).applyMatrix4(bindToHead).toArray());
  }
  for(let i=0;i<(closed?n:n-1);i++){const a=i*4,b=((i+1)%n)*4;for(let j=0;j<4;j++){const k=(j+1)%4;indices.push(a+j,b+j,a+k,a+k,b+j,b+k);}}
  if(!closed){indices.push(0,2,1,0,3,2);const a=(n-1)*4;indices.push(a,a+1,a+2,a,a+2,a+3);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,leather);mesh.name=name;mesh.castShadow=true;mesh.frustumCulled=false;g.add(mesh);return samples;
 }
 const arc=(f,start,end,n,extra=0)=>Array.from({length:n},(_,i)=>section(f).sample(start+(end-start)*i/(n-1),extra));
 strap('Noseband',Array.from({length:64},(_,i)=>section(.36).sample(i/64*Math.PI*2)),.017*size,true);
 const crown=1.10,mouth=.12,brow=.83,drop=f=>.66*Math.sin(Math.PI*.5*(crown-f)/(crown-mouth));
 const crownSamples=arc(crown,0,Math.PI,40),browSamples=arc(brow,-drop(brow),Math.PI+drop(brow),40);
 for(const samples of[crownSamples,browSamples]){samples[0]=lateral(samples[0].point,1);samples[samples.length-1]=lateral(samples.at(-1).point,-1);}
 strap('Crownpiece',crownSamples,.017*size);
 strap('Browband',browSamples,.014*size);
 // Cheekpieces run behind/below the eyes, with the bit at each mouth corner.
 for(const sign of[-1,1]){
  const end=sign>0?0:39,baseAngle=sign<0?Math.PI:0,bitSample=lateral(section(mouth).sample(baseAngle-sign*drop(mouth)).point,sign,.008*size);
  const guide=new THREE.CatmullRomCurve3([crownSamples[end].point,browSamples[end].point,section(.36).sample(baseAngle-sign*drop(.36)).point,bitSample.point],false,'centripetal');
  const cheek=Array.from({length:61},(_,i)=>lateral(guide.getPoint(i/60),sign,.008*size*Math.pow(i/60,8)));cheek[0]=crownSamples[end];cheek[20]=browSamples[end];cheek[60]=bitSample;
  strap(sign<0?'Left cheekpiece':'Right cheekpiece',cheek,.013*size,false,[20]);
  const bit=cheek.at(-1).point;fit.rawBits.push(bit.toArray());
  const ringGeo=new THREE.TorusGeometry(.022*size,.0034*size,8,26);ringGeo.rotateY(Math.PI/2);ringGeo.translate(...bit.toArray());ringGeo.applyMatrix4(bindToHead);const ring=new THREE.Mesh(ringGeo,iron);ring.name=sign<0?'Left bit ring':'Right bit ring';ring.castShadow=true;g.add(ring);
 }
 // The throatlatch crosses underneath the jaw, toward the nose as it drops.
 // A face-normal section instead travels backward into the neck. Cast against
 // the whole body in this inclined plane so the neck/head skin-weight seam
 // cannot leave gaps, and filter only outward to keep the leather outside it.
 const throatCenter=crownSamples[0].point.clone().add(crownSamples.at(-1).point).multiplyScalar(.5),underJaw=V(0,-1,.32).normalize();
 const throatRay=new THREE.Ray(),throatHit=V(),throatA=V(),throatB=V(),throatC=V(),throatCount=65,throatRaw=[];
 fit.throatFallbackRays=0;
 for(let i=0;i<throatCount;i++){
  const angle=Math.PI*i/(throatCount-1),normal=side.clone().multiplyScalar(-Math.cos(angle)).addScaledVector(underJaw,Math.sin(angle)),sag=Math.sin(angle);let radius=Infinity;
  throatRay.set(throatCenter,normal);
  for(let j=0;j<(index?.count||pos.count);j+=3){
   throatA.fromBufferAttribute(pos,index?index.getX(j):j);throatB.fromBufferAttribute(pos,index?index.getX(j+1):j+1);throatC.fromBufferAttribute(pos,index?index.getX(j+2):j+2);
   if(throatRay.intersectTriangle(throatA,throatB,throatC,false,throatHit)){const distance=throatHit.distanceTo(throatCenter);if(distance>1e-5)radius=Math.min(radius,distance);}
  }
  if(!Number.isFinite(radius)){fit.throatFallbackRays++;radius=throatCenter.distanceTo(crownSamples[0].point);}
  throatRaw.push({normal,radius:radius+clearance+.007*size*sag});
 }
 let throatRadii=throatRaw.map(s=>s.radius);
 for(let pass=0;pass<8;pass++)throatRadii=throatRadii.map((r,i)=>i===0||i===throatCount-1?r:Math.max(throatRaw[i].radius,(throatRadii[i-1]+2*r+throatRadii[i+1])*.25));
 const throat=throatRaw.map((s,i)=>({normal:s.normal,point:throatCenter.clone().addScaledVector(s.normal,throatRadii[i])}));
 throat[0]=crownSamples.at(-1);throat[throat.length-1]=crownSamples[0];
 strap('Throatlatch',throat,.010*size,false,throat.map((_,i)=>i));
 for(const angle of[Math.PI*.3,Math.PI*.5,Math.PI*.7]){const p=section(.83).sample(angle,.002*size).point,geometry=new THREE.SphereGeometry(.0034*size,8,6);geometry.translate(...p.toArray());geometry.applyMatrix4(bindToHead);const stud=new THREE.Mesh(geometry,gold);stud.name='Browband stud';g.add(stud);}
 g.userData.gold=gold;g.userData.modelKey=rig.key||rig.modelKey;g.userData.artistBridle=true;g.userData.fit=fit;
 g.userData.bitOffsets=fit.rawBits.map(p=>V(...p).applyMatrix4(bindToHead));
 const inverseMount=new THREE.Matrix4();
 g.userData.follow=(hb,_bones,_restQ,_root,mount)=>{
  if(!hb||!mount)return;hb.updateWorldMatrix(true,false);mount.updateWorldMatrix(true,false);
  inverseMount.copy(mount.matrixWorld).invert();g.matrix.multiplyMatrices(inverseMount,hb.matrixWorld);g.matrix.decompose(g.position,g.quaternion,g.scale);g.matrixWorldNeedsUpdate=true;
 };
 const mount=rig.scene.parent;if(mount)g.userData.follow(bones[headIndex],null,null,null,mount);
 return g;
}
