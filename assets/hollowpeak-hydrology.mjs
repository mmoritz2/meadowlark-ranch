// One landscape renderer/support owner. Payload/query readiness belongs to the loader.
// Fetch/import readiness is the caller's job; all Three construction below is
// one synchronous private-RNG transaction with no await while patched.
import {createHollowpeakDesign,HOLLOWPEAK_DESIGN as DESIGN} from './hollowpeak-design.mjs';
import {patchPlungePool} from './cascade-flow.mjs?v=hollowpeak-cascades-1';

let seed=0x68443273;
function privately(run){
 const previous=Math.random;let draws=0;
 Math.random=()=>{draws++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 try{const value=run();if(value?.then)throw Error('Private construction must remain synchronous');return {value,draws};}
 finally{Math.random=previous;}
}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const need=(v,m)=>{if(!v)throw Error(m);return v;};

export function installHollowpeakHydrology({G,FALLS,heights,waterTriangles,waters,shoreGeometry,finalFieldSHA256,queries}){
 need(!G.world.hollowpeakHydrology,'Install exactly one landscape hydrology owner');
 const T=G.THREE,W=G.world,L=W.fallsLandscape,S=W.hollowpeakShore,scene=G.scene;
 need(S?.status==='ready'&&!W.hollowpeakShoreError,'Actual original shoreReady must finish first');
 need(typeof W.waterMaterial?.userData?.plainShader==='function','Authoritative plain water shader required');
 const previousOwnedQueries=L.ownedQueries,beforeSurfaces=W.groundSurfaces.slice(),contactIndex=beforeSurfaces.indexOf(S.contact);
 need(contactIndex>=0&&beforeSurfaces.filter(c=>c===S.contact).length===1,'Exactly one original registered shore contact');
 const bankSource=S.meshes.find(m=>m.name==='Hollowpeak shore | shoals')?.material;
 need(bankSource?.isMaterial&&bankSource.map&&bankSource.normalMap&&bankSource.roughnessMap,'Resident wet bedrock PBR required');
 const exact=[[L.tarn,'upper tarn'],[L.stream,'source channel'],[L.pool,'plunge pool'],...S.meshes.map(m=>[m,'old shore']),[FALLS.surface,'fall'],[FALLS.effects?.group,'spray'],[FALLS.foam,'impact foam']];
 need(exact.length===8&&new Set(exact.map(([o])=>o)).size===8,'Exactly eight distinct obsolete selected wet roots');
 for(const[o,reason]of exact)need(o?.isObject3D,'Missing exact obsolete '+reason);
 const oldVisibility=exact.map(([o])=>o.visible),ownedResources=[],created=[],atmosMaterials=[],oldFactoryEffects=W.waterfallArt.effectGroups.length,oldFactoryMists=W.waterfallArt.mistMaterials.length;

 let result;
 try{
  result=privately(()=>{
   need(queries===L.ownedQueries&&queries.shoreGeometry===shoreGeometry,'Use the early source-planning query owner');const root=new T.Group();root.name='Hollowpeak | connected watercourse';created.push(root);
   const ledger=exact.map(([o,reason],i)=>{o.visible=false;return {name:o.name,uuid:o.uuid,reason,wasVisible:oldVisibility[i],visible:o.visible,drawRange:o.geometry?{...o.geometry.drawRange}:null};});
   const deep=new T.Color('#244f53'),shallow=new T.Color('#507778'),color=new T.Color(),waterMeshes=[];
   function fittedWater(part){
    const position=part.position,index=part.index,uv=new Float32Array(position.length/3*2),tint=new Float32Array(position.length),depth=new Float32Array(position.length/3);
    for(let i=0;i<depth.length;i++){const x=position[i*3],y=position[i*3+1],z=position[i*3+2],d=Math.max(0,y-queries.design.heightAt(x,z));depth[i]=d;uv[i*2]=x/6;uv[i*2+1]=z/6;color.copy(deep).lerp(shallow,1-smooth(.05,1.1,d));color.toArray(tint,i*3);}
    const geometry=new T.BufferGeometry();ownedResources.push(geometry);geometry.setAttribute('position',new T.BufferAttribute(position,3));geometry.setIndex(new T.BufferAttribute(index,1));geometry.setAttribute('uv',new T.BufferAttribute(uv,2));geometry.setAttribute('color',new T.BufferAttribute(tint,3));geometry.setAttribute('hydroWaterDepth',new T.BufferAttribute(depth,1));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const pool=part.id===DESIGN.pool.id,material=W.waterMaterial.clone();ownedResources.push(material);material.name='Hollowpeak | '+part.id+' water';material.map=null;material.color.set(0xffffff);material.vertexColors=true;material.opacity=pool?.82:.96;material.roughness=pool?.18:.16;material.clearcoat=.36;
    material.onBeforeCompile=(shader,renderer)=>{W.waterMaterial.userData.plainShader(shader,renderer);if(pool)patchPlungePool(shader,{x:DESIGN.fall.landing[0],z:DESIGN.fall.landing[2]});shader.vertexShader='attribute float hydroWaterDepth;varying float hydroFittedDepth;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nhydroFittedDepth=hydroWaterDepth;');shader.fragmentShader='varying float hydroFittedDepth;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a*=smoothstep(0.0,.20,hydroFittedDepth);\n#include <alphatest_fragment>');};
    material.customProgramCacheKey=()=> 'v23-hydro2-finite-depth-feather-'+(pool?'new-landing-impact':'plain');
    const mesh=new T.Mesh(geometry,material);mesh.name='Hollowpeak | '+part.id;mesh.receiveShadow=true;mesh.castShadow=false;mesh.renderOrder=2;mesh.userData.collisionIgnore=true;root.add(mesh);waterMeshes.push({id:part.id,mesh,arrays:part});
   }
   for(const part of waters)fittedWater(part);
   const shore=new T.BufferGeometry();ownedResources.push(shore);shore.setAttribute('position',new T.BufferAttribute(shoreGeometry.position,3));shore.setIndex(new T.BufferAttribute(shoreGeometry.index,1));
   const uv=new Float32Array(shoreGeometry.position.length/3*2),tint=new Float32Array(shoreGeometry.position.length);
   for(let i=0;i<shoreGeometry.position.length/3;i++){const x=shoreGeometry.position[i*3],y=shoreGeometry.position[i*3+1],z=shoreGeometry.position[i*3+2],basin=Math.hypot(x-DESIGN.tarn.x,z-DESIGN.tarn.z)<Math.hypot(x-DESIGN.pool.x,z-DESIGN.pool.z)?DESIGN.tarn:DESIGN.pool,wet=1-smooth(0,.8,y-basin.level),shade=.8-.29*wet;uv[i*2]=x/3.2;uv[i*2+1]=z/3.2;tint[i*3]=shade;tint[i*3+1]=shade*1.015;tint[i*3+2]=shade*.99;}
   shore.setAttribute('uv',new T.BufferAttribute(uv,2));shore.setAttribute('color',new T.BufferAttribute(tint,3));shore.computeVertexNormals();shore.computeBoundingBox();shore.computeBoundingSphere();
   const shoreMaterial=bankSource.clone();ownedResources.push(shoreMaterial);shoreMaterial.name='Hollowpeak | wet bedrock';shoreMaterial.onBeforeCompile=bankSource.onBeforeCompile;shoreMaterial.customProgramCacheKey=bankSource.customProgramCacheKey;
   const shoreMesh=new T.Mesh(shore,shoreMaterial);shoreMesh.name='Hollowpeak | single owned shore';shoreMesh.receiveShadow=true;shoreMesh.castShadow=false;shoreMesh.renderOrder=1;shoreMesh.userData.collisionIgnore=true;root.add(shoreMesh);
   const f=DESIGN.fall,flow={x:f.x,z:f.z,top:f.top,bottom:f.bottom,width:f.width,run:f.run,name:'Hollowpeak connected falls'};
   const fall=W.waterfallArt.fall({...flow,flowProfile:'hollowpeak-cataract-2'});
   fall.traverse(o=>{if(o.geometry)ownedResources.push(o.geometry);});
   const effects=W.waterfallArt.effects(flow);
   effects.group.traverse(o=>{if(o.geometry)ownedResources.push(o.geometry);});ownedResources.push(...effects.materials);
   const foam=W.waterfallArt.impact({x:f.landing[0],y:DESIGN.pool.level+.045,z:f.landing[2],radius:f.impactRadius});ownedResources.push(foam.geometry,foam.material);
   root.add(fall,effects.group,foam);
   // The existing factory/tick advances the same time uniform. No second clock.
   for(const material of effects.materials){atmosMaterials.push(material);}
   scene.add(root);W.groundSurfaces[contactIndex]=queries.shoreContact;L.ownedQueries=queries;
   need(W.groundSurfaces.length===beforeSurfaces.length,'Do not append a second floor');
   need(beforeSurfaces.every((c,i)=>i===contactIndex||W.groundSurfaces[i]===c),'Unrelated support callback changed');
   need(L.group.visible&&L.rock.visible&&L.shadow.visible,'Retain actual terrain material and mountain shadow');
   const basinQueries=[DESIGN.pool,DESIGN.tarn].map(basin=>({basin,query:createHollowpeakDesign({heights,waterTriangles:waterTriangles.filter(t=>t.id===basin.id),finalFieldSHA256})}));
   // Query padding requests the nearest finite emitted face even off-surface;
   // it is used only as a distance search and never admits swimming there.
   const reflectionPlanes=(x,z)=>basinQueries.map(({basin,query})=>({distance:query.waterFootprintAt(x,z,2000).distance??Infinity,level:basin.level,refreshIntervalMs:100}));
   return {profile:'hollowpeak-connected-hydrology-1',root,queries,waterMeshes,shoreMesh,shoreGeometry,fall,effects,foam,flow,reflectionPlanes,contactIndex,beforeSurfaces,ledger,ownedResources,sourceShore:S,sourceBankMaterial:bankSource,field:heights,finalFieldSHA256,sourceWaterTriangles:waterTriangles};
  });
 }catch(error){for(let i=0;i<exact.length;i++)exact[i][0].visible=oldVisibility[i];W.groundSurfaces.splice(0,W.groundSurfaces.length,...beforeSurfaces);L.ownedQueries=previousOwnedQueries;for(const o of created)o.removeFromParent();for(const r of ownedResources)r.dispose();W.waterfallArt.effectGroups.length=oldFactoryEffects;W.waterfallArt.mistMaterials.length=oldFactoryMists;throw error;}
 const state=result.value;state.privateConstructorDraws=result.draws;
 need(state.root.position.lengthSq()===0&&state.root.rotation.x===0&&state.root.rotation.y===0&&state.root.rotation.z===0&&state.root.scale.x===1&&state.root.scale.y===1&&state.root.scale.z===1,'World-space factory geometry requires identity parent');
 W.hollowpeakHydrology=state;
 // Commit atmosphere registration only after the caller's solid owner is ready.
 let committed=false,rolledBack=false;
 state.activate=()=>{if(rolledBack)throw Error('Hydrology transaction rolled back');if(committed)return;for(const m of atmosMaterials)G.atmos?.registerMist?.(m);committed=true;};
 state.rollback=()=>{
  if(committed)throw Error('Committed world-lifetime hydrology cannot be partially removed');if(rolledBack)return;
  need(W.groundSurfaces[contactIndex]===queries.shoreContact,'Owned support changed before rollback');
  W.groundSurfaces[contactIndex]=S.contact;L.ownedQueries=previousOwnedQueries;
  for(let i=0;i<exact.length;i++)exact[i][0].visible=oldVisibility[i];
  state.root.removeFromParent();for(const r of new Set(ownedResources))r.dispose();
  const e=W.waterfallArt.effectGroups.indexOf(state.effects);if(e>=0)W.waterfallArt.effectGroups.splice(e,1);
  for(const m of state.effects.materials){const i=W.waterfallArt.mistMaterials.indexOf(m);if(i>=0)W.waterfallArt.mistMaterials.splice(i,1);}
  W.hollowpeakHydrology=null;rolledBack=true;
 };
 return state;
}
