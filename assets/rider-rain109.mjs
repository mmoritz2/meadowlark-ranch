import {createRiderLibrary as createWardrobe} from './rider-wardrobe.js?v=character-foundation99-20261021';
import {prepareCaninoStance102} from './rider-canino-stance102.mjs?v=canino-stance102-20261022';
import {createTriangleSurface} from './rider-head-surface.js?v=character-polish-20261009';
import {installRainAccessories109} from './rider-rain-accessories109.mjs?v=rain-character109-20261023';
import {installRainHelmet109} from './rider-rain-helmet109.mjs?v=rain-character109-20261023';

// These are variations of Rain's authored hair pieces, with their fitted crown
// retained. Unsupported old saved styles fall back to the complete ponytail.
export const RAIN_HAIR_STYLES=[
 {id:'ponytail',label:'Sculpted ponytail',body:['f']},
 {id:'bun',label:'Sculpted bun',body:['f']},
 {id:'crop',label:'Swept crop',body:['f']},
];
export function rainHairId(id){
 return id==='bun'||id==='lowbun'||id==='highbun'?'bun':id==='crop'||id==='short'||id==='pixie'?'crop':'ponytail';
}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const partName=mesh=>mesh.name.replace(/^Rain[_-]/i,'').replace(/^GEO-rain-/,'').replace(/-(evaluated|preview)$/,'');
const shortOutfits=new Set(['polo','sportpolo','breton','daisytee']);
const noSleeveOutfits=new Set([]);
const RAIN_HELMET_RIM_GLSL=`
float rainHelmetRim(float th,float cy){float a=abs(th)/3.14159265359;
 return a<.28?cy+.041-.028*(a/.28):a<.62?cy+.013-.053*((a-.28)/.34):cy-.040-.020*((a-.62)/.38);
}`;

function sourceDye(T,material,kind,uniforms,state){
 const m=material.clone(),previous=m.onBeforeCompile,previousKey=m.customProgramCacheKey();
 // Keep the accepted painted skin, physical eye material and all source maps.
 // Colours only change after a corresponding wardrobe field is supplied.
 const dye=kind==='hair'?uniforms.hair:kind==='top'?uniforms.shirt:kind==='jeans'?uniforms.pants:kind==='shoes'?uniforms.boots:kind==='head'||kind==='body'?uniforms.skin:null;
 if(dye||kind==='body'||kind==='eyes'){
  m.onBeforeCompile=shader=>{
   previous.call(m,shader);
   shader.uniforms.uRainDye=dye||uniforms.skin;
   shader.uniforms.uRainDyeEnabled=kind==='hair'?uniforms.hairOn:kind==='top'?uniforms.shirtOn:kind==='jeans'?uniforms.pantsOn:kind==='shoes'?uniforms.bootsOn:uniforms.skinOn;
   shader.uniforms.uRainEye=uniforms.eyes;shader.uniforms.uRainEyeEnabled=uniforms.eyesOn;
   shader.uniforms.uRainSourceOutfit=state.sourceUniform;shader.uniforms.uRainArmCuff=state.armCuff;
   if(kind==='hair')Object.assign(shader.uniforms,{uRainHelmet:state.helmetUniforms.enabled,uRainHeadInverse:state.helmetUniforms.headInverse,uRainHelmetInverse:state.helmetUniforms.objectInverse,uRainHelmetCenter:state.helmetUniforms.center});
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRainBind;'+(kind==='body'?'\nattribute vec2 rainArmCoverage;varying vec2 vRainArm;':'')).replace('#include <begin_vertex>','#include <begin_vertex>\nvRainBind=position;'+(kind==='body'?'vRainArm=rainArmCoverage;':''));
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vRainBind;'+(kind==='body'?'varying vec2 vRainArm;':'')+'uniform vec3 uRainDye,uRainEye;uniform float uRainDyeEnabled,uRainEyeEnabled,uRainSourceOutfit,uRainArmCuff;');
   let tint='';
   if(kind==='hair')tint='float l=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(diffuseColor.rgb,uRainDye*clamp(l/.22,.12,2.5),uRainDyeEnabled);';
   else if(kind==='eyes')tint='float iris=step(diffuseColor.r*1.08,diffuseColor.g)*step(diffuseColor.b*1.04,diffuseColor.g);float l=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(diffuseColor.rgb,uRainEye*clamp(l/.25,.14,2.5),iris*uRainEyeEnabled);';
   else if(kind==='head'||kind==='body')tint='diffuseColor.rgb*=mix(vec3(1.0),uRainDye/vec3(.694,.410,.279),uRainDyeEnabled);';
   else tint='float l=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(diffuseColor.rgb,uRainDye*clamp(l/.35,.14,2.2),uRainDyeEnabled);';
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n{'+tint+'}');
   if(kind==='hair'){
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uRainHelmet;uniform mat4 uRainHeadInverse,uRainHelmetInverse;uniform vec3 uRainHelmetCenter;\n'+RAIN_HELMET_RIM_GLSL);
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(uRainHelmet>.5){vec3 hp=(uRainHelmetInverse*uRainHeadInverse*vec4(vRainBind,1.0)).xyz;float rim=rainHelmetRim(atan(hp.x-uRainHelmetCenter.x,hp.z-uRainHelmetCenter.z),uRainHelmetCenter.y);if(hp.y>rim-.002)discard;}');
   }
   if(kind==='body')shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(uRainSourceOutfit<.5 && vRainBind.y<'+Number(state.neckCut).toFixed(6)+' && vRainArm.x<.025 && (vRainArm.y<.025 || abs(vRainBind.x)<uRainArmCuff))discard;');
  };
  m.customProgramCacheKey=()=>previousKey+'-rain109-'+kind+(kind==='hair'?'-helmet-rim1':'');m.needsUpdate=true;
 }
 return m;
}

/** Fit the old wardrobe to the new body using measured bind-space surface
 * differences. Each displacement is applied once and shared details follow the
 * same smooth field, retaining seams, relief, joint weights and UVs. */
function garmentFitter(T,rig,parts){
 const original=createTriangleSurface(T,rig.kit.garmentSkin.geometry),targets=['body','top','jeans'].filter(n=>parts.has(n)).map(n=>({surface:createTriangleSurface(T,parts.get(n).geometry),reserve:n==='body'?0:n==='top'?.003:.0025})),fitted=new WeakSet();
 const oldGeometry=rig.kit.garmentSkin.geometry,oldPosition=oldGeometry.attributes.position;
 const stats={geometries:0,vertices:0,maxDisplacementM:0,misses:0},V=(...x)=>new T.Vector3(...x),axisZ=rig.kit.zones.neckZ-.012;
 const grid=new Map(),step=.018;
 function sample(ai,yi){
  const key=ai+'|'+yi;
  if(grid.has(key))return grid.get(key);
  const a=ai*.13,h=yi*step,dir=V(Math.sin(a),0,Math.cos(a)),origin=V(dir.x*.6,h,axisZ+dir.z*.6),back=dir.clone().negate();
  const accept=hit=>hit.point.x*dir.x+(hit.point.z-axisZ)*dir.z>.004;
  const one=original.cast(origin,back,accept,.6);let two=null;
  for(const target of targets){const hit=target.surface.cast(origin,back,accept,.6);if(hit){hit.point.addScaledVector(dir,-target.reserve);hit.distance+=target.reserve;if(!two||hit.distance<two.distance)two=hit;}}
  const d=one&&two?T.MathUtils.clamp(two.point.clone().sub(one.point).dot(dir),-.055,.055):0;
  if(!one||!two)stats.misses++;const value=dir.multiplyScalar(d);grid.set(key,value);return value;
 }
 function displacement(x,y,z){
  const a=Math.atan2(x,z-axisZ)/.13,h=y/step,ai=Math.floor(a),yi=Math.floor(h),fa=a-ai,fh=h-yi;
  return V().addScaledVector(sample(ai,yi),(1-fa)*(1-fh)).addScaledVector(sample(ai+1,yi),fa*(1-fh)).addScaledVector(sample(ai,yi+1),(1-fa)*fh).addScaledVector(sample(ai+1,yi+1),fa*fh);
 }
 function apply(){
  const meshes=(rig.outfit?.meshes||[]).filter(m=>m.isSkinnedMesh&&!fitted.has(m.geometry)&&!/Feet|Boot/.test(m.name));
  if(!meshes.length)return;
  rig.clothingPose?.release();
  for(const mesh of meshes){
   const g=mesh.geometry;if(fitted.has(g))continue;fitted.add(g);const p=g.attributes.position;
   for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    // Keep limbs and lower hems on their authored joint frame. The trunk field
    // fades before the shoulder, waist and inner seat rather than folding seams.
    const weight=(1-smooth(.18,.25,Math.abs(x)))*smooth(.77,.87,y)*(1-smooth(rig.kit.zones.armY-.10,rig.kit.zones.armY+.025,y));
    if(weight<=0)continue;const delta=displacement(x,y,z).clone().multiplyScalar(weight);
    p.setXYZ(i,x+delta.x,y,z+delta.z);stats.vertices++;stats.maxDisplacementM=Math.max(stats.maxDisplacementM,delta.length());
   }
   p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();stats.geometries++;
  }
  rig.clothingPose?.update();
 }
 return {apply,evidence:()=>({...stats,sourceVertices:oldPosition.count,targetSurfaces:['body','top','jeans'],clothThicknessReserveM:.003}),dispose(){original.dispose();targets.forEach(t=>t.surface.dispose());grid.clear();}};
}

function measureSourceSoles(T,rig,shoes){
 const saved=new Map(Object.entries(rig.bones).map(([name,b])=>[name,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}])),contacts={},V=(...v)=>new T.Vector3(...v);
 try{
  for(const[name,s]of rig.kit.seat.local){const b=rig.bones[name];if(b){b.position.copy(s.p);b.quaternion.copy(s.q);}}
  rig.root.updateWorldMatrix(true,true);rig.root.updateMatrixWorld(true);rig.body.skeleton.update();
  const matrix=rig.root.matrixWorld.clone().invert(),point=name=>rig.bones[name].getWorldPosition(V()).applyMatrix4(matrix),a=shoes.geometry.attributes,names=rig.body.skeleton.bones.map(b=>b.name);
  for(const S of['R','L']){
   const side=S==='R'?'l':'r',ankle=point('foot_'+side),ball=point('ball_'+side),forward=ball.clone().sub(ankle).normalize(),up=V(0,1,0).addScaledVector(forward,-forward.y).normalize(),right=V().crossVectors(forward,up).normalize(),near=[];
   for(let i=0;i<a.position.count;i++){
    let owned=0;for(let k=0;k<4;k++)if(['foot_'+side,'ball_'+side].includes(names[a.skinIndex.getComponent(i,k)]))owned+=a.skinWeight.getComponent(i,k);
    if(owned<.65)continue;const p=shoes.getVertexPosition(i,V()).applyMatrix4(shoes.matrixWorld).applyMatrix4(matrix),delta=p.clone().sub(ball);
    if(Math.abs(delta.dot(forward))<.045&&Math.abs(delta.dot(right))<.045)near.push({p,height:delta.dot(up),id:i});
   }
   if(!near.length)throw Error('Rain shoe lacks measured '+S+' ball-of-foot support');
   const lowest=Math.min(...near.map(v=>v.height)),sole=near.filter(v=>v.height<=lowest+.006),contact=V();for(const v of sole)contact.add(v.p);contact.multiplyScalar(1/sole.length);
   contacts[S]={point:contact.sub(ankle),forward:ball.sub(ankle),samples:sole.length,vertices:sole.map(v=>v.id),source:'Rain_shoes'};
  }
 }finally{for(const[name,s]of saved){const b=rig.bones[name];b.position.copy(s.p);b.quaternion.copy(s.q);b.scale.copy(s.s);}rig.root.updateMatrixWorld(true);rig.body.skeleton.update();}
 return contacts;
}

function sourceHair(T,rig,parts){
 const pony=parts.get('hair_ponytail'),strand=parts.get('hair_strand'),band=parts.get('hairband'),crown=parts.get('hair_main');
 const sources=new Map(),owned=new Set(),headId=rig.body.skeleton.bones.indexOf(rig.bones.Head),inverse=rig.body.skeleton.boneInverses[headId],bind=rig.body.bindMatrix;
 const local=inverse.clone().multiply(bind),world=local.clone().invert(),V=(...x)=>new T.Vector3(...x);
 for(const m of[pony,strand,band])if(m){const g=m.geometry.clone();m.geometry=g;owned.add(g);sources.set(m,g.attributes.position.array.slice());}
 let key='',style='ponytail',helmet=false;
 const anchor=band?new T.Box3().setFromBufferAttribute(band.geometry.attributes.position).getCenter(V()).applyMatrix4(local):V(0,.09,-.08);
 function apply(id,on=false){
  style=rainHairId(id);helmet=!!on;const next=style+'|'+helmet;
  // Creator staging can re-enable shadows on every mesh after construction.
  // Restore the clipped crown's depth-pass state even for an unchanged look.
  if(next===key){for(const m of[crown,strand,band])if(m)m.castShadow=!helmet;return;}key=next;
  for(const[m,source]of sources){const p=m.geometry.attributes.position;p.array.set(source);m.visible=true;
   if(m===pony&&style==='bun'){
    for(let i=0;i<p.count;i++){
     const q=V().fromBufferAttribute(p,i).applyMatrix4(local),delta=q.clone().sub(anchor),t=smooth(.016,.065,delta.length());
     // The attachment is exact; the hanging tail gathers into an oval roll
     // immediately behind the tie instead of separating from the crown.
     const gathered=V(delta.x*1.30,delta.y*.16-.012,-.035+delta.z*.23);
     q.copy(anchor).add(delta.lerp(gathered,t));q.applyMatrix4(world);p.setXYZ(i,q.x,q.y,q.z);
    }
   }
   if(style==='crop'&&(m===pony||m===band))m.visible=false;
   if(helmet&&m===strand)m.visible=false;
   p.needsUpdate=true;m.geometry.computeVertexNormals();m.geometry.computeBoundingBox();m.geometry.computeBoundingSphere();
  }
  if(crown)crown.visible=true;
  // A clipped quiff must not remain in the unpatched depth shadow pass. Lower
  // ponytail pieces still cast below the helmet; crown/strand/band resume their
  // source shadows immediately when the helmet is removed.
  for(const m of[crown,strand,band])if(m)m.castShadow=!helmet;
 }
 return {apply,get style(){return style;},evidence:()=>({style,helmet,sourceCrownPreserved:true,variants:RAIN_HAIR_STYLES.map(s=>s.id)}),dispose(){for(const g of owned)g.dispose();sources.clear();}};
}

export function installRain109(T,rig,initialLook={},lifecycle){
 if(rig.rain109)return rig;
 const imported=[],materials=[],privateGeometry=new Set(),parts=new Map(),bind=rig.body.bindMatrix,oldHair=rig.hair;
 const old={look:rig.setLook,outfit:rig.setOutfit,hair:rig.setHair,dispose:rig.dispose,refresh:rig.refreshAccessories,update:rig.updateHairMass};
 let look={...initialLook},nested=0,dead=false;
 const color=()=>({value:new T.Color(1,1,1)}),toggle=()=>({value:0});
 const uniforms={hair:color(),shirt:color(),pants:color(),boots:color(),skin:color(),eyes:color(),hairOn:toggle(),shirtOn:toggle(),pantsOn:toggle(),bootsOn:toggle(),skinOn:toggle(),eyesOn:toggle()};
 const state=rig.rain109={source:'Rain Rig (CC) Blender Foundation | studio.blender.org',imported,eyeColors:rig.rainEyeColors109||[],sourceOutfit:true,sourceUniform:{value:1},armCuff:{value:rig.kit.zones.cuffX-.012},neckCut:rig.kit.zones.neckY+.055};
 const headIndex=rig.body.skeleton.bones.indexOf(rig.bones.Head),helmetGeo=rig.kit.helmetGeo;
 rig.helmet.updateMatrix();
 state.helmetUniforms={enabled:rig.u.uHelmet,headInverse:{value:rig.body.skeleton.boneInverses[headIndex].clone().multiply(bind)},objectInverse:{value:rig.helmet.matrix.clone().invert()},center:{value:new T.Vector3(helmetGeo.cx,helmetGeo.cy,helmetGeo.cz)}};
 rig.root.name='Rain rider';
 rig.kit.rain109.scene.traverse(src=>{
  if(!src.isMesh)return;const name=partName(src),kind=name.startsWith('hair')?'hair':name;
  const material=Array.isArray(src.material)?src.material.map(m=>sourceDye(T,m,kind,uniforms,state)):sourceDye(T,src.material,kind,uniforms,state);
  materials.push(...(Array.isArray(material)?material:[material]));
  let geometry=src.geometry;
  if(name==='body'){
   geometry=src.geometry.clone();privateGeometry.add(geometry);
   const a=geometry.attributes,coverage=new Float32Array(a.position.count*2),names=rig.body.skeleton.bones.map(b=>b.name);let handVertices=0,armVertices=0;
   for(let i=0;i<a.position.count;i++){let hand=0,arm=0;for(let k=0;k<4;k++){const bone=names[a.skinIndex.getComponent(i,k)]||'',w=a.skinWeight.getComponent(i,k);if(/^(hand|index|middle|ring|pinky|thumb)_/.test(bone))hand+=w;if(/^(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)_/.test(bone))arm+=w;}coverage[i*2]=hand;coverage[i*2+1]=arm;if(hand>.025)handVertices++;if(arm>.025)armVertices++;}
   geometry.setAttribute('rainArmCoverage',new T.BufferAttribute(coverage,2));state.skinCoverage={handVertices,armVertices,source:'canonical deform weights'};
  }
  const mesh=new T.SkinnedMesh(geometry,material);mesh.name='Rain_'+name;mesh.bind(rig.body.skeleton,bind);mesh.frustumCulled=false;
  mesh.castShadow=!['eyes','eye_dots','eyelashes','eyebrows','body','head'].includes(name);mesh.receiveShadow=!['eyes','eye_dots','eyelashes','eyebrows','head','body'].includes(name);mesh.userData.rain109=true;mesh.userData.rainPart=name;
  if(name==='shoes')mesh.userData.riderSurfaceRole='footwear';
  rig.body.parent.add(mesh);parts.set(name,mesh);imported.push(mesh);
 });
 if(!parts.get('head')||!parts.get('body')||!parts.get('eyes'))throw Error('Complete Rain109 source body, head and eyes required');
 const fittedHelmet=installRainHelmet109(T,rig,{head:parts.get('head'),eyes:parts.get('eyes')});
 state.helmetUniforms.center.value.set(fittedHelmet.metadata.cx,fittedHelmet.metadata.cy,fittedHelmet.metadata.cz);
 state.helmetMetadata=fittedHelmet.metadata;
 const hair=sourceHair(T,rig,parts),fit=garmentFitter(T,rig,parts),sourceSoles=measureSourceSoles(T,rig,parts.get('shoes'));
 state.parts=parts;state.hair=hair;state.fit=fit;
 state.sourceFootContacts=sourceSoles;state.updateSoleContacts=()=>{if(state.adoptedR)for(const S of['L','R'])state.adoptedR.sk.by['foot'+S].userData.soleContact=state.sourceOutfit?sourceSoles[S]:rig.kit.seat.footContacts[S];};
 function updateColors(){
  for(const key of['hair','shirt','pants','boots','skin']){if(look[key]){uniforms[key].value.set(look[key]);uniforms[key+'On'].value=1;}else uniforms[key+'On'].value=0;}
  const e=rig.rain109.eyeColors?.find(e=>e.id===look.eyes);if(e){uniforms.eyes.value.set(e.col);uniforms.eyesOn.value=1;}else uniforms.eyesOn.value=0;
 }
 function refresh(){
  if(dead||rig.disposed)return;
  state.sourceOutfit=rig.outfitId==='riding';state.sourceUniform.value=state.sourceOutfit?1:0;
  const cuff=shortOutfits.has(rig.outfitId)?.315:noSleeveOutfits.has(rig.outfitId)?.205:rig.kit.zones.cuffX-.012;state.armCuff.value=cuff;
  for(const m of[rig.body,rig.face,rig.eyes,rig.brows,oldHair])if(m)m.visible=false;
  rig.root.getObjectByName('rider-eyelashes')?.removeFromParent();
  for(const m of rig.outfit?.meshes||[])m.visible=!state.sourceOutfit;
  for(const m of rig.boots||[])m.visible=!state.sourceOutfit;
  for(const name of['top','jeans','shoes','scarf'])if(parts.has(name))parts.get(name).visible=state.sourceOutfit;
  hair.apply(look.hairStyle,rig.u.uHelmet.value>.5);
  rig.helmet.updateMatrix();state.helmetUniforms.objectInverse.value.copy(rig.helmet.matrix).invert();
  fit.apply();updateColors();state.updateSoleContacts();
 }
 rig.setHair=(id,colorValue,helmet)=>{if(!nested)look={...look,hairStyle:rainHairId(id),...(colorValue?{hair:colorValue}:{})};if(typeof helmet==='boolean')rig.u.uHelmet.value=helmet?1:0;hair.apply(look.hairStyle,rig.u.uHelmet.value>.5);updateColors();};
 rig.setOutfit=(id,callback)=>{look={...look,outfit:id||'riding'};nested++;try{return old.outfit.call(rig,id,()=>{if(!nested)refresh();callback?.();});}finally{if(!--nested)refresh();}};
 rig.setLook=f=>{look={...look,...f};nested++;try{return old.look.call(rig,look);}finally{if(!--nested)refresh();}};
 rig.refreshAccessories=(...args)=>old.refresh?.apply(rig,args);
 // The old crown is retained only for its owner's cleanup; the source hair is
 // the sole visible hair and receives all style changes.
 rig.updateHairMass=(...args)=>{old.update?.apply(rig,args);};
 rig.dispose=(...args)=>{if(dead)return;dead=true;fittedHelmet.dispose();hair.dispose();fit.dispose();for(const m of imported)m.removeFromParent();privateGeometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());return old.dispose.apply(rig,args);};
 rig.setLook(look);
 installRainAccessories109(T,rig,{head:parts.get('head'),eyes:[parts.get('eyes')],top:parts.get('top')});
 state.inspect=()=>({source:state.source,sourceOutfit:state.sourceOutfit,sourceMeshCount:imported.length,hair:hair.evidence(),garmentFit:fit.evidence(),skinCoverage:state.skinCoverage,sourceSoleSamples:Object.fromEntries(Object.entries(sourceSoles).map(([s,c])=>[s,c.samples])),acceptedFace:'Rain108',canonicalDriverVisible:rig.body.visible});
 return lifecycle?.trackRig?lifecycle.trackRig(rig):rig;
}

export function withRainCharacter(options,legacy,lifecycle){
 const T=options.THREE,female=createWardrobe({...options,riderMaterialLifecycle:{...lifecycle,trackRig:rig=>rig}}),loader=new options.GLTFLoader(),ready=new Map();
 let pending,modelPromise;const model=()=>modelPromise||(modelPromise=loader.loadAsync(new URL('./models/rider/rain-f.glb?v=rain-character109-20261023',import.meta.url).href));
 const kit=body=>body==='m'?legacy.kit(body):pending||(pending=Promise.all([female.kit('f'),model()]).then(([k,g])=>{prepareCaninoStance102(T,k);k.rain109=g;k.characterSource='Blender Studio Rain';ready.set('f',k);return k;}));
 return {...legacy,materialLifecycle:lifecycle,hairStyles:[...RAIN_HAIR_STYLES.map(h=>({...h,body:legacy.hairStyles.some(x=>x.id===h.id&&x.body.includes('m'))?['f','m']:['f']})),...legacy.hairStyles.filter(h=>h.body.includes('m')&&!RAIN_HAIR_STYLES.some(x=>x.id===h.id)).map(h=>({...h,body:['m']}))],hairId:(id,body)=>body==='m'?legacy.hairId(id,body):rainHairId(id),kit,ready:body=>body==='m'?legacy.ready(body):ready.get('f')||null,
  outfitFor:(k,id)=>k.body==='m'?legacy.outfitFor(k,id):female.outfitFor(k,id),
  build(k,look={}){if(k.body==='m')return legacy.build(k,look);const rig=female.build(k,{...look,neckwear:'none'});rig.rainEyeColors109=legacy.eyes;return installRain109(T,rig,look,lifecycle);},
  adoptRider(R,rig,opt){if(rig.kit.body==='m')return legacy.adoptRider(R,rig,opt);const result=female.adoptRider(R,rig,opt);rig.rain109.adoptedR=R;rig.rain109.updateSoleContacts();return result;}
 };
}
