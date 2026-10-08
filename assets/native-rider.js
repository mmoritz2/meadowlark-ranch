/* Display-only equipment modes and Western reins for the native 677-joint horse.
 * Original GLB vertex positions, skin weights, bones and bind matrices remain
 * untouched. A private geometry clone selects visible equipment triangles;
 * two 19 mm leather ribbons connect the rider's hands to the original bit.
 */
export const DISPLAY_REIN_COMPONENTS = [57,58,59,60,61,62,72,73,74,75,103,104,141,142,143,153,163,164,244,245,254,255,278,283];
const PROTECTED_COMPONENTS = [89,91,205,209];
const EXPECTED_TRIANGLES = 17194;
const EXPECTED_REMOVED = 1640;
// Measured connected components of the source's headstall, bit, buckles and
// stitching. The remaining non-rein parts belong to the saddle/breastplate.
const BRIDLE_COMPONENTS=[11,12,13,15,16,17,55,56,69,70,71,76,77,93,94,95,98,101,102,105,106,144,159,161,162,165,166,168,169,170,175,182,188,189,191,197,198,199,200,201,202,203,204,205,209,237,242,243,246,247,252,253,256,257,265,268,269,270,271,272,273,277,279,282,284,286,287,288,289,290,291];

function separateComponents(geometry) {
  const index=geometry.index?.array, count=geometry.attributes.position.count;
  if (!index || count!==13895 || index.length/3!==EXPECTED_TRIANGLES)
    throw Error('Original Western tack topology changed; rein-only removal is unsafe');
  const parent=Array.from({length:count},(_,i)=>i);
  const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  for(let i=0;i<index.length;i+=3){const a=root(index[i]);parent[root(index[i+1])]=a;parent[root(index[i+2])]=a;}
  const groupByRoot=new Map(),byVertex=new Int16Array(count),vertices=[];
  for(let i=0;i<count;i++){const r=root(i);if(!groupByRoot.has(r)){groupByRoot.set(r,vertices.length);vertices.push([]);}const c=groupByRoot.get(r);byVertex[i]=c;vertices[c].push(i);}
  if(vertices.length!==300)throw Error('Original Western tack component count changed');
  return {index,byVertex,vertices};
}

/** A private geometry clone preserves the source attributes; mode switches only
 * select its index buffer. Bareback keeps the headstall; wild hides all tack. */
export function createNativeTackModes({THREE,rig,mount=rig.scene.parent,collectionOwned=false}={}){
 if(rig?.profile?.nativeKind!=='horse')return null;
 const meshes=[];rig.scene.traverse(o=>{if(o.isSkinnedMesh&&[13895,5092].includes(o.geometry?.attributes.position.count))meshes.push(o);});
 const tack=meshes.find(o=>o.geometry.attributes.position.count===13895),saddle=meshes.find(o=>o.geometry.attributes.position.count===5092);
 if(!tack||!saddle||meshes.length!==2)throw Error('Native Western tack meshes changed');
 const sourceGeometry=tack.geometry,visibleBefore=meshes.map(m=>m.visible);
 // Fitted collections own source partitions even when no pieces are equipped.
 // Modes still provide the animated bareback seat, but never alter their draw state.
 const geometry=collectionOwned?null:sourceGeometry.clone();
 let buffers=null;
 if(!collectionOwned){
 const {index,byVertex}=separateComponents(sourceGeometry),head=new Set(BRIDLE_COMPONENTS),rein=new Set(DISPLAY_REIN_COMPONENTS),indices={all:[],live:[],bare:[],bareLive:[]};
 for(let i=0;i<index.length;i+=3){const id=byVertex[index[i]],triangle=[index[i],index[i+1],index[i+2]];
  if(byVertex[index[i+1]]!==id||byVertex[index[i+2]]!==id)throw Error('Cross-component tack triangle');
  indices.all.push(...triangle);if(!rein.has(id))indices.live.push(...triangle);
  if(head.has(id)||rein.has(id))indices.bare.push(...triangle);if(head.has(id))indices.bareLive.push(...triangle);
 }
 if(indices.bareLive.length!==5090*3||indices.all.length-indices.live.length!==EXPECTED_REMOVED*3)throw Error('Native bridle isolation mismatch');
 buffers=Object.fromEntries(Object.entries(indices).map(([key,values])=>[key,new THREE.BufferAttribute(new Uint16Array(values),1)]));
 tack.geometry=geometry;geometry.clearGroups();
 }
 let mode='saddled',liveReins=false,applied='',disposed=false;
 function apply(){
  if(disposed||collectionOwned)return;const key=mode==='bareback'?(liveReins?'bareLive':'bare'):(liveReins?'live':'all');
  if(key!==applied){geometry.setIndex(buffers[key]);geometry.clearGroups();geometry.addGroup(0,buffers[key].count,0);applied=key;}
  tack.visible=mode!=='wild';saddle.visible=mode==='saddled';
 }
 // Reuse a handful of measured coat vertices rather than assuming every breed
 // has the same saddle thickness. These vertices continue to follow skinning.
 const skin=rig.skin,seatFollower=rig.nativeSeatFollower||rig.nativeContacts?.seatFollower,point=new THREE.Vector3(),seat=new THREE.Vector3(),bareIds=[];
 if(skin&&seatFollower&&mount){
  rig.scene.updateWorldMatrix(true,true);rig.scene.updateMatrixWorld(true);seatFollower.getWorldPosition(seat);mount.worldToLocal(seat);
  const scale=Math.max(.01,mount.getWorldScale(new THREE.Vector3()).y),candidates=[];
  for(let i=0;i<skin.geometry.attributes.position.count;i++){
   skin.getVertexPosition(i,point);point.applyMatrix4(skin.matrixWorld);mount.worldToLocal(point);
   if(Math.abs(point.x-seat.x)<.075/scale&&Math.abs(point.z-seat.z)<.10/scale&&point.y>seat.y-.30/scale&&point.y<seat.y+.08/scale)candidates.push({id:i,y:point.y});
  }
  candidates.sort((a,b)=>b.y-a.y);for(const entry of candidates.slice(0,8))bareIds.push(entry.id);
 }
 function barebackSeatLocal(){
  if(!mount||!seatFollower)return null;
  rig.scene.updateWorldMatrix(true,true);rig.scene.updateMatrixWorld(true);seat.set(0,0,0);
  if(bareIds.length){for(const id of bareIds){skin.getVertexPosition(id,point);point.applyMatrix4(skin.matrixWorld);seat.add(mount.worldToLocal(point));}seat.multiplyScalar(1/bareIds.length);}
  else{seatFollower.getWorldPosition(seat);mount.worldToLocal(seat);seat.y-=.08/Math.max(.01,mount.getWorldScale(point).y);}
  return seat.clone();
 }
 const api={sourceGeometry,tack,barebackSeatLocal,collectionOwned,
  setMode(value){if(disposed)return false;if(!['saddled','bareback','wild'].includes(value))return false;mode=value;apply();return true;},
  setLiveReins(value){if(disposed)return;liveReins=!!value;apply();},
  get mode(){return mode;},
  inspect(){const sourceReinsVisible=tack.visible&&(collectionOwned&&Array.isArray(tack.material)?tack.geometry.groups.some(g=>g.materialIndex===4&&tack.material[4]?.visible!==false):!liveReins);return {mode,collectionOwned,saddleVisible:saddle.visible&&mode==='saddled',bridleVisible:tack.visible&&mode!=='wild',reinsVisible:sourceReinsVisible,sourceReinsVisible,triangles:tack.geometry.index.count/3,bridleTriangles:5090,sourceTriangles:sourceGeometry.index.count/3,sourceGeometryPreserved:tack.geometry!==sourceGeometry,barebackSeat:barebackSeatLocal()?.toArray()||null,barebackSeatVertices:bareIds.slice()};},
  dispose(){if(disposed)return;disposed=true;if(!collectionOwned){if(tack.geometry===geometry)tack.geometry=sourceGeometry;geometry.dispose();meshes.forEach((mesh,i)=>mesh.visible=visibleBefore[i]);}},
 };
 apply();return api;
}

function ribbon(THREE, group, material, name, width, count=42){
  const geometry=new THREE.BufferGeometry(),position=new Float32Array((count+1)*2*3),indices=[];
  for(let i=0;i<count;i++){const j=2*i;indices.push(j,j+1,j+2,j+1,j+3,j+2);}
  geometry.setAttribute('position',new THREE.BufferAttribute(position,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(indices);
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.frustumCulled=false;mesh.castShadow=true;group.add(mesh);
  let centerline=[];
  function update(knots){
    const curve=new THREE.CatmullRomCurve3(knots,false,'centripetal');
    centerline=[];
    for(let i=0;i<=count;i++)centerline.push(curve.getPoint(i/count));
    for(let i=0;i<=count;i++){
      const before=centerline[Math.max(0,i-1)],after=centerline[Math.min(count,i+1)];
      const tangent=after.clone().sub(before).normalize();
      let across=new THREE.Vector3(0,1,0).addScaledVector(tangent,-tangent.y);
      if(across.lengthSq()<.03)across=new THREE.Vector3(0,0,1).addScaledVector(tangent,-tangent.z);
      across.normalize();
      const taper=i===count? .86 : 1;
      const half=width*taper/2,j=i*6;
      const left=centerline[i].clone().addScaledVector(across,-half),right=centerline[i].clone().addScaledVector(across,half);
      position.set(left.toArray(),j);position.set(right.toArray(),j+3);
    }
    geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();
  }
  return {mesh,widthM:width,update,get centerline(){return centerline;}};
}

export function createNativeRiderReins({THREE,scene,tack,anchors,rider,contactPoint,seatFollower,tackModes}) {
  const originalGeometry=tackModes?.sourceGeometry||tack.geometry,originalRestingReinIndices=tack.userData.nativeRestingReinIndices;
  const {index,byVertex,vertices}=separateComponents(originalGeometry);
  const hidden=new Set(DISPLAY_REIN_COMPONENTS);
  for(const id of PROTECTED_COMPONENTS)if(hidden.has(id))throw Error('Protected native tack component selected for removal');
  const kept=[],restingReinIndices=[];const retainedPerComponent=new Int32Array(vertices.length),removedPerComponent=new Int32Array(vertices.length);
  for(let i=0;i<index.length;i+=3){const id=byVertex[index[i]];if(byVertex[index[i+1]]!==id||byVertex[index[i+2]]!==id)throw Error('Cross-component tack triangle');
    if(hidden.has(id)){removedPerComponent[id]++;restingReinIndices.push(index[i],index[i+1],index[i+2]);}else{kept.push(index[i],index[i+1],index[i+2]);retainedPerComponent[id]++;}}
  const removed=index.length/3-kept.length/3;
  if(removed!==EXPECTED_REMOVED || PROTECTED_COMPONENTS.some(id=>retainedPerComponent[id]===0))
    throw Error(`Rein isolation mismatch: ${removed} triangles removed`);
  // BufferGeometry clone leaves source mesh bytes untouched. The same skeleton,
  // bind matrix, material, UVs and all 276 other original parts stay in place.
  // The fitted bridle reuses these exact skinned strips when the rider is off
  // the horse. Collection-owned modes leave source indices/groups untouched;
  // the renderer alone suppresses those strips while drawing its private pair.
  tack.userData.nativeRestingReinIndices=Object.freeze(restingReinIndices);
  let displayGeometry=null;
  if(tackModes)tackModes.setLiveReins(true);
  else{displayGeometry=originalGeometry.clone();displayGeometry.setIndex(kept);displayGeometry.clearGroups();displayGeometry.addGroup(0,kept.length,0);tack.geometry=displayGeometry;}
  const group=new THREE.Group();group.name='Native leather split reins';scene.add(group);
  const leather=new THREE.MeshStandardMaterial({color:0x512810,roughness:1,metalness:0,side:THREE.DoubleSide});
  const reins={};
  for(const side of ['left','right'])reins[side]={
    main:ribbon(THREE,group,leather,`${side} bit-to-fist rein`,.019),
    loose:ribbon(THREE,group,leather,`${side} loose split-rein end`,.019,26),
    bit:null,hand:null,guide:null,
  };
  const pointPair=(id,k)=>{const ids=vertices[id],p=new THREE.Vector3(),q=new THREE.Vector3();if(ids.length!==56)throw Error('Source main-rein guide width/count changed');tack.getVertexPosition(ids[2*k],p);tack.getVertexPosition(ids[2*k+1],q);return p.applyMatrix4(tack.matrixWorld).add(q.applyMatrix4(tack.matrixWorld)).multiplyScalar(.5);};
  function update(){
    tack.updateWorldMatrix(true,false);tack.updateMatrixWorld(true);rider.R.fitG.updateMatrixWorld(true);
    const seat=seatFollower.getWorldPosition(new THREE.Vector3());
    for(const side of ['left','right']){
      const sign=side==='left'?-1:1,r=reins[side];
      const bit=contactPoint(anchors.contacts[`${side}BitRing`].vertexIds,tack).point;
      const hand=(side==='left'?rider.R.handL:rider.R.handR).getWorldPosition(new THREE.Vector3());
      // The original source strip is a useful collision-safe guide over the
      // outside of the neck. Its geometry remains skinned but is not rendered.
      const id=side==='left'?72:141;
      const g24=pointPair(id,24),g15=pointPair(id,15),g6=pointPair(id,6),g0=pointPair(id,0);
      const lift=g0.clone().add(new THREE.Vector3(sign*.018,.225,-.16));
      const approach=hand.clone().add(new THREE.Vector3(sign*.08,-.075,.13));
      r.main.update([bit,g24,g15,g6,g0,lift,approach,hand]);
      // Western split reins continue behind the rider's hands and hang beside
      // the thigh. Each branch follows both the rider and the moving saddle.
      const looseMid=hand.clone().add(new THREE.Vector3(sign*.12,-.19,-.14));
      const tip=seat.clone().add(new THREE.Vector3(sign*.32,-.48,.12));
      r.loose.update([hand,hand.clone().add(new THREE.Vector3(sign*.025,-.035,-.035)),looseMid,tip]);
      r.bit=bit;r.hand=hand;r.guide=[g24,g15,g6,g0];
    }
  }
  const position=a=>a?.toArray()||null;
  function inspect(){
    const sides={};for(const side of ['left','right']){const r=reins[side];sides[side]={bit:position(r.bit),hand:position(r.hand),mainStart:position(r.main.centerline[0]),mainEnd:position(r.main.centerline.at(-1)),looseStart:position(r.loose.centerline[0]),looseEnd:position(r.loose.centerline.at(-1)),mainWidthM:r.main.widthM,looseWidthM:r.loose.widthM,mainCenterline:r.main.centerline.map(position),looseCenterline:r.loose.centerline.map(position)};}
    return {triangles:{original:EXPECTED_TRIANGLES,removed,retained:kept.length/3},hiddenComponents:[...hidden],protectedComponents:PROTECTED_COMPONENTS,nonReinComponentsIntact:retainedPerComponent.every((n,id)=>hidden.has(id)?n===0:n>0),sides};
  }
  let disposed=false;
  return {group,update,inspect,setColor(value){leather.color.set(value||0x512810);},dispose(){
    if(disposed)return;disposed=true;group.removeFromParent();
    for(const side of ['left','right']){reins[side].main.mesh.geometry.dispose();reins[side].loose.mesh.geometry.dispose();}
    leather.dispose();
    if(tackModes)tackModes.setLiveReins(false);
    else{if(tack.geometry===displayGeometry)tack.geometry=originalGeometry;displayGeometry.dispose();}
    if(originalRestingReinIndices===undefined)delete tack.userData.nativeRestingReinIndices;else tack.userData.nativeRestingReinIndices=originalRestingReinIndices;
  }};
}

// These vertex sets were measured on the original skinned Western equipment.
// Both the white and Bay 677-joint targets retain identical topology/weights.
const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
const CONTACTS=Object.freeze({
  leftStirrupTread:{vertexIds:range(2792,2845),top:true},
  rightStirrupTread:{vertexIds:range(2716,2769),top:true},
  leftBitRing:{vertexIds:range(7894,8124)},
  rightBitRing:{vertexIds:range(6954,7184)},
});

// A broad draft needs a more open bareback thigh angle. Cache a sparse outer
// coat profile once; its few vertices then follow the native skin every frame.
function createDraftBarebackBarrel(THREE,rig,mount,seatLocal){
  if(!rig.profile?.nativeVariant?.draftShape||!rig.skin)return null;
  const skin=rig.skin,point=new THREE.Vector3(),scale=mount.getWorldScale(new THREE.Vector3()).x;
  const seat=seatLocal(),rows={L:[],R:[]};
  for(let i=0;i<11;i++)for(const S of ['L','R'])rows[S].push({height:seat.y-(.04+i*.075)/scale,id:-1,width:-Infinity,point:new THREE.Vector3()});
  skin.updateWorldMatrix(true,true);
  for(let id=0;id<skin.geometry.attributes.position.count;id++){
    skin.getVertexPosition(id,point);point.applyMatrix4(skin.matrixWorld);mount.worldToLocal(point);
    if(point.z<seat.z-.32/scale||point.z>seat.z+.18/scale)continue;
    const S=point.x<seat.x?'L':'R',width=Math.abs(point.x-seat.x);
    for(const row of rows[S])if(Math.abs(point.y-row.height)<.045/scale&&width>row.width){row.id=id;row.width=width;}
  }
  for(const S of ['L','R'])rows[S]=rows[S].filter(row=>row.id>=0);
  if(rows.L.length<5||rows.R.length<5)return null;
  const samples=rows.L.concat(rows.R);
  function update(){
    skin.updateWorldMatrix(true,true);
    for(const row of samples){skin.getVertexPosition(row.id,row.point);row.point.applyMatrix4(skin.matrixWorld);mount.worldToLocal(row.point);}
  }
  function clearance(world,side){
    point.copy(world);mount.worldToLocal(point);const list=rows[side<0?'L':'R'];let width=side*list[0].point.x;
    if(point.y<list.at(-1).point.y)width=side*list.at(-1).point.x;
    else for(let i=1;i<list.length;i++){
      const a=list[i-1].point,b=list[i].point;
      if(point.y<=a.y&&point.y>=b.y){const t=(a.y-point.y)/Math.max(.0001,a.y-b.y);width=side*(a.x+(b.x-a.x)*t);break;}
    }
    return (side*point.x-width)*scale;
  }
  update();
  return {update,clearance,inspect:()=>({sampleCount:rows.L.length+rows.R.length,sides:Object.fromEntries(Object.entries(rows).map(([S,list])=>[S,list.map(row=>({id:row.id,point:row.point.toArray()}))]))})};
}

/** Connect the game's existing articulated rider to the source saddle and tack.
 * The horse scene stays inside the game's externally driven player mount. This
 * bridge changes only a clone of the display-rein index buffer and two ribbons;
 * original skinning, bridle hardware, saddle, and stirrups remain intact.
 */
export function createNativeRiderBridge({THREE,scene,mount,rig,rider,saddleProxy,bitL,bitR,collectionOwned=false}){
  if(rig.profile?.nativeKind!=='horse')throw Error('Native Western rider bridge requires a horse');
  const seatFollower=rig.nativeSeatFollower||rig.nativeContacts?.seatFollower;
  let tack=rig.nativeContacts?.tack;
  if(!tack)rig.scene.traverse(o=>{if(o.isSkinnedMesh&&o.geometry?.attributes.position.count===13895)tack=o;});
  if(!seatFollower||!tack||tack.geometry.attributes.position.count!==13895)
    throw Error('Native saddle seat or original Western tack missing');
  const tackModes=createNativeTackModes({THREE,rig,mount,collectionOwned});
  const barebackBarrel=createDraftBarebackBarrel(THREE,rig,mount,()=>tackModes.barebackSeatLocal());
  const anchors={contacts:CONTACTS};
  const v=new THREE.Vector3(),min=new THREE.Vector3(),max=new THREE.Vector3(),mean=new THREE.Vector3();
  let reins=null,enabled=false,reinsWanted=false,reinColor=null,disposed=false,lastContact=null;
  function assertLive(){if(disposed)throw Error('Native rider bridge disposed');}
  function point(ids,mesh,top=false){
    // CPU skinning reads bone world matrices directly. The renderer uploads
    // the shared skeleton once; rebuilding its 677 GPU matrices per contact
    // repeated that work six times every riding frame. Callers update matrices.
    min.set(Infinity,Infinity,Infinity);max.set(-Infinity,-Infinity,-Infinity);mean.set(0,0,0);
    for(const i of ids){mesh.getVertexPosition(i,v);v.applyMatrix4(mesh.matrixWorld);min.min(v);max.max(v);mean.add(v);}
    mean.multiplyScalar(1/ids.length);
    if(top){mean.copy(min).add(max).multiplyScalar(.5);mean.y=max.y;}
    return mean.clone();
  }
  const contactPoint=(ids,mesh,top=false)=>({point:point(ids,mesh,top)});
  function seatLocal(){assertLive();seatFollower.getWorldPosition(v);return mount.worldToLocal(v.clone());}
  function updateContacts(){
    assertLive();rig.scene.updateWorldMatrix(true,true);rig.scene.updateMatrixWorld(true);mount.updateWorldMatrix(true,false);
    const leftTread=point(CONTACTS.leftStirrupTread.vertexIds,tack,true),rightTread=point(CONTACTS.rightStirrupTread.vertexIds,tack,true);
    const leftBit=point(CONTACTS.leftBitRing.vertexIds,tack),rightBit=point(CONTACTS.rightBitRing.vertexIds,tack);
    for(const [name,world] of [['L',leftTread],['R',rightTread]]){
      const stir=saddleProxy?.userData?.stir?.[name];
      if(stir){stir.parent.updateWorldMatrix(true,false);stir.position.copy(stir.parent.worldToLocal(world.clone()));}
    }
    // Legacy bitL means the +X side; the measured source's leftBitRing is -X.
    if(bitL)bitL.position.copy(mount.worldToLocal(rightBit.clone()));
    if(bitR)bitR.position.copy(mount.worldToLocal(leftBit.clone()));
    lastContact={seat:seatLocal().toArray(),leftTread:mount.worldToLocal(leftTread.clone()).toArray(),rightTread:mount.worldToLocal(rightTread.clone()).toArray(),leftBit:mount.worldToLocal(leftBit.clone()).toArray(),rightBit:mount.worldToLocal(rightBit.clone()).toArray()};
    return lastContact;
  }
  // Fitted tack may partition the current display geometry. Prepare the rein
  // metadata before collection creation; later riding updates never replace its groups.
  function prepareReins(){
    assertLive();if(!rider?.sk)return false;
    if(!reins){reins=createNativeRiderReins({THREE,scene,tack,anchors,rider:{R:rider},contactPoint,seatFollower,tackModes});reins.group.visible=false;reins.setColor(reinColor);}
    return true;
  }
  function updateReins(){
    assertLive();
    if(!enabled||!reinsWanted||!rider?.sk){if(reins)reins.group.visible=false;return null;}
    prepareReins();
    reins.group.visible=true;reins.update();return true;
  }
  function setMode(value){assertLive();if(!tackModes.setMode(value))return false;enabled=value!=='wild';if(reins)reins.group.visible=enabled&&reinsWanted;return true;}
  function setTackVisible(value){
    if(!collectionOwned)return setMode(value?'saddled':'wild');
    assertLive();enabled=!!value&&tackModes.mode!=='wild';
    if(reins)reins.group.visible=enabled&&reinsWanted;
    return true;
  }
  function showReins(value){assertLive();reinsWanted=!!value;if(reins)reins.group.visible=enabled&&reinsWanted;}
  function setReinColor(value){assertLive();const next=typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:null;if(next===reinColor)return;reinColor=next;reins?.setColor(reinColor);}
  function inspect(){return {kind:'nativeWesternHorse',enabled,...tackModes.inspect(),reinsWanted,reinsVisible:!!reins?.group.visible,reinColor,contact:lastContact,reins:reins?.inspect()||null,seatFollower:seatFollower.name||'saddle_0333 seat'};}
  function dispose(){if(disposed)return;reins?.dispose();tackModes.dispose();disposed=true;}
  return {seatLocal,barebackSeatLocal:tackModes.barebackSeatLocal,barebackBarrel,updateContacts,prepareReins,updateReins,setMode,setTackVisible,showReins,setReinColor,inspect,dispose,get readyForReins(){return !!rider?.sk;},get mode(){return tackModes.mode;}};
}
