// Original battered dry-stone wall geometry. Pure geometry creation consumes no RNG.
// Route samples, gates and collision ownership remain in world-paths.js.
const hash=(a,b=0)=>{const n=Math.sin(a*127.1+b*311.7+17.3)*43758.5453;return n-Math.floor(n);};
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((v,n,i)=>v+n*b[i],0);
export function createCoursedFieldWallGeometry(records,groundH){
 const p=[],n=[],uv=[],col=[],idx=[],units=[];
 function stone(r,u,lo,w,h,d,seed,coping=false){
  const half=w/2,depth=d/2,b=Math.min(coping?.034:.014+hash(seed,47)*.024,w*.23);
  const cx=r.x+r.tx*u,cz=r.z+r.tz*u;
  // Each footing seats at the low corner of its own patch of ground, avoiding
  // floating near-side corners on a slope. A modest buried base closes seams.
  const base=Math.min(...[-1,1].flatMap(a=>[-1,1].map(c=>groundH(cx+r.tx*half*a+r.nx*depth*c,cz+r.tz*half*a+r.nz*depth*c))));
  const centre=[cx,base+lo+h/2,cz];
  const tint=.78+hash(seed,11)*.22,offset=[hash(seed,19)*3,hash(seed,23)*3];
  function face(points){
   // Sum the whole polygon area; a tiny bevel triangle must not choose the
   // direction or lighting normal of the entire stone face.
   let normal=[0,0,0];
   for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    normal[0]+=(a[1]-b[1])*(a[2]+b[2]);
    normal[1]+=(a[2]-b[2])*(a[0]+b[0]);
    normal[2]+=(a[0]-b[0])*(a[1]+b[1]);
   }
   const mid=points.reduce((a,v)=>a.map((n,i)=>n+v[i]/points.length),[0,0,0]);
   if(dot(normal,sub(mid,centre))<0){points=points.slice().reverse();normal=normal.map(v=>-v);}
   const L=Math.hypot(...normal);if(L<1e-10)throw Error('Degenerate field stone');normal=normal.map(v=>v/L);
   const axis=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs))),start=p.length/3;
   for(const v of points){p.push(...v);n.push(...normal);col.push(tint,tint,tint);
    const a=axis===0?v[2]:v[0],c=axis===1?v[2]:v[1];uv.push(a/.9+offset[0],c/.9+offset[1]);}
   for(let i=1;i<points.length-1;i++)idx.push(start,start+i,start+i+1);
  }
  // Broad, flat bearings support the courses. Unequal lower and upper
  // shoulders leave a chipped slab silhouette instead of a repeated box.
  // Six points retain the original twenty-triangle stone budget.
  const footL=w*(.045+hash(seed,71)*.085),footR=w*(.045+hash(seed,73)*.085);
  const crownL=w*(.080+hash(seed,79)*.110),crownR=w*(.080+hash(seed,83)*.105);
  const shoulderL=w*(.006+hash(seed,89)*.024),shoulderR=w*(.006+hash(seed,97)*.024);
  const profile=[[-half+footL,lo],[half-footR,lo],
   [half-shoulderR,lo+h*(.36+hash(seed,101)*.28)],
   [half-crownR,lo+h*(.970+hash(seed,103)*.030)],
   [-half+crownL,lo+h*(.965+hash(seed,107)*.035)],
   [-half+shoulderL,lo+h*(.32+hash(seed,109)*.28)]];
  const rings=[-1,1].map(side=>profile.map(([x,y],i)=>{
   // Depth rake is an affine function of the actual nicked profile. Both
   // broad faces and every connecting shoulder therefore remain planar.
   const nick=(hash(seed+i,13)-.5)*Math.min(coping?.006:.008,b*.72*.25),nickedY=y+nick;
   const z=side*(depth-.014-(nickedY-lo)/h*(coping?.057:.043)+(x/w)*.012)+((hash(seed,53)-.5)*.006);
   return[cx+r.tx*x+r.nx*z,base+nickedY,cz+r.tz*x+r.nz*z];
  }));
  face(rings[0]);face(rings[1]);
  for(let i=0;i<profile.length;i++)face([rings[0][i],rings[0][(i+1)%profile.length],rings[1][(i+1)%profile.length],rings[1][i]]);
 }
 for(let ri=0;ri<records.length;ri++){
  const r=records[ri];if(![r.x,r.z,r.tx,r.tz,r.nx,r.nz].every(Number.isFinite))throw Error('Invalid field wall record');
  const seed=r.x*7+r.z*13,start=idx.length,span=1.15;
  // Alternating end half-stones break vertical joints. Each segment retains
  // its existing centre and 1.15 m route sampling; no line or gap is moved.
  for(let row=0;row<3;row++){
   const cuts=row%2?[-.575,-.40+(hash(seed,row+2)-.5)*.07,.02+(hash(seed,row+5)-.5)*.11,.42+(hash(seed,row+8)-.5)*.06,.575]:[-.575,-.21+(hash(seed,row+2)-.5)*.10,.20+(hash(seed,row+5)-.5)*.10,.575];
   const base=-.060+row*.245+(hash(seed,row+17)-.5)*.012,depth=.68-row*.055;
   for(let i=0;i<cuts.length-1;i++){
    const gap=.006+hash(seed+i,row+61)*.007,left=cuts[i]+gap,right=cuts[i+1]-gap;
    stone(r,(left+right)/2,base,right-left,.238+(hash(seed+i,row+41)-.5)*.012,depth,seed+row*37+i*7);
   }
  }
  for(let i=0;i<4;i++){
   // Individual coping stones stay within their original quarter slots;
   // unequal joints and bearings break the mechanical repeated skyline.
   const slot=span/4,left=-span/2+i*slot+.006+hash(seed+i,113)*.015;
   const right=-span/2+(i+1)*slot-.006-hash(seed+i,127)*.015;
   stone(r,(left+right)/2,.658+hash(seed+i,137)*.010,right-left,.244+hash(seed+i,17)*.037,.555,seed+131+i*9,true);
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
