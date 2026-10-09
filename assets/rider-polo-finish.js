import {surfaceSampler,trimGarment} from './rider-fit.js?v=character-polish-20261009';

// Folded collar, button placket and ribbing share the draped garment's weights.
export function poloFinish(T,kit,garment,data,{color='#754653',trim='#613846',collarColor='#d9ccb6'}={}){
 const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),get=['getX','getY','getZ','getW'];
 const parent=garment.geometry.clone();if(!parent.attributes.uv)parent.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(parent.attributes.position.count*2),2));parent.computeVertexNormals();
 const a=parent.attributes,point=id=>({p:V().fromBufferAttribute(a.position,id),joints:get.map(k=>a.skinIndex[k](id)),weights:get.map(k=>a.skinWeight[k](id))});
 const mix=(u,v,t,p)=>{const m=new Map();for(const [q,f]of [[u,1-t],[v,t]])q.joints.forEach((j,k)=>m.set(j,(m.get(j)||0)+q.weights[k]*f));const w=[...m].filter(q=>q[1]>0).sort((x,y)=>y[1]-x[1]||x[0]-y[0]).slice(0,4),sum=w.reduce((s,q)=>s+q[1],0);while(w.length<4)w.push([0,0]);return{p,joints:w.map(q=>q[0]),weights:w.map(q=>q[1]/sum)};};
 const geo=(v,idx)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v.flatMap(q=>q.p.toArray()),3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(v.flatMap(q=>q.joints),4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(v.flatMap(q=>q.weights),4));g.setAttribute('uv',new T.Float32BufferAttribute(v.flatMap(q=>[q.p.x*4,q.p.y*4]),2));g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();return g;};
 const fabric=(c,rib=false)=>{const m=new T.MeshStandardMaterial({color:c,roughness:.84,metalness:0,side:T.DoubleSide});m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vPoloDetail;').replace('#include <begin_vertex>','#include <begin_vertex>\nvPoloDetail=position;');sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vPoloDetail;').replace('#include <map_fragment>',`#include <map_fragment>
 float warp=vPoloDetail.x*${rib?'1700.0':'2700.0'},weft=vPoloDetail.y*2700.0;
 float resolved=1.0-smoothstep(.8,3.0,max(fwidth(warp),fwidth(weft)));
 float weave=sin(warp)*${rib?'1.0':'sin(weft)'};
 diffuseColor.rgb*=1.0+weave*resolved*${rib?'.034':'.026'};`);};m.customProgramCacheKey=()=> 'equestrian-polo-fabric3-'+(rib?'rib':'pique');return m;};
 const pieces=[],push=(name,g,m)=>{pieces.push({name,geometry:g,material:m,skeleton:garment.skeleton,bindMatrix:garment.bindMatrix});return pieces.at(-1);};
 const sampler=surfaceSampler(T,[{...garment,geometry:parent}]);
 const cast=(from,dir,offset=.001,accept=()=>true)=>{const h=sampler.cast(from,dir,accept);if(!h)return null;return{p:h.point.clone().addScaledVector(h.normal,offset),joints:h.joints,weights:h.weights,normal:h.normal};};
 const fit=(x,y,offset=.001)=>cast(V(x,y,.65),V(0,0,-1),offset);
 const neck=data.boundaryLoops.find(l=>l.label==='neck').ids,roots=neck.map(point),center=roots.reduce((p,v)=>p.add(v.p),V()).divideScalar(neck.length);
 const front=roots.filter(v=>v.p.z>center.z).sort((x,y)=>Math.abs(x.p.x)-Math.abs(y.p.x))[0].p;
 const vertices=[],indices=[],rows=9;let misses=0;
 for(const root of roots){
  const radial=V(root.p.x,0,root.p.z-center.z).normalize(),frontness=T.MathUtils.smoothstep(radial.z,-.2,.85),drop=.010+.029*Math.exp(-(((Math.abs(root.p.x)-.014)/.032)**2))*frontness,outerY=root.p.y-drop;
  const crest=root.p.clone().addScaledVector(radial,.0035);crest.y+=.006;
  let outer;
  if(radial.z>.30){const x=root.p.x+Math.sign(root.p.x||1)*(.014+.011*frontness);outer=fit(x,outerY,.0020);}
  else {const r=Math.hypot(root.p.x,root.p.z-center.z)+.050;outer=cast(V(radial.x*r,outerY,center.z+radial.z*r),radial.clone().negate(),.0020,p=>p.distanceTo(root.p)<.075&&V(p.x,0,p.z-center.z).dot(radial)>0);}
  if(!outer){misses++;outer={...root,p:root.p.clone().addScaledVector(radial,.028).add(V(0,-drop,0))};}
  for(let j=0;j<rows;j++){
   const t=j/(rows-1);let p;
   if(j===0)p=root.p.clone();else if(t<=.25)p=root.p.clone().lerp(crest,t/.25);else{const u=(t-.25)/.75;p=crest.clone().lerp(outer.p,u).addScaledVector(radial,.003*Math.sin(u*Math.PI));}
   vertices.push(mix(root,outer,T.MathUtils.smoothstep(t,.22,1),p));
  }
 }
 const split=roots.map(r=>r.p.z>center.z&&Math.abs(r.p.x)<.013);for(let i=0;i<neck.length;i++){if(split[i]||split[(i+1)%neck.length])continue;for(let j=0;j<rows-1;j++){const a=i*rows+j,b=((i+1)%neck.length)*rows+j;indices.push(a,b,a+1,b,b+1,a+1);}}
 const collar=geo(vertices,indices);push('Polo_Folded_Collar',collar,fabric(collarColor));
 const hem=data.boundaryLoops.find(l=>l.label==='hem').ids,hemY=Math.max(...hem.map(i=>a.position.getY(i))),cuffX=Math.max(...data.boundaryLoops.filter(l=>l.label.startsWith('cuff')).flatMap(l=>l.ids.map(i=>Math.abs(a.position.getX(i)))));
 const band=trimGarment(T,parent,[(x,y)=>Math.max(hemY+.012-y,Math.abs(x)-(cuffX-.020))]);
 for(let i=0;i<band.attributes.position.count;i++){const p=V().fromBufferAttribute(band.attributes.position,i),n=V().fromBufferAttribute(band.attributes.normal,i);p.addScaledVector(n,.0007);band.attributes.position.setXYZ(i,p.x,p.y,p.z);}band.computeBoundingSphere();push('Polo_Ribbed_Cuffs_Hem',band,fabric(trim,true));
 const ribbon=(path,width,offset=.001)=>{const v=[],idx=[];let prev=null;for(const [x,y]of path){const q=fit(x-width/2,y,offset),r=fit(x+width/2,y,offset);if(!q||!r){prev=null;continue;}const k=v.length;v.push(q,r);if(prev!==null)idx.push(prev,prev+1,k,prev+1,k+1,k);prev=k;}return geo(v,idx);};
 const bottom=front.y-.155,top=front.y+.0015;push('Polo_Button_Placket',ribbon(Array.from({length:54},(_,i)=>[0,bottom+(top-bottom)*i/53]),.018,.00115),fabric(trim));
 const bv=[],bi=[],hv=[],hi=[];
 const disk=(cx,cy,r,offset,v,idx)=>{const rings=3,n=16,base=v.length,q=fit(cx,cy,offset+.0009);if(!q)return;v.push(q);for(let row=1;row<=rings;row++)for(let k=0;k<n;k++){const ang=k*Math.PI*2/n,t=row/rings,p=fit(cx+Math.cos(ang)*r*t,cy+Math.sin(ang)*r*t,offset+.0009*(1-t*t));if(!p)throw Error('Polo button leaves shirt');v.push(p);}for(let k=0;k<n;k++)idx.push(base,base+1+k,base+1+(k+1)%n);for(let row=0;row<rings-1;row++)for(let k=0;k<n;k++){const a=base+1+row*n+k,b=base+1+row*n+(k+1)%n;idx.push(a,a+n,b,b,a+n,b+n);}};
 for(const y of [front.y-.025,front.y-.073,front.y-.121]){disk(0,y,.0032,.00155,bv,bi);for(const x of[-.001,.001])disk(x,y,.00038,.00254,hv,hi);}
 push('Polo_Pearl_Buttons',geo(bv,bi),new T.MeshStandardMaterial({color:'#e6dbc8',roughness:.38,metalness:.04,side:T.DoubleSide}));push('Polo_Button_Thread',geo(hv,hi),fabric(trim));
 for(const side of[-1,1])push('Polo_Placket_Stitch_'+side,ribbon(Array.from({length:50},(_,i)=>[side*.0071,bottom+.004+(top-bottom-.008)*i/49]),.00048,.00155),fabric('#ad8890'));
 sampler.dispose();parent.dispose();return{material:fabric(color),pieces,evidence:{style:'folded-collar riding polo',neckRoots:neck.length,collarRows:rows,collarSamplesMissed:misses,frontSplitWidthM:.026,collarStandM:.006,buttons:3,placketWidthM:.018,detailVertices:pieces.reduce((n,p)=>n+p.geometry.attributes.position.count,0),detailTriangles:pieces.reduce((n,p)=>n+p.geometry.index.count/3,0)}};
}
