// Original Wrenfell masonry. Old merged geometry/solidParts remain the authority.
export const LANDMARK_STONEWORK_PROFILE='landmark-stonework-1';
const installed=new WeakMap(),hash=(i,k=0)=>{const n=Math.sin(i*127.1+k*311.7+9.7)*43758.5453;return n-Math.floor(n);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export function withLandmarkStoneworkResources(run){const prior=Math.random;let s=0x7772656e;Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};try{return run();}finally{Math.random=prior;}}
export function landmarkStoneTexturesReady(source){return !!source&&[source.map,source.normalMap,source.roughnessMap].every(t=>{const i=t?.image;return i&&Number(i.naturalWidth??i.width)>0&&Number(i.naturalHeight??i.height)>0;});}
export async function waitForLandmarkStoneTextures(source,{timeout=12000,now=()=>performance.now(),frame=()=>new Promise(resolve=>setTimeout(resolve,40))}={}){const start=now();while(!landmarkStoneTexturesReady(source)){if(now()-start>=timeout)throw Error('Resident marble textures not ready before bounded deadline');await frame();}return true;}
export function buildLandmarkStoneworkData(original,pieces){
 const A=original.attributes,p=A.position.array,n=A.normal.array,c=A.color.array;if(original.index||!A.position||!A.normal||!A.color||p.length!==n.length||p.length!==c.length)throw Error('Original unindexed landmark arrays required');
 if(!Array.isArray(pieces)||pieces.length<300)throw Error('Original Wrenfell masonry pieces required');
 const P=[],N=[],U=[],C=[],I=[],pieceRanges=[],replaced=new Uint8Array(A.position.count);let curved=0;
 for(let id=0;id<pieces.length;id++){
  const r=pieces[id];if(!Number.isInteger(r.start)||!Number.isInteger(r.count)||r.start<0||r.start+r.count>A.position.count||r.start%3||r.count%3||r.matrix.length!==16||!r.matrix.every(Number.isFinite))throw Error('Invalid original stone span');
  for(let i=r.start;i<r.start+r.count;i++){if(replaced[i])throw Error('Duplicate original stone span');replaced[i]=1;}
  const first=P.length/3,m=r.matrix,size=r.size,tint=.78+hash(id,19)*.25;
  const emit=(pts,inside,offset=hash(id,23)*3)=>{
   let nor=cross(sub(pts[1],pts[0]),sub(pts[2],pts[0])),mid=pts.reduce((a,q)=>a.map((v,i)=>v+q[i]/3),[0,0,0]);if(dot(nor,sub(mid,inside))<0){pts=[pts[0],pts[2],pts[1]];nor=nor.map(v=>-v);}const len=Math.hypot(...nor);if(len<1e-12)throw Error('Degenerate stone face');nor=nor.map(v=>v/len);
   const points=pts.map(q=>{const v=q.map((v,i)=>v/size[i]);return[m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]];}),wn=cross(sub(points[1],points[0]),sub(points[2],points[0])),wl=Math.hypot(...wn),axis=nor.map(Math.abs).indexOf(Math.max(...nor.map(Math.abs))),base=P.length/3;
   for(let i=0;i<3;i++){P.push(...points[i]);N.push(...wn.map(v=>v/wl));const q=pts[i];U.push((axis===0?q[2]:q[0])/6.8013715744+offset,(axis===1?q[2]:q[1])/6.8013715744+offset*.31);C.push(tint,tint,tint);}I.push(base,base+1,base+2);
  };
  if(r.type==='BoxGeometry'){
   const[w,h,d]=size;if(!size.every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid original stone dimensions');
   let outline;const radius=Math.hypot(m[12],m[14]),radial=Math.abs(w-1.36)<1e-8&&Math.abs(h-.8)<1e-8&&Math.abs(d-1.15)<1e-8;
   if(radial){curved++;const half=Math.PI/30*.975,inner=(radius-d/2+.006)/Math.cos(half),outer=radius+d/2-.006;outline=[];for(const t of[-half,0,half])outline.push([Math.sin(t)*inner,Math.cos(t)*inner-radius]);for(const t of[half,0,-half])outline.push([Math.sin(t)*outer,Math.cos(t)*outer-radius]);}
   else{const x=w/2-.002,z=d/2-.002,b=Math.min(w,d)*(.055+hash(id,29)*.035);outline=[[-x+b,-z],[x-b,-z],[x,-z+b],[x,z-b],[x-b,z],[-x+b,z],[-x,z-b],[-x,-z+b]];}
   const bevel=Math.min(.025,h*.13),ys=[-h/2,-h/2+bevel,h/2-bevel,h/2],rings=ys.map((y,j)=>outline.map(([x,z],k)=>{const end=j===0||j===3,shrink=end?1-Math.min(.08,.025/Math.max(.02,Math.min(w,d)))*( .7+hash(id,k+31)*.3):1;return[x*shrink,y,z*shrink];})),inside=[0,0,0],len=outline.length;
   for(let j=0;j<3;j++)for(let k=0;k<len;k++){const next=(k+1)%len;emit([rings[j][k],rings[j+1][k],rings[j+1][next]],inside);emit([rings[j][k],rings[j+1][next],rings[j][next]],inside);}
   for(const j of[0,3]){const center=[0,ys[j],0];for(let k=0;k<len;k++)emit([center,rings[j][k],rings[j][(k+1)%len]],inside);}
  }else{
   for(let i=r.start;i<r.start+r.count;i++){const q=Array.from(p.subarray(i*3,i*3+3)),normal=Array.from(n.subarray(i*3,i*3+3)),axis=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));P.push(...q);N.push(...normal);U.push((axis===0?q[2]:q[0])/6.8013715744+hash(id,23)*3,(axis===1?q[2]:q[1])/6.8013715744);C.push(tint,tint,tint);I.push(I.length);}
  }
  pieceRanges.push({id,start:first,count:P.length/3-first,sourceStart:r.start,sourceCount:r.count,type:r.type,size:r.size,matrix:r.matrix,curved:radialFlag(r)});
 }
 function radialFlag(r){return r.type==='BoxGeometry'&&Math.abs(r.size[0]-1.36)<1e-8&&Math.abs(r.size[1]-.8)<1e-8&&Math.abs(r.size[2]-1.15)<1e-8;}
 const legacy={position:[],normal:[],color:[]};for(let i=0;i<A.position.count;i++)if(!replaced[i]){legacy.position.push(...p.subarray(i*3,i*3+3));legacy.normal.push(...n.subarray(i*3,i*3+3));legacy.color.push(...c.subarray(i*3,i*3+3));}
 return{stone:{position:new Float32Array(P),normal:new Float32Array(N),uv:new Float32Array(U),color:new Float32Array(C),index:new Uint32Array(I)},legacy:Object.fromEntries(Object.entries(legacy).map(([k,v])=>[k,new Float32Array(v)])),pieceRanges,curvedStones:curved,originalTriangles:A.position.count/3,stoneTriangles:I.length/3,legacyTriangles:legacy.position.length/9};
}
export function installLandmarkStonework(G,L){
 if(installed.has(L.mesh))return installed.get(L.mesh);const T=G.THREE,old=L.mesh,group=L.g,source=G.world.fallsLandscape?.rock?.material,meta=old?.userData.landmarkStoneworkSource;
 if(L.id!=='wrenfell'||!old?.visible||old.parent!==group||!meta||meta.profile!==LANDMARK_STONEWORK_PROFILE||old.geometry.drawRange.count===0)throw Error('Original Wrenfell source owner unavailable');
 if(!landmarkStoneTexturesReady(source))throw Error('Resident marble images unavailable');const data=buildLandmarkStoneworkData(old.geometry,meta.pieces),savedRange={...old.geometry.drawRange},owned=[],meshes=[];let material;
 try{withLandmarkStoneworkResources(()=>{
  material=new T.MeshStandardMaterial({name:'Wrenfell | weathered grey marble masonry',map:source.map,normalMap:source.normalMap,roughnessMap:source.roughnessMap,normalScale:new T.Vector2(.34,.34),color:'#d7d9d5',vertexColors:true,roughness:.96,metalness:0,envMapIntensity:.58});owned.push(material);
  material.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n#ifdef USE_MAP\nfloat wrenGrey=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(vec3(wrenGrey),diffuseColor.rgb,.18);\n#endif');};material.customProgramCacheKey=()=> 'wrenfell-grey-masonry-1';
  for(const[kind,arrays,mat]of[['masonry',data.stone,material],['original ground ivy and timber',data.legacy,old.material]]){const geo=new T.BufferGeometry();owned.push(geo);for(const[name,array]of Object.entries(arrays))if(name==='index')geo.setIndex(new T.BufferAttribute(array,1));else geo.setAttribute(name,new T.BufferAttribute(array,name==='uv'?2:3));geo.computeBoundingBox();geo.computeBoundingSphere();const mesh=new T.Mesh(geo,mat);mesh.name='Wrenfell | '+kind;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.collisionIgnore=true;meshes.push(mesh);}
 });}catch(e){for(const o of owned)o.dispose();throw e;}
 const state={status:'ready',profile:LANDMARK_STONEWORK_PROFILE,site:[L.x,L.y,L.z],oldMesh:old,meshes,originalTriangles:data.originalTriangles,stoneTriangles:data.stoneTriangles,legacyTriangles:data.legacyTriangles,triangles:data.stoneTriangles+data.legacyTriangles,curvedStones:data.curvedStones,pieces:meta.pieces.length,newGeometries:2,newMeshes:2,newMaterials:1,newTextures:0,geometryBytes:meshes.reduce((s,o)=>s+(o.geometry.index?.array.byteLength||0)+Object.values(o.geometry.attributes).reduce((a,b)=>a+b.array.byteLength,0),0),disposed:false};
 for(const m of meshes)group.add(m);old.geometry.setDrawRange(0,0);state.dispose=()=>{if(state.disposed)return;state.disposed=true;old.geometry.setDrawRange(savedRange.start,savedRange.count);for(const m of meshes){group.remove(m);m.geometry.dispose();}material.dispose();installed.delete(old);};installed.set(old,state);return state;
}
