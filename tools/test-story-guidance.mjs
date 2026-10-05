import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// The web project uses ES modules without a root package.json.
const source=await readFile(new URL('../assets/features/story-guidance.js',import.meta.url),'utf8');
const {nearestPickup,resolveTarget,nextAction}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const pickup=(x,z,item='lettuce',visible=true)=>({item,g:{visible,position:{x,y:0,z}}});
const here={x:0,z:0};

test('gathering chooses a visible matching pickup, not a closer wrong food',()=>{
 const far=pickup(8,0),near=pickup(3,0),wrong=pickup(1,0,'pumpkin'),hidden=pickup(0,0,'lettuce',false);
 assert.equal(nearestPickup([wrong,far,hidden,near],'lettuce',here),near.g);
 assert.equal(nearestPickup([hidden,wrong],'lettuce',here),null);
});
test('carrot quests use carrot pickups; forage quests use the requested crop',()=>{
 const carrot=pickup(4,0,'carrot'),lettuce=pickup(2,0),world={carrots:[carrot],forage:[lettuce]};
 assert.equal(resolveTarget({type:'carrots'},false,world,here).position,carrot.g.position);
 assert.equal(resolveTarget({type:'forage',item:'lettuce'},false,world,here).position,lettuce.g.position);
 carrot.g.visible=false;
 assert.equal(resolveTarget({type:'carrots'},false,world,here),null);
});
test('finished tasks keep the existing giver/turn-in resolver',()=>{
 for(const type of ['carrots','forage','gallop','event','build']){
  assert.equal(resolveTarget({type},true,{},here),undefined);
  assert.equal(nextAction({type},true),null);
 }
});
test('place and conversation targets remain with the established resolver',()=>{
 for(const type of ['visit','door','talk','clues','name','guess','future-type'])assert.equal(resolveTarget({type},false,{},here),undefined);
});
test('action tasks suppress premature giver markers and expose the real action',()=>{
 for(const type of ['gallop','train','event','ribbons','build','photo'])assert.equal(resolveTarget({type},false,{},here),null);
 assert.equal(nextAction({type:'gallop'},false).action,'gallop');
 assert.equal(nextAction({type:'event',ev:'h1'},false).action,'event');
 assert.equal(nextAction({type:'train'},false).action,'care');
 assert.equal(nextAction({type:'carrots'},false).action,'');
});
