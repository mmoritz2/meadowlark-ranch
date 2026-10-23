import {createTriangleSurface} from './rider-head-surface.js?v=character-polish-20261009';

// Fit the existing accessory artwork to the imported character's actual surfaces.
// Every accessory geometry remains owned and disposed by the normal accessory API.
export function installRainAccessories109(T,rig,{head,eyes=[],top=null}={}){
 if(!head?.geometry||!rig.bones?.Head||rig.rainAccessories109)return rig;
 const V=(...v)=>new T.Vector3(...v),inverse=rig.kit.headAsset.inverse;
 const localHead=head.geometry.clone().applyMatrix4(inverse),headSurface=createTriangleSurface(T,localHead);
 const eyeGeometry=eyes.filter(e=>e?.geometry).map(e=>e.geometry.clone().applyMatrix4(inverse));
 const eyeSurfaces=eyeGeometry.map(g=>createTriangleSurface(T,g));
 const oldEyes=rig.kit.headAsset.portrait99.eyes,oldCenter=oldEyes.reduce((p,e)=>p.add(V(...e.center)),V()).multiplyScalar(1/oldEyes.length);
 const centers=[];
 // Rain stores both globes in one mesh. Measure each half separately so a
 // combined central bounding box cannot collapse the glasses' horizontal fit.
 for(const g of eyeGeometry){const p=g.attributes.position;for(const side of[-1,1]){const box=new T.Box3();let count=0;for(let i=0;i<p.count;i++)if(p.getX(i)*side>0){box.expandByPoint(V().fromBufferAttribute(p,i));count++;}if(count)centers.push(box.getCenter(V()));}}
 const center=centers.length?centers.reduce((p,q)=>p.add(q),V()).multiplyScalar(1/centers.length):oldCenter.clone();
 const oldHalf=oldEyes.reduce((n,e)=>n+Math.abs(e.center[0]),0)/oldEyes.length;
 const newHalf=centers.length?centers.reduce((n,p)=>n+Math.abs(p.x),0)/centers.length:oldHalf;
 const xScale=T.MathUtils.clamp(newHalf/Math.max(.001,oldHalf),.55,1.45),stats={eyewear:0,earrings:0,neckwear:0,hiddenNeckwear:0,frontProjections:0,sideProjections:0};
 let disposed=false;
 function front(x,y){
  const origin=V(x,y,.5),direction=V(0,0,-1);let best=null;
  for(const surface of [headSurface,...eyeSurfaces]){const hit=surface.cast(origin,direction,null,.8);if(hit&&(!best||hit.point.z>best.point.z))best=hit;}
  return best;
 }
 function edit(root,fn){
  const done=new Set();root.traverse(mesh=>{
   if(!mesh.isMesh||done.has(mesh.geometry))return;done.add(mesh.geometry);
   const g=mesh.geometry,p=g.attributes.position;
   for(let i=0;i<p.count;i++){const q=V().fromBufferAttribute(p,i);fn(q);p.setXYZ(i,q.x,q.y,q.z);}
   p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  });
 }
 function fitEyewear(root){
  edit(root,p=>{
   p.x*=xScale;p.y=center.y+(p.y-oldCenter.y)*1.18;p.z+=center.z-oldCenter.z;
   if(p.z>center.z+.006){const hit=front(p.x,p.y);if(hit&&p.z<hit.point.z+.0035){p.z=hit.point.z+.0035;stats.frontProjections++;}}
   else if(Math.abs(p.x)>.045){const s=Math.sign(p.x),hit=headSurface.cast(V(s*.3,p.y,p.z),V(-s,0,0),h=>h.point.x*s>0,.3);if(hit&&p.x*s<hit.point.x*s+.0035){p.x=hit.point.x+s*.0035;stats.sideProjections++;}}
  });stats.eyewear++;
 }
 function earTarget(side){
  const p=localHead.attributes.position;localHead.computeBoundingBox();
  const width=Math.max(Math.abs(localHead.boundingBox.min.x),Math.abs(localHead.boundingBox.max.x));
  const candidates=[];let low=Infinity;
  for(let i=0;i<p.count;i++){const q=V().fromBufferAttribute(p,i);if(q.x*side>width*.85&&q.y>center.y-.055&&q.y<center.y+.025&&q.z>-.075&&q.z<center.z-.025){candidates.push(q);low=Math.min(low,q.y);}}
  const row=candidates.filter(q=>q.y<low+.009),target=row.length?row.reduce((q,p)=>q.add(p),V()).multiplyScalar(1/row.length):V(side*width,center.y-.030,center.z-.070);
  target.y=Number.isFinite(low)?low+.005:target.y;
  const hit=headSurface.cast(V(side*.3,target.y,target.z),V(-side,0,0),h=>h.point.x*side>0,.3);
  if(hit)target.copy(hit.point);target.x+=side*.0035;return target;
 }
 function fitEarrings(root){
  const targets={1:earTarget(1),'-1':earTarget(-1)},anchors={};
  for(const side of[-1,1]){
   const samples=[];let high=-Infinity;
   root.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const q=V().fromBufferAttribute(p,i);if(q.x*side>0){samples.push(q);high=Math.max(high,q.y);}}});
   const cap=samples.filter(q=>q.y>high-.0007),a=cap.length?cap.reduce((q,p)=>q.add(p),V()).multiplyScalar(1/cap.length):targets[side].clone();
   a.y=high-(root.name.endsWith('-pearls')?.0055:.0036);anchors[side]=a;
  }
  edit(root,p=>{const s=p.x<0?-1:1;p.add(targets[s]).sub(anchors[s]);});stats.earrings++;
 }
 function fitNeckwear(root){
  let rest=root.userData.rainNeckwearRest109;
  if(!rest){rest=new Map();root.traverse(mesh=>{if(mesh.isMesh)rest.set(mesh.geometry,mesh.geometry.attributes.position.array.slice());});root.userData.rainNeckwearRest109=rest;}
  for(const [geometry,positions]of rest){geometry.attributes.position.array.set(positions);geometry.attributes.position.needsUpdate=true;}
  const authored=!!rig.rain109.sourceOutfit;
  const oldGarments=(rig.outfit?.meshes||[]).filter(m=>!/Legs|Feet|Buttons|Boot/.test(m.name));
  const garments=authored?(top?[top]:[]):oldGarments.filter(m=>m.visible);
  const indexed=new Map(),entry=mesh=>{if(!indexed.has(mesh.geometry))indexed.set(mesh.geometry,{mesh,surface:createTriangleSurface(T,mesh.geometry)});return indexed.get(mesh.geometry);};
  const surfaces=[head,...garments].map(entry),oldSurfaces=[rig.kit.skin,rig.kit.headAsset.mesh,...oldGarments].map(entry);
  const pending=[],axisZ=-.03;let missing=0,total=0,maxShift=0;
  try{
   root.traverse(mesh=>{
    if(!mesh.isMesh)return;const g=mesh.geometry,p=g.attributes.position,positions=p.array.slice(),joints=new Uint16Array(p.count*4),weights=new Float32Array(p.count*4);
    for(let i=0;i<p.count;i++){
     total++;const q=V().fromBufferAttribute(p,i),direction=V(q.x,0,q.z-axisZ).normalize(),origin=V(direction.x*.6,q.y,axisZ+direction.z*.6);
     let chosen=null;
     for(const entry of surfaces){const hit=entry.surface.cast(origin,direction.clone().negate(),h=>h.point.x*direction.x+(h.point.z-axisZ)*direction.z>.002,.6);if(hit&&(!chosen||hit.distance<chosen.hit.distance))chosen={...entry,hit};}
     if(!chosen||chosen.hit.point.distanceTo(q)>.12){missing++;continue;}
     const {hit,mesh:source}=chosen,a=source.geometry.attributes,face=hit.face;
     const bary=T.Triangle.getBarycoord(hit.point,V().fromBufferAttribute(a.position,face.a),V().fromBufferAttribute(a.position,face.b),V().fromBufferAttribute(a.position,face.c),V());
     if(!bary||!a.skinIndex||!a.skinWeight){missing++;continue;}
     const field=new Map();for(const[id,w]of[[face.a,bary.x],[face.b,bary.y],[face.c,bary.z]])for(let k=0;k<4;k++){const j=a.skinIndex.getComponent(id,k),v=a.skinWeight.getComponent(id,k)*w;field.set(j,(field.get(j)||0)+v);}
     const ranked=[...field].filter(e=>e[1]>1e-8).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=ranked.reduce((s,e)=>s+e[1],0);
     if(!(sum>0)){missing++;continue;}
     // Transfer the old supporting surface's displacement, retaining the
     // chain/pearl's radial relief instead of flattening every tube vertex.
     let oldHit=null;for(const e of oldSurfaces){const h=e.surface.cast(origin,direction.clone().negate(),h=>h.point.x*direction.x+(h.point.z-axisZ)*direction.z>.002,.6);if(h&&(!oldHit||h.distance<oldHit.distance))oldHit=h;}
     const relief=oldHit?T.MathUtils.clamp(q.clone().sub(oldHit.point).dot(direction),.0015,.024):.004;
     const fitted=hit.point.clone().addScaledVector(direction,relief);maxShift=Math.max(maxShift,fitted.distanceTo(q));fitted.toArray(positions,i*3);
     ranked.forEach(([j,w],k)=>{joints[i*4+k]=j;weights[i*4+k]=w/sum;});
    }
    pending.push({g,positions,joints,weights});
   });
   // Keep a chain only when every point has a verified same-side supporting surface.
   if(missing){root.visible=false;stats.hiddenNeckwear++;return {available:false,missing,total,maxShiftM:maxShift};}
   for(const {g,positions,joints,weights}of pending){g.setAttribute('position',new T.BufferAttribute(positions,3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();}
   root.visible=true;stats.neckwear++;return {available:true,missing,total,maxShiftM:maxShift};
  }finally{for(const e of indexed.values())e.surface.dispose();}
 }
 const originalRefresh=rig.refreshAccessories,originalDispose=rig.dispose;
 function fit(){
  if(disposed||rig.disposed)return;
  for(const root of rig.accessories?.roots||[]){
   if(root.name.startsWith('accessory-neckwear-')){
    const signature=rig.outfitId+'|'+(rig.rain109.sourceOutfit?1:0);
    if(root.userData.rainNeckwearSignature109!==signature){root.userData.rainNeckwear109=fitNeckwear(root);root.userData.rainNeckwearSignature109=signature;}
    continue;
   }
   if(root.userData.rainAccessories109)continue;
   if(root.name.startsWith('accessory-eyewear-'))fitEyewear(root);
   else if(root.name.startsWith('accessory-earrings-'))fitEarrings(root);
   root.userData.rainAccessories109=true;
  }
 }
 rig.refreshAccessories=function(...args){const result=originalRefresh.apply(this,args);fit();return result;};
 rig.rainAccessories109={fit,inspect:()=>({...stats,eyeCenter:center.toArray(),xScale})};
 rig.dispose=function(...args){if(disposed)return;disposed=true;headSurface.dispose();eyeSurfaces.forEach(s=>s.dispose());localHead.dispose();eyeGeometry.forEach(g=>g.dispose());return originalDispose.apply(this,args);};
 fit();return rig;
}
