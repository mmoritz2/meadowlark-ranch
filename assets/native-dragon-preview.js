/* Isolated review adapter for 3DHaupt's original dragon. This is intentionally
 * idle-only: the source provides no walk, canter, jump, takeoff or flight clip.
 * It is not wired into the ranch roster or the shared 40-joint horse solver. */
const SOURCE_WITHERS_M=3.2891557745925395;
const SOURCE_GROUND_OFFSET_M=0.010140415394662964;

export async function loadNativeDragonPreview({THREE,GLTFLoader,url,withersM=1.85,darkAppearance=true}){
 if(!url)throw new Error('Native dragon review requires an explicit source URL');
 const gltf=await new GLTFLoader().loadAsync(url);
 const skins=[];
 gltf.scene.traverse(o=>{if(o.isSkinnedMesh)skins.push(o);});
 if(!skins.length||skins.some(o=>o.skeleton.bones.length!==232))throw new Error('Expected creator 232-joint dragon skin');
 const clip=gltf.animations.find(c=>c.name==='Scene');
 if(!clip||clip.tracks.length!==708)throw new Error('Expected creator native dragon Scene clip');
 const floor=gltf.scene.getObjectByName('Plane_Material_0');
 if(floor){if(floor.isSkinnedMesh)throw new Error('Unexpected skinned source floor');floor.removeFromParent();}
 // The creator GLB's main body is semitransparent and highly metallic, which
 // washes it out against Studio's light floor. Clone its existing materials
 // and tint only the two body surfaces for this local review; keep all maps,
 // normal maps, geometry, joints, and the creator animation untouched.
 if(darkAppearance){
  for(const skin of skins){
   const darken=material=>{
    if(material.name!=='Game_dragon'&&material.name!=='Game_dragon.001')return material;
    const tinted=material.clone();
    tinted.color.multiplyScalar(.16);
    tinted.opacity=1;tinted.transparent=false;tinted.depthWrite=true;
    tinted.metalness=Math.min(tinted.metalness,.12);
    tinted.roughness=Math.max(tinted.roughness,.62);
    if('transmission' in tinted)tinted.transmission=0;
    if('clearcoat' in tinted)tinted.clearcoat=Math.min(tinted.clearcoat,.15);
    if('specularIntensity' in tinted)tinted.specularIntensity=Math.min(tinted.specularIntensity,.35);
    return tinted;
   };
   skin.material=Array.isArray(skin.material)?skin.material.map(darken):darken(skin.material);
  }
 }
 const body=skins.reduce((a,b)=>a.geometry.attributes.position.count>b.geometry.attributes.position.count?a:b);
 const scene=new THREE.Group();scene.name='NativeDragonReview';scene.userData.owned=true;
 scene.add(gltf.scene);scene.scale.setScalar(withersM/SOURCE_WITHERS_M);
 scene.position.y=SOURCE_GROUND_OFFSET_M*withersM/1.85;
 scene.updateMatrixWorld(true);
 const mixer=new THREE.AnimationMixer(gltf.scene),action=mixer.clipAction(clip);
 action.play();action.paused=true;mixer.setTime(0);
 let mode='rest';
 const motion={
  availableModes:['rest','stand'],
  state:{lead:'left',bodyLiftM:0,speedMps:0,grounded:true},
  get mode(){return mode;},get clip(){return mode==='stand'?clip.name:null;},get time(){return action.time;},
  set(value){
   if(value==='rest'){mode='rest';action.paused=true;mixer.setTime(0);return;}
   if(value==='stand'){mode='stand';action.paused=false;action.play();return;}
   throw new Error('Creator dragon has no native '+value+' animation');
  },
  update(dt){if(mode==='stand')mixer.update(Math.max(0,Math.min(.25,dt||0)));},
  seek(seconds){if(mode!=='stand')this.set('stand');mixer.setTime(Math.max(0,Math.min(clip.duration,Number(seconds)||0)));},
  reset(){this.set('rest');},
  dispose(){mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);}
 };
 return {scene,body,motion,joints:232,clipName:clip.name,clipDuration:clip.duration,
  sourceScene:gltf.scene,sourceAnimations:gltf.animations,sourceMaterials:skins.flatMap(o=>Array.isArray(o.material)?o.material:[o.material])};
}
