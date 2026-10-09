import {trimGarment} from './rider-fit.js?v=character-polish-20261009';
// A continuous sewn facing cut from the literal garment surface. Its physical
// thickness closes both edges; no independent polar collar/corner frame or skin
// mask changes the opening. Original surface/boundary skinning is authoritative.
export function createPhysicalBinding(T,geometry,{label='sewn opening',edgeFilter=null,sourceIDs=null,width=.005,radius=.0012}={}){
 const p=geometry.attributes.position,index=geometry.index,key=v=>v.toArray().map(x=>Math.round(x*1e6)).join(','),V=()=>new T.Vector3(),wanted=sourceIDs?new Set(sourceIDs):null,canonical=new Map(),sourcePoints=[],sourceWeld=new Uint32Array(p.count),edgeMap=new Map();
 for(let i=0;i<p.count;i++){const v=V().fromBufferAttribute(p,i),k=key(v);let id=canonical.get(k);if(id===undefined){id=sourcePoints.length;canonical.set(k,id);sourcePoints.push({p:v,id:i});}sourceWeld[i]=id;}
 for(let i=0;i<index.count;i+=3)for(let k=0;k<3;k++){const one=index.getX(i+k),two=index.getX(i+(k+1)%3),u=sourceWeld[one],v=sourceWeld[two],id=u<v?u+':'+v:v+':'+u;if(u===v)continue;const old=edgeMap.get(id);if(old)old.count++;else edgeMap.set(id,{u,v,one,two,count:1});}
 const selected=[...edgeMap.values()].filter(e=>e.count===1&&(!wanted||(wanted.has(e.one)&&wanted.has(e.two)))&&(!edgeFilter||edgeFilter(sourcePoints[e.u].p,sourcePoints[e.v].p))),outgoing=new Map(),incoming=new Set(),remaining=new Set();
 for(const e of selected){if(outgoing.has(e.u)||incoming.has(e.v))throw Error(label+' boundary branches');outgoing.set(e.u,e);incoming.add(e.v);remaining.add(e.u);}
 if(selected.some(e=>!outgoing.has(e.v)||!incoming.has(e.u)))throw Error(label+' boundary is open');let loopCount=0;
 while(remaining.size){let at=remaining.values().next().value,start=at;do{if(!remaining.delete(at))throw Error(label+' repeated boundary');at=outgoing.get(at).v;}while(at!==start);loopCount++;}
 if(!loopCount)throw Error(label+' has no opening');
 const lines=selected.map(e=>{const a=sourcePoints[e.u].p,b=sourcePoints[e.v].p,d=b.clone().sub(a);return{a,d,l:d.lengthSq()};}),box=new T.Box3().setFromPoints(lines.flatMap(q=>[q.a,q.a.clone().add(q.d)])).expandByScalar(width);
 const distance=(x,y,z)=>{if(x<box.min.x||x>box.max.x||y<box.min.y||y>box.max.y||z<box.min.z||z>box.max.z)return width+1;let min=Infinity;for(const q of lines){const dx=x-q.a.x,dy=y-q.a.y,dz=z-q.a.z,t=T.MathUtils.clamp((dx*q.d.x+dy*q.d.y+dz*q.d.z)/q.l,0,1),xx=dx-q.d.x*t,yy=dy-q.d.y*t,zz=dz-q.d.z*t;min=Math.min(min,xx*xx+yy*yy+zz*zz);}return Math.sqrt(min);};
 const parent=geometry.attributes.uv?geometry:geometry.clone();if(!parent.attributes.uv)parent.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(p.count*2),2));
 const band=trimGarment(T,parent,[(x,y,z)=>width-distance(x,y,z)]),ba=band.attributes,bp=ba.position,bi=band.index,owned=new Map(),points=[],mapped=new Uint32Array(bp.count),triangles=[];
 for(let i=0;i<bp.count;i++){const at=V().fromBufferAttribute(bp,i),k=key(at);let id=owned.get(k);if(id===undefined){id=points.length;owned.set(k,id);points.push({p:at,n:V().fromBufferAttribute(ba.normal,i),source:i});}else points[id].n.add(V().fromBufferAttribute(ba.normal,i));mapped[i]=id;}for(const q of points)q.n.normalize();
 const boundary=new Map();for(let i=0;i<bi.count;i+=3){const q=[mapped[bi.getX(i)],mapped[bi.getX(i+1)],mapped[bi.getX(i+2)]];if(new Set(q).size<3)continue;triangles.push(...q);for(let k=0;k<3;k++){const a=q[k],b=q[(k+1)%3],id=a<b?a+':'+b:b+':'+a,old=boundary.get(id);if(old)old.count++;else boundary.set(id,{a,b,count:1});}}
 const N=points.length,vertices=[],joints=[],weights=[],uv=[],normal=[],idx=[],basePositions=[],lift=radius*.55,depth=radius*.20,scales=points.map(()=>1);
 // Preserve each literal source face's orientation. Very short inherited neck
 // slivers cannot support a uniform offset; locally taper physical thickness
 // rather than reversing its indices or importing unsafe collar frames.
 let offsetRounds=0;
 const offsetPoint=(id,amount)=>{const q=points[id],v=q.p.clone().addScaledVector(q.n,amount*scales[id]);return v.set(Math.fround(v.x),Math.fround(v.y),Math.fround(v.z));};
 for(let round=0;round<18;round++){
  const bad=new Set();for(let k=0;k<triangles.length;k+=3){const ids=triangles.slice(k,k+3),base=ids.map(id=>points[id].p),ref=T.Triangle.getNormal(...base,V());for(const amount of[lift,-depth]){const actual=ids.map(id=>offsetPoint(id,amount));if(T.Triangle.getNormal(...actual,V()).dot(ref)<.40||new T.Triangle(...actual).getArea()<new T.Triangle(...base).getArea()*.10)ids.forEach(id=>bad.add(id));}}
  if(!bad.size)break;if(round===17)throw Error(label+' cannot preserve source-facing orientation');offsetRounds++;for(const id of bad)scales[id]*=.50;
 }
 const append=(q,at,n)=>{vertices.push(...at.toArray());basePositions.push(...q.p.toArray());normal.push(...n.toArray());for(let k=0;k<4;k++){joints.push(ba.skinIndex.array[q.source*4+k]);weights.push(ba.skinWeight.array[q.source*4+k]);}uv.push(at.x*4,at.y*4);};
 for(let i=0;i<N;i++)append(points[i],offsetPoint(i,lift),points[i].n);
 for(let i=0;i<N;i++)append(points[i],offsetPoint(i,-depth),points[i].n.clone().negate());
 for(let i=0;i<triangles.length;i+=3){const[a,b,c]=triangles.slice(i,i+3);idx.push(a,b,c,N+c,N+b,N+a);}
 const sideColumns=new Map(),columns=[],openingIDs=new Set(selected.flatMap(e=>[e.u,e.v]));
 const side=id=>{if(sideColumns.has(id))return sideColumns.get(id);const q=points[id],base=vertices.length/3;append(q,offsetPoint(id,lift),q.n);append(q,q.p,q.n);append(q,offsetPoint(id,-depth),q.n.clone().negate());sideColumns.set(id,base);const sourceID=canonical.get(key(q.p));if(sourceID!==undefined&&openingIDs.has(sourceID)){const parentID=sourcePoints[sourceID].id;columns.push({offset:base,rootIndex:base+1,root:q.p.toArray(),source:[parentID,parentID,0]});}return base;};
 for(const e of boundary.values())if(e.count===1){const a=side(e.a),b=side(e.b);for(let k=0;k<2;k++)idx.push(a+k,a+k+1,b+k,a+k+1,b+k+1,b+k);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.setAttribute('bindingSourcePosition',new T.Float32BufferAttribute(basePositions,3));g.computeVertexNormals();g.computeBoundingSphere();
 g.userData.physicalBinding={label,version:2,construction:'actual garment surface facing with closed physical edge',width,radius,lift,depth,loopCount,sourceEdges:selected.length,columns,segments:3,surfaceVertices:N,surfaceTriangles:triangles.length/3,topVertices:N,offsetRounds,minThicknessScale:Math.min(...scales)};band.dispose();if(parent!==geometry)parent.dispose();return g;
}
