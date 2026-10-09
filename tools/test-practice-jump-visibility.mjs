import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Exercise the actual free-practice judging loop with inert reward surfaces.
// No replacement crossing logic, renderer, browser, or player save is involved.
const source=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
function section(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert(a>=0&&b>a,'production section: '+start);
 return source.slice(a,b);
}
const visibility=section('function setPracticeJumps(on){','function makeJump(');
const judging=section('for(const j of (course?[]:jumps)){','for(const wm of windmills)');
function fixture({visible=true,course=null,drill=false}={}){
 const j={x:0,z:0,rotY:0,prevSide:-1,g:{visible}},player={pos:{x:0,z:.2},y:0,speed:4};
 const trace={coins:0,xp:0,pass:0,chimes:0,thuds:0,stats:[],quests:[],dailies:[],toasts:[]};
 const bindings={course,DRILL:{on:drill},jumps:[j],player,
  addCoins:n=>trace.coins+=n,addXp3D:n=>trace.xp+=n,passAdd:n=>trace.pass+=n,
  sChime:()=>trace.chimes++,sThud:()=>trace.thuds++,statBump:(...a)=>trace.stats.push(a),
  questEvt:(...a)=>trace.quests.push(a),dailyEvt:(...a)=>trace.dailies.push(a),toast:m=>trace.toasts.push(m)};
 const api=new Function(...Object.keys(bindings),visibility+'\nreturn {tick(){'+judging+'},setPracticeJumps};')(...Object.values(bindings));
 return {j,player,trace,...api};
}
const noEffects=f=>assert.deepEqual(f.trace,{coins:0,xp:0,pass:0,chimes:0,thuds:0,stats:[],quests:[],dailies:[],toasts:[]});

test('hidden practice fences cannot slow or reward a drill rider, even with a stale crossing side',()=>{
 for(const y of [0,.8]){
  const f=fixture({visible:false,drill:true});f.player.y=y;f.tick();
  noEffects(f);assert.equal(f.player.speed,4);assert.equal(f.j.prevSide,0);
  f.player.pos.z=-.2;f.tick();f.player.pos.z=.2;f.tick();
  noEffects(f);assert.equal(f.player.speed,4);assert.equal(f.j.prevSide,0);
 }
});

test('hiding and restoring a practice fence resets side history without inventing a crossing',()=>{
 const f=fixture();f.player.y=.8;
 f.setPracticeJumps(false);assert.equal(f.j.g.visible,false);assert.equal(f.j.prevSide,0);
 f.player.pos.z=-.2;f.tick();f.player.pos.z=.2;f.tick();noEffects(f);
 f.setPracticeJumps(true);assert.equal(f.j.g.visible,true);assert.equal(f.j.prevSide,0);
 f.tick();noEffects(f);assert.equal(f.j.prevSide,1);
});

test('a visible grounded practice crossing still clips the rails once',()=>{
 const f=fixture();f.tick();
 assert.equal(f.player.speed,1.8);assert.equal(f.trace.thuds,1);
 assert.equal(f.trace.toasts.length,1);assert.match(f.trace.toasts[0],/clipped the rails/);
 assert.equal(f.trace.coins,0);assert.equal(f.trace.xp,0);assert.equal(f.trace.pass,0);
 f.player.pos.z=.3;f.tick();assert.equal(f.trace.thuds,1);
});

test('a visible airborne practice crossing retains its one reward and clean-jump objectives',()=>{
 const f=fixture();f.player.y=.8;f.player.pos.z=.02;f.tick();noEffects(f);
 f.player.pos.z=.2;f.tick();
 assert.deepEqual({coins:f.trace.coins,xp:f.trace.xp,pass:f.trace.pass,chimes:f.trace.chimes,thuds:f.trace.thuds},{coins:10,xp:3,pass:5,chimes:1,thuds:0});
 assert.deepEqual(f.trace.stats,[['jumps',1]]);assert.deepEqual(f.trace.quests,[['cleanjump',1]]);assert.deepEqual(f.trace.dailies,[['cleanjump',1]]);
 assert.equal(f.player.speed,4);assert.equal(f.trace.toasts.length,1);
 f.player.pos.z=.3;f.tick();assert.equal(f.trace.coins,10);assert.equal(f.trace.quests.length,1);
});

test('riding outside a visible fence span and riding an active course leave practice rewards alone',()=>{
 const outside=fixture();outside.player.pos.x=2;outside.player.y=.8;outside.tick();noEffects(outside);assert.equal(outside.player.speed,4);
 const course=fixture({course:{id:'actual-course'}});course.player.y=.8;course.tick();noEffects(course);assert.equal(course.player.speed,4);
});
