// Original coursed farm masonry. The existing blocks remain the sole physics
// and camera authorities; this model stays inside their recorded closed boxes.
export const BARLEYFOLD_WALL_PROFILE='barleyfold-coursed-farm-wall-1';
const installed=new WeakMap();
const hash=(a,b=0)=>{const n=Math.sin(a*127.1+b*311.7+17.3)*43758.5453;return n-Math.floor(n);};
const sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
export function buildBarleyfoldWallData(records,{excludedIndices=[]}={}){
 if(!Array.isArray(records)||records.length!==46)throw Error('Exact46 Barleyfold wall units required');
 const excluded=new Set(excludedIndices);if(excluded.size!==excludedIndices.length||[...excluded].some(i=>!Number.isInteger(i)||i<0||i>=46))throw Error('Invalid excluded wall unit');
 const P=[],N=[],U=[],C=[],I=[],units=[];
 let recordIndex=0;
 for(const r of records){
  const originalIndex=recordIndex++;if(excluded.has(originalIndex))continue;
  if(![r.x,r.z,r.groundY,r.rotation].every(Number.isFinite)||!Number.isInteger(r.run)||r.run<0||r.run>3)throw Error('Nonfinite Barleyfold wall unit');
  const cos=Math.cos(r.rotation),sin=Math.sin(r.rotation),seed=r.x*7+r.z*13,start=I.length;
  const world=p=>[r.x+cos*p[0]+sin*p[2],r.groundY+p[1],r.z-sin*p[0]+cos*p[2]];
  function tri(points,inside,tint,offset=0){
   let normal=cross(sub(points[1],points[0]),sub(points[2],points[0]));const mid=points.reduce((a,v)=>a.map((n,i)=>n+v[i]/3),[0,0,0]);
   if(dot(normal,sub(mid,inside))<0){points=[points[0],points[2],points[1]];normal=normal.map(v=>-v);}
   const len=Math.hypot(...normal);if(len<1e-10)throw Error('Degenerate farm masonry face');normal=normal.map(v=>v/len);
   const wn=[cos*normal[0]+sin*normal[2],normal[1],-sin*normal[0]+cos*normal[2]],axis=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs))),first=P.length/3;
   for(const p of points){const w=world(p);P.push(...w);N.push(...wn);C.push(tint,tint,tint);U.push((axis===0?p[2]:p[0])/1.4+offset,(axis===1?p[2]:p[1])/1.4+offset*.37);}
   I.push(first,first+1,first+2);
  }
  function box(w,h,d,y,tint){
   const v=[];for(const z of[-d/2,d/2])for(const yy of[y-h/2,y+h/2])for(const x of[-w/2,w/2])v.push([x,yy,z]);
   const centre=[0,y,0];for(const q of[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]]){tri([v[q[0]],v[q[1]],v[q[2]]],centre,tint);tri([v[q[0]],v[q[2]],v[q[3]]],centre,tint);}
  }
  // Continuous recessed mortar backing prevents holes between real block joints.
  // It also retains the original body's exact X/Y extent without face overlays.
  box(6.1,2.2,.66,1.1,.44);
  let stones=0;
  for(let row=0;row<8;row++){
   const cuts=[-3.05],pitch=.61,phase=row%2?.5:1;
   for(let x=-3.05+phase*pitch;x<3.05-.02;x+=pitch)cuts.push(x+(hash(seed+row*31+cuts.length,41)-.5)*.052);
   cuts.push(3.05);
   for(let col=0;col<cuts.length-1;col++){
    const sid=seed+row*83+col*17,left=cuts[col]+.004+hash(sid,43)*.004,right=cuts[col+1]-.004-hash(sid,47)*.004,w=right-left;
    const lo=row*.275+.005+hash(sid,53)*.004,hi=(row+1)*.275-.005-hash(sid,59)*.004,h=hi-lo,cx=(left+right)/2;
    const profile=[[left+w*.055,lo],[right-w*.045,lo+.002],[right,lo+h*.46],[right-w*.075,hi],[left+w*.065,hi-.002],[left,lo+h*.52]],rings=[-1,1].map(s=>profile.map(([x,y])=>[x,y,s*(.425+(hash(sid+x*3,y*11)-.5)*.008)])),inside=[cx,(lo+hi)/2,0],tint=.78+hash(sid,61)*.25,offset=hash(sid,67)*4;
    for(let side=0;side<2;side++){
     const sign=side===0?-1:1,centre=[cx+(hash(sid,71)-.5)*w*.045,lo+h*(.48+(hash(sid,73)-.5)*.06),sign*.45];
     for(let i=0;i<6;i++)tri([centre,rings[side][i],rings[side][(i+1)%6]],inside,tint,offset);
    }
    for(let i=0;i<6;i++){const j=(i+1)%6;tri([rings[0][i],rings[0][j],rings[1][j]],inside,tint,offset);tri([rings[0][i],rings[1][j],rings[1][i]],inside,tint,offset);}stones++;
   }
  }
  const bodyEnd=I.length;
  // Individually jointed, pitched coping, wholly inside old6.2×.25×1.1 cap.
  // Uneven shoulders and shallow end chips replace the long cuboid highlight.
  const capBase=2.3;
  for(let k=0;k<7;k++){
   const sid=seed+k*23+809,left=-3.1+k*6.2/7+.005,right=-3.1+(k+1)*6.2/7-.005,crest=.125-hash(sid,97)*.008;
   const section=[[-.55,-.125],[.55,-.125],[.55,-.054],[.22,.075],[0,crest],[-.22,.078],[-.55,-.051]],ends=[left,right].map((x,i)=>section.map(([z,y],j)=>[x+(j>1?(i===0?1:-1)*hash(sid+j,101)*.012:0),capBase+y,z])),inside=[(left+right)/2,capBase-.005,0],tint=.83+hash(sid,103)*.16,offset=hash(sid,107)*4;
   for(const end of ends)for(let i=1;i<section.length-1;i++)tri([end[0],end[i],end[i+1]],inside,tint,offset);
   for(let i=0;i<section.length;i++){const j=(i+1)%section.length;tri([ends[0][i],ends[1][i],ends[1][j]],inside,tint,offset);tri([ends[0][i],ends[1][j],ends[0][j]],inside,tint,offset);}
  }
  units.push({index:originalIndex,run:r.run,x:r.x,z:r.z,groundY:r.groundY,rotation:r.rotation,indexStart:start,indexCount:I.length-start,bodyIndexCount:bodyEnd-start,bodyStones:stones,copingStones:7,bodyBounds:{min:[-3.05,0,-.45],max:[3.05,2.2,.45]},capBounds:{min:[-3.1,2.175,-.55],max:[3.1,2.425,.55]}});
 }
 return{positions:new Float32Array(P),normals:new Float32Array(N),uvs:new Float32Array(U),colors:new Float32Array(C),indices:new Uint32Array(I),units,triangles:I.length/3};
}
export function withBarleyfoldWallResources(run){
 const random=Math.random;let seed=0x62617231;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 try{return run();}finally{Math.random=random;}
}
export function barleyfoldWallTexturesReady(source){
 return !!source&&[source.map,source.normalMap,source.roughnessMap].every(t=>{const i=t?.image;return i&&Number(i.naturalWidth??i.width)>0&&Number(i.naturalHeight??i.height)>0;});
}
export async function waitForBarleyfoldWallTextures(source,{timeout=12000,errors=()=>[],now=()=>globalThis.performance?.now?.()??Date.now(),frame=()=>new Promise(resolve=>{let id;const timer=setTimeout(()=>{if(id!==undefined)cancelAnimationFrame(id);resolve();},50);id=requestAnimationFrame(()=>{clearTimeout(timer);resolve();});})}={}){
 const start=now();while(!barleyfoldWallTexturesReady(source)){
  if(errors().some(e=>String(e).includes('rock_boulder_cracked')))throw Error('Resident limestone texture failed');
  if(now()-start>=timeout)throw Error('Resident limestone textures not ready before bounded deadline');
  await frame();
 }
 return{textures:3,images:[source.map,source.normalMap,source.roughnessMap].map(t=>({width:Number(t.image.naturalWidth??t.image.width),height:Number(t.image.naturalHeight??t.image.height)}))};
}
export function installBarleyfoldFarmWall(G,{group,records}){
 const T=G.THREE,source=G.world.ranchBuilderArt.materials.stone;
 if(installed.has(group))return installed.get(group);
 if(!barleyfoldWallTexturesReady(source))throw Error('Resident limestone PBR images unavailable');
 const seen=new Set(),saved=[],activeSaved=[],retiredIndices=[];
 if(!Array.isArray(records)||records.length!==46)throw Error('Exact46 Barleyfold wall units required');
 for(let index=0;index<records.length;index++){const r=records[index],hidden=r.body?.visible===false&&r.cap?.visible===false;
  if(r.body?.visible!==r.cap?.visible)throw Error('Partially retired original farmwall unit');
  if(hidden){if(r.run!==1||r.x!==256||Math.abs(r.z+66.92857142857143)>1e-9)throw Error('Unexpected retired farmwall unit');retiredIndices.push(index);}
  for(const mesh of[r.body,r.cap]){if(!mesh?.isMesh||mesh.parent!==group||mesh.geometry.type!=='BoxGeometry'||seen.has(mesh)||mesh.geometry.drawRange.count===0)throw Error('Unexpected original farmwall owner');seen.add(mesh);const row={mesh,range:{...mesh.geometry.drawRange}};saved.push(row);if(!hidden)activeSaved.push(row);}
 }
 if(retiredIndices.length!==1||activeSaved.length!==90)throw Error('Expected45 active and1 already-retired farmwall units');
 const expected=[10,12,13,11];for(let run=0;run<4;run++)if(records.filter(r=>r.run===run).length!==expected[run])throw Error('Original farmwall run counts changed');
 for(const r of records){for(const[mesh,w,h,d,y]of[[r.body,6.1,2.2,.9,r.groundY+1.1],[r.cap,6.2,.25,1.1,r.groundY+2.3]]){const p=mesh.geometry.parameters;if(p.width!==w||p.height!==h||p.depth!==d||mesh.position.x!==r.x||mesh.position.z!==r.z||mesh.position.y!==y||mesh.rotation.y!==r.rotation)throw Error('Original farmwall dimensions/transform changed');}}
 const data=buildBarleyfoldWallData(records,{excludedIndices:retiredIndices}),owned=[],geometries=[],meshes=[];let material;
 try{
  withBarleyfoldWallResources(()=>{
   material=source.clone();owned.push(material);material.name='Barleyfold | coursed limestone';material.vertexColors=true;
   for(let run=0;run<4;run++){
    const units=data.units.filter(r=>r.run===run),start=units[0].indexStart,end=units.at(-1).indexStart+units.at(-1).indexCount;
    const geometry=new T.BufferGeometry();owned.push(geometry);geometries.push(geometry);
    for(const[name,array,size]of[['position',data.positions,3],['normal',data.normals,3],['uv',data.uvs,2],['color',data.colors,3]])geometry.setAttribute(name,new T.BufferAttribute(array.subarray(start*size,end*size),size));
    geometry.setAttribute('uv1',geometry.getAttribute('uv'));
    const index=data.indices.slice(start,end);for(let i=0;i<index.length;i++)index[i]-=start;
    geometry.setIndex(new T.BufferAttribute(index,1));geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new T.Mesh(geometry,material);mesh.name='Barleyfold | modelled farm masonry | run '+run;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.collisionIgnore=true;mesh.userData.barleyfoldRun=run;meshes.push(mesh);
   }
  });
 }catch(error){for(const r of owned)r.dispose();throw error;}
 const state={status:'ready',profile:BARLEYFOLD_WALL_PROFILE,meshes,records:data.units,sourceMeshes:saved.map(r=>r.mesh),activeSourceMeshes:activeSaved.map(r=>r.mesh),retiredSourceMeshes:saved.filter(r=>!activeSaved.includes(r)).map(r=>r.mesh),sourceRecordCount:46,activeUnits:45,retiredUnits:1,retiredIndices,triangles:data.triangles,originalTriangles:45*24,addedTriangles:data.triangles-45*24,renderDrawCalls:4,shadowDrawCalls:4,newGeometries:4,newMaterials:1,newTextures:0,geometryBytes:[...new Set(geometries.flatMap(g=>[g.index.array.buffer,...Object.values(g.attributes).map(a=>a.array.buffer)]))].reduce((n,b)=>n+b.byteLength,0),sourceMaterial:source.name,disposed:false};
 // Original owner visibility/matrices/geometry/bounds/registration remain active.
 // All new resources are prepared; adoption changes only old draw ranges.
 for(const mesh of meshes)group.add(mesh);for(const r of activeSaved)r.mesh.geometry.setDrawRange(0,0);
 state.dispose=()=>{if(state.disposed)return;state.disposed=true;for(const r of saved)r.mesh.geometry.setDrawRange(r.range.start,r.range.count);for(const mesh of meshes)group.remove(mesh);for(const geometry of geometries)geometry.dispose();material.dispose();installed.delete(group);};
 installed.set(group,state);return state;
}
