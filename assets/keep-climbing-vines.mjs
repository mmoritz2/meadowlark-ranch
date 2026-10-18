// Original static rooted climbers. Physical leaf silhouettes, no alpha cards,
// downloaded asset, renderer constructor, random stream or per-frame updater.
export const KEEP_CLIMBING_VINES_PROFILE='keep-climbing-vines-1';
const hash=(i,k=0)=>{const q=Math.sin(i*127.1+k*311.7+43.9)*43758.5453;return q-Math.floor(q);};
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>{const l=Math.hypot(...a);if(l<1e-12)throw Error('Collapsed vine direction');return mul(a,1/l);};
const finite=a=>a.every(Number.isFinite);
function linear(hex){return hex.match(/../g).map(v=>{const q=parseInt(v,16)/255;return q<=.04045?q/12.92:Math.pow((q+.055)/1.055,2.4);});}
const leafA=linear('314c29'),leafB=linear('6a8547'),woodA=linear('423b2a'),woodB=linear('756548');

// The original merged primitive/proxy owner remains immutable. Only the ten
// declared ellipsoid triangle spans are removed from the decorative legacy batch.
export function retireKeepIvySpans(original,stonePieces,ivyPieces){
 const A=original.attributes;if(original.index||!A.position||!A.normal||!A.color)throw Error('Original unindexed Keep owner required');
 if(!Array.isArray(ivyPieces)||ivyPieces.length!==10)throw Error('Exactly ten original ivy ellipsoid spans required');
 const mask=new Uint8Array(A.position.count),ivyMask=new Uint8Array(A.position.count);
 const mark=(r,ivy)=>{if(!Number.isInteger(r.start)||!Number.isInteger(r.count)||r.start<0||r.count<=0||r.start+r.count>A.position.count||r.start%3||r.count%3||!finite(r.matrix)||r.matrix.length!==16)throw Error('Invalid Keep source span');for(let i=r.start;i<r.start+r.count;i++){if(mask[i])throw Error('Overlapping Keep source spans');mask[i]=1;if(ivy)ivyMask[i]=1;}};
 for(const r of stonePieces)mark(r,false);for(const r of ivyPieces){if(r.type!=='SphereGeometry')throw Error('Only the original ivy ellipsoids may retire');mark(r,true);}
 const legacy={position:[],normal:[],color:[]};for(let i=0;i<mask.length;i++)if(!mask[i])for(const k in legacy)legacy[k].push(...A[k].array.subarray(i*3,i*3+3));
 return{legacy:Object.fromEntries(Object.entries(legacy).map(([k,v])=>[k,new Float32Array(v)])),retiredVertices:ivyMask.reduce((a,b)=>a+b,0),retiredSpans:ivyPieces.map(r=>({start:r.start,count:r.count,solidIndex:r.solidIndex}))};
}

// Radial rays hit the actual emitted hewn stone triangles, not an ideal cylinder.
// Bins are built once, used only during authoring, and are not retained at runtime.
export function createKeepWallSampler(stone,pieceRanges){
 if(!stone?.position||!stone?.index||!Array.isArray(pieceRanges))throw Error('Actual Keep masonry triangle arrays required');
 const p=stone.position,bins=new Map();let faces=0;
 for(const r of pieceRanges){const radius=Math.hypot(r.matrix[12],r.matrix[14]);if(!(r.curved||r.type==='CylinderGeometry'||radius>4.8&&radius<5.55))continue;
  for(let i=r.start;i<r.start+r.count;i+=3){const a=Array.from(p.subarray(i*3,i*3+3)),b=Array.from(p.subarray((i+1)*3,(i+1)*3+3)),c=Array.from(p.subarray((i+2)*3,(i+2)*3+3)),ab=sub(b,a),ac=sub(c,a),n=cross(ab,ac),length=Math.hypot(...n);if(length<1e-10)continue;
   const tri={a,ab,ac,n:mul(n,1/length),id:faces++};for(let y=Math.floor(Math.min(a[1],b[1],c[1])/.8);y<=Math.floor(Math.max(a[1],b[1],c[1])/.8);y++){if(!bins.has(y))bins.set(y,[]);bins.get(y).push(tri);}
  }
 }
 const cache=new Map();
 const sample=(angle,y)=>{const key=angle.toFixed(7)+','+y.toFixed(7);if(cache.has(key))return cache.get(key);const radial=[Math.cos(angle),0,Math.sin(angle)],origin=[radial[0]*9,y,radial[2]*9],dir=mul(radial,-1);let best=null;
  for(const t of bins.get(Math.floor(y/.8))||[]){if(dot(t.n,radial)<.20)continue;const h=cross(dir,t.ac),det=dot(t.ab,h);if(Math.abs(det)<1e-10)continue;const s=sub(origin,t.a),u=dot(s,h)/det;if(u< -1e-7||u>1.0000001)continue;const q=cross(s,t.ab),v=dot(dir,q)/det;if(v< -1e-7||u+v>1.0000001)continue;const distance=dot(t.ac,q)/det,r=9-distance;if(distance<0||r<4.65||r>6.25||best&&r<=best.radius)continue;best={point:add(origin,mul(dir,distance)),normal:t.n.slice(),radius:r,triangle:t.id};}
  cache.set(key,best);return best;
 };
 return{sample,sourceTriangles:faces};
}

export function buildKeepClimbingVines({stone,pieceRanges,ivyPieces,groundAt}){
 if(typeof groundAt!=='function'||!Array.isArray(ivyPieces)||ivyPieces.length!==10)throw Error('Actual Keep roots and ten declared original ivy anchors required');
 const wall=createKeepWallSampler(stone,pieceRanges),P=[],N=[],C=[],I=[],roots=[],contacts=[],leaves=[],stems=[];let leafId=0;
 const tri=(a,b,c,na,nb,nc,colors)=>{const face=cross(sub(b,a),sub(c,a)),area=Math.hypot(...face);if(area<1e-10)throw Error('Degenerate climbing vine face');if(dot(face,add(add(na,nb),nc))<0){[b,c]=[c,b];[nb,nc]=[nc,nb];[colors[1],colors[2]]=[colors[2],colors[1]];}const start=P.length/3;for(const [v,n,col]of [[a,na,colors[0]],[b,nb,colors[1]],[c,nc,colors[2]]]){P.push(...v);N.push(...unit(n));C.push(...col);}I.push(start,start+1,start+2);};
 const support=(angle,y)=>{let hit=wall.sample(angle,y);if(!hit)for(const dy of [-.035,.035,-.07,.07]){hit=wall.sample(angle,y+dy);if(hit)break;}return hit;};
 const attached=(angle,y,offset=.035)=>{const hit=support(angle,y);if(!hit)return null;const point=add([hit.point[0],y,hit.point[2]],mul(hit.normal,offset));contacts.push({point,wall:hit.point,normal:hit.normal,gap:Math.hypot(...sub(point,hit.point)),jointBridgeM:Math.abs(y-hit.point[1]),triangle:hit.triangle});return{point,angle,y,normal:hit.normal,hit};};
 function stem(points,radius,id,sides=5,kind='branch'){if(points.length<2)return;const start=P.length/3,shade=.35+.45*hash(id,21),col=woodA.map((v,k)=>v+(woodB[k]-v)*shade),rings=[];let priorA=null;
  for(let i=0;i<points.length;i++){const tangent=unit(sub(points[Math.min(i+1,points.length-1)].point,points[Math.max(0,i-1)].point)),a=priorA?unit(sub(priorA,mul(tangent,dot(priorA,tangent)))):unit(cross(tangent,Math.abs(tangent[1])<.9?[0,1,0]:[1,0,0])),b=unit(cross(tangent,a)),r=radius*(1-.72*i/(points.length-1));priorA=a;rings.push(Array.from({length:sides},(_,k)=>{const n=add(mul(a,Math.cos(k/sides*Math.PI*2)),mul(b,Math.sin(k/sides*Math.PI*2)));return{p:add(points[i].point,mul(n,r)),n};}));}
  for(let i=0;i<rings.length-1;i++)for(let k=0;k<sides;k++){const l=(k+1)%sides,a=rings[i][k],b=rings[i+1][k],c=rings[i+1][l],d=rings[i][l];tri(a.p,b.p,c.p,a.n,b.n,c.n,[col,col,col]);tri(a.p,c.p,d.p,a.n,c.n,d.n,[col,col,col]);}
  for(const i of [0,rings.length-1]){const tangent=unit(sub(points[i?i:1].point,points[i?i-1:0].point)),n=mul(tangent,i?1:-1);for(let k=0;k<sides;k++)tri(points[i].point,rings[i][k].p,rings[i][(k+1)%sides].p,n,n,n,[col,col,col]);}
  stems.push({start,count:P.length/3-start,points:points.map(p=>p.point.slice()),radius,kind});
 }
 function leaf(anchor,id,side=1,accent=false){const size=(accent ? .115 : .135)+hash(id,31)*.105,hit=anchor.hit,normal=hit.normal,u=unit(cross([0,1,0],normal)),v=unit(cross(normal,u)),yaw=(hash(id,32)-.5)*1.5,co=Math.cos(yaw),si=Math.sin(yaw),U=add(mul(u,co),mul(v,si)),V=add(mul(v,co),mul(u,-si));
  const shift=side*(.06+hash(id,33)*.07),center=add(anchor.point,add(mul(u,shift),mul(normal,.018+hash(id,34)*.018))),outline=[[0,-.48],[-.21,-.27],[-.49,-.22],[-.34,.025],[-.48,.19],[-.185,.225],[0,.57],[.185,.225],[.48,.19],[.34,.025],[.49,-.22],[.21,-.27]],points=outline.map(([x,y])=>add(center,add(add(mul(U,x*size),mul(V,y*size)),mul(normal,(.008*Math.abs(x/.5)+.014*Math.sin(y*3))*size/.2))));
  // A leaf may frame an opening, but its whole lamina must have nearby masonry
  // behind it. Missing wall rays reject that leaf without relocating any world owner.
  for(const p of points){const a=Math.atan2(p[2],p[0]),q=support(a,p[1]);if(!q||Math.hypot(...sub(p,q.point))>.25)return;}
  stem([{point:anchor.point},{point:points[0]}],.0022+hash(id,38)*.0008,id+1000,3,'petiole');
  const start=P.length/3,spine=add(center,mul(normal,.018)),shade=.22+.73*hash(id,35),col=leafA.map((q,k)=>q+(leafB[k]-q)*shade),centerColor=col.map(q=>q*1.10);
  // Shared per-vertex lamina normals retain gentle folds without faceted
  // dark triangles or geometrically rectangular alpha billboards.
  const normals=points.map((p,k)=>{const prior=points[(k+points.length-1)%points.length],next=points[(k+1)%points.length];let a=cross(sub(prior,p),sub(spine,p)),b=cross(sub(spine,p),sub(next,p));if(dot(a,normal)<0)a=mul(a,-1);if(dot(b,normal)<0)b=mul(b,-1);return unit(add(a,b));});
  for(let k=0;k<points.length;k++){const next=(k+1)%points.length;tri(spine,points[k],points[next],normal,normals[k],normals[next],[centerColor,col,col]);}
  leaves.push({id,start,count:P.length/3-start,center,size,normal,wall:hit.point,sourceTriangle:hit.triangle});
 }
 const angles=ivyPieces.map(r=>Math.atan2(r.matrix[14],r.matrix[12])+(Math.atan2(r.matrix[14],r.matrix[12])<0?Math.PI*2:0)).sort((a,b)=>a-b),chosen=[0,2,4,6,9].map(i=>angles[i]);
 for(let id=0;id<chosen.length;id++){
  let angle=chosen[id],valid=false;
  for(const delta of [0,-.12,.12,-.24,.24,-.36,.36]){const a=chosen[id]+delta;if(roots.every(r=>Math.abs(r.angle-a)>.20)&&[.55,1.1,1.8,2.5,3.1].every(y=>support(a,y))){angle=a;valid=true;break;}}
  if(!valid)continue;
  const x=Math.cos(angle)*6.0,z=Math.sin(angle)*6.0,ground=groundAt(x,z);if(!Number.isFinite(ground))throw Error('Finite current Keep soil support required');
  const rootPoint=[x,ground-.025,z],root={point:rootPoint,angle,y:ground-.025,normal:[Math.cos(angle),0,Math.sin(angle)]},main=[root],height=6.2+hash(id,47)*3.0;
  for(let y=Math.max(ground+.18,.42);y<height;y+=.27){const t=y/height,a=angle+.045*Math.sin(t*7+id*1.4)+(.035-id*.012)*t,p=attached(a,y,.032);if(!p){if(y>1)break;continue;}main.push(p);if(main.length>2)for(let side=-1;side<=1;side+=2)leaf(p,leafId++,side,y>5.6);}
  if(main.length<4)continue;stem(main,.028+hash(id,48)*.015,id);roots.push({id,angle,soilPoint:[x,ground,z],rootPoint,startY:ground-.025,terminalY:main.at(-1).y,mainStem:stems.length-1});
  const branches=7;
  for(let k=0;k<branches;k++){const at=Math.min(main.length-2,2+Math.floor(k/(branches-1)*(main.length-5))),base=main[at],side=k%2?1:-1,length=k<4?1.25+hash(id,k)*.8:.75+hash(id,k)*.9,branch=[base],spread=(.11+hash(id,k+53)*.10)*side;
   for(let j=1;j<=9;j++){const t=j/9,a=base.angle+spread*Math.sin(t*Math.PI*.55),y=base.y+t*length+.10*Math.sin(t*Math.PI),p=attached(a,y,.035+.015*t);if(!p)break;branch.push(p);for(let l=0;l<(k<4?3:2);l++)leaf(p,leafId++,l%2?1:-1,k>=4);}
   stem(branch,.010+hash(id,k+61)*.004,id*13+k+100);
  }
 }
 if(roots.length<3||leaves.length<350)throw Error('Current Keep masonry cannot support the authored climbing-vine family');
 return{geometry:{position:new Float32Array(P),normal:new Float32Array(N),color:new Float32Array(C),index:new Uint32Array(I)},roots,contacts,leaves,stems,stats:{profile:KEEP_CLIMBING_VINES_PROFILE,rootCount:roots.length,leafCount:leaves.length,stemCount:stems.length,triangles:I.length/3,vertices:P.length/3,sourceWallTriangles:wall.sourceTriangles,wallContactSamples:contacts.length,leafTriangles:leaves.reduce((n,r)=>n+r.count/3,0),stemTriangles:stems.reduce((n,r)=>n+r.count/3,0),newTextures:0,perFrameUpdates:0}};
}
