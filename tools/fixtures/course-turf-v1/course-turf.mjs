// Original clipped grass for the outer part of a mown course. This owns only
// private toroidal cells and a separate draw; existing cover rows stay untouched.
export const MOWN_COURSE_TURF=Object.freeze({
 profile:'mown-course-turf-1',cellMetres:6,windowCells:14,candidatesPerCell:120,
 highOrdinals:120,mediumOrdinals:80,lowOrdinals:50,
 highCapacity:6000,mediumCapacity:4000,lowCapacity:2500,
 triangles:24,leaves:8,sourceHeight:.08,minHeight:.03,maxHeight:.08,
 minSpread:.85,maxSpread:1.10,footprint:.34,innerHalfWidth:1.6,outerHalfWidth:3.4,
});
const finite=(v,label)=>{if(!Number.isFinite(v))throw Error('Nonfinite '+label);return v;};
export function mownTurfHash(x,z,ordinal,salt=0){
 let h=(Math.imul(x,374761393)^Math.imul(z,668265263)^Math.imul(ordinal+1,1274126177)^Math.imul(salt+1,2246822519))|0;
 h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;
}
let visualEpoch=0;
function constructVisual(make){
 const previous=Math.random;let seed=(0x37a926f1+Math.imul(++visualEpoch,2654435761))>>>0;
 Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 try{const result=make();if(result&&typeof result.then==='function')throw Error('Turf construction must be synchronous');return result;}finally{Math.random=previous;}
}
export function createMownCourseTurfGeometry(T){return constructVisual(()=>{
 const positions=[],colors=[],uvs=[],indices=[],leafRanges=[];
 const roots=[[-.016,-.009],[.012,-.008],[-.008,.016],[.016,.012]];
 const headings=[.22,1.64,2.65,3.22,4.55,5.30,6.01,2.10],heights=[.047,.073,.055,.080,.064,.051,.071,.060];
 for(let leaf=0;leaf<8;leaf++){
  const root=roots[leaf%4],a=headings[leaf],dx=Math.cos(a),dz=Math.sin(a),reach=.072+(leaf%4)*.012,width=.0038+(leaf%3)*.0006,start=positions.length/3,indexStart=indices.length;
  for(let ring=0;ring<3;ring++){
   const t=[0,.58,1][ring],rise=[0,.72,leaf%3===0?1:.93][ring],lean=reach*(.30*t+.70*t*t),cross=(leaf%2?-1:1)*.006*t*t;
   const cx=root[0]+dx*lean-dz*cross,cz=root[1]+dz*lean+dx*cross,half=width*[.42,.72,0][ring],roll=(leaf%2?-.16:.13)*t;
   for(const side of ring===2?[0]:[-1,1]){
    positions.push(cx-Math.sin(a)*half*side,heights[leaf]*rise+Math.sin(roll)*half*side,cz+Math.cos(a)*half*side);
    uvs.push((side+1)*.5,t);const shade=.34+.58*Math.pow(Math.sin(t*Math.PI*.5),.8);colors.push(shade*.91,shade,shade*.78);
   }
  }
  indices.push(start,start+1,start+2,start+1,start+3,start+2,start+2,start+3,start+4);
  leafRanges.push({vertexStart:start,vertexCount:5,indexStart,indexCount:9});
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(new Float32Array(positions.length),3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
 g.userData.mownCourseTurf={profile:MOWN_COURSE_TURF.profile,sourceHeight:.08,leaves:8,triangles:24,leafRanges};return g;
});}

// canRoot applies the actual world guards with the supplied complete animated
// footprint. courseDistance is the actual course-clear owner, never a replica.
export function createMownCourseTurfPlanner({canRoot,heightAt,colorAt,courseDistance,innerHalfWidth=MOWN_COURSE_TURF.innerHalfWidth}={}){
 if(![canRoot,heightAt,colorAt,courseDistance].every(f=>typeof f==='function'))throw Error('Actual turf world callbacks required');
 finite(innerHalfWidth,'inner course width');if(innerHalfWidth<1.5||innerHalfWidth>1.7)throw Error('Unreviewed inner course width');
 const slots=new Array(14*14);let invalidated=0,fills=0,lastCellX=null,lastCellZ=null;
 const slotAt=(x,z)=>((x%14)+14)%14+14*(((z%14)+14)%14);
 function fill(ci,cj){
  const rows=[];
  for(let ordinal=0;ordinal<120;ordinal++){
   const x=ci*6+mownTurfHash(ci,cj,ordinal,0)*6,z=cj*6+mownTurfHash(ci,cj,ordinal,1)*6;
   const d=finite(courseDistance(x,z),'course distance');
   if(d<innerHalfWidth+.34||d>=3.4||!canRoot(x,z,.34))continue;
   const ground=finite(heightAt(x,z),'turf ground'),epsilon=.34;
   const gx=finite((heightAt(x+epsilon,z)-heightAt(x-epsilon,z))/(2*epsilon),'ground gradient X'),gz=finite((heightAt(x,z+epsilon)-heightAt(x,z-epsilon))/(2*epsilon),'ground gradient Z');
   // Put the fitted plane just below every sampled footprint point. The
   // basis stays orthogonal; no Y shear is used for Three instance normals.
   const residuals=[0];for(let edge=0;edge<8;edge++){const angle=edge*Math.PI/4,dx=Math.cos(angle)*.34,dz=Math.sin(angle)*.34;residuals.push(finite(heightAt(x+dx,z+dz)-ground-gx*dx-gz*dz,'turf plane residual'));}
   const planeMin=Math.min(...residuals),planeMax=Math.max(...residuals);
   if(planeMax-planeMin>.015)continue; // Do not bury a short plant on broken terrain.
   const variation=mownTurfHash(ci,cj,ordinal,2),color=Array.from(colorAt(x,z,variation));
   if(color.length!==3||!color.every(v=>Number.isFinite(v)&&v>=0))throw Error('Invalid actual turf color');
   rows.push({cellX:ci,cellZ:cj,ordinal,id:ci+','+cj+','+ordinal,x,y:ground+planeMin-.002,z,gx,gz,planeResidual:{min:planeMin,max:planeMax,range:planeMax-planeMin},
    yaw:mownTurfHash(ci,cj,ordinal,3)*Math.PI*2,height:.03+.05*mownTurfHash(ci,cj,ordinal,4),spread:.85+.25*mownTurfHash(ci,cj,ordinal,5),color,courseDistance:d});
  }
  const cell={cellX:ci,cellZ:cj,rows,generation:invalidated};slots[slotAt(ci,cj)]=cell;fills++;return cell;
 }
 function plan(x,z,{quality='high',vr=false}={}){
  finite(x,'turf window X');finite(z,'turf window Z');if(!['high','medium','low'].includes(quality))throw Error('Unknown turf quality');
  const capacity=MOWN_COURSE_TURF[quality+'Capacity'],limit=MOWN_COURSE_TURF[quality+'Ordinals'];
  if(vr)return{rows:[],quality,vr:true,capacity,triangles:0,sourceFills:0,scope:'No supplemental turf in VR; existing cover remains owned by its original pipeline'};
  const cx=Math.floor(x/6)-7,cz=Math.floor(z/6)-7,rows=[],before=fills;
  for(let j=0;j<14;j++)for(let i=0;i<14;i++){
   const ci=cx+i,cj=cz+j,slot=slots[slotAt(ci,cj)],cell=slot&&slot.cellX===ci&&slot.cellZ===cj&&slot.generation===invalidated?slot:fill(ci,cj);
   for(const row of cell.rows)if(row.ordinal<limit)rows.push(row);
  }
  if(rows.length>capacity){const error=Error('Mown course turf capacity exceeded: '+rows.length+' > '+capacity+'; no visible roots were trimmed');error.data={quality,eligibleRows:rows.length,capacity,triangles:rows.length*24};throw error;}
  lastCellX=cx;lastCellZ=cz;
  return{rows,quality,vr:false,capacity,triangles:rows.length*24,sourceFills:fills-before,windowCellX:cx,windowCellZ:cz,
   instanceBytes:6000*19*4,sourceRows:rows.length,sourceCandidatesPerCell:120,scope:'All admitted private rows within the toroidal window; fixed ordinal Low/Medium subsets, no global RNG or original cover edits'};
 }
 return{plan,invalidate:()=>{invalidated++;lastCellX=lastCellZ=null;},stats:()=>({fills,generation:invalidated,lastCellX,lastCellZ,slotCount:slots.filter(Boolean).length})};
}

export function createMownCourseTurfMesh(T,material){return constructVisual(()=>{
 if(!material)throw Error('Existing near turf material required');const geometry=createMownCourseTurfGeometry(T);let mesh=null;
 try{mesh=new T.InstancedMesh(geometry,material,6000);mesh.setColorAt(0,new T.Color());mesh.name='Mown course shoulder turf';mesh.count=0;mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.castShadow=false;mesh.userData.fineGroundCover=true;mesh.userData.mownCourseTurf={profile:MOWN_COURSE_TURF.profile,privateRows:true};return mesh;}catch(error){mesh?.dispose();geometry.dispose();throw error;}
});}
export function packMownCourseTurf(mesh,plan){
 if(plan.rows.length>mesh.instanceMatrix.count)throw Error('Turf target capacity mismatch');const matrices=mesh.instanceMatrix.array,colors=mesh.instanceColor?.array;if(!colors)throw Error('Shared-color turf buffer missing');
 matrices.fill(0);colors.fill(0);
 for(let i=0;i<plan.rows.length;i++){
  const r=plan.rows[i],c=Math.cos(r.yaw),s=Math.sin(r.yaw),normal=[-r.gx,1,-r.gz],nl=Math.hypot(...normal);for(let k=0;k<3;k++)normal[k]/=nl;
  const u=[c,r.gx*c-r.gz*s,-s],ul=Math.hypot(...u);for(let k=0;k<3;k++)u[k]/=ul;
  const v=[u[1]*normal[2]-u[2]*normal[1],u[2]*normal[0]-u[0]*normal[2],u[0]*normal[1]-u[1]*normal[0]],o=i*16;
  for(let k=0;k<3;k++){matrices[o+k]=u[k]*r.spread;matrices[o+4+k]=normal[k]*(r.height/(.08*nl));matrices[o+8+k]=v[k]*r.spread;}
  matrices[o+12]=r.x;matrices[o+13]=r.y;matrices[o+14]=r.z;matrices[o+15]=1;colors.set(r.color,i*3);
 }
 mesh.count=plan.rows.length;mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
 return{rows:mesh.count,triangles:mesh.count*24,instanceBytes:matrices.byteLength+colors.byteLength,materialShared:true};
}

export function installCourseTurf(G){
 const T=G.THREE,W=G.world,scene=G.scene,state={profile:MOWN_COURSE_TURF.profile,mesh:null,planner:null,rows:[],stats:{rows:0,triangles:0},errors:[],lastFailure:null,disposed:false};
 let lastCellX=null,lastCellZ=null,lastQuality=null,lastVR=null,dirty=true;
 const onTick=(dt,t)=>{try{const p=G.horse?.player?.pos;if(!p)throw Error('Actual rider position unavailable');state.tick(t,p.x,p.z);}catch(error){fail(error);}};
 function fail(error){
  state.errors.push(String(error?.message||error));state.lastFailure={message:String(error?.message||error),data:error?.data??null,priorStats:{...state.stats},planner:state.planner?.stats?.()??null};state.dispose();
 }
 state.dispose=()=>{
  if(state.disposed)return;state.disposed=true;G.off?.('tick',onTick);
  if(state.mesh){state.mesh.count=0;scene?.remove(state.mesh);state.mesh.geometry.dispose();state.mesh.dispose();}
  state.rows=[];state.planner=null;
 };
 state.invalidate=()=>{dirty=true;state.planner?.invalidate();};
 state.tick=(t,x,z,force=false)=>{
  if(state.disposed||!state.planner||!state.mesh)return state.stats;
  if(typeof G.gfx?.get!=='function')throw Error('Actual turf quality unavailable');
  const quality=G.gfx.get(),vr=!!G.renderer?.xr?.isPresenting,cx=Math.floor(x/6),cz=Math.floor(z/6);
  if(!force&&!dirty&&cx===lastCellX&&cz===lastCellZ&&quality===lastQuality&&vr===lastVR)return state.stats;
  try{
   const plan=state.planner.plan(x,z,{quality,vr}),packed=packMownCourseTurf(state.mesh,plan);state.rows=plan.rows;
   state.stats={...packed,quality,vr,sourceFills:plan.sourceFills,capacity:plan.capacity,footprint:.34,innerHalfWidth:1.6,sourceCandidatesPerCell:120,privateRows:true,addedTextures:0,addedMaterials:0};
   lastCellX=cx;lastCellZ=cz;lastQuality=quality;lastVR=vr;dirty=false;return state.stats;
  }catch(error){fail(error);return state.stats;}
 };
 state.ready=(async()=>{
  if(!T||!W||!scene||!W.pastoralCoverReady||!G.courseClear?.ready||!W.mixedSward?.ready)throw Error('Actual final course/pastoral/mixed ready dependencies required');
  await Promise.all([W.pastoralCoverReady,G.courseClear.ready,W.mixedSward.ready,G.photoscans?.ready,G.photoscans?.floraRetirementReady,G.worldDetails?.ready,G.undergrowth?.ready]);
  if(state.disposed)return state;
  const cover=W.nearGroundCover,source=cover?.swardSource;
  if(!cover?.near?.material||typeof source?.canCourseTurf!=='function'||typeof source?.courseTurfColor!=='function'||typeof W.groundH!=='function'||typeof G.courseClear?.courseDist!=='function')throw Error('Actual course-turf material/source/terrain callbacks required');
  const color=constructVisual(()=>new T.Color());
  state.planner=createMownCourseTurfPlanner({canRoot:(x,z,r)=>source.canCourseTurf(x,z,r),heightAt:W.groundH,
   colorAt:(x,z,sample)=>{source.courseTurfColor(x,z,sample,color);return[color.r,color.g,color.b];},courseDistance:(x,z)=>G.courseClear.courseDist(x,z)});
  if(typeof G.gfx?.get!=='function'||!G.horse?.player?.pos)throw Error('Actual turf quality/rider callbacks required');
  // Prove the first complete plan fits before allocating a render resource.
  const p=G.horse.player.pos,first=state.planner.plan(p.x,p.z,{quality:G.gfx.get(),vr:!!G.renderer?.xr?.isPresenting});
  state.mesh=createMownCourseTurfMesh(T,cover.near.material);packMownCourseTurf(state.mesh,first);scene.add(state.mesh);state.rows=first.rows;
  state.stats={rows:first.rows.length,triangles:first.triangles,quality:first.quality,vr:first.vr,capacity:first.capacity,instanceBytes:state.mesh.instanceMatrix.array.byteLength+state.mesh.instanceColor.array.byteLength,addedTextures:0,addedMaterials:0,materialShared:state.mesh.material===cover.near.material,privateRows:true};
  G.on?.('tick',onTick);dirty=true;state.tick(0,p.x,p.z,true);return state;
 })().catch(error=>{fail(error);return state;});
 return state;
}
