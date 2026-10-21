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

function strandTexture(THREE,grounded=false){
 if(grounded)return shaggyStrandTexture(THREE);
 const width=64,height=256,data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=(x+.5)/width,v=y/(height-1),edge=Math.pow(Math.sin(Math.PI*u),.45);
  const fiber=.5+.5*Math.sin(u*Math.PI*16+.20*Math.sin(v*9+u*7));
  const tip=grounded?1.08+.03*Math.sin(u*31+.7)+.02*Math.sin(u*71):.91+.06*Math.sin(u*25+.7)+.025*Math.sin(u*61),split=clamp((tip-v)*11,0,1),i=(y*width+x)*4;
  const root=smooth01((v-.025-.028*Math.sin(u*23+.8))/.18);
  const shade=Math.round((210+45*fiber)*(.90+.10*smooth01(v/.30)));data[i]=shade;data[i+1]=shade;data[i+2]=shade;
  // A connected soft undercoat gives volume; fine shaded fibers and varied
  // tips retain hair detail without transparent grass-like cuts in each lock.
  data[i+3]=Math.round(255*edge*(.78+.22*fiber)*root*split);
 }
 const texture=once(new THREE.DataTexture(data,width,height));
 texture.name='Native draft feather fibers';texture.colorSpace=THREE.SRGBColorSpace;
 texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;return texture;
}

// Eight irregular fiber fields break repeated pinstripes without adding a
// material or draw call. Fine longer fibers remain visible at the contact hem.
function shaggyStrandTexture(THREE){
 const tiles=8,tileWidth=64,width=tiles*tileWidth,height=256,data=new Uint8Array(width*height*4);
 for(let tile=0;tile<tiles;tile++){
  const rnd=random(7139+tile*593),fibers=[];
  for(let k=0;k<18;k++)fibers.push({center:(k+.18+.64*rnd())/18,width:.018+.018*rnd(),wave:(rnd()-.5)*.038,phase:rnd()*6.28,tip:k%2===0?1.10+.06*rnd():.90+.14*rnd(),shade:.76+.24*rnd()});
  for(let y=0;y<height;y++)for(let x=0;x<tileWidth;x++){
   const u=(x+.5)/tileWidth,v=y/(height-1),edge=Math.pow(Math.sin(Math.PI*u),.65);let body=0,tip=0,shade=0;
   for(const f of fibers){const center=f.center+f.wave*Math.sin(v*3.6+f.phase)*Math.sin(v*Math.PI*.8),d=(u-center)/f.width,weight=Math.exp(-d*d*2.2);body+=weight;tip+=weight*smooth01((f.tip-v)/.09);shade+=weight*f.shade;}
   const root=smooth01((v-.014-.022*Math.sin(u*21+tile))/.12),fiber=Math.min(1,body),end=body?tip/body:0;
   const alpha=edge*root*(.66+.34*fiber)*end,i=(y*width+tile*tileWidth+x)*4;
   const value=Math.round(255*(body?shade/body:.84)*(.91+.09*smooth01(v/.28)));data[i]=value;data[i+1]=value;data[i+2]=value;data[i+3]=Math.round(255*alpha);
  }
 }
 const texture=once(new THREE.DataTexture(data,width,height));texture.name='Native draft irregular layered fibers';texture.colorSpace=THREE.SRGBColorSpace;
 texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;return texture;
}

// Secondary motion owns only the four private feather position/normal arrays.
// Leg displacement is measured relative to the actor, never from camera/world
// travel. No source bone, skin, bind matrix or animation track is edited.
function createFeatherMotion(THREE,scene,skin,anchors,meshes,restrained){
 const inverseScene=new THREE.Matrix4(),matrix=new THREE.Matrix4(),inverse=new THREE.Matrix4();
 const point=new THREE.Vector3(),top=new THREE.Vector3(),pivot=new THREE.Vector3();
 const rest=meshes.map(m=>({position:m.geometry.attributes.position.array.slice(),normal:m.geometry.attributes.normal.array.slice()}));
 const legs=anchors.map((a,i)=>({a,mesh:meshes[i],rest:rest[i],ready:false,px:0,py:0,pz:0,ux:0,uy:1,uz:0,vx:0,vy:0,vz:0,x:0,y:0,z:0,dx:0,dy:0,dz:0,tx:0,ty:0,tz:0,driver:0,offset:0}));
 // Preserve each authored lock's rest fall direction and root-to-tip drop.
 // Only the loose length counters a raised hoof's rotation toward gravity.
 scene.updateWorldMatrix(true,false);inverseScene.copy(scene.matrixWorld).invert();
 for(const l of legs){
  l.a.pastern.updateWorldMatrix(true,false);matrix.multiplyMatrices(inverseScene,l.a.pastern.matrixWorld);inverse.copy(matrix).invert();
  const e=matrix.elements,ie=inverse.elements;l.restDown=new THREE.Vector3(-ie[4],-ie[5],-ie[6]);
  const base=l.rest.position,uv=l.mesh.geometry.attributes.uv.array;l.drop=new Float32Array(base.length/3);let rootY=0;
  for(let i=0;i<base.length/3;i++){const n=i*3,y=e[1]*base[n]+e[5]*base[n+1]+e[9]*base[n+2]+e[13];if(uv[i*2+1]===0)rootY=y;l.drop[i]=Math.max(0,rootY-y);}l.drape=0;
 }
 const cap=restrained?.034:.045,drapeCap=restrained?0:.075,stats={frames:0,maxTipOffsetM:0,peakTipOffsetM:0,maxDrapeOffsetM:0,groundCorrections:0,finite:true};
 function normals(geometry){
  const p=geometry.attributes.position.array,n=geometry.attributes.normal.array,idx=geometry.index.array;n.fill(0);
  for(let t=0;t<idx.length;t+=3){const a=idx[t]*3,b=idx[t+1]*3,c=idx[t+2]*3,abx=p[b]-p[a],aby=p[b+1]-p[a+1],abz=p[b+2]-p[a+2],acx=p[c]-p[a],acy=p[c+1]-p[a+1],acz=p[c+2]-p[a+2],x=aby*acz-abz*acy,y=abz*acx-abx*acz,z=abx*acy-aby*acx;for(let k=0;k<3;k++){const i=idx[t+k]*3;n[i]+=x;n[i+1]+=y;n[i+2]+=z;}}
  for(let i=0;i<n.length;i+=3){const d=1/(Math.hypot(n[i],n[i+1],n[i+2])||1);n[i]*=d;n[i+1]*=d;n[i+2]*=d;}
  geometry.attributes.normal.needsUpdate=true;
 }
 function reset(){
  stats.frames=0;stats.maxDrapeOffsetM=0;stats.maxTipOffsetM=0;stats.peakTipOffsetM=0;stats.groundCorrections=0;stats.finite=true;
  for(let i=0;i<legs.length;i++){const l=legs[i];l.ready=false;l.vx=l.vy=l.vz=l.x=l.y=l.z=l.dx=l.dy=l.dz=l.tx=l.ty=l.tz=l.driver=l.offset=l.drape=0;const g=l.mesh.geometry;g.attributes.position.array.set(l.rest.position);g.attributes.normal.array.set(l.rest.normal);g.attributes.position.needsUpdate=true;g.attributes.normal.needsUpdate=true;}
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
  for(const a of anchors){a.frameSole=Infinity;for(let n=0;n<a.soleSamples.length;n++){
   skin.getVertexPosition(a.soleSamples[n],point);point.applyMatrix4(skin.matrixWorld).applyMatrix4(inverseScene);if(point.y<sole)sole=point.y;if(point.y<a.frameSole)a.frameSole=point.y;
  }}
  // Heavy feather brushes the actor's ground plane; it must not hover with
  // the lighter Percheron margin or follow a raised hoof into the air.
  const floor=restrained?Math.min(0,Number.isFinite(sole)?sole:0)+.008:.0006;
  const filter=1-Math.exp(-dt/.045),steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;
  stats.maxTipOffsetM=0;stats.maxDrapeOffsetM=0;stats.groundCorrections=0;
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
   l.offset=0;l.drape=0;
   const lifted=restrained?0:smooth01((a.frameSole-a.soleY-.012)/.065),down=l.restDown;
   const gravityX=-(e[0]*down.x+e[4]*down.y+e[8]*down.z),gravityY=-1-(e[1]*down.x+e[5]*down.y+e[9]*down.z),gravityZ=-(e[2]*down.x+e[6]*down.y+e[10]*down.z);
   for(let n=0;n<p.length;n+=3){
    const t=uv[n/3*2+1];if(t===0){p[n]=base[n];p[n+1]=base[n+1];p[n+2]=base[n+2];continue;}
    const w=t*t*(.82+.18*t),bx=base[n],by=base[n+1],bz=base[n+2];
    const qx=e[0]*bx+e[4]*by+e[8]*bz+e[12],qy=e[1]*bx+e[5]*by+e[9]*bz+e[13],qz=e[2]*bx+e[6]*by+e[10]*bz+e[14];
    let x=l.x*w,y=l.y*w,z=l.z*w;
    if(lifted>0){
     const loose=smooth01((t-.15)/.85)*l.drop[n/3]*lifted;
     let gx=gravityX*loose,gy=gravityY*loose,gz=gravityZ*loose;
     const length=Math.hypot(gx,gy,gz);if(length>drapeCap){const factor=drapeCap/length;gx*=factor;gy*=factor;gz*=factor;}
     x+=gx;y+=gy;z+=gz;l.drape=Math.max(l.drape,Math.hypot(gx,gy,gz));
    }
    // Keep the displaced lock outside its original cannon shell, allowing only
    // a tiny inward flex. This prevents a running lock cutting through the leg.
    let rx=qx-pivot.x,ry=qy-pivot.y,rz=qz-pivot.z;const along=rx*top.x+ry*top.y+rz*top.z;rx-=along*top.x;ry-=along*top.y;rz-=along*top.z;
    const radius=Math.hypot(rx,ry,rz);if(radius>.008){rx/=radius;ry/=radius;rz/=radius;const inward=x*rx+y*ry+z*rz;if(inward<-.003*w){const correction=-.003*w-inward;x+=rx*correction;y+=ry*correction;z+=rz*correction;}}
    if(qy+y<floor){
     const penetration=floor-qy-y;
     if(!restrained){const horizontal=Math.hypot(rx,rz);if(horizontal>1e-6){const brush=Math.min(.025,penetration*.45);x+=rx/horizontal*brush;z+=rz/horizontal*brush;}}
     y=floor-qy;stats.groundCorrections++;
    }
    const offset=Math.hypot(x,y,z);l.offset=Math.max(l.offset,offset);
    p[n]=bx+ie[0]*x+ie[4]*y+ie[8]*z;p[n+1]=by+ie[1]*x+ie[5]*y+ie[9]*z;p[n+2]=bz+ie[2]*x+ie[6]*y+ie[10]*z;
   }
   g.attributes.position.needsUpdate=true;normals(g);stats.maxTipOffsetM=Math.max(stats.maxTipOffsetM,l.offset);stats.maxDrapeOffsetM=Math.max(stats.maxDrapeOffsetM,l.drape);
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
  return {id,upper,pastern,hoof,top:at(upper),pivot:at(pastern),toe:at(hoof),minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity,samples:0,soleCandidates:[],soleSamples:[],hoofMinX:Infinity,hoofMaxX:-Infinity,hoofMinZ:Infinity,hoofMaxZ:-Infinity,soleY:Infinity};
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
  for(const a of anchors)if(point.y<.16&&Math.abs(point.x-a.pivot.x)<.16&&Math.abs(point.z-a.pivot.z)<.22){a.soleCandidates.push({id:i,y:point.y});a.soleY=Math.min(a.soleY,point.y);if(point.y<.14){a.hoofMinX=Math.min(a.hoofMinX,point.x);a.hoofMaxX=Math.max(a.hoofMaxX,point.x);a.hoofMinZ=Math.min(a.hoofMinZ,point.z);a.hoofMaxZ=Math.max(a.hoofMaxZ,point.z);}}
 }
 for(const a of anchors){a.soleCandidates.sort((a,b)=>a.y-b.y);a.soleSamples=a.soleCandidates.slice(0,16).map(p=>p.id);delete a.soleCandidates;}
 const fantasy=profile.family==='fantasy',vanner=foundation==='vanner',restrained=foundation==='percheron',texture=strandTexture(THREE,!restrained);
 const color=new THREE.Color(vanner?'#f1ede4':'#e6e0d4');
 if(fantasy){const mane=profile.nativeRosterAppearance?.mane||profile.nativeRosterColors?.mane;if(mane)color.set(mane).lerp(new THREE.Color('#e6e0d4'),.42);}
 const material=once(new THREE.MeshStandardMaterial({name:'Native draft silky feather',map:texture,color,
  side:THREE.DoubleSide,alphaTest:restrained?.32:.25,alphaToCoverage:!restrained,roughness:restrained?.82:.88,metalness:0,depthWrite:true}));
 const meshes=[],segments=7,strandsPerLeg=restrained?96:vanner?150:foundation==='clyde'?144:138;
 const frontLocks=restrained?18:24,layerLocks=(strandsPerLeg-frontLocks)/2;
 for(let leg=0;leg<anchors.length;leg++){
  const a=anchors[leg],rnd=random(1987+leg*811+(restrained?127:vanner?831:foundation==='clyde'?412:0));
  const rx=a.samples?clamp((a.maxX-a.minX)*.5,.032,.085):.047;
  const rz=a.samples?clamp((a.maxZ-a.minZ)*.5,.031,.077):.043;
  const cx=a.samples?(a.minX+a.maxX)*.5:a.pivot.x,cz=a.samples?(a.minZ+a.maxZ)*.5:a.pivot.z;
  const axis=a.top.clone().sub(a.pivot).normalize(),positions=[],uvs=[],colors=[],indices=[];
  const sceneToBone=new THREE.Matrix4().copy(a.pastern.matrixWorld).invert().multiply(scene.matrixWorld);
  const local=new THREE.Vector3(),center=new THREE.Vector3();
  for(let strand=0;strand<strandsPerLeg;strand++){
   const heavyLayer=restrained?0:Math.floor(strand/(strandsPerLeg/3));
   const front=restrained&&strand>=strandsPerLeg-frontLocks,upperLayer=restrained?!front&&strand>=layerLocks:heavyLayer===2;
   // Heavy drafts carry a full flowing skirt around the toe and heel. The
   // Percheron family retains shorter back/side locks and lighter toe cover.
   const slot=front?strand-(strandsPerLeg-frontLocks):strand%layerLocks;
   const angle=!restrained?((strand%(strandsPerLeg/3)+.12+.76*rnd()+heavyLayer*.43)/(strandsPerLeg/3)-.5)*Math.PI*2:front?Math.PI+((slot+.2+.6*rnd())/frontLocks-.5)*(restrained?1.10:1.80)
    :((slot+.18+.64*rnd()+(upperLayer?.35:0))/layerLocks-.5)*Math.PI*1.72;
   const radialX=Math.sin(angle),radialZ=-Math.cos(angle);
   const rootUp=front?(restrained?.025+rnd()*.040:.032+rnd()*.074):restrained
    ?upperLayer?.075+rnd()*.050:.030+rnd()*.053
    :heavyLayer===2?.085+rnd()*.065:heavyLayer===1?.045+rnd()*.070:.018+rnd()*.075;
   const length=front?(restrained?.170+rnd()*.040:.057+rnd()*.043):restrained
    ?.145+rnd()*.055:.181+rnd()*.084;
   const width=front?(restrained?.016+rnd()*.008:.016+rnd()*.014):restrained
    ?.018+rnd()*.008:.020+rnd()*.006;
   const flare=front?.008+rnd()*.009:restrained?.020+rnd()*.018
    :(upperLayer?.020+rnd()*.022:.031+rnd()*.024);
   const bend=(rnd()-.5)*(restrained?.013:.019),rootY=a.pivot.y+rootUp;
   const minimumTipY=Math.max(.025,a.toe.y-(restrained?.078:.064));
   const contactLayer=!restrained&&heavyLayer===0;
   const heavyTip=restrained?0:contactLayer?.0008+.0009*rnd():heavyLayer===1?.004+rnd()*.034:.023+rnd()*.070;
   const drop=restrained?Math.min(length,Math.max(.03,rootY-minimumTipY)):Math.max(.03,rootY-heavyTip);
   const hoofRx=Number.isFinite(a.hoofMinX)?(a.hoofMaxX-a.hoofMinX)*.5:rx;
   const hoofRz=Number.isFinite(a.hoofMinZ)?(a.hoofMaxZ-a.hoofMinZ)*.5:rz;
   const hoofCx=Number.isFinite(a.hoofMinX)?(a.hoofMaxX+a.hoofMinX)*.5:cx;
   const hoofCz=Number.isFinite(a.hoofMinZ)?(a.hoofMaxZ+a.hoofMinZ)*.5:cz;
   const shade=.82+rnd()*.18,base=positions.length/3;
   const curlNoise=restrained?0:rnd()-.5,rollNoise=restrained?0:rnd()-.5;
   const tipCurl=curlNoise*.54,tipRoll=rollNoise*1.05,
    curl=restrained?0:.19*Math.sin(angle*4+leg*.45)+curlNoise*.12,
    roll=restrained?0:.30*Math.sin(angle*4+heavyLayer*.5)+rollNoise*.28,tile=(strand*3+leg*5)%8;
   for(let step=0;step<=segments;step++){
    const t=step/segments,contactBlend=contactLayer?smooth01((t-.5)/.3):0,lockCurl=curl+(tipCurl-curl)*contactBlend,lockRoll=roll+(tipRoll-roll)*contactBlend,rootWidth=.18+.82*smooth01(t/.27),taper=(restrained?.12:.25)+(restrained?.88:.75)*rootWidth*Math.pow(1-t,restrained?.48:.44),spread=flare*Math.sin(t*Math.PI*.5);
    const embeddedRoot=.88+.06*smooth01(t/.26);
    // Most of the flow falls downward; a modest rear sweep and rounded lock
    // face keep the silhouette soft from oblique/front/rear views.
    center.set(cx+axis.x*rootUp+radialX*(rx*embeddedRoot+spread)+bend*Math.sin(t*Math.PI*.8),
     rootY-drop*t,cz+axis.z*rootUp+radialZ*(rz*embeddedRoot+spread)-.009*Math.sin(t*Math.PI));
    {
     // Toe locks also wrap forward over the hoof. Leaving them on the
     // cannon axis hides their center behind the shin and exposes a bald band.
     // The narrow embedded root follows the real cannon; the loose length
     // opens gradually over the actual hoof instead of radiating like grass.
     const aroundHoof=smooth01(t/(restrained?.92:.86)),rootX=cx+axis.x*rootUp,rootZ=cz+axis.z*rootUp;
     const sweep=angle+lockCurl*smooth01(t),sx=Math.sin(sweep),sz=-Math.cos(sweep);
     const fanX=restrained?.006:.023,fanZ=restrained?.008:.025;
     const radiusX=rx*embeddedRoot+(Math.max(rx+flare,hoofRx+fanX)-rx*embeddedRoot)*aroundHoof;
     const radiusZ=rz*embeddedRoot+(Math.max(rz+flare,hoofRz+fanZ)-rz*embeddedRoot)*aroundHoof;
     // Neighboring fibers follow a shared curved tuft, with fine variation
     // inside it. This gives flowing clumps rather than equally straight grass.
     const tuft=(restrained?.003:.006)*Math.sin(angle*4+leg*.45+t*Math.PI*1.6)*smooth01(t/.24)*Math.sin(t*Math.PI*.85)*(1-contactBlend);
     center.x=rootX+(hoofCx-rootX)*aroundHoof+sx*radiusX+bend*Math.sin(t*Math.PI*.8)+Math.cos(sweep)*tuft;
     center.z=rootZ+(hoofCz-rootZ)*aroundHoof+sz*radiusZ-.008*Math.sin(t*Math.PI)+Math.sin(sweep)*tuft;
    }
    for(const side of [-1,0,1]){
     const sweep=angle+lockCurl*smooth01(t),twist=lockRoll*Math.sin(t*Math.PI*.8),acrossX=Math.cos(sweep)*Math.cos(twist)+Math.sin(sweep)*Math.sin(twist),acrossZ=Math.sin(sweep)*Math.cos(twist)-Math.cos(sweep)*Math.sin(twist);
     local.copy(center);local.x+=acrossX*width*taper*side*.5;local.z+=acrossZ*width*taper*side*.5;
     const bow=(1-side*side)*width*.20*taper;
     local.x+=radialX*bow;local.z+=radialZ*bow;
     local.applyMatrix4(sceneToBone);positions.push(local.x,local.y,local.z);
     uvs.push(restrained?(side+1)*.5:(tile+.035+(side+1)*.465)/8,t);colors.push(shade,shade,shade);
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
 const controller={foundation,meshes,anchors,strands:4*strandsPerLeg,layers:restrained?2:3,style:restrained?'light flowing feather':'layered shaggy ground feather',disposed:false,
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
  triangles,strands:feathers.strands,maxDrapeOffsetM:feathers.motion.stats.maxDrapeOffsetM,maxTipOffsetM:feathers.motion.stats.maxTipOffsetM,peakTipOffsetM:feathers.motion.stats.peakTipOffsetM,frames:feathers.motion.stats.frames,groundCorrections:feathers.motion.stats.groundCorrections,legs:feathers.motion.legs.map(l=>({id:l.a.id,tipOffsetM:l.offset,driverM:l.driver,drapeM:l.drape})),layers:feathers.layers,style:feathers.style,finiteAnchors:finite&&feathers.anchors.every(a=>a.pastern.matrixWorld.elements.every(Number.isFinite)),
  boneNames:feathers.anchors.map(a=>a.pastern.name),skinSamples:feathers.anchors.map(a=>a.samples)};
}
