export const FERRY_BANK_APPROACH=Object.freeze({profile:'ferry-bank-approach-1',overlap:.65,width:2.6,minRun:4,maxRun:8.5,runStep:.5,maxGrade:.36,landGap:.025,plankThickness:.075});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const local=(plan,x,z)=>{const dx=x-plan.x,dz=z-plan.z;return{u:dx*plan.cos-dz*plan.sin,v:dx*plan.sin+dz*plan.cos};};
const world=(plan,u,v)=>({x:plan.x+u*plan.cos+v*plan.sin,z:plan.z-u*plan.sin+v*plan.cos});
function segmentDistance(x,z,w){const dx=w.x2-w.x1,dz=w.z2-w.z1,t=clamp(((x-w.x1)*dx+(z-w.z1)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(x-w.x1-dx*t,z-w.z1-dz*t);}

// Derive a bounded landing from the actual dock pose and final physical grid.
// No scene objects, RNG, colliders or world samplers are changed while planning.
export function planFerryBankApproach({dock,terrainH,colliders=[],walls=[]}){
 if(!dock||![dock.x,dock.z,dock.y,dock.yaw,dock.width,dock.length].every(Number.isFinite)||dock.width<2||dock.length<3||typeof terrainH!=='function')throw Error('Invalid ferry landing geometry');
 const p={...dock,cos:Math.cos(dock.yaw),sin:Math.sin(dock.yaw),startV:dock.length/2-FERRY_BANK_APPROACH.overlap,dryV:dock.length/2,profile:FERRY_BANK_APPROACH.profile};
 const U=Array.from({length:7},(_,i)=>Math.fround((i/6-.5)*dock.width));
 let chosen=null;
 for(let run=FERRY_BANK_APPROACH.minRun;run<=FERRY_BANK_APPROACH.maxRun;run+=FERRY_BANK_APPROACH.runStep){
  const endV=p.dryV+run,end=U.map(u=>{const a=world(p,u,endV);return terrainH(a.x,a.z)+FERRY_BANK_APPROACH.landGap;});
  if(!end.every(Number.isFinite)||Math.max(...end.map(y=>Math.abs(y-p.y)/run))>FERRY_BANK_APPROACH.maxGrade)continue;
  let clear=true,minGroundGap=Infinity;
  for(let k=0;k<=Math.ceil(run/.1)&&clear;k++){
   const t=k/Math.ceil(run/.1),v=p.dryV+run*t,c=world(p,0,v),radius=dock.width/2+.6;
   if(colliders.some(o=>Math.hypot(c.x-o.x,c.z-o.z)<radius+(o.r||0))||walls.some(w=>segmentDistance(c.x,c.z,w)<radius)){clear=false;break;}
   for(let j=0;j<U.length;j++){const a=world(p,U[j],v),top=p.y+(end[j]-p.y)*t,gap=top-terrainH(a.x,a.z);minGroundGap=Math.min(minGroundGap,gap);if(gap<.012){clear=false;break;}}
  }
  if(clear){chosen={run,endV,end,minGroundGap};break;}
 }
 if(!chosen)throw Error('No clear bounded ferry bank approach');Object.assign(p,chosen);
 const headN=Math.ceil(FERRY_BANK_APPROACH.overlap/.23),runN=Math.ceil(p.run/.23);
 const V=[...Array.from({length:headN+1},(_,i)=>Math.fround(p.startV+FERRY_BANK_APPROACH.overlap*i/headN)),...Array.from({length:runN},(_,i)=>Math.fround(p.dryV+p.run*(i+1)/runN))];
 const Y=V.map(v=>U.map((u,j)=>Math.fround((p.end[j]-p.y)*clamp((v-p.dryV)/p.run,0,1))));
 const cell=(array,value)=>{let lo=0,hi=array.length-1;while(lo+1<hi){const mid=(lo+hi)>>1;if(array[mid]<=value)lo=mid;else hi=mid;}return lo;};
 p.startV=V[0];p.endV=V.at(-1);p.columns=U;p.rows=V;p.heights=Y;p.heightAt=(x,z)=>{const {u,v}=local(p,x,z);if(u<U[0]||u>U.at(-1)||v<V[0]||v>V.at(-1))return-Infinity;
  const i=cell(U,u),j=cell(V,v),fx=(u-U[i])/(U[i+1]-U[i]),fz=(v-V[j])/(V[j+1]-V[j]),a=Y[j][i],b=Y[j+1][i],c=Y[j+1][i+1],d=Y[j][i+1];
  return p.y+(fx<=fz?a+(c-b)*fx+(b-a)*fz:a+(d-a)*fx+(c-d)*fz);
 };
 p.contains=(x,z,pad=0)=>{const {u,v}=local(p,x,z);return u>=U[0]-pad&&u<=U.at(-1)+pad&&v>=p.startV-pad&&v<=p.endV+pad;};
 p.world=(u,v)=>world(p,u,v);return p;
}

function privateConstruction(make){let seed=0x7fa416b1;const previous=Math.random;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};try{return make();}finally{Math.random=previous;}}

// One owned mesh reuses the dock's exact material. Its floor and supports are
// registered as real triangles, never as a tall AABB across the sloping lane.
export function createFerryBankApproach(T,plan,material,terrainH){return privateConstruction(()=>{
 const P=[],U=[],I=[],metres=material.userData.metres||.7,thickness=FERRY_BANK_APPROACH.plankThickness;
 const vertex=(x,y,z,u,v)=>{const id=P.length/3;P.push(x,y,z);U.push(u,v);return id;};
 const quad=(a,b,c,d)=>{const k=P.length/3,ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2],nx=Math.abs(uy*vz-uz*vy),ny=Math.abs(uz*vx-ux*vz),nz=Math.abs(ux*vy-uy*vx);for(const p of[a,b,c,d]){const uv=ny>=nx&&ny>=nz?[p[0],p[2]]:nx>=nz?[p[2],p[1]]:[p[0],p[1]];vertex(...p,uv[0]/metres,uv[1]/metres);}I.push(k,k+1,k+2,k,k+2,k+3);};
 for(let row=0;row<plan.rows.length-1;row++)for(let col=0;col<plan.columns.length-1;col++){
  const x0=plan.columns[col],x1=plan.columns[col+1],z0=plan.rows[row],z1=plan.rows[row+1],a=[x0,plan.heights[row][col],z0],b=[x0,plan.heights[row+1][col],z1],c=[x1,plan.heights[row+1][col+1],z1],d=[x1,plan.heights[row][col+1],z0];
  quad(a,b,c,d);quad([x0,a[1]-thickness,z0],[x1,d[1]-thickness,z0],[x1,c[1]-thickness,z1],[x0,b[1]-thickness,z1]);
  if(col===0)quad([x0,a[1]-thickness,z0],[x0,b[1]-thickness,z1],b,a);
  if(col===plan.columns.length-2)quad(d,c,[x1,c[1]-thickness,z1],[x1,d[1]-thickness,z0]);
  if(row===0)quad(a,d,[x1,d[1]-thickness,z0],[x0,a[1]-thickness,z0]);
  if(row===plan.rows.length-2)quad([x0,b[1]-thickness,z1],[x1,c[1]-thickness,z1],c,b);
 }
 const topTriangles=(plan.rows.length-1)*(plan.columns.length-1)*2;
 // Square weathered piles under the floor follow the actual bank, with buried
 // feet and no posts/rails across the usable 2.6m riding lane.
 for(const v of[plan.dryV+.6,plan.dryV+2.7,plan.dryV+4.8,plan.endV-.55])for(const side of[-1,1]){
  const x=side*(plan.width/2-.19),at=plan.world(x,v),hi=plan.heightAt(at.x,at.z)-plan.y-.13,lo=terrainH(at.x,at.z)-plan.y-.30,r=.09;
  if(hi<=lo)continue;const a=[x-r,lo,v-r],b=[x+r,lo,v-r],c=[x+r,lo,v+r],d=[x-r,lo,v+r],A=[x-r,hi,v-r],B=[x+r,hi,v-r],C=[x+r,hi,v+r],D=[x-r,hi,v+r];
  quad(A,D,C,B);quad(a,b,c,d);quad(a,A,B,b);quad(b,B,C,c);quad(c,C,D,d);quad(d,D,A,a);
 }
 const geometry=new T.BufferGeometry();geometry.name='Ferry bank approach | connected timber floor';geometry.setAttribute('position',new T.Float32BufferAttribute(P,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(U,2));geometry.setIndex(I);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const mesh=new T.Mesh(geometry,material);mesh.name='Ferry | far bank timber approach';mesh.position.set(plan.x,plan.y,plan.z);mesh.rotation.y=plan.yaw;mesh.castShadow=true;mesh.receiveShadow=true;
 mesh.userData.ferryBankApproach={profile:plan.profile,run:plan.run,overlap:FERRY_BANK_APPROACH.overlap,width:plan.width,plankThickness:thickness,topTriangles,sourceDock:plan.id};
 return{mesh,plan,heightAt:plan.heightAt,contains:plan.contains,topTriangles};
});}

// Clear only existing herbaceous submissions covered by the exact new floor.
// Source populations, roots, colours, old zeros and every woody owner survive.
export function clearFerryApproachPlants(G,approach){
 const names=new Set(['flora_tuft','flora_brack','flora_petal','flora_reed','Water | bank reeds','Seeded pasture flower clumps','Trail edge | meadow tussocks','Trail garden | gazania']),changes=[];
 G.scene.traverse(mesh=>{if(!mesh.isInstancedMesh||!names.has(mesh.name))return;mesh.updateWorldMatrix(true,false);const world=mesh.matrixWorld.elements,a=mesh.instanceMatrix.array,rows=[];
  for(let row=0;row<mesh.instanceMatrix.count;row++){const k=row*16;if(Math.hypot(a[k],a[k+1],a[k+2])+Math.hypot(a[k+4],a[k+5],a[k+6])+Math.hypot(a[k+8],a[k+9],a[k+10])<1e-9)continue;
   const x=world[0]*a[k+12]+world[4]*a[k+13]+world[8]*a[k+14]+world[12],z=world[2]*a[k+12]+world[6]*a[k+13]+world[10]*a[k+14]+world[14];if(!approach.contains(x,z))continue;
   for(const column of[0,4,8])for(let axis=0;axis<3;axis++)a[k+column+axis]=0;rows.push(row);
  }if(rows.length){mesh.instanceMatrix.needsUpdate=true;changes.push({name:mesh.name,owner:mesh.uuid,sourceCount:mesh.count,capacity:mesh.instanceMatrix.count,rows});}
 });return changes;
}

export function installFerryBankApproach(G){
 const P=G.waterPkg,W=G.world;if(P.ferryBankApproachReady)return P.ferryBankApproachReady;
 P.ferryBankApproachReady=Promise.resolve().then(()=>Promise.allSettled([
  G.photoscans?.floraRetirementReady,G.worldDetails?.ready,G.undergrowth?.ready,G.courseClear?.ready,
  W.mixedSward?.ready,W.chalkCoverReady,G.quartersPkg?.saplingsReady,G.worldPaths?.roadsideReady
 ])).then(()=>{
  const dock=G.worldPkg?.FERRY?.docks.find(d=>d.id==='farbank'),root=dock?.g,meta=root?.userData.sceneryArt;if(!root||meta?.kind!=='dock')throw Error('Actual far bank ferry landing unavailable');
  const material=W.ranchBuilderArt?.materials.aged;if(!material)throw Error('Actual ferry deck material unavailable');
  const plan=planFerryBankApproach({dock:{id:dock.id,x:root.position.x,y:root.position.y,z:root.position.z,yaw:root.rotation.y,width:meta.width,length:meta.length},terrainH:W.terrainH,colliders:W.colliders,walls:W.walls});
  const out=createFerryBankApproach(G.THREE,plan,material,W.terrainH);G.scene.add(out.mesh);W.groundSurfaces.push(out.heightAt);
  W.followCamera.register(out.mesh);out.surfaceTriangles=W.solidWorld.registerSurface(out.mesh);
  out.plants=clearFerryApproachPlants(G,out);out.originalExcludesPlants=P.excludesPlants;
  const previous=P.excludesPlants;P.excludesPlants=(x,z)=>!!(previous?.(x,z)||out.contains(x,z));
  const player=G.horse.player.pos;W.nearGroundCover?.invalidate?.();W.nearGroundCover?.tick?.(0,player.x,player.z);
  if(W.mixedSward){W.mixedSward.refreshEligibility();W.mixedSward.tick(0,player.x,player.z,true);}
  P.ferryBankApproach=out;return out;
 });return P.ferryBankApproachReady;
}
