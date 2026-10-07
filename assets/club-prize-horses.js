/* Club champions wear their own material artwork on the existing native rig.
 * Bind-space paint follows the skinned coat; no bones, animation tracks, source
 * geometry, tack or shared materials are changed by these appearance layers. */
const VERSION='club-prize-horses-1';
export const CLUB_PRIZE_APPEARANCES=Object.freeze({
 moonveil:{name:'Moonveil Andalusian',body:'#d9dbeb',mane:'#4d497a',roughness:.42,metalness:.045,mote:[.61,.72,1]},
 stormglass:{name:'Stormglass Arabian',body:'#182932',mane:'#93b5c6',roughness:.38,metalness:.07,mote:[.35,.84,.86]},
 rosebloom:{name:'Rosebloom Gypsy Vanner',body:'#ead5d0',mane:'#75445f',roughness:.51,metalness:.025,mote:[1,.56,.61]},
});
const declarations=`
uniform vec3 cpMin,cpSize;
uniform float cpTime,cpEnergy;
varying vec3 cpPosition;
float cpHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float cpNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(cpHash(i),cpHash(i+vec2(1,0)),f.x),mix(cpHash(i+vec2(0,1)),cpHash(i+vec2(1,1)),f.x),f.y);}
float cpLine(vec2 p,vec2 a,vec2 b,float width){vec2 ab=b-a;float h=clamp(dot(p-a,ab)/max(dot(ab,ab),.0001),0.0,1.0);return 1.0-smoothstep(width,width*1.7,length(p-a-ab*h));}
float cpDot(vec2 p,vec2 center,float size){return 1.0-smoothstep(size*.50,size,length(p-center));}
float cpLeaf(vec2 p,vec2 center,float turn,float size){p-=center;p=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*p;return (1.0-smoothstep(.92,1.04,length(p/vec2(size,size*.42))))*(.65+.35*smoothstep(-.005,.005,p.y));}
float cpMineral(vec2 p,float seed){
 vec2 q=p*vec2(5.2,4.3)+vec2(seed,seed*.31),cell=floor(q),f=fract(q);
 float first=10.0,second=10.0;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 o=vec2(float(x),float(y)),c=cell+o;
  float d=length(o+.18+.64*vec2(cpHash(c),cpHash(c+13.6))-f);
  if(d<first){second=first;first=d;}else second=min(second,d);
 }
 return (1.0-smoothstep(.024,.054,second-first))*smoothstep(.38,.68,cpNoise(p*4.0+seed));
}
`;
const sharedPaint=`
vec3 cpRel=(cpPosition-cpMin)/max(cpSize,vec3(.0001));
float cpL=clamp(dot(diffuseColor.rgb,vec3(.299,.587,.114)),0.0,1.0);
float cpDetail=clamp(.28+.86*pow(cpL,.75),.26,1.08);
float cpSide=smoothstep(.07,.25,abs(cpRel.x-.5));
float cpHoof=smoothstep(.037,.065,cpRel.y);
vec2 cpFlank=vec2((cpRel.z-.24)/.28,(cpRel.y-.62)/.29);
vec2 cpShoulder=vec2((cpRel.z-.675)/.21,(cpRel.y-.625)/.28);
float cpFlankMask=1.0-smoothstep(.32,.58,length(cpFlank));
float cpShoulderMask=1.0-smoothstep(.28,.53,length(cpShoulder));
float cpFace=smoothstep(.79,.88,cpRel.z);
vec2 cpCrest=vec2((cpRel.x-.5)/.026,(cpRel.y-.884)/.020);
vec3 cpGlow=vec3(0);
`;
const bodyPaint={
 moonveil:`
  vec3 cpPearl=mix(vec3(.49,.52,.63),vec3(.76,.75,.77),smoothstep(.25,.80,cpRel.y));
  float cpDapple=cpNoise(cpRel.zy*56.0+cpRel.x*7.0);
  cpPearl*=.94+.06*smoothstep(.32,.69,cpDapple);
  diffuseColor.rgb=mix(vec3(.055,.050,.068),cpPearl,cpHoof)*cpDetail;
  // An understated constellation sits over each hip, with silver star points
  // and faint blue-grey links. It is a small flank motif, never a body stripe.
  vec2 cpP=cpFlank;
  float cpLinks=max(max(cpLine(cpP,vec2(-.28,-.06),vec2(-.08,.20),.006),cpLine(cpP,vec2(-.08,.20),vec2(.14,.10),.006)),max(cpLine(cpP,vec2(.14,.10),vec2(.30,.28),.006),cpLine(cpP,vec2(.14,.10),vec2(.23,-.18),.006)));
  float cpStars=max(max(cpDot(cpP,vec2(-.28,-.06),.024),cpDot(cpP,vec2(-.08,.20),.032)),max(cpDot(cpP,vec2(.14,.10),.025),max(cpDot(cpP,vec2(.30,.28),.020),cpDot(cpP,vec2(.23,-.18),.021))));
  float cpStardust=smoothstep(.976,.998,cpNoise(cpRel.zy*185.0))*cpFlankMask*.26;
  float cpMoon=(1.0-smoothstep(.73,.86,length(cpCrest)))*smoothstep(.63,.77,length(cpCrest-vec2(.38,.13)))*cpFace;
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.29,.34,.48)*cpDetail,cpLinks*cpSide*.65);
  float cpSilver=max((cpStars+cpStardust)*cpSide,cpMoon);
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.72,.82,.94),cpSilver*.85);
  cpGlow=vec3(.28,.42,.76)*cpSilver*(.07+.06*cpEnergy);
 `,
 stormglass:`
  vec3 cpStorm=mix(vec3(.012,.020,.030),vec3(.027,.072,.076),smoothstep(.38,.84,cpRel.y));
  float cpSheen=cpNoise(cpRel.zy*7.0+cpRel.x*2.0);
  cpStorm*=.88+.22*cpSheen;
  diffuseColor.rgb=mix(vec3(.007,.009,.012),cpStorm,cpHoof)*cpDetail;
  // Thin mineral seams live in two irregular shoulder/hip clusters, with dark
  // breaks between facets and a restrained cyan heart instead of a full glow.
  float cpSeam=max(cpMineral(cpFlank+.5,8.0)*cpFlankMask,cpMineral(cpShoulder+.5,2.0)*cpShoulderMask)*cpSide;
  float cpCore=cpSeam*smoothstep(.45,.85,cpNoise(cpRel.zy*47.0));
  float cpSeal=max(cpLine(cpCrest,vec2(.16,.80),vec2(-.20,.04),.055),cpLine(cpCrest,vec2(-.20,.04),vec2(.18,.11),.055));
  cpSeal=max(cpSeal,cpLine(cpCrest,vec2(.18,.11),vec2(-.15,-.76),.055))*cpFace;
  float cpEtch=max(cpSeam,cpSeal);
  diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.08,.25,.27),vec3(.36,.67,.66),cpCore),cpEtch*.87);
  cpGlow=vec3(.11,.55,.56)*(cpCore*.13+cpSeal*.07)*(.8+cpEnergy*.45);
 `,
 rosebloom:`
  float cpBlush=smoothstep(.25,.85,cpNoise(cpRel.zy*8.0+cpRel.x*3.0));
  vec3 cpCream=mix(vec3(.76,.67,.58),vec3(.69,.47,.48),cpBlush*.43);
  diffuseColor.rgb=mix(vec3(.07,.045,.05),cpCream,cpHoof)*cpDetail;
  // A pair of short climbing vines follows the shoulder and hip. Leaf shapes
  // are tapered, asymmetric and shaded like pigment, not floating jewelry.
  float cpVine=0.0,cpLeaves=0.0,cpBuds=0.0;
  for(int i=0;i<2;i++){
   vec2 cpP=i==0?cpFlank:cpShoulder;
   float cpCurve=.10*sin((cpP.y+.30)*5.5)+cpP.y*.23;
   float cpStem=(1.0-smoothstep(.008,.016,abs(cpP.x-cpCurve)))*smoothstep(-.38,-.29,cpP.y)*(1.0-smoothstep(.28,.37,cpP.y));
   cpVine=max(cpVine,cpStem);
   cpLeaves=max(cpLeaves,cpLeaf(cpP,vec2(-.16,-.23),.55,.105));
   cpLeaves=max(cpLeaves,cpLeaf(cpP,vec2(.16,-.10),-.55,.11));
   cpLeaves=max(cpLeaves,cpLeaf(cpP,vec2(-.027,.065),.64,.10));
   cpLeaves=max(cpLeaves,cpLeaf(cpP,vec2(.23,.22),-.45,.086));
   vec2 cpFlower=cpP-vec2(.10,.34);
   float cpPetalRadius=.032+.010*cos(atan(cpFlower.y,cpFlower.x)*5.0);
   cpBuds=max(cpBuds,1.0-smoothstep(cpPetalRadius,cpPetalRadius+.008,length(cpFlower)));
  }
  cpVine*=cpSide;cpLeaves*=cpSide;cpBuds*=cpSide;
  float cpPetal=cpLeaf(cpCrest,vec2(-.16,.04),.62,.42)+cpLeaf(cpCrest,vec2(.16,.04),-.62,.42);
  cpPetal=min(1.0,cpPetal)*cpFace;
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.29,.24,.10)*cpDetail,cpVine*.84);
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.16,.30,.15)*(.75+.25*cpDetail),cpLeaves*.77);
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.57,.22,.30),max(cpBuds,cpPetal)*.9);
  cpGlow=vec3(.42,.28,.07)*cpVine*.025+vec3(.48,.18,.22)*cpPetal*.035;
 `,
};
const hairPaint={
 moonveil:'vec3 cpHairColor=mix(vec3(.068,.058,.17),vec3(.68,.74,.88),smoothstep(.12,.97,cpTip));',
 stormglass:'vec3 cpHairColor=mix(vec3(.085,.15,.20),vec3(.49,.75,.76),smoothstep(.08,.98,cpTip));',
 rosebloom:'vec3 cpHairColor=mix(vec3(.16,.038,.09),vec3(.68,.26,.34),smoothstep(.08,.95,cpTip));',
};
function hook(material,base,tag,uniforms,fragmentDeclarations,paint,emissive){
 const previous=base.onBeforeCompile,cache=base.customProgramCacheKey.call(base);
 material.onBeforeCompile=shader=>{
  previous?.call(material,shader);Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='varying vec3 cpPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncpPosition=position;');
  shader.fragmentShader=fragmentDeclarations+shader.fragmentShader.replace('#include <map_fragment>',paint);
  if(emissive)shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n'+emissive);
 };
 material.customProgramCacheKey=()=>cache+'|'+VERSION+'|'+tag;material.needsUpdate=true;
}

export function createClubPrizeHorse({THREE,inst,id=inst?.key}={}){
 const config=CLUB_PRIZE_APPEARANCES[id];
 if(!config||!THREE||!inst?.skin||!inst.scene)return null;
 const {scene,skin}=inst,original=skin.material,hair=[],owned=[];
 if(!skin.geometry.boundingBox)skin.geometry.computeBoundingBox();
 const box=skin.geometry.boundingBox,size=box.getSize(new THREE.Vector3());
 const time={value:0},energy={value:0},flow={value:0},dye={value:new THREE.Vector2(1,1)};
 const uniforms={cpMin:{value:box.min.clone()},cpSize:{value:size},cpTime:time,cpEnergy:energy};
 const clone=(base,name)=>{const mat=base.clone();mat.name=name;owned.push(mat);inst.materials?.push(mat);return mat;};
 const material=clone(original,config.name+' · signature coat');
 if(inst.nativeNeutralCoat)material.map=inst.nativeNeutralCoat;
 material.color.set(0xffffff);material.roughness=config.roughness;material.metalness=config.metalness;material.emissive?.set(0x000000);
 hook(material,original,id+'-coat',uniforms,declarations,'#include <map_fragment>\n'+sharedPaint+bodyPaint[id],'totalEmissiveRadiance+=cpGlow;');
 skin.material=material;
 scene.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||mesh===skin||mesh.geometry?.attributes.position.count!==inst.profile.hairVertexCount)return;
  const originals=mesh.material,isArray=Array.isArray(originals),bases=isArray?originals:[originals];
  const materials=bases.map(base=>{
   const mat=clone(base,config.name+' · gradient groom');
   mat.color.set(0xffffff);mat.roughness=.46;mat.metalness=.025;mat.emissive?.set(0x000000);
   hook(mat,base,id+'-hair',{...uniforms,cpHairDye:dye},'uniform vec3 cpMin,cpSize;uniform float cpEnergy;uniform vec2 cpHairDye;varying vec3 cpPosition;\n',`
    vec3 cpHairRel=(cpPosition-cpMin)/max(cpSize,vec3(.0001));
    float cpTail=1.0-smoothstep(.16,.36,cpHairRel.z);
    float cpTip=mix(clamp((.96-cpHairRel.y)*2.7+abs(cpHairRel.x-.5)*1.2,0.0,1.0),1.0-smoothstep(.13,.69,cpHairRel.y),cpTail);
    ${hairPaint[id]}
    diffuseColor.rgb*=cpHairColor;
    #include <map_fragment>
    float cpHairDetail=clamp(dot(diffuseColor.rgb/max(cpHairColor,vec3(.001)),vec3(.299,.587,.114)),0.0,1.0);
    vec3 cpHairGlow=cpHairColor*.012*cpTip*cpHairDetail*mix(cpHairDye.x,cpHairDye.y,cpTail);
   `,'totalEmissiveRadiance+=cpHairGlow;');
   return mat;
  });
  mesh.material=isArray?materials:materials[0];hair.push({mesh,originals,materials});
 });

 // One small fixed-capacity cloud rides with the animated groom. Most points
 // remain invisible at rest; it never adds a light or allocates during update.
 const count=14,positions=new Float32Array(count*3),seeds=new Float32Array(count*4);
 for(let i=0;i<count;i++){seeds[i*4]=(i*.61803398875)%1;seeds[i*4+1]=(i*.41421356237+.17)%1;seeds[i*4+2]=(i*.73205080756+.37)%1;seeds[i*4+3]=i/count;}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('cpSeed',new THREE.BufferAttribute(seeds,4));
 const mane={value:new THREE.Vector3()},tail={value:new THREE.Vector3()},scale={value:Math.max(.6,(inst.profile.withersM||1.7)/Math.abs(scene.scale.y||1))};
 const moteMaterial=new THREE.ShaderMaterial({name:config.name+' · drifting motes',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{cpTime:time,cpFlow:flow,cpEnergy:energy,cpMane:mane,cpTail:tail,cpScale:scale,cpMoteColor:{value:new THREE.Vector3(...config.mote)}},
  vertexShader:`attribute vec4 cpSeed;uniform float cpTime,cpFlow,cpEnergy,cpScale;uniform vec3 cpMane,cpTail;varying float cpAlpha;
   void main(){float age=fract(cpSeed.x+cpFlow*(.10+cpSeed.y*.05));vec3 p=mix(cpMane,cpTail,step(.48,cpSeed.z));
    p+=vec3((cpSeed.y-.5)*.14,(cpSeed.z-.5)*.05,(cpSeed.x-.5)*.10)*cpScale;
    p.x+=sin(cpTime*.55+cpSeed.x*16.0+age*3.0)*age*.05*cpScale;p.y+=age*(.06+cpEnergy*.12)*cpScale;p.z-=age*(.045+cpEnergy*.27)*cpScale;
    vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((4.5+cpSeed.y*3.0)*cpScale/max(1.0,-mv.z),1.0,3.4);
    cpAlpha=sin(age*3.14159265)*(.15+cpEnergy*.22)*step(cpSeed.w,.15+cpEnergy*.85);
   }`,
  fragmentShader:`uniform vec3 cpMoteColor;varying float cpAlpha;void main(){vec2 p=gl_PointCoord-.5;${id==='rosebloom'?'p=mat2(.8,-.6,.6,.8)*p;p.x/=.64;':''}float d=length(p);if(d>.5)discard;gl_FragColor=vec4(cpMoteColor,(1.0-smoothstep(.02,.5,d))*cpAlpha);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`});
 const motes=new THREE.Points(geometry,moteMaterial);motes.name=config.name+' Motes';motes.frustumCulled=false;motes.renderOrder=1;scene.add(motes);
 const bones=inst.bones||skin.skeleton.bones,maneBone=bones.find(b=>b.name==='neck_04_017')||bones.find(b=>b.name==='head_019'),tailBone=bones.find(b=>b.name==='tail_03_0369')||bones.find(b=>b.name==='tail_01_0367');
 let disposed=false,clock=0;
 const appearance={id,material,motes,version:VERSION,particleCapacity:count,get energy(){return energy.value;},get disposed(){return disposed;},
  update(dt,state={}){
   if(disposed)return;const step=Math.min(.12,Math.max(0,Number(dt)||0));clock=(clock+step)%10000;time.value=clock;
   const target=Math.max(0,Math.min(1,Number(state.intensity)||Math.abs(Number(state.speedMps)||0)/8));energy.value+=(target-energy.value)*(1-Math.exp(-step*3));flow.value=(flow.value+step*(1+energy.value*.40))%10000;
   if(maneBone){maneBone.getWorldPosition(mane.value);scene.worldToLocal(mane.value);mane.value.y+=scale.value*.04;}
   if(tailBone){tailBone.getWorldPosition(tail.value);scene.worldToLocal(tail.value);}
   const custom=inst.nativeCustomization?.applied;dye.value.set(custom?.mane?0:1,custom?.tail?0:1);
   motes.visible=!custom?.body;
  },
  dispose(){
   if(disposed)return;disposed=true;if(skin.material===material)skin.material=original;
   for(const entry of hair)if(entry.mesh.material===entry.materials||entry.mesh.material===entry.materials[0])entry.mesh.material=entry.originals;
   motes.removeFromParent();geometry.dispose();moteMaterial.dispose();
   for(const mat of owned){mat.dispose();const index=inst.materials?.indexOf(mat);if(index>=0)inst.materials.splice(index,1);}
  },
 };
 appearance.update(0);return appearance;
}
