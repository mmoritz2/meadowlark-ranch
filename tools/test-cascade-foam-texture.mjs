import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCascadeFoamTexture,cascadeFoamTextureStatus} from '../assets/cascade-foam-texture.mjs';
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function fixture(mode='manual'){
 const state={loads:0,constructors:0,disposed:0,visualDraws:[],callbacks:null,texture:null,decode:deferred(),decodeRandom:null};
 class TextureLoader{constructor(){state.constructors++;state.visualDraws.push(Math.random());}load(url,ready,progress,error){state.loads++;state.visualDraws.push(Math.random());const texture={image:{width:1254,height:1254,decode(){state.decodeRandom=Math.random;return state.decode.promise;}},dispose(){state.disposed++;}};state.texture=texture;state.callbacks={ready,error};if(mode==='sync')ready(texture);if(mode==='throw')throw Error('network constructor');return texture;}}
 return{T:{TextureLoader,NoColorSpace:'',RepeatWrapping:1000,LinearMipmapLinearFilter:1008,LinearFilter:1006},state};
}
function gameRandom(){let calls=0;const fn=()=>++calls/100;return{fn,calls:()=>calls};}
test('one shared texture stays pending through load and decode, then exposes ready density settings',async()=>{
 const {T,state}=fixture(),game=gameRandom(),old=Math.random;Math.random=game.fn;
 try{
  assert.equal(Math.random(),.01);const a=loadCascadeFoamTexture({THREE:T,url:'/foam.png'}),b=loadCascadeFoamTexture({THREE:T,url:'/foam.png'});assert.equal(a,b);assert.equal(state.loads,1);assert.equal(state.constructors,1);assert.equal(Math.random,game.fn);assert.equal(game.calls(),1);assert.equal(cascadeFoamTextureStatus({THREE:T,url:'/foam.png'}).status,'loading');
  let settled=false;a.then(()=>{settled=true;});state.callbacks.ready(state.texture);await Promise.resolve();assert.equal(state.decodeRandom,game.fn);assert.equal(settled,false);assert.equal(Math.random(),.02);state.decode.resolve();const texture=await a;assert.equal(texture,state.texture);assert.equal(texture.colorSpace,'');assert.equal(texture.wrapS,1000);assert.equal(texture.wrapT,1000);assert.equal(texture.generateMipmaps,true);assert.equal(texture.minFilter,1008);assert.equal(texture.magFilter,1006);assert.equal(texture.anisotropy,4);assert.equal(texture.needsUpdate,true);assert.deepEqual(cascadeFoamTextureStatus({THREE:T,url:'/foam.png'}),{status:'ready',width:1254,height:1254});assert.equal(await loadCascadeFoamTexture({THREE:T,url:'/foam.png'}),texture);assert.equal(state.loads,1);assert.equal(Math.random(),.03);assert.equal(state.disposed,0);
 }finally{Math.random=old;}
});
test('synchronous cached callback still decodes with the gameplay generator restored',async()=>{
 const {T,state}=fixture('sync'),game=gameRandom(),old=Math.random;Math.random=game.fn;
 try{const p=loadCascadeFoamTexture({THREE:T,url:'/cached.png'});assert.equal(Math.random,game.fn);assert.equal(state.decodeRandom,null);await Promise.resolve();assert.equal(state.decodeRandom,game.fn);assert.equal(game.calls(),0);state.decode.resolve();assert.equal(await p,state.texture);assert.equal(Math.random(),.01);}finally{Math.random=old;}
});
test('load error returns cached null fallback, disposes the failed texture and never retries',async()=>{
 const {T,state}=fixture(),game=gameRandom(),old=Math.random;Math.random=game.fn;
 try{const p=loadCascadeFoamTexture({THREE:T,url:'/missing.png'});state.callbacks.error(Error('not found'));assert.equal(await p,null);assert.equal(state.disposed,1);assert.equal(cascadeFoamTextureStatus({THREE:T,url:'/missing.png'}).status,'fallback');assert.equal(await loadCascadeFoamTexture({THREE:T,url:'/missing.png'}),null);assert.equal(state.loads,1);assert.equal(game.calls(),0);assert.equal(Math.random(),.01);}finally{Math.random=old;}
});
test('decode rejection or invalid dimensions fail safely without asynchronous RNG override',async()=>{
 for(const bad of['decode','dimensions']){const {T,state}=fixture('sync'),game=gameRandom(),old=Math.random;Math.random=game.fn;try{const p=loadCascadeFoamTexture({THREE:T,url:'/bad-'+bad+'.png'});await Promise.resolve();assert.equal(Math.random,game.fn);if(bad==='decode')state.decode.reject(Error('decode'));else{state.texture.image.width=0;state.texture.image.height=0;state.decode.resolve();}assert.equal(await p,null);assert.equal(state.disposed,1);assert.equal(game.calls(),0);}finally{Math.random=old;}}
});
test('constructor exception restores the exact generator and returns null',async()=>{
 const {T}=fixture('throw'),game=gameRandom(),old=Math.random;Math.random=game.fn;try{const p=loadCascadeFoamTexture({THREE:T,url:'/throws.png'});assert.equal(Math.random,game.fn);assert.equal(await p,null);assert.equal(game.calls(),0);assert.equal(Math.random(),.01);}finally{Math.random=old;}
});
test('error during decode cannot resurrect an already retired texture',async()=>{
 const {T,state}=fixture('sync'),p=loadCascadeFoamTexture({THREE:T,url:'/decode-race.png'});await Promise.resolve();state.callbacks.error(Error('late load failure'));assert.equal(await p,null);state.decode.resolve();await Promise.resolve();assert.equal(cascadeFoamTextureStatus({THREE:T,url:'/decode-race.png'}).status,'fallback');assert.equal(state.disposed,1);assert.equal(await loadCascadeFoamTexture({THREE:T,url:'/decode-race.png'}),null);
});
