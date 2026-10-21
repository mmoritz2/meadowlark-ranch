// Same synchronous private constructor and actual-face support index as reviewed single-owner implementation.
const RAW_BOULDER_PROFILE='raw-boulder-batch-prototype-1';
function privateClone(key,make){
 const previous=Math.random;let seed=2166136261,draws=0;
 for(const c of RAW_BOULDER_PROFILE+'|'+key)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
 Math.random=()=>{draws++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 try{return{value:make(),draws};}finally{Math.random=previous;}
}
// Exact actual-face vertical query. Only this owner's triangles enter its small
// subcells. It is a support acceleration index, never an enclosing box floor.
function supportIndex(geometry,matrix){
 const P=geometry.attributes.position,I=geometry.index,M=matrix.elements,step=.2,cells=new Map();
 const world=j=>{const x=P.getX(j),y=P.getY(j),z=P.getZ(j);return[M[0]*x+M[4]*y+M[8]*z+M[12],M[1]*x+M[5]*y+M[9]*z+M[13],M[2]*x+M[6]*y+M[10]*z+M[14]];};
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,faces=0,maxCellFaces=0;
 for(let i=0;i<I.count;i+=3){
  const [a,b,c]=[0,1,2].map(k=>world(I.getX(i+k))),den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
  if(Math.abs(den)<1e-10)continue;
  const e={a,b,c,den,minX:Math.min(a[0],b[0],c[0]),maxX:Math.max(a[0],b[0],c[0]),minZ:Math.min(a[2],b[2],c[2]),maxZ:Math.max(a[2],b[2],c[2])};faces++;
  minX=Math.min(minX,e.minX);maxX=Math.max(maxX,e.maxX);minZ=Math.min(minZ,e.minZ);maxZ=Math.max(maxZ,e.maxZ);
  for(let x=Math.floor(e.minX/step);x<=Math.floor(e.maxX/step);x++)for(let z=Math.floor(e.minZ/step);z<=Math.floor(e.maxZ/step);z++){const k=x+','+z;if(!cells.has(k))cells.set(k,[]);const list=cells.get(k);list.push(e);maxCellFaces=Math.max(maxCellFaces,list.length);}
 }
 const heightAt=(x,z)=>{
  if(x<minX||x>maxX||z<minZ||z>maxZ)return-Infinity;let h=-Infinity;
  for(const e of cells.get(Math.floor(x/step)+','+Math.floor(z/step))||[]){
   if(x<e.minX-1e-10||x>e.maxX+1e-10||z<e.minZ-1e-10||z>e.maxZ+1e-10)continue;
   const{a,b,c,den}=e,u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,w=1-u-v;
   if(Math.min(u,v,w)>=-1e-10)h=Math.max(h,u*a[1]+v*b[1]+w*c[1]);
  }return h;
 };
 return{heightAt,stats:{step,cells:cells.size,projectedFaces:faces,maxCellFaces,bounds:{minX,maxX,minZ,maxZ}}};
}

export {privateClone,supportIndex};
