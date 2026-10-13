import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture as f} from './contour-fixture.mjs';
import {createWaterfallArt} from '../assets/waterfall-art.js';
import {clipScalar,forTerrainIntersections,sweptLowerFacets,exactSweptClearance} from './terrain-water-contact.mjs';
const {T,old,candidate:C,before,after,n,step}=f;
const waterMaterial=new T.MeshPhysicalMaterial();waterMaterial.userData.plainShader=()=>{};
function produce(source,heightAt){let randomDraws=0;const previous=Math.random;Math.random=()=>{randomDraws++;return .25;};try{const art=source.createFallsLandscape({THREE:T,scene:new T.Scene(),heightAt,terrainStep:step,waterMaterial,colliders:[],loadTextures:false});return {art,randomDraws};}finally{Math.random=previous;}}
const original=produce(old,f.oldHeight),current=produce(C,f.height);
function triangleCorners(x,z){const gx=(x+500)/step,gz=(z+500)/step,ix=Math.floor(gx),iz=Math.floor(gz),i=iz*n+ix;return gx-ix+gz-iz<=1?[i,i+n,i+1]:[i+1,i+n,i+n+1];}
function retainedCell(x,z){for(const i of triangleCorners(x,z))assert.equal(after[i],before[i],`Route support vertex changed at ${x},${z}: ${i}`);}
function contacts(mesh){const p=mesh.geometry.attributes.position,u=mesh.geometry.attributes.uv,index=mesh.geometry.index;let opaqueMin=Infinity,min=Infinity,maxDelta=0,buriedAlpha=0,triangles=0,intersections=0;
 for(let i=0;i<index.count;i+=3){const triangle=[0,1,2].map(k=>{const id=index.getX(i+k);return[p.getX(id),p.getZ(id),p.getY(id),u.getY(id),u.getX(id)];});triangles++;
  forTerrainIntersections(triangle,step,poly=>{intersections+=poly.length;for(const q of poly){min=Math.min(min,q[2]-f.height(q[0],q[1]));maxDelta=Math.max(maxDelta,Math.abs(f.height(q[0],q[1])-f.oldHeight(q[0],q[1])));}
   let core=clipScalar(poly,q=>.91-q[3]);if(mesh===current.art.stream){core=clipScalar(core,q=>q[3]-.09);core=clipScalar(core,q=>q[4]-.025);}for(const q of core)opaqueMin=Math.min(opaqueMin,q[2]-f.height(q[0],q[1]));
   for(const q of clipScalar(poly,q=>f.height(q[0],q[1])-q[2])){const t=Math.max(0,Math.min(1,(q[3]-.91)/.09));buriedAlpha=Math.max(buriedAlpha,1-t*t*(3-2*t));}
  });
 }return{opaqueMin,min,maxDelta,buriedAlpha,triangles,intersections};}
function normalizeApprovedPoolMaterial(source){return source.replace("m.opacity=name==='plunge pool'?.82:.96;m.roughness=name==='plunge pool'?.18:.16;","m.opacity=.96;m.roughness=.16;").replace("if(name==='plunge pool')patchPlungePool(sh,{x:HOLLOWPEAK.x,z:HOLLOWPEAK.z+HOLLOWPEAK.run});",'').replace("'hollowpeak-water-'+flow+(name==='plunge pool'?'-impact-wave-1':'')","'hollowpeak-water-'+flow");}
test('native baseline is exact and substantial compact terrain shaping consumes no terrain RNG',()=>{
 assert.equal(f.sha(before),'9b4147b0a6b71e34b4aedc96cc5d7361d9ea82fd299d595f155529ba69cb2220');assert.equal(f.stats.maxBaseError,0);assert.equal(f.stats.oldReconstructed,12648);assert(f.stats.changed>5000);assert(f.stats.maxChange>15&&f.stats.maxChange<32);
 for(let i=0;i<after.length;i++){assert(Number.isFinite(after[i]));const x=i%n*step-500,z=Math.floor(i/n)*step-500;if(x<=-274||x>=-32||z<=-414||z>=-214)assert.equal(after[i],before[i]);}
});
test('continuous swept-triangle fixture detects interior terrain peaks and preserves winding/lower-envelope coverage',()=>{
 const tri=[[0,0,2,.2],[4,0,2,.2],[0,4,2,.2]],facets=sweptLowerFacets(tri),reversed=sweptLowerFacets([...tri].reverse());assert.equal(facets.length,1);assert.deepEqual(facets,reversed);
 const terrain=(x,z)=>{const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,node=(x,z)=>x===1&&z===1?3:0,a=node(ix,iz),b=node(ix,iz+1),d=node(ix+1,iz),c=node(ix+1,iz+1);return fx+fz<=1?a+(d-a)*fx+(b-a)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz);};
 const proof=exactSweptClearance({position:[0,2,0,4,2,0,0,2,4],index:[0,1,2],motion:[.2,.2,.2],step:1,height:terrain});assert.equal(proof.emptyFacets,0);assert.equal(proof.min,-1,'A terrain summit between original vertices must be detected');
 const sloped=sweptLowerFacets([[0,0,1,.1],[1,0,2,.2],[0,1,1,.05]]);assert.equal(sloped.length,2);assert(sloped.every(poly=>poly.length>=3));
});
test('every entire airborne triangle and continuous lateral shader-motion bound clears the new physical grid',()=>{
 const F=C.HOLLOWPEAK,water=createWaterfallArt({THREE:T}),sheet=water.fall({x:F.x,z:F.z,top:F.top,bottom:F.level+.04,width:F.width,run:F.run}).children[0],p=sheet.geometry.attributes.position;
 const proof=exactSweptClearance({position:p.array,index:sheet.geometry.index.array,motion:sheet.geometry.attributes.cascadeMotion.array,step,height:f.height});assert.equal(proof.triangles,4608);assert.equal(proof.emptyFacets,0);assert(proof.facets>4608&&proof.clippedVertices>40000);assert(proof.min>1.05,JSON.stringify(proof));
});
test('fixed pool/tarn/channel meshes and deep opaque cores remain safe; original feather alone meets the bank',()=>{
 assert.deepEqual(C.HOLLOWPEAK,old.HOLLOWPEAK);for(const key of ['pool','tarn','stream']){const a=original.art[key].geometry,b=current.art[key].geometry;for(const k of Object.keys(a.attributes))assert.equal(f.sha(a.attributes[k].array),f.sha(b.attributes[k].array));assert.equal(f.sha(a.index.array),f.sha(b.index.array));}
 const pool=contacts(current.art.pool),tarn=contacts(current.art.tarn),stream=contacts(current.art.stream);assert.equal(pool.triangles,3360);assert.equal(tarn.triangles,3360);assert.equal(stream.triangles,2112);assert(pool.opaqueMin>.19&&tarn.opaqueMin>.14&&stream.opaqueMin>.8);assert(stream.min>.70);assert(pool.min>-.216&&tarn.min>-.282,'Outer feather burial cannot exceed the baseline bounds');assert(pool.maxDelta<.12&&tarn.maxDelta<.22&&stream.maxDelta<.65);assert(pool.buriedAlpha<.49&&tarn.buriedAlpha<.74,'No new fully opaque bank interference');
 for(const basin of [C.HOLLOWPEAK.pool,C.HOLLOWPEAK.tarn])assert(Math.abs(f.height(basin.x,basin.z)-(basin.level-1.5))<.04,'Fixed centre depth remains1.5m');
});
test('actual protected Frostpine route and three-metre riding corridor retain physical grid contacts',()=>{
 const route=[[-160,-215],[-173.0439,-225.4024],[-187.0279,-235.9788],[-200.6802,-244.8582],[-260,-280]];
 for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/length,nz=(b[0]-a[0])/length;for(let t=0;t<=1;t+=.005)for(const offset of [-3,0,3])retainedCell(a[0]+(b[0]-a[0])*t+nx*offset,a[1]+(b[1]-a[1])*t+nz*offset);}
 for(const [x,z]of [[-303,-319],[-292,-326],[-288,-310],[-280,-328],[-169,-186],[-92,-173]])assert.equal(f.height(x,z),f.oldHeight(x,z));
});
test('actual west/east frontal slopes develop unequal middle-height ledges beyond colour or cross-ridge changes',()=>{
 function bench(x,height){let peak=0;for(let z=-290;z< -227;z+=.1)peak=Math.max(peak,height(x,z));let run=0,longest=0;for(let z=-290;z< -227;z+=.1){const h=height(x,z),grade=Math.abs((height(x,z+.05)-height(x,z-.05))/.1);run=h>6&&h<peak*.82&&grade<.4?run+.1:0;longest=Math.max(longest,run);}return longest;}
 assert(bench(-184,f.height)>5);assert(bench(-184,f.oldHeight)<1);assert(bench(-118,f.height)>7);assert(bench(-118,f.oldHeight)<1.5);
});
test('grounded mineral/shadow share the actual walkable grid, bounded scene resources and current cliff barriers',()=>{
 const a=original.art,b=current.art;assert.equal(a.group.children.length,5);assert.equal(b.group.children.length,5);assert.equal(original.randomDraws,current.randomDraws);assert.equal(a.shadow.geometry.index.count,b.shadow.geometry.index.count);
 for(const name of ['rock','shadow']){const ap=a[name].geometry.attributes.position,bp=b[name].geometry.attributes.position;assert.equal(ap.count,bp.count);assert.equal(ap.array.byteLength,bp.array.byteLength);for(let i=0;i<bp.count;i++){assert.equal(ap.getX(i),bp.getX(i));assert.equal(ap.getZ(i),bp.getZ(i));assert(Math.abs(bp.getY(i)-f.height(bp.getX(i),bp.getZ(i))-.012)<.00001);}}
 assert(b.rock.geometry.index.count/3<11000);assert(b.barriers.length<a.barriers.length);for(const c of b.barriers){assert(Number.isFinite(c.x+c.z+c.topY));assert(c.terrainCliff&&c.landform);assert(c.topY>f.height(c.x,c.z)+2);}
 const baseline=fs.readFileSync(new URL('./fixtures/hollowpeak-contours-6edee7c/assets/falls-landscape.js',import.meta.url),'utf8'),source=fs.readFileSync(new URL('../assets/falls-landscape.js',import.meta.url),'utf8');assert.equal(normalizeApprovedPoolMaterial(source.slice(source.indexOf('export function createFallsLandscape'))),baseline.slice(baseline.indexOf('export function createFallsLandscape')));
});
