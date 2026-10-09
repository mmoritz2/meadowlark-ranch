/* Saved appearance on the realistic horse. Skinning, clip curves, source geometry
 * and Western tack are untouched; every modified material belongs to one actor. */
const MARKS={none:0,dapple:1,appaloosa:2,pinto:3,roan:4,points:5,leopard:6,sooty:7,dun:8,metal:9};
const MARKS2={none:0,blaze:1,snip:2,socks:3,stockings:4,star:5};
const neutralMaps=new Map();
const validColor=value=>typeof value==='string'&&/^#[\da-f]{6}$/i.test(value);
const uniforms=values=>Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{value}]));
function neutralMap(THREE,profile){
 const url=new URL(profile.nativeNeutralCoatFile||'./models/native-roster/neutralcoat.png',import.meta.url).href;
 if(!neutralMaps.has(url)){
  const texture=new THREE.TextureLoader().load(url,undefined,undefined,()=>neutralMaps.delete(url));
  texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;neutralMaps.set(url,texture);
 }
 return neutralMaps.get(url);
}
const patternShader=`
uniform vec3 nrCoat,nrMarkColor,nrMin,nrSize;
uniform float nrRecolor,nrMark,nrMark2,nrSeed;
varying vec3 nrPosition;
float nrHash(vec2 p){p=fract(p*vec2(127.1,311.7)+nrSeed);p+=dot(p,p+34.7);return fract(p.x*p.y*95.43);}
float nrNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(nrHash(i),nrHash(i+vec2(1,0)),f.x),mix(nrHash(i+vec2(0,1)),nrHash(i+vec2(1,1)),f.x),f.y);}
float nrFbm(vec2 p){return nrNoise(p)*.6+nrNoise(p*2.3)*.27+nrNoise(p*4.7)*.13;}
float nrSpots(vec2 uv,float n,float density,float lo,float hi){
 vec2 p=uv*n,c=floor(p),f=fract(p)-.5;float d=1.0;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 o=vec2(float(x),float(y)),cc=c+o;float r=nrHash(cc);
  if(r>density){vec2 center=o+vec2(nrHash(cc+37.7),nrHash(cc+91.3))*.7-.35;d=min(d,length(f-center)-mix(lo,hi,r));}
 }return 1.0-smoothstep(-.035,.035,d);
}
`;
const coatFragment=`
vec3 nrRel=(nrPosition-nrMin)/max(nrSize,vec3(.001));
float nrL=dot(diffuseColor.rgb,vec3(.299,.587,.114));
float nrSkin=smoothstep(.035,.075,nrRel.y)*smoothstep(.002,.035,nrL);
if(nrRecolor>.5){
 // Native neutral map is white: its luminance preserves the sculpted coat detail.
 vec3 nrDyed=nrCoat*clamp(nrL,0.0,1.0);
 diffuseColor.rgb=mix(diffuseColor.rgb,nrDyed,nrSkin);
}
vec3 nrBefore=diffuseColor.rgb,nrBase=diffuseColor.rgb;
float fl=nrRel.z,fh=nrRel.y,fw=abs(nrRel.x-.5)*2.0;
if(nrMark>.5){
 if(nrMark<1.5){float d=nrFbm(vMapUv*22.0);float ring=smoothstep(.46,.54,d)*(1.0-smoothstep(.60,.72,d));diffuseColor.rgb=mix(nrBase,nrBase*1.30+.05,ring*.75);}
 else if(nrMark<2.5){float blanket=(1.0-smoothstep(.24,.54,fl))*smoothstep(.06,.4,fh);float spots=nrSpots(vMapUv,16.0,.42,.10,.22);diffuseColor.rgb=mix(nrBase,mix(nrMarkColor,nrBase*.5,spots*.88),blanket*.92);}
 else if(nrMark<3.5){diffuseColor.rgb=mix(nrBase,nrMarkColor,smoothstep(.50,.57,nrFbm(vMapUv*5.5))*.95);}
 else if(nrMark<4.5){float tick=smoothstep(.61,.83,nrNoise(vMapUv*1100.0));float area=smoothstep(.20,.45,fh)*(1.0-smoothstep(.70,.92,fl));diffuseColor.rgb=mix(nrBase,nrMarkColor,(.12+tick*.16)*area);float points=(1.0-smoothstep(.10,.30,fh))+smoothstep(.72,.92,fl);diffuseColor.rgb=mix(diffuseColor.rgb,nrBase*.55,clamp(points,0.0,1.0)*.7);}
 else if(nrMark<5.5){float points=(1.0-smoothstep(.06,.26,fh))+smoothstep(.86,.99,fl);diffuseColor.rgb=mix(nrBase,nrMarkColor,clamp(points,0.0,1.0)*.85);}
 else if(nrMark<6.5){diffuseColor.rgb=mix(nrMarkColor,nrBase*.45,nrSpots(vMapUv,13.0,.34,.13,.26)*.95);}
 else if(nrMark<7.5){float shade=smoothstep(.45,.95,fh)*(.55+.45*nrFbm(vMapUv*8.0));diffuseColor.rgb=mix(nrBase,nrBase*.5,shade*.8);}
 else if(nrMark<8.5){float stripe=(1.0-smoothstep(.06,.30,fw))*smoothstep(.55,.85,fh);float bars=(1.0-smoothstep(.05,.22,fh))*step(.5,fract(fh*26.0));diffuseColor.rgb=mix(nrBase,nrMarkColor,clamp(stripe+bars*.7,0.0,1.0)*.8);}
 else {float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vViewPosition))),2.0);diffuseColor.rgb=mix(nrBase,nrMarkColor,rim*.55)*(1.0+.22*nrFbm(vMapUv*11.0));}
 diffuseColor.rgb=mix(nrBefore,diffuseColor.rgb,nrSkin);
}
if(nrMark2>.5){
 float white=0.0;
 if(nrMark2<1.5)white=smoothstep(.84,.90,fl)*(1.0-smoothstep(.10,.20,fw))*smoothstep(.45,.60,fh);
 else if(nrMark2<2.5)white=smoothstep(.95,.985,fl)*smoothstep(.42,.55,fh)*(1.0-smoothstep(.62,.72,fh));
 else if(nrMark2<3.5)white=(1.0-smoothstep(.08,.13,fh))*smoothstep(.045,.09,fh);
 else if(nrMark2<4.5)white=(1.0-smoothstep(.17,.24,fh))*smoothstep(.045,.09,fh);
 else white=1.0-smoothstep(.05,.09,length(vec2((fl-.90)*3.0,(fh-.74)*2.0)));
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.94,.92,.88),clamp(white,0.0,1.0)*.9);
}
`;
function makeBodyMaterial(THREE,rig,base,neutral){
 const material=base.clone(),previous=base.onBeforeCompile,previousKey=base.customProgramCacheKey();
 if(neutral){material.map=rig.nativeNeutralCoat||neutralMap(THREE,rig.profile);material.color.set(0xffffff);}
 const geometry=rig.skin.geometry;if(!geometry.boundingBox)geometry.computeBoundingBox();
 const state=uniforms({nrCoat:new THREE.Color(),nrMarkColor:new THREE.Color(),nrRecolor:neutral?1:0,nrMark:0,nrMark2:0,nrSeed:0,nrMin:geometry.boundingBox.min.clone(),nrSize:geometry.boundingBox.getSize(new THREE.Vector3())});
 material.onBeforeCompile=shader=>{
  previous?.call(material,shader);Object.assign(shader.uniforms,state);
  shader.vertexShader='varying vec3 nrPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nnrPosition=position;');
  shader.fragmentShader=patternShader+shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+coatFragment);
 };
 material.customProgramCacheKey=()=>previousKey+'|native-roster-saved-coat-v1';material.needsUpdate=true;
 material.userData.nativeRosterCoat=state;return material;
}
function prepareHair(THREE,rig){
 const entries=[];
 rig.scene.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||mesh.geometry?.attributes.position.count!==rig.profile.hairVertexCount)return;
  const geometry=mesh.geometry,indices=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight;
  if(!geometry.attributes.nativeTailDye){
   const mask=new Float32Array(indices.count);
   for(let i=0;i<mask.length;i++)for(let j=0;j<4;j++)if(/tail/i.test(mesh.skeleton.bones[indices.getComponent(i,j)]?.name||''))mask[i]+=weights.getComponent(i,j);
   geometry.setAttribute('nativeTailDye',new THREE.BufferAttribute(mask,1));
  }
  const originals=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const materials=originals.map(base=>{
   const material=base.clone(),previous=base.onBeforeCompile,previousKey=base.customProgramCacheKey();
   const state=uniforms({nrMane:new THREE.Color(),nrTail:new THREE.Color(),nrHairBaseColor:base.color.clone(),nrManeOn:0,nrTailOn:0});
   material.onBeforeCompile=shader=>{
    previous?.call(material,shader);Object.assign(shader.uniforms,state);
    shader.vertexShader='attribute float nativeTailDye;varying float nrTailMask;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nnrTailMask=nativeTailDye;');
    shader.fragmentShader='uniform vec3 nrMane,nrTail,nrHairBaseColor;uniform float nrManeOn,nrTailOn;varying float nrTailMask;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
     float nrTailMix=smoothstep(.15,.70,nrTailMask);
     float nrHairDetail=clamp(dot(diffuseColor.rgb/max(nrHairBaseColor,vec3(.0001)),vec3(.299,.587,.114)),0.0,1.0);
     diffuseColor.rgb=mix(diffuseColor.rgb,mix(nrMane,nrTail,nrTailMix)*nrHairDetail,mix(nrManeOn,nrTailOn,nrTailMix));`);
   };
   material.customProgramCacheKey=()=>previousKey+'|native-roster-saved-hair-v1';material.needsUpdate=true;
   material.userData.nativeRosterHair=state;return material;
  });
  mesh.material=Array.isArray(mesh.material)?materials:materials[0];entries.push({mesh,originals,materials,array:Array.isArray(mesh.material)});
 });return entries;
}

/** defaults may be the existing BREEDS3 row; the save remains unchanged. */
export function configureNativeCustomization({THREE,rig,horse,defaults}={}){
 if(!rig?.profile?.nativeRoster||!rig.skin||!horse)return null;
 const profile=rig.profile,row=Array.isArray(defaults)?defaults:null;
 const colors=row?{body:row[5],mane:row[7]?.maneCol||row[6]}:profile.nativeRosterColors||{};
 const marks=row?.[7]||profile.nativeRosterMarks||{};
 const equal=(a,b)=>validColor(a)&&validColor(b)&&new THREE.Color(a).equals(new THREE.Color(b));
 // Feature-added natural breeds borrow a shape, not its original pigment. A
 // Suffolk on the Percheron foundation must still wear its own chestnut coat.
 const aliasAppearance=!!profile.nativeRosterAlias&&!horse.coat&&!rig.fantasyAppearance;
 const bodyCustom=aliasAppearance||validColor(horse.colors?.body)&&!equal(horse.colors.body,colors.body);
 const markCustom=horse.mark!=null&&horse.mark!==(marks.mark||'none');
 const markColorCustom=validColor(horse.markCol)&&!equal(horse.markCol,marks.markCol||'#f2ece0');
 const secondary=MARKS2[horse.mark2]||0,neutral=bodyCustom||markCustom||markColorCustom;
 const maneChanged=aliasAppearance||validColor(horse.colors?.mane)&&!equal(horse.colors.mane,colors.mane),tailCustom=validColor(horse.tailCol);
 // A naturally varied Fjord keeps its authored two-tone crest. The provenance
 // must match the current saved pigment, so a later/imported dye never loses.
 const fjordMane=horse.breed==='fjord'&&profile.nativeVariant?.id==='fjord'&&!profile.nativeRosterAlias&&!horse.coat&&!rig.nativeFantasy&&!rig.fantasyAppearance;
 const maneSource=fjordMane&&equal(horse.maneAppearance?.color,horse.colors?.mane)?horse.maneAppearance?.source:null;
 const maneCustom=maneSource==='natural'?false:maneChanged||maneSource==='dyed';
 const tailTint=tailCustom||maneChanged;
 let state=rig.nativeCustomization;
 if(!state){
  state={material:null,base:null,neutral:false,hair:[],dispose(){
   if(this.material){if(rig.skin.material===this.material)rig.skin.material=this.base;this.material.dispose();}
   for(const entry of this.hair){entry.mesh.material=entry.array?entry.originals:entry.originals[0];entry.materials.forEach(material=>material.dispose());}
   this.material=null;this.hair=[];if(rig.nativeCustomization===this)rig.nativeCustomization=null;
  }};rig.nativeCustomization=state;
 }
 const authored=rig.fantasyMaterial||rig.fantasyAppearance?.material||rig.baseMat;
 const base=neutral?rig.baseMat:authored;
 if(state.material&&(state.base!==base||state.neutral!==neutral||(!neutral&&!secondary))){
  if(rig.skin.material===state.material)rig.skin.material=authored;state.material.dispose();state.material=null;
 }
 if(neutral||secondary){
  if(!state.material){state.material=makeBodyMaterial(THREE,rig,base,neutral);state.base=base;state.neutral=neutral;}
  const u=state.material.userData.nativeRosterCoat;
  u.nrCoat.value.set(validColor(horse.colors?.body)?horse.colors.body:colors.body||'#8a5a2b');
  u.nrMarkColor.value.set(validColor(horse.markCol)?horse.markCol:marks.markCol||'#f2ece0');
  u.nrMark.value=neutral?(MARKS[horse.mark??marks.mark]||0):0;u.nrMark2.value=secondary;
  u.nrSeed.value=Array.from(String(horse.id||1)).reduce((n,c)=>(n*31+c.charCodeAt(0))%97,0);
  rig.skin.material=state.material;
 }else rig.skin.material=authored;
 if((maneCustom||tailTint)&&!state.hair.length)state.hair=prepareHair(THREE,rig);
 for(const entry of state.hair)for(const material of entry.materials){
  const u=material.userData.nativeRosterHair;
  u.nrMane.value.set(validColor(horse.colors?.mane)?horse.colors.mane:colors.mane||'#332214');
  u.nrTail.value.set(tailCustom?horse.tailCol:validColor(horse.colors?.mane)?horse.colors.mane:colors.mane||'#332214');
  u.nrManeOn.value=maneCustom?1:0;u.nrTailOn.value=tailTint?1:0;
 }
 state.applied={body:!!neutral,mark:neutral?(horse.mark??marks.mark??'none'):'authored',mark2:horse.mark2||null,mane:maneCustom,tail:tailTint};
 return state;
}
