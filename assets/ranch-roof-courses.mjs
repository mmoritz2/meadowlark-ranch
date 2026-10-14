export const RANCH_ROOF_COURSES_PROFILE='ranch-roof-courses-2';

// Measured horizontal butt seams and three real vertical-joint candidates per row in
// the resident 1024 px albedos. Coordinates are image pixels, before flipY.
// Cedar: original roof_albedo.jpg (1.8 m). Slate: CC0 roof_slates_03 (3 m).
// The geometry models every photographed course, retaining the original UVs;
// one rotating real joint per row has geometry; finer joints remain in the map.
export const RANCH_ROOF_PHOTO_PROFILES=Object.freeze({
 cedar:{patchMetres:1.8,butts:[0,131,255,386,509,642,767,898,1024],
  joints:[[262,511,785],[217,552,833],[263,512,722],[233,561,821],[265,513,778],[283,476,826],[229,494,714],[278,528,754]],relief:.026,jointDepth:.003,jointHalfWidth:.0025},
 slate:{patchMetres:3,butts:[0,17,65,101,137,172,208,244,279,315,349,385,419,455,490,525,561,597,632,668,703,738,774,809,844,879,915,950,985,1020,1024],
  joints:[[309,563,781],[275,565,798],[212,571,737],[242,545,712],[308,573,738],[243,499,767],[270,574,739],[242,498,823],[213,474,794],[241,545,766],[313,572,738],[240,544,765],[212,572,793],[238,487,709],[210,571,792],[294,543,765],[210,569,791],[238,542,708],[210,513,734],[237,540,706],[209,567,789],[236,447,817],[208,474,733],[236,538,704],[208,565,787],[235,501,759],[207,473,731],[234,500,818],[207,563,729],[204,567,792]],relief:.011,jointDepth:.0018,jointHalfWidth:.0018},
});

// Mutates the original cover box after its old solid proxy was recorded. This
// is a single closed heightfield, with no hidden overlapping shingle solids.
// The five original non-top faces and a 5 mm bedding rim retain every old corner,
// envelope, underside and outside UV. No new Three UUID/resource or random draw.
export function dressRoofCoverBox(T,g,{width,height,depth,axis='z',downSlope=1,style='cedar',relief=null}={}){
 const dims=[width,height,depth],profile=RANCH_ROOF_PHOTO_PROFILES[style];
 if(!dims.every(Number.isFinite)||Math.min(...dims)<=0||!['x','z'].includes(axis)||![-1,1].includes(downSlope)||!profile)
  throw Error('A finite bounded roof cover profile is required');
 const sourceP=g.attributes.position,sourceN=g.attributes.normal,sourceU=g.attributes.uv;
 if(g.type!=='BoxGeometry'||!sourceP||!sourceN||!sourceU||!g.index)
  throw Error('Dress the original indexed roof BoxGeometry before batching');
 const topIds=[];for(let i=0;i<sourceP.count;i++)if(sourceN.getY(i)>.99)topIds.push(i);
 if(topIds.length!==4)throw Error('The cover must retain its authored top UV corners');
 const a=topIds[0],ax=topIds.find(i=>Math.abs(sourceP.getX(i)-sourceP.getX(a))>width*.9&&Math.abs(sourceP.getZ(i)-sourceP.getZ(a))<1e-6),
  az=topIds.find(i=>Math.abs(sourceP.getZ(i)-sourceP.getZ(a))>depth*.9&&Math.abs(sourceP.getX(i)-sourceP.getX(a))<1e-6);
 if(ax===undefined||az===undefined)throw Error('The top needs an affine metre-scaled UV rectangle');
 const uvFit=[0,1].map(component=>{
  const get=i=>component?sourceU.getY(i):sourceU.getX(i),dx=sourceP.getX(ax)-sourceP.getX(a),dz=sourceP.getZ(az)-sourceP.getZ(a),
   x=(get(ax)-get(a))/dx,z=(get(az)-get(a))/dz;
  return{x,z,c:get(a)-x*sourceP.getX(a)-z*sourceP.getZ(a)};
 });
 if(!uvFit.every(q=>[q.x,q.z,q.c].every(Number.isFinite)))throw Error('Finite roof UV scale is required');
 const point=(v,t,y)=>axis==='z'?[v,y,t*downSlope]:[t*downSlope,y,v],
  toward=(v,t)=>axis==='z'?[v,0,t*downSlope]:[t*downSlope,0,v],
  coeff=q=>({across:axis==='z'?q.x:q.z,along:(axis==='z'?q.z:q.x)*downSlope,c:q.c}),uf=coeff(uvFit[0]),vf=coeff(uvFit[1]);
 // Preserve the previous mapping policy if it puts photographed courses across
 // the slope (the original open-stall sampler is one such intentional skip).
 if(Math.abs(vf.across)>1e-6||Math.abs(uf.along)>1e-6||Math.abs(vf.along)<1e-6||Math.abs(uf.across)<1e-6)return null;
 const P=[],N=[],U=[],I=[],cross=(a,b,c)=>{
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
  return[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
 },same=(a,b)=>a.every((v,k)=>Math.abs(v-b[k])<1e-10),half=height/2;
 // Retain original non-top triangles and UVs without reprojecting them.
 for(let i=0;i<g.index.count;i+=3){const ids=[0,1,2].map(k=>g.index.getX(i+k));if(ids.every(j=>sourceN.getY(j)>.99))continue;
  const offset=P.length/3;for(const j of ids){P.push(sourceP.getX(j),sourceP.getY(j),sourceP.getZ(j));N.push(sourceN.getX(j),sourceN.getY(j),sourceN.getZ(j));U.push(sourceU.getX(j),sourceU.getY(j));}I.push(offset,offset+1,offset+2);
 }
 const uv=(p,n)=>{
  const out=uvFit.map(q=>q.x*p[0]+q.z*p[2]+q.c);
  // A lap is vertical. Give its physical thickness a nonzero UV derivative so
  // the resident normal map has a valid tangent basis and no stretched texel.
  if(Math.abs(n[1])<.1){const grad=Math.abs(n[0])>.5?uvFit.map(q=>q.z):uvFit.map(q=>q.x),drop=p[1]-half;
   out[0]-=grad[1]*drop;out[1]+=grad[0]*drop;
  }return out;
 };
 const face=(input,hint)=>{
  let points=input.filter((p,i)=>!i||!same(p,input[i-1]));if(points.length>2&&same(points[0],points.at(-1)))points.pop();if(points.length<3)return;
  let n=null;for(let i=1;i<points.length-1;i++){const q=cross(points[0],points[i],points[i+1]);if(Math.hypot(...q)>1e-12){n=q;break;}}if(!n)return;
  if(n[0]*hint[0]+n[1]*hint[1]+n[2]*hint[2]<0){points=points.slice().reverse();n=n.map(v=>-v);}
  const len=Math.hypot(...n);n=n.map(v=>v/len);const offset=P.length/3;
  for(const p of points){P.push(...p);N.push(...n);U.push(...uv(p,n));}
  for(let i=1;i<points.length-1;i++){if(Math.hypot(...cross(points[0],points[i],points[i+1]))>1e-12)I.push(offset,offset+i,offset+i+1);}
 };
 const across=axis==='z'?width:depth,run=axis==='z'?depth:width,
  edge=Math.min(.005,across*.012,run*.012),A=across/2-edge,lo=-run/2+edge,hi=run/2-edge,
  lip=Math.min(relief??profile.relief,height*.34),groove=Math.min(profile.jointDepth,lip*.22),grooveHalf=profile.jointHalfWidth;
 if(!Number.isFinite(lip)||lip<=0)throw Error('Positive roof course relief is required');
 for(const s of[-1,1]){
  const v=s*A,w=s*across/2;
  face([point(v,-run/2,half),point(w,-run/2,half),point(w,run/2,half),point(v,run/2,half)],[0,1,0]);
  const t=s*(run/2-edge),u=s*run/2;
  face([point(-A,t,half),point(A,t,half),point(A,u,half),point(-A,u,half)],[0,1,0]);
 }
 const vMin=Math.min(vf.along*lo+vf.c,vf.along*hi+vf.c),vMax=Math.max(vf.along*lo+vf.c,vf.along*hi+vf.c),anchors=[];
 for(let k=Math.floor(vMin)-1;k<=Math.ceil(vMax)+1;k++)for(const y of profile.butts.slice(0,-1))anchors.push((k+1-y/1024-vf.c)/vf.along);
 anchors.sort((a,b)=>a-b);const unique=anchors.filter((v,i)=>!i||v-anchors[i-1]>1e-8),courses=[];
 const mod=v=>((v%1)+1)%1;
 for(let i=0;i<unique.length-1;i++){
  const full0=unique[i],full1=unique[i+1],t0=Math.max(lo,full0),t1=Math.min(hi,full1);if(t1-t0<1e-7)continue;
  const imageY=mod(1-(vf.along*(full0+full1)/2+vf.c))*1024,row=Math.min(profile.joints.length-1,Math.max(0,profile.butts.findIndex((b,j)=>j<profile.butts.length-1&&imageY>=b&&imageY<profile.butts[j+1]))),
   uMin=Math.min(uf.across*-A+uf.c,uf.across*A+uf.c),uMax=Math.max(uf.across*-A+uf.c,uf.across*A+uf.c),joints=[];
  for(let k=Math.floor(uMin)-1;k<=Math.ceil(uMax);k++)for(const pixel of [profile.joints[row][row%3]]){
   const v=(k+pixel/1024-uf.c)/uf.across;if(v>-A+grooveHalf&&v<A-grooveHalf)joints.push(v);
  }
  joints.sort((a,b)=>a-b);const edges=[-A,...joints.flatMap(v=>[v-grooveHalf,v,v+grooveHalf]),A],
   offset=v=>{let d=0;for(const j of joints)d=Math.min(d,-groove*Math.max(0,1-Math.abs(v-j)/grooveHalf));return d;},
   level=(v,t)=>half-lip*(1-(t-full0)/(full1-full0))+offset(v);
  for(let j=0;j<edges.length-1;j++){const a=edges[j],b=edges[j+1];face([point(a,t0,level(a,t0)),point(b,t0,level(b,t0)),point(b,t1,level(b,t1)),point(a,t1,level(a,t1))],[0,1,0]);}
  for(const s of[-1,1]){const v=s*A;face([point(v,t0,half),point(v,t1,half),point(v,t1,level(v,t1)),point(v,t0,level(v,t0))],toward(-s,0));}
  courses.push({t0,t1,edges,level,row,joints:joints.length});
 }
 let lapFaces=0;
 for(let row=0;row<=courses.length;row++){
  const upper=courses[row-1],lower=courses[row],t=lower?.t0??hi,
   edges=[...new Set([...(upper?.edges??[]),...(lower?.edges??[])])].sort((a,b)=>a-b);
  for(let col=0;col<edges.length-1;col++){
   const a=edges[col],b=edges[col+1],ua=upper?upper.level(a,t):half,ub=upper?upper.level(b,t):half,
    da=lower?lower.level(a,t):half,db=lower?lower.level(b,t):half;
   if(Math.max(Math.abs(ua-da),Math.abs(ub-db))<1e-10)continue;
   face([point(a,t,ua),point(b,t,ub),point(b,t,db),point(a,t,da)],toward(0,Math.sign((ua+ub-da-db)/2)));lapFaces++;
  }
 }
 g.setIndex(I);g.clearGroups();g.setAttribute('position',new T.Float32BufferAttribute(P,3));
 g.setAttribute('normal',new T.Float32BufferAttribute(N,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.computeBoundingBox();g.computeBoundingSphere();
 const receipt={profile:RANCH_ROOF_COURSES_PROFILE,style,axis,downSlope,rows:courses.length,joints:courses.reduce((s,r)=>s+r.joints,0),lapFaces,
  relief:lip,jointDepth:groove,edge,triangles:I.length/3,authoredBounds:dims,
  uvProjection:uvFit.map(q=>[q.x,q.z,q.c]),sourceRows:courses.map(r=>r.row),
  bytes:(P.length+N.length+U.length)*4+g.index.array.byteLength};
 g.userData.ranchRoofCourses=receipt;return receipt;
}
