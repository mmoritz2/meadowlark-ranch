import {fittedZip} from './rider-fitted-zip.js?v=character-finish68-20261010';
import {surfaceSampler,trimGarment} from './rider-fit.js?v=tailored-coats69-20261010';

// Detail surfaces inherit the actual draped shirt's triangle weights. The
// collar shares the literal neck edge; tape and stitching sit on that surface.
export function technicalFinish(T,kit,garment,data,{color='#426776',trim='#263e4b',thread='#71858c'}={}){
 const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),get=['getX','getY','getZ','getW'];
 const parent=garment.geometry.clone();if(!parent.attributes.uv)parent.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(parent.attributes.position.count*2),2));parent.computeVertexNormals();
 const attr=parent.attributes,point=id=>({p:V().fromBufferAttribute(attr.position,id),joints:get.map(k=>attr.skinIndex[k](id)),weights:get.map(k=>attr.skinWeight[k](id))});
 const geo=(vertices,indices)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices.flatMap(v=>v.p.toArray()),3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(vertices.flatMap(v=>v.joints),4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(vertices.flatMap(v=>v.weights),4));g.setAttribute('uv',new T.Float32BufferAttribute(vertices.flatMap(v=>[v.p.x*4,v.p.y*4]),2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();return g;};
 const fabric=(c,rib=false)=>{const m=new T.MeshStandardMaterial({color:c,roughness:.81,metalness:0,side:T.DoubleSide});m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vClothDetail;').replace('#include <begin_vertex>','#include <begin_vertex>\nvClothDetail=position;');sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vClothDetail;').replace('#include <map_fragment>',`#include <map_fragment>
 float warp=vClothDetail.x*${rib?'1900.0':'3100.0'},weft=vClothDetail.y*2800.0;
 float resolved=1.0-smoothstep(.8,3.0,max(fwidth(warp),fwidth(weft)));
 float weave=sin(warp)*${rib?'1.0':'sin(weft)'};
 diffuseColor.rgb*=1.0+weave*resolved*${rib?'.038':'.022'};`);};m.customProgramCacheKey=()=> 'modern-technical-fabric2-'+(rib?'rib':'weave');return m;};
 const pieces=[],push=(name,geometry,material)=>{pieces.push({name,geometry,material,skeleton:garment.skeleton,bindMatrix:garment.bindMatrix});return pieces.at(-1);};
 const neck=data.boundaryLoops.find(l=>l.label==='neck').ids,neckPoints=neck.map(point),center=neckPoints.reduce((p,v)=>p.add(v.p),V()).divideScalar(neck.length),height=kit.body==='f'?.020:.023;
 const collarVertices=[],collarIndices=[],profile=[[0,0],[.20,.0005],[.85,-.001],[1,-.0015],[1,-.003],[.72,-.0032]];
 for(const [rise,ease]of profile)for(const v of neckPoints){const radial=V(v.p.x-center.x,0,v.p.z-center.z).normalize(),p=v.p.clone().addScaledVector(radial,ease);p.y+=height*rise;collarVertices.push({...v,p});}
 for(let row=0;row<profile.length-1;row++)for(let i=0;i<neck.length;i++){const a=row*neck.length+i,b=row*neck.length+(i+1)%neck.length,c=a+neck.length,d=b+neck.length;collarIndices.push(a,b,c,b,d,c);}
 const collar=push('Technical_Stand_Collar',geo(collarVertices,collarIndices),fabric(color));
 const hem=data.boundaryLoops.find(l=>l.label==='hem').ids,hemY=Math.max(...hem.map(i=>attr.position.getY(i))),cuffX=Math.max(...data.boundaryLoops.filter(l=>l.label.startsWith('cuff')).flatMap(l=>l.ids.map(i=>Math.abs(attr.position.getX(i)))));
 const band=trimGarment(T,parent,[(x,y)=>Math.max(hemY+.016-y,Math.abs(x)-(cuffX-.018))]);
 for(let i=0;i<band.attributes.position.count;i++){const p=V().fromBufferAttribute(band.attributes.position,i),n=V().fromBufferAttribute(band.attributes.normal,i);p.addScaledVector(n,.0007);band.attributes.position.setXYZ(i,p.x,p.y,p.z);}band.computeBoundingSphere();push('Technical_Ribbed_Edges',band,fabric(trim,true));
 const sampler=surfaceSampler(T,[{...garment,geometry:parent},collar]);
 // Two-sided folded collar faces can point inward; front attachments need outward relief.
 const fit=(x,y,offset=.001)=>{const h=sampler.cast(V(x,y,.6),V(0,0,-1));if(!h)return null;const normal=h.normal.clone();if(normal.z<0)normal.negate();return{p:h.point.clone().addScaledVector(normal,offset),joints:h.joints,weights:h.weights};};
 const ribbon=(path,width,offset=.001)=>{const vertices=[],indices=[];let previous=null;for(const [x,y]of path){const a=fit(x-width*.5,y,offset),b=fit(x+width*.5,y,offset);if(!a||!b){previous=null;continue;}const i=vertices.length;vertices.push(a,b);if(previous!==null)indices.push(previous,previous+1,i,previous+1,i+1,i);previous=i;}return geo(vertices,indices);};
 const front=neckPoints.filter(v=>v.p.z>center.z).sort((a,b)=>Math.abs(a.p.x)-Math.abs(b.p.x))[0].p,top=front.y+height-.003,bottom=front.y-.185,path=Array.from({length:82},(_,i)=>[0,bottom+(top-bottom)*i/81]);
 push('Technical_Quarter_Zip_Tape',ribbon(path,.0055,.0011),fabric(trim));
 for(const p of fittedZip(T,{fit,geo,path,trim}))push(p.name,p.geometry,p.material);
 const seamVertices=[],seamIndices=[];
 const append=g=>{const offset=seamVertices.length;for(let i=0;i<g.attributes.position.count;i++)seamVertices.push({p:V().fromBufferAttribute(g.attributes.position,i),joints:get.map(k=>g.attributes.skinIndex[k](i)),weights:get.map(k=>g.attributes.skinWeight[k](i))});for(const i of g.index.array)seamIndices.push(offset+i);g.dispose();};
 for(const side of [-1,1]){
  const panel=Array.from({length:75},(_,i)=>{const t=i/74,y=hemY+.015+(front.y-.035-hemY-.015)*t,x=side*(.073+.090*t-.009*Math.sin(t*Math.PI));return[x,y];});append(ribbon(panel,.00095,.00085));
  for(let y=bottom+.005;y<top-.012;y+=.0062)append(ribbon([[side*.0049,y],[side*.0049,y+.0028]],.00055,.0014));
 }
 push('Technical_Topstitch',geo(seamVertices,seamIndices),new T.MeshStandardMaterial({color:new T.Color(color).lerp(new T.Color(thread),.22),roughness:.94,side:T.DoubleSide}));
 sampler.dispose();parent.dispose();return {material:fabric(color),pieces,evidence:{neckRoots:neck.length,neckRootOffsetM:0,collarHeightM:height,cuffRibWidthM:.018,hemRibWidthM:.016,quarterZipLengthM:top-bottom,detailVertices:pieces.reduce((n,p)=>n+p.geometry.attributes.position.count,0),detailTriangles:pieces.reduce((n,p)=>n+p.geometry.index.count/3,0)}};
}
