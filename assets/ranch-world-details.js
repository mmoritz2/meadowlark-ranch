import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Authored yard clusters using the already licensed CC0 Poly Haven scans.
// Metre scale, all submeshes and the original PBR channels are retained.
export function installRanchWorldDetails(G,{shrubs=[]}={}) {
  const {THREE,scene,world:W,horse:H}=G;
  const state=G.worldDetails={placed:[],skipped:[],errors:[],understory:0,ready:null};
  const group=new THREE.Group();group.name='Ranch working-yard details';scene.add(group);
  const loader=new GLTFLoader(), objects=[],patches=[],wind={value:0};
  const placements=[
    ['wine_barrel_01',.40,[[-20.1,-14.8,.2],[-20.2,-15.8,.7],[-29.8,-5.8,1.1],[41,-47,.3]]],
    ['wooden_crate_01',.45,[[-20.3,-12.4,.12],[-20.1,-11.6,-.1],[-11.2,-16.8,.4],[40.4,-46,.2]]],
    ['wooden_crate_02',.60,[[-12,-17.2,1.52],[-30,-7.2,.2],[41.8,-48.2,.1]]],
    ['wooden_bucket_01',.20,[[-18.8,-10.9,.4],[-29.4,-4.8,1.7],[-6.8,-18.8,.4]]],
    ['wooden_ladder',.50,[[-20.4,-13.6,Math.PI/2]]],
    ['watering_can_metal_01',0,[[-11.7,-9.6,1.2],[38.8,-45.8,2.1]]],
    ['wooden_bucket_02',.32,[[-11.6,-17.8,.2],[-29.1,-6.2,1.2]]],
  ];
  const segmentDistance=(x,z,a,b)=>{
    const dx=b[0]-a[0],dz=b[1]-a[1],t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);
    return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
  };
  const routes=Object.values(G.tables.RACE_ROUTES).filter(Array.isArray);
  function available(x,z,r) {
    if((x/24.8)**2+(z/19.8)**2<1)return false;
    if(W.pathDist(x,z)<r+1.7)return false;
    if(W.colliders.some(c=>Math.hypot(c.x-x,c.z-z)<c.r+r+.18))return false;
    if(Object.values(G.ranch?.SLOTS||{}).some(s=>Math.hypot(s.x-x,s.z-z)<7.5+r))return false;
    for(const route of routes)for(let i=1;i<route.length;i++)if(segmentDistance(x,z,route[i-1],route[i])<r+3.8)return false;
    const h=W.groundH(x,z);
    return [[r,0],[-r,0],[0,r],[0,-r]].every(([dx,dz])=>Math.abs(W.groundH(x+dx,z+dz)-h)<.18);
  }
  state.ready=(async()=>{
    // Yield until the mounted horse has loaded, avoiding competition on arrival.
    for(let i=0;i<120&&!H.RIG()?.ready;i++)await new Promise(ok=>setTimeout(ok,250));
    for(const [name,radius,points] of placements) {
      const safe=points.filter(([x,z])=>available(x,z,radius));
      state.skipped.push(...points.filter(p=>!safe.includes(p)).map(p=>({asset:name,x:p[0],z:p[1]})));
      if(!safe.length)continue;
      try {
        const asset=await loader.loadAsync('./assets/models/world/props/'+name+'.glb');
        const bounds=new THREE.Box3().setFromObject(asset.scene);
        asset.scene.traverse(o=>{
          if(!o.isMesh)return;
          o.castShadow=true;o.receiveShadow=true;
          for(const m of (Array.isArray(o.material)?o.material:[o.material])) {
            m.envMapIntensity=.7;
            for(const k of ['map','normalMap','roughnessMap','metalnessMap'])if(m[k])m[k].anisotropy=Math.min(8,G.renderer.capabilities.getMaxAnisotropy());
          }
        });
        for(const [x,z,yaw] of safe) {
          const root=asset.scene.clone(true);
          root.name='Yard scan | '+name;
          root.rotation.y=yaw;root.position.set(x,W.groundH(x,z)-bounds.min.y,z);
          group.add(root);objects.push(root);
          if(radius>0)W.colliders.push({x,z,r:radius});
          W.followCamera.register(root);
          state.placed.push({asset:name,x,z,r:radius});
        }
      } catch(e) {state.errors.push(name+': '+e.message);console.warn('Yard detail unavailable',name,e);}
    }
    for(const [name,parity,height] of [['shrub_03',0,.8],['shrub_04',1,.65],['fern_02',2,.48]]){
      const points=shrubs.filter((p,i)=>parity===2?i%4===0:i%2===parity)
        .map(p=>({...p,x:p.x+(parity===2?1.05:0),z:p.z+(parity===2?.85:0)}))
        .filter(p=>W.pathDist(p.x,p.z)>2.5&&!(window.__onCourse&&window.__onCourse(p.x,p.z,3.4)));
      try{
        const asset=await loader.loadAsync('./assets/models/world/'+name+'.glb');
        asset.scene.updateMatrixWorld(true);
        let source=null;asset.scene.traverse(o=>{if(o.isMesh&&!source)source=o;});
        if(!source)throw Error('Scan contains no mesh');
        const geo=source.geometry.clone().applyMatrix4(source.matrixWorld);geo.computeBoundingBox();
        const minY=geo.boundingBox.min.y,h=geo.boundingBox.max.y-minY||1;
        const mat=source.material;mat.alphaToCoverage=true;mat.envMapIntensity=.55;
        mat.roughness=.92;mat.side=THREE.DoubleSide;
        const deform=sh=>{
          sh.uniforms.yardWind=wind;
          sh.vertexShader='uniform float yardWind;\n'+sh.vertexShader;
          sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
            #ifdef USE_INSTANCING
              float anchor=max(0.0,position.y-(${minY.toFixed(5)}));
              float phase=instanceMatrix[3].x*.21+instanceMatrix[3].z*.17;
              transformed.x+=sin(yardWind*1.2+phase)*anchor*anchor*.025;
              transformed.z+=sin(yardWind*.8+phase*1.3)*anchor*.016;
            #endif`);
        };
        mat.onBeforeCompile=deform;mat.customProgramCacheKey=()=>name+'-wind-1';
        const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:mat.map,alphaTest:mat.alphaTest,side:THREE.DoubleSide});
        depth.onBeforeCompile=deform;depth.customProgramCacheKey=()=>name+'-depth-wind-1';
        const cells=new Map();
        for(const p of points){const key=Math.floor(p.x/100)+','+Math.floor(p.z/100);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(p);}
        const matrix=new THREE.Matrix4(),v=new THREE.Vector3(),s=new THREE.Vector3(),q=new THREE.Quaternion();
        for(const points of cells.values()){
          const mesh=new THREE.InstancedMesh(geo,mat,points.length);mesh.name='foliage_scan_'+name;
          mesh.customDepthMaterial=depth;mesh.receiveShadow=true;mesh.castShadow=G.gfx.get()==='high';
          const cx=points.reduce((sum,p)=>sum+p.x,0)/points.length,cz=points.reduce((sum,p)=>sum+p.z,0)/points.length;
          mesh.position.set(cx,0,cz);
          points.forEach((p,i)=>{
            const scale=height*(p.s||1)/h;
            v.set(p.x-cx,W.groundH(p.x,p.z)-minY*scale-.035,p.z-cz);
            s.setScalar(scale);q.setFromAxisAngle(new THREE.Vector3(0,1,0),p.r||0);
            matrix.compose(v,q,s);mesh.setMatrixAt(i,matrix);
          });
          mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);patches.push(mesh);
        }
        state.understory+=points.length;
      }catch(e){state.errors.push(name+': '+e.message);console.warn('Understory scan unavailable',name,e);}
    }
    return state.placed.length;
  })();
  let elapsed=0;
  G.on('tick',(dt,t)=>{
    wind.value=t;
    elapsed+=dt;if(elapsed<.4)return;elapsed=0;
    const max=G.gfx.get()==='low'?65:140, p=H.player.pos;
    for(const root of objects)root.visible=Math.hypot(root.position.x-p.x,root.position.z-p.z)<max;
    for(const patch of patches)patch.visible=Math.hypot(patch.position.x-p.x,patch.position.z-p.z)<max+75;
  });
}
