// Historical original factory on canonical terrain. Only index22 has a known
// registered-surface Y difference; target24 and all whole-XZ bounds are exact.
// Current relocation tests import the
// actual production helper directly. This does not reconstruct admission epoch.
import fs from 'node:fs';
import * as T from '../assets/vendor/three/build/three.module.js';
const fixture=new URL('./fixtures/outcrop-clearance-7eccc/',import.meta.url);
export const nativeSnapshot=JSON.parse(fs.readFileSync(new URL('fallback-sites.json',fixture)));
export const parentSource=fs.readFileSync(new URL('world-outcrops.js',fixture),'utf8');
const data=JSON.parse(fs.readFileSync(new URL('terrain-tiles.json',fixture))),tiles=data.tiles.map(t=>{const b=Buffer.from(t.float32LE,'base64');return{...t,values:new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength))};});
export function terrainH(x,z){const gx=(x+500)/data.step,gz=(z+500)/data.step,ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,t=tiles.find(t=>ix>=t.ix&&ix+1<t.ix+t.width&&iz>=t.iz&&iz+1<t.iz+t.height);if(!t)throw Error('Outside frozen outcrop terrain tiles');const i=(iz-t.iz)*t.width+ix-t.ix,a=t.values[i],b=t.values[i+t.width],c=t.values[i+t.width+1],d=t.values[i+1];return fx+fz<=1?a+(d-a)*fx+(b-a)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz);}
const utilURL=new URL('../assets/vendor/three/examples/jsm/utils/BufferGeometryUtils.js',import.meta.url),threeURL=new URL('../assets/vendor/three/build/three.module.js',import.meta.url),utils=fs.readFileSync(utilURL,'utf8').replace("from 'three'","from '"+threeURL.href+"'"),{mergeGeometries,mergeVertices}=await import('data:text/javascript;base64,'+Buffer.from(utils).toString('base64'));
export function reconstructOutcropFallback(){
 const expected=nativeSnapshot.placed,accepted=[];let source=parentSource.replace(/import \{mergeGeometries,mergeVertices\} from '[^']+';/,'').replace('export const id=','const id=').replace('export function install(G)','function install(G)');
 const start=source.indexOf(' function ok(x,z,R){'),end=source.indexOf(' /* ---------------------------------------------------------------- building one',start);if(start<0||end<0)throw Error('Frozen original admission hook unavailable');source=source.slice(0,start)+' function ok(x,z,R){return acceptNext(x,z,R); }\n\n'+source.slice(end);
 const document={createElement:()=>({width:0,height:0,getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:()=>{}})})};
 const G={THREE:T,scene:new T.Scene(),world:{groundH:terrainH,colliders:[],forestPoints:[],walls:[],npcList:[],things:[],mapMarkers:[],FORAGE_SPOTS:[],climbables:[]},tables:{},on:()=>{}};
 const acceptNext=(x,z,R)=>{const q=expected[accepted.length];if(!q||Math.hypot(x-q.x,z-q.z)>1e-8)return false;if(Math.abs(R-q.r*1.5)>1e-9)throw Error('Original radius replay mismatch');accepted.push({x,z,R});return true;};
 new Function('mergeGeometries','mergeVertices','document','acceptNext',source+';return install;')(mergeGeometries,mergeVertices,document,acceptNext)(G);
 if(accepted.length!==30||G.worldOutcrops.placed.length!==30)throw Error('Original source replay did not reach all30sites');for(let i=0;i<30;i++){const a=G.worldOutcrops.placed[i],b=expected[i];if(a.x!==b.x||a.z!==b.z||a.r!==b.r)throw Error('Original model index/site changed '+i);}return{G,accepted,scope:'Original source factory on canonical terrain; exact30nativeXZ/radii/localRNG and target24wholegeometry. Index22 registered-surfaceY not reconstructed. Historical admission oracle is not the original admission epoch.'};
}
