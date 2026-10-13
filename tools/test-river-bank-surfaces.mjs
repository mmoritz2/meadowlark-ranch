import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../assets/vendor/three/build/three.module.js';
import {configureRiverBanks,riverBankTerrainHeight,RIVERBANK_REACHES} from '../assets/riverbank-terrain.mjs?v=river-banks-1';
import {conformRiverBankGeometry,dressRiverBankMaterial} from '../assets/riverbank-surface.mjs?v=river-banks-1';
const fixture=new URL('./fixtures/river-bank-aprons-7908/',import.meta.url),meta=JSON.parse(readFileSync(new URL('receipt.json',fixture))),rows=JSON.parse(readFileSync(new URL('aprons.json',fixture))),buf=readFileSync(new URL('terrain-grid.f32',fixture));
const oldGrid=new Float32Array(buf.buffer,buf.byteOffset,buf.byteLength/4),step=1000/512,newGrid=new Float32Array(oldGrid);
function sample(grid,x,z){const gx=(x+500)/step,gz=(z+500)/step,ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,id=iz*513+ix,a=grid[id],b=grid[id+513],c=grid[id+514],d=grid[id+1];return fx+fz<=1?a+(d-a)*fx+(b-a)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz);}
const oldH=(x,z)=>sample(oldGrid,x,z),plan=configureRiverBanks({rawHeightAt:oldH,heightAt:oldH});
for(let iz=0;iz<513;iz++)for(let ix=0;ix<513;ix++){const id=iz*513+ix;newGrid[id]=riverBankTerrainHeight(ix*step-500,iz*step-500,oldGrid[id]);}
const groundH=(x,z)=>sample(newGrid,x,z),level=x=>.5-x*.009;
const results=[];
function make(row){const g=new T.BufferGeometry();for(const[name,a]of Object.entries(row.geometry.attributes))g.setAttribute(name,new T.Float32BufferAttribute(a.array,a.itemSize));g.setIndex(row.geometry.index);const p=g.attributes.position,u=g.attributes.uv;
 // The actual original constructor still builds these four columns; only its
 // supplied shared ground changed. This reconstructs that exact pre-adapter path.
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),y=groundH(x,z);p.setY(i,u.getY(i)===0?Math.min(y,level(x))-.05:y+.025);}g.computeVertexNormals();return new T.Mesh(g,new T.MeshStandardMaterial({transparent:true,opacity:.74,vertexColors:true,depthWrite:false,side:T.DoubleSide}));}
for(const row of rows){const mesh=make(row);mesh.name=row.name;const geometry=mesh.geometry,material=mesh.material,uuids=[mesh.uuid,geometry.uuid,material.uuid],prior=Math.random;Math.random=()=>{throw Error('Adapter UUID/gameplay randomness leak');};let stats;try{stats=conformRiverBankGeometry({THREE:T,mesh,groundHeight:groundH});}finally{Math.random=prior;}assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);assert.deepEqual([mesh.uuid,geometry.uuid,material.uuid],uuids);results.push({mesh,stats});}
const proof={profile:'river-bank-source-adapter-1',base:meta.base,referenceRows:plan.referenceRows,referenceValueBytes:plan.referenceValueBytes,surfaces:results.map(r=>r.stats)};

test('fixture binds actual native source aprons and Float32 terrain',()=>{for(const[n,h]of Object.entries(meta.files))assert.equal(createHash('sha256').update(readFileSync(new URL(n,fixture))).digest('hex'),h);assert.equal(oldGrid.length,513**2);assert(rows.every(r=>r.triangles===1596));});
test('same two source mesh, geometry and material owners retain UUIDs; no new Three constructor/RNG is needed',()=>{assert.equal(results.length,2);assert(results.every(r=>r.stats.newGeometryObjects===0&&r.stats.newDrawOwners===0));assert(results.every(r=>r.stats.conformedSourceTriangles>400));});
test('actual adapted positions are finite upward terrain-following triangles with bounded inherited skin clearance',()=>{
 for(const{mesh}of results){const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,u=mesh.geometry.attributes.uv,ix=mesh.geometry.index;let low=Infinity,high=-Infinity,covered=0;
  for(let i=0;i<ix.count;i+=3){const vs=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,ix.getX(i+k))),ab=vs[1].clone().sub(vs[0]),ac=vs[2].clone().sub(vs[0]),cross=ab.cross(ac);assert(cross.y>1e-10);assert(vs.every(v=>v.toArray().every(Number.isFinite)));
   if(!RIVERBANK_REACHES.some(([a,b])=>vs.every(v=>v.x>a+1&&v.x<b-1)))continue;
   if(Math.max(...vs.map(v=>v.x))-Math.min(...vs.map(v=>v.x))>step+.0001||Math.max(...vs.map(v=>v.z))-Math.min(...vs.map(v=>v.z))>step+.0001)continue;
   for(const v of vs){const gap=v.y-groundH(v.x,v.z);low=Math.min(low,gap);high=Math.max(high,gap);assert(gap<=.02504);}
   covered++;
  }
  assert(covered>2000);proof[mesh.name]={coveredTriangles:covered,minSkinOffset:low,maxSkinOffset:high};
  for(let i=0;i<n.count;i++)assert(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-6);assert.equal(p.count,u.count);
 }
});
test('buffer, triangle, owner and attribute budgets use actual source geometry bytes',()=>{
 for(const{mesh,stats}of results){assert.equal(stats.oldTriangles,1596);assert.equal(stats.triangles,mesh.geometry.index.count/3);assert.equal(stats.bytes,Object.values(mesh.geometry.attributes).reduce((s,a)=>s+a.array.byteLength,mesh.geometry.index.array.byteLength));assert(stats.triangles<18000&&stats.bytes<3000000);assert(stats.triangles>stats.oldTriangles,'budget must disclose the real tessellation increase');assert.deepEqual(Object.keys(mesh.geometry.attributes).sort(),['color','normal','position','uv']);}
});
test('resident soil hook constructs no textures/materials and keeps original alpha/depth/render-side policy',()=>{
 const mat=results[0].mesh.material,prior=Math.random,soil={color:{value:{image:null}},properties:{value:{image:null}},ready:{value:0}},old={opacity:mat.opacity,side:mat.side,depthWrite:mat.depthWrite,transparent:mat.transparent};Math.random=()=>{throw Error('Shader setup used gameplay randomness');};try{assert(dressRiverBankMaterial(mat,soil));}finally{Math.random=prior;}
 assert.deepEqual({opacity:mat.opacity,side:mat.side,depthWrite:mat.depthWrite,transparent:mat.transparent},old);const sh={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};mat.onBeforeCompile(sh);assert.equal(sh.uniforms.riverSoilColor,soil.color);assert.equal(sh.uniforms.riverSoilProperties,soil.properties);assert.notEqual(sh.uniforms.riverSoilReady,soil.ready);assert(sh.fragmentShader.includes('diffuseColor.a*=bankCanvas.a'));assert(sh.fragmentShader.includes('riverBankPosition/2.53'));assert(sh.fragmentShader.includes('weights/=max(.0001'));assert.equal(mat.customProgramCacheKey(),'river-bank-soil-skin-1');
 mat.onBeforeRender();assert.equal(sh.uniforms.riverSoilReady.value,0);soil.properties.value.image={width:1024};mat.onBeforeRender();assert.equal(sh.uniforms.riverSoilReady.value,0);soil.color.value.image={width:1024};mat.onBeforeRender();assert.equal(sh.uniforms.riverSoilReady.value,1);for(let i=0;i<500;i++)mat.onBeforeRender();assert.equal(soil.ready.value,0,'never alter shared terrain ready state');
});
test('triangle clipping preserves summed horizontal source area without duplicate overlapping surfaces',()=>{
 const horizontal=(p,ix)=>{let s=0;for(let i=0;i<ix.length;i+=3){const a=ix[i]*3,b=ix[i+1]*3,c=ix[i+2]*3;s+=Math.abs((p[b]-p[a])*(p[c+2]-p[a+2])-(p[b+2]-p[a+2])*(p[c]-p[a]))*.5;}return s;};
 for(let k=0;k<rows.length;k++){const a=horizontal(rows[k].geometry.attributes.position.array,rows[k].geometry.index),b=horizontal(results[k].mesh.geometry.attributes.position.array,results[k].mesh.geometry.index.array);assert(Math.abs(a-b)<.002,JSON.stringify({a,b}));proof.surfaces[k].horizontalAreaBefore=a;proof.surfaces[k].horizontalAreaAfter=b;}
 if(process.env.RIVER_BANK_AUDIT_OUTPUT)writeFileSync(process.env.RIVER_BANK_AUDIT_OUTPUT,JSON.stringify(proof,null,2)+'\n');
});

test('actual riverbed keeps its oneowner and depositcolors while every triangle follows true substrate, with metre-scale fallback UVs',()=>{
 const row=JSON.parse(readFileSync(new URL('bed.json',fixture))),g=new T.BufferGeometry();for(const[name,a]of Object.entries(row.geometry.attributes))g.setAttribute(name,new T.Float32BufferAttribute(a.array,a.itemSize));g.setIndex(row.geometry.index);const mat=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.88}),mesh=new T.Mesh(g,mat),ids=[mesh.uuid,g.uuid,mat.uuid],prior=Math.random;Math.random=()=>{throw Error('Bedfix UUID/randomness leak');};let stats;try{stats=conformRiverBankGeometry({THREE:T,mesh,groundHeight:groundH,full:true,offsetM:.008,worldUV:true});}finally{Math.random=prior;}assert.deepEqual([mesh.uuid,g.uuid,mat.uuid],ids);
 const p=g.attributes.position,uv=g.attributes.uv,ix=g.index;let maxVertexGapError=0,maxInteriorGapError=0,minColor=Infinity,maxColor=0;
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),error=Math.abs(p.getY(i)-groundH(x,z)-.008);maxVertexGapError=Math.max(maxVertexGapError,error);assert(Math.abs(uv.getX(i)-Math.fround(x/2.53))<.00002);assert(Math.abs(uv.getY(i)-Math.fround(z/2.53))<.00002);}
 for(let i=0;i<ix.count;i+=3){const ids=[ix.getX(i),ix.getX(i+1),ix.getX(i+2)],x=ids.reduce((s,id)=>s+p.getX(id),0)/3,y=ids.reduce((s,id)=>s+p.getY(id),0)/3,z=ids.reduce((s,id)=>s+p.getZ(id),0)/3;maxInteriorGapError=Math.max(maxInteriorGapError,Math.abs(y-groundH(x,z)-.008));}
 assert(maxVertexGapError<.00003&&maxInteriorGapError<.00003);assert(stats.triangles<32000&&stats.bytes<4000000);assert(stats.triangles>stats.oldTriangles);assert.equal(stats.oldTriangles,row.triangles);assert.equal(mesh.material,mat);assert.equal(mesh.geometry,g);
 proof.bed={...stats,maxVertexGapErrorM:maxVertexGapError,maxTriangleInteriorGapErrorM:maxInteriorGapError};if(process.env.RIVER_BANK_AUDIT_OUTPUT)writeFileSync(process.env.RIVER_BANK_AUDIT_OUTPUT,JSON.stringify(proof,null,2)+'\n');
});
