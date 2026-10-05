// Convert the mature pine's millions of individual needle faces into photographed
// twig sprays placed in occupied canopy cells. Positions come from the authored
// crown; the existing bark, branch and cone geometry remains separate and intact.
export function clusterPineNeedles(doc,primitive){
 const position=primitive.getAttribute('POSITION'),normal=primitive.getAttribute('NORMAL'),uv=primitive.getAttribute('TEXCOORD_0');
 const input=primitive.getIndices().getArray(),P=position.getArray(),N=normal.getArray(),U=uv.getArray();
 const parent=Int32Array.from({length:position.getCount()},(_,i)=>i);
 const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 for(let i=0;i<input.length;i+=3){const a=root(input[i]),b=root(input[i+1]),c=root(input[i+2]);parent[b]=a;parent[c]=a;}
 const components=new Map();for(let i=0;i<input.length;i+=3){const k=root(input[i]);if(!components.has(k))components.set(k,[]);components.get(k).push(input[i],input[i+1],input[i+2]);}
 const p=[],n=[],u=[],indices=[],remap=new Map(),cells=new Map();let needles=0;
 const copy=v=>{if(remap.has(v))return remap.get(v);const k=p.length/3;p.push(P[v*3],P[v*3+1],P[v*3+2]);n.push(N[v*3],N[v*3+1],N[v*3+2]);u.push(U[v*2],U[v*2+1]);remap.set(v,k);return k;};
 for(const faces of components.values()){
  const vs=[...new Set(faces)];
  if(faces.length<21||faces.length>60||vs.length!==faces.length/3+2){for(const v of faces)indices.push(copy(v));continue;}
  const c=[0,0,0];for(const v of vs)for(let j=0;j<3;j++)c[j]+=P[v*3+j]/vs.length;
  const key=c.map(v=>Math.floor(v/.28)).join(',');if(!cells.has(key))cells.set(key,{sum:[0,0,0],count:0});
  const cell=cells.get(key);for(let j=0;j<3;j++)cell.sum[j]+=c[j];cell.count++;needles++;
 }
 const normalize=v=>{const len=Math.hypot(...v)||1;return v.map(x=>x/len);};
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 for(const cell of cells.values()){
  const c=cell.sum.map(v=>v/cell.count),axis=normalize([c[0]*.48,.75,c[2]*.48]);
  const right=normalize(cross(axis,[0,1,0])),face=normalize(cross(right,axis));
  const width=.25+Math.min(.11,cell.count*.003),length=.46+Math.min(.10,cell.count*.002);
  for(const angle of[-.62,.62]){
   const side=right.map((v,j)=>v*Math.cos(angle)+face[j]*Math.sin(angle));
   const norm=normalize(cross(side,axis)),base=p.length/3;
   // UV rectangle of the original author's complete green twig photograph.
   for(const [x,y,uu,vv]of [[-1,-1,.003,.458],[1,-1,.245,.458],[1,1,.245,.002],[-1,1,.003,.002]]){
    for(let j=0;j<3;j++)p.push(c[j]+side[j]*x*width/2+axis[j]*y*length/2);
    n.push(...norm);u.push(uu,vv);
   }
   indices.push(base,base+1,base+2,base,base+2,base+3);
  }
 }
 const buffer=position.getBuffer();
 for(const [semantic,type,values]of [['POSITION','VEC3',p],['NORMAL','VEC3',n],['TEXCOORD_0','VEC2',u]])primitive.setAttribute(semantic,doc.createAccessor().setType(type).setArray(new Float32Array(values)).setBuffer(buffer));
 primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(indices)).setBuffer(buffer));
 return {needles,canopyCells:cells.size,sprayCards:cells.size*2,trianglesBefore:input.length/3,trianglesAfter:indices.length/3};
}
