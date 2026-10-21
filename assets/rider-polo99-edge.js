// The short cuff is a sewn boundary against visible skin. Fit that boundary
// to the actual source arm section, with that section's skin field, rather
// than treating garment provenance X as the physical new sleeve edge.
export function fitPolo99SleeveEdge(T,short,body,limit){
 const g=short.geometry,a=g.attributes,b=body.attributes,idx=body.index,get=['getX','getY','getZ','getW'],smooth=x=>{const t=T.MathUtils.clamp(x,0,1);return t*t*(3-2*t);};let maxDelta=0;
 for(const side of [-1,1]){
  const loop=short.cloth.boundaryLoops.find(l=>l.label.startsWith('cuff')&&Math.sign(a.position.getX(l.ids[0]))===side),segments=[],x=side*limit;
  for(let f=0;f<idx.count;f+=3){const hits=[];for(let k=0;k<3;k++){const i=idx.getX(f+k),j=idx.getX(f+(k+1)%3),u=b.position.getX(i)-x,v=b.position.getX(j)-x;if((u<0)===(v<0)||Math.abs(u-v)<1e-12)continue;const t=u/(u-v);hits.push({p:new T.Vector2(T.MathUtils.lerp(b.position.getY(i),b.position.getY(j),t),T.MathUtils.lerp(b.position.getZ(i),b.position.getZ(j),t)),field:[[i,1-t],[j,t]]});}if(hits.length===2)segments.push(hits);}
  if(segments.length<12)throw Error('Polo99 actual visible arm section missing');
  const center=new T.Vector2();for(const seg of segments)for(const h of seg)center.add(h.p);center.multiplyScalar(1/(segments.length*2));
  const cross=(u,v)=>u.x*v.y-u.y*v.x;
  const section=rad=>{let best=null;for(const [u,v]of segments){const e=v.p.clone().sub(u.p),w=u.p.clone().sub(center),den=cross(rad,e);if(Math.abs(den)<1e-12)continue;const t=cross(w,e)/den,s=cross(w,rad)/den;if(t>0&&s>=-1e-8&&s<=1+1e-8&&(!best||t>best.radius)){const map=new Map();for(const [h,f]of [[u,1-s],[v,s]])for(const [id,c]of h.field)for(const key of get){const j=b.skinIndex[key](id);map.set(j,(map.get(j)||0)+b.skinWeight[key](id)*c*f);}best={radius:t,field:map};}}if(!best)throw Error('Polo99 arm section radial miss');return best;};
  const edgeDeltas=[];
  for(const i of loop.ids){const p=new T.Vector3().fromBufferAttribute(a.position,i),rad=new T.Vector2(p.y-center.x,p.z-center.y).normalize(),h=section(rad),target=new T.Vector3(x,center.x+rad.x*(h.radius+.0010),center.y+rad.y*(h.radius+.0010));edgeDeltas.push({i,rad,delta:target.clone().sub(p),field:h.field});}
  const used=new Set(g.index.array);
  for(const i of used){const source=short.cloth.sourcePositions[i];let distance;if(source)distance=limit-Math.abs(source[0]);else distance=limit-Math.abs(a.position.getX(i));if(distance>.026||Math.sign(a.position.getX(i))!==side)continue;const blend=smooth(1-distance/.026),rad=new T.Vector2(a.position.getY(i)-center.x,a.position.getZ(i)-center.y).normalize(),near=edgeDeltas.reduce((best,h)=>!best||h.rad.dot(rad)>best.rad.dot(rad)?h:best,null),old=new T.Vector3().fromBufferAttribute(a.position,i),p=old.clone().addScaledVector(near.delta,blend);a.position.setXYZ(i,p.x,p.y,p.z);maxDelta=Math.max(maxDelta,p.distanceTo(old));const map=new Map();for(const key of get){const j=a.skinIndex[key](i);map.set(j,(map.get(j)||0)+a.skinWeight[key](i)*(1-blend));}for(const[j,w]of near.field)map.set(j,(map.get(j)||0)+w*blend);const field=[...map].filter(x=>x[1]>0).sort((x,y)=>y[1]-x[1]||x[0]-y[0]).slice(0,4),sum=field.reduce((s,x)=>s+x[1],0);while(field.length<4)field.push([0,0]);a.skinIndex.setXYZW(i,...field.map(x=>x[0]));a.skinWeight.setXYZW(i,...field.map(x=>x[1]/sum));}
 }
 g.computeVertexNormals();g.computeBoundingSphere();short.evidence.actualVisibleEdgeFit99={sectionM:limit,clothThicknessM:.001,materialBlendLengthM:.026,maxDeltaM:maxDelta,actualArmSkinField:true};return short;
}
