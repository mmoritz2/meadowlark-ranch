import {trimRegions} from './rider-garment-regions.js?v=tailored-coats69-20261010';
import {crewneckFinish} from './rider-crewneck-finish.js?v=tailored-coats69-20261010';
import {knitFinish} from './rider-knit-finish.js?v=tailored-coats69-20261010';
import {surfaceSampler,trimGarment} from './rider-fit.js?v=tailored-coats69-20261010';
import {fitLowerLayer} from './rider-garment-inner-fit.js?v=tailored-coats69-20261010';

const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
function outerShell(T,kit,garment,data,ease,extension,clearance=.004){
 const geometry=garment.geometry.clone(),a=geometry.attributes,V=()=>new T.Vector3();
 if(!a.uv)geometry.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(a.position.count*2),2));
 const hem=Math.max(...data.boundaryLoops.find(l=>l.label==='hem').ids.map(i=>a.position.getY(i)));
 for(let i=0;i<a.position.count;i++){const p=V().fromBufferAttribute(a.position,i),n=V().fromBufferAttribute(a.normal,i),lower=(1-smooth((p.y-hem)/.16))*(1-smooth((Math.abs(p.x)-.17)/.12));p.addScaledVector(n,ease);p.y-=extension*lower;a.position.setXYZ(i,p.x,p.y,p.z);}
 geometry.computeVertexNormals();geometry.computeBoundingSphere();const layer={...garment,geometry},lowerFit=fitLowerLayer(T,kit,layer,{underlayer:garment,maximumY:hem+.18,clearance});return{layer,lowerFit};
}
function moveOut(T,g,d){const p=new T.Vector3(),n=new T.Vector3();for(let i=0;i<g.attributes.position.count;i++){p.fromBufferAttribute(g.attributes.position,i);n.fromBufferAttribute(g.attributes.normal,i);p.addScaledVector(n,d);g.attributes.position.setXYZ(i,p.x,p.y,p.z);}g.computeBoundingSphere();return g;}
function exactIndexed(T,source){
 const names=Object.keys(source.attributes),attrs=names.map(n=>source.attributes[n]),values=attrs.map(()=>[]),ids=[],seen=new Map();
 for(const i of source.index.array){
  const key=attrs.map(a=>Array.from(a.array.slice(i*a.itemSize,(i+1)*a.itemSize)).join(',')).join('|');
  let id=seen.get(key);if(id===undefined){id=seen.size;seen.set(key,id);attrs.forEach((a,k)=>values[k].push(...a.array.slice(i*a.itemSize,(i+1)*a.itemSize)));}ids.push(id);
 }
 const out=new T.BufferGeometry();attrs.forEach((a,k)=>out.setAttribute(names[k],new T.BufferAttribute(new a.array.constructor(values[k]),a.itemSize,a.normalized)));out.setIndex(ids);out.computeBoundingSphere();source.dispose();return out;
}
function cloth(T,color){return new T.MeshStandardMaterial({color,roughness:.94,side:T.DoubleSide});}

// A cream cotton underlayer remains visible inside a genuinely open long knit.
export function cardiganFinish(T,kit,garment,data,{color='#b88064',trim='#8f614d'}={}){
 const inner=crewneckFinish(T,kit,garment,data,{color:'#e4ded0',trim:'#e4ded0'}),{layer,lowerFit}=outerShell(T,kit,garment,data,.006,.055,.008),outer=knitFinish(T,kit,layer,data,{color,trim});
 const regions=[[(x,y,z)=>.010-z],[(x,y,z)=>z-.010,x=>x-.044],[(x,y,z)=>z-.010,x=>-.044-x]],pieces=[...inner.pieces];
 pieces.push({name:'Cardigan_Open_Knit_Shell',geometry:trimRegions(T,layer.geometry,regions),material:outer.material,skeleton:garment.skeleton,bindMatrix:garment.bindMatrix});
 for(const p of outer.pieces){const g=trimRegions(T,p.geometry,regions);p.geometry.dispose();if(!g.index.count){g.dispose();p.material.dispose();continue;}pieces.push({...p,name:p.name.replace('Knit_','Cardigan_'),geometry:g});}
 const edge=moveOut(T,trimRegions(T,layer.geometry,[[x=>x-.044,x=>.054-x,(x,y,z)=>z-.012],[x=>-x-.044,x=>.054+x,(x,y,z)=>z-.012]]),.0012);
 pieces.push({name:'Cardigan_Front_Rib_Binding',geometry:edge,material:cloth(T,trim),skeleton:garment.skeleton,bindMatrix:garment.bindMatrix});
 // The cardigan covers the shirt sleeves and sides. Render the exposed cotton
 // inset only, like the show-coat stock inset, so hidden under-shirt surfaces
 // cannot leak through a differently tailored outer hem during animation.
 if(!garment.geometry.attributes.uv)garment.geometry.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(garment.geometry.attributes.position.count*2),2));
 const inset=trimRegions(T,garment.geometry,[[x=>x+.048,x=>.048-x,(x,y,z)=>z-.006]]);
 garment.geometry.copy(inset);inset.dispose();
 for(const part of inner.pieces)if(part.name==='Cotton_Double_Stitched_Edges'){
  const edge=trimRegions(T,part.geometry,[[x=>x+.048,x=>.048-x,(x,y,z)=>z-.006]]);part.geometry.dispose();part.geometry=edge;
 }
 layer.geometry.dispose();return{material:inner.material,pieces,patternMaterials:[outer.material],evidence:{style:'open long knit cardigan over cotton top',hemExtensionM:.055,openFrontWidthM:.088,edgeBindingWidthM:.010,visibleCottonInsetOnly:true,lowerFit,detailTriangles:pieces.reduce((n,p)=>n+p.geometry.index.count/3,0)}};
}

// A separate denim bib and continuous shoulder straps sit over the cotton
// shirt, with the same trouser color joining the waist. No painted-on bib.
export function overallsFinish(T,kit,garment,data,{color='#e8d9b8',pantsColor='#435f80'}={}){
 const inner=crewneckFinish(T,kit,garment,data,{color,trim:color}),{layer,lowerFit}=outerShell(T,kit,garment,data,.006,.014),V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
 const neckY=kit.zones.neckY,waistY=kit.zones.waistY,bibTop=neckY-.19,bibWidth=kit.body==='f'?.105:.135,strapX=kit.body==='f'?.087:.108,strapHalf=.013;
 const waist=waistY+.026,waistBand=waist+.016,cottonUnderlap=waist-.006,backTop=neckY-.15,regions=[
  [(x,y)=>waistBand-y],
  [x=>x+bibWidth,x=>bibWidth-x,(x,y)=>y-waistBand,(x,y)=>bibTop-y,(x,y,z)=>z-.008],
  [x=>x+bibWidth,x=>bibWidth-x,(x,y)=>y-waistBand,(x,y)=>backTop-y,(x,y,z)=>-.006-z]
 ];
 for(const side of[-1,1]){const lo=side*strapX-strapHalf,hi=side*strapX+strapHalf;
  regions.push([x=>x-lo,x=>hi-x,(x,y)=>y-bibTop,(x,y,z)=>z-.008]);
  regions.push([x=>x-lo,x=>hi-x,(x,y)=>y-backTop,(x,y,z)=>-.006-z]);
  regions.push([x=>x-lo,x=>hi-x,(x,y)=>y-waistBand,(x,y,z)=>z+.006,(x,y,z)=>.008-z]);
 }
 const denim=cloth(T,pantsColor),pieces=[...inner.pieces],bib=trimRegions(T,layer.geometry,regions);
 pieces.push({name:'Overalls_Denim_Bib_And_Straps',geometry:bib,material:denim,skeleton:garment.skeleton,bindMatrix:garment.bindMatrix});
 denim.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vBibRest;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBibRest=position;');sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vBibRest;').replace('#include <map_fragment>',`#include <map_fragment>
 float twill=(vBibRest.x+vBibRest.y)*2300.0,resolve=1.0-smoothstep(.8,3.0,fwidth(twill));diffuseColor.rgb*=.99+.025*sin(twill)*resolve;`);};denim.customProgramCacheKey=()=> 'denim-bib1';
 const sampler=surfaceSampler(T,[layer]),fit=(x,y,lift=.002)=>{const h=sampler.cast(V(x,y,.65),V(0,0,-1));if(!h)throw Error('Overall detail leaves bib '+x+'/'+y);return{p:h.point.clone().addScaledVector(h.normal,lift),j:h.joints,w:h.weights};};
 const geo=(v,idx)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v.flatMap(q=>q.p.toArray()),3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(v.flatMap(q=>q.j),4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(v.flatMap(q=>q.w),4));g.setAttribute('uv',new T.Float32BufferAttribute(v.flatMap(q=>[q.p.x*4,q.p.y*4]),2));g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();return g;};
 const push=(name,g,m)=>pieces.push({name,geometry:g,material:m,skeleton:garment.skeleton,bindMatrix:garment.bindMatrix});
 const vs=[],idx=[],rows=17,cols=17,pocketWidth=.102,pocketHeight=.077,top=bibTop-.022;
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const u=c/(cols-1),t=r/(rows-1);vs.push(fit((u-.5)*pocketWidth,top-pocketHeight*t+.008*Math.abs(u-.5)*2*t,.002+.002*Math.sin(u*Math.PI)*Math.sin(t*Math.PI)));}
 for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){const j=r*cols+c,k=j+cols;idx.push(j,k,j+1,k,k+1,j+1);}push('Overalls_Chest_Patch_Pocket',geo(vs,idx),cloth(T,pantsColor));
 const bv=[],bi=[],quad=(x0,y0,x1,y1)=>{const i=bv.length;bv.push(fit(x0,y0,.004),fit(x1,y0,.004),fit(x0,y1,.004),fit(x1,y1,.004));bi.push(i,i+1,i+2,i+1,i+3,i+2);};
 for(const side of[-1,1]){const x=side*strapX,y=bibTop+.006,w=.010,h=.009,t=.0018;quad(x-w,y-h,x+w,y-h+t);quad(x-w,y+h-t,x+w,y+h);quad(x-w,y-h,x-w+t,y+h);quad(x+w-t,y-h,x+w,y+h);}
 push('Overalls_Brass_Strap_Buckles',geo(bv,bi),new T.MeshStandardMaterial({color:'#b7a16a',metalness:.65,roughness:.42,side:T.DoubleSide}));
 const sv=[],si=[];for(let i=0;i<40;i++){const x=-pocketWidth/2+.004+(pocketWidth-.008)*i/39,j=sv.length;sv.push(fit(x,top-.0045,.0042),fit(x,top-.0034,.0042));if(i)si.push(j-2,j-1,j,j-1,j+1,j);}push('Overalls_Pocket_Topstitch',geo(sv,si),cloth(T,'#b99d65'));
 // The actual cotton hem is hidden under the complete denim waistband.
 // Keep22mm of source-domain underlap; exposed upper cotton/cuffs are preserved.
 if(!garment.geometry.attributes.uv)garment.geometry.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(garment.geometry.attributes.position.count*2),2));
 const cotton=exactIndexed(T,trimRegions(T,garment.geometry,[[(x,y)=>y-cottonUnderlap]]));
 garment.geometry.copy(cotton);cotton.dispose();
 for(const part of pieces)if(part.name==='Cotton_Double_Stitched_Edges'){
  const edge=exactIndexed(T,trimRegions(T,part.geometry,[[(x,y)=>y-cottonUnderlap]]));part.geometry.dispose();part.geometry=edge;
 }
 sampler.dispose();layer.geometry.dispose();return{material:inner.material,primaryMaterial:inner.material,pieces,patternMaterials:[],evidence:{style:'denim bib overalls over cotton shirt',cottonUnderlapM:.022,waistBandSupportM:.016,hiddenCottonHemTrimmed:true,bibTopM:bibTop,bibHalfWidthM:bibWidth,strapWidthM:strapHalf*2,realChestPocket:true,strapBuckles:2,lowerFit,detailTriangles:pieces.reduce((n,p)=>n+p.geometry.index.count/3,0)}};
}
