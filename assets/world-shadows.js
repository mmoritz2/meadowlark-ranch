// One terrain-following sun shadow map. Lower quality reduces resolution and
// coverage; it does not remove the shadows that give the landscape its depth.
export function createWorldShadows({THREE,renderer,light,heightAt}) {
  const presets={low:{map:1024,radius:52},medium:{map:2048,radius:76},high:{map:4096,radius:100}};
  const state={tier:'high',mapSize:0,span:0,ground:0};
  let preset=presets.high;
  const centre=new THREE.Vector3(),direction=new THREE.Vector3(),right=new THREE.Vector3(),vertical=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  const camera=light.shadow.camera;
  light.castShadow=true;
  camera.near=1;camera.far=380;
  light.shadow.bias=-.000035;light.shadow.normalBias=.022;
  function setQuality(tier){
    state.tier=tier;preset=presets[tier]||presets.high;
    const size=Math.min(preset.map,renderer.capabilities.maxTextureSize);
    if(light.shadow.mapSize.x!==size){
      light.shadow.mapSize.set(size,size);
      if(light.shadow.map){light.shadow.map.dispose();light.shadow.map=null;}
    }
    state.mapSize=size;
  }
  function update(position,sunDirection,lowSun=0){
    const radius=preset.radius+Math.max(0,Math.min(1,lowSun))*20;
    if(Math.abs(camera.right-radius)>.001){
      camera.left=camera.bottom=-radius;camera.right=camera.top=radius;camera.updateProjectionMatrix();
    }
    state.span=radius*2;state.ground=heightAt(position.x,position.z);
    centre.set(position.x,state.ground,position.z);direction.copy(sunDirection).normalize();
    right.crossVectors(up,direction).normalize();vertical.crossVectors(direction,right).normalize();
    // Snap in light space, so a small camera movement does not slide the shadow
    // texel grid across stationary roofs, tree trunks and horse legs.
    const texel=state.span/state.mapSize;
    const x=centre.dot(right),y=centre.dot(vertical);
    centre.addScaledVector(right,Math.round(x/texel)*texel-x);
    centre.addScaledVector(vertical,Math.round(y/texel)*texel-y);
    light.target.position.copy(centre);light.position.copy(centre).addScaledVector(direction,180);
  }
  setQuality('high');
  return {state,setQuality,update};
}
