import {createOuterCanopyShadePixels} from './outer-canopy-shade.mjs?v=outer-canopy-shelter-1';
import {reseatOuterWoodland} from './outer-watershed.mjs?v=northern-watershed-2';
import {patchOuterFog} from './outer-landscape.js?v=northern-watershed-2';
export const YOUNG_OUTER_WOODLAND_PROFILE='young-outer-woodland-3';
export const YOUNG_OUTER_WOODLAND_LIMITS=Object.freeze({trees:180,triangles:360,draws:6,pocket:30});
// Unequal low woodland pockets leave wide meadow bays between the mature groves.
// Each three-lobed footprint has a larger sheltered core and two lower fingers.
export const YOUNG_OUTER_POCKETS=Object.freeze([
 {id:'west-rock-foot',x:-535,z:-600,angle:-.30,sector:0,back:[.1,-1],lobes:[[0,0,12,8,1],[-12,4,9,6,.83],[9,-8,7,5,.67]]},
 {id:'west-meadow-bay',x:-373,z:-618,angle:0,sector:0,back:[1,0],lobes:[[0,0,10,8,1],[11,-2,8,7,.95],[-10,7,6,4,.55]]},
 {id:'north-fold-foot',x:-241,z:-623,angle:.08,sector:1,back:[-1,-.25],lobes:[[0,0,11,7,1],[-11,-8,10,7,.95],[9,7,6,5,.60]]},
 {id:'north-open-shoulder',x:-80,z:-626,angle:.2,sector:1,back:[-.5,-1],lobes:[[0,0,10,7,1],[-10,-10,9,7,.95],[8,5,7,4,.60]]},
 {id:'clover-west-pocket',x:350,z:-642,angle:-.40,sector:2,back:[.25,-1],lobes:[[0,0,12,7,1],[-8,-7,9,7,.85],[11,7,7,5,.63]]},
 {id:'clover-east-pocket',x:460,z:-627,angle:.75,sector:2,back:[-.25,1],lobes:[[0,0,12,8,1],[12,3,10,5,.82],[-8,-9,7,6,.67]]},
].map(p=>Object.freeze({...p,back:Object.freeze(p.back),lobes:Object.freeze(p.lobes.map(Object.freeze))})));
const clamp=x=>Math.max(0,Math.min(1,x));
export function youngWoodlandHash(x,z,salt=0){let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^Math.imul(salt+1,1274126177);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;}
export function youngPocketAt(x,z,pocket){
 const co=Math.cos(pocket.angle),sn=Math.sin(pocket.angle),dx=x-pocket.x,dz=z-pocket.z,u=dx*co+dz*sn,v=-dx*sn+dz*co;let weight=0;
 for(const [cx,cz,rx,rz,gain]of pocket.lobes){const t=clamp(1-((u-cx)/rx)**2-((v-cz)/rz)**2);weight=Math.max(weight,t*t*(3-2*t)*gain);}return weight;
}
export function planYoungOuterWoodland({positions,index,trees=[],rockData}){
 const bins=new Map(),cell=16;for(const tree of trees){const key=Math.floor(tree.x/cell)+':'+Math.floor(tree.z/cell);if(!bins.has(key))bins.set(key,[]);bins.get(key).push(tree);}
 const clearTree=(x,z)=>{const ix=Math.floor(x/cell),iz=Math.floor(z/cell);for(let i=ix-1;i<=ix+1;i++)for(let j=iz-1;j<=iz+1;j++)for(const t of bins.get(i+':'+j)||[])if(Math.hypot(x-t.x,z-t.z)<2.3+t.height*.02)return false;return true;};
 const all=[],step=3.25;
 for(let pocket=0;pocket<YOUNG_OUTER_POCKETS.length;pocket++){
  const spec=YOUNG_OUTER_POCKETS[pocket],rows=[];
  for(let ix=-9;ix<=9;ix++)for(let iz=-9;iz<=9;iz++){
   const x=spec.x+(ix+(youngWoodlandHash(ix,iz,pocket*13+1)-.5)*.65)*step,z=spec.z+(iz+(youngWoodlandHash(ix,iz,pocket*13+2)-.5)*.65)*step,weight=youngPocketAt(x,z,spec);
   if(weight<.035||Math.max(Math.abs(x),Math.abs(z))<538||rockData?.intersectsRoot({x,z})||!clearTree(x,z))continue;
   const variation=youngWoodlandHash(ix,iz,pocket*13+3),rear=clamp(.5+((x-spec.x)*spec.back[0]+(z-spec.z)*spec.back[1])/(16*Math.hypot(...spec.back))),height=3.2+(1.4+3.6*rear)*Math.sqrt(weight)+.65*variation;
   rows.push({x,z,y:0,pocket,sector:spec.sector,weight,height,source:youngWoodlandHash(ix,iz,pocket*13+4)<.58?'canopy-broadleaf':'broadleaf',yaw:youngWoodlandHash(ix,iz,pocket*13+5)*Math.PI*2,rank:youngWoodlandHash(ix,iz,pocket*13+6)});
  }
  rows.sort((a,b)=>a.rank-b.rank);const grounded=reseatOuterWoodland(rows,positions,index).filter(r=>r.slope<.62),chosen=[];
  for(const r of grounded){if(chosen.some(p=>Math.hypot(r.x-p.x,r.z-p.z)<2.55))continue;chosen.push(r);if(chosen.length===YOUNG_OUTER_WOODLAND_LIMITS.pocket)break;}
  all.push(...chosen);
 }
 return all;
}
export function installYoungOuterWoodland(G,sources){
 const outer=G.world.outerLandscape;if(!outer||outer.youngWoodland)return outer?.youngWoodland;
 const state=outer.youngWoodland={profile:YOUNG_OUTER_WOODLAND_PROFILE,ready:false,disposed:false,pending:null,errors:[],meshes:[],records:[],stats:null};
 const ownedMaterials=[],footprints=[];let preparedRecords=[];
 const refreshShelter=()=>{const shelter=outer.canopyShelter;if(!shelter)return;const pixels=createOuterCanopyShadePixels(outer.canopyFootprints,{size:shelter.size,extent:shelter.extent});shelter.texture.image.data.set(pixels.data);shelter.texture.needsUpdate=true;shelter.coveredTexels=pixels.covered;shelter.maximum=pixels.maximum;};
 state.dispose=()=>{if(state.disposed)return;state.disposed=true;for(const mesh of state.meshes){G.scene.remove(mesh);mesh.dispose();}for(const material of ownedMaterials)material.dispose();for(const p of footprints){const i=outer.canopyFootprints?.indexOf(p)??-1;if(i>=0)outer.canopyFootprints.splice(i,1);}if(footprints.length)refreshShelter();state.meshes.length=0;state.records.length=0;};
 // Plan plain data before the existing one-shot shelter texture is built. No
 // Three resources or ambient random values are created in this phase.
 try{
  if(!sources||sources.length!==2||!['broadleaf','canopy-broadleaf'].every(key=>sources.some(s=>s.key===key)))throw Error('Young woodland needs both resident broadleaf sources');
  if(sources.some(s=>!s.card?.geo||!s.card?.mat||!Number.isFinite(s.sourceHeight)||s.sourceHeight<=0||!Number.isFinite(s.bottom)||!Number.isFinite(s.crownSpan)||s.crownSpan<=0))throw Error('Invalid resident young woodland metadata');
  const sourceByKey=new Map(sources.map(s=>[s.key,s]));preparedRecords=planYoungOuterWoodland({positions:outer.mesh.geometry.attributes.position.array,index:outer.mesh.geometry.index.array,trees:outer.woodlandSites,rockData:outer.rockClusterData});
  for(const row of preparedRecords){const source=sourceByKey.get(row.source);row.sourceHeight=source.sourceHeight;row.sourceBottom=source.bottom;row.crownRadius=source.crownSpan*row.height/source.sourceHeight*.43;footprints.push({x:row.x,z:row.z,radius:Math.max(1.0,row.crownRadius),source:row.source,youngWoodland:true});}
  (outer.canopyFootprints??=[]).push(...footprints);refreshShelter();
 }catch(error){state.errors.push(error.message);state.dispose();state.pending=Promise.resolve(state);console.warn('Young outer woodland preparation unavailable:',error);return state;}

 state.pending=(async()=>{
  // Not awaited by photoscans: resources are allocated after all original
  // placement owners finish. This leaves their ambient UUID/RNG stream intact.
  await Promise.all([G.photoscans?.ready,G.worldDetails?.ready,G.undergrowth?.ready,G.world.ranchBuilderArt?.ready,G.quartersPkg?.saplingsReady,G.worldPkg?.oasisReady,G.worldPaths?.roadsideReady]);
  if(state.disposed)return state;
  if(!sources||sources.length!==2)throw Error('Young woodland needs both resident broadleaf sources');
  const T=G.THREE,byKey=new Map(sources.map(s=>[s.key,s])),records=preparedRecords;
  const materials=new Map();for(const source of sources){
   if(source.outerMaterial){materials.set(source.key,source.outerMaterial);continue;}
   const base=source.card.mat,mat=base.clone();mat.userData={...base.userData};mat.onBeforeCompile=(shader,renderer)=>{base.onBeforeCompile(shader,renderer);patchOuterFog(shader);};mat.customProgramCacheKey=()=>base.customProgramCacheKey()+'-outer-haze';materials.set(source.key,mat);ownedMaterials.push(mat);
  }
  const groups=new Map();for(const row of records){const key=row.sector+':'+row.source;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
  const position=new T.Vector3(),scale=new T.Vector3(),up=new T.Vector3(0,1,0),rotation=new T.Quaternion(),matrix=new T.Matrix4();
  for(const rows of groups.values()){
   const source=byKey.get(rows[0].source),mat=materials.get(source.key),mesh=new T.InstancedMesh(source.card.geo,mat,rows.length);mesh.name='Young outer woodland | '+rows[0].sector+' | '+source.key;mesh.customDepthMaterial=mat.userData.scanDepth;mesh.castShadow=false;mesh.receiveShadow=false;mesh.matrixAutoUpdate=false;mesh.updateMatrix();
   for(let i=0;i<rows.length;i++){const row=rows[i],s=row.height/source.sourceHeight;position.set(row.x,row.y-source.bottom*s-.035,row.z);scale.setScalar(s);rotation.setFromAxisAngle(up,row.yaw);matrix.compose(position,rotation,scale);mesh.setMatrixAt(i,matrix);row.sourceHeight=source.sourceHeight;row.sourceBottom=source.bottom;row.crownRadius=source.crownSpan*s*.43;}
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.userData.youngWoodland={profile:YOUNG_OUTER_WOODLAND_PROFILE,sector:rows[0].sector,source:source.key,triangles:2*rows.length};G.scene.add(mesh);state.meshes.push(mesh);
  }
  state.records=records;state.stats={trees:records.length,triangles:records.length*2,draws:state.meshes.length,pockets:YOUNG_OUTER_POCKETS.map((p,i)=>({id:p.id,trees:records.filter(r=>r.pocket===i).length})),newTextures:0,newGeometries:0,newMaterials:ownedMaterials.length,sharedSourceGeometry:true,sharedAtlasTextures:true,shelterExtended:true,shelterFootprints:footprints.length};state.ready=true;return state;
 })().catch(error=>{state.errors.push(error.message);state.dispose();console.warn('Young outer woodland unavailable:',error);return state;});
 return state;
}
