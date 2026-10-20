import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
const runtime=path.resolve(process.env.RANCH_TIMBER_RUNTIME_ROOT||fileURLToPath(new URL('../',import.meta.url))),root=pathToFileURL(runtime+'/'),T=await import(new URL('assets/vendor/three/build/three.module.js',root));
const moduleFile=process.env.RANCH_TIMBER_MODULE_PATH?pathToFileURL(path.resolve(process.env.RANCH_TIMBER_MODULE_PATH)):new URL('assets/ranch-painted-timber.mjs',root);
// The standalone staging path resolves its one resident geometry dependency here.
let source=fs.readFileSync(moduleFile,'utf8');source=source.replace("'./ranch-timber-joinery.mjs?v=ranch-timber-joinery-2'",JSON.stringify(new URL('assets/ranch-timber-joinery.mjs?v=ranch-timber-joinery-2',root).href));
const {createRanchPaintedTimber}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function fixture(){const map=new T.Texture(),normalMap=new T.Texture(),roughnessMap=new T.Texture(),material=new T.MeshStandardMaterial({map,normalMap,roughnessMap,roughness:.87});return {map,normalMap,roughnessMap,material,art:createRanchPaintedTimber({THREE:T,sourceMaterial:material})};}
const boxArray=b=>[...b.min.toArray(),...b.max.toArray()];
for(const [dimensions,axis,post]of[[[.15,1.1,.15],'y',true],[[.08,.14,44.5],'z',false],[[.08,.14,6.8],'z',false],[[3.35,.32,.09],'x',false]])test('inside timber chamfer keeps original bounds, identity and metre grain '+dimensions.join('x'),()=>{
 const f=fixture(),g=new T.BoxGeometry(...dimensions),mesh=new T.Mesh(g,f.material),uuid=g.uuid,params=g.parameters;g.name='Owned fixed rail';g.userData={solidParts:[{unchanged:true}]};g.computeBoundingBox();g.computeBoundingSphere();const sphere=g.boundingSphere,box=g.boundingBox;const before=boxArray(g.boundingBox);mesh.position.set(3,2,-9);mesh.rotation.set(.21,.6,.03);mesh.scale.set(.8,1.1,1.3);mesh.updateMatrixWorld(true);const matrix=mesh.matrix.clone(),world=g.boundingBox.clone().applyMatrix4(matrix);mesh.castShadow=true;
 f.art.dress(mesh,{grainAxis:axis,post});assert.equal(mesh.geometry,g);assert.equal(g.uuid,uuid);assert.equal(g.parameters,params);assert.equal(g.name,'Owned fixed rail');assert.equal(g.boundingSphere,sphere);assert.equal(g.boundingBox,box);assert.deepEqual(g.userData.solidParts,[{unchanged:true}]);assert.deepEqual(boxArray(g.boundingBox),before);assert.deepEqual(boxArray(g.boundingBox.clone().applyMatrix4(mesh.matrixWorld)),boxArray(world));assert.deepEqual(mesh.matrixWorld.toArray(),matrix.toArray());assert.equal(mesh.castShadow,true);assert.equal(mesh.receiveShadow,true);assert.equal(g.index.count/3,44);
 const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,foot=g.attributes.paintedTimberFoot,along={x:0,y:1,z:2}[axis],get=['getX','getY','getZ'];let bevel=0;
 for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i),normal=new T.Vector3().fromBufferAttribute(n,i);assert(g.boundingBox.containsPoint(v));assert.ok(Math.abs(normal.length()-1)<1e-6);assert.ok(Number.isFinite(uv.getX(i))&&Number.isFinite(uv.getY(i)));if(Math.max(Math.abs(normal.x),Math.abs(normal.y),Math.abs(normal.z))<.999)bevel++;if(Math.abs(normal.getComponent(along))<.85)assert.ok(Math.abs(uv.getX(i)-v.getComponent(along)/1.8)<1e-6,'Length UV uses the same metre pitch');assert.ok(Math.abs(foot.getX(i)-(post?v.y+dimensions[1]/2:100))<1e-6);}
 assert(bevel>40);
 const weldedEdges=new Map(),pointKey=i=>new T.Vector3().fromBufferAttribute(p,i).toArray().join(',');
 for(let face=0;face<g.index.count;face+=3){const ids=[0,1,2].map(k=>g.index.getX(face+k)),points=ids.map(i=>new T.Vector3().fromBufferAttribute(p,i)),cross=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));assert(cross.length()>1e-10);assert(cross.dot(new T.Vector3().fromBufferAttribute(n,ids[0]))>0,'Visible triangles face outward');for(let k=0;k<3;k++){const a=pointKey(ids[k]),b=pointKey(ids[(k+1)%3]),key=a<b?a+'|'+b:b+'|'+a,edge=weldedEdges.get(key)||[0,0];edge[0]++;edge[1]+=a<b?1:-1;weldedEdges.set(key,edge);}}
 for(const[count,balance]of weldedEdges.values()){assert.equal(count,2,'Closed chamfered solid');assert.equal(balance,0,'Oriented closed edge');}
 const parameters=g.userData.paintedTimber,own=g.attributes.position;f.art.dress(mesh,{grainAxis:axis,post});assert.equal(g.attributes.position,own);assert.equal(g.userData.paintedTimber,parameters);assert.equal(f.art.stats().meshes,1);f.art.dispose();g.dispose();f.material.dispose();
});
test('fixed paint shares the resident scan channels and adds no sampler or source-material ownership',()=>{
 const f=fixture(),originalColor=f.material.color.clone(),m=f.art.material;assert.notEqual(m,f.material);assert.equal(m.map,null);assert.equal(m.normalMap,f.normalMap);assert.equal(m.roughnessMap,f.roughnessMap);assert.equal(f.material.map,f.map);assert.deepEqual(f.material.color.toArray(),originalColor.toArray());assert.equal(f.material.roughness,.87);assert.equal(m.userData.paintedTimber.newSamplers,0);
 const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};m.onBeforeCompile(shader,{});assert(shader.vertexShader.includes('instanceMatrix*paintedTimberOrigin'));assert(shader.fragmentShader.includes('paintedTimberDirt'));assert(shader.fragmentShader.includes('roughnessFactor=clamp'));assert.equal((shader.fragmentShader.match(/uniform sampler/g)||[]).length,(T.ShaderLib.standard.fragmentShader.match(/uniform sampler/g)||[]).length);assert.equal(m.transparent,false);assert.equal(m.depthWrite,true);
 let sourceDisposals=0,scanDisposals=0,targetDisposals=0;f.material.addEventListener('dispose',()=>sourceDisposals++);for(const tex of[f.map,f.normalMap,f.roughnessMap])tex.addEventListener('dispose',()=>scanDisposals++);m.addEventListener('dispose',()=>targetDisposals++);f.art.dispose();f.art.dispose();assert.equal(targetDisposals,1);assert.equal(sourceDisposals,0);assert.equal(scanDisposals,0);assert.throws(()=>f.art.material,/disposed/);f.material.dispose();
});
test('all resource UUIDs remain unique without consuming ambient random draws, including failed allocation',()=>{
 const f=fixture(),a=new T.Mesh(new T.BoxGeometry(.15,1.1,.15),f.material),b=new T.Mesh(new T.BoxGeometry(.15,1.1,.15),f.material),ambient=Math.random;let calls=0;const observe=()=>{calls++;return .31;};Math.random=observe;
 try{f.art.dress(a,{grainAxis:'y',post:true});f.art.dress(b,{grainAxis:'y',post:true});assert.equal(Math.random,observe);assert.equal(calls,0);assert.notEqual(a.geometry.uuid,b.geometry.uuid);assert.notEqual(a.material.uuid,f.material.uuid);assert.equal(a.material,b.material);assert.notEqual(a.geometry.attributes.position.array,b.geometry.attributes.position.array);assert.equal(f.art.stats().templates,1);}finally{Math.random=ambient;f.art.dispose();a.geometry.dispose();b.geometry.dispose();}
 const original=f.material.clone;f.material.clone=function(){assert.notEqual(Math.random,observe);throw Error('intentional paint clone failure');};const broken=createRanchPaintedTimber({THREE:T,sourceMaterial:f.material});Math.random=observe;
 try{assert.throws(()=>broken.material,/intentional paint clone failure/);assert.equal(Math.random,observe);assert.equal(calls,0);}finally{Math.random=ambient;f.material.clone=original;broken.dispose();f.material.dispose();}
});
// Execute the real fixed construction blocks. Only resource IO/terrain are
// isolated; all post randomness, path openings, segment lengths and transforms
// come from production source rather than a duplicate fence model in this test.
const html=fs.readFileSync(new URL('ranch3d.html',root),'utf8');
function section(start,end){const a=html.indexOf(start);assert(a>=0,start);const b=html.indexOf(end,a+start.length);assert(b>a,end);return html.slice(a,b);}
const arena=section(' const postGeo=new THREE.BoxGeometry(0.15,1.1,0.15);','\n}\n/* ================= show arena detailing'),kick=section(' // white kickboard ring around the footing',' // dressage letters'),pasture=section(' const posts=[];\n for(let x=PAST.x1;',' // run-in shelter');
const sourceOptIn=/import\s*\{\s*createRanchPaintedTimber/.test(html);
if(sourceOptIn){
 assert.equal((html.match(/ranchPaintedTimber\.dress\(/g)||[]).length,5,'Exactly the five scoped fixed-owner seams');
 assert.equal((arena.match(/ranchPaintedTimber\.dress\(inst,/g)||[]).length,1);assert.equal((arena.match(/ranchPaintedTimber\.dress\(m,/g)||[]).length,1);assert.equal((kick.match(/ranchPaintedTimber\.dress\(kb,/g)||[]).length,1);assert.equal((pasture.match(/ranchPaintedTimber\.dress\(inst,/g)||[]).length,1);assert.equal((pasture.match(/ranchPaintedTimber\.dress\(m,/g)||[]).length,1);
 assert.equal((html.match(/grainTex\('#ece8db','#c9bfa8',0\.5\)/g)||[]).length,1,'Original white paint texture/RNG construction remains');
}
const {RANCH_PASTURE_GATE:GATE}=await import(new URL('assets/ranch-pasture-route.mjs',root));
function actualPieces(material,art=null){
 const objects=[],scene={add(o){objects.push(o);}},PAST={x1:-110,x2:-33,z1:-45,z2:25},NORTH_GATE={x1:-5.5,x2:-.5},groundH=(x,z)=>.13*Math.sin(x*.04)+.07*Math.cos(z*.06),box=(w,h,d,m,x,y,z,parent)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;};
 // Existing opt-in seams can be removed only for a counted independent baseline.
 const blocks=[arena,kick,pasture].map(s=>s.replace(/\s*ranchPaintedTimber\.dress\([^;]+\);/g,''));
 Function('THREE','whitePaintMat','NORTH_GATE','RANCH_PASTURE_GATE','scene',blocks[0])(T,material,NORTH_GATE,GATE,scene);
 Function('THREE','whitePaintMat','RANCH_PASTURE_GATE','scene','box',blocks[1])(T,material,GATE,scene,box);
 Function('THREE','whitePaintMat','PAST','groundH','scene',blocks[2])(T,material,PAST,groundH,scene);
 if(art)for(const mesh of objects){const d=mesh.geometry.parameters,post=mesh.isInstancedMesh;art.dress(mesh,{grainAxis:post?'y':d.width>d.depth?'x':'z',post});}
 return objects;
}
test('production arena, kickboard and pasture owners retain exact placement stream, matrices, counts and bounds',()=>{
 const f=fixture(),ambient=Math.random;function run(art){let state=9128471,draws=0;Math.random=()=>{draws++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};const objects=actualPieces(f.material,art);return {draws,state,objects};}
 let before,after;try{before=run(null);after=run(f.art);}finally{Math.random=ambient;}
 assert.equal(after.draws,before.draws);assert.equal(after.state,before.state);assert.equal(after.objects.length,before.objects.length);assert(after.objects.length>100);
 let instances=0;for(let i=0;i<before.objects.length;i++){const a=before.objects[i],b=after.objects[i];a.geometry.computeBoundingBox();b.geometry.computeBoundingBox();a.updateMatrixWorld(true);b.updateMatrixWorld(true);assert.equal(b.geometry.uuid,a.geometry.uuid);assert.deepEqual(b.position.toArray(),a.position.toArray());assert.deepEqual(b.quaternion.toArray(),a.quaternion.toArray());assert.deepEqual(b.scale.toArray(),a.scale.toArray());assert.deepEqual(b.matrix.toArray(),a.matrix.toArray());assert.deepEqual(boxArray(b.geometry.boundingBox),boxArray(a.geometry.boundingBox));assert.deepEqual(b.geometry.parameters,a.geometry.parameters);assert.equal(b.receiveShadow,true);assert.equal(b.castShadow,a.castShadow);assert.equal(b.count,a.count);if(a.isInstancedMesh){instances+=a.count;assert.deepEqual(Array.from(b.instanceMatrix.array),Array.from(a.instanceMatrix.array));}a.geometry.dispose();b.geometry.dispose();}
 assert(instances>150);assert.equal(f.material.map,f.map);console.log(JSON.stringify({sourceOptIn,fixedMeshes:before.objects.length,postInstances:instances,ambientDraws:before.draws,templates:f.art.stats().templates}));f.art.dispose();f.material.dispose();
});
