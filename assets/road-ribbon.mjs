// A bounded bevel stroke of the original polyline, with no centreline smoothing.
// Adjacent segment strips overlap at bends. Subtract their already-covered
// areas before triangulation so transparent road surfaces never draw twice.
const EPS=1e-9, AREA_EPS=1e-8;
const finitePoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const area=p=>Math.abs(p.reduce((s,a,i)=>s+orient(p[0],a,p[(i+1)%p.length]),0))/2;
function clean(p){
 const out=[];
 for(const v of p)if(!out.length||Math.hypot(v[0]-out.at(-1)[0],v[1]-out.at(-1)[1])>EPS)out.push(v);
 if(out.length>1&&Math.hypot(out[0][0]-out.at(-1)[0],out[0][1]-out.at(-1)[1])<=EPS)out.pop();
 return out.length>=3&&area(out)>AREA_EPS?out:[];
}
// Half-plane clipping preserves convexity. UVs are recovered later from the
// source triangle's affine map, rather than from any cutting triangle.
function clip(p,a,b,inside){
 if(!p.length)return[];
 const out=[];let prev=p.at(-1),d0=orient(a,b,prev),keep0=inside?d0>=0:d0<=0;
 for(const next of p){
  const d1=orient(a,b,next),keep1=inside?d1>=0:d1<=0;
  if(keep0!==keep1){const t=d0/(d0-d1);out.push([prev[0]+(next[0]-prev[0])*t,prev[1]+(next[1]-prev[1])*t]);}
  if(keep1)out.push(next);
  prev=next;d0=d1;keep0=keep1;
 }
 return clean(out);
}
function subtract(p,triangle){
 let intersection=p;
 for(let i=0;i<3&&intersection.length;i++)intersection=clip(intersection,triangle[i],triangle[(i+1)%3],true);
 if(!intersection.length)return[p];
 const pieces=[];let rest=p;
 for(let i=0;i<3&&rest.length;i++){
  const a=triangle[i],b=triangle[(i+1)%3],outside=clip(rest,a,b,false);
  if(outside.length)pieces.push(outside);
  rest=clip(rest,a,b,true);
 }
 return pieces;
}
const bounds=p=>({minX:Math.min(...p.map(v=>v[0])),maxX:Math.max(...p.map(v=>v[0])),minZ:Math.min(...p.map(v=>v[1])),maxZ:Math.max(...p.map(v=>v[1]))});
const intersects=(a,b)=>Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX)>EPS&&Math.min(a.maxZ,b.maxZ)-Math.max(a.minZ,b.minZ)>EPS;
function affine(points,uv){
 const a=points[0],b=points[1],c=points[2],det=orient(a,b,c),dx=b[0]-a[0],dz=b[1]-a[1],ex=c[0]-a[0],ez=c[1]-a[1];
 return p=>[0,1].map(i=>uv[0][i]+((uv[1][i]-uv[0][i])*ez-(uv[2][i]-uv[0][i])*dz)/det*(p[0]-a[0])+((uv[2][i]-uv[0][i])*dx-(uv[1][i]-uv[0][i])*ex)/det*(p[1]-a[1]));
}

/**
 * buildRoadRibbon({points, run?, halfWidths?, halfWidth=2, columns=9,
 *                  uvRepeat=3, maxSegmentLength=2.6, minHalfWidth=0})
 *
 * points are [x,z]. halfWidth can be a number or (run, point, index)=>number;
 * halfWidths supplies one width per input point instead. Existing run values
 * must increase on nonzero segments. Added rows interpolate run and widths.
 *
 * Returns flat positions [x,z,...], uv [run/uvRepeat,cross,...], indices,
 * and diagnostics. Increasing cross follows the right side of the route.
 * The nine-column source strips retain terrain draping rows. Clipping adds
 * vertices at intersections; those also need height sampling by the caller.
 * No output position is farther than maxHalfWidth from the input polyline.
 */
export function buildRoadRibbon(options={}){
 const {points,run,halfWidths,halfWidth=2,columns=9,uvRepeat=3,maxSegmentLength=2.6,minHalfWidth=0}=options;
 if(!Array.isArray(points)||points.length<2||points.some(p=>!finitePoint(p)))throw new TypeError('Ribbon needs finite [x,z] points');
 if(!Number.isInteger(columns)||columns<3||columns%2!==1||![uvRepeat,maxSegmentLength,minHalfWidth].every(Number.isFinite)||uvRepeat<=0||maxSegmentLength<=0||minHalfWidth<0)throw new TypeError('Invalid ribbon sampling options');
 if(run&&(!Array.isArray(run)||run.length!==points.length||run.some(v=>!Number.isFinite(v))))throw new TypeError('Invalid ribbon run values');
 if(halfWidths&&(!Array.isArray(halfWidths)||halfWidths.length!==points.length))throw new TypeError('One halfwidth is needed per point');
 const originalRun=run?run.slice():[0];
 if(!run)for(let i=1;i<points.length;i++)originalRun.push(originalRun.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
 const widths=points.map((p,i)=>halfWidths?halfWidths[i]:typeof halfWidth==='function'?halfWidth(originalRun[i],p.slice(),i):halfWidth);
 if(widths.some(w=>!Number.isFinite(w)||w<=0||w<minHalfWidth))throw new RangeError('Halfwidths must be finite, positive, and above minHalfWidth');
 const rows=[];
 for(let i=0;i<points.length-1;i++){
  const a=points[i],b=points[i+1],length=Math.hypot(b[0]-a[0],b[1]-a[1]),delta=originalRun[i+1]-originalRun[i];
  if(length<=EPS){if(Math.abs(delta)>EPS)throw new RangeError('Coincident points cannot advance run');continue;}
  if(delta<=0)throw new RangeError('Run must increase along the route');
  const count=Math.max(1,Math.ceil(length/maxSegmentLength));
  for(let j=0;j<count;j++){const t=j/count;rows.push({p:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],run:originalRun[i]+delta*t,w:widths[i]+(widths[i+1]-widths[i])*t});}
 }
 rows.push({p:points.at(-1).slice(),run:originalRun.at(-1),w:widths.at(-1)});
 if(rows.length<2)throw new RangeError('Ribbon needs a nonzero segment');
 const positions=[],uv=[],indices=[],raw=[],cells=new Map(),vertexMap=new Map(),fragments=[];
 const cellSize=Math.max(maxSegmentLength,Math.max(...widths)*2);
 const diagnostics={sourceRows:rows.length,columns,rawTriangles:0,triangles:0,clippedPieces:0,overlapTests:0,alignedEdgeVertices:0,droppedDegenerate:0,minHalfWidth:Math.min(...widths),maxHalfWidth:Math.max(...widths)};
 const cellKeys=b=>{const keys=[];for(let x=Math.floor(b.minX/cellSize);x<=Math.floor(b.maxX/cellSize);x++)for(let z=Math.floor(b.minZ/cellSize);z<=Math.floor(b.maxZ/cellSize);z++)keys.push(x+','+z);return keys;};
 const vertex=(p,t)=>{const key=p[0]+','+p[1]+','+t[0]+','+t[1];if(vertexMap.has(key))return vertexMap.get(key);const id=positions.length/2;positions.push(...p);uv.push(...t);vertexMap.set(key,id);return id;};
 function emit(p,map){
  const quantized=clean(p.map(v=>v.map(Math.fround)));
  if(!quantized.length){diagnostics.droppedDegenerate++;return;}
  const centre=quantized.length>3?[Math.fround(quantized.reduce((s,v)=>s+v[0],0)/quantized.length),Math.fround(quantized.reduce((s,v)=>s+v[1],0)/quantized.length)]:null;
  const fans=centre?quantized.map((v,i)=>[centre,quantized[(i+1)%quantized.length],v]):[[quantized[0],quantized[2],quantized[1]]];
  for(const triangle of fans){
   // XZ clockwise is +Y. Float32 checks match the eventual BufferGeometry.
   const texture=triangle.map(v=>map(v).map((value,k)=>Math.fround(k===1?Math.max(0,Math.min(1,value)):value)));
   if(orient(...triangle)>=-AREA_EPS||texture.some(t=>t.some(v=>!Number.isFinite(v)))||orient(...texture)<=AREA_EPS){diagnostics.droppedDegenerate++;continue;}
   indices.push(...triangle.map((v,k)=>vertex(v,texture[k])));diagnostics.triangles++;
  }
 }
 function cover(points,texture){
  const signed=orient(...points);if(Math.abs(signed)<=AREA_EPS)return;
  if(signed<0){points=[points[0],points[2],points[1]];texture=[texture[0],texture[2],texture[1]];}
  const b=bounds(points),keys=cellKeys(b),candidates=new Set();for(const key of keys)for(const id of cells.get(key)||[])candidates.add(id);
  let pieces=[points];
  for(const id of [...candidates].sort((a,b)=>a-b)){
   const cutter=raw[id];if(!intersects(b,cutter.bounds))continue;
   const next=[];
   for(const p of pieces){diagnostics.overlapTests++;if(!intersects(bounds(p),cutter.bounds)){next.push(p);continue;}next.push(...subtract(p,cutter.points));}
   pieces=next;if(!pieces.length)break;
  }
  const map=affine(points,texture);for(const p of pieces)fragments.push({points:p,map});
  diagnostics.clippedPieces+=pieces.length;diagnostics.rawTriangles++;
  const id=raw.length;raw.push({points,bounds:b});for(const key of keys){if(!cells.has(key))cells.set(key,[]);cells.get(key).push(id);}
 }
 function quad(p,t){cover([p[0],p[1],p[2]],[t[0],t[1],t[2]]);cover([p[0],p[2],p[3]],[t[0],t[2],t[3]]);}
 const directions=rows.slice(1).map((b,i)=>{const a=rows[i],dx=b.p[0]-a.p[0],dz=b.p[1]-a.p[1],l=Math.hypot(dx,dz);return{tx:dx/l,tz:dz/l,nx:dz/l,nz:-dx/l};});
 for(let i=0;i<rows.length-1;i++){
  const a=rows[i],b=rows[i+1],d=directions[i],offset=(r,f)=>[r.p[0]+d.nx*r.w*f,r.p[1]+d.nz*r.w*f];
  for(let j=0;j<columns-1;j++){
   const v0=j/(columns-1),v1=(j+1)/(columns-1);
   quad([offset(a,v0*2-1),offset(b,v0*2-1),offset(b,v1*2-1),offset(a,v1*2-1)],[[a.run/uvRepeat,v0],[b.run/uvRepeat,v0],[b.run/uvRepeat,v1],[a.run/uvRepeat,v1]]);
  }
  if(i===rows.length-2)continue;
  const next=directions[i+1],turn=d.tx*next.tz-d.tz*next.tx;if(Math.abs(turn)<=EPS)continue;
  const side=Math.sign(turn),outerA=[d.nx*side,d.nz*side],outerB=[next.nx*side,next.nz*side],rings=(columns-1)/2;
  const across=Math.max(1,Math.ceil(b.w*Math.hypot(outerA[0]-outerB[0],outerA[1]-outerB[1])/maxSegmentLength));
  const at=(r,t)=>[b.p[0]+b.w*r*(outerA[0]*(1-t)+outerB[0]*t),b.p[1]+b.w*r*(outerA[1]*(1-t)+outerB[1]*t)];
  const texture=p=>[(b.run+(p[0]-b.p[0])*d.tx+(p[1]-b.p[1])*d.tz)/uvRepeat,.5+((p[0]-b.p[0])*d.nx+(p[1]-b.p[1])*d.nz)/(2*b.w)];
  for(let r=0;r<rings;r++)for(let j=0;j<across;j++){
   const p=[at(r/rings,j/across),at((r+1)/rings,j/across),at((r+1)/rings,(j+1)/across),at(r/rings,(j+1)/across)];quad(p,p.map(texture));
  }
 }
 // A clipping point on an earlier triangle's edge must also be a vertex of
 // that earlier face. Otherwise height sampling would leave a T junction:
 // one side follows the ground there while its neighbour spans straight past.
 // Canonical points and matching edge subdivisions also keep Float32 rounding
 // from creating microscopic overlaps between those neighbouring pieces.
 const canonical=new Map(),pointCells=new Map();
 const shared=p=>{const key=p.map(v=>Math.round(v*1e8)).join(',');if(!canonical.has(key)){const q=p.slice();canonical.set(key,q);const k=Math.floor(q[0]/cellSize)+','+Math.floor(q[1]/cellSize);if(!pointCells.has(k))pointCells.set(k,[]);pointCells.get(k).push(q);}return canonical.get(key);};
 for(const f of fragments)f.points=f.points.map(shared);
 for(const f of fragments){
  const p=[];
  for(let i=0;i<f.points.length;i++){
   const a=f.points[i],b=f.points[(i+1)%f.points.length],dx=b[0]-a[0],dz=b[1]-a[1],length2=dx*dx+dz*dz;
   p.push(a);if(length2<EPS*EPS)continue;
   const between=[],lineTolerance=1e-7*Math.sqrt(length2);
   for(const key of cellKeys({minX:Math.min(a[0],b[0])-1e-7,maxX:Math.max(a[0],b[0])+1e-7,minZ:Math.min(a[1],b[1])-1e-7,maxZ:Math.max(a[1],b[1])+1e-7}))for(const v of pointCells.get(key)||[]){
    if(v===a||v===b||Math.abs(dx*(v[1]-a[1])-dz*(v[0]-a[0]))>lineTolerance)continue;
    const t=((v[0]-a[0])*dx+(v[1]-a[1])*dz)/length2;if(t>EPS&&t<1-EPS)between.push({t,p:v});
   }
   between.sort((a,b)=>a.t-b.t||a.p[0]-b.p[0]||a.p[1]-b.p[1]);p.push(...between.map(v=>v.p));diagnostics.alignedEdgeVertices+=between.length;
  }
  emit(p,f.map);
 }
 return{positions,uv,indices,diagnostics};
}
