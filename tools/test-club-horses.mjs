// Real club feature and acquisition helper; disposable saves, no network or browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {install} from '../assets/features/clubs-boards.js';
import {EMBER_FRIESIAN_BREED,CLUB_HORSE_BREEDS,CLUB_HORSE_REWARDS} from '../assets/club-horses.js';

const copy=v=>JSON.parse(JSON.stringify(v)),noop=()=>{},checks=[];
const game=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
const grantSource=game.slice(game.indexOf('function grantHorse(s,breedKey,opts){'),game.indexOf('function makeFoal(s,a,b,opts){'));
assert(grantSource.includes("G.run('grantHorse',s,h,opts)"));
globalThis.document={createElement:()=>({}),head:{appendChild:noop}};
const check=(name,fn)=>{fn();checks.push(name);console.log('PASS '+name);};

function client(initial={},options={}){
 let data={horses:[],nextId:1,clubHorseVoucher:1,ridingClub:'',club:'meadowlark-commons',...copy(initial)};
 const hooks={},ensures=[],toasts=[],sourceRules=[],tabs=[],actions={},achievements=[],aliases=[];let reloads=0,writes=0;
 const G={$:()=>null,toast:t=>toasts.push(t),sNeigh:noop,on:(k,f)=>(hooks[k]||=[]).push(f),run(k,...args){for(const fn of hooks[k]||[])fn(...args);},
  save:{ensure(fn){ensures.push(fn);fn(data);},fresh:()=>copy(data),sync(fn){
   // Match production syncSave: its write is atomic and it catches storage/grant errors.
   try{const draft=copy(data);ensures.forEach(e=>e(draft));fn(draft);if(options.failWrite)throw Error('Storage quota');data=draft;writes++;}catch{}
  }},
  time:{isoWeekKey:()=> '2026-10-05',weekKey:()=> '2026-10-05'},money:{rewardLabel:()=> 'Reward'},
  tables:{BREEDS3:[['bay','Bay','Common',0,0,'#aa7755','#442211',{}]]},
  net:{net:{id:'tester',club:'meadowlark-commons',client:{connected:false}},myName:()=> 'Tester',subscribe:noop,publish(){throw Error('No network allowed in this test');}},
  ui:{onlineSection:noop,action:(name,fn)=>actions[name]=fn,lbTab:t=>tabs.push(t),renderLB:noop,rerender:noop},
  quest:{addAch:a=>achievements.push(a)},
  horse:{sourceRule:fn=>sourceRules.push(fn),breedModels:{alias:(...args)=>aliases.push(args)},reloadHorses:()=>reloads++},
 };
 G.horse.grantHorse=Function('BREEDS3','TIER_BASE','NAMES3','ensureStats','ensureTurnout','G',grantSource+';return grantHorse;')(
  G.tables.BREEDS3,{Common:3,Legendary:7,Mythic:8},['Willow'],noop,noop,G);
 install(G);
 return {G,options,sourceRules,tabs,actions,achievements,aliases,toasts,data:()=>copy(data),reloads:()=>reloads,writes:()=>writes,reload:()=>client(data)};
}

check('Four different club prizes have equal stat budgets and exclusive source metadata',()=>{
 assert.equal(CLUB_HORSE_BREEDS.length,4);assert.equal(new Set(CLUB_HORSE_REWARDS.map(h=>h.id)).size,4);
 for(const b of CLUB_HORSE_BREEDS){
  assert.equal(b[2],'Legendary');assert.equal(b[7].exclusive,'club');assert.equal(b[7].club,true);assert.equal(b[7].src,'club');assert.equal(b[7].family,'fantasy');
  const p=CLUB_HORSE_REWARDS.find(p=>p.id===b[0]);assert(p.name&&p.description&&p.tagline&&p.strength);assert.equal(Object.values(p.stats).reduce((a,b)=>a+b,0),37);
 }
 assert.strictEqual(CLUB_HORSE_BREEDS[0],EMBER_FRIESIAN_BREED);
 assert.deepEqual(EMBER_FRIESIAN_BREED.slice(0,7),['emberfriesian','Ember Friesian','Legendary',0,0,'#1a1412','#ff7a2a']);
 assert.equal(EMBER_FRIESIAN_BREED[7].coat,'fire');assert.equal(EMBER_FRIESIAN_BREED[7].body,'black');
});
check('Registration exposes all four rewards and excludes every prize from normal pools',()=>{
 const c=client();assert.equal(c.G.clubs.CLUB_HORSE_REWARDS.length,4);assert.equal(c.G.clubs.CLUB_HORSE,'emberfriesian');
 for(const b of [...CLUB_HORSE_BREEDS,c.G.tables.BREEDS3.find(b=>b[0]==='larksong')]){
  assert.equal(c.G.tables.BREEDS3.filter(row=>row[0]===b[0]).length,1);
  for(const ctx of ['shop','market','summon','wild','season'])assert.equal(c.sourceRules[0](ctx,b),false,b[0]+' excluded from '+ctx);
 }
 assert.equal(c.sourceRules[0]('shop',c.G.tables.BREEDS3[0]),undefined);
 assert.deepEqual(c.aliases.filter(([id])=>id!=='larksong').map(([id,body])=>[id,body]),[['emberfriesian','black'],['moonveil','grey'],['stormglass','sunset'],['rosebloom','vanner']]);
});
check('Each selected prize grants its exact appearance and fixed stats for one token',()=>{
 for(const prize of CLUB_HORSE_REWARDS){
  const c=client(),row=CLUB_HORSE_BREEDS.find(r=>r[0]===prize.id);assert.equal(c.G.clubs.claimClubHorse(prize.id),true);
  const s=c.data(),h=s.horses[0];assert.equal(s.clubHorseVoucher,0);assert.equal(s.horses.length,1);assert.equal(h.breed,prize.id);
  assert.deepEqual(h.stats,prize.stats);assert.deepEqual(h.colors,{body:row[5],mane:row[6]});assert.equal(h.coat,row[7].coat);assert.equal(h.bond,25);assert.equal(h.src,'club');assert.equal(c.reloads(),1);
  assert(c.toasts.some(t=>t.includes(prize.name)&&t.includes('walks into')));
 }
});
check('Legacy no-argument redemption and Ember achievement remain compatible',()=>{
 const c=client();assert.equal(c.G.clubs.claimClubHorse(),true);assert.equal(c.data().horses[0].breed,'emberfriesian');
 assert.deepEqual(c.data().horses[0].stats,{speed:9,stamina:8,jump:6,accel:9,agility:5});
 const a=c.achievements.find(a=>a.id==='clubhorse');assert.equal(a.v(c.data()),1);assert.deepEqual(a.r,{g:5});
 const other=client();other.G.clubs.claimClubHorse('moonveil');assert.equal(a.v(other.data()),0);
});
check('Invalid selection and missing or malformed tokens never spend or grant',()=>{
 for(const key of ['unknown','larksong','bay','__proto__',null,{},42]){const c=client(),before=c.data();assert.equal(c.G.clubs.claimClubHorse(key),false);assert.deepEqual(c.data(),before);assert.equal(c.reloads(),0);}
 for(const token of [0,-1,0.5,'1']){const c=client({clubHorseVoucher:token}),before=c.data();assert.equal(c.G.clubs.claimClubHorse('stormglass'),false);assert.deepEqual(c.data(),before);}
});
check('Repeated clicks and reload cannot spend a one-token save twice',()=>{
 const c=client();assert.equal(c.G.clubs.claimClubHorse('rosebloom'),true);assert.equal(c.G.clubs.claimClubHorse('moonveil'),false);
 const r=c.reload();assert.equal(r.G.clubs.claimClubHorse('stormglass'),false);assert.equal(r.data().horses.length,1);assert.equal(r.data().horses[0].breed,'rosebloom');assert.equal(r.data().clubHorseVoucher,0);
});
check('Collection choices preserve existing horses and spend only one token each',()=>{
 const veteran={id:40,name:'Old Friend',breed:'emberfriesian',colors:{body:'#443322',mane:'#aaaaff'},coat:null,stats:{speed:9,stamina:8,jump:6,accel:9,agility:5}};
 const c=client({nextId:41,horses:[veteran],clubHorseVoucher:3});for(const id of ['moonveil','stormglass','rosebloom'])assert.equal(c.G.clubs.claimClubHorse(id),true);
 assert.deepEqual(c.data().horses[0],veteran);assert.equal(c.data().horses.length,4);assert.equal(c.data().clubHorseVoucher,0);
});
check('Storage failure reports failure with both horse and token unchanged; retry works',()=>{
 const c=client({}, {failWrite:true}),before=c.data();assert.equal(c.G.clubs.claimClubHorse('moonveil'),false);assert.deepEqual(c.data(),before);assert.equal(c.reloads(),0);assert(!c.toasts.some(t=>t.includes('walks into')));
 c.options.failWrite=false;assert.equal(c.G.clubs.claimClubHorse('moonveil'),true);assert.equal(c.data().clubHorseVoucher,0);assert.equal(c.data().horses.length,1);
});
check('Failed and partial grant helpers never consume a token or persist partial horses',()=>{
 for(const mode of ['throw','null','wrong-breed','duplicate-id']){
  const c=client({nextId:2,horses:[{id:1,breed:'bay'}]}),before=c.data();
  c.G.horse.grantHorse=s=>{const h={id:mode==='duplicate-id'?1:s.nextId++,breed:mode==='wrong-breed'?'bay':'moonveil',name:'Partial'};s.horses.push(h);if(mode==='throw')throw Error('Grant hook failed');return mode==='null'?null:h;};
  assert.equal(c.G.clubs.claimClubHorse('moonveil'),false,mode);assert.deepEqual(c.data(),before);assert.equal(c.reloads(),0);
 }
});
check('A nested grant hook cannot recursively redeem the same token',()=>{
 const c=client();let attempts=0;c.G.on('grantHorse',()=>{attempts++;assert.equal(c.G.clubs.claimClubHorse('stormglass'),false);});
 assert.equal(c.G.clubs.claimClubHorse('moonveil'),true);assert.equal(attempts,1);assert.equal(c.data().horses.length,1);assert.equal(c.data().clubHorseVoucher,0);
});
check('Legacy board and action route show and redeem the chosen horse',()=>{
 const c=client(),html=c.tabs.find(t=>t.id==='club').render(c.data());
 for(const h of CLUB_HORSE_REWARDS){assert(html.includes(h.name));assert(html.includes('clubs:horse:'+h.id));assert(html.includes('horse='+h.id));}
 c.actions.clubs(['horse','stormglass']);assert.equal(c.data().horses[0].breed,'stormglass');
});
check('Champions eligibility and published token odds remain unchanged',()=>{
 const c=client();assert.equal(c.G.clubs.CHAMPION_MIN_SP,100);assert.equal(c.G.clubs.CHAMPION_LOOT.find(r=>r.clubHorse).p,5);
 assert.equal(c.G.clubs.championCount(50,100),1);assert.equal(c.G.clubs.championCount(51,100),0);assert.equal(c.G.clubs.championCount(1,99),0);
});
console.log(`${checks.length} club-horse checks passed. No player saves, broker calls, or screenshots written.`);
