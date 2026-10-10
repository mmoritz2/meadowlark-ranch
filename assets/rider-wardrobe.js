import {coatHemDisplacement} from './rider-coat-cutaway.js?v=tailored-coats69-20261010';
import {installClothingPose39} from './rider-clothing-pose.js?v=tailored-coats69-20261010';
import {createTextilePanels} from './rider-textile-surface.js?v=character-polish-20261009';
import {fitLowerLayer} from './rider-garment-layer-fit.js?v=tailored-coats69-20261010';
// TMP integration candidate. Keeps the normal rider API and all existing outfit IDs.
// Construction families still marked approximate below must receive dedicated art
// before this becomes a complete catalog release.
import {createRiderLibrary as createBase,RIDER_OUTFITS} from './rider-model-base.js?v=tailored-coats69-20261010';
export * from './rider-model-base.js?v=tailored-coats69-20261010';
import {CLOTH_GLSL} from './rider-clothes.js?v=tailored-coats69-20261010';
import {finishRidingBoots} from './rider-boot-finish.js?v=character-polish-20261009';
import {technicalFinish} from './rider-technical-finish.js?v=tailored-coats69-20261010';
import {poloFinish} from './rider-polo-finish.js?v=tailored-coats69-20261010';
import {crewneckFinish} from './rider-crewneck-finish.js?v=tailored-coats69-20261010';
import {cardiganFinish,overallsFinish} from './rider-layered-finish.js?v=tailored-coats69-20261010';
import {outdoorFinish} from './rider-outdoor-finish.js?v=tailored-coats69-20261010';
import {longCoatFinish} from './rider-long-coat-finish.js?v=outward-lapels70-20261010';
import {overshirtFinish} from './rider-overshirt-finish.js?v=tailored-coats69-20261010';
import {vestFinish} from './rider-vest-finish.js?v=tailored-coats69-20261010';
import {shirtFinish} from './rider-shirt-finish.js?v=tailored-coats69-20261010';
import {knitFinish} from './rider-knit-finish.js?v=tailored-coats69-20261010';
import {showJacketFinish} from './rider-show-jacket-finish.js?v=outward-lapels70-20261010';
import {finishBreeches} from './rider-breeches-finish.js?v=character-polish-20261009';
import {shortSleeveCut} from './rider-short-sleeve.js?v=character-polish-20261009';
import {finishArtistSkin} from './rider-skin-finish.js?v=character-polish-20261009';
import {installSourceCoverage} from './rider-source-coverage.js?v=character-polish-20261009';

const families={
 cardigan:'cardigan',overalls:'overalls',
 sweatshirt:'outdoor',raincoat:'outdoor',summit:'outdoor',hunter:'long-coat',tweed:'long-coat',
 denim:'overshirt',canvas:'overshirt',railroad:'overshirt',woodland:'overshirt',trailchecks:'overshirt',
 ranger:'vest',quilted:'vest',explorer:'vest',
 riding:'technical',eventer:'technical',team:'technical',chevron:'technical',
 polo:'short-polo',sportpolo:'short-polo',rugby:'polo',breton:'tee',daisytee:'tee',
 cable:'knit',alpine:'knit',argyle:'knit',patchwork:'knit',ranchknit:'knit',sunset:'knit',ivy:'knit',mariner:'knit',fairisle:'knit',northern:'knit',
 show:'show',dressage:'show',pinstripe:'show',
 peasant:'shirt',flannel:'shirt',western:'shirt',safari:'shirt',gingham:'shirt',orchard:'shirt',floral:'shirt',prairie:'shirt',dotblouse:'shirt',botanical:'shirt',wildflower:'shirt'
};
export const CONNECTED_FAMILY_STATUS=RIDER_OUTFITS.map(o=>({id:o.id,family:families[o.id]||'technical',constructionReady:!!families[o.id],catalogArtAccepted:false}));

export function createRiderLibrary(options){
 const T=options.THREE,base=createBase(options),ready=new Map(),pending=new Map(),textileByKit=new WeakMap(),get=['getX','getY','getZ','getW'];
 const V=()=>new T.Vector3(),json=async key=>options.connectedData?.[key]??await(await fetch(new URL('./models/rider/connected/'+key+'.json?v=character-polish-20261009',import.meta.url))).json();
 const fromSource=(data,positions,source)=>{
  const g=new T.BufferGeometry(),joints=[],weights=[];let maxSourceDelta=0;
  for(let i=0;i<data.sourceVertexProvenance.length;i++){
   const m=new Map(),p=V();for(const[id,t]of data.sourceVertexProvenance[i]){
    if(id>=source.position.count)throw Error('Wardrobe source ID missing '+id);
    p.addScaledVector(V().fromBufferAttribute(source.position,id),t);
    for(const k of get){const j=source.skinIndex[k](id);m.set(j,(m.get(j)||0)+source.skinWeight[k](id)*t);}
   }
   maxSourceDelta=Math.max(maxSourceDelta,p.distanceTo(V().fromArray(data.sourcePositions[i])));
   const ranked=[...m].filter(v=>v[1]>0).sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,4),sum=ranked.reduce((s,v)=>s+v[1],0);
   if(!Number.isFinite(sum)||sum<=0)throw Error('Wardrobe source weights invalid');while(ranked.length<4)ranked.push([0,0]);
   joints.push(...ranked.map(v=>v[0]));weights.push(...ranked.map(v=>v[1]/sum));
  }
  if(maxSourceDelta>1e-6)throw Error('Wardrobe source position mismatch '+maxSourceDelta);
  g.setAttribute('position',new T.Float32BufferAttribute(positions.flat(),3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));g.setIndex(data.triangles.flat());g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData.sourceBindDelta=maxSourceDelta;return g;
 };
 async function kit(sex){
  sex=sex==='m'?'m':'f';if(pending.has(sex))return pending.get(sex);
  const task=(async()=>{
   const k=await base.kit(sex),[shirt,mask,pants,pantsMask,boots]=await Promise.all([json('cloth-'+sex),json('mask-'+sex),json('pants-'+sex),json('pants-mask'),json('boots-'+sex)]),source=k.garmentSkin.geometry.attributes;
   if(JSON.stringify(shirt.jointNames)!==JSON.stringify(k.skin.skeleton.bones.map(b=>b.name)))throw Error('Wardrobe canonical joint order mismatch');
   const shirtGeometry=fromSource(shirt,shirt.shellPositions,source),pantsGeometry=fromSource(pants,pants.positions,source),bootGeometry=new T.BufferGeometry();
   bootGeometry.setAttribute('position',new T.Float32BufferAttribute(boots.positions.flat(),3));bootGeometry.setAttribute('uv',new T.Float32BufferAttribute(boots.uv.flat(),2));bootGeometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(boots.skinIndices.flat(),4));bootGeometry.setAttribute('skinWeight',new T.Float32BufferAttribute(boots.skinWeights.flat(),4));bootGeometry.setIndex(boots.triangles.flat());bootGeometry.computeVertexNormals();bootGeometry.computeBoundingSphere();
   const short=shortSleeveCut(T,shirtGeometry,shirt,k.skin.geometry,mask,sex==='f'?.315:.345);
   // Prevent the base constructor from scheduling obsolete garment loads.
   k.outfits.riding=Promise.resolve({meshes:[],refs:new Map()});
   for(const name of ['hairClothSurface','hairWeightSurface']){const cache=k[name];if(cache){(cache.surface||cache).dispose?.();delete k[name];}}
   k.hairGarmentEnvelope={geometry:shirtGeometry,skeleton:k.skin.skeleton,bindMatrix:k.skin.bindMatrix,representatives:['connected wardrobe full sleeve envelope'],bounds:shirtGeometry.boundingBox.clone(),buildMs:0};
   k.connectedWardrobe={shirt,mask,pants,pantsMask,boots,shirtGeometry,pantsGeometry,bootGeometry,short};ready.set(sex,k);return k;
  })();pending.set(sex,task);return task;
 }
 function addPattern(material,rig,recipe){
  let panels=textileByKit.get(rig.kit);if(!panels){panels=createTextilePanels(T,rig.kit);textileByKit.set(rig.kit,panels);}
  // Sewing, ribbing and relief come from the construction material; apply the
  // existing chosen textile print without old analytic cuffs or painted buttons.
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey(),design=[0,3,8,9].includes(recipe.design)?0:recipe.design;
  material.onBeforeCompile=shader=>{
   previous(shader);Object.assign(shader.uniforms,{uZ1:rig.u.uZ1,uZ2:rig.u.uZ2,uPants:rig.u.uPants,uClothes:{value:new T.Vector4(design,0,0,0)},uTailor:{value:new T.Vector4()},uArmTextile:{value:new T.Vector4(rig.kit.zones.armY,rig.kit.zones.armZ,rig.kit.body==='f'?.22:.27,rig.kit.body==='f'?.050:.058)}});
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWardrobeBind;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWardrobeBind=position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec4 uZ1,uZ2,uArmTextile;uniform vec3 uPants;varying vec3 vWardrobeBind;\n'+CLOTH_GLSL).replace('#include <map_fragment>','#include <map_fragment>\nfloat sleeveMix=step(uArmTextile.z,abs(vWardrobeBind.x));\nvec3 textileBind=vWardrobeBind;\nfloat sleeveAngle=atan(vWardrobeBind.z-uArmTextile.y,vWardrobeBind.y-uArmTextile.x);\ntextileBind.xy=mix(vWardrobeBind.xy,vec2(sleeveAngle*uArmTextile.w,uZ1.x-max(0.0,abs(vWardrobeBind.x)-uArmTextile.z)),sleeveMix);\ndiffuseColor.rgb=riderFabric(diffuseColor.rgb,textileBind);');
  };material.customProgramCacheKey=()=>key+'-catalog-textile-cylindrical3-'+design;
  panels.material(material,design);
 }
 function build(k,look={}){
  if(!k.connectedWardrobe)throw Error('Wardrobe build before kit ready');
  const rig=base.build(k,{...look,outfit:'riding',neckwear:'none'}),d=k.connectedWardrobe,bodyGeo=rig.body.geometry.clone(),garments=[],coverage=[];
  const covered=new Set(d.pantsMask.sex[k.body].coveredOriginalSourceTriangles.map(ids=>ids.toSorted((a,b)=>a-b).join(':'))),kept=[];let removed=0;
  for(let i=0;i<bodyGeo.index.count;i+=3){const ids=[bodyGeo.index.getX(i),bodyGeo.index.getX(i+1),bodyGeo.index.getX(i+2)];if(covered.has(ids.toSorted((a,b)=>a-b).join(':')))removed++;else kept.push(...ids);}
  if(removed!==covered.size)throw Error('Wardrobe pants membership mismatch');bodyGeo.setIndex(kept);bodyGeo.setAttribute('qaSourceCut',new T.Float32BufferAttribute(d.mask.affineSourceCutFields.flat(),3));rig.body.geometry=bodyGeo;
  bodyGeo.setAttribute('qaBootCoverage',new T.Float32BufferAttribute(Array.from({length:bodyGeo.attributes.position.count},(_,i)=>bodyGeo.attributes.position.getY(i)-(rig.u.uZ1.value.w-.085)),1));
  finishArtistSkin(rig.body.material);const bodyCoverage=installSourceCoverage(T,rig.body,{shirt:true,boots:true});
  Object.defineProperty(rig.u.uOutfit,'value',{configurable:true,get:()=>0,set:()=>{}});rig.u.uFitted.value=0;
  const attach=(name,geometry,material)=>{textileByKit.get(k)?.geometry(geometry,material);const mesh=new T.SkinnedMesh(geometry,material);mesh.name=name;mesh.bind(rig.body.skeleton,rig.body.bindMatrix);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;rig.body.parent.add(mesh);return mesh;};
  const bootGeometry=d.bootGeometry.clone(),bootFinish=finishRidingBoots(T,bootGeometry,d.boots,rig.u.uBoot);
  const boots=attach('Modern_Riding_Feet',bootGeometry,bootFinish.material),bootMeshes=[boots];
  for(const piece of bootFinish.pieces)bootMeshes.push(attach(piece.name,piece.geometry,piece.material));
  for(const mesh of bootMeshes)mesh.userData.riderSurfaceRole='footwear';
  rig.boots=bootMeshes;rig.u.uBootMesh.value=1;rig.bootFinishEvidence=bootFinish.evidence;
  rig.setBoots=on=>{for(const mesh of bootMeshes)mesh.visible=!!on;rig.u.uBootMesh.value=on?1:0;};
  let currentKey='',currentLook={...look},buildCount=0;
  const disposeGarments=()=>{rig.clothingPose?.release();for(const h of coverage)h.dispose();coverage.length=0;for(const m of garments){m.removeFromParent();m.geometry.dispose();m.material.dispose();}garments.length=0;};
  rig.setOutfit=(id,callback)=>{
   const recipe=RIDER_OUTFITS.find(o=>o.id===id)||RIDER_OUTFITS[0],family=families[recipe.id]||'technical',shirt=currentLook.shirt||recipe.palette[0],pants=currentLook.pants||recipe.palette[1],key=[recipe.id,shirt,pants].join('|');
   rig.outfitId=recipe.id;rig.u.uClothes.value.set(recipe.design,recipe.cut==='short'?1:0,recipe.cut==='sweater'?1:0,recipe.cut==='gilet'?1:0);
   if(currentKey===key){rig.clothingPose?.update();callback?.();return;}currentKey=key;disposeGarments();
   const short=family==='short-polo'||family==='tee',data=short?d.short.cloth:d.shirt,mask=short?d.short.mask:d.mask,geometry=(short?d.short.geometry:d.shirtGeometry).clone();
   // Fit the actual overlapping waist before details are attached. Trousers
   // remain visible beneath lifted hems; depth resolves the garment layering.
   const waistFit=fitLowerLayer(T,k,{geometry,skeleton:k.skin.skeleton,bindMatrix:k.skin.bindMatrix},{clearance:.006});
   // The cutaway exposes trousers above the old straight shirt hem. Keep an
   //8mm trouser underlap beneath the shaped front edge in every render pass.
   const coverageFields=family==='long-coat'?mask.affineSourceCutFields.map((f,i)=>{
    const [x,,z]=mask.canonicalSourcePositions[i],raise=Math.max(0,coatHemDisplacement(x,z));
    return [f[0]-raise-.008,f[1],f[2]];
   }):mask.affineSourceCutFields;
   bodyGeo.setAttribute('qaSourceCut',new T.Float32BufferAttribute(coverageFields.flat(),3));
   const trim='#'+new T.Color(shirt).multiplyScalar(.72).getHexString(),factory=family==='cardigan'?cardiganFinish:family==='overalls'?overallsFinish:family==='outdoor'?outdoorFinish:family==='long-coat'?longCoatFinish:family==='overshirt'?overshirtFinish:family==='vest'?vestFinish:family==='tee'?crewneckFinish:family==='shirt'?shirtFinish:family==='knit'?knitFinish:family==='show'?showJacketFinish:family==='polo'||family==='short-polo'?poloFinish:technicalFinish;
   const finish=factory(T,k,{geometry,skeleton:k.skin.skeleton,bindMatrix:k.skin.bindMatrix},data,{color:shirt,pantsColor:pants,trim:family==='tee'?shirt:trim,lapel:trim,recipe});for(const material of finish.patternMaterials||[finish.material])addPattern(material,rig,recipe);
   const top=attach('Tailored_Body',geometry,finish.material);top.userData.riderSurfaceRole=family==='cardigan'?'cotton-inset':'torso-shell';if(top.userData.riderSurfaceRole==='torso-shell')finish.material.shadowSide=T.BackSide;garments.push(top);
   for(const p of finish.pieces){if(family==='shirt'&&/Shirt_Chest_Pocket|Shirt_Folded_Collar|Shirt_Tailored_Cuffs/.test(p.name))addPattern(p.material,rig,recipe);const mesh=attach(p.name,p.geometry,p.material);mesh.userData.riderSurfaceRole=['Vest_Outer_Shell','Cardigan_Open_Knit_Shell'].includes(p.name)?'outer-shell':p.name==='Overalls_Denim_Bib_And_Straps'?'bib-straps':'detail';if(mesh.userData.riderSurfaceRole==='outer-shell')p.material.shadowSide=T.BackSide;garments.push(mesh);}
   const pantsGeo=d.pantsGeometry.clone(),pantsMat=new T.MeshStandardMaterial({color:pants,roughness:.86,side:T.DoubleSide}),pantsMesh=attach('Tailored_Legs',pantsGeo,pantsMat);garments.push(pantsMesh);
   const fields=d.pants.sourceVertexProvenance.map(coeff=>[0,1,2].map(axis=>coeff.reduce((sum,[id,t])=>sum+coverageFields[id][axis]*t,0)));
   pantsGeo.setAttribute('qaSourceCut',new T.Float32BufferAttribute(fields.flat(),3));pantsGeo.setAttribute('qaBootCoverage',new T.Float32BufferAttribute(d.pants.sourcePositions.map(p=>p[1]-(d.boots.parameters.topY-.006)),1));
   finishBreeches(T,k,pantsMat,pantsGeo,{color:pants});coverage.push(installSourceCoverage(T,pantsMesh,{shirt:false,boots:true}));
   rig.outfit={id:recipe.id,meshes:garments.slice()};rig.connectedWardrobe={family,constructionReady:!!families[recipe.id],catalogArtAccepted:false,buildCount:++buildCount,removedBodyPantsTriangles:removed,sourceBindDelta:{shirt:d.shirtGeometry.userData.sourceBindDelta,pants:d.pantsGeometry.userData.sourceBindDelta},finish:{...finish.evidence,waistFit},primaryMaterial:finish.primaryMaterial||finish.patternMaterials?.[0]||finish.material,shortSleeve:short?d.short.evidence:null,top,pants:pantsMesh};
   rig.clothingPose?.update();rig.accessoryKey=null;rig.refreshAccessories();callback?.();
  };
  const originalSetLook=rig.setLook;rig.setLook=f=>{currentLook={...f};originalSetLook(f);};
  // Fill synchronously so the base constructor's obsolete async outfit callback
  // cannot attach an empty outfit or start an imported boot request.
  rig.setOutfit(look.outfit||'riding');rig.setLook(look);
  const originalDispose=rig.dispose;rig.dispose=()=>{
   if(rig.disposed)return;disposeGarments();bodyCoverage.dispose();for(const mesh of bootMeshes){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();}bodyGeo.dispose();rig.outfit=null;rig.boots=null;originalDispose();
  };
  return installClothingPose39(T,rig);
 }
 return {...base,kit,ready:sex=>ready.get(sex==='m'?'m':'f')||null,build};
}
