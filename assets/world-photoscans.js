import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries,deinterleaveGeometry} from 'three/addons/utils/BufferGeometryUtils.js';

// Real, CC0 Poly Haven assets. The generated world stays available until each
// replacement has loaded; detailed crowns are budgeted around the rider.
export function installWorldPhotoscans(G,{seedTrees=[],rocks=[],pinePoints=[]}={}) {
  const {THREE,scene,world:W,horse:H,renderer}=G;
  const state=G.photoscans={ready:null,errors:[],assets:[],trees:0,activeTrees:0,rocks:0,outcrops:0,saplings:0,logs:0,cliffs:0};
  const loader=new GLTFLoader(),wind={value:0},group=new THREE.Group();
  group.name='Poly Haven environment';scene.add(group);
  const loaded=new Map(),trees=[],detailPatches=[];
  const zero=new THREE.Matrix4().makeScale(0,0,0),UP=new THREE.Vector3(0,1,0),WHITE=new THREE.Color(0xffffff);
  const q=new THREE.Quaternion(),v=new THREE.Vector3(),s=new THREE.Vector3();
  const rnd=(x,z,k=0)=>{const n=Math.sin(x*127.1+z*311.7+k*74.7)*43758.5453;return n-Math.floor(n);};
  const protectedPoints=[...Object.values(W.things||{}),...Object.values(W.mapMarkers||{}),...Object.values(W.FORAGE_SPOTS||{})].filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.z));
  const routes=Object.values(G.tables.RACE_ROUTES).filter(Array.isArray);
  function segmentDistance(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
  function clear(x,z,r=1){
    if(Math.hypot(x,z)<33||W.pathDist(x,z)<r+3)return false;
    if(Math.abs(z-W.riverZ(x))<r+10||z<163&&Math.abs(x-W.streamX(z))<r+8)return false;
    if(Math.hypot(x-20,z-16)<r+19)return false;
    if(protectedPoints.some(p=>Math.hypot(x-p.x,z-p.z)<r+(p.reach||3)+2))return false;
    if(W.colliders.some(p=>Math.hypot(x-p.x,z-p.z)<r+(p.r||0)+.3))return false;
    for(const route of routes)for(let i=0;i<route.length;i++)if(segmentDistance(x,z,route[i],route[(i+1)%route.length])<r+5)return false;
    return Math.abs(W.groundH(x+r,z)-W.groundH(x-r,z))<r*.40&&Math.abs(W.groundH(x,z+r)-W.groundH(x,z-r))<r*.40;
  }
  function configureMaterial(mat,foliage=false){
    mat.envMapIntensity=foliage?.48:.68;
    for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])if(mat[key])mat[key].anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    if(!foliage)return;
    mat.alphaToCoverage=true;mat.side=THREE.DoubleSide;mat.shadowSide=THREE.DoubleSide;
    const deform=sh=>{
      sh.uniforms.scanWind=wind;
      sh.vertexShader='uniform float scanWind;\n'+sh.vertexShader;
      sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        #ifdef USE_INSTANCING
          float scanPhase=instanceMatrix[3].x*.17+instanceMatrix[3].z*.23;
          float scanTip=max(0.0,position.y);
          transformed.x+=sin(scanWind*.85+scanPhase+position.y*.4)*scanTip*.006;
          transformed.z+=sin(scanWind*1.1+scanPhase)*scanTip*.004;
        #endif`);
    };
    mat.onBeforeCompile=sh=>{
      deform(sh);
      sh.fragmentShader=sh.fragmentShader.replace('#include <opaque_fragment>',`
        #if NUM_DIR_LIGHTS > 0
          float scanBack=pow(max(0.0,dot(-normal,directionalLights[0].direction)),2.0);
          outgoingLight+=diffuseColor.rgb*directionalLights[0].color*scanBack*.055;
        #endif
        #include <opaque_fragment>`);
    };
    mat.customProgramCacheKey=()=> 'photoscan-foliage-v1';
    const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:mat.map,alphaTest:mat.alphaTest,side:THREE.DoubleSide});
    depth.onBeforeCompile=deform;depth.customProgramCacheKey=()=> 'photoscan-foliage-depth-v1';
    mat.userData.scanDepth=depth;
  }
  async function load(id){
    if(loaded.has(id))return loaded.get(id);
    const asset=await loader.loadAsync('./assets/models/world/realism/'+id+'.glb');
    asset.scene.updateMatrixWorld(true);
    const mats=new Set();asset.scene.traverse(o=>{if(o.isMesh)for(const mat of Array.isArray(o.material)?o.material:[o.material])mats.add(mat);});
    for(const mat of mats)configureMaterial(mat,/leaves|twig/.test(mat.name));
    loaded.set(id,asset.scene);state.assets.push(id);return asset.scene;
  }
  // Collection nodes have gallery translations. Bake rotation/scale, retaining
  // their authored local origin rather than the source file's contact-sheet grid.
  function pieces(root,collection=false){
    const result=[];
    root.traverse(o=>{
      if(!o.isMesh)return;
      const geo=o.geometry.clone(),matrix=o.matrixWorld.clone();
      deinterleaveGeometry(geo);
      if(collection)matrix.setPosition(0,0,0);
      geo.applyMatrix4(matrix);geo.computeBoundingBox();geo.computeBoundingSphere();
      result.push({geo,mat:o.material,name:o.name,bounds:geo.boundingBox.clone()});
    });
    return result;
  }
  function instances(piece,points,label){
    const mesh=new THREE.InstancedMesh(piece.geo,piece.mat,points.length);
    mesh.name=label;mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.customDepthMaterial=piece.mat.userData.scanDepth;
    for(let i=0;i<points.length;i++)mesh.setMatrixAt(i,points[i]);
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);return mesh;
  }
  function placement(piece,x,z,scale,yaw=0,sink=.04){
    q.setFromAxisAngle(UP,yaw);s.setScalar(scale);
    v.set(x,W.groundH(x,z)-piece.bounds.min.y*scale-sink,z);
    return new THREE.Matrix4().compose(v,q,s);
  }
  function patch(mesh,x,z,range=150){detailPatches.push({mesh,x,z,range});}
  let treeMeshes=[],treeCards=[];
  async function installTrees(){
    const root=await load('tree_small_02'),parts=pieces(root),bounds=new THREE.Box3().setFromObject(root);
    const sourceHeight=bounds.max.y-bounds.min.y;
    // Pair the original instanced trunk/crown before replacing both together.
    for(const stem of seedTrees.filter(o=>o.userData.treeLayer==='wood'&&['oak','birch'].includes(o.userData.treeSpecies))){
      const leaves=seedTrees.find(o=>o.userData.treeLayer==='leaves'&&o.userData.treePoints===stem.userData.treePoints);
      if(!leaves)continue;
      stem.userData.treePoints.forEach((p,i)=>{
        trees.push({x:p.x,z:p.z,height:6.2*p.s,yaw:p.r,stem,leaves,index:i});
      });
    }
    // The biome package also plants broadleaf copses. Replace their simple
    // forked trunks as well, matching trunk/crown instances by world position.
    const banks=G.floraPkg?.bank,stems=new Map(),floraCanopies=[];
    if(banks?.trunk){
      const matrix=new THREE.Matrix4(),pos=new THREE.Vector3(),rot=new THREE.Quaternion(),scale=new THREE.Vector3();
      const key=p=>p.x.toFixed(3)+','+p.z.toFixed(3);
      for(let i=0;i<banks.trunk.n;i++){banks.trunk.im.getMatrixAt(i,matrix);pos.setFromMatrixPosition(matrix);stems.set(key(pos),i);}
      for(const kind of ['oak','birch']){
        const bank=banks[kind];if(!bank)continue;floraCanopies.push(bank.im);
        for(let i=0;i<bank.n;i++){
          bank.im.getMatrixAt(i,matrix);matrix.decompose(pos,rot,scale);
          const stemIndex=stems.get(key(pos));if(stemIndex===undefined)continue;
          const amber=Math.hypot(pos.x-300,pos.z+300)<145;
          trees.push({x:pos.x,z:pos.z,height:scale.y,yaw:new THREE.Euler().setFromQuaternion(rot).y,
            stem:banks.trunk.im,stemIndex,leaves:bank.im,index:i,
            tint:amber?new THREE.Color('#d9a568'):new THREE.Color(0xffffff)});
        }
      }
    }
    // Close, individually authored broadleaf trees also gain the new crown.
    const natural=[];scene.traverse(o=>{if(['Natural oak tree','Natural birch tree'].includes(o.name)&&o.parent===scene)natural.push(o);});
    for(const original of natural){
      const b=new THREE.Box3().setFromObject(original);if(b.isEmpty())continue;
      trees.push({x:original.position.x,z:original.position.z,height:b.max.y-b.min.y,yaw:original.rotation.y,root:original});
    }
    for(const t of trees){
      const scale=t.height/sourceHeight;
      q.setFromAxisAngle(UP,t.yaw);s.setScalar(scale);
      v.set(t.x,W.groundH(t.x,t.z)-bounds.min.y*scale-.07,t.z);
      t.matrix=new THREE.Matrix4().compose(v,q,s);
    }
    const cells=new Map();
    for(const t of trees){const key=Math.floor(t.x/55)+','+Math.floor(t.z/55);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(t);}
    const atlas=await new THREE.TextureLoader().loadAsync('./assets/models/world/realism/tree_small_02_views.webp');
    atlas.colorSpace=THREE.SRGBColorSpace;atlas.anisotropy=4;
    const cardGeo=new THREE.PlaneGeometry(6,5);cardGeo.translate(0,2.3,0);
    // Predominantly upward botanical normals keep distant crowns from changing
    // brightness just because the camera turns. The game still lights them.
    const normals=cardGeo.getAttribute('normal');for(let i=0;i<normals.count;i++)normals.setXYZ(i,0,.94,.34);
    const cardMat=new THREE.MeshStandardMaterial({map:atlas,alphaTest:.28,side:THREE.DoubleSide,roughness:1,envMapIntensity:.48});
    cardMat.alphaToCoverage=true;
    cardMat.onBeforeCompile=sh=>{
      sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 toEye=cameraPosition-instanceMatrix[3].xyz;
          float eyeAngle=atan(toEye.x,toEye.z);
          float treeAngle=atan(instanceMatrix[2].x,instanceMatrix[2].z);
          float localAngle=eyeAngle-treeAngle;
          float frame=mod(floor((localAngle+6.2831853+.3926991)/.7853982),8.0);
          transformed.x=position.x*cos(localAngle);
          transformed.z=-position.x*sin(localAngle);
          vMapUv=(uv+vec2(mod(frame,4.0),1.0-floor(frame/4.0)))/vec2(4.0,2.0);
        #endif`);
    };
    cardMat.customProgramCacheKey=()=> 'scanned-tree-eight-views-v1';
    for(const records of cells.values()){
      const mesh=instances({geo:cardGeo,mat:cardMat},records.map(t=>t.matrix),'Scanned distant tree views');
      records.forEach((t,i)=>mesh.setColorAt(i,t.tint||new THREE.Color(0xffffff)));
      mesh.castShadow=false;treeCards.push({mesh,records});
    }
    // The distant views use this same tree, so both LODs share their silhouette.
    // Original procedural meshes remain available until the atlas has loaded.
    for(const t of trees){
      if(t.root)t.root.visible=false;
      else{
        t.stem.setMatrixAt(t.stemIndex??t.index,zero);t.leaves.setMatrixAt(t.index,zero);
        t.stem.instanceMatrix.needsUpdate=t.leaves.instanceMatrix.needsUpdate=true;
      }
    }
    floraCanopies.forEach(m=>{m.visible=false;});
    // Separate spatial batches allow Three to reject crowns behind the camera
    // and outside the shadow frustum instead of drawing every nearby tree.
    for(const records of cells.values())for(const p of parts){
      const mesh=instances(p,records.map(()=>zero),'Photoscan broadleaf | '+p.name);
      records.forEach((t,i)=>mesh.setColorAt(i,/leaves/.test(p.mat.name)&&t.tint?t.tint:new THREE.Color(0xffffff)));
      mesh.count=0;treeMeshes.push({mesh,records});
    }
    state.trees=trees.length;
    state.treePositions=trees.map(t=>({x:t.x,z:t.z,height:t.height}));
  }
  async function installRocks(){
    const parts=pieces(await load('rock_moss_set_01'),true);
    rocks.forEach((rock,i)=>{
      const piece=parts[i%parts.length],p=rock.userData.scanPlacement;
      if(!p)return;
      const old=rock.geometry,geo=piece.geo.clone();
      // Keep existing position, orientation and collision footprint.
      const size=piece.bounds.getSize(new THREE.Vector3()),scale=(p.s*1.8)/Math.max(size.x,size.z);
      geo.translate(-(piece.bounds.min.x+piece.bounds.max.x)/2,-piece.bounds.min.y,-(piece.bounds.min.z+piece.bounds.max.z)/2);
      geo.scale(scale,scale,scale);geo.translate(0,-.10,0);
      rock.geometry=geo;rock.material=piece.mat;rock.name='Scanned mossy boulder';old.dispose();state.rocks++;
    });
    // Replace each already-sited outcrop in place, preserving its collider and
    // climbable mesh reference. Six scans give natural asymmetry within the heap.
    for(const [i,at] of (G.worldOutcrops?.placed||[]).entries()){
      const mesh=G.worldOutcrops.group.children[i];if(!mesh?.isMesh)continue;
      const geos=[];
      for(let j=0;j<5;j++){
        const piece=parts[(i+j)%parts.length],geo=piece.geo.clone(),b=piece.bounds;
        const a=j*2.39996+i*.7,d=j===0?0:at.r*.65,size=b.getSize(new THREE.Vector3());
        const scale=(j===0?at.r*1.4:at.r*.85)/Math.max(size.x,size.z);
        geo.translate(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2);
        geo.scale(scale,scale*(j===0?1.25:1),scale);geo.rotateY(a);
        const x=Math.cos(a)*d,z=Math.sin(a)*d;
        geo.translate(x,W.groundH(at.x+x,at.z+z)-mesh.position.y-.14,z);geos.push(geo);
      }
      const merged=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());
      if(merged){mesh.geometry.dispose();mesh.geometry=merged;mesh.material=parts[0].mat;mesh.name='Outcrop | scanned mossy stone';state.outcrops++;}
    }
  }
  async function installForestFloor(){
    const root=await load('pine_sapling_small');
    // Each collection child is a complete sapling, with both bark and needles.
    for(let variant=0;variant<root.children.length;variant++){
      const child=root.children[variant],parts=pieces(child,true),bounds=new THREE.Box3();parts.forEach(p=>bounds.union(p.bounds));
      const cells=new Map();let count=0;
      for(let i=variant;i<pinePoints.length;i+=3){
        const p=pinePoints[i],x=p.x+2.8+2*rnd(p.x,p.z),z=p.z-3.4+2*rnd(p.x,p.z,1);
        if(!clear(x,z,.65))continue;
        const scale=(.75+rnd(x,z)*.85)/(bounds.max.y-bounds.min.y);
        const key=Math.floor(x/45)+','+Math.floor(z/45);
        if(!cells.has(key))cells.set(key,{x:Math.floor(x/45)*45+22.5,z:Math.floor(z/45)*45+22.5,points:[]});
        cells.get(key).points.push(placement({bounds},x,z,scale,rnd(x,z,2)*Math.PI*2));count++;
      }
      for(const cell of cells.values())for(const p of parts){
        const mesh=instances(p,cell.points,'Photoscan pine saplings');mesh.castShadow=false;
        patch(mesh,cell.x,cell.z,95);mesh.userData.groundPlant=true;
      }
      state.saplings+=count;
    }
    const log=pieces(await load('dead_tree_trunk_02'))[0];
    let placed=0;
    for(const p of W.forestPoints){
      if(placed>=32)break;
      if(Math.hypot(p.x,p.z)>260||rnd(p.x,p.z,2)>.45)continue;
      const x=p.x+4.5,z=p.z+3.1;if(!clear(x,z,2.4))continue;
      const scale=.48+rnd(x,z)*.25,mat=placement(log,x,z,scale,rnd(x,z,5)*Math.PI*2,.10);
      const mesh=instances(log,[mat],'Photoscan fallen timber');patch(mesh,x,z);
      W.colliders.push({x,z,r:1.25});placed++;
    }
    state.logs=placed;
  }
  async function installRockFaces(){
    for(const [id,stride] of [['rock_face_02',3],['namaqualand_cliff_02',4]]){
      const piece=pieces(await load(id))[0],size=piece.bounds.getSize(new THREE.Vector3());
      for(const [i,at] of (G.worldOutcrops?.placed||[]).entries()){
        if(i%stride!==0)continue;
        // The center lies inside the existing solid outcrop, never across a trail.
        const scale=at.r*(id==='rock_face_02'?1.2:1.8)/Math.max(size.x,size.z);
        const matrix=placement(piece,at.x,at.z,scale,rnd(at.x,at.z,8)*Math.PI*2,size.y*scale*.48);
        // Center the scan horizontally; its source origin need not be its center.
        matrix.multiply(new THREE.Matrix4().makeTranslation(-(piece.bounds.min.x+piece.bounds.max.x)/2,0,-(piece.bounds.min.z+piece.bounds.max.z)/2));
        const mesh=instances(piece,[matrix],'Photoscan weathered rock face');patch(mesh,at.x,at.z,240);state.cliffs++;
        W.climbables.push({mesh,x:at.x,z:at.z,r:at.r*1.95,y:W.groundH(at.x,at.z),kind:'outcrop'});
      }
    }
  }
  function updateTrees(){
    if(!treeMeshes.length)return;
    const p=H.player.pos,tier=G.gfx.get(),enabled=tier!=='low'&&!renderer.xr.isPresenting;
    const range=tier==='high'?58:40,budget=tier==='high'?12:6;
    const selected=enabled?trees.filter(t=>Math.hypot(t.x-p.x,t.z-p.z)<range).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z)).slice(0,budget):[];
    const set=new Set(selected);
    for(const {mesh,records} of treeMeshes){
      let count=0;for(const t of records)if(set.has(t)){
        mesh.setMatrixAt(count,t.matrix);mesh.setColorAt(count,/leaves/.test(mesh.material.name)&&t.tint?t.tint:WHITE);count++;
      }
      mesh.count=count;mesh.visible=count>0;
      mesh.instanceMatrix.needsUpdate=mesh.instanceColor.needsUpdate=true;mesh.castShadow=tier==='high';
      if(count)mesh.computeBoundingSphere();
    }
    for(const {mesh,records} of treeCards){
      let count=0;for(const t of records)if(!set.has(t)){mesh.setMatrixAt(count,t.matrix);mesh.setColorAt(count,t.tint||WHITE);count++;}
      mesh.count=count;mesh.visible=count>0;mesh.instanceMatrix.needsUpdate=mesh.instanceColor.needsUpdate=true;
      if(count)mesh.computeBoundingSphere();
    }
    state.activeTrees=selected.length;
    state.distantTrees=trees.length-selected.length;
  }
  state.ready=(async()=>{
    for(let i=0;i<120&&!H.RIG()?.ready;i++)await new Promise(ok=>setTimeout(ok,250));
    for(const install of [installRocks,installTrees,installForestFloor,installRockFaces]){
      try{await install();}catch(e){state.errors.push(e.message);console.warn('World scan unavailable:',e);}
    }
    updateTrees();return state.assets;
  })();
  let timer=0;
  G.on('tick',(dt,t)=>{
    wind.value=t;timer+=dt;if(timer<.35)return;timer=0;
    updateTrees();const p=H.player.pos,tier=G.gfx.get();
    for(const d of detailPatches){d.mesh.visible=Math.hypot(d.x-p.x,d.z-p.z)<d.range*(tier==='low'?.6:1);d.mesh.castShadow=tier==='high'&&!d.mesh.userData.groundPlant;}
  });
  state.update=updateTrees;
}
