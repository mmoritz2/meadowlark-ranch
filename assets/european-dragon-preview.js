/* Isolated review adapter for Regina Cachoa's European Dragon. It plays only
 * the five clips authored in the source GLB, preserving the 169-joint skin,
 * materials, mesh and animation tracks. It is not wired into the public ranch. */
export const EUROPEAN_DRAGON_CLIPS=['Idle Stand','Idle Sit','Walk','Run','Fly'];

export async function loadEuropeanDragonPreview({THREE,GLTFLoader,url,scale=1.45}){
 if(!url)throw new Error('European Dragon review requires an explicit source URL');
 const gltf=await new GLTFLoader().loadAsync(url);
 const skins=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)skins.push(o);});
 if(skins.length!==5||skins.some(o=>o.skeleton.bones.length!==169))throw new Error('Expected creator five-part 169-joint dragon skin');
 const names=gltf.animations.map(c=>c.name);
 if(names.length!==EUROPEAN_DRAGON_CLIPS.length||EUROPEAN_DRAGON_CLIPS.some(n=>!names.includes(n)))throw new Error('Expected five original European Dragon clips');
 const body=skins.reduce((a,b)=>a.geometry.attributes.position.count>b.geometry.attributes.position.count?a:b);
 const scene=new THREE.Group();scene.name='EuropeanDragonReview';scene.userData.owned=true;
 scene.add(gltf.scene);scene.scale.setScalar(scale);scene.position.y=.03;scene.updateMatrixWorld(true);
 const mixer=new THREE.AnimationMixer(gltf.scene),actions=new Map(gltf.animations.map(clip=>[clip.name,mixer.clipAction(clip)]));
 let mode='Idle Stand',active=null;
 const motion={
  availableModes:[...EUROPEAN_DRAGON_CLIPS],
  state:{lead:'left',bodyLiftM:0,speedMps:0,grounded:true},
  get mode(){return mode;},get clip(){return active?.getClip().name||null;},get time(){return active?.time||0;},
  set(value){
   if(!actions.has(value))throw new Error('European Dragon source has no native '+value+' clip');
   mixer.stopAllAction();mode=value;active=actions.get(value);active.reset().play();mixer.update(0);
   this.state.grounded=value!=='Fly';
  },
  update(dt){mixer.update(Math.max(0,Math.min(.25,dt||0)));},
  seek(seconds){if(!active)throw new Error('No active European Dragon clip');mixer.setTime(Math.max(0,Math.min(active.getClip().duration,Number(seconds)||0)));},
  reset(){this.set('Idle Stand');},
  dispose(){mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);}
 };
 motion.reset();
 return {scene,body,motion,joints:169,sourceScene:gltf.scene,sourceAnimations:gltf.animations,
  sourceMaterials:skins.flatMap(o=>Array.isArray(o.material)?o.material:[o.material])};
}
