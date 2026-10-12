import {createTriangleSurface} from './rider-head-surface.js?v=character-polish-20261009';

const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*t*(10+t*(-15+6*t));};
const component=(a,i,k)=>a[['getX','getY','getZ','getW'][k]](i);

// Fair a supported hanging line with a bending penalty. Contact is an upper
// bound, not a contour to trace: the free curve can bridge the nape indentation
// and raised collar while every emitted section retains its measured clearance.
function fairSupportedLine(original,rows,N,options){
 const count=N+1,A=Array.from({length:count},()=>new Float64Array(count)),b=new Float64Array(count),fixed=new Map(),lambda=options?.lambda??6000,tension=options?.tension??12;
 for(let i=0;i<count;i++){A[i][i]=1;b[i]=rows[i].z;if(i/N<=.10)fixed.set(i,original[i].z);}
 for(let i=1;i<N;i++){
  const ids=[i-1,i,i+1],v=[1,-2,1];for(let j=0;j<3;j++)for(let k=0;k<3;k++)A[ids[j]][ids[k]]+=lambda*v[j]*v[k];
 }
 for(let i=0;i<N;i++){A[i][i]+=tension;A[i+1][i+1]+=tension;A[i][i+1]-=tension;A[i+1][i]-=tension;}
 let z=rows.map(r=>r.z);
 function solve(){
  const ids=Array.from({length:count},(_,i)=>i).filter(i=>!fixed.has(i)),n=ids.length,L=Array.from({length:n},()=>new Float64Array(n)),rhs=ids.map(i=>{let value=b[i];for(const[j,v]of fixed)value-=A[i][j]*v;return value;}),y=new Float64Array(n),x=new Float64Array(n);
  // The original second-difference energy is pentadiagonal. Removing fixed
  // contact rows leaves at most two nonzero neighbours in the compressed order.
  for(let i=0;i<n;i++)for(let j=Math.max(0,i-2);j<=i;j++){
   let value=A[ids[i]][ids[j]];for(let k=Math.max(0,i-2,j-2);k<j;k++)value-=L[i][k]*L[j][k];L[i][j]=i===j?Math.sqrt(Math.max(1e-12,value)):value/L[j][j];
  }
  for(let i=0;i<n;i++){let value=rhs[i];for(let k=Math.max(0,i-2);k<i;k++)value-=L[i][k]*y[k];y[i]=value/L[i][i];}
  for(let i=n-1;i>=0;i--){let value=y[i];for(let k=i+1;k<=Math.min(n-1,i+2);k++)value-=L[k][i]*x[k];x[i]=value/L[i][i];}
  for(let i=0;i<n;i++)z[ids[i]]=x[i];for(const[i,v]of fixed)z[i]=v;
 }
 for(let iteration=0;iteration<count*4;iteration++){
  solve();let worst=-1,error=1e-9;
  for(let i=0;i<count;i++)if(!fixed.has(i)&&z[i]-rows[i].limit>error){worst=i;error=z[i]-rows[i].limit;}
  if(worst>=0){fixed.set(worst,rows[worst].limit);continue;}
  let release=-1,gradient=1e-8;
  for(const[i]of fixed){if(i/N<=.10)continue;let value=-b[i];for(let j=Math.max(0,i-2);j<=Math.min(N,i+2);j++)value+=A[i][j]*z[j];if(value>gradient){release=i;gradient=value;}}
  if(release>=0){fixed.delete(release);continue;}break;
 }
 return z.map((v,i)=>i/N<=.10?original[i].z:Math.min(v,rows[i].limit));
}

// Each braided length, loose end and tie shares a material axis and its native
// skeleton attachment. Only outfit/style changes rebuild this fitted assembly.
export function installNativeBraids(T,rig){
 const V=()=>new T.Vector3(),oldUpdate=rig.updateHairMass,oldLook=rig.setLook,oldOutfit=rig.setOutfit,oldDispose=rig.dispose;
 const canonical=new Map();rig.body.skeleton.bones.forEach((b,i)=>{if(!canonical.has(b.name)||rig.bones[b.name]===b)canonical.set(b.name,i);});
 const headIndex=canonical.get('Head'),spineIndex=canonical.get('spine_03'),restHead=rig.body.skeleton.boneInverses[headIndex].clone().invert(),headInverse=restHead.clone().invert();
 const allowed=new Set([...canonical].filter(([name])=>/^(Head|neck_\d+|spine_\d+|clavicle_[lr]|pelvis)$/.test(name)).map(([,i])=>i));
 let states=[],key=null,depth=0,dead=false;
 const stats={fits:0,updates:0,fitMs:0,last:null};
 // Raised neck collars are structural supports even when the garment builder
 // classifies them as details. Use their real skinned surface and ownership;
 // buttons, zipper tape and decorative stitching do not support a braid.
 const structuralCollars=new Set(['Technical_Stand_Collar','Show_Standing_Stock_Collar','Cotton76_Continuous_Collar']);
 const outer=()=>[...new Set([...(rig.outfit?.meshes||[]),rig.connectedWardrobe?.top])].filter(m=>m?.visible&&m.isSkinnedMesh&&(['torso-shell','outer-shell','cotton-inset','bib-straps','outer-garment'].includes(m.userData.riderSurfaceRole||m.userData.hairCollisionRole)||structuralCollars.has(m.name)));
 function frames(points){
  const result=[];let side=V().set(1,0,0),previous=null;
  for(let i=0;i<points.length;i++){
   const tangent=points[Math.min(points.length-1,i+1)].clone().sub(points[Math.max(0,i-1)]).normalize();
   if(previous)side.applyQuaternion(new T.Quaternion().setFromUnitVectors(previous,tangent));
   side.addScaledVector(tangent,-side.dot(tangent)).normalize();
   result.push({side:side.clone(),cross:tangent.clone().cross(side),tangent});previous=tangent;
  }
  return result;
 }
 function fit(parts){
  const t0=performance.now(),surfaces=[],assemblies=new Map(),N=128;
  try{
   for(const mesh of [...parts,rig.face]){
    const geometry=mesh.geometry.clone(),p=geometry.attributes.position,transform=headInverse.clone().multiply(mesh.bindMatrix);
    for(let i=0;i<p.count;i++){const point=V().fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(transform);p.setXYZ(i,point.x,point.y,point.z);}
    surfaces.push({mesh,geometry,surface:createTriangleSurface(T,geometry)});
   }
   const head=surfaces.find(s=>s.mesh===rig.face),triangles=[];
   for(let i=0;i<head.geometry.index.count;i+=3){
    const ids=[head.geometry.index.getX(i),head.geometry.index.getX(i+1),head.geometry.index.getX(i+2)],points=ids.map(id=>V().fromBufferAttribute(head.geometry.attributes.position,id));
    triangles.push({ids,triangle:new T.Triangle(...points),lo:V().set(Math.min(...points.map(p=>p.x)),Math.min(...points.map(p=>p.y)),Math.min(...points.map(p=>p.z))),hi:V().set(Math.max(...points.map(p=>p.x)),Math.max(...points.map(p=>p.y)),Math.max(...points.map(p=>p.z)))});
   }
   let headQueries=0,castQueries=0;
   function headAttachment(point){
    headQueries++;let best=.036*.036,selected=null,closest=V(),temp=V();
    for(const tri of triangles){
     let distance=0;for(let k=0;k<3;k++){const v=point.getComponent(k),gap=Math.max(tri.lo.getComponent(k)-v,0,v-tri.hi.getComponent(k));distance+=gap*gap;}
     if(distance>best)continue;tri.triangle.closestPointToPoint(point,temp);distance=temp.distanceToSquared(point);
     if(distance<best){best=distance;selected=tri;closest.copy(temp);}
    }
    if(!selected)return 0;
    const bary=selected.triangle.getBarycoord(closest,V());let w=0;
    for(let i=0;i<3;i++)for(let k=0;k<4;k++)if(head.mesh.skeleton.bones[component(head.mesh.geometry.attributes.skinIndex,selected.ids[i],k)]?.name==='Head')w+=Math.max(0,bary.getComponent(i))*component(head.mesh.geometry.attributes.skinWeight,selected.ids[i],k);
    return Math.max(0,Math.min(1,w))*(1-smooth(.018,.036,Math.sqrt(best)));
   }
   function ownership(part,hit){
    const p=part.geometry.attributes.position,f=hit.face,bary=T.Triangle.getBarycoord(hit.point,V().fromBufferAttribute(p,f.a),V().fromBufferAttribute(p,f.b),V().fromBufferAttribute(p,f.c),V()),result=new Map();
    for(const[id,t]of[[f.a,bary.x],[f.b,bary.y],[f.c,bary.z]])for(let k=0;k<4;k++){
     const j=canonical.get(part.mesh.skeleton.bones[component(part.mesh.geometry.attributes.skinIndex,id,k)]?.name),w=Math.max(0,t)*component(part.mesh.geometry.attributes.skinWeight,id,k);
     if(allowed.has(j)&&w>0)result.set(j,(result.get(j)||0)+w);
    }
    const sum=[...result.values()].reduce((a,b)=>a+b,0);if(sum<1e-8)return null;for(const[j,w]of result)result.set(j,w/sum);return result;
   }
   for(const state of states)for(const binding of state.source.userData.braidBindings){
    if(binding.front||assemblies.has(binding.assembly))continue;
    const central=rig.hair.name==='hair-braid'||rig.hair.name==='hair-braidedpony',twin=rig.hair.name==='hair-twinbraids',axis=new T.CatmullRomCurve3(binding.axis.map(p=>V().fromArray(p))),original=Array.from({length:N+1},(_,i)=>axis.getPoint(i/N)),oldFrames=frames(original),rows=[];
    // Derive support from the complete emitted cross section, including every
    // weave lobe, loose end and tie, instead of a nominal strand radius.
    const extents=new Array(N+1).fill(0),sectionOffsets=twin?Array.from({length:N+1},()=>[]):null;
    for(const state of states)for(const piece of state.source.userData.braidBindings){
     if(piece.assembly!==binding.assembly||piece.front)continue;
     for(let v=0;v<piece.count;v++){
      const t=Math.max(0,Math.min(1,piece.along[v])),point=V().fromBufferAttribute(state.source.attributes.position,piece.start+v),r=point.distanceTo(axis.getPoint(t)),row=Math.floor(t*N);
      for(let k=Math.max(0,row-1);k<=Math.min(N,row+2);k++){
       extents[k]=Math.max(extents[k],r);
       if(twin){
        const u=t*N,j=Math.min(N-1,Math.floor(u)),f=u-j,tangent=oldFrames[j].tangent.clone().lerp(oldFrames[j+1].tangent,f).normalize(),side=oldFrames[j].side.clone().lerp(oldFrames[j+1].side,f);side.addScaledVector(tangent,-side.dot(tangent)).normalize();
        const offset=point.clone().sub(axis.getPoint(t));sectionOffsets[k].push([offset.dot(side),offset.dot(tangent.clone().cross(side)),offset.dot(tangent)]);
       }
      }
     }
    }

    let twinZ=null;
    if(twin){
     // Twin axes cross a sloped shoulder at different offsets. Measure the
     // actual emitted weave/tie/end section in its transported frame; an
     // enclosing sphere combines unrelated width and depth and overstates the
     // collar clearance. Fair the resulting bounds instead of tracing them.
     let currentFrames=oldFrames;
     const offsets=sectionOffsets.map(list=>[...new Map(list.map(v=>[v.map(x=>Math.round(x*2000)).join(','),v])).values()]);
     for(let pass=0;pass<3;pass++){
      rows.length=0;
      for(let i=0;i<=N;i++){
       const t=i/N,point=original[i],frame=currentFrames[i];let limit=Infinity,owner=null,ownerZ=Infinity,collarOwner=null,collarZ=Infinity,hitCount=0;
       for(const components of offsets[i]){
        const offset=V().addScaledVector(frame.side,components[0]).addScaledVector(frame.cross,components[1]).addScaledVector(frame.tangent,components[2]);
        for(const part of surfaces){
         castQueries++;const hit=part.surface.cast(V().set(point.x+offset.x,point.y+offset.y,-.8),V().set(0,0,1),h=>Math.abs(h.point.z-rig.kit.head.cz)<.45);
         if(!hit)continue;hitCount++;// The departing section sweeps into the raised collar during
         // sprint. Reserve eight millimetres over that broad upper interval,
         // plus five over the shoulder transition; pinned roots and ends
         // retain their attachment/local clearance.
         const reserve=.008*smooth(.16,.24,t)*(1-smooth(.30,.44,t))+.005*smooth(.40,.55,t)*(1-smooth(.70,.88,t)),bound=hit.point.z-offset.z-.008-reserve;limit=Math.min(limit,bound);
         if(bound<ownerZ){const weights=ownership(part,hit);if(weights){owner=weights;ownerZ=bound;}}
         // A real collar section owns the departing side length where the
         // emitted weave occupies its footprint. The inner skin can impose
         // clearance without carrying this free section through the collar.
         if(structuralCollars.has(part.mesh.name)&&bound<collarZ){const weights=ownership(part,hit);if(weights){collarOwner=weights;collarZ=bound;}}
        }
       }
       if(collarOwner&&owner){const factor=1-smooth(.34,.44,t),mixed=new Map();for(const[k,w]of owner)mixed.set(k,w*(1-factor));for(const[k,w]of collarOwner)mixed.set(k,(mixed.get(k)||0)+w*factor);owner=mixed;}
       if(!Number.isFinite(limit))limit=point.z;
       const follow=smooth(.10,.25,t),target=point.z+(limit-point.z)*follow;
       rows.push({z:t<=.10?point.z:target,limit:t<=.10?point.z:target,follow,weights:owner,collarWeights:collarOwner,hits:hitCount});
      }
      // A raised collar carries a broad departing section, including the
      // nearby free length above its exact rest footprint. Borrow ownership
      // only from a measured collar on this same side axis, with a 45mm
      // physical transition. Taper back to local shirt ownership through
      // along .34-.44; geometry clearance still uses occupied sections.
      const collars=rows.map((r,i)=>r.collarWeights&&i/N<=.44?i:-1).filter(i=>i>=0);
      for(let i=0;i<=N;i++){
       if(i/N<=.10||!rows[i].weights||!collars.length)continue;
       let near=collars[0];for(const j of collars)if(Math.abs(original[j].y-original[i].y)<Math.abs(original[near].y-original[i].y))near=j;
       const factor=(1-smooth(.010,.045,Math.abs(original[near].y-original[i].y)))*(1-smooth(.34,.44,i/N));if(!factor)continue;
       const owner=new Map();for(const[k,w]of rows[i].weights)owner.set(k,w*(1-factor));for(const[k,w]of rows[near].collarWeights)owner.set(k,(owner.get(k)||0)+w*factor);rows[i].weights=owner;
      }
      twinZ=fairSupportedLine(original,rows,N,{lambda:1800,tension:6});
      currentFrames=frames(original.map((p,i)=>p.clone().setZ(twinZ[i])));
     }
    }else{
    for(let i=0;i<=N;i++){
     const t=i/N,point=original[i],radius=Math.max(extents[i],binding.radius*.20),margin=radius+.008;
     let limit=central||twin?Infinity:point.z,owner=null,ownerZ=Infinity,hitCount=0;
     // Sample the width actually occupied by the braid. The central style
     // takes ownership from its local skull/neck or outer clothing support;
     // Twin braids query only their own side axis and occupied width; a side
     // length outside the narrow neck retains its hanging seed, rather than
     // borrowing a central nape plane or the opposite shoulder's ownership.
     for(const x of [point.x-radius,point.x,point.x+radius])for(const y of [point.y-radius,point.y,point.y+radius])for(const part of surfaces){
      castQueries++;const hit=part.surface.cast(V().set(x,y,-.8),V().set(0,0,1),h=>Math.abs(h.point.z-rig.kit.head.cz)<.45);
      if(!hit)continue;hitCount++;limit=Math.min(limit,hit.point.z-margin);
      // The central braid follows its real skull/neck until the outer collar
      // or shirt becomes the rear support. That surface also owns its motion.
      if((central||twin||part.mesh!==rig.face)&&hit.point.z<ownerZ){const weights=ownership(part,hit);if(weights){owner=weights;ownerZ=hit.point.z;}}
     }
     if(!Number.isFinite(limit))limit=point.z;
     const follow=central||twin?smooth(.10,.25,t):smooth(.10,.22,t)*(1-headAttachment(point)),target=point.z+(limit-point.z)*follow;
     rows.push({z:t<=.10?point.z:central||twin?target:Math.min(point.z,target),limit:t<=.10?point.z:target,follow,weights:owner,hits:hitCount});
    }
    }
    const valid=rows.map((r,i)=>r.weights?i:-1).filter(i=>i>=0);
    for(let i=0;i<=N;i++)if(!rows[i].weights){let near=valid[0];for(const j of valid)if(Math.abs(j-i)<Math.abs(near-i))near=j;rows[i].weights=new Map(near===undefined?[[spineIndex,1]]:rows[near].weights);}
    // One smooth displacement field carries every woven lobe, tie and end.
    // Central sections return toward the current-height support as the neck
    // narrows. Each twin axis independently relaxes after its own collar/back
    // support recedes. No X/Y changes or shared centreline merge are applied.
    if(!central&&!twin){let rear=rows[0].z;
     for(let i=0;i<=N;i++){if(i/N>.25){rear=Math.min(rear,rows[i].limit);rows[i].limit=rear;rows[i].z=Math.min(rows[i].z,rear);}else rear=rows[i].z;}
    }
    let z=twin?twinZ:central?fairSupportedLine(original,rows,N):rows.map(r=>r.z);
    if(!central&&!twin)for(let pass=0;pass<100;pass++){
     const curvature=z.map((v,i)=>i===0||i===N?0:z[i-1]-2*v+z[i+1]);
     z=z.map((v,i)=>i/N<=.10||i===N?v:Math.min(rows[i].limit,v-.055*(curvature[i-1]-2*curvature[i]+curvature[i+1])));
    }
    let weights=rows.map(r=>r.weights);
    if(central||twin)weights=weights.map((_,i)=>{
     const out=new Map();let total=0;for(let j=0;j<=N;j++){const d=Math.abs(original[j].y-original[i].y);if(d>.045)continue;const factor=Math.exp(-.5*(d/.018)**2);total+=factor;for(const[k,w]of rows[j].weights)out.set(k,(out.get(k)||0)+w*factor);}for(const[k,w]of out)out.set(k,w/total);return out;
    });
    for(let pass=0;pass<3;pass++)weights=weights.map((r,i)=>{const out=new Map();for(const[d,k]of[[-1,.25],[0,.5],[1,.25]])for(const[j,w]of weights[Math.max(0,Math.min(N,i+d))])out.set(j,(out.get(j)||0)+w*k);return out;});
    const fitted=original.map((p,i)=>p.clone().setZ(z[i])),newFrames=frames(fitted);
    assemblies.set(binding.assembly,{original,fitted,oldFrames,newFrames,weights:weights.map((r,i)=>{const out=new Map([...r].map(([j,w])=>[j,w*rows[i].follow]));out.set(headIndex,(out.get(headIndex)||0)+1-rows[i].follow);return out;}),maxShift:Math.max(...z.map((v,i)=>Math.abs(v-original[i].z))),samples:N+1,hits:rows.filter(r=>r.hits).length,rootPreserved:original.slice(0,Math.floor(N*.10)+1).every((p,i)=>p.equals(fitted[i]))});
   }
   for(const state of states){
    const g=state.source.clone();g.userData={...state.source.userData};const p=g.attributes.position,si=new Uint16Array(p.count*4),sw=new Float32Array(p.count*4);for(let i=0;i<p.count;i++){si[i*4]=headIndex;sw[i*4]=1;}
    for(const binding of state.source.userData.braidBindings){
     const a=assemblies.get(binding.assembly);if(binding.front||!a)continue;
     if(binding.along.length!==binding.count)throw Error('Braid axis coordinate count mismatch');
     for(let v=0;v<binding.count;v++){
      const id=binding.start+v,t=Math.max(0,Math.min(1,binding.along[v])),u=t*N,i=Math.min(N-1,Math.floor(u)),f=u-i;
      if(t<=.10)continue;
      const center=a.original[i].clone().lerp(a.original[i+1],f),next=a.fitted[i].clone().lerp(a.fitted[i+1],f),offset=V().fromBufferAttribute(state.source.attributes.position,id).sub(center);
      const atFrame=frames=>{const tangent=frames[i].tangent.clone().lerp(frames[i+1].tangent,f).normalize(),side=frames[i].side.clone().lerp(frames[i+1].side,f);side.addScaledVector(tangent,-side.dot(tangent)).normalize();return{side,tangent,cross:tangent.clone().cross(side)};};
      const oldFrame=atFrame(a.oldFrames),newFrame=atFrame(a.newFrames);
      const point=next.clone();for(const k of ['side','cross','tangent'])point.addScaledVector(newFrame[k],offset.dot(oldFrame[k]));
      p.setXYZ(id,point.x,point.y,point.z);
      const influences=new Map();for(const[row,w]of[[a.weights[i],1-f],[a.weights[i+1],f]])for(const[j,value]of row)influences.set(j,(influences.get(j)||0)+value*w);
      const ranked=[[headIndex,influences.get(headIndex)||0],...[...influences].filter(([j,w])=>j!==headIndex&&w>0).sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,3)],sum=ranked.reduce((s,[,w])=>s+w,0);while(ranked.length<4)ranked.push([headIndex,0]);
      for(let k=0;k<4;k++){si[id*4+k]=ranked[k][0];sw[id*4+k]=ranked[k][1]/sum;}
     }
    }
    g.setAttribute('skinIndex',new T.Uint16BufferAttribute(si,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(sw,4));g.computeVertexNormals();if(g.attributes.tangent)g.computeTangents();g.computeBoundingSphere();g.userData.flexibleHair=true;
    const mesh=state.mesh;
    if(mesh.isSkinnedMesh){mesh.geometry.dispose();mesh.geometry=g;}
    else{
     const replacement=new T.SkinnedMesh(g,mesh.material);replacement.name=mesh.name;replacement.userData={...mesh.userData,ownGeo:true,flexibleHair:true};replacement.customDepthMaterial=mesh.customDepthMaterial;replacement.castShadow=mesh.castShadow;replacement.receiveShadow=mesh.receiveShadow;replacement.frustumCulled=false;replacement.bindMode=T.AttachedBindMode;replacement.bind(rig.body.skeleton,restHead);
     const parent=mesh.parent;parent.remove(mesh);parent.add(replacement);if(mesh.userData.ownGeo)mesh.geometry.dispose();state.mesh=replacement;
    }
   }
   rig.root.updateMatrixWorld(true);rig.body.skeleton.update();stats.fits++;stats.last={assemblies:[...assemblies].map(([id,a])=>({id,maxShiftM:a.maxShift,samples:a.samples,supportRows:a.hits,rootPreserved:a.rootPreserved})),headQueries,castQueries,parts:parts.map(m=>m.name),warmQueries:0};
  }finally{for(const s of surfaces){s.surface.dispose();s.geometry.dispose();}stats.fitMs=performance.now()-t0;}
 }
 function update(){
  if(dead)return;stats.updates++;const result=oldUpdate?.call(rig);if(depth)return result;
  const meshes=rig.hair?.children.filter(m=>m.geometry?.userData.braidBindings?.some(b=>!b.front))||[];
  if(meshes.length!==states.length||meshes.some(m=>!states.some(s=>s.mesh===m))){for(const s of states)s.source.dispose();states=meshes.map(mesh=>({mesh,source:mesh.geometry.clone()}));key=null;}
  if(!states.length)return result;
  const parts=outer(),nextKey=parts.map(m=>m.uuid+':'+m.geometry.uuid).join('|');if(parts.length&&nextKey!==key){fit(parts);key=nextKey;}
  return result;
 }
 rig.setLook=(...args)=>{depth++;try{return oldLook.apply(rig,args);}finally{depth--;if(!depth)update();}};
 rig.setOutfit=(...args)=>{depth++;try{return oldOutfit.apply(rig,args);}finally{depth--;if(!depth)update();}};
 rig.updateHairMass=update;rig.updatePoseDetails=update;rig.braidEvidence=()=>({...stats,active:!!states.length,disposed:dead});
 rig.dispose=()=>{if(dead)return;for(const s of states)s.source.dispose();states=[];dead=true;oldDispose.call(rig);};
 update();return rig;
}
