import {HOLLOWPEAK_CATARACT_TRAJECTORY_K} from './hollowpeak-cataract.mjs?v=hollowpeak-cataract-2';
// A selected surface response for the existing Hollowpeak cataract. Geometry,
// travel rate, bank contacts and the shared Ribbon/chute material remain owned
// by waterfall-art. All density is one whole-width field across joined veils.
export const HOLLOWPEAK_FALLING_WATER_PROFILE='hollowpeak-falling-water-trajectory-1';
let cloneSerial=0;
function privateClone(material){
 let state=2166136261;for(const c of material.uuid+'|'+HOLLOWPEAK_FALLING_WATER_PROFILE+'|'+(++cloneSerial))state=Math.imul(state^c.charCodeAt(0),16777619);
 const previous=Math.random;Math.random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 try{return material.clone();}finally{Math.random=previous;}
}
function replaceOnce(source,before,after){if(source.split(before).length!==2)throw Error('Hollowpeak waterfall shader contract changed');return source.replace(before,after);}
export function createHollowpeakFallingWaterMaterial(base,{flowTexture=null}={}){
 const compile=base.onBeforeCompile.bind(base),cacheKey=base.customProgramCacheKey();
 const material=privateClone(base);material.name='Water | Hollowpeak accelerating current';material.forceSinglePass=base.forceSinglePass;material.defaultAttributeValues={...base.defaultAttributeValues};
 material.onBeforeCompile=(shader,renderer)=>{
  compile(shader,renderer);
  const begin='   vec2 fuv=cascadeUV;',end='   diffuseColor.a*=outerEdge*mix(.13,.96,aeration);';
  const start=shader.fragmentShader.indexOf(begin),stop=shader.fragmentShader.indexOf(end);
  if(start<0||stop<=start||shader.fragmentShader.indexOf(begin,start+begin.length)!==-1||shader.fragmentShader.indexOf(end,stop+end.length)!==-1)throw Error('Hollowpeak waterfall colour contract changed');
  const field=`   vec2 fuv=cascadeUV;
   float fx=cascadeWholeAcross;
   // Selected UV.y is the principal drop fraction q(s). Its inverse is elapsed
   // fall time; the selected rate retains gravity with finite initial speed.
   float trajectoryK=${HOLLOWPEAK_CATARACT_TRAJECTORY_K.toFixed(8)};
   float fallElapsed=(sqrt(trajectoryK*trajectoryK+4.0*(1.0-trajectoryK)*max(fuv.y,0.0))-trajectoryK)/(2.0*(1.0-trajectoryK));
   float fallTravel=fallElapsed-waterfallTime*cascadeTravelSpeed;
   float currentBend=(fallNoise(vec2(fx*3.1,fallTravel*2.8))-.5)*.025;
   float fallStream=fx+currentBend;
   float mainCurrent=exp(-pow((fallStream-.31)/.20,2.0));
   float sideCurrent=exp(-pow((fallStream-.75)/.13,2.0));
   float bulk=clamp(.30+.61*mainCurrent+.43*sideCurrent,0.0,1.0);
   // Long narrow strands carry the main structure; the photograph contributes
   // only small density variation rather than a full-sheet printed pattern.
   float strandAA=1.0-smoothstep(.45,1.25,max(fwidth(fallStream)*39.0,fwidth(fallTravel)*20.0));
   float mistAA=1.0-smoothstep(.45,1.25,max(fwidth(fallStream)*29.0,fwidth(fallTravel)*39.0));
   float strand=mix(.5,fallNoise(vec2(fallStream*39.0,fallTravel*20.0)),strandAA);
   float fine=mix(.5,fallNoise(vec2(fallStream*139.0,fallTravel*75.0)),1.0-smoothstep(.45,1.25,max(fwidth(fallStream)*139.0,fwidth(fallTravel)*75.0)));
   float mist=mix(.5,fallNoise(vec2(fallStream*29.0,fallTravel*39.0)),mistAA);
   ${flowTexture?`vec4 photoSample=texture2D(waterfallFlowMap,vec2(fallStream*3.8,fallTravel*1.7));float photoDetail=photoSample.a*dot(photoSample.rgb,vec3(.2126,.7152,.0722));`:'float photoDetail=fine;'}
   float pulse=fallNoise(vec2(fallStream*9.0,fallTravel*10.0));
   float brokenCurrent=smoothstep(.22,.78,strand*.74+pulse*.26);
   float entrainment=smoothstep(.008,.44,fuv.y);
   float toe=smoothstep(.68,1.0,fuv.y);
   float aeration=clamp(entrainment*(.31+.57*brokenCurrent+.065*fine)+.11*(1.0-entrainment)*brokenCurrent*bulk+.075*toe+(photoDetail-.5)*.045*entrainment,0.0,1.0);
   float outerEdge=smoothstep(0.0,.012,fx)*smoothstep(0.0,.012,1.0-fx);
   diffuseColor.rgb=mix(vec3(.23,.31,.32),vec3(.88,.94,.92),aeration);
   diffuseColor.a*=outerEdge*clamp(.42+.23*bulk+.28*aeration+(strand-.5)*.045,0.0,.96);`;
  shader.fragmentShader=shader.fragmentShader.slice(0,start)+field+shader.fragmentShader.slice(stop+end.length);
  shader.fragmentShader=replaceOnce(shader.fragmentShader,'roughnessFactor=mix(.28,.58,aeration);','roughnessFactor=mix(.20,.56,aeration);');
  shader.fragmentShader=replaceOnce(shader.fragmentShader,'normal=normalize(normal+vec3((fine-.5)*.025,(mist-.5)*.022,0.0));',`// Surface tangents are in the same view space as the lit physical normal.
   vec3 fallDx=dFdx(-vViewPosition),fallDy=dFdy(-vViewPosition);
   vec2 fallUdx=dFdx(vec2(fx,fuv.y)),fallUdy=dFdy(vec2(fx,fuv.y));
   float fallDet=fallUdx.x*fallUdy.y-fallUdx.y*fallUdy.x;
   vec3 fallAcross=fallDx*fallUdy.y-fallDy*fallUdx.y;
   vec3 fallDown=fallDy*fallUdx.x-fallDx*fallUdy.x;
   fallAcross*=sign(fallDet)/max(length(fallAcross),.00001);
   fallDown*=sign(fallDet)/max(length(fallDown),.00001);
   normal=normalize(normal-fallAcross*(strand-.5)*.075*strandAA-fallDown*(mist-.5)*.035*mistAA);`);
 };
 material.customProgramCacheKey=()=>HOLLOWPEAK_FALLING_WATER_PROFILE+'|'+cacheKey;
 material.userData.hollowpeakFallingWater={profile:HOLLOWPEAK_FALLING_WATER_PROFILE,geometryUnchanged:true};
 return material;
}
