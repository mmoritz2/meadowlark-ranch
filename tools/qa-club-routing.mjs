import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the shipping inline hooks with an in-memory transport: no broker or player messages.
const html=readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
const source=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
const hooks=[],positions=[],removed=[],sent=[];
const save={playerName:'Aster',club:'new-club',sp:{pts:2},wk:{week:'local-week',sp:2,days:0,lastDay:''}};
let closed=0,handled=false;
const client={connected:false,on(){return this;},subscribe(){},publish(...args){sent.push(args);},end(){closed++;}};
const ctx=vm.createContext({
 SOCIAL:true,net:{id:'self',club:'old-club',client},remotes:{old:{parts:{group:'old-actor'}}},
 lbData:{sp:{OldRider:99}},trailOffer:{by:'OldRider'},NET_SUBS:[],
 freshSave:()=>save,syncSave:fn=>fn(save),myClub:()=>save.club,
 mqtt:{connect:()=>client},scene:{remove:x=>removed.push(x)},
 G:{run:(...args)=>{hooks.push(args);return args[0]==='message'&&handled;}},
 remoteUpdate:m=>positions.push(m),netStatus(){},toast(){},
 ensureWeek(){},weekKey:()=> 'local-week',Date,Math,
});
vm.runInContext(source('async function netConnect(){','/* The message dispatcher'),ctx);
vm.runInContext(source('function netOnMessage(topic,payload){','function isFriend(name){'),ctx);
vm.runInContext(source('function addSP(s,n,why){','function weeklyFeatured(){'),ctx);

await ctx.netConnect();
assert.equal(ctx.net.club,'new-club');assert.equal(closed,1);
assert.deepEqual(removed,['old-actor']);assert.equal(Object.keys(ctx.remotes).length,0);
assert.equal(Object.keys(ctx.lbData).length,0);assert.equal(ctx.trailOffer,null);
assert.deepEqual(hooks.find(h=>h[0]==='clubRoom'),['clubRoom','new-club','old-club']);
ctx.netOnMessage('srf1/old-club/pos',JSON.stringify({id:'old',n:'OldRider'}));
ctx.netOnMessage('srf1/old-club/lb/sp/OldRider',JSON.stringify({id:'old',n:'OldRider',v:99}));
assert.equal(positions.length,0);assert.equal(Object.keys(ctx.lbData).length,0);
ctx.netOnMessage('srf1/new-club/pos',JSON.stringify({id:'new',n:'NewRider'}));
ctx.netOnMessage('srf1/new-club/lb/sp/NewRider',JSON.stringify({id:'new',n:'NewRider',v:12}));
assert.equal(positions.length,1);assert.equal(ctx.lbData.sp.NewRider,12);
ctx.netOnMessage('srf1/new-club/pos',JSON.stringify({id:'self'}));
assert.equal(positions.length,1,'Own echo never becomes a remote rider');
handled=true;
ctx.netOnMessage('srf1/directory/profile',JSON.stringify({id:'directory'}));
assert(hooks.some(h=>h[0]==='message'&&h[1]==='srf1/directory/profile'),'Feature handlers still receive global directory/social topics');
ctx.remotes.same={parts:{group:'same-room'}};
await ctx.netConnect();
assert.equal(removed.length,1,'Reconnecting the same room keeps its current cached riders');
ctx.addSP(save,7,'event');
assert.equal(save.sp.pts,9);assert.equal(save.wk.sp,9);
const awards=hooks.filter(h=>h[0]==='starPoints');
assert.equal(awards.length,1);assert.equal(awards[0][1],save);
assert.deepEqual(awards[0].slice(2),[7,'event']);
assert.equal(sent.length,0,'The fixture sends no real or simulated player messages');
console.log('Club routing: room cleanup, stale packets, same-room reconnect and single Star Point hook passed.');
