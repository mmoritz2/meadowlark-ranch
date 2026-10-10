// A continuous concealed coil and raised pull replace disconnected flat metal teeth.
// Every sample carries the supporting shirt/collar triangle's skin weights.
export function fittedZip(T,{fit,geo,path,trim}){
 const pieces=[],push=(name,g,m)=>pieces.push({name,geometry:g,material:m});
 const strip=(rows,width,height)=>{const vs=[],ids=[];let prev=null;
  for(const[x,y]of rows){const start=vs.length,profile=[[-.5,0],[-.35,.7],[0,1],[.35,.7],[.5,0]],v=profile.map(([u,z])=>fit(x+u*width,y,.00165+z*height));
   if(v.some(p=>!p)){prev=null;continue;}vs.push(...v);
   if(prev!==null)for(let k=0;k<4;k++)ids.push(prev+k,prev+k+1,start+k,prev+k+1,start+k+1,start+k);prev=start;
  }return geo(vs,ids);
 };
 const coil=new T.MeshStandardMaterial({color:new T.Color(trim).multiplyScalar(.65),roughness:.77,metalness:0,side:T.DoubleSide});
 push('Technical_Zip_Coil',strip(path,.0024,.0006),coil);
 const top=path.at(-1)[1],vertices=[],indices=[];
 const contour=(cx,cy,w,h,r)=>{const p=[];for(const[x,y,a]of[[cx+w/2-r,cy+h/2-r,0],[cx-w/2+r,cy+h/2-r,Math.PI/2],[cx-w/2+r,cy-h/2+r,Math.PI],[cx+w/2-r,cy-h/2+r,Math.PI*1.5]])for(let k=0;k<=3;k++){const t=a+k*Math.PI/6;p.push([x+Math.cos(t)*r,y+Math.sin(t)*r]);}return p;};
 const loft=(rings,closed=true)=>{const offset=vertices.length,points=rings.map(r=>r.xy.map(([x,y])=>fit(x,y,r.z)));if(points.some(ps=>ps.some(v=>!v)))return;
  points.forEach(ps=>vertices.push(...ps));const n=points[0].length;
  for(let row=0;row<points.length-1;row++)for(let i=0;i<n;i++){const a=offset+row*n+i,b=offset+row*n+(i+1)%n,c=a+n,d=b+n;indices.push(a,b,c,b,d,c);}
  if(closed){for(let i=1;i<n-1;i++)indices.push(offset,offset+i+1,offset+i);const end=offset+(points.length-1)*n;for(let i=1;i<n-1;i++)indices.push(end,end+i,end+i+1);}
 };
 // Rounded slider and a shallow ring-shaped pull with a visible central opening.
 loft([{xy:contour(0,top-.0055,.0056,.009,.0010),z:.0017},{xy:contour(0,top-.0055,.0048,.0082,.0008),z:.0032}]);
 const outer=contour(0,top-.014,.0045,.011,.0012),inner=contour(0,top-.014,.0018,.0065,.00065);
 loft([{xy:outer,z:.0028},{xy:outer,z:.0035},{xy:inner,z:.0035},{xy:inner,z:.0028},{xy:outer,z:.0028}],false);
 push('Technical_Zipper',geo(vertices,indices),new T.MeshStandardMaterial({color:'#9aa09d',roughness:.48,metalness:.35,side:T.DoubleSide}));
 return pieces;
}
