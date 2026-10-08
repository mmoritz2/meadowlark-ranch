// Exercise the actual acquisition helpers with a disposable game host. No
// browser, downloaded models, player save or broker connection is used here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EXPANSION_HORSE_BREEDS as ROWS,EXPANSION_HORSE_DETAILS as DETAILS} from '../assets/expansion-horses.js';
import {install} from '../assets/features/expansion-horses.js';
const copy=v=>JSON.parse(JSON.stringify(v)),KEYS=ROWS.map(b=>b[0]),STATS=['speed','stamina','jump','accel','agility'];
const game=fs.readFileSync(new URL('../ranch3d.html',import.meta.url),'utf8');
const extract=(a,b)=>{const from=game.indexOf(a),to=game.indexOf(b,from+a.length);assert(from>=0&&to>from,'production helper boundaries exist');return game.slice(from,to);};
const grantSource=extract('function grantHorse(s,breedKey,opts){','function makeFoal(s,a,b,opts){');
const foalSource=extract('function makeFoal(s,a,b,opts){','const SHOP_TABS=');
const ceilSource=extract('function statCeil(h,k){','function statNeed(v){');
const TIER_BASE={Common:3,Uncommon:4,Rare:5,Epic:6,Legendary:7,Draft:4,Mythic:8};
function client(seed={}){
 let save={nextId:1,horses:[],...copy(seed)};
 const hooks={},ensures=[],horseEnsures=[],aliases=[],sources=[],sections=[],geneticCalls=[];
 const roster={COATS3:{},BREED_PERKS:{},FANTASY_CEIL:{},tameHex:h=>h};
 const G={tables:{BREEDS3:[['bay','Bay','Common',90,0,'#774422','#221100',{}]],BREED_CEIL:{bay:{speed:7,stamina:6,jump:5,accel:6,agility:5}}},
  on(k,fn){(hooks[k]||=[]).push(fn);},run(k,...args){for(const fn of hooks[k]||[])fn(...args);},
  save:{ensure:fn=>ensures.push(fn),ensureHorse:fn=>horseEnsures.push(fn),fresh:()=>copy(save),sync:fn=>{const next=copy(save);ensures.forEach(f=>f(next));fn(next);save=next;}},
  horse:{roster,breedModels:{alias:(...args)=>aliases.push(args)},sourceRule:fn=>sources.push(fn)},
  ui:{section:(...args)=>sections.push(args)},
 };
 G.horse.registerBreed=row=>{const old=G.tables.BREEDS3.find(b=>b[0]===row[0]);if(old)return old;G.tables.BREEDS3.push(row);return row;};
 // The earlier roster acquisition hook may choose any named coat or add white
 // markings. Expansion defaults must run after it and respect explicit options.
 G.on('grantHorse',(s,h,opts={})=>{
  if(!KEYS.includes(h.breed))return;
  if(!opts.colors){
   const coat=roster.COATS3[h.breed]?.[1];
   if(coat){h.variant=coat[0];h.colors={body:coat[2],mane:coat[3]};h.mark=coat[4]||'none';if(coat[5])h.markCol=coat[5];else delete h.markCol;}
   else {h.colors={body:'#abcdef',mane:'#fedcba'};h.mark='pinto';h.markCol='#eeeeee';}
  }
  h.mark2='blaze';
 });
 const ensureStats=h=>{h.stats??={};h.sxp??={};h.gear??={};for(const f of horseEnsures)f(h);return h;};
 G.horse.grantHorse=Function('BREEDS3','TIER_BASE','NAMES3','ensureStats','ensureTurnout','G',grantSource+';return grantHorse;')(G.tables.BREEDS3,TIER_BASE,['Juniper'],ensureStats,()=>{},G);
 const blendHex=(a,b)=>a===b?a:'#776655',inheritMark=(a,b)=>({mark:a.mark||b.mark||undefined,col:a.markCol||b.markCol});
 G.horse.makeFoal=Function('NAMES3','ensureStats','blendHex','inheritMark','G',foalSource+';return makeFoal;')(['Clover'],ensureStats,blendHex,inheritMark,G);
 G.xp={statCeil:Function('BREED_CEIL','BREEDS3','TIER_BASE',ceilSource+';return statCeil;')(G.tables.BREED_CEIL,G.tables.BREEDS3,TIER_BASE)};
 install(G);
 // The real breeding feature installs after expansion-horses, before boot. Its
 // real foal colors must survive the expansion's deferred post-breeding hook.
 G.breeding={BREED_GENES:{bay:{E:'Ee',A:'Aa'}}};
 G.on('foal',(s,h,a,b,opts)=>{
  geneticCalls.push({h,opts});
  if(ROWS.find(r=>r[0]===h.breed)?.[7].family==='horse'){
   h.colors={body:'#b98a65',mane:'#eadbc1'};delete h.mark;delete h.markCol;h.variant=null;h.genes={E:['e','e'],A:['A','a']};h.coatHow='genes';
  }else if(opts?.pot?.includes('mirror')){
   const parent=opts.mirror==='b'?b:a;h.colors={...parent.colors};h.mark=parent.mark;h.markCol=parent.markCol;h.mark2=parent.mark2;h.variant=parent.variant;h.coat=parent.coat;h.coatHow='mirror';
  }
 });
 const boot=()=>G.run('boot');boot();
 return {G,hooks,ensures,horseEnsures,aliases,sources,sections,geneticCalls,boot,get save(){return save;},migrate(){ensures.forEach(f=>f(save));},grant:(id,opts)=>G.horse.grantHorse(save,id,opts),foal:(a,b,opts)=>G.horse.makeFoal(save,a,b,opts)};
}
test('six catalog entries have complete native shape, coin-shop and stat definitions',()=>{
 assert.equal(ROWS.length,6);assert.equal(new Set(KEYS).size,6);
 assert.deepEqual(KEYS,['dutchwarmblood','tennesseewalker','dales','belgian','seaglass','starweave']);
 for(const row of ROWS){
  const [id,name,rarity,coins,gems,body,mane,flags]=row,detail=DETAILS[id];
  assert(name&&rarity&&flags.description&&flags.coatLabel&&detail.strength);assert(Number.isInteger(coins)&&coins>0);assert.equal(gems,0);assert.equal(flags.src,'shop');
  assert(['thoro','morgan','iceland','percheron','palomino','lipiz'].includes(flags.body));assert.match(body,/^#[a-f0-9]{6}$/i);assert.match(mane,/^#[a-f0-9]{6}$/i);
  assert.deepEqual(Object.keys(detail.stats).sort(),STATS.slice().sort());for(const n of Object.values(detail.stats))assert(Number.isInteger(n)&&n>=1&&n<=10);
  assert.equal(detail.description,flags.description);
  if(flags.family==='horse'){assert(detail.coats.length>=3);assert(detail.genes);assert.equal(new Set(detail.coats.map(c=>c[0])).size,detail.coats.length);}
  else {assert(flags.coat);assert.equal(flags.glow,true);}
 }
});
test('registration installs each breed once, preserves native aliases and uses real per-stat ceilings',()=>{
 const c=client();
 for(const row of ROWS){
  const id=row[0];assert.equal(c.G.tables.BREEDS3.filter(b=>b[0]===id).length,1);
  assert(c.aliases.some(a=>a[0]===id&&a[1]===row[7].body));assert.deepEqual(c.G.tables.BREED_CEIL[id],DETAILS[id].stats);
  for(const stat of STATS)assert.equal(c.G.xp.statCeil({breed:id,level:50},stat),DETAILS[id].stats[stat]);
  assert.deepEqual(c.G.horse.roster.BREED_PERKS[id],DETAILS[id].perks);
  if(row[7].family==='fantasy')assert.deepEqual(c.G.horse.roster.FANTASY_CEIL[id],DETAILS[id].stats);
 }
 assert.equal(c.G.xp.statCeil({breed:'bay'},'jump'),5);assert.equal(c.G.expansionHorses.source,'shop');assert.equal(c.G.expansionHorses.currency,'coins');
});
test('natural coat variants and genetics register without replacing unrelated breed tables',()=>{
 const c=client();assert.deepEqual(c.G.breeding.BREED_GENES.bay,{E:'Ee',A:'Aa'});
 for(const row of ROWS.filter(r=>r[7].family==='horse')){
  const id=row[0];assert.deepEqual(c.G.horse.roster.COATS3[id],DETAILS[id].coats);assert.deepEqual(c.G.breeding.BREED_GENES[id],DETAILS[id].genes);
  assert.notStrictEqual(c.G.horse.roster.COATS3[id],DETAILS[id].coats);
 }
});
test('new horses remain direct coin purchases and do not leak into randomized acquisition pools',()=>{
 const c=client();assert.equal(c.sources.length,1);
 for(const row of ROWS){
  assert.equal(c.sources[0]('market',row),false);assert.equal(c.sources[0]('summon',row),false);assert.equal(c.sources[0]('shop',row),undefined);
  assert.equal(c.G.tables.BREEDS3.find(b=>b[0]===row[0])[7].src,'shop');
 }
 assert.equal(c.sources[0]('market',c.G.tables.BREEDS3[0]),undefined);assert.equal(c.sources[0]('summon',null),undefined);
});
test('natural grants preserve the named coat chosen by the preceding roster hook',()=>{
 const c=client();
 for(const row of ROWS.filter(r=>r[7].family==='horse')){
  const coat=DETAILS[row[0]].coats[1],h=c.grant(row[0]);
  assert.equal(h.breed,row[0]);assert.equal(h.variant,coat[0]);assert.deepEqual(h.colors,{body:coat[2],mane:coat[3]});assert.equal(h.mark,coat[4]||'none');
  assert.equal(h.foal,false);assert.equal(h.level,1);assert.equal(h.bond,10);
 }
 assert.equal(c.save.horses.length,4);
});
test('fantasy arrivals retain their full signature after a preceding random appearance roll',()=>{
 const c=client();
 for(const row of ROWS.filter(r=>r[7].family==='fantasy')){
  const h=c.grant(row[0]);assert.deepEqual(h.colors,{body:row[5],mane:row[6]});assert.equal(h.coat,row[7].coat);assert.equal(h.mark,'none');assert.equal(h.mark2,null);assert.equal(h.variant??null,null);
  assert.equal(h.glow,true);assert.equal(h.horn,!!row[7].horn);assert.equal(h.wings,false);
 }
});
test('explicit colors and extra appearance fields win over arrival defaults and roster rolls',()=>{
 const c=client(),colors={body:'#113355',mane:'#7799bb'};
 for(const id of KEYS){
  const opts={name:'Custom rider choice',colors,extra:{mark:'pinto',markCol:'#aaccdd',mark2:'socks',variant:'custom-variant',coat:null}},before=copy(opts),h=c.grant(id,opts);
  assert.deepEqual(h.colors,colors,id);assert.equal(h.mark,'pinto',id);assert.equal(h.markCol,'#aaccdd',id);assert.equal(h.mark2,'socks',id);assert.equal(h.variant,'custom-variant',id);assert.equal(h.coat,null,id);assert.equal(h.name,opts.name);assert.deepEqual(opts,before);
 }
 const extraColors={body:'#246810',mane:'#135790'},h=c.grant('seaglass',{colors,extra:{colors:extraColors,mark:'dapple',mark2:null}});
 assert.deepEqual(h.colors,extraColors);assert.equal(h.mark,'dapple');assert.equal(h.mark2,null);
 const extraOnly=c.grant('starweave',{extra:{colors:extraColors,mark:'none',markCol:null,mark2:null,coat:null,variant:null}});
 assert.deepEqual(extraOnly.colors,extraColors);assert.equal(extraOnly.coat,null);assert.equal(extraOnly.markCol,null);
});
test('real foals retain inherited genetic colors and stats through the actual foal helper',()=>{
 const c=client();
 for(const row of ROWS.filter(r=>r[7].family==='horse')){
  const a=c.grant(row[0],{name:'Sire',colors:{body:'#553311',mane:'#221100'}}),b=c.grant(row[0],{name:'Dam',colors:{body:'#aa8866',mane:'#ddddaa'}}),parents=copy([a,b]);
  const stats={speed:4,stamina:5,jump:4,accel:3,agility:5},h=c.foal(a,b,{name:'Inherited coat',stats});
  assert.deepEqual(h.colors,{body:'#b98a65',mane:'#eadbc1'});assert.deepEqual(h.genes,{E:['e','e'],A:['A','a']});assert.equal(h.coatHow,'genes');assert.equal(h.mark,'none');assert.deepEqual(h.stats,stats);
  assert.equal(h.foal,true);assert.equal(h.lineage.sire,a.id);assert.equal(h.lineage.dam,b.id);assert.deepEqual([a,b],parents);
 }
});
test('fantasy foals get their own signature unless a mirror potion selected a parent look',()=>{
 const c=client();
 for(const row of ROWS.filter(r=>r[7].family==='fantasy')){
  const a=c.grant(row[0],{colors:{body:'#123456',mane:'#abcdef'},extra:{mark:'pinto',markCol:'#eeeeaa',mark2:'blaze',variant:'parent-dye'}}),b=c.grant(row[0],{colors:{body:'#654321',mane:'#fedcba'},extra:{mark:'dapple',markCol:'#aabbcc',mark2:'socks',variant:'parent-dye-b'}});
  const plain=c.foal(a,b);assert.deepEqual(plain.colors,{body:row[5],mane:row[6]});assert.equal(plain.coat,row[7].coat);assert.equal(plain.mark,'none');assert.equal(plain.mark2,null);
  const mirror=c.foal(a,b,{pot:['mirror'],mirror:'b'});assert.deepEqual(mirror.colors,b.colors);assert.equal(mirror.mark,b.mark);assert.equal(mirror.markCol,b.markCol);assert.equal(mirror.mark2,b.mark2);assert.equal(mirror.variant,b.variant);assert.equal(mirror.coatHow,'mirror');
 }
});
test('migration preserves existing dyes, genetics, explicit no-coat values and unrelated horses',()=>{
 const legacy={id:50,breed:'seaglass',colors:{body:'#104060',mane:'#204080'},coat:null,mark:'pinto',markCol:'#eeeeee',mark2:'socks',variant:'player-created',genes:{E:['e','e']},stats:{speed:2},name:'Old friend'};
 const original={id:51,breed:'bay',colors:{body:'#663311',mane:'#111111'},mark:'dapple',coat:null,stats:{speed:3}},c=client({horses:[legacy,original],nextId:52});
 c.migrate();c.migrate();assert.deepEqual(c.save.horses,[legacy,original]);
});
test('migration fills genuinely missing coat fields without replacing a saved partial color choice',()=>{
 const c=client({horses:ROWS.map((r,i)=>({id:i+1,breed:r[0],colors:{mane:'#102030'}}))});c.migrate();
 for(const h of c.save.horses){
  const row=ROWS.find(r=>r[0]===h.breed);assert.equal(h.colors.body,row[5]);assert.equal(h.colors.mane,'#102030');assert.equal(h.coat,row[7].coat||null);assert.equal(h.mark2,null);
  if(!h.coat)assert.equal(h.mark,row[7].mark||'none');
 }
 const once=copy(c.save);c.migrate();assert.deepEqual(c.save,once);
});
test('repeated install and boot do not add duplicate rows, source rules or acquisition hooks',()=>{
 const c=client(),snapshot=()=>({rows:c.G.tables.BREEDS3.length,aliases:c.aliases.length,rules:c.sources.length,ensures:c.ensures.length,horseEnsures:c.horseEnsures.length,hooks:Object.fromEntries(Object.entries(c.hooks).map(([k,v])=>[k,v.length]))}),before=snapshot();
 install(c.G);c.boot();c.boot();assert.deepEqual(snapshot(),before);
 c.grant('starweave');assert.equal(c.save.horses.length,1);assert.equal(c.save.nextId,2);
});
