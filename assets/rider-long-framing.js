import {createTriangleSurface} from './rider-head-surface.js?v=character-polish-20261009';
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*t*(10+t*(-15+6*t));};
const component=(a,i,k)=>a[['getX','getY','getZ','getW'][k]](i);
export function installSideflow7(T,rig){
 const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),oldUpdate=rig.updateHairMass,oldLook=rig.setLook,oldOutfit=rig.setOutfit,oldDispose=rig.dispose;
 const canonical=new Map(rig.body.skeleton.bones.map((b,i)=>[b.name,i])),head=canonical.get('Head'),restHead=rig.body.skeleton.boneInverses[head].clone().invert(),headInverse=restHead.clone().invert(),H=rig.kit.head;
 const allowed=new Set([...canonical].filter(([n])=>/^(Head|neck_\d+|spine_\d+|clavicle_[lr])$/.test(n)).map(([,i])=>i));
 let state=null,depth=0,dead=false;const stats={fits:0,updates:0,queries:0,last:null};
 const outer=()=>[...new Set(rig.outfit?.meshes||[])].filter(m=>m.visible&&m.isSkinnedMesh);
 const attrWeights=(g,id)=>{const m=new Map();for(let k=0;k<4;k++){const j=component(g.attributes.skinIndex,id,k),w=component(g.attributes.skinWeight,id,k);if(w)m.set(j,(m.get(j)||0)+w);}return m;};
 const blendWeights=(a,b,t)=>{const m=new Map();for(const[j,w]of a)m.set(j,(m.get(j)||0)+w*(1-t));for(const[j,w]of b)m.set(j,(m.get(j)||0)+w*t);return m;};
 function fit(mesh,parts){
  const begun=performance.now(),source=mesh.geometry,g=source.clone(),P=g.attributes.position,meta=source.userData.forelockCorrection,join=source.userData.crownFallJoin,clumps=meta.clumps,counts=clumps.map(c=>c.centers.length*13+2),prefix=P.count-counts.reduce((a,b)=>a+b,0),changed=new Set(),details=[];
  const surfaces=[...parts,rig.face].map(m=>{const geo=m.geometry.clone(),p=geo.attributes.position;for(let i=0;i<p.count;i++)p.setXYZ(i,...V().fromBufferAttribute(m.geometry.attributes.position,i).applyMatrix4(m.bindMatrix).applyMatrix4(headInverse).toArray());return{m,geo,surface:createTriangleSurface(T,geo)};});
  let queries=0;
  const cast=(sd,point,normal)=>{let best=null;for(const s of surfaces){queries++;const hit=s.surface.cast(point.clone().addScaledVector(normal,.8),normal.clone().negate(),h=>h.point.x*sd>=0&&h.distance<1.6,1.6);if(hit&&(!best||hit.distance<best.hit.distance))best={s,hit};}return best;};
  function surfaceWeights(hit,allowShoulder=false){
   if(!hit)return null;const{s,hit:h}=hit,ids=[h.face.a,h.face.b,h.face.c],p=s.geo.attributes.position,bary=T.Triangle.getBarycoord(h.point,...ids.map(i=>V().fromBufferAttribute(p,i)),V()),m=new Map();
   for(let n=0;n<3;n++)for(let k=0;k<4;k++){const sourceJoint=component(s.m.geometry.attributes.skinIndex,ids[n],k),j=canonical.get(s.m.skeleton.bones[sourceJoint]?.name),w=Math.max(0,bary.getComponent(n))*component(s.m.geometry.attributes.skinWeight,ids[n],k);if((allowed.has(j)||(allowShoulder&&/^upperarm_[lr]$/.test(s.m.skeleton.bones[sourceJoint]?.name)))&&w)m.set(j,(m.get(j)||0)+w);}
   const sum=[...m.values()].reduce((a,b)=>a+b,0);if(!sum)return null;for(const[j,w]of m)m.set(j,w/sum);return m;
  }
  function rail(sd,y){
   const col=sd>0?2:110,rows=[];for(let r=0;r<=48;r++){const id=join.capCount+r*113+col,back=id+49*113;rows.push({id,p:V().fromBufferAttribute(P,id).add(V().fromBufferAttribute(P,back)).multiplyScalar(.5),weights:attrWeights(source,id)});}
   for(let i=1;i<rows.length;i++)if(rows[i-1].p.y>=y&&rows[i].p.y<=y){const a=rows[i-1],b=rows[i],t=(a.p.y-y)/(a.p.y-b.p.y);return{p:a.p.clone().lerp(b.p,t),weights:blendWeights(a.weights,b.weights,t),ids:[a.id,b.id],t};}
   const r=y>rows[0].p.y?rows[0]:rows.at(-1);return{p:r.p.clone(),weights:r.weights,ids:[r.id,r.id],t:0};
  }
  try{
   let start=prefix;const newClumps=[],mainFlows=new Map(),keptRanges=[[0,prefix]];
   function mainAt(sd,y){const f=mainFlows.get(sd),P=f.centers;let i=1,t=0;for(;i<P.length;i++)if(P[i-1].y>=y&&P[i].y<=y){t=(P[i-1].y-y)/(P[i-1].y-P[i].y);break;}if(i===P.length){i=y>P[0].y?1:P.length-1;t=y>P[0].y?0:1;}return{point:P[i-1].clone().lerp(P[i],t),width:f.widths[i-1]*(1-t)+f.widths[i]*t,depth:f.depths[i-1]*(1-t)+f.depths[i]*t,weights:blendWeights(f.weights[i-1],f.weights[i],t),palette:f.palette};}
   const sampleMain=(sd,y)=>mainAt(sd,y).point;
   for(let ci=0;ci<clumps.length;ci++){
    // The long style uses the complete main locks and intact scalp cap.
    // A second closed short tube made a raised crosswise root lip, so it is
    // absent from the emitted surface rather than hidden inside the main mass.
    if(clumps[ci].layer===1){start+=counts[ci];continue;}
    keptRanges.push([start,start+counts[ci]]);
    const c=clumps[ci],sd=c.side,j=c.layer,ts=c.arcParameters||c.centers.map((_,i)=>i/(c.centers.length-1)),protect=c.protectedArc,oldCenters=c.centers.map(a=>V(...a)),protectIndex=ts.findLastIndex(t=>t<=protect),temple=oldCenters[protectIndex].clone(),tipY=j?H.chin.y+.008:oldCenters.at(-1).y,end=rail(sd,tipY),jawY=H.chin.y+.010,shoulderY=jawY+(tipY-jawY)*.54,shoulderRail=rail(sd,shoulderY);
    // Follow the cheek silhouette before the lock falls onto the shoulder.
    const cheek=V(sd*H.rx*.86,H.cy-.024,H.cz+.047),jaw=V(sd*H.rx*.91,jawY,H.cz+.017),shoulder=V(sd*(Math.abs(shoulderRail.p.x)+H.rx*.10),shoulderY,shoulderRail.p.z);
    const hangingEnd=end.p.clone();
    if(!j){
     // The main lock hangs beside the neck. Rear rails set lateral scale/ownership,
     // not a terminal weld: actual front shoulder supports set only the clearance.
     hangingEnd.x=sd*(Math.abs(end.p.x)+H.rx*.05);hangingEnd.z=jaw.z;
     const tipSupport=cast(sd,hangingEnd,V(0,0,1));if(tipSupport)hangingEnd.z=Math.max(hangingEnd.z,tipSupport.hit.point.z+.015);
     shoulder.z=jaw.z;const shoulderSupport=cast(sd,shoulder,V(0,0,1));if(shoulderSupport)shoulder.z=Math.max(shoulder.z,shoulderSupport.hit.point.z+.012);
    }
    const guide=new T.CatmullRomCurve3([temple,cheek,jaw,shoulder,hangingEnd]);
    function atY(y){let lo=0,hi=1;for(let n=0;n<28;n++){const t=(lo+hi)*.5;if(guide.getPoint(t).y>y)lo=t;else hi=t;}return guide.getPoint((lo+hi)*.5);}
    const centers=oldCenters.map((p,i)=>{const t=ts[i];if(t<=protect)return p.clone();const lift=j?(tipY-oldCenters.at(-1).y)*smooth(protect,1,t):0,y=p.y+lift,q=j?sampleMain(sd,y).addScaledVector(V(sd*.58,0,1).normalize(),-mainAt(sd,y).depth*.15):atY(y),release=smooth(protect,protect+.11,t);return p.clone().lerp(q,release);});
    const frameCenters=centers.map(p=>p.clone()),shifts=[],radials=[];
    const widths=[],depths=[],weights=[],vertexWeights=[],offsets=[];let maxShift=0;
    for(let i=0;i<ts.length;i++){
     const t=ts[i],free=smooth(protect,protect+.11,t),u=Math.max(0,(t-protect)/(1-protect)),bulge=Math.sin(Math.PI*u),rawWidth=c.widths[i]+free*H.rx*(j?.080:.12)*bulge,rawDepth=c.depths[i]+free*H.rx*(j?.020:.030)*bulge,merge=j?smooth(H.cy+.026,H.cy-.045,centers[i].y)*free:0,mf=j?mainAt(sd,centers[i].y):null,mergedWidth=j?rawWidth*(1-merge)+Math.min(rawWidth,mf.width*.42)*merge:rawWidth,w=(i&&centers[i].y<H.chin.y+.050)?Math.min(mergedWidth,widths[i-1]):mergedWidth,d=j?rawDepth*(1-merge)+Math.min(rawDepth,mf.depth*.22)*merge:rawDepth;
     widths.push(w);depths.push(d);
     if(t<=protect){offsets.push(null);weights.push(new Map([[head,1]]));vertexWeights.push(null);shifts.push(0);radials.push(V(sd*.58,0,1).normalize());continue;}
     const tangent=frameCenters[Math.min(i+1,centers.length-1)].clone().sub(frameCenters[Math.max(0,i-1)]).normalize(),radial=V(sd*.58,0,1).normalize(),out=radial.clone();out.addScaledVector(tangent,-out.dot(tangent)).normalize();const across=out.clone().cross(tangent).normalize();
     const oldT=oldCenters[Math.min(i+1,oldCenters.length-1)].clone().sub(oldCenters[Math.max(0,i-1)]).normalize(),oldOut=V(sd*.58,0,1);oldOut.addScaledVector(oldT,-oldOut.dot(oldT)).normalize();const oldAcross=oldOut.clone().cross(oldT).normalize(),section=[];
     for(let k=0;k<=12;k++){const p=V().fromBufferAttribute(P,start+i*13+k).sub(oldCenters[i]);section.push(across.clone().multiplyScalar(p.dot(oldAcross)*w/Math.max(1e-9,c.widths[i])).addScaledVector(out,p.dot(oldOut)*d/Math.max(1e-9,c.depths[i])).addScaledVector(tangent,p.dot(oldT)));}
     let shift=0;const railOwners=[];for(const off of section){const p=centers[i].clone().add(off),hit=cast(sd,p,radial);railOwners.push(surfaceWeights(hit,!j));if(hit)shift=Math.max(shift,.8-hit.hit.distance+(!j&&hit.s.m!==rig.face?.014:.0025));}
     shifts.push(Math.max(0,shift)*free);radials.push(radial);maxShift=Math.max(maxShift,Math.abs(shift));offsets.push(section);
     const hit=cast(sd,centers[i],radial),rear=rail(sd,centers[i].y),owner=surfaceWeights(hit,!j)||rear.weights,follow=smooth(H.chin.y+.040,H.chin.y-.080,centers[i].y),w0=blendWeights(new Map([[head,1]]),owner,follow);weights.push(w0);vertexWeights.push(null);
    }
    // Fit one smooth native guide. A conservative smooth offset envelope replaces
    // individual ring pushes; uniform, smoothed ring ownership preserves sections.
    const arclength=[0];for(let i=1;i<centers.length;i++)arclength.push(arclength[i-1]+centers[i].distanceTo(centers[i-1]));
    const mass=arclength.map((a,i)=>Math.max(1e-6,(arclength[Math.min(i+1,arclength.length-1)]-arclength[Math.max(0,i-1)])/2));
    const smoothed=shifts.map((v,i)=>{let sum=0,den=0;for(let k=0;k<shifts.length;k++){const q=mass[k]*Math.exp(-Math.pow((arclength[i]-arclength[k])/.024,2));sum+=q*shifts[k];den+=q;}return sum/den*smooth(protect,protect+.11,ts[i]);});
    let reserve=0;for(let i=0;i<shifts.length;i++){const f=smooth(protect,protect+.11,ts[i]);if(f>1e-7)reserve=Math.max(reserve,(shifts[i]-smoothed[i])/f);}
    const smoothOwners=weights.map((w,i)=>{if(ts[i]<=protect)return w;const m=new Map();let den=0;for(let k=0;k<weights.length;k++){const q=mass[k]*Math.exp(-Math.pow((arclength[i]-arclength[k])/.022,2));den+=q;for(const[b,v]of weights[k])m.set(b,(m.get(b)||0)+q*v);}for(const[b,v]of m)m.set(b,v/den);return blendWeights(w,m,smooth(protect,protect+.12,ts[i]));});
    for(let i=0;i<centers.length;i++){centers[i].addScaledVector(radials[i],smoothed[i]+reserve*smooth(protect,protect+.11,ts[i]));weights[i]=smoothOwners[i];}
    // One fixed shoulder palette prevents top-four rank changes from kinking
    // the smooth guide. Neck motion blends continuously into the attached Head.
    const jointNames=rig.body.skeleton.bones.map(b=>b.name),totals=new Map();for(let i=0;i<weights.length;i++)for(const[b,w]of weights[i])totals.set(b,(totals.get(b)||0)+w*mass[i]);
    const strongest=prefix=>[...totals].filter(([b,w])=>jointNames[b].startsWith(prefix)).sort((a,b)=>b[1]-a[1])[0]?.[0]??head;
    const palette=j?mainFlows.get(sd).palette:[head,strongest('clavicle_'),strongest('upperarm_'),strongest('spine_')];
    const project=w=>{const m=new Map(palette.map(b=>[b,0]));for(const[b,v]of w){const name=jointNames[b],to=palette.includes(b)?b:name.startsWith('neck_')?head:name.startsWith('spine_')?palette[3]:name.startsWith('upperarm_')?palette[2]:name.startsWith('clavicle_')?palette[1]:head;m.set(to,(m.get(to)||0)+v);}return m;};
    for(let i=0;i<weights.length;i++)if(ts[i]>protect){weights[i]=project(weights[i]);if(j){const merge=smooth(H.cy+.026,H.cy-.045,centers[i].y)*smooth(protect,protect+.11,ts[i]),m=mainAt(sd,centers[i].y);centers[i].lerp(m.point.clone().addScaledVector(radials[i],-m.depth*.15),merge);weights[i]=blendWeights(weights[i],m.weights,merge);}}
    if(!j)mainFlows.set(sd,{centers:centers.map(p=>p.clone()),widths:widths.slice(),depths:depths.slice(),weights:weights.map(w=>new Map(w)),palette});
    for(let i=0;i<ts.length;i++)if(ts[i]>protect){
     for(let k=0;k<=12;k++){const w=vertexWeights[i]?.[k]||weights[i],ranked=palette.map(b=>[b,w.get(b)||0]),sum=ranked.reduce((a,v)=>a+v[1],0);while(ranked.length<4)ranked.push([head,0]);const id=start+i*13+k,p=centers[i].clone().add(offsets[i][k]);P.setXYZ(id,...p.toArray());for(let q=0;q<4;q++){g.attributes.skinIndex.array[id*4+q]=ranked[q][0];g.attributes.skinWeight.array[id*4+q]=ranked[q][1]/sum;}changed.add(id);}
    }
    const tipId=start+counts[ci]-1;P.setXYZ(tipId,...centers.at(-1).toArray());for(let k=0;k<4;k++){g.attributes.skinIndex.array[tipId*4+k]=g.attributes.skinIndex.array[(tipId-2)*4+k];g.attributes.skinWeight.array[tipId*4+k]=g.attributes.skinWeight.array[(tipId-2)*4+k];}changed.add(tipId);
    details.push({side:sd,layer:j,protectedArc:protect,protectedVertices:(protectIndex+1)*13+1,nativePalette:palette.map(b=>jointNames[b]),guide:[temple,cheek,jaw,shoulder,hangingEnd].map(p=>p.toArray()),tip:centers.at(-1).toArray(),targetMethod:j?'short layer hidden inside main at jaw':'main gravity-hanging actual front support',freeTarget:hangingEnd.toArray(),railTarget:end.p.toArray(),railSourceIds:end.ids,railSourceLerp:end.t,tipRailGapM:centers.at(-1).distanceTo(end.p),maxLateralShiftM:maxShift});
    newClumps.push({...c,centers:centers.map(p=>p.toArray()),widths,depths,sideflow7:true,sourceCenters:c.centers,sourceTip:c.tip,tip:centers.at(-1).toArray(),sourceArcLength:c.centerArcLength,centerArcLength:centers.reduce((s,p,i)=>s+(i?p.distanceTo(centers[i-1]):0),0)});start+=counts[ci];
   }
   P.needsUpdate=true;g.attributes.skinIndex.needsUpdate=true;g.attributes.skinWeight.needsUpdate=true;g.computeVertexNormals();if(g.attributes.tangent)g.computeTangents();
   for(const n of ['normal','tangent'])if(g.attributes[n])for(let i=0;i<P.count;i++)if(!changed.has(i))for(let k=0;k<g.attributes[n].itemSize;k++)g.attributes[n].array[i*g.attributes[n].itemSize+k]=source.attributes[n].array[i*g.attributes[n].itemSize+k];
   // Compact every attribute and triangle so removed short layers cannot remain
   // as ghost vertices in either rendered geometry or the emitted-surface oracle.
   const oldCount=P.count,remap=new Int32Array(oldCount).fill(-1);let keptCount=0;
   for(const[a,b]of keptRanges)for(let i=a;i<b;i++)remap[i]=keptCount++;
   for(const[name,attr]of Object.entries(g.attributes)){
    if(attr.isInterleavedBufferAttribute||attr.count!==oldCount)throw Error('Unsupported sideflow attribute storage');
    const data=new attr.array.constructor(keptCount*attr.itemSize);
    for(const[a,b]of keptRanges)for(let i=a;i<b;i++)data.set(attr.array.subarray(i*attr.itemSize,(i+1)*attr.itemSize),remap[i]*attr.itemSize);
    const next=new T.BufferAttribute(data,attr.itemSize,attr.normalized);next.name=attr.name;next.usage=attr.usage;next.gpuType=attr.gpuType;g.setAttribute(name,next);
   }
   if(Object.keys(g.morphAttributes).length)throw Error('Unexpected sideflow morph attributes');
   const keptIndex=[],groupCounts=g.groups.map(()=>0);
   for(let k=0;k<g.index.count;k+=3){const old=[0,1,2].map(j=>g.index.getX(k+j)),mapped=old.map(i=>remap[i]);
    if(mapped.some(i=>i<0)){if(mapped.some(i=>i>=0))throw Error('Removed short layer shares a triangle with retained hair');continue;}
    keptIndex.push(...mapped);for(let j=0;j<g.groups.length;j++)if(k>=g.groups[j].start&&k<g.groups[j].start+g.groups[j].count)groupCounts[j]+=3;
   }
   const groups=g.groups.map((q,i)=>({...q,count:groupCounts[i]}));g.setIndex(keptIndex);g.clearGroups();let groupStart=0;for(const q of groups){g.addGroup(groupStart,q.count,q.materialIndex);groupStart+=q.count;}
   g.setDrawRange(0,Infinity);g.computeBoundingSphere();if(g.boundingBox)g.computeBoundingBox();
   g.userData={...source.userData,forelockCorrection:{...meta,clumps:newClumps},sideflow7:{revision:"11 main9 retained, redundant short closed layers removed",method:'Two continuous main locks with original scalp roots, main9 smooth native fall and intact scalp/rear surface. No redundant short closed layers.',removedShortVertices:oldCount-keptCount,retainedVertices:keptCount,details}};
   mesh.geometry=g;source.dispose();state.output=g;stats.fits++;stats.queries+=queries;stats.last={fitMs:performance.now()-begun,queries,parts:parts.map(m=>m.name),prefix,changedVertices:changed.size,details};
  }finally{for(const s of surfaces){s.surface.dispose();s.geo.dispose();}}
 }
 function update(){if(dead)return;stats.updates++;const result=oldUpdate?.call(rig);if(depth)return result;const mesh=rig.hair?.name==='hair-long'?rig.hair.children.find(m=>m.geometry?.userData.forelockCorrection&&m.geometry?.userData.crownFallJoin):null;if(!mesh){state=null;return result;}const parts=outer(),key=parts.map(m=>m.uuid+':'+m.geometry.uuid).join('|');if(!state||state.mesh!==mesh||mesh.geometry!==state.output||state.key!==key){state={mesh,key,output:null};fit(mesh,parts);}return result;}
 rig.setLook=(...args)=>{depth++;try{return oldLook.apply(rig,args);}finally{depth--;if(!depth)update();}};
 rig.setOutfit=(...args)=>{depth++;try{return oldOutfit.apply(rig,args);}finally{depth--;if(!depth)update();}};
 rig.updateHairMass=update;rig.updatePoseDetails=update;rig.sideflowEvidence=()=>({...stats,active:!!state,disposed:dead});rig.dispose=()=>{if(dead)return;dead=true;state=null;oldDispose.call(rig);};update();return rig;
}
