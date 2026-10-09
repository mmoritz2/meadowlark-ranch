import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Execute the real herd, following, interaction and save seams. The inert scene
// and isolated string store never launch a browser or touch a player's save.
const worldUrl=new URL('../assets/features/world.js',import.meta.url);
const source=fs.readFileSync(worldUrl,'utf8');
const a=source.indexOf(' /* ================= 7. wild herds'),b=source.indexOf(' /* ================= 8. sanctuaries',a);
assert(a>=0&&b>a,'production ordinary-wild-herd boundary');
const herdCode=source.slice(a,b);
const steeringStart=source.indexOf(' function segDist('),steeringEnd=source.indexOf(' /* Nothing that follows you',steeringStart);
assert(steeringStart>=0&&steeringEnd>steeringStart,'production follower steering boundary');
const steeringCode=source.slice(steeringStart,steeringEnd);
const ruleImport=source.match(/import\s*\{[^}]*wildTamingInteraction[^}]*\}\s*from\s*['"]([^'"]+)['"]/);
const rules=ruleImport?await import(new URL(ruleImport[1].split('?')[0],worldUrl)):{};
const clone=value=>JSON.parse(JSON.stringify(value));
const core=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
const escapeStart=core.indexOf(" if(e.code==='Escape'){"),escapeEnd=core.indexOf(" if($('load')||G.dialogue",escapeStart);
assert(escapeStart>=0&&escapeEnd>escapeStart,'production Escape boundary');
const escapeCode=core.slice(escapeStart,escapeEnd);
function vec(x=0,y=0,z=0){return {x,y,z,set(x,y,z){Object.assign(this,{x,y,z});return this;},copy(v){return this.set(v.x,v.y,v.z);}};}
function group(){return {position:vec(),rotation:{x:0,y:0,z:0},visible:true,children:[],add(x){this.children.push(x);x.parent=this;},remove(x){this.children=this.children.filter(v=>v!==x);x.parent=null;}};}
function fixture(options={}){
 const elements=new Map(),events={},trace={toasts:[],writes:0,writeAttempts:0,removed:[],chat:[],daily:[],quest:[],pass:[],confirm:[],wallet:0,reload:0,sanctuary:[],chime:0,gem:0,grants:[]};
 let now=100000,failure=options.failure||null,failedAtWrites=0,random=.5,blocked=false;
 const key='isolated-wild-taming-fixture';
 let stored=JSON.stringify({coins:100,gems:2,items:{carrot:options.carrots??4},nextId:2,horses:[{id:1,name:'Clover',breed:'bay-sporthorse'}],stats:{},pass:{pts:5},sanctuary:{},wildSeen:{},life:{},story:{idx:0,prog:0},dq:{prog:{}}});
 const localStorage={getItem(k){assert.equal(k,key);if(failure==='readback'&&trace.writes>failedAtWrites)throw Error('readback unavailable');return stored;},setItem(k,v){assert.equal(k,key);trace.writeAttempts++;if(failure==='write')throw Error('storage full');stored=String(v);trace.writes++;if(failure==='after-write')throw Error('write wrapper failed after commit');}};
 function node(id=''){
  const n={id,style:{display:'none'},dataset:{},textContent:'',onclick:null,disabled:false,hidden:false,children:[],classList:{toggle(){},add(){},remove(){},contains(){return false;}},setAttribute(k,v){this[k]=v;},appendChild(c){this.children.push(c);},querySelector(selector){for(const id of selector.split(',').map(s=>s.trim().replace(/^#/,'')))if((this._ids||[]).includes(id))return elements.get(id)||null;return null;},addEventListener(name,fn){this['on'+name]=fn;},getClientRects(){return this.style.display==='none'?[]:[{}];},focus(){},click(){if(!this.disabled&&!this.hidden)this.onclick?.({preventDefault(){},stopPropagation(){}});}};
  Object.defineProperty(n,'innerHTML',{get(){return this._html||'';},set(html){for(const old of this._ids||[])elements.delete(old);this._ids=[];this._html=html;for(const match of html.matchAll(/<[^>]+\bid=["']([^"']+)["'][^>]*>/g)){this._ids.push(match[1]);const child=node(match[1]),style=/\bstyle=["']([^"']*)["']/.exec(match[0]);child.style.display='';child.hidden=/\bhidden(?:\s|>)/.test(match[0]);child.disabled=/\bdisabled(?:\s|>)/.test(match[0]);child.markup=match[0];if(style)child.inlineStyle=style[1];elements.set(child.id,child);}}});
  if(id)elements.set(id,n);return n;
 }
 for(const id of ['dlg','tameHud','bigmapWrap','chatBar'])node(id);
 const $=id=>elements.get(id)||null;
 const document={hidden:false,head:node(),body:node(),createElement:()=>node(),getElementById:$,addEventListener(name,fn){(events['document:'+name]??=[]).push(fn);}};
 const player={pos:vec(),heading:0,speed:0,y:0},P={veh:null};
 const W={things:[],colliders:[],walls:[],addThing(t){this.things.push(t);return t;}};
 const scene={add(){},remove(g){trace.removed.push(g);}};
 const S={KEY:key,fresh(){try{return JSON.parse(localStorage.getItem(key));}catch{return null;}},sync(fn){try{const s=JSON.parse(localStorage.getItem(key));fn(s);localStorage.setItem(key,JSON.stringify(s));}catch{}},ensure(){}};
 const M={payReward(s,r){s.coins+=(r.c||0);s.gems+=(r.g||0);},grantGems(s,n){s.gems+=n;return n;},refreshWallet(){trace.wallet++;}};
 const H={breedLabel:b=>b,player,makeHorse:()=>({group:group()}),grantHorse(s,breed,opts){trace.grants.push(clone({breed,opts}));const h={id:s.nextId++,breed,...clone(opts),...clone(opts.extra||{})};s.horses.push(h);return h;},reloadHorses(){trace.reload++;}};
 const Q={dailyEvt(type,value){trace.daily.push({type,value});},questEvt(type,value){trace.quest.push({type,value});},creditTamingProgress(s,receipt){s.life.tame=(s.life.tame||0)+1;s.story.prog++;s.dq.prog.tame=(s.dq.prog.tame||0)+1;receipt.progress={tame:1};return receipt.progress;},confirmTamingProgress(receipt){trace.confirm.push(clone(receipt));}};
 const N={SOCIAL:false,myName:()=> 'Rider',sendChat(message,data){trace.chat.push(clone({message,data}));}};
 const G={worldPkg:P,horse:H,money:M,quest:Q,save:S,net:N,input:{blocked:()=>blocked},course:{get:()=>null,drillActive:()=>false},wild:{get:()=>null,strays:true},xp:{passAmount:n=>n,passAdd(n){trace.pass.push(n);S.sync(s=>{s.pass.pts+=n;});}},sChime(){trace.chime++;},sGem(){trace.gem++;},on(name,fn){(events[name]??=[]).push(fn);},run(name,...args){let handled;for(const fn of events[name]||[]){if(fn(...args)===true)handled=true;}return handled;},riding:{releaseAll(){}},seFrame:{screens:new Set(),settle(){}},ui:{canAnnounce:()=>true}};
 const hyp=(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz);
 const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
 const {steer,pushOut,avoid}=Function('W','P','hyp','wrap','fallsAllowsHorse',steeringCode+'return {steer,pushOut,avoid};')(W,P,hyp,wrap,()=>true);
 const bindings={...rules,G,W,H,S,M,Q,N,UI:G.ui,P,player,scene,$,document,localStorage,THREE:{Vector3:class{constructor(x=0,y=0,z=0){Object.assign(this,vec(x,y,z));}}},T:{REWARD_KINDS:{c:{pay(s,n){s.coins+=n;}},g:{pay(s,n){s.gems+=n;}},p:{pay(s,n){s.pass.pts+=n;}}},WILD_BREEDS:[{breed:'appaloosa',variant:'River Paint',body:'#b87742',mane:'#312314',base:5}]},groundH:()=>0,findClear:(x,z)=>[x,z],fallsAllowsHorse:()=>true,plate:()=>({position:vec()}),rnd:(a,b)=>(a+b)/2,hyp,steer,pushOut,avoid,clearOfCamera(){},refreshSanctuary:sc=>trace.sanctuary.push(sc.id),SANCTUARIES:[{id:'pines',x:-62,z:-90,label:'🌲 Pines Horse Sanctuary'}],toast:m=>trace.toasts.push(m),performance:{now:()=>now},Math:Object.assign(Object.create(Math),{random:()=>random}),setTimeout:fn=>fn(),clearTimeout(){}};
 const escape=Function('G','$','document','hidePanels','freeCam','toggleFreeCam','build','endBuild','toggleMap','setPosing','e',escapeCode);
 const api=Function(...Object.keys(bindings),herdCode+'\nreturn {offerCarrot,checkTame,tameMember,tickHerds,tickTrustHud,useWildMember:typeof useWildMember===\"function\"?useWildMember:null,wildInteraction:typeof wildInteraction===\"function\"?wildInteraction:null};')(...Object.values(bindings));
 const hd=P.herds.find(h=>h.def.id===(options.herdId||'pines')),m=hd.members[options.memberIndex||0];hd.members=[m];hd.seen=true;P.herds=[hd];W.things=[m.thing];player.pos.set(m.pos.x,0,m.pos.z+1);
 return {api,G,P,W,H,player,member:m,trace,$,elements,events,get save(){return JSON.parse(stored);},get stored(){return stored;},get failure(){return failure;},set failure(v){failure=v;failedAtWrites=trace.writes;},set random(v){random=v;},set blocked(v){blocked=v;},tick(dt=.1){now+=dt*1000;api.tickHerds(dt,now/1000);api.tickTrustHud();},ready(){for(let i=0;i<300&&P.effTrust(m)<100;i++)this.tick();assert.equal(P.effTrust(m),100,'the production calm/follow loop earns full trust');return m;},use(){m.thing.use();},click(id){assert($(id),'production button '+id);$(id).click();},escape(){return escape(G,$,document,()=>{},false,()=>{}, {},()=>{},()=>{},()=>{},{code:'Escape',preventDefault(){}});},styles:()=>document.head.children.map(n=>n.textContent).join('\n'),inHerd(){return hd.members.includes(m)&&W.things.includes(m.thing)&&!trace.removed.includes(m.parts.group);}};
}

test('calm approach earns following and full trust without carrots or automatic removal',()=>{
 const f=fixture(),carrots=f.save.items.carrot;let followed=false;
 for(let i=0;i<300&&f.P.effTrust(f.member)<100;i++){f.tick();if(f.member.follow)followed=true;}
 assert(followed,'patient approach activates the actual follow branch at half trust');assert.equal(f.P.effTrust(f.member),100);
 assert.equal(f.member.follow,true);assert.equal(f.save.items.carrot,carrots);assert(f.inHerd(),'earned horse stays visible and interactive');
 assert.equal(f.$('dlg').style.display,'none','trust alone never opens a forced dialog');
 assert.match(f.member.thing.label(),/choose a home|befriend|ready|trusts you/i,'the interaction advertises the earned finish');
 assert.equal(f.save.stats.tamedWild||0,0);assert.equal(f.trace.quest.length,0);
});

test('walking with a ready horse retains it until a stopped explicit nearby interaction',()=>{
 const f=fixture();f.ready();f.player.speed=3;for(let i=0;i<20;i++){f.player.pos.z+=.1;f.tick();}
 assert(f.inHerd());assert.equal(f.member.follow,true);assert.equal(f.$('dlg').style.display,'none');
 f.use();assert.equal(f.$('dlg').style.display,'none','a moving rider cannot finish');
 f.player.speed=0;f.player.pos.set(f.member.pos.x,0,f.member.pos.z+1);f.use();
 assert.equal(f.$('dlg').style.display,'block');assert(f.$('wTameHome'));assert(f.$('wTameSanct'));assert(f.$('wTameLater'));assert(f.inHerd());
});

test('ready HUD action is an explicit reachable alternative to E',()=>{
 const f=fixture();f.ready();f.tick();const action=f.$('wildTameAction');assert(action,'the real trust HUD contains its action');
 assert.equal(action.hidden,false);assert.equal(action.disabled,false);assert.match(f.styles(),/#wildTameAction\s*\{[^}]*min-height:44px/,'production HUD stylesheet declares its 44px touch target');
 action.click();assert.equal(f.$('dlg').style.display,'block');assert(f.inHerd());
});

test('dismissal via Later and Escape retains the same earned encounter for reopening',()=>{
 const f=fixture();f.ready();f.use();f.click('wTameLater');assert.equal(f.$('dlg').style.display,'none');assert(f.inHerd());
 f.use();assert.equal(f.$('dlg').style.display,'block');f.escape();assert.equal(f.$('dlg').style.display,'none');assert(f.inHerd());
 f.use();assert.equal(f.$('dlg').style.display,'block');assert.equal(f.save.stats.tamedWild||0,0);assert.equal(f.trace.removed.length,0);
});

test('home choice stores the same named coat, ownership and progress before removing once',()=>{
 const f=fixture();f.ready();f.use();const m=f.member,save=f.save;f.click('wTameHome');
 const after=f.save,h=after.horses.find(h=>h.id!==1);assert(h);assert.equal(h.name,m.name);assert.equal(h.breed,m.wb.breed);assert.deepEqual(h.colors,{body:m.wb.body,mane:m.wb.mane});assert.equal(h.variant,m.wb.variant);
 assert.equal(after.stats.tamedWild,1);assert.equal(after.wildSeen[m.herd.id],1);assert.equal(after.gems,save.gems+1);assert.equal(after.life.tame,1);assert.equal(after.story.prog,1);assert.equal(after.dq.prog.tame,1);
 assert.equal(f.inHerd(),false);assert.equal(f.trace.removed.length,1);assert.equal(f.trace.reload,1);assert.equal(f.trace.confirm.length,1);
 const committed=f.stored;f.api.tameMember(m,true);assert.equal(f.stored,committed);assert.equal(f.trace.removed.length,1);assert.equal(f.trace.confirm.length,1);
});

test('sanctuary choice stores the exact encounter and release reward without granting ownership',()=>{
 const f=fixture();f.ready();f.use();const before=f.save;f.click('wTameSanct');const s=f.save,row=s.sanctuary.pines?.[0];
 assert(row);assert.equal(row.name,f.member.name);assert.equal(row.breed,f.member.wb.breed);assert.equal(row.variant,f.member.wb.variant);assert.equal(row.body,f.member.wb.body);assert.equal(row.mane,f.member.wb.mane);
 assert.equal(s.horses.length,before.horses.length);assert.equal(s.stats.tamedWild,1);assert.equal(s.stats.released,1);assert.equal(s.coins,before.coins+150);assert.equal(s.gems,before.gems+1);assert.equal(s.life.tame,1);
 assert.equal(f.inHerd(),false);assert.deepEqual(f.trace.sanctuary,['pines']);assert.equal(f.trace.confirm.length,1);
});

for(const choice of ['wTameHome','wTameSanct'])test('failed '+choice+' save retains horse and choice for exact retry',()=>{
 const f=fixture();f.ready();f.use();const before=f.stored;f.failure='write';f.click(choice);
 assert.equal(f.stored,before,'a rejected write retains exact saved ownership, rewards and progress');assert(f.inHerd());assert.equal(f.trace.removed.length,0);assert.equal(f.trace.confirm.length,0);assert.equal(f.trace.chat.length,0);
 assert.equal(f.$('dlg').style.display,'block');assert(f.$('wTameRetry'),'failed choice offers a real retry');
 const proposal=f.trace.grants.at(-1);f.random=.99;f.failure=null;const retry=f.$('wTameRetry');retry.click();if(proposal)assert.deepEqual(f.trace.grants.at(-1).opts.stats,proposal.opts.stats,'retry does not reroll the frozen horse');assert.equal(f.save.stats.tamedWild,1);assert.equal(f.save.life.tame,1);assert.equal(f.trace.removed.length,1);assert.equal(f.trace.confirm.length,1);
 if(choice==='wTameHome'){assert.equal(f.save.horses.length,2);assert.equal(f.save.horses[1].name,f.member.name);}else assert.equal(f.save.sanctuary.pines.length,1);
 const saved=f.stored;retry.click();assert.equal(f.stored,saved);assert.equal(f.trace.removed.length,1);assert.equal(f.trace.confirm.length,1);
});

test('an ambiguous post-write failure confirms the already saved same horse without duplicate payouts',()=>{
 const f=fixture();f.ready();f.use();f.failure='after-write';f.click('wTameHome');
 assert.equal(f.save.horses.length,2);assert.equal(f.save.stats.tamedWild,1);assert.equal(f.save.life.tame,1);
 f.failure=null;if(f.inHerd()){assert(f.$('wTameRetry'));f.click('wTameRetry');}
 assert.equal(f.save.horses.length,2);assert.equal(f.save.stats.tamedWild,1);assert.equal(f.save.life.tame,1);assert.equal(f.trace.removed.length,1);assert.equal(f.trace.confirm.length,1);
});


test('ready completion rejects remote, moving and spooked interactions without carrots or removal',()=>{
 const f=fixture();f.ready();const initial=f.save.items.carrot;
 for(const state of [{distance:5.6,speed:0,flee:0},{distance:1,speed:1.2,flee:0},{distance:1,speed:-1.2,flee:0},{distance:1,speed:0,flee:1}]){
  f.player.pos.set(f.member.pos.x,0,f.member.pos.z+state.distance);f.player.speed=state.speed;f.member.flee=state.flee;f.use();
  assert.equal(f.$('dlg').style.display,'none');assert(f.inHerd());assert.equal(f.save.items.carrot,initial,'earned finish is not another feeding action');
 }
 f.member.flee=0;f.player.speed=0;f.player.pos.set(f.member.pos.x,0,f.member.pos.z+1);f.use();assert.equal(f.$('dlg').style.display,'block');
});

test('optional carrots still build trust but no-carrot approach can earn the finish',()=>{
 const f=fixture();f.use();assert.equal(f.save.items.carrot,3);assert.equal(f.member.trust,25);assert.equal(f.$('dlg').style.display,'none');assert.equal(f.trace.daily.filter(e=>e.type==='feed').length,1);
 const g=fixture({carrots:0});g.use();assert.equal(g.member.trust,0);g.ready();g.use();assert.equal(g.$('dlg').style.display,'block');assert.equal(g.save.items.carrot,0);assert(g.inHerd());
});

test('unreadable post-write confirmation keeps the earned horse until same-outcome retry',()=>{
 const f=fixture();f.ready();f.use();f.failure='readback';f.click('wTameHome');
 assert.equal(f.save.horses.length,2,'the first write really committed');assert.equal(f.save.stats.tamedWild,1);assert(f.inHerd(),'the unreadable confirmation cannot remove the horse');assert.equal(f.trace.confirm.length,0);assert.equal(f.trace.chat.length,0);
 assert(f.$('wTameRetry'));f.failure=null;const writes=f.trace.writes;f.click('wTameRetry');
 assert.equal(f.save.horses.length,2);assert.equal(f.save.stats.tamedWild,1);assert.equal(f.save.life.tame,1);assert.equal(f.trace.writes,writes,'receipt retry only confirms the existing transaction');assert.equal(f.trace.removed.length,1);assert.equal(f.trace.confirm.length,1);
});


function cooperativeReady(f){
 f.member.trust=60;f.member.follow=true;
 f.G.run('chat',{id:'ash',wild:{h:f.member.herd.id,i:f.member.i,tr:60}},'Ash');
 assert.equal(f.P.effTrust(f.member),100);assert.equal(f.member.taming,true,'real incoming trust latches the earned encounter');
}
function helperDone(f,runId='wild-remote-tame-1'){
 return f.G.run('chat',{id:'ash',wildDone:{h:f.member.herd.id,i:f.member.i,by:'Ash',runId}},'Ash');
}

test('a ready but unchosen co-op encounter still settles its saved finisher helper reward once',()=>{
 const f=fixture({herdId:'coyote'});cooperativeReady(f);const before=f.save;
 helperDone(f);const s=f.save;assert.equal(s.stats.coopTames,1);assert.equal(s.stats.tamedWild||0,0);assert.equal(s.horses.length,before.horses.length);
 assert.equal(s.coins,before.coins+300);assert.equal(s.gems,before.gems+2);assert.equal(s.pass.pts,before.pass.pts+40);assert.equal(s.wildTaming.lastResult.choice,'helper');assert.equal(s.wildTaming.lastResult.runId,'helper-wild-remote-tame-1');
 assert.equal(f.trace.removed.length,1);assert.equal(f.trace.confirm.length,1);const saved=f.stored;helperDone(f);assert.equal(f.stored,saved);assert.equal(f.trace.confirm.length,1);
});

test('incoming helper success and failed pending save preserve an unrelated visible dialog',()=>{
 for(const fail of [false,true]){
  const f=fixture({herdId:'coyote'});cooperativeReady(f);const dialog=f.$('dlg');dialog.innerHTML='<b>An unrelated conversation</b>';dialog.style.display='block';
  if(fail)f.failure='write';helperDone(f);
  assert.equal(dialog.innerHTML,'<b>An unrelated conversation</b>');assert.equal(dialog.style.display,'block','remote game completion never opens or dismisses another dialogue');
  if(fail){
   assert(f.inHerd());assert.equal(f.trace.confirm.length,0);assert.equal(f.P.pendingTaming().length,1);assert.equal(f.P.pendingTaming()[0].choice,'helper');
   f.failure=null;dialog.style.display='none';f.player.speed=0;f.player.pos.set(f.member.pos.x,0,f.member.pos.z+1);f.use();assert(f.$('wTameRetry'));f.click('wTameRetry');
  }
  assert.equal(f.save.stats.coopTames,1);assert.equal(f.save.coins,400);assert.equal(f.save.gems,4);assert.equal(f.trace.confirm.length,1);
 }
});

test('replayed saved finisher packet cannot repay or remove a replacement herd member',()=>{
 const f=fixture({herdId:'coyote'});cooperativeReady(f);helperDone(f);f.tick(181);
 const replacement=f.P.herds[0].members[0];assert(replacement);assert.notEqual(replacement,f.member);replacement.trust=10;
 const saved=f.stored,removed=f.trace.removed.length;helperDone(f);
 assert.equal(f.stored,saved);assert.equal(f.trace.removed.length,removed);assert(f.P.herds[0].members.includes(replacement));assert.equal(f.trace.confirm.length,1);
});

test('menus freeze a pre-ready follower and cannot accumulate escorted-distance progress',()=>{
 const f=fixture();f.member.trust=60;f.member.follow=true;f.member.pos.x+=10;
 const before={x:f.member.pos.x,z:f.member.pos.z,trust:f.member.trust,walked:f.member.walked};f.blocked=true;f.tick(10);
 assert.deepEqual({x:f.member.pos.x,z:f.member.pos.z,trust:f.member.trust,walked:f.member.walked},before);
 assert.equal(f.trace.daily.filter(e=>e.type==='walkwild').length,0);assert.equal(f.member.taming,undefined);
 f.blocked=false;f.tick(.5);assert.notEqual(f.member.pos.x,before.x,'normal escort movement resumes after the menu');
});

test('a remote finisher cannot replace this rider’s already selected pending home outcome',()=>{
 const f=fixture({herdId:'coyote'});cooperativeReady(f);f.use();f.failure='write';f.click('wTameHome');
 const pending=f.P.pendingTaming()[0];assert.equal(pending.choice,'home');const before=f.stored;
 helperDone(f);assert.equal(f.P.pendingTaming()[0],pending);assert.equal(pending.choice,'home');assert.equal(f.stored,before);assert.equal(f.trace.confirm.length,0);
 f.failure=null;f.click('wTameRetry');assert.equal(f.save.wildTaming.lastResult.choice,'home');assert.equal(f.save.horses.length,2);assert.equal(f.save.coins,100);assert.equal(f.save.gems,3);assert.equal(f.trace.confirm.length,1);
});

test('rejected carrot deduction earns no trust, feed progress or successful-looking sound',()=>{
 const f=fixture(),before=f.stored;f.failure='write';f.use();
 assert.equal(f.stored,before);assert.equal(f.member.trust,0);assert.equal(f.trace.daily.filter(e=>e.type==='feed').length,0);assert.equal(f.trace.chime,0);assert.equal(f.$('dlg').style.display,'none');
 f.failure=null;f.use();assert.equal(f.save.items.carrot,3);assert.equal(f.member.trust,25);assert.equal(f.trace.daily.filter(e=>e.type==='feed').length,1);assert.equal(f.trace.chime,1);
});

test('unreadable committed carrot deduction retries the same feed without consuming twice',()=>{
 const f=fixture();f.failure='readback';f.use();
 assert.equal(f.save.items.carrot,3,'the carrot deduction really committed');assert.equal(f.member.trust,0,'trust waits for verified feed');assert.equal(f.trace.daily.filter(e=>e.type==='feed').length,0);assert.equal(f.trace.chime,0);
 f.failure=null;const saved=f.stored;f.use();
 assert.equal(f.save.items.carrot,3);assert.equal(f.member.trust,25);assert.equal(f.trace.daily.filter(e=>e.type==='feed').length,1);assert.equal(f.trace.chime,1);assert.equal(f.stored,saved,'retry preserves the exact existing feed transaction');assert.equal(Object.keys(f.save.wildTaming.feeds).length,1);
});

test('ambiguous post-write carrot failure acknowledges one saved feed',()=>{
 const f=fixture();f.failure='after-write';f.use();
 assert.equal(f.save.items.carrot,3);assert.equal(f.member.trust,25);assert.equal(f.trace.daily.filter(e=>e.type==='feed').length,1);assert.equal(f.trace.chime,1);assert.equal(Object.keys(f.save.wildTaming.feeds).length,1);
});


test('actual stopped follower steering settles inside the handover reach after a natural walk',()=>{
 for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const memberIndex of [0,1]){
  const f=fixture({memberIndex});f.player.heading=heading;f.ready();
  f.player.speed=3;
  for(let i=0;i<100;i++){f.player.pos.x+=Math.sin(heading)*.15;f.player.pos.z+=Math.cos(heading)*.15;f.tick(.05);}
  f.player.speed=0;let largestStep=0,lastStep=0;
  for(let i=0;i<100;i++){const before={x:f.member.pos.x,z:f.member.pos.z};f.tick(.05);lastStep=Math.hypot(f.member.pos.x-before.x,f.member.pos.z-before.z);largestStep=Math.max(largestStep,lastStep);}
  const distance=Math.hypot(f.member.pos.x-f.player.pos.x,f.member.pos.z-f.player.pos.z);
  assert(distance<=5.5,`stopped follower ${memberIndex} at heading ${heading} is reachable: ${distance}`);
  assert(lastStep<1e-8,'the actual steer stop radius settles rather than orbiting');assert(largestStep<=6.5*.05+1e-8,'open-ground correction respects the authored travel speed');
  assert.equal(f.api.wildInteraction(f.member).eligible,true);assert.equal(f.$('wildTameAction').disabled,false);f.use();assert.equal(f.$('dlg').style.display,'block');assert(f.inHerd());
 }
});


for(const dismissal of ['Later','Escape'])test('stale wild dialog ownership cannot close Wren after '+dismissal,()=>{
 const f=fixture({herdId:'coyote'});cooperativeReady(f);f.use();
 const dialog=f.$('dlg');assert.equal(dialog.dataset.wildTaming,f.member.runId);assert(dialog.querySelector('#wTameHome'));
 if(dismissal==='Later')f.click('wTameLater');else f.escape();assert.equal(dialog.style.display,'none');
 dialog.innerHTML='<b>Grandpa Wren</b><p>A new unrelated conversation.</p><button id="dlgBtn">Continue</button>';dialog.style.display='block';
 assert.equal(dialog.dataset.wildTaming,f.member.runId,'the reused dialogue retains the stale ownership marker');assert.equal(dialog.querySelector('#wTameHome,#wTameRetry'),null);
 const text=dialog.innerHTML;helperDone(f);
 assert.equal(dialog.innerHTML,text);assert.equal(dialog.style.display,'block','only a currently owned live wild choice may be closed');assert(f.$('dlgBtn'));assert.equal(f.trace.confirm.length,1);assert.equal(f.save.stats.coopTames,1);
});

test('a saved remote finisher closes this encounter’s still-live wild choice',()=>{
 const f=fixture({herdId:'coyote'});cooperativeReady(f);f.use();assert(f.$('dlg').querySelector('#wTameHome'));
 helperDone(f);assert.equal(f.$('dlg').style.display,'none');assert.equal(f.trace.confirm.length,1);
});
