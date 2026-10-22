import {CANINO_HAIR_STYLES,caninoHairId,installCaninoHair101} from './rider-canino-hair101.mjs?v=canino-style101-20261022';
import {installCaninoFit101} from './rider-canino-fit101.mjs?v=canino-style101-20261022';
/* Canino3d Studio's CC BY 4.0 character, adapted to the game's canonical65 rig.
 * The artist's head, eyes, lashes, hair and upper body remain separate authored
 * surfaces. Conversion and attribution: assets/models/rider/canino-LICENSE.txt. */
import {CLOTH_GLSL} from './rider-clothes.js?v=tailored-coats69-20261010';
import {installCaninoAccessories100} from './rider-canino-accessories100.mjs?v=canino-character100-20261021';
import {createRiderLibrary as createWardrobe} from './rider-wardrobe.js?v=character-foundation99-20261021';

const AUTHORED_TOPS=new Set(['polo','sportpolo','breton','daisytee']);
export function withCaninoCharacter(options,legacy,lifecycle){
 const T=options.THREE,female=createWardrobe({...options,riderMaterialLifecycle:{...lifecycle,trackRig:rig=>rig}}),loader=new options.GLTFLoader();
 let modelPromise;const ready=new Map();
 const model=()=>modelPromise||(modelPromise=loader.loadAsync(new URL('./models/rider/canino-f.glb?v=canino-character100-20261021',import.meta.url).href));
 function kit(body){if(body==='m')return legacy.kit(body);return Promise.all([female.kit('f'),model()]).then(([k,g])=>{k.canino100=g;k.characterSource='Canino3d Studio';ready.set('f',k);return k;});}
 function install(rig,look){
  const imported=[],owned=[],byMaterial=new Map(),bind=rig.body.bindMatrix;
  rig.root.name='Canino stylized rider';
  const oldHair=rig.hair;if(oldHair)oldHair.visible=false;
  rig.setHair=()=>{};
  // Dye only material color; retain the artist's UV textures and fine face detail.
  const dye=(material,kind)=>{
   const m=material.clone();owned.push(m);m.roughness=kind==='eye'?.26:kind==='hair'?.67:.78;m.metalness=0;
   if(kind==='hair'){m.alphaTest=.18;m.alphaToCoverage=true;m.transparent=false;m.depthWrite=true;m.side=T.DoubleSide;}
   if(kind==='lashes'){m.alphaTest=.3;m.transparent=false;m.depthWrite=true;m.side=T.DoubleSide;}
   if(kind==='eye'){m.transparent=false;m.opacity=1;m.depthWrite=true;}
   if(kind==='cornea'){m.transparent=true;m.opacity=.16;m.depthWrite=false;m.roughness=.10;}
   if(kind==='skin'||kind==='hair'||kind==='shirt'||kind==='eye'){
    const uniform=kind==='hair'?rig.u.uHair:kind==='shirt'?rig.u.uShirt:kind==='eye'?rig.u.uEye:rig.u.uSkin;
    m.onBeforeCompile=shader=>{
     shader.uniforms.uCaninoDye=uniform;
     shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCaninoBind;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCaninoBind=position;');
     shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uCaninoDye; varying vec3 vCaninoBind;');
     const tint=kind==='hair'?'float l=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)); diffuseColor.rgb=uCaninoDye*clamp(l*5.0,.18,1.6);':kind==='shirt'?'diffuseColor.rgb*=uCaninoDye;':kind==='eye'?'float iris=step(diffuseColor.r*1.15,diffuseColor.g)*step(diffuseColor.b*1.12,diffuseColor.g);float l=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(diffuseColor.rgb,uCaninoDye*clamp(l*2.8,.2,1.5),iris);':'diffuseColor.rgb*=uCaninoDye/vec3(.70,.42,.29);';
     shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n{'+tint+'}');
     if(kind==='shirt'){Object.assign(shader.uniforms,{uClothes:rig.u.uClothes,uTailor:rig.u.uTailor,uZ1:rig.u.uZ1,uZ2:rig.u.uZ2,uPants:rig.u.uPants});shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec4 uZ1,uZ2;uniform vec3 uPants;\n'+CLOTH_GLSL).replace('{'+tint+'}','{'+tint+'}\ndiffuseColor.rgb=riderFabric(diffuseColor.rgb,vCaninoBind);');}
     // Only the hands remain exposed beneath long sleeves. The authored T-shirt
     // owns its shoulder opening, so bare arms need no inferred surface mask.
     if(kind==='skin'&&material.name==='Std_Skin_Arm'){
      shader.uniforms.uCaninoLongSleeve=rig.canino100.longSleeve;
      shader.fragmentShader=shader.fragmentShader.replace('varying vec3 vCaninoBind;','varying vec3 vCaninoBind; uniform float uCaninoLongSleeve;').replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(uCaninoLongSleeve>.5 && abs(vCaninoBind.x)<.636) discard;');
     }
    };m.customProgramCacheKey=()=> 'canino100-'+kind+'-'+material.name;
   }
   return m;
  };
  rig.canino100={source:'Canino3d Studio',longSleeve:{value:0},imported,authoredTop:false};
  rig.kit.canino100.scene.traverse(src=>{
   if(!src.isMesh)return;
   const name=src.material.name;
   // Riding trousers and boots cover these body regions completely.
   if(name==='Std_Skin_Leg'||name==='Std_Skin_Body'||name==='lambert13')return;
   const kind=name==='lambert10'?'hair':name==='lambert7'?'shirt':name==='Std_Eyelash'?'lashes':/Cornea|Tearline|Occlusion/.test(name)?'cornea':/^Std_Eye_[LR]$/.test(name)?'eye':/Skin|Nails/.test(name)?'skin':'mouth';
   const geometry=src.geometry.clone();
   if(kind==='shirt'){
    const p=geometry.attributes.position;
    for(let i=0;i<p.count;i++){const y=p.getY(i),t=T.MathUtils.smoothstep(y,1.36,1.50);p.setY(i,y-.155*(1-t));}
    geometry.computeVertexNormals();geometry.computeBoundingSphere();
   }
   if(name==='Std_Nails'){
    const p=geometry.attributes.position,idx=geometry.index,keep=[];for(let i=0;i<idx.count;i+=3){const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2);if(Math.max(p.getY(a),p.getY(b),p.getY(c))>.8)keep.push(a,b,c);}geometry.setIndex(keep);
   }
   const m=new T.SkinnedMesh(geometry,dye(src.material,kind));m.name=src.name;m.bind(rig.body.skeleton,bind);m.frustumCulled=false;m.castShadow=!['cornea','lashes'].includes(kind)&&name!=='Std_Skin_Arm';m.receiveShadow=!['skin','hair','eye','cornea'].includes(kind);m.userData.canino100=true;m.userData.caninoKind=kind;rig.body.parent.add(m);imported.push(m);byMaterial.set(name,m);
  });
  installCaninoAccessories100(T,rig,{head:byMaterial.get('Std_Skin_Head'),eyes:[byMaterial.get('Std_Eye_R'),byMaterial.get('Std_Eye_L')],top:byMaterial.get('lambert7')});
  const originalLook=rig.setLook,originalOutfit=rig.setOutfit,originalDispose=rig.dispose;
  function refresh(f){
   const authored=AUTHORED_TOPS.has(rig.outfitId);rig.canino100.authoredTop=authored;rig.canino100.longSleeve.value=authored?0:1;
   for(const mesh of [rig.body,rig.face,rig.eyes,rig.brows,oldHair])if(mesh)mesh.visible=false;
   rig.root.getObjectByName('rider-eyelashes')?.removeFromParent();
   for(const mesh of rig.outfit?.meshes||[])mesh.visible=!authored||mesh.name==='Tailored_Legs';
   const top=byMaterial.get('lambert7');if(top)top.visible=authored;
   // Fit the existing riding helmet around the new, larger authored crown.
   rig.helmet.scale.set(1.10,1.04,1.12);rig.helmet.position.set(0,.013,-.017);
   rig.refreshAccessories();
  }
  rig.setOutfit=(id,cb)=>originalOutfit(id,()=>{refresh(look);cb?.();});
  rig.setLook=f=>{look={...f};originalLook(f);refresh(f);};
  rig.dispose=()=>{if(rig.disposed)return;for(const m of imported){m.removeFromParent();m.geometry.dispose();}for(const m of owned)m.dispose();originalDispose();};
  rig.setLook(look);installCaninoFit101(T,rig);installCaninoHair101(T,rig,{head:byMaterial.get('Std_Skin_Head'),hair:byMaterial.get('lambert10'),lifecycle,initialLook:look});return lifecycle.trackRig(rig);
 }
 return {...legacy,materialLifecycle:lifecycle,hairStyles:[...CANINO_HAIR_STYLES.map(h=>({...h,body:legacy.hairStyles.some(x=>x.id===h.id&&x.body.includes('m'))?['f','m']:['f']})),...legacy.hairStyles.filter(h=>h.body.includes('m')&&!CANINO_HAIR_STYLES.some(x=>x.id===h.id)).map(h=>({...h,body:['m']}))],hairId:(id,body)=>body==='m'?legacy.hairId(id,body):caninoHairId(id),kit,ready:body=>body==='m'?legacy.ready(body):ready.get('f')||null,
  outfitFor:(k,id)=>k.body==='m'?legacy.outfitFor(k,id):female.outfitFor(k,id),
  build(k,look){return k.body==='m'?legacy.build(k,look):install(female.build(k,{...look,neckwear:'none'}),look||{});},
  adoptRider:(R,rig,opt)=>rig.kit.body==='m'?legacy.adoptRider(R,rig,opt):female.adoptRider(R,rig,opt)
 };
}
