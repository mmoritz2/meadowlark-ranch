// Cut actual connected sleeve triangles at a source-body coordinate. The same
// affine boundary controls visible body skin, so the arm is exposed correctly.
export function shortSleeveCut(T,geometry,cloth,bodyGeometry,mask,limitX){
 const get=['getX','getY','getZ','getW'],attrs=geometry.attributes,arrays={},source=cloth.sourcePositions.map(p=>p.slice()),edges=new Map(),indices=[];
 for(const [name,a]of Object.entries(attrs)){arrays[name]=Array.from(a.array);}
 const add=(a,b,fa,fb)=>{const key=Math.min(a,b)+':'+Math.max(a,b);if(edges.has(key))return edges.get(key);const t=fa/(fa-fb),id=source.length;
  source.push(source[a].map((v,k)=>v+(source[b][k]-v)*t));
  for(const[name,attr]of Object.entries(attrs)){if(name==='skinIndex'||name==='skinWeight')continue;for(let k=0;k<attr.itemSize;k++)arrays[name].push(attr.array[a*attr.itemSize+k]*(1-t)+attr.array[b*attr.itemSize+k]*t);}
  const w=new Map();for(const[i,f]of [[a,1-t],[b,t]])for(let k=0;k<4;k++){const j=attrs.skinIndex.array[i*4+k];w.set(j,(w.get(j)||0)+attrs.skinWeight.array[i*4+k]*f);}
  const ranked=[...w].filter(v=>v[1]>0).sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,4),sum=ranked.reduce((s,v)=>s+v[1],0);while(ranked.length<4)ranked.push([0,0]);arrays.skinIndex.push(...ranked.map(v=>v[0]));arrays.skinWeight.push(...ranked.map(v=>v[1]/sum));edges.set(key,id);return id;
 };
 const field=id=>limitX-Math.abs(source[id][0]),original=Array.from(geometry.index.array);
 for(let i=0;i<original.length;i+=3){const tri=original.slice(i,i+3),poly=[];for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],fa=field(a),fb=field(b);if(fa>=0)poly.push(a);if((fa>=0)!==(fb>=0))poly.push(add(a,b,fa,fb));}for(let k=1;k<poly.length-1;k++)indices.push(poly[0],poly[k],poly[k+1]);}
 const g=new T.BufferGeometry();for(const[name,data]of Object.entries(arrays))g.setAttribute(name,name==='skinIndex'?new T.Uint16BufferAttribute(data,attrs[name].itemSize):new T.Float32BufferAttribute(data,attrs[name].itemSize));g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();
 const counts=new Map();for(let i=0;i<indices.length;i+=3)for(let k=0;k<3;k++){const a=indices[i+k],b=indices[i+(k+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);if(!counts.has(key))counts.set(key,{n:0,a,b});counts.get(key).n++;}
 const cuffEdges=[...counts.values()].filter(e=>e.n===1&&Math.abs(field(e.a))<1e-6&&Math.abs(field(e.b))<1e-6),adj=new Map();for(const e of cuffEdges)for(const [a,b]of [[e.a,e.b],[e.b,e.a]]){if(!adj.has(a))adj.set(a,[]);adj.get(a).push(b);}if([...adj.values()].some(v=>v.length!==2))throw Error('Short sleeve boundary must be closed degree2');
 const remaining=new Set(adj.keys()),loops=[];while(remaining.size){const first=remaining.values().next().value,ids=[];let current=first,prev=-1;do{ids.push(current);remaining.delete(current);const next=adj.get(current).find(x=>x!==prev);prev=current;current=next;}while(current!==first&&ids.length<=adj.size);if(current!==first)throw Error('Open short sleeve cuff');loops.push(ids);}
 if(loops.length!==2)throw Error('Expected exactly two sleeve openings, got '+loops.length);
 const bodyPos=bodyGeometry.attributes.position,newFields=mask.affineSourceCutFields.map((v,i)=>[v[0],Math.min(v[1],limitX-Math.abs(bodyPos.getX(i))),v[2]]),boundaries=[...cloth.boundaryLoops.filter(l=>!l.label.startsWith('cuff')),...loops.map(ids=>({label:source[ids[0]][0]<0?'cuff-left':'cuff-right',ids,count:ids.length}))];
 let invalidWeights=0;for(const i of new Set(indices)){let sum=0;for(const k of get){const w=g.attributes.skinWeight[k](i);if(!Number.isFinite(w)||w<0)invalidWeights++;sum+=w;}if(Math.abs(sum-1)>1e-6)invalidWeights++;}if(invalidWeights)throw Error('Short sleeve weights invalid');
 return {geometry:g,cloth:{...cloth,boundaryLoops:boundaries},mask:{...mask,affineSourceCutFields:newFields},evidence:{sourceCutX:limitX,originalTriangles:original.length/3,triangles:indices.length/3,newEdgeVertices:edges.size,cuffCounts:loops.map(l=>l.length),bodyMaskUsesSameSourcePlane:true,invalidWeights}};
}
