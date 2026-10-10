import {fitLowerLayer} from './rider-garment-layer-fit.js?v=tailored-coats69-20261010';
import {shirtFinish} from './rider-shirt-finish.js?v=tailored-coats69-20261010';
import {surfaceSampler} from './rider-fit.js?v=tailored-coats69-20261010';

// Roomy work jacket: eased shoulders/sleeves, a slightly longer hem, curved
// patch pockets and actual topstitch ribbons sharing the garment skin field.
export function overshirtFinish(T,kit,garment,data,{color='#435f80',trim='#30435c',recipe={id:'denim'}}={}){
 const denim=recipe.id==='denim',V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),a=garment.geometry.attributes;
 const neckIds=new Set(data.boundaryLoops.find(l=>l.label==='neck').ids),hemIds=data.boundaryLoops.find(l=>l.label==='hem').ids;
 const hemY=Math.max(...hemIds.map(i=>a.position.getY(i))),neckY=kit.zones.neckY;
 const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
 for(let i=0;i<a.position.count;i++){
  const p=V().fromBufferAttribute(a.position,i),n=V().fromBufferAttribute(a.normal,i);
  const rootFade=neckIds.has(i)?0:smooth((neckY-p.y+.004)/.075),sleeve=smooth((Math.abs(p.x)-.18)/.17);
  const ease=(denim?.0038:.006)*(rootFade*(1-sleeve)+sleeve);
  p.addScaledVector(n,ease);p.y-=.023*(1-sleeve)*(1-smooth((p.y-hemY)/.14));
  a.position.setXYZ(i,p.x,p.y,p.z);
 }
 garment.geometry.computeVertexNormals();garment.geometry.computeBoundingSphere();
 const lowerFit=fitLowerLayer(T,kit,garment);
 const result=shirtFinish(T,kit,garment,data,{color,trim,recipe:{id:denim?'western':'prairie'}}),patternMaterials=[result.material];
 for(const p of result.pieces)if(/Chest_Pocket|Folded_Collar|Tailored_Cuffs/.test(p.name))patternMaterials.push(p.material);
 const sampler=surfaceSampler(T,[garment]),fit=(x,y,lift=.0014)=>{
  const h=sampler.cast(V(x,y,.65),V(0,0,-1));return h?{p:h.point.clone().addScaledVector(h.normal,lift),j:h.joints,w:h.weights}:null;
 };
 const geometry=(vs,idx)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vs.flatMap(q=>q.p.toArray()),3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(vs.flatMap(q=>q.j),4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(vs.flatMap(q=>q.w),4));g.setAttribute('uv',new T.Float32BufferAttribute(vs.flatMap(q=>[q.p.x*4,q.p.y*4]),2));g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();return g;};
 const piece=(name,g,m)=>result.pieces.push({name,geometry:g,material:m,skeleton:garment.skeleton,bindMatrix:garment.bindMatrix});
 const seamColor=denim?'#b69a62':'#'+new T.Color(color).multiplyScalar(.75).getHexString();
 const ribbon=(name,path,width=.0012)=>{
  const vs=[],idx=[];let prev=null;
  for(let i=0;i<path.length;i++){const [x,y]=path[i],b=path[Math.max(0,i-1)],n=path[Math.min(path.length-1,i+1)],dx=n[0]-b[0],dy=n[1]-b[1],len=Math.hypot(dx,dy)||1,q=fit(x-dy/len*width/2,y+dx/len*width/2,.0032),r=fit(x+dy/len*width/2,y-dx/len*width/2,.0032);if(!q||!r){prev=null;continue;}const j=vs.length;vs.push(q,r);if(prev!==null)idx.push(prev,prev+1,j,prev+1,j+1,j);prev=j;}
  piece(name,geometry(vs,idx),new T.MeshStandardMaterial({color:seamColor,roughness:.94,side:T.DoubleSide}));
 };
 const frontY=Math.min(...data.boundaryLoops.find(l=>l.label==='neck').ids.map(i=>a.position.getY(i)));
 const line=(x0,y0,x1,y1,n=40)=>Array.from({length:n},(_,i)=>[x0+(x1-x0)*i/(n-1),y0+(y1-y0)*i/(n-1)]);
 for(const side of[-1,1])ribbon('Workwear_Double_Front_Stitch_'+side,line(side*.0105,hemY+.004,side*.0105,frontY-.015));
 if(denim){
  for(const side of[-1,1]){ribbon('Denim_Chest_Yoke_'+side,line(side*.013,frontY-.079,side*.145,frontY-.099));ribbon('Denim_Chest_Yoke_Second_'+side,line(side*.013,frontY-.0815,side*.145,frontY-.1015));}
 }else{
  for(const side of[-1,1]){
   const px=side*(kit.body==='f'?.066:.086),top=hemY+.112,width=kit.body==='f'?.066:.084,height=.096,vs=[],idx=[],rows=18,cols=14;
   for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const u=c/(cols-1),t=r/(rows-1),q=fit(px+(u-.5)*width,top-height*t+.008*Math.abs(u-.5)*2*t,.0016+.0024*Math.sin(u*Math.PI)*Math.sin(t*Math.PI));if(!q)throw Error('Work jacket pocket leaves shell '+JSON.stringify({body:kit.body,id:recipe.id,x:px+(u-.5)*width,y:top-height*t+.008*Math.abs(u-.5)*2*t,hemY,frontY}));vs.push(q);}
   for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){const j=r*cols+c,k=j+cols;idx.push(j,k,j+1,k,k+1,j+1);}
   const m=new T.MeshStandardMaterial({color,roughness:.94,side:T.DoubleSide});patternMaterials.push(m);piece('Workwear_Lower_Patch_Pocket_'+side,geometry(vs,idx),m);
   ribbon('Workwear_Pocket_Topstitch_'+side,line(px-width/2+.004,top-.006,px+width/2-.004,top-.006),.0016);
   ribbon('Workwear_Pocket_Fold_'+side,line(px-width/2,top-.002,px+width/2,top-.002),.004);
  }
 }
 const previous=result.material.onBeforeCompile,key=result.material.customProgramCacheKey();
 result.material.onBeforeCompile=sh=>{previous(sh);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWorkwearRest;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWorkwearRest=position;');sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWorkwearRest;').replace('#include <map_fragment>',`#include <map_fragment>
  vec2 workUv=vec2(vWorkwearRest.x+vWorkwearRest.z*.4,vWorkwearRest.y);
  float workResolve=1.0-smoothstep(.8,3.0,max(fwidth(workUv.x*1900.0),fwidth(workUv.y*1900.0)));
  float workWeave=${denim?'sin((workUv.x+workUv.y)*2400.0)':'sin(workUv.x*1900.0)*sin(workUv.y*1900.0)'};
  diffuseColor.rgb*=.985+.026*workWeave*workResolve;`);};
 result.material.customProgramCacheKey=()=>key+'-workwear-shell1-'+(denim?'denim':'canvas');
 sampler.dispose();return {...result,patternMaterials,evidence:{...result.evidence,lowerFit,style:denim?'denim work jacket':'roomy canvas overshirt',easeM:denim?.0038:.006,hemExtensionM:.023,lowerPatchPockets:denim?0:2,topstitch:true,detailTriangles:result.pieces.reduce((s,p)=>s+p.geometry.index.count/3,0)}};
}
