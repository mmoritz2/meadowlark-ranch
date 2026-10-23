import {withNativeRidingResources} from './native-riding-groom.mjs?v=native-riding-locks-1';
/* Actor-private native hair volume and motion. The source skin, clips, bones,
 * bind matrices, dye attributes and material/shader references remain intact. */
const owned=new WeakMap();
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
function islands(g){
 const count=g.attributes.position.count,parent=new Int32Array(count);for(let i=0;i<count;i++)parent[i]=i;
 const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;},index=g.index?.array;
 if(!index)return[];for(let i=0;i<index.length;i+=3){join(index[i],index[i+1]);join(index[i],index[i+2]);}
 const map=new Map();for(let i=0;i<count;i++){const k=find(i);if(!map.has(k))map.set(k,[]);map.get(k).push(i);}return [...map.values()];
}
// Private topology and weights never change during this controller's lifetime.
// Retain original face order: Float32 accumulation and published normals stay exact.
function normalWork(g,weights){
 const index=g.index.array,corners=[],vertices=[];
 for(let i=0;i<g.attributes.position.count;i++)if(!weights||weights[i]!==0)vertices.push(i*3);
 for(let i=0;i<index.length;i+=3){const a=index[i],b=index[i+1],c=index[i+2];if(!weights||weights[a]!==0||weights[b]!==0||weights[c]!==0)corners.push(a*3,b*3,c*3);}
 return{corners:new Uint32Array(corners),vertices:new Uint32Array(vertices)};
}
function geometricNormals(g,out,work){
 out.fill(0);const p=g.attributes.position.array,index=work.corners;
 for(let i=0;i<index.length;i+=3){const a=index[i],b=index[i+1],c=index[i+2],ax=p[b]-p[a],ay=p[b+1]-p[a+1],az=p[b+2]-p[a+2],bx=p[c]-p[a],by=p[c+1]-p[a+1],bz=p[c+2]-p[a+2],x=ay*bz-az*by,y=az*bx-ax*bz,z=ax*by-ay*bx;
  out[a]+=x;out[a+1]+=y;out[a+2]+=z;
  out[b]+=x;out[b+1]+=y;out[b+2]+=z;
  out[c]+=x;out[c+1]+=y;out[c+2]+=z;
 }
 const vertices=work.vertices;
 for(let j=0;j<vertices.length;j++){const i=vertices[j],x=out[i],y=out[i+1],z=out[i+2],l=Math.hypot(x,y,z)||1;out[i]=x/l;out[i+1]=y/l;out[i+2]=z/l;}
}
function transferNormals(from,to,authored,out,work){
 // Zero-weight vertices always retain these exact authored values. Bulk copy
 // replaces the old per-vertex copy branch; only free lengths need transport.
 out.set(authored);const vertices=work.vertices;
 for(let j=0;j<vertices.length;j++){const i=vertices[j];
  const ax=from[i],ay=from[i+1],az=from[i+2],bx=to[i],by=to[i+1],bz=to[i+2],x=authored[i],y=authored[i+1],z=authored[i+2],kx=ay*bz-az*by,ky=az*bx-ax*bz,kz=ax*by-ay*bx,d=ax*bx+ay*by+az*bz;
  if(d<-.9999){out[i]=bx;out[i+1]=by;out[i+2]=bz;continue;}
  const u=ky*z-kz*y,v=kz*x-kx*z,w=kx*y-ky*x,q=1/(1+d),nx=x+u+(ky*w-kz*v)*q,ny=y+v+(kz*u-kx*w)*q,nz=z+w+(kx*v-ky*u)*q,l=Math.hypot(nx,ny,nz)||1;out[i]=nx/l;out[i+1]=ny/l;out[i+2]=nz/l;
 }
}
function shapeLayeredLock(raw,ids,uv,role,lockIndex){
 const levels=new Map();for(const i of ids){const t=uv.getY(i);if(!levels.has(t))levels.set(t,[]);levels.get(t).push(i);}
 const rows=[...levels].sort((a,b)=>a[0]-b[0]).map(([t,ring])=>{const center=[0,0,0];for(const i of ring)for(let c=0;c<3;c++)center[c]+=raw[i*3+c]/ring.length;return{t,ring,center};});
 for(let row=0;row<rows.length;row++){
  const {t,ring,center:[x,y,z]}=rows[row];if(t===0)continue;
  const a=ring.find(i=>uv.getX(i)===0);if(a===undefined)continue;
  let ax=raw[a*3]-x,ay=raw[a*3+1]-y,az=raw[a*3+2]-z,radius=Math.hypot(ax,ay,az);if(radius<1e-8)continue;ax/=radius;ay/=radius;az/=radius;
  const previous=rows[Math.max(0,row-1)].center,next=rows[Math.min(rows.length-1,row+1)].center;
  let tx=next[0]-previous[0],ty=next[1]-previous[1],tz=next[2]-previous[2],length=Math.hypot(tx,ty,tz)||1;tx/=length;ty/=length;tz/=length;
  let bx=ty*az-tz*ay,by=tz*ax-tx*az,bz=tx*ay-ty*ax,depthAxis=Math.hypot(bx,by,bz)||1;bx/=depthAxis;by/=depthAxis;bz/=depthAxis;
  const blend=smooth(t/.23),width=1-blend*.17,depth=1-blend*(role==='tail'?.60:.42);
  const wave=role==='tail'?.18:1.12,phase=lockIndex*.23,curve=blend*radius*wave*Math.sin(t*Math.PI*1.55+phase)*Math.sin(t*Math.PI*.8),lift=blend*radius*.18*Math.sin(t*Math.PI);
  for(const i of ring){const n=i*3,dx=raw[n]-x,dy=raw[n+1]-y,dz=raw[n+2]-z,across=dx*ax+dy*ay+dz*az;raw[n]=x+ax*(across*width+curve)+(dx-ax*across)*depth+bx*lift;raw[n+1]=y+ay*(across*width+curve)+(dy-ay*across)*depth+by*lift;raw[n+2]=z+az*(across*width+curve)+(dz-az*across)*depth+bz*lift;}
 }
}
export function createNativeFlowingGroom({THREE,scene,skin,profile}={}){
 if(!THREE||!scene||!skin||!profile?.nativeBreed||profile.nativeKind!=='horse'||skin.skeleton?.bones.length!==677)return null;
 const previous=owned.get(skin);if(previous&&!previous.disposed)return previous;
 const hair=[];scene.traverse(o=>{if(o.isSkinnedMesh&&(o.geometry.attributes.position.count===23514||o.userData.nativeEquestrianGroom))hair.push(o);});
 if(!hair.length)return null;
 const boneMap=Object.fromEntries(skin.skeleton.bones.map(b=>[b.name,b]));
 const drivers=[{name:'mane',bone:boneMap.neck_03_016,cap:.065},{name:'forelock',bone:boneMap.head_019,cap:.025},{name:'tail',bone:boneMap.tail_03_0369,cap:.085}];
 if(drivers.some(d=>!d.bone))return null;
 for(const d of drivers)Object.assign(d,{ready:false,px:0,py:0,pz:0,ux:0,uy:0,uz:0,vx:0,vy:0,vz:0,x:0,y:0,z:0,dx:0,dy:0,dz:0,tx:0,ty:0,tz:0,offset:0});
 const records=[],rootIds=[],fjord=profile.nativeVariant?.id==='fjord',shellMeta=profile.nativeVariant?.groom?.equestrian;
 let cardCount=0,lockCount=0,protectedVertices=0;
 for(const mesh of hair){
  const original=mesh.geometry,g=mesh.userData.nativeRidingGroom?withNativeRidingResources(mesh.uuid+'|flowing',()=>original.clone()):original.clone(),position=g.attributes.position,raw=position.array,originalPosition=raw.slice(),weights=new Float32Array(position.count),parts=new Int8Array(position.count);parts.fill(-1);
  const oldGeo=new Float32Array(raw.length),newGeo=new Float32Array(raw.length),originalNormal=g.attributes.normal.array.slice();geometricNormals(g,oldGeo,normalWork(g));
  const authoredRoles=new Map();for(const c of shellMeta?.cards||[])authoredRoles.set(c.start,c.role);
  const riding=mesh.userData.nativeRidingGroom,meta=riding||shellMeta,shell=!!mesh.userData.nativeEquestrianGroom,groups=shell&&meta?.locks?meta.locks.map(l=>Array.from({length:l.count},(_,i)=>l.start+i)):islands(g),groupsOut=[];
  const sourceRootGroups=new Map((g.userData.nativeRidingSourceRoots||[]).map(r=>[r.start,r]));
  for(let k=0;k<groups.length;k++){
   const ids=groups[k];let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity,root=ids[0];
   for(const i of ids){const n=i*3,x=raw[n],y=raw[n+1],z=raw[n+2];minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);if(y>maxY){maxY=y;root=i;}}
   const sourceRoot=shell?null:sourceRootGroups.get(ids[0]);if(sourceRoot)root=sourceRoot.root;
   // Native cards use the same authoring centimetre frame, independent of the
   // current animation or actor transform. Tiny eyelash islands are protected.
   const role=shell?(riding?meta.locks[k].role:shellMeta.locks[k].part==='tail'?'tail':k>=12?'forelock':'mane'):sourceRoot?.role||authoredRoles.get(ids[0])||((maxZ+minZ)*.5< -60?'tail':Math.max(maxX-minX,maxY-minY,maxZ-minZ)<4?'lash':(maxZ+minZ)*.5>112?'forelock':'mane');
   if(role==='lash'||fjord&&role!=='tail'){protectedVertices+=ids.length;continue;}
   // Riding-shell texture V may sample an opaque dock; motion uses geometric rows.
   const lock=riding?meta.locks[k]:null,lockT=i=>{const n=i-lock.start,rings=lock.rows*(lock.sides+1);return n>=rings?n-rings:Math.floor(n/(lock.sides+1))/(lock.rows-1);};
   const part=role==='tail'?2:role==='forelock'?1:0,uv=g.attributes.uv,roots=shell?ids.filter(i=>(riding?lockT(i):uv.getY(i))===0):sourceRoot?sourceRoot.roots.slice():ids.filter(i=>maxY-raw[i*3+1]<.12);
   if(!roots.length)roots.push(root);let rx=0,ry=0,rz=0;for(const i of roots){rx+=raw[i*3];ry+=raw[i*3+1];rz+=raw[i*3+2];}rx/=roots.length;ry/=roots.length;rz/=roots.length;
   if(shell&&!riding)shapeLayeredLock(raw,ids,uv,role,k);
   const rootSet=new Set(roots),height=Math.max(.01,ry-minY),fineDraft=!shell&&!!shellMeta,
    length=riding?0:role==='tail'?Math.min(.24,Math.max(0,(minY-9)/height)):shell?.08:role==='forelock'?(fineDraft?.8:.08):fineDraft?1.25:.24,
    width=shell?0:role==='tail'?.32:role==='forelock'?.15:fineDraft?.35:.22;
   const group={ids,part,root,roots,weights:[],gain:.93+.14*((((riding?.flowLockOffset||0)+k)*37%101)/100)};
   for(const i of ids){const n=i*3,t=rootSet.has(i)?0:shell?clamp(riding?lockT(i):uv.getY(i),0,1):clamp((ry-raw[n+1])/height,0,1),w=t*t*(.8+.2*t);weights[i]=w;parts[i]=part;group.weights.push(w);
    // Preserve the whole root ring; broaden a lock gradually, without moving
    // its attachment or replacing tapered tips with broad rectangular ends.
    if(w){const fullness=smooth(t/.32);raw[n]=rx+(raw[n]-rx)*(1+width*fullness);raw[n+1]=ry+(raw[n+1]-ry)*(1+length*smooth(t/.40));raw[n+2]=rz+(raw[n+2]-rz)*(1+width*.45*fullness);
     if(fineDraft&&role!=='tail'){
      // Neighboring source fibers share a gently swept field instead of
      // stretching into parallel scratch lines. Roots and lashes remain exact.
      const envelope=smooth(t/.24)*Math.sin(t*Math.PI*.88),phase=rz*.055;
      const wave=Math.sin(t*Math.PI*1.5+phase),amplitude=Math.min(2.6,height*.16);
      raw[n]+=amplitude*envelope*(.55+.45*wave);raw[n+2]+=amplitude*envelope*wave*.85;
     }
    }
   }
   rootIds.push({mesh:mesh.name,role,ids:roots.slice()});groupsOut.push(group);if(shell)lockCount++;else cardCount++;
  }
  const work=normalWork(g,weights);geometricNormals(g,newGeo,work);transferNormals(oldGeo,newGeo,originalNormal,g.attributes.normal.array,work);
  g.attributes.position.setUsage(THREE.DynamicDrawUsage);g.attributes.normal.setUsage(THREE.DynamicDrawUsage);g.computeBoundingBox();g.computeBoundingSphere();g.boundingSphere.radius+=12;
  const rest=raw.slice(),normal=g.attributes.normal.array.slice(),baseGeo=newGeo.slice();
  mesh.geometry=g;records.push({mesh,original,g,rest,normal,baseGeo,scratch:newGeo,weights,parts,groups:groupsOut,originalPosition,normalWork:work});
 }
 const inverseScene=new THREE.Matrix4(),matrix=new THREE.Matrix4(),blend=new THREE.Matrix4(),joint=new THREE.Matrix4(),inverse=new THREE.Matrix4(),temp=new THREE.Matrix4();
 const activeBones=[...new Set(records.flatMap(r=>Array.from(r.g.attributes.skinIndex.array)))],skinFrames=new Float64Array(skin.skeleton.bones.length*12);
 let visibleOffset=false;
 const stats={version:3,frames:0,cardCount,lockCount,protectedVertices,maxTipOffsetM:0,maneTipOffsetM:0,tailTipOffsetM:0,finite:true,groundCorrections:0};
 function sample(d,dt,paused){matrix.multiplyMatrices(inverseScene,d.bone.matrixWorld);const e=matrix.elements,len=Math.hypot(e[4],e[5],e[6])||1,x=e[12],y=e[13],z=e[14],ux=e[4]/len,uy=e[5]/len,uz=e[6]/len;
  if(paused){d.vx=d.vy=d.vz=0;d.ready=true;}else if(d.ready){const mx=x-d.px,my=y-d.py,mz=z-d.pz,filter=1-Math.exp(-dt/.055);if(Math.hypot(mx,my,mz)>.45){d.x=d.y=d.z=d.dx=d.dy=d.dz=d.vx=d.vy=d.vz=0;d.tx=d.ty=d.tz=0;}else{const vx=d.vx+(clamp(mx/dt,-5,5)-d.vx)*filter,vy=d.vy+(clamp(my/dt,-5,5)-d.vy)*filter,vz=d.vz+(clamp(mz/dt,-5,5)-d.vz)*filter,ax=clamp((vx-d.vx)/dt,-35,35),ay=clamp((vy-d.vy)/dt,-35,35),az=clamp((vz-d.vz)/dt,-35,35),gain=d.name==='tail'?3.1:d.name==='mane'?2.7:1;
    d.tx=(-.024*vx-.0010*ax+.018*(d.ux-ux)/dt)*gain;d.ty=(-.009*vy-.0005*ay+.008*(d.uy-uy)/dt)*gain;d.tz=(-.021*vz-.0010*az+.018*(d.uz-uz)/dt)*gain;const length=Math.hypot(d.tx,d.ty,d.tz);if(length>d.cap){const q=d.cap/length;d.tx*=q;d.ty*=q;d.tz*=q;}d.vx=vx;d.vy=vy;d.vz=vz;
   }}else{d.ready=true;d.tx=d.ty=d.tz=0;}
  d.px=x;d.py=y;d.pz=z;d.ux=ux;d.uy=uy;d.uz=uz;
 }
 function reset(){for(const d of drivers){d.ready=false;for(const k of ['vx','vy','vz','x','y','z','dx','dy','dz','tx','ty','tz','offset'])d[k]=0;}for(const r of records){r.g.attributes.position.array.set(r.rest);r.g.attributes.normal.array.set(r.normal);r.g.attributes.position.needsUpdate=true;r.g.attributes.normal.needsUpdate=true;}stats.maxTipOffsetM=stats.maneTipOffsetM=stats.tailTipOffsetM=0;visibleOffset=false;skinFrames.fill(0);}
 function update(dt,state,options){
  if(controller.disposed||!Number.isFinite(dt)||dt<0)return;
  if(!options?.finalizedPose){scene.updateWorldMatrix(true,false);scene.updateMatrixWorld(true);}inverseScene.copy(scene.matrixWorld).invert();
  if(dt===0||state?.paused){for(const d of drivers)sample(d,0,true);return;}
  if(dt>.20||state?.reset||state?.discontinuity){reset();return;}
  const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;stats.groundCorrections=0;stats.maxTipOffsetM=stats.maneTipOffsetM=stats.tailTipOffsetM=0;
  for(const d of drivers){sample(d,dt,false);const stiffness=d.name==='tail'?121:196,damping=d.name==='tail'?20:25;for(let i=0;i<steps;i++){d.dx+=(stiffness*(d.tx-d.x)-damping*d.dx)*h;d.dy+=(stiffness*(d.ty-d.y)-damping*d.dy)*h;d.dz+=(stiffness*(d.tz-d.z)-damping*d.dz)*h;d.x+=d.dx*h;d.y+=d.dy*h;d.z+=d.dz*h;}d.offset=Math.hypot(d.x,d.y,d.z);if(d.offset>d.cap){const q=d.cap/d.offset;d.x*=q;d.y*=q;d.z*=q;d.offset=d.cap;}}
  // Cached actor-space skin operators serve both the grounded-tip guard and
  // an exact still-pose fast path. They never write to the shared skeleton.
  let poseChanged=false;
  const bind=records[0].mesh.bindMatrix;
  for(const id of activeBones){joint.multiplyMatrices(skin.skeleton.bones[id].matrixWorld,skin.skeleton.boneInverses[id]);temp.multiplyMatrices(inverseScene,joint).multiply(bind);const e=temp.elements,n=id*12;for(let row=0;row<3;row++)for(let col=0;col<4;col++){const k=n+row*4+col,value=e[col*4+row];if(Math.abs(skinFrames[k]-value)>1e-10)poseChanged=true;skinFrames[k]=value;}}
  const moving=drivers.some(d=>d.offset>1e-7);
  if(!poseChanged&&!moving&&!visibleOffset){stats.frames++;return;}
  visibleOffset=moving;
  for(const r of records){const p=r.g.attributes.position.array,si=r.g.attributes.skinIndex,sw=r.g.attributes.skinWeight,skeleton=r.mesh.skeleton;
   for(const group of r.groups){const d=drivers[group.part],e=blend.elements;e.fill(0);for(let k=0;k<4;k++){const w=sw.array[group.root*4+k];if(!w)continue;const j=si.array[group.root*4+k];joint.multiplyMatrices(skeleton.bones[j].matrixWorld,skeleton.boneInverses[j]);for(let c=0;c<16;c++)e[c]+=joint.elements[c]*w;}
    // Invert the actual weighted skin frame at the attached root, expressing a
    // scene-local spring in the authored skin frame, regardless of actor yaw.
    temp.multiplyMatrices(inverseScene,blend).multiply(r.mesh.bindMatrix);inverse.copy(temp).invert();const m=inverse.elements,gain=group.gain,dx=d.x*gain,dy=d.y*gain,dz=d.z*gain,x=m[0]*dx+m[4]*dy+m[8]*dz,y=m[1]*dx+m[5]*dy+m[9]*dz,z=m[2]*dx+m[6]*dy+m[10]*dz;
    for(let k=0;k<group.ids.length;k++){const id=group.ids[k],n=id*3,w=group.weights[k];p[n]=r.rest[n]+x*w;p[n+1]=r.rest[n+1]+y*w;p[n+2]=r.rest[n+2]+z*w;}
    const offset=d.offset*gain;stats.maxTipOffsetM=Math.max(stats.maxTipOffsetM,offset);if(group.part===2)stats.tailTipOffsetM=Math.max(stats.tailTipOffsetM,offset);else stats.maneTipOffsetM=Math.max(stats.maneTipOffsetM,offset);
   }
   // Bend only the free lock lengths against the actor-local ground. This
   // also covers lying down/grazing, where a safe standing tail can otherwise
   // penetrate after the native skin rotates it. Attached root vertices stay
   // exact, even if the original animation itself places one below its floor.
   for(let id=0;id<r.weights.length;id++)if(r.weights[id]>0){const n=id*3,x=p[n],y=p[n+1],z=p[n+2];let py=0;
    for(let k=0;k<4;k++){const w=sw.array[id*4+k];if(!w)continue;const b=si.array[id*4+k]*12+4;py+=w*(skinFrames[b]*x+skinFrames[b+1]*y+skinFrames[b+2]*z+skinFrames[b+3]);}
    if(py<.004){let a=0,b=0,c=0,d=0,e=0,f=0,g=0,h=0,i=0;
     for(let k=0;k<4;k++){const w=sw.array[id*4+k];if(!w)continue;const v=si.array[id*4+k]*12;a+=skinFrames[v]*w;b+=skinFrames[v+1]*w;c+=skinFrames[v+2]*w;d+=skinFrames[v+4]*w;e+=skinFrames[v+5]*w;f+=skinFrames[v+6]*w;g+=skinFrames[v+8]*w;h+=skinFrames[v+9]*w;i+=skinFrames[v+10]*w;}
     const det=a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);
     if(Math.abs(det)>1e-15){const lift=(.004-py)/det;p[n]+=(c*h-b*i)*lift;p[n+1]+=(a*i-c*g)*lift;p[n+2]+=(b*g-a*h)*lift;stats.groundCorrections++;visibleOffset=true;}
    }
   }
   geometricNormals(r.g,r.scratch,r.normalWork);transferNormals(r.baseGeo,r.scratch,r.normal,r.g.attributes.normal.array,r.normalWork);r.g.attributes.position.needsUpdate=true;r.g.attributes.normal.needsUpdate=true;
  }
  stats.frames++;stats.finite=Number.isFinite(stats.maxTipOffsetM);
 }
 const controller={meshes:records.map(r=>r.mesh),roots:rootIds,update,reset,inspect:()=>({...stats,drivers:drivers.map(d=>({name:d.name,offsetM:d.offset})),privateMeshes:records.length}),disposed:false,dispose(){if(controller.disposed)return;controller.disposed=true;for(const r of records){if(r.mesh.geometry===r.g)r.mesh.geometry=r.original;r.g.dispose();}owned.delete(skin);}};
 owned.set(skin,controller);return controller;
}
