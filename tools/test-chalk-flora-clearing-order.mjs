import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../assets/vendor/three/build/three.module.js';
import {install as installCourseClear} from '../assets/features/course-clear.js';
import {createChalkDown} from '../assets/chalk-down.js';
import {configureChalkGrazing,applyChalkGrassMesh,applyChalkFlowerMesh} from '../assets/chalk-grazing.mjs?v=chalk-grazing-1';
import {installChalkCoverRefresh} from '../assets/chalk-cover-refresh.mjs';
const site={x:-68.98,z:213.41,len:112,depth:76,h:14,crest:.5},field=configureChalkGrazing(site);
const down=createChalkDown({THREE:{...T,TextureLoader:class{load(){return new T.Texture();}}},site,baseHeight:()=>2,groundMaterial:new T.MeshStandardMaterial()});
const source=fs.readFileSync(new URL('../assets/features/world-flora.js',import.meta.url),'utf8');
const block=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a);return source.slice(a,b);};
// These are the actual authored old cards/writer/hash, not a new surrogate
// whose dimensions would accidentally avoid course-clear's radius threshold.
const geometryFactory=new Function('THREE',block(' const hsh=',' const vn=')+block(' function W3(){',' /* Every plant')+block(' const crossGeo=',' const reedGeo=')+'return crossGeo;')(T);
const installDeferred=new Function('F','BANK','groundH','applyChalkGrassMesh','applyChalkFlowerMesh',block(' F.refreshChalkGrazing=',' // Suppress live cutting cover'));
const proof={scope:'Actual original static geometry plus actual production course gather/mow/boot and final V2 deferred closure; no GPU.',rows:[]};
function world(){const scene=new T.Scene(),hooks=new Map(),[x,z]=field.frame(0,.45),groundH=(x,z)=>Math.max(2,down.heightAt(x,z)),BANK={};
 for(const [kind,n,width,lean]of[['tuft',3,1.15,.24],['brack',3,1.15,.24],['petal',2,.52,.10]]){const geometry=geometryFactory(n,width,lean),mesh=new T.InstancedMesh(geometry,new T.MeshStandardMaterial(),1);mesh.name='flora_'+kind;mesh.setColorAt(0,new T.Color('#aabc90'));mesh.setMatrixAt(0,new T.Matrix4().makeScale(2,2,2).setPosition(x,groundH(x,z)-.04,z));scene.add(mesh);BANK[kind]={n:1,im:mesh};}
 const G={THREE:T,scene,world:{colliders:[],walls:[],groundH,terrainH:()=>2,nearGroundCover:{invalidate(){},tick(){}}},horse:{player:{pos:{x,z}}},vistas:{chalkDown:down,clearZones:[down.planningContains]},tables:{RACE_ROUTES:{far:[[1000,1000],[1010,1000]]},EVENTS3:[]},floraPkg:{},on:(k,f)=>hooks.set(k,f)};
 installDeferred(G.floraPkg,BANK,groundH,applyChalkGrassMesh,applyChalkFlowerMesh);return{G,BANK,hooks};}
const basis=m=>Math.hypot(m[0],m[1],m[2])+Math.hypot(m[4],m[5],m[6])+Math.hypot(m[8],m[9],m[10]);
async function run(order){const w=world(),priorWindow=globalThis.window,priorTimeout=globalThis.setTimeout,scheduled=[];globalThis.window={};globalThis.setTimeout=(fn,ms)=>{assert.equal(ms,400);scheduled.push(fn);return 1;};
 try{if(order==='rejected early')w.G.floraPkg.refreshChalkGrazing();let ready;if(order==='final deferred')ready=installChalkCoverRefresh(w.G);installCourseClear(w.G);await Promise.resolve();assert(!w.G.world.chalkCoverResponse);w.hooks.get('boot')();assert.equal(scheduled.length,1);scheduled[0]();await w.G.courseClear.ready;if(ready)await ready;
  const rows=Object.fromEntries(Object.entries(w.BANK).map(([kind,b])=>[kind,{matrix:Array.from(b.im.instanceMatrix.array),color:Array.from(b.im.instanceColor.array),count:b.n}]));proof.rows.push({order,hidden:w.G.courseClear.stats.instancesHidden,rows});return rows;
 }finally{globalThis.setTimeout=priorTimeout;if(priorWindow===undefined)delete globalThis.window;else globalThis.window=priorWindow;for(const b of Object.values(w.BANK)){b.im.dispose();b.im.geometry.dispose();b.im.material.dispose();}}
}
test('negative control reproduces early-height policy escaping the actual old large-plant landmark clearing branch',async()=>{
 const baseline=await run('baseline'),early=await run('rejected early');assert.equal(basis(baseline.tuft.matrix),0);assert(basis(early.tuft.matrix)>0,'early shortening drops the old radius below0.9m and reproduces the resurrection defect');
});
test('final V2 waits actual original course/boot clearing then keeps every hidden static basis and row byte unchanged',async()=>{
 const baseline=await run('baseline'),late=await run('final deferred');for(const kind of['tuft','brack','petal']){if(basis(baseline[kind].matrix)===0){assert.equal(basis(late[kind].matrix),0);assert.deepEqual(late[kind],baseline[kind]);}else{assert.equal(late[kind].count,baseline[kind].count);assert.deepEqual(late[kind].color,baseline[kind].color);for(const k of[12,14,15])assert.equal(late[kind].matrix[k],baseline[kind].matrix[k]);}}
 if(process.env.CHALK_CLEARING_AUDIT_OUTPUT)fs.writeFileSync(process.env.CHALK_CLEARING_AUDIT_OUTPUT,JSON.stringify(proof,null,2)+'\n');
});
