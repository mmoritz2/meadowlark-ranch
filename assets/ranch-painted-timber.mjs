import {dressTimberBox} from './ranch-timber-joinery.mjs?v=ranch-timber-joinery-2';
const PITCH=1.8,SCAN_CENTRE=.665;
let paintUUIDState=0x5041494e;
function resources(build){
 const ambient=Math.random;Math.random=()=>{paintUUIDState=(Math.imul(paintUUIDState,1664525)+1013904223)>>>0;return paintUUIDState/4294967296;};
 try{return build();}finally{Math.random=ambient;}
}
// Fixed arena/pasture owners opt in explicitly. Builder fences, other white
// paint consumers, texture loading and all placement/collision owners stay separate.
export function createRanchPaintedTimber({THREE:T,sourceMaterial}={}){
 if(!T||!sourceMaterial?.isMeshStandardMaterial||!sourceMaterial.normalMap||!sourceMaterial.roughnessMap)throw Error('Resident white paint and scanned normal/ARM textures required');
 const templates=new Map();let material=null,disposed=false,meshes=0;
 function paint(){
  if(disposed)throw Error('Painted timber factory disposed');
  if(material)return material;
  material=resources(()=>sourceMaterial.clone());material.name='Ranch | maintained white painted timber';material.map=null;
  material.color.set('#e8e6dd');material.roughness=.82;material.metalness=0;material.normalScale.set(.10,.10);material.envMapIntensity=.62;
  const previous=sourceMaterial.onBeforeCompile,sourceKey=sourceMaterial.customProgramCacheKey();
  material.onBeforeCompile=function(shader,renderer){
   previous?.call(this,shader,renderer);
   for(const[token,source]of[['#include <common>',shader.vertexShader],['#include <begin_vertex>',shader.vertexShader],['#include <color_fragment>',shader.fragmentShader],['#include <roughnessmap_fragment>',shader.fragmentShader]])if(source.split(token).length!==2)throw Error('Painted timber shader seam changed '+token);
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float paintedTimberFoot;varying vec3 vPaintedTimberSurface;varying float vPaintedTimberVariant;').replace('#include <begin_vertex>',`#include <begin_vertex>
    vPaintedTimberSurface=vec3(uv*${PITCH.toFixed(1)},paintedTimberFoot);
    vec4 paintedTimberOrigin=vec4(0.0,0.0,0.0,1.0);
    #ifdef USE_INSTANCING
     paintedTimberOrigin=instanceMatrix*paintedTimberOrigin;
    #endif
    paintedTimberOrigin=modelMatrix*paintedTimberOrigin;
    vec3 paintedTimberHash=fract(paintedTimberOrigin.xyz*.1031);
    paintedTimberHash+=dot(paintedTimberHash,paintedTimberHash.yzx+33.33);
    vPaintedTimberVariant=fract((paintedTimberHash.x+paintedTimberHash.y)*paintedTimberHash.z);
   `);
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vPaintedTimberSurface;varying float vPaintedTimberVariant;').replace('#include <color_fragment>',`#include <color_fragment>
    float paintedTimberPhase=vPaintedTimberSurface.y*1950.0+sin(vPaintedTimberSurface.x*13.0)*.65;
    float paintedTimberVisible=1.0-smoothstep(.65,2.1,fwidth(paintedTimberPhase));
    float paintedTimberGrain=sin(paintedTimberPhase)*paintedTimberVisible;
    float paintedTimberDirt=(1.0-smoothstep(.025,.23,vPaintedTimberSurface.z))*(.88+.12*sin(vPaintedTimberSurface.y*151.0));
    diffuseColor.rgb*=1.0+(vPaintedTimberVariant-.5)*.025+paintedTimberGrain*.005;
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.77,.75,.66),paintedTimberDirt*.23);
   `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    roughnessFactor=clamp(roughnessFactor+.008*paintedTimberGrain+paintedTimberDirt*.035,.46,.96);
   `);
  };
  material.customProgramCacheKey=()=>sourceKey+'|ranch-painted-timber-1';
  material.userData={...sourceMaterial.userData,paintedTimber:{version:1,source:'resident Poly Haven coated_pine CC0 normal/ARM',sharedMaps:true,newSamplers:0,pitchM:PITCH,maintainedPaint:true}};
  material.needsUpdate=true;return material;
 }
 function template(width,height,depth,axis,post){
  const key=[width,height,depth,axis,post].join('|');if(templates.has(key))return templates.get(key);
  const g=resources(()=>new T.BufferGeometry()),radius=Math.min(.0035,width*.045,height*.045,depth*.045);
  dressTimberBox(T,g,{width,height,depth,radius});
  const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,foot=new Float32Array(p.count),along={x:0,y:1,z:2}[axis],others=[0,1,2].filter(i=>i!==along),get=['getX','getY','getZ'];
  for(let i=0;i<p.count;i++){
   const normal=[Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i))];
   const cap=normal[along]>.85,across=normal[others[0]]>normal[others[1]]?others[1]:others[0];
   const u=cap?p[get[others[0]]](i):p[get[along]](i),v=cap?p[get[others[1]]](i):p[get[across]](i);
   // U follows the photograph's horizontal fibres. The same metre pitch serves
   // every length; V stays within one photographed board, away from its joints.
   uv.setXY(i,u/PITCH,SCAN_CENTRE+v/PITCH);foot[i]=post?p.getY(i)+height/2:100;
  }
  g.setAttribute('paintedTimberFoot',new T.BufferAttribute(foot,1));
  g.userData.paintedTimber={version:1,grainAxis:axis,post,width,height,depth,chamferM:radius,pitchM:PITCH,scanCentre:SCAN_CENTRE};
  templates.set(key,g);return g;
 }
 return{
  dress(mesh,{grainAxis='z',post=false}={}){
   if(disposed)throw Error('Painted timber factory disposed');
   if(!mesh?.isMesh||!['x','y','z'].includes(grainAxis))throw Error('Explicit timber mesh and grain axis required');
   const g=mesh.geometry,old=g.userData.paintedTimber;
   if(old){if(old.grainAxis!==grainAxis||old.post!==!!post)throw Error('Painted timber owner changed');mesh.material=paint();mesh.receiveShadow=true;return mesh;}
   if(mesh.material!==sourceMaterial||g.type!=='BoxGeometry')throw Error('Only an explicitly owned original white timber box may be dressed');
   const {width,height,depth}=g.parameters||{};if(![width,height,depth].every(v=>Number.isFinite(v)&&v>0))throw Error('Finite original timber bounds required');
   const targetMaterial=paint(),originalData=g.userData,originalName=g.name,originalParameters=g.parameters;
   if(!g.boundingBox)g.computeBoundingBox();if(!g.boundingSphere)g.computeBoundingSphere();
   const originalBox=g.boundingBox,originalSphere=g.boundingSphere;
   g.copy(template(width,height,depth,grainAxis,!!post));g.parameters=originalParameters;g.boundingBox=originalBox;g.boundingSphere=originalSphere;g.userData={...originalData,...g.userData};g.name=originalName;
   mesh.material=targetMaterial;mesh.receiveShadow=true;meshes++;return mesh;
  },
  stats:()=>({version:1,meshes,templates:templates.size,material:!!material,newSamplers:0,disposed}),
  get material(){return paint();},
  dispose(){if(disposed)return;disposed=true;for(const g of templates.values())g.dispose();templates.clear();material?.dispose();},
 };
}
