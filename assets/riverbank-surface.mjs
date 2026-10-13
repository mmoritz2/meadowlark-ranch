import {RIVERBANK_REACHES} from './riverbank-terrain.mjs?v=river-banks-1';
export const RIVERBANK_SURFACE_PROFILE='river-bank-soil-skin-1';
const STEP=1000/512;
const touchesReach=vs=>RIVERBANK_REACHES.some(([lo,hi])=>Math.max(...vs.map(v=>v.x))>lo&&Math.min(...vs.map(v=>v.x))<hi);
const area=vs=>Math.abs((vs[1].x-vs[0].x)*(vs[2].z-vs[0].z)-(vs[1].z-vs[0].z)*(vs[2].x-vs[0].x));
const mixVertex=(a,b,t)=>Object.fromEntries(Object.keys(a).map(k=>[k,a[k]+(b[k]-a[k])*t]));
function clip(poly,a,b){
 const side=v=>(b.x-a.x)*(v.z-a.z)-(b.z-a.z)*(v.x-a.x),out=[];
 for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dp=side(p),dq=side(q),inp=dp>=-1e-9,inq=dq>=-1e-9;if(inp)out.push(p);if(inp!==inq)out.push(mixVertex(p,q,dp/(dp-dq)));}
 return out;
}
function onTerrain(poly,groundHeight){
 const loX=Math.floor((Math.min(...poly.map(v=>v.x))+500)/STEP),hiX=Math.floor((Math.max(...poly.map(v=>v.x))+500)/STEP),loZ=Math.floor((Math.min(...poly.map(v=>v.z))+500)/STEP),hiZ=Math.floor((Math.max(...poly.map(v=>v.z))+500)/STEP),out=[];
 for(let iz=loZ;iz<=hiZ;iz++)for(let ix=loX;ix<=hiX;ix++){
  const x=ix*STEP-500,z=iz*STEP-500,A={x,z},B={x:x+STEP,z},C={x,z:z+STEP},D={x:x+STEP,z:z+STEP};
  for(const tri of[[A,B,C],[B,D,C]]){
   let clipped=poly;for(let k=0;k<3&&clipped.length;k++)clipped=clip(clipped,tri[k],tri[(k+1)%3]);
   for(let k=1;k+1<clipped.length;k++){const vs=[clipped[0],clipped[k],clipped[k+1]];if(area(vs)>1e-8)out.push(vs.map(v=>({...v,y:groundHeight(v.x,v.z)+v.offset})));}
  }
 }
 return out;
}
// Retain each already-constructed owner/geometry/material UUID. Only triangles
// in authored reaches are clipped onto the actual shared terrain triangles.
export function conformRiverBankGeometry({THREE:T,mesh,groundHeight,full=false,offsetM=null,worldUV=false}){
 const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color,u=g.attributes.uv,ix=g.index.array,out={position:[],normal:[],color:[],uv:[],index:[]};
 const oldTriangles=ix.length/3,oldBytes=Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,g.index.array.byteLength);let conformed=0;
 const vertex=i=>({x:p.getX(i),y:p.getY(i),z:p.getZ(i),nx:n.getX(i),ny:n.getY(i),nz:n.getZ(i),r:c.getX(i),g:c.getY(i),b:c.getZ(i),u:u.getX(i),v:u.getY(i),offset:offsetM===null?p.getY(i)-groundHeight(p.getX(i),p.getZ(i)):offsetM});
 const emit=(vs,changed)=>{if(area(vs)<1e-8)return;let a=vs;if((a[1].x-a[0].x)*(a[2].z-a[0].z)-(a[1].z-a[0].z)*(a[2].x-a[0].x)>0)a=[a[0],a[2],a[1]];
  for(const v of a){const id=out.position.length/3;out.position.push(v.x,v.y,v.z);out.color.push(v.r,v.g,v.b);out.uv.push(worldUV?v.x/2.53:v.u,worldUV?v.z/2.53:v.v);out.index.push(id);
   if(changed){const dx=(groundHeight(v.x+.06,v.z)-groundHeight(v.x-.06,v.z))/.12,dz=(groundHeight(v.x,v.z+.06)-groundHeight(v.x,v.z-.06))/.12,len=Math.hypot(dx,1,dz);out.normal.push(-dx/len,1/len,-dz/len);}else out.normal.push(v.nx,v.ny,v.nz);
  }
 };
 for(let i=0;i<ix.length;i+=3){const vs=[vertex(ix[i]),vertex(ix[i+1]),vertex(ix[i+2])];if(full||touchesReach(vs)){for(const tri of onTerrain(vs,groundHeight))emit(tri,true);conformed++;}else emit(vs,false);}
 for(const name of['position','normal','color','uv'])g.setAttribute(name,new T.Float32BufferAttribute(out[name],name==='uv'?2:3));g.setIndex(out.index);g.computeBoundingBox();g.computeBoundingSphere();
 const triangles=g.index.count/3,bytes=Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,g.index.array.byteLength);
 if(triangles>64000||bytes>6500000)throw Error('Riverbank skin resource budget exceeded');
 return{profile:full?'river-bed-terrain-surface-1':RIVERBANK_SURFACE_PROFILE,oldTriangles,triangles,oldBytes,bytes,conformedSourceTriangles:conformed,newGeometryObjects:0,newDrawOwners:0,offsetM,worldUV};
}
export function dressRiverBankMaterial(material,soil){
 if(!soil)return false;
 const ready={value:0};material.onBeforeRender=()=>{const color=soil.color.value?.image,properties=soil.properties.value?.image;ready.value=color?.width>0&&properties?.width>0?1:0;};
 material.onBeforeCompile=sh=>{
  sh.uniforms.riverSoilColor=soil.color;sh.uniforms.riverSoilProperties=soil.properties;sh.uniforms.riverSoilReady=ready;
  sh.vertexShader='varying vec3 riverBankPosition; varying vec3 riverBankNormal;\n'+sh.vertexShader;
  sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nriverBankPosition=(modelMatrix*vec4(transformed,1.0)).xyz;riverBankNormal=normalize(mat3(modelMatrix)*normal);');
  sh.fragmentShader='varying vec3 riverBankPosition; varying vec3 riverBankNormal; uniform sampler2D riverSoilColor,riverSoilProperties; uniform float riverSoilReady;\n'+sh.fragmentShader;
  sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
   vec4 bankCanvas=texture2D(map,vMapUv);
   vec3 weights=pow(abs(normalize(riverBankNormal)),vec3(4.0));weights/=max(.0001,weights.x+weights.y+weights.z);
   vec3 p=riverBankPosition/2.53;
   vec3 bankMineral=texture2D(riverSoilColor,p.zy).rgb*weights.x+texture2D(riverSoilColor,p.xz).rgb*weights.y+texture2D(riverSoilColor,p.xy).rgb*weights.z;
   diffuseColor.rgb*=mix(bankCanvas.rgb,bankMineral,riverSoilReady);
   diffuseColor.a*=bankCanvas.a;
   #endif`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   if(riverSoilReady>.5){vec3 p=riverBankPosition/2.53;vec3 w=pow(abs(normalize(riverBankNormal)),vec3(4.0));w/=max(.0001,w.x+w.y+w.z);float granularRoughness=texture2D(riverSoilProperties,p.zy).b*w.x+texture2D(riverSoilProperties,p.xz).b*w.y+texture2D(riverSoilProperties,p.xy).b*w.z;roughnessFactor=mix(roughnessFactor,clamp(granularRoughness,.70,1.0),.85);}`);
 };
 material.customProgramCacheKey=()=>RIVERBANK_SURFACE_PROFILE;material.needsUpdate=true;material.userData.riverBankSurface=RIVERBANK_SURFACE_PROFILE;return true;
}
