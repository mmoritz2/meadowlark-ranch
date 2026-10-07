/* Ember Friesian's own artwork. All paint is evaluated in the original mesh's
 * bind coordinates, so the 677-joint rig, moving groom and tack stay untouched.
 * Materials and the one bounded cinder draw call belong to this actor only. */
const VERSION='ember-friesian-1';
const bodyDeclarations=`
uniform vec3 efMin,efSize;
uniform float efTime,efEnergy;
varying vec3 efPosition;
float efHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float efNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(efHash(i),efHash(i+vec2(1,0)),f.x),mix(efHash(i+vec2(0,1)),efHash(i+vec2(1,1)),f.x),f.y);}
float efVein(vec2 p,float seed){
 // Irregular mineral seams branch around small plates; they never become a
 // horizontal body stripe. The second-nearest cell gives each shared edge.
 vec2 q=p*vec2(4.4,3.5)+vec2(seed,seed*.31),cell=floor(q),f=fract(q);
 float nearest=10.0,second=10.0;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 o=vec2(float(x),float(y)),c=cell+o;
  vec2 center=o+.20+.60*vec2(efHash(c),efHash(c+19.7));
  float d=length(center-f);
  if(d<nearest){second=nearest;nearest=d;}else second=min(second,d);
 }
 float seam=1.0-smoothstep(.026,.067,second-nearest);
 return seam*smoothstep(.26,.69,efNoise(p*3.2+seed));
}
`;
const bodyPaint=`
vec3 efRel=(efPosition-efMin)/max(efSize,vec3(.0001));
float efL=clamp(dot(diffuseColor.rgb,vec3(.299,.587,.114)),0.0,1.0);
float efDetail=clamp(.36+.80*pow(efL,.70),.30,1.10);
vec3 efCoal=mix(vec3(.022,.022,.029),vec3(.047,.037,.032),smoothstep(.3,.9,efRel.y));
diffuseColor.rgb=efCoal*efDetail;
float efSide=smoothstep(.07,.26,abs(efRel.x-.5));
vec2 efShoulder=vec2((efRel.z-.55)/.27,(efRel.y-.44)/.36);
vec2 efFlank=vec2((efRel.z-.04)/.36,(efRel.y-.43)/.39);
float efShoulderMask=1.0-smoothstep(.23,.54,length((efShoulder-.5)*vec2(1.05,.94)));
float efFlankMask=1.0-smoothstep(.23,.54,length((efFlank-.5)*vec2(.98,1.05)));
float efEtching=max(efVein(efShoulder,2.0)*efShoulderMask,efVein(efFlank,8.0)*efFlankMask)*efSide;
// A few tapering copper traces climb from each coronet, leaving the hoof dark.
float efAnkle=smoothstep(.036,.071,efRel.y)*(1.0-smoothstep(.17,.26,efRel.y));
float efLegTrace=abs(sin(efRel.z*88.0+efRel.x*13.0+efNoise(efRel.yz*21.0)*2.0));
efEtching=max(efEtching,(1.0-smoothstep(.06,.19,efLegTrace))*efAnkle*.80);
// Central, pointed flame crest on the forehead. Its bind-space mask moves with
// the head's skinning instead of floating above the face as a separate decal.
vec2 efCrest=vec2((efRel.x-.5)/.052,(efRel.y-.883)/.038);
float efDiamond=abs(efCrest.x)+abs(efCrest.y);
float efFace=smoothstep(.78,.87,efRel.z);
float efSeal=(1.0-smoothstep(.90,1.06,efDiamond))*smoothstep(.54,.70,efDiamond)*efFace;
float efSealCore=(1.0-smoothstep(.22,.36,efDiamond))*efFace;
efSeal=max(efSeal,efSealCore*.70);
float efInk=max(efEtching,efSeal);
vec3 efCopper=mix(vec3(.33,.10,.024),vec3(.67,.29,.064),efSealCore);
diffuseColor.rgb=mix(diffuseColor.rgb,efCopper*(.66+.34*efDetail),efInk*.95);
float efBreath=.92+.08*sin(efTime*1.25+efRel.z*5.0);
vec3 efGlow=vec3(.76,.20,.035)*efEtching*(.12+.12*efEnergy)*efBreath;
efGlow+=vec3(.95,.37,.06)*efSeal*(.13+.07*efEnergy);
float efRim=pow(1.0-abs(dot(normalize(vNormal),normalize(vViewPosition))),3.5);
efGlow+=vec3(.027,.009,.002)*efRim*smoothstep(.20,.58,efRel.y);
`;

function ownedMaterial(THREE,inst,base,name){
 const material=base.clone();material.name=name;inst.materials?.push(material);return material;
}
function hook(material,base,tag,uniforms,vertex,fragment,emissive){
 const before=base.onBeforeCompile,cache=base.customProgramCacheKey.call(base);
 material.onBeforeCompile=shader=>{
  before?.call(material,shader);Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='varying vec3 efPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nefPosition=position;');
  shader.fragmentShader=vertex+shader.fragmentShader.replace('#include <map_fragment>',fragment);
  if(emissive)shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n'+emissive);
 };
 material.customProgramCacheKey=()=>cache+'|'+VERSION+'|'+tag;material.needsUpdate=true;
}

export function createEmberFriesian({THREE,inst}={}){
 if(!THREE||!inst?.skin||!inst.scene)return null;
 const {scene,skin}=inst,original=skin.material,hair=[],owned=[];
 if(!skin.geometry.boundingBox)skin.geometry.computeBoundingBox();
 const box=skin.geometry.boundingBox,size=box.getSize(new THREE.Vector3());
 const time={value:0},flow={value:0},energy={value:0},dye={value:new THREE.Vector2(1,1)};
 const uniforms={efMin:{value:box.min.clone()},efSize:{value:size},efTime:time,efEnergy:energy};
 const material=ownedMaterial(THREE,inst,original,'Ember Friesian · obsidian and copper');owned.push(material);
 if(inst.nativeNeutralCoat)material.map=inst.nativeNeutralCoat;
 material.color.set(0xffffff);material.roughness=.43;material.metalness=.055;
 material.emissive?.set(0x000000);
 hook(material,original,'body',uniforms,bodyDeclarations,'#include <map_fragment>\n'+bodyPaint,'totalEmissiveRadiance+=efGlow;');
 skin.material=material;
 scene.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||mesh===skin||mesh.geometry?.attributes.position.count!==inst.profile.hairVertexCount)return;
  const originals=mesh.material,isArray=Array.isArray(originals),bases=isArray?originals:[originals];
  const materials=bases.map(base=>{
   const m=ownedMaterial(THREE,inst,base,'Ember Friesian · molten copper groom');owned.push(m);
   m.color.set(0xffffff);m.roughness=.47;m.metalness=.025;m.emissive?.set(0x000000);
   hook(m,base,'hair',{...uniforms,efHairDye:dye},'uniform vec3 efMin,efSize;uniform float efTime,efEnergy;uniform vec2 efHairDye;varying vec3 efPosition;\n',`
    vec3 efHairRel=(efPosition-efMin)/max(efSize,vec3(.0001));
    float efTail=1.0-smoothstep(.16,.36,efHairRel.z);
    float efTip=mix(clamp((.96-efHairRel.y)*2.7+abs(efHairRel.x-.5)*1.2,0.0,1.0),1.0-smoothstep(.13,.69,efHairRel.y),efTail);
    vec3 efHairColor=mix(vec3(.23,.047,.015),vec3(.74,.28,.055),smoothstep(0.0,.64,efTip));
    efHairColor=mix(efHairColor,vec3(1.0,.65,.22),smoothstep(.67,1.0,efTip)*.86);
    diffuseColor.rgb*=efHairColor;
    #include <map_fragment>
    float efHairDetail=clamp(dot(diffuseColor.rgb/max(efHairColor,vec3(.001)),vec3(.299,.587,.114)),0.0,1.0);
    float efHairEnabled=mix(efHairDye.x,efHairDye.y,efTail);
    vec3 efHairGlow=efHairColor*(.035+.13*efTip+.07*efEnergy)*efHairDetail*efHairEnabled;
   `,'totalEmissiveRadiance+=efHairGlow;');
   return m;
  });
  mesh.material=isArray?materials:materials[0];hair.push({mesh,originals,materials,isArray});
 });

 // Fixed-capacity, deterministic particles: no textures, spawning allocations,
 // lights, geometry changes, or CPU particle integration in the animation loop.
 const count=28,positions=new Float32Array(count*3),seeds=new Float32Array(count*4);
 for(let i=0;i<count;i++){seeds[i*4]=(i*.61803398875)%1;seeds[i*4+1]=(i*.41421356237+.17)%1;seeds[i*4+2]=(i*.73205080756+.37)%1;seeds[i*4+3]=i/count;}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('efSeed',new THREE.BufferAttribute(seeds,4));
 const mane={value:new THREE.Vector3()},tail={value:new THREE.Vector3()},scale={value:Math.max(.6,(inst.profile.withersM||1.7)/Math.abs(scene.scale.y||1))};
 const sparks=new THREE.ShaderMaterial({name:'Ember Friesian · drifting cinders',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{efTime:time,efFlow:flow,efEnergy:energy,efMane:mane,efTail:tail,efScale:scale},
  vertexShader:`attribute vec4 efSeed;uniform float efTime,efFlow,efEnergy,efScale;uniform vec3 efMane,efTail;varying float efAlpha,efGold;
   void main(){
    float age=fract(efSeed.x+efFlow*(.13+efSeed.y*.07));
    float fromTail=step(.46,efSeed.z);vec3 p=mix(efMane,efTail,fromTail);
    p+=vec3((efSeed.y-.5)*.20,(efSeed.z-.5)*.09,(efSeed.x-.5)*.16)*efScale;
    p.x+=sin(efTime*.65+efSeed.x*18.0+age*4.0)*age*.045*efScale;
    p.y+=age*(.12+efEnergy*.23)*efScale;
    p.z-=age*(.08+efEnergy*.36)*efScale;
    vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;
    gl_PointSize=clamp((6.0+efSeed.y*4.0)*efScale/max(1.0,-mv.z),1.2,5.0);
    efAlpha=sin(age*3.14159265)*(.28+efEnergy*.35)*step(efSeed.w,.28+efEnergy*.72);efGold=efSeed.y;
   }`,
  fragmentShader:`varying float efAlpha,efGold;void main(){vec2 p=gl_PointCoord-.5;float d=length(p);if(d>.5)discard;float a=(1.0-smoothstep(.06,.5,d))*efAlpha;gl_FragColor=vec4(mix(vec3(1.0,.25,.035),vec3(1.0,.65,.20),efGold),a);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`});
 const cinders=new THREE.Points(geo,sparks);cinders.name='Ember Friesian Cinders';cinders.frustumCulled=false;cinders.renderOrder=1;scene.add(cinders);
 const bones=inst.bones||skin.skeleton.bones,maneBone=bones.find(b=>b.name==='neck_04_017')||bones.find(b=>b.name==='head_019'),tailBone=bones.find(b=>b.name==='tail_03_0369')||bones.find(b=>b.name==='tail_01_0367');
 let disposed=false,clock=0;
 const appearance={material,cinders,version:VERSION,particleCapacity:count,get energy(){return energy.value;},get disposed(){return disposed;},
  update(dt,state={}){
   if(disposed)return;const step=Math.min(.12,Math.max(0,Number(dt)||0));clock=(clock+step)%10000;time.value=clock;
   const target=Math.max(0,Math.min(1,Number(state.intensity)||Math.abs(Number(state.speedMps)||0)/8));energy.value+=(target-energy.value)*(1-Math.exp(-step*3));
   flow.value=(flow.value+step*(1+energy.value*.55))%10000;
   if(maneBone){maneBone.getWorldPosition(mane.value);scene.worldToLocal(mane.value);mane.value.y+=scale.value*.06;}
   if(tailBone){tailBone.getWorldPosition(tail.value);scene.worldToLocal(tail.value);}
   const custom=inst.nativeCustomization?.applied;dye.value.set(custom?.mane?0:1,custom?.tail?0:1);
  },
  dispose(){
   if(disposed)return;disposed=true;
   if(skin.material===material)skin.material=original;
   for(const entry of hair){const current=entry.mesh.material;if(current===entry.materials[0]||current===entry.materials)entry.mesh.material=entry.originals;}
   cinders.removeFromParent();geo.dispose();sparks.dispose();
   for(const m of owned){m.dispose();const i=inst.materials?.indexOf(m);if(i>=0)inst.materials.splice(i,1);}
  }
 };
 appearance.update(0);return appearance;
}
