import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
export const repo=path.resolve(process.env.PASTORAL_TEST_REPO||fileURLToPath(new URL('../',import.meta.url)));
export const moduleAt=(name,query='')=>import(pathToFileURL(path.join(repo,name)).href+query);
export const T=await moduleAt('assets/vendor/three/build/three.module.js');
const newCover=fs.existsSync(path.join(repo,'assets/pastoral-cover.mjs'))?await moduleAt('assets/pastoral-cover.mjs','?v=pastoral-cover-1-commons-landscape-1'):{};
const grass=await moduleAt('assets/meadow-cover.js'),flowers=await moduleAt('assets/meadow-flowers.mjs'),pastoral=await moduleAt('assets/pastoral-fields.mjs'),ranch=await moduleAt('assets/ranch-grounds.mjs'),chalk=await moduleAt('assets/chalk-grazing.mjs','?v=chalk-grazing-1'),reeds=await moduleAt('assets/reed-beds.js');
export const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
export const cellsDigest=cells=>sha(Buffer.concat(cells.flatMap(c=>[Buffer.from(c.matrices.buffer,c.matrices.byteOffset,c.matrices.byteLength),Buffer.from(c.colors.buffer,c.colors.byteOffset,c.colors.byteLength)])));
export const sourceSlice=(source,start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);if(a<0||b<=a)throw Error('Actual production block absent: '+start);return source.slice(a,b);};
export const positive=a=>Math.hypot(a[0],a[1],a[2])+Math.hypot(a[4],a[5],a[6])+Math.hypot(a[8],a[9],a[10])>1e-9;
export function transformedVerticalBounds(geometry,a){const p=geometry.attributes.position;let min=Infinity,max=-Infinity;for(let i=0;i<p.count;i++){const y=a[1]*p.getX(i)+a[5]*p.getY(i)+a[9]*p.getZ(i)+a[13];min=Math.min(min,y);max=Math.max(max,y);}return {min,max,height:max-min};}
export function withoutRandom(run){const old=Math.random;Math.random=()=>{throw Error('Presentation update consumed gameplay RNG');};try{return run();}finally{Math.random=old;}}
// Replay the real production admission/fill/pack code. Fixed adversarial world
// inputs isolate the render response from terrain installation; geometry is
// the actual production library, and the cell hashes/rows are never recreated.
export function createNearReplay(source,{quality='high',groundH=(x,z)=>.008*x+.012*z,bindings={}}={}){
 const NG_CELL=6,NG_W=14,NG_K=quality==='low'?105:240,NG_F=4,NG_FR=quality==='low'?2:4,NG_RK=quality==='low'?2:3,NG_RD=2,NG_LU=quality==='low'?16:44;
 const scene=new T.Scene(),material=new T.MeshStandardMaterial({vertexColors:true});
 const mesh=(geometry,n)=>{const m=new T.InstancedMesh(geometry,material,n);m.setColorAt(0,new T.Color());scene.add(m);return m;};
 const near=mesh(grass.createGrassTuftGeometry(T,{profile:'near-folded-v1'}),NG_W*NG_W*NG_K),flow=mesh(new T.PlaneGeometry(.48,.4),NG_W*NG_W*NG_F),fern=mesh(new T.PlaneGeometry(.92,.62),NG_W*NG_W*NG_FR),reed=mesh(reeds.createReedGeometry(T),NG_W*NG_W*NG_RD),rock=mesh(new T.SphereGeometry(.5,11,8),NG_W*NG_W*NG_RK),lupin=mesh(grass.createLupinGeometry(T),NG_W*NG_W*NG_LU);
 const cells=(n)=>Array.from({length:NG_W*NG_W},()=>({count:0,matrices:new Float32Array(n*16),colors:new Float32Array(n*3)}));
 const grassCells=cells(NG_K),lupinCells=cells(NG_LU),reedCells=cells(NG_RD),D={THREE:T,scene,near,flow,fern,reed,rock,lupin,grassCells,lupinCells,reedCells,NG_CELL,NG_W,NG_K,NG_F,NG_FR,NG_RK,NG_RD,NG_LU,quality,window:{},G:{world:{colliders:[],walls:[]}},m4:new T.Matrix4(),e:new T.Euler(),q:new T.Quaternion(),v:new T.Vector3(),sc:new T.Vector3(),bcol:new T.Color(),winterGrassTint:new T.Color('#c1b99b'),grassDrawCount:0,grassVR:false,grassSourceVersion:0,groundH,terrainH:groundH,managedGrass:(x,z)=>Math.hypot(x+7,z-7)<4?.72:0,riverZ:x=>120+Math.sin(x*.012)*45,pathDist:(x,z)=>Math.abs(z-25),PATH_W:2.2,BR_A:120,BR_B:160,alpineSnowAt:()=>0,coldPastureCover:()=>1,canyonCliffAt:()=>false,fallsExcludesDryPlants:()=>false,hasMeadowCover:()=>true,oasisContainsWater:()=>false,coyoteCoverDryWeight:()=>0,coldWoodlandWeights:()=>({weight:0}),coldCoverProfile:()=>null,...grass,...flowers,...pastoral,...ranch,...chalk,...newCover,createMeadowDistance:()=>({invalidate(){},tick(){}}),...bindings};
 const body=sourceSlice(source,' const gh=',' const crossGeo=')+sourceSlice(source,' const okGrass=',' let swardAccentColliders=');
 const update=new Function('D','with(D){'+body+'return {update,fillCell,okGrass,okClutter,sourceVersion:()=>grassSourceVersion,cellOrigin:()=>[cx0,cz0]};}')(D);
 return{...update,D,scene,near,flow,fern,reed,rock,lupin,grassCells,lupinCells,reedCells,dispose(){for(const m of[near,flow,fern,reed,rock,lupin]){m.dispose();m.geometry.dispose();}material.dispose();}};
}
