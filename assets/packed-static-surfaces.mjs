// Artifact prototype: packed STATIC triangles only. Float64 preserves the exact
// Number results of Three.Vector3.applyMatrix4 and the existing query helpers.
const defaults=Object.freeze({vertices:1048576,triangles:600000,cells:300000,references:12000000});
const need=(ok,message)=>{if(!ok)throw Error(message);};
const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const at=(a,i)=>a.getX(i);
const key=(x,z)=>x+','+z;

export function createPackedStaticSurfaces(){
 const surfaceCells=new Map(),surfaceOwners=new Map(),supportCells=new Map();let serial=0;
 const activeSurface=e=>!(e.registeredParent&&!e.root.parent&&!e.root.userData.collisionBatched);
 function eachCell(packet,index,fn){if(!index)return;for(let x=0;x<index.width;x++)for(let z=0;z<index.height;z++){const i=x*index.height+z;if(index.offsets[i+1]>index.offsets[i])fn(key(x+index.minX,z+index.minZ),i);}}
 function removePacket(packet){
  for(const [map,index]of[[surfaceCells,packet.body],[supportCells,packet.support]])eachCell(packet,index,k=>{const row=map.get(k);row?.delete(packet);if(!row?.size)map.delete(k);});
 }
 function unregisterSurface(root){const packet=surfaceOwners.get(root);if(!packet)return;removePacket(packet);surfaceOwners.delete(root);}
 function install(packet){
  // New references are staged while the old owner remains intact. No await or
  // user callback is allowed during publication. A failed insert removes only
  // the new packet, preserving the previously registered owner and ordering.
  try{for(const[map,index]of[[surfaceCells,packet.body],[supportCells,packet.support]])eachCell(packet,index,(k,i)=>{if(!map.has(k))map.set(k,new Map());map.get(k).set(packet,i);});}
  catch(error){removePacket(packet);throw error;}
  const prior=surfaceOwners.get(packet.root);try{surfaceOwners.set(packet.root,packet);}catch(cause){
   // The raw backend is observable by diagnostic callers. Even an explicitly
   // injected own .set override that mutates then throws must not lose the old
   // owner. Restoration uses native Map operations with no user callback.
   let rollbackError=null;try{removePacket(packet);}catch(error){rollbackError=error;}
   try{if(prior)Map.prototype.set.call(surfaceOwners,packet.root,prior);else Map.prototype.delete.call(surfaceOwners,packet.root);}catch(error){rollbackError=error;}
   const restored=(prior?surfaceOwners.get(packet.root)===prior:!surfaceOwners.has(packet.root))&&!rollbackError;
   const error=new Error('Packed surface owner publication failed: '+cause.message,{cause});error.phase='surface-owner-publication';error.rollbackRestored=restored;if(rollbackError)error.rollbackError=rollbackError;throw error;
  }if(prior)removePacket(prior);return packet.length;
 }
 function prepareSurface(root,geometry=root.geometry,matrix=null,{supportStep=null,limits={}}={}){
  const cap={...defaults,...limits},p=geometry?.attributes?.position,index=geometry?.index;
  need(Object.keys(defaults).every(k=>Number.isSafeInteger(cap[k])&&cap[k]>0&&cap[k]<=defaults[k]),'Packed surface hard resource limits may only be tightened');
  need(root?.updateWorldMatrix&&p&&p.itemSize===3&&Number.isSafeInteger(p.count)&&p.count>=3&&Number.isSafeInteger(index?index.count:p.count)&&(index?index.count:p.count)>=0&&(index?index.count:p.count)%3===0,'Invalid static triangle surface');
  root.updateWorldMatrix(true,false);const rootWorld=root.matrixWorld.elements.slice(),transform=matrix||root.matrixWorld,M=transform?.elements?.slice(),parent=root.parent,n=index?index.count:p.count;
  need(M&&M.every(Number.isFinite),'Invalid static surface world transform');
  need(p.count<=cap.vertices&&n/3<=cap.triangles,'Packed surface source resource bound exceeded');
  need(supportStep===null||supportStep===.2,'Packed support uses the reviewed 0.2 metre step');
  let local=new Float64Array(p.count*3),originalIndex=new Uint32Array(n),world=new Float64Array(p.count*3),triangles=new Uint32Array(n),bounds=new Float64Array(n*2),denominators=new Float64Array(n/3),supportBounds=new Float64Array([Infinity,-Infinity,Infinity,-Infinity]);
  const packet={root,registeredParent:parent,world,triangles,bounds,denominators,supportBounds,marks:null,length:0,body:null,support:null};
  let phase='vertices',cursor=0,length=0,referenceCount=0,totalOperations=0,disposed=false,committed=false,indexBuild=null,minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,verification=0;
  const sameSource=()=>{need(geometry.attributes.position===p&&geometry.index===index&&p.count*3===local.length&&(index?index.count:p.count)===n,'Packed surface attributes changed during preparation');root.updateWorldMatrix(true,false);need(root.parent===parent&&equal(root.matrixWorld.elements,rootWorld)&&equal(transform.elements,M),'Packed surface root changed during preparation');};
  function sourceUnchanged(){sameSource();for(let i=0;i<p.count;i++)need(Object.is(p.getX(i),local[i*3])&&Object.is(p.getY(i),local[i*3+1])&&Object.is(p.getZ(i),local[i*3+2]),'Packed surface positions changed during preparation');for(let i=0;i<n;i++)need((index?at(index,i):i)===originalIndex[i],'Packed surface indices changed during preparation');}
  function beginIndex(step,name){
   if(!length){packet[name]={step,minX:0,minZ:0,width:0,height:0,offsets:new Uint32Array(1),refs:new Uint32Array(0)};return false;}
   const a=Math.floor(minX/step),b=Math.floor(maxX/step),c=Math.floor(minZ/step),d=Math.floor(maxZ/step),width=b-a+1,height=d-c+1;
   need([a,b,c,d,width*height].every(Number.isSafeInteger)&&width>0&&height>0&&width*height<=cap.cells,'Packed surface cell resource bound exceeded');
   indexBuild={step,name,minX:a,minZ:c,width,height,counts:new Uint32Array(width*height),offsets:null,refs:null,write:null,face:0,x:null,z:null,used:0,pass:'counts',prefix:0};return true;
  }
  function oneReference(){
   const B=indexBuild;if(B.face>=length)return false;const t=B.face,b=t*6;if(B.name==='support'&&Math.abs(denominators[t])<1e-10){B.face++;return true;}if(B.x===null){B.x=Math.floor(bounds[b]/B.step);B.z=Math.floor(bounds[b+2]/B.step);}const i=(B.x-B.minX)*B.height+B.z-B.minZ;
   need(i>=0&&i<B.counts.length,'Packed surface internal cell bound');
   if(B.pass==='counts'){need(B.used<cap.references,'Packed surface reference resource bound exceeded');B.counts[i]++;B.used++;referenceCount++;}
   else B.refs[B.write[i]++]=t;
   B.z++;if(B.z>Math.floor(bounds[b+3]/B.step)){B.z=Math.floor(bounds[b+2]/B.step);B.x++;if(B.x>Math.floor(bounds[b+1]/B.step)){B.face++;B.x=null;B.z=null;}}return true;
  }
  function finishIndex(){const B=indexBuild;packet[B.name]={step:B.step,minX:B.minX,minZ:B.minZ,width:B.width,height:B.height,offsets:B.offsets,refs:B.refs};indexBuild=null;}
  const builder={
   step({maximumOperations=256}={}){
    need(!disposed&&!committed,'Packed surface preparation is no longer active');need(Number.isInteger(maximumOperations)&&maximumOperations>0&&maximumOperations<=10000000,'Bounded positive preparation slice required');let used=0;
    while(used<maximumOperations&&phase!=='ready'){
     if(phase==='vertices'){
      if(cursor===p.count){phase='faces';cursor=0;continue;}
      const i=cursor++,j=i*3,x=p.getX(i),y=p.getY(i),z=p.getZ(i),w=1/(M[3]*x+M[7]*y+M[11]*z+M[15]);local[j]=x;local[j+1]=y;local[j+2]=z;world[j]=(M[0]*x+M[4]*y+M[8]*z+M[12])*w;world[j+1]=(M[1]*x+M[5]*y+M[9]*z+M[13])*w;world[j+2]=(M[2]*x+M[6]*y+M[10]*z+M[14])*w;
     }else if(phase==='faces'){
      if(cursor===n){packet.length=length;packet.marks=new Uint32Array(length);phase='body-index';cursor=0;if(!beginIndex(2,'body'))phase=supportStep===null?'verify':'support-index';continue;}
      const j=cursor,ids=[0,1,2].map(k=>index?at(index,j+k):j+k);cursor+=3;for(let k=0;k<3;k++){const i=ids[k];need(Number.isInteger(i)&&i>=0&&i<p.count,'Invalid surface index');originalIndex[j+k]=i;need(Number.isFinite(world[i*3])&&Number.isFinite(world[i*3+1])&&Number.isFinite(world[i*3+2]),'Nonfinite static surface triangle');}
      const a=ids[0]*3,b=ids[1]*3,c=ids[2]*3,ax=world[a],ay=world[a+1],az=world[a+2],bx=world[b],by=world[b+1],bz=world[b+2],cx=world[c],cy=world[c+1],cz=world[c+2],ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az;
      if(Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)<1e-10){used++;totalOperations++;continue;}
      const k=length*6;bounds[k]=Math.min(ax,bx,cx);bounds[k+1]=Math.max(ax,bx,cx);bounds[k+2]=Math.min(az,bz,cz);bounds[k+3]=Math.max(az,bz,cz);bounds[k+4]=Math.min(ay,by,cy);bounds[k+5]=Math.max(ay,by,cy);denominators[length]=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(denominators[length])>=1e-10){supportBounds[0]=Math.min(supportBounds[0],bounds[k]);supportBounds[1]=Math.max(supportBounds[1],bounds[k+1]);supportBounds[2]=Math.min(supportBounds[2],bounds[k+2]);supportBounds[3]=Math.max(supportBounds[3],bounds[k+3]);}triangles[length*3]=ids[0];triangles[length*3+1]=ids[1];triangles[length*3+2]=ids[2];minX=Math.min(minX,bounds[k]);maxX=Math.max(maxX,bounds[k+1]);minZ=Math.min(minZ,bounds[k+2]);maxZ=Math.max(maxZ,bounds[k+3]);length++;
     }else if(phase==='body-index'||phase==='support-index'){
      if(!indexBuild){if(!beginIndex(supportStep,'support')){phase='verify';continue;}}
      const B=indexBuild;
      if(B.pass==='counts'){
       if(!oneReference()){B.offsets=new Uint32Array(B.counts.length+1);B.pass='prefix';continue;}
      }else if(B.pass==='prefix'){
       if(B.prefix===B.counts.length){B.refs=new Uint32Array(B.used);B.write=B.offsets.slice(0,-1);B.pass='fill';B.face=0;B.x=B.z=null;continue;}
       const i=B.prefix++;B.offsets[i+1]=B.offsets[i]+B.counts[i];
      }else if(!oneReference()){const name=B.name;finishIndex();phase=name==='body'&&supportStep!==null?'support-index':'verify';continue;}
     }else if(phase==='verify'){
      if(verification<p.count){const i=verification++;need(Object.is(p.getX(i),local[i*3])&&Object.is(p.getY(i),local[i*3+1])&&Object.is(p.getZ(i),local[i*3+2]),'Packed surface positions changed during preparation');}
      else if(verification<p.count+n){const i=verification++-p.count;need((index?at(index,i):i)===originalIndex[i],'Packed surface indices changed during preparation');}
      else{sameSource();phase='ready';continue;}
     }else throw Error('Unknown packed preparation phase');
     used++;totalOperations++;
    }return{done:phase==='ready',operations:used,...builder.stats()};
   },
   commit(){need(!disposed&&!committed&&phase==='ready','Complete private preparation required before publication');sourceUnchanged();const result=install(packet);committed=true;local=originalIndex=null;phase='committed';return result;},
   dispose(){need(!committed,'Committed surface is owned by unregisterSurface');disposed=true;local=originalIndex=world=triangles=bounds=denominators=supportBounds=null;indexBuild=null;packet.body=packet.support=packet.world=packet.triangles=packet.bounds=packet.denominators=packet.supportBounds=packet.marks=null;phase='disposed';},
   stats(){return{phase,triangles:length,sourceVertices:p.count,sourceTriangles:n/3,referenceCount,totalOperations,bodyCells:packet.body?.offsets.length-1||0,supportCells:packet.support?.offsets.length-1||0,retainedBytes:disposed?0:world.byteLength+triangles.byteLength+bounds.byteLength+denominators.byteLength+supportBounds.byteLength+(packet.marks?.byteLength||0)+(packet.body?packet.body.offsets.byteLength+packet.body.refs.byteLength:0)+(packet.support?packet.support.offsets.byteLength+packet.support.refs.byteLength:0),temporaryBytes:(local?.byteLength||0)+(originalIndex?.byteLength||0)}}};
  return builder;
 }
 function registerSurface(root,geometry=root.geometry,matrix=null){const b=prepareSurface(root,geometry,matrix);while(!b.step({maximumOperations:10000000}).done){}return b.commit();}
 function nextSerial(){serial=(serial+1)>>>0;if(!serial){for(const p of surfaceOwners.values())p.marks.fill(0);serial=1;}return serial;}
 function* nearbySurfaces(x,z,r){
  const stamp=nextSerial(),triangle=[[0,0,0],[0,0,0],[0,0,0]],e={packet:null,face:0,get triangle(){const p=this.packet,t=this.face;for(let k=0;k<3;k++){const i=p.triangles[t*3+k]*3;triangle[k][0]=p.world[i];triangle[k][1]=p.world[i+1];triangle[k][2]=p.world[i+2];}return triangle;}};
  for(let ix=Math.floor((x-r)/2);ix<=Math.floor((x+r)/2);ix++)for(let iz=Math.floor((z-r)/2);iz<=Math.floor((z+r)/2);iz++)for(const[p,cell]of surfaceCells.get(key(ix,iz))||[]){
   const I=p.body;for(let j=I.offsets[cell];j<I.offsets[cell+1];j++){const t=I.refs[j];if(p.marks[t]===stamp)continue;p.marks[t]=stamp;const b=t*6;e.packet=p;e.face=t;e.root=p.root;e.registeredParent=p.registeredParent;e.minX=p.bounds[b];e.maxX=p.bounds[b+1];e.minZ=p.bounds[b+2];e.maxZ=p.bounds[b+3];e.minY=p.bounds[b+4];e.maxY=p.bounds[b+5];yield e;}
  }
 }
 function copySurfaceTriangle(packet,face,triangle){for(let k=0;k<3;k++){const i=packet.triangles[face*3+k]*3;triangle[k][0]=packet.world[i];triangle[k][1]=packet.world[i+1];triangle[k][2]=packet.world[i+2];}return triangle;}
 function visitNearbySurfaces(x,z,r,visit){
  const stamp=nextSerial();
  for(let ix=Math.floor((x-r)/2);ix<=Math.floor((x+r)/2);ix++)for(let iz=Math.floor((z-r)/2);iz<=Math.floor((z+r)/2);iz++)for(const[p,cell]of surfaceCells.get(key(ix,iz))||[]){
   const I=p.body;for(let j=I.offsets[cell];j<I.offsets[cell+1];j++){const t=I.refs[j];if(p.marks[t]===stamp)continue;p.marks[t]=stamp;visit(p,t);}
  }
 }
 function surfaceHeight(x,z,owner=null){
  // A radius-zero ray touches exactly one body cell, so its original Set has no
  // duplicates to remove. Iterate that same cell/owner/face order directly.
  let h=-Infinity;for(const[p,cell]of surfaceCells.get(key(Math.floor(x/2),Math.floor(z/2)))||[]){
   if(!activeSurface(p)||(owner&&p.root!==owner))continue;const I=p.body,P=p.world;
   for(let j=I.offsets[cell];j<I.offsets[cell+1];j++){const t=I.refs[j],a=p.triangles[t*3]*3,b=p.triangles[t*3+1]*3,c=p.triangles[t*3+2]*3,den=p.denominators[t];if(Math.abs(den)<1e-10)continue;
    const u=((P[b+2]-P[c+2])*(x-P[c])+(P[c]-P[b])*(z-P[c+2]))/den,v=((P[c+2]-P[a+2])*(x-P[c])+(P[a]-P[c])*(z-P[c+2]))/den,w=1-u-v;if(Math.min(u,v,w)<-1e-10)continue;h=Math.max(h,u*P[a+1]+v*P[b+1]+w*P[c+1]);
   }
  }return h;
 }
 function surfaceSupportHeight(x,z,owner=null){
  let h=-Infinity;for(const[p,cell]of supportCells.get(key(Math.floor(x/.2),Math.floor(z/.2)))||[]){if(owner&&p.root!==owner||!activeSurface(p))continue;const B=p.supportBounds;if(x<B[0]||x>B[1]||z<B[2]||z>B[3])continue;const I=p.support;
   for(let j=I.offsets[cell];j<I.offsets[cell+1];j++){const t=I.refs[j],b=t*6;if(x<p.bounds[b]-1e-10||x>p.bounds[b+1]+1e-10||z<p.bounds[b+2]-1e-10||z>p.bounds[b+3]+1e-10)continue;
    const ia=p.triangles[t*3]*3,ib=p.triangles[t*3+1]*3,ic=p.triangles[t*3+2]*3,P=p.world,den=p.denominators[t],u=((P[ib+2]-P[ic+2])*(x-P[ic])+(P[ic]-P[ib])*(z-P[ic+2]))/den,v=((P[ic+2]-P[ia+2])*(x-P[ic])+(P[ia]-P[ic])*(z-P[ic+2]))/den,w=1-u-v;if(Math.min(u,v,w)>=-1e-10)h=Math.max(h,u*P[ia+1]+v*P[ib+1]+w*P[ic+1]);
   }
  }return h;
 }
 const storageStats=()=>{let bytes=0,bodyReferences=0,supportReferences=0;for(const p of surfaceOwners.values()){bytes+=p.world.byteLength+p.triangles.byteLength+p.bounds.byteLength+p.denominators.byteLength+p.supportBounds.byteLength+p.marks.byteLength+p.body.offsets.byteLength+p.body.refs.byteLength+(p.support?p.support.offsets.byteLength+p.support.refs.byteLength:0);bodyReferences+=p.body.refs.length;supportReferences+=p.support?.refs.length||0;}return{owners:surfaceOwners.size,bodyCells:surfaceCells.size,supportCells:supportCells.size,bodyReferences,supportReferences,typedBytes:bytes};};
 return{surfaceCells,surfaceOwners,prepareSurface,registerSurface,unregisterSurface,nearbySurfaces,visitNearbySurfaces,copySurfaceTriangle,activeSurface,surfaceHeight,surfaceSupportHeight,storageStats};
}
