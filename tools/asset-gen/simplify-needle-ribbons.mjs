// The source fir represents every needle with an eight-triangle bent ribbon.
// Fit a textured quad to each ribbon instead of letting global decimation delete
// whole needles. The original UV rectangle, position, and averaged normal remain.
export function simplifyNeedleRibbons(doc,primitive,{triangles=8,vertices:expectedVertices=10}={}){
 const position=primitive.getAttribute('POSITION'),normal=primitive.getAttribute('NORMAL'),uv=primitive.getAttribute('TEXCOORD_0');
 const input=primitive.getIndices().getArray(),P=position.getArray(),N=normal.getArray(),U=uv.getArray();
 const parent=Int32Array.from({length:position.getCount()},(_,i)=>i);
 const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const union=(a,b)=>{a=root(a);b=root(b);if(a!==b)parent[b]=a;};
 for(let i=0;i<input.length;i+=3){union(input[i],input[i+1]);union(input[i],input[i+2]);}
 const components=new Map();
 for(let i=0;i<input.length;i+=3){const k=root(input[i]);if(!components.has(k))components.set(k,[]);components.get(k).push(input[i],input[i+1],input[i+2]);}
 const p=[],n=[],u=[],indices=[],remap=new Map();let ribbons=0;
 function original(v){if(remap.has(v))return remap.get(v);const k=p.length/3;for(let j=0;j<3;j++){p.push(P[v*3+j]);n.push(N[v*3+j]);}u.push(U[v*2],U[v*2+1]);remap.set(v,k);return k;}
 for(const faces of components.values()){
  const vertices=[...new Set(faces)];
  if(faces.length!==triangles*3||vertices.length!==expectedVertices){for(const v of faces)indices.push(original(v));continue;}
  let um=0,vm=0,umin=Infinity,umax=-Infinity,vmin=Infinity,vmax=-Infinity;const pm=[0,0,0],nm=[0,0,0];
  for(const v of vertices){const a=U[v*2],b=U[v*2+1];um+=a/vertices.length;vm+=b/vertices.length;umin=Math.min(umin,a);umax=Math.max(umax,a);vmin=Math.min(vmin,b);vmax=Math.max(vmax,b);for(let j=0;j<3;j++){pm[j]+=P[v*3+j]/vertices.length;nm[j]+=N[v*3+j];}}
  let uu=0,vv=0,uvv=0;const up=[0,0,0],vp=[0,0,0];
  for(const v of vertices){const a=U[v*2]-um,b=U[v*2+1]-vm;uu+=a*a;vv+=b*b;uvv+=a*b;for(let j=0;j<3;j++){up[j]+=a*(P[v*3+j]-pm[j]);vp[j]+=b*(P[v*3+j]-pm[j]);}}
  const det=uu*vv-uvv*uvv;
  if(Math.abs(det)<1e-12){for(const v of faces)indices.push(original(v));continue;}
  const A=up.map((x,j)=>(x*vv-vp[j]*uvv)/det),B=vp.map((x,j)=>(x*uu-up[j]*uvv)/det),len=Math.hypot(...nm)||1,base=p.length/3;
  for(const [a,b]of [[umin,vmin],[umax,vmin],[umax,vmax],[umin,vmax]]){for(let j=0;j<3;j++){p.push(pm[j]+A[j]*(a-um)+B[j]*(b-vm));n.push(nm[j]/len);}u.push(a,b);}
  const cross=[A[1]*B[2]-A[2]*B[1],A[2]*B[0]-A[0]*B[2],A[0]*B[1]-A[1]*B[0]];
  if(cross.reduce((s,x,j)=>s+x*nm[j],0)>0)indices.push(base,base+1,base+2,base,base+2,base+3);
  else indices.push(base,base+2,base+1,base,base+3,base+2);
  ribbons++;
 }
 const buffer=position.getBuffer();
 for(const [semantic,type,values]of [['POSITION','VEC3',p],['NORMAL','VEC3',n],['TEXCOORD_0','VEC2',u]])primitive.setAttribute(semantic,doc.createAccessor().setType(type).setArray(new Float32Array(values)).setBuffer(buffer));
 primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(indices)).setBuffer(buffer));
 return {ribbons,trianglesBefore:input.length/3,trianglesAfter:indices.length/3};
}
