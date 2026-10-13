/* Private, bone-attached hair for the feathered native draft foundations.
 * The approved skinned meshes, weights, inverse binds and clips stay untouched. */
const owned=new WeakMap();
const LEGS=[
 ['FL','hand_l_0206','fingers_01_l_0187','fingers_02_l_0208'],
 ['FR','hand_r_0272','fingers_01_r_0273','fingers_02_r_0274'],
 ['HL','foot_l_0407','toes_01_l_0408','toes_02_l_0409'],
 ['HR','foot_r_0476','toes_01_r_0477','toes_02_r_0478'],
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth01=v=>{const t=clamp(v,0,1);return t*t*(3-2*t);};
function random(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
function once(resource){const dispose=resource.dispose.bind(resource);let disposed=false;resource.dispose=()=>{if(disposed)return;disposed=true;dispose();};return resource;}

function strandTexture(THREE){
 const width=64,height=256,data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=(x+.5)/width,v=y/(height-1),edge=Math.pow(Math.sin(Math.PI*u),.45);
  const fiber=.5+.5*Math.sin(u*Math.PI*16+.20*Math.sin(v*9+u*7));
  const tip=.91+.06*Math.sin(u*25+.7)+.025*Math.sin(u*61),split=clamp((tip-v)*11,0,1),i=(y*width+x)*4;
  const root=smooth01((v-.025-.028*Math.sin(u*23+.8))/.18);
  const shade=Math.round((210+45*fiber)*(.90+.10*smooth01(v/.30)));data[i]=shade;data[i+1]=shade;data[i+2]=shade;
  // A connected soft undercoat gives volume; fine shaded fibers and varied
  // tips retain hair detail without transparent grass-like cuts in each lock.
  data[i+3]=Math.round(255*edge*(.60+.40*fiber)*root*split);
 }
 const texture=once(new THREE.DataTexture(data,width,height));
 texture.name='Native draft feather fibers';texture.colorSpace=THREE.SRGBColorSpace;
 texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;return texture;
}

// Secondary motion owns only the four private feather position/normal arrays.
// Leg displacement is measured relative to the actor, never from camera/world
// travel. No source bone, skin, bind matrix or animation track is edited.
function createFeatherMotion(THREE,scene,skin,anchors,meshes,restrained){
 const inverseScene=new THREE.Matrix4(),matrix=new THREE.Matrix4(),inverse=new THREE.Matrix4();
 const point=new THREE.Vector3(),top=new THREE.Vector3(),pivot=new THREE.Vector3();
 const rest=meshes.map(m=>({position:m.geometry.attributes.position.array.slice(),normal:m.geometry.attributes.normal.array.slice()}));
 const legs=anchors.map((a,i)=>({a,mesh:meshes[i],rest:rest[i],ready:false,px:0,py:0,pz:0,ux:0,uy:1,uz:0,vx:0,vy:0,vz:0,x:0,y:0,z:0,dx:0,dy:0,dz:0,tx:0,ty:0,tz:0,driver:0,offset:0}));
 const cap=restrained?.034:.045,stats={frames:0,maxTipOffsetM:0,peakTipOffsetM:0,groundCorrections:0,finite:true};
 function normals(geometry){
  const p=geometry.attributes.position.array,n=geometry.attributes.normal.array,idx=geometry.index.array;n.fill(0);
  for(let t=0;t<idx.length;t+=3){const a=idx[t]*3,b=idx[t+1]*3,c=idx[t+2]*3,abx=p[b]-p[a],aby=p[b+1]-p[a+1],abz=p[b+2]-p[a+2],acx=p[c]-p[a],acy=p[c+1]-p[a+1],acz=p[c+2]-p[a+2],x=aby*acz-abz*acy,y=abz*acx-abx*acz,z=abx*acy-aby*acx;for(let k=0;k<3;k++){const i=idx[t+k]*3;n[i]+=x;n[i+1]+=y;n[i+2]+=z;}}
  for(let i=0;i<n.length;i+=3){const d=1/(Math.hypot(n[i],n[i+1],n[i+2])||1);n[i]*=d;n[i+1]*=d;n[i+2]*=d;}
  geometry.attributes.normal.needsUpdate=true;
 }
 function reset(){
  stats.frames=0;stats.maxTipOffsetM=0;stats.peakTipOffsetM=0;stats.groundCorrections=0;stats.finite=true;
  for(let i=0;i<legs.length;i++){const l=legs[i];l.ready=false;l.vx=l.vy=l.vz=l.x=l.y=l.z=l.dx=l.dy=l.dz=l.tx=l.ty=l.tz=l.driver=l.offset=0;const g=l.mesh.geometry;g.attributes.position.array.set(l.rest.position);g.attributes.normal.array.set(l.rest.normal);g.attributes.position.needsUpdate=true;g.attributes.normal.needsUpdate=true;}
 }
 function update(dt,state){
  if(!Number.isFinite(dt)||dt<0)return;
  if(dt===0||state?.paused){
   // A photo/hidden-tab pose may be refreshed while time is stopped. Reseed
   // only measured history so resume cannot mistake that edit for acceleration.
   scene.updateWorldMatrix(true,false);inverseScene.copy(scene.matrixWorld).invert();
   for(let i=0;i<legs.length;i++){const l=legs[i];l.a.pastern.updateWorldMatrix(true,false);matrix.multiplyMatrices(inverseScene,l.a.pastern.matrixWorld);const e=matrix.elements,d=Math.hypot(e[4],e[5],e[6])||1;l.px=e[12];l.py=e[13];l.pz=e[14];l.ux=e[4]/d;l.uy=e[5]/d;l.uz=e[6]/d;l.vx=l.vy=l.vz=0;l.ready=true;}
   return;
  }
  if(state?.reset||state?.discontinuity||dt>.20){reset();return;}
  scene.updateWorldMatrix(true,false);inverseScene.copy(scene.matrixWorld).invert();
  // Use real source-sole samples in the same actor frame. A raised jumping
  // foot does not raise the ground, while a native negative sole is respected.
  let sole=Infinity;
  skin.updateWorldMatrix(true,false);skin.updateMatrixWorld(true);
  for(const a of anchors)for(let n=0;n<a.soleSamples.length;n++){
   skin.getVertexPosition(a.soleSamples[n],point);point.applyMatrix4(skin.matrixWorld).applyMatrix4(inverseScene);if(point.y<sole)sole=point.y;
  }
  const floor=Math.min(0,Number.isFinite(sole)?sole:0)+.008;
  const filter=1-Math.exp(-dt/.045),steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;
  stats.maxTipOffsetM=0;stats.groundCorrections=0;
  for(let i=0;i<legs.length;i++){
   const l=legs[i],a=l.a;a.pastern.updateWorldMatrix(true,false);a.upper.updateWorldMatrix(true,false);
   matrix.multiplyMatrices(inverseScene,a.pastern.matrixWorld);inverse.copy(matrix).invert();const e=matrix.elements,ie=inverse.elements;
   pivot.set(e[12],e[13],e[14]);top.setFromMatrixPosition(a.upper.matrixWorld).applyMatrix4(inverseScene).sub(pivot).normalize();
   let ux=e[4],uy=e[5],uz=e[6],ul=Math.hypot(ux,uy,uz)||1;ux/=ul;uy/=ul;uz/=ul;
   if(l.ready){
    const mx=pivot.x-l.px,my=pivot.y-l.py,mz=pivot.z-l.pz;
    if(Math.hypot(mx,my,mz)>.40){l.vx=l.vy=l.vz=l.x=l.y=l.z=l.dx=l.dy=l.dz=0;l.tx=l.ty=l.tz=0;}
    else{
     const vx=clamp(mx/dt,-4,4),vy=clamp(my/dt,-4,4),vz=clamp(mz/dt,-4,4);
     const nx=l.vx+(vx-l.vx)*filter,ny=l.vy+(vy-l.vy)*filter,nz=l.vz+(vz-l.vz)*filter;
     const ax=clamp((nx-l.vx)/dt,-35,35),ay=clamp((ny-l.vy)/dt,-35,35),az=clamp((nz-l.vz)/dt,-35,35);
     const run=1+.45*clamp(Math.max(Math.hypot(nx,ny,nz)/1.2,Math.abs(state?.speedMps||0)/7),0,1);
     l.tx=(-.006*nx-.00032*ax+.005*(l.ux-ux)/dt)*run;
     l.ty=(-.004*ny-.00022*ay+.003*(l.uy-uy)/dt)*run;
     l.tz=(-.006*nz-.00032*az+.005*(l.uz-uz)/dt)*run;
     const length=Math.hypot(l.tx,l.ty,l.tz);if(length>cap){const q=cap/length;l.tx*=q;l.ty*=q;l.tz*=q;}
     l.vx=nx;l.vy=ny;l.vz=nz;
    }
   }else{l.ready=true;l.tx=l.ty=l.tz=0;}
   l.px=pivot.x;l.py=pivot.y;l.pz=pivot.z;l.ux=ux;l.uy=uy;l.uz=uz;l.driver=Math.hypot(l.tx,l.ty,l.tz);
   // Stable substepped damped spring; each leg receives its own measured drive.
   for(let step=0;step<steps;step++){
    l.dx+=(256*(l.tx-l.x)-30*l.dx)*h;l.dy+=(256*(l.ty-l.y)-30*l.dy)*h;l.dz+=(256*(l.tz-l.z)-30*l.dz)*h;
    l.x+=l.dx*h;l.y+=l.dy*h;l.z+=l.dz*h;
   }
   const size=Math.hypot(l.x,l.y,l.z);if(size>cap){const q=cap/size;l.x*=q;l.y*=q;l.z*=q;l.dx*=.5;l.dy*=.5;l.dz*=.5;}
   const g=l.mesh.geometry,p=g.attributes.position.array,uv=g.attributes.uv.array,base=l.rest.position;
   l.offset=0;
   for(let n=0;n<p.length;n+=3){
    const t=uv[n/3*2+1];if(t===0){p[n]=base[n];p[n+1]=base[n+1];p[n+2]=base[n+2];continue;}
    const w=t*t*(.82+.18*t),bx=base[n],by=base[n+1],bz=base[n+2];
    const qx=e[0]*bx+e[4]*by+e[8]*bz+e[12],qy=e[1]*bx+e[5]*by+e[9]*bz+e[13],qz=e[2]*bx+e[6]*by+e[10]*bz+e[14];
    let x=l.x*w,y=l.y*w,z=l.z*w;
    // Keep the displaced lock outside its original cannon shell, allowing only
    // a tiny inward flex. This prevents a running lock cutting through the leg.
    let rx=qx-pivot.x,ry=qy-pivot.y,rz=qz-pivot.z;const along=rx*top.x+ry*top.y+rz*top.z;rx-=along*top.x;ry-=along*top.y;rz-=along*top.z;
    const radius=Math.hypot(rx,ry,rz);if(radius>.008){rx/=radius;ry/=radius;rz/=radius;const inward=x*rx+y*ry+z*rz;if(inward<-.003*w){const correction=-.003*w-inward;x+=rx*correction;y+=ry*correction;z+=rz*correction;}}
    if(qy+y<floor){y=floor-qy;stats.groundCorrections++;}
    const offset=Math.hypot(x,y,z);l.offset=Math.max(l.offset,offset);
    p[n]=bx+ie[0]*x+ie[4]*y+ie[8]*z;p[n+1]=by+ie[1]*x+ie[5]*y+ie[9]*z;p[n+2]=bz+ie[2]*x+ie[6]*y+ie[10]*z;
   }
   g.attributes.position.needsUpdate=true;normals(g);stats.maxTipOffsetM=Math.max(stats.maxTipOffsetM,l.offset);
  }
  stats.frames++;stats.peakTipOffsetM=Math.max(stats.peakTipOffsetM,stats.maxTipOffsetM);stats.finite=Number.isFinite(stats.maxTipOffsetM);
 }
 return{update,reset,stats,legs};
}

export function createNativeDraftFeathers({THREE,scene,skin,profile}={}){
 const foundation=profile?.nativeVariant?.id;
 if(!THREE||!scene||!skin||!profile?.nativeRoster||!['percheron','shire','clyde','vanner'].includes(foundation))return null;
 const existing=owned.get(skin);if(existing&&!existing.disposed)return existing;
 scene.updateWorldMatrix(true,true);
 // SkinnedMesh refreshes bindMatrixInverse in updateMatrixWorld, which is
 // needed when the actor was already placed/rotated before sampling its skin.
 scene.updateMatrixWorld(true);
 const at=bone=>scene.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
 const anchors=LEGS.map(([id,upperName,pasternName,hoofName])=>{
  const upper=scene.getObjectByName(upperName),pastern=scene.getObjectByName(pasternName),hoof=scene.getObjectByName(hoofName);
  if(!upper||!pastern||!hoof)return null;
  return {id,upper,pastern,hoof,top:at(upper),pivot:at(pastern),toe:at(hoof),minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity,samples:0,soleCandidates:[],soleSamples:[]};
 });
 if(anchors.some(a=>!a||![...a.top.toArray(),...a.pivot.toArray(),...a.toe.toArray()].every(Number.isFinite)))return null;
 // Read the current conformation at the lower cannon. The draft morph may be
 // wider than its preserved skeleton; roots must emerge from the actual skin.
 const point=new THREE.Vector3(),p=skin.geometry.attributes.position;
 for(let i=0;i<p.count;i++){
  skin.getVertexPosition(i,point);skin.localToWorld(point);scene.worldToLocal(point);
  for(const a of anchors)if(point.y>a.pivot.y+.015&&point.y<a.pivot.y+.11&&Math.abs(point.x-a.pivot.x)<.14&&Math.abs(point.z-a.pivot.z)<.15){
   a.minX=Math.min(a.minX,point.x);a.maxX=Math.max(a.maxX,point.x);a.minZ=Math.min(a.minZ,point.z);a.maxZ=Math.max(a.maxZ,point.z);a.samples++;
  }
  for(const a of anchors)if(point.y<.16&&Math.abs(point.x-a.pivot.x)<.16&&Math.abs(point.z-a.pivot.z)<.22)a.soleCandidates.push({id:i,y:point.y});
 }
 for(const a of anchors){a.soleCandidates.sort((a,b)=>a.y-b.y);a.soleSamples=a.soleCandidates.slice(0,16).map(p=>p.id);delete a.soleCandidates;}
 const fantasy=profile.family==='fantasy',vanner=foundation==='vanner',restrained=foundation==='percheron',texture=strandTexture(THREE);
 const color=new THREE.Color(vanner?'#f1ede4':'#e6e0d4');
 if(fantasy){const mane=profile.nativeRosterAppearance?.mane||profile.nativeRosterColors?.mane;if(mane)color.set(mane).lerp(new THREE.Color('#e6e0d4'),.42);}
 const material=once(new THREE.MeshStandardMaterial({name:'Native draft silky feather',map:texture,color,
  side:THREE.DoubleSide,alphaTest:.32,roughness:.82,metalness:0,depthWrite:true}));
 const meshes=[],segments=7,strandsPerLeg=restrained?72:vanner?104:foundation==='clyde'?100:96;
 const frontLocks=restrained?12:vanner?16:12,layerLocks=(strandsPerLeg-frontLocks)/2;
 for(let leg=0;leg<anchors.length;leg++){
  const a=anchors[leg],rnd=random(1987+leg*811+(restrained?127:vanner?831:foundation==='clyde'?412:0));
  const rx=a.samples?clamp((a.maxX-a.minX)*.5,.032,.085):.047;
  const rz=a.samples?clamp((a.maxZ-a.minZ)*.5,.031,.077):.043;
  const cx=a.samples?(a.minX+a.maxX)*.5:a.pivot.x,cz=a.samples?(a.minZ+a.maxZ)*.5:a.pivot.z;
  const axis=a.top.clone().sub(a.pivot).normalize(),positions=[],uvs=[],colors=[],indices=[];
  const sceneToBone=new THREE.Matrix4().copy(a.pastern.matrixWorld).invert().multiply(scene.matrixWorld);
  const local=new THREE.Vector3(),center=new THREE.Vector3();
  for(let strand=0;strand<strandsPerLeg;strand++){
   const front=strand>=strandsPerLeg-frontLocks,upperLayer=!front&&strand>=layerLocks;
   // Stagger two continuous back/side layers. Only short wisps cross the front,
   // leaving the hoof toe and joint structure readable rather than a fur boot.
   const slot=front?strand-(strandsPerLeg-frontLocks):strand%layerLocks;
   const angle=front?Math.PI+((slot+.2+.6*rnd())/frontLocks-.5)*1.10
    :((slot+.18+.64*rnd()+(upperLayer?.35:0))/layerLocks-.5)*Math.PI*1.72;
   const radialX=Math.sin(angle),radialZ=-Math.cos(angle);
   const rootUp=front?.012+rnd()*.052:restrained
    ?upperLayer?.083+rnd()*.050:.030+rnd()*.053
    :upperLayer?.096+rnd()*.065:.028+rnd()*.070;
   const length=front?(restrained?.045+rnd()*.035:.057+rnd()*.043):restrained
    ?.130+rnd()*.060:.181+rnd()*.084;
   const width=front?(restrained?.006+rnd()*.004:.008+rnd()*.005):restrained
    ?.012+rnd()*.009:.018+rnd()*.014;
   const flare=front?.005+rnd()*.008:restrained?.017+rnd()*.021
    :(upperLayer?.018+rnd()*.022:.027+rnd()*.024);
   const bend=(rnd()-.5)*(restrained?.013:.019),rootY=a.pivot.y+rootUp;
   const minimumTipY=Math.max(.025,a.toe.y-(restrained?.051:.064));
   const drop=Math.min(length,Math.max(.03,rootY-minimumTipY));
   const shade=.82+rnd()*.18,base=positions.length/3;
   for(let step=0;step<=segments;step++){
    const t=step/segments,rootWidth=.18+.82*smooth01(t/.27),taper=.025+.975*rootWidth*Math.pow(1-t,.48),spread=flare*Math.sin(t*Math.PI*.5);
    const embeddedRoot=.88+.06*smooth01(t/.26);
    // Most of the flow falls downward; a modest rear sweep and rounded lock
    // face keep the silhouette soft from oblique/front/rear views.
    center.set(cx+axis.x*rootUp+radialX*(rx*embeddedRoot+spread)+bend*Math.sin(t*Math.PI*.8),
     rootY-drop*t,cz+axis.z*rootUp+radialZ*(rz*embeddedRoot+spread)-.009*Math.sin(t*Math.PI));
    for(const side of [-1,0,1]){
     local.copy(center);local.x+=Math.cos(angle)*width*taper*side*.5;local.z+=Math.sin(angle)*width*taper*side*.5;
     const bow=(1-side*side)*width*.20*taper;
     local.x+=radialX*bow;local.z+=radialZ*bow;
     local.applyMatrix4(sceneToBone);positions.push(local.x,local.y,local.z);
     uvs.push((side+1)*.5,t);colors.push(shade,shade,shade);
    }
    if(step<segments){const n=base+step*3;for(let panel=0;panel<2;panel++)indices.push(n+panel,n+panel+3,n+panel+1,n+panel+1,n+panel+3,n+panel+4);}

   }
  }
  const geometry=once(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();const b=sceneToBone.elements,padding=.12*Math.max(Math.hypot(b[0],b[1],b[2]),Math.hypot(b[4],b[5],b[6]),Math.hypot(b[8],b[9],b[10]));geometry.boundingBox.expandByScalar(padding);geometry.boundingSphere.radius+=padding;geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);geometry.attributes.normal.setUsage(THREE.DynamicDrawUsage);
  const mesh=new THREE.Mesh(geometry,material);mesh.name='NativeDraftFeather_'+a.id;mesh.userData.nativeDraftFeather=true;
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;a.pastern.add(mesh);meshes.push(mesh);
 }
 material.vertexColors=true;
 const motion=createFeatherMotion(THREE,scene,skin,anchors,meshes,restrained);
 const controller={foundation,meshes,anchors,strands:4*strandsPerLeg,layers:2,style:restrained?'light flowing feather':'full flowing feather',disposed:false,
  update(dt,state){if(!this.disposed)motion.update(dt,state);},reset(){if(!this.disposed)motion.reset();},motion,
  setColors({maneColor}={}){if(!this.disposed&&fantasy&&maneColor)material.color.set(maneColor).lerp(new THREE.Color('#e6e0d4'),.42);},
  inspect(){return inspectNativeDraftFeathers(this);},
  dispose(){if(this.disposed)return;this.disposed=true;for(const mesh of meshes){mesh.removeFromParent();mesh.geometry.dispose();}material.dispose();texture.dispose();owned.delete(skin);},
 };
 owned.set(skin,controller);return controller;
}

/** On-demand QA inspection; update() itself allocates no arrays or vectors. */
export function inspectNativeDraftFeathers(feathers){
 if(!feathers)return {enabled:false,drawCalls:0,triangles:0,strands:0,finiteAnchors:true};
 let triangles=0,finite=true;for(const mesh of feathers.meshes){triangles+=mesh.geometry.index.count/3;finite=finite&&mesh.geometry.attributes.position.array.every(Number.isFinite);}
 return {enabled:!feathers.disposed,foundation:feathers.foundation,drawCalls:feathers.disposed?0:feathers.meshes.length,
  triangles,strands:feathers.strands,maxTipOffsetM:feathers.motion.stats.maxTipOffsetM,peakTipOffsetM:feathers.motion.stats.peakTipOffsetM,frames:feathers.motion.stats.frames,groundCorrections:feathers.motion.stats.groundCorrections,legs:feathers.motion.legs.map(l=>({id:l.a.id,tipOffsetM:l.offset,driverM:l.driver})),layers:feathers.layers,style:feathers.style,finiteAnchors:finite&&feathers.anchors.every(a=>a.pastern.matrixWorld.elements.every(Number.isFinite)),
  boneNames:feathers.anchors.map(a=>a.pastern.name),skinSamples:feathers.anchors.map(a=>a.samples)};
}
