import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Authored yard clusters using the already licensed CC0 Poly Haven scans.
// Metre scale, all submeshes and the original PBR channels are retained.
export function installRanchWorldDetails(G,{shrubs=[]}={}) {
  const {THREE,scene,world:W,horse:H}=G;
  const state=G.worldDetails={placed:[],skipped:[],errors:[],understory:0,flowers:0,grassClumps:0,flowerPositions:[],ready:null};
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
    if(W.pathDist(x,z)<r+1.7||(G.worldPaths?.trackDist(x,z)??Infinity)<r+1.7)return false;
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
          if(radius>0)W.colliders.push({x,z,r:radius,height:bounds.max.y-bounds.min.y});
          W.followCamera.register(root);
          state.placed.push({asset:name,x,z,r:radius});
        }
      } catch(e) {state.errors.push(name+': '+e.message);console.warn('Yard detail unavailable',name,e);}
    }
    for(const [name,parity,height] of [['shrub_03',0,.8],['shrub_04',1,.65],['fern_02',2,.48]]){
      const points=shrubs.filter((p,i)=>parity===2?i%4===0:i%2===parity)
        .map(p=>({...p,x:p.x+(parity===2?1.05:0),z:p.z+(parity===2?.85:0)}))
        .filter(p=>!G.villageCourts?.contains(p.x,p.z,1.8)&&!window.__chalkCut?.(p.x,p.z)&&W.pathDist(p.x,p.z)>2.5&&(G.worldPaths?.trackDist(p.x,p.z)??Infinity)>3.8&&!(window.__onCourse&&window.__onCourse(p.x,p.z,3.4)));
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
    // Small authored drifts frame the ranch, pasture approach and river trail.
    // Reuse the licensed scan already used by the builder. Keep every plant
    // outside paths, courses, building slots and solid scenery.
    try{
      const flower=await loader.loadAsync('./assets/models/world/builder/flower_gazania.glb');
      flower.scene.updateMatrixWorld(true);
      function plantVariants(root){
        root.updateMatrixWorld(true);
        const sources=[];root.traverse(o=>{if(o.isMesh)sources.push(o);});
        sources.sort((a,b)=>a.geometry.attributes.position.count-b.geometry.attributes.position.count);
        return sources.slice(0,4).map(source=>{
          const geo=source.geometry.clone().applyMatrix4(source.matrixWorld);geo.computeBoundingBox();
          const b=geo.boundingBox,h=Math.max(.01,b.max.y-b.min.y);
          const width=Math.max(b.max.x-b.min.x,b.max.z-b.min.z)/h;
          geo.translate(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2);geo.scale(1/h,1/h,1/h);
          const mat=source.material.clone();mat.roughness=1;mat.envMapIntensity=.55;mat.alphaToCoverage=true;
          for(const key of ['map','normalMap','roughnessMap'])if(mat[key])mat[key].anisotropy=Math.min(8,G.renderer.capabilities.getMaxAnisotropy());
          return {geo,mat,width};
        });
      }
      const variants=plantVariants(flower.scene);
      const gardenFlower=await loader.loadAsync('./assets/models/world/gardens/periwinkle_plant.glb');
      const gardenVariants=plantVariants(gardenFlower.scene);
      state.gardenAsset='periwinkle_plant';
      state.cottageGardens=0;state.townhouseGardens=0;
      const cottages=[];scene.traverse(o=>{if(['cottage','townhouse'].includes(o.userData.architecture?.kind))cottages.push(o);});
      for(const root of cottages){
        const boxes=root.userData.architecture.windowBoxes||[];
        if(!boxes.length)continue;
        const garden=new THREE.Group();garden.name='Cottage | living window boxes';
        const batches=gardenVariants.map(()=>[]),plant=new THREE.Object3D();
        for(const [index,box]of boxes.entries()){
          const floorPot=box.height>.3,count=floorPot?5:7;
          for(let i=0;i<count;i++){
            plant.position.set(box.x-box.width*.40+i*box.width*.80/(count-1),box.y,box.z+Math.sin(i*2.399)*.055);
            const variant=(i+index)%gardenVariants.length,maxWidth=floorPot?.36:.34;
            const height=(floorPot?.42:.32)+(i%3)*.035;
            const scale=Math.min(height,maxWidth/gardenVariants[variant].width);
            plant.scale.setScalar(scale);plant.rotation.y=i*2.399+index;plant.updateMatrix();
            batches[variant].push(plant.matrix.clone());
          }
        }
        // Four material batches per house, regardless of its number of flowers.
        for(const [i,matrices]of batches.entries()){
          if(!matrices.length)continue;
          const mesh=new THREE.InstancedMesh(gardenVariants[i].geo,gardenVariants[i].mat,matrices.length);
          matrices.forEach((matrix,j)=>mesh.setMatrixAt(j,matrix));mesh.instanceMatrix.needsUpdate=true;
          mesh.computeBoundingSphere();mesh.receiveShadow=true;mesh.castShadow=true;garden.add(mesh);
        }
        root.add(garden);if(root.userData.architecture.kind==='townhouse')state.townhouseGardens++;else state.cottageGardens++;
      }
      let seed=71839;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      const drifts=[[-35,25],[-46,7],[-49,-30],[-72,35],[-120,32],[8,78],[21,100],[42,128],[50,-60],[15,-34],[-33,-54]];
      const beds=new Map();
      for(const [cx,cz]of drifts)for(let i=0;i<38;i++){
        const a=rand()*Math.PI*2,r=Math.sqrt(rand())*5;
        const x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r*.65;
        if(!available(x,z,.16)||Math.abs(z-W.riverZ(x))<10||z<163&&Math.abs(x-W.streamX(z))<7)continue;
        const variant=i%variants.length,key=Math.floor(x/45)+','+Math.floor(z/45)+':'+variant;
        if(!beds.has(key))beds.set(key,{variant,points:[]});
        const point={x,z,y:W.groundH(x,z),height:.20+rand()*.22,yaw:rand()*Math.PI*2};
        beds.get(key).points.push(point);state.flowerPositions.push({x,z});
      }
      const matrix=new THREE.Matrix4(),v=new THREE.Vector3(),q=new THREE.Quaternion(),sc=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
      for(const {variant,points}of beds.values()){
        const {geo,mat}=variants[variant],mesh=new THREE.InstancedMesh(geo,mat,points.length);
        const cx=points.reduce((sum,p)=>sum+p.x,0)/points.length,cz=points.reduce((sum,p)=>sum+p.z,0)/points.length;
        mesh.name='Trail garden | gazania';mesh.position.set(cx,0,cz);mesh.receiveShadow=true;mesh.castShadow=false;
        points.forEach((p,i)=>{v.set(p.x-cx,p.y-.015,p.z-cz);sc.setScalar(p.height);q.setFromAxisAngle(up,p.yaw);matrix.compose(v,q,sc);mesh.setMatrixAt(i,matrix);});
        mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);patches.push(mesh);state.flowers+=points.length;
      }
    }catch(e){state.errors.push('trail flowers: '+e.message);console.warn('Trail flowers unavailable',e);}
    // Photographed tussocks break up the fine procedural sward at the garden
    // edges. A few dozen clumps near any rider, never a full-field scan carpet.
    try{
      const asset=await loader.loadAsync('./assets/models/world/grass_medium_02.glb');asset.scene.updateMatrixWorld(true);
      let source=null;asset.scene.traverse(o=>{if(o.isMesh&&!source)source=o;});
      const geo=source.geometry.clone().applyMatrix4(source.matrixWorld);geo.computeBoundingBox();
      const b=geo.boundingBox,h=b.max.y-b.min.y;geo.translate(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2);geo.scale(1/h,1/h,1/h);
      const mat=source.material.clone();mat.name='Trail edge | scanned meadow grass';mat.alphaToCoverage=true;mat.side=THREE.DoubleSide;mat.roughness=1;mat.envMapIntensity=.45;
      for(const key of ['map','normalMap','roughnessMap'])if(mat[key])mat[key].anisotropy=Math.min(8,G.renderer.capabilities.getMaxAnisotropy());
      mat.onBeforeCompile=sh=>{sh.uniforms.yardWind=wind;sh.vertexShader='uniform float yardWind;\n'+sh.vertexShader;
        sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
          #ifdef USE_INSTANCING
            float phase=instanceMatrix[3].x*.21+instanceMatrix[3].z*.17;
            transformed.x+=sin(yardWind*1.1+phase)*position.y*position.y*.08;
            transformed.z+=cos(yardWind*.8+phase)*position.y*.025;
          #endif`);};mat.customProgramCacheKey=()=> 'scanned-trail-grass-1';
      const cells=new Map();
      for(let i=0;i<state.flowerPositions.length;i+=3){const p=state.flowerPositions[i],x=p.x+.38,z=p.z-.32;if(!available(x,z,.35))continue;
        const key=Math.floor(x/30)+','+Math.floor(z/30);if(!cells.has(key))cells.set(key,[]);cells.get(key).push({x,z,i});}
      const matrix=new THREE.Matrix4(),v=new THREE.Vector3(),q=new THREE.Quaternion(),sc=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
      for(const points of cells.values()){
        const mesh=new THREE.InstancedMesh(geo,mat,points.length),cx=points.reduce((a,p)=>a+p.x,0)/points.length,cz=points.reduce((a,p)=>a+p.z,0)/points.length;
        mesh.name='Trail edge | meadow tussocks';mesh.position.set(cx,0,cz);mesh.receiveShadow=true;mesh.castShadow=false;
        points.forEach((p,i)=>{const size=.26+(p.i%7)*.017;v.set(p.x-cx,W.groundH(p.x,p.z)-.025,p.z-cz);sc.set(size,size,size);q.setFromAxisAngle(up,p.i*2.3999);matrix.compose(v,q,sc);mesh.setMatrixAt(i,matrix);});
        mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);patches.push(mesh);state.grassClumps+=points.length;
      }
    }catch(e){state.errors.push('meadow tussocks: '+e.message);}
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
