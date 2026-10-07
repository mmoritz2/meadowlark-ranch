import * as THREE from 'three';

// One nearby water plane, refreshed at most 15 Hz on High. Clipping rejects the
// underwater half of the world. Lower tiers and XR keep the PBR sky reflection.
export function createWaterReflections({scene,renderer,camera,material,levelAt,quality,omitFromReflection=()=>false}) {
  const reflection=material.userData.reflection;
  const target=new THREE.WebGLRenderTarget(640,360,{type:THREE.HalfFloatType,depthBuffer:true});
  target.texture.name='Nearby water reflection';
  reflection.map.value=target.texture;
  const mirror=new THREE.PerspectiveCamera(),textureMatrix=reflection.matrix.value;
  const direction=new THREE.Vector3(),up=new THREE.Vector3(),plane=new THREE.Plane();
  const clip=new THREE.Vector4(),corner=new THREE.Vector4(),normal=new THREE.Vector3(0,1,0);
  let last=-Infinity,lastLevel=Infinity;
  const hidden=[];
  const state={renders:0,active:false};
  return {
    state,
    update(now=performance.now()) {
      const water=levelAt(camera.position.x,camera.position.z);
      const active=quality()==='high'&&!renderer.xr.isPresenting&&water.distance<48&&camera.position.y>water.level+.08;
      state.active=active;reflection.amount.value=active?1:0;
      if(!active)return;
      if(now-last<(water.refreshIntervalMs||66)&&Math.abs(lastLevel-water.level)<.04)return;
      last=now;lastLevel=water.level;
      reflection.level.value=water.level;
      camera.updateMatrixWorld();camera.getWorldDirection(direction);
      mirror.position.copy(camera.position);mirror.position.y=2*water.level-camera.position.y;
      direction.y=-direction.y;
      up.set(0,1,0).transformDirection(camera.matrixWorld);up.y=-up.y;mirror.up.copy(up);
      mirror.lookAt(direction.add(mirror.position));
      mirror.near=camera.near;mirror.far=camera.far;
      mirror.projectionMatrix.copy(camera.projectionMatrix);mirror.updateMatrixWorld();
      textureMatrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1)
        .multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
      plane.set(normal,-water.level+.025).applyMatrix4(mirror.matrixWorldInverse);
      clip.set(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
      const projection=mirror.projectionMatrix.elements;
      corner.set((Math.sign(clip.x)+projection[8])/projection[0],
        (Math.sign(clip.y)+projection[9])/projection[5],-1,(1+projection[10])/projection[14]);
      clip.multiplyScalar(2/clip.dot(corner));
      projection[2]=clip.x;projection[6]=clip.y;projection[10]=clip.z+1-.001;projection[14]=clip.w;
      mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
      // Hide water skins to avoid attachment feedback, and omit floating UI labels.
      hidden.length=0;
      scene.traverse(o=>{
        if(!o.visible||(!o.isMesh&&!o.isSprite))return;
        const mats=Array.isArray(o.material)?o.material:[o.material];
        if(omitFromReflection(o)||mats.some(m=>m.userData.waterTime||m.userData.reflection||m.name==='World | floating label')) {hidden.push(o);o.visible=false;}
      });
      const previousTarget=renderer.getRenderTarget(),shadowUpdate=renderer.shadowMap.autoUpdate;
      const callback=scene.onBeforeRender,xr=renderer.xr.enabled;
      try {
        renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;scene.onBeforeRender=()=>{};
        renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,mirror);state.renders++;
      } finally {
        for(const o of hidden)o.visible=true;
        scene.onBeforeRender=callback;renderer.shadowMap.autoUpdate=shadowUpdate;renderer.xr.enabled=xr;
        renderer.setRenderTarget(previousTarget);
      }
    },
    dispose(){target.dispose();},
  };
}
