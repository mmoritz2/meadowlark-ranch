import {surfaceSampler,trimGarment} from './rider-fit.js?v=character-polish-20261009';

// A separate pullover construction: soft turned neckband, broad cuffs and hem,
// and yarn relief in the garment's rest coordinates, all on its own skin field.
export function knitFinish(T,kit,garment,data,{color='#a7b5a1',trim='#8b9a86'}={}) {
 const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z), get=['getX','getY','getZ','getW'];
 const parent=garment.geometry.clone();if(!parent.attributes.uv)parent.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(parent.attributes.position.count*2),2));parent.computeVertexNormals();
 const a=parent.attributes,point=id=>({p:V().fromBufferAttribute(a.position,id),joints:get.map(k=>a.skinIndex[k](id)),weights:get.map(k=>a.skinWeight[k](id))});
 const geo=(v,idx)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v.flatMap(q=>q.p.toArray()),3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(v.flatMap(q=>q.joints),4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(v.flatMap(q=>q.weights),4));g.setAttribute('uv',new T.Float32BufferAttribute(v.flatMap(q=>[q.p.x*4,q.p.y*4]),2));g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();return g;};
 const fabric=(c,rib=false)=>{
  const m=new T.MeshStandardMaterial({color:c,roughness:.94,metalness:0,side:T.DoubleSide});
  m.onBeforeCompile=sh=>{
   sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vKnitRest;').replace('#include <begin_vertex>','#include <begin_vertex>\nvKnitRest=position;');
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
    varying vec3 vKnitRest;
    float yarnRidge(float d,float width){return exp(-d*d/(width*width));}
   `).replace('#include <map_fragment>',`#include <map_fragment>
    float sleeve=smoothstep(.18,.29,abs(vKnitRest.x));
    vec2 knitUv=mix(vKnitRest.xy,vec2(vKnitRest.z,abs(vKnitRest.x)),sleeve);
    float column=knitUv.x/0.0046;
    float row=knitUv.y/0.0052;
    float yarnResolve=1.0-smoothstep(.30,1.5,max(fwidth(column),fwidth(row)));
    float chevron=abs(fract(column)-.5)*.82;
    float loopWave=cos((row-chevron)*6.2831853);
    float stitch=(.55+.45*cos(column*6.2831853))*(.70+.30*loopWave);
    float ribWave=.5+.5*cos(knitUv.x*1550.0);
    float ribResolve=1.0-smoothstep(.7,3.0,fwidth(knitUv.x*1550.0));
    float cableMask=1.0-sleeve;
    float cableX=(abs(knitUv.x)-.055);
    float cablePhase=knitUv.y*125.0;
    float cableLeft=yarnRidge(cableX-.007*cos(cablePhase),.0032);
    float cableRight=yarnRidge(cableX+.007*cos(cablePhase),.0032);
    float cable=max(cableLeft*(.80+.20*sin(cablePhase)),cableRight*(.80-.20*sin(cablePhase)))*cableMask;
    float cableResolve=1.0-smoothstep(.006,.020,max(fwidth(knitUv.x),fwidth(knitUv.y)));
    float knitHeight=${rib?'0.00042*ribWave*ribResolve':'0.00018*stitch*yarnResolve+0.00080*cable*cableResolve'};
    diffuseColor.rgb*=${rib?'(.97+.045*ribWave*ribResolve)':'(.98+.035*stitch*yarnResolve+.025*cable*cableResolve)'};
   `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec3 knitDx=dFdx(-vViewPosition),knitDy=dFdy(-vViewPosition);
    vec3 knitR1=cross(knitDy,normal),knitR2=cross(normal,knitDx);
    float knitDet=dot(knitDx,knitR1);
    vec3 knitGradient=sign(knitDet)*(dFdx(knitHeight)*knitR1+dFdy(knitHeight)*knitR2);
    normal=normalize(max(abs(knitDet),1e-12)*normal-knitGradient);
   `);
  };m.customProgramCacheKey=()=> 'source-knit-pullover1-'+(rib?'rib':'cable');return m;
 };
 const pieces=[],push=(name,g,m)=>{pieces.push({name,geometry:g,material:m,skeleton:garment.skeleton,bindMatrix:garment.bindMatrix});return pieces.at(-1);};
 const neck=data.boundaryLoops.find(l=>l.label==='neck').ids,roots=neck.map(point),center=roots.reduce((p,v)=>p.add(v.p),V()).divideScalar(roots.length);
 const sampler=surfaceSampler(T,[{...garment,geometry:parent}]);
 const vertices=[],indices=[],rows=7;let misses=0;
 for(const root of roots){const radial=V(root.p.x-center.x,0,root.p.z-center.z).normalize();const height=.019,outerY=root.p.y-height,r=Math.hypot(root.p.x-center.x,root.p.z-center.z)+.06;
  const h=sampler.cast(V(center.x+radial.x*r,outerY,center.z+radial.z*r),radial.clone().negate(),p=>p.distanceTo(root.p)<.075&&V(p.x-center.x,0,p.z-center.z).dot(radial)>0);
  let outer=h?{p:h.point.clone().addScaledVector(h.normal,.0012),joints:h.joints,weights:h.weights}:null;
  if(!outer){misses++;outer={...root,p:root.p.clone().addScaledVector(radial,.012).add(V(0,-height,0))};}
  for(let row=0;row<rows;row++){const t=row/(rows-1),p=root.p.clone().lerp(outer.p,t).addScaledVector(radial,.0023*Math.sin(t*Math.PI));p.y+=.003*Math.sin(t*Math.PI);const weights=new Map();for(const[q,f]of[[root,1-t],[outer,t]])q.joints.forEach((j,k)=>weights.set(j,(weights.get(j)||0)+q.weights[k]*f));const ranked=[...weights].filter(q=>q[1]>0).sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,4),sum=ranked.reduce((n,q)=>n+q[1],0);while(ranked.length<4)ranked.push([0,0]);vertices.push({p,joints:ranked.map(q=>q[0]),weights:ranked.map(q=>q[1]/sum)});}
 }
 for(let i=0;i<roots.length;i++)for(let r=0;r<rows-1;r++){const a=i*rows+r,b=((i+1)%roots.length)*rows+r;indices.push(a,b,a+1,b,b+1,a+1);}push('Knit_Turned_Neckband',geo(vertices,indices),fabric(trim,true));
 const hem=data.boundaryLoops.find(l=>l.label==='hem').ids,hemY=Math.max(...hem.map(i=>a.position.getY(i))),cuffX=Math.max(...data.boundaryLoops.filter(l=>l.label.startsWith('cuff')).flatMap(l=>l.ids.map(i=>Math.abs(a.position.getX(i)))));
 const band=trimGarment(T,parent,[(x,y)=>Math.max(hemY+.035-y,Math.abs(x)-(cuffX-.038))]);
 for(let i=0;i<band.attributes.position.count;i++){const p=V().fromBufferAttribute(band.attributes.position,i),n=V().fromBufferAttribute(band.attributes.normal,i);p.addScaledVector(n,.001);band.attributes.position.setXYZ(i,p.x,p.y,p.z);}band.computeBoundingSphere();push('Knit_Broad_Rib_Cuffs_Hem',band,fabric(trim,true));
 sampler.dispose();parent.dispose();return {material:fabric(color),pieces,evidence:{style:'cable knit riding pullover',neckRoots:neck.length,neckbandWidthM:.019,neckbandSamplesMissed:misses,cuffWidthM:.038,hemWidthM:.035,cableReliefM:.0008,yarnReliefM:.00018,detailTriangles:pieces.reduce((n,p)=>n+p.geometry.index.count/3,0)}};
}
