/* Private, display-only Western split reins for the native 677-joint horse.
 * Original GLB vertex positions, skin weights, bones, bind matrices, and all
 * non-rein tack remain untouched. This replaces selected triangles on a clone
 * of the original tack BufferGeometry and updates two 19 mm leather ribbons.
 */
export const DISPLAY_REIN_COMPONENTS = [57,58,59,60,61,62,72,73,74,75,103,104,141,142,143,153,163,164,244,245,254,255,278,283];
const PROTECTED_COMPONENTS = [89,91,205,209];
const EXPECTED_TRIANGLES = 17194;
const EXPECTED_REMOVED = 1640;

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

export function createNativeRiderReins({THREE,scene,tack,anchors,rider,contactPoint,seatFollower}) {
  const originalGeometry=tack.geometry;
  const {index,byVertex,vertices}=separateComponents(originalGeometry);
  const hidden=new Set(DISPLAY_REIN_COMPONENTS);
  for(const id of PROTECTED_COMPONENTS)if(hidden.has(id))throw Error('Protected native tack component selected for removal');
  const kept=[];const retainedPerComponent=new Int32Array(vertices.length),removedPerComponent=new Int32Array(vertices.length);
  for(let i=0;i<index.length;i+=3){const id=byVertex[index[i]];if(byVertex[index[i+1]]!==id||byVertex[index[i+2]]!==id)throw Error('Cross-component tack triangle');
    if(hidden.has(id))removedPerComponent[id]++;else{kept.push(index[i],index[i+1],index[i+2]);retainedPerComponent[id]++;}}
  const removed=index.length/3-kept.length/3;
  if(removed!==EXPECTED_REMOVED || PROTECTED_COMPONENTS.some(id=>retainedPerComponent[id]===0))
    throw Error(`Rein isolation mismatch: ${removed} triangles removed`);
  // BufferGeometry clone leaves source mesh bytes untouched. The same skeleton,
  // bind matrix, material, UVs and all 276 other original parts stay in place.
  tack.geometry=originalGeometry.clone();tack.geometry.setIndex(kept);
  tack.geometry.clearGroups();tack.geometry.addGroup(0,kept.length,0);
  const group=new THREE.Group();group.name='Private dynamic leather split reins';scene.add(group);
  const leather=new THREE.MeshStandardMaterial({color:0x512810,roughness:1,metalness:0,side:THREE.DoubleSide});
  const reins={};
  for(const side of ['left','right'])reins[side]={
    main:ribbon(THREE,group,leather,`${side} bit-to-fist rein`,.019),
    loose:ribbon(THREE,group,leather,`${side} loose split-rein end`,.019,26),
    bit:null,hand:null,guide:null,
  };
  const pointPair=(id,k)=>{const ids=vertices[id],p=new THREE.Vector3(),q=new THREE.Vector3();if(ids.length!==56)throw Error('Source main-rein guide width/count changed');tack.getVertexPosition(ids[2*k],p);tack.getVertexPosition(ids[2*k+1],q);return p.applyMatrix4(tack.matrixWorld).add(q.applyMatrix4(tack.matrixWorld)).multiplyScalar(.5);};
  function update(){
    tack.skeleton.update();tack.updateWorldMatrix(true,false);rider.R.fitG.updateMatrixWorld(true);
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
  return {update,inspect,dispose(){group.removeFromParent();for(const side of ['left','right']){reins[side].main.mesh.geometry.dispose();reins[side].loose.mesh.geometry.dispose();}leather.dispose();tack.geometry.dispose();tack.geometry=originalGeometry;}};
}
