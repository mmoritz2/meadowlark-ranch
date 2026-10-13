// Original weathered rubble masonry. Coordinate hashing creates local stone
// shape only; authored unit placement and the world's RNG stream are untouched.
const hash=(a,b=0)=>{const n=Math.sin(a*127.1+b*311.7+17.3)*43758.5453;return n-Math.floor(n);};
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((v,n,i)=>v+n*b[i],0);
export function createCoursedFieldWallGeometry(records,groundH){
 const p=[],n=[],uv=[],col=[],idx=[],units=[];
 const point=(r,x,y,z)=>{const wx=r.x+r.tx*x+r.nx*z,wz=r.z+r.tz*x+r.nz*z,h=groundH(wx,wz);if(!Number.isFinite(h))throw Error('Invalid rubble wall footing');return [wx,h+y,wz];};
 function stone(r,left,right,lo,h,d,seed,coping=false){
  const w=right-left,cx=(left+right)/2,half=w/2,depth=d/2;
  // Smaller uneven blocks have broad interlocking bearings. The split face is
  // a shallow real convex ridge rather than a flat rectangular side panel.
  const profile=[[-half+w*(.07+hash(seed,71)*.07),lo],
   [half-w*(.06+hash(seed,73)*.08),lo+.008*hash(seed,74)],
   [half-w*.015,lo+h*(.39+hash(seed,79)*.15)],
   [half-w*(.11+hash(seed,83)*.07),lo+h*(.97+hash(seed,89)*.03)],
   [-half+w*(.09+hash(seed,97)*.09),lo+h*(.95+hash(seed,101)*.04)],
   [-half+w*.015,lo+h*(.42+hash(seed,103)*.17)]];
  const tint=.80+hash(seed,11)*.20,offset=[hash(seed,19)*3,hash(seed,23)*3];
  const rings=[-1,1].map(side=>profile.map(([x,y],i)=>{
   // Every corner follows the same actual ground function; a whole 1.15 m
   // unit therefore never acquires the old level-top staircase on a grade.
   // Batter and small face chips remain strictly inside the source thickness.
   const z=side*(depth-.011-(y-lo)/h*.022+(hash(seed+i,127)-.5)*.010);
   return point(r,cx+x,y,z);
  }));
  const interior=rings.flat().reduce((a,v)=>a.map((n,i)=>n+v[i]/12),[0,0,0]);
  function tri(points){
   let normal=cross(sub(points[1],points[0]),sub(points[2],points[0]));
   const mid=points.reduce((a,v)=>a.map((n,i)=>n+v[i]/3),[0,0,0]);
   if(dot(normal,sub(mid,interior))<0){points=[points[0],points[2],points[1]];normal=normal.map(v=>-v);}
   const L=Math.hypot(...normal);if(L<1e-10)throw Error('Degenerate rubble stone');normal=normal.map(v=>v/L);
   const axis=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs))),start=p.length/3;
   for(const v of points){p.push(...v);n.push(...normal);col.push(tint,tint,tint);const a=axis===0?v[2]:v[0],c=axis===1?v[2]:v[1];uv.push(a/.9+offset[0],c/.9+offset[1]);}
   idx.push(start,start+1,start+2);
  }
  for(let side=0;side<2;side++){
   const s=side===0?-1:1,centre=point(r,cx+(hash(seed,137)-.5)*w*.05,lo+h*(.48+(hash(seed,139)-.5)*.12),s*(depth+.009+hash(seed,149)*.007));
   for(let i=0;i<6;i++)tri([centre,rings[side][i],rings[side][(i+1)%6]]);
  }
  for(let i=0;i<6;i++){
   const j=(i+1)%6;tri([rings[0][i],rings[0][j],rings[1][j]]);tri([rings[0][i],rings[1][j],rings[1][i]]);
  }
 }
 for(const r of records){
  if(![r.x,r.z,r.tx,r.tz,r.nx,r.nz].every(Number.isFinite))throw Error('Invalid field wall record');
  const seed=r.x*7+r.z*13,start=idx.length,half=.575;
  for(let row=0;row<4;row++){
   const count=row%2?4:5,cuts=[-half];
   for(let i=1;i<count;i++)cuts.push(-half+i*1.15/count+(hash(seed+i*7,row+211)-.5)*.040);
   cuts.push(half);
   const lo=[-.055,.128,.322,.510][row],h=[.208,.217,.208,.205][row],d=.64-row*.035;
   for(let i=0;i<count;i++){
    const gap=.003+hash(seed+i,row+223)*.003;
    stone(r,cuts[i]+gap,cuts[i+1]-gap,lo+(hash(seed+i,row+227)-.5)*.006,h,d,seed+row*43+i*11);
   }
  }
  for(let i=0;i<5;i++){
   const left=-half+i*1.15/5+.004+hash(seed+i,241)*.005,right=-half+(i+1)*1.15/5-.004-hash(seed+i,251)*.005;
   stone(r,left,right,.699+hash(seed+i,257)*.008,.184+hash(seed+i,263)*.034,.532,seed+307+i*13,true);
  }
  units.push({x:r.x,z:r.z,tx:r.tx,tz:r.tz,nx:r.nx,nz:r.nz,legacyRows:r.legacyRows,indexStart:start,indexCount:idx.length-start,visible:true,triangles:(idx.length-start)/3,halfLength:.575,halfDepth:.35,maxHeight:.952});
 }
 return {positions:new Float32Array(p),normals:new Float32Array(n),uvs:new Float32Array(uv),colors:new Float32Array(col),indices:new Uint32Array(idx),units,triangles:idx.length/3};
}

// A source unit needs no duplicate wall when its entire centreline lies in
// the five-centimetre capsule of existing jumpable segments. Intersect the
// line with each segment's strip and endpoint disks, then union the intervals.
// This uses only authored doubles and plain objects: no RNG or GPU resources.
function fieldWallSpanCovered(unit,walls){
 const half=unit.halfLength,radius=.05,intervals=[],tx=unit.tx,tz=unit.tz;
 const add=(a,b)=>{a=Math.max(-half,a);b=Math.min(half,b);if(a<=b)intervals.push([a,b]);};
 const disk=(x,z)=>{
  const dx=unit.x-x,dz=unit.z-z,A=tx*tx+tz*tz,B=2*(dx*tx+dz*tz),C=dx*dx+dz*dz-radius*radius,D=B*B-4*A*C;
  if(A<=1e-12||D<0)return;const d=Math.sqrt(D);add((-B-d)/(2*A),(-B+d)/(2*A));
 };
 for(const wall of walls){
  if(![wall?.x1,wall?.z1,wall?.x2,wall?.z2].every(Number.isFinite))continue;
  const dx=wall.x2-wall.x1,dz=wall.z2-wall.z1,L=Math.hypot(dx,dz);if(L<=1e-9)continue;
  const ex=dx/L,ez=dz/L,ox=unit.x-wall.x1,oz=unit.z-wall.z1;
  let lo=-half,hi=half;
  const clip=(c,k,a,b)=>{if(Math.abs(k)<1e-12)return c>=a&&c<=b;const p=(a-c)/k,q=(b-c)/k;lo=Math.max(lo,Math.min(p,q));hi=Math.min(hi,Math.max(p,q));return lo<=hi;};
  if(clip(ox*ex+oz*ez,tx*ex+tz*ez,0,L)&&clip(-ox*ez+oz*ex,-tx*ez+tz*ex,-radius,radius))add(lo,hi);
  disk(wall.x1,wall.z1);disk(wall.x2,wall.z2);
 }
 intervals.sort((a,b)=>a[0]-b[0]);let end=-half;
 for(const [lo,hi]of intervals){if(lo>end+1e-9)return false;end=Math.max(end,hi);if(end>=half-1e-9)return true;}
 return false;
}

// Finish only after the existing course cleanup and all seeded installs. Keep
// the old rendering until the replacement textures have loaded successfully.
export async function installCoursedFieldWalls({THREE:T,scene,legacy,records,groundH,anisotropy=4,walls}){
 const matrix=new T.Matrix4(),accepted=[],skipped=[];
 if(!legacy)return {status:'empty',unitCount:0,activeUnitCount:0,units:[],triangles:0,skipped:records};
 const loader=new T.TextureLoader(),root='./assets/textures/scanned/rock_boulder_cracked_';
 const loaded=await Promise.allSettled(['diff','nor_gl','arm'].map(s=>loader.loadAsync(root+s+'.webp')));
 const error=loaded.find(r=>r.status==='rejected');
 if(error){for(const result of loaded)if(result.status==='fulfilled')result.value.dispose();throw error.reason;}
 const [map,normalMap,roughnessMap]=loaded.map(r=>r.value);
 // A public course rebuild may run while images load. Read its final matrices
 // here, immediately before building and retiring the accepted units.
 for(const r of records){
  const activeRows=r.legacyRows.filter(i=>{legacy.getMatrixAt(i,matrix);return legacy.visible&&Math.abs(matrix.determinant())>1e-8;});
  if(activeRows.length===r.legacyRows.length)accepted.push(r);else skipped.push({...r,activeRows,status:activeRows.length?'partially-cleared':'course-cleared'});
 }
 const data=createCoursedFieldWallGeometry(accepted,groundH);
 if(!accepted.length){for(const texture of [map,normalMap,roughnessMap])texture.dispose();return {status:'empty',unitCount:0,activeUnitCount:0,units:[],triangles:0,skipped};}
 for(const texture of [map,normalMap,roughnessMap]){texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=anisotropy;}
 map.colorSpace=T.SRGBColorSpace;
 const material=new T.MeshStandardMaterial({name:'Bridleway | coursed fieldstone',color:'#c6c2b6',map,normalMap,roughnessMap,normalScale:new T.Vector2(.42,.42),roughness:1,envMapIntensity:.5,vertexColors:true});
 material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  float fieldstoneGrey=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
  diffuseColor.rgb=mix(vec3(fieldstoneGrey),diffuseColor.rgb,.72);`);};
 material.customProgramCacheKey=()=> 'coursed-fieldstone-v3';
 const geometry=new T.BufferGeometry();
 for(const [name,array,itemSize]of [['position',data.positions,3],['normal',data.normals,3],['uv',data.uvs,2],['color',data.colors,3]])geometry.setAttribute(name,new T.BufferAttribute(array,itemSize));
 geometry.setIndex(new T.BufferAttribute(data.indices,1));geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const mesh=new T.Mesh(geometry,material);mesh.name='worldPaths:coursedFieldWalls';mesh.castShadow=true;mesh.receiveShadow=true;
 const savedRows=new Map();
 for(const r of accepted)for(const row of r.legacyRows){legacy.getMatrixAt(row,matrix);savedRows.set(row,matrix.toArray());}
 const sourceTriangles=(legacy.geometry.index?legacy.geometry.index.count:legacy.geometry.attributes.position.count)/3;
 const state={status:'ready',mesh,unitCount:accepted.length,activeUnitCount:accepted.length,units:data.units,skipped,triangles:data.triangles,visibleTriangles:data.triangles,
  visibleSourceTrianglesRetired:accepted.length*5*sourceTriangles,submittedAddedTriangles:data.triangles,
  legacySubmittedTriangles:legacy.count*sourceTriangles,
  drawCalls:1,retiredRows:accepted.flatMap(r=>r.legacyRows),currentlyRetiredRows:accepted.flatMap(r=>r.legacyRows),cleanupPasses:0};
 // Decide against only pre-existing segments; no unit may rely on a
 // neighbour's new barrier and lose its own coverage when that neighbour clears.
 const originalWalls=Array.isArray(walls)?walls.slice():null,ownedWalls=new Map();
 state.jumpableCoverage={originalSegmentCount:originalWalls?.length||0,addedSegmentCount:0,activeSegmentCount:0};
 const zero=new T.Matrix4().makeScale(0,0,0);
 // The course-clear owner calls these around its normal synchronous pass.
 // Restore only the proxies this replacement owns, so its exact existing
 // radius/position decisions remain authoritative even for a future rebuild.
 state.beforeCourseClear=()=>{
  for(const unit of state.units)if(unit.visible)for(const row of unit.legacyRows)legacy.setMatrixAt(row,matrix.fromArray(savedRows.get(row)));
  legacy.instanceMatrix.needsUpdate=true;
 };
 state.afterCourseClear=()=>{
  for(const unit of state.units)if(unit.visible){
   const activeRows=unit.legacyRows.filter(row=>{legacy.getMatrixAt(row,matrix);return legacy.visible&&Math.abs(matrix.determinant())>1e-8;});
   if(activeRows.length<unit.legacyRows.length){
    unit.visible=false;unit.clearedAfterInstall=true;
    const owned=ownedWalls.get(unit);
    if(owned){const at=walls.indexOf(owned);if(at!==-1)walls.splice(at,1);ownedWalls.delete(unit);}
    // Keep any surviving old rocks as the original cleanup would. Never grow
    // a complete new wall back across a partially cleared course margin.
    const first=geometry.index.getX(unit.indexStart);
    for(let i=unit.indexStart;i<unit.indexStart+unit.indexCount;i++)geometry.index.setX(i,first);
    geometry.index.needsUpdate=true;
    state.skipped.push({...unit,activeRows,status:activeRows.length?'partially-cleared':'course-cleared'});
   }else for(const row of unit.legacyRows)legacy.setMatrixAt(row,zero);
  }
  legacy.instanceMatrix.needsUpdate=true;
  state.activeUnitCount=state.units.filter(u=>u.visible).length;
  state.visibleTriangles=state.units.filter(u=>u.visible).reduce((sum,u)=>sum+u.triangles,0);
  state.currentlyRetiredRows=state.units.filter(u=>u.visible).flatMap(u=>u.legacyRows);
  state.jumpableCoverage.activeSegmentCount=ownedWalls.size;
  state.cleanupPasses++;
 };
 // No rendered frame contains the replacement plus its old boulders.
 for(const row of state.retiredRows)legacy.setMatrixAt(row,zero);
 if(originalWalls)for(const unit of state.units)if(!fieldWallSpanCovered(unit,originalWalls)){
  const half=unit.halfLength,wall={x1:unit.x-unit.tx*half,z1:unit.z-unit.tz*half,x2:unit.x+unit.tx*half,z2:unit.z+unit.tz*half};
  walls.push(wall);ownedWalls.set(unit,wall);
 }
 state.jumpableCoverage.addedSegmentCount=state.jumpableCoverage.activeSegmentCount=ownedWalls.size;
 legacy.instanceMatrix.needsUpdate=true;scene.add(mesh);
 return state;
}
