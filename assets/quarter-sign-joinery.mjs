import {recordSolidPart} from './solid-collisions.js?v=solid-world-1';
// Artifact successor: final static signs query existing support; they never create a floor.
const finite=Number.isFinite;
const fnv=a=>{let h=2166136261;for(const b of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^b,16777619)>>>0;return h;};
const axis=(radius,step)=>{const n=Math.ceil(2*radius/step),a=Array.from({length:n+1},(_,i)=>-radius+2*radius*i/n);if(!a.includes(0))a.push(0);return a.sort((a,b)=>a-b);};
export function planQuarterSignSeat({matrixWorld:m,width,groundH,step=.2,clearance=.31,maximumRise=2}){
 if(!m||m.length!==16||!Array.from(m).every(finite)||typeof groundH!=='function'||!(width>=2.5&&width<=4.5)||!(step>=.1&&step<=.25)||!(clearance>=.2&&clearance<=.6)||!(maximumRise>=0&&maximumRise<=2))throw Error('Actual finite static sign pose/support required');
 if(Math.abs(m[1])+Math.abs(m[3])+Math.abs(m[4])+Math.abs(m[6])+Math.abs(m[7])+Math.abs(m[9])+Math.abs(m[11])+Math.abs(m[5]-1)+Math.abs(m[15]-1)>1e-9||Math.abs(Math.hypot(m[0],m[2])-1)>1e-9||Math.abs(Math.hypot(m[8],m[10])-1)>1e-9||Math.abs(m[0]*m[8]+m[2]*m[10])>1e-9||Math.abs(m[0]*m[10]-m[2]*m[8]-1)>1e-9)throw Error('Upright unscaled authored sign required');
 const samples=[],sample=(x,z)=>{if(samples.length>=2048)throw Error('Sign support query budget');const wx=m[0]*x+m[8]*z+m[12],wz=m[2]*x+m[10]*z+m[14],y=groundH(wx,wz);if(!finite(y))throw Error('Final support is not finite');samples.push({localX:x,localZ:z,x:wx,z:wz,y});return y;};
 let highest=-Infinity;for(const x of axis(width/2+.11,step))for(const z of axis(.65,step))highest=Math.max(highest,sample(x,z));for(const z of[-2,-1,1,2])highest=Math.max(highest,sample(0,z));
 const postX=[-width/2-.2,width/2+.2],baseY=postX.map(x=>sample(x,0)-m[13]-.015),rise=Math.max(0,highest-m[13])+.01,boardBottom=2.65+clearance,boardCenter=boardBottom+.29,railCenter=boardCenter+.30,postTop=boardCenter+.37;
 if(rise>maximumRise||baseY.some(y=>postTop+rise-y<.8||postTop+rise-y>6))throw Error('Final support requires an unadmitted sign proportion');
 return{profile:'quarter-sign-final-support-4',boardCenterY:boardCenter+rise,boardBottomY:boardBottom+rise,railCenterY:railCenter+rise,postTopY:postTop+rise,postBaseY:baseY,postX,rise,highestSampledGround:highest,clearanceTarget:clearance,samples,minimumSampledBoardClearance:m[13]+boardBottom+rise-highest-2.65,supportQueries:samples.length,samplingStep:step,scope:'Existing composed ground queried after Willow/Frost support installation. Dense bounded samples and native site checks; not an exact maximum certificate for arbitrary opaque callbacks between samples.'};
}
export function createQuarterSignJoinery({THREE:T,W,scene,own,mergeGeometries,setQuarterPrimitiveUV}){
 const pending=[],marked=new WeakMap(),roots=new WeakSet(),stats={profile:'quarter-sign-final-support-4',captured:0,finalized:0,retained:0,errors:[],records:[]};
 function privateResources(key,make){let n=2166136261;for(const c of key)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;const prior=Math.random;Math.random=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);try{return make();}finally{Math.random=prior;}}
 function capture(root,text,width){
  if(roots.has(root)||pending.length>=5)return false;
  const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
  const posts=meshes.filter(o=>o.geometry?.type==='CylinderGeometry'),rails=meshes.filter(o=>o.geometry?.type==='BoxGeometry'),faces=meshes.filter(o=>o.geometry?.type==='PlaneGeometry'),back=meshes.filter(o=>!o.geometry?.index);
  if(meshes.length!==6||posts.length!==2||rails.length!==1||faces.length!==2||back.length!==1||faces[0].material!==faces[1].material||posts[0].material!==posts[1].material||posts[0].material!==rails[0].material)return false;
  const r={root,text,width,meshes,posts:posts.sort((a,b)=>a.position.x-b.position.x),rail:rails[0],faces,back:back[0],state:'captured',registerAttempted:false};
  root.name='Quarter sign | '+text;root.userData.quarterSign={text,width,status:'captured-final-support-pending'};pending.push(r);roots.add(root);for(const m of meshes)marked.set(m,r);stats.captured++;return true;
 }
 function prepareBake(g){
  for(const r of pending){if(r.state!=='captured')continue;let p=r.root;while(p&&p!==g)p=p.parent;if(p!==g)continue;
   const inv=new T.Matrix4().copy(r.root.matrixWorld).invert();r.world=r.root.matrixWorld.clone();r.parent=r.root.parent;r.sources=r.meshes.map(m=>({mesh:m,parent:m.parent,local:m.matrix.clone(),geometry:m.geometry,material:m.material,uuid:m.uuid,geometryUUID:m.geometry.uuid,materialUUID:m.material.uuid,position:m.geometry.attributes.position.array,index:m.geometry.index?.array||null,positionHash:fnv(m.geometry.attributes.position.array),indexHash:m.geometry.index?fnv(m.geometry.index.array):null,relative:new T.Matrix4().multiplyMatrices(inv,m.matrixWorld)}));r.state='prepared';
  }
 }
 const omit=o=>marked.get(o)?.state==='prepared';
 function identity(r){const actual=[];r.root.traverse(o=>{if(o.isMesh)actual.push(o);});return actual.length===r.sources.length&&actual.every((m,i)=>m===r.sources[i].mesh)&&r.root.parent===r.parent&&r.root.matrixWorld.elements.every((n,i)=>Object.is(n,r.world.elements[i]))&&r.sources.every(s=>s.mesh.parent===s.parent&&s.mesh.matrix.elements.every((n,i)=>Object.is(n,s.local.elements[i]))&&s.mesh.geometry===s.geometry&&s.mesh.material===s.material&&s.mesh.uuid===s.uuid&&s.geometry.uuid===s.geometryUUID&&s.material.uuid===s.materialUUID&&s.geometry.attributes.position.array===s.position&&(s.geometry.index?.array||null)===s.index&&fnv(s.position)===s.positionHash&&(s.index===null||fnv(s.index)===s.indexHash));}
 function release(r){r.parent=null;r.sources=null;r.meshes=null;r.posts=null;r.faces=null;r.back=null;r.rail=null;}
 function fallback(r,error){
  r.root.removeFromParent();r.root.matrixAutoUpdate=false;r.root.matrix.copy(r.world);r.root.matrixWorld.copy(r.world);r.back.visible=false;r.root.userData.collisionIgnore=true;scene.add(own(r.root));r.root.userData.quarterSign.status='retained-original-render-only';r.root.userData.quarterSign.reason=error.message;r.state='retained';stats.retained++;release(r);
 }
 function finalize(){
  for(const r of pending){if(r.state!=='prepared')continue;let built=null;
   try{
    r.root.updateWorldMatrix(true,true);if(!identity(r)||W.solidWorld.hasParts(r.root)){r.stale=true;throw Error('Source sign identity/pose changed before final support');}
    const plan=planQuarterSignSeat({matrixWorld:r.world.elements,width:r.width,groundH:W.groundH});
    built=privateResources(r.text,()=>{const bins=new Map(),parts={userData:{}},temps=[],meshes=[];try{
     for(const s of r.sources){const matrix=s.relative.clone(),e=matrix.elements,m=s.mesh;let material=s.material;
      if(m===r.posts[0]||m===r.posts[1]){const k=m===r.posts[0]?0:1;e[5]=plan.postTopY-plan.postBaseY[k];e[13]=(plan.postTopY+plan.postBaseY[k])/2;}
      else if(m===r.rail)e[13]=plan.railCenterY;
      else e[13]=plan.boardCenterY;
      if(m===r.back)material=r.posts[0].material;
      recordSolidPart(T,parts,s.geometry,material,matrix);
      const c=s.geometry.clone();temps.push(c);if(!c.index){const count=c.attributes.position.count,ix=new Uint16Array(count);for(let i=0;i<count;i++)ix[i]=i;c.setIndex(new T.BufferAttribute(ix,1));}
      const scale=new T.Vector3(),position=new T.Vector3(),quaternion=new T.Quaternion();matrix.decompose(position,quaternion,scale);if(!c.userData.workshopUV)setQuarterPrimitiveUV(c,scale,position,material.userData.quarterSurface);c.applyMatrix4(matrix);for(const k of Object.keys(c.attributes))if(!['position','normal','uv'].includes(k))c.deleteAttribute(k);const list=bins.get(material)||[];list.push(c);bins.set(material,list);
     }
     if(parts.userData.solidParts?.length!==4||bins.size!==2)throw Error('Final four-part/two-material sign required');
     for(const[material,list]of bins){const geo=mergeGeometries(list,false);if(!geo)throw Error('Private sign merge failed');geo.computeBoundingBox();geo.computeBoundingSphere();const m=new T.Mesh(geo,material);m.name='Quarter sign | '+r.text+' | '+(material===r.posts[0].material?'joined timber':'painted faces');m.castShadow=m.receiveShadow=true;meshes.push(m);}
     return{meshes,parts:parts.userData.solidParts,plan};
    }catch(error){for(const m of meshes)m.geometry.dispose();throw error;}finally{for(const g of temps)g.dispose();}});
    if(!identity(r)){r.stale=true;throw Error('Source identity changed during private sign preparation');}
    if(!plan.samples.every(s=>Object.is(W.groundH(s.x,s.z),s.y)))throw Error('Source/final support changed during private sign preparation');
    r.root.updateWorldMatrix(true,true);if(!identity(r)||W.solidWorld.hasParts(r.root)){r.stale=true;throw Error('Source identity changed during final support recheck');}
    r.ownerPublicationAttempted=true;
    r.root.removeFromParent();r.root.clear();r.root.matrixAutoUpdate=false;r.root.matrix.copy(r.world);r.root.matrixWorld.copy(r.world);r.root.userData.solidParts=built.parts;for(const m of built.meshes)r.root.add(m);scene.add(own(r.root));r.state='committed-static';r.root.userData.quarterSign={text:r.text,width:r.width,status:'committed-static-pending-camera',plan};
    const beforeCamera=W.followCamera.obstacleCount,beforeBody=W.solidWorld.stats();r.registerAttempted=true;
    W.followCamera.register(r.root);
    if(W.followCamera.obstacleCount-beforeCamera!==4||!W.solidWorld.hasParts(r.root)||W.solidWorld.stats().parts-beforeBody.parts!==4||W.solidWorld.stats().owners-beforeBody.owners!==1)throw Error('Final sign camera/body registration did not add exactly four parts');
    r.root.userData.quarterSign.status='final-static-body-and-camera';r.state='final';stats.finalized++;stats.records.push({text:r.text,status:r.state,parts:4,renderMeshes:2,plan});release(r);
   }catch(error){
    if(r.registerAttempted||r.ownerPublicationAttempted){r.state=r.registerAttempted?'registration-failed-no-retry':'owner-publication-failed-no-retry';r.root.userData.quarterSign.status=r.state;r.root.userData.quarterSign.error=error.message;stats.errors.push({text:r.text,phase:r.registerAttempted?'irreversible-static-camera-registration':'irreversible-static-owner-publication',message:error.message,rollbackClaimed:false});release(r);}
    else{
     // A support/merge callback can fail after mutating source state. Never reset that source via fallback.
     try{r.root.updateWorldMatrix(true,true);if(!identity(r)||W.solidWorld.hasParts(r.root))r.stale=true;}catch{r.stale=true;}
     if(built)for(const m of built.meshes)m.geometry.dispose();if(r.stale){r.state='rejected-source-changed-no-mutation';stats.errors.push({text:r.text,phase:'source-identity',message:error.message,sourceMutationClaimed:false});release(r);r.root=null;}else fallback(r,error);stats.records.push({text:r.text,status:r.state,reason:error.message});}
   }
  }
  return stats;
 }
 return{capture,prepareBake,omit,finalize,finalRoots:()=>pending.filter(r=>r.state==='final').map(r=>r.root),stats};
}
