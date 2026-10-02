/* Feature package 'new-breeds' — more horses.

   The headline is the Chameleon Mustang: the rarest horse on the shelf, a hundred gems, and its coat
   really does hide it. Ride it across the meadow and it wears meadow greens and browns in soft
   blotches; ride on into Coyote Canyon and over a second or two the blotches go to sand and ochre;
   up at Hollowpeak it turns snow white and grey, down by the river the blue-green of the water.
   A faint shimmer runs over it at the moment it changes. It does the same standing in the pasture,
   in the barn, following you or tied at a post. Wild herds are easier on it: a spooked wild horse
   settles twice as fast, and they warm to you from further off while you stand quietly. A one in two
   hundred chance of it also sits in every Starfall Call, printed on the call's card.

   Then nine more to fill the stable: five real breeds the game did not have yet (Connemara Pony,
   Suffolk Punch, Rocky Mountain Horse and Hanoverian in the shop for coins, the Lusitano out of the
   Summoning Stall) and the Camargue, only found wild in the river meadow herd; and three fantasy horses
   of our own — the Firefly Arabian from the Starfall Call, the Opaline Unicorn for gems in the shop,
   and the Daybreak Haflinger, which comes to anyone who rides on five different days of one week.
   Each has named coats (the real ones) or a coat theme (the fantasy ones), stat ceilings, two mastery
   perks and a line of description on its Market card and in Horse Care.

   How the camouflage works. The coat is a fantasy theme like the others ('camo', registered with the
   shared shader module), so every picture of the horse — the My Horses portrait, a friend's screen, the
   Market preview — shows a pleasant woodland coat in three colours. Horses standing in the world get a
   live copy of that material instead, whose three colours this package moves. A few times a second it
   works out what ground is under the horse from the same regions the terrain shader paints (canyon,
   snow, the four far quarters, the riverbank and the stream, Loon Lake, the arena, the roads, the leaf
   litter under the trees, bare stone on a steep slope), blended where one country fades into another,
   and each frame the coat eases toward that palette. Nothing is allocated per frame.

   Owned by this package: this file, the BREEDS3 rows it pushes, its coat themes, and the rows it adds to
   the roster's shared tables (COATS3, BREED_PERKS, SRC_LABEL), to BREED_CEIL and WILD_BREEDS, and the
   breeding package's BREED_GENES and WILD_COATS (at boot).
   Nothing runs at import time. */
import {registerFantasyTheme,registerFantasyAppearance,createEquineFantasyCoat} from '../equine-fantasy.js?v=artist-breeds-1';
export const id='new-breeds';

/* ---------------------------------------------------------------------------------------
   DATA
   --------------------------------------------------------------------------------------- */
const CAMO='chameleon', CAMO_GEMS=100;
const ODDS={starfall:0.005};                     // the Chameleon Mustang's chance on any Starfall Call (printed on the card)

/* [key,label,tier,coins,gems,body,mane,flags]. body: the authored model each one stands on.
   The mane column is always the body model's OWN mane (its BREEDS3 row's) and maneCol is the breed's
   true mane. ranch3d.html's configureArtistCustomization switches the mane dye off when a horse's mane
   equals that column and lets the model's authored hair show, so with the model's own mane there, every
   coat of ours (none of which uses it) keeps its mane dyed on, and a horse that somehow ends up with
   exactly that colour shows the model's hair, which is that colour anyway. A horse arrives wearing
   maneCol (see the grantHorse and foal hooks), so it is dyed on in every picture of the horse: the
   world, My Horses, a friend's screen. */
const ROWS=[
 ['chameleon','Chameleon Mustang','Mythic',0,CAMO_GEMS,'#6b853e','#f4e6c5',{coat:'camo',maneCol:'#3a3a26',src:'shop',body:'palomino',camo:true}],
 ['connemara','Connemara Pony','Common',85,0,'#565a63','#d8c49a',{maneCol:'#1e1d22',mark:'roan',markCol:'#dfe3ea',body:'iceland'}],
 ['suffolk','Suffolk Punch','Draft',60,0,'#a8561f','#6a6f78',{maneCol:'#c47a42',mark:'none',body:'percheron'}],
 ['rockymtn','Rocky Mountain Horse','Uncommon',175,0,'#4a3226','#2a1a12',{maneCol:'#e6d6b4',mark:'none',body:'morgan'}],
 ['hanover','Hanoverian','Rare',340,0,'#a0552a','#2a1c12',{maneCol:'#7a3c1c',mark:'none',body:'thoro'}],
 /* the Lipizzaner's authored coat is a pale grey, so the wild herd (which draws a horse from its breed
    alone, with no pattern) shows a white Camargue and not a chestnut Haflinger */
 ['camargue','Camargue Horse','Rare',0,0,'#c9cac5','#e0ddd4',{maneCol:'#e6e4de',mark:'dapple',src:'wild',body:'lipiz'}],
 ['lusitano','Lusitano','Epic',0,0,'#7a4a2a','#787f8a',{maneCol:'#231811',mark:'points',markCol:'#1e150f',src:'summon',body:'grey'}],
 ['firefly','Firefly Arabian','Mythic',0,0,'#223a28','#ffd166',{coat:'firefly',maneCol:'#c9d98a',glow:true,ability:'swift',src:'summon',body:'sunset'}],
 /* on the Lipizzaner too: a pale coat with no dapples under the opal */
 ['opaline','Opaline Unicorn','Legendary',0,12,'#c9c2d9','#e0ddd4',{coat:'opal',maneCol:'#f1e4ff',horn:true,glow:true,ability:'leap',src:'shop',body:'lipiz'}],
 ['daybreak','Daybreak Haflinger','Mythic',0,0,'#e98a78','#f7ecd4',{coat:'dawn',maneCol:'#ffe0a6',glow:true,ability:'leap',src:'loyal',exclusive:'Ride on five different days in one week',body:'haflinger'}],
];
const KEYS=ROWS.map(r=>r[0]);
const OLD_BODY={daybreak:'#c86a4c'};   // defaults that changed after horses were already given out (see the boot pass)
const DESC={
 chameleon:'A camouflage mustang: its coat takes on the ground under its hooves, meadow green on grass, sand in the canyon, snow on the peaks. Wild horses hardly notice it.',
 connemara:'A hardy Irish pony from the rocky west coast, famous for jumping fences far bigger than it looks.',
 suffolk:'The oldest English draft breed: always chestnut, spelt chesnut on the old farms, and as round as an apple.',
 rockymtn:'A smooth-gaited horse from the Kentucky hills, loved for its chocolate coat and pale flaxen mane.',
 hanover:'A German warmblood bred for the show ring: big, bold and careful over a fence.',
 camargue:'The white horses of the salt marshes, born dark and turning white as they grow. Only found wild, in the river meadow herd.',
 lusitano:'A proud Portuguese horse with a high, rounded stride and quick feet, gifted at dressage.',
 firefly:'A dusk-green Arabian freckled with slow drifting lights, like a summer field just after sunset.',
 opaline:'A unicorn whose pearly coat shifts through soft rainbow colours as it moves.',
 daybreak:'A Haflinger that glows like a sunrise, rose below and gold on top. It comes to riders who come back day after day.',
};
/* Named coats for the real breeds: [id,label,body,mane,mark?,markCol?] (the roster's COATS3 shape). The
   first is the breed's default, the one on its row and in its Market painting. */
const COATS={
 connemara:[['connemararoan','Blue Roan','#565a63','#1e1d22','roan','#dfe3ea'],['connemaradun','Dun','#b99b6a','#3b3226','dun','#3a3024'],['connemaragrey','Dapple Grey','#a9aeb3','#6d7178','dapple'],
  ['connemarabay','Bay','#7e5230','#261a12','points','#221811'],['connemarabuck','Buckskin','#c4a26b','#2a2018','points','#241a12'],['connemarapal','Palomino','#d6aa62','#f2e4c2','none'],['connemarablack','Black','#2a2a30','#121216','none']],
 suffolk:[['suffolkbright','Bright Chestnut','#b35d26','#d18a4f','none'],['suffolkred','Red Chestnut','#9a4520','#b8683a','sooty'],['suffolkdark','Dark Chestnut','#6e3518','#8a4a26','sooty'],
  ['suffolkliver','Liver Chestnut','#5a2e1c','#7a4a30','none'],['suffolkgold','Golden Chestnut','#c27a3a','#e0b077','none']],
 rockymtn:[['rockychoc','Chocolate','#4a3226','#e6d6b4','none'],['rockysilverbay','Silver Bay','#7a4e2e','#d9ccb4','none'],['rockysilverblack','Silver Black','#3e3833','#cfc8bc','none'],
  ['rockychestnut','Flaxen Chestnut','#9a5028','#e8d2a8','none'],['rockypal','Palomino','#d4a55e','#f4e6c6','none']],
 hanover:[['hanoverchestnut','Chestnut','#a0552a','#7a3c1c','none'],['hanoverbay','Bay','#6e4526','#1f1510','points','#1c140e'],['hanoverdarkbay','Dark Bay','#4a2c1a','#161009','points','#140e09'],
  ['hanoverblack','Black','#26262c','#101014','none'],['hanovergrey','Grey','#b8bcc2','#7c828a','dapple']],
 camargue:[['camarguewhite','Marsh White','#c9cac5','#e6e4de','dapple'],['camarguegrey','Steel Grey','#9fa3a6','#d6d6d2','dapple'],['camarguefleabit','Flea-bitten','#cfcec8','#bdbab2','roan','#7a6456']],
 lusitano:[['lusibay','Bay','#7a4a2a','#231811','points','#1e150f'],['lusirose','Rose Grey','#c9b3ad','#8a7370','dapple'],['lusiisabelo','Isabelo','#dcc394','#f2e8d0','none'],
  ['lusichestnut','Chestnut','#a55a2c','#7a3d1d','none'],['lusiblack','Black','#28282e','#111115','none'],['lusibuck','Buckskin','#c3a06a','#281e16','points','#221810']],
};
/* A rare wild coat for a tamed Camargue (the breeding package's WILD_COATS, which otherwise hands it the
   brown 'Mountain Dun' every other wild horse without an entry gets). */
const WILD_COAT={label:'Salt-marsh White',body:'#dcdcd6',mane:'#f0efe9',mark:'dapple'};
/* Stat ceilings: speed, stamina, jump, acceleration, agility (the stats package's order). */
const CEIL={chameleon:[10,9,9,9,10],connemara:[6,8,9,7,8],suffolk:[6,10,6,7,7],rockymtn:[7,9,6,7,8],hanover:[9,8,10,8,8],
 camargue:[7,10,7,7,9],lusitano:[8,8,8,9,10],firefly:[10,9,8,10,9],opaline:[9,9,10,9,10],daybreak:[9,10,9,9,9]};
/* Mastery perks, rung 5 and rung 10 (the roster scales them to a fantasy horse's five-step ladder). */
const PERKS={
 chameleon:{5:{label:'Hidden in plain sight',ag:.05},10:{label:'Shifting coat',stam:.85}},
 connemara:{5:{label:'Bog-trotter',ag:.05},10:{label:'Pony jumper',jp:.05}},
 suffolk:{5:{label:'Draft heart',stam:.85},10:{label:'Punch power',ac:.06}},
 rockymtn:{5:{label:'Single-foot gait',stam:.9},10:{label:'Mountain sure',ag:.05}},
 hanover:{5:{label:'Warmblood scope',jp:.05},10:{label:'Grand prix',sp:.04}},
 camargue:{5:{label:'Marsh legs',stam:.9},10:{label:'Horse of the sea',ag:.06}},
 lusitano:{5:{label:'Collected power',ag:.06},10:{label:'Quick turn',ac:.07}},
 firefly:{5:{label:'Dusk lantern',ac:.06},10:{label:'Summer night',sp:.05}},
 opaline:{5:{label:'Opal step',ag:.05},10:{label:'Rainbow leap',jp:.06}},
 daybreak:{5:{label:'First light',ac:.06},10:{label:'Long summer day',stam:.8}},
};
const LOYAL_DAYS=5;
/* Coat genetics for the breeding package's foal colours (its loci: E A Cr D G Rn To Lp Z). The Connemara
   carries roan, dun and grey, the Rocky Mountain Horse silver, the Camargue is always grey, the Suffolk
   always chestnut. */
const GENES={connemara:{E:'Ee',A:'Aa',G:'nG',D:'nD',Rn:'nRn'},suffolk:{E:'ee',A:'AA'},rockymtn:{E:'EE',A:'Aa',Z:'nZ'},hanover:{E:'Ee',A:'Aa'},
 camargue:{E:'Ee',A:'Aa',G:'GG'},lusitano:{E:'Ee',A:'Aa',G:'nG'}};

/* The ground palettes: [what the player reads, dark blotch, base, light blotch] (sRGB). */
const GROUNDS={
 meadow:['meadow grass','#557037','#8aa653','#b3a468'],
 forest:['leaf litter under the trees','#3f3b26','#6e6040','#8d9a52'],
 track: ['a worn track','#6f5a41','#a08967','#bcae90'],
 arena: ['arena sand','#9d8a68','#c8b48c','#e0d4b4'],
 shingle:['the pale shingle of the riverbank','#8a7f68','#b8ab8c','#d3c8ad'],
 river: ['the water at the river\'s edge','#34575b','#5b8987','#93aa95'],
 marsh: ['Willowmere marsh','#45553a','#768b57','#a9b584'],
 amber: ['Amberwood leaves','#6a3c1b','#ad6c2c','#d6a458'],
 desert:['Coyote Canyon sand','#957c5e','#cbb58c','#e6dab9'],
 ochre: ['Ochre Reach red rock','#86553b','#b77b55','#d8aa84'],
 snow:  ['Hollowpeak snow','#9ea8b3','#d3d9e0','#eef1f4'],
 tundra:['Frostpine snow and stone','#5f6b5c','#9aa597','#cfd5cf'],
 rock:  ['bare stone','#5a5752','#88837c','#aea99f'],
};

/* ---- coat themes (equine-fantasy.js): fx may read _l,_fres,vMapUv,uTime,uGlow,uC0-2,_hash --------- */
/* The camouflage coat: three fields of soft value noise over the coat, their edges warped by a fourth,
   thresholded into small ragged dark, light and mid blotches over the base colour (four tones in all)
   and a fine mottle over everything, so it reads as disruptive camouflage and not a flat recolour or
   big two-tone paint-horse patches; the texture's own shading kept underneath. The model's darkest
   texels (the palomino's hooves and muzzle) take a shaded dark-blotch colour rather than black, so no
   black stockings give it away on snow or sand. uC0/uC1/uC2 are dark/base/light; uGlow is the shimmer,
   0 at rest, which runs a band of light and a scatter of glints over the coat while it changes. NB_SEED
   shifts the pattern: every picture uses none, a horse standing in the world gets its own (makeLive),
   so two Chameleons in one pasture are not twins. */
const CAMO_FX=`
#ifndef NB_SEED
#define NB_SEED vec2(0.0)
#endif
#define NB_CF(v) (fract(v)*fract(v)*(3.0-2.0*fract(v)))
#define NB_CN(v) mix(mix(_hash(floor(v)),_hash(floor(v)+vec2(1.0,0.0)),NB_CF(v).x),mix(_hash(floor(v)+vec2(0.0,1.0)),_hash(floor(v)+vec2(1.0,1.0)),NB_CF(v).x),NB_CF(v).y)
   vec2 _cu=vMapUv+NB_SEED;
   vec2 _cw=_cu+vec2(NB_CN(_cu*17.0+5.2),NB_CN(_cu*17.0+17.9))*0.06;
   float _ca=NB_CN(_cw*vec2(21.0,16.0))*0.62+NB_CN(_cw*vec2(46.0,37.0)+7.3)*0.38;
   float _cb=NB_CN(_cw*vec2(19.0,15.0)+19.7)*0.62+NB_CN(_cw*vec2(43.0,34.0)+41.3)*0.38;
   float _cm=NB_CN(_cw*vec2(24.0,18.0)+88.1)*0.6+NB_CN(_cw*vec2(52.0,40.0)+3.7)*0.4;
   float _dk=smoothstep(0.54,0.58,_ca);
   float _lt=smoothstep(0.55,0.59,_cb)*(1.0-_dk);
   float _md=smoothstep(0.56,0.60,_cm)*(1.0-_dk)*(1.0-_lt);
   vec3 _cc=mix(mix(uC1,uC0,_dk),mix(uC1,uC2,0.8),_lt);
   _cc=mix(_cc,mix(uC1,uC0,0.5),_md);
   _cc*=0.93+0.14*NB_CN(_cu*vec2(70.0,56.0));
   float _raw=dot(diffuseColor.rgb,vec3(0.299,0.587,0.114));
   float _tone=0.62+0.5*smoothstep(0.02,0.6,_l);
   _ramp=mix(mix(uC0*0.5,diffuseColor.rgb*0.35,0.4),_cc*_tone,smoothstep(0.004,0.02,_raw));
   float _sw=pow(max(0.0,sin(vMapUv.x*16.0+vMapUv.y*7.0-uTime*6.0)),8.0);
   float _sp=step(0.985,_hash(floor(vMapUv*130.0)+floor(uTime*8.0)));
   _ramp=mix(_ramp,_ramp*1.25+0.03,(_sw*0.6+_sp*0.5)*uGlow);
   _emis=(mix(uC2,vec3(1.0),0.55)*(_sw*0.55+_fres*0.35)+vec3(1.0)*_sp*0.9)*uGlow;`;
/* Fireflies: points of warm light drifting slowly over a dusk-green coat, each blinking on its own clock:
   a small hot golden core in a soft warm halo, so in daylight they read as glowing fireflies and not as
   pale spots or snow. */
const FIREFLY_FX=`float _ff=0.0,_hal=0.0;
   {vec2 _g=vMapUv*vec2(30.0,22.0); vec2 _c=floor(_g); vec2 _f=fract(_g)-0.5; float _r=_hash(_c+17.0);
    if(_r>0.78){ vec2 _o=vec2(_hash(_c+3.1),_hash(_c+7.7))-0.5; _o+=0.22*vec2(sin(uTime*0.6+_r*40.0),cos(uTime*0.8+_r*23.0));
     float _d=length(_f-_o*0.55); float _bl=smoothstep(0.35,1.0,0.5+0.5*sin(uTime*(1.2+_r*1.6)+_r*60.0));
     _ff=(1.0-smoothstep(0.02,0.12,_d))*_bl; _hal=(1.0-smoothstep(0.05,0.5,_d))*_bl; }}
   _ramp=mix(_ramp,vec3(1.0,0.86,0.30),_ff*0.7);
   _ramp=mix(_ramp,_ramp+vec3(0.35,0.30,0.05),_hal*0.45);
   _emis=_ramp*uGlow*(0.06+0.3*_l)+vec3(1.0,0.80,0.22)*_ff*2.4+vec3(1.0,0.78,0.25)*_hal*0.55+vec3(0.5,0.85,0.35)*_fres*0.22;`;
/* Opal: a pearly coat with a soft rainbow that slides round as the horse turns, and a few glints. */
const OPAL_FX=`float _oa=sin(vMapUv.x*13.0+vMapUv.y*8.0+uTime*0.5)*0.5+0.5;
   vec3 _oc=0.5+0.5*cos(6.2832*(vec3(0.0,0.33,0.67)+_oa*0.7+_fres*0.8));
   _ramp=mix(_ramp,_ramp*(0.8+0.4*_oc),0.45+0.35*_fres);
   vec2 _ogp=vMapUv*70.0;
   float _og=step(0.995,_hash(floor(_ogp)))*(1.0-smoothstep(0.03,0.20,length(fract(_ogp)-0.5)))*(0.5+0.5*sin(uTime*3.0+vMapUv.x*50.0));
   _ramp+=vec3(1.0)*_og*0.25;
   _emis=_ramp*uGlow*(0.08+0.3*_l)+_oc*_fres*0.4+vec3(1.0)*_og*0.28;`;
/* Dawn: a sunrise on the horse, rose along the belly and legs rising to warm gold along the back, a rim
   of morning light that breathes slowly, and a ray passing now and then. */
const DAWN_FX=`float _br=0.62+0.38*sin(uTime*0.8);
   float _up=clamp(normalize(vNormal).y*0.5+0.5,0.0,1.0);
   _ramp=mix(_ramp*vec3(0.97,0.80,0.86),_ramp*vec3(1.06,1.0,0.78)+vec3(0.10,0.07,0.0),smoothstep(0.30,0.85,_up));
   float _ray=pow(max(0.0,sin(vMapUv.x*22.0+vMapUv.y*5.0-uTime*1.1)),14.0)*smoothstep(0.25,0.9,_l);
   _ramp=mix(_ramp,vec3(1.0,0.86,0.6),_ray*0.45);
   _ramp=mix(_ramp,vec3(1.0,0.82,0.55),_fres*0.5);
   _emis=_ramp*uGlow*(0.1+0.45*_l)*_br+vec3(1.0,0.72,0.40)*_fres*0.8*_br+vec3(1.0,0.88,0.58)*_ray*0.5;`;
const THEMES={
 camo:{cfg:{ramp:[GROUNDS.meadow[1],GROUNDS.meadow[2],GROUNDS.meadow[3]],glow:0,rough:0.82},fx:CAMO_FX,base:'#6b853e',coat:{emissive:0x000000,ei:0,rough:0.85},
  wing:{a:'#8a9a5a',b:'#3d5126',e:'#000000',ei:0},drg:{web:'#6b853e',root:'#2a3319',bone:'#1e2412',glow:'#a3ad72',head:'#4a5a2c',ridge:'#927f4d'},elem:'arcane'},
 firefly:{cfg:{ramp:['#1c3322','#4a7a52','#c3dd88'],glow:0.45,rough:0.7},fx:FIREFLY_FX,base:'#223a28',coat:{emissive:0xd8c860,ei:0.25,rough:0.7},
  wing:{a:'#b8d078',b:'#1c3020',e:'#e0d060',ei:0.35},drg:{web:'#b8d078',root:'#0e1c12',bone:'#0a120d',glow:'#ffe680',head:'#223a28',ridge:'#e0d060'},elem:'fire'},
 opal:{cfg:{ramp:['#8a86a0','#d6d0e4','#f2eef8'],glow:0.3,rough:0.45},fx:OPAL_FX,base:'#c9c2d9',coat:{emissive:0xd8c8ff,ei:0.25,rough:0.45},
  wing:{a:'#f4f0ff',b:'#9c94b8',e:'#d8c8ff',ei:0.35},drg:{web:'#e8dcff',root:'#4a4660',bone:'#2e2a40',glow:'#f4ecff',head:'#8a84a6',ridge:'#f4ecff'},elem:'arcane'},
 dawn:{cfg:{ramp:['#7a3a52','#e98a78','#ffe3a0'],glow:0.55,rough:0.6},fx:DAWN_FX,base:'#e98a78',coat:{emissive:0xff9a60,ei:0.35,rough:0.6},
  wing:{a:'#ffd79a',b:'#b0503c',e:'#ff9a60',ei:0.4},drg:{web:'#ffc080',root:'#4a1f24',bone:'#2e1216',glow:'#ffe0a6',head:'#8a3e32',ridge:'#ffe0a6'},elem:'fire'},
};

/* ---- the camouflage timing ---------------------------------------------------------------- */
const SAMPLE_S=0.25;        // the ground is read four times a second per camouflage horse
const TAU=0.45;             // the coat's easing time: about 95% of the way there in a second and a half
const SHIFT=0.14;           // how far the palette must move (linear RGB, base colour) before it shimmers: a new country, not a road
const SHIM_S=1.3, SHIM_GLOW=0.85, SHIM_COOL=2.5;
const PATH_W=2.9;           // ranch3d.html's road width

/* ---------------------------------------------------------------------------------------
   INSTALL
   --------------------------------------------------------------------------------------- */
export function install(G){
 const {THREE,$,toast}=G, T=G.tables, H=G.horse, W=G.world, BREEDS3=T.BREEDS3, R=H.roster;
 const byKey=k=>BREEDS3.find(b=>b[0]===k);
 const rowOf=k=>ROWS.find(r=>r[0]===k);
 const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const isCamoH=h=>!!(h&&h.coat==='camo');
 /* Whether a camouflage horse is wearing the plain coat instead: configureArtistCustomization's own test
    (a body colour, pattern, pattern colour or leg/face white other than the row's is a dye). */
 function camoCovered(h){
  const b=h&&byKey(h.breed); if(!b)return false; const o=b[7]||{}, L=v=>String(v||'').toLowerCase();
  const body=h.colors&&h.colors.body, customBody=!!body&&L(body)!==L(b[5]), customMarkCol=!!h.markCol&&L(h.markCol)!==L(o.markCol||'#f2ece0');
  const customMark=h.mark!=null&&!(h.mark==='none'&&!customBody&&!customMarkCol);
  return customBody||customMark||customMarkCol||!!(h.mark2&&h.mark2!=='none');
 }

 /* ---- 1. rows, bodies, coats, ceilings, perks, sources ------------------------------------ */
 for(const r of ROWS){ if(!byKey(r[0]))BREEDS3.push(r); }
 try{for(const r of ROWS){if(r[7].body&&H.breedModels&&H.breedModels.alias)H.breedModels.alias(r[0],r[7].body,r);}}catch(e){}
 for(const k in CEIL){const c=CEIL[k];T.BREED_CEIL[k]={speed:c[0],stamina:c[1],jump:c[2],accel:c[3],agility:c[4]};}
 if(R){
  for(const k in COATS)if(!R.COATS3[k])R.COATS3[k]=COATS[k].map(v=>{const o=v.slice();if(R.tameHex)o[2]=R.tameHex(o[2]);return o;});   // the roster's soft knee on pale coats, as its own table gets
  for(const k in PERKS)if(!R.BREED_PERKS[k])R.BREED_PERKS[k]=PERKS[k];
  if(R.FANTASY_CEIL)for(const k of ['chameleon','firefly','opaline','daybreak']){const c=CEIL[k];if(!R.FANTASY_CEIL[k])R.FANTASY_CEIL[k]={speed:c[0],stamina:c[1],jump:c[2],accel:c[3],agility:c[4]};}
  if(R.SRC_LABEL&&!R.SRC_LABEL.loyal)R.SRC_LABEL.loyal='Ride on five different days in one week';
 }
 /* The Chameleon Mustang is a shelf horse, but only the shelf: it never turns up on the market board and
    the Summoning Stall only has it through the Starfall Call's own printed chance (below). */
 H.sourceRule((ctx,b)=>{if(b&&b[0]===CAMO&&(ctx==='summon'||ctx==='market'))return false;return undefined;});
 /* The Camargue is wild: the river meadow herd by the stream, and the odd stray. */
 if(T.WILD_BREEDS&&!T.WILD_BREEDS.some(w=>w.breed==='camargue'))T.WILD_BREEDS.push({breed:'camargue',variant:'Camargue',body:'#c9cac5',mane:'#e6e4de',base:5,region:'meadows'});

 /* ---- 2. coat themes and appearances --------------------------------------------------------- */
 for(const k in THEMES){const th=THEMES[k];
  registerFantasyTheme(k,th.cfg,th.fx);
  if(T.FANTASY_CFG&&!T.FANTASY_CFG[k]){T.FANTASY_CFG[k]=th.cfg;T.FANTASY_FX[k]=th.fx;}
  if(T.FANTASY_COAT&&!T.FANTASY_COAT[k])T.FANTASY_COAT[k]=th.coat;
  if(T.COAT_BASE&&!T.COAT_BASE[k])T.COAT_BASE[k]=th.base;
  if(T.WING_TINT&&!T.WING_TINT[k])T.WING_TINT[k]=th.wing;
  if(T.DRAGON_TINT&&!T.DRAGON_TINT[k])T.DRAGON_TINT[k]=th.drg;
  if(T.ELEM_OF&&!T.ELEM_OF[k])T.ELEM_OF[k]=th.elem;
 }
 for(const r of ROWS){const o=r[7];if(!o.coat)continue;
  registerFantasyAppearance(r[0],Object.assign({theme:o.coat,mane:o.maneCol||r[6]},o.horn?{horn:true}:{}));}

 /* the breeding package installs after this one, so its gene table and its wild coats are met at boot
    (G.breeding.WILD_COATS is the very object its taming hook reads) */
 G.on('boot',()=>{try{const B=G.breeding&&G.breeding.BREED_GENES;if(B)for(const k in GENES)if(!B[k])B[k]=GENES[k];}catch(e){}
  try{const WC=G.breeding&&G.breeding.WILD_COATS;if(WC&&!WC.camargue)WC.camargue=Object.assign({},WILD_COAT);}catch(e){}});

 /* ---- 3. arrivals ------------------------------------------------------------------------------ */
 const lc=v=>String(v==null?'':v).toLowerCase();
 /* The breed's true mane (see ROWS): a horse that arrives wearing the model's own mane column gets the
    breed's instead. A real breed standing on another breed's model also needs its own pattern switched
    on, or the model's authored texture (an Icelandic's brown under a Connemara) shows through: the
    roster's coat roll always sets one, but a horse that arrives with its colours already chosen (a tamed
    Camargue) does not. */
 function trueMane(h,r){const o=r[7];if(o.maneCol&&(!h.colors||!h.colors.mane||lc(h.colors.mane)===lc(r[6])))h.colors=Object.assign({},h.colors,{mane:o.maneCol});}
 G.on('grantHorse',(s,h)=>{const r=h&&rowOf(h.breed);if(!r)return;const o=r[7];
  trueMane(h,r);
  if(o.coat){if(h.mark2)h.mark2=null;return;}   // leg or face white would put the plain coat over the theme (the roster rolls it for a horse given with its colours)
  if(h.mark==null)h.mark=o.mark||'none';});
 /* Foals, registered at boot so this runs after the breeding package's foal hook, which installs later
    and rewrites a foal's colours and pattern from its genes:
    - a camouflage foal wears its breed's own body colour, no pattern and no leg or face white. makeFoal
      blends the parents' body colours, and a blended body counts as a dye (configureArtistCustomization
      then puts the plain coat on), which would switch the camouflage off for good;
    - a real-breed foal whose genes chose no pattern (chestnut, palomino, cremello...) has its mark deleted
      by breeding; 'none' makes it a plain colour instead of the borrowed model's authored texture (the
      Percheron's dapple grey under a Suffolk foal);
    - a fantasy foal put back to its row's colours (a pairing that rebuilds it as its breed) gets the
      coat's own mane, like any arrival. A real-breed foal keeps the mane its genes gave it even when that
      happens to be the model's own mane column: that shows the model's hair, of the same colour (a grey
      Lusitano foal's grey mane), where the breed's default would be wrong. */
 G.on('boot',()=>G.on('foal',(s,foal)=>{try{
  if(!foal)return; const r=rowOf(foal.breed);
  if(foal.coat==='camo'){const b=byKey(foal.breed);if(b){foal.colors={body:b[5],mane:(r&&r[7].maneCol)||b[6]};foal.mark='none';delete foal.markCol;foal.mark2=null;foal.variant=null;}return;}
  if(!r)return;
  if(r[7].coat){if(foal.colors)trueMane(foal,r);return;}
  if(!foal.coat&&foal.mark==null)foal.mark='none';
 }catch(e){}}));

 /* ---- 4. the ground under a horse ------------------------------------------------------------ */
 const PALF={};   // linear RGB, dark/base/light, nine floats a palette
 function palette(k){const c=new THREE.Color(),g=GROUNDS[k],a=PALF[k]||new Float32Array(9);for(let i=0;i<3;i++){c.set(g[i+1]);a[i*3]=c.r;a[i*3+1]=c.g;a[i*3+2]=c.b;}PALF[k]=a;}
 for(const k in GROUNDS)palette(k);
 const ss=(a,b,x)=>{const t=x<=a?0:x>=b?1:(x-a)/(b-a);return t*t*(3-2*t);};
 const hyp=Math.hypot;
 /* trees, bucketed so the canopy test looks at a handful of them */
 let TREES=null, treeN=-1;
 function buildTrees(){const fp=W.forestPoints||[];treeN=fp.length;TREES=new Map();
  for(const t of fp){if(!t||!isFinite(t.x))continue;const k=((Math.floor(t.x/16)+64)<<8)|(Math.floor(t.z/16)+64);let a=TREES.get(k);if(!a){a=[];TREES.set(k,a);}a.push(t);}}
 function canopyAt(x,z){
  if(!TREES||(W.forestPoints&&W.forestPoints.length!==treeN))buildTrees();
  const cx=Math.floor(x/16)+64, cz=Math.floor(z/16)+64; let g=0;
  for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const a=TREES.get(((cx+i)<<8)|(cz+j));if(!a)continue;
   for(let n=0;n<a.length;n++){const t=a[n],r=5.5+(t.s||1)*2.2,d=hyp(x-t.x,z-t.z);if(d<r){const v=0.92*(1-ss(0.3*r,r,d));if(v>g)g=v;}}}
  return ss(0.10,0.80,g);
 }
 function mixIn(out,P,w){if(!(w>0.002))return;if(w>=0.999){out.set(P);return;}for(let i=0;i<9;i++)out[i]+=(P[i]-out[i])*w;}
 /* Fills out with the palette for (x,z) and returns the name of the ground that has most say. The
    regions and their soft edges are the terrain shader's own (assets/terrain-realism.js). */
 function groundAt(x,z,out){
  out.set(PALF.meadow); let top='meadow', tw=0.45;
  const put=(k,w)=>{if(!(w>0.002))return;mixIn(out,PALF[k],w);if(w>=tw){tw=w;top=k;}};
  put('forest',canopyAt(x,z)*0.6);   // grass still grows through most of it
  const rz=W.riverZ?W.riverZ(x):120+Math.sin(x*0.012)*45, rd=Math.abs(z-rz);
  const sd=z<158?Math.abs(x-(118+Math.sin(z*0.03)*14+Math.sin(z*0.011+3)*8)):1e9;
  const live=1-ss(158,166,z), wd=R&&R.waterDepth?R.waterDepth(x,z):0;
  put('shingle',Math.max(1-ss(3.8,9.8,rd),(1-ss(1.3,5.0,sd))*live)*0.95);                    // pale stones up the bank
  put('river',Math.max(1-ss(2.5,5.0,rd),(1-ss(0.8,2.5,sd))*live,1-ss(4.5,9.5,hyp(x-20,z-16)),wd>0.05?1:0)*0.95);   // wet silt at the waterline, and in the water
  if(W.pathDist)put('track',(1-ss(PATH_W*0.45,PATH_W*1.25,W.pathDist(x,z)))*0.8);
  let grade=0; if(W.terrainH){const gx=W.terrainH(x+1,z)-W.terrainH(x-1,z), gz=W.terrainH(x,z+1)-W.terrainH(x,z-1); grade=hyp(gx,gz)/2;}
  put('rock',ss(0.42,1.0,grade)*0.9);
  put('desert',(1-ss(96,172,hyp(x+220,z-130)))*0.96);
  put('snow',(1-ss(88,158,hyp(x+160,z+210)))*(1-ss(0.2,0.58,grade))*0.98);
  put('amber',(1-ss(86,132,hyp(x-300,z+300)))*0.5);    // half: on screen Amberwood's floor is mostly olive grass under the leaves
  put('marsh',(1-ss(76,124,hyp(x-310,z-300)))*0.92);
  put('tundra',(1-ss(80,128,hyp(x+300,z+320)))*0.88);
  put('ochre',(1-ss(80,128,hyp(x+330,z-300)))*0.94);
  const e=(x/23.5)*(x/23.5)+(z/18.5)*(z/18.5); put('arena',1-ss(0.82,1.0,e));
  return top;
 }

 /* ---- 5. the live coat ------------------------------------------------------------------------ */
 /* One state per body mesh: the live material, its uniforms once the renderer has compiled it, the
    target and current palettes, the shimmer clock and the hair colours. Keyed by the mesh, so a horse
    that is put away takes its state with it. */
 const STATE=new WeakMap();
 const _c=new THREE.Color();
 function newState(){return {live:null,U:null,tgt:new Float32Array(9),cur:new Float32Array(9),anchor:new Float32Array(9),
  maneT:new Float32Array(3),mane:new Float32Array(3),tailT:new Float32Array(3),tail:new Float32Array(3),init:false,hairInit:false,sT:0,shim:0,cool:0,top:'meadow',dyes:null,dyeScene:null,shifts:0,
  seed:new THREE.Vector2(),hid:undefined};}
 const isStatic=m=>!!(m&&m.name==='EquineFantasy_camo');
 function writeU(st){
  const U=st.U; if(!U||!U.uC0)return; const c=st.cur;
  U.uC0.value.setRGB(c[0],c[1],c[2]); U.uC1.value.setRGB(c[3],c[4],c[5]); U.uC2.value.setRGB(c[6],c[7],c[8]);
  U.uGlow.value=st.shim>0?Math.sin(Math.PI*(1-st.shim/SHIM_S))*SHIM_GLOW:0;
 }
 /* Each horse's own blotch layout: an offset into the pattern from its id (a few pattern cells either
    way, small enough to keep the shader's hash precise), the same on every device. */
 function seedOf(h,v){
  const id=h&&h.id, n=Number.isFinite(Number(id))?Number(id):Array.from(String(id==null?'':id)).reduce((a,c)=>(a*31+c.charCodeAt(0))%100003,7);
  const fr=x=>x-Math.floor(x); return v.set(fr(n*0.6180339887+0.13)*1.7,fr(n*0.7548776662+0.41)*1.3);
 }
 /* The live copy is built by the same function as every picture of the coat, from the same theme; the
    wrapper keeps hold of its uniforms and feeds the pattern its per-horse offset (NB_SEED in CAMO_FX),
    which makes it a program of its own, shared by every horse in the world wearing the live coat. */
 function makeLive(base,st){
  const live=createEquineFantasyCoat(THREE,base,'camo',false);
  const up=live.userData.update; live.userData={update:up};          // nothing of the old material's userData comes along (a copied Color would turn into a number)
  live.name='EquineFantasy_camo_live';
  live.customProgramCacheKey=()=>'EquineFantasy_camo_live_seeded';
  const ob=live.onBeforeCompile;
  live.onBeforeCompile=function(sh,r){ob.call(this,sh,r);
   sh.uniforms.uNbSeed={value:st.seed};
   sh.fragmentShader='#define NB_SEED uNbSeed\nuniform vec2 uNbSeed;\n'+sh.fragmentShader;
   st.U=sh.uniforms;if(st.init)writeU(st);};
  return live;
 }
 /* the coat dirt bond-personality-emotes lays on the ridden horse stays on through the swap */
 function carryDirt(from,to){try{const cc=from.userData&&from.userData.cleanColor;if(cc&&cc.isColor){to.userData.cleanColor=cc.clone();to.color.copy(from.color);}}catch(e){}}
 function hairFree(h){const r=rowOf(h.breed);if(h.tailCol||!r)return false;const m=h.colors&&h.colors.mane,d=r[7].maneCol||r[6];return !m||String(m).toLowerCase()===d.toLowerCase();}   // a dyed mane or tail is the player's, and stays
 function collectDyes(scene){const out=[];scene.traverse(o=>{if(!o.isMesh)return;const ms=Array.isArray(o.material)?o.material:[o.material];for(const m of ms){const d=m&&m.userData&&m.userData.artistGroomDye;if(d&&out.indexOf(d)<0)out.push(d);}});return out;}
 const hexOf=(a,i)=>'#'+_c.setRGB(a[i],a[i+1],a[i+2]).getHexString();
 function hairTargets(st){
  const t=st.tgt;
  for(let i=0;i<3;i++)st.maneT[i]=(t[i]*0.65+t[3+i]*0.35)*0.8;               // the mane sits a shade under the dark blotches
  let tail=hexOf(st.maneT,0); try{if(R&&R.tailFromMane)tail=R.tailFromMane(tail);}catch(e){}   // the tail the roster would give that mane, so the two never argue
  _c.set(tail); st.tailT[0]=_c.r; st.tailT[1]=_c.g; st.tailT[2]=_c.b;
 }
 function visit(skin,h,x,z,groom,scene,dt){
  if(!skin)return null;
  let st=STATE.get(skin); const m=skin.material;
  if(!st){if(!isStatic(m))return null;st=newState();STATE.set(skin,st);}
  if(m!==st.live){
   if(!isStatic(m))return null;                        // a dye or a different coat: that look belongs to the player, and there is no camouflage while it lasts
   if(!st.live)st.live=makeLive(m,st);
   carryDirt(m,st.live); skin.material=st.live;
  }
  if(h&&h.id!==st.hid){st.hid=h.id;seedOf(h,st.seed);}   // the uniform holds this very vector
  st.sT-=dt;
  if(st.sT<=0){
   st.sT=SAMPLE_S; st.top=groundAt(x,z,st.tgt);
   if(!st.init){st.cur.set(st.tgt);st.anchor.set(st.tgt);st.init=true;}
   else{const a=st.anchor,t=st.tgt;if(hyp(t[3]-a[3],t[4]-a[4],t[5]-a[5])>SHIFT){st.anchor.set(t);if(st.cool<=0){st.shim=SHIM_S;st.cool=SHIM_COOL;st.shifts++;}}}
   hairTargets(st); if(!st.hairInit){st.mane.set(st.maneT);st.tail.set(st.tailT);st.hairInit=true;}
  }
  const k=1-Math.exp(-dt/TAU), c=st.cur, t=st.tgt;
  for(let i=0;i<9;i++)c[i]+=(t[i]-c[i])*k;
  for(let i=0;i<3;i++){st.mane[i]+=(st.maneT[i]-st.mane[i])*k;st.tail[i]+=(st.tailT[i]-st.tail[i])*k;}
  if(st.shim>0)st.shim=Math.max(0,st.shim-dt); if(st.cool>0)st.cool-=dt;
  writeU(st);
  if(groom&&scene&&groom.setColors&&hairFree(h)){
   if(!st.dyes||st.dyeScene!==scene){st.dyes=collectDyes(scene);st.dyeScene=scene;}
   if(!st.dyes.length||st.dyes[0].maneOverride!==1){                  // a recolour elsewhere switched our hair colour off: back on
    try{groom.setColors({maneColor:hexOf(st.mane,0),tailColor:hexOf(st.tail,0),maneOverride:true,tailOverride:true});}catch(e){}
    st.dyes=collectDyes(scene);
   }
   for(let i=0;i<st.dyes.length;i++){const d=st.dyes[i];d.mane.setRGB(st.mane[0],st.mane[1],st.mane[2]);d.tail.setRGB(st.tail[0],st.tail[1],st.tail[2]);}
  }
  return st;
 }
 /* the horse left standing while the rider is on foot: its body mesh, found once */
 const SKIN_OF=new WeakMap();
 function skinIn(group){
  if(!group)return null; let s=SKIN_OF.get(group); if(s&&s.parent)return s; s=null;
  group.traverse(o=>{if(!s&&o.isSkinnedMesh&&o.material&&/^EquineFantasy_camo/.test(o.material.name||''))s=o;});
  if(s)SKIN_OF.set(group,s); return s;
 }
 let ofT=0, ofGroup=null, playerSt=null, ridingCamo=false;
 function tickCamo(dt){
  const p=H.player, RIG=H.RIG(), hr=H.ridden(), mine=H.myHorses;
  const onFoot=!!(G.onFoot&&G.onFoot.on);
  ridingCamo=false; playerSt=null;
  if(RIG&&RIG.skin&&isCamoH(hr)&&RIG.attachedTo===p.mesh){playerSt=visit(RIG.skin,hr,p.pos.x,p.pos.z,RIG.groom||RIG.hair,RIG.scene,dt);ridingCamo=!onFoot&&!!playerSt;}
  const herd=H.herd();
  for(let i=0;i<herd.length;i++){const a=herd[i];if(!a.rig)continue;const hh=mine[a.idx];if(isCamoH(hh))visit(a.rig.skin,hh,a.pos.x,a.pos.z,a.rig.hair||a.rig.groom,a.rig.scene,dt);}
  const RS=G.ranchSys;
  if(RS&&RS.barnHorses){const bh=RS.barnHorses();for(let i=0;i<bh.length;i++){const b=bh[i];if(!b.rig)continue;const hh=mine[b.idx];if(isCamoH(hh)){const gp=b.parts.group.position;visit(b.rig.skin,hh,gp.x,gp.z,b.rig.hair||b.rig.groom,b.rig.scene,dt);}}}
  if(G.ranch&&G.ranch.standing){const sd=G.ranch.standing();for(let i=0;i<sd.length;i++){const b=sd[i];if(!b.rig)continue;const hh=mine[b.idx];if(isCamoH(hh)){const gp=b.parts.group.position;visit(b.rig.skin,hh,gp.x,gp.z,b.rig.hair||b.rig.groom,b.rig.scene,dt);}}}
  if(onFoot&&isCamoH(hr)){
   ofT-=dt; if(ofT<=0){ofT=SAMPLE_S;try{const o=G.onFoot.horse();ofGroup=o?o.group:null;}catch(e){ofGroup=null;}}
   const sk=skinIn(ofGroup); if(sk)visit(sk,hr,ofGroup.position.x,ofGroup.position.z,null,null,dt);
  }else ofGroup=null;
 }
 /* The gentle bonus: riding the Chameleon Mustang, a spooked wild horse settles twice as fast, and one
    you stand quietly near (within nine metres rather than five and a half) warms to you a little. */
 function tickWild(dt){
  const P=G.worldPkg; if(!ridingCamo||!P||!P.herds)return;
  const p=H.player, sp=Math.abs(p.speed||0);
  for(let i=0;i<P.herds.length;i++){const L=P.herds[i].members||[];
   for(let j=0;j<L.length;j++){const m=L[j];if(!m||!m.pos)continue;const dx=m.pos.x-p.pos.x,dz=m.pos.z-p.pos.z,d2=dx*dx+dz*dz;if(d2>400)continue;
    if(m.flee>0)m.flee=Math.max(0,m.flee-dt);
    else if(sp<2&&d2<81&&d2>30.25&&!m.follow)m.trust=Math.min(100,(m.trust||0)+dt*4);}}
 }
 G.on('tick',dt=>{
  dt=Math.min(0.1,Math.max(0,+dt||0));
  try{tickCamo(dt);}catch(e){if(!tickCamo.warned){tickCamo.warned=1;console.warn('new-breeds camouflage',e);}}
  try{tickWild(dt);}catch(e){}
 });
 /* after any recolour of the ridden horse, straight back to the live coat (before the dirt goes on) */
 G.on('coat',()=>{try{const RIG=H.RIG(),hr=H.ridden();if(RIG&&RIG.skin&&isCamoH(hr))visit(RIG.skin,hr,H.player.pos.x,H.player.pos.z,RIG.groom||RIG.hair,RIG.scene,0);}catch(e){}});

 /* ---- 6. the Starfall Call's printed chance -------------------------------------------------- */
 /* Added at boot so it runs after the Market's own draw hook (pity, the no-repeat promise). */
 G.on('boot',()=>{
  G.on('summonDraw',(D)=>{try{if(D&&D.tier&&D.tier.id==='starfall'&&Math.random()<ODDS.starfall){const b=byKey(CAMO);if(b){D.breed=b;D.rar='Legendary';D.extra=D.extra||{};D.extra.chameleon=1;}}}catch(e){}});
 });
 G.on('summonDone',(sv,D,h)=>{if(D&&D.extra&&D.extra.chameleon&&h)setTimeout(()=>{try{toast(h.name+' the Chameleon Mustang stepped out of the Starfall Call. That is a one in two hundred horse!');}catch(e){}},900);});
 const starfallTxt=()=>'Chameleon Mustang '+(ODDS.starfall*100).toFixed(1).replace(/\.0$/,'')+'% on every call';
 G.ui.section('summonCard',(t)=>t&&t.id==='starfall'?'<div class="odds"><span class="sumOdd nb-odd" style="background:#dfeccb;color:#2f3f1d">'+starfallTxt()+'</span></div>':'');

 /* ---- 7. a week of riding: the Daybreak Haflinger -------------------------------------------- */
 /* The week closes at start-up (ranch3d.html weekRoll), before any package is listening, so the one
    place the week is read is the boot pass, which looks at the closed week in s.wkLast. The roster does
    the same for its weekly horses; there is deliberately no 'weekRoll' listener here, since that hook only
    ever fires before this package exists. One Daybreak Haflinger per week. */
 function weekly(s,w){
  if(!s||!w||!w.week||(w.days||0)<LOYAL_DAYS||!R||!R.grantExclusive)return null;
  return R.grantExclusive(s,'daybreak',w.week,'Five days of riding in one week');
 }
 const announce=h=>setTimeout(()=>{try{H.reloadHorses();toast(h.name+' the Daybreak Haflinger has come to the ranch: five days of riding in one week!');}catch(e){}},1600);
 /* A fantasy horse given out before its row's body colour changed would now count as dyed and lose its
    coat theme: it takes the new default instead. */
 function migrate(sv){let n=0;for(const h of (sv&&sv.horses)||[]){const old=OLD_BODY[h&&h.breed],b=old&&byKey(h.breed);if(b&&h.colors&&lc(h.colors.body)===old){h.colors.body=b[5];n++;}}return n;}
 G.on('boot',()=>{let got=null,moved=0;try{G.save.sync(sv=>{moved=migrate(sv);got=weekly(sv,sv.wkLast);});}catch(e){}
  if(moved){try{H.reloadHorses();H.rebuildAll();}catch(e){}}
  if(got)announce(got);});

 /* ---- 8. what the player reads ---------------------------------------------------------------- */
 G.ui.careSection((s,h)=>{
  if(!h)return ''; const r=rowOf(h.breed); let x='';
  if(r)x+='<div style="font-size:11.5px;margin-top:4px"><b>'+esc(r[1])+'</b> · '+esc(DESC[r[0]])+'</div>';
  if(isCamoH(h)){const hr=H.ridden(), st=(hr&&hr.id===h.id&&playerSt)||null;
   x+='<div style="font-size:11.5px;margin-top:4px"><b>Camouflage</b> · '+(camoCovered(h)?'hidden under the dye just now: only its own coat takes on the ground, and wild horses notice it like any other horse.</div>'
    :(st?'the coat is matching <b>'+esc(GROUNDS[st.top][0])+'</b>. ':'the coat takes on the ground wherever it stands. ')
    +'Wild horses settle twice as fast after a spook, and warm to you from further off while you stand quietly.</div>');}
  return x;
 });
 /* The Market cards: a line of description under each new horse. The shop renderer is the roster's,
    and ui2-shop rebuilds its rows into cards, so the line goes in once they have settled. */
 const LBL2KEY=new Map(ROWS.map(r=>[r[1],r[0]]));
 const SP=$('shopPanel');
 if(!document.getElementById('nbCss')){const st=document.createElement('style');st.id='nbCss';
  st.textContent=`.nb-desc{font-size:11.5px;line-height:1.3;margin-top:3px;color:#6b5a46;font-weight:600;text-align:inherit}
#shopPanel.se-mk>.s2-row .nb-desc{color:#5b4f7c}
#nbConfirm{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;background:rgba(14,10,36,.55);font-family:Nunito,system-ui,sans-serif}
#nbConfirm.on{display:flex}
#nbConfirm .nbc{width:min(420px,calc(100vw - 32px));border-radius:16px;padding:18px 18px 16px;background:linear-gradient(180deg,#f6f3ff,#e7e0fb);color:#2a2046;box-shadow:0 10px 30px rgba(10,6,40,.5);text-align:center}
#nbConfirm .nbc b.t{display:block;font-size:19px;font-weight:900;margin-bottom:6px}
#nbConfirm .nbc p{margin:6px 0;font-size:13.5px;line-height:1.4;color:#4b3f6c}
#nbConfirm .nbc .row{display:flex;gap:10px;justify-content:center;margin-top:12px}
#nbConfirm .nbc button{min-height:40px;padding:6px 16px;border:0;border-radius:10px;font:900 14px Nunito,system-ui,sans-serif;cursor:pointer}
#nbConfirm .nbc button[data-nbc="yes"]{background:linear-gradient(180deg,#4c9a34,#2f7a2c);color:#fff}
#nbConfirm .nbc button[data-nbc="no"]{background:#d9d2ee;color:#2a2046}`;
  document.head.appendChild(st);}
 let pend=false;
 function tagShop(){
  pend=false; if(!SP||SP.style.display==='none')return;
  const rows=SP.querySelectorAll('.evrow');
  for(let i=0;i<rows.length;i++){const row=rows[i];if(row.querySelector('.nb-desc'))continue;
   const b=row.querySelector('.s2-title b')||row.querySelector('b');const k=b&&LBL2KEY.get((b.textContent||'').trim());if(!k)continue;
   const d=document.createElement('div');d.className='nb-desc';d.textContent=DESC[k];(row.querySelector('.s2-copy')||row).appendChild(d);}
  /* the Market's Summon tab draws its own banner cards, so the Starfall Call's printed chance goes on here */
  const cards=SP.querySelectorAll('.sumTier');
  for(let i=0;i<cards.length;i++){const card=cards[i];if(card.querySelector('.nb-odd'))continue;
   if(!card.querySelector('[data-summon="starfall"],[data-fx$=":starfall"]'))continue;
   const chip=document.createElement('span');chip.className='sumOdd s2-note-chip nb-odd';chip.style.cssText='background:#dfeccb;color:#2f3f1d';chip.textContent=starfallTxt();
   let nd=card.querySelector('.s2-notes');if(!nd){nd=document.createElement('div');nd.className='s2-notes';const foot=card.querySelector('.s2-b-foot');card.insertBefore(nd,foot&&foot.parentNode===card?foot:null);}
   nd.appendChild(chip);}
 }
 if(SP)try{new MutationObserver(()=>{if(!pend){pend=true;requestAnimationFrame(tagShop);}}).observe(SP,{childList:true,subtree:true});}catch(e){}
 /* A hundred gems is days of riding, so the Chameleon Mustang asks before it spends them. Not enough
    gems and the click goes straight through to the game, which says so in its own words. */
 const box=document.createElement('div'); box.id='nbConfirm'; document.body.appendChild(box);
 let onYes=null;
 function ask(title,body,yes,fn){onYes=fn;box.innerHTML='<div class="nbc" role="dialog" aria-modal="true"><b class="t">'+esc(title)+'</b>'+body+'<div class="row"><button data-nbc="yes">'+esc(yes)+'</button><button data-nbc="no">Not now</button></div></div>';box.classList.add('on');}
 function closeAsk(){box.classList.remove('on');onYes=null;}
 box.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-nbc]');if(e.target===box||(b&&b.dataset.nbc==='no')){closeAsk();return;}if(b&&b.dataset.nbc==='yes'){const f=onYes;closeAsk();if(f)f();}});
 addEventListener('keydown',e=>{if(e.key==='Escape'&&box.classList.contains('on')){closeAsk();e.stopPropagation();}},true);
 if(SP)SP.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('[data-buyh]'); if(!b)return;
  const r=BREEDS3[+b.dataset.buyh]; if(!r||r[0]!==CAMO)return;
  if(b.dataset.nbOk==='1'){delete b.dataset.nbOk;return;}                // the confirmed click: on to the game's own buy
  const s=G.save.fresh()||{}; if((s.gems||0)<r[4])return;
  e.preventDefault(); e.stopPropagation();
  ask(r[1],'<p>'+esc(DESC[CAMO])+'</p><p>Spend <b>'+r[4]+' gems</b> on it? You have '+(s.gems||0)+'.</p>','Buy for '+r[4]+' gems',()=>{b.dataset.nbOk='1';b.click();});
 },true);

 /* ---- 9. for the other packages and for QA ------------------------------------------------- */
 function camoInfo(st){
  if(!st)return null; const c=st.cur,t=st.tgt; let d=0; for(let i=0;i<9;i++)d=Math.max(d,Math.abs(t[i]-c[i]));
  return {live:!!st.live,bound:!!st.U,ground:st.top,label:GROUNDS[st.top]?GROUNDS[st.top][0]:st.top,base:hexOf(c,3),dark:hexOf(c,0),light:hexOf(c,6),target:hexOf(t,3),
   uniform:st.U&&st.U.uC1?'#'+st.U.uC1.value.getHexString():null,glow:st.U&&st.U.uGlow?+st.U.uGlow.value.toFixed(3):0,shimmer:+st.shim.toFixed(2),shifts:st.shifts,settled:d<0.01,off:+d.toFixed(4),
   mane:hexOf(st.mane,0),seed:[+st.seed.x.toFixed(3),+st.seed.y.toFixed(3)]};
 }
 G.newBreeds={KEYS,ROWS,DESC,COATS,CEIL,PERKS,GENES,GROUNDS,THEMES:Object.keys(THEMES),CAMO,CAMO_GEMS,ODDS,LOYAL_DAYS,
  groundAt:(x,z)=>{const a=new Float32Array(9),k=groundAt(x,z,a);return {key:k,label:GROUNDS[k][0],dark:hexOf(a,0),base:hexOf(a,3),light:hexOf(a,6)};},
  camo:()=>camoInfo(playerSt),stateOf:skin=>camoInfo(STATE.get(skin)),isCamo:isCamoH,covered:camoCovered,weekly,WILD_COAT,ridingCamo:()=>ridingCamo,ask:(t,b,y,f)=>ask(t,'<p>'+esc(b)+'</p>',y,f),closeAsk,
  tune:(k,cols)=>{if(!GROUNDS[k]||!Array.isArray(cols)||cols.length!==3)return false;GROUNDS[k]=[GROUNDS[k][0]].concat(cols);palette(k);return true;}};   // for the calibration tools: try a palette live
 G.on('state',o=>{const ci=camoInfo(playerSt);o.newBreeds={rows:KEYS.filter(k=>!!byKey(k)).length,riding:ridingCamo,camo:ci?{ground:ci.ground,base:ci.base,target:ci.target,settled:ci.settled,live:ci.live}:null};});
}
