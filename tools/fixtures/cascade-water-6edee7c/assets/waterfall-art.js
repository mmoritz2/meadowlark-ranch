import {createWaterfallEffects} from './waterfall-effects.js?v=living-cascades-1';
/* Lit falling water: accelerating fine strands, broken edges and aerated flow.
   Both waterfalls share this material and one frame clock, with no allocations
   during animation. UV.y is travel down the fall; UV.x is across its width. */
export function createWaterfallArt({THREE:T}){
 const time={value:0},mistMaterials=[],effectGroups=[];
 const material=new T.MeshStandardMaterial({name:'Water | flowing waterfall',color:'#bfd0ce',roughness:.38,metalness:0,transparent:true,opacity:.86,depthWrite:false,side:T.DoubleSide});
 material.forceSinglePass=true;
 material.defaultAttributeValues={...material.defaultAttributeValues,cascadePhase:[0]};
 material.onBeforeCompile=sh=>{
  sh.uniforms.waterfallTime=time;
  sh.vertexShader='attribute float cascadePhase; varying float cascadeLayer; varying vec2 cascadeUV;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncascadeUV=uv;cascadeLayer=cascadePhase;');
  sh.fragmentShader=`varying vec2 cascadeUV;varying float cascadeLayer;uniform float waterfallTime;
   float fallHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
   float fallNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(fallHash(i),fallHash(i+vec2(1,0)),f.x),mix(fallHash(i+vec2(0,1)),fallHash(i+vec2(1,1)),f.x),f.y);}
   `+sh.fragmentShader;
  sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec2 fuv=cascadeUV;
   // Sqrt travel compresses detail near the lip and stretches it as it falls.
   float fy=sqrt(max(fuv.y,.0001))-waterfallTime*.47+cascadeLayer;
   float drift=fallNoise(vec2(fuv.x*11.0,fy*5.0));
   float folds=fallNoise(vec2(fuv.x*19.0+drift*1.8,fy*9.0));
   float streak=fallNoise(vec2(fuv.x*115.0+drift*2.0,fy*18.0));
   float mist=fallNoise(vec2(fuv.x*56.0,fy*63.0));
   float fine=fallNoise(vec2(fuv.x*240.0,fy*113.0));
   float aeration=smoothstep(.31,.69,folds*.46+streak*.25+mist*.21+fine*.08);
   aeration*=mix(.55,1.0,smoothstep(.02,.62,fuv.y));
   float edge=smoothstep(0.0,.025+drift*.045,fuv.x)*smoothstep(0.0,.025+(1.0-drift)*.045,1.0-fuv.x);
   diffuseColor.rgb=mix(vec3(.075,.14,.15),vec3(.88,.94,.93),aeration);
   diffuseColor.a*=edge*mix(.28,.96,aeration)*(1.0-smoothstep(.96,1.0,fuv.y));
  `);
  sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   normal=normalize(normal+vec3((fine-.5)*.10,(mist-.5)*.08,0.0));`);
 };
 material.customProgramCacheKey=()=> 'flowing-waterfall-v2';
 function fall({x,z,top,bottom,width,run=2.6,name='waterfall'}){
  const root=new T.Group();root.name='Water | '+name;const p=[],uv=[],phases=[],ix=[],R=64,C=32;
  // Two thin curved surfaces give a visible side edge without a solid plastic volume.
  for(let layer=0;layer<2;layer++){
   const offset=p.length/3;
   for(let j=0;j<=R;j++)for(let i=0;i<=C;i++){
    const v=j/R,u=i/C,edge=u*2-1,w=width*(1+v*.29),ripple=Math.sin(v*39+u*12)*.013;
    p.push(x+edge*w,top-(top-bottom)*Math.pow(v,1.055),z+run*v*v+Math.sin(u*Math.PI)*.14+ripple-layer*.10);uv.push(u,v);phases.push(layer*.37);
   }
   for(let j=0;j<R;j++)for(let i=0;i<C;i++){const a=offset+j*(C+1)+i,b=a+C+1;ix.push(a,b,a+1,a+1,b,b+1);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setAttribute('cascadePhase',new T.Float32BufferAttribute(phases,1));geo.setIndex(ix);geo.computeVertexNormals();
  const mesh=new T.Mesh(geo,material);mesh.renderOrder=2;root.add(mesh);root.userData.waterfallArt={top,bottom,width,run};return root;
 }
 function pool({x,z,y,radius=7.4}){
  const g=new T.CircleGeometry(radius,80),p=g.attributes.position;
  for(let i=1;i<p.count;i++){const a=Math.atan2(p.getY(i),p.getX(i)),scale=1+.09*Math.sin(a*5)+.04*Math.cos(a*9);p.setXYZ(i,p.getX(i)*scale,p.getY(i)*scale*.87,0);}
  const m=new T.MeshStandardMaterial({name:'Water | feathered plunge pool',color:'#618b88',roughness:.18,metalness:.17,transparent:true,opacity:.75,depthWrite:false});
  m.onBeforeCompile=sh=>{sh.uniforms.waterfallTime=time;sh.vertexShader='varying vec2 poolUV;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npoolUV=uv;');sh.fragmentShader='varying vec2 poolUV;uniform float waterfallTime;\n'+sh.fragmentShader;
   sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float radius=length(poolUV-.5)*2.0;
    diffuseColor.a*=1.0-smoothstep(.68,1.0,radius);
    float ripple=sin(radius*91.0-waterfallTime*3.4)*sin(poolUV.x*110.0+waterfallTime*.7);
    diffuseColor.rgb*=.93+.07*ripple;
   `);};m.customProgramCacheKey=()=> 'feathered-falls-pool-v1';
  const out=new T.Mesh(g,m);out.name='Water | irregular plunge pool';out.rotation.x=-Math.PI/2;out.position.set(x,y,z);out.receiveShadow=true;return out;
 }
 function impact({x,y,z,radius=3}){
  const mat=new T.MeshStandardMaterial({name:'Water | aerated impact foam',color:'#d9e1da',roughness:.78,transparent:true,opacity:.78,depthWrite:false});
  mat.onBeforeCompile=sh=>{sh.uniforms.waterfallTime=time;sh.vertexShader='varying vec2 splashUV;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsplashUV=uv;');sh.fragmentShader=`varying vec2 splashUV;uniform float waterfallTime;
    float foamHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
    float foamNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(foamHash(i),foamHash(i+vec2(1,0)),f.x),mix(foamHash(i+vec2(0,1)),foamHash(i+vec2(1,1)),f.x),f.y);}
    `+sh.fragmentShader;
   sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec2 sp=(splashUV-.5)*2.0;
    // Irregular foam patches drift with the surface current. Noise
    // breaks both the bubble walls and the footprint, avoiding concentric discs.
    float sr=length(sp*vec2(1.0,.88));
    vec2 drift=sp+vec2(waterfallTime*.035,-waterfallTime*.065);
    float breakup=foamNoise(sp*5.0+vec2(waterfallTime*.08,-waterfallTime*.06));
    float cells=foamNoise(drift*23.0+breakup*2.1);
    float smallCells=foamNoise(drift*51.0);
    float bubbles=(1.0-smoothstep(.025,.135,abs(cells-.52)))*mix(.38,1.0,smallCells);
    float core=(1.0-smoothstep(.06,.62,sr))*(.38+.62*bubbles);
    float scattered=bubbles*smoothstep(.35,.65,breakup)*.54;
    diffuseColor.a*=(1.0-smoothstep(.40,1.0,sr+(breakup-.5)*.18))*max(core,scattered);
   `);};mat.customProgramCacheKey=()=> 'aerated-impact-v2';
  const out=new T.Mesh(new T.PlaneGeometry(radius*2,radius*2),mat);out.rotation.x=-Math.PI/2;out.position.set(x,y,z);out.renderOrder=3;out.name='Water | soft impact foam';return out;
 }
 function effects(options){const result=createWaterfallEffects({THREE:T,time,...options});mistMaterials.push(...result.materials);effectGroups.push(result);return result;}
 return {fall,pool,impact,effects,mistMaterials,effectGroups,material,time,update(t){time.value=t;}};
}
