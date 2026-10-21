import {cascadeSpread} from './cascade-flow.mjs?v=hollowpeak-cascades-1';
import {HOLLOWPEAK_CATARACT_PROFILE} from './hollowpeak-cataract.mjs?v=hollowpeak-cataract-2';
// One existing selected material only; no Three/resources/RNG/clock is created.
export const HOLLOWPEAK_IMPACT_FOAM_PROFILE='hollowpeak-impact-current-1';
const FALL_PROFILE='hollowpeak-falling-water-stranded-2',OLD_KEY='aerated-impact-v3-natural-footprint';
const need=(v,m)=>{if(!v)throw Error('Selected Hollowpeak impact: '+m);return v;};
function once(s,a,b){need(s.split(a).length===2,'source shader contract changed');return s.replace(a,b);}
const identity=o=>o.position.x===0&&o.position.y===0&&o.position.z===0&&o.quaternion.x===0&&o.quaternion.y===0&&o.quaternion.z===0&&o.quaternion.w===1&&o.scale.x===1&&o.scale.y===1&&o.scale.z===1;
const gl=x=>{need(Number.isFinite(x),'finite shader binding');return Number(x).toPrecision(17);};
export function configureHollowpeakImpactFoam({foam,fall,flow,landing,time}){
 need(foam?.isMesh&&fall?.isGroup&&fall.children.length===1&&fall.children[0]?.isMesh,'actual selected foam/fall');
 const mesh=fall.children[0],g=mesh.geometry,m=foam.material,meta=fall.userData.waterfallArt;
 need(identity(fall)&&identity(mesh)&&!fall.parent&&!foam.parent,'untransformed source-phase selected owners');
 need(meta?.profile===HOLLOWPEAK_CATARACT_PROFILE&&mesh.material.userData.hollowpeakFallingWater?.profile===FALL_PROFILE,'actual stranded-2 cataract profile');
 need(m?.type==='MeshStandardMaterial'&&m.name==='Water | aerated impact foam'&&m.customProgramCacheKey()===OLD_KEY&&!m.userData.hollowpeakImpactFoam,'unmodified existing selected impact material');
 need(foam.rotation.x===-Math.PI/2&&foam.rotation.y===0&&foam.rotation.z===0&&foam.scale.x===1&&foam.scale.y===1&&foam.scale.z===1&&foam.geometry.attributes.position.count===66&&foam.geometry.index.count===192,'original impact footprint/pose');
 need(time&&Number.isFinite(time.value)&&Array.isArray(landing)&&landing.length===3&&landing.every(Number.isFinite),'existing shared clock/landing');
 need(['x','z','top','bottom','width','run'].every(k=>Number.isFinite(flow?.[k]))&&['top','bottom','width','run'].every(k=>Object.is(meta[k],flow[k]))&&meta.lipZRange?.every(z=>Object.is(z,flow.z))&&flow.width>0&&flow.run>0,'actual source flow metadata');
 need(foam.position.x===landing[0]&&foam.position.z===landing[2],'same actual landing XZ');
 const p=g.attributes.position,u=g.attributes.uv,rateA=g.attributes.cascadeSpeed,across=g.attributes.cascadeAcross,motion=g.attributes.cascadeMotion;
 need([p,u,rateA,across,motion].every(a=>a?.array instanceof Float32Array&&a.count===p.count),'resident Float32 fall attributes');
 const rate=rateA.array[0];need(Number.isFinite(rate)&&rate>0&&rateA.array.every(v=>Object.is(v,rate))&&Math.fround(meta.rate)===rate,'identical actual Float32 travel rate');
 const halfWidth=flow.width*cascadeSpread(flow,1),tolerance=Math.max(1,Math.abs(flow.x),Math.abs(flow.z),...landing.map(Math.abs))*2**-22;
 need(Number.isFinite(halfWidth)&&halfWidth>0&&Math.abs(landing[0]-flow.x)<=tolerance&&Math.abs(landing[1]-flow.bottom)<=tolerance&&Math.abs(landing[2]-(flow.z+flow.run))<=tolerance,'actual +Z flow/landing');
 let toe=0,lip=0,lipMinX=Infinity,lipMaxX=-Infinity,minX=Infinity,maxX=-Infinity,minAcross=Infinity,maxAcross=-Infinity,maxFxResidual=0,maxToePositionResidual=0;
 for(let i=0;i<p.count;i++){
  const x=p.array[i*3],y=p.array[i*3+1],z=p.array[i*3+2],v=u.array[i*2+1],fx=across.array[i];
  need([x,y,z,v,fx,motion.array[i]].every(Number.isFinite),'finite actual fall data');
  if(v===0){lip++;lipMinX=Math.min(lipMinX,x);lipMaxX=Math.max(lipMaxX,x);need(Math.abs(z-flow.z)<=tolerance&&Math.abs(y-flow.top)<=tolerance,'actual lip basis');}
  if(v!==1)continue;toe++;need(motion.array[i]===0,'zero actual toe vertex motion');
  const residual=Math.max(Math.abs(y-flow.bottom),Math.abs(z-landing[2]),Math.abs(x-(landing[0]+(2*fx-1)*halfWidth)));
  need(residual<=tolerance,'toe geometry/whole-width coordinates match actual flow');
  maxToePositionResidual=Math.max(maxToePositionResidual,residual);maxFxResidual=Math.max(maxFxResidual,Math.abs(.5+(x-landing[0])/(2*halfWidth)-fx));minX=Math.min(minX,x);maxX=Math.max(maxX,x);minAcross=Math.min(minAcross,fx);maxAcross=Math.max(maxAcross,fx);
 }
 need(toe>1&&lip>1&&Math.abs((lipMinX+lipMaxX)/2-flow.x)<=tolerance&&Math.abs((lipMaxX-lipMinX)/2-flow.width)<=tolerance&&Math.abs(minAcross)<=2**-22&&Math.abs(maxAcross-1)<=2**-22&&Math.abs((minX+maxX)/2-landing[0])<=tolerance&&Math.abs((maxX-minX)/2-halfWidth)<=tolerance,'complete actual toe span');
 const compile=m.onBeforeCompile.bind(m),binding=Object.freeze({landingX:landing[0],landingZ:landing[2],axis:'+Z',across:'+X',toeHalfWidthM:halfWidth,actualFloat32Rate:rate,toeVertices:toe,lipVertices:lip,zeroToeMotion:true,maximumPackedPositionResidualM:maxToePositionResidual,maximumPackedFxResidual:maxFxResidual,packingToleranceM:tolerance,fallProfile:FALL_PROFILE});
 m.onBeforeCompile=(shader,renderer)=>{
  compile(shader,renderer);need(shader.uniforms.waterfallTime===time,'original live shared clock identity');
  shader.vertexShader='varying vec2 impactWorldXZ;\n'+shader.vertexShader;
  shader.vertexShader=once(shader.vertexShader,'#include <begin_vertex>','#include <begin_vertex>\nimpactWorldXZ=(modelMatrix*vec4(position,1.0)).xz;');
  shader.fragmentShader='varying vec2 impactWorldXZ;\n'+shader.fragmentShader;
  shader.fragmentShader=once(shader.fragmentShader,
   'diffuseColor.a*=(1.0-smoothstep(.40,1.0,sr+(breakup-.5)*.18))*max(core,scattered);',
   `// Same accepted current field at the actual toe (s=1). foamNoise has
    // the identical hash/interpolation math as the selected fall's fallNoise.
    vec2 impactDelta=impactWorldXZ-vec2(${gl(binding.landingX)},${gl(binding.landingZ)});
    float fx=.5+impactDelta.x/(2.0*${gl(binding.toeHalfWidthM)});
    float fallTravel=1.0-waterfallTime*${gl(binding.actualFloat32Rate)};
    float currentBend=(foamNoise(vec2(fx*3.1,fallTravel*2.8))-.5)*.025;
    float fallStream=fx+currentBend;
    float mainAxis=.313+(foamNoise(vec2(2.7,fallTravel*2.0))-.5)*.025;
    float sideAxis=.745+(foamNoise(vec2(9.1,fallTravel*2.6))-.5)*.019;
    float mainWidth=.118+.024*foamNoise(vec2(1.9,fallTravel*2.1));
    float sideWidth=.061+.018*foamNoise(vec2(7.3,fallTravel*3.4));
    float mainCurrent=exp(-pow((fallStream-mainAxis)/mainWidth,2.0));
    float sideCurrent=exp(-pow((fallStream-sideAxis)/sideWidth,2.0));
    float impactBody=clamp((.58*mainCurrent+.32*sideCurrent)*bubbles+.12*scattered,0.0,.60);
    float directionGate=smoothstep(-1.0,-.1,impactDelta.y)*(1.0-smoothstep(.9,2.6,impactDelta.y));
    diffuseColor.a*=(1.0-smoothstep(.40,1.0,sr+(breakup-.5)*.18))*min(max(core,scattered),impactBody)*directionGate;`);
 };
 m.customProgramCacheKey=()=>OLD_KEY+'|'+HOLLOWPEAK_IMPACT_FOAM_PROFILE+'|'+[binding.landingX,binding.landingZ,binding.toeHalfWidthM,binding.actualFloat32Rate].join(',');
 m.opacity=.52;m.color.set('#c0d2cf');m.userData.hollowpeakImpactFoam={profile:HOLLOWPEAK_IMPACT_FOAM_PROFILE,geometryUnchanged:true,sharedClockUnchanged:true};
 return {profile:HOLLOWPEAK_IMPACT_FOAM_PROFILE,binding,material:m,sharedTime:time};
}
