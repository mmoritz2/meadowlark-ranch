// Split road paint at the terrain's cell edges and diagonal before sampling
// height. Sampling only the original road vertices lets a triangle cut through
// a hill even when all three corners sit above it.
const area2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function clip(polygon,distance){
 const result=[];let a=polygon.at(-1),da=distance(a);
 for(const b of polygon){
  const db=distance(b),insideA=da>=0,insideB=db>=0;
  if(insideA!==insideB){const t=da/(da-db);result.push(a.map((v,i)=>v+(b[i]-v)*t));}
  if(insideB)result.push(b);
  a=b;da=db;
 }
 return result;
}

/** Retain each route's footprint and affine UV/color/coverage attributes.
 * Terrain cells use the same x+z diagonal as terrainH. Pure array work creates
 * no THREE resources and does not consume the world's random sequence.
 */
export function drapeRoadSurface({positions,uv,colors,strokeMask,indices,ranges,
 terrainStep,heightAt,origin=-500,lift=.055}){
 if(!(Number.isFinite(terrainStep)&&terrainStep>0&&Number.isFinite(origin)&&Number.isFinite(lift))||typeof heightAt!=='function')throw new TypeError('Invalid road terrain sampler');
 if([positions,uv,colors,strokeMask].some(a=>!a||!a.every(Number.isFinite)))throw new RangeError('Nonfinite road source attributes');
 const count=positions.length/3;
 if(!Number.isInteger(count)||uv.length!==count*2||colors.length!==count*4||strokeMask.length!==count||indices.length%3)throw new TypeError('Road attributes must share vertex and triangle counts');
 const result={positions:[],uv:[],colors:[],strokeMask:[],indices:[],ranges:{},
  diagnostics:{sourceTriangles:indices.length/3,triangles:0,discardedTriangles:0,discardedProjectedArea:0,terrainStep,lift}};
 const sourceVertex=id=>[positions[id*3],positions[id*3+2],uv[id*2],uv[id*2+1],...colors.slice(id*4,id*4+4),strokeMask[id]];
 const sections=Object.entries(ranges||{road:{indexStart:0,indexCount:indices.length}}).sort((a,b)=>a[1].indexStart-b[1].indexStart);
 let consumed=0;
 for(const [id,range]of sections){
  if(range.indexStart!==consumed||range.indexCount%3||range.indexStart+range.indexCount>indices.length)throw new RangeError('Road ranges must partition the index buffer');
  const indexStart=result.indices.length,vertexStart=result.positions.length/3,vertices=new Map();
  const vertex=point=>{
   const p=point.map(Math.fround),key=p.join(',');
   if(vertices.has(key))return vertices.get(key);
   const y=heightAt(p[0],p[1])+lift;
   if(!p.every(Number.isFinite)||!Number.isFinite(y))throw new RangeError('Nonfinite draped road vertex');
   const index=result.positions.length/3;
   result.positions.push(p[0],Math.fround(y),p[1]);result.uv.push(p[2],p[3]);
   result.colors.push(p[4],p[5],p[6],p[7]);result.strokeMask.push(p[8]);vertices.set(key,index);return index;
  };
  let winding=-1,uvWinding=1;
  const emit=polygon=>{
   if(polygon.length<3)return;
   for(let i=1;i<polygon.length-1;i++){
    const triangle=[polygon[0],polygon[i],polygon[i+1]].map(p=>p.map(Math.fround));
    const projected=area2(...triangle),texture=area2(...triangle.map(p=>[p[2],p[3]]));
    // Float32 can invert or collapse very thin pieces at cell intersections.
    // Reject those slivers before normal-map derivatives encounter singular UVs.
    if(projected*winding<=2e-9||texture*uvWinding<=1e-10){
     result.diagnostics.discardedTriangles++;result.diagnostics.discardedProjectedArea+=Math.abs(projected)*.5;continue;
    }
    result.indices.push(...triangle.map(vertex));
   }
  };
  for(let i=range.indexStart;i<range.indexStart+range.indexCount;i+=3){
   const ids=indices.slice(i,i+3);
   if(ids.some(id=>!Number.isInteger(id)||id<0||id>=count))throw new RangeError('Invalid road triangle index');
   const tri=Array.from(ids,sourceVertex),xs=tri.map(p=>p[0]),zs=tri.map(p=>p[1]);
   winding=Math.sign(area2(...tri));uvWinding=Math.sign(area2(...tri.map(p=>[p[2],p[3]])));if(winding===0||uvWinding===0)continue;
   const minX=Math.floor((Math.min(...xs)-origin)/terrainStep),maxX=Math.floor((Math.max(...xs)-origin)/terrainStep);
   const minZ=Math.floor((Math.min(...zs)-origin)/terrainStep),maxZ=Math.floor((Math.max(...zs)-origin)/terrainStep);
   for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
    const x0=origin+x*terrainStep,z0=origin+z*terrainStep;
    let polygon=tri;
    for(const plane of [p=>p[0]-x0,p=>x0+terrainStep-p[0],p=>p[1]-z0,p=>z0+terrainStep-p[1]]){
     if(polygon.length<3)break;polygon=clip(polygon,plane);
    }
    if(polygon.length<3)continue;
    const diagonal=p=>terrainStep-(p[0]-x0)-(p[1]-z0);
    emit(clip(polygon,diagonal));emit(clip(polygon,p=>-diagonal(p)));
   }
  }
  consumed+=range.indexCount;
  result.ranges[id]={vertexStart,vertexCount:result.positions.length/3-vertexStart,indexStart,indexCount:result.indices.length-indexStart};
 }
 if(consumed!==indices.length)throw new RangeError('Road ranges omit triangles');
 result.diagnostics.triangles=result.indices.length/3;
 return result;
}
