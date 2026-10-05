import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('the actual flight altitude input respects modal ownership and preserves landing',async()=>{
 const html=await readFile(new URL('../ranch3d.html',import.meta.url),'utf8');
 const expression=html.match(/const climb=(player\.landing[^;]+);/)[1];
 const climb=new Function('player','ridingIntent','keys','touch','return '+expression);
 for(const [keys,touch,want]of [[{Space:true},{},1],[{ShiftLeft:true},{},-1],[{}, {jump:true},1],[{}, {gal:true},-1]]){
  assert.equal(climb({landing:false},{locked:false},keys,touch),want);
  assert.equal(climb({landing:false},{locked:true},keys,touch),0,'held VR or keyboard input cannot change altitude behind a menu');
  assert.equal(climb({landing:true},{locked:true},keys,touch),-1,'an already requested landing continues');
 }
});

test('on-foot capture leaves menu/dialogue keys with their owner',async()=>{
 const source=await readFile(new URL('../assets/features/on-foot.js',import.meta.url),'utf8');
 const start=source.indexOf("window.addEventListener('keydown',e=>{");
 const script=source.slice(start,source.indexOf(' },true);',start)+9);
 let listener,calls=0,stops=0,prevents=0;
 const G={key:()=> 'KeyH',screenInput:{active:false},dialogue:{active:false}};
 vm.runInNewContext(script,{G,ST:{on:true},document:{activeElement:{tagName:'BUTTON'}},callHorse(){calls++;},window:{addEventListener(type,fn){assert.equal(type,'keydown');listener=fn;}}});
 const key=()=>listener({code:'KeyH',repeat:false,stopImmediatePropagation(){stops++;},preventDefault(){prevents++;}});
 G.screenInput.active=true;key();assert.equal(calls,0);assert.equal(stops,0);
 G.screenInput.active=false;G.dialogue.active=true;key();assert.equal(calls,0);assert.equal(prevents,0);
 G.dialogue.active=false;key();assert.equal(calls,1);assert.equal(stops,1);assert.equal(prevents,1);
});
