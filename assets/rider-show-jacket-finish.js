import {surfaceSampler,trimGarment} from './rider-fit.js?v=character-polish-20261009';

// Fitted show coat with a separate stock-shirt inset, notch lapels, full front
// closure and welt pockets. Every surface follows the draped coat's triangle skin.
export function showJacketFinish(T,kit,garment,data,{color='#283d50',lapel='#223446',shirt='#e1dccf',metal='#b6a177'}={}){
 const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),get=['getX','getY','getZ','getW'];
 const parent=garment.geometry.clone();if(!parent.attributes.uv)parent.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(parent.attributes.position.count*2),2));parent.computeVertexNormals();
 const a=parent.attributes,neck=data.boundaryLoops.find(l=>l.label==='neck').ids,roots=neck.map(id=>V().fromBufferAttribute(a.position,id)),center=roots.reduce((p,v)=>p.add(v),V()).divideScalar(roots.length),front=roots.filter(v=>v.z>center.z).sort((x,y)=>Math.abs(x.x)-Math.abs(y.x))[0];
 const hemY=Math.max(...data.boundaryLoops.find(l=>l.label==='hem').ids.map(id=>a.position.getY(id))),cuffX=Math.max(...data.boundaryLoops.filter(l=>l.label.startsWith('cuff')).flatMap(l=>l.ids.map(id=>Math.abs(a.position.getX(id)))));
 const geo=(v,idx)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v.flatMap(q=>q.p.toArray()),3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(v.flatMap(q=>q.joints),4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(v.flatMap(q=>q.weights),4));g.setAttribute('uv',new T.Float32BufferAttribute(v.flatMap(q=>[q.p.x*4,q.p.y*4]),2));g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();return g;};
 const fabric=c=>{const m=new T.MeshStandardMaterial({color:c,roughness:.82,metalness:0,side:T.DoubleSide});m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vShowRest;').replace('#include <begin_vertex>','#include <begin_vertex>\nvShowRest=position;');sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vShowRest;').replace('#include <map_fragment>',`#include <map_fragment>
  float twill=(vShowRest.x+vShowRest.y*.75)*2300.0;
  float resolve=1.0-smoothstep(.8,3.0,fwidth(twill));
  diffuseColor.rgb*=1.0+.020*cos(twill)*resolve;`);};m.customProgramCacheKey=()=> 'tailored-show-twill2';return m;};
 const pieces=[],push=(name,g,m)=>{pieces.push({name,geometry:g,material:m,skeleton:garment.skeleton,bindMatrix:garment.bindMatrix});return pieces.at(-1);};
 const offset=(g,d)=>{for(let i=0;i<g.attributes.position.count;i++){const p=V().fromBufferAttribute(g.attributes.position,i),n=V().fromBufferAttribute(g.attributes.normal,i);p.addScaledVector(n,d);g.attributes.position.setXYZ(i,p.x,p.y,p.z);}g.computeBoundingSphere();return g;};
 const bottom=front.y-.186;
 const inset=trimGarment(T,parent,[(x,y,z)=>z-center.z,(x,y)=>y-bottom-Math.abs(x)*2.35]);push('Show_Stock_Shirt_Inset',offset(inset,.0007),fabric(shirt));
 const sampler=surfaceSampler(T,[{...garment,geometry:parent}]),fit=(x,y,offset=.001)=>{const h=sampler.cast(V(x,y,.65),V(0,0,-1));if(!h)return null;return {p:h.point.clone().addScaledVector(h.normal,offset),joints:h.joints,weights:h.weights};};
 const ribbon=(path,width,offset=.001)=>{const v=[],idx=[];let prev=null;for(let i=0;i<path.length;i++){const [x,y]=path[i],before=path[Math.max(0,i-1)],after=path[Math.min(path.length-1,i+1)],dx=after[0]-before[0],dy=after[1]-before[1],length=Math.hypot(dx,dy)||1,nx=dy/length*width/2,ny=-dx/length*width/2,q=fit(x-nx,y-ny,offset),r=fit(x+nx,y+ny,offset);if(!q||!r){prev=null;continue;}const k=v.length;v.push(q,r);if(prev!==null)idx.push(prev,prev+1,k,prev+1,k+1,k);prev=k;}return geo(v,idx);};
 // Lapels are bounded strips with a notched outer edge, fitted across each row.
 for(const side of[-1,1]){const vertices=[],indices=[],rows=58,cols=7;for(let row=0;row<rows;row++){const t=row/(rows-1),y=bottom+(front.y+.008-bottom)*t,inner=.007+.061*t,notch=.012*Math.exp(-(((t-.75)/.045)**2)),outer=inner+(.006+.034*Math.sin(Math.PI*t*.72))-notch;for(let col=0;col<cols;col++){const u=col/(cols-1),x=side*(inner+(outer-inner)*u),p=fit(x,y,.0016+.0024*Math.sin(u*Math.PI)*Math.sin(t*Math.PI));if(!p)throw Error('Show lapel misses jacket '+side+'/'+row+'/'+col);vertices.push(p);}}for(let row=0;row<rows-1;row++)for(let col=0;col<cols-1;col++){const a=row*cols+col,b=a+cols;indices.push(a,b,a+1,b,b+1,a+1);}push('Show_Notch_Lapel_'+side,geo(vertices,indices),fabric(lapel));
  const y=hemY+.061;push('Show_Welt_Pocket_'+side,ribbon(Array.from({length:25},(_,i)=>[side*(.064+.065*i/24),y+.012*i/24]),.0060,.0014),fabric(lapel));push('Show_Pocket_Seam_'+side,ribbon(Array.from({length:25},(_,i)=>[side*(.064+.065*i/24),y-.002+.012*i/24]),.0006,.0017),fabric('#607180'));
 }
 // A clean standing stock collar shares the literal shirt neck edge.
 const collarV=[],collarI=[],profile=[[0,.001],[.8,.0002],[1,-.0007],[1,-.0026],[.65,-.0030]],height=.014;
 for(const [rise,ease]of profile)for(const id of neck){const p=V().fromBufferAttribute(a.position,id),radial=V(p.x-center.x,0,p.z-center.z).normalize();p.addScaledVector(radial,ease);p.y+=height*rise;collarV.push({p,joints:get.map(k=>a.skinIndex[k](id)),weights:get.map(k=>a.skinWeight[k](id))});}
 for(let row=0;row<profile.length-1;row++)for(let i=0;i<neck.length;i++){const a=row*neck.length+i,b=row*neck.length+(i+1)%neck.length;collarI.push(a,b,a+neck.length,b,b+neck.length,a+neck.length);}push('Show_Standing_Stock_Collar',geo(collarV,collarI),fabric(shirt));
 push('Show_Front_Closure',ribbon(Array.from({length:56},(_,i)=>[.003,hemY+.010+(bottom-hemY-.007)*i/55]),.012,.0009),fabric(lapel));
 const cuff=trimGarment(T,parent,[(x)=>Math.abs(x)-(cuffX-.009)]);push('Show_White_Shirt_Cuffs',offset(cuff,.0009),fabric(shirt));
 const bv=[],bi=[],addButton=(cx,cy,r)=>{const n=16,base=bv.length,mid=fit(cx,cy,.0031);if(!mid)return;bv.push(mid);for(let k=0;k<n;k++){const a=k*Math.PI*2/n,p=fit(cx+Math.cos(a)*r,cy+Math.sin(a)*r,.0024);if(!p)throw Error('Show button leaves coat');bv.push(p);}for(let k=0;k<n;k++)bi.push(base,base+1+k,base+1+(k+1)%n);};
 const buttonYs=[.23,.285,.34].map(d=>front.y-d).filter(y=>y>hemY+.012);for(const y of buttonYs)addButton(.003,y,.0040);push('Show_Antique_Metal_Buttons',geo(bv,bi),new T.MeshStandardMaterial({color:metal,roughness:.4,metalness:.7,side:T.DoubleSide}));
 // Stock tie: narrow fabric strip, with a small knot immediately under the collar.
 push('Show_Stock_Tie',ribbon(Array.from({length:30},(_,i)=>[0,front.y-.112+.115*i/29]),.014,.0015),fabric('#d4c9b2'));
 const knotV=[],knotI=[];for(let row=0;row<9;row++){const t=row/8,y=front.y-.025+t*.016,w=.007+Math.sin(t*Math.PI)*.008;for(const x of [-w/2,w/2]){const p=fit(x,y,.0026);if(!p)throw Error('Stock knot leaves shirt');knotV.push(p);}if(row){const k=(row-1)*2;knotI.push(k,k+1,k+2,k+1,k+3,k+2);}}push('Show_Stock_Knot',geo(knotV,knotI),fabric('#cdc4b3'));
 sampler.dispose();parent.dispose();return {material:fabric(color),pieces,evidence:{style:'tailored equestrian show jacket with white stock shirt',lapels:2,weltPockets:2,buttons:buttonYs.length,insetDepthM:.186,stockCollarHeightM:height,shirtCuffWidthM:.009,detailTriangles:pieces.reduce((n,p)=>n+p.geometry.index.count/3,0)}};
}
