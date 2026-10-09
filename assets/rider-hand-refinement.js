import {HAND_SURFACE} from './rider-hand-refinement-data.js?v=character-polish-20261009';
// Post-wardrobe shape refinement: original source-ID prefix and native rig stay
// intact. Only the hand patch is subdivided; coverage fields follow edge stencils.
export function refineHandSurface(T,rig){
 const body=rig.kit.body,S=HAND_SURFACE[body],g=rig.body.geometry,A=g.attributes,total=S.sourceCount+S.added.length,V=()=>new T.Vector3();
 if(g.userData.handSurfaceRefinement1)throw Error('Hand refinement already installed');
 if(A.position.count!==S.sourceCount)throw Error('Hand refinement source count');
 const get=['getX','getY','getZ','getW'],arrays={};
 for(const[k,a]of Object.entries(A)){if(a.count!==S.sourceCount)throw Error('Hand source attribute count '+k);const out=new a.array.constructor(total*a.itemSize);out.set(a.array);arrays[k]=out;}
 for(const r of S.changes){if(V().fromBufferAttribute(A.position,r.id).distanceTo(new T.Vector3(...r.before))>1e-7)throw Error('Hand source geometry mismatch');new T.Vector3(...r.after).toArray(arrays.position,r.id*3);}
 for(const r of S.added){const[a,b]=r.sourceEdge;new T.Vector3(...r.position).toArray(arrays.position,r.id*3);for(const[k,attr]of Object.entries(A)){if(['position','normal','skinIndex','skinWeight'].includes(k))continue;for(let j=0;j<attr.itemSize;j++)arrays[k][r.id*attr.itemSize+j]=(attr.array[a*attr.itemSize+j]+attr.array[b*attr.itemSize+j])*.5;}
  const weights=new Map();for(const id of[a,b])for(let j=0;j<4;j++){const w=A.skinWeight[get[j]](id)*.5;if(w>0){const i=A.skinIndex[get[j]](id);weights.set(i,(weights.get(i)||0)+w);}}const ranked=[...weights].sort((a,b)=>b[1]-a[1]);if(ranked.length>4&&ranked.slice(4).some(([,w])=>w>1e-8))throw Error('Hand weight stencil exceeds four');ranked.length=Math.min(4,ranked.length);const sum=ranked.reduce((s,[,w])=>s+w,0);while(ranked.length<4)ranked.push([0,0]);ranked.forEach(([i,w],j)=>{arrays.skinIndex[r.id*4+j]=i;arrays.skinWeight[r.id*4+j]=w/sum;});
 }
 const oldTriangles=new Map(S.sourceTriangles.map((t,i)=>[t.join(','),i])),children=Array.from({length:S.sourceTriangles.length},()=>[]);S.triangles.forEach((t,i)=>children[S.parentFaces[i]].push(t));const index=[];let matched=0;
 for(let j=0;j<g.index.count;j+=3){const t=[0,1,2].map(k=>g.index.getX(j+k)),parent=oldTriangles.get(t.join(','));if(parent===undefined)index.push(...t);else{matched++;for(const child of children[parent])index.push(...child);}}
 if(matched!==S.sourceTriangles.length)throw Error('Hand source triangle membership');
 for(const[k,a]of Object.entries(A))g.setAttribute(k,new T.BufferAttribute(arrays[k],a.itemSize,a.normalized));g.setIndex(index);
 const p=g.attributes.position,n=g.attributes.normal,sums=Array.from({length:total},V);
 for(let j=0;j<index.length;j+=3){const ids=index.slice(j,j+3),q=ids.map(i=>V().fromBufferAttribute(p,i)),cross=q[2].clone().sub(q[1]).cross(q[0].clone().sub(q[1]));for(const i of ids)sums[i].add(cross);}
 for(const i of [...S.normalSupport,...S.added.map(r=>r.id)]){const v=sums[i].normalize();if(v.lengthSq()<.5)throw Error('Invalid refined hand normal');n.setXYZ(i,v.x,v.y,v.z);}
 const refreshCoverage=()=>{const cut=g.attributes.qaSourceCut;if(cut.count===S.sourceCount){const a=new Float32Array(total*3);a.set(cut.array);for(const r of S.added)for(let k=0;k<3;k++)a[r.id*3+k]=(cut.array[r.sourceEdge[0]*3+k]+cut.array[r.sourceEdge[1]*3+k])*.5;g.setAttribute('qaSourceCut',new T.Float32BufferAttribute(a,3));}else if(cut.count!==total)throw Error('Hand coverage source count');};
 const cutoff=rig.u.uZ1.value.w-.085,boot=g.attributes.qaBootCoverage;for(const i of [...S.changes.map(r=>r.id),...S.added.map(r=>r.id)])boot.setX(i,p.getY(i)-cutoff);boot.needsUpdate=true;
 const setOutfit=rig.setOutfit;rig.setOutfit=function(id,callback){const result=setOutfit.call(this,id,typeof callback==='function'?function(...args){refreshCoverage();return callback.apply(this,args);}:callback);refreshCoverage();return result;};
 // BufferGeometry.clone shares userData; this marker belongs to this rig only.
 g.userData={...g.userData,handSurfaceRefinement1:{body,sourceCount:S.sourceCount,counts:S.counts,changedIDs:S.changes.map(r=>r.id),fixedIDs:S.fixed,added:S.added.map(r=>({id:r.id,sourceEdge:r.sourceEdge})),sourceTriangles:S.sourceTriangles,parentFaces:S.parentFaces,handTriangles:S.triangles}};g.computeBoundingBox();g.computeBoundingSphere();return rig;
}
