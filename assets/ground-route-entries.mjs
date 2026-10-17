// Original route ownership only. No placement, terrain, constructor or RNG read.
// Equal reversed/rotated closed loops are one ground-mask input; overlapping
// distinct routes retain their real width and combine through channel-wise max.
function canonicalLine(points){
 let line=points.map(p=>JSON.stringify([p[0],p[1]]));
 const closed=line.length>2&&line[0]===line[line.length-1];if(closed)line=line.slice(0,-1);
 if(!closed){const a=line.join(';'),b=line.slice().reverse().join(';');return a<b?a:b;}
 const choices=[];
 for(const order of[line,line.slice().reverse()]){const smallest=order.slice().sort()[0];for(let i=0;i<order.length;i++)if(order[i]===smallest)choices.push([...order.slice(i),...order.slice(0,i)].join(';'));}
 return choices.sort()[0]+';closed';
}
// Match the actual ranch ribbon's source sampling exactly. These are its
// centre points only; the rendered road and its physical height stay owned by
// the original builder, whose code and buffers this helper never changes.
export function sampleGroundBasePaths(paths){
 const cr=(p0,p1,p2,p3,t)=>{const t2=t*t,t3=t2*t;return .5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3);};
 return paths.map(pl=>{const pts=[];for(let i=0;i<pl.length-1;i++){
  const p0=pl[Math.max(0,i-1)],p1=pl[i],p2=pl[i+1],p3=pl[Math.min(pl.length-1,i+2)],length=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]),steps=Math.max(3,Math.round(length/1.6));
  for(let k=0;k<steps;k++){const t=k/steps;pts.push([cr(p0[0],p1[0],p2[0],p3[0],t),cr(p0[1],p1[1],p2[1],p3[1],t)]);}
 }pts.push(pl[pl.length-1]);return pts;});
}
export function normalizeGroundRouteEntries(routes,width=2.9,strength=1){
 const seen=new Set(),result=[];
 for(const route of routes||[]){
  const pts=Array.isArray(route)?route:route?.pts,w=route?.width??route?.w??width,s=route?.strength??strength;
  if(!Array.isArray(pts)||pts.length<2)continue;
  if(!pts.every(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0]+p[1]))||!Number.isFinite(w+s)||w<=0||s<0||s>1)throw Error('Actual finite route points, width and strength required');
  if(pts.every(p=>p[0]===pts[0][0]&&p[1]===pts[0][1]))continue;
  const key=canonicalLine(pts)+'|'+w+'|'+s;if(seen.has(key))continue;seen.add(key);
  result.push({pts,width:w,strength:s});
 }
 return result;
}
