import {RIVERBANK_ROUTES,RIVERBANK_PROTECTED_SUPPORTS} from './riverbank-route-reference.mjs?v=river-banks-1';
export const RIVERBANK_PROFILE='river-bank-landforms-1';
export const RIVERBANK_REACHES=Object.freeze([[-218,-122],[70,174],[230,362]]);
const STEP=1000/512,N=513;
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
const riverZ=x=>120+Math.sin(x*.012)*45,level=x=>.50-x*.009;
let active=null;
export const legacyRiverBankHeight=(x,z,height)=>height;
function corridorDistance(x,z){let min=Infinity;for(const[a,b,c,d]of RIVERBANK_ROUTES){const dx=c-a,dz=d-b,t=clamp(((x-a)*dx+(z-b)*dz)/(dx*dx+dz*dz||1));min=Math.min(min,Math.hypot(x-a-dx*t,z-b-dz*t));}return min;}
function supportWeight(x,z){
 let longitudinal=0;
 for(const[lo,hi]of RIVERBANK_REACHES)longitudinal=Math.max(longitudinal,ease(lo,lo+14,x)*(1-ease(hi-13,hi,x)));
 if(!longitudinal)return 0;
 // These full crossing/site neighborhoods include two grid cells around their
 // terrain supports. The visible channel/actual wet cells are protected below.
 const protection=Math.min(ease(10,18,Math.abs(x)),ease(20,28,Math.abs(x+104)),ease(18,26,Math.abs(x+250)),ease(12,21,Math.abs(x-16)),ease(12,21,Math.abs(x-134)));
 const stream=118+Math.sin(z*.03)*14+Math.sin(z*.011+3)*8;
 const creek=z<170?ease(17,21,Math.abs(x-stream)):1;
 const route=ease(5.9,8.5,corridorDistance(x,z));
 return longitudinal*protection*creek*route;
}
export function riverBankDomainAt(x,z){return supportWeight(x,z)>0&&Math.abs(z-riverZ(x))<12.4&&Math.abs(z-riverZ(x))>4.6;}
// Configure before the new physical grid is sampled. The reference stores the
// original Float32 grid, not a second analytic proxy for planted/riding terrain.
export function configureRiverBanks({rawHeightAt,heightAt,terrainStep=STEP}){
 if(terrainStep!==STEP||typeof rawHeightAt!=='function')throw Error('Original513 grid sampler required');
 const reference=new Map(),protectedVertices=new Set();
 const boxes=RIVERBANK_REACHES.map(([lo,hi])=>{let low=Infinity,high=-Infinity;for(let x=lo-6;x<=hi+6;x+=1){low=Math.min(low,riverZ(x)-16.4);high=Math.max(high,riverZ(x)+16.4);}return{ix0:Math.floor((lo-6+500)/STEP),ix1:Math.ceil((hi+6+500)/STEP),iz0:Math.floor((low+500)/STEP),iz1:Math.ceil((high+500)/STEP)};});
 for(const b of boxes)for(let iz=b.iz0;iz<=b.iz1;iz++)for(let ix=b.ix0;ix<=b.ix1;ix++){const x=ix*STEP-500,z=iz*STEP-500,h=Math.fround(rawHeightAt(x,z));if(!Number.isFinite(h))throw Error('Nonfinite river planning grid');reference.set(iz*N+ix,h);}
 const protectTriangle=ids=>{
  const points=ids.map(id=>{const ix=id%N,iz=Math.floor(id/N),x=ix*STEP-500,z=iz*STEP-500;return{x,z,h:reference.get(id)};});
  if(points.some(p=>!Number.isFinite(p.h)))return;
  // Every original shoreline/interior-water terrain triangle stays exact. A
  // wet vertex anywhere in the physical ribbon pins all three support vertices.
  if(points.some(p=>Math.abs(p.z-riverZ(p.x))<8&&p.h-level(p.x)<=.04))for(const id of ids)protectedVertices.add(id);
  if(points.some(p=>corridorDistance(p.x,p.z)<5.9))for(const id of ids)protectedVertices.add(id);
 };
 for(const b of boxes)for(let iz=b.iz0;iz<b.iz1;iz++)for(let ix=b.ix0;ix<b.ix1;ix++){const a=iz*N+ix;protectTriangle([a,a+1,a+N]);protectTriangle([a+1,a+N+1,a+N]);}
 for(const id of RIVERBANK_PROTECTED_SUPPORTS)if(reference.has(id))protectedVertices.add(id);
 const sample=(x,z)=>{
  const gx=(x+500)/STEP,gz=(z+500)/STEP,ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,id=iz*N+ix;
  const a=reference.get(id),b=reference.get(id+N),c=reference.get(id+N+1),d=reference.get(id+1);
  if([a,b,c,d].every(Number.isFinite))return fx+fz<=1?a+(d-a)*fx+(b-a)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz);
  return heightAt(x,z);
 };
 active={reference,protectedVertices,boxes,sample};
 return Object.freeze({profile:RIVERBANK_PROFILE,heightAt:sample,referenceRows:reference.size,referenceValueBytes:reference.size*4,protectedVertices:protectedVertices.size,boxes});
}
export function riverBankTerrainHeight(x,z,height){
 if(!active)return height;
 const signed=z-riverZ(x),d=Math.abs(signed);if(d<=4.6||d>=12.4)return height;
 const wet=active.protectedVertices.has(Math.round((z+500)/STEP)*N+Math.round((x+500)/STEP));if(wet)return height;
 const weight=supportWeight(x,z);if(!weight)return height;
 const side=Math.sign(signed),bend=Math.sin(x*.012),strength=.52+.48*Math.abs(bend);
 const phase=x*.087+side*.8,shift=.26*Math.sin(phase)+.15*Math.sin(x*.19-side);
 const q=d-shift,across=ease(4.6,5.5,q)*(1-ease(10.0,12.4,q));
 // Two unequal accretion shelves on the inside, a low toe and one eroded
 // shoulder on the outside. The original ground is joined over metres, never
 // hidden by a floating skin or a ruled vertical strip.
 const bench=.23+.12*ease(5.5,6.9,q)+.20*ease(8.1,8.9,q);
 const shallowRun=.085*Math.exp(-(((q-(7.0+.35*Math.sin(x*.06)))/.60)**2))*(.45+.55*ease(-.6,.8,Math.sin(x*.083+.8)));
 const point=.15*(1-ease(7.1,9.6,q))*(.45+.55*Math.cos((x-(x<0?-170:112))*.025));
 const innerTarget=level(x)+bench+point-shallowRun;
 const toe=.25+.22*ease(5.4,6.4,q),face=.78*ease(6.9,7.8,q),shoulder=.30*ease(8.9,10.0,q);
 const gully=.26*Math.exp(-(((q-8.1)/1.25)**2))*ease(.15,.8,Math.sin(x*.135+side*1.7));
 const outerTarget=level(x)+toe+face+shoulder-gully;
 const insideWeight=ease(-.25,.25,-side*bend),target=outerTarget+(innerTarget-outerTarget)*insideWeight;
 const delta=Math.max(-1.45,Math.min(1.45,target-height));
 return height+delta*weight*across*strength;
}
export function riverBankReferenceStats(){return active?{rows:active.reference.size,protectedVertices:active.protectedVertices.size}:null;}
