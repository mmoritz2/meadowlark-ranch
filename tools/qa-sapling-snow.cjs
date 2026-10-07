// Matched-revision Frostpine nursery snow review. The root agent owns all GPU runs.
// QA_SAPLING_IDENTITY_FIRST=1 saves a quick full nursery/world receipt before views.
// Baseline: QA_SAPLING_BASELINE=1 node tools/qa-sapling-snow.cjs <out>
// Review: QA_SAPLING_REFERENCE=<baseline>/report.json node ... <out>
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||'output/sapling-snow');
const fixtureOnly=process.env.QA_SAPLING_FIXTURE_ONLY==='1';
const diagnosticOnly=process.env.QA_SAPLING_DIAGNOSTIC_ONLY==='1';
const baseline=process.env.QA_SAPLING_BASELINE==='1',reference=process.env.QA_SAPLING_BASE_REV||'bcd45a1';
const files=['ranch3d.html','assets/features/index.js','assets/features/world-paths.js','assets/world-photoscans.js','assets/terrain-realism.js','assets/features/world-flora.js','assets/cold-woodland.mjs','assets/ranch-builder-art.js','assets/features/world-quarters.js','assets/vegetation.js','assets/solid-collisions.js'];
const newModules=['assets/roadside-prop-geometry.mjs','assets/fingerpost-geometry.mjs'];
files.push('assets/features/story-quests.js','assets/features/world.js','assets/features/on-foot.js',...newModules);
files.push('assets/story-filly-navigation.mjs');
const navigationModule='assets/sapling-snow.mjs';
const moduleFiles=[...files,...(!baseline&&fs.existsSync(path.join(ROOT,navigationModule))?[navigationModule]:[])],expectedBodies=new Map(),rawBodies=new Map();
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
 {checks.fillyBenchSkinClear=['bench-front-high','bench-side-high','bench-back-high'].every(name=>{const f=rows.find(r=>r.name===name)?.filly;return f?.present&&f.skin?.belongsToFilly&&f.bodyContact?.crossings?.pairs===0&&f.bodyContact?.slabClearance>=-.00005;});}
 return{checks,metrics};
}

function measureFillyFootprint(footprint){
 const q=window.__coldQA,f=q.G.storyQuests.foal(),T=q.THREE,skin=f?.rig?.skin;if(!skin)return{finite:false};
 f.group.updateWorldMatrix(true,true);skin.skeleton?.update();const position=skin.geometry.attributes.position,v=new T.Vector3(),root=new T.Vector3().setFromMatrixPosition(f.group.matrixWorld),c=Math.cos(f.heading),s=Math.sin(f.heading);let maximumNearestProbeRadius=0,maximumInsideSlabNearestRadius=0,minY=Infinity,maxY=-Infinity,worst=null,finite=true;
 for(let i=0;i<position.count;i++){skin.getVertexPosition(i,v);v.applyMatrix4(skin.matrixWorld);const dx=v.x-root.x,dz=v.z-root.z,x=c*dx-s*dz,z=s*dx+c*dz,y=v.y-root.y;let d=Infinity;for(const probe of footprint.probes)d=Math.min(d,Math.hypot(x-probe.x,z-probe.z));finite&&=Number.isFinite(d)&&Number.isFinite(y);minY=Math.min(minY,y);maxY=Math.max(maxY,y);if(d>maximumNearestProbeRadius){maximumNearestProbeRadius=d;worst={index:i,x,y,z,world:v.toArray()};}if(y>=footprint.bottom&&y<=footprint.top)maximumInsideSlabNearestRadius=Math.max(maximumInsideSlabNearestRadius,d);}
 return{vertices:position.count,finite,maximumNearestProbeRadius,maximumInsideSlabNearestRadius,minY,maxY,worst};
}

// Read-only native nursery receipt. No Three resources or random values are created.
function captureSaplings({roots}={}){
 const q=window.__coldQA,P=q.G.quartersPkg,T=q.THREE,W=q.G.world;
 const clone=x=>x==null?null:JSON.parse(JSON.stringify(x)),hash=a=>{if(!a)return null;let h=2166136261;for(const b of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^b,16777619);return(h>>>0).toString(16);};
 const textHash=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return(h>>>0).toString(16);};
 const box=b=>b?{min:b.min.toArray(),max:b.max.toArray()}:null,sphere=b=>b?{center:b.center.toArray(),radius:b.radius}:null;
 const geometry=g=>({type:g.type,attributes:Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,{itemSize:a.itemSize,count:a.count,type:a.array.constructor.name,hash:hash(a.array)}])),index:g.index?{count:g.index.count,type:g.index.array.constructor.name,hash:hash(g.index.array)}:null,bounds:box(g.boundingBox),sphere:sphere(g.boundingSphere),groups:clone(g.groups),drawRange:clone(g.drawRange),triangles:(g.index?.count||g.attributes.position.count)/3});
 const materials=new Map(),textures=new Map(),hook=q.saplingShaderCapture;
 function texture(t){if(!textures.has(t)){const image=t.image||{};textures.set(t,{id:textures.size,name:t.name,url:image.currentSrc||image.src||null,width:image.width||null,height:image.height||null,format:t.format,type:t.type,colorSpace:t.colorSpace,channel:t.channel,wrapS:t.wrapS,wrapT:t.wrapT,minFilter:t.minFilter,magFilter:t.magFilter,anisotropy:t.anisotropy,flipY:t.flipY,generateMipmaps:t.generateMipmaps,repeat:t.repeat?.toArray(),offset:t.offset?.toArray(),rotation:t.rotation});}return textures.get(t);}
 function material(m){
  if(!m)return null;if(materials.has(m))return materials.get(m).id;
  const rec=hook?.materials.get(m),programs=q.renderer.properties.get(m).programs,gl=q.renderer.getContext(),native=[];
  if(programs)for(const [key,p] of programs){const vs=gl.getShaderSource(p.vertexShader)||'',fs=gl.getShaderSource(p.fragmentShader)||'';native.push({cacheKey:key,name:p.name,usedTimes:p.usedTimes,vertexShaderHash:textHash(vs),fragmentShaderHash:textHash(fs),vertexShaderLength:vs.length,fragmentShaderLength:fs.length,samplerDeclarations:(fs.match(/uniform\s+(?:highp\s+|mediump\s+|lowp\s+)?sampler\w*\s+/g)||[]).length,vertexCompiled:!!gl.getShaderParameter(p.vertexShader,gl.COMPILE_STATUS),fragmentCompiled:!!gl.getShaderParameter(p.fragmentShader,gl.COMPILE_STATUS),linked:!!gl.getProgramParameter(p.program,gl.LINK_STATUS),vertexLog:(gl.getShaderInfoLog(p.vertexShader)||'').slice(0,4096),fragmentLog:(gl.getShaderInfoLog(p.fragmentShader)||'').slice(0,4096),linkLog:(gl.getProgramInfoLog(p.program)||'').slice(0,4096),features:{snow:vs.includes('vSaplingSnowWorld')&&fs.includes('float saplingSnowCover('),originalWorldNormal:vs.includes('vSaplingSnowNormalY = dot('),instanced:/#define USE_INSTANCING/.test(vs),foliageAlbedo:fs.includes('uFoliageAlbedoMean'),foliageAlphaFade:fs.includes('smoothstep(0.5, 2.6, length(vViewPosition))'),foliageDoubleSide:fs.includes('normal *= faceDirection;'),foliageTransmission:fs.includes('float leafTransmission=')}});}
  const r={id:materials.size,name:m.name,type:m.type,color:m.color?.toArray(),transparent:m.transparent,opacity:m.opacity,depthWrite:m.depthWrite,depthTest:m.depthTest,alphaTest:m.alphaTest,side:m.side,shadowSide:m.shadowSide,roughness:m.roughness,metalness:m.metalness,normalScale:m.normalScale?.toArray(),vertexColors:m.vertexColors,premultipliedAlpha:m.premultipliedAlpha,polygonOffset:m.polygonOffset,toneMapped:m.toneMapped,cacheKey:rec?.cacheKey??m.customProgramCacheKey(),hookSource:rec?.hookSource??m.onBeforeCompile.toString(),maps:Object.fromEntries(['map','alphaMap','normalMap','roughnessMap','metalnessMap','aoMap'].filter(k=>m[k]).map(k=>[k,texture(m[k]).id])),compiled:clone(rec?.compiled||[]),programs:native};materials.set(m,r);return r.id;
 }
 q.scene.updateMatrixWorld(true);const matrix=new T.Matrix4(),sourceMeshes=roots?roots.flatMap(root=>{const meshes=[];root.traverse(m=>{if(m.isMesh)meshes.push(m);});return meshes;}):(P.saplings||[]),cells=sourceMeshes.map((m,cellIndex)=>{const rows=[];for(let i=0;i<m.count;i++){m.getMatrixAt(i,matrix);rows.push({matrix:matrix.toArray(),determinant:matrix.determinant()});}return{cellIndex,name:m.name,type:m.type,count:m.count,matrix:m.matrixWorld.toArray(),rows,instanceHash:hash(m.instanceMatrix?.array),instanceColorHash:hash(m.instanceColor?.array),geometry:geometry(m.geometry),bounds:box(m.boundingBox),sphere:sphere(m.boundingSphere),cell:clone(m.userData.sceneryCell||null),visible:m.visible,frustumCulled:m.frustumCulled,castShadow:m.castShadow,receiveShadow:m.receiveShadow,materials:(Array.isArray(m.material)?m.material:[m.material]).map(material),customDepthMaterial:material(m.customDepthMaterial),customDistanceMaterial:material(m.customDistanceMaterial)};});
 if(roots)return{cells,materials:[...materials.values()],textures:[...textures.values()]};
 const retained=clone(P.__saplingAudit?.placements||null),quarterRoots=(P.objs||[]).map((o,index)=>({index,name:o.name,type:o.type,matrix:o.matrixWorld.toArray(),position:o.position.toArray(),scale:o.scale.toArray(),geometry:o.geometry?geometry(o.geometry):null,instanceHash:hash(o.instanceMatrix?.array),instanceColorHash:hash(o.instanceColor?.array)}));
 const things=(W.things||[]).map((o,index)=>({index,id:o.id,kind:o.kind,x:o.x,y:o.y??null,z:o.z,reach:o.reach??null,root:o.g?{name:o.g.name,type:o.g.type,matrix:o.g.matrixWorld.toArray()}:null}));
 const registry=typeof window.__qaSolidOwners==='function'?window.__qaSolidOwners():null;
 const canonicalRotors=[{role:'world-vistas:FAN',root:q.G.vistas.FAN},...(q.windmills||[]).map((root,index)=>({role:'ranch:windmill:'+index,root}))].map(({role,root})=>{
  if(!root)throw Error('Canonical animated rotor missing: '+role);const parts=[];root.traverse(o=>{if(o.isMesh){const g=geometry(o.geometry);delete g.bounds;delete g.sphere;parts.push({name:o.name,type:o.type,localMatrix:o===root?null:o.matrix.toArray(),geometry:g});}});const w=new T.Vector3().setFromMatrixPosition(root.matrixWorld);
  return{role,registryIndex:window.__qaSolidOwnerIndex(root),root:{name:root.name,type:root.type,position:root.position.toArray(),worldTranslation:w.toArray(),scale:root.scale.toArray(),rotationX:root.rotation.x,rotationY:root.rotation.y,rotationOrder:root.rotation.order},solidParts:clone(root.userData.solidParts||[]),parts};
 });

 const placed=[];q.scene.traverse(o=>{if(o.name==='Ranch prop | frost_tree'){placed.push({name:o.name,matrix:o.matrixWorld.toArray(),parts:[]});o.traverse(p=>{if(p.isMesh)placed.at(-1).parts.push({name:p.name,matrix:p.matrixWorld.toArray(),geometry:geometry(p.geometry),materials:(Array.isArray(p.material)?p.material:[p.material]).map(material)});});}});
 return{retained,cells,materials:[...materials.values()],textures:[...textures.values()],quarter:{sites:clone(P.sites),counts:{draws:P.draws,mergedFrom:P.mergedFrom,inst:P.inst,instItems:P.instItems,buildings:P.buildings,npcs:P.npcs,things:P.things,colliders:P.colliders},roots:quarterRoots,things,ponds:clone(P.ponds)},registry,canonicalRotors,placed,ready:!!P.saplingsReady,modelAvailable:W.ranchBuilderArt.models.includes('pine_sapling_small'),rendererMemory:clone(q.renderer.info.memory)};
}
function installSaplingShaderCapture(){
 const q=window.__coldQA,materials=new Map(),wrapperBase=new WeakMap();
 const state=q.saplingShaderCapture={materials,wrapperBase,install(roots){for(const root of roots||[])root.traverse(o=>{if(!o.isMesh)return;for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(materials.has(m))continue;const callback=m.onBeforeCompile,key=m.customProgramCacheKey();let raw=callback;while(wrapperBase.has(raw))raw=wrapperBase.get(raw);const rec={name:m.name,cacheKey:key,hookSource:raw.toString(),compiled:[]};materials.set(m,rec);const wrap=function(sh,renderer){callback.call(this,sh,renderer);const entry={vertexShader:sh.vertexShader,fragmentShader:sh.fragmentShader,textureUniforms:Object.keys(sh.uniforms||{}).filter(k=>sh.uniforms[k]?.value?.isTexture).sort()};if(!rec.compiled.some(r=>r.vertexShader===entry.vertexShader&&r.fragmentShader===entry.fragmentShader))rec.compiled.push(entry);};wrapperBase.set(wrap,raw);m.onBeforeCompile=wrap;m.customProgramCacheKey=()=>key;m.needsUpdate=true;}});}};
 state.install(q.G.quartersPkg.saplings);
}
const QUARTER_MARKERS=['q:amber:lodge','q:amber:office','q:amber:pond','q:amber:tower','q:willow:boathouse','q:willow:eelhouse','q:willow:mere','q:frost:bunk','q:frost:store','q:frost:bell','q:frost:hole','q:ochre:post','q:ochre:barn','q:ochre:tank'];
const ROTOR_SHAPES=[{role:'world-vistas:FAN',registryIndex:201,root:{name:'',type:'Mesh'},solidParts:37,meshes:1,entries:37},{role:'ranch:windmill:0',registryIndex:158,root:{name:'Mill | rotating sails',type:'Group'},solidParts:2,meshes:18,entries:58},{role:'ranch:windmill:1',registryIndex:160,root:{name:'Mill | rotating sails',type:'Group'},solidParts:2,meshes:18,entries:58}];
const MOVING_SOLIDS=new Map([[37,['Scenery | sewn touring balloon',129]],[38,['Scenery | sewn touring balloon',129]],[39,['Scenery | sewn touring balloon',129]],[193,['Scenery | clinker-built passenger ferry',67]],[206,['Scenery | clinker-built rowing skiff',64]],[207,['Scenery | clinker-built rowing skiff',64]],[208,['Scenery | clinker-built rowing skiff',64]],[279,['Scenery | clinker-built rowing skiff',64]]]);
function stableQuarter(quarter){
 const copy=JSON.parse(JSON.stringify(quarter)),smoke=copy.roots.filter(r=>r.index===116&&r.name==='Settlement | soft chimney plume');
 assert.equal(smoke.length,1,'One authored quarter chimney plume is required');
 assert.equal(smoke[0].index,116);assert.equal(smoke[0].type,'Mesh');
 assert.equal(smoke[0].geometry.attributes.puffLife.count,18);assert.equal(smoke[0].geometry.attributes.puffLife.itemSize,1);assert.equal(smoke[0].geometry.attributes.puffLife.type,'Float32Array');
 // These two buffers are authored per-frame smoke, not placement or geometry.
 delete smoke[0].instanceHash;delete smoke[0].geometry.attributes.puffLife.hash;
 copy.things=copy.things.filter(t=>typeof t.id==='string'&&t.id.startsWith('q:'));
 assert.deepEqual(copy.things.map(t=>t.id),QUARTER_MARKERS,'Authored quarter marker membership/order changed');
 return copy;
}
function validCanonicalRotors(rotors,registry){
 return Array.isArray(rotors)&&rotors.length===ROTOR_SHAPES.length&&ROTOR_SHAPES.every(expected=>{
  const rotor=rotors.find(r=>r.role===expected.role),entry=registry?.[expected.registryIndex];
  return rotor?.registryIndex===expected.registryIndex&&rotor.solidParts.length===expected.solidParts&&rotor.parts.length===expected.meshes&&equal({name:rotor.root.name,type:rotor.root.type},expected.root)&&entry?.dynamic===false&&equal(entry.root,expected.root)&&entry.entries.length===expected.entries&&rotor.parts.every(p=>p.geometry?.attributes.position.count>0)&&rotor.parts.filter(p=>p.localMatrix===null).length===(expected.root.type==='Mesh'?1:0);
 });
}
function stableSolidRegistry(registry,rotors){
 assert(validCanonicalRotors(rotors,registry),'Animated collision phase exclusions require all three directly bound canonical definitions');
 const indices=new Set(rotors.map(r=>r.registryIndex));
 return registry.map((row,index)=>{
  if(row.dynamic){const expected=MOVING_SOLIDS.get(index);assert(expected&&row.root.name===expected[0]&&row.root.type==='Group'&&row.entries.length===expected[1],'Unexpected moving collision owner');}
  if(!row.dynamic&&!indices.has(index))return row;
  // Entry order, owners and polygon vertex counts are immutable. World-space
  // bounds, polygon coordinates and spatial hash keys follow these named owners.
  return {...row,entries:row.entries.map(e=>{assert(e.poly.length>=3&&e.poly.flat().every(Number.isFinite)&&['minX','maxX','minY','maxY','minZ','maxZ'].every(k=>Number.isFinite(e[k]))&&Array.isArray(e.keys),'Invalid animated collision bounds');return {...e,poly:{vertices:e.poly.length},keys:null,minX:null,maxX:null,minY:null,maxY:null,minZ:null,maxZ:null};})};
 });
}
function companionReferencePath(){return process.env.QA_SAPLING_FIXTURE_REFERENCE||path.join(path.dirname(process.env.QA_SAPLING_REFERENCE||path.join(out,'../sapling-before/report.json')),'../sapling-before-fixtures/fixtures.json');}
function stripAllowedCacheQueries(body,file){
 if(file==='ranch3d.html')return body.replace(/('(\.\/assets\/(?:vegetation|ranch-builder-art|features\/index)\.js))\?v=[^']*(')/g,'$1$3');
 if(file==='assets/features/index.js')return body.replace(/('\.\/world-quarters\.js)\?v=[^']*(')/g,'$1$2');
 if(file==='assets/features/world-quarters.js')return body.replace(/('\.\.\/vegetation\.js)\?v=[^']*(')/g,'$1$2');
 return body;
}
function preservedAnimatorSources(sourceReceipt){
 if(!sourceReceipt?.files?.length)return false;
 const animators=['ranch3d.html','assets/features/index.js','assets/features/world-quarters.js','assets/marsh-dressing.js','assets/features/world-vistas.js','assets/features/course-engine.js','assets/features/world.js','assets/features/season-hunts.js'];
 if(!animators.every(file=>sourceReceipt.files.some(r=>r.file===file)))return false;
 const tracked=new Set(cp.execFileSync('git',['ls-tree','-r','--name-only',reference],{cwd:ROOT,encoding:'utf8'}).trim().split('\n'));
 const mutable=new Set(['assets/ranch-builder-art.js','assets/vegetation.js']);
 return sourceReceipt.files.every(receipt=>{
  if(!tracked.has(receipt.file))return receipt.file===navigationModule;
  if(mutable.has(receipt.file))return true;
  const prior=cp.execFileSync('git',['show',reference+':'+receipt.file],{cwd:ROOT,encoding:'utf8',maxBuffer:8e6});
  const current=baseline?prior:fs.readFileSync(path.join(ROOT,receipt.file),'utf8');
  return sha(current)===receipt.rawSha256&&stripAllowedCacheQueries(current,receipt.file)===stripAllowedCacheQueries(prior,receipt.file);
 });
}
function compiledPrograms(materials){return materials.flatMap(m=>m.programs||[]);}
function programsValid(materials){const programs=compiledPrograms(materials);return programs.length>0&&programs.every(p=>p.vertexCompiled&&p.fragmentCompiled&&p.linked);}
function snowMaterialPrograms(materials,name){const material=materials.find(m=>m.name===name);return !!material&&material.programs.length>0&&material.programs.every(p=>p.features?.snow&&p.features?.originalWorldNormal&&p.vertexCompiled&&p.fragmentCompiled&&p.linked);}
function samplerDeclarationsUnchanged(materials,old){return materials.every(m=>{const prior=old.find(p=>p.id===m.id&&p.name===m.name);return !!prior&&equal([...new Set(m.programs.map(p=>p.samplerDeclarations))].sort(),[...new Set(prior.programs.map(p=>p.samplerDeclarations))].sort());});}
function saplingAcceptance(state,before,rows){
 const old=before.state.saplings,now=state.saplings,checks={},metrics={};
 const frozenMaterial=m=>{const {cacheKey,hookSource,compiled,programs,...stable}=m;return stable;};
 checks.retainedNurserySitesExact=Array.isArray(now.retained)&&now.retained.length>0&&equal(now.retained,old.retained);
 checks.allNurseryCellsExact=equal(now.cells,old.cells);
 checks.nurseryGeometryAndRootsFinite=now.cells.length>0&&now.cells.every(c=>c.rows.every(r=>r.matrix.every(Number.isFinite)&&Number.isFinite(r.determinant))&&c.geometry.attributes.position.count>0);
 checks.nurseryMaterialAlphaMapsExact=equal(now.materials.map(frozenMaterial),old.materials.map(frozenMaterial));
 checks.nurseryTexturesExact=equal(now.textures,old.textures);
 checks.quarterSitesAndMarkersExact=equal(stableQuarter(now.quarter),stableQuarter(old.quarter));
 const companion=baseline?null:JSON.parse(fs.readFileSync(companionReferencePath()));
 if(companion){assert.equal(companion.baseline,true);assert.equal(companion.reference,reference);assert.equal(companion.seed,928471);}
 const canonicalBefore=companion?.nursery.canonicalRotors||now.canonicalRotors;
 checks.canonicalRotorDefinitionsExact=validCanonicalRotors(canonicalBefore,old.registry)&&validCanonicalRotors(now.canonicalRotors,now.registry)&&equal(now.canonicalRotors,canonicalBefore);
 checks.fullStaticSolidRegistryExact=Array.isArray(now.registry)&&equal(stableSolidRegistry(now.registry,now.canonicalRotors),stableSolidRegistry(old.registry,canonicalBefore));
 checks.existingPlacedFrostTreesExact=equal(now.placed,old.placed);
 checks.settledScannedSaplings=now.ready&&now.modelAvailable&&now.cells.every(c=>c.name==='Frostpine | scanned saplings');
 checks.nurseryViewsCaptured=['nursery-front-high','nursery-back-high','nursery-approach-high','nursery-retreat-high','nursery-front-medium','nursery-front-low','nursery-front-rain','nursery-front-golden','nursery-front-night'].every(name=>rows.some(r=>r.name===name));
 const fullSceneExact=rows.every(r=>{const p=before.rows.find(o=>o.name===r.name);return!!p&&r.renderMetrics.calls===p.renderMetrics.calls&&r.renderMetrics.triangles===p.renderMetrics.triangles;});
 let budgetProof=null;if(!baseline){budgetProof=bindNurseryDiagnosticProof();checks.nurseryBudgetNativeSourcesBound=budgetProof.baselineRuntime.length>0&&budgetProof.afterRuntime.length>0;checks.actualNurseryMatchedDrawsAndTriangles=budgetProof.checks.actualNurseryDrawsAndTrianglesExact;checks.actualNurseryNativeResourcesExact=budgetProof.checks.actualNurseryResourcesExact&&budgetProof.cells===now.cells.length;}else{checks.actualNurseryMatchedDrawsAndTriangles=true;checks.actualNurseryNativeResourcesExact=true;}
 if(!baseline){checks.nurseryNativeProgramsCompiled=programsValid(now.materials);checks.nurseryRenderedSnowHook=snowMaterialPrograms(now.materials,'Builder | snow-dusted needles');checks.nurserySamplerDeclarationsUnchanged=samplerDeclarationsUnchanged(now.materials,old.materials);}
 if(!baseline&&state.saplingFixtures)Object.assign(checks,fixtureAcceptance(state.saplingFixtures,companion).checks);
 metrics.saplings={budgetProof,wholeSceneRenderDiagnostic:{exact:fullSceneExact,scope:'Whole-scene renderer includes pre-manual animation/streaming state; this exact equality is diagnostic, not the isolated nursery budget contract.',rows:rows.map(row=>{const p=before.rows.find(r=>r.name===row.name);return{name:row.name,callDelta:row.renderMetrics.calls-p.renderMetrics.calls,triangleDelta:row.renderMetrics.triangles-p.renderMetrics.triangles};}),resourceDelta:{geometries:state.worldResources.sceneGeometries-before.state.worldResources.sceneGeometries,bytes:state.worldResources.geometryBytes-before.state.worldResources.geometryBytes,textures:state.worldResources.sceneTextures-before.state.worldResources.sceneTextures},limitation:'Original aggregate receipt did not record ownership of the two initial differing geometries; their 1,357,116-byte size equals one existing Western tack pair. Additional directly bound native baseline/after censuses record identical per-stage geometry bytes/counts, material/texture counts and NPC status. No claim of exact whole-world draw/triangle equality is made.'},retained:now.retained?.length,cells:now.cells.length,instances:now.cells.reduce((n,c)=>n+c.count,0),materials:now.materials.map(m=>({name:m.name,cacheKey:m.cacheKey,variants:m.compiled.length,programs:m.programs.length,samplerDeclarations:[...new Set(m.programs.map(p=>p.samplerDeclarations))],features:m.programs.map(p=>p.features)})),textures:now.textures.length,target:state.saplingTarget,phaseExclusions:{quarterSmoke:{index:116,name:'Settlement | soft chimney plume',buffers:['instanceHash','geometry.attributes.puffLife.hash']},quarterMarkers:{ownership:'q:*',count:QUARTER_MARKERS.length,unrelatedLiveWorldThings:now.quarter.things.length-QUARTER_MARKERS.length},rotors:ROTOR_SHAPES.map(r=>({role:r.role,registryIndex:r.registryIndex,entryCount:r.entries,fields:['poly coordinates','min/max XYZ','spatial hash keys'],canonicalRootAndGeometryExact:checks.canonicalRotorDefinitionsExact})),registeredMovingOwnerIndices:[...MOVING_SOLIDS.keys()]},canonicalReference:companion?{path:companionReferencePath(),sha256:sha(fs.readFileSync(companionReferencePath()))}:null};
 return{checks,metrics};
}

// Resource ownership diagnostics allocate no Three resources and preserve every
// runtime source injection. A separate capture measures only actual nursery cells.
function captureSceneInventory(){
 const q=window.__coldQA,hash=a=>{let h=2166136261;for(const b of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^b,16777619);return(h>>>0).toString(16);},geometries=new Map(),materials=new Set(),textures=new Set();
 const ancestry=o=>{const names=[];for(let p=o;p&&p!==q.scene;p=p.parent)names.push(p.name||p.type);return names.reverse().join(' > ');};
 q.scene.updateMatrixWorld(true);q.scene.traverse(o=>{if(!o.geometry)return;const g=o.geometry;if(!geometries.has(g)){const attributes=Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,{type:a.array.constructor.name,itemSize:a.itemSize,count:a.count,bytes:a.array.byteLength,hash:hash(a.array)}])),index=g.index?{type:g.index.array.constructor.name,count:g.index.count,bytes:g.index.array.byteLength,hash:hash(g.index.array)}:null;geometries.set(g,{name:g.name,type:g.type,attributes,index,bytes:Object.values(attributes).reduce((n,a)=>n+a.bytes,0)+(index?.bytes||0),triangles:(g.index?.count||g.attributes.position.count)/3,owners:[]});}let visible=true;for(let p=o;p;p=p.parent)visible&&=p.visible!==false;geometries.get(g).owners.push({name:o.name,type:o.type,uuid:o.uuid,ancestry:ancestry(o),visible,count:o.count??1,root:o.matrixWorld.toArray(),materialNames:(Array.isArray(o.material)?o.material:[o.material]).filter(Boolean).map(m=>m.name),isSkinnedMesh:!!o.isSkinnedMesh});for(const m of(Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){materials.add(m);for(const t of Object.values(m))if(t?.isTexture)textures.add(t);for(const u of Object.values(m.uniforms||{}))if(u.value?.isTexture)textures.add(u.value);}});
 const records=[...geometries.values()];return{geometryCount:records.length,geometryBytes:records.reduce((n,g)=>n+g.bytes,0),materialCount:materials.size,textureCount:textures.size,geometries:records,npcCharacters:q.G.world.npcCharacters.stats(),dayTime:q.G.state?.().graphics?.day??null};
}
async function captureNurseryDiagnostics({target,inventorySource,saplingsSource}){
 const q=window.__coldQA,G=q.G,T=q.THREE,inventory=Function('return ('+inventorySource+')')(),saplings=Function('return ('+saplingsSource+')')(),rows=[],snapshots=[{name:'settled-world',inventory:inventory()}],cells=G.quartersPkg.saplings;
 const saved={player:q.player.pos.clone(),camera:q.camera.position.clone(),quaternion:q.camera.quaternion.clone()},sourceBuffers=()=>[q.composer.renderTarget1,q.composer.renderTarget2].map(q.read);
 async function sceneView(view,isolated=false){
  q.G.gfx.apply(view.tier||'high');q.day(.34,false);q.player.pos.set(view.eye[0],0,view.eye[2]);q.player.speed=q.player.y=q.player.vy=0;q.player.flying=false;
  if(!isolated){const render=q.renderer.render;q.renderer.render=()=>{};try{for(let i=0;i<210;i++){q.step(1/30);q.scene.onBeforeRender();}let settled=0;for(let i=0;i<180;i++){q.step(.016);settled=G.world.npcCharacters.stats().pending?0:settled+1;if(settled>=2)break;await new Promise(r=>setTimeout(r,40));}}finally{q.renderer.render=render;}}
  else q.step(0);
  q.player.mesh.visible=false;for(const t of Object.values(q.TACK||{}))if(t?.isObject3D)t.visible=false;const reins=q.scene.getObjectByName('Native leather split reins');if(reins)reins.visible=false;
  const eye=view.eye.slice(),look=view.look.slice();eye[1]+=q.groundH(eye[0],eye[2]);look[1]+=q.groundH(look[0],look[2]);q.camera.position.set(...eye);q.camera.lookAt(...look);q.scene.onBeforeRender();q.scene.updateMatrixWorld(true);
  const visible=[],beforeRender=q.scene.onBeforeRender,allow=new Set();if(isolated){q.scene.traverse(o=>visible.push([o,o.visible]));const add=o=>{for(let p=o;p;p=p.parent)allow.add(p);};for(const cell of cells)if(cell.visible)add(cell);add(q.scene.getObjectByName('Pasture terrain'));q.scene.traverse(o=>{if(o.isLight)add(o);});for(const [o,v]of visible)o.visible=allow.has(o)&&v;q.scene.onBeforeRender=()=>{};}
  const hooks=[],draws=[];q.scene.traverse(o=>{if(!o.isMesh)return;const regular=o.onBeforeRender,shadow=o.onBeforeShadow,path=[];for(let p=o;p&&p!==q.scene;p=p.parent)path.push(p.name||p.type);const ancestry=path.reverse().join(' > '),record=(kind,args)=>{const offset=kind==='shadow'?1:0,geometry=args[3+offset],material=args[4+offset],group=args[5+offset];draws.push({kind,name:o.name,ancestry,uuid:o.uuid,isNursery:cells.includes(o),material:material?.name||'',triangles:(group?.count??geometry?.drawRange?.count??Infinity)===Infinity?(geometry?.index?.count||geometry?.attributes.position.count||0)/3:(group?.count??geometry.drawRange.count)/3,instances:o.count??1,group:group?{start:group.start,count:group.count,materialIndex:group.materialIndex}:null});};o.onBeforeRender=function(...args){regular.apply(this,args);record('render',args);};o.onBeforeShadow=function(...args){shadow.apply(this,args);record('shadow',args);};hooks.push([o,regular,shadow]);});
  const info=q.renderer.info,reset=info.autoReset,samplesMs=[];info.autoReset=false;let renderMetrics,source;const pass=q.composer.passes[0],original=pass.render;pass.render=function(renderer,write,read,...rest){original.call(this,renderer,write,read,...rest);source=q.read(read);};
  try{for(let i=0;i<8;i++){draws.length=0;info.reset();const start=performance.now();q.composer.render();q.renderer.getContext().finish();if(i>=2)samplesMs.push(performance.now()-start);}renderMetrics={calls:info.render.calls,triangles:info.render.triangles,lines:info.render.lines,points:info.render.points,samplesMs,memory:{...info.memory}};
   const result={name:view.name,view,isolated,renderMetrics,draws:draws.slice(),source,buffers:sourceBuffers(),gl:q.renderer.getContext().getError(),image:q.renderer.domElement.toDataURL('image/webp',.96).split(',')[1],...(isolated?{nursery:saplings()}: {inventory:inventory()})};
   if(isolated){result.nurseryDraws=result.draws.filter(r=>r.isNursery);result.nurseryRenderedTriangles=result.nurseryDraws.reduce((n,d)=>n+d.triangles*d.instances,0);result.nurseryDrawCalls=result.nurseryDraws.length;}return result;
  }finally{pass.render=original;info.autoReset=reset;for(const [o,regular,shadow]of hooks){o.onBeforeRender=regular;o.onBeforeShadow=shadow;}q.scene.onBeforeRender=beforeRender;for(const [o,v]of visible)o.visible=v;}
 }
 try{
  for(const view of[{name:'hollow-core-high',eye:[-169,1.9,-216],look:[-151,3,-246]},{name:'hollow-thaw-high',eye:[-64,1.9,-171],look:[-115,1.6,-205]},{name:'snow-close-high',eye:[-205,1.7,-223],look:[-211,.2,-239]}]){const row=await sceneView(view);snapshots.push({name:row.name,inventory:row.inventory});delete row.inventory;rows.push(row);}
  const nx=Math.sin(target.r),nz=Math.cos(target.r),height=5.7*target.s;
  for(const tier of['high','medium','low'])for(const [pose,eye,look]of[['front',[target.x+nx*4.1,2.05,target.z+nz*4.1],[target.x,height*.55,target.z]],['back',[target.x-nx*4.1,2.05,target.z-nz*4.1],[target.x,height*.55,target.z]],['station',[-304,2,-291],[-320,3,-326]]])rows.push(await sceneView({name:'isolated-nursery-'+pose+'-'+tier,eye,look,tier},true));
  return{snapshots,rows,cells:cells.length,target,method:'Actual settled nursery cells and existing terrain/lights only; no clones, geometry/material allocation, registration or RNG calls. Full-world ownership census at settled state and the original first three Hollowpeak camera poses precedes isolation.'};
 }finally{q.player.pos.copy(saved.player);q.camera.position.copy(saved.camera);q.camera.quaternion.copy(saved.quaternion);}
}
function diagnosticAcceptance(now,old){
 const checks={diagnosticNativeReceipt:old?.baseline===true&&old.reference===reference&&old.seed===928471,diagnosticFinitePixels:now.rows.every(r=>[r.source,...r.buffers].every(b=>b&&!b.invalid)),diagnosticWebGL:now.rows.every(r=>!r.gl),nineIsolatedNurseryViews:now.rows.filter(r=>r.isolated).length===9};
 if(!checks.diagnosticNativeReceipt)return{checks};
 const stableMaterial=m=>{const {cacheKey,hookSource,compiled,programs,...stable}=m;return stable;};
 const before=old.capture;
 checks.actualNurseryDrawsAndTrianglesExact=now.rows.filter(r=>r.isolated).every(row=>{const prev=before.rows.find(r=>r.name===row.name);return !!prev&&row.renderMetrics.calls===prev.renderMetrics.calls&&row.renderMetrics.triangles===prev.renderMetrics.triangles&&row.nurseryDrawCalls===prev.nurseryDrawCalls&&row.nurseryRenderedTriangles===prev.nurseryRenderedTriangles&&equal(row.nurseryDraws.map(({uuid,...d})=>d),prev.nurseryDraws.map(({uuid,...d})=>d));});
 checks.actualNurseryResourcesExact=now.rows.filter(r=>r.isolated).every(row=>{const prev=before.rows.find(r=>r.name===row.name);return !!prev&&equal(row.nursery.cells,prev.nursery.cells)&&equal(row.nursery.textures,prev.nursery.textures)&&equal(row.nursery.materials.map(stableMaterial),prev.nursery.materials.map(stableMaterial));});
 checks.actualNurseryProgramsCompiled=now.rows.filter(r=>r.isolated).every(row=>programsValid(row.nursery.materials));
 return{checks};
}

// Diagnostic factory clones are allocated only after all matched world views,
// or in a separate pinned-baseline companion capture. They are never registered.
async function captureSaplingFixtures({captureSource,forceFallback=false,vegetationUrl}){
 const q=window.__coldQA,G=q.G,T=q.THREE,W=G.world,art=W.ranchBuilderArt;
 q.G.gfx.apply('high');q.day(.34,false);q.step(0);
 const before={colliders:JSON.stringify(W.colliders),walls:JSON.stringify(W.walls),registry:JSON.stringify(W.solidWorld.stats()),save:JSON.stringify(G.save.fresh())};
 const visibility=q.scene.children.map(o=>[o,o.visible]),background=q.scene.background,fog=q.scene.fog,player=q.player.pos.clone(),camera=q.camera.position.clone(),quaternion=q.camera.quaternion.clone();
 const collect=Function('return ('+captureSource+')')(),fixtures=[],made=[],x=-55,z=45,y=q.groundH(x,z),yaw=.37;
 const hashes={};
 async function render(name,roots,view=1){
  const deadline=performance.now()+20000;while(roots.some(root=>{let pending=false;root.traverse(o=>{if(!o.isMesh)return;for(const m of(Array.isArray(o.material)?o.material:[o.material]))for(const k of['map','alphaMap','normalMap','roughnessMap','metalnessMap','aoMap'])if(m[k]&&(!m[k].image?.width||m[k].image?.complete===false))pending=true;});return pending;})){if(performance.now()>deadline)throw Error('Fixture textures did not settle: '+name);await new Promise(r=>setTimeout(r,40));}
  q.scene.updateMatrixWorld(true);q.camera.position.set(x+view*3.7,y+1.95,z+view*3.7);q.camera.lookAt(x,y+1.42,z);q.player.pos.set(x,0,z);
  let source;const pass=q.composer.passes[0],original=pass.render;pass.render=function(renderer,write,read,...rest){original.call(this,renderer,write,read,...rest);source=q.read(read);};
  try{q.composer.render();q.renderer.getContext().finish();}finally{pass.render=original;}
  const capture=collect({roots}),row={name,capture,source,buffers:[q.composer.renderTarget1,q.composer.renderTarget2].map(q.read),gl:q.renderer.getContext().getError(),image:q.renderer.domElement.toDataURL('image/webp',.96).split(',')[1]};
  fixtures.push(row);const failed=capture.materials.flatMap(m=>m.programs.filter(p=>!p.vertexCompiled||!p.fragmentCompiled||!p.linked).map(p=>({material:m.name,...p})));
  if(failed.length||row.gl){window.__saplingFixtureFailure={name,row,failed};throw Error('Native fixture shader compile/link/WebGL failure: '+name+' '+JSON.stringify(failed.map(p=>({material:p.material,vertexCompiled:p.vertexCompiled,fragmentCompiled:p.fragmentCompiled,linked:p.linked,fragmentLog:p.fragmentLog,linkLog:p.linkLog}))));}return row;
 }
 function clone(type,ghost=false){const root=art.create(type,ghost);if(!root)throw Error('Builder fixture unavailable: '+type);root.position.set(x,y,z);root.rotation.y=yaw;root.name='QA nursery | '+type+(ghost?' ghost':'');made.push(root);q.scene.add(root);q.saplingShaderCapture.install([root]);return root;}
 try{
  for(const [o]of visibility)if(!o.isLight&&o.name!=='Pasture terrain')o.visible=false;
  q.scene.background=new T.Color('#9fb6bf');q.scene.fog=null;
  for(const [type,ghost,name]of[['frost_tree',false,'builder-frost-front'],['frost_tree',true,'builder-frost-ghost'],['sapling',false,'builder-ordinary-control'],['blossom_tree',false,'builder-blossom-control']]){
   const root=clone(type,ghost);await render(name,[root]);if(type==='frost_tree'&&!ghost)await render('builder-frost-back',[root],-1);root.visible=false;
  }
  // Render the real first-load/failure nursery foliage implementation, using one
  // retained pose relocated solely for this isolated native material fixture.
  const {plantNaturalPines}=await import(vegetationUrl||'./assets/vegetation.js?v=ranch-life-1');
  const fallback=plantNaturalPines({THREE:T,scene:q.scene,placements:[{x,z,s:.48,r:yaw}],groundH:q.groundH,species:'snowpine'});made.push(...fallback);q.saplingShaderCapture.install(fallback);await render('snowpine-fallback',[...fallback]);for(const m of fallback)m.visible=false;
  // The exact builder procedural branch is selected by a test-only failure of
  // its private scan lookup. Fresh template creation bypasses the already-ready
  // cached scan without changing the cache, models list, or loaded GLB.
  if(typeof art.__qaFreshTemplate!=='function')throw Error('Fresh builder failure fixture exposure missing');
  window.__qaSaplingBuilderFailure=true;let builderFallback;try{builderFallback=art.__qaFreshTemplate('frost_tree');}finally{window.__qaSaplingBuilderFailure=false;}
  builderFallback.position.set(x,y,z);builderFallback.rotation.y=yaw;builderFallback.name='QA nursery | builder-frost-fallback';made.push(builderFallback);q.scene.add(builderFallback);q.saplingShaderCapture.install([builderFallback]);await render('builder-frost-fallback',[builderFallback]);builderFallback.visible=false;
  // Repeated true factory clones must reuse every geometry and material after
  // the first ghost cache entry. Holding these off-scene cannot affect culling.
  const resources=roots=>{const geo=new Set(),mat=new Set(),tex=new Set();for(const root of roots)root.traverse(o=>{if(!o.isMesh)return;geo.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:[o.material])){mat.add(m);for(const t of Object.values(m))if(t?.isTexture)tex.add(t);}});return{geometries:geo.size,materials:mat.size,textures:tex.size};};
  const shared=[];for(let i=0;i<8;i++)shared.push(art.create('frost_tree',i%2===1));const combined=resources(shared),single=resources(shared.slice(0,2));hashes.factoryResourceReuse={single,combined,exact:JSON.stringify(single)===JSON.stringify(combined)};
  const scan=fixtures.find(f=>f.name==='builder-frost-front').capture,ghost=fixtures.find(f=>f.name==='builder-frost-ghost').capture;
  const baseNeedles=scan.materials.find(m=>/snow-dusted needles/.test(m.name)),ghostNeedles=ghost.materials.find(m=>/snow-dusted needles/.test(m.name));
  hashes.realGhostShader=!!baseNeedles&&!!ghostNeedles&&baseNeedles.cacheKey===ghostNeedles.cacheKey&&baseNeedles.hookSource===ghostNeedles.hookSource&&baseNeedles.alphaTest===ghostNeedles.alphaTest&&baseNeedles.side===ghostNeedles.side&&ghostNeedles.transparent&&ghostNeedles.opacity===.48&&!ghostNeedles.depthWrite;
  hashes.fallbackFailure=forceFallback?{simulated:true,settledNames:q.G.quartersPkg.saplings.map(o=>o.name),promiseSettled:true,onlyNatural:q.G.quartersPkg.saplings.every(o=>o.name==='Natural snowpine saplings')}:null;
 }finally{for(const o of made)q.scene.remove(o);for(const [o,v]of visibility)o.visible=v;q.scene.background=background;q.scene.fog=fog;q.player.pos.copy(player);q.camera.position.copy(camera);q.camera.quaternion.copy(quaternion);}
 const unchanged={colliders:before.colliders===JSON.stringify(W.colliders),walls:before.walls===JSON.stringify(W.walls),registry:before.registry===JSON.stringify(W.solidWorld.stats()),save:before.save===JSON.stringify(G.save.fresh())};
 const checks={fixtureWorldPreserved:Object.values(unchanged).every(Boolean),fixtureFinitePixels:fixtures.every(f=>[f.source,...f.buffers].every(p=>p&&!p.invalid)),fixtureWebGL:fixtures.every(f=>!f.gl),realGhostShader:hashes.realGhostShader,factoryResourceReuse:hashes.factoryResourceReuse.exact,allFactoryControls:fixtures.length===7};
 {const afterSnow=fixtures.filter(f=>['builder-frost-front','builder-frost-ghost','builder-frost-fallback','snowpine-fallback'].includes(f.name)).flatMap(f=>f.capture.materials.filter(m=>/snow-dusted needles|leaf sprays|leaves-snowpine/.test(m.name)));hashes.actualSnowPrograms=afterSnow.map(m=>({name:m.name,programs:m.programs.map(p=>({samplers:p.samplerDeclarations,features:p.features}))}));}
 if(forceFallback)checks.actualFailureKeepsNaturalNursery=hashes.fallbackFailure.onlyNatural;
 return{method:'Real ranchBuilderArt.create factory clones/ghost and real plantNaturalPines snowpine foliage at one fixed isolated camera. No collider registration, decor placement, save edits or world RNG influence before matched views.',forceFallback,unchanged,checks,resources:hashes,fixtures};
}
function fixtureAcceptance(now,old){
 const checks={},stableMaterial=m=>{const {cacheKey,hookSource,compiled,programs,...stable}=m;return stable;};
 checks.nativeFixtureReceipt=!!now&&!!old&&old.baseline===true&&old.reference===reference;
 if(!now||!old)return{checks};
 const before=old.capture;
 checks.allNativeFixturesPassed=Object.values(now.checks).every(Boolean)&&Object.values(before.checks).every(Boolean);
 checks.fixtureGeometryAlphaAndTexturesExact=now.fixtures.length===before.fixtures.length&&now.fixtures.every(row=>{const prev=before.fixtures.find(f=>f.name===row.name);return!!prev&&equal(row.capture.cells,prev.capture.cells)&&equal(row.capture.textures,prev.capture.textures)&&equal(row.capture.materials.map(stableMaterial),prev.capture.materials.map(stableMaterial));});
 checks.ordinaryBlossomShadersExact=['builder-ordinary-control','builder-blossom-control'].every(name=>{const a=now.fixtures.find(f=>f.name===name),b=before.fixtures.find(f=>f.name===name);return!!a&&!!b&&equal(a.capture.materials.map(m=>({name:m.name,cacheKey:m.cacheKey,hookSource:m.hookSource,compiled:m.compiled})),b.capture.materials.map(m=>({name:m.name,cacheKey:m.cacheKey,hookSource:m.hookSource,compiled:m.compiled})));});
 checks.fixtureNativeProgramsCompiled=now.fixtures.every(f=>programsValid(f.capture.materials));
 checks.fixtureSamplerDeclarationsUnchanged=now.fixtures.every(f=>samplerDeclarationsUnchanged(f.capture.materials,before.fixtures.find(p=>p.name===f.name).capture.materials));
 checks.factoryRenderedSnowHooks=[['builder-frost-front','Builder | snow-dusted needles'],['builder-frost-back','Builder | snow-dusted needles'],['builder-frost-ghost','Builder | snow-dusted needles'],['snowpine-fallback','leaves-snowpine'],['builder-frost-fallback','Builder | leaf sprays']].every(([fixture,name])=>snowMaterialPrograms(now.fixtures.find(f=>f.name===fixture).capture.materials,name));
 checks.snowpineFoliageFeaturesPreserved=now.fixtures.find(f=>f.name==='snowpine-fallback').capture.materials.find(m=>m.name==='leaves-snowpine').programs.every(p=>['foliageAlbedo','foliageAlphaFade','foliageDoubleSide','foliageTransmission','instanced'].every(k=>p.features[k]));
 return{checks};
}

function nativeSourceReceiptAudit(receipt,{pinned=false,fixtureMode=false,required=pinned?files:moduleFiles,readSource}={}){
 assert(receipt?.files?.length,'Native runtime source receipt is missing');const seen=new Set(),audit=[];
 for(const r of receipt.files){assert(r.file&&!path.isAbsolute(r.file)&&!r.file.split('/').includes('..')&&!seen.has(r.file),'Unsafe or duplicate runtime receipt path');seen.add(r.file);const raw=readSource?readSource(r.file):pinned?cp.execFileSync('git',['show',reference+':'+r.file],{cwd:ROOT,encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(path.join(ROOT,r.file),'utf8'),rawHash=sha(raw),executedHash=sha(auditedSource(raw,r.file,fixtureMode));assert.equal(rawHash,r.rawSha256,'Captured production body changed: '+r.file);assert.equal(executedHash,r.executedSha256,'Captured source injection changed: '+r.file);assert(r.browserSha256?.length&&r.browserSha256.every(h=>h===executedHash),'Native browser body mismatch: '+r.file);audit.push({file:r.file,rawSha256:rawHash,executedSha256:executedHash});}
 for(const file of required)assert(seen.has(file),'Required native runtime receipt missing: '+file);return audit;
}
function bindNurseryDiagnosticProof(){
 const beforePath=path.resolve(process.env.QA_SAPLING_DIAGNOSTIC_REFERENCE||path.join(out,'../sapling-before-diagnostics/diagnostics.json')),afterPath=path.resolve(process.env.QA_SAPLING_DIAGNOSTIC_AFTER||path.join(out,'../sapling-after-diagnostics/diagnostics.json'));
 const oldBytes=fs.readFileSync(beforePath),newBytes=fs.readFileSync(afterPath),old=JSON.parse(oldBytes),now=JSON.parse(newBytes);
 assert(old.baseline===true&&now.baseline===false&&old.reference===reference&&now.reference===reference&&old.seed===928471&&now.seed===928471,'Nursery budget references must be matched native captures');
 assert.equal(old.captureStage,'native-resource-ownership-and-actual-nursery-budget');assert.equal(now.captureStage,old.captureStage);assert.equal(now.routeReplay,old.routeReplay);
 assert(Object.values(old.checks).every(Boolean)&&Object.values(now.checks).every(Boolean)&&!old.errors.length&&!now.errors.length,'Native nursery budget capture failed');
 const baselineRuntime=nativeSourceReceiptAudit(old.sourceReceipt,{pinned:true}),afterRuntime=nativeSourceReceiptAudit(now.sourceReceipt),result=diagnosticAcceptance(now.capture,old);
 const views=now.capture.rows.filter(r=>r.isolated),names=['high','medium','low'].flatMap(tier=>['front','back','station'].map(pose=>'isolated-nursery-'+pose+'-'+tier));assert.deepEqual(views.map(r=>r.name),names);
 const images=[];for(const [kind,receipt,folder]of[['baseline',old,path.dirname(beforePath)],['after',now,path.dirname(afterPath)]])for(const row of receipt.capture.rows){assert(/^[a-z0-9-]+$/.test(row.name));const file=path.join(folder,row.name+'.webp');images.push({kind,file,sha256:sha(fs.readFileSync(file))});}
 return{checks:result.checks,beforePath,afterPath,beforeSha256:sha(oldBytes),afterSha256:sha(newBytes),baselineRuntime,afterRuntime,images,cells:now.capture.cells,rows:views.map(row=>({name:row.name,before:old.capture.rows.find(p=>p.name===row.name).renderMetrics,after:row.renderMetrics,nurseryDrawCalls:row.nurseryDrawCalls,nurseryRenderedTriangles:row.nurseryRenderedTriangles})),worldInventories:now.capture.snapshots.map(row=>{const prior=old.capture.snapshots.find(p=>p.name===row.name);return{name:row.name,before:{geometries:prior.inventory.geometryCount,bytes:prior.inventory.geometryBytes,materials:prior.inventory.materialCount,textures:prior.inventory.textureCount,npcs:prior.inventory.npcCharacters},after:{geometries:row.inventory.geometryCount,bytes:row.inventory.geometryBytes,materials:row.inventory.materialCount,textures:row.inventory.textureCount,npcs:row.inventory.npcCharacters}};})};
}
async function recheckNativeFixtures(){
 assert.equal(baseline,false,'Fixture acceptance recheck is after-only');const input=path.resolve(process.env.QA_SAPLING_FIXTURE_RECHECK),bytes=fs.readFileSync(input),native=JSON.parse(bytes),referencePath=path.resolve(companionReferencePath()),referenceBytes=fs.readFileSync(referencePath),before=JSON.parse(referenceBytes);
 assert.equal(native.captureStage,'isolated-native-builder-fixtures');assert(native.baseline===false&&before.baseline===true&&native.reference===reference&&before.reference===reference&&native.seed===928471&&before.seed===928471,'Fixture preservation reference mismatch');assert(Object.values(native.checks).every(Boolean)&&!native.errors.length,'Original native fixture capture failed');
 const runtimeAudit=nativeSourceReceiptAudit(native.sourceReceipt,{fixtureMode:true}),baselineRuntimeAudit=nativeSourceReceiptAudit(before.sourceReceipt,{pinned:true,fixtureMode:true}),result=fixtureAcceptance(native.capture,before),images=[];fs.mkdirSync(out,{recursive:true});
 for(const row of native.capture.fixtures){assert(/^[a-z0-9-]+$/.test(row.name));const file=path.join(path.dirname(input),row.name+'.webp'),target=path.join(out,row.name+'.webp'),data=fs.readFileSync(file);if(file!==target)fs.copyFileSync(file,target);const hash=sha(data);assert.equal(sha(fs.readFileSync(target)),hash);images.push({name:row.name+'.webp',sha256:hash});}
 const checks={...native.checks,...result.checks},accepted={...native,checks,originalAcceptance:{checks:native.checks},recheckedFrom:input,recheck:{method:'CPU-only native fixture acceptance recomputation; no browser/rendering',nativeReceiptSha256:sha(bytes),referenceReceipt:referencePath,referenceReceiptSha256:sha(referenceBytes),runtimeAudit,baselineRuntimeAudit,images}};fs.writeFileSync(path.join(out,'fixtures.json'),JSON.stringify(accepted,null,2));console.log(JSON.stringify({checks,errors:native.errors,sourceFiles:runtimeAudit.length,images:images.length}));assert(Object.values(checks).every(Boolean),'Native fixture acceptance recheck failed');
}

function stableRouteClearance(value){
 const copy=JSON.parse(JSON.stringify(value));
 for(const route of Object.values(copy.clearance||{}))if(route?.stats)delete route.stats.elapsedMs;
 return copy;
}
// Reconstruct exactly the read-only source injections used in the native run.
// Runtime file hashes and browser-executed hashes must both remain identical.
function auditedSource(body,file,fixtureMode=fixtureOnly){
 const add=(marker,prefix)=>{assert.equal(body.split(marker).length-1,1,'Native audit marker changed: '+file);body=body.replace(marker,prefix+marker);};
 if(file==='assets/world-photoscans.js')add('state.treePositions=trees.map','state.__coldAudit={trees,treeMeshes,treeCards};');
 if(file==='assets/terrain-realism.js')add('Object.assign(sh.uniforms, uniforms);','material.userData.__coldShaders=material.userData.__coldShaders||[];material.userData.__coldShaders.push(sh);');
 if(file==='assets/features/world-paths.js'){
  add('const TRACKS=[];',`window.__coldSolids={colliders:JSON.parse(JSON.stringify(W.colliders)),walls:JSON.parse(JSON.stringify(W.walls))};`);
  add('const pathTimber=',`P.__propsAudit={BAT,SIGNS};`);
 }
 if(file==='assets/features/world-quarters.js')add('  P.saplings=plantNaturalPines(', '  P.__saplingAudit={placements:sap.map(p=>({...p})),rngState:_rs};\n');
 if(file==='assets/features/world-quarters.js')add("   if(!W.ranchBuilderArt.models.includes('pine_sapling_small'))return;","   if(window.__qaSaplingFallbackFailure)return;\n");
 if(file==='assets/ranch-builder-art.js'&&fixtureMode){add('  const src=scans.get(id);',"  if(window.__qaSaplingBuilderFailure&&id==='pine_sapling_small')return false;\n");add(' return Object.assign(state,{create,materials:'," state.__qaFreshTemplate=type=>createTemplate(type);\n");}
 if(file==='assets/solid-collisions.js')add(' return {register,registerParts,unregister,resolve,limitVertical,', ` window.__qaSolidOwnerIndex=root=>[...owners.keys()].indexOf(root);window.__qaSolidOwners=()=>[...owners].map(([root,entries])=>({root:{name:root.name,type:root.type},dynamic:moving.has(root),entries:entries.map(e=>({owner:{name:e.owner.name,type:e.owner.type},poly:e.poly.map(p=>p.slice()),minY:e.minY,maxY:e.maxY,minX:e.minX,maxX:e.maxX,minZ:e.minZ,maxZ:e.maxZ,keys:e.keys.slice()}))}));\n`);
 if(file==='ranch3d.html')add('const MERGE_STATS=mergeStatics();',`window.__coldQA={THREE,scene,camera,renderer,composer,G,player,groundH,terrainH,TACK,keys,windmills,step(dt){manualStepping=true;tick(dt)},day(t=.34,rain=false){dayT=t;weather.mode=rain?'rain':'clear';weather.timer=99999}};`);
 return body;
}
async function recheckNativeCapture(){
 assert.equal(baseline,false,'An offline after recheck cannot be run in baseline mode');
 const input=path.resolve(process.env.QA_SAPLING_RECHECK),bytes=fs.readFileSync(input),report=JSON.parse(bytes);
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
 const referencePath=path.resolve(process.env.QA_SAPLING_REFERENCE||path.join(out,'../sapling-before/report.json'));
 const referenceBytes=fs.readFileSync(referencePath),before=JSON.parse(referenceBytes);
 assert.equal(before.baseline,true,'Preservation reference must be an actual native baseline');assert.equal(before.reference,reference);
 const result=await acceptCapture({state:report.state,rows:report.rows,errors:report.errors,sourceMatches:true,sourceReceipt:report.sourceReceipt});
 fs.mkdirSync(out,{recursive:true});const images=[];
 for(const row of report.rows){
  assert(/^[a-z0-9-]+$/.test(row.name),'Unsafe image row name');
  const source=path.join(path.dirname(input),row.name+'.webp'),target=path.join(out,row.name+'.webp'),data=fs.readFileSync(source),hash=sha(data);
  if(path.resolve(source)!==path.resolve(target))fs.copyFileSync(source,target);
  assert.equal(sha(fs.readFileSync(target)),hash,'Native image changed during recheck: '+row.name);
  images.push({name:row.name+'.webp',sha256:hash});
 }
 const final={...report,...result,originalAcceptance:{checks:report.checks,metrics:report.metrics},recheckedFrom:input,
  recheck:{method:'CPU-only acceptance recomputation; no browser/rendering',excludedTimingFields:['state.routeClearance.clearance.*.stats.elapsedMs'],phaseExclusions:result.metrics.saplings.phaseExclusions,canonicalReference:result.metrics.saplings.canonicalReference,nativeReportSha256:sha(bytes),nativeCapturedGitHead:report.gitHead,validationGitHead:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),referenceReport:referencePath,referenceReportSha256:sha(referenceBytes),runtimeAudit:audit,images}};
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
 if(process.env.QA_SAPLING_MAX_DRAW_DELTA)checks.drawBudget=rows.every(r=>{const b=before.rows.find(b=>b.name===r.name);return b?r.renderMetrics.calls<=b.renderMetrics.calls+Number(process.env.QA_SAPLING_MAX_DRAW_DELTA):!!r.view.diagnostic;});
 if(process.env.QA_SAPLING_MAX_TRIANGLE_DELTA)checks.triangleBudget=rows.every(r=>{const b=before.rows.find(b=>b.name===r.name);return b?r.renderMetrics.triangles<=b.renderMetrics.triangles+Number(process.env.QA_SAPLING_MAX_TRIANGLE_DELTA):!!r.view.diagnostic;});
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
 const clone=v=>JSON.parse(JSON.stringify(v));
 const quarter={sites:[{x:1,z:2}],counts:{things:14},ponds:[],roots:[{index:0,name:'Other geometry',matrix:[1,2],instanceHash:'fixed',geometry:{attributes:{position:{hash:'fixed'}}}},{index:116,name:'Settlement | soft chimney plume',type:'Mesh',matrix:[3,4],instanceHash:'smoke-a',geometry:{attributes:{position:{hash:'plane'},puffLife:{count:18,itemSize:1,type:'Float32Array',hash:'life-a'}}}}],things:[...QUARTER_MARKERS.map((id,index)=>({index:119+index,id,kind:'door',x:index,z:2,root:{matrix:[1,2]}})),{index:30,id:'live-bottle',kind:'bottle',root:{matrix:[0,1]}}]};
 const phase=clone(quarter);phase.roots[1].instanceHash='smoke-b';phase.roots[1].geometry.attributes.puffLife.hash='life-b';phase.things.at(-1).root.matrix=[9,8];assert(equal(stableQuarter(quarter),stableQuarter(phase)));
 for(const mutate of[q=>q.roots[0].matrix[0]++,q=>q.roots[1].matrix[0]++,q=>q.roots[1].geometry.attributes.position.hash='changed',q=>q.things[0].x++]){const changed=clone(quarter);mutate(changed);assert(!equal(stableQuarter(quarter),stableQuarter(changed)));}
 {const changed=clone(quarter);changed.things.splice(0,1);assert.throws(()=>stableQuarter(changed));}
 {const changed=clone(quarter);changed.roots[1].geometry.attributes.puffLife.count=19;assert.throws(()=>stableQuarter(changed));}
 const proxy={owner:{name:'Authored part',type:'Mesh'},poly:[[0,0],[1,0],[0,1]],minX:0,maxX:1,minY:0,maxY:1,minZ:0,maxZ:1,keys:['0,0']},registry=Array.from({length:280},()=>({root:{name:'Static root',type:'Mesh'},dynamic:false,entries:[clone(proxy)]}));
 const rotors=ROTOR_SHAPES.map(shape=>{registry[shape.registryIndex]={root:clone(shape.root),dynamic:false,entries:Array.from({length:shape.entries},()=>clone(proxy))};return{role:shape.role,registryIndex:shape.registryIndex,root:{...shape.root,position:[1,2,3],scale:[1,1,1],rotationX:0,rotationY:0},solidParts:Array.from({length:shape.solidParts},()=>({matrix:[1,2,3],min:[0,0,0],max:[1,1,1]})),parts:Array.from({length:shape.meshes},(_,index)=>({localMatrix:shape.root.type==='Mesh'&&index===0?null:[1,2,3],geometry:{attributes:{position:{count:3,hash:'geometry'}}}}))};});
 for(const [index,[name,count]] of MOVING_SOLIDS)registry[index]={root:{name,type:'Group'},dynamic:true,entries:Array.from({length:count},()=>clone(proxy))};
 const spinning=clone(registry);for(const shape of ROTOR_SHAPES){spinning[shape.registryIndex].entries[0].poly[0][0]=42;spinning[shape.registryIndex].entries[0].minX=-40;spinning[shape.registryIndex].entries[0].keys=['new','cell'];}spinning[279].entries[0].maxY=8;
 assert(equal(stableSolidRegistry(registry,rotors),stableSolidRegistry(spinning,rotors)));
 for(const mutate of[r=>r[2].entries[0].minX++,r=>r[201].entries[0].owner.name='Other owner',r=>r[158].entries[0].poly.push([2,3])]){const changed=clone(registry);mutate(changed);assert(!equal(stableSolidRegistry(registry,rotors),stableSolidRegistry(changed,rotors)));}
 {const changed=clone(registry);changed[4].dynamic=true;assert.throws(()=>stableSolidRegistry(changed,rotors));}
 {const changed=clone(rotors);changed[0].registryIndex=202;assert.throws(()=>stableSolidRegistry(registry,changed));}
 {const changed=clone(rotors);changed[1].parts[0].geometry.attributes.position.hash='changed';assert(!equal(changed,rotors));}
 const body="import {x} from './assets/vegetation.js?v=old';\nconst rotorSpeed=.7;",cached=body.replace('v=old','v=new');assert.equal(stripAllowedCacheQueries(body,'ranch3d.html'),stripAllowedCacheQueries(cached,'ranch3d.html'));assert.notEqual(stripAllowedCacheQueries(body,'ranch3d.html'),stripAllowedCacheQueries(cached.replace('.7','.8'),'ranch3d.html'));
 const materials=[{id:0,name:'Needles',programs:[{vertexCompiled:true,fragmentCompiled:true,linked:true,samplerDeclarations:30,features:{snow:true,originalWorldNormal:true}}]}];assert(programsValid(materials));assert(snowMaterialPrograms(materials,'Needles'));assert(samplerDeclarationsUnchanged(materials,materials));
 {const changed=clone(materials);changed[0].programs[0].linked=false;assert(!programsValid(changed));assert(!snowMaterialPrograms(changed,'Needles'));}
 {const changed=clone(materials);changed[0].programs[0].features.originalWorldNormal=false;assert(!snowMaterialPrograms(changed,'Needles'));}
 {const changed=clone(materials);changed[0].programs[0].samplerDeclarations++;assert(!samplerDeclarationsUnchanged(changed,materials));}
 const measured={name:'isolated-nursery-front-high',isolated:true,renderMetrics:{calls:4,triangles:600},nurseryDrawCalls:2,nurseryRenderedTriangles:500,nurseryDraws:[{uuid:'run-a',kind:'render',name:'twig',triangles:250,instances:2}],source:{invalid:0},buffers:[{invalid:0}],gl:0,nursery:{cells:[{name:'Twig cell',geometry:{attributes:{position:{count:3,hash:'fixed'}}}}],textures:[{id:0}],materials:clone(materials)}},budgetBefore={baseline:true,reference,seed:928471,capture:{rows:Array.from({length:9},(_,i)=>({...clone(measured),name:'fixture-'+i})),checks:{passed:true}}},budgetNow=clone(budgetBefore.capture);assert(diagnosticAcceptance(budgetNow,budgetBefore).checks.actualNurseryDrawsAndTrianglesExact);assert(diagnosticAcceptance(budgetNow,budgetBefore).checks.actualNurseryResourcesExact);assert(diagnosticAcceptance(budgetNow,budgetBefore).checks.actualNurseryProgramsCompiled);
 for(const mutate of[r=>r.renderMetrics.calls++,r=>r.nurseryDrawCalls++,r=>r.nurseryDraws[0].triangles++]){const changed=clone(budgetNow);mutate(changed.rows[0]);assert(!diagnosticAcceptance(changed,budgetBefore).checks.actualNurseryDrawsAndTrianglesExact);}
 {const changed=clone(budgetNow);changed.rows[0].nursery.cells[0].geometry.attributes.position.hash='altered';assert(!diagnosticAcceptance(changed,budgetBefore).checks.actualNurseryResourcesExact);}
 {const changed=clone(budgetNow);changed.rows[0].nursery.materials[0].programs[0].fragmentCompiled=false;assert(!diagnosticAcceptance(changed,budgetBefore).checks.actualNurseryProgramsCompiled);}
 const source='export const value=1;',sourceReceipt={files:[{file:'assets/qa-fixture.mjs',rawSha256:sha(source),executedSha256:sha(source),browserSha256:[sha(source)]}]},options={required:[],readSource:()=>source};assert.equal(nativeSourceReceiptAudit(sourceReceipt,options).length,1);
 for(const field of['rawSha256','executedSha256','browserSha256']){const changed=clone(sourceReceipt);changed.files[0][field]=field==='browserSha256'?['bad']:'bad';assert.throws(()=>nativeSourceReceiptAudit(changed,options));}
 assert.throws(()=>nativeSourceReceiptAudit(sourceReceipt,{...options,readSource:()=>source+'changed'}));assert.throws(()=>nativeSourceReceiptAudit(sourceReceipt,{...options,required:['assets/missing.mjs']}));
 console.log('Sapling QA CPU regressions passed: authored quarter placements/14 markers, exact smoke buffer phase exceptions, directly bound three rotors, collision shape/order and unknown-owner rejection, cache-only source edits, native GLSL compile/snow/sampler gates, plus retained roadside collision and triangle-crossing checks. No browser launched.');
}
async function acceptCapture({state,rows,errors,sourceMatches,sourceReceipt}){
 const checks={sourcesMatchWorkingTree:sourceMatches,finitePixels:rows.every(r=>[r.source,...r.buffers].every(b=>!b.invalid)),opaqueWorld:rows.every(r=>r.source.minAlpha>=1-1/2048),validWebGL:rows.every(r=>!r.gl),noErrors:!errors.length&&!state.errors.length,mountedBothDirections:state.rides.every(r=>r.complete&&r.finite&&!r.stalled&&r.maxGroundError<.1&&r.minCameraHeight>.1&&r.maxDeviation<1.5),ridgeStopsHorse:state.ridgeStop.relief<3.2&&state.ridgeStop.barrierDistance<1.8,clearAlpineSnow:rows.every(r=>r.grass.length===0),clearWinterCore:rows.every(r=>r.coldGrass.length===0),noWinterFlowers:rows.every(r=>r.winterFlowers.length===0),snowSourceResolution:rows.every(r=>{const s=r.resources.find(r=>r.key==='terrainSnow');return s?.width===2048&&s?.height===2048}),lodMatricesMatch:rows.every(r=>r.lodCount>2000&&!r.lodMismatch),treeBudget:rows.every(r=>r.treeTriangles<=r.treeBudget&&r.activeTrees<=12),rootedTrees:state.treeAudit.every(t=>Math.abs(t.bottomY-t.groundY+.07)<1e-8),validHeights:state.treeAudit.every(t=>Object.values(t).filter(v=>typeof v==='number').every(Number.isFinite)&&t.height>0),threeQualityTiers:rows.filter(r=>/snow-(medium|low)/.test(r.name)).length===2};
 checks.unchangedAuthoredSources=preservedAnimatorSources(sourceReceipt);
 const metrics={};{
  const before=baseline?{baseline:true,reference,state,rows}:JSON.parse(fs.readFileSync(process.env.QA_SAPLING_REFERENCE||path.join(out,'../sapling-before/report.json')));
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

 const before=baseline?{state,rows}:JSON.parse(fs.readFileSync(process.env.QA_SAPLING_REFERENCE||path.join(out,'../sapling-before/report.json')));const props=roadsideAcceptance(state,before,rows),filly=fillyAcceptance(state,before,rows),sapling=saplingAcceptance(state,before,rows);return {checks:{...checks,...props.checks,...filly.checks,...sapling.checks},metrics:{...metrics,...props.metrics,...filly.metrics,...sapling.metrics}};
}
(async()=>{
 if(process.env.QA_SAPLING_SELFTEST==='1'){runSelfTest();return;}
 if(process.env.QA_SAPLING_RECHECK){await recheckNativeCapture();return;}
 if(process.env.QA_SAPLING_FIXTURE_RECHECK){await recheckNativeFixtures();return;}
 fs.mkdirSync(out,{recursive:true});const QA=require('./qa-platform.cjs');
 if(process.env.QA_SAPLING_IDENTITY_FIRST==='1')assert(baseline,'Identity-first capture must be pinned to published baseline');
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
  if(file==='assets/features/world-quarters.js')body=inject(body,'  P.saplings=plantNaturalPines(', '  P.__saplingAudit={placements:sap.map(p=>({...p})),rngState:_rs};\n',file);
  if(file==='assets/features/world-quarters.js')body=inject(body,"   if(!W.ranchBuilderArt.models.includes('pine_sapling_small'))return;","   if(window.__qaSaplingFallbackFailure)return;\n",file);
  if(file==='assets/ranch-builder-art.js'&&fixtureOnly){body=inject(body,'  const src=scans.get(id);',"  if(window.__qaSaplingBuilderFailure&&id==='pine_sapling_small')return false;\n",file);body=inject(body,' return Object.assign(state,{create,materials:'," state.__qaFreshTemplate=type=>createTemplate(type);\n",file);}
  if(file==='assets/solid-collisions.js')body=inject(body,' return {register,registerParts,unregister,resolve,limitVertical,', ` window.__qaSolidOwnerIndex=root=>[...owners.keys()].indexOf(root);window.__qaSolidOwners=()=>[...owners].map(([root,entries])=>({root:{name:root.name,type:root.type},dynamic:moving.has(root),entries:entries.map(e=>({owner:{name:e.owner.name,type:e.owner.type},poly:e.poly.map(p=>p.slice()),minY:e.minY,maxY:e.maxY,minX:e.minX,maxX:e.maxX,minZ:e.minZ,maxZ:e.maxZ,keys:e.keys.slice()}))}));\n`,file);
  if(file==='ranch3d.html')body=inject(body,'const MERGE_STATS=mergeStatics();',`window.__coldQA={THREE,scene,camera,renderer,composer,G,player,groundH,terrainH,TACK,keys,windmills,step(dt){manualStepping=true;tick(dt)},day(t=.34,rain=false){dayT=t;weather.mode=rain?'rain':'clear';weather.timer=99999}};`,file);
  expectedBodies.set(file,body);await r.fulfill({contentType:file.endsWith('.html')?'text/html':'text/javascript',headers:{'cache-control':'no-store'},body});
 });
 await page.addInitScript(forceFallback=>{window.__qaSaplingFallbackFailure=forceFallback;let seed=928471;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};},process.env.QA_SAPLING_FORCE_FALLBACK==='1');
 await page.goto(QA.BASE+'/ranch3d.html?qa=roadside-props',{timeout:120000});await page.waitForFunction(()=>window.__coldQA?.G.horse.RIG().ready&&!document.getElementById('load'),null,{timeout:120000});
 await page.evaluate(async()=>{const q=__coldQA;q.G.save.sync(s=>{s.qualityLocked=true;s.unlocked=s.unlocked||{};for(const r of q.G.tables.REGIONS)if(r.unlock)s.unlocked[r.id]=true;});q.G.wardrobe?.closeChar();q.G.hidePanels();await q.G.photoscans.ready;await q.G.worldDetails.ready;await q.G.undergrowth.ready;await q.G.world.ranchBuilderArt.ready;await q.G.worldPkg.oasisReady;await q.G.quartersPkg?.saplingsReady;await q.G.worldPaths.roadsideReady;await new Promise(queueMicrotask);advanceTime(0);q.G.gfx.apply('high');q.day();q.fallsModule=await import('./assets/falls-landscape.js?v=alpine-range-1');q.coldModule=await import('./assets/cold-woodland.mjs?v=cold-woodland-1');
  q.read=rt=>{const w=Math.floor(rt.width),h=Math.floor(rt.height),p=new Uint16Array(w*h*4);q.renderer.readRenderTargetPixels(rt,0,0,w,h,p);let invalid=0,minAlpha=1;for(let i=0;i<p.length;i+=4){if([0,1,2].some(c=>(p[i+c]&0x7c00)===0x7c00))invalid++;minAlpha=Math.min(minAlpha,q.THREE.DataUtils.fromHalfFloat(p[i+3]));}return{invalid,minAlpha}};
 });await page.evaluate(sources=>{__coldQA.fillyTriangleCrossings=Function('return ('+sources.crossings+')')();__coldQA.captureFillySource=sources.capture;__coldQA.measureFillyFootprint=Function('return ('+sources.measure+')')();},{crossings:fillyTriangleCrossings.toString(),capture:captureFilly.toString(),measure:measureFillyFootprint.toString()});console.log('Nursery capture ready: world models, flowers, cold groves, saplings and deferred props settled');
 const state=await page.evaluate(fixtureOnly=>{const q=__coldQA,W=q.G.world,T=q.THREE;
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
  const render=q.renderer.render,rides=[],track=q.G.worldPaths.tracks.find(t=>t.id==='frostpine');q.renderer.render=()=>{};try{if(!fixtureOnly)for(const direction of[1,-1]){const pts=direction===1?track.pts:track.pts.slice().reverse(),a=pts[0];q.player.pos.set(a[0],0,a[1]);q.player.speed=q.player.y=q.player.vy=0;q.player.flying=q.player.onFoot=false;q.player.stam=1;q.G.followCam.reset();q.G.input.reset();q.G.riding.releaseAll();q.G.riding.selectGait('walk');q.keys.KeyW=true;let target=1,frames=0,maxGroundError=0,minCameraHeight=Infinity,maxDeviation=0,best=Infinity,lastProgress=0,stalled=false,finite=true;const maxFrames=Math.ceil(track.len/.9*30)+900;
   for(;frames<maxFrames&&target<pts.length;frames++){const b=pts[target],dx=b[0]-q.player.pos.x,dz=b[1]-q.player.pos.z,d=Math.hypot(dx,dz);if(d<1.15){target++;best=Infinity;lastProgress=frames;continue}if(d<best-.03){best=d;lastProgress=frames;}if(frames-lastProgress>300){stalled=true;break;}q.player.heading=Math.atan2(dx,dz);q.day();q.step(1/30);maxGroundError=Math.max(maxGroundError,Math.abs(q.player.mesh.position.y-q.groundH(q.player.pos.x,q.player.pos.z)));minCameraHeight=Math.min(minCameraHeight,q.camera.position.y-q.groundH(q.camera.position.x,q.camera.position.z));maxDeviation=Math.max(maxDeviation,q.G.worldPaths.trackDist(q.player.pos.x,q.player.pos.z,'frostpine'));finite&&=[...q.player.pos.toArray(),...q.camera.position.toArray()].every(Number.isFinite);}
   q.keys.KeyW=false;rides.push({direction,complete:target===pts.length,frames,maxGroundError,minCameraHeight,maxDeviation,stalled,finite});
  }}finally{q.renderer.render=render;q.keys.KeyW=false;}
  let ridgeStop;const oldRender=q.renderer.render;q.renderer.render=()=>{};try{if(!fixtureOnly){q.player.pos.set(-80,0,-252);q.player.speed=q.player.y=q.player.vy=0;q.player.flying=false;q.player.heading=Math.PI;q.keys.KeyW=true;for(let i=0;i<300;i++){q.day();q.step(1/30);}ridgeStop={position:q.player.pos.toArray(),relief:q.fallsModule.fallsRelief(q.player.pos.x,q.player.pos.z),barrierDistance:Math.min(...W.fallsLandscape.barriers.map(c=>Math.hypot(c.x-q.player.pos.x,c.z-q.player.pos.z)))};}}finally{q.keys.KeyW=false;q.renderer.render=oldRender;}
  return{ground,terrainAttrs,landmark,formations,preRoad:window.__coldSolids,treePositions,treeAudit,tracks:q.G.worldPaths.tracks.map(t=>({id:t.id,pts:t.pts,len:t.len})),registry:W.solidWorld.stats(),outerGeometry,outer:outer.stats,outerSites:outer.woodlandSites.length,rides,ridgeStop,errors:[...q.G.errors,...q.G.photoscans.errors,...q.G.worldDetails.errors,...q.G.undergrowth.errors]};
 },fixtureOnly||(diagnosticOnly&&process.env.QA_SAPLING_DIAGNOSTIC_REPLAY_ROUTES!=='1'));Object.assign(state,await page.evaluate(captureRoadside));assert(Array.isArray(state.benches),'Published physical benches must expose P.benches in baseline and after');{const legacy=extractLegacyBenches(state);state.nonBenchBat=legacy.nonBenchBat;state.nonBenchBatches=legacy.nonBenchBatches;state.legacyBenches=legacy.benches;}
 const footGround=await page.evaluate(benches=>benches.map(b=>{const q=window.__coldQA,c=Math.cos(b.yaw),s=Math.sin(b.yaw),feet=[];for(const lx of[-.59,.59])for(const lz of[-.20,.20]){const x=b.x+c*lx+s*lz,z=b.z-s*lx+c*lz;feet.push({local:[lx,lz],x,z,groundY:q.groundH(x,z),relativeToCentre:q.groundH(x,z)-b.y});}return{feet,feetGroundMin:Math.min(...feet.map(f=>f.groundY)),feetGroundMax:Math.max(...feet.map(f=>f.groundY)),feetRelief:Math.max(...feet.map(f=>f.groundY))-Math.min(...feet.map(f=>f.groundY))};}),state.benches);
 state.benches.forEach((b,i)=>Object.assign(b,footGround[i]));
 await page.evaluate(installSaplingShaderCapture);state.saplings=await page.evaluate(captureSaplings);
 const nativeSaplings=state.saplings.retained;assert(nativeSaplings?.length,'Retained nursery placements not captured');
 state.saplingTarget=nativeSaplings.map((p,index)=>({...p,index,distance:Math.hypot(p.x+304,p.z+291)})).sort((a,b)=>a.distance-b.distance)[0];
 console.log('Nursery receipt: retained='+nativeSaplings.length+', cells='+state.saplings.cells.length+', target='+JSON.stringify(state.saplingTarget));
 fs.writeFileSync(path.join(out,'preservation-state.json'),JSON.stringify({baseline,reference,gitHead:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),captureStage:'preservation-before-views',state},null,2));
 console.log('Preservation snapshot saved: built benches='+state.benches.length+', visible='+state.benches.filter(b=>b.visible).length+', cleared='+state.benches.filter(b=>!b.visible).length+', old circle absent='+state.benches.filter(b=>!b.collider).length+', maximum four-foot terrain relief='+Math.max(...state.benches.map(b=>b.feetRelief)).toFixed(4)+'m');
 const identitySources=await Promise.all(sourceTasks),identityReceipt={revision:baseline?reference:'working-tree',files:[...rawBodies].map(([file,body])=>({file,rawSha256:sha(body),executedSha256:sha(expectedBodies.get(file)),browserSha256:identitySources.filter(s=>s.file===file).map(s=>s.sha256)})).sort((a,b)=>a.file.localeCompare(b.file))};
 assert(moduleFiles.every(file=>identityReceipt.files.some(r=>r.file===file&&r.browserSha256.length&&r.browserSha256.every(h=>h===r.executedSha256))),'Nursery identity runtime source receipt missing or mismatched');
 fs.writeFileSync(path.join(out,'identity-first.json'),JSON.stringify({baseline,reference,seed:928471,captureStage:'settled-nursery-before-matched-views',gitHead:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),sourceReceipt:identityReceipt,state},null,2));
 if(process.env.QA_SAPLING_IDENTITY_FIRST==='1')return;
 if(diagnosticOnly){
  const capture=await page.evaluate(captureNurseryDiagnostics,{target:state.saplingTarget,inventorySource:captureSceneInventory.toString(),saplingsSource:captureSaplings.toString()});for(const row of capture.rows){fs.writeFileSync(path.join(out,row.name+'.webp'),Buffer.from(row.image,'base64'));delete row.image;}
  const browserSources=await Promise.all(sourceTasks),sourceReceipt={revision:baseline?reference:'working-tree',files:[...rawBodies].map(([file,body])=>({file,rawSha256:sha(body),executedSha256:sha(expectedBodies.get(file)),browserSha256:browserSources.filter(s=>s.file===file).map(s=>s.sha256)})).sort((a,b)=>a.file.localeCompare(b.file))};
  const checks={sourcesMatch:sourceReceipt.files.every(r=>r.browserSha256.length&&r.browserSha256.every(h=>h===r.executedSha256)),unchangedAuthoredSources:preservedAnimatorSources(sourceReceipt),noErrors:!errors.length,nativeGPU:!/swiftshader|llvmpipe|software rasterizer/i.test(state.gpu)};
  if(!baseline){const prior=JSON.parse(fs.readFileSync(process.env.QA_SAPLING_DIAGNOSTIC_REFERENCE||path.join(out,'../sapling-before-diagnostics/diagnostics.json')));Object.assign(checks,diagnosticAcceptance(capture,prior).checks);}
  const receipt={baseline,reference,seed:928471,captureStage:'native-resource-ownership-and-actual-nursery-budget',routeReplay:process.env.QA_SAPLING_DIAGNOSTIC_REPLAY_ROUTES==='1',gitHead:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),capture,sourceReceipt,checks,errors};fs.writeFileSync(path.join(out,'diagnostics.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({stage:receipt.captureStage,checks,cells:capture.cells,rows:capture.rows.length,inventories:capture.snapshots.map(s=>({name:s.name,geometries:s.inventory.geometryCount,bytes:s.inventory.geometryBytes,NPCs:s.inventory.npcCharacters})),errors}));assert(Object.values(checks).every(Boolean),'Native nursery ownership diagnostic failed');return;
 }

 async function fixtureCapture(){const vegetationImport=rawBodies.get('assets/features/world-quarters.js').match(/from\s+['"]\.\.\/(vegetation\.js[^'"]*)['"]/);assert(vegetationImport,'Actual quarters vegetation import missing');let result;try{result=await page.evaluate(captureSaplingFixtures,{captureSource:captureSaplings.toString(),forceFallback:process.env.QA_SAPLING_FORCE_FALLBACK==='1',vegetationUrl:'./assets/'+vegetationImport[1]});}catch(error){const failure=await page.evaluate(()=>window.__saplingFixtureFailure||null);if(failure){if(failure.row?.image){fs.writeFileSync(path.join(out,'fixture-failure.webp'),Buffer.from(failure.row.image,'base64'));delete failure.row.image;}fs.writeFileSync(path.join(out,'fixture-failure.json'),JSON.stringify({baseline,reference,failure,errors},null,2));}throw error;}for(const f of result.fixtures){fs.writeFileSync(path.join(out,f.name+'.webp'),Buffer.from(f.image,'base64'));delete f.image;}return result;}
 if(process.env.QA_SAPLING_FIXTURE_ONLY==='1'){
  const capture=await fixtureCapture(),loadedSources=await Promise.all(sourceTasks),sourceReceipt={revision:baseline?reference:'working-tree',files:[...rawBodies].map(([file,body])=>({file,rawSha256:sha(body),executedSha256:sha(expectedBodies.get(file)),browserSha256:loadedSources.filter(s=>s.file===file).map(s=>s.sha256)})).sort((a,b)=>a.file.localeCompare(b.file))};
  const sourcesMatch=sourceReceipt.files.every(r=>r.browserSha256.length&&r.browserSha256.every(h=>h===r.executedSha256));const receipt={baseline,reference,seed:928471,captureStage:'isolated-native-builder-fixtures',gitHead:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),capture,nursery:state.saplings,sourceReceipt,checks:{...capture.checks,sourcesMatch,nativeGPU:!/swiftshader|llvmpipe|software rasterizer/i.test(state.gpu),noErrors:!errors.length,canonicalRotorDefinitionsCaptured:state.saplings.canonicalRotors.length===3&&state.saplings.canonicalRotors.every(r=>r.registryIndex>=0&&r.solidParts.length>0)},errors};
  if(!baseline){const fixturePath=process.env.QA_SAPLING_FIXTURE_REFERENCE||path.join(out,'../sapling-before-fixtures/fixtures.json');Object.assign(receipt.checks,fixtureAcceptance(capture,JSON.parse(fs.readFileSync(fixturePath))).checks);}
  fs.writeFileSync(path.join(out,'fixtures.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({stage:receipt.captureStage,checks:receipt.checks,errors}));assert(Object.values(receipt.checks).every(Boolean),'Native nursery fixture capture failed');return;
 }

 const beforeForViews=baseline?{state}:JSON.parse(fs.readFileSync(process.env.QA_SAPLING_REFERENCE||path.join(out,'../sapling-before/report.json')));
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
 const nursery=beforeForViews.state.saplingTarget,nx=Math.sin(nursery.r),nz=Math.cos(nursery.r),height=5.7*nursery.s;
 const nurseryView=(name,side=1,options={})=>({name,eye:[nursery.x+nx*4.1*side,2.05,nursery.z+nz*4.1*side],look:[nursery.x,height*.55,nursery.z],...options});
 views.push(nurseryView('nursery-front-high'),nurseryView('nursery-back-high',-1),{name:'nursery-approach-high',horse:[nursery.x+nx*12,nursery.z+nz*12,nursery.r+Math.PI],riding:true},{name:'nursery-retreat-high',horse:[nursery.x-nx*12,nursery.z-nz*12,nursery.r],riding:true});
 for(const n of['medium','low','rain','golden','night'])views.push(nurseryView('nursery-front-'+n,1,{tier:['medium','low'].includes(n)?n:'high',rain:n==='rain',time:n==='golden'?.23:n==='night'?0:.34}));
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

 }

 state.saplings=await page.evaluate(captureSaplings);fs.writeFileSync(path.join(out,'sapling-native.json'),JSON.stringify(state.saplings,null,2));
 if(!baseline&&process.env.QA_SAPLING_WITH_FIXTURES==='1'){state.saplingFixtures=await fixtureCapture();fs.writeFileSync(path.join(out,'fixtures.json'),JSON.stringify({baseline,reference,seed:928471,captureStage:'after-matched-world-views',capture:state.saplingFixtures},null,2));}
 const browserSources=await Promise.all(sourceTasks),required=moduleFiles;
 const sourceReceipt={revision:baseline?reference:'working-tree',files:[...rawBodies].map(([file,body])=>({file,rawSha256:sha(body),executedSha256:sha(expectedBodies.get(file)),browserSha256:browserSources.filter(s=>s.file===file).map(s=>s.sha256)})).sort((a,b)=>a.file.localeCompare(b.file))};
 const sourceMatches=required.every(file=>expectedBodies.has(file)&&browserSources.some(s=>s.file===file))&&sourceReceipt.files.every(r=>r.browserSha256.length&&r.browserSha256.every(h=>h===r.executedSha256));
 if(!baseline)for(const file of files.filter(f=>!['ranch3d.html','assets/features/index.js','assets/ranch-builder-art.js','assets/vegetation.js'].includes(f))){const prior=cp.execFileSync('git',['show',reference+':'+file],{cwd:ROOT,encoding:'utf8',maxBuffer:8e6}),strip=b=>file==='assets/features/world-quarters.js'?b.replace(/('\.\.\/vegetation\.js)\?v=[^']*(')/g,'$1$2'):b;assert.equal(strip(rawBodies.get(file)),strip(prior),'Unchanged landscape source modified: '+file);} 
 const {checks,metrics}=await acceptCapture({state,rows,errors,sourceMatches,sourceReceipt});
 const report={baseline,reference,gitHead:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),checks,metrics,state,rows,browserSources,sourceReceipt,errors};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks,metrics:{benches:metrics.benches?.count,worldResources:metrics.worldResources,filly:metrics.filly,saplings:metrics.saplings},errors}));assert(Object.values(checks).every(Boolean),'Sapling snow acceptance failed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
