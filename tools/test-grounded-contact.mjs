import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {createSolidWorld} from '../assets/solid-collisions.js';
import {UPRIGHT_HYBRID_WOOD_BOXES} from '../assets/upright-broadleaf-wood-proxies.mjs';
import {resolveGroundedContact} from '../assets/grounded-contact.mjs';

// Captured regression: v2 authored upright at (106.004237,-196.279263).
// Its exact source wood transform and the four Float32 vertices of the visible
// terrain cell reproduce the mounted residual without a renderer or scene boot.
const TREE_MATRIX=[.8718071068832542,0,1.1275492330591266,0,0,1.4252771325550602,0,0,-1.1275492330591266,0,.8718071068832542,0,106.00423724294332,8.819566664861604,-196.27926258952886,1];
const terrainHeight=(x,z)=>{
 const fx=(x-103.515625)/1.953125,fz=(z+197.265625)/1.953125;
 assert(fx>=0&&fx<=1&&fz>=0&&fz<=1,'Regression stays in its captured terrain cell');
 const a=8.54912281036377,b=8.91909408569336,c=8.757122039794922,d=8.410730361938477;
 return fx+fz<=1?a+(d-a)*fx+(b-a)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz);
};
function world(parts){
 const solids=createSolidWorld({THREE}),scene=new THREE.Scene(),owner=new THREE.Group();scene.add(owner);
 owner.userData.solidParts=parts;solids.register(owner);return solids;
}
const options=(heightAt,previous=null)=>({heightAt,previous,radius:.55,bottomOffset:.38,topOffset:2.65});
const body=(heightAt,p)=>({bottom:heightAt(p.x,p.z)+.38,top:heightAt(p.x,p.z)+2.65,radius:.55});
test('captured wood contact is clear at the old slab but overlaps after the slope raises the body',()=>{
 const solids=world(UPRIGHT_HYBRID_WOOD_BOXES.map(b=>({min:b.min,max:b.max,matrix:TREE_MATRIX})));
 const initial={x:104.88,z:-195.674},position={...initial},oldBody=body(terrainHeight,position);
 assert(solids.resolve(position,oldBody)>0);
 const sameSlab={...position};assert.equal(solids.resolve(sameSlab,oldBody),0);assert.deepEqual(sameSlab,position);
 const newSlab={...position};assert(solids.resolve(newSlab,body(terrainHeight,newSlab))>0);
 const residual=Math.hypot(newSlab.x-position.x,newSlab.z-position.z);assert(residual>.017&&residual<.019);
 const fixed={...initial},result=resolveGroundedContact(solids,fixed,options(terrainHeight));
 assert(result.converged);assert(result.calls<=4);assert(!result.restoredPrevious);
 const final={...fixed};assert.equal(solids.resolve(final,body(terrainHeight,final)),0);assert.deepEqual(final,fixed);
});

test('grounded convergence clears a neighbourhood of the captured trunk without moving its collider',()=>{
 const solids=world(UPRIGHT_HYBRID_WOOD_BOXES.map(b=>({min:b.min,max:b.max,matrix:TREE_MATRIX})));
 let inspected=0,requiredRegrounding=0;
 for(let ix=0;ix<12;ix++)for(let iz=0;iz<16;iz++){
  const position={x:104.43+ix*.047,z:-196.22+iz*.051};
  const result=resolveGroundedContact(solids,position,options(terrainHeight));
  assert(result.converged);assert(result.calls<=4);if(result.calls>2)requiredRegrounding++;
  const check={...position};assert.equal(solids.resolve(check,body(terrainHeight,check)),0);assert.deepEqual(check,position);inspected++;
 }
 assert.equal(inspected,192);assert(requiredRegrounding>0);
});

test('downhill correction lowers the body into a short second obstacle and resolves it',()=>{
 const matrix=new THREE.Matrix4().toArray(),solids=world([
  {min:[-.3,-1,-.1],max:[0,3,.1],matrix},
  {min:[.4,-1,-.1],max:[.5,.31,.1],matrix}
 ]),heightAt=x=>-.25*x,position={x:.2,z:0};
 const result=resolveGroundedContact(solids,position,options(heightAt));
 assert(result.converged);assert.equal(result.calls,3);assert(position.x>1.05);
 const check={...position};assert.equal(solids.resolve(check,body(heightAt,check)),0);assert.deepEqual(check,position);
});

test('flat clear movement costs one resolve and preserves the original previous pose object',()=>{
 const previous={x:1,z:2,bottom:.38,top:2.65},position={x:1.1,z:2},calls=[];
 const solids={resolve(p,args){calls.push({p,args});return 0;}};
 const result=resolveGroundedContact(solids,position,options(()=>0,previous));
 assert.deepEqual(result,{contacts:0,calls:1,converged:true,restoredPrevious:false});
 assert.equal(calls[0].p,position);assert.equal(calls[0].args.previous,previous);
 assert.equal(calls[0].args.bottom,.38);assert.equal(calls[0].args.top,2.65);
 assert.deepEqual(position,{x:1.1,z:2});
});

test('every convergence pass preserves the initial previous pose for surface-side logic',()=>{
 const previous={x:0,z:0,bottom:.38,top:2.65},position={x:1,z:0},seen=[];
 const solids={resolve(p,args){seen.push(args);if(seen.length===1){p.x+=.1;return 1;}return 0;}};
 const result=resolveGroundedContact(solids,position,options(x=>x*.5,previous));
 assert(result.converged);assert.equal(result.calls,2);
 assert(seen.every(args=>args.previous===previous));assert(seen[1].bottom>seen[0].bottom);
});

test('nonconvergent corrections restore only a separately certified clear prior grounded pose',()=>{
 const previous={x:0,z:0},position={x:1,z:0},calls=[];
 const solids={resolve(p,args){calls.push({position:{...p},args});if(p.x===0)return 0;p.x+=.01;return 1;}};
 const result=resolveGroundedContact(solids,position,options(()=>0,previous));
 assert.deepEqual(result,{contacts:4,calls:5,converged:true,restoredPrevious:true});assert.deepEqual(position,previous);
 assert(calls.slice(0,4).every(c=>c.args.previous===previous));assert.equal(calls[4].args.previous,undefined);
});

test('an overlapping prior pose is never restored after cap exhaustion',()=>{
 const previous={x:0,z:0},position={x:1,z:0};
 const solids={resolve(p){p.x+=.01;return 1;}};
 const result=resolveGroundedContact(solids,position,options(()=>0,previous));
 assert.deepEqual(result,{contacts:4,calls:5,converged:false,restoredPrevious:false});
 assert(position.x>1.039&&position.x<1.041);assert.deepEqual(previous,{x:0,z:0});
});

test('cancelled pushes with reported contact are not mistaken for clear zero motion',()=>{
 const position={x:1,z:0},solids={resolve(){return 2;}};
 const result=resolveGroundedContact(solids,position,options(()=>0));
 assert.deepEqual(result,{contacts:8,calls:4,converged:false,restoredPrevious:false});
});
