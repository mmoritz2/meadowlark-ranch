import {createPhysicalBinding} from './rider-physical-binding.js?v=tailored-coats69-20261010';
import {shirtFinish} from './rider-shirt-finish.js?v=tailored-coats69-20261010';
import {trimGarment} from './rider-fit.js?v=tailored-coats69-20261010';

// A separate sleeveless layer over a complete cotton shirt. Both layers keep
// the same source skeleton; the undershirt continues through each armhole.
export function vestFinish(T,kit,garment,data,{color='#365447',trim='#273e33',recipe={id:'ranger'}}={}){
 const quilted=recipe.id==='quilted',inner=shirtFinish(T,kit,garment,data,{color:'#e6dfcf',trim:'#d6cdbb',recipe:{id:'prairie'}});
 // The inner shirt is a clean crew opening for the layered vest. Its original
 // shirt shell, placket and sleeves stay exact; only the sampled folded collar
 // detail is replaced by a small sewn rim on the literal source neck boundary.
 for(const p of inner.pieces.filter(p=>p.name==='Shirt_Folded_Collar')){p.geometry.dispose();p.material.dispose();}
 inner.pieces=inner.pieces.filter(p=>p.name!=='Shirt_Folded_Collar');
 const innerNeck=createPhysicalBinding(T,garment.geometry,{label:'inner shirt neck',sourceIDs:data.boundaryLoops.find(l=>l.label==='neck').ids,width:.004,radius:.00020});
 inner.pieces.push({name:'Inner_Shirt_Sewn_Neckline',geometry:innerNeck,material:new T.MeshStandardMaterial({color:'#d6cdbb',roughness:.9,side:T.DoubleSide}),skeleton:garment.skeleton,bindMatrix:garment.bindMatrix});
 const shell=garment.geometry.clone(),a=shell.attributes,V=()=>new T.Vector3();
 if(!a.uv)shell.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(a.position.count*2),2));
 const ease=quilted?.006:.0035;
 for(let i=0;i<a.position.count;i++){
  const p=V().fromBufferAttribute(a.position,i),n=V().fromBufferAttribute(a.normal,i);
  p.addScaledVector(n,ease);a.position.setXYZ(i,p.x,p.y,p.z);
 }
 shell.computeVertexNormals();shell.computeBoundingSphere();
 const cutoff=kit.body==='f'?.185:(quilted?.240:.255),neckY=kit.zones.neckY;
 const fields=[x=>cutoff-Math.abs(x)];
 // The work vests have a V opening; the quilted gilet closes to its collar.
 if(!quilted)fields.push((x,y,z)=>Math.max(neckY-.125-y,Math.abs(x)-.48*(y-(neckY-.125)),.012-z));
 const outer=shirtFinish(T,kit,{...garment,geometry:shell},data,{color,trim,recipe:{id:recipe.id==='ranger'?'prairie':'safari'}});
 const pieces=[...inner.pieces],patternMaterials=[outer.material];
 const vest=trimGarment(T,shell,fields);
 pieces.push({name:'Vest_Outer_Shell',geometry:vest,material:outer.material,skeleton:garment.skeleton,bindMatrix:garment.bindMatrix});
 for(const p of outer.pieces){
  if(/Shirt_Folded_Collar|Shirt_Tailored_Cuffs/.test(p.name)){p.geometry.dispose();p.material.dispose();continue;}
  const geometry=trimGarment(T,p.geometry,fields);p.geometry.dispose();
  if(!geometry.index.count){geometry.dispose();p.material.dispose();continue;}
  pieces.push({...p,name:p.name.replace('Shirt_','Vest_'),geometry});
  if(/Chest_Pocket/.test(p.name))patternMaterials.push(p.material);
 }
 const atCut=(p)=>Math.abs(Math.abs(p.x)-cutoff)<1e-6;
 const armhole=createPhysicalBinding(T,vest,{label:'vest armholes',edgeFilter:(u,v)=>atCut(u)&&atCut(v),width:.005,radius:.00030});
 pieces.push({name:'Vest_Sewn_Armhole_Binding',geometry:armhole,material:new T.MeshStandardMaterial({color:trim,roughness:.9,side:T.DoubleSide}),skeleton:garment.skeleton,bindMatrix:garment.bindMatrix});
 const hemY=Math.max(...data.boundaryLoops.find(l=>l.label==='hem').ids.map(i=>a.position.getY(i)));
 const vestNeck=createPhysicalBinding(T,vest,{label:'vest neck opening',edgeFilter:(u,v)=>!atCut(u)&&!atCut(v)&&Math.min(u.y,v.y)>hemY+.05,width:.004,radius:.00020});
 pieces.push({name:'Vest_Sewn_Neckline_Binding',geometry:vestNeck,material:new T.MeshStandardMaterial({color:trim,roughness:.9,side:T.DoubleSide}),skeleton:garment.skeleton,bindMatrix:garment.bindMatrix});
 if(quilted){
  const previous=outer.material.onBeforeCompile,key=outer.material.customProgramCacheKey();
  outer.material.onBeforeCompile=shader=>{
   previous(shader);
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vQuiltBind;').replace('#include <begin_vertex>','#include <begin_vertex>\nvQuiltBind=position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vQuiltBind;').replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec2 cell=fract(vec2(vQuiltBind.x+vQuiltBind.y,vQuiltBind.x-vQuiltBind.y)*20.0);
    float quiltResolve=1.0-smoothstep(.008,.04,max(fwidth(vQuiltBind.x),fwidth(vQuiltBind.y)));
    float quiltHeight=.0018*sin(cell.x*3.14159265)*sin(cell.y*3.14159265)*quiltResolve;
    vec3 qdx=dFdx(-vViewPosition),qdy=dFdy(-vViewPosition),qr1=cross(qdy,normal),qr2=cross(normal,qdx);
    float qdet=dot(qdx,qr1);
    normal=normalize(max(abs(qdet),1e-12)*normal-sign(qdet)*(dFdx(quiltHeight)*qr1+dFdy(quiltHeight)*qr2));`);
  };outer.material.customProgramCacheKey=()=>key+'-padded-vest1';
 }
 shell.dispose();
 return{material:inner.material,pieces,patternMaterials,evidence:{style:quilted?'quilted gilet over cotton shirt':'tailored trail vest over cotton shirt',innerShirt:true,openingFinish:'actual surface facing with closed physical edge',innerNeckLoops:innerNeck.userData.physicalBinding.loopCount,armholeLoops:armhole.userData.physicalBinding.loopCount,vestNeckLoops:vestNeck.userData.physicalBinding.loopCount,armholeCutoffM:cutoff,outerEaseM:ease,neckline:quilted?'closed':'V',pockets:recipe.id==='ranger'?0:2,detailTriangles:pieces.reduce((s,p)=>s+p.geometry.index.count/3,0)}};
}
