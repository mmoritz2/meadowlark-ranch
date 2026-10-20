// CPU material/loader fixtures. No browser, WebGL, external requests or game saves.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{register}=require('node:module');
const root=path.resolve(__dirname,'..'),threeURL=pathToFileURL(path.join(root,'assets/vendor/three/build/three.module.js')).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(specifier,context,next){if(specifier==='three')return {url:${JSON.stringify(threeURL)},shortCircuit:true};return next(specifier,context);}`));
let checks=0;function check(value,message){assert(value,message);checks++;}
const load=relative=>import(pathToFileURL(path.join(root,relative)).href);
(async()=>{
 const THREE=await import(threeURL),{clone}=await load('assets/vendor/three/examples/jsm/utils/SkeletonUtils.js');
 const {applyNativeHorseMaterials:apply,NATIVE_HORSE_MATERIAL_FINISH:finish,NATIVE_COAT_SHADING:shading,NATIVE_LEG_COAT_SHADING:legShading,NATIVE_COAT_REALISM:realism}=await load('assets/native-horse-materials.js');
 const {createBreedLibrary}=await load('assets/breed-models.js');
 const {NATIVE_BREED_PROFILES}=await load('assets/native-breed-profiles.js');
 const {configureNativeCustomization}=await load('assets/native-horse-customization.js');
 const {createEquineFantasyCoat}=await load('assets/equine-fantasy.js');
 const materialsOf=scene=>{const out={};scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])out[m.name]=m;});return out;};
 const snapshot=m=>JSON.stringify({name:m.name,color:m.color.toArray(),roughness:m.roughness,metalness:m.metalness,specularIntensity:m.specularIntensity,envMapIntensity:m.envMapIntensity,sheen:m.sheen,sheenColor:m.sheenColor?.toArray(),sheenRoughness:m.sheenRoughness,clearcoat:m.clearcoat,clearcoatRoughness:m.clearcoatRoughness,alphaTest:m.alphaTest,alphaToCoverage:m.alphaToCoverage,transparent:m.transparent,depthWrite:m.depthWrite,map:m.map?.uuid});
 function fixtureMaterial(def,index){const p=def.pbrMetallicRoughness,m=new THREE.MeshPhysicalMaterial({name:def.name,roughness:p.roughnessFactor,metalness:p.metallicFactor,specularIntensity:def.extensions.KHR_materials_specular.specularFactor,side:THREE.DoubleSide,alphaTest:def.alphaCutoff||0,map:new THREE.Texture({fixture:index})});m.color.fromArray(p.baseColorFactor);return m;}
 function fixtureAsset(key,defs,{nativeRoster=false,nativeDragon=false}={}){
  const scene=new THREE.Group(),normalization=new THREE.Group(),nativeRoot=new THREE.Group(),head=new THREE.Bone(),seat=new THREE.Bone();head.name='head_019';seat.name='saddle_0333';nativeRoot.add(head,seat);scene.add(normalization);normalization.add(nativeRoot);
  const skeleton=new THREE.Skeleton([head,seat]),materials=defs.map(fixtureMaterial);let skin;
  for(let i=0;i<materials.length;i++){
   const n=i+3,geo=new THREE.BufferGeometry(),pos=new Float32Array(n*3),ids=new Uint16Array(n*4),weights=new Float32Array(n*4);
   for(let j=0;j<n;j++){pos.set([j*.1,j%2*.2,j*.07],j*3);weights[j*4]=1;}
   geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(n*3).fill(.5),3));geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(n*2).fill(.5),2));geo.setAttribute('skinIndex',new THREE.BufferAttribute(ids,4));geo.setAttribute('skinWeight',new THREE.BufferAttribute(weights,4));
   const mesh=new THREE.SkinnedMesh(geo,materials[i]);mesh.name=materials[i].name+' mesh';nativeRoot.add(mesh);mesh.bind(skeleton);if(i===0)skin=mesh;
  }
  return {key,scene,skin,profile:{...NATIVE_BREED_PROFILES[key],nativeRoster,nativeDragon,bodyVertexCount:3,hairVertexCount:5,tackVertexCount:6,nativeScale:1,nativeTranslation:[0,0,0],nativeSourceSeat:[0,0,0]},fitScale:1,fitY:0,baseMat:skin.material,nativeNeutralCoat:nativeRoster?materials[0].map:undefined,animations:[]};
 }
 const previousFetch=global.fetch;
 global.fetch=async url=>{const u=new URL(url);return {ok:true,json:async()=>JSON.parse(fs.readFileSync(u,'utf8'))};};
 const library=createBreedLibrary({THREE,clone,GLTFLoader:class{}});await library.manifestReady;global.fetch=previousFetch;
 const docs={};
 for(const [key,dir] of [['white-western','white'],['bay-western','bay'],['bay-sporthorse-native','sporthorse']]){
  const bytes=fs.readFileSync(path.join(root,'review/native-trot-reference-kit',dir,'model.glb')),doc=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));docs[key]=doc;
  const source=fixtureAsset(key,doc.materials),sourceM=materialsOf(source.scene),before=Object.fromEntries(Object.entries(sourceM).map(([k,m])=>[k,snapshot(m)]));
  const positions=source.skin.geometry.attributes.position.array.slice(),bonePose=source.skin.skeleton.bones.map(b=>b.quaternion.toArray());
  const baseline=library.instantiate(source,{materialPolish:false}),rig=library.instantiate(source),m=materialsOf(rig.scene),untreated=materialsOf(baseline.scene);
  check(rig.nativeMaterialPolish.body===1&&rig.nativeMaterialPolish.hair===1&&rig.nativeMaterialPolish.eye===1,key+' treats all three intended surfaces');
  check(!baseline.nativeMaterialPolish,key+' baseline opt-out stays untreated');
  for(const name of Object.keys(m)){
   check(snapshot(sourceM[name])===before[name]&&snapshot(untreated[name])===before[name],key+' cached source and separate baseline remain immutable: '+name);
   check(m[name]!==sourceM[name]&&m[name]!==untreated[name],key+' actor owns private material: '+name);
   check(m[name].map===sourceM[name].map&&m[name].map===untreated[name].map,key+' source map/UV sampling preserved: '+name);
  }
  for(const name of ['M_Saddle1','M_Saddle2'])check(snapshot(m[name])===before[name],key+' original tack finish is untouched');
  check(m.M_Body.sheen===finish.body.sheen&&m.M_Body.sheenRoughness===finish.body.sheenRoughness&&m.M_Eye.clearcoat===finish.eye.clearcoat,key+' broad coat sheen and eye tear-film properties are applied');
  check(m.M_Body.color.equals(sourceM.M_Body.color)&&m.M_Body.roughness===finish.body.roughness&&m.M_Body.specularIntensity>0,key+' coat retains pigment with restored dielectric highlights');
  check(m.M_Eye.color.r>m.M_Eye.color.g&&m.M_Eye.color.g>m.M_Eye.color.b&&m.M_Eye.roughness<.25&&m.M_Eye.specularIntensity>0,key+' iris is warm dark with a controlled moist surface');
  check(m.M_Hair.alphaTest===finish.hair.alphaCutoff&&m.M_Hair.alphaToCoverage&&!m.M_Hair.transparent&&m.M_Hair.depthWrite,key+' hair keeps cutout depth with antialiased edges');
  const ratio=sourceM.M_Hair.color.r?m.M_Hair.color.r/sourceM.M_Hair.color.r:1;
  check(ratio>=1&&ratio<=1.4&&Math.abs(m.M_Hair.color.g/sourceM.M_Hair.color.g-ratio)<1e-10,key+' dark-hair lift is bounded and hue preserving');
  const once=snapshot(m.M_Hair);apply({THREE,rig});check(snapshot(m.M_Hair)===once,key+' repeat application never accumulates brightness');
  check(source.skin.geometry===rig.skin.geometry&&positions.every((x,i)=>x===rig.skin.geometry.attributes.position.array[i]),key+' mesh data remains identical');
  check(rig.skin.skeleton.bones.every((b,i)=>b.quaternion.toArray().every((v,j)=>v===bonePose[i][j])),key+' bone pose is unchanged');
 }

 for(const [file,name] of [['horse-roster.js','registerRosterPreviews'],['new-breeds.js','registerNewBreedPreviews'],['clubs-boards.js','registerClubHorsePreviews'],['market-summon-keys-pets.js','registerMarketHorsePreviews']]){const provider=await load('assets/features/'+file);provider[name](library);}
 const {EXPANSION_HORSE_BREEDS}=await load('assets/expansion-horses.js');for(const row of EXPANSION_HORSE_BREEDS)library.alias(row[0],row[7].body,row);
 let equines=0;
 for(const profile of Object.values(library.manifest.breeds).filter(p=>p.nativeBreed&&p.nativeKind==='horse'&&!p.nativeDragon)){
  const horse=fixtureAsset('white-western',docs['white-western'].materials);horse.profile=profile;horse.materials=Object.values(materialsOf(horse.scene));
  const result=apply({THREE,rig:horse});check(result.body===1&&result.hair===1&&result.eye===1,'surface treatment covers exact native profile '+profile.id);equines++;
 }
 check(equines>=73,'all 73 studio equine identities, including natural/fantasy aliases, enter the surface path');
 const defs=docs['white-western'].materials;
 const cached=fixtureAsset('white-western',defs);check(apply({THREE,rig:cached}).body===0&&cached.baseMat.specularIntensity===0,'public helper refuses to mutate unowned cached materials');
 const dragon=fixtureAsset('white-western',defs,{nativeDragon:true}),dragonBefore=dragon.baseMat.roughness;
 const d=library.instantiate(dragon);check(!d.nativeMaterialPolish&&d.baseMat.roughness===dragonBefore,'dragons are excluded even if materials reuse equine names');
 const old=fixtureAsset('white-western',defs);old.profile.nativeBreed=false;old.profile.nativeKind='horse';check(apply({THREE,rig:old})===null,'older non-native assets are excluded');
 // Actual customization and fantasy factories must retain both shading hooks
 // and exact player-selected pigment values after the shared PBR finish.
 const roster=fixtureAsset('white-western',defs,{nativeRoster:true}),r=library.instantiate(roster),base=r.baseMat,map=base.map;
 const row=['fixture','Fixture',0,0,0,'#8a5a2b','#332214',{mark:'none'}],horse={id:'rider-horse',colors:{body:row[5],mane:row[6]},mark:'none',markCol:'#f2ece0'};
 const fx=createEquineFantasyCoat(THREE,base,'galaxy');r.fantasyMaterial=fx;r.skin.material=fx;
 check(fx.specularIntensity===base.specularIntensity&&fx.map===map,'fantasy material inherits native reflectance and the original map');
 configureNativeCustomization({THREE,rig:r,horse:{...horse,mark2:'star'},defaults:row});
 const makeShader=()=>({uniforms:{},vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader});
 const layered=makeShader();r.skin.material.onBeforeCompile(layered);
 check(layered.uniforms.uGlow&&layered.uniforms.nrMark2.value===5&&layered.fragmentShader.includes('_ramp')&&layered.fragmentShader.includes('nrBefore'),'fantasy and saved star shader layers both survive treatment');
 check(r.skin.material.customProgramCacheKey().includes('EquineFantasy_galaxy')&&r.skin.material.customProgramCacheKey().includes('native-roster-saved-coat'),'composed shader retains both program cache identities');
 const custom={...horse,colors:{body:'#b76b43',mane:'#d0af77'},mark:'pinto',markCol:'#faf0dc',tailCol:'#272223'};
 const saved=configureNativeCustomization({THREE,rig:r,horse:custom,defaults:row});
 check(saved.material.specularIntensity===finish.body.specularIntensity&&saved.material.map===roster.nativeNeutralCoat,'saved coat keeps treatment and native neutral detail map');
 check(saved.material.userData.nativeRosterCoat.nrCoat.value.equals(new THREE.Color(custom.colors.body)),'saved body color stays exact');
 check(saved.material.userData.nativeRosterCoat.nrMarkColor.value.equals(new THREE.Color(custom.markCol)),'saved marking color stays exact');
 check(saved.hair.length>0&&saved.hair.every(entry=>entry.materials.every(m=>m.userData.nativeRosterHair.nrMane.value.equals(new THREE.Color(custom.colors.mane))&&m.userData.nativeRosterHair.nrTail.value.equals(new THREE.Color(custom.tailCol)))),'saved mane and tail dyes retain their exact selected colors');
 const shader=makeShader();saved.material.onBeforeCompile(shader);check(shader.uniforms.nrMark.value===3&&shader.fragmentShader.includes('nrSkin'),'saved coat shader compiles its existing pinto controls');
 check(shader.uniforms.nativeCoatNeutral?.value===roster.nativeNeutralCoat,'saved alias recoloring retains the exact cached neutral atlas');
 check(shader.fragmentShader.indexOf('float ncL=')<shader.fragmentShader.indexOf('#include <map_fragment>')&&shader.fragmentShader.indexOf('#include <map_fragment>')<shader.fragmentShader.indexOf('vec3 nrBefore='),'shadow compensation precedes map sampling and authored markings, preserving bright marking colors');
 check(shader.fragmentShader.match(/uniform sampler2D nativeCoatNeutral/g)?.length===1&&shader.fragmentShader.match(/float ncL=/g)?.length===1,'saved customization includes the coat correction exactly once');

 const hookRig=fixtureAsset('white-western',defs,{nativeRoster:true});hookRig.materials=Object.values(materialsOf(hookRig.scene));const hookMaterial=hookRig.baseMat;
 const hook=shader=>{shader.uniforms.fixture={value:3};},cache=()=> 'prior-artwork-v1';hookMaterial.onBeforeCompile=hook;hookMaterial.customProgramCacheKey=cache;
 apply({THREE,rig:hookRig});const hookShader=makeShader();hookMaterial.onBeforeCompile(hookShader);
 check(hookShader.uniforms.fixture.value===3&&hookShader.uniforms.nativeCoatNeutral.value===hookRig.nativeNeutralCoat,'surface helper chains existing artwork and supplies the untouched neutral atlas');
 check(hookMaterial.customProgramCacheKey()==='prior-artwork-v1|native-coat-satin-4','composed program identity retains its prior key and explicit coat revision');
 const installedHook=hookMaterial.onBeforeCompile;apply({THREE,rig:hookRig});check(hookMaterial.onBeforeCompile===installedHook,'repeated material application never stacks the coat hook');
 const raw=fixtureAsset('white-western',defs);raw.materials=Object.values(materialsOf(raw.scene));const rawHook=raw.baseMat.onBeforeCompile;apply({THREE,rig:raw});check(raw.baseMat.onBeforeCompile===rawHook,'raw colored originals without a neutral atlas are never mistaken for grayscale shading');
 const belgianProfile=library.manifest.breeds.belgian;check(belgianProfile?.nativeRosterAlias,'Belgian uses the actual registered alias path');
 const belgianSource=fixtureAsset('white-western',defs,{nativeRoster:true});belgianSource.profile={...belgianProfile,bodyVertexCount:3,hairVertexCount:5,tackVertexCount:6};
 const belgian=library.instantiate(belgianSource),belgianRow=['belgian','Belgian',0,0,0,'#ba753d','#f3dfb2',{}];
 configureNativeCustomization({THREE,rig:belgian,horse:{id:'belgian',breed:'belgian',colors:{body:'#ba753d',mane:'#f3dfb2'},mark:'none',markCol:'#ffffff'},defaults:belgianRow});
 const belgianShader=makeShader();belgian.skin.material.onBeforeCompile(belgianShader);
 check(belgianShader.uniforms.nrRecolor.value===1&&belgianShader.uniforms.nrCoat.value.equals(new THREE.Color('#ba753d'))&&belgianShader.uniforms.nativeCoatNeutral.value===belgianSource.nativeNeutralCoat,'Belgian alias receives softer source shading with its exact warm golden saved pigment');
 // Bound the authored tone curve: pigment ratios are multiplied equally, dark
 // skin remains dark, highlights do not grow, and middle-shadow contrast drops.
 const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 const gain=x=>1+(Math.min(shading.maxGain,Math.pow(Math.max(x,.0001),shading.exponent)/Math.max(x,.0001))-1)*smooth(shading.skinStart,shading.skinEnd,x);
 check(gain(0)===1&&gain(.01)===1&&gain(1)===1,'neutral black skin and white highlights are unchanged by the bounded coat curve');
 check(Array.from({length:1001},(_,i)=>gain(i/1000)).every(x=>Number.isFinite(x)&&x>=1&&x<=1.55),'all atlas luminances have finite, bounded, positive gain');
 check((.3*gain(.3))/(.1*gain(.1))<3&&gain(.2)>1.4,'middle-shadow anatomy contrast is reduced without erasing its direction');
 check(belgianShader.fragmentShader.includes(shading.exponent.toFixed(4))&&belgianShader.fragmentShader.includes(shading.maxGain.toFixed(4)),'production shader uses the tested tone-curve bounds');
 // Tonal compression is separate from pigment: retain black skin, constrain
 // reflectance, reduce a bright/dark anatomy pair, and preserve full leg shaping.
 const previousTone=x=>x*gain(x),realTone=(x,leg=0)=>{const a=previousTone(x),tone=Math.max(-realism.maxToneDelta,Math.min(realism.maxToneDelta,(realism.tonePivot-a)*realism.toneStrength));return a+tone*smooth(shading.skinStart,shading.skinEnd,x)*(1-Math.abs(leg));};
 check(realTone(0)===0&&realTone(.01)===previousTone(.01),'black nostrils/hooves are never lifted by realism compression');
 check(Array.from({length:1001},(_,i)=>realTone(i/1000)).every((x,i,a)=>Number.isFinite(x)&&x>=0&&x<=1&&(i===0||x>=a[i-1])),'realism transfer is finite, bounded, monotonic across every source intensity');
 check(realTone(.1)/realTone(.5)>previousTone(.1)/previousTone(.5)&&realTone(.8)<previousTone(.8),'painted groove/highlight contrast decreases in both directions');
 check([-.9,-.4,0,.4,.9].every(leg=>Math.abs(realTone(.3,leg)-previousTone(.3))<=realism.maxToneDelta),'transition correction is bounded');
 check([.04,.1,.3,.8].every(x=>realTone(x,1)===previousTone(x)&&realTone(x,-1)===previousTone(x)),'full fore and hind masks keep the existing leg transfer exactly');
 check(realism.fiberHeightM<=.00003&&realism.roughnessVariation<=.12,'coat detail stays micrometre-scale with restrained roughness, not anatomical bumps');
 const themed=Object.values(materialsOf(r.scene));check(themed.every(m=>Number.isFinite(m.roughness)&&Number.isFinite(m.specularIntensity)),'composed material properties remain finite');
 // Parse untouched GLB bytes with the actual vendored loader. Only image pixel
 // decoding is stubbed; KHR extensions, material classes, rigs and preparation
 // are real, so a fixture cannot accidentally hide a skipped material-type gate.
 const {GLTFLoader}=await load('assets/vendor/three/examples/jsm/loaders/GLTFLoader.js');
 class FileLoader extends GLTFLoader{
  constructor(manager){super(manager);this.register(()=>({name:'CPU_TEXTURE_PIXELS',loadTexture(index){const texture=new THREE.Texture();texture.name='source texture '+index;return Promise.resolve(texture);}}));}
  async loadAsync(url){const location=new URL(url);check(location.protocol==='file:','actual loader cannot make network requests');const bytes=fs.readFileSync(location);return this.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
 }
 global.fetch=async url=>{const u=new URL(url);assert.equal(u.protocol,'file:');return {ok:true,json:async()=>JSON.parse(fs.readFileSync(u,'utf8'))};};
 let actualLibrary;
 try{actualLibrary=createBreedLibrary({THREE,clone,GLTFLoader:FileLoader});await actualLibrary.manifestReady;}finally{global.fetch=previousFetch;}
 for(const key of ['white-western','bay-western','bay-sporthorse-native']){
  const asset=await actualLibrary.load(key),original=materialsOf(asset.scene),before=Object.fromEntries(Object.entries(original).map(([name,m])=>[name,snapshot(m)]));
  const sourceArrays=Object.fromEntries(['position','normal','uv','skinIndex','skinWeight'].map(name=>[name,new asset.skin.geometry.attributes[name].array.constructor(asset.skin.geometry.attributes[name].array)]));
  const sourceIndices=new asset.skin.geometry.index.array.constructor(asset.skin.geometry.index.array);
  const untreated=actualLibrary.instantiate(asset,{materialPolish:false}),actor=actualLibrary.instantiate(asset),m=materialsOf(actor.scene);
  const rest=actor.skin.geometry.attributes.nativeCoatRest,coatShader=makeShader();m.M_Body.onBeforeCompile(coatShader);
  check(rest?.count===16159&&actor.nativeMaterialPolish.coatFiberVertices===16159,key+' real original receives stable short-hair appearance coordinates');
  check(Array.from(rest.array).every(Number.isFinite),key+' every cached rest coordinate is finite');
  for(const name of Object.keys(sourceArrays))check(Buffer.from(asset.skin.geometry.attributes[name].array.buffer,asset.skin.geometry.attributes[name].array.byteOffset,asset.skin.geometry.attributes[name].array.byteLength).equals(Buffer.from(sourceArrays[name].buffer)),key+' source '+name+' bytes stay exact');
  check(Buffer.from(asset.skin.geometry.index.array.buffer,asset.skin.geometry.index.array.byteOffset,asset.skin.geometry.index.array.byteLength).equals(Buffer.from(sourceIndices.buffer)),key+' source topology stays exact');
  const valuesBefore=rest.array.slice(),again=actualLibrary.instantiate(asset);check(again.skin.geometry.attributes.nativeCoatRest===rest,key+' later actors reuse one immutable appearance attribute');
  actor.skin.skeleton.bones[0].position.x+=.5;actor.scene.updateMatrixWorld(true);actor.skin.skeleton.update();
  check(Buffer.from(rest.array.buffer).equals(Buffer.from(valuesBefore.buffer)),key+' motion does not make grain swim or modify the shared rest field');actor.skin.skeleton.bones[0].position.x-=.5;
  check(coatShader.vertexShader.includes('ncCoatRest=nativeCoatRest')&&coatShader.fragmentShader.includes('ncFiberFilter=1.0-smoothstep')&&coatShader.fragmentShader.includes('dFdx(ncHeight)'),key+' shader has stable directional fiber relief and derivative distance filtering');
  check(coatShader.fragmentShader.indexOf('float ncFiber=')<coatShader.fragmentShader.indexOf('float ncHeight='),key+' fiber variables are declared before normal perturbation');
  check(coatShader.fragmentShader.match(/varying vec3 ncCoatRest/g)?.length===1,key+' fiber shader is installed exactly once');
  for(const material of again.materials)material.dispose();
  check(Object.keys(original).sort().join(',')==='M_Body,M_Eye,M_Hair,M_Saddle1,M_Saddle2',key+' actual loader preserves exact source material names');
  check(['M_Body','M_Eye','M_Hair'].every(name=>original[name].isMeshPhysicalMaterial&&original[name].specularIntensity===0),key+' KHR_materials_specular constructs physical source materials');
  check(actor.nativeMaterialPolish.body===1&&actor.nativeMaterialPolish.eye===1&&actor.nativeMaterialPolish.hair===1,key+' real load→prepare→private clone applies every intended surface');
  check(m.M_Body.roughness===finish.body.roughness&&m.M_Body.specularIntensity===finish.body.specularIntensity,key+' actual loaded coat restores its dielectric highlights');
  check(m.M_Eye.color.getHexString()===finish.eye.color.slice(1)&&m.M_Eye.roughness===finish.eye.roughness,key+' actual loaded eye becomes dark warm iris');
  check(m.M_Hair.alphaTest===finish.hair.alphaCutoff&&m.M_Hair.alphaToCoverage,key+' actual loaded hair retains cutout and softer edges');
  const eyeShader=makeShader();m.M_Eye.onBeforeCompile(eyeShader);
  check(eyeShader.fragmentShader.includes('float neCatch=pow(max(0.0,dot(normal,neHalf)),80.0)')&&eyeShader.fragmentShader.includes('dot(normal,neView)')&&eyeShader.fragmentShader.indexOf('float neCatch=')>eyeShader.fragmentShader.indexOf('#include <lights_physical_fragment>'),key+' small corneal reflection uses actual view/normal direction and fades at grazing angles');
  check(eyeShader.fragmentShader.includes('min(.22,neLit*.36)')&&eyeShader.fragmentShader.includes('diffuse*neIrisL*(.48+.16*neIrisL)'),key+' iris retains its source fibers with warm reflectance and catchlight cannot shine in unlit shadow');
  check(m.M_Eye.emissive.getHex()===original.M_Eye.emissive.getHex()&&m.M_Eye.clearcoat===finish.eye.clearcoat,key+' eye retains physical corneal reflection without changing emissive material pigment');
  check(m.M_Eye.envMapIntensity<=.2&&m.M_Eye.specularIntensity>=.5&&m.M_Eye.clearcoat>0&&m.M_Eye.clearcoat<=.3&&m.M_Eye.clearcoatRoughness<.08,key+' broad environment reflection recedes while a narrow physical tear-film highlight remains');
  for(const name of Object.keys(original)){
   check(snapshot(original[name])===before[name]&&snapshot(materialsOf(untreated.scene)[name])===before[name],key+' actual source/baseline isolated: '+name);
   check(m[name].map===original[name].map&&m[name]!==original[name],key+' actual map unchanged and material privately cloned: '+name);
  }
  check(['M_Saddle1','M_Saddle2'].every(name=>snapshot(m[name])===before[name]),key+' real original tack remains untreated');
  check(actor.skin.geometry===asset.skin.geometry&&actor.skin.skeleton.bones.length===677&&asset.animations.length>0,key+' real geometry/677-joint rig/clips preserved');
  console.log('Real GLTFLoader:',key,'M_Body/M_Eye/M_Hair = MeshPhysicalMaterial; treatment applied.');
 }

 // Decode the real unchanged RGB atlas without a browser/canvas or image package.
 function neutralPixels(){
  const bytes=fs.readFileSync(path.join(root,'assets/models/native-roster/neutralcoat.png')),chunks=[];let width,height,channels;
  for(let at=8;at<bytes.length;){const length=bytes.readUInt32BE(at),type=bytes.toString('ascii',at+4,at+8),data=bytes.subarray(at+8,at+8+length);if(type==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);assert.equal(data[8],8);assert([2,6].includes(data[9]));assert.equal(data[12],0);channels=data[9]===2?3:4;}else if(type==='IDAT')chunks.push(data);at+=length+12;}
  const raw=require('node:zlib').inflateSync(Buffer.concat(chunks)),stride=width*channels,pixels=new Uint8Array(stride*height);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){const filter=raw[y*(stride+1)];assert(filter<=4);for(let x=0;x<stride;x++){const at=y*stride+x,a=x>=channels?pixels[at-channels]:0,b=y?pixels[at-stride]:0,c=y&&x>=channels?pixels[at-stride-channels]:0;pixels[at]=(raw[y*(stride+1)+1+x]+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;}}
  const linear=x=>(x/=255)<=.04045?x/12.92:((x+.055)/1.055)**2.4;
  return (u,v)=>{const x=Math.max(0,Math.min(width-1,Math.round(u*(width-1)))),y=Math.max(0,Math.min(height-1,Math.round(v*(height-1)))),i=(y*width+x)*channels;return linear(pixels[i])*.2126+linear(pixels[i+1])*.7152+linear(pixels[i+2])*.0722;};
 }
 const neutralLuma=neutralPixels(),digest=x=>require('node:crypto').createHash('sha256').update(x).digest('hex');
 const attributeHash=geometry=>digest(Buffer.concat(['position','normal','uv','skinIndex','skinWeight'].map(name=>{const a=geometry.attributes[name].array;return Buffer.from(a.buffer,a.byteOffset,a.byteLength);})));
 const atlasHash=digest(fs.readFileSync(path.join(root,'assets/models/native-roster/neutralcoat.png')));
 const draftTHREE={...THREE,TextureLoader:class{async loadAsync(){return new THREE.Texture();}}};
 global.fetch=async url=>{const u=new URL(url);assert.equal(u.protocol,'file:');const bytes=fs.readFileSync(u);return {ok:true,json:async()=>JSON.parse(bytes),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};};
 try{
  const draftLibrary=createBreedLibrary({THREE:draftTHREE,clone,GLTFLoader:FileLoader});await draftLibrary.manifestReady;
  for(const key of ['percheron','shire','clyde']){
   const asset=await draftLibrary.load(key),originalHash=attributeHash(asset.skin.geometry),actor=draftLibrary.instantiate(asset),mesh=actor.skin,geometry=mesh.geometry,mask=geometry.attributes.nativeLegCoat;
   check(mask?.itemSize===1&&mask.count===16159&&mask.array.every(x=>Number.isFinite(x)&&Math.abs(x)<=1),key+' actual source body has one finite bounded leg appearance scalar');
   check(actor.nativeMaterialPolish.legCoatVertices>3000&&actor.nativeMaterialPolish.legCoatVertices<4000,key+' leg-only support is bounded to the four intended limbs');
   check(attributeHash(geometry)===originalHash,key+' leg appearance preserves exact positions, normals, UVs and all 677-joint skin weights');
   const points=[],areas=new Float64Array(mask.count),luma=new Float64Array(mask.count),before=new Float64Array(mask.count),after=new Float64Array(mask.count),v=new THREE.Vector3();actor.scene.updateMatrixWorld(true);mesh.skeleton.update();
   for(let i=0;i<mask.count;i++){mesh.getVertexPosition(i,v);mesh.localToWorld(v);actor.scene.worldToLocal(v);points.push(v.clone());const x=neutralLuma(geometry.attributes.uv.getX(i),geometry.attributes.uv.getY(i));luma[i]=x;before[i]=x*gain(x);const pivot=mask.getX(i)>=0?legShading.foreMean:legShading.hindMean;after[i]=before[i]+Math.max(-legShading.maxDelta,Math.min(legShading.maxDelta,(pivot-before[i])*legShading.strength))*Math.abs(mask.getX(i))*smooth(shading.skinStart,shading.skinEnd,x);}
   const index=geometry.index.array,ab=new THREE.Vector3(),ac=new THREE.Vector3();for(let i=0;i<index.length;i+=3){const a=index[i],b=index[i+1],c=index[i+2],area=ab.subVectors(points[b],points[a]).cross(ac.subVectors(points[c],points[a])).length()/6;areas[a]+=area;areas[b]+=area;areas[c]+=area;}
   check(points.every((p,i)=>p.y>.30&&p.y<1.35||mask.getX(i)===0),key+' hoof/pastern, chest, neck and head are outside mask support');
   check(Array.from(mask.array).every((x,i)=>x!==0||before[i]===after[i]),key+' every vertex outside leg support has exactly unchanged neutral shading');
   const changes=[];
   for(const sign of [1,-1]){let weight=0,a=0,b=0,aa=0,bb=0;for(let i=0;i<mask.count;i++)if(mask.getX(i)*sign>.01){const w=areas[i];weight+=w;a+=w*before[i];b+=w*after[i];aa+=w*before[i]**2;bb+=w*after[i]**2;}a/=weight;b/=weight;const varianceRatio=(bb/weight-b*b)/(aa/weight-a*a),meanDrift=Math.abs(b-a)/a;check(meanDrift<.012,key+' '+(sign>0?'fore':'hind')+' mean leg brightness changes by less than 1.2%');check(varianceRatio<.88,key+' '+(sign>0?'fore':'hind')+' actual painted leg variance decreases at least 12%');changes.push({leg:sign>0?'fore':'hind',meanDriftPercent:+(meanDrift*100).toFixed(3),varianceReductionPercent:+((1-varianceRatio)*100).toFixed(2)});}
   const cached=draftLibrary.instantiate(asset);check(cached.skin.geometry.attributes.nativeLegCoat===mask,key+' second actor reuses its prepared mask without per-frame or repeated skin sampling');
   const row=[key,key,0,0,0,'#8a5a2b','#332214',{}];configureNativeCustomization({THREE,rig:actor,horse:{id:key,breed:key,colors:{body:'#ba753d',mane:'#332214'},mark:'pinto',markCol:'#fffaf0'},defaults:row});const shader=makeShader();actor.skin.material.onBeforeCompile(shader);
   check(shader.vertexShader.includes('ncLegMask=nativeLegCoat')&&shader.fragmentShader.indexOf('ncSoft+=ncDelta')<shader.fragmentShader.indexOf('#include <map_fragment>')&&shader.fragmentShader.indexOf('#include <map_fragment>')<shader.fragmentShader.indexOf('vec3 nrBefore='),key+' leg compression composes before exact player pigment and white markings');
   check(shader.uniforms.nrCoat.value.equals(new THREE.Color('#ba753d'))&&shader.uniforms.nrMarkColor.value.equals(new THREE.Color('#fffaf0')),key+' chosen dark/golden coat and white marking colors are not rewritten');
   actor.nativeCustomization.dispose();for(const material of [...actor.materials,...cached.materials])material.dispose();console.log('Real neutral atlas leg contrast:',key,JSON.stringify(changes));
  }
  const other=draftLibrary.instantiate(await draftLibrary.load('vanner'));check(!other.skin.geometry.attributes.nativeLegCoat&&!other.baseMat.customProgramCacheKey().includes('native-leg-coat'), 'unapproved Vanner foundation receives no draft-leg material change');
 }finally{global.fetch=previousFetch;}
 check(digest(fs.readFileSync(path.join(root,'assets/models/native-roster/neutralcoat.png')))===atlasHash,'source neutral atlas bytes remain unchanged');
 // Real Fjord binary + its authored card metadata: no browser or texture fetch.
 const {applyNativeFjordGroom,fjordCardColorMask}=await load('assets/native-fjord-groom.js');
 check(fjordCardColorMask(3,[{start:0,count:2,outer:.5}])[1]===1.5,'card mask retains deterministic fractional layer pigment');
 for(const cards of [[{start:-1,count:1,outer:0}],[{start:0,count:4,outer:0}],[{start:0,count:2,outer:0},{start:1,count:1,outer:1}],[{start:0,count:1,outer:NaN}]])check(fjordCardColorMask(3,cards)===null,'invalid card ranges fail safely');
 const cpuTHREE={...THREE,TextureLoader:class{async loadAsync(){return new THREE.Texture();}}};
 const fetchedBinaries=[];
 global.fetch=async url=>{const u=new URL(url);assert.equal(u.protocol,'file:');const bytes=fs.readFileSync(u);return {ok:true,json:async()=>JSON.parse(bytes.toString()),arrayBuffer:async()=>{const binary=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);fetchedBinaries.push({binary,before:Buffer.from(binary).toString('base64')});return binary;}};};
 let fjordLibrary,fjordAsset;
 try{fjordLibrary=createBreedLibrary({THREE:cpuTHREE,clone,GLTFLoader:FileLoader});await fjordLibrary.manifestReady;fjordAsset=await fjordLibrary.load('fjord');}finally{global.fetch=previousFetch;}
 const fjord=fjordLibrary.instantiate(fjordAsset),fjordM=materialsOf(fjord.scene),sourceHair=materialsOf(fjordAsset.scene).M_Hair;
 check(fetchedBinaries.every(({binary,before})=>Buffer.from(binary).toString('base64')===before),'GLTF skin normalization never mutates the shared cached variant binary');
 check(fjord.nativeFjordGroom?.cards===278,'real Fjord loader installs the complete authored crest pigment');
 let hairMesh;fjord.scene.traverse(mesh=>{if(mesh.isSkinnedMesh&&mesh.material.name==='M_Hair')hairMesh=mesh;});
 const mask=hairMesh.geometry.attributes.nativeFjordCard.array;
 check(mask.length===23514&&mask.filter(x=>x>0).length===11300,'only mane/forelock vertices have the real color mask');
 check(mask.filter(x=>x===1).length>4000&&mask.filter(x=>x===2).length>3000,'source fringe supplies coherent dark center and pale outer lanes');
 check(fjordM.M_Hair!==sourceHair&&fjordM.M_Hair.map===sourceHair.map,'two-tone surface is private with untouched creator hair atlas');
 const authoredShader=makeShader();fjordM.M_Hair.onBeforeCompile(authoredShader);
 check(authoredShader.vertexShader.includes('nativeFjordCard')&&authoredShader.fragmentShader.indexOf('if(fjCard>.5')<authoredShader.fragmentShader.indexOf('#include <map_fragment>'),'natural pigment applies before native alpha/detail texture sampling');
 check(authoredShader.uniforms.fjManeOverride.value===0,'authored two-tone starts enabled');
 const fjordRow=['fjord','Fjord',0,0,0,'#c2a06a','#3a3428',{}],fjordHorse={id:'fjord-test',colors:{body:'#c2a06a',mane:'#3a3428'},mark:'none',markCol:'#f2ece0'};
 const dyed=configureNativeCustomization({THREE,rig:fjord,horse:{...fjordHorse,colors:{...fjordHorse.colors,mane:'#c89463'}},defaults:fjordRow});
 const dyedMaterial=dyed.hair[0].materials[0],dyedShader=makeShader();dyedMaterial.onBeforeCompile(dyedShader);
 check(dyedShader.uniforms.fjManeOverride===dyedMaterial.userData.nativeRosterHair.nrManeOn&&dyedShader.uniforms.fjManeOverride.value===1,'manual mane dye uses the same live uniform to disable natural stripe');
 check(dyedShader.uniforms.nrMane.value.equals(new THREE.Color('#c89463'))&&dyedMaterial.customProgramCacheKey().includes('fjord-brushed-crest-4')&&dyedMaterial.customProgramCacheKey().includes('native-roster-saved-hair'),'exact player dye and both shader cache identities survive composition');
 configureNativeCustomization({THREE,rig:fjord,horse:fjordHorse,defaults:fjordRow});
 check(dyedShader.uniforms.fjManeOverride.value===0,'restoring default mane immediately restores natural two-tone without recompile');
 const countBefore=hairMesh.geometry.attributes.nativeFjordCard,hookBefore=fjordM.M_Hair.onBeforeCompile;applyNativeFjordGroom({THREE,rig:fjord});
 check(hairMesh.geometry.attributes.nativeFjordCard===countBefore&&fjordM.M_Hair.onBeforeCompile===hookBefore,'reapplying groom is idempotent');
 const alias={...fjord,profile:{...fjord.profile,nativeVariant:{...fjord.profile.nativeVariant,id:'bay'}}};
 check(applyNativeFjordGroom({THREE,rig:alias})===null,'other natural foundations are excluded');
 let crest;fjord.scene.traverse(mesh=>{if(mesh.userData?.nativeFjordCrest)crest=mesh;});
 check(crest?.isSkinnedMesh&&crest.geometry.attributes.position.count===1562&&crest.geometry.index.count===9360,'one small continuous crest uses the real generated surface');
 check(crest.skeleton.bones.length===677&&crest.skeleton.bones.every((bone,i)=>bone===hairMesh.skeleton.bones[i]),'crest shares every original animated hair skeleton bone');
 check(crest.geometry.attributes.nativeFjordOuter.array.some(x=>x===0)&&crest.geometry.attributes.nativeFjordOuter.array.some(x=>x===1),'continuous shell supplies the center stripe and pale sidewalls');
 check(crest.material.alphaTest===0&&crest.material.map===null&&crest.material.transparent===false&&fjordM.M_Hair.map===sourceHair.map,'solid crest continuity preserves the separate original alpha-card atlas');
 const crestShader=makeShader();crest.material.onBeforeCompile(crestShader);
 check(crestShader.vertexShader.includes('fjCrestBlend=nativeFjordOuter')&&crestShader.fragmentShader.includes('fjFiber')&&crestShader.fragmentShader.includes('fjBundleShade'),'shell uses continuous pigment and restrained fine-hair surface detail');
 fjord.scene.updateMatrixWorld(true);const posed=new THREE.Box3(),point=new THREE.Vector3();
 for(let i=0;i<crest.geometry.attributes.position.count;i++){crest.getVertexPosition(i,point);crest.localToWorld(point);fjord.scene.worldToLocal(point);check(point.toArray().every(Number.isFinite),'actual skinned crest vertex stays finite');posed.expandByPoint(point);}
 const expected=fjord.profile.nativeVariant.groom.uprightCrest.shell.standingBoundsM;
 check(posed.min.distanceTo(new THREE.Vector3().fromArray(expected.min))<2e-5&&posed.max.distanceTo(new THREE.Vector3().fromArray(expected.max))<2e-5,'actual GLTF bind-space reconstruction agrees with authored standing-world bounds');
 configureNativeCustomization({THREE,rig:fjord,horse:{...fjordHorse,colors:{...fjordHorse.colors,mane:'#9166bb'}},defaults:fjordRow});crest.onBeforeRender();
 check(crestShader.uniforms.fjCrestNatural.value===0&&crestShader.uniforms.fjCrestDye.value.equals(new THREE.Color('#9166bb')),'equipped crest immediately follows exact saved mane dye');
 configureNativeCustomization({THREE,rig:fjord,horse:fjordHorse,defaults:fjordRow});crest.onBeforeRender();
 check(crestShader.uniforms.fjCrestNatural.value===1,'restoring the default color restores the continuous natural stripe');
 // Saved naturally varied Fjords retain the stripe; only explicit current dyes override it.
 const naturalFjord={...fjordHorse,breed:'fjord',colors:{...fjordHorse.colors,mane:'#3b3529'},maneAppearance:{source:'natural',color:'#3b3529'}};
 let provenance=configureNativeCustomization({THREE,rig:fjord,horse:naturalFjord,defaults:fjordRow});crest.onBeforeRender();
 check(!provenance.applied.mane&&provenance.applied.tail&&crestShader.uniforms.fjCrestNatural.value===1,'recorded natural variation keeps the accepted stripe while preserving its old tail tint');
 check(provenance.hair[0].materials[0].userData.nativeRosterHair.nrTail.value.equals(new THREE.Color('#3b3529')),'natural provenance does not rewrite saved tail pigment');
 const staleNatural={...naturalFjord,colors:{...naturalFjord.colors,mane:'#9a6cff'}};
 provenance=configureNativeCustomization({THREE,rig:fjord,horse:staleNatural,defaults:fjordRow});crest.onBeforeRender();
 check(provenance.applied.mane&&crestShader.uniforms.fjCrestNatural.value===0&&crestShader.uniforms.fjCrestDye.value.equals(new THREE.Color('#9a6cff')),'stale natural metadata cannot suppress a later saved dye');
 const sameBaseDye={...naturalFjord,colors:{...naturalFjord.colors,mane:fjordRow[6]},maneAppearance:{source:'dyed',color:fjordRow[6]}};
 provenance=configureNativeCustomization({THREE,rig:fjord,horse:sameBaseDye,defaults:fjordRow});crest.onBeforeRender();
 check(provenance.applied.mane&&!provenance.applied.tail&&crestShader.uniforms.fjCrestNatural.value===0,'explicit dye provenance wins even when equal to the default mane, without changing tail rules');
 const reset={...sameBaseDye,maneAppearance:{source:'natural',color:fjordRow[6]}};
 provenance=configureNativeCustomization({THREE,rig:fjord,horse:reset,defaults:fjordRow});crest.onBeforeRender();
 check(!provenance.applied.mane&&crestShader.uniforms.fjCrestNatural.value===1,'Natural reset restores the stripe immediately');
 for(const h of [{...naturalFjord,coat:'ice'},{...naturalFjord,breed:'fjord-alias'}]){provenance=configureNativeCustomization({THREE,rig:fjord,horse:h,defaults:fjordRow});check(provenance.applied.mane,'natural Fjord provenance does not override fantasy or another breed identity');}
 const profileBefore=fjord.profile;fjord.profile={...profileBefore,nativeRosterAlias:true};provenance=configureNativeCustomization({THREE,rig:fjord,horse:naturalFjord,defaults:fjordRow});check(provenance.applied.mane,'borrowed foundation keeps its own mane pigment');fjord.profile=profileBefore;
 configureNativeCustomization({THREE,rig:fjord,horse:fjordHorse,defaults:fjordRow});crest.onBeforeRender();
 fjord.nativeFantasy={};crest.onBeforeRender();check(crestShader.uniforms.fjCrestNatural.value===0,'fantasy appearance uses its hair pigment instead of a forced natural Fjord stripe');fjord.nativeFantasy=null;
 const {nativeGroomFacade}=await load('assets/game-hero-horse.js');
 const facade=nativeGroomFacade({THREE,scene:fjord.scene,skin:fjord.skin,mount:fjord.scene,profile:fjord.profile});
 check(facade.meshes.includes(hairMesh)&&facade.meshes.includes(crest),'Hair control includes original cards and added continuous crest');
 facade.mane.visible=false;check(!hairMesh.visible&&!crest.visible,'Hair off never leaves an orphan crest');facade.mane.visible=true;check(hairMesh.visible&&crest.visible,'Hair on restores the entire native groom');
 const {createNativeHorseMotion}=await load('assets/native-horse-motion.js');
 const animation=createNativeHorseMotion({THREE,root:fjord.nativeRoot,clips:fjord.animations,profile:fjord.profile});
 check(!!animation.groomInertia,'adding a verified crest keeps native hair inertia active');
 const sampleCrest=()=>{fjord.scene.updateMatrixWorld(true);const values=[];for(let i=0;i<crest.geometry.attributes.position.count;i+=37){const p=crest.getVertexPosition(i,new THREE.Vector3());crest.localToWorld(p);fjord.scene.worldToLocal(p);check(p.toArray().every(Number.isFinite),'animated crest sample remains finite');values.push(p);}return values;};
 const standing=sampleCrest();animation.set('walk');for(let i=0;i<35;i++)animation.update(1/60);const walking=sampleCrest();
 check(walking.some((p,i)=>p.distanceTo(standing[i])>.002),'continuous crest follows actual source Walk and native hair controls');
 animation.set('gallop');for(let i=0;i<35;i++)animation.update(1/60);sampleCrest();animation.set('jump');for(let i=0;i<22;i++)animation.update(1/60);sampleCrest();
 check(animation.snapshot().groomInertia!==null,'native groom phase remains active through Walk/Gallop/Jump');animation.dispose();facade.dispose();
 console.log(`Native horse material QA passed: ${checks} checks; three originals, private ownership, maps/rig/tack preservation, fantasy and saved dye composition.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
