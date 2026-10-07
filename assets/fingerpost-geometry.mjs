// Original closed fingerpost boards. Pure mesh data: no scene resources or RNG.
const TAU_EPS=1e-12;
const norm=v=>{const n=Math.hypot(...v);return v.map(x=>x/(n||1));};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
function insetPolygon(points,d){
 return points.map((p,i)=>{
  const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];
  const n1=norm([-(p[1]-a[1]),p[0]-a[0]]),n2=norm([-(b[1]-p[1]),b[0]-p[0]]);
  const c1=n1[0]*p[0]+n1[1]*p[1]+d,c2=n2[0]*p[0]+n2[1]*p[1]+d,det=n1[0]*n2[1]-n1[1]*n2[0];
  if(Math.abs(det)<TAU_EPS)throw Error('Degenerate fingerpost bevel');
  return[(c1*n2[1]-c2*n1[1])/det,(n1[0]*c2-n2[0]*c1)/det];
 });
}
export function createFingerpostBoardData({arms,x,z,width=2.45,height=.40,thickness=.07,bevel=.009,grainMetres=1.8}){
 if(!arms?.length||!Number.isFinite(x)||!Number.isFinite(z)||width<=0||height<=0||thickness<=0||grainMetres<=0||bevel<=0||bevel>=Math.min(height,thickness)*.45)throw Error('Invalid fingerpost dimensions');
 const position=[],normal=[],uv=[],grainUv=[],index=[],boards=[],fasteners=[],supports=[];
 const CW=512,CH=112,tail=6,tip=CW-6,notch=CH*.5;
 // Same painted outline and letter coordinates as the old two-face atlas.
 const outer=[[tail,8],[tip-notch,8],[tip,CH/2],[tip-notch,CH-8],[tail,CH-8]].map(([u,v])=>[(u/CW-.5)*width,(.5-v/CH)*height]).reverse();
 const inner=insetPolygon(outer,bevel),n=arms.length;
 for(let arm=0;arm<n;arm++){
  const[label,tx,tz]=arms[arm],yaw=Math.atan2(tx-x,tz-z),dx=Math.sin(yaw),dz=Math.cos(yaw),U=[dx,0,dz],N=[-dz,0,dx],y=2.62-arm*.50,offset=width/2+.09;
  const point=(p,w)=>[dx*(offset+p[0])+N[0]*w,y+p[1],dz*(offset+p[0])+N[2]*w];
  const faceUv=(p,side)=>{const u=p[0]/width+.5,face=arm+(side<0?n:0);return[side>0?u:1-u,1-(face+.5-p[1]/height)/(n*2)];};
  const grain=(p,w,normal)=>{
   const along=Math.abs(normal[0]*U[0]+normal[2]*U[2]),up=Math.abs(normal[1]),face=Math.abs(normal[0]*N[0]+normal[2]*N[2]);
   if(along>up+1e-6&&along>face+1e-6)return[w/grainMetres+.15,p[1]/grainMetres+.43];
   return[(offset+p[0])/grainMetres+.15,(up>face+1e-6?w:p[1])/grainMetres+.43];
  };
  function polygon(vertices,normals,textureUvs,grains){
   const start=position.length/3;
   vertices.forEach((p,i)=>{position.push(...p);normal.push(...normals[i]);uv.push(...textureUvs[i]);grainUv.push(...grains[i]);});
   for(let i=1;i<vertices.length-1;i++){
    const a=vertices[0],b=vertices[i],c=vertices[i+1],geometric=cross(sub(b,a),sub(c,a)),facing=normals[0];
    const forward=geometric.reduce((s,v,k)=>s+v*facing[k],0)>0;
    index.push(start,start+(forward?i:i+1),start+(forward?i+1:i));
   }
  }
  const startIndex=index.length;
  for(const side of[1,-1]){
   const w=side*thickness/2;
   polygon(inner.map(p=>point(p,w)),inner.map(()=>N.map(v=>v*side)),inner.map(p=>faceUv(p,side)),inner.map(p=>grain(p,w,N.map(v=>v*side))));
   for(let i=0;i<outer.length;i++){
    const j=(i+1)%outer.length,e=sub(outer[j],outer[i]),out=norm([e[1],-e[0]]),bn=norm([U[0]*out[0]+N[0]*side,out[1],U[2]*out[0]+N[2]*side]);
    const pts=[inner[i],inner[j],outer[j],outer[i]],ws=[w,w,side*(thickness/2-bevel),side*(thickness/2-bevel)];
    polygon(pts.map((p,k)=>point(p,ws[k])),pts.map(()=>bn),pts.map(p=>faceUv(p,side)),pts.map((p,k)=>grain(p,ws[k],bn)));
   }
  }
  for(let i=0;i<outer.length;i++){
   const j=(i+1)%outer.length,e=sub(outer[j],outer[i]),out=norm([e[1],-e[0]]),sn=[U[0]*out[0],out[1],U[2]*out[0]],pts=[outer[i],outer[j],outer[j],outer[i]],ws=[-thickness/2+bevel,-thickness/2+bevel,thickness/2-bevel,thickness/2-bevel];
   polygon(pts.map((p,k)=>point(p,ws[k])),pts.map(()=>sn),pts.map(()=>faceUv([-.48*width,0],1)),pts.map((p,k)=>grain(p,ws[k],sn)));
  }
  for(const side of[1,-1])for(const dy of[-.085,.085]){
   const length=.33,h=.036,d=.010,center=point([.185-offset,dy],side*(thickness/2+d/2));
   supports.push({arm,side,position:center,size:[length,h,d],matrix:[...U.map(v=>v*length),0,0,h,0,0,...N.map(v=>v*d),0,...center,1],postContact:point([.025-offset,dy],side*(thickness/2+d/2)),boardContact:point([.25-offset,dy],side*thickness/2)});
   fasteners.push({position:point([-width/2+.22,dy],side*(thickness/2+d+.0065)),normal:N.map(v=>v*side),arm});
  }
  boards.push({label,destination:[tx,tz],yaw,y,center:[dx*offset,y,dz*offset],direction:U,normal:N,indexStart:startIndex,indexCount:index.length-startIndex,outline:outer.map(p=>p.slice())});
 }
 return{position:new Float32Array(position),normal:new Float32Array(normal),uv:new Float32Array(uv),grainUv:new Float32Array(grainUv),index:new Uint16Array(index),boards,fasteners,supports,width,height,thickness,bevel,grainMetres,triangles:index.length/3};
}
