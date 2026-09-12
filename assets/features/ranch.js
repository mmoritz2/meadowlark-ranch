/* Feature package 'ranch' — the ranch as a place you own, build and live in.
   Multiple ranches (a home switch with its own barn row, pasture and caps), land slots with
   buildings, a categorised furniture catalogue with seasonal sets, builder points that scale
   with price, a star rating with perks for the player and for stalled horses, passive stall
   bonuses, stall management (tack any horse, hitch a horse to a post, stall cards), decor
   gems that feed club points, a build mode with a meter and party eligibility, and ranch
   parties (public gated on builder points, private for friends, with a party game).
   Owned inline seams: DECOR_CAT/openBuild/placeAt (move mode, gems, snap), pastureMax,
   ranchPts/ranchMul, BARN_ROW/refreshBarn, tackLockerHtml/tackAct (tackIdx), startParty and
   the chat party payload, all exposed to this file through G.ranchSys. Nothing runs at
   import time. */
export const id='ranch';
export function install(G){
 const {THREE,scene,$,toast}=G; const T=G.tables, R=G.ranchSys, W=G.world, S=G.save, H=G.horse;
 const DC=T.DECOR_CAT, LV=T.RANCH_LEVELS;
 const {box,tube,blob}=W;
 const num=(v,d)=>{v=+v;return isFinite(v)?v:d;};

 /* ================= 1. data ================= */
 /* Two purchasable ranches beyond the family place. Each brings its own barn row (the open
    stalls), a pasture rectangle the herd grazes in, a pasture cap and a perk. */
 const RANCHES=[
  {id:'meadowlark',label:'Meadowlark Ranch',emoji:'🏡',x:0,z:5,price:0,pasture:8,barn:{x:-30.5,z0:-31.5,step:3.3,n:6},past:{x1:-110,x2:-33,z1:-45,z2:25},perk:null,
   blurb:'The family place. Grandpa Wren raised the barn; the rest is yours to build.',
   slots:[['l1',-40,56,0],['l2',-40,68,1500],['l3',-52,56,2500],['l4',-52,68,3500],['l5',-34,80,2000],['l6',-22,80,3000],['l7',-82,44,4000],['l8',-82,56,5000]]},
  {id:'loon',label:'Loon Lake Shore',emoji:'🌊',x:72,z:37,price:6000,pasture:10,barn:{x:82,z0:2,step:3.3,n:8},past:{x1:66,x2:80,z1:0,z2:32},perk:'xp',perkMul:1.10,perkText:'Horses earn 10% more XP by the water',
   blurb:'A quiet shore east of the lake: eight stalls, a bigger string, and loons at dusk.',
   slots:[['k1',76,42,2000],['k2',76,54,2500],['k3',76,66,3000],['k4',90,6,3500],['k5',31,36,2500],['k6',46,45,3000]]},
  {id:'barleyfold',label:'Barleyfold Homestead',emoji:'🌾',x:224,z:-100,price:15000,pasture:12,barn:{x:218,z0:-96,step:3.3,n:10},past:{x1:202,x2:216,z1:-92,z2:-72},perk:'decay',perkMul:0.85,perkText:'Farm grain: horses get hungry and thirsty 15% slower',
   blurb:'The big farm on the east road: ten stalls, the widest pasture in the Basin, and grain by the sack.',
   slots:[['b1',230,-106,2500],['b2',230,-94,3000],['b3',230,-82,3500],['b4',230,-70,4000],['b5',242,-106,4500],['b6',242,-94,5000],['b7',242,-82,5500],['b8',242,-70,6000]]},
 ];
 const SLOT_HALF=6;                                    // every plot is 12 m square
 const SLOTS={}; for(const r of RANCHES)for(const [sid,x,z,price] of r.slots)SLOTS[sid]={id:sid,ranch:r.id,x,z,price};
 /* What goes on a plot. cap raises the home ranch's stalls or pasture; perk feeds ranchMul. */
 const BUILDINGS={
  stable:{label:'Stable block',emoji:'🏠',price:1200,pts:120,cap:{barn:2},r:0,blurb:'Two more stalls — stalled horses gain XP here too'},
  house:{label:'Ranch house',emoji:'🏡',price:1800,pts:150,room:true,r:2.4,blurb:'A house you can furnish: indoor pieces go inside'},
  paddock:{label:'Paddock',emoji:'🌿',price:900,pts:80,cap:{pasture:2},r:0,blurb:'Turn out two more horses'},
  shed:{label:'Feed shed',emoji:'🛖',price:700,pts:60,perk:'forage',perkMul:0.9,r:1.9,blurb:'Forage grows back 10% sooner'},
  ring:{label:'Training ring',emoji:'🎯',price:1500,pts:140,perk:'xp',perkMul:1.05,r:0,blurb:'Every horse earns 5% more XP'},
  well:{label:'Stone well',emoji:'🪣',price:500,pts:50,perk:'decay',perkMul:0.95,r:0.9,blurb:'Horses get thirsty 5% slower'},
 };
 /* Matching pieces pay a bonus while all of them stand somewhere on your land. */
 const DECOR_SETS={
  winter:{label:'❄️ Winter set',pieces:['snowman','ice_lantern','sled','frost_tree'],bonus:'decay',mul:0.95,text:'hunger and thirst 5% slower'},
  harvest:{label:'🍂 Harvest set',pieces:['pumpkin_pile','scarecrow','corn_stook','harvest_wagon'],bonus:'forage',mul:0.9,text:'forage grows back 10% sooner'},
  bloom:{label:'🌸 Bloom set',pieces:['maypole','tulip_bed','butterfly_house','blossom_tree'],bonus:'board',mul:1.10,text:'boarders pay 10% more'},
  sunny:{label:'☀️ Long Sun set',pieces:['sun_umbrella','picnic_table','paddling_pool','lemonade_stand'],bonus:'xp',mul:1.05,text:'horses earn 5% more XP'},
  dragon:{label:'🐉 Dragon set',pieces:['dragon_statue','dragon_banner','ember_brazier','scale_arch'],bonus:'xp',mul:1.05,text:'horses earn 5% more XP'},
  cozy:{label:'🛋️ Cosy home set',pieces:['bed','rug','lamp','fireplace'],bonus:'stall',mul:1.10,text:'stalled horses gain 10% more'},
 };
 const CATS=[['all','🧺 All'],['yard','🪵 Yard'],['garden','🌷 Garden'],['stable','🏠 Stable'],['indoor','🛋️ Indoor'],['build','🧱 Walls & floors'],['seasonal','🍂 Seasonal'],['sets','🐉 Sets']];
 const STALL_BONUS={xpPerH:4,happyPerH:6,stamSxpPerH:2};
 const PARTY_PTS=LV[3];                                  // 320 — the free equivalent of the 4,000-point gate, a real build goal on this ladder
 const PARTY_LEN={short:90,long:180,epic:300};
 const PARTY_GAMES=[['dance','💃 Dance circle','everyone emotes together — press 1 to 5'],['hide','🙈 Hide and seek','the host counts to thirty; hide within forty strides'],['weave','🎯 Lantern weave','weave the lantern posts without touching one'],['photo','📸 Photo parade','line up by the banner for a group shot']];
 const RANCH_STAR_RULES=[
  ['6 kinds of piece placed',s=>uniqueDecorTypes(s)>=6],
  ['12 kinds of piece placed',s=>uniqueDecorTypes(s)>=12],
  ['a completed decor set',s=>setsDone(s).length>=1],
  ['a building on your land',s=>buildingCount(s)>=1],
 ];
 const RANCH_STALL_PERKS={1:'Stalled horses gain XP, stamina and cheer while you ride',2:'Stall gains +10%',3:'Stall gains +20%',4:'Stall gains +30%',5:'Stall gains +40%',6:'Stall gains +50%'};

 /* ================= 2. save shape ================= */
 S.ensure(s=>{
  s.ranches=s.ranches||{owned:['meadowlark'],home:'meadowlark'};
  if(!Array.isArray(s.ranches.owned)||!s.ranches.owned.length)s.ranches.owned=['meadowlark'];
  if(!s.ranches.owned.includes('meadowlark'))s.ranches.owned.unshift('meadowlark');
  if(!RANCHES.some(r=>r.id===s.ranches.home)||!s.ranches.owned.includes(s.ranches.home))s.ranches.home='meadowlark';
  s.land=s.land||{owned:['l1'],b:{}}; s.land.owned=s.land.owned||['l1']; if(!s.land.owned.includes('l1'))s.land.owned.push('l1'); s.land.b=s.land.b||{};
  if(!s.stallLast)s.stallLast=Date.now();
 });
 S.ensureHorse(h=>{if(h.hitch===undefined)h.hitch=null;});

 /* ================= 3. the catalogue ================= */
 const cat0={haybale:'stable',trough:'stable',barrel:'stable',boulder:'yard',stump:'yard',fence:'yard',post:'stable',planter:'garden',lantern:'yard',bench:'yard',stand:'stable',sapling:'garden',sign:'yard',stall:'stable'};
 for(const k in cat0)if(DC[k]&&!DC[k].cat)DC[k].cat=cat0[k];
 if(DC.fence)DC.fence.snap=true;
 const W1='#efe6d2',WD='#5a3d22',WL='#8a6745',IR='#3a3430';
 const NEW={
  /* walls, floors and doorways: build rooms anywhere (walls snap end to end) */
  wall:{label:'Wall',emoji:'🧱',price:45,cat:'build',r:0.3,len:3,snap:true,mk:g=>{box(3,2.4,0.16,W1,0,1.2,0,g);box(3.04,0.1,0.22,WD,0,2.42,0,g);box(3.04,0.12,0.22,WD,0,0.06,0,g);}},
  door:{label:'Doorway',emoji:'🚪',price:70,cat:'build',r:0.3,len:3,snap:true,mk:g=>{for(const x of[-1.5+0.5,1.5-0.5])box(1,2.4,0.16,W1,x,1.2,0,g);box(1.1,0.5,0.16,W1,0,2.15,0,g);box(3.04,0.1,0.22,WD,0,2.42,0,g);box(0.9,1.85,0.06,WL,0,0.93,0.04,g);}},
  floor:{label:'Floor tile',emoji:'🟫',price:30,cat:'build',r:0.9,flat:true,mk:g=>{box(2,0.06,2,'#c9a273',0,0.03,0,g);box(1.9,0.07,0.04,WD,0,0.03,0,g);box(0.04,0.07,1.9,WD,0,0.03,0,g);}},
  /* garden */
  flower_arch:{label:'Flower arch',emoji:'🌹',price:220,cat:'garden',r:0.5,mk:g=>{for(const x of[-1,1])tube(0.06,0.07,2.4,W1,x,1.2,0,g);box(2.2,0.12,0.12,W1,0,2.45,0,g);[[-0.8,2.5,'#ff8fab'],[0,2.6,'#f4c2c2'],[0.8,2.5,'#ff8fab'],[-1,1.4,'#5d9e4f'],[1,1.6,'#5d9e4f']].forEach(([x,y,c])=>blob(0.3,0.26,0.3,c,x,y,0,g));}},
  birdbath:{label:'Bird bath',emoji:'🐦',price:140,cat:'garden',r:0.5,mk:g=>{tube(0.12,0.22,0.9,'#c9c2b4',0,0.45,0,g);tube(0.5,0.42,0.14,'#c9c2b4',0,0.95,0,g);tube(0.44,0.44,0.02,'#8fc7e6',0,1.03,0,g);blob(0.08,0.07,0.1,'#6b4a2e',0.2,1.1,0,g);}},
  hedge:{label:'Hedge',emoji:'🌿',price:55,cat:'garden',r:0.4,len:2.4,snap:true,mk:g=>{box(2.4,0.9,0.6,'#4f8a3e',0,0.45,0,g);box(2.3,0.2,0.5,'#5d9e4f',0,0.98,0,g);}},
  fountain:{label:'Stone fountain',emoji:'⛲',gems:5,cat:'garden',r:1.2,mk:g=>{tube(1.3,1.4,0.4,'#c9c2b4',0,0.2,0,g);tube(1.1,1.1,0.04,'#8fc7e6',0,0.42,0,g);tube(0.12,0.2,1.2,'#c9c2b4',0,0.9,0,g);tube(0.5,0.4,0.1,'#c9c2b4',0,1.5,0,g);blob(0.14,0.4,0.14,'#bfe8ff',0,1.8,0,g);}},
  pond:{label:'Garden pond',emoji:'💧',price:260,cat:'garden',r:1.4,flat:true,mk:g=>{tube(1.5,1.6,0.08,'#8a7a62',0,0.04,0,g);tube(1.35,1.35,0.05,'#79b8d6',0,0.09,0,g);blob(0.3,0.05,0.3,'#5d9e4f',0.5,0.13,0.3,g);blob(0.1,0.06,0.1,'#ff8fab',0.5,0.17,0.3,g);}},
  maypole:{label:'Maypole',emoji:'🎀',price:180,cat:'seasonal',season:'bloom',set:'bloom',r:0.4,mk:g=>{tube(0.07,0.09,4,W1,0,2,0,g);blob(0.3,0.3,0.3,'#ff8fab',0,4.1,0,g);['#ff8fab','#ffd166','#8fc7e6','#b197fc'].forEach((c,i)=>{const a=i*Math.PI/2;const m=box(0.05,3.4,0.02,c,Math.sin(a)*0.5,2.2,Math.cos(a)*0.5,g);m.rotation.z=Math.sin(a)*0.28;m.rotation.x=-Math.cos(a)*0.28;});}},
  tulip_bed:{label:'Tulip bed',emoji:'🌷',price:95,cat:'seasonal',season:'bloom',set:'bloom',r:0.8,flat:true,mk:g=>{box(1.8,0.12,1.0,'#5a3d22',0,0.06,0,g);for(let i=0;i<8;i++){const x=-0.7+(i%4)*0.47,z=i<4?-0.25:0.25;tube(0.02,0.02,0.35,'#5d9e4f',x,0.3,z,g);blob(0.09,0.12,0.09,['#e63946','#ffd166','#ff8fab','#b197fc'][i%4],x,0.5,z,g);}}},
  butterfly_house:{label:'Butterfly house',emoji:'🦋',price:130,cat:'seasonal',season:'bloom',set:'bloom',r:0.3,mk:g=>{tube(0.05,0.06,1.4,WD,0,0.7,0,g);box(0.4,0.6,0.25,'#f4c2c2',0,1.6,0,g);box(0.5,0.1,0.35,WD,0,1.95,0,g);blob(0.12,0.04,0.16,'#ffd166',0.22,1.7,0.14,g);}},
  blossom_tree:{label:'Blossom tree',emoji:'🌸',gems:3,cat:'seasonal',season:'bloom',set:'bloom',r:0.9,mk:g=>{tube(0.14,0.2,2,'#6b4a2e',0,1,0,g);blob(1.3,1.0,1.3,'#f4b6cf',0,2.4,0,g);blob(0.9,0.8,0.9,'#f9d0e0',0.4,2.9,0.2,g);blob(0.7,0.6,0.7,'#f4b6cf',-0.5,2.8,-0.3,g);}},
  /* stable yard */
  wash_rack:{label:'Wash rack',emoji:'🚿',price:300,cat:'stable',r:1.1,mk:g=>{box(2.4,0.1,2.4,'#b9b2a4',0,0.05,0,g);for(const x of[-1.1,1.1])tube(0.06,0.06,2.2,IR,x,1.1,-1.1,g);box(2.3,0.08,0.08,IR,0,2.2,-1.1,g);tube(0.04,0.04,0.9,IR,0.9,1.9,-0.7,g);blob(0.14,0.1,0.14,'#8fc7e6',0.9,1.42,-0.3,g);}},
  muck_cart:{label:'Muck cart',emoji:'🛒',price:120,cat:'stable',r:0.6,mk:g=>{box(1.1,0.5,0.7,WL,0,0.55,0,g);for(const x of[-0.4,0.4]){const w=tube(0.28,0.28,0.08,IR,x,0.3,0.36,g);w.rotation.x=Math.PI/2;}box(0.9,0.06,0.06,WD,0.9,0.75,0,g);blob(0.45,0.25,0.3,'#b58a4a',0,0.9,0,g);}},
  feed_bin:{label:'Feed bin',emoji:'🥣',price:110,cat:'stable',r:0.5,mk:g=>{box(1.0,0.8,0.7,'#6b7a86',0,0.4,0,g);const l=box(1.04,0.08,0.74,'#4c5964',0,0.86,-0.1,g);l.rotation.x=-0.25;blob(0.4,0.12,0.3,'#d9b56a',0,0.84,0.12,g);}},
  tack_hook:{label:'Tack hooks',emoji:'🪝',price:60,cat:'stable',r:0.3,mk:g=>{box(1.2,0.16,0.08,WD,0,1.6,0,g);for(const x of[-0.4,0,0.4]){tube(0.02,0.02,0.2,IR,x,1.48,0.06,g);}blob(0.16,0.3,0.06,'#6b4423',-0.4,1.3,0.06,g);blob(0.12,0.24,0.06,'#2e86c1',0.4,1.32,0.06,g);}},
  shelter:{label:'Field shelter',emoji:'⛺',price:900,cat:'stable',r:2.4,mk:g=>{box(4,0.12,3,'#a88a5a',0,0.06,0,g);box(4,2.2,0.14,W1,0,1.1,-1.45,g);for(const x of[-1.95,1.95])box(0.14,2.2,3,W1,x,1.1,0,g);const r=box(4.4,0.14,3.6,'#7a5236',0,2.35,0.1,g);r.rotation.x=0.12;blob(0.7,0.35,0.5,'#d9b56a',-1,0.35,-0.6,g);}},
  /* indoors — goes inside a ranch house */
  bed:{label:'Bed',emoji:'🛏️',price:150,cat:'indoor',set:'cozy',r:0.9,mk:g=>{box(2,0.3,1.3,WL,0,0.35,0,g);box(1.9,0.22,1.2,'#f6f1e7',0,0.6,0,g);box(1.9,0.14,0.9,'#c85c5c',0,0.72,0.1,g);box(0.7,0.14,0.36,'#fff',0,0.75,-0.4,g);box(2,0.9,0.1,WD,0,0.55,-0.65,g);}},
  table:{label:'Kitchen table',emoji:'🍽️',price:120,cat:'indoor',r:0.8,mk:g=>{box(1.6,0.08,0.9,WL,0,0.78,0,g);for(const x of[-0.7,0.7])for(const z of[-0.35,0.35])box(0.08,0.75,0.08,WD,x,0.37,z,g);blob(0.16,0.12,0.16,'#ffd166',0.3,0.88,0,g);}},
  chair:{label:'Chair',emoji:'🪑',price:60,cat:'indoor',r:0.35,mk:g=>{box(0.45,0.06,0.45,WL,0,0.45,0,g);box(0.45,0.5,0.06,WL,0,0.72,-0.2,g);for(const x of[-0.18,0.18])for(const z of[-0.18,0.18])box(0.05,0.44,0.05,WD,x,0.22,z,g);}},
  rug:{label:'Woven rug',emoji:'🧶',price:80,cat:'indoor',set:'cozy',r:1.0,flat:true,mk:g=>{box(2.2,0.04,1.5,'#b5533c',0,0.02,0,g);box(1.8,0.05,1.1,'#e6b85c',0,0.02,0,g);box(1.0,0.06,0.5,'#b5533c',0,0.02,0,g);}},
  shelf:{label:'Bookshelf',emoji:'📚',price:110,cat:'indoor',r:0.5,mk:g=>{box(1.2,1.8,0.35,WL,0,0.9,0,g);for(const y of[0.45,0.9,1.35])box(1.1,0.04,0.3,WD,0,y,0,g);['#e63946','#2e86c1','#ffd166','#5d9e4f','#b197fc'].forEach((c,i)=>box(0.14,0.34,0.24,c,-0.45+i*0.2,0.65+(i%2)*0.45,0,g));}},
  lamp:{label:'Oil lamp',emoji:'🪔',price:90,cat:'indoor',set:'cozy',r:0.3,mk:g=>{tube(0.14,0.18,0.06,IR,0,0.03,0,g);tube(0.04,0.05,1.3,IR,0,0.68,0,g);const sh=new THREE.Mesh(new THREE.ConeGeometry(0.3,0.3,10,1,true),new THREE.MeshStandardMaterial({color:0xffe1a8,emissive:0xffb347,emissiveIntensity:0.9,side:THREE.DoubleSide}));sh.position.y=1.45;g.add(sh);}},
  wardrobe:{label:'Wardrobe',emoji:'🚪',price:170,cat:'indoor',r:0.5,mk:g=>{box(1.2,2.0,0.6,WL,0,1,0,g);box(0.02,1.8,0.62,WD,0,1,0,g);for(const x of[-0.12,0.12])blob(0.04,0.04,0.04,'#d8b24a',x,1.05,0.31,g);}},
  fireplace:{label:'Fireplace',emoji:'🔥',price:260,cat:'indoor',set:'cozy',r:0.7,mk:g=>{box(1.6,1.4,0.6,'#8c8074',0,0.7,0,g);box(1.0,0.8,0.4,'#2a2420',0,0.45,0.12,g);box(1.8,0.12,0.7,WD,0,1.46,0,g);const f=new THREE.Mesh(new THREE.ConeGeometry(0.22,0.5,8),new THREE.MeshStandardMaterial({color:0xff9a3c,emissive:0xff6a00,emissiveIntensity:1.4}));f.position.set(0,0.35,0.12);g.add(f);}},
  /* seasonal — the Frost, Embers and Long Sun sets rotate with the season */
  snowman:{label:'Snowman',emoji:'⛄',gems:4,cat:'seasonal',season:'frost',set:'winter',r:0.6,mk:g=>{blob(0.6,0.55,0.6,'#fff',0,0.5,0,g);blob(0.45,0.42,0.45,'#fff',0,1.25,0,g);blob(0.32,0.3,0.32,'#fff',0,1.85,0,g);blob(0.05,0.05,0.2,'#ff7a1a',0,1.85,0.3,g);box(0.5,0.06,0.5,IR,0,2.1,0,g);box(0.3,0.25,0.3,IR,0,2.25,0,g);box(0.9,0.06,0.06,'#c85c5c',0,1.55,0,g);}},
  ice_lantern:{label:'Ice lantern',emoji:'🏮',price:120,cat:'seasonal',season:'frost',set:'winter',r:0.3,mk:g=>{const m=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.7,0.5),new THREE.MeshStandardMaterial({color:0xcfefff,emissive:0x8fd0ff,emissiveIntensity:0.6,transparent:true,opacity:0.8}));m.position.y=0.35;g.add(m);blob(0.1,0.16,0.1,'#ffd27a',0,0.35,0,g);}},
  sled:{label:'Wooden sled',emoji:'🛷',price:140,cat:'seasonal',season:'frost',set:'winter',r:0.6,mk:g=>{for(const z of[-0.3,0.3])box(1.6,0.06,0.08,IR,0,0.08,z,g);box(1.3,0.08,0.7,WL,0,0.28,0,g);for(const x of[-0.5,0,0.5])box(0.06,0.2,0.7,WD,x,0.18,0,g);box(0.2,0.3,0.5,'#c85c5c',0.55,0.45,0,g);}},
  frost_tree:{label:'Frosted fir',emoji:'🎄',gems:3,cat:'seasonal',season:'frost',set:'winter',r:0.8,mk:g=>{tube(0.1,0.14,0.8,'#6b4a2e',0,0.4,0,g);[[1.2,0.9,0.9],[0.95,1.6,0.75],[0.65,2.2,0.6]].forEach(([r,y,h])=>{const c=new THREE.Mesh(new THREE.ConeGeometry(r,h,9),new THREE.MeshStandardMaterial({color:0x3f7a4a}));c.position.y=y;g.add(c);const s=new THREE.Mesh(new THREE.ConeGeometry(r*0.7,0.12,9),new THREE.MeshStandardMaterial({color:0xf4fbff}));s.position.y=y+h*0.35;g.add(s);});blob(0.16,0.16,0.16,'#ffd166',0,2.65,0,g);}},
  pumpkin_pile:{label:'Pumpkin pile',emoji:'🎃',price:120,cat:'seasonal',season:'ember',set:'harvest',r:0.6,mk:g=>{[[0,0.28,0,0.34],[0.45,0.22,0.2,0.26],[-0.4,0.22,0.25,0.24],[0.1,0.7,0,0.24]].forEach(([x,y,z,r])=>{blob(r,r*0.8,r,'#e8871e',x,y,z,g);tube(0.03,0.04,0.12,'#5d9e4f',x,y+r*0.8,z,g);});}},
  scarecrow:{label:'Scarecrow',emoji:'🎃',price:150,cat:'seasonal',season:'ember',set:'harvest',r:0.4,mk:g=>{tube(0.05,0.06,2.2,WD,0,1.1,0,g);box(1.4,0.06,0.06,WD,0,1.7,0,g);box(0.5,0.7,0.3,'#5b7fb8',0,1.5,0,g);box(1.3,0.18,0.18,'#5b7fb8',0,1.7,0,g);blob(0.22,0.24,0.22,'#e9c98a',0,2.05,0,g);box(0.7,0.05,0.7,'#b58a4a',0,2.25,0,g);box(0.35,0.2,0.35,'#b58a4a',0,2.35,0,g);}},
  corn_stook:{label:'Corn stook',emoji:'🌽',price:90,cat:'seasonal',season:'ember',set:'harvest',r:0.5,mk:g=>{for(let i=0;i<6;i++){const a=i*Math.PI/3;const m=tube(0.06,0.09,1.5,'#d9b56a',Math.sin(a)*0.3,0.75,Math.cos(a)*0.3,g);m.rotation.z=-Math.sin(a)*0.22;m.rotation.x=Math.cos(a)*0.22;}tube(0.3,0.3,0.06,'#8a6745',0,1.1,0,g);}},
  harvest_wagon:{label:'Harvest wagon',emoji:'🚜',gems:4,cat:'seasonal',season:'ember',set:'harvest',r:1.1,mk:g=>{box(2.2,0.6,1.2,WL,0,0.7,0,g);for(const x of[-0.8,0.8])for(const z of[-0.66,0.66]){const w=tube(0.35,0.35,0.1,IR,x,0.35,z,g);w.rotation.x=Math.PI/2;}blob(1.0,0.4,0.55,'#e8871e',0,1.1,0,g);blob(0.5,0.3,0.4,'#d9b56a',0.6,1.15,0.1,g);box(1.2,0.06,0.06,WD,1.6,0.6,0,g);}},
  sun_umbrella:{label:'Sun umbrella',emoji:'⛱️',price:130,cat:'seasonal',season:'sun',set:'sunny',r:0.5,mk:g=>{tube(0.03,0.04,2.4,W1,0,1.2,0,g);const c=new THREE.Mesh(new THREE.ConeGeometry(1.3,0.5,12,1,true),new THREE.MeshStandardMaterial({color:0xffd166,side:THREE.DoubleSide}));c.position.y=2.3;g.add(c);const c2=new THREE.Mesh(new THREE.ConeGeometry(1.31,0.5,12,1,true),new THREE.MeshStandardMaterial({color:0xe63946,side:THREE.DoubleSide,transparent:true,opacity:0.5}));c2.position.y=2.31;g.add(c2);}},
  picnic_table:{label:'Picnic table',emoji:'🧺',price:160,cat:'seasonal',season:'sun',set:'sunny',r:0.9,mk:g=>{box(1.8,0.08,0.8,WL,0,0.75,0,g);for(const z of[-0.7,0.7])box(1.8,0.06,0.3,WL,0,0.45,z,g);for(const x of[-0.6,0.6]){const a=box(0.08,0.8,0.08,WD,x,0.4,-0.3,g);a.rotation.x=0.5;const b=box(0.08,0.8,0.08,WD,x,0.4,0.3,g);b.rotation.x=-0.5;}blob(0.3,0.15,0.3,'#c85c5c',0.4,0.85,0,g);}},
  paddling_pool:{label:'Paddling pool',emoji:'🏊',price:200,cat:'seasonal',season:'sun',set:'sunny',r:1.3,flat:true,mk:g=>{tube(1.4,1.5,0.35,'#8fc7e6',0,0.17,0,g);tube(1.25,1.25,0.04,'#bfe8ff',0,0.33,0,g);blob(0.3,0.12,0.3,'#ffd166',0.4,0.38,0.3,g);}},
  lemonade_stand:{label:'Lemonade stand',emoji:'🍋',gems:3,cat:'seasonal',season:'sun',set:'sunny',r:0.8,mk:g=>{box(1.6,0.9,0.6,'#ffd166',0,0.45,0,g);box(1.7,0.06,0.7,WD,0,0.93,0,g);for(const x of[-0.7,0.7])tube(0.04,0.04,1.4,WD,x,1.6,-0.25,g);box(1.7,0.4,0.06,'#e63946',0,2.2,-0.25,g);blob(0.12,0.16,0.12,'#f7e36b',-0.3,1.05,0.1,g);blob(0.12,0.16,0.12,'#f7e36b',0.2,1.05,0.1,g);}},
  /* the Dragon set — earned gems, Hollowpeak style */
  dragon_statue:{label:'Dragon statue',emoji:'🐉',gems:6,cat:'sets',set:'dragon',r:0.8,mk:g=>{box(1.2,0.3,1.2,'#6c6560',0,0.15,0,g);blob(0.5,0.35,0.9,'#3b6b5a',0,0.6,0,g);blob(0.28,0.28,0.4,'#3b6b5a',0,1.1,0.55,g);blob(0.1,0.22,0.1,'#3b6b5a',0,1.35,0.5,g);const w=blob(0.9,0.05,0.4,'#2e564a',0,0.9,-0.1,g);w.rotation.z=0.3;const t=blob(0.15,0.12,0.7,'#3b6b5a',0,0.55,-0.7,g);blob(0.06,0.06,0.06,'#ffd166',0.1,1.15,0.85,g);}},
  dragon_banner:{label:'Dragon banner',emoji:'🚩',gems:2,cat:'sets',set:'dragon',r:0.3,mk:g=>{tube(0.05,0.06,3.2,IR,0,1.6,0,g);box(1.1,1.4,0.03,'#7a1f2b',0.6,2.4,0,g);blob(0.3,0.3,0.05,'#ffd166',0.6,2.45,0.02,g);blob(0.06,0.06,0.06,'#ffd166',0,3.25,0,g);}},
  ember_brazier:{label:'Ember brazier',emoji:'🔥',gems:3,cat:'sets',set:'dragon',r:0.5,mk:g=>{for(let i=0;i<3;i++){const a=i*2.1;tube(0.03,0.04,1.0,IR,Math.sin(a)*0.25,0.5,Math.cos(a)*0.25,g);}tube(0.4,0.25,0.35,IR,0,1.1,0,g);const f=new THREE.Mesh(new THREE.ConeGeometry(0.28,0.6,8),new THREE.MeshStandardMaterial({color:0xff9a3c,emissive:0xff5a00,emissiveIntensity:1.5}));f.position.y=1.5;g.add(f);}},
  scale_arch:{label:'Scale arch',emoji:'🏛️',gems:5,cat:'sets',set:'dragon',r:0.6,mk:g=>{for(const x of[-1.2,1.2])box(0.35,2.8,0.35,'#6c6560',x,1.4,0,g);box(2.9,0.4,0.45,'#6c6560',0,2.95,0,g);for(let i=0;i<7;i++)blob(0.2,0.14,0.08,'#3b6b5a',-1.2+i*0.4,3.2,0,g);blob(0.14,0.14,0.14,'#ffd166',0,3.4,0,g);}},
 };
 for(const k in NEW)if(!DC[k])DC[k]=NEW[k];

 /* ================= 4. points, sets, stars, multipliers ================= */
 function uniqueDecorTypes(s){return new Set((s.decor||[]).map(d=>d.t)).size;}
 function setsDone(s){const have=new Set((s.decor||[]).map(d=>d.t));return Object.keys(DECOR_SETS).filter(k=>DECOR_SETS[k].pieces.every(p=>have.has(p)));}
 function decorSetsDone(s){return setsDone(s).length;}
 function setProgress(s,k){const have=new Set((s.decor||[]).map(d=>d.t));return DECOR_SETS[k].pieces.filter(p=>have.has(p)).length;}
 function homeId(s){return (s&&s.ranches&&s.ranches.home)||'meadowlark';}
 function ranchOf(idv){return RANCHES.find(r=>r.id===idv)||RANCHES[0];}
 function homeRanch(s){return ranchOf(homeId(s));}
 function ownedRanches(s){return ((s&&s.ranches&&s.ranches.owned)||['meadowlark']).map(ranchOf);}
 function buildingsOf(s,ranchId){const b=(s.land&&s.land.b)||{};return Object.keys(b).filter(sid=>SLOTS[sid]&&(!ranchId||SLOTS[sid].ranch===ranchId)).map(sid=>({sid,slot:SLOTS[sid],t:b[sid].t,def:BUILDINGS[b[sid].t]})).filter(o=>o.def);}
 function buildingCount(s){return buildingsOf(s).length;}
 function countB(s,ranchId,t){return buildingsOf(s,ranchId).filter(o=>o.t===t).length;}
 function extraPts(s){return buildingsOf(s).reduce((a,o)=>a+o.def.pts,0);}
 function ranchStars(s){let n=1;for(const [,fn] of RANCH_STAR_RULES){try{if(fn(s))n++;}catch(e){}}return Math.min(5,n);}
 function barnCap(s){return R.BARN_ROW.n+2*countB(s,homeId(s),'stable');}
 function ranchPts(s){return R.ranchPts(s);}
 /* cached for ranchMul, which runs per horse on every save pass */
 const C={stars:1,sets:[],bperks:{},home:'meadowlark'};
 function refreshCaches(s){ s=s||S.fresh(); if(!s)return; C.stars=ranchStars(s); C.sets=setsDone(s); C.home=homeId(s);
  C.bperks={}; for(const o of buildingsOf(s,C.home))if(o.def.perk){const cur=C.bperks[o.def.perk]||1; C.bperks[o.def.perk]=o.def.perk==='xp'?Math.min(cur*o.def.perkMul,1.10):Math.max(cur*o.def.perkMul,0.8);}   // two sheds help, ten do not
  R.refreshLevel(); }
 const API={
  RANCHES,SLOTS,BUILDINGS,DECOR_SETS,STALL_BONUS,PARTY_PTS,PARTY_LEN,PARTY_GAMES,RANCH_STAR_RULES,
  tackFor:null,
  pastureBase(s){return homeRanch(s).pasture+2*countB(s,homeId(s),'paddock');},
  extraPts,ranchStars,setsDone,decorSetsDone,barnCap,uniqueDecorTypes,homeRanch,homeId,ownedRanches,buildingsOf,refreshCaches,
  stars:()=>C.stars,
  mul(k,L){ let m=1; if(k==='stall')m*=1+0.10*(L-1)+0.05*(C.stars-1); else if(k==='board')m*=1+0.04*(C.stars-1);
   const hr=ranchOf(C.home); if(hr.perk===k)m*=hr.perkMul; if(C.bperks[k])m*=C.bperks[k];
   for(const sk of C.sets){const d=DECOR_SETS[sk];if(d.bonus===k)m*=d.mul;} return m; },
  canHostPublic(){const s=S.fresh();return !!s&&ranchPts(s)>=PARTY_PTS;},
  decorOk(c,x,z,skip){
   if(c.cat!=='indoor')return undefined;
   const room=roomAt(x,z); if(!room)return 'Furniture goes inside a ranch house';
   for(const o of R.decorObjs){ if(o===skip)continue; const oc=DC[o.d.t]||{r:0.3}; if(oc.flat||c.flat)continue; if(Math.hypot(o.d.x-x,o.d.z-z)<(c.r+oc.r)*0.85)return 'Overlaps another piece'; }
   return null;
  },
  snap(c,x,z,rot,moving){
   if(!c||!c.snap||!c.len)return null;
   const ends=(cx,cz,ry,L)=>[[cx+L/2*Math.cos(ry),cz-L/2*Math.sin(ry)],[cx-L/2*Math.cos(ry),cz+L/2*Math.sin(ry)]];
   const mine=ends(x,z,rot,c.len); let best=null,bd=0.6;
   for(const o of R.decorObjs){ if(o===moving)continue; const oc=DC[o.d.t]; if(!oc||!oc.snap||!oc.len)continue; if(Math.hypot(o.d.x-x,o.d.z-z)>c.len+oc.len)continue;
    for(const e of ends(o.d.x,o.d.z,o.d.ry||0,oc.len))for(const m of mine){const d=Math.hypot(e[0]-m[0],e[1]-m[1]);if(d<bd){bd=d;best=[e[0]-m[0],e[1]-m[1]];}} }
   return best?{x:x+best[0],z:z+best[1]}:null;
  },
  roomAt:(x,z)=>roomAt(x,z),
 };
 G.ranch=API;
 function roomAt(x,z){const s=S.fresh();if(!s)return null;for(const o of buildingsOf(s))if(o.def.room&&Math.abs(x-o.slot.x)<=SLOT_HALF-0.4&&Math.abs(z-o.slot.z)<=SLOT_HALF-0.4)return o;return null;}

 /* ================= 5. the world: ranches, land, buildings ================= */
 const built={};            // slotId -> {g, coll, stalls:[{x,z,ry}]}
 const markers={};          // slotId -> plane
 let yard=null;             // the paddock fence + sign at a non-home ranch
 function slotRect(sid){const s=SLOTS[sid];return {x:s.x,z:s.z,half:SLOT_HALF};}
 function rotXZ(lx,lz,ry){return [lx*Math.cos(ry)+lz*Math.sin(ry),-lx*Math.sin(ry)+lz*Math.cos(ry)];}
 function fenceRing(g,x1,z1,x2,z2,gap){const ring=[]; for(let x=x1;x<=x2+0.01;x+=gap){ring.push([x,z1]);ring.push([x,z2]);} for(let z=z1+gap;z<z2-0.01;z+=gap){ring.push([x1,z]);ring.push([x2,z]);}
  for(const [px,pz] of ring)box(0.14,1.15,0.14,'#f4f0e6',px,0.57,pz,g);
  const rail=(ax,az,bx,bz)=>{const L=Math.hypot(bx-ax,bz-az);for(const y of[0.55,0.98]){const m=box(L,0.09,0.06,'#f4f0e6',(ax+bx)/2,y,(az+bz)/2,g);m.rotation.y=Math.atan2(-(bz-az),bx-ax);}};
  rail(x1,z1,x2,z1);rail(x1,z2,x2,z2);rail(x1,z1,x1,z2);rail(x2,z1,x2,z2);}
 function buildMesh(sid,t){
  const def=BUILDINGS[t], sl=SLOTS[sid]; if(!def||!sl)return null;
  const g=new THREE.Group(); g.name='Building '+sid; const A=W.ranchArchitecture; const rec={g,coll:null,stalls:[]};
  const ry=Math.atan2(-sl.x+ranchOf(sl.ranch).x,-sl.z+ranchOf(sl.ranch).z);   // the door faces the ranch
  if(t==='stable'){ for(const lz of[-1.65,1.65]){const st=A.buildOpenStall();st.position.set(0,0,lz);g.add(st);const [wx,wz]=rotXZ(-0.1,lz,ry);rec.stalls.push({x:sl.x+wx,z:sl.z+wz,ry:ry-Math.PI/2});} }
  else if(t==='house'){ g.add(A.buildCottage({variant:Math.abs(Math.round(sl.x+sl.z))%4})); }
  else if(t==='shed'){ g.add(A.buildOutbuilding({width:3.2,depth:2.6,height:2.4,animatedDoorOpening:{width:.9,height:1.7}})); }
  else if(t==='paddock'){ fenceRing(g,-5,-5,5,5,2.5); blob(0.5,0.25,0.4,'#d9b56a',2,0.25,2,g); }
  else if(t==='ring'){ const n=14; for(let i=0;i<n;i++){const a=i/n*Math.PI*2;box(0.14,1.15,0.14,'#f4f0e6',Math.sin(a)*5,0.57,Math.cos(a)*5,g);const b=i/n*Math.PI*2,c=(i+1)/n*Math.PI*2;for(const y of[0.55,0.98]){const m=box(Math.hypot(Math.sin(c)-Math.sin(b),Math.cos(c)-Math.cos(b))*5,0.08,0.06,'#f4f0e6',Math.sin((b+c)/2)*5,y,Math.cos((b+c)/2)*5,g);m.rotation.y=-(b+c)/2;}} box(3,0.1,3,'#c9a273',0,0.05,0,g); for(const [x,z] of[[-2,0],[2,0]])tube(0.2,0.3,0.6,'#e8871e',x,0.3,z,g); }
  else if(t==='well'){ tube(0.8,0.85,0.9,'#8c8074',0,0.45,0,g); for(const x of[-0.7,0.7])box(0.12,2.0,0.12,WD,x,1.0,0,g); box(2,0.1,1.4,'#7a5236',0,2.05,0,g); box(0.06,0.06,1.2,WD,0,1.75,0,g); blob(0.25,0.2,0.25,WL,0.4,1.7,0,g); }
  g.position.set(sl.x,W.groundH(sl.x,sl.z),sl.z); g.rotation.y=ry;
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  const sp=G.nameSprite(def.emoji+' '+def.label); sp.position.y=(g.children[0]&&g.children[0].userData.architecture&&g.children[0].userData.architecture.suggestedLabelY)||3.2; g.add(sp);
  scene.add(g); W.followCamera.register(g);
  if(def.r){rec.coll={x:sl.x,z:sl.z,r:def.r,building:sid};W.colliders.push(rec.coll);}
  return rec;
 }
 function disposeBuilding(sid){const b=built[sid];if(!b)return;scene.remove(b.g);if(b.coll){const i=W.colliders.indexOf(b.coll);if(i>=0)W.colliders.splice(i,1);}delete built[sid];}
 function syncBuildings(){const s=S.fresh();if(!s)return;const want=(s.land&&s.land.b)||{};
  for(const sid in built)if(!want[sid]||want[sid].t!==built[sid].t)disposeBuilding(sid);
  for(const sid in want){if(built[sid]||!SLOTS[sid]||!BUILDINGS[want[sid].t])continue;const rec=buildMesh(sid,want[sid].t);if(rec){rec.t=want[sid].t;built[sid]=rec;}}
 }
 function landStallSpots(s){const out=[];for(const o of buildingsOf(s,homeId(s)))if(o.t==='stable'&&built[o.sid])out.push(...built[o.sid].stalls);return out;}
 /* plot markers, shown while building */
 function syncMarkers(){const s=S.fresh();if(!s)return;const owned=new Set(s.land.owned);
  for(const sid in SLOTS){const sl=SLOTS[sid]; if(!s.ranches.owned.includes(sl.ranch)){if(markers[sid]){scene.remove(markers[sid]);delete markers[sid];}continue;}
   let m=markers[sid]; if(!m){m=new THREE.Mesh(new THREE.PlaneGeometry(SLOT_HALF*2-0.4,SLOT_HALF*2-0.4),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.22,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(sl.x,W.groundH(sl.x,sl.z)+0.12,sl.z);m.visible=false;scene.add(m);markers[sid]=m;}
   const isOwned=owned.has(sid), hasB=!!(s.land.b[sid]); m.material.color.set(isOwned?0x8fd17a:0xf2c46a); m.material.opacity=hasB?0.08:0.22;
   const txt=isOwned?(hasB?'':'📍 '+sid+' · yours'):'📍 '+sid+' · '+sl.price+'🪙'; if(m.userData.txt!==txt){m.userData.txt=txt;if(m.userData.sp){m.remove(m.userData.sp);m.userData.sp=null;}if(txt){const sp=G.nameSprite(txt);sp.position.set(0,0,-1.2);sp.scale.set(2.8,0.7,1);m.add(sp);m.userData.sp=sp;}} }
 }
 function showMarkers(on){for(const k in markers)markers[k].visible=on;}
 /* the home ranch: barn row, pasture bounds, fence, sign, fast travel */
 function applyHome(s){
  s=s||S.fresh(); const r=homeRanch(s);
  const changed=R.BARN_ROW.x!==r.barn.x||R.BARN_ROW.z0!==r.barn.z0||R.BARN_ROW.n!==r.barn.n;
  Object.assign(R.BARN_ROW,r.barn); Object.assign(R.PAST,r.past);
  if(yard){scene.remove(yard);yard=null;}
  if(r.id!=='meadowlark'){ yard=new THREE.Group(); fenceRing(yard,r.past.x1,r.past.z1,r.past.x2,r.past.z2,2.5); yard.position.y=0; yard.children.forEach(m=>{m.position.y+=W.groundH(m.position.x,m.position.z);m.castShadow=true;}); const sp=G.nameSprite(r.emoji+' '+r.label); sp.position.set(r.barn.x,W.groundH(r.barn.x,r.barn.z0)+4.2,r.barn.z0+r.barn.step*r.barn.n/2); sp.scale.set(4.4,1.1,1); yard.add(sp); scene.add(yard); }
  if(changed)R.resetBarn();                         // the row is rebuilt at the new spot by the next rebuildAll
  syncFT(s); return changed;
 }
 function syncFT(s){ for(const r of RANCHES){ if(r.id==='meadowlark')continue; const has=T.FT.find(f=>f[3]==='ranch:'+r.id); if(s.ranches.owned.includes(r.id)){ if(!has)W.addFT([r.emoji+' '+r.label.split(' ')[0],r.x,r.z,'ranch:'+r.id]); } } }
 function buyRanch(idv){ const r=ranchOf(idv); if(!r||r.id==='meadowlark')return false; let ok=false,msg='';
  S.sync(s=>{ if(s.ranches.owned.includes(r.id)){msg='You already own '+r.label+'.';return;} if((s.coins||0)<r.price){msg='Not enough coins — '+r.label+' is '+r.price+'🪙';return;} s.coins-=r.price; s.ranches.owned.push(r.id); s.stats.ranchSpend=(s.stats.ranchSpend||0)+r.price; ok=true; msg='🏡 '+r.label+' is yours! Make it home from the Build panel.'; });
  G.money.refreshWallet(); if(ok){G.sGem();W.addRegion({name:r.emoji+' '+r.label,x:r.x,z:r.z,r:34});W.mapMarkers.push({x:r.x,z:r.z,glyph:r.emoji,label:r.label});syncFT(S.fresh());syncMarkers();G.quest.dailyEvt('ranchbuy',1);} toast(msg); return ok; }
 function setHome(idv){ const r=ranchOf(idv); let ok=false,msg='';
  S.sync(s=>{ if(!s.ranches.owned.includes(r.id)){msg='You do not own '+r.label+' yet.';return;} if(s.ranches.home===r.id){msg='You already live at '+r.label+'.';return;} s.ranches.home=r.id; ok=true;
   const cap=API.pastureBase(s)+(0); let out=0; for(const h of s.horses){ if(h.out){ if(out<cap)out++; else h.out=false; } }   // a smaller pasture brings the extras in
   msg='🏡 Home is '+r.label+' now — '+r.barn.n+' stalls, '+r.pasture+' out to grass'+(r.perkText?' · '+r.perkText:'')+'.'; });
  if(ok){ refreshCaches(); applyHome(S.fresh()); H.reloadHorses(); G.horse.player.pos.set(r.x,0,r.z); G.horse.player.speed=0; G.sChime(); } toast(msg); return ok; }
 function buyLand(sid){ const sl=SLOTS[sid]; if(!sl)return false; let ok=false,msg='';
  S.sync(s=>{ if(!s.ranches.owned.includes(sl.ranch)){msg='That plot belongs to '+ranchOf(sl.ranch).label+' — buy the ranch first.';return;} if(s.land.owned.includes(sid)){msg='You already own plot '+sid+'.';return;} if((s.coins||0)<sl.price){msg='Not enough coins — plot '+sid+' is '+sl.price+'🪙';return;} s.coins-=sl.price; s.land.owned.push(sid); s.stats.landSpend=(s.stats.landSpend||0)+sl.price; ok=true; msg='📍 Plot '+sid+' is yours — put a building on it.'; });
  G.money.refreshWallet(); if(ok){G.sCoin();syncMarkers();G.quest.dailyEvt('land',1);} toast(msg); return ok; }
 function placeBuilding(sid,t){ const sl=SLOTS[sid], def=BUILDINGS[t]; if(!sl||!def)return false; let ok=false,msg='',lvl0=0,lvl1=0;
  S.sync(s=>{ if(!s.land.owned.includes(sid)){msg='Buy plot '+sid+' first.';return;} if(s.land.b[sid]){msg='Plot '+sid+' already has a '+BUILDINGS[s.land.b[sid].t].label+' — take it down first.';return;} if((s.coins||0)<def.price){msg='Not enough coins — a '+def.label+' is '+def.price+'🪙';return;}
   lvl0=R.ranchLevel(s); s.coins-=def.price; s.land.b[sid]={t,at:Date.now()}; G.xp.addSP(s,Math.ceil(def.pts/2),'build'); s.stats.built=(s.stats.built||0)+1; s.stats.buildings=(s.stats.buildings||0)+1; s.stats.decorSpend=(s.stats.decorSpend||0)+def.price; lvl1=R.ranchLevel(s); ok=true; });
  G.money.refreshWallet(); if(!ok){toast(msg);return false;}
  syncBuildings(); syncMarkers(); refreshCaches(); G.sChime();
  if(lvl1>lvl0){G.sGem();toast('🏗️ Ranch level '+lvl1+'! '+(T.RANCH_PERKS[lvl1]||''));} else toast(def.emoji+' '+def.label+' built on plot '+sid+' · +'+def.pts+' builder points');
  G.quest.dailyEvt('building',1); if(def.cap&&def.cap.barn)H.rebuildAll(); return true; }
 function demolish(sid){ let ok=false,back=0,lbl='';
  S.sync(s=>{ const b=s.land.b[sid]; if(!b)return; const def=BUILDINGS[b.t]; back=Math.floor(def.price/2); lbl=def.label; delete s.land.b[sid]; s.coins+=back; for(const d of (s.decor||[]))if(def.room&&Math.abs(d.x-SLOTS[sid].x)<=SLOT_HALF&&Math.abs(d.z-SLOTS[sid].z)<=SLOT_HALF&&(DC[d.t]||{}).cat==='indoor')d._gone=1; s.decor=(s.decor||[]).filter(d=>!d._gone); ok=true;
   const cap=API.pastureBase(s); let out=0; for(const h of s.horses){ if(h.out){ if(out<cap)out++; else h.out=false; } } });
  if(!ok)return false; G.money.refreshWallet(); syncBuildings(); syncMarkers(); refreshCaches(); dropOrphans(); H.reloadHorses(); toast('🧹 '+lbl+' taken down · +'+back+'🪙 back'); return true; }

 function dropOrphans(){const s=S.fresh();if(!s)return;const ids=new Set((s.decor||[]).map(d=>d.id));for(let i=R.decorObjs.length-1;i>=0;i--){const o=R.decorObjs[i];if(ids.has(o.d.id))continue;scene.remove(o.g);const ci=W.colliders.indexOf(o.coll);if(ci>=0)W.colliders.splice(ci,1);R.decorObjs.splice(i,1);}}
 /* ================= 6. standing horses: land stalls and hitching posts ================= */
 let standing=[];           // {parts,idx,phase,rig?,kind:'land'|'post'}
 function clearStanding(){for(const b of standing)R.disposeHorseEnt(b);standing=[];}
 function stand(hh,idx,x,z,ry,kind){ const parts=H.makeHorse({colors:hh.colors,horn:hh.horn,wings:hh.wings,dragon:hh.dragon,coat:hh.coat,tack:null,seed:hh.id||(idx+3),breed:hh.breed});
  parts.group.scale.setScalar(R.horseScale(hh)); parts.group.position.set(x,W.groundH(x,z),z); parts.group.rotation.y=ry; const sp=G.nameSprite(hh.name); sp.position.y=3.0; parts.group.add(sp); scene.add(parts.group);
  standing.push({parts,idx,phase:Math.random()*6,kind}); }
 function postOf(s,pid){return R.decorObjs.find(o=>o.d.id===pid&&o.d.t==='post');}
 function rebuildStanding(){
  clearStanding(); const s=S.fresh(); if(!s)return; const ri=H.rideIdx(); const hs=H.myHorses;
  const inside=[]; for(let i=0;i<hs.length;i++){ if(i===ri)continue; const h=hs[i]; if(h.out)continue; if(h.hitch){ const o=postOf(s,h.hitch); if(o){stand(h,i,o.d.x+Math.sin(o.d.ry||0)*0.9,o.d.z+Math.cos(o.d.ry||0)*0.9,(o.d.ry||0)+Math.PI,'post');continue;} } inside.push(i); }
  const spots=landStallSpots(s); const extra=inside.slice(R.BARN_ROW.n);
  for(let k=0;k<extra.length&&k<spots.length;k++){ const sp=spots[k]; stand(hs[extra[k]],extra[k],sp.x,sp.z,sp.ry,'land'); }
  rebuildStallThings();
 }
 function rebuildStallThings(){
  const th=W.things; for(let i=th.length-1;i>=0;i--)if(th[i].kind==='stall')th.splice(i,1);
  const add=(b,x,z)=>W.addThing({kind:'stall',id:'stall'+b.idx,x,z,g:null,idx:b.idx,reach:3.4,label:t=>{const h=H.myHorses[t.idx];return h?'🐴 '+h.name+' · Lv '+(h.level||1)+' · stable card (E)':'';},use:t=>openCard(t.idx)});
  for(const b of R.barnHorses())add(b,R.BARN_ROW.x-0.1,b.z);
  for(const b of standing)add(b,b.parts.group.position.x,b.parts.group.position.z);
 }
 function openCard(i){ G.ui.openStable(); const p=$('stablePanel'); const row=p&&p.querySelector('[data-fx="ranch:tack:'+i+'"]'); const ev=row&&row.closest('.evrow'); if(ev){ev.style.outline='2px solid #77905b';ev.style.outlineOffset='2px';requestAnimationFrame(()=>ev.scrollIntoView({block:'center'}));} }
 function tickStanding(dt,t){ for(const b of standing){ const horse=H.myHorses[b.idx]; if(horse){H.dressWithRig(b,b.parts,horse.colors,{breed:horse.breed,mine:true,foal:horse.foal,coat:horse.coat,dragon:horse.dragon,tailCol:horse.tailCol,mark:horse.mark,markCol:horse.markCol,seed:horse.id});R.tickRig(b,0,dt,t,0);} b.phase+=dt*0.9; R.animateHorse(b.parts,b.phase,0.05,R.GAITS.walk,true,t,1); } }
 function hitch(i,pid){ let msg='',ok=false; S.sync(s=>{ const h=s.horses[i]; if(!h)return; if(pid==null){ h.hitch=null; msg='🏠 '+h.name+' is back in the barn.'; ok=true; return; } if(!(s.decor||[]).some(d=>d.id===pid&&d.t==='post')){msg='That post is gone.';return;} if(s.horses.some((x,j)=>j!==i&&x.hitch===pid)){msg='Another horse is tied there.';return;} h.hitch=pid; h.out=false; msg='⛓️ '+h.name+' is hitched at the post.'; ok=true; });
  if(ok){H.reloadHorses();G.sChime();G.quest.dailyEvt('hitch',1);} toast(msg); G.ui.renderStable(); return ok; }
 function freePosts(s){const used=new Set(s.horses.map(h=>h.hitch).filter(Boolean));return (s.decor||[]).filter(d=>d.t==='post'&&!used.has(d.id));}

 /* ================= 7. stall bonuses ================= */
 function barnList(s){ const ri=H.rideIdx(); const out=[]; for(let i=0;i<s.horses.length;i++){ if(i===ri)continue; const h=s.horses[i]; if(h.out||h.hitch)continue; out.push(i);} return out; }
 function stallTick(s,sec){ if(!s||!(sec>0))return 0; sec=Math.min(24*3600,sec); const cap=barnCap(s), m=R.ranchMul('stall'), hrs=sec/3600; let xpTot=0;
  for(const i of barnList(s).slice(0,cap)){ const h=s.horses[i]; h.needs=h.needs||{hunger:90,thirst:90,clean:90,happy:90}; h.needs.happy=Math.min(100,(h.needs.happy||0)+STALL_BONUS.happyPerH*hrs*m); G.xp.ensureStats(h);
   h.stallAcc=(h.stallAcc||0)+STALL_BONUS.xpPerH*hrs*m; const xp=Math.floor(h.stallAcc); if(xp>0){h.stallAcc-=xp;G.xp.applyXp(s,h,xp);xpTot+=xp;}
   h.stamAcc=(h.stamAcc||0)+STALL_BONUS.stamSxpPerH*hrs*m; const sx=Math.floor(h.stamAcc); if(sx>0){h.stamAcc-=sx;G.xp.grantStatXp(s,h,'stamina',sx,'stall');} }
  s.stats=s.stats||{}; s.stats.stallXp=(s.stats.stallXp||0)+xpTot; s.stallLast=Date.now(); return xpTot; }
 API.stallTick=stallTick; API.barnList=barnList; API.stallRate=()=>STALL_BONUS.xpPerH*R.ranchMul('stall');

 /* ================= 8. panels ================= */
 let buildCat='all';
 const meter=(pts,L)=>{const lo=LV[L-1]||0,hi=LV[L];const f=hi?Math.max(0,Math.min(1,(pts-lo)/(hi-lo))):1;return '<div class="crow" style="gap:8px;align-items:center"><span style="font-size:12px;font-weight:700;flex:none">🧱 '+pts+' pts</span><div class="cbar"><div style="width:'+Math.round(f*100)+'%;height:100%;background:linear-gradient(90deg,#a9d67f,#5f9d3e)"></div></div><span style="font-size:11px;color:#8c7a63;flex:none">'+(hi?'Lv '+(L+1)+' at '+hi:'max level')+'</span></div>';};
 const priceTxt=c=>c.gems?c.gems+'💎':(c.price||0)+'🪙';
 function seasonId(){try{return G.time.seasonNow().def.id;}catch(e){return 'bloom';}}
 function partyLine(s){const pts=ranchPts(s);return pts>=PARTY_PTS?'🎉 Ranch party: ready ✅ — throw one from 🌐 Club':'🎉 Public ranch party: needs '+(PARTY_PTS-pts)+' more builder points ('+pts+'/'+PARTY_PTS+') · private parties are always open';}
 function piecesTab(sv){
  sv.decor=sv.decor||[]; const pts=ranchPts(sv), L=R.ranchLevel(sv), stars=ranchStars(sv), sid=seasonId();
  let html=meter(pts,L);
  html+='<div style="font-size:12px"><b>'+'⭐'.repeat(stars)+'<span style="color:#d8cfc0">'+'⭐'.repeat(5-stars)+'</span> '+stars+'-star ranch</b> · stalled horses gain +'+Math.round((R.ranchMul('stall')-1)*100)+'% · boarders pay +'+Math.round((R.ranchMul('board')-1)*100)+'%'
   +'<div style="margin-top:2px">'+RANCH_STAR_RULES.map(([lbl,fn])=>{let ok=false;try{ok=fn(sv);}catch(e){}return '<span style="margin-right:8px;color:'+(ok?'#3a7a3a':'#b8a888')+'">'+(ok?'✅':'☆')+' '+lbl+'</span>';}).join('')+'</div></div>';
  html+='<div style="font-size:12px;color:#8c7a63">'+partyLine(sv)+'</div>';
  html+='<details style="font-size:12px"><summary style="cursor:pointer">Level perks — for you and for the horses in the stalls</summary><div style="margin:2px 0">'+Object.keys(T.RANCH_PERKS).map(k=>'<div style="color:'+(L>=+k?'#3a7a3a':'#b8a888')+'">'+(L>=+k?'✅':'🔒')+' Lv '+k+' · you: '+T.RANCH_PERKS[k]+' · stalls: '+(RANCH_STALL_PERKS[k]||'')+'</div>').join('')+'</div>'
   +'<div style="color:#8c7a63">Points follow the price: 1 per 10🪙, 3 per 💎. Half of them are Star Points for the club board, and every 10💎 spent on decor is 1 more ⭐.</div></details>';
  html+='<div class="crow" style="gap:4px;flex-wrap:wrap">'+CATS.map(([k,l])=>'<button class="tabbtn '+(buildCat===k?'on':'')+'" style="font-size:11px;padding:4px 9px" data-fx="ranch:cat:'+k+'">'+l+'</button>').join('')+'</div>';
  const keys=Object.keys(DC).filter(k=>{const c=DC[k];const ct=c.cat||'yard';if(buildCat==='all')return ct!=='seasonal'||c.season===sid||sv.decor.some(d=>d.t===k);if(buildCat==='seasonal')return ct==='seasonal'&&(c.season===sid||sv.decor.some(d=>d.t===k));return ct===buildCat;});
  if(buildCat==='seasonal'){const sn=G.time.seasonNow().def;html+='<div style="font-size:12px;color:#8c7a63">'+sn.emoji+' '+sn.name+' pieces are in the catalogue now; pieces you already own stay placed when the season turns.</div>';}
  if(buildCat==='indoor')html+='<div style="font-size:12px;color:#8c7a63">Indoor pieces go inside a 🏡 Ranch house — build one on a plot in the 📍 Land tab.</div>';
  html+=keys.map(t=>{const c=DC[t];const have=sv.decor.filter(d=>d.t===t).length;const st=c.set&&DECOR_SETS[c.set];return '<div class="evrow">'+c.emoji+' <b>'+c.label+'</b><span style="font-size:11px">'+priceTxt(c)+' · '+R.decorPts(c)+' pts'+(st?' · '+st.label:'')+(c.season?' · '+({bloom:'🌸',sun:'☀️',ember:'🍂',frost:'❄️'}[c.season]||'')+' '+c.season:'')+(have?' · placed ×'+have:'')+'</span><button data-fx="ranch:place:'+t+'">Place</button></div>';}).join('');
  if(!keys.length)html+='<div style="font-size:12px;color:#b8a888">Nothing in this shelf right now.</div>';
  if(buildCat==='all'||buildCat==='sets'||buildCat==='seasonal'){ html+='<div style="font-size:12px;color:#8c7a63;margin-top:4px">🧩 Sets — place every piece for the bonus</div>'+Object.keys(DECOR_SETS).map(k=>{const d=DECOR_SETS[k],n=setProgress(sv,k),done=n>=d.pieces.length;return '<div class="evrow'+(done?' done':'')+'"><b>'+d.label+'</b><span>'+n+'/'+d.pieces.length+' · '+d.text+'</span>'+(done?'<span style="flex:none">✅</span>':'')+'</div>';}).join(''); }
  html+='<div class="crow" style="gap:6px;margin-top:6px;flex-wrap:wrap"><button data-fx="ranch:move">✋ Move a piece</button><button data-fx="ranch:remove">🧹 Remove a piece</button><span style="font-size:11px;color:#8c7a63">'+sv.decor.length+' pieces · R/Q turn, Shift for fine turns · walls snap end to end</span></div>';
  return html;
 }
 function landTab(sv){
  const home=homeRanch(sv); let html='<div style="font-size:12px;color:#8c7a63">Plots are 12 m square. Buy one, then put a building on it: stables and paddocks raise your caps at the ranch you live on, houses can be furnished, sheds and wells and rings pay a perk.</div>';
  for(const r of ownedRanches(sv)){ html+='<div class="ph" style="font-size:14px;margin-top:4px">'+r.emoji+' '+r.label+(r.id===home.id?' <span class="badge">HOME</span>':'')+'</div>';
   for(const [sid] of r.slots){const sl=SLOTS[sid];const owned=sv.land.owned.includes(sid);const b=sv.land.b[sid];
    if(!owned)html+='<div class="evrow">📍 <b>Plot '+sid+'</b><span>'+sl.price+'🪙 · '+Math.round(Math.hypot(sl.x-r.x,sl.z-r.z))+' m from the yard</span><button data-fx="ranch:land:buy:'+sid+'">Buy</button></div>';
    else if(b){const def=BUILDINGS[b.t];html+='<div class="evrow done">'+def.emoji+' <b>'+def.label+'</b><span>plot '+sid+' · '+def.pts+' pts · '+def.blurb+'</span><button data-fx="ranch:land:demolish:'+sid+'" title="Half the price back">🧹</button></div>';}
    else html+='<div class="evrow"><b>Plot '+sid+'</b><span style="display:flex;gap:4px;flex-wrap:wrap">'+Object.keys(BUILDINGS).map(t=>'<button data-fx="ranch:land:build:'+sid+':'+t+'" title="'+BUILDINGS[t].blurb+'" style="font-size:11px;padding:3px 7px">'+BUILDINGS[t].emoji+' '+BUILDINGS[t].label+' · '+BUILDINGS[t].price+'🪙</button>').join('')+'</span></div>';}
  }
  html+='<div style="font-size:12px;color:#8c7a63;margin-top:4px">Stalls at home: '+barnCap(sv)+' · out to grass: '+API.pastureBase(sv)+(G.money?'':'')+' · buildings: '+buildingCount(sv)+' (+'+extraPts(sv)+' pts)</div>';
  return html;
 }
 function ranchesTab(sv){
  const home=homeId(sv); let html='<div style="font-size:12px;color:#8c7a63">Every ranch you own keeps its plots and buildings. The one you call home is where the barn row, the pasture and the stall bonuses live.</div>';
  for(const r of RANCHES){const own=sv.ranches.owned.includes(r.id);html+='<div class="evrow'+(r.id===home?' done':'')+'">'+r.emoji+' <b>'+r.label+'</b><span>'+r.blurb+'<br>'+r.barn.n+' stalls · '+r.pasture+' out to grass'+(r.perkText?' · '+r.perkText:'')+(own?'':' · '+r.price+'🪙')+'</span>'+(r.id===home?'<span style="flex:none">🏡 home</span>':own?'<button data-fx="ranch:home:'+r.id+'">Make home</button>':'<button data-fx="ranch:buy:'+r.id+'" '+((sv.coins||0)>=r.price?'class="claimBtn"':'')+'>Buy</button>')+'</div>';}
  return html;
 }
 G.ui.buildTab({id:'pieces',label:'🪵 Pieces',pos:0,render:piecesTab});
 G.ui.buildTab({id:'land',label:'📍 Land',render:landTab});
 G.ui.buildTab({id:'ranches',label:'🏡 Ranches',render:ranchesTab});
 G.ui.shopTab({id:'ranches',label:'🏡 Ranches',render:s=>ranchesTab(s)});
 G.ui.shopTab({id:'furniture',label:'🪑 Furniture',render:s=>'<div style="font-size:12px;color:#8c7a63">Furniture and decor live in the Build panel — '+Object.keys(DC).length+' pieces across '+(CATS.length-1)+' shelves, priced in coins and earned gems.</div><button data-fx="ranch:build" class="claimBtn">🏗️ Open the Build panel</button>'});
 function reopenBuild(){const p=$('buildPanel');if(p)p.style.display='none';G.ui.openBuild();}
 /* the stable: header, per-horse tack / hitch buttons */
 G.ui.stableHeader(s=>{const inside=barnList(s),cap=barnCap(s),hit=s.horses.filter(h=>h.hitch).length;const stars=ranchStars(s);return '<div style="font-size:11.5px;color:#8c7a63;padding:0 2px">🏠 <b>'+inside.length+' in the barn</b> ('+cap+' stalls at '+homeRanch(s).label+')'+(hit?' · ⛓️ '+hit+' hitched':'')+' · ✨ stalled horses gain <b>'+API.stallRate().toFixed(1)+' XP/h</b> at Lv '+R.level()+' '+'⭐'.repeat(stars)+(inside.length>cap?' · <span style="color:#b0552f">'+(inside.length-cap)+' waiting for a stall — build a Stable block</span>':'')+'</div>';});
 G.ui.stableRow((h,i)=>{const ri=H.rideIdx();let o='<button data-fx="ranch:tack:'+i+'" title="Tack and un-tack this horse">🐎 Tack</button>';if(i!==ri&&!h.out){o+=h.hitch?'<button data-fx="ranch:unhitch:'+i+'" class="claimBtn" title="Back to the barn">⛓️ Hitched</button>':'<button data-fx="ranch:hitch:'+i+'" title="Tie up at a free hitching post">⛓️</button>';}return o;});
 G.ui.section('tackHeader',(s,ti)=>'<div class="crow" style="gap:6px"><span class="lbl">Dressing</span><select data-fxin="ranch:tackfor">'+s.horses.map((h,i)=>'<option value="'+i+'"'+(i===ti?' selected':'')+'>'+(i===H.rideIdx()?'🏇 ':h.out?'🌿 ':h.hitch?'⛓️ ':'🏠 ')+h.name+'</option>').join('')+'</select><span style="font-size:11px;color:#8c7a63">any horse — in the barn, at grass or at a post</span></div>');
 G.ui.moneyRow(s=>'<div class="evrow">⭐ <b>'+ranchStars(s)+'-star ranch</b><span>boarders pay +'+Math.round((R.ranchMul('board')-1)*100)+'% · stalled horses gain +'+Math.round((R.ranchMul('stall')-1)*100)+'% · '+setsDone(s).length+' decor set'+(setsDone(s).length===1?'':'s')+' complete</span></div>');
 /* party planner in the club panel */
 const pp={priv:false,len:'short',game:''};
 G.ui.onlineSection(s=>{const pts=ranchPts(s),ok=pts>=PARTY_PTS,fr=Object.keys(s.friends||{}).length;
  return '<div style="font-size:12px;color:#8c7a63;margin-top:-4px">'+(ok?'✅ Public parties unlocked ('+pts+' builder points)':'🏗️ Public parties need '+PARTY_PTS+' builder points — you have '+pts+'. Private parties are always open.')+'</div>'
  +'<div class="crow" style="gap:6px;flex-wrap:wrap"><select data-fxin="ranch:ppriv"><option value="0"'+(pp.priv?'':' selected')+(ok?'':' disabled')+'>🌐 Public — the whole club</option><option value="1"'+(pp.priv?' selected':'')+'>🔒 Private — '+fr+' friend'+(fr===1?'':'s')+'</option></select>'
  +'<select data-fxin="ranch:plen">'+Object.keys(PARTY_LEN).map(k=>'<option value="'+k+'"'+(pp.len===k?' selected':'')+'>'+k+' · '+(PARTY_LEN[k]/60)+' min</option>').join('')+'</select>'
  +'<select data-fxin="ranch:pgame"><option value="">no game</option>'+PARTY_GAMES.map(g=>'<option value="'+g[0]+'"'+(pp.game===g[0]?' selected':'')+'>'+g[1]+'</option>').join('')+'</select>'
  +'<button data-fx="ranch:party" '+(R.party()?'disabled':(pp.priv||ok?'class="claimBtn"':''))+'>🎉 Throw it at '+homeRanch(s).label.split(' ')[0]+'</button></div>'
  +'<span style="font-size:11px;color:#8c7a63">Parties happen at your home ranch. A game is a roleplay prompt for everyone who comes: '+PARTY_GAMES.map(g=>g[1]).join(', ')+'.</span>';});
 /* one dispatcher */
 G.ui.action('ranch',(a,el)=>{
  const op=a[0];
  if(op==='cat'){buildCat=a[1]||'all';reopenBuild();}
  else if(op==='place'){R.startPlace(a[1]);}
  else if(op==='move'){R.startMoveMode();}
  else if(op==='remove'){R.startRemove();}
  else if(op==='build'){G.hidePanels();G.ui.openBuild();}
  else if(op==='land'){ if(a[1]==='buy')buyLand(a[2]); else if(a[1]==='build')placeBuilding(a[2],a[3]); else if(a[1]==='demolish')demolish(a[2]); reopenBuild(); }
  else if(op==='buy'){buyRanch(a[1]);const p=$('shopPanel');if(p&&p.style.display==='flex')G.ui.openShop('ranches');else reopenBuild();}
  else if(op==='home'){setHome(a[1]);const p=$('shopPanel');if(p&&p.style.display==='flex')G.ui.openShop('ranches');else reopenBuild();}
  else if(op==='tack'){API.tackFor=+a[1];G.ui.openShop('tack');}
  else if(op==='tackfor'){API.tackFor=+el.value;G.ui.openShop('tack');}
  else if(op==='hitch'){const s=S.fresh();const posts=freePosts(s);if(!posts.length){toast('No free hitching post — place one from 🏗️ Build (Stable shelf).');return;}hitch(+a[1],posts[0].id);}
  else if(op==='unhitch'){hitch(+a[1],null);}
  else if(op==='ppriv'){pp.priv=el.value==='1';}
  else if(op==='plen'){pp.len=el.value;}
  else if(op==='pgame'){pp.game=el.value;}
  else if(op==='party'){ const s=S.fresh(); const opts={priv:pp.priv,len:PARTY_LEN[pp.len]||90,game:(PARTY_GAMES.find(g=>g[0]===pp.game)||[])[1]||null,to:pp.priv?Object.keys(s.friends||{}).slice(0,40):undefined};
   if(pp.priv&&!opts.to.length)toast('🔒 No friends on your list yet — befriend riders in the Club roster. The party is still on for you.');
   if(R.startParty(null,false,opts)){const p=$('onlinePanel');if(p&&p.style.display==='flex'){p.style.display='none';G.ui.openOnline();}} }
 });

 /* ================= 9. parties ================= */
 G.on('partyHost',opts=>{ const s=S.fresh()||{}; const r=homeRanch(s); if(opts.x==null){opts.x=r.x;opts.z=r.z;}
  if(!opts.priv&&ranchPts(s)<PARTY_PTS){toast('🏗️ Public parties need '+PARTY_PTS+' builder points — you have '+ranchPts(s)+'. Build more, or throw a private one for your friends.');return true;} });
 G.on('chat',(m,nm)=>{ if(!m.party||typeof m.party!=='object')return; const p=m.party;
  if(p.priv){ const to=Array.isArray(p.to)?p.to.map(x=>String(x).slice(0,14)):[]; if(!to.includes(G.net.myName())){m.party=null;return;} }
  m.party={priv:!!p.priv,x:Math.max(-290,Math.min(290,num(p.x,0))),z:Math.max(-290,Math.min(290,num(p.z,5))),len:Math.max(30,Math.min(600,num(p.len,90))),game:p.game?String(p.game).slice(0,24):null}; });
 let partyHint=null, markersOn=false;
 G.on('tick',(dt,t)=>{
  if(standing.length)tickStanding(dt,t);
  const pt=R.party(); if(pt&&pt.game){ const P=H.player; if(Math.hypot(P.pos.x-pt.x,P.pos.z-pt.z)<25){ if(partyHint!==pt){partyHint=pt;const g=PARTY_GAMES.find(x=>x[1]===pt.game);toast('🎉 Party game: '+pt.game+(g?' — '+g[2]:''));} const c=$('ctx'); if(c&&c.style.display==='none'){c.style.display='block';c.textContent='🎉 '+pt.game;} } }
  else if(!pt)partyHint=null;
  const b=R.build; const on=!!(b.type||b.move||b.remove)||(($('buildPanel')||{}).style||{}).display==='flex'; if(on!==markersOn){markersOn=on;showMarkers(on);}
 });

 /* ================= 10. quests, boards, state ================= */
 G.quest.addAch({id:'ranch2',icon:'🏡',label:'Landowner',desc:'Own a second ranch',v:s=>((s.ranches&&s.ranches.owned)||[]).length,goal:2,r:{g:5,k:1}});
 G.quest.addAch({id:'land3',icon:'🗺️',label:'Homesteader',desc:'Own 3 plots of land',v:s=>((s.land&&s.land.owned)||[]).length,goal:3,r:{c:500}});
 G.quest.addAch({id:'bld3',icon:'🏗️',label:'Raising the roof',desc:'Put 3 buildings on your land',v:s=>buildingCount(s),goal:3,r:{c:600,k:1}});
 G.quest.addAch({id:'set1',icon:'🧩',label:'Matching set',desc:'Complete a decor set',v:s=>decorSetsDone(s),goal:1,r:{g:3}});
 G.quest.addAch({id:'pts500',icon:'🧱',label:'Master builder',desc:'Earn 500 builder points',v:s=>ranchPts(s),goal:500,r:{c:400,k:1}});
 G.quest.addAch({id:'star5',icon:'🌟',label:'Five-star ranch',desc:'Reach a 5-star ranch rating',v:s=>ranchStars(s),goal:5,r:{g:8,k:2}});
 G.quest.addAch({id:'stall500',icon:'🛏️',label:'Well rested',desc:'Earn 500 XP from stalled horses',v:s=>(s.stats&&s.stats.stallXp)||0,goal:500,r:{c:400}});
 G.quest.addAch({id:'decorGems50',icon:'💎',label:'Premium decorator',desc:'Spend 50 gems on decor',v:s=>(s.stats&&s.stats.decorGems)||0,goal:50,r:{c:600,k:1}});
 G.quest.addAch({id:'host3',icon:'🎉',label:'Party host',desc:'Throw 3 ranch parties',v:s=>(s.stats&&s.stats.parties)||0,goal:3,r:{c:300}});
 G.quest.addAch({id:'hitch1',icon:'⛓️',label:'Tied up',desc:'Hitch a horse to a post',v:s=>(s.life&&s.life.hitch)||0,goal:1,r:{c:80}});
 G.quest.addDaily({type:'stallin',icon:'🏠',label:'Bring a horse into the barn',goal:1,r:{c:60}});
 G.quest.addDaily({type:'build',icon:'🏗️',label:'Place 3 pieces of decor',goal:3,r:{c:90,p:10}});
 W.addBoard({k:'ranchpts',g:'ranch',label:'Builder points',rate:6,val:s=>ranchPts(s)});
 W.addBoard({k:'decorGems',g:'ranch',label:'Gems spent on decor',rate:0.6,val:s=>(s.stats&&s.stats.decorGems)||0});
 G.on('decorPlaced',(d,c)=>{ refreshCaches(); G.quest.dailyEvt('build',1); if(c.cat==='indoor')G.quest.dailyEvt('furnish',1); if(c.set&&DECOR_SETS[c.set]&&setProgress(S.fresh()||{},c.set)===DECOR_SETS[c.set].pieces.length){G.sGem();toast('🧩 '+DECOR_SETS[c.set].label+' complete — '+DECOR_SETS[c.set].text+'!');} });
 G.on('decorRemoved',(d,c)=>{ refreshCaches(); if(d.t==='post')rebuildStanding(); });
 G.on('rebuild',()=>{ rebuildStanding(); });
 G.on('state',o=>{ const s=S.fresh()||{}; o.ranch={home:homeId(s),owned:(s.ranches&&s.ranches.owned)||[],pts:ranchPts(s),level:R.ranchLevel(s),stars:ranchStars(s),barnCap:barnCap(s),pasture:API.pastureBase(s),land:{owned:((s.land&&s.land.owned)||[]).length,buildings:buildingCount(s)},sets:setsDone(s),party:R.party()?{t:Math.round(R.party().t),x:R.party().x,z:R.party().z,priv:!!R.party().priv,game:R.party().game||null}:null,pieces:Object.keys(DC).length}; });
 G.on('interval30',(s,now)=>{ try{stallTick(s,Math.min(3600,(now-(s.stallLast||now))/1000));}catch(e){} });
 G.on('boot',(s,BI)=>{
  refreshCaches(s); let got=0;
  S.sync(sv=>{ got=stallTick(sv,(Date.now()-(sv.stallLast||Date.now()))/1000); });
  const moved=applyHome(S.fresh());
  syncBuildings(); syncMarkers();
  for(const r of RANCHES){ if(r.id==='meadowlark')continue; if((s.ranches.owned||[]).includes(r.id)){W.addRegion({name:r.emoji+' '+r.label,x:r.x,z:r.z,r:34});W.mapMarkers.push({x:r.x,z:r.z,glyph:r.emoji,label:r.label});} }
  setTimeout(()=>{ try{ if(moved)H.rebuildAll(); else rebuildStanding(); if(got>=3)toast('✨ Your stalled horses gained '+got+' XP while you were away.'); }catch(e){} },4500);   // after rebuildDecor's own 4 s timer, so posts and buildings exist; a moved home re-seats the herd and the barn row
 });
 /* fast travel to an owned ranch (FT rows carry a 4th tag; buildFtBar ignores it) */
 Object.assign(API,{buyRanch,setHome,buyLand,placeBuilding,demolish,hitch,freePosts,rebuildStanding,syncBuildings,built,standing:()=>standing,applyHome,piecesTab,landTab,ranchesTab,partyPrefs:pp,barnCap,ranchPts,stallTick,setProgress,openCard});
}
