import {OASIS_FACE} from './canyon-landscape.js?v=countryside-banks-1';
import {patchOuterFog} from './outer-landscape.js?v=continuous-countryside-1';
import {installThunderOak} from './thunder-oak-art.js?v=split-oak-1';
import {installWillowArt} from './willow-art.js?v=weeping-willows-1';
import {installDeadwoodArt} from './deadwood-art.js?v=weathered-deadwood-1';
import {createOrchardFruit} from './orchard-art.js?v=leafy-orchard-1';
import {installVillageEvergreens} from './village-planting.js?v=village-gardens-1';
import {prepareCanopyShade,patchCanopyShade} from './canopy-shading.js?v=canopy-depth-1';
import {MATURE_LEAF_ALIAS,createMatureLeafGeometry} from './mature-leaf-patches.mjs?v=mature-leaf-patches-1';
import {COTTONWOOD_TREES} from './cottonwood-layout.js?v=village-gardens-1';
import {alpineSnowAt,fallsContainsWater} from './falls-landscape.js?v=alpine-range-1';
import {coldWoodlandWeights,coldWoodlandProfile} from './cold-woodland.mjs?v=cold-woodland-1';
import {oasisContainsWater} from './oasis-art.js?v=living-oasis-1';
import {inMeadowOpening} from './pastoral-fields.mjs?v=leafy-orchard-1';
import {treeImpostor,patchFoliageCoverage,patchSeasonalFoliage,enableOpaqueFoliageCoverage} from './tree-impostors.js?v=canopy-lighting-1';
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
    if(inMeadowOpening(x,z)||fallsContainsWater(x,z,r+1.5))return false;
    if(G.vistas?.clearZones?.some(test=>test(x,z)))return false;
    if(G.quartersPkg?.willowmereArt?.excludesPlants(x,z))return false;
    if(W.sceneryArt.containsWaterfall(x,z,r))return false;
    if(Math.hypot(x,z)<33||W.pathDist(x,z)<r+3||(G.worldPaths?.trackDist(x,z)??Infinity)<r+3)return false;
    if(Math.abs(z-W.riverZ(x))<r+10||z<163&&Math.abs(x-W.streamX(z))<r+8)return false;
    if(Math.hypot(x-20,z-16)<r+19||oasisContainsWater(x,z,r+.7))return false;
    if(protectedPoints.some(p=>Math.hypot(x-p.x,z-p.z)<r+(p.reach||3)+2))return false;
    if(W.colliders.some(p=>Math.hypot(x-p.x,z-p.z)<r+(p.r||0)+.3))return false;
    for(const route of routes)for(let i=0;i<route.length;i++)if(segmentDistance(x,z,route[i],route[(i+1)%route.length])<r+5)return false;
    return Math.abs(W.groundH(x+r,z)-W.groundH(x-r,z))<r*.40&&Math.abs(W.groundH(x,z+r)-W.groundH(x,z-r))<r*.40;
  }
  function configureMaterial(mat,foliage=false){
    mat.envMapIntensity=foliage?.48:.68;
    for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])if(mat[key])mat[key].anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    if(!foliage)return;
    enableOpaqueFoliageCoverage(THREE,mat);mat.side=THREE.DoubleSide;mat.shadowSide=THREE.DoubleSide;
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
      deform(sh);patchSeasonalFoliage(sh);if(mat.userData.hasCanopyShade)patchCanopyShade(sh);
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
    mat.customProgramCacheKey=()=> 'photoscan-seasonal-foliage-v5-'+!!mat.userData.hasCanopyShade;
    const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:mat.map,alphaTest:mat.alphaTest,side:THREE.DoubleSide});
    depth.onBeforeCompile=deform;depth.customProgramCacheKey=()=> 'photoscan-foliage-depth-v1';
    mat.userData.scanDepth=depth;
  }
  async function load(id){
    if(loaded.has(id))return loaded.get(id);
    const asset=await loader.loadAsync('./assets/models/world/realism/'+id+'.glb');
    asset.scene.updateMatrixWorld(true);
    const canopyStarted=performance.now(),canopyShade=prepareCanopyShade(THREE,asset.scene);
    if(canopyShade)(state.canopyShading??={})[id]={...canopyShade,prepareMs:performance.now()-canopyStarted};
    const mats=new Set();asset.scene.traverse(o=>{if(o.isMesh)for(const mat of Array.isArray(o.material)?o.material:[o.material])mats.add(mat);});
    for(const mat of mats){
      // Match the mature crown to the daylight pasture exposure; bark stays raw.
      if(id==='pine_tree_01'&&/twig/.test(mat.name))mat.color.setRGB(1.7,2.1,1.5);
      mat.userData.hasCanopyShade=!!canopyShade&&/leaves/.test(mat.name);
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
    const catalog=await fetch('./assets/models/world/realism/tree-impostors.json?v=tree-atlas-framing-1').then(r=>{if(!r.ok)throw Error('Tree view catalog unavailable');return r.json();});
    const broad=await load('tree_small_02'),pine=await load('fir_sapling_medium'),mature=await load('pine_tree_01'),leafy=await load('island_tree_01'),woodland=await load('jacaranda_tree');
    const specs=[['tree_small_02',-1,broad,'broadleaf'],
      ...pine.children.map((root,i)=>['fir_sapling_medium',i,root,'pine-'+i]),
      ['pine_tree_01',0,mature.children[0],'mature-pine'],
      ['island_tree_01',-1,leafy,'canopy-broadleaf'],
      ['jacaranda_tree',-1,woodland,'woodland-broadleaf']];
    const variants=specs.map(([id,variant,root,key])=>{
      const parts=pieces(root,variant>=0),bounds=new THREE.Box3();parts.forEach(p=>bounds.union(p.bounds));
      const meta=catalog.trees.find(t=>t.id===id&&t.variant===variant);
      if(!meta)throw Error('Missing tree view metadata: '+id);
      const triangles=parts.reduce((n,p)=>n+(p.geo.index?.count||p.geo.attributes.position.count)/3,0);
      return {parts,bounds,key,meta,triangles};
    });
    const island=variants.find(v=>v.key==='canopy-broadleaf');
    const fruit=createOrchardFruit({THREE,branchGeometry:island.parts.find(p=>p.mat.name.endsWith('_branches')).geo,sourceHeight:island.meta.sourceHeight,forageArt:W.forageArt});
    const orchardParts=[...island.parts,...pieces(fruit.root)],orchardBounds=new THREE.Box3();orchardParts.forEach(p=>orchardBounds.union(p.bounds));
    const orchardMeta=catalog.trees.find(t=>t.id==='orchard_apple');if(!orchardMeta)throw Error('Missing orchard view metadata');
    const orchardSource={parts:orchardParts,bounds:orchardBounds,key:'orchard-broadleaf',meta:orchardMeta,triangles:island.triangles+fruit.stats.triangles};
    variants.push(orchardSource);
    // Mature fallbacks retain the original wood and its collision envelope.
    // Only the leaf surface patches grow; the material/depth preparation stays shared.
    let matureLeafPart;const matureStarted=performance.now(),identity=new THREE.Matrix4();
    broad.traverse(o=>{
      if(!o.isMesh||o.material.name!=='tree_small_02_leaves')return;
      if(matureLeafPart||!o.matrixWorld.equals(identity))throw Error('Unexpected mature leaf source frame');
      const originalLeafPart=variants[0].parts.find(p=>p.mat.name===o.material.name);
      const geo=createMatureLeafGeometry(THREE,o.geometry,originalLeafPart.geo);
      // Shade density depends on geometry, not pigment. The throwaway facade
      // absorbs prepareCanopyShade's pigment multiply without retinting the real material.
      const leaf={isMesh:true,geometry:geo,matrixWorld:identity,material:{name:o.material.name,color:o.material.color.clone()}};
      const facade={updateMatrixWorld(){},traverse(fn){fn(leaf);}};
      const shade=prepareCanopyShade(THREE,facade);
      (state.canopyShading??={})[MATURE_LEAF_ALIAS]={...shade,prepareMs:performance.now()-matureStarted};
      matureLeafPart={geo,mat:o.material,name:o.name,bounds:geo.boundingBox.clone()};
    });
    if(!matureLeafPart)throw Error('Missing original mature leaf primitive');
    const matureLeafParts=variants[0].parts.map(p=>p.mat.name==='tree_small_02_leaves'?matureLeafPart:p),matureLeafBounds=new THREE.Box3();
    matureLeafParts.forEach(p=>matureLeafBounds.union(p.bounds));
    const matureLeafMeta=catalog.trees.find(t=>t.id===MATURE_LEAF_ALIAS&&t.variant===-1);
    if(!matureLeafMeta)throw Error('Missing mature leaf view metadata');
    const matureLeafSource={parts:matureLeafParts,bounds:matureLeafBounds,key:'mature-leaf-broadleaf',meta:matureLeafMeta,triangles:variants[0].triangles};
    variants.push(matureLeafSource);
    const sourceFor=t=>{
      if(t.authoredOrchard)return orchardSource;
      if(alpineSnowAt(t.x,t.z)>.35)return t.height>=6.2&&rnd(t.x,t.z,31)>.42?variants[4]:variants[1+Math.floor(rnd(t.x,t.z,17)*3)];
      // Related trees grow in groves. Young roadside trees stay slender; mature
      // oak sites carry full crowns. Broad trees define meadow and woodland edges.
      const roadEdge=Math.min(W.pathDist(t.x,t.z),G.worldPaths?.trackDist(t.x,t.z)??Infinity);
      if(roadEdge<8.5&&!['pine','snowpine','cold'].includes(t.kind))return ['oak','blossom'].includes(t.kind)&&t.height>=7.2?variants[5]:variants[0];
      if(t.kind==='woodland')return variants[6];
      if(t.kind==='willow')return variants[5];
      const lowland=t.kind!=='cold'&&t.kind!=='snowpine'&&Math.hypot(t.x+160,t.z+210)>160;
      if(!['pine','snowpine','cold'].includes(t.kind)||lowland&&rnd(t.x,t.z,49)>.28){
        const village=Math.hypot(t.x-47,t.z+50)<34;
        const grove=Math.sin(t.x*.034+t.z*.011)+Math.cos(t.z*.047-t.x*.009);
        const spreading=!village&&grove+rnd(t.x,t.z,53)*.65>-.32;
        if(spreading)return grove>.55?variants[6]:variants[5];
        // Keep earlier grove choices, young trees, village and cold margins exact.
        const matureFallback=!village&&!t.authoredVillage&&['oak','birch','blossom'].includes(t.kind)
          &&t.height>=7.2&&t.height<=12.5&&coldWoodlandWeights(t.x,t.z).weight<=.08;
        return matureFallback?matureLeafSource:variants[0];
      }
      return t.height>=6.2&&rnd(t.x,t.z,31)>.42?variants[4]:variants[1+Math.floor(rnd(t.x,t.z,17)*3)];
    };
    const onRoad=(x,z)=>(G.worldPaths?.trackDist(x,z)??Infinity)<3.7||W.pathDist(x,z)<3.2;
    const clearTrunk=(x,z)=>{
      for(let i=W.colliders.length-1;i>=0;i--){const c=W.colliders[i];if(c.r<=1.2&&Math.hypot(c.x-x,c.z-z)<.15)W.colliders.splice(i,1);}
      for(let i=(W.forestPoints?.length||0)-1;i>=0;i--)if(Math.hypot(W.forestPoints[i].x-x,W.forestPoints[i].z-z)<.15)W.forestPoints.splice(i,1);
    };
    state.roadClearedTrees=0;state.roadClearedSnags=0;state.meadowClearings=[];
    const autumnPalette=['#e6b448','#db8734','#ad3d42','#c85c65'].map(c=>new THREE.Color(c));
    const coldStats=state.coldWoodland={trees:0,mature:0,regeneration:0,mixedMargin:0,sourceChanges:0,sourceCounts:{}};
    const add=t=>{
      const road=onRoad(t.x,t.z),meadow=inMeadowOpening(t.x,t.z);
      const cleared=!t.authoredOrchard&&((road&&!t.authoredVillage)||meadow||G.vistas?.clearZones?.some(test=>test(t.x,t.z)));
      if(cleared){
        if(t.root)t.root.visible=false;else if(t.stem){t.stem.setMatrixAt(t.stemIndex??t.index,zero);t.leaves.setMatrixAt(t.index,zero);t.stem.instanceMatrix.needsUpdate=t.leaves.instanceMatrix.needsUpdate=true;}
        clearTrunk(t.x,t.z);if(road)state.roadClearedTrees++;
        if(meadow)state.meadowClearings.push({x:t.x,z:t.z,kind:t.kind});
        return;
      }
      // Blossom placements share the scanned broadleaf canopy pipeline too;
      // keeping their old cards left disconnected leaves and bare forked poles.
      if(t.root&&!t.root.visible)return;
      if(t.stem){const matrix=new THREE.Matrix4();t.stem.getMatrixAt(t.stemIndex??t.index,matrix);const a=matrix.elements;if(Math.hypot(a[0],a[1],a[2])<.01)return;}
      t.source=sourceFor(t);
      const autumn=1-THREE.MathUtils.smoothstep(Math.hypot(t.x-300,t.z+300),110,145);
      if(autumn>0&&t.source.key.includes('broadleaf')){
        // Neighbouring trees share seasonal patches; no random-sequence changes.
        const patch=rnd(Math.floor(t.x/24),Math.floor(t.z/24),91);
        t.tint=autumnPalette[Math.floor(patch*autumnPalette.length)].clone().lerp(WHITE,1-autumn);
      }else t.tint=WHITE;
      // Broad crowns occupy the old tree sites; trunks and route clearances stay fixed.
      if(t.source.key==='canopy-broadleaf')t.height=Math.min(t.height,12.5);
      if(t.source.key==='woodland-broadleaf'&&t.kind!=='woodland')t.height=Math.min(14,Math.max(8,t.height*1.35));
      // Keep the older source/crown rules exact outside the established cold
      // climate. Evergreen age patches alter crowns, never their trunk sites.
      if(!t.authoredOrchard&&!t.authoredVillage&&coldWoodlandWeights(t.x,t.z).weight>.08){
        const elevation=W.groundH(t.x,t.z),grade=Math.hypot(W.groundH(t.x+1,t.z)-W.groundH(t.x-1,t.z),W.groundH(t.x,t.z+1)-W.groundH(t.x,t.z-1))*.5;
        const profile=coldWoodlandProfile({x:t.x,z:t.z,height:t.height,source:t.source.key,elevation,grade});
        const source=variants.find(v=>v.key===profile.source);
        if(!source)throw Error('Missing cold woodland source: '+profile.source);
        coldStats.sourceChanges+=source!==t.source;t.source=source;
        t.height=profile.height;t.crownWidth=profile.crownWidth;
        coldStats.trees++;coldStats.sourceCounts[source.key]=(coldStats.sourceCounts[source.key]||0)+1;
        if(source.key==='mature-pine')coldStats.mature++;
        else if(source.key.startsWith('pine-'))coldStats.regeneration++;
        else coldStats.mixedMargin++;
      }
      trees.push(t);
    };
    // Respect cleared placements in both the original seed batches and new landmark zones.
    const seedMatrix=new THREE.Matrix4();
    for(const stem of seedTrees.filter(o=>o.userData.treeLayer==='wood'&&['oak','birch','blossom','pine','snowpine'].includes(o.userData.treeSpecies))){
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
      for(const kind of ['oak','birch','blossom','pine','cold','willow']){
        const bank=banks[kind];if(!bank)continue;floraCanopies.push(bank.im);
        for(let i=0;i<bank.n;i++){
          bank.im.getMatrixAt(i,matrix);matrix.decompose(pos,rot,scale);
          const stemIndex=stems.get(key(pos));if(stemIndex===undefined)continue;
          add({x:pos.x,z:pos.z,height:scale.y,yaw:new THREE.Euler().setFromQuaternion(rot).y,kind,
            stem:banks.trunk.im,stemIndex,leaves:bank.im,index:i});
        }
      }
    }
    for(const t of G.quartersPkg?.scanTrees||[])add({...t});
    state.replacedQuarterTrees=(G.quartersPkg?.scanTrees||[]).length;
    const snags=banks?.snag;
    if(snags){
      const matrix=new THREE.Matrix4(),pos=new THREE.Vector3();
      for(let i=0;i<snags.n;i++){
        snags.im.getMatrixAt(i,matrix);if(Math.abs(matrix.determinant())<1e-8)continue;
        pos.setFromMatrixPosition(matrix);const road=onRoad(pos.x,pos.z),meadow=inMeadowOpening(pos.x,pos.z);if(!road&&!meadow)continue;
        snags.im.setMatrixAt(i,zero);clearTrunk(pos.x,pos.z);if(road)state.roadClearedSnags++;
        if(meadow)state.meadowClearings.push({x:pos.x,z:pos.z,kind:'snag'});
      }
      snags.im.instanceMatrix.needsUpdate=true;
    }
    const natural=[];scene.traverse(o=>{if(['Natural oak tree','Natural birch tree','Natural pine pine','Natural snowpine pine'].includes(o.name)&&o.parent===scene)natural.push(o);});
    for(const original of natural){if(!original.visible)continue;const b=new THREE.Box3().setFromObject(original);if(b.isEmpty())continue;
      add({x:original.position.x,z:original.position.z,height:b.max.y-b.min.y,yaw:original.rotation.y,root:original,kind:original.name.includes('pine')?'pine':'oak'});
    }
    // These authored food trees are nested under Forage decor, so the legacy
    // scene-root tree scan above cannot discover them. Keep their picking sites.
    const orchard=[];scene.traverse(o=>{if(o.userData.orchard)orchard.push(o);});
    for(const original of orchard){const p=original.getWorldPosition(new THREE.Vector3()),a=original.userData.orchard;
      add({x:p.x,z:p.z,height:a.height,yaw:a.yaw,root:original,kind:'orchard',authoredOrchard:true});
    }
    // Irregular groves frame the new bridleway, with gaps between them for views
    // across the hill. Every trunk respects paths, courses, water and buildings.
    const trail=G.worldPaths?.tracks.find(t=>t.id==='clover');
    state.trailTrees=[];
    if(trail)for(let i=8;i<trail.pts.length-8;i+=9){
      const [x,z]=trail.pts[i],a=trail.pts[i-1],b=trail.pts[i+1];
      const length=Math.hypot(b[0]-a[0],b[1]-a[1])||1,nx=-(b[1]-a[1])/length,nz=(b[0]-a[0])/length;
      const side=rnd(x,z,82)>.5?1:-1;
      for(const edgeSide of [side,-side])for(let j=0;j<4;j++){
        const off=edgeSide*(9+j*2.6+rnd(x+j,z,83)*3.5),tx=x+nx*off+(rnd(x,z+j,84)-.5)*11,tz=z+nz*off+(rnd(x+j,z,85)-.5)*11;
        if(!clear(tx,tz,2.6)||trees.some(t=>Math.hypot(tx-t.x,tz-t.z)<5.5))continue;
        const height=9+rnd(tx,tz,86)*4;
        add({x:tx,z:tz,height,yaw:rnd(tx,tz,87)*Math.PI*2,kind:'woodland'});
        state.trailTrees.push({x:tx,z:tz,height});
      }
    }
    state.villageEvergreens=await installVillageEvergreens(G,COTTONWOOD_TREES,wind);
    state.villageTrees=COTTONWOOD_TREES;
    const textureLoader=new THREE.TextureLoader();
    // Load all views before hiding any original tree. Missing data leaves the
    // existing forest intact, instead of empty silhouettes during a slow load.
    for(const source of variants){
      const m=source.meta;
      const [atlas,normals]=await Promise.all([textureLoader.loadAsync('./assets/models/world/realism/'+m.views.file+'?v='+m.views.sha256),textureLoader.loadAsync('./assets/models/world/realism/'+m.normals.file+'?v='+m.normals.sha256)]);
      atlas.colorSpace=THREE.SRGBColorSpace;atlas.anisotropy=8;normals.colorSpace=THREE.NoColorSpace;normals.anisotropy=4;
      source.impostor={THREE,albedo:atlas,normals,width:m.width,height:m.height,bottom:m.bottom};
      source.card=treeImpostor(source.impostor);
    }
    // The same lit, eight-angle source atlases continue woodland beyond the
    // riding terrain. These static groves never consume the nearby model budget.
    const outer=W.outerLandscape;
    if(outer){const groves=new Map(),cards=new Map();
      for(const site of outer.woodlandSites){const source=variants.find(v=>v.key===site.source),scale=site.height/source.meta.sourceHeight;
        q.setFromAxisAngle(UP,site.yaw);s.setScalar(scale);v.set(site.x,site.y-source.bounds.min.y*scale-.035,site.z);
        const key=source.key+':'+(site.x<0?0:1)+':'+(site.z<0?0:1);
        if(!groves.has(key))groves.set(key,{source,matrices:[]});groves.get(key).matrices.push(new THREE.Matrix4().compose(v,q,s));
      }
      const meshes=[];for(const {source,matrices} of groves.values()){
        if(!cards.has(source.key)){
          const base=source.card.mat,mat=base.clone();mat.userData={...base.userData};
          mat.onBeforeCompile=(shader,renderer)=>{base.onBeforeCompile(shader,renderer);patchOuterFog(shader);};
          mat.customProgramCacheKey=()=>base.customProgramCacheKey()+'-outer-haze';
          cards.set(source.key,{...source.card,mat});
        }
        const mesh=instances(cards.get(source.key),matrices,'Outer woodland | '+source.key);mesh.receiveShadow=false;meshes.push(mesh);
      }
      state.outerWoodland={trees:outer.woodlandSites.length,draws:meshes.length,triangles:outer.woodlandSites.length*2,meshes};
      outer.stats.woodlandDraws=meshes.length;outer.stats.woodlandTriangles=outer.woodlandSites.length*2;
    }
    for(const t of trees){
      const scale=t.height/t.source.meta.sourceHeight,crownWidth=t.crownWidth||1;
      // Detailed geometry, distant views and shadow depth use this same matrix.
      q.setFromAxisAngle(UP,t.yaw);s.set(scale*crownWidth,scale,scale*crownWidth);
      v.set(t.x,W.groundH(t.x,t.z)-t.source.bounds.min.y*scale-.07,t.z);
      t.matrix=new THREE.Matrix4().compose(v,q,s);
    }
    const cells=new Map();for(const t of trees){const key=t.source.key+':'+Math.floor(t.x/65)+','+Math.floor(t.z/65);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(t);}
    for(const records of cells.values()){
      const source=records[0].source;
      const card=instances(source.card,records.map(t=>t.matrix),'Scanned distant tree views | '+source.key);
      // Camera-facing atlases contain the same baked canopy shading; receiving their
      // own differently oriented shadow card creates false dark triangles.
      card.receiveShadow=false;
      records.forEach((t,i)=>card.setColorAt(i,t.tint||WHITE));treeCards.push({mesh:card,records});
      for(const p of source.parts){
        const mesh=instances(p,records.map(()=>zero),'Photoscan '+source.key+' | '+p.name);
        records.forEach((t,i)=>mesh.setColorAt(i,/leaves|twig/.test(p.mat.name)&&t.tint?t.tint:WHITE));
        mesh.count=0;treeMeshes.push({mesh,records});
      }
    }
    for(const t of trees){if(t.root)t.root.visible=false;else if(t.stem){
      t.stem.setMatrixAt(t.stemIndex??t.index,zero);t.leaves.setMatrixAt(t.index,zero);t.stem.instanceMatrix.needsUpdate=t.leaves.instanceMatrix.needsUpdate=true;
    }}
    const orchardRecords=trees.filter(t=>t.authoredOrchard);
    state.orchardFruit={...fruit.stats,trees:orchardRecords.length,clusters:fruit.stats.clusters*orchardRecords.length,apples:fruit.stats.apples*orchardRecords.length,triangles:fruit.stats.triangles*orchardRecords.length,integratedLOD:true};
    state.orchardTrees=orchardRecords.map(t=>({x:t.x,z:t.z,height:t.height,yaw:t.yaw,source:t.source.key}));
    // Commit new trunk collisions only after all tree views have loaded.
    for(const t of COTTONWOOD_TREES)W.colliders.push({x:t.x,z:t.z,r:.34,height:t.height,trunk:true});
    for(const t of state.trailTrees)W.colliders.push({x:t.x,z:t.z,r:.62,height:t.height,trunk:true});
    // A zero-scale instance still runs every vertex and shadow vertex shader.
    // These seed batches are wholly replaced; stop submitting their old meshes.
    const retired=new Set();
    for(const t of trees)if(t.stem?.userData.treePoints){retired.add(t.stem);retired.add(t.leaves);}
    for(const mesh of retired){mesh.visible=false;mesh.userData.photoscanReplaced=true;}
    state.retiredBatches=retired.size;
    floraCanopies.forEach(m=>{m.visible=false;});
    state.trees=trees.length+COTTONWOOD_TREES.length;state.conifers=trees.filter(t=>t.source.key.includes('pine')).length+COTTONWOOD_TREES.length;state.normalMappedViews=variants.length;state.matureTrees=trees.filter(t=>t.source.key==='mature-pine').length;
    state.woodlandCanopies=trees.filter(t=>t.source.key==='woodland-broadleaf').length;
    state.broadleafCanopies=trees.filter(t=>t.source.key==='canopy-broadleaf').length;
    state.treePositions=trees.map(t=>({x:t.x,z:t.z,height:t.height,kind:t.kind,source:t.source.key,tint:t.tint.getHexString()}));
    state.treePositions.push(...COTTONWOOD_TREES.map(t=>({...t,kind:'village',source:'columnar-evergreen',tint:'ffffff'})));
    // Regenerate leaf litter from surviving trunks; cleared meadows must not
    // keep the old brown forest-floor circles or camera obstacles.
    scene.getObjectByName('Pasture terrain')?.material.userData.setTrees?.(W.forestPoints);
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
        // The same compact rock scan gives roadside dry-stone courses proper
        // surfaces and rounded, asymmetric silhouettes without a full rock mesh.
        const pathStone=scene.getObjectByName('worldPaths:stone');
        if(pathStone){
          const pathGeo=geo.clone(),box=geo.boundingBox,size=box.getSize(new THREE.Vector3()),centre=box.getCenter(new THREE.Vector3());
          pathGeo.translate(-centre.x,-centre.y,-centre.z);pathGeo.scale(1/size.x,1/size.y,1/size.z);pathGeo.computeBoundingSphere();
          pathStone.geometry.dispose();pathStone.geometry=pathGeo;pathStone.material.dispose();
          const mat=parts[0].mat.clone();mat.name='Bridleway | scanned dry stone';
          mat.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
            float stoneLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
            diffuseColor.rgb=mix(vec3(stoneLuma),diffuseColor.rgb,.18)*1.18;`);};
          mat.customProgramCacheKey=()=> 'bridleway-stone-v1';pathStone.material=mat;
          for(let i=0;i<pathStone.count;i++)pathStone.setColorAt(i,new THREE.Color().setScalar(.88+rnd(i,42)*.18));
          pathStone.instanceColor.needsUpdate=true;pathStone.computeBoundingSphere();state.pathStoneTriangles=data.index.length/3;
        }
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
  async function installWillows(){
    const roots=G.quartersPkg?.willowTrees||[];if(roots.length)state.willows=await installWillowArt(G,roots,wind);
  }
  async function installOak(){state.thunderOak=await installThunderOak(G,wind);}
  async function installDeadwood(){
    const bank=G.floraPkg?.bank.snag;if(!bank)return;
    const catalog=await fetch('./assets/models/world/realism/deadwood-lods.json?v=weathered-deadwood-1').then(r=>{if(!r.ok)throw Error('Deadwood mesh catalog unavailable');return r.json();});
    const sources=[];for(const variant of catalog.variants)sources.push(await load(variant.id));
    state.deadwood=installDeadwoodArt(G,{bank,catalog,sources});
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
  // The surveyed scan and terrain seat share a fixed transform. Its detailed
  // contact surface stays active independently of visibility and graphics quality.
  function installPrincipalOasisFace(piece){
    const {x,z,yaw}=OASIS_FACE,size=piece.bounds.getSize(new THREE.Vector3());
    const scale=OASIS_FACE.width/size.x,co=Math.cos(yaw),sn=Math.sin(yaw);
    const cx=(piece.bounds.min.x+piece.bounds.max.x)/2,cz=(piece.bounds.min.z+piece.bounds.max.z)/2;
    // Fixed survey elevation: cutting the backing must not sink the scan.
    const position=piece.geo.attributes.position,ty=OASIS_FACE.baseY;let footVertices=0,footGapMin=Infinity,footGapMax=-Infinity;
    for(let i=0;i<position.count;i++){
      const sy=position.getY(i);if(sy>piece.bounds.min.y+.45)continue;
      const sx=position.getX(i)-cx,sz=position.getZ(i)-cz;
      const wx=x+scale*(co*sx+sn*sz),wz=z+scale*(-sn*sx+co*sz);
      const ground=W.terrainH(wx,wz);if(!Number.isFinite(ground))throw Error('Principal cliff footing is outside canonical terrain');
      const gap=ty+scale*sy-ground;footGapMin=Math.min(footGapMin,gap);footGapMax=Math.max(footGapMax,gap);footVertices++;
    }
    if(!footVertices)throw Error('Principal cliff source has no finite low footing');
    const matrix=new THREE.Matrix4().set(scale*co,0,scale*sn,x-scale*(co*cx+sn*cz),
      0,scale,0,ty,-scale*sn,0,scale*co,z-scale*(-sn*cx+co*cz),0,0,0,1);
    const mesh=new THREE.Mesh(piece.geo,piece.mat);mesh.name='Photoscan principal organic Oasis cliff face';
    mesh.matrixAutoUpdate=false;mesh.matrix.copy(matrix);mesh.castShadow=true;mesh.receiveShadow=true;
    group.add(mesh);mesh.updateWorldMatrix(true,false);
    const contactTriangles=W.solidWorld.registerSurface(mesh);
    W.groundSurfaces.push((wx,wz)=>W.solidWorld.surfaceHeight(wx,wz,mesh));
    state.cliffs++;
    state.principalCliff={name:mesh.name,x,z,yaw,scale,width:size.x*scale,height:size.y*scale,depth:size.z*scale,
      matrix:matrix.toArray(),footVertices,lowBand:.45,originalBurial:.18,source:'namaqualand_cliff_02',
      sourceGeometry:piece.geo.uuid,sourceMaterial:piece.mat.uuid,footGapMin,footGapMax,contactTriangles};
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
      if(id==='namaqualand_cliff_02')installPrincipalOasisFace(piece);
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
    const selected=[],triangleBudget=tier==='high'?1800000:750000;
    // Reserve authored village, willow and landmark wood/crowns in the same budget.
    let triangles=(state.villageEvergreens?.triangles||0)+(state.willows?.triangles||0)+(state.thunderOak?.triangles||0);
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
      mesh.instanceMatrix.needsUpdate=mesh.instanceColor.needsUpdate=true;mesh.castShadow=!renderer.xr.isPresenting;
      if(count)mesh.computeBoundingSphere();
    }
    for(const {mesh,records} of treeCards){
      if(!changed(records))continue;
      let count=0;for(const t of records)if(!set.has(t)){mesh.setMatrixAt(count,t.matrix);mesh.setColorAt(count,t.tint||WHITE);count++;}
      mesh.count=count;mesh.visible=count>0;mesh.castShadow=!renderer.xr.isPresenting;mesh.instanceMatrix.needsUpdate=mesh.instanceColor.needsUpdate=true;
      if(count)mesh.computeBoundingSphere();
    }
    previousSelection=set;previousMode=mode;
    state.detailRebuilds=(state.detailRebuilds||0)+1;
    state.activeTrees=selected.length;
    state.distantTrees=trees.length-selected.length;
  }
  state.ready=(async()=>{
    for(let i=0;i<120&&!H.RIG()?.ready;i++)await new Promise(ok=>setTimeout(ok,250));
    for(const install of [installRocks,installTrees,installWillows,installOak,installDeadwood,installForestFloor,installRockFaces]){
      try{await install();}catch(e){state.errors.push(e.message);console.warn('World scan unavailable:',e);}
    }
    state.willows?.update();state.thunderOak?.update();updateTrees();return state.assets;
  })();
  let timer=0;
  G.on('tick',(dt,t)=>{
    wind.value=t;timer+=dt;if(timer<.35)return;timer=0;
    state.willows?.update();state.thunderOak?.update();updateTrees();state.deadwood?.update();const p=H.player.pos,tier=G.gfx.get();
    for(const d of detailPatches){d.mesh.visible=Math.hypot(d.x-p.x,d.z-p.z)<d.range*(tier==='low'?.6:1);d.mesh.castShadow=tier==='high'&&!d.mesh.userData.groundPlant;}
  });
  state.update=()=>{state.willows?.update();state.thunderOak?.update();updateTrees();state.deadwood?.update();};
}
