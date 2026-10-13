/* Actual bond reducer and tick consumer, with production distance snapshots.
 * No browser, network, renderer, model writes or saved-game injection. */
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {ridingTravelCredit} from '../assets/riding-distance.mjs';
const source=fs.readFileSync(new URL('../assets/features/bond-personality-emotes.js',import.meta.url),'utf8'),core=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i);assert(i>=0&&j>i,'Actual bond seam exists: '+a);return source.slice(i,j);}
const constants=section('const PERS_DEFAULT=','/* ---- horse emote poses'),identity=section(' for(const k in PERS_FILL)',' const persWhistleOk='),helpers=section(' const levelToasts=[];',' const lastLv={};'),consumer=section('  // Consume the core\'s immutable collision-resolved frame once','  if(player.riderEmote&&');
const gain=core.match(/^function bondGain\(h,x,kind\).*$/m)?.[0];assert(gain,'Actual personality bond reducer exists');
function fixture({pers='relaxed',bond=20,earned=0,date=new Date().toDateString()}={}){
 const horse={id:'horse-one',name:'Clover',pers,bond,bondDay:{date,n:earned}},other={id:'horse-two',name:'Juniper',pers:'relaxed',bond:10,bondDay:null},live=[structuredClone(horse),structuredClone(other)],toasts=[];
 let saved={horses:[horse,other]},writes=0,index=0;const G={horse:{myHorses:live,rideIdx:()=>index,ridden:()=>live[index]},save:{sync(fn){const draft=structuredClone(saved);fn(draft);saved=draft;writes++;}}};
 const ctx=vm.createContext({G,PERS:{},toast:v=>toasts.push(v)});vm.runInContext(constants+identity+'\n'+gain+'\nG.horse.bondGain=bondGain;\n'+helpers+'\nfunction rideTick(dt){'+consumer+'}\nfunction accumulated(){return rideAcc;}',ctx);
 return {G,ctx,live,toasts,get saved(){return saved;},set saved(v){saved=v;},get writes(){return writes;},select:i=>{index=i;},tick:(travel,dt=.1)=>{G.horse.frameTravel=travel;ctx.rideTick(dt);},acc:()=>ctx.accumulated()};
}
function physical({mountId='horse-one',distance=1,onFoot=false,flying=false,vehicle=false,locked=false,grounded=true}={}){
 return ridingTravelCredit({x:0,z:0,speed:10,mountId,onFoot,flying,vehicle,locked,grounded},{x:0,z:distance},{dt:distance/10,mountId,onFoot,flying,vehicle,locked,grounded,native:true,gait:grounded?'gallop':'jump'});
}
function meters(f,n,options={}){for(let i=0;i<n;i++)f.tick(physical(options));}
test('nominal motion against obstacles, missing snapshots and invalid distances cannot earn bond',()=>{
 const f=fixture();f.G.horse.player={speed:30,flying:false};
 for(const travel of [undefined,null,physical({distance:0}),{mountId:'horse-one',bond:NaN},{mountId:'horse-one',bond:Infinity},{mountId:'horse-one',bond:-1}])f.tick(travel,60);
 assert.equal(f.acc(),0);assert.equal(f.writes,0);assert.equal(f.saved.horses[0].bond,20);
});
test('wrong or missing current horse identity cannot contribute riding metres',()=>{
 const f=fixture();meters(f,250,{mountId:'horse-two'});assert.equal(f.acc(),0);assert.equal(f.writes,0);f.select(9);f.tick({mountId:undefined,bond:200});assert.equal(f.acc(),0);assert.equal(f.writes,0);
});
test('200 actual non-flying mounted metres award one riding bond and preserve the remainder',()=>{
 const f=fixture();meters(f,199);assert.equal(f.writes,0);assert.equal(f.acc(),199);f.tick(physical());assert.equal(f.writes,1);assert.equal(f.saved.horses[0].bond,21);assert.equal(f.live[0].bond,21);assert.equal(f.saved.horses[0].bondDay.n,1);assert.equal(f.acc(),0);meters(f,3);assert.equal(f.acc(),3);assert.equal(f.writes,1);
});
test('replaying the same immutable frame snapshot cannot double-credit its metres',()=>{
 const f=fixture(),travel=physical();f.tick(travel);for(let i=0;i<250;i++)f.tick(travel);assert.equal(f.acc(),1);assert.equal(f.writes,0);f.tick(physical());assert.equal(f.acc(),2);
});
test('actual jump travel builds riding bond but flight, vehicles and on-foot travel never do',()=>{
 const jump=fixture();meters(jump,200,{grounded:false});assert.equal(jump.saved.horses[0].bond,21);assert.equal(jump.writes,1);
 for(const flags of [{flying:true},{vehicle:true},{onFoot:true},{locked:true}]){const f=fixture();meters(f,250,flags);assert.equal(f.writes,0);assert.equal(f.acc(),0);assert.equal(f.saved.horses[0].bond,20);}
});
test('the existing personality gain and eight-bond daily cap remain authoritative',()=>{
 const energetic=fixture({pers:'energetic'});meters(energetic,800);assert.equal(energetic.saved.horses[0].bond,28);assert.equal(energetic.saved.horses[0].bondDay.n,8);meters(energetic,400);assert.equal(energetic.saved.horses[0].bond,28);assert.equal(energetic.saved.horses[0].bondDay.n,8);
 const aloof=fixture({pers:'aloof'});meters(aloof,200);assert.equal(aloof.saved.horses[0].bond,20);assert.equal(aloof.saved.horses[0].bondDay.n,0);
 const capped=fixture({earned:8});meters(capped,200);assert.equal(capped.saved.horses[0].bond,20);assert.equal(capped.saved.horses[0].bondDay.n,8);
});
test('normal daily rollover still opens the existing riding cap',()=>{
 const f=fixture({earned:8,date:'Yesterday'});meters(f,200);assert.equal(f.saved.horses[0].bond,21);assert.equal(f.saved.horses[0].bondDay.date,new Date().toDateString());assert.equal(f.saved.horses[0].bondDay.n,1);
});
test('a reordered fresh save pays the same measured horse ID rather than another horse at its old index',()=>{
 const f=fixture();f.saved={horses:[f.saved.horses[1],f.saved.horses[0]]};meters(f,200);assert.equal(f.saved.horses.find(h=>h.id==='horse-one').bond,21);assert.equal(f.saved.horses.find(h=>h.id==='horse-two').bond,10);
});
test('a horse removed from the fresh save cannot redirect riding bond to a replacement',()=>{
 const f=fixture();f.saved={horses:[f.saved.horses[1]]};meters(f,200);assert.equal(f.saved.horses[0].bond,10);assert.equal(f.saved.horses[0].bondDay,null);
});
