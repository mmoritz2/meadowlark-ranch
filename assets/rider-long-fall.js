import {createTriangleSurface} from './rider-head-surface.js?v=character-polish-20261009';
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const smoother=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*t*(10+t*(-15+6*t));};
const component=(a,i,k)=>a[['getX','getY','getZ','getW'][k]](i);
// Experimental long fall only. The accepted cap, bridge geometry, forelocks and all other
// styles retain their source geometry. No stateful motion/contact solver.
export function installRearFall4c(T,rig){
 const V=()=>new T.Vector3(),oldUpdate=rig.updateHairMass,oldLook=rig.setLook,oldOutfit=rig.setOutfit,oldDispose=rig.dispose;
 let state=null,depth=0,dead=false;const stats={fits:0,updates:0,fitMs:0,last:null};
 const canonical=new Map();rig.body.skeleton.bones.forEach((b,i)=>{if(!canonical.has(b.name)||rig.bones[b.name]===b)canonical.set(b.name,i);});
 const headIndex=canonical.get('Head'),allowed=new Set([...canonical].filter(([name])=>/^(Head|neck_\d+|spine_\d+|clavicle_[lr]|pelvis)$/.test(name)).map(([,i])=>i));
 const restHead=rig.body.skeleton.boneInverses[headIndex].clone().invert();
 function outer(){return [...new Set([...(rig.outfit?.meshes||[]),rig.connectedWardrobe?.top])].filter(m=>m?.visible&&m.isSkinnedMesh&&['torso-shell','outer-shell','cotton-inset','bib-straps','outer-garment'].includes(m.userData.riderSurfaceRole||m.userData.hairCollisionRole));}
 function fit(mesh,parts){
  const t0=performance.now(),source=state.source,meta=source.userData.crownFallJoin,cap=meta.capCount,A=112,B=48,total=(A+1)*(B+1);
  const surfaces=[...parts,rig.face].filter(Boolean).map(m=>{m.skeleton.update();const g=m.geometry.clone(),p=g.attributes.position;for(let i=0;i<p.count;i++)p.setXYZ(i,...V().fromBufferAttribute(m.geometry.attributes.position,i).applyMatrix4(m.bindMatrix).applyMatrix4(restHead.clone().invert()).toArray());return{m,g,surface:createTriangleSurface(T,g)};});
  // Build-only actual Head/neck nearest triangles avoid missing side silhouettes.
  // Within the existing support clearance, rigid scalp keeps Head ownership;
  // the constraint fades smoothly to zero at twice that distance.
  const headSurface=surfaces.find(part=>part.m===rig.face),headQuery={calls:0,hits:0,nodeVisits:0};
  const headTriangles=[];if(headSurface){const g=headSurface.g,p=g.attributes.position;for(let i=0;i<g.index.count;i+=3){const ids=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)],points=ids.map(id=>V().fromBufferAttribute(p,id)),triangle=new T.Triangle(...points),lo=[0,1,2].map(k=>Math.min(...points.map(v=>v.getComponent(k)))),hi=[0,1,2].map(k=>Math.max(...points.map(v=>v.getComponent(k))));headTriangles.push({ids,triangle,lo,hi,center:lo.map((v,k)=>(v+hi[k])*.5)});}}
  function headTree(ids){const lo=[0,1,2].map(k=>Math.min(...ids.map(i=>headTriangles[i].lo[k]))),hi=[0,1,2].map(k=>Math.max(...ids.map(i=>headTriangles[i].hi[k]))),node={lo,hi};if(ids.length<=12){node.ids=ids;return node;}let axis=0;for(let k=1;k<3;k++)if(hi[k]-lo[k]>hi[axis]-lo[axis])axis=k;ids.sort((a,b)=>headTriangles[a].center[axis]-headTriangles[b].center[axis]);const mid=ids.length>>1;node.left=headTree(ids.slice(0,mid));node.right=headTree(ids.slice(mid));return node;}
  const headRoot=headTriangles.length?headTree(headTriangles.map((_,i)=>i)):null;
  function headAttachment(point){
    headQuery.calls++;if(!headRoot)return 0;let best=.036*.036,found=null,closest=V();const temporary=V();
    const distance=node=>{let d=0;for(let k=0;k<3;k++){const v=point.getComponent(k),gap=Math.max(node.lo[k]-v,0,v-node.hi[k]);d+=gap*gap;}return d;};
    const visit=node=>{headQuery.nodeVisits++;if(distance(node)>best)return;if(node.ids){for(const i of node.ids){const tri=headTriangles[i];tri.triangle.closestPointToPoint(point,temporary);const d=temporary.distanceToSquared(point);if(d<best){best=d;found=tri;closest.copy(temporary);}}return;}const dl=distance(node.left),dr=distance(node.right);if(dl<dr){if(dl<=best)visit(node.left);if(dr<=best)visit(node.right);}else{if(dr<=best)visit(node.right);if(dl<=best)visit(node.left);}};visit(headRoot);if(!found)return 0;
    headQuery.hits++;const bary=found.triangle.getBarycoord(closest,V());let weight=0;found.ids.forEach((id,i)=>{for(let k=0;k<4;k++)if(headSurface.m.skeleton.bones[component(headSurface.m.geometry.attributes.skinIndex,id,k)]?.name==='Head')weight+=component(headSurface.m.geometry.attributes.skinWeight,id,k)*Math.max(0,bary.getComponent(i));});
    return Math.max(0,Math.min(1,weight))*(1-smoother(.018,.036,Math.sqrt(best)));
  }
  const p=source.attributes.position,basePoint=(row,col)=>V().fromBufferAttribute(p,cap+row*113+col).add(V().fromBufferAttribute(p,cap+total+row*113+col)).multiplyScalar(.5);
  const field=[],rows=B-meta.joinRow+1;let directHits=0,missing=0;
  for(let r=meta.joinRow;r<=B;r++){
   const row=[];
   for(let c=0;c<=A;c++){
    const point=basePoint(r,c),direction=V().set(0,0,1);let chosen=null,owner=null;
    // Both drawn rails need support: a center ray alone can miss the steep
    // garment silhouette underneath the inward rail at the waist.
    for(const probe of [point,V().fromBufferAttribute(p,cap+r*113+c),V().fromBufferAttribute(p,cap+total+r*113+c)])for(const part of surfaces){const hit=part.surface.cast(V().set(probe.x,probe.y,-.8),direction,h=>Math.abs(h.point.z-rig.kit.head.cz)<.45),supportZ=hit?hit.point.z-(probe.z-point.z):Infinity;if(hit&&(!chosen||supportZ<chosen.supportZ))chosen={part,hit,supportZ};if(hit&&part.m!==rig.face&&(!owner||supportZ<owner.supportZ))owner={part,hit,supportZ};}
    if(!chosen){row.push(null);missing++;continue;}directHits++;
    const {part,hit}=owner||chosen,bary=V(),f=hit.face,q=part.g.attributes.position;T.Triangle.getBarycoord(hit.point,V().fromBufferAttribute(q,f.a),V().fromBufferAttribute(q,f.b),V().fromBufferAttribute(q,f.c),bary);const weights=new Map();
    for(const[id,t]of[[f.a,bary.x],[f.b,bary.y],[f.c,bary.z]])for(let k=0;k<4;k++){const j=canonical.get(part.m.skeleton.bones[component(part.m.geometry.attributes.skinIndex,id,k)]?.name),w=component(part.m.geometry.attributes.skinWeight,id,k)*Math.max(0,t);if(allowed.has(j)&&w>0)weights.set(j,(weights.get(j)||0)+w);}
    const sum=[...weights.values()].reduce((a,b)=>a+b,0);if(!sum)throw Error('No torso hair weights');for(const[j,w]of weights)weights.set(j,w/sum);
    row.push({z:chosen.supportZ,weights:owner?weights:null,direct:true});
   }
   field.push(row);
  }
  // Continue measured same-height support only across a missing silhouette.
  // This is a fitted geometric field, never an outfit/body-ID coordinate table.
  for(const row of field){const valid=row.map((v,i)=>v?i:-1).filter(i=>i>=0);if(valid.length)for(let c=0;c<=A;c++)if(!row[c]){let near=valid[0];for(const v of valid)if(Math.abs(v-c)<Math.abs(near-c))near=v;row[c]={...row[near],direct:false};}}
  const valid=field.map((r,i)=>r.some(Boolean)?i:-1).filter(i=>i>=0);if(!valid.length)throw Error('Actual garment has no rear support');
  for(let r=0;r<rows;r++)if(!field[r].some(Boolean)){let near=valid[0];for(const v of valid)if(Math.abs(v-r)<Math.abs(near-r))near=v;field[r]=field[near].map(v=>({...v,direct:false}));}
  // Head/neck contributes collision support, while only the current garment
  // contributes the released fall's torso ownership. Head attachment already
  // has a separate explicit smooth fade; borrowing face weights would add a
  // second abrupt Head-to-shoulder transition.
  for(const row of field){const valid=row.map((v,i)=>v.weights?i:-1).filter(i=>i>=0);if(valid.length)for(let c=0;c<=A;c++)if(!row[c].weights){let near=valid[0];for(const v of valid)if(Math.abs(v-c)<Math.abs(near-c))near=v;row[c].weights=new Map(row[near].weights);}}
  const weightRows=field.map((row,r)=>row.some(v=>v.weights)?r:-1).filter(r=>r>=0);if(!weightRows.length)throw Error('No measured garment ownership');
  for(let r=0;r<rows;r++)if(!field[r].some(v=>v.weights)){let near=weightRows[0];for(const v of weightRows)if(Math.abs(v-r)<Math.abs(near-r))near=v;field[r].forEach((v,c)=>v.weights=new Map(field[near][c].weights));}
  // Smooth ownership, while keeping each measured outer garment depth as a
  // conservative lower bound. No dense query remains in the animation loop.
  let smoothed=field;const kernel=[1,2,1];for(let pass=0;pass<2;pass++)for(const axis of[0,1])smoothed=smoothed.map((row,r)=>row.map((_,c)=>{const weights=new Map();let z=0;for(let d=-1;d<=1;d++){const v=smoothed[axis===0?Math.max(0,Math.min(rows-1,r+d)):r][axis===1?Math.max(0,Math.min(A,c+d)):c],k=kernel[d+1]/4;z+=v.z*k;for(const[j,w]of v.weights)weights.set(j,(weights.get(j)||0)+w*k);}return{z,weights};}));
  // Fair each longitudinal path against the measured support inequality.
  // First two rows and the style's final-height tip remain fixed. Projected
  // bending-energy descent spreads a shoulder bend over neighboring rows without
  // allowing any free row forward of the actual support clearance.
  const bounds=field.map((row,r)=>row.map((raw,c)=>Math.min(raw.z,smoothed[r][c].z)-.018));
  // Negative Head-bind Z is rearward. Preserve the deepest support already
  // cleared by each column: a narrower waist must not pull the lower fall in.
  for(let c=0;c<=A;c++){let back=basePoint(meta.joinRow+1,c).z;for(let r=2;r<rows;r++){back=Math.min(back,bounds[r][c]);bounds[r][c]=back;}}
  let fair=field.map((row,r)=>row.map((_,c)=>{const point=basePoint(r+meta.joinRow,c),target=bounds[r][c],blend=target<point.z?smooth(1,3,r):smooth(1,8,r);return r<2?point.z:Math.min(point.z+(target-point.z)*blend,target);}));
  const seeded=fair.map(row=>row.slice());
  for(let pass=0;pass<400;pass++){
   const curvature=fair.map((row,r)=>row.map((z,c)=>r===0||r===rows-1?0:fair[r-1][c]-2*z+fair[r+1][c]));
   fair=fair.map((row,r)=>row.map((z,c)=>r<2||r===rows-1?z:Math.min(bounds[r][c],z-.055*(curvature[r-1][c]-2*curvature[r][c]+curvature[r+1][c]))));
  }
  const bends=paths=>{const values=[];for(let c=0;c<=A;c++)for(let r=2;r<rows-1;r++){const a=basePoint(r+meta.joinRow-1,c),b=basePoint(r+meta.joinRow,c),d=basePoint(r+meta.joinRow+1,c);a.z=paths[r-1][c];b.z=paths[r][c];d.z=paths[r+1][c];values.push(a.sub(b).negate().normalize().angleTo(d.sub(b).normalize())*180/Math.PI);}values.sort((a,b)=>a-b);return{median:values[values.length>>1],p95:values[Math.floor(values.length*.95)],max:values.at(-1)};};
  const fairing={iterations:400,beforeBendDegrees:bends(seeded),afterBendDegrees:bends(fair),maxOutwardAdjustmentM:Math.max(...fair.flatMap((row,r)=>row.map((z,c)=>seeded[r][c]-z)))};
  const g=source.clone();g.userData={...source.userData};const gp=g.attributes.position,si=new Uint16Array(gp.count*4),sw=new Float32Array(gp.count*4),moved=new Uint8Array(gp.count);for(let i=0;i<gp.count;i++){si[i*4]=headIndex;sw[i*4]=1;}
  const shifts=[],residuals=[],arcs=[];let maxShift=0,maxWeightError=0;
  for(let r=meta.joinRow;r<=B;r++)for(let c=0;c<=A;c++){
   const f=smoothed[r-meta.joinRow][c],raw=field[r-meta.joinRow][c],point=basePoint(r,c),fit=smooth(meta.joinRow+1,meta.joinRow+8,r),follow=1-headAttachment(point),targetZ=bounds[r-meta.joinRow][c],shift=fair[r-meta.joinRow][c]-point.z;
   let influences=new Map([...f.weights].map(([j,w])=>[j,w*follow]));influences.set(headIndex,(influences.get(headIndex)||0)+1-follow);const ranked=[[headIndex,influences.get(headIndex)||0],...[...influences].filter(([j,w])=>j!==headIndex&&w>0).sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,3)],sum=ranked.reduce((s,[,w])=>s+w,0);while(ranked.length<4)ranked.push([headIndex,0]);for(const q of ranked)q[1]/=sum;
   for(let side=0;side<2;side++){
    const id=cap+side*total+r*113+c,desired=V().fromBufferAttribute(p,id);desired.z+=shift;
    if(smoother(meta.joinRow+1,meta.joinRow+10,r)>0||shift!==0){gp.setXYZ(id,...desired.toArray());moved[id]=1;}
    for(let k=0;k<4;k++){si[id*4+k]=ranked[k][0];sw[id*4+k]=ranked[k][1];}maxWeightError=Math.max(maxWeightError,Math.abs(sw[id*4]+sw[id*4+1]+sw[id*4+2]+sw[id*4+3]-1));
   }
   maxShift=Math.max(maxShift,Math.abs(shift));shifts.push(shift);if(raw.direct&&fit===1)residuals.push(raw.z-(point.z+shift));
  }
  // Release ownership across the existing joined bridge, before it reaches
  // shoulder height. The crown seam and first two bridge rings remain Head100.
  // The final bridge ring and first fall ring use the very same measured
  // garment weights, so duplicate seam positions also deform identically.
  const bridgeBase=cap+meta.fallCount,bridgeRows=7,ringWidth=A+1;
  for(let c=0;c<=A;c++)for(let side=0;side<2;side++)for(let ring=1;ring<=bridgeRows;ring++){
    const id=bridgeBase+meta.bottomBridgeIndices[c]+side*bridgeRows*ringWidth-(bridgeRows-ring)*ringWidth,
      center=V().fromBufferAttribute(p,bridgeBase+meta.bottomBridgeIndices[c]-(bridgeRows-ring)*ringWidth).add(V().fromBufferAttribute(p,bridgeBase+meta.bottomBridgeIndices[c]+bridgeRows*ringWidth-(bridgeRows-ring)*ringWidth)).multiplyScalar(.5),follow=smoother(2,bridgeRows,ring)*(1-headAttachment(center)),f=smoothed[0][c],weights=new Map([...f.weights].map(([j,w])=>[j,w*follow]));
    weights.set(headIndex,(weights.get(headIndex)||0)+1-follow);
    const ranked=[[headIndex,weights.get(headIndex)||0],...[...weights].filter(([j,w])=>j!==headIndex&&w>0).sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,3)],sum=ranked.reduce((s,[,w])=>s+w,0);
    while(ranked.length<4)ranked.push([headIndex,0]);
    for(let k=0;k<4;k++){si[id*4+k]=ranked[k][0];sw[id*4+k]=ranked[k][1]/sum;}
  }
  g.setAttribute('skinIndex',new T.Uint16BufferAttribute(si,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(sw,4));g.computeVertexNormals();for(let i=0;i<gp.count;i++)if(!moved[i])g.attributes.normal.setXYZ(i,source.attributes.normal.getX(i),source.attributes.normal.getY(i),source.attributes.normal.getZ(i));if(source.attributes.tangent){g.computeTangents();const t=g.attributes.tangent,old=source.attributes.tangent;for(let i=0;i<gp.count;i++)if(!moved[i])t.setXYZW(i,old.getX(i),old.getY(i),old.getZ(i),old.getW(i));}g.computeBoundingSphere();
  stats.last={method:'Actual current outer garments and head/neck in canonical Head bind coordinates; center plus both drawn rails; separate actual garment torso ownership with explicit Head fade; monotone measured prior-support envelope and constrained longitudinal fairing; direct native bind construction; Head100 cap/forelocks and first two bridge rings; actual Head-surface ownership gates smooth measured torso release over remaining bridge; seam-identical native lower-fall skinning',headNeckSupport:{name:rig.face.name,vertices:rig.face.geometry.attributes.position.count},sourceParts:parts.map(m=>({name:m.name,vertices:m.geometry.attributes.position.count,geometry:m.geometry.uuid})),directHits,missing,totalSamples:rows*113,joinRow:meta.joinRow,pinnedFallRows:[],headFadeBridgeRings:[2,7],headSurfaceAnatomyGate:true,headQuery,headGateNearM:.018,headGateFarM:.036,geometryUnchangedVsR3:true,headInfluenceSlotReserved:true,clearanceM:.018,fairing,movedVertices:moved.reduce((a,b)=>a+b,0),maxShiftM:maxShift,maxWeightError,fullFitCenterClearanceMin:Math.min(...residuals),fullFitCenterClearanceMax:Math.max(...residuals)};
  g.userData.rearFallFit=stats.last;g.userData.flexibleHair=true;
  if(!mesh.isSkinnedMesh){const replacement=new T.SkinnedMesh(g,mesh.material);replacement.name=mesh.name;replacement.userData={...mesh.userData,ownGeo:true,flexibleHair:true};replacement.customDepthMaterial=mesh.customDepthMaterial;replacement.castShadow=mesh.castShadow;replacement.receiveShadow=mesh.receiveShadow;replacement.frustumCulled=false;replacement.bindMode=T.AttachedBindMode;replacement.bind(rig.body.skeleton,restHead);const parent=mesh.parent;parent.remove(mesh);parent.add(replacement);if(mesh.userData.ownGeo)mesh.geometry.dispose();state.mesh=replacement;}else{mesh.geometry.dispose();mesh.geometry=g;}
  rig.root.updateMatrixWorld(true);rig.body.skeleton.update();for(const part of surfaces){part.surface.dispose();part.g.dispose();}stats.fits++;stats.fitMs=performance.now()-t0;
 }
 function update(){if(dead)return;stats.updates++;const result=oldUpdate?.call(rig);if(depth)return result;rig.root.updateWorldMatrix(true,false);rig.root.updateMatrixWorld(true);rig.body.skeleton.update();
  const mesh=rig.hair?.name==='hair-long'?rig.hair.children.find(m=>m.geometry?.userData.crownFallJoin):null;
  if(!mesh){if(state){state.source.dispose();state=null;}return result;}
  if(!state||state.mesh!==mesh){state?.source.dispose();state={mesh,source:mesh.geometry.clone(),key:null};}
  const parts=outer(),key=parts.map(m=>m.uuid+':'+m.geometry.uuid).join('|');if(parts.length&&key!==state.key){fit(mesh,parts);state.key=key;}return result;
 }
 rig.setLook=(...args)=>{depth++;try{return oldLook.apply(rig,args);}finally{depth--;if(!depth)update();}};
 rig.setOutfit=(...args)=>{depth++;try{return oldOutfit.apply(rig,args);}finally{depth--;if(!depth)update();}};
 rig.updateHairMass=update;rig.updatePoseDetails=update;rig.rearFallEvidence=()=>({...stats,active:!!state,disposed:dead});
 rig.dispose=()=>{if(dead)return;state?.source.dispose();state=null;dead=true;oldDispose.call(rig);};update();return rig;
}
