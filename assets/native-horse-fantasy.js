import {createEquineFantasyCoat,createEquineWingLibrary,EQUINE_FANTASY_APPEARANCE,fantasyThemes} from './equine-fantasy.js?v=artist-breeds-1';

// Fantasy adornments fit the cloned native horse, leaving its skin bindings,
// gait tracks, groom bones and Western tack intact. Creator dragons do not use
// this layer.
export const NATIVE_HORSE_FANTASY=EQUINE_FANTASY_APPEARANCE;
function appearanceFor(profile,key,overrides={}){
 const flags=profile.nativeRosterAppearance||{},registered=NATIVE_HORSE_FANTASY[key];
 const theme=flags.theme||(fantasyThemes().includes(flags.coat)?flags.coat:undefined);
 const config={...registered,...flags,...(theme?{theme}:{}),mane:flags.maneCol||flags.mane||registered?.mane,...overrides};
 // A naturally marked horse that inherits wings keeps its authored coat.
 if(!registered&&!flags.horn&&!flags.wings&&!flags.dragon&&!theme){delete config.body;delete config.mane;}
 return config;
}
const appearanceSignature=(key,c)=>JSON.stringify([key,c.theme||null,!!c.horn,!!c.wings,!!c.dragon,c.body||null,c.mane||null]);
const sharedWingLibraries=new WeakMap();
function defaultWings(THREE){
 let library=sharedWingLibraries.get(THREE);
 if(!library){
  // Without a camera/light context disable the optional feather transmission;
  // the feathers still receive the renderer's normal PBR lights and shadows.
  library=createEquineWingLibrary(THREE,{camera:{matrixWorldInverse:new THREE.Matrix4()},sun:{position:new THREE.Vector3(-3,7,5),intensity:.6}});
  sharedWingLibraries.set(THREE,library);
 }
 return library;
}

export function createNativeHorseFantasy({THREE,inst,key=inst?.key,wingLibrary,appearanceOverride}={}){
 if(!THREE||!inst?.profile?.nativeRoster||inst.profile.nativeKind!=='horse')return null;
 const config=appearanceFor(inst.profile,key,appearanceOverride);
 if(!config.body&&!config.theme&&!config.horn&&!config.wings&&!config.dragon)return null;
 if(inst.nativeFantasy)return inst.nativeFantasy;
 const scene=inst.scene,skin=inst.skin,bones=inst.bones||skin.skeleton.bones;
 const bone=name=>bones.find(b=>b.name===name),head=bone(inst.profile.nativeHeadBone||'head_019');
 const spine=bone('spine_04_012')||bone('spine_03_011');
 scene.updateWorldMatrix(true,true);
 const pointOf=b=>scene.worldToLocal(b.getWorldPosition(new THREE.Vector3()));
 // Position attachments in the outer scene's local coordinates. This wrapper
 // later scales the entire native rig, including tack and these attachments.
 const withers=Math.max(.65,(Number(inst.profile.withersM)||1.65)/Math.abs(scene.scale.y||1));
 const original=skin.material,materials=[],geometry=[],extras=[];
 let material=original;
 if(config.theme){
  material=createEquineFantasyCoat(THREE,original,config.theme,!!config.dragon);
  if(config.dragon){
   // This horse's UV islands cover less of the atlas than the older body did.
   // Keep the reused scale pattern fine enough to read as skin texture.
   const compile=material.onBeforeCompile,keyOf=material.customProgramCacheKey;
   material.onBeforeCompile=shader=>{compile(shader);shader.fragmentShader=shader.fragmentShader.replace('vec2(52.0,34.0)','vec2(156.0,102.0)');};
   material.customProgramCacheKey=()=>keyOf.call(material)+'_native_uv';
  }
  skin.material=material;inst.materials?.push(material);
 }else if(config.body){
  material=original.clone();material.name='NativeFantasyPearl_'+key;
  if(inst.nativeNeutralCoat)material.map=inst.nativeNeutralCoat;
  material.color.set(config.body);material.roughness=.52;material.metalness=.035;
  skin.material=material;inst.materials?.push(material);
 }
 const tintedHair=new Set(),hairRest=[];
 scene.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||mesh===skin||mesh.geometry.attributes.position.count!==inst.profile.hairVertexCount)return;
  for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
   if(tintedHair.has(m))continue;tintedHair.add(m);
   hairRest.push({material:m,color:m.color.clone(),roughness:m.roughness});
   if(config.mane)m.color.set(config.mane);m.roughness=Math.max(.38,m.roughness||.5);m.needsUpdate=true;
  }
 });
 const appearance={...config,material,update(time){material.userData.update?.(time);}};
 let pair=null,wingMount=null,horn=null;
 if(config.wings&&spine){
  wingLibrary=wingLibrary||defaultWings(THREE);pair=config.dragon?wingLibrary.buildDragonWings():wingLibrary.buildPegasusWings();
  const at=pointOf(spine),seat=inst.nativeSeatFollower?pointOf(inst.nativeSeatFollower):at;
  wingMount=new THREE.Group();wingMount.name='NativeFantasyWings';
  // The shoulder sockets flank the withers ahead of the saddle. The wrapper,
  // rather than each wing pivot, carries body scale: poseWings owns pivot scale.
  wingMount.position.set(0,seat.y-withers*.075,at.z+withers*.035);
  wingMount.scale.setScalar(withers/1.52);
  for(const wing of pair){wingMount.add(wing);wing.position.set(wing.userData.sgn*.23,0,0);wingLibrary.tintWingMats(wing,config.theme);}
  scene.add(wingMount);scene.updateWorldMatrix(true,true);spine.attach(wingMount);
 }
 if(config.horn&&!config.dragon&&head){
  const poll=pointOf(bone('head_end_027')||head),at=poll.clone();
  at.x=0;at.y-=withers*.072;
  // Fit the horn base to the actual front surface of this clone's forehead,
  // not to the joint pivot inside the skull. Sample only a narrow central strip
  // at the chosen forehead height; mane and tack are separate meshes.
  const p=new THREE.Vector3(),positions=skin.geometry.attributes.position;
  let front=-Infinity,bestY=at.y;
  skin.skeleton.update();
  for(let i=0;i<positions.count;i++){
   skin.getVertexPosition(i,p);p.applyMatrix4(skin.matrixWorld);scene.worldToLocal(p);
   if(Math.abs(p.x)<withers*.035&&Math.abs(p.y-at.y)<withers*.025&&p.z>poll.z&&p.z<poll.z+withers*.33&&p.z>front){front=p.z;bestY=p.y;}
  }
  at.z=Number.isFinite(front)?front-.004:poll.z+withers*.09;at.y=bestY;
  const length=withers*.205,radius=withers*.022;
  const mat=new THREE.MeshStandardMaterial({color:config.theme?'#d9c1ff':'#f1ddaf',roughness:.35,metalness:.25});materials.push(mat);
  horn=new THREE.Group();horn.name='NativeUnicornHorn';horn.position.copy(at);horn.rotation.x=Math.PI*.20;
  const coneGeo=new THREE.ConeGeometry(radius,length,24);geometry.push(coneGeo);
  const cone=new THREE.Mesh(coneGeo,mat);cone.position.y=length*.5;horn.add(cone);
  class Spiral extends THREE.Curve{getPoint(t,target=new THREE.Vector3()){const r=radius*(1-t)*1.025,a=t*Math.PI*12;return target.set(Math.cos(a)*r,t*length,Math.sin(a)*r);}}
  const spiralGeo=new THREE.TubeGeometry(new Spiral(),128,radius*.115,6,false);geometry.push(spiralGeo);horn.add(new THREE.Mesh(spiralGeo,mat));
  horn.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  scene.add(horn);scene.updateWorldMatrix(true,true);head.attach(horn);
 }
 if(config.dragon&&head){
  const ridge=new THREE.MeshStandardMaterial({color:config.mane||'#bca1e5',roughness:.48,metalness:.12});materials.push(ridge);
  const dark=new THREE.MeshStandardMaterial({color:'#352f3f',roughness:.62,metalness:.1});materials.push(dark);
  function spineMesh(height,radius,backSweep,mat){
   const geo=new THREE.ConeGeometry(radius,height,12,8);geo.translate(0,height*.5,0);
   const position=geo.attributes.position;for(let i=0;i<position.count;i++){const t=Math.max(0,position.getY(i)/height);position.setZ(i,position.getZ(i)-backSweep*t*t);}
   geo.computeVertexNormals();geometry.push(geo);const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=mesh.receiveShadow=true;return mesh;
  }
  const poll=pointOf(bone('head_end_027')||head),horns=new THREE.Group();horns.name='NativeDragonHorns';
  for(const sign of [-1,1]){const mesh=spineMesh(withers*.15,withers*.026,withers*.13,dark);mesh.position.set(sign*withers*.056,poll.y-withers*.025,poll.z-withers*.05);mesh.rotation.z=-sign*.18;horns.add(mesh);}
  scene.add(horns);scene.updateWorldMatrix(true,true);head.attach(horns);extras.push(horns);
  const p=new THREE.Vector3(),positions=skin.geometry.attributes.position;skin.skeleton.update();
  for(const [name,height] of [['neck_05_018',.10],['neck_04_017',.14],['neck_03_016',.15],['neck_02_015',.12]]){
   const anchor=bone(name);if(!anchor)continue;const at=pointOf(anchor);let top=-Infinity;
   for(let i=0;i<positions.count;i++){skin.getVertexPosition(i,p);p.applyMatrix4(skin.matrixWorld);scene.worldToLocal(p);if(Math.abs(p.x)<withers*.035&&Math.abs(p.z-at.z)<withers*.035&&p.y>top)top=p.y;}
   at.x=0;at.y=Number.isFinite(top)?top-withers*.012:at.y+withers*.09;
   const crest=spineMesh(withers*height,withers*.026,withers*.075,ridge);crest.name='NativeDragonCrest';crest.position.copy(at);
   scene.add(crest);scene.updateWorldMatrix(true,true);anchor.attach(crest);extras.push(crest);
  }
 }
 let time=0,open=false,openness=.04,beat=0,disposed=false;
 const controller={pair,horn,wingMount,extras,appearance,signature:appearanceSignature(key,config),
  get open(){return open;},get openness(){return openness;},get beat(){return beat;},
  toggle(){open=!open;this.update(0);},setOpen(value){open=!!value;this.update(0);},
  update(dt,{flying=false,power=.65,grounded=true,intensity=0}={}){
   if(disposed)return;
   dt=Math.max(0,Number(dt)||0);time+=dt;appearance.update(time);
   if(!pair)return;
   const target=open?.85:flying?1:!grounded?.65:(config.dragon?.02:.04)+Math.max(0,Math.min(1,intensity))*(config.dragon?.08:.22);
   const mix=dt>0?1-Math.exp(-dt*4):1;openness+=(target-openness)*mix;
   beat=(beat+dt*(flying?1.05+Math.max(0,Math.min(1,power))*.85:open?.35:.13))%1;
   wingLibrary.poseWings(pair,openness,beat,time);
  },
  dispose(){if(disposed)return;disposed=true;wingLibrary?.disposePair(pair);wingMount?.removeFromParent();horn?.removeFromParent();for(const o of extras)o.removeFromParent();for(const g of geometry)g.dispose();for(const m of materials)m.dispose();
   for(const entry of hairRest){entry.material.color.copy(entry.color);entry.material.roughness=entry.roughness;}
   if(material!==original){if(skin.material===material)skin.material=original;material.dispose();const i=inst.materials?.indexOf(material);if(i>=0)inst.materials.splice(i,1);}
  },
 };
 controller.update(0);inst.nativeFantasy=controller;inst.fantasyAppearance=appearance;
 return controller;
}

// Called before saved dyes/markings are reapplied. A foal can inherit a horn
// independently of its breed, and explicit false means that trait is absent.
export function syncNativeHorseFantasy({THREE,rig,horse}={}){
 if(!rig?.profile?.nativeRoster||rig.profile.nativeKind!=='horse'||!horse)return rig?.nativeFantasy||null;
 const key=rig.key||rig.modelKey||rig.profile.id,overrides={};
 for(const trait of ['horn','wings','dragon'])if(horse[trait]!==undefined)overrides[trait]=!!horse[trait];
 if(horse.coat!==undefined)overrides.theme=horse.coat||null;
 const config=appearanceFor(rig.profile,key,overrides),signature=appearanceSignature(key,config);
 if((rig.nativeFantasy?.signature||rig.nativeFantasySignature)===signature)return rig.nativeFantasy||null;
 rig.nativeCustomization?.dispose?.();rig.nativeFantasy?.dispose?.();
 rig.nativeFantasy=null;rig.fantasyAppearance=null;rig.skin.material=rig.baseMat;
 rig.nativeFantasy=createNativeHorseFantasy({THREE,inst:rig,key,appearanceOverride:overrides});
 rig.fantasyAppearance=rig.nativeFantasy?.appearance||null;
 rig.nativeFantasySignature=signature;rig.nativeCanFly=!!config.wings;
 return rig.nativeFantasy;
}
