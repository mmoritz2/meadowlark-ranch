import * as THREE from 'three';

// One nearby water plane, refreshed at most 15 Hz on High. Actual static water
// must overlap the main view/local reflection footprint before scene submission.
// Lower tiers and XR keep the PBR sky reflection.
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
  const viewProjection=new THREE.Matrix4(),frustum=new THREE.Frustum(),waterBounds=new WeakMap();
  const state={renders:0,active:false,visible:false,invisibleSkips:0};
  const alive=o=>{for(let a=o;a;a=a.parent)if(!a.visible)return false;return true;};
  // Small consecutive triangle blocks keep long river ribbons conservative but
  // useful. Only water geometry is read, once per actual source/version change.
  function blocks(o){
    const g=o.geometry,p=g?.attributes?.position,index=g?.index,start=Math.max(0,Math.floor(g?.drawRange?.start||0));
    if(!g?.isBufferGeometry||!p||p.itemSize!==3||p.isGLBufferAttribute||o.userData.reflectionDynamic||o.isInstancedMesh||o.isSkinnedMesh||o.morphTargetInfluences?.some(v=>v!==0))return null;
    const count=Math.max(0,Math.min(index?index.count:p.count,start+(g.drawRange.count===Infinity?(index?index.count:p.count):g.drawRange.count))-start);
    if(!Number.isFinite(start+count)||start%3||count%3)return null;
    let c=waterBounds.get(o);o.updateWorldMatrix(true,false);
    const sourceSame=c&&c.geometry===g&&c.position===p&&c.array===p.array&&c.version===p.version&&c.dataVersion===(p.data?.version??null)&&c.index===index&&c.indexArray===index?.array&&c.indexVersion===index?.version&&c.start===start&&c.count===count;
    if(!sourceSame){
      const local=[];
      for(let a=start;a<start+count;a+=64*3){
        const b=new THREE.Box3();b.makeEmpty();
        for(let j=a;j<Math.min(start+count,a+64*3);j++){const k=index?index.getX(j):j;corner.set(p.getX(k),p.getY(k),p.getZ(k),1);if(!Number.isFinite(corner.x+corner.y+corner.z))return null;b.expandByPoint(corner);}
        if(!b.isEmpty())local.push(b);
      }
      c={geometry:g,position:p,array:p.array,version:p.version,dataVersion:p.data?.version??null,index,indexArray:index?.array,indexVersion:index?.version,start,count,local,world:local.map(()=>new THREE.Box3()),matrix:null};waterBounds.set(o,c);
    }
    if(!c.matrix||c.matrix.some((v,i)=>v!==o.matrixWorld.elements[i])){for(let i=0;i<c.local.length;i++)c.world[i].copy(c.local[i]).applyMatrix4(o.matrixWorld).expandByScalar(.05);c.matrix=o.matrixWorld.elements.slice();}
    return c.world;
  }
  function waterCanContribute(o,level){
    if(!alive(o)||!o.layers.test(camera.layers))return false;
    const mats=Array.isArray(o.material)?o.material:[o.material];
    if(mats.some(m=>m?.isShaderMaterial||m?.displacementMap))return true;
    const bounds=blocks(o);if(!bounds)return true; // Unsupported water stays eligible.
    return bounds.some(b=>b.max.y>=level-.65&&b.min.y<=level+.65&&b.distanceToPoint(camera.position)<=110.05&&frustum.intersectsBox(b));
  }

  return {
    state,
    update(now=performance.now()) {
      const water=levelAt(camera.position.x,camera.position.z);
      const active=quality()==='high'&&!renderer.xr.isPresenting&&water.distance<48&&camera.position.y>water.level+.08;
      state.active=active;reflection.amount.value=active?1:0;
      if(!active)return;
      if(now-last<(water.refreshIntervalMs||66)&&Math.abs(lastLevel-water.level)<.04)return;
      camera.updateMatrixWorld();viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(viewProjection);
      let visibleWater=false;
      // Clones lose non-enumerable reflection metadata but retain waterTime;
      // both forms use the original shared shader/uniform closure.
      scene.traverse(o=>{
        if(visibleWater||!o.isMesh||!o.visible)return;
        const mats=Array.isArray(o.material)?o.material:[o.material];
        if(mats.some(m=>m?.userData.waterTime||m?.userData.reflection)&&waterCanContribute(o,water.level))visibleWater=true;
      });
      state.visible=visibleWater;if(!visibleWater){state.invisibleSkips++;return;}
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
