import assert from 'node:assert/strict';
import {install} from '../assets/features/club-chat.js';
const copy=v=>JSON.parse(JSON.stringify(v));
function client(id,initial={}){
 let data={ridingClub:'a-club',...copy(initial)};const hooks={},ensures=[],sent=[];
 const G={on:(k,f)=>(hooks[k]||=[]).push(f),run:(k,...a)=>(hooks[k]||[]).forEach(f=>f(...a)),
  save:{ensure(f){ensures.push(f);f(data);},fresh:()=>copy(data),sync(f){const s=copy(data);ensures.forEach(e=>e(s));f(s);data=s;}},
  net:{net:{id,club:'meadowlark-commons',client:{connected:true}},myName:()=>id,subscribe(){},publish(topic,payload,options){sent.push({topic,payload:{id,n:id,...payload},options});return true;}},
  clubs:{identity:s=>({code:(s||data).ridingClub})},social:{filter:{clean:t=>({text:t.replace(/badword/g,'***')})}}};
 install(G);return {G,sent,data:()=>copy(data),reload:()=>client(id,data)};
}
const a=client('alice'),b=client('bob');
assert.equal(a.G.clubChat.send('Hello, club!').ok,true);
const p=a.sent[0];assert.equal(p.topic,'srf1/a-club/chat');assert.equal(p.options.retain,false);
b.G.run('message',p.topic,p.payload);b.G.run('message',p.topic,p.payload);
assert.equal(b.G.clubChat.rows().length,1,'Duplicate packets count once');
assert.equal(b.reload().G.clubChat.rows()[0].t,'Hello, club!');
b.G.run('message','srf1/another-club/chat',{id:'other',t:'Foreign'});
b.G.run('message',p.topic,{...p.payload,mid:'private',to:'someone',t:'Whisper'});
assert.equal(b.G.clubChat.rows().length,1,'Other clubs and whispers stay out');
b.G.save.sync(s=>{s.blocked={Muted:true};});b.G.run('message',p.topic,{id:'muted',n:'Muted',t:'Hidden'});
assert.equal(b.G.clubChat.rows().length,1);
b.G.run('message',p.topic,{id:'word',n:'Other',mid:'filtered',t:'badword'});
assert.equal(b.G.clubChat.rows()[1].t,'***');
b.G.net.net.client.connected=false;assert.equal(b.G.clubChat.send('Offline').ok,false);assert.equal(b.sent.length,0);
b.G.save.sync(s=>{s.ridingClub='another-club';});assert.deepEqual(b.G.clubChat.rows(),[]);
b.G.save.sync(s=>{s.ridingClub='a-club';});assert.equal(b.G.clubChat.rows().length,2);
assert.equal(a.G.clubChat.rows()[0].mine,true);
console.log('Club chat passed: Commons routing, non-retained transport, dedup, reload, isolation, mute/filter and offline state. No real messages sent.');
