import {treeImpostor,patchFoliageCoverage} from './tree-impostors.js?v=foliage-coverage-1';
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
    if(G.vistas?.clearZones?.some(test=>test(x,z)))return false;
    if(W.sceneryArt.containsWaterfall(x,z,r))return false;
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
    // Thin needle cards receive light across a canopy, not like solid bark.
    mat.aoMapIntensity=.45;mat.normalScale.multiplyScalar(.55);
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
    mat.onBeforeCompile=(sh,activeRenderer)=>{
      deform(sh);
      sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec3 canopyUp=normalize(mat3(viewMatrix)*vec3(0.0,1.0,0.0));
        normal=normalize(mix(normal,canopyUp,.42));`);
      sh.fragmentShader=sh.fragmentShader.replace('#include <opaque_fragment>',`
        #if NUM_DIR_LIGHTS > 0
          float scanBack=pow(max(0.0,dot(-normal,directionalLights[0].direction)),2.0);
          outgoingLight+=diffuseColor.rgb*directionalLights[0].color*scanBack*.055;
        #endif
        #include <opaque_fragment>`);
      patchFoliageCoverage(sh,activeRenderer);
    };
    mat.customProgramCacheKey=()=> 'photoscan-foliage-v3';
    const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:mat.map,alphaTest:mat.alphaTest,side:THREE.DoubleSide});
    depth.onBeforeCompile=deform;depth.customProgramCacheKey=()=> 'photoscan-foliage-depth-v1';
    mat.userData.scanDepth=depth;
  }
  async function load(id){
    if(loaded.has(id))return loaded.get(id);
    const asset=await loader.loadAsync('./assets/models/world/realism/'+id+'.glb');
    asset.scene.updateMatrixWorld(true);
    const mats=new Set();asset.scene.traverse(o=>{if(o.isMesh)for(const mat of Array.isArray(o.material)?o.material:[o.material])mats.add(mat);});
    for(const mat of mats){
      // Match the mature crown to the daylight pasture exposure; bark stays raw.
      if(id==='pine_tree_01'&&/twig/.test(mat.name))mat.color.setRGB(1.7,2.1,1.5);
      configureMaterial(mat,/leaves|twig/.test(mat.name));
    }
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
    const catalog=await fetch('./assets/models/world/realism/tree-impostors.json?v=mature-woodland-1').then(r=>{if(!r.ok)throw Error('Tree view catalog unavailable');return r.json();});
    const broad=await load('tree_small_02'),pine=await load('fir_sapling_medium'),mature=await load('pine_tree_01');
    const specs=[['tree_small_02',-1,broad,'broadleaf'],
      ...pine.children.map((root,i)=>['fir_sapling_medium',i,root,'pine-'+i]),
      ['pine_tree_01',0,mature.children[0],'mature-pine']];
    const variants=specs.map(([id,variant,root,key])=>{
      const parts=pieces(root,variant>=0),bounds=new THREE.Box3();parts.forEach(p=>bounds.union(p.bounds));
      const meta=catalog.trees.find(t=>t.id===id&&t.variant===variant);
      if(!meta)throw Error('Missing tree view metadata: '+id);
      const triangles=parts.reduce((n,p)=>n+(p.geo.index?.count||p.geo.attributes.position.count)/3,0);
      return {parts,bounds,key,meta,triangles};
    });
    const sourceFor=t=>{
      if(!['pine','snowpine','cold'].includes(t.kind))return variants[0];
      return t.height>=6.2&&rnd(t.x,t.z,31)>.42?variants[4]:variants[1+Math.floor(rnd(t.x,t.z,17)*3)];
    };
    const add=t=>{
      const cleared=G.vistas?.clearZones?.some(test=>test(t.x,t.z));
      if(cleared){
        if(t.root)t.root.visible=false;else{t.stem.setMatrixAt(t.stemIndex??t.index,zero);t.leaves.setMatrixAt(t.index,zero);t.stem.instanceMatrix.needsUpdate=t.leaves.instanceMatrix.needsUpdate=true;}
        for(let i=W.colliders.length-1;i>=0;i--){const c=W.colliders[i];if((c.r<=1.1||c.height>3)&&Math.hypot(c.x-t.x,c.z-t.z)<.15)W.colliders.splice(i,1);}
        return;
      }
      if(t.root&&!t.root.visible)return;
      if(t.stem){const matrix=new THREE.Matrix4();t.stem.getMatrixAt(t.stemIndex??t.index,matrix);const a=matrix.elements;if(Math.hypot(a[0],a[1],a[2])<.01)return;}
      t.source=sourceFor(t);trees.push(t);
    };
    // Respect cleared placements in both the original seed batches and new landmark zones.
    const seedMatrix=new THREE.Matrix4();
    for(const stem of seedTrees.filter(o=>o.userData.treeLayer==='wood'&&['oak','birch','pine','snowpine'].includes(o.userData.treeSpecies))){
      const leaves=seedTrees.find(o=>o.userData.treeLayer==='leaves'&&o.userData.treePoints===stem.userData.treePoints);
      if(!leaves)continue;
      const kind=stem.userData.treeSpecies,height=kind==='pine'?7.4:kind==='snowpine'?7.2:6.2;
      stem.userData.treePoints.forEach((p,i)=>{
        stem.getMatrixAt(i,seedMatrix);if(seedMatrix.determinant()===0)return;
        leaves.getMatrixAt(i,seedMatrix);if(seedMatrix.determinant()===0)return;
        add({x:p.x,z:p.z,height:height*p.s,yaw:p.r,stem,leaves,index:i,kind});
      });
    }
    const banks=G.floraPkg?.bank,stems=new Map(),floraCanopies=[];
    if(banks?.trunk){
      const matrix=new THREE.Matrix4(),pos=new THREE.Vector3(),rot=new THREE.Quaternion(),scale=new THREE.Vector3(),key=p=>p.x.toFixed(3)+','+p.z.toFixed(3);
      for(let i=0;i<banks.trunk.n;i++){banks.trunk.im.getMatrixAt(i,matrix);pos.setFromMatrixPosition(matrix);stems.set(key(pos),i);}
      for(const kind of ['oak','birch','pine','cold']){
        const bank=banks[kind];if(!bank)continue;floraCanopies.push(bank.im);
        for(let i=0;i<bank.n;i++){
          bank.im.getMatrixAt(i,matrix);matrix.decompose(pos,rot,scale);
          const stemIndex=stems.get(key(pos));if(stemIndex===undefined)continue;
          const amber=Math.hypot(pos.x-300,pos.z+300)<145&&kind!=='pine'&&kind!=='cold';
          add({x:pos.x,z:pos.z,height:scale.y,yaw:new THREE.Euler().setFromQuaternion(rot).y,kind,
            stem:banks.trunk.im,stemIndex,leaves:bank.im,index:i,tint:amber?new THREE.Color('#d9a568'):WHITE});
        }
      }
    }
    const natural=[];scene.traverse(o=>{if(['Natural oak tree','Natural birch tree','Natural pine pine','Natural snowpine pine'].includes(o.name)&&o.parent===scene)natural.push(o);});
    for(const original of natural){if(!original.visible)continue;const b=new THREE.Box3().setFromObject(original);if(b.isEmpty())continue;
      add({x:original.position.x,z:original.position.z,height:b.max.y-b.min.y,yaw:original.rotation.y,root:original,kind:original.name.includes('pine')?'pine':'oak'});
    }
    const textureLoader=new THREE.TextureLoader();
    // Load all views before hiding any original tree. Missing data leaves the
    // existing forest intact, instead of empty silhouettes during a slow load.
    for(const source of variants){
      const m=source.meta;
      const [atlas,normals]=await Promise.all([textureLoader.loadAsync('./assets/models/world/realism/'+m.views.file+'?v=world-cinematic-1'),textureLoader.loadAsync('./assets/models/world/realism/'+m.normals.file)]);
      atlas.colorSpace=THREE.SRGBColorSpace;atlas.anisotropy=8;normals.colorSpace=THREE.NoColorSpace;normals.anisotropy=4;
      source.impostor={THREE,albedo:atlas,normals,width:m.width,height:m.height,bottom:m.bottom};
      source.card=treeImpostor(source.impostor);
    }
    for(const t of trees){
      const scale=t.height/t.source.meta.sourceHeight;
      q.setFromAxisAngle(UP,t.yaw);s.setScalar(scale);
      v.set(t.x,W.groundH(t.x,t.z)-t.source.bounds.min.y*scale-.07,t.z);
      t.matrix=new THREE.Matrix4().compose(v,q,s);
    }
    const cells=new Map();for(const t of trees){const key=t.source.key+':'+Math.floor(t.x/65)+','+Math.floor(t.z/65);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(t);}
    for(const records of cells.values()){
      const source=records[0].source;
      const card=instances(source.card,records.map(t=>t.matrix),'Scanned distant tree views | '+source.key);
      records.forEach((t,i)=>card.setColorAt(i,t.tint||WHITE));treeCards.push({mesh:card,records});
      for(const p of source.parts){
        const mesh=instances(p,records.map(()=>zero),'Photoscan '+source.key+' | '+p.name);
        records.forEach((t,i)=>mesh.setColorAt(i,/leaves|twig/.test(p.mat.name)&&t.tint?t.tint:WHITE));
        mesh.count=0;treeMeshes.push({mesh,records});
      }
    }
    for(const t of trees){if(t.root)t.root.visible=false;else{
      t.stem.setMatrixAt(t.stemIndex??t.index,zero);t.leaves.setMatrixAt(t.index,zero);t.stem.instanceMatrix.needsUpdate=t.leaves.instanceMatrix.needsUpdate=true;
    }}
    // A zero-scale instance still runs every vertex and shadow vertex shader.
    // These seed batches are wholly replaced; stop submitting their old meshes.
    const retired=new Set();
    for(const t of trees)if(t.stem?.userData.treePoints){retired.add(t.stem);retired.add(t.leaves);}
    for(const mesh of retired){mesh.visible=false;mesh.userData.photoscanReplaced=true;}
    state.retiredBatches=retired.size;
    floraCanopies.forEach(m=>{m.visible=false;});
    state.trees=trees.length;state.conifers=trees.filter(t=>t.source!==variants[0]).length;state.normalMappedViews=variants.length;state.matureTrees=trees.filter(t=>t.source.key==='mature-pine').length;
    state.treePositions=trees.map(t=>({x:t.x,z:t.z,height:t.height,kind:t.kind,source:t.source.key}));
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
    // The travelling ground-cover layer used an untextured low-poly sphere.
    // This small scan LOD costs about the same but retains real weathered UVs.
    if(W.nearGroundCover?.rock){
      try{
        const response=await fetch('./assets/models/world/realism/ground-stone.json');
        if(!response.ok)throw Error('Ground stone LOD unavailable');
        const data=await response.json(),geo=new THREE.BufferGeometry();
        for(const [key,name,size]of [['POSITION','position',3],['NORMAL','normal',3],['TEXCOORD_0','uv',2]])
          geo.setAttribute(name,new THREE.Float32BufferAttribute(data.attributes[key],size));
        geo.setIndex(data.index);geo.applyMatrix4(new THREE.Matrix4().fromArray(data.matrix));geo.computeBoundingBox();
        const b=geo.boundingBox,size=b.getSize(new THREE.Vector3()),scale=1/Math.max(size.x,size.z);
        geo.translate(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2);geo.scale(scale,scale,scale);geo.translate(0,-.08,0);
        geo.computeBoundingSphere();const layer=W.nearGroundCover.rock;layer.geometry.dispose();layer.geometry=geo;
        const mat=parts[0].mat.clone();mat.name='Ground cover | scanned moss stone';
        mat.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`
          #if defined(USE_COLOR) || defined(USE_INSTANCING_COLOR)
            diffuseColor.rgb*=clamp(vColor*1.5+.35,vec3(.75),vec3(1.1));
          #endif`);};
        mat.customProgramCacheKey=()=> 'ground-stone-scan-v1';layer.material.dispose();layer.material=mat;
        layer.name='Scanned ground stones';state.groundStoneTriangles=data.index.length/3;
      }catch(e){state.errors.push('ground stone: '+e.message);}
    }
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
  let previousSelection=new Set(),previousMode=null;
  function updateTrees(){
    if(!treeMeshes.length)return;
    const p=H.player.pos,tier=G.gfx.get(),enabled=tier!=='low'&&!renderer.xr.isPresenting;
    const range=tier==='high'?58:40,budget=tier==='high'?12:6;
    // Keep an incumbent until a new tree is appreciably closer. Nearest-N
    // alone alternates equally distant trees at every scenery tick while riding.
    const distance=t=>(t.x-p.x)**2+(t.z-p.z)**2;
    const candidates=enabled?trees.filter(t=>distance(t)<(range+(previousSelection.has(t)?5:0))**2)
      .sort((a,b)=>distance(a)*(previousSelection.has(a)?.72:1)-distance(b)*(previousSelection.has(b)?.72:1)):[];
    // The fuller mature canopy shares a fixed geometry budget with the nearby
    // saplings, so asset quality cannot silently multiply the phone workload.
    const selected=[],triangleBudget=tier==='high'?1800000:750000;let triangles=0;
    for(const t of candidates){
      if(selected.length>=budget)break;
      if(triangles+t.source.triangles>triangleBudget)continue;
      selected.push(t);triangles+=t.source.triangles;
    }
    state.activeTreeTriangles=triangles;state.treeTriangleBudget=triangleBudget;
    const set=new Set(selected);
    const mode=tier+':'+renderer.xr.isPresenting,tierChanged=previousMode!==mode;
    if(!tierChanged&&set.size===previousSelection.size&&selected.every(t=>previousSelection.has(t)))return;
    const changed=records=>tierChanged||records.some(t=>set.has(t)!==previousSelection.has(t));
    for(const {mesh,records} of treeMeshes){
      if(!changed(records))continue;
      let count=0;for(const t of records)if(set.has(t)){
        mesh.setMatrixAt(count,t.matrix);mesh.setColorAt(count,/leaves|twig/.test(mesh.material.name)&&t.tint?t.tint:WHITE);count++;
      }
      mesh.count=count;mesh.visible=count>0;
      mesh.instanceMatrix.needsUpdate=mesh.instanceColor.needsUpdate=true;mesh.castShadow=tier==='high';
      if(count)mesh.computeBoundingSphere();
    }
    for(const {mesh,records} of treeCards){
      if(!changed(records))continue;
      let count=0;for(const t of records)if(!set.has(t)){mesh.setMatrixAt(count,t.matrix);mesh.setColorAt(count,t.tint||WHITE);count++;}
      mesh.count=count;mesh.visible=count>0;mesh.castShadow=tier==='high'&&!renderer.xr.isPresenting;mesh.instanceMatrix.needsUpdate=mesh.instanceColor.needsUpdate=true;
      if(count)mesh.computeBoundingSphere();
    }
    previousSelection=set;previousMode=mode;
    state.detailRebuilds=(state.detailRebuilds||0)+1;
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
