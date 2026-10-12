// The CC0 pine atlas was authored for UV islands, rather than a rectangular
// photograph. Its opaque neighbouring cone/branch padding crossed the added
// rectangular spray cards. Bound only those cards to the original twig island.
export const PINE_SPRAY_SURFACE_PROFILE='pine-photo-island-1';
export const PINE_SPRAY_SOURCE_SHA='3d0a4ef03966d85f283baf0b579b11d26993fcdaa83e3e5a6c7ed91b5fb4139f';
export const PINE_SPRAY_CORNERS=Object.freeze([.002929732204165713,.24492256046387426,.001953154802777142,.45812161440451665]);
// 1024px author-alpha clear-surround row envelope, inset by two pixels. The
// inset removes opaque neighbouring padding while retaining every photographed
// opaque twig/needle texel within the current spray crop at its .38 cutoff.
export const PINE_SPRAY_ROWS=Object.freeze([
 [0,2,210],[40,2,231],[80,2,239],[120,2,252],[200,2,248],
 [280,7,237],[320,24,235],[360,33,228],[380,37,224],[400,41,208],
 [420,44,193],[440,70,181],[450,87,173],[456,94,169]
].map(Object.freeze));
export function isPineSprayCorner(u,v){
 const [a,b,c,d]=PINE_SPRAY_CORNERS;
 return (Math.abs(u-a)<.000002||Math.abs(u-b)<.000002)&&
  (Math.abs(v-c)<.000002||Math.abs(v-d)<.000002);
}
export function withinPineSprayIsland(u,v){
 const x=u*1024,y=v*1024;if(y<0||y>456)return false;
 for(let i=1;i<PINE_SPRAY_ROWS.length;i++){
  const a=PINE_SPRAY_ROWS[i-1],b=PINE_SPRAY_ROWS[i];if(y>b[0])continue;
  const t=(y-a[0])/(b[0]-a[0]);return x>=a[1]+(b[1]-a[1])*t&&x<=a[2]+(b[2]-a[2])*t;
 }
 return false;
}
export function pineSprayCornerStats(geometry){
 const uv=geometry.attributes.uv,index=geometry.index;let corners=0,triangles=0,mixed=0;
 if(!uv||!index)return null;
 const flags=[];for(let i=0;i<uv.count;i++){const f=isPineSprayCorner(uv.getX(i),uv.getY(i));flags.push(f);if(f)corners++;}
 for(let i=0;i<index.count;i+=3){const n=Number(flags[index.getX(i)])+Number(flags[index.getX(i+1)])+Number(flags[index.getX(i+2)]);if(n===3)triangles++;else if(n)mixed++;}
 return {corners,triangles,mixed};
}
const number=n=>Number(n).toFixed(9);
const [u0,u1,v0,v1]=PINE_SPRAY_CORNERS;
const vertex=`varying vec2 pineSprayUV;varying float pineSprayPatch;\n`;
const mark=`pineSprayUV=uv;
 pineSprayPatch=((abs(uv.x-${number(u0)})<.000002||abs(uv.x-${number(u1)})<.000002)&&
 (abs(uv.y-${number(v0)})<.000002||abs(uv.y-${number(v1)})<.000002))?1.0:0.0;`;
const envelope=PINE_SPRAY_ROWS.slice(1).map((b,i)=>{
 const a=PINE_SPRAY_ROWS[i];
 return `${i?'else ':''}if(p.y<=${number(b[0])}){
  float t=(p.y-${number(a[0])})/${number(b[0]-a[0])};
  return p.x>=mix(${number(a[1])},${number(b[1])},t)&&p.x<=mix(${number(a[2])},${number(b[2])},t);
 }`;
}).join('\n');
const fragment=`varying vec2 pineSprayUV;varying float pineSprayPatch;
 bool withinPinePhotoIsland(vec2 rawUV){vec2 p=rawUV*1024.0;
  if(p.y<0.0||p.y>456.0)return false;
  ${envelope}
  return false;
 }\n`;
const discard='if(pineSprayPatch>.5&&!withinPinePhotoIsland(pineSprayUV))discard;';
export function patchPineSprayCutout(shader){
 if(shader.vertexShader.includes('varying float pineSprayPatch;'))return false;
 const main=/void\s+main\s*\(\s*\)\s*\{/;
 if(!main.test(shader.vertexShader)||!main.test(shader.fragmentShader))throw Error('Pine spray shader requires both main functions');
 shader.vertexShader=vertex+shader.vertexShader.replace(main,m=>m+'\n'+mark+'\n');
 shader.fragmentShader=fragment+shader.fragmentShader.replace(main,m=>m+'\n'+discard+'\n');
 return true;
}
// Wrap existing programs: retained foliage wind, alpha coverage, shading and
// depth deformation run unchanged, before the same island guard is appended.
export function applyPineSprayCutout(material){
 if(material.userData.pineSpraySurface)return false;
 const before=material.onBeforeCompile,key=material.customProgramCacheKey;
 material.onBeforeCompile=(shader,renderer)=>{before.call(material,shader,renderer);patchPineSprayCutout(shader);};
 material.customProgramCacheKey=()=>key.call(material)+':'+PINE_SPRAY_SURFACE_PROFILE;
 material.userData.pineSpraySurface=PINE_SPRAY_SURFACE_PROFILE;material.needsUpdate=true;
 return true;
}
