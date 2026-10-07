// Matched-revision story filly obstacle review. The root agent owns all GPU runs.
// QA_FILLY_IDENTITY_FIRST=1 stops a baseline after the exact view prefix through bench-front.
// Every full baseline also writes identity-first.json immediately at that view.
// Baseline: QA_FILLY_BASELINE=1 node tools/qa-roadside-props.cjs <out>
// Review: QA_FILLY_REFERENCE=<baseline>/report.json node ... <out>
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||'output/story-filly-obstacles');
const baseline=process.env.QA_FILLY_BASELINE==='1',reference=process.env.QA_FILLY_BASE_REV||'4fdc662';
const files=['ranch3d.html','assets/features/index.js','assets/features/world-paths.js','assets/world-photoscans.js','assets/terrain-realism.js','assets/features/world-flora.js','assets/cold-woodland.mjs','assets/ranch-builder-art.js','assets/features/world-quarters.js','assets/vegetation.js','assets/solid-collisions.js'];
const newModules=['assets/roadside-prop-geometry.mjs','assets/fingerpost-geometry.mjs'];
files.push('assets/features/story-quests.js','assets/features/world.js','assets/features/on-foot.js',...newModules);
const navigationModule='assets/story-filly-navigation.mjs';
const moduleFiles=[...files,...(!baseline?[navigationModule]:[])],expectedBodies=new Map(),rawBodies=new Map();
const sha=body=>crypto.createHash('sha256').update(body).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const near=(a,b,tol=2e-5)=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<=tol);
const scales=m=>[0,4,8].map(k=>Math.hypot(m[k],m[k+1],m[k+2]));
const angular=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
const det3=m=>m[0]*(m[5]*m[10]-m[6]*m[9])-m[4]*(m[1]*m[10]-m[2]*m[9])+m[8]*(m[1]*m[6]-m[2]*m[5]);
function circleEvidence(colliders,x,z,r){
 const matches=colliders.map((object,index)=>({object,index})).filter(({object:c})=>c.r===r&&c.x===x&&c.z===z);
 assert(matches.length<=1,'Duplicate old prop collision circles');
 const nearest=colliders.map((object,index)=>({index,object,distance:Math.hypot(object.x-x,object.z-z)})).filter(c=>Number.isFinite(c.distance)).sort((a,b)=>a.distance-b.distance).slice(0,3);
 return{collider:matches[0]||null,nearestColliders:nearest};
}
function extractLegacyBenches(state){
 const rows=state.bat.box,removed=new Set(),benches=[];
 for(let seat=0;seat<rows.length;seat++){
  const r=rows[seat],m=r.matrix;if(!near(scales(m),[1.70,.09,.42],1e-8))continue;
  const x=m[12],z=m[14],yaw=Math.atan2(m[8],m[10]),y=m[13]-.46;
  const back=[x-Math.sin(yaw+Math.PI/2)*.20,y+.78,z-Math.cos(yaw+Math.PI/2)*.20];
  const legs=[-.70,.70].map(s=>[x+Math.sin(yaw)*s,y+.23,z+Math.cos(yaw)*s]);
  const find=(size,position)=>rows.map((r,i)=>({r,i})).filter(({r})=>near(scales(r.matrix),size,1e-8)&&near([r.matrix[12],r.matrix[13],r.matrix[14]],position,1e-8));
  const backRows=find([1.70,.30,.06],back),legRows=legs.map(p=>find([.10,.46,.34],p));
  assert.equal(backRows.length,1,'Legacy bench needs one exact back row');
  assert(legRows.every(a=>a.length===1),'Legacy bench needs two exact leg rows');
  const indices=[seat,backRows[0].i,...legRows.map(a=>a[0].i)];
  assert(indices.every(i=>!removed.has(i)),'Legacy bench row assigned twice');indices.forEach(i=>removed.add(i));
  const circles=circleEvidence(state.colliders,x,z,.85);
  const c=Math.cos(yaw),s=Math.sin(yaw),matrix=[c,0,-s,0,0,1,0,0,s,0,c,0,x,y,z,1];
  benches.push({x,y,z,yaw,matrix,seatIndex:seat,legacyRowIndices:indices,legacyRows:indices.map(i=>rows[i]),renderRows:indices.map(i=>state.batches.box.rows[i]),visible:state.batches.box.rows[seat].visible??Math.abs(det3(state.batches.box.rows[seat].matrix))>1e-8,...circles});
 }
 assert(benches.length>0,'No legacy bench seats captured');
 return{benches,nonBenchBat:{...state.bat,box:rows.filter((_,i)=>!removed.has(i))},nonBenchBatches:Object.fromEntries(Object.entries(state.batches).map(([k,b])=>[k,{...b,rows:k==='box'?b.rows.filter((_,i)=>!removed.has(i)):b.rows}]))};
}
// Runs in Chromium; this function is self-contained and does not alter game state.
function captureRoadside(){
 const q=window.__coldQA,W=q.G.world,P=q.G.worldPaths,T=q.THREE;
 const hash=a=>{let h=2166136261;for(const b of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^b,16777619);return(h>>>0).toString(16);};
 const geometry=(g,full=false)=>{g.computeBoundingBox();return{type:g.type,bounds:{min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()},triangles:(g.index?.count||g.attributes.position.count)/3,attributes:Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,{itemSize:a.itemSize,type:a.array.constructor.name,count:a.count,hash:hash(a.array),...(full?{array:Array.from(a.array)}:{})}])),index:g.index?{type:g.index.array.constructor.name,hash:hash(g.index.array),...(full?{array:Array.from(g.index.array)}:{})}:null};};
 const clone=o=>JSON.parse(JSON.stringify(o));
 const material=m=>({name:m.name,type:m.type,transparent:m.transparent,opacity:m.opacity,alphaTest:m.alphaTest,side:m.side,roughness:m.roughness,metalness:m.metalness,maps:Object.fromEntries(['map','normalMap','roughnessMap','metalnessMap','aoMap'].filter(k=>m[k]).map(k=>[k,{url:m[k].image?.currentSrc||m[k].image?.src||null,width:m[k].image?.width,height:m[k].image?.height}]))});
 const audit=P.__propsAudit;if(!audit?.BAT||!audit?.SIGNS)throw Error('Roadside source instrumentation missing');
 const bat=Object.fromEntries(Object.entries(audit.BAT).map(([k,rows])=>[k,rows.map(r=>({matrix:Array.from(r.m.elements),color:r.c.toArray()}))]));
 q.scene.updateMatrixWorld(true);const mat=new T.Matrix4(),col=new T.Color(),batches={};
 for(const kind of Object.keys(bat)){const mesh=q.scene.getObjectByName('worldPaths:'+kind);if(!mesh){batches[kind]={rows:[],geometry:null,materials:[]};continue;}const rows=[];for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,mat);if(mesh.instanceColor)mesh.getColorAt(i,col);rows.push({matrix:mat.toArray(),color:mesh.instanceColor?col.toArray():null,determinant:mat.determinant(),visible:mesh.visible&&Math.abs(mat.determinant())>1e-8});}batches[kind]={rows,geometry:geometry(mesh.geometry),materials:(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(material)};}
 const colliders=clone(W.colliders),walls=clone(W.walls);
 const circles=(x,z,r)=>{const matches=colliders.map((object,index)=>({object,index})).filter(({object:c})=>c.r===r&&c.x===x&&c.z===z);if(matches.length>1)throw Error('Duplicate prop circles');const nearestColliders=colliders.map((object,index)=>({index,object,distance:Math.hypot(object.x-x,object.z-z)})).filter(c=>Number.isFinite(c.distance)).sort((a,b)=>a.distance-b.distance).slice(0,3);return{collider:matches[0]||null,nearestColliders};};
 const signs=audit.SIGNS.map(sp=>{const mesh=q.scene.getObjectByName('sign:'+sp.id);if(!mesh)throw Error('Missing sign '+sp.id);const arms=sp.arms.map(([label,x,z],i)=>({label,destination:[x,z],yaw:Math.atan2(x-sp.x,z-sp.z),y:2.62-i*.5})),parts=[],canvases=[];mesh.traverse(o=>{if(!o.isMesh)return;parts.push({name:o.name,matrix:o.matrixWorld.toArray(),geometry:geometry(o.geometry,true),castShadow:o.castShadow,receiveShadow:o.receiveShadow,materials:(Array.isArray(o.material)?o.material:[o.material]).map(material)});for(const m of(Array.isArray(o.material)?o.material:[o.material])){const canvas=m.map?.image;if(canvas?.getContext){const p=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;canvases.push({width:canvas.width,height:canvas.height,hash:hash(p)});}}});const evidence=circles(sp.x,sp.z,.42);return{id:sp.id,name:mesh.name,x:sp.x,y:mesh.position.y,z:sp.z,matrix:mesh.matrixWorld.toArray(),arms,...evidence,parts,canvases,boardData:clone(P.signBoardData?.find(s=>s.id===sp.id)?.data||null)};});
 const benchVisual=[];q.scene.traverse(o=>{
  if(!/^worldPaths:bench(?:Wood|Aged|Iron)$/.test(o.name)||!o.isMesh)return;
  if(o.isInstancedMesh){const rows=[];for(let i=0;i<o.count;i++){o.getMatrixAt(i,mat);rows.push(mat.toArray());}const p=o.geometry.attributes.position;let radius=0;for(let i=0;i<p.count;i++)radius=Math.max(radius,Math.hypot(p.getX(i),p.getZ(i)));benchVisual.push({name:o.name,type:'instanced',count:o.count,rows,geometry:geometry(o.geometry),radius,castShadow:o.castShadow,receiveShadow:o.receiveShadow,materials:(Array.isArray(o.material)?o.material:[o.material]).map(material),hasSolidParts:!!o.userData.solidParts});return;}
  const key={Wood:'wood',Aged:'aged',Iron:'iron'}[o.name.slice('worldPaths:bench'.length)],metadata=P.benchBatches?.groups?.[key];
  const sites=(metadata?.sites||[]).map(s=>({...clone(P.benchBatches?.sites?.[s.siteIndex]||{}),...clone(s)}));
  const actualFootContacts=[];
  if(key==='wood'){const position=o.geometry.attributes.position,v=new T.Vector3();for(const site of sites)for(const foot of site.footContacts||[]){const samples=(foot.vertexIndices||[]).map(index=>{v.fromBufferAttribute(position,index).applyMatrix4(o.matrixWorld);const groundY=q.groundH(v.x,v.z);return{index,x:v.x,y:v.y,z:v.z,groundY,gap:v.y-groundY};});actualFootContacts.push({siteIndex:site.siteIndex,id:foot.id,samples,minGap:samples.length?Math.min(...samples.map(s=>s.gap)):null,maxGap:samples.length?Math.max(...samples.map(s=>s.gap)):null});}}
  benchVisual.push({name:o.name,key,type:'baked',matrix:o.matrixWorld.toArray(),geometry:geometry(o.geometry,true),sites,actualFootContacts,castShadow:o.castShadow,receiveShadow:o.receiveShadow,materials:(Array.isArray(o.material)?o.material:[o.material]).map(material),hasSolidParts:!!o.userData.solidParts});
 });
 const benches=Array.isArray(P.benches)?P.benches.map(b=>({x:b.x,y:b.y,z:b.z,yaw:b.yaw,matrix:Array.from(b.matrix?.elements||b.matrix),visible:b.visible,legacyRowIndices:Array.from(b.legacyRowIndices||[]),...circles(b.x,b.z,.85)})):null;
 const geometries=new Set(),textures=new Set();let geometryBytes=0;
 q.scene.traverse(o=>{if(o.geometry&&!geometries.has(o.geometry)){geometries.add(o.geometry);for(const a of Object.values(o.geometry.attributes))geometryBytes+=a.array.byteLength;geometryBytes+=o.geometry.index?.array.byteLength||0;}for(const m of(o.material?(Array.isArray(o.material)?o.material:[o.material]):[])){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);for(const v of Object.values(m.uniforms||{}))if(v.value?.isTexture)textures.add(v.value);}});
 const gl=q.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info'),gpu=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
 return{bat,batches,colliders,walls,signs,benches,benchVisual,benchBatchStats:clone(P.benchBatches?.stats||null),roadsideReady:!!P.roadsideReady,worldResources:{sceneGeometries:geometries.size,geometryBytes,sceneTextures:textures.size,rendererMemory:clone(q.renderer.info.memory)},gpu,routeClearance:{mine:P.mine,blocked:clone(P.blocked),preExisting:clone(P.preExistingTight),clearance:clone(P.clearance)}};
}
// Native actor receipt. No transforms, simulation, visibility or obstacle arrays are changed.
function captureFilly({bench,view='',light=false}={}){
 const q=window.__coldQA,G=q.G,T=q.THREE,f=G.storyQuests.foal();
 const clone=o=>o==null?null:JSON.parse(JSON.stringify(o));
 const record=(owner,name,group,entry)=>{if(!group)return null;group.updateWorldMatrix(true,false);let visible=true;for(let n=group;n;n=n.parent)visible&&=n.visible!==false;const root=new T.Vector3().setFromMatrixPosition(group.matrixWorld);return{owner,name,uuid:group.uuid,root:root.toArray(),visible,distanceToBench:Math.hypot(root.x-bench.x,root.z-bench.z),entry:{heading:entry?.heading,x:entry?.x??entry?.pos?.x,z:entry?.z??entry?.pos?.z}};};
 if(!f)return{view,present:false,owner:null};
 const root={x:f.x,z:f.z,heading:f.heading,side:f.side,bolt:f.bolt,phase:f.phase,away:!!f.away};
 const receipt={view,present:true,owner:'story-prologue-filly',root,benchDistance:Math.hypot(f.x-bench.x,f.z-bench.z),groundY:q.groundH(f.x,f.z)};
 const group=f.group;group.updateWorldMatrix(true,true);
 receipt.group={uuid:group.uuid,name:group.name,visible:group.visible,position:group.position.toArray(),matrix:group.matrixWorld.toArray(),scale:group.scale.toArray(),worldScale:group.getWorldScale(new T.Vector3()).toArray()};
 receipt.player={root:q.player.pos.toArray(),heading:q.player.heading,speed:q.player.speed};
 if(light)return receipt;
 const roots=[record('ridden',G.horse.ridden()?.name,q.player.mesh,q.player),record('story-prologue-filly',G.save.fresh()?.story?.name,group,f)];
 for(const a of G.horse.herd())roots.push(record('owned-pasture',G.horse.myHorses[a.idx]?.name,a.parts.group,a));
 for(const h of G.worldPkg.herds||[])for(const a of h.members)roots.push(record('wild-herd:'+h.def.id,a.name,a.parts.group,a));
 for(const h of G.worldPkg.SANCTUARIES||[])for(const a of h.horses||[])roots.push(record('sanctuary:'+h.id,a.e?.name,a.parts.group,a));
 const wild=G.wild.get();if(wild)roots.push(record('single-wild',wild.wb?.breed,wild.parts.group,wild));
 const parked=G.onFoot?.horse();if(parked)roots.push(record('parked',G.horse.ridden()?.name,parked.group,parked));
 receipt.nearbyActorRoots=roots.filter(Boolean).sort((a,b)=>a.distanceToBench-b.distanceToBench);
 receipt.closestVisibleActor=receipt.nearbyActorRoots.find(a=>a.visible)||null;
 receipt.story=clone(G.save.fresh()?.story);
 const skin=f.rig?.skin;if(!skin){receipt.skin=null;return receipt;}
 const parents=[];for(let n=skin;n;n=n.parent)parents.push(n.uuid);
 skin.updateWorldMatrix(true,true);skin.skeleton?.update();
 const p=skin.geometry.attributes.position,indices=skin.geometry.index?.array;
 const inverse=new T.Matrix4().copy(group.matrixWorld).invert(),v=new T.Vector3(),local=new T.Vector3();
 const boxes=Object.fromEntries(['skinLocal','groupLocal','world','headingMetres'].map(k=>[k,{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]}]));
 const expand=(b,v)=>{for(let k=0;k<3;k++){b.min[k]=Math.min(b.min[k],v[k]);b.max[k]=Math.max(b.max[k],v[k]);}};
 const points=new Float64Array(p.count*3),extrema={},axes=['x','y','z'];let nearest={distance:Infinity};
 const c=Math.cos(f.heading),s=Math.sin(f.heading),gRoot=new T.Vector3().setFromMatrixPosition(group.matrixWorld);
 for(let i=0;i<p.count;i++){
  skin.getVertexPosition(i,v);expand(boxes.skinLocal,v.toArray());v.applyMatrix4(skin.matrixWorld);points[i*3]=v.x;points[i*3+1]=v.y;points[i*3+2]=v.z;expand(boxes.world,v.toArray());
  local.copy(v).applyMatrix4(inverse);expand(boxes.groupLocal,local.toArray());
  const dx=v.x-gRoot.x,dz=v.z-gRoot.z,heading=[c*dx-s*dz,v.y-gRoot.y,s*dx+c*dz];expand(boxes.headingMetres,heading);
  for(let k=0;k<3;k++)for(const side of['min','max']){const key=axes[k]+':'+side;if(!extrema[key]||(side==='min'?heading[k]<extrema[key].heading[k]:heading[k]>extrema[key].heading[k]))extrema[key]={index:i,heading,world:v.toArray(),groupLocal:local.toArray()};}
  const d=Math.hypot(v.x-bench.x,v.z-bench.z);if(d<nearest.distance)nearest={index:i,distance:d,world:v.toArray(),heading,groupLocal:local.toArray()};
 }
 receipt.skin={uuid:skin.uuid,name:skin.name,isSkinnedMesh:skin.isSkinnedMesh,belongsToFilly:parents.includes(group.uuid),parentUuids:parents,vertices:p.count,triangles:(indices?.length||p.count)/3,matrix:skin.matrixWorld.toArray(),scale:skin.scale.toArray(),worldScale:skin.getWorldScale(new T.Vector3()).toArray(),nativeSceneScale:f.rig.scene?.scale?.toArray(),profile:{id:f.rig.profile?.id,breed:f.rig.profile?.breed,nativeRoster:!!f.rig.profile?.nativeRoster,withersM:f.rig.profile?.withersM},skinLocalBounds:boxes.skinLocal,rootLocalBounds:boxes.groupLocal,worldBounds:boxes.world,headingBoundsMetres:boxes.headingMetres,extremalProbes:extrema,nearestBenchProbe:nearest};
 const meshes=['worldPaths:benchWood','worldPaths:benchAged','worldPaths:benchIron'].map(n=>q.scene.getObjectByName(n)).filter(Boolean),siteIndex=G.worldPaths.benches.findIndex(b=>b.x===bench.x&&b.z===bench.z),benchTriangles=[],benchBounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
 for(const mesh of meshes){const key={Wood:'wood',Aged:'aged',Iron:'iron'}[mesh.name.slice('worldPaths:bench'.length)],site=G.worldPaths.benchBatches.groups[key].sites[siteIndex],geo=mesh.geometry,position=geo.attributes.position,index=geo.index?.array;if(!site?.visible)continue;mesh.updateWorldMatrix(true,false);for(let k=site.indexStart;k<site.indexStart+site.indexCount;k+=3){const triangle=[];for(let j=0;j<3;j++){v.fromBufferAttribute(position,index?index[k+j]:k+j).applyMatrix4(mesh.matrixWorld);const xyz=v.toArray();triangle.push(xyz);expand(benchBounds,xyz);}benchTriangles.push({mesh:mesh.name,index:k/3,points:triangle});}}
 const overlap=(a,b)=>a.min.every((v,k)=>v<=b.max[k]+1e-8&&a.max[k]>=b.min[k]-1e-8),triangleBounds=pts=>({min:[0,1,2].map(k=>Math.min(...pts.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...pts.map(p=>p[k])))});
 const candidates=[];if(overlap(boxes.world,benchBounds))for(let k=0;k<(indices?.length||p.count);k+=3){const ids=[0,1,2].map(j=>indices?indices[k+j]:k+j),pts=ids.map(i=>Array.from(points.subarray(i*3,i*3+3)));if(overlap(triangleBounds(pts),benchBounds))candidates.push({index:k/3,vertexIndices:ids,points:pts});}
 let slabClearance=Infinity,slabVertices=0,slabWorst=null;
 for(let i=0;i<p.count;i++){const y=points[i*3+1];if(y<benchBounds.min[1]||y>benchBounds.max[1])continue;slabVertices++;const clearance=Math.hypot(points[i*3]-bench.x,points[i*3+2]-bench.z)-.85;if(clearance<slabClearance){slabClearance=clearance;slabWorst={index:i,world:Array.from(points.subarray(i*3,i*3+3))};}}
 receipt.bodyContact={method:'Actual skinned world vertices via getVertexPosition and bone matrices; strict non-coplanar surface triangle crossings. The independent slab check uses the unchanged bench .85m circle over its actual geometry height, conservatively enclosing the prop. Bounds alone are diagnostic.',benchBounds,benchTriangles:benchTriangles.length,skinCandidates:candidates.length,skinTriangles:candidates,slabVertices,slabClearance:Number.isFinite(slabClearance)?slabClearance:null,slabWorst};
 if(q.fillyTriangleCrossings){const crossing=q.fillyTriangleCrossings(candidates,benchTriangles);receipt.bodyContact.crossings=crossing;}
 return receipt;
}
function fillyTriangleCrossings(skin,bench){
 const sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((v,x,k)=>v+x*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const box=t=>({min:[0,1,2].map(k=>Math.min(...t.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...t.map(p=>p[k])))}),overlap=(a,b)=>a.min.every((v,k)=>v<=b.max[k]+1e-9&&a.max[k]>=b.min[k]-1e-9);
 function edge(a,b,t){const d=sub(b,a),e1=sub(t[1],t[0]),e2=sub(t[2],t[0]),p=cross(d,e2),det=dot(e1,p);if(Math.abs(det)<1e-10)return false;const s=sub(a,t[0]),u=dot(s,p)/det;if(u<-1e-8||u>1+1e-8)return false;const q=cross(s,e1),v=dot(d,q)/det;if(v<-1e-8||u+v>1+1e-8)return false;const along=dot(e2,q)/det;return along>1e-7&&along<1-1e-7;}
 const size=.30,cells=new Map(),cell=v=>Math.floor(v/size),key=(x,y,z)=>x+','+y+','+z;
 const bounded=bench.map(t=>({...t,bounds:box(t.points)}));
 for(let i=0;i<bounded.length;i++){const b=bounded[i].bounds;for(let x=cell(b.min[0]);x<=cell(b.max[0]);x++)for(let y=cell(b.min[1]);y<=cell(b.max[1]);y++)for(let z=cell(b.min[2]);z<=cell(b.max[2]);z++){const k=key(x,y,z);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(i);}}
 let pairs=0,tested=0;const samples=[];
 for(const a of skin){const b=box(a.points),set=new Set();for(let x=cell(b.min[0]);x<=cell(b.max[0]);x++)for(let y=cell(b.min[1]);y<=cell(b.max[1]);y++)for(let z=cell(b.min[2]);z<=cell(b.max[2]);z++)for(const i of cells.get(key(x,y,z))||[])set.add(i);
  for(const i of set){const t=bounded[i];if(!overlap(b,t.bounds))continue;tested++;if([0,1,2].some(k=>edge(a.points[k],a.points[(k+1)%3],t.points)||edge(t.points[k],t.points[(k+1)%3],a.points))){pairs++;if(samples.length<12)samples.push({skinTriangle:a.index,benchMesh:t.mesh,benchTriangle:t.index,skin:a.points,bench:t.points});}}
 }
 return{pairs,tested,samples,criterion:'Strict non-coplanar edge/surface crossing; zero does not prove absence of fully contained or coplanar contacts.'};
}
function fillyAcceptance(state,before,rows){
 const checks={},front=rows.find(r=>r.name==='bench-front-high')?.filly,metrics={filly:{front:front?{owner:front.owner,root:front.root,benchDistance:front.benchDistance,groupUuid:front.group?.uuid,skinUuid:front.skin?.uuid,skinBounds:front.skin?.headingBoundsMetres,crossings:front.bodyContact?.crossings?.pairs,slabClearance:front.bodyContact?.slabClearance}:null,views:rows.map(r=>({name:r.name,present:r.filly?.present,root:r.filly?.root,benchDistance:r.filly?.benchDistance,skinBounds:r.filly?.skin?.headingBoundsMetres,crossings:r.filly?.bodyContact?.crossings?.pairs,slabClearance:r.filly?.bodyContact?.slabClearance})),navigationCases:state.fillyCases?{checks:state.fillyCases.checks,coverage:state.fillyCases.coverage,controllerTiming:state.fillyCases.controllerTiming,cases:state.fillyCases.cases.map(c=>({name:c.name,maximumStep:c.maximumStep,finalThreeSecondJitter:c.finalThreeSecondJitter,finite:c.finite,clear:c.clear,bodyClear:c.bodyClear}))}:null}};
 checks.nativeFillyOwnership=!!front?.group?.visible&&front.skin?.belongsToFilly&&front.closestVisibleActor?.uuid===front.group.uuid&&front.skin?.isSkinnedMesh;
 checks.nativeFillyBoundsMeasured=!!front?.skin&&[front.skin.skinLocalBounds,front.skin.rootLocalBounds,front.skin.worldBounds,front.skin.headingBoundsMetres].every(b=>[...b.min,...b.max].every(Number.isFinite)&&b.min.every((v,k)=>v<b.max[k]));
 if(baseline){checks.publishedFillyOverlapReproduced=Math.abs(front?.benchDistance-.16847823637758258)<.00002;checks.publishedSkinBenchCrossingMeasured=front?.bodyContact?.crossings?.pairs>0;}
 else{checks.fillyBenchSkinClear=['bench-front-high','bench-side-high','bench-back-high'].every(name=>{const f=rows.find(r=>r.name===name)?.filly;return f?.present&&f.skin?.belongsToFilly&&f.bodyContact?.crossings?.pairs===0&&f.bodyContact?.slabClearance>=-.00005;});checks.fillyNavigationCases=!!state.fillyCases?.checks&&Object.values(state.fillyCases.checks).every(Boolean);}
 return{checks,metrics};
}

// Controlled fixtures run only after all matched images/preservation evidence.
// They call the actual controller and rig animation through an attested QA-only
// exposure, preserving player riding code and all obstacle arrays/registries.
async function captureFillyCases(bench){
 const q=window.__coldQA,G=q.G,T=q.THREE,module=await import('./assets/story-filly-navigation.mjs?qa=filly-poses');
 const footprint=module.STORY_FILLY_FOOTPRINT,world={colliders:G.world.colliders,walls:G.world.walls,groundH:q.groundH,allowsPose:q.fallsModule.fallsAllowsHorse,resolveSolid:(p,o)=>G.world.solidWorld.resolve(p,o)};
 if(typeof window.__qaFillyTick!=='function'||typeof module.fillyPoseClear!=='function'||!footprint)throw Error('Actual filly controller or navigation safety API missing');
 const actor=G.storyQuests.foal();if(!actor)throw Error('Filly absent before controlled cases');
 const scalarKeys=['x','z','heading','phase','bolt','side','flipT','away'],old=Object.fromEntries(scalarKeys.map(k=>[k,actor[k]])),oldPlayer={pos:q.player.pos.clone(),heading:q.player.heading,speed:q.player.speed},oldCamera={pos:q.camera.position.clone(),quaternion:q.camera.quaternion.clone()},getCourse=G.course.get;
 const before={colliders:JSON.stringify(world.colliders),walls:JSON.stringify(world.walls),registry:JSON.stringify(G.world.solidWorld.stats()),save:JSON.stringify(G.save.fresh())},cases=[];let time=9000;
 const sx=-205.22857680451483,sz=-235.68331022159,dt=1/30;
 function player(x=sx,z=sz,heading=0,speed=0){q.player.pos.set(x,0,z);q.player.heading=heading;q.player.speed=speed;q.camera.position.set(x-Math.sin(heading)*6,q.groundH(x,z)+3,z-Math.cos(heading)*6);}
 function seed(x,z,heading=0){const f=G.storyQuests.foal();f.x=x;f.z=z;f.heading=heading;f.side=1;f.flipT=0;f.away=false;f.bolt=0;f.group.visible=true;f.group.position.set(x,q.groundH(x,z),z);f.group.rotation.y=heading;}
 function light(){const f=G.storyQuests.foal();if(!f)return{present:false};return{present:true,x:f.x,z:f.z,heading:f.heading,phase:f.phase,bolt:f.bolt,visible:f.group.visible,groupPosition:f.group.position.toArray(),groundY:q.groundH(f.x,f.z),clear:module.fillyPoseClear({x:f.x,z:f.z,heading:f.heading},world,footprint),distanceToBench:Math.hypot(f.x-bench.x,f.z-bench.z)};}
 async function body(label){const r=await q.captureFilly({bench,view:label});if(r.bodyContact){delete r.bodyContact.skinTriangles;}return r;}
 async function run(name,frames,prepare,{bodyEvery=30,allowDespawn=false}={}){
  const row={name,dt,frames,trajectory:[],bodySamples:[],start:light()};let maximumStep=0;try{for(let i=0;i<frames;i++){prepare?.(i,frames);const previous=G.storyQuests.foal();const from=previous?{x:previous.x,z:previous.z}:null;time+=dt;const controllerStart=performance.now();window.__qaFillyTick(dt,time);const controllerMs=performance.now()-controllerStart;const s=light();s.controllerMs=controllerMs;s.frame=i;s.time=(i+1)*dt;if(s.present){s.footprintCoverage=q.measureFillyFootprint(footprint);if(from)maximumStep=Math.max(maximumStep,Math.hypot(s.x-from.x,s.z-from.z));}row.trajectory.push(s);if(s.present&&(i===0||i===frames-1||i%bodyEvery===0))row.bodySamples.push(await body(name+':'+i));if(!s.present){row.despawnFrame=i;break;}}
   row.maximumStep=maximumStep;row.end=light();row.finite=row.trajectory.every(s=>!s.present||[s.x,s.z,s.heading,s.groundY,...s.groupPosition].every(Number.isFinite));row.grounded=row.trajectory.every(s=>!s.present||Math.abs(s.groupPosition[1]-s.groundY)<.0001);row.clear=row.trajectory.every(s=>!s.present||s.clear);row.bodyClear=row.bodySamples.every(s=>!s.present||s.bodyContact?.crossings?.pairs===0&&s.bodyContact?.slabClearance>=-.00005);row.presence=row.end.present!==false||allowDespawn;cases.push(row);return row;
  }catch(error){row.error=String(error.stack||error);cases.push(row);throw error;}
 }
 try{
  q.captureFilly=Function('return ('+q.captureFillySource+')')();
  player();seed(sx+2.8,sz+.4);const settle=await run('blocked-shoulder-settle-20s',600);const final=settle.trajectory.filter(s=>s.present).slice(-90),last=final.at(-1);settle.finalThreeSecondJitter=last?Math.max(...final.map(s=>Math.hypot(s.x-last.x,s.z-last.z))):Infinity;
  player(sx,sz-8);seed(sx+2.8,sz-8+.4);await run('approach-pause-turn-20s',600,i=>{if(i<180)player(sx,sz-8+8*(i+1)/180,0,8/6);else if(i<300)player();else if(i<420)player(sx,sz,(i-300)/120*Math.PI/2);else player(sx,sz,Math.PI/2);});
  player();seed(bench.x,bench.z);await run('idle-initial-centre-overlap',90);
  player();seed(sx+2.8,sz+.4);G.course.get=()=>({ev:{id:'qa-only-filly-event'}});time+=dt;window.__qaFillyTick(dt,time);const eventHidden=!G.storyQuests.foal().group.visible&&!!G.storyQuests.foal().away;G.course.get=getCourse;const reentry=await run('event-return',90);reentry.eventHidden=eventHidden;
  player();seed(sx+140,sz,0);const far=await run('far-catchup',90);far.initialDistance=Math.hypot(sx+140-sx,sz-sz);far.restoredNearPlayer=far.end.present&&Math.hypot(far.end.x-sx,far.end.z-sz)<15;
  // Last fixture intentionally exercises the controller's existing final despawn.
  player();seed(bench.x-3,bench.z,Math.PI/2);const bolt=G.storyQuests.foal();bolt.bolt=4;const storm=await run('storm-bolt-through-bench',150,null,{bodyEvery:5,allowDespawn:true});storm.removedOnTime=storm.end.present===false&&storm.despawnFrame>=118&&storm.despawnFrame<=121;
 }finally{
  G.course.get=getCourse;q.player.pos.copy(oldPlayer.pos);q.player.heading=oldPlayer.heading;q.player.speed=oldPlayer.speed;q.camera.position.copy(oldCamera.pos);q.camera.quaternion.copy(oldCamera.quaternion);
  const remaining=G.storyQuests.foal();if(remaining){for(const k of scalarKeys)remaining[k]=old[k];remaining.group.position.set(remaining.x,q.groundH(remaining.x,remaining.z),remaining.z);remaining.group.rotation.y=remaining.heading;}
 }
 const unchanged={colliders:before.colliders===JSON.stringify(world.colliders),walls:before.walls===JSON.stringify(world.walls),registry:before.registry===JSON.stringify(G.world.solidWorld.stats()),save:before.save===JSON.stringify(G.save.fresh())},get=name=>cases.find(c=>c.name===name);
 const measured=cases.flatMap(c=>c.trajectory.filter(s=>s.present).map(s=>({case:c.name,frame:s.frame,heading:s.heading,phase:s.phase,...s.footprintCoverage}))),worst=measured.reduce((a,b)=>!a||b.maximumNearestProbeRadius>a.maximumNearestProbeRadius?b:a,null);
 const timingSamples=cases.flatMap(c=>c.trajectory.map(s=>s.controllerMs)).sort((a,b)=>a-b),controllerTiming={method:'Native wall time around actual tickFoal only, including its existing rig animation; excludes all pose-clear assertions, getVertexPosition/skin coverage, contact analysis and rendering. After-only cost evidence, no baseline comparison or hard timing gate.',samples:timingSamples.length,medianMs:timingSamples[Math.floor(timingSamples.length*.5)],p95Ms:timingSamples[Math.min(timingSamples.length-1,Math.floor(timingSamples.length*.95))],maximumMs:timingSamples.at(-1)};
 const coverage={poses:measured.length,verticesPerPose:measured[0]?.vertices,worst,maximumNearestProbeRadius:worst?.maximumNearestProbeRadius,radius:footprint.radius,maximumAboveTop:Math.max(...measured.map(p=>p.maxY-footprint.top)),maximumInsideSlabNearestRadius:Math.max(...measured.map(p=>p.maximumInsideSlabNearestRadius))};
 const checks={controlledObstaclesPreserved:Object.values(unchanged).every(Boolean),allCasesRecorded:cases.length===6,actorsRemainUntilExpectedBolt:cases.every(c=>c.presence),finiteActors:cases.every(c=>c.finite),rootedActors:cases.every(c=>c.grounded),existingObstaclesClear:cases.every(c=>c.clear),actualSkinBenchClear:cases.every(c=>c.bodyClear),animatedFootprintCoverage:measured.length>1400&&measured.every(p=>p.finite&&p.maximumNearestProbeRadius<=footprint.radius+.00005&&p.maxY<=footprint.top+.00005),stableTwentySecondIdle:get('blocked-shoulder-settle-20s')?.finalThreeSecondJitter<.03,eventHiddenAndReturns:!!get('event-return')?.eventHidden&&get('event-return')?.end?.present,farCatchupReturns:!!get('far-catchup')?.restoredNearPlayer,stormBoltDespawnPreserved:!!get('storm-bolt-through-bench')?.removedOnTime};
 return{method:'Controlled actual tickFoal and rig animation, after the 21 matched images. Module pose-clear check and actual posed skin/probe coverage every frame, plus independent surface contact samples. First-frame corrections from deliberately invalid starts allowed.',footprint,unchanged,checks,coverage,controllerTiming,cases};
}
function measureFillyFootprint(footprint){
 const q=window.__coldQA,f=q.G.storyQuests.foal(),T=q.THREE,skin=f?.rig?.skin;if(!skin)return{finite:false};
 f.group.updateWorldMatrix(true,true);skin.skeleton?.update();const position=skin.geometry.attributes.position,v=new T.Vector3(),root=new T.Vector3().setFromMatrixPosition(f.group.matrixWorld),c=Math.cos(f.heading),s=Math.sin(f.heading);let maximumNearestProbeRadius=0,maximumInsideSlabNearestRadius=0,minY=Infinity,maxY=-Infinity,worst=null,finite=true;
 for(let i=0;i<position.count;i++){skin.getVertexPosition(i,v);v.applyMatrix4(skin.matrixWorld);const dx=v.x-root.x,dz=v.z-root.z,x=c*dx-s*dz,z=s*dx+c*dz,y=v.y-root.y;let d=Infinity;for(const probe of footprint.probes)d=Math.min(d,Math.hypot(x-probe.x,z-probe.z));finite&&=Number.isFinite(d)&&Number.isFinite(y);minY=Math.min(minY,y);maxY=Math.max(maxY,y);if(d>maximumNearestProbeRadius){maximumNearestProbeRadius=d;worst={index:i,x,y,z,world:v.toArray()};}if(y>=footprint.bottom&&y<=footprint.top)maximumInsideSlabNearestRadius=Math.max(maximumInsideSlabNearestRadius,d);}
 return{vertices:position.count,finite,maximumNearestProbeRadius,maximumInsideSlabNearestRadius,minY,maxY,worst};
}

function stableRouteClearance(value){
 const copy=JSON.parse(JSON.stringify(value));
 for(const route of Object.values(copy.clearance||{}))if(route?.stats)delete route.stats.elapsedMs;
 return copy;
}
// Reconstruct exactly the read-only source injections used in the native run.
// Runtime file hashes and browser-executed hashes must both remain identical.
function auditedSource(body,file){
 const add=(marker,prefix)=>{assert.equal(body.split(marker).length-1,1,'Native audit marker changed: '+file);body=body.replace(marker,prefix+marker);};
 if(file==='assets/world-photoscans.js')add('state.treePositions=trees.map','state.__coldAudit={trees,treeMeshes,treeCards};');
 if(file==='assets/terrain-realism.js')add('Object.assign(sh.uniforms, uniforms);','material.userData.__coldShaders=material.userData.__coldShaders||[];material.userData.__coldShaders.push(sh);');
 if(file==='assets/features/world-paths.js'){
  add('const TRACKS=[];',`window.__coldSolids={colliders:JSON.parse(JSON.stringify(W.colliders)),walls:JSON.parse(JSON.stringify(W.walls))};`);
  add('const pathTimber=',`P.__propsAudit={BAT,SIGNS};`);
 }
 if(file==='assets/features/story-quests.js')add('G.storyQuests={','window.__qaFillyTick=tickFoal;');
 if(file==='ranch3d.html')add('const MERGE_STATS=mergeStatics();',`window.__coldQA={THREE,scene,camera,renderer,composer,G,player,groundH,terrainH,TACK,keys,step(dt){manualStepping=true;tick(dt)},day(t=.34,rain=false){dayT=t;weather.mode=rain?'rain':'clear';weather.timer=99999}};`);
 return body;
}
async function recheckNativeCapture(){
 assert.equal(baseline,false,'An offline after recheck cannot be run in baseline mode');
 const input=path.resolve(process.env.QA_FILLY_RECHECK),bytes=fs.readFileSync(input),report=JSON.parse(bytes);
 assert.equal(report.baseline,false,'Recheck requires an actual native after capture');
 assert.equal(report.reference,reference,'Native capture revision differs from requested preservation reference');
 assert.equal(report.checks.sourcesMatchWorkingTree,true,'Native run did not attest its executed source');
 assert(report.sourceReceipt?.files?.length,'Native source receipt is missing');
 const audit=[];
 for(const receipt of report.sourceReceipt.files){
  assert(receipt.file&&!path.isAbsolute(receipt.file)&&!receipt.file.split('/').includes('..'),'Unsafe receipt path');
  const raw=fs.readFileSync(path.join(ROOT,receipt.file),'utf8'),current=sha(raw),executed=sha(auditedSource(raw,receipt.file));
  assert.equal(current,receipt.rawSha256,'Captured runtime changed: '+receipt.file);
  assert.equal(executed,receipt.executedSha256,'Audit injection differs from native execution: '+receipt.file);
  assert(receipt.browserSha256.length&&receipt.browserSha256.every(h=>h===executed),'Native browser hashes differ: '+receipt.file);
  audit.push({file:receipt.file,rawSha256:current,executedSha256:executed});
 }
 for(const file of moduleFiles)assert(audit.some(r=>r.file===file),'Required native runtime receipt missing: '+file);
 const referencePath=path.resolve(process.env.QA_FILLY_REFERENCE||path.join(out,'../filly-before/report.json'));
 const referenceBytes=fs.readFileSync(referencePath),before=JSON.parse(referenceBytes);
 assert.equal(before.baseline,true,'Preservation reference must be an actual native baseline');assert.equal(before.reference,reference);
 const result=await acceptCapture({state:report.state,rows:report.rows,errors:report.errors,sourceMatches:true});
 fs.mkdirSync(out,{recursive:true});const images=[];
 for(const row of report.rows){
  assert(/^[a-z0-9-]+$/.test(row.name),'Unsafe image row name');
  const source=path.join(path.dirname(input),row.name+'.webp'),target=path.join(out,row.name+'.webp'),data=fs.readFileSync(source),hash=sha(data);
  if(path.resolve(source)!==path.resolve(target))fs.copyFileSync(source,target);
  assert.equal(sha(fs.readFileSync(target)),hash,'Native image changed during recheck: '+row.name);
  images.push({name:row.name+'.webp',sha256:hash});
 }
 const final={...report,...result,originalAcceptance:{checks:report.checks,metrics:report.metrics},recheckedFrom:input,
  recheck:{method:'CPU-only acceptance recomputation; no browser/rendering',excludedTimingFields:['state.routeClearance.clearance.*.stats.elapsedMs'],nativeReportSha256:sha(bytes),nativeCapturedGitHead:report.gitHead,validationGitHead:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),referenceReport:referencePath,referenceReportSha256:sha(referenceBytes),runtimeAudit:audit,images}};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(final,null,2));
 console.log(JSON.stringify({checks:result.checks,metrics:result.metrics,recheckedFrom:input,sourceFiles:audit.length,images:images.length}));
 assert(Object.values(result.checks).every(Boolean),'Roadside native capture recheck failed');
}
function roadsideAcceptance(state,before,rows){
 const old=before.state,checks={},metrics={};
 checks.nativeGPU=!/swiftshader|llvmpipe|software rasterizer/i.test(state.gpu);
 checks.allCollidersPreserved=equal(state.colliders,old.colliders);
 checks.allWallsPreserved=equal(state.walls,old.walls);
 checks.nonBenchRawBatchesPreserved=equal(state.nonBenchBat,old.nonBenchBat);
 checks.nonBenchRenderRowsPreserved=Object.keys(old.nonBenchBatches).every(k=>equal(state.nonBenchBatches[k].rows,old.nonBenchBatches[k].rows));
 checks.allTreesPreserved=equal(state.treeAudit,old.treeAudit);
 checks.routeClearancePreserved=equal(stableRouteClearance(state.routeClearance),stableRouteClearance(old.routeClearance));
 checks.allBenchSitesPreserved=state.benches.length===old.benches.length&&state.benches.every((b,i)=>{const a=old.benches[i];return b.x===a.x&&b.z===a.z&&Math.abs(b.y-a.y)<1e-10&&angular(b.yaw,a.yaw)<1e-10&&near(b.matrix,a.matrix)&&b.visible===a.visible&&equal(b.legacyRowIndices,a.legacyRowIndices)&&equal(b.collider,a.collider);});
 const immutableSign=s=>({id:s.id,name:s.name,x:s.x,y:s.y,z:s.z,matrix:s.matrix,arms:s.arms,collider:s.collider});
 checks.allSignsPreserved=state.signs.length===15&&equal(state.signs.map(immutableSign),old.signs.map(immutableSign));
 checks.benchViewsCaptured=['bench-front-high','bench-side-high','bench-back-high'].every(name=>rows.some(r=>r.name===name));
 checks.relocatedSignViewsCaptured=['sign-hollowpeak-high','sign-frostpine-high','sign-ranchfork-high'].every(name=>rows.some(r=>r.name===name));
 {
  checks.roadsideReady=state.roadsideReady;
  checks.legacyBenchRowsRetired=state.legacyBenches.length===state.benches.length&&state.legacyBenches.every(b=>b.renderRows.every(r=>Math.abs(r.determinant??det3(r.matrix))<1e-8&&[0,1,2,4,5,6,8,9,10].every(k=>Math.abs(r.matrix[k])<1e-8)));

  const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  checks.boundedSharedBenchGeometry=state.benchVisual.length===3&&['wood','aged','iron'].every(key=>state.benchVisual.some(v=>v.key===key))&&state.benchVisual.every(v=>v.type==='baked'&&!v.hasSolidParts&&v.castShadow&&v.receiveShadow&&near(v.matrix,identity,1e-12));
  checks.benchVisualMatricesMatch=state.benchVisual.every(v=>v.sites.length===state.benches.length&&v.sites.every((s,i)=>{const b=state.benches[i];return s.x===b.x&&s.z===b.z&&Math.abs(s.y-b.y)<1e-10&&angular(s.yaw,b.yaw)<1e-10&&s.visible===b.visible;}));
  checks.benchVertexRangesValid=state.benchVisual.every(v=>{const p=v.geometry.attributes.position.array,index=v.geometry.index?.array||[],vertices=p.length/3;let vertexEnd=0,indexEnd=0;for(const s of v.sites){if(!Number.isInteger(s.vertexStart)||!Number.isInteger(s.vertexCount)||!Number.isInteger(s.indexStart)||!Number.isInteger(s.indexCount)||s.vertexStart!==vertexEnd||s.indexStart!==indexEnd||s.vertexCount<0||s.indexCount<0||s.vertexStart+s.vertexCount>vertices||s.indexStart+s.indexCount>index.length)return false;for(let i=s.indexStart;i<s.indexStart+s.indexCount;i++)if(index[i]<s.vertexStart||index[i]>=s.vertexStart+s.vertexCount)return false;for(let i=s.vertexStart;i<s.vertexStart+s.vertexCount;i++)if(Math.hypot(p[i*3]-s.x,p[i*3+2]-s.z)>.85003)return false;if(s.visible&&s.vertexCount===0||!s.visible&&s.vertexCount!==0)return false;vertexEnd+=s.vertexCount;indexEnd+=s.indexCount;}return vertexEnd===vertices&&indexEnd===index.length;});
  const contacts=state.benchVisual.find(v=>v.key==='wood')?.actualFootContacts||[],embed=state.benchBatchStats?.embed;
  checks.benchFeetContactGround=Number.isFinite(embed)&&contacts.length===state.benches.filter(b=>b.visible).length*4&&contacts.every(f=>f.samples.length>0&&f.samples.every(p=>Number.isInteger(p.index)&&Number.isFinite(p.gap)&&Math.abs(p.gap+embed)<.00005));
  checks.signDirectionMetadataMatches=state.signs.every(s=>s.boardData?.boards?.length===s.arms.length&&s.boardData.boards.every((b,i)=>{const a=s.arms[i],dx=Math.sin(a.yaw),dz=Math.cos(a.yaw);return b.label===a.label&&equal(b.destination,a.destination)&&angular(b.yaw,a.yaw)<1e-12&&b.y===a.y&&near(b.direction,[dx,0,dz],1e-12)&&near(b.normal,[-dz,0,dx],1e-12)&&near(b.center,[dx*(2.45/2+.09),a.y,dz*(2.45/2+.09)],1e-12);}));
  checks.physicalSignBoards=state.signs.every(s=>{const root=s.parts[0];return root.geometry.triangles>=s.arms.length*12&&root.castShadow&&root.receiveShadow&&root.materials.every(m=>!m.transparent&&m.opacity===1&&m.alphaTest===0);});
 }
 metrics.benches={count:state.benches.length,visible:state.benches.filter(b=>b.visible).length,cleared:state.benches.filter(b=>!b.visible).length,missingOldCircle:state.benches.filter(b=>!b.collider).length,legacyBoxRows:old.benches.length*4,visualBatches:state.benchVisual.map(b=>({name:b.name,type:b.type,sites:b.sites?.length,triangles:b.geometry.triangles})),batchStats:state.benchBatchStats};
 metrics.worldResources={before:old.worldResources,after:state.worldResources};
 const median=a=>{const s=a.slice().sort((a,b)=>a-b);return s.length?s[Math.floor(s.length/2)]:null;};
 metrics.nativeFrames=rows.map(r=>{const previous=before.rows.find(b=>b.name===r.name);return{name:r.name,before:previous?.renderMetrics,after:r.renderMetrics,medianRatio:previous?median(r.renderMetrics.samplesMs)/median(previous.renderMetrics.samplesMs):null};});
 // Native timings are evidence, not a flaky hard acceptance gate. Draw/triangle
 // budgets are explicit opt-ins so the reviewer can set measured limits.
 if(process.env.QA_FILLY_MAX_DRAW_DELTA)checks.drawBudget=rows.every(r=>{const b=before.rows.find(b=>b.name===r.name);return b?r.renderMetrics.calls<=b.renderMetrics.calls+Number(process.env.QA_FILLY_MAX_DRAW_DELTA):!!r.view.diagnostic;});
 if(process.env.QA_FILLY_MAX_TRIANGLE_DELTA)checks.triangleBudget=rows.every(r=>{const b=before.rows.find(b=>b.name===r.name);return b?r.renderMetrics.triangles<=b.renderMetrics.triangles+Number(process.env.QA_FILLY_MAX_TRIANGLE_DELTA):!!r.view.diagnostic;});
 return{checks,metrics};
}
function runSelfTest(){
 const y=7.31,yaw=-1.6536755063023536,x=-202.43818784289377,z=-235.45151409810353;
 function matrix(px,py,pz,sx,sy,sz,ry,rz=0){const a=Math.cos(ry),b=Math.sin(ry),c=Math.cos(rz),d=Math.sin(rz);return[a*c*sx,d*sx,-b*c*sx,0,-a*d*sy,c*sy,b*d*sy,0,b*sz,0,a*sz,0,px,py,pz,1];}
 const make=m=>({matrix:m,color:[.3,.4,.5]});
 const rows=[make(matrix(3,0,4,1,1,1,0)),make(matrix(x,y+.46,z,1.7,.09,.42,yaw)),make(matrix(x-Math.sin(yaw+Math.PI/2)*.2,y+.78,z-Math.cos(yaw+Math.PI/2)*.2,1.7,.3,.06,yaw,.14)),...[-.7,.7].map(s=>make(matrix(x+Math.sin(yaw)*s,y+.23,z+Math.cos(yaw)*s,.1,.46,.34,yaw))),make(matrix(8,0,9,.7,1,.2,.3))];
 const rendered=rows.map(r=>({...r,matrix:Array.from(new Float32Array(r.matrix)),color:Array.from(new Float32Array(r.color))}));
 const fixture={bat:{box:rows,cyl:[]},batches:{box:{rows:rendered},cyl:{rows:[]}},colliders:[{x:9,z:3,r:2,id:'existing'},{x,z,r:.85}]};
 const got=extractLegacyBenches(fixture);assert.equal(got.benches.length,1);assert.deepEqual(got.benches[0].legacyRowIndices,[1,2,3,4]);assert.equal(got.benches[0].collider.index,1);assert.equal(got.benches[0].collider.object,fixture.colliders[1]);assert.deepEqual(got.nonBenchBat.box,[rows[0],rows[5]]);assert.deepEqual(got.nonBenchBatches.box.rows,[rendered[0],rendered[5]]);assert.equal(got.benches[0].x,x);assert.equal(got.benches[0].z,z);assert(angular(got.benches[0].yaw,yaw)<1e-12);
 const clearedRows=rendered.map((r,i)=>i===1?{...r,matrix:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1]}:r);const cleared=extractLegacyBenches({...fixture,colliders:[],batches:{...fixture.batches,box:{rows:clearedRows}}});assert.equal(cleared.benches[0].collider,null);assert.equal(cleared.benches[0].visible,false);assert.throws(()=>extractLegacyBenches({...fixture,colliders:[...fixture.colliders,fixture.colliders[1]]}));assert.throws(()=>extractLegacyBenches({...fixture,bat:{...fixture.bat,box:rows.filter((_,i)=>i!==2)}}));
 const route={mine:0,blocked:[{x:1,z:2}],clearance:{riverwest:{stats:{elapsedMs:3,removed:2},points:[[1,2],[3,4]]}}},timing=JSON.parse(JSON.stringify(route));timing.clearance.riverwest.stats.elapsedMs=900;
 assert(equal(stableRouteClearance(route),stableRouteClearance(timing)));assert.equal(route.clearance.riverwest.stats.elapsedMs,3);timing.clearance.riverwest.stats.removed=4;assert(!equal(stableRouteClearance(route),stableRouteClearance(timing)));
 const across=fillyTriangleCrossings([{index:0,points:[[-1,0,0],[1,0,0],[0,1,0]]}],[{mesh:'bench',index:0,points:[[0,-1,-1],[0,1,1],[0,1,-1]]}]);assert.equal(across.pairs,1);const separated=fillyTriangleCrossings([{index:0,points:[[-1,0,0],[1,0,0],[0,1,0]]}],[{mesh:'bench',index:0,points:[[0,3,-1],[0,5,1],[0,5,-1]]}]);assert.equal(separated.pairs,0);
 console.log('Roadside QA CPU fixture passed: rotated 4-row extraction, exact old collider index/object, preserved raw/Float32 non-bench rows, nullable removed circles, hidden-seat state, duplicate-circle and missing-piece rejection. No browser launched.');
}
async function acceptCapture({state,rows,errors,sourceMatches}){
 const checks={sourcesMatchWorkingTree:sourceMatches,finitePixels:rows.every(r=>[r.source,...r.buffers].every(b=>!b.invalid)),opaqueWorld:rows.every(r=>r.source.minAlpha>=1-1/2048),validWebGL:rows.every(r=>!r.gl),noErrors:!errors.length&&!state.errors.length,mountedBothDirections:state.rides.every(r=>r.complete&&r.finite&&!r.stalled&&r.maxGroundError<.1&&r.minCameraHeight>.1&&r.maxDeviation<1.5),ridgeStopsHorse:state.ridgeStop.relief<3.2&&state.ridgeStop.barrierDistance<1.8,clearAlpineSnow:rows.every(r=>r.grass.length===0),clearWinterCore:rows.every(r=>r.coldGrass.length===0),noWinterFlowers:rows.every(r=>r.winterFlowers.length===0),snowSourceResolution:rows.every(r=>{const s=r.resources.find(r=>r.key==='terrainSnow');return s?.width===2048&&s?.height===2048}),lodMatricesMatch:rows.every(r=>r.lodCount>2000&&!r.lodMismatch),treeBudget:rows.every(r=>r.treeTriangles<=r.treeBudget&&r.activeTrees<=12),rootedTrees:state.treeAudit.every(t=>Math.abs(t.bottomY-t.groundY+.07)<1e-8),validHeights:state.treeAudit.every(t=>Object.values(t).filter(v=>typeof v==='number').every(Number.isFinite)&&t.height>0),threeQualityTiers:rows.filter(r=>/snow-(medium|low)/.test(r.name)).length===2};
 const metrics={};{
  const before=baseline?{baseline:true,reference,state,rows}:JSON.parse(fs.readFileSync(process.env.QA_FILLY_REFERENCE||path.join(out,'../filly-before/report.json')));
  assert.equal(before.baseline,true,'Preservation reference must be a native baseline');assert.equal(before.reference,reference,'Preservation reference revision mismatch');
  for(const key of['ground','terrainAttrs','landmark','formations','preRoad','tracks','registry','outerGeometry','outerSites'])checks[key+'Preserved']=JSON.stringify(state[key])===JSON.stringify(before.state[key]);
  const {coldWoodlandWeights}=await import(path.join(ROOT,'assets/cold-woodland.mjs'));
  const old=before.state.treeAudit,now=state.treeAudit;
  checks.allTreeSitesYawPreserved=JSON.stringify(now.map(t=>[t.x,t.z,t.yaw]))===JSON.stringify(old.map(t=>[t.x,t.z,t.yaw]));
  checks.outsideColdTreeModelsPreserved=now.every((t,i)=>coldWoodlandWeights(t.x,t.z).weight>.08||JSON.stringify(t)===JSON.stringify(old[i]));
  const core=now.filter(t=>coldWoodlandWeights(t.x,t.z).weight>.35);
  checks.evergreenColdCores=core.length>300&&core.every(t=>/^(mature-pine|pine-[012])$/.test(t.source));
  const textureKeys=rows[0].resources.map(r=>r.key).sort();metrics.coldGrass={beforeNamedCoverObservations:before.rows.reduce((n,r)=>n+r.coldGrass.length,0),afterIncludingSeedGrassAndNearFlowers:rows.reduce((n,r)=>n+r.coldGrass.length,0)};checks.sameTextureSlots=JSON.stringify(textureKeys)===JSON.stringify(before.rows[0].resources.map(r=>r.key).sort());
  const concordance=trees=>{let agree=0,total=0;for(let i=0;i<trees.length;i++)for(let j=i+1;j<trees.length;j++){const a=trees[i],b=trees[j];if(Math.hypot(a.x-b.x,a.z-b.z)<14){total++;agree+=(a.source==='mature-pine')===(b.source==='mature-pine');}}return{agree,total,ratio:agree/total};};
  const cold=trees=>trees.filter(t=>coldWoodlandWeights(t.x,t.z).weight>.35);metrics.agePatches={before:concordance(cold(old)),after:concordance(core)};
  const mean=a=>a.reduce((s,t)=>s+t.height,0)/a.length;metrics.height={adults:mean(core.filter(t=>t.source==='mature-pine')),regeneration:mean(core.filter(t=>t.source.startsWith('pine-')))};
  checks.coherentAgePatches=Math.abs(metrics.agePatches.after.ratio-metrics.agePatches.before.ratio)<1e-12&&metrics.agePatches.after.ratio>.65;checks.shorterRegeneration=metrics.height.adults>metrics.height.regeneration*1.2;
 }

 const before=baseline?{state,rows}:JSON.parse(fs.readFileSync(process.env.QA_FILLY_REFERENCE||path.join(out,'../filly-before/report.json')));const props=roadsideAcceptance(state,before,rows),filly=fillyAcceptance(state,before,rows);return {checks:{...checks,...props.checks,...filly.checks},metrics:{...metrics,...props.metrics,...filly.metrics}};
}
(async()=>{
 if(process.env.QA_FILLY_SELFTEST==='1'){runSelfTest();return;}
 if(process.env.QA_FILLY_RECHECK){await recheckNativeCapture();return;}
 fs.mkdirSync(out,{recursive:true});const QA=require('./qa-platform.cjs');
 if(process.env.QA_FILLY_IDENTITY_FIRST==='1')assert(baseline,'Identity-first capture must be pinned to published baseline');
 const browser=await QA.chromium.launch({headless:true,args:QA.gpuArgs()});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const sourceTasks=[];page.on('response',r=>{const file=new URL(r.url()).pathname.replace(/^\/+/, '');if(expectedBodies.has(file))sourceTasks.push(r.body().then(body=>({file,sha256:sha(body)})));});
 const tracked=new Set(cp.execFileSync('git',['ls-tree','-r','--name-only',reference],{cwd:ROOT,encoding:'utf8'}).trim().split('\n'));
 function raw(file){if(!rawBodies.has(file))rawBodies.set(file,baseline?cp.execFileSync('git',['show',reference+':'+file],{cwd:ROOT,encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(path.join(ROOT,file),'utf8'));return rawBodies.get(file);}
 function inject(body,marker,addition,file){assert.equal(body.split(marker).length-1,1,'Audit marker changed: '+file+' '+marker);return body.replace(marker,addition+marker);}
 // Every local tracked script/HTML body is revision-bound, not only modified
 // imports. This prevents a baseline from accidentally loading the live prop code.
 await page.route('**/*',async r=>{
  const url=new URL(r.request().url()),file=url.pathname.replace(/^\/+/, '');
  if(url.pathname==='/api/me'){await r.fulfill({contentType:'application/json',body:'null'});return;}
  if(url.origin!==new URL(QA.BASE).origin||! /\.(?:js|mjs|html)$/.test(file)){await r.continue();return;}
  if(baseline?!tracked.has(file):!fs.existsSync(path.join(ROOT,file))){await r.continue();return;}
  let body=raw(file);
  if(file==='assets/world-photoscans.js')body=inject(body,'state.treePositions=trees.map','state.__coldAudit={trees,treeMeshes,treeCards};',file);
  if(file==='assets/terrain-realism.js')body=inject(body,'Object.assign(sh.uniforms, uniforms);','material.userData.__coldShaders=material.userData.__coldShaders||[];material.userData.__coldShaders.push(sh);',file);
  if(file==='assets/features/world-paths.js'){
   body=inject(body,'const TRACKS=[];',`window.__coldSolids={colliders:JSON.parse(JSON.stringify(W.colliders)),walls:JSON.parse(JSON.stringify(W.walls))};`,file);
   body=inject(body,'const pathTimber=',`P.__propsAudit={BAT,SIGNS};`,file);
  }
  if(file==='assets/features/story-quests.js')body=inject(body,'G.storyQuests={','window.__qaFillyTick=tickFoal;',file);
  if(file==='ranch3d.html')body=inject(body,'const MERGE_STATS=mergeStatics();',`window.__coldQA={THREE,scene,camera,renderer,composer,G,player,groundH,terrainH,TACK,keys,step(dt){manualStepping=true;tick(dt)},day(t=.34,rain=false){dayT=t;weather.mode=rain?'rain':'clear';weather.timer=99999}};`,file);
  expectedBodies.set(file,body);await r.fulfill({contentType:file.endsWith('.html')?'text/html':'text/javascript',headers:{'cache-control':'no-store'},body});
 });
 await page.addInitScript(()=>{let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
 await page.goto(QA.BASE+'/ranch3d.html?qa=roadside-props',{timeout:120000});await page.waitForFunction(()=>window.__coldQA?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__coldQA;q.G.save.sync(s=>{s.qualityLocked=true;s.unlocked=s.unlocked||{};for(const r of q.G.tables.REGIONS)if(r.unlock)s.unlocked[r.id]=true;});q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;await q.G.undergrowth.ready;await q.G.world.ranchBuilderArt.ready;await q.G.worldPkg.oasisReady;await q.G.quartersPkg?.saplingsReady;await q.G.worldPaths.roadsideReady;await new Promise(queueMicrotask);advanceTime(0);q.G.gfx.apply('high');q.day();q.fallsModule=await import('./assets/falls-landscape.js?v=alpine-range-1');q.coldModule=await import('./assets/cold-woodland.mjs?v=cold-woodland-1');
  q.read=rt=>{const w=Math.floor(rt.width),h=Math.floor(rt.height),p=new Uint16Array(w*h*4);q.renderer.readRenderTargetPixels(rt,0,0,w,h,p);let invalid=0,minAlpha=1;for(let i=0;i<p.length;i+=4){if([0,1,2].some(c=>(p[i+c]&0x7c00)===0x7c00))invalid++;minAlpha=Math.min(minAlpha,q.THREE.DataUtils.fromHalfFloat(p[i+3]));}return{invalid,minAlpha}};
 });await page.evaluate(sources=>{__coldQA.fillyTriangleCrossings=Function('return ('+sources.crossings+')')();__coldQA.captureFillySource=sources.capture;__coldQA.measureFillyFootprint=Function('return ('+sources.measure+')')();},{crossings:fillyTriangleCrossings.toString(),capture:captureFilly.toString(),measure:measureFillyFootprint.toString()});console.log('Roadside capture ready: models, flowers, cold groves, saplings and deferred props settled');
 const state=await page.evaluate(()=>{const q=__coldQA,W=q.G.world,T=q.THREE;
  const hash=array=>{if(!array)return null;const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);let h=2166136261;for(const b of bytes)h=Math.imul(h^b,16777619);return(h>>>0).toString(16);};
  const geometry=g=>!g?null:Object.fromEntries(Object.entries(g.attributes).map(([k,v])=>[k,hash(v.array)]).concat([['index',hash(g.index?.array)]]));
  q.scene.updateMatrixWorld(true);const terrain=q.scene.getObjectByName('Pasture terrain'),outer=W.outerLandscape;
  const ground=[];for(let z=-420;z<=420;z+=35)for(let x=-420;x<=420;x+=35)if(Math.hypot(x,z)<445)ground.push([x,z,q.groundH(x,z)]);
  const landmark=q.G.vistas.LAND.map(l=>({id:l.id,x:l.x,y:l.y,z:l.z,matrix:l.mesh.matrixWorld.toArray(),geometry:geometry(l.mesh.geometry)}));
  const formations=[];q.scene.traverse(o=>{if(o.userData.geology)formations.push({name:o.name,geology:o.userData.geology,matrix:o.matrixWorld.toArray(),geometry:geometry(o.geometry)});});
  const terrainAttrs=geometry(terrain.geometry),outerGeometry=geometry(outer.mesh.geometry);
  const audit=q.G.photoscans.__coldAudit;
  const treeAudit=audit.trees.map(t=>({x:t.x,z:t.z,yaw:t.yaw,height:t.height,kind:t.kind,source:t.source.key,tint:t.tint.getHexString(),crownWidth:t.crownWidth||1,rootY:t.matrix.elements[13],groundY:q.groundH(t.x,t.z),bottomY:t.matrix.elements[13]+t.source.bounds.min.y*t.height/t.source.meta.sourceHeight,matrix:t.matrix.toArray(),sourceHeight:t.source.meta.sourceHeight}));
  const treePositions=q.G.photoscans.treePositions.filter(s=>Math.abs(s.x)<=500&&Math.abs(s.z)<=500);
  const render=q.renderer.render,rides=[],track=q.G.worldPaths.tracks.find(t=>t.id==='frostpine');q.renderer.render=()=>{};try{for(const direction of[1,-1]){const pts=direction===1?track.pts:track.pts.slice().reverse(),a=pts[0];q.player.pos.set(a[0],0,a[1]);q.player.speed=q.player.y=q.player.vy=0;q.player.flying=q.player.onFoot=false;q.player.stam=1;q.G.followCam.reset();q.G.input.reset();q.G.riding.releaseAll();q.G.riding.selectGait('walk');q.keys.KeyW=true;let target=1,frames=0,maxGroundError=0,minCameraHeight=Infinity,maxDeviation=0,best=Infinity,lastProgress=0,stalled=false,finite=true;const maxFrames=Math.ceil(track.len/.9*30)+900;
   for(;frames<maxFrames&&target<pts.length;frames++){const b=pts[target],dx=b[0]-q.player.pos.x,dz=b[1]-q.player.pos.z,d=Math.hypot(dx,dz);if(d<1.15){target++;best=Infinity;lastProgress=frames;continue}if(d<best-.03){best=d;lastProgress=frames;}if(frames-lastProgress>300){stalled=true;break;}q.player.heading=Math.atan2(dx,dz);q.day();q.step(1/30);maxGroundError=Math.max(maxGroundError,Math.abs(q.player.mesh.position.y-q.groundH(q.player.pos.x,q.player.pos.z)));minCameraHeight=Math.min(minCameraHeight,q.camera.position.y-q.groundH(q.camera.position.x,q.camera.position.z));maxDeviation=Math.max(maxDeviation,q.G.worldPaths.trackDist(q.player.pos.x,q.player.pos.z,'frostpine'));finite&&=[...q.player.pos.toArray(),...q.camera.position.toArray()].every(Number.isFinite);}
   q.keys.KeyW=false;rides.push({direction,complete:target===pts.length,frames,maxGroundError,minCameraHeight,maxDeviation,stalled,finite});
  }}finally{q.renderer.render=render;q.keys.KeyW=false;}
  let ridgeStop;const oldRender=q.renderer.render;q.renderer.render=()=>{};try{q.player.pos.set(-80,0,-252);q.player.speed=q.player.y=q.player.vy=0;q.player.flying=false;q.player.heading=Math.PI;q.keys.KeyW=true;for(let i=0;i<300;i++){q.day();q.step(1/30);}ridgeStop={position:q.player.pos.toArray(),relief:q.fallsModule.fallsRelief(q.player.pos.x,q.player.pos.z),barrierDistance:Math.min(...W.fallsLandscape.barriers.map(c=>Math.hypot(c.x-q.player.pos.x,c.z-q.player.pos.z)))};}finally{q.keys.KeyW=false;q.renderer.render=oldRender;}
  return{ground,terrainAttrs,landmark,formations,preRoad:window.__coldSolids,treePositions,treeAudit,tracks:q.G.worldPaths.tracks.map(t=>({id:t.id,pts:t.pts,len:t.len})),registry:W.solidWorld.stats(),outerGeometry,outer:outer.stats,outerSites:outer.woodlandSites.length,rides,ridgeStop,errors:[...q.G.errors,...q.G.photoscans.errors,...q.G.worldDetails.errors,...q.G.undergrowth.errors]};
 });Object.assign(state,await page.evaluate(captureRoadside));assert(Array.isArray(state.benches),'Published physical benches must expose P.benches in baseline and after');{const legacy=extractLegacyBenches(state);state.nonBenchBat=legacy.nonBenchBat;state.nonBenchBatches=legacy.nonBenchBatches;state.legacyBenches=legacy.benches;}
 const footGround=await page.evaluate(benches=>benches.map(b=>{const q=window.__coldQA,c=Math.cos(b.yaw),s=Math.sin(b.yaw),feet=[];for(const lx of[-.59,.59])for(const lz of[-.20,.20]){const x=b.x+c*lx+s*lz,z=b.z-s*lx+c*lz;feet.push({local:[lx,lz],x,z,groundY:q.groundH(x,z),relativeToCentre:q.groundH(x,z)-b.y});}return{feet,feetGroundMin:Math.min(...feet.map(f=>f.groundY)),feetGroundMax:Math.max(...feet.map(f=>f.groundY)),feetRelief:Math.max(...feet.map(f=>f.groundY))-Math.min(...feet.map(f=>f.groundY))};}),state.benches);
 state.benches.forEach((b,i)=>Object.assign(b,footGround[i]));
 fs.writeFileSync(path.join(out,'preservation-state.json'),JSON.stringify({baseline,reference,gitHead:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),captureStage:'preservation-before-views',state},null,2));
 console.log('Preservation snapshot saved: built benches='+state.benches.length+', visible='+state.benches.filter(b=>b.visible).length+', cleared='+state.benches.filter(b=>!b.visible).length+', old circle absent='+state.benches.filter(b=>!b.collider).length+', maximum four-foot terrain relief='+Math.max(...state.benches.map(b=>b.feetRelief)).toFixed(4)+'m');
 const beforeForViews=baseline?{state}:JSON.parse(fs.readFileSync(process.env.QA_FILLY_REFERENCE||path.join(out,'../filly-before/report.json')));
 const pictured=beforeForViews.state.benches.find(b=>Math.hypot(b.x+202.43818784289377,b.z+235.45151409810353)<.001);assert(pictured,'The photographed Frostpine bench was not captured');
 const benchView=(name,lx,lz)=>{const c=Math.cos(pictured.yaw),s=Math.sin(pictured.yaw);return{name,eye:[pictured.x+c*lx+s*lz,1.7,pictured.z-s*lx+c*lz],look:[pictured.x,.65,pictured.z]};};
 const signView=id=>{const sign=beforeForViews.state.signs.find(s=>s.id===id);assert(sign,'Missing relocated post '+id);const yaw=sign.arms[0].yaw,dx=Math.sin(yaw),dz=Math.cos(yaw),nx=-dz,nz=dx;return{name:'sign-'+id+'-high',eye:[sign.x+dx*1.3+nx*3,1.85,sign.z+dz*1.3+nz*3],look:[sign.x+dx*1.3,2.55,sign.z+dz*1.3]};};
 const views=[
  {name:'hollow-core-high',eye:[-169,1.9,-216],look:[-151,3,-246]},
  {name:'hollow-thaw-high',eye:[-64,1.9,-171],look:[-115,1.6,-205]},
  {name:'snow-close-high',eye:[-205,1.7,-223],look:[-211,.2,-239]},
  {name:'frost-forest-high',eye:[-304,2,-291],look:[-320,3,-326]},
  {name:'alpine-high',eye:[-194,3,-276],look:[-173,12,-342]},
  {name:'frost-riding-high',horse:[-219,-255,-2.0],riding:true},
  {name:'meadow-control',eye:[-60,2,56],look:[-53,1.5,39]},
  {name:'dry-control',horse:[-178,132,-1.1],riding:true},
  benchView('bench-front-high',0,2.8),benchView('bench-side-high',2.6,.7),benchView('bench-back-high',0,-2.8),...['hollowpeak','frostpine','ranchfork'].map(signView),
  ...['medium','low','rain','golden','night'].map(n=>({name:'snow-'+n,eye:[-205,1.7,-223],look:[-211,.2,-239],tier:['medium','low'].includes(n)?n:'high',rain:n==='rain',time:n==='golden'?.23:n==='night'?0:.34}))
 ];
 // The accepted 19-view prefix remains untouched. Two diagnostic
 // views in both captures verify the physical board back face still reads forwards.
 for(const id of['hollowpeak','frostpine']){const front=signView(id),sign=beforeForViews.state.signs.find(s=>s.id===id),yaw=sign.arms[0].yaw,dx=Math.sin(yaw),dz=Math.cos(yaw);views.push({name:'sign-'+id+'-back-high',eye:[sign.x+dx*1.3+dz*3,1.85,sign.z+dz*1.3-dx*3],look:front.look,diagnostic:true});}
 const rows=[];for(const c of views){const row=await page.evaluate(async c=>{const q=__coldQA;q.G.gfx.apply(c.tier||'high');q.player.pos.set(c.horse?.[0]??c.eye[0],0,c.horse?.[1]??c.eye[2]);q.player.speed=q.player.y=q.player.vy=0;q.player.flying=false;q.player.heading=c.horse?.[2]??0;const render=q.renderer.render;q.renderer.render=()=>{};try{for(let i=0;i<210;i++){q.day(c.time??.34,c.rain);q.step(1/30);q.scene.onBeforeRender();}let settled=0;for(let i=0;i<180;i++){q.step(.016);settled=q.G.world.npcCharacters.stats().pending?0:settled+1;if(settled>=2)break;await new Promise(r=>setTimeout(r,40));}}finally{q.renderer.render=render;}
  q.player.mesh.visible=!!c.riding;for(const o of Object.values(q.TACK||{}))if(o?.isObject3D)o.visible=!!c.riding;const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=!!c.riding;
  if(!c.riding){const eye=c.eye.slice(),look=c.look.slice();eye[1]+=q.groundH(eye[0],eye[2]);look[1]+=q.groundH(look[0],look[2]);q.camera.position.set(...eye);q.camera.lookAt(...look);}
  q.G.waterReflections.update(performance.now()+100);let source;const pass=q.composer.passes[0],original=pass.render;pass.render=function(renderer,write,read,...rest){original.call(this,renderer,write,read,...rest);source=q.read(read);};try{q.composer.render();}finally{pass.render=original;}
  const detail=q.G.photoscans.__coldAudit,mat=new q.THREE.Matrix4();let lodCount=0,lodMismatch=0,treeDraws=0;for(const {mesh,records} of [...detail.treeMeshes,...detail.treeCards]){if(!mesh.visible)continue;treeDraws++;for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,mat);const m=mat.elements,t=records.find(t=>Math.abs(t.x-m[12])<.001&&Math.abs(t.z-m[14])<.001);lodCount++;if(!t||m.some((v,k)=>Math.abs(v-t.matrix.elements[k])>2e-5))lodMismatch++;}}
  const grass=[],coldGrass=[],winterFlowers=[];q.scene.traverse(o=>{const seed=o===q.G.world.seedGrass,flower=o===q.G.world.nearGroundCover.flow||o.name==='Seeded pasture flower clumps';if(!o.isInstancedMesh||!o.visible||(!seed&&!flower&&!['flora_tuft','flora_petal','flora_brack','Living pasture grass','Modelled meadow lupins','Middle distance pasture'].includes(o.name)))return;for(let i=0;i<o.count;i++){o.getMatrixAt(i,mat);if(Math.abs(mat.determinant())<1e-8)continue;const m=mat.elements;if(q.fallsModule.alpineSnowAt(m[12],m[14])>.35)grass.push([o.name,m[12],m[14]]);const weight=q.coldModule.coldWoodlandWeights(m[12],m[14]).weight,label=seed?'seedGrass':flower?'nearFlowers':o.name;if(weight>=.60)coldGrass.push([label,m[12],m[14]]);if(weight>.08&&(flower||['flora_petal','Modelled meadow lupins'].includes(o.name)))winterFlowers.push([label,m[12],m[14]]);}});
  const compiled=q.scene.getObjectByName('Pasture terrain').material.userData.__coldShaders||[],sh=compiled.findLast(s=>!s.vertexShader.includes('outerLandBlend'));if(!sh)throw Error('Actual riding-terrain shader not observed');
  const resources=Object.entries(sh?.uniforms||{}).filter(([k,v])=>v.value?.isTexture).map(([key,v])=>({key,width:v.value.image?.width,height:v.value.image?.height}));
  const info=q.renderer.info,oldReset=info.autoReset,samplesMs=[];let renderMetrics;info.autoReset=false;try{for(let i=0;i<8;i++){info.reset();const start=performance.now();q.composer.render();q.renderer.getContext().finish();const elapsed=performance.now()-start;if(i>=2)samplesMs.push(elapsed);}renderMetrics={method:'Frozen matched view: composer.render plus WebGL finish, two warmups and six native CPU/GPU wall samples',samplesMs,calls:info.render.calls,triangles:info.render.triangles,lines:info.render.lines,points:info.render.points,memory:{...info.memory}};}finally{info.autoReset=oldReset;}
  return{name:c.name,view:c,renderMetrics,lodCount,lodMismatch,treeDraws,grass,coldGrass,winterFlowers,resources,activeTrees:q.G.photoscans.activeTrees,treeTriangles:q.G.photoscans.activeTreeTriangles,treeBudget:q.G.photoscans.treeTriangleBudget,source,buffers:[q.composer.renderTarget1,q.composer.renderTarget2].map(q.read),gl:q.renderer.getContext().getError(),image:q.renderer.domElement.toDataURL('image/webp',.96).split(',')[1]};
 },c);row.filly=await page.evaluate(captureFilly,{bench:pictured,view:row.name});fs.writeFileSync(path.join(out,row.name+'.webp'),Buffer.from(row.image,'base64'));delete row.image;rows.push(row);console.log(row.name);
 if(row.name==='bench-front-high'){const identity={baseline,reference,gitHead:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),captureStage:'exact-accepted-prefix-through-bench-front',seed:928471,state,rows,identity:row.filly,sourceReceipt:{revision:baseline?reference:'working-tree',files:[...rawBodies].map(([file,body])=>({file,rawSha256:sha(body),executedSha256:sha(expectedBodies.get(file))})).sort((a,b)=>a.file.localeCompare(b.file))},errors};fs.writeFileSync(path.join(out,'identity-first.json'),JSON.stringify(identity,null,2));console.log('Filly identity saved: '+JSON.stringify({owner:row.filly?.owner,root:row.filly?.root,benchDistance:row.filly?.benchDistance,skin:row.filly?.skin?.uuid,bodyBounds:row.filly?.skin?.rootLocalBounds}));if(process.env.QA_FILLY_IDENTITY_FIRST==='1'){assert(row.filly?.group?.visible&&row.filly?.skin?.belongsToFilly,'Visible gray native filly ownership was not confirmed');assert(Math.abs(row.filly.benchDistance-.16847823637758258)<.00002,'Published bench-front root did not reproduce');return;}}
 }
 if(!baseline){state.fillyCases=await page.evaluate(captureFillyCases,pictured);fs.writeFileSync(path.join(out,'filly-cases.json'),JSON.stringify(state.fillyCases,null,2));console.log('Filly controlled cases: '+JSON.stringify({checks:state.fillyCases.checks,coverage:state.fillyCases.coverage,controllerTiming:state.fillyCases.controllerTiming}));}
 const browserSources=await Promise.all(sourceTasks),required=moduleFiles;
 const sourceReceipt={revision:baseline?reference:'working-tree',files:[...rawBodies].map(([file,body])=>({file,rawSha256:sha(body),executedSha256:sha(expectedBodies.get(file)),browserSha256:browserSources.filter(s=>s.file===file).map(s=>s.sha256)})).sort((a,b)=>a.file.localeCompare(b.file))};
 const sourceMatches=required.every(file=>expectedBodies.has(file)&&browserSources.some(s=>s.file===file))&&sourceReceipt.files.every(r=>r.browserSha256.length&&r.browserSha256.every(h=>h===r.executedSha256));
 if(!baseline)for(const file of files.filter(f=>!['ranch3d.html','assets/features/index.js','assets/features/story-quests.js'].includes(f)))assert.equal(rawBodies.get(file),cp.execFileSync('git',['show',reference+':'+file],{cwd:ROOT,encoding:'utf8',maxBuffer:8e6}),'Unchanged landscape source modified: '+file);
 const {checks,metrics}=await acceptCapture({state,rows,errors,sourceMatches});
 const report={baseline,reference,gitHead:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),checks,metrics,state,rows,browserSources,sourceReceipt,errors};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks,metrics:{benches:metrics.benches?.count,worldResources:metrics.worldResources,filly:metrics.filly},errors}));assert(Object.values(checks).every(Boolean),'Story filly obstacle acceptance failed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
