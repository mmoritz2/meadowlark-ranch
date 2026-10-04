/* Two disposable clients and a retained in-memory broker. No browser or real network. */
import assert from 'node:assert/strict';
import {install} from '../assets/features/clubs-boards.js';
import {cleanClubMeta,acceptClubMeta} from '../assets/club-state.js';
const clone=v=>JSON.parse(JSON.stringify(v));
globalThis.document={createElement:()=>({}),head:{appendChild(){}},body:{classList:{contains:()=>false}}};
let week='2026-09-28';const clients=[],retained=new Map(),pending=[];
const matches=(pattern,topic)=>pattern.endsWith('/#')?topic.startsWith(pattern.slice(0,-1)):pattern===topic;
function flush(){for(let count=0;pending.length;count++){assert(count<1000,'No publication loop');const [to,topic,m]=pending.shift();if(m.id!==to.net.net.id)to.run('message',topic,clone(m));}}
function client(id,name,code='lake',seed){
 let saved=clone(seed||{playerName:name,club:code,horses:[],sp:{week:'personal-week',pts:0},coins:0}),writing=false;const ensures=[],events=new Map(),subs=new Set(),sent=[];
 const G={$:()=>null,toast(){},tables:{BREEDS3:[],NEIGHBOURS:[],EVENTS3:[]},horse:{sourceRule(){},grantHorse(s,key){const h={breed:key,name:key};s.horses.push(h);return h;},refreshTack(){},reloadHorses(){}},course:{weeklyFeatured:()=>[]},quest:{addAch(){}},sGem(){},sNeigh(){},time:{isoWeekKey:()=>week,weekKey:()=> 'personal-week'},ui:{rerender(){},onlineSection(){},lbTab(){},action(){},openOnline(){},renderLB(){}},money:{payReward(s,r){s.payments=(s.payments||0)+1;s.coins+=(r.c||0);},rewardLabel:()=>'',refreshWallet(){}}};
 G.on=(key,fn)=>{const a=events.get(key)||[];a.push(fn);events.set(key,a);};G.run=(key,...args)=>{for(const f of events.get(key)||[])if(f(...args)===true)return true;};
 G.save={ensure(fn){ensures.push(fn);fn(saved);},fresh(){const s=clone(saved);for(const f of ensures)f(s);return s;},sync(fn){assert(!writing,'No nested save transaction');writing=true;try{const s=G.save.fresh();fn(s);saved=clone(s);}finally{writing=false;}},flag(s,k){s.flags=s.flags||{};if(s.flags[k])return false;s.flags[k]=true;return true;}};
 G.net={net:{id,club:code,client:{connected:true,end(){this.connected=false;}}},lbData:{},myName:()=>G.save.fresh().playerName,subscribe(topic){subs.add(topic);for(const [t,m]of retained)if(matches(topic,t))pending.push([G,t,m]);},publish(topic,obj,opts){if(!G.net.net.client?.connected)return false;const m={id,n:G.net.myName(),...obj};sent.push([topic,clone(m)]);if(opts?.retain)retained.set(topic,m);for(const peer of clients)if([...peer.subs].some(p=>matches(p,topic)))pending.push([peer.G,topic,m]);return true;},netConnect(){G.run('clubRoom',saved.club,G.net.net.club);G.net.net.club=saved.club;}};
 const wrapper={G,subs,sent,raw:()=>clone(saved),rename(n){G.save.sync(s=>{s.playerName=n;});},credit(n){G.save.sync(s=>G.run('starPoints',s,n,'qa'));}};clients.push(wrapper);install(G);return wrapper;
}
const A=client('pa','Ada','lake',{playerName:'Ada',club:'lake',clubMeta:{name:'Lake Riders',founder:'Ada'},horses:[],coins:0}),B=client('pb','Bea');
assert(B.G.clubs.identity().pendingJoin);assert(!B.G.clubs.updateIdentity({name:'Accidental takeover'}),'Unknown joined club cannot be claimed');
assert(A.G.clubs.updateIdentity({name:'Lake Riders',motto:'Ride together',crest:'star',color:'#436b99',pub:true}));flush();
assert.equal(B.G.clubs.identity().name,'Lake Riders');assert(A.G.clubs.isLeader());assert(!B.G.clubs.isLeader());
A.credit(10);B.credit(7);A.G.clubs.publishClubCard();B.G.clubs.publishClubCard();flush();assert.equal(A.G.clubs.clubTotal(),17);assert.equal(B.G.clubs.clubTotal(),17);
A.G.run('message','srf1/lake/members/pb',{id:'pb',n:'Bea',sp:999999,wk:'2026-09-21',last:Date.now()+1});assert.equal(A.G.clubs.clubTotal(),17,'Late prior-week card cannot erase current contribution');
assert(!B.G.clubs.updateIdentity({name:'Wrong'}));assert(!B.G.clubs.saveNotice('Wrong'));
assert(A.G.clubs.setRole('Bea','officer'));flush();assert(B.G.clubs.canManage());assert(!A.G.clubs.canManageName('Bea','different-id'),'Another rider with the same officer name gets no role');assert(!A.G.clubs.canManageName('Bea'),'Name-only message cannot impersonate an ID-backed officer');assert(B.G.clubs.saveNotice('Saturday ride'));flush();assert.equal(A.G.save.fresh().clubNotice.t,'Saturday ride');A.G.run('message','srf1/lake/notice',{id:'different-id',n:'Bea',t:'False officer notice',at:Date.now()+1000});assert.equal(A.G.save.fresh().clubNotice.t,'Saturday ride');
B.rename('Bee');assert(B.G.clubs.canManage(),'Officer permission follows stable ID after name change');assert(B.G.clubs.saveNotice('Sunday ride'));flush();
A.rename('Adaline');assert(A.G.clubs.isLeader(),'Founder permission follows stable ID after name change');A.G.clubs.publishClubCard();flush();const C=client('pc','Cora');flush();assert.equal(C.G.clubs.identity().founderId,'pa','New joiner accepts stable founder ID after founder rename');
A.G.run('message','srf1/lake/meta',{id:'pretender',n:'Ada',f:'Ada',fid:'pa',nm:'Hijack',rev:100});assert.equal(A.G.clubs.identity().name,'Lake Riders');
A.G.run('message','srf1/lake/members/ancient',{id:'ancient',n:'Old',sp:999999,last:Date.now()});assert.equal(A.G.clubs.clubTotal(),17,'Untagged old points never count');
const reloaded=client('pb','Bee','lake',B.raw());flush();assert.equal(reloaded.G.clubs.spOf(),7,'Local contributions survive reload');
A.G.clubs.updateIdentity({pub:false});flush();assert(!B.G.clubs.clubDir.lake,'Unlisting removes retained public directory card');
B.G.run('message','srf1/dir/lake',{id:'pa',fid:'pa',nm:'Old listed club',wk:week,pub:true,rev:1});assert(!B.G.clubs.clubDir.lake,'Old listing cannot undo a newer unlist');
B.G.run('message','srf1/dir/legacy',{id:'old',nm:'Untagged stale points',sp:999999});assert(!B.G.clubs.clubDir.legacy,'Untagged directory cards are excluded');
A.G.run('clubRoom','meadowlark-commons','lake');A.G.net.net.club='meadowlark-commons';A.G.clubs.publishClubCard();flush();assert.equal(A.G.clubs.identity().code,'lake');assert(!A.sent.some(([t])=>t==='srf1/meadowlark-commons/meta'),'Commons never receives private identity');
A.G.run('message','srf1/clubs/forest',{id:'host',nm:'Forest advertised',wk:week,sp:40,mem:2});assert(A.G.clubs.joinClub('forest'));assert.equal(A.G.clubs.clubRows().filter(r=>r.n==='Forest advertised').length,0,'Joined club has only its own row, not a duplicate cached advertised row');assert.equal(A.G.clubs.spOf(),0);A.credit(4);assert.equal(A.G.clubs.spOf(),4);A.G.run('message','srf1/lake/meta',{id:'pa',n:'Ada',f:'Ada',fid:'pa',nm:'Old room',rev:200});assert.equal(A.G.clubs.identity().code,'forest');assert.notEqual(A.G.clubs.identity().name,'Old room');
assert(A.G.clubs.joinClub('lake'));assert.equal(A.G.clubs.spOf(),0,'Leaving resets current club SP, including after rejoining');assert.equal(A.G.clubs.clubTotal(),7);
week='2026-10-05';A.G.clubs.clubWeekRoll();assert.equal(A.G.clubs.clubTotal(),0,'Monday excludes all old contribution cards');A.credit(3);assert.equal(A.G.clubs.clubTotal(),3);A.G.clubs.publishClubCard();flush();assert.equal(B.G.clubs.clubTotal(),3);
A.G.save.sync(s=>{s.clubRecords.lake.last={week:'2026-09-28',total:320,rank:5,claimed:false};s.clubWeekLast={...s.clubRecords.lake.last};});assert(A.G.clubs.claimClubChest());const payments=A.raw().payments;assert.equal(payments,4,'Normal club chest pays four independent reward rolls');assert.equal(A.G.save.fresh().clubWeekLast.rewards.length,4);assert(!A.G.clubs.claimClubChest());A.G.clubs.joinClub('forest');A.G.clubs.joinClub('lake');assert(!A.G.clubs.claimClubChest());assert.equal(A.raw().payments,payments,'Chest cannot be re-claimed by leaving/rejoining');
const archiveReload=client('pa','Adaline','lake',A.raw());assert(!archiveReload.G.clubs.claimClubChest(),'Chest archive survives reload');
A.credit(3);A.G.save.sync(s=>A.G.run('interval30',s,Date.now()));assert.equal(A.G.clubs.spOf(),3,'Periodic upkeep preserves current transaction');
assert(A.G.clubs.leaveClub());assert.equal(A.G.clubs.identity().code,'');assert.equal(A.G.clubs.memberRows().length,0);assert(A.G.clubs.identity().canCreate);assert(A.G.clubs.createClub({name:'Fresh Club'}));assert(A.G.clubs.isLeader());
assert(!A.G.clubs.joinClub('constructor'));assert.equal({}.polluted,undefined);
const pendingClient=client('pending','Newcomer','new-room');pendingClient.G.run('message','srf1/new-room/notice',{id:'newfounder',n:'Founder',t:'Retained notice first',at:Date.now()});pendingClient.G.run('message','srf1/new-room/meta',{id:'newfounder',n:'Founder',f:'Founder',fid:'newfounder',nm:'New Room',rev:1});assert.equal(pendingClient.G.save.fresh().clubNotice.t,'Retained notice first','One pending notice replays only after founder authorization');
const legacyPersonal=client('personal','Solo','mr-abcdef');assert(legacyPersonal.G.clubs.identity().canCreate);assert(legacyPersonal.G.clubs.updateIdentity({name:'Solo Club'}),'Legacy unnamed personal room remains creatable');const safe=cleanClubMeta({roles:JSON.parse('{"__proto__":"officer","constructor":"officer"}')});assert(!Object.hasOwn(safe.roles,'__proto__'));assert(!Object.hasOwn(safe.roles,'constructor'));
assert(acceptClubMeta(cleanClubMeta(),{founder:'Old Name',founderId:'pa',senderId:'pa',senderName:'New Name',revision:1}));
console.log('PASS club core: two-client identity/roles, stable IDs, current-week contributions, reload, Commons isolation, join/leave, directory tombstone, chest idempotence, transaction safety');

// Screenshot-verified Star Equestrian weekly chest rules, without invented tier prices.
const rewards=client('rewards','Reward Rider','rewards-club',{playerName:'Reward Rider',club:'rewards-club',clubMeta:{name:'Rewards Club',founder:'Reward Rider'},horses:[],coins:0});
assert.deepEqual([rewards.G.clubs.championCount(1,99),rewards.G.clubs.championCount(1,100),rewards.G.clubs.championCount(50,100),rewards.G.clubs.championCount(51,100),rewards.G.clubs.championCount(0,100)],[0,1,1,0,0]);
assert.equal(rewards.G.clubs.clubRows().length,1,'Actual club board contains no synthetic rivals');assert(rewards.G.clubs.npcClubRows().every(r=>r.rival));
rewards.credit(100);rewards.G.clubs.touchClubWeek();assert.equal(rewards.G.save.fresh().clubWeek.ownSP,100);assert.equal(rewards.G.clubs.myClubRank().rank,1);
week='2026-10-12';const closed=rewards.G.clubs.clubWeekRoll();assert.equal(closed.ownSP,100,'Personal eligibility is archived when the week settles');assert.equal(closed.rewardPolicy,2);assert.equal(rewards.G.clubs.spOf(),0);assert.equal(rewards.G.clubs.championsForWeek(rewards.G.save.fresh().clubWeekLast),1);
const random=Math.random;try{Math.random=()=>0;assert(rewards.G.clubs.claimClubChest());}finally{Math.random=random;}
assert.equal(rewards.raw().payments,5,'Eligible week pays four club rewards plus one Champions reward');assert.equal(rewards.raw().stats.clubChests,1);assert.equal(rewards.raw().stats.clubChamp,1);assert(!rewards.G.clubs.claimClubChest());
assert.equal(rewards.G.clubs.championsForWeek({rank:1,claimed:false}),2,'Previously earned legacy Champions awards are preserved');
console.log('PASS club rewards: real clubs only, top-50/100-SP boundary, four rolls, archived own SP, leave reset, legacy awards preserved');

// Recorded history is cumulative per club, scoped, and distinct from this week's score.
const history=client('history','History Rider','history-club',{playerName:'History Rider',club:'history-club',clubMeta:{name:'History Club',founder:'History Rider'},horses:[],coins:0,sp:{week:'personal-week',pts:12}});
assert.equal(history.G.clubs.clubAllTime(),12,'Migrate known local current points once');
history.G.save.sync(()=>{});history.G.save.sync(()=>{});assert.equal(history.G.clubs.clubAllTime(),12,'Repeated ensure does not remigrate points');
history.credit(8);assert.equal(history.G.clubs.clubAllTime(),20);
history.G.run('message','srf1/history-club/members/peer',{id:'peer',n:'Peer',sp:9,allTime:30,wk:week,last:Date.now()});
assert.equal(history.G.clubs.clubAllTime(),50);history.G.clubs.touchClubWeek();
const historyWeek=week;week='2026-10-19';history.G.clubs.clubWeekRoll();
assert.equal(history.G.clubs.clubAllTime(),50,'Weekly reset retains all-time ledger');assert.equal(history.G.clubs.clubRows(undefined,'week')[0].v,0);assert.equal(history.G.clubs.clubRows(undefined,'all')[0].v,50);assert.equal(history.G.clubs.clubRows(undefined,'last')[0].v,29);
assert.equal(history.G.clubs.memberRows().find(r=>r.me).lastSP,20);assert.equal(history.G.clubs.memberRows().find(r=>r.id==='peer').lastSP,9);
history.credit(5);history.G.run('message','srf1/history-club/members/peer',{id:'peer',n:'Peer',sp:4,allTime:34,wk:week,last:Date.now()+1});
assert.equal(history.G.clubs.clubAllTime(),59);assert.equal(history.G.clubs.memberRows().find(r=>r.id==='peer').lastSP,9);
history.G.run('message','srf1/clubs/observed',{id:'owner',nm:'Observed',sp:45,allTime:140,level:4,wk:week,lastWeek:{week:historyWeek,total:28}});
history.G.run('message','srf1/clubs/no-history',{id:'owner2',nm:'No History',sp:7,wk:week});
assert.equal(history.G.clubs.clubRows(undefined,'week').find(r=>r.code==='observed').v,45);assert.equal(history.G.clubs.clubRows(undefined,'last').find(r=>r.code==='observed').v,28);assert.equal(history.G.clubs.clubRows(undefined,'all').find(r=>r.code==='observed').v,140);assert(!history.G.clubs.clubRows(undefined,'last').some(r=>r.code==='no-history'),'Unknown past totals are not invented');assert(!history.G.clubs.clubRows(undefined,'all').some(r=>r.code==='no-history'),'Legacy card without cumulative ledger is omitted from all-time');
history.G.run('message','srf1/clubs/observed',{id:'owner',nm:'Old observed',sp:30,allTime:110,wk:historyWeek});assert.equal(history.G.clubs.clubRows(undefined,'week').find(r=>r.code==='observed').v,45,'Old card cannot overwrite current score');assert.equal(history.G.clubs.clubRows(undefined,'all').find(r=>r.code==='observed').v,140,'Old card cannot lower cumulative ledger');
history.G.clubs.publishClubCard();const historyCard=history.sent.filter(([t])=>t==='srf1/clubs/history-club').at(-1)[1];assert.equal(historyCard.allTime,59);assert.equal(historyCard.lastWeek.total,29);assert.equal(historyCard.level,1);
history.G.clubs.joinClub('different-club');history.credit(2);assert.equal(history.G.clubs.clubAllTime(),2);history.G.clubs.joinClub('history-club');assert.equal(history.G.clubs.spOf(),0);assert.equal(history.G.clubs.clubAllTime(),59,'Leaving resets current score without erasing recorded lifetime SP');assert.equal(history.G.clubs.memberRows().find(r=>r.me).lastSP,20,'Settled personal contribution survives leave');
assert(history.G.clubs.saveNotice('N'.repeat(1000)));assert.equal(history.G.save.fresh().clubNotice.t.length,1000);
console.log('PASS club periods: one-time migration, cumulative credits, week/last/all real rows, unknown history omitted, member last SP, leave persistence, 1000-character notices');

// Leaving never republishes an aggregate based on stale peer scores.
const departOwner=client('depart-owner','Owner','depart-club',{playerName:'Owner',club:'depart-club',clubMeta:{name:'Depart Club',founder:'Owner'},horses:[],coins:0}),departPeer=client('depart-peer','Peer','depart-club'),observer=client('observer','Observer','observer-club');
departOwner.G.clubs.updateIdentity({name:'Depart Club'});flush();departOwner.credit(10);departPeer.credit(7);departOwner.G.clubs.publishClubCard();departPeer.G.clubs.publishClubCard();flush();departOwner.G.clubs.publishClubCard();flush();
assert.equal(observer.G.clubs.clubRows().find(r=>r.code==='depart-club').v,17);
const oldAggregate=clone(retained.get('srf1/clubs/depart-club'));
departPeer.credit(6);assert.equal(departPeer.G.clubs.spOf(),13);assert.equal(departOwner.G.clubs.clubTotal(),17,'Departing member has not seen the peer’s latest six points');
assert(departOwner.G.clubs.leaveClub());flush();
assert.equal(departPeer.G.clubs.spOf(),13,'Departure cannot overwrite a remaining member’s score');assert.equal(departPeer.G.clubs.clubTotal(),13);assert.equal(observer.G.clubs.clubRows().find(r=>r.code==='depart-club').v,13,'Remaining member immediately publishes the authoritative new aggregate');
assert.equal(observer.G.clubs.clubRows(undefined,'all').find(r=>r.code==='depart-club').v,23,'Leaving does not erase earned all-time points');
observer.G.run('message','srf1/clubs/depart-club',oldAggregate);assert.equal(observer.G.clubs.clubRows().find(r=>r.code==='depart-club').v,13,'Delayed pre-departure aggregate cannot resurrect the old total');
const departure=clone(retained.get('srf1/clubs/depart-club/departures/depart-owner'));observer.G.run('message','srf1/clubs/depart-club/departures/depart-owner',departure);assert.equal(observer.G.clubs.clubRows().find(r=>r.code==='depart-club').v,13,'A retained departure arriving after the fresh card cannot hide the fresh total');
const solo=client('depart-solo','Solo','solo-club',{playerName:'Solo',club:'solo-club',clubMeta:{name:'Solo Club',founder:'Solo'},horses:[],coins:0});solo.credit(9);solo.G.clubs.publishClubCard();flush();solo.G.clubs.leaveClub();flush();assert(!observer.G.clubs.clubRows().some(r=>r.code==='solo-club'),'An old aggregate is omitted when nobody remains online to refresh it');assert.equal(observer.G.clubs.clubRows(undefined,'all').find(r=>r.code==='solo-club').v,9);
console.log('PASS club departure: immediate scoped invalidation, remaining-member refresh, no stale peer overwrite, retained arrival order, lifetime history intact');
