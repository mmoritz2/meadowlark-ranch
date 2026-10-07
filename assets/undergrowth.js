import {coyoteCoverDryWeight} from './biome-weights.mjs?v=dry-foothills-1';
import {loadUndergrowthModels} from './undergrowth-models.js?v=individual-undergrowth-1';
import {coverBiome,coverHash,coverShape,selectCover,UNDERGROWTH_TIERS} from './undergrowth-layout.mjs?v=dry-foothills-1';
import {treeImpostor,enableOpaqueFoliageCoverage,patchFoliageCoverage,patchSeasonalFoliage} from './tree-impostors.js?v=canopy-lighting-1';
import {alpineSnowAt} from './falls-landscape.js?v=alpine-range-1';

export function installUndergrowth(G,{flowerShrubs=[],staticShrubs=[]}={}){
 staticShrubs=staticShrubs.filter(root=>!['cold','dry'].includes(coverBiome(root.position.x,root.position.z,alpineSnowAt(root.position.x,root.position.z))));
 for(const root of staticShrubs)root.userData.undergrowthReplaceable=true;
 const T=G.THREE,W=G.world,player=G.horse.player,group=new T.Group();group.name='Individual woodland plants';G.scene.add(group);
 const state=G.undergrowth={ready:null,errors:[],sources:[],records:[],localRecords:[],templates:[],group,originalGroups:staticShrubs,stats:{ready:false}};
 const uniforms={coverTime:{value:0},coverEye:{value:new T.Vector2()},coverLimit:{value:21},coverRange:{value:135},coverRider:{value:new T.Vector2()}};
 const m=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3(),up=new T.Vector3(0,1,0),white=new T.Color();let order=0;
 function record(matrix,color,kind,meta){
  const x=matrix.elements[12],z=matrix.elements[14],biome=coverBiome(x,z,alpineSnowAt(x,z));if(biome==='cold'||biome==='dry')return null;
  matrix.decompose(p,q,s);const variation=coverHash(x,z),dry=biome==='autumn'?0:coyoteCoverDryWeight(x,z),shape=coverShape(kind,s.y,variation,meta,dry),height=shape.height,y=W.groundH(x,z)-.025,yaw=Math.atan2(matrix.elements[8],matrix.elements[10]);
  q.setFromAxisAngle(up,yaw);const root=new T.Matrix4().compose(new T.Vector3(x,y,z),q,new T.Vector3(height,height,height));
  const tint=biome==='autumn'?color.clone():new T.Color().setRGB(.94+variation*.06,1,.88+variation*.10);
  if(dry>0)tint.lerp(new T.Color().setRGB(1,.91,.68),dry*.76);
  return{x,y,z,kind,biome,dry,index:shape.index,height,matrix:root,color:tint,order:order++};
 }
 function patch(material,native,id){
  const old=material.onBeforeCompile,cache=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=(sh,renderer)=>{
   old.call(material,sh,renderer);Object.assign(sh.uniforms,uniforms);
   sh.vertexShader='uniform float coverTime;uniform vec2 coverEye;uniform vec2 coverRider;varying float coverDistance;varying float coverCameraDistance;\n'+sh.vertexShader;
   sh.vertexShader=sh.vertexShader.replace('#include <project_vertex>',`
    vec2 plantSite=instanceMatrix[3].xz;coverDistance=distance(plantSite,coverEye);
    float plantTip=max(0.,position.y),phase=plantSite.x*.21+plantSite.y*.17;
    transformed.x+=sin(coverTime*1.2+phase)*plantTip*plantTip*.025;
    transformed.z+=cos(coverTime*.9+phase)*plantTip*.018;
    vec2 away=plantSite-coverRider;float parting=1.-smoothstep(.35,1.25,length(away));
    vec2 awayWorld=normalize(away+vec2(.001));
    vec2 awayLocal=vec2(dot(awayWorld,normalize(instanceMatrix[0].xz)),dot(awayWorld,normalize(instanceMatrix[2].xz)));
    transformed.xz+=awayLocal*parting*plantTip*.45;transformed.y*=1.-parting*.22;
    coverCameraDistance=distance((modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz,cameraPosition);
    #include <project_vertex>`);
   sh.fragmentShader='uniform float coverLimit;uniform float coverRange;varying float coverDistance;varying float coverCameraDistance;\n'+sh.fragmentShader;
   sh.fragmentShader=sh.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
    float pixel=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
    float transition=smoothstep(coverLimit-3.,coverLimit,coverDistance);
    if(${native?'pixel<transition':'pixel>=transition'})discard;
    if(pixel>smoothstep(.35,1.10,coverCameraDistance)*(1.-smoothstep(coverRange-12.,coverRange,coverDistance)))discard;`);
  };
  material.customProgramCacheKey=()=>cache()+'-individual-cover-1-'+id+'-'+native;
 }
 state.ready=(async()=>{
  try{
   const [models,catalog]=await Promise.all([loadUndergrowthModels(T),fetch(new URL('./models/world/undergrowth/views.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Plant view catalogue unavailable');return r.json()})]);
   const loader=new T.TextureLoader(),meta=models.map(model=>{const row=catalog.plants.find(p=>p.id===model.id);if(!row)throw Error('Missing plant views: '+model.id);return row;});
   const cards=await Promise.all(meta.map(async row=>{const [albedo,normals]=await Promise.all(['albedo','normals'].map(key=>loader.loadAsync(new URL('./models/world/undergrowth/'+row.files[key].file,import.meta.url).href)));albedo.colorSpace=T.SRGBColorSpace;return treeImpostor({THREE:T,albedo,normals,width:row.width,height:row.height,bottom:row.bottom});}));
   // Later settlement passes remove plants from water and boardwalks. Capture
   // those final placements, including the existing yard scan clusters.
   await G.worldDetails.ready;
   const sources=[['scrub',G.floraPkg.bank.scrub.im,G.floraPkg.bank.scrub.n],['brack',G.floraPkg.bank.brack.im,G.floraPkg.bank.brack.n]];
   G.scene.traverse(o=>{if(o.isInstancedMesh&&o.name.startsWith('foliage_scan_'))sources.push([o.name.includes('fern_02')?'yard-fern':'yard-shrub',o,o.count]);});
   for(const source of flowerShrubs)sources.push(['woody',source,source.count,source.material.alphaTest===0]);
   for(const root of staticShrubs){root.updateWorldMatrix(true,true);root.traverse(source=>{if(source.isMesh)sources.push(['woody',source,1,source.material.alphaTest===0]);});}
   const color=new T.Color();
   for(const [kind,source,count,skipRecord]of sources){source.updateWorldMatrix(true,false);const fallback=[];
    for(let i=0;i<count;i++){if(source.isInstancedMesh){source.getMatrixAt(i,m);m.premultiply(source.matrixWorld)}else m.copy(source.matrixWorld);if(Math.abs(m.determinant())<1e-8)continue;if(source.instanceColor)source.getColorAt(i,color);else color.copy(white);
     const r=record(m,color,kind,meta);if(r){if(!skipRecord)state.records.push(r);}else fallback.push({matrix:m.clone(),color:color.clone(),x:m.elements[12],z:m.elements[14]});
    }
    const back=new T.InstancedMesh(source.geometry,source.material,Math.max(1,fallback.length));back.name='Retained cold/dry cover | '+kind;back.castShadow=false;back.receiveShadow=source.receiveShadow;back.frustumCulled=false;back.count=0;group.add(back);
    state.sources.push({source,kind,back,fallback,skipRecord:!!skipRecord,previousVisible:source.visible});
   }
   const local=W.nearGroundCover.fern,localFallback=new T.InstancedMesh(local.geometry,local.material,local.instanceMatrix.count);localFallback.name='Retained local cold/dry cover';localFallback.castShadow=false;localFallback.receiveShadow=true;localFallback.frustumCulled=false;localFallback.count=0;group.add(localFallback);
   const maxLocal=local.instanceMatrix.count;
   for(let i=0;i<models.length;i++){
    const model=models[i],card=cards[i],mat=model.mat;
    mat.name='Individual plant | '+model.id;mat.side=T.DoubleSide;mat.envMapIntensity=.55;mat.roughness=1;
    enableOpaqueFoliageCoverage(T,mat);
    for(const key of['map','normalMap','roughnessMap','metalnessMap'])if(mat[key])mat[key].anisotropy=Math.min(8,G.renderer.capabilities.getMaxAnisotropy());
    mat.onBeforeCompile=(sh,renderer)=>{patchSeasonalFoliage(sh,true);sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
     vec3 coverUp=normalize(mat3(viewMatrix)*vec3(0.,1.,0.));normal=normalize(mix(normal,coverUp,.32));`);patchFoliageCoverage(sh,renderer);};mat.customProgramCacheKey=()=> 'individual-plant-lighting-1';
    patch(mat,true,model.id);patch(card.mat,false,model.id);
    const near=new T.InstancedMesh(model.geo,mat,Math.ceil(480000/model.triangles)),far=new T.InstancedMesh(card.geo,card.mat,state.records.filter(r=>r.index===i).length+maxLocal);
    if(model.kind==='woody'){const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,map:mat.map,alphaTest:mat.alphaTest,side:T.DoubleSide});patch(depth,true,model.id+'-depth');near.customDepthMaterial=depth;}
    near.name='Undergrowth detail | '+model.id;far.name='Undergrowth distance | '+model.id;
    for(const mesh of[near,far]){mesh.count=0;mesh.castShadow=false;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.userData.fineGroundCover=model.kind!=='woody';mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(mesh);}
    state.templates.push({...meta[i],near,far});
   }
   let lastX=Infinity,lastZ=Infinity,lastTier=null,lastVersion=-1,localFallbackRecords=[];
   function update(dt,time){
    uniforms.coverTime.value=time;uniforms.coverRider.value.set(player.pos.x,player.pos.z);const tier=G.gfx.get(),changed=local.instanceMatrix.version!==lastVersion;
    if(changed){state.localRecords=[];localFallbackRecords=[];local.updateWorldMatrix(true,false);
     for(let i=0;i<local.count;i++){local.getMatrixAt(i,m);if(Math.abs(m.determinant())<1e-8)continue;m.premultiply(local.matrixWorld);local.getColorAt(i,color);const r=record(m,color,'local',meta);if(r)state.localRecords.push(r);else localFallbackRecords.push({matrix:m.clone(),color:color.clone()});}
     lastVersion=local.instanceMatrix.version;
    }
    if(!changed&&tier===lastTier&&Math.hypot(player.pos.x-lastX,player.pos.z-lastZ)<.75)return;
    lastX=player.pos.x;lastZ=player.pos.z;lastTier=tier;
    const selection=selectCover([...state.records,...state.localRecords],lastX,lastZ,tier,meta);uniforms.coverEye.value.set(lastX,lastZ);uniforms.coverLimit.value=selection.radius;uniforms.coverRange.value=selection.range;
    for(const t of state.templates){t.near.count=0;t.far.count=0;t.near.castShadow=t.kind==='woody'&&tier!=='low';}
    for(const [key,list]of[['near',selection.detail],['far',selection.far]])for(const {r}of list){const mesh=state.templates[r.index][key],i=mesh.count++;mesh.setMatrixAt(i,r.matrix);mesh.setColorAt(i,r.color);}
    for(const t of state.templates)for(const mesh of[t.near,t.far]){mesh.visible=mesh.count>0;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
    for(const src of state.sources){src.back.count=0;for(const r of src.fallback)if(Math.hypot(r.x-lastX,r.z-lastZ)<selection.range){const i=src.back.count++;src.back.setMatrixAt(i,r.matrix);src.back.setColorAt(i,r.color);}src.back.visible=src.back.count>0;src.back.instanceMatrix.needsUpdate=true;if(src.back.instanceColor)src.back.instanceColor.needsUpdate=true;}
    localFallback.count=localFallbackRecords.length;localFallbackRecords.forEach((r,i)=>{localFallback.setMatrixAt(i,r.matrix);localFallback.setColorAt(i,r.color)});localFallback.visible=localFallback.count>0;localFallback.instanceMatrix.needsUpdate=true;if(localFallback.instanceColor)localFallback.instanceColor.needsUpdate=true;
    state.stats={ready:true,tier,staticPlants:state.records.length,localPlants:state.localRecords.length,detail:selection.detail.length,far:selection.far.length,triangles:selection.triangles,budget:selection.budget,radius:selection.radius,range:selection.range,legacyFallback:state.sources.reduce((n,s)=>n+s.back.count,0)+localFallback.count};
   }
   for(const s of state.sources){s.source.visible=false;s.source.userData.replacedUndergrowth=true;}local.visible=false;local.userData.replacedUndergrowth=true;
   state.local=local;state.localFallback=localFallback;state.update=update;update(0,0);G.on('tick',update);
  }catch(e){state.errors.push(e.message);console.warn('Individual plants unavailable',e);}
 })();return state;
}
