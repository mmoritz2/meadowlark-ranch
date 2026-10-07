import assert from 'node:assert/strict';
import test from 'node:test';
import {buildRoadRibbon} from '../assets/road-ribbon.mjs';

const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const point=(array,i)=>array.slice(i*2,i*2+2);
const triangles=mesh=>Array.from({length:mesh.indices.length/3},(_,i)=>mesh.indices.slice(i*3,i*3+3).map(id=>point(mesh.positions,id)));
function inside(p,t,epsilon=1e-8){return t.every((a,i)=>cross(a,t[(i+1)%3],p)<=epsilon);}
// Independently intersect triangles using contained vertices, edge crossings,
// and a convex hull, rather than repeating the helper's polygon subtraction.
function intersectionArea(a,b){
 const p=[...a.filter(v=>inside(v,b)),...b.filter(v=>inside(v,a))];
 for(let i=0;i<3;i++)for(let j=0;j<3;j++){
  const x=a[i],y=a[(i+1)%3],v=b[j],w=b[(j+1)%3],dx=y[0]-x[0],dz=y[1]-x[1],ex=w[0]-v[0],ez=w[1]-v[1],det=dx*ez-dz*ex;
  if(Math.abs(det)<1e-12)continue;
  const t=((v[0]-x[0])*ez-(v[1]-x[1])*ex)/det,u=((v[0]-x[0])*dz-(v[1]-x[1])*dx)/det;
  if(t>=0&&t<=1&&u>=0&&u<=1)p.push([x[0]+dx*t,x[1]+dz*t]);
 }
 p.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const half=points=>{const h=[];for(const v of points){while(h.length>1&&cross(h.at(-2),h.at(-1),v)<=0)h.pop();h.push(v);}return h;};
 const h=half(p).slice(0,-1).concat(half(p.slice().reverse()).slice(0,-1));
 if(h.length<3)return 0;
 return Math.abs(h.reduce((s,a,i)=>s+cross(h[0],a,h[(i+1)%h.length]),0))/2;
}
function overlap(mesh){
 const ts=triangles(mesh),cells=new Map(),seen=new Set();let maxArea=0,totalArea=0,pairs=0;
 for(let i=0;i<ts.length;i++){
  const t=ts[i],xs=t.map(p=>p[0]),zs=t.map(p=>p[1]),keys=[];
  for(let x=Math.floor(Math.min(...xs)/3);x<=Math.floor(Math.max(...xs)/3);x++)for(let z=Math.floor(Math.min(...zs)/3);z<=Math.floor(Math.max(...zs)/3);z++)keys.push(x+','+z);
  for(const key of keys)for(const j of cells.get(key)||[]){
   const id=j+','+i;if(seen.has(id))continue;seen.add(id);
   const s=ts[j];if(Math.min(...xs)>=Math.max(...s.map(p=>p[0]))||Math.max(...xs)<=Math.min(...s.map(p=>p[0]))||Math.min(...zs)>=Math.max(...s.map(p=>p[1]))||Math.max(...zs)<=Math.min(...s.map(p=>p[1])))continue;
   const a=intersectionArea(t,s);pairs++;maxArea=Math.max(maxArea,a);totalArea+=a;
  }
  for(const key of keys){if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);}
 }
 return{maxArea,totalArea,pairs};
}
function distanceToRoute(p,pts){
 let best=Infinity;
 for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz,t=l2?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/l2)):0;
  best=Math.min(best,Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t));
 }
 return best;
}
function validate(mesh,pts,maxWidth){
 assert.ok(mesh.indices.length>0);
 assert.equal(mesh.positions.length,mesh.uv.length);
 assert.ok([...mesh.positions,...mesh.uv].every(Number.isFinite));
 assert.ok(mesh.positions.every(v=>Math.fround(v)===v),'Geometry is checked at Float32 precision');
 for(let i=1;i<mesh.uv.length;i+=2)assert.ok(mesh.uv[i]>=0&&mesh.uv[i]<=1,'Transverse UV stays inside the road texture');
 for(let i=0;i<mesh.indices.length;i+=3){
  const ids=mesh.indices.slice(i,i+3);for(const id of ids)assert.ok(Number.isInteger(id)&&id>=0&&id<mesh.positions.length/2);
  assert.ok(cross(...ids.map(id=>point(mesh.positions,id)))<-1e-8,'Every projected face points up');
  assert.ok(cross(...ids.map(id=>point(mesh.uv,id)))>1e-8,'Every UV triangle has a positive nonsingular determinant');
 }
 for(let i=0;i<mesh.positions.length/2;i++)assert.ok(distanceToRoute(point(mesh.positions,i),pts)<=maxWidth+5e-5,'Bevels remain inside the conservative corridor');
 const o=overlap(mesh);
 assert.ok(o.maxArea<1e-5,'Triangles must not overlap beyond Float32 subpixel tolerance: '+JSON.stringify(o));
 return o;
}
function coversRoute(mesh,pts,minHalfWidth=0){
 const ts=triangles(mesh);
 for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.max(1,Math.ceil(length/.25)),nx=(b[1]-a[1])/length,nz=-(b[0]-a[0])/length;
  for(let j=0;j<=count;j++)for(const offset of minHalfWidth?[-minHalfWidth,0,minHalfWidth]:[0]){const t=j/count,p=[a[0]+(b[0]-a[0])*t+nx*offset,a[1]+(b[1]-a[1])*t+nz*offset];assert.ok(ts.some(tr=>inside(p,tr,3e-5)),'The unchanged centreline and usable width stay covered at '+p);}
 }
}

test('straight road retains nine columns, longitudinal draping rows, and run UV',()=>{
 const points=[[0,0],[10,0]],r=buildRoadRibbon({points,run:[12,22],halfWidth:2});
 validate(r,points,2);assert.equal(r.diagnostics.sourceRows,5);assert.equal(r.diagnostics.columns,9);assert.equal(r.diagnostics.triangles,64);
 assert.equal(r.positions.length/2,45);assert.equal(Math.min(...r.uv.filter((_,i)=>i%2===0)),4);assert.equal(Math.max(...r.uv.filter((_,i)=>i%2===0)),Math.fround(22/3));
 assert.equal(triangles(r).reduce((s,t)=>s-Math.min(0,cross(...t))/2,0),40);
});
test('left and right ninety-degree bevels cover their corners without overlapping',()=>{
 for(const z of[-10,10]){const p=[[0,0],[10,0],[10,z]],r=buildRoadRibbon({points:p});validate(r,p,2);coversRoute(r,p);}
});
test('close zigzags, reversals, crossings, and large world coordinates stay bounded',()=>{
 const fixtures=[[[0,0],[10,0],[10,2],[8,2],[8,5],[13,5]],[[0,0],[5,0],[0,0]],[[0,0],[5,0],[5.1,.08],[4,1],[7,3]],[[-5,-5],[5,5],[-5,5],[5,-5]],[[330,250],[332,250],[331,251],[333,252]]];
 for(const p of fixtures){const r=buildRoadRibbon({points:p,halfWidth:2.12,minHalfWidth:1});validate(r,p,2.12);coversRoute(r,p);assert.equal(r.diagnostics.minHalfWidth,2.12);}
});
test('width interpolation does not mutate the centreline, run, or supplied widths',()=>{
 const points=[[0,0],[9,0],[9,8]],run=[4,13,21],halfWidths=[1.5,2.12,1.8],before=JSON.stringify({points,run,halfWidths});
 const r=buildRoadRibbon({points,run,halfWidths,minHalfWidth:1});validate(r,points,2.12);coversRoute(r,points);assert.equal(JSON.stringify({points,run,halfWidths}),before);
});
test('deterministic output and callback widths',()=>{
 const points=[[0,0],[7,0],[7,2],[5,3]],halfWidth=s=>2*(1+.04*Math.sin(s*.12)+.02*Math.sin(s*.047));
 assert.deepEqual(buildRoadRibbon({points,halfWidth}),buildRoadRibbon({points,halfWidth}));
});
test('invalid widths, run, sampling, and nonfinite inputs fail explicitly',()=>{
 for(const o of[{points:[[0,0],[NaN,1]]},{points:[[0,0],[0,0]]},{points:[[0,0],[1,1]],run:[1,1]},{points:[[0,0],[1,1]],halfWidth:0},{points:[[0,0],[1,1]],halfWidths:[2]},{points:[[0,0],[1,1]],halfWidth:Infinity},{points:[[0,0],[1,1]],columns:8},{points:[[0,0],[1,1]],maxSegmentLength:0},{points:[[0,0],[1,1]],halfWidth:.8,minHalfWidth:1}])assert.throws(()=>buildRoadRibbon(o));
});

// Real route fixture follows below. It includes the close western reconnection
// that folded the old strip while its unchanged centreline was rideable.
const riverwest=[
 [0,132],
 [-1.675087241641112,132.2293770846031],
 [-3.563348374344567,132.50238610649924],
 [-5.718749189299126,132.82391366843885],
 [-8.125533170172146,133.18116860414818],
 [-10.7413325523875,133.55459485976692],
 [-13.515301816762443,133.92247974078774],
 [-16.394185986770257,134.26249747765536],
 [-19.228019304842064,134.62714761688883],
 [-20.818679536561376,135.75143174459257],
 [-22.409339768280688,136.87571587229627],
 [-24,138],
 [-25.5,137.5],
 [-27,137],
 [-27.999155963189963,135.15239197244875],
 [-30.502829783113988,134.87985030526013],
 [-33.07725947237746,134.71025294615512],
 [-35.66761169971161,134.49287052916804],
 [-38.28017764830572,134.21980906232434],
 [-40.9182395473691,133.89821182466034],
 [-43.58528048469042,133.6382745104494],
 [-44.792640242345215,134.3191372552247],
 [-46,135],
 [-47.90971948633395,134.11040564255873],
 [-49.81943897266789,133.22081128511743],
 [-51.72915845900184,132.33121692767617],
 [-54.446831713289335,131.85381951574146],
 [-57.1154874205349,131.28008799121983],
 [-59,130],
 [-61,129.5],
 [-63,129],
 [-64.84287814588669,130.16207693312097],
 [-67.31328321645722,129.8096488141138],
 [-69.7942715200263,129.39160852797175],
 [-72.28994005687143,128.9560710286558],
 [-74.7990906795176,128.51095682105762],
 [-77.31899357831603,128.05998315451913],
 [-79.84650660136158,127.60646052800413],
 [-82.37838291537139,127.1536681525488],
 [-84.89282334137769,126.69670684485406],
 [-87.24242895385588,126.026802054823],
 [-88,125],
 [-89.5,124],
 [-91,123],
 [-93.0157510780437,123.96721555070418],
 [-95.03150215608741,124.93443110140836],
 [-97.50233454428022,124.58837163057909],
 [-99.96139862249908,124.36435692196902],
 [-100.98069931124954,125.18217846098452],
 [-102,126],
 [-103.5,125.5],
 [-105,125],
 [-106.5,123.5],
 [-108,122],
 [-110.25113732100885,122.0563378772326],
 [-112.5022746420177,122.11267575446519],
 [-115.00025016564834,121.7526221070651],
 [-117.50002750865244,121.39355662175079],
 [-120.00000302394184,121.05648766664322],
 [-122.50012895741405,120.74760195928243],
 [-125.00184308919341,120.4492382804933],
 [-127,120],
 [-128.545652196452,120.00167171977165],
 [-130.091304392904,120.0033434395433],
 [-132.7379592793154,119.83783833809935],
 [-135.43055722739388,119.68491732275305],
 [-138.08187266298395,119.43340227903354],
 [-139.05458177532265,117.9556015193557],
 [-140.0272908876613,116.47780075967785],
 [-141,115],
 [-142.5,114],
 [-144,113],
 [-146,114.5],
 [-148,116],
 [-148,118],
 [-146.9176464064928,119.80784805614785],
 [-149.10460406899008,119.38835648646565],
 [-151.75306605251166,119.36788297471188],
 [-154.4116931791406,119.51120352913244],
 [-156.20584658957029,120.25560176456622],
 [-158,121],
 [-160.19880858239276,120.42599038206336],
 [-162.39761716478552,119.85198076412671],
 [-164.99345195380434,120.04191272903205],
 [-167.59122198788108,120.30509203245589],
 [-169.96429062062228,120.49037114015673],
 [-169.6428604137482,122.32691409343782],
 [-169.32143020687408,124.1634570467189],
 [-169,126],
 [-170.8,127.4],
 [-172.6,128.8],
 [-174.4,130.2],
 [-176.2,131.6],
 [-178,133],
 [-180.42857142857142,133.85714285714286],
 [-182.85714285714286,134.71428571428572],
 [-185.28571428571428,135.57142857142858],
 [-187.71428571428572,136.42857142857142],
 [-190.14285714285714,137.28571428571428],
 [-192.57142857142858,138.14285714285714],
 [-195,139],
 [-197.16666666666666,138],
 [-199.33333333333334,137],
 [-201.5,136],
 [-203.66666666666666,135],
 [-205.83333333333334,134],
 [-208,133],
 [-207.580273023521,130.95953817831762],
 [-207.16054604704195,128.91907635663523],
 [-208.69452126504905,129.45837449371004],
 [-211.13086116383275,130.28227513967664],
 [-213.4643862365247,131.0864871340959],
 [-215.54601405963663,131.8107986383187],
 [-217.35845083315021,132.43807029734168],
 [-219,133]
];
test('actual River Road West retains full width, finite UVs, no folded or overlapping faces',()=>{
 const halfWidth=s=>2*(1+.04*Math.sin(s*.12)+.02*Math.sin(s*.047)),started=performance.now(),r=buildRoadRibbon({points:riverwest,halfWidth,minHalfWidth:1});
 const elapsed=performance.now()-started,o=validate(r,riverwest,2.12);coversRoute(r,riverwest,1.8);
 assert.ok(r.diagnostics.minHalfWidth>=1.88,'No adaptive pinch');assert.ok(r.diagnostics.maxHalfWidth<=2.12);assert.ok(r.diagnostics.triangles<8000,'Keep one-road geometry bounded');assert.ok(elapsed<2000,'CPU installation must stay bounded');
 console.log('Riverwest ribbon: '+JSON.stringify({...r.diagnostics,vertices:r.positions.length/2,elapsedMs:Number(elapsed.toFixed(2)),maxOverlapArea:o.maxArea,totalOverlapArea:o.totalArea}));
});
