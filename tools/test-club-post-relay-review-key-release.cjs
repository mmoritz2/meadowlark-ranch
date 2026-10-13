const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('review/club-post-relay/client.js','utf8');
assert.ok(source.includes("w.addEventListener('keyup',rememberReleasedKey);"));
const extracted=source.slice(source.indexOf('function rememberReleasedKey('),source.indexOf('function release('));
class KeyboardEvent extends Event{constructor(type,options={}){super(type,options);this.code=options.code;this.key=options.key;}}
const gameWindow=new EventTarget(),productionKeys={},events=[];
gameWindow.addEventListener('keydown',e=>productionKeys[e.code]=true);gameWindow.addEventListener('keyup',e=>productionKeys[e.code]=false);
const w={KeyboardEvent,addEventListener:gameWindow.addEventListener.bind(gameWindow),document:{dispatchEvent(e){events.push({type:e.type,code:e.code});return gameWindow.dispatchEvent(e);}}};
const ctx=vm.createContext({w});vm.runInContext('const held={};'+extracted,ctx);
vm.runInContext("key('KeyW',true)",ctx);assert.equal(productionKeys.KeyW,true);assert.equal(events.filter(e=>e.type==='keydown'&&e.code==='KeyW').length,1);
// Reproduce a production-only release between two driver polls. Without the observer the driver cache is stale.
gameWindow.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true}));assert.equal(productionKeys.KeyW,false);
vm.runInContext("key('KeyW',true)",ctx);assert.equal(productionKeys.KeyW,false);assert.equal(events.length,1);
// Install the exact ordinary keyup subscription from boot, then reproduce the same release.
vm.runInContext("w.addEventListener('keyup',rememberReleasedKey)",ctx);
gameWindow.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true}));assert.equal(vm.runInContext('held.KeyW',ctx),false);
vm.runInContext("key('KeyW',true)",ctx);assert.equal(productionKeys.KeyW,true);assert.equal(events.filter(e=>e.type==='keydown'&&e.code==='KeyW').length,2);
vm.runInContext("key('KeyW',true)",ctx);assert.equal(events.filter(e=>e.type==='keydown'&&e.code==='KeyW').length,2,'sustained input remains deduplicated');
vm.runInContext("key('KeyA',true)",ctx);gameWindow.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true}));assert.equal(vm.runInContext('held.KeyA',ctx),true,'other held intent remains unchanged');
gameWindow.dispatchEvent(new KeyboardEvent('keyup',{code:'Escape',bubbles:true}));assert.equal(vm.runInContext("Object.prototype.hasOwnProperty.call(held,'Escape')",ctx),false,'foreign keys never become fixture intent');
vm.runInContext("key('KeyA',false)",ctx);assert.equal(vm.runInContext('held.KeyA',ctx),false);assert.equal(productionKeys.KeyA,false);
vm.runInContext("key('Space',true)",ctx);gameWindow.dispatchEvent(new KeyboardEvent('keyup',{code:'Space',bubbles:true}));assert.equal(vm.runInContext('held.Space',ctx),false);vm.runInContext("key('Space',true)",ctx);assert.equal(events.filter(e=>e.type==='keydown'&&e.code==='Space').length,2);
console.log('Extracted key/cache regression passed: old stale-cache failure reproduced; actual window keyup clears only own intent and permits the next ordinary re-press. No game key table is accessed by fixture code.');
