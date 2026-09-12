/* Feature package 'horse-roster' — the roster itself.
   Star rarity on every horse; named coats and procedural coats; per-fantasy stat ceilings and
   mastery perks; the fantasy catalogue with its sources (shop, Starfall call, season track,
   leaderboard, club, photo, breeding); seasonal releases and the Season Call; the elemental
   dragon family found by breeding; six-star breeding-only horses; acquisition traits; the
   swimming specialist and the water itself; the flying mastery track.

   Owned by this package: this file, the BREEDS3 rows it pushes, the fantasy themes it registers
   (assets/equine-fantasy.js), TIER_STARS/MARKS2 and the second marking layer of makeCoatMat.
   Nothing here runs at import time — everything happens in install(G). */
import {registerFantasyTheme,registerFantasyAppearance} from '../equine-fantasy.js?v=artist-breeds-1';
export const id='horse-roster';

/* ---------------------------------------------------------------------------------------
   DATA
   --------------------------------------------------------------------------------------- */
const STAR='⭐';
const SRC_LABEL={shop:'🛍️ Shop',summon:'✨ Starfall Call at the Summoning Stall',season:'🎟️ Season track',
 weekly:'🏅 A champion week on the weekly board (550 SP)',club:'🏰 Top of the club\'s weekly Star Points board',photo:'📷 First place in the weekly photo gallery',
 breed:'💞 Breeding only',story:'📜 The story',exclusive:'🎁 Exclusive reward',market:'🤝 Market',wild:'🐎 Tamed in the wild'};

/* Named coats. [id, label, body, mane, mark?, markCol?]. A named coat is still its breed for
   mastery and stats; the roll happens the moment a horse arrives. */
const COATS3={
 bay:[['sorrel','Sorrel','#9c4f23','#6e3617','none'],['palomino','Palomino','#d9a85c','#f4e6c5','none'],['buckskin','Buckskin','#c2a06a','#2a1f16','points','#241a12'],
  ['blueroan','Blue Roan','#4a4e58','#1d1c22','roan','#dfe3ea'],['grulla','Grulla','#7d7a70','#2a2622','dun','#3a3024'],['reddun','Red Dun','#c48a5a','#8a5230','dun','#6a3a1e'],
  ['champagne','Champagne','#c9a97a','#e8d8b8','dapple'],['blackpoints','Bay Points','#8a5a2b','#332214','points','#241a12'],['chestnutflax','Flaxen Chestnut','#a85a2a','#f2e2c0','none'],
  ['smokyblack','Smoky Black','#2e2a2a','#171515','sooty'],['leopardqh','Leopard','#efe6d8','#d8cfc0','leopard','#3a2a1e'],['tobianoqh','Tobiano','#8a5a2b','#3a2a1a','pinto','#f4efe4']],
 chestnut:[['shetlandbay','Bay','#7a4a28','#2a1c12','points','#20160f'],['shetlandblack','Black','#26262e','#101015','none'],['shetlandroan','Strawberry Roan','#9c4f23','#6e3617','roan','#e8dcc8'],['shetlandpie','Piebald','#26262e','#101015','pinto','#f4efe4']],
 palomino:[['gold','Golden','#d9a85c','#f4e6c5','sooty'],['cream','Cream','#efe0b8','#f8f2e0','none'],['darkgold','Dark Gold','#b88a3a','#e8d8a8','dapple'],['chocolate','Chocolate','#5a3a24','#f4e6c5','sooty'],['pintomustang','Pinto','#d9a85c','#f4e6c5','pinto','#f4efe4']],
 haflinger:[['flaxen','Flaxen','#c98643','#f7ecd4','dapple'],['liver','Liver','#7a4a2a','#f2e2c0','none'],['pale','Pale Gold','#d8a868','#fbf2dc','none'],['redflax','Red Flaxen','#a8562a','#f4e6c5','dapple']],
 grey:[['dapple','Dapple Grey','#b9bec6','#787f8a','dapple'],['fleabit','Flea-bitten','#d8dad8','#9a9c9a','roan','#8a6a5a'],['steel','Steel Grey','#7a828c','#3a3f48','none'],['pearl','Pearl','#e8e6df','#cfcbc0','none'],['rosegrey','Rose Grey','#c9b3ad','#8a7370','dapple']],
 black:[['jet','Jet Black','#26262e','#101015','sooty'],['white','White Hair','#26262e','#e8e8ec','sooty'],['mohawk','Mohawk','#1e1e24','#0c0c10','none'],['braided','Braided','#26262e','#151518','sooty'],['chestnutfr','Chestnut','#8a4a25','#5a2e18','none']],
 pinto:[['overo','Overo','#7d4f24','#3a2a1a','pinto','#f4efe4'],['tobiano','Tobiano','#5a3a24','#2a1a12','pinto','#f4efe4'],['blackpinto','Black Tobiano','#26262e','#101015','pinto','#f4efe4'],['palominopaint','Palomino Paint','#d9a85c','#f4e6c5','pinto','#fbf6ea'],
  ['sorrelpaint','Sorrel Overo','#a85a2a','#6e3617','pinto','#f4efe4'],['buckskinpaint','Buckskin Tobiano','#c2a06a','#2a1f16','pinto','#f4efe4'],['bluepaint','Blue Roan Paint','#4a4e58','#1d1c22','pinto','#e8eaf0'],['medicine','Medicine Hat','#efe6d8','#3a2a1a','pinto','#f8f4ec']],
 appaloosa:[['blanket','Blanket','#8a6a4a','#4a3a2a','appaloosa','#f2ece0'],['leopard','Leopard','#efe6d8','#3a2a1e','leopard','#3a2a1e'],['snowflake','Snowflake','#5a4a3a','#2a1e14','roan','#f2ece0'],['fewspot','Few-spot','#efe8dc','#d0c8b8','appaloosa','#f8f4ec'],['bayappy','Bay Blanket','#8a5a2b','#332214','appaloosa','#f2ece0']],
 sunset:[['sunset','Sunset','#c96a4f','#ffd166','dapple'],['flea','Flea-bitten Grey','#d8dad8','#9a9c9a','roan','#8a5a4a'],['blackarab','Black','#26262e','#101015','none'],['bayarab','Bay','#8a5a2b','#332214','points','#241a12'],['chestnutarab','Chestnut','#a85a2a','#7a3a18','none'],['greyarab','Grey','#c9ccd2','#8a8e96','dapple']],
 iceland:[['seal','Seal Brown','#6a4a32','#d8c49a','roan','#e6d8c0'],['silverdapple','Silver Dapple','#5a4a48','#d8d0c8','dapple'],['pintoice','Pinto','#6a4a32','#d8c49a','pinto','#f4efe4'],['dunice','Dun','#b89a6a','#3a3428','dun','#3a3024'],['chestnutice','Chestnut','#9c4f23','#f2e2c0','none']],
 welsh:[['welshgrey','Grey','#d8dad8','#bfc2c4','dapple'],['welshbay','Bay','#8d6742','#efe3c8','points','#2a1c12'],['welshchestnut','Chestnut','#a85a2a','#f2e2c0','none'],['welshpal','Palomino','#d9a85c','#f4e6c5','none']],
 stock:[['stockbay','Bay','#9a6a3a','#4a3020','roan','#e2d6c2'],['cremello','Cremello','#f2e8d0','#fbf5e6','none'],['greychimera','Grey Chimera','#a8adb4','#4a4e58','pinto','#e8eaf0'],['stockblack','Black','#26262e','#101015','none'],['stockchestnut','Chestnut','#a85a2a','#6e3617','none'],['stockbuck','Buckskin','#c2a06a','#2a1f16','points','#241a12']],
 fjord:[['browndun','Brown Dun','#c2a06a','#3a3428','dun','#3a3024'],['reddun','Red Dun','#d8a878','#5a3a24','dun','#5a3a24'],['greydun','Grey Dun','#b8b4a8','#3a3a38','dun','#2a2a28'],['whitedun','White Dun','#e8dcc0','#4a4438','dun','#4a4438']],
 morgan:[['morganbay','Bay','#5a3a24','#2a1a12','sooty'],['morganblack','Black','#26262e','#101015','none'],['morganchest','Chestnut','#a85a2a','#6e3617','none'],['morganpal','Palomino','#d9a85c','#f4e6c5','none']],
 thoro:[['darkbay','Dark Bay','#7a4a28','#2a1c12','points','#20160f'],['thorochest','Chestnut','#a85a2a','#6e3617','none'],['thorogrey','Grey','#c9ccd2','#8a8e96','dapple'],['thoroblack','Black','#26262e','#101015','none'],['thorobright','Bright Bay','#a06a3a','#2a1c12','points','#20160f']],
 knab:[['leopardknab','Leopard','#8a7a68','#5a5048','leopard','#f2ede2'],['blanketknab','Blanket','#5a4a3a','#2a1e14','appaloosa','#f2ece0'],['fewspotknab','Few-spot','#efe8dc','#d0c8b8','appaloosa','#f8f4ec']],
 vanner:[['vannerpie','Piebald','#4a3a30','#f0e6d2','pinto','#f4efe2'],['vannerskew','Skewbald','#8a5a2b','#f0e6d2','pinto','#f4efe2'],['vannerblag','Blagdon','#26262e','#e8e8ec','pinto','#f4efe2'],['vannersolid','Solid Black','#26262e','#151518','none']],
 marwari:[['marwaribay','Bay','#8a5a2b','#3a2418','points','#241a12'],['marwaripinto','Pinto','#8a5a2b','#3a2418','pinto','#efe6d6'],['marwarigrey','Grey','#c9ccd2','#8a8e96','dapple'],['marwarichest','Chestnut','#a85a2a','#6e3617','none']],
 lipiz:[['lipizwhite','White','#efece4','#e0ddd4','dapple'],['lipizgrey','Grey','#c9ccd2','#8a8e96','dapple'],['lipizbay','Bay','#8a5a2b','#332214','points','#241a12']],
 sport:[['sorreltob','Sorrel Tobiano','#a85a2a','#6e3617','pinto','#f4efe4'],['redroan','Red Roan','#9c4f23','#6e3617','roan','#e8dcc8'],['sportpie','Piebald','#2a2a30','#14141a','pinto','#f4efe4'],['sportpal','Palomino','#d9a85c','#f4e6c5','none'],
  ['leopardcross','Leopard Cross','#efe6d8','#3a2a1e','leopard','#3a2a1e'],['sportblue','Blue Roan','#4a4e58','#1d1c22','roan','#dfe3ea'],['sportblack','Black','#2a2a30','#14141a','sooty'],['sportbay','Bay','#8a5a2b','#332214','points','#241a12']],
 akhal:[['goldteke','Golden','#c9a24a','#e8d79a','metal','#fff2c0'],['creamteke','Cream','#efe0b8','#f8f2e0','metal','#fff8e0'],['bayteke','Bay','#8a5a2b','#332214','metal','#ffe8b0'],['blackteke','Raven','#26262e','#101015','metal','#d8d8e8']],
 percheron:[['perchgrey','Dapple Grey','#a8adb4','#6a6f78','dapple'],['perchblack','Black','#26262e','#101015','none'],['perchwhite','White','#e8e6df','#cfcbc0','none']],
 shire:[['shireblack','Black','#3a3530','#1d1a17','roan','#ded4c4'],['shirewhite','White','#e8e6df','#cfcbc0','none'],['shiregreytob','Grey Tobiano','#a8adb4','#6a6f78','pinto','#f4f2ec'],['shireblue','Blue Roan','#4a4e58','#1d1c22','roan','#dfe3ea'],['shireovero','Black Overo','#26262e','#101015','pinto','#f4efe4']],
 clyde:[['clydebay','Bay','#7a4526','#2e2018','pinto','#f0e8d8'],['lightning','Lightning Dapple','#8a8e96','#3a3a40','dapple'],['clydeblanket','Blanket Appaloosa','#6a4a32','#2a1e14','appaloosa','#f2ece0'],['strawberry','Strawberry Roan','#a85a3a','#6e3617','roan','#f0e2d8'],
  ['clydeblack','Black','#26262e','#101015','pinto','#f0e8d8'],['clydechest','Chestnut','#a85a2a','#6e3617','pinto','#f4efe4'],['clydegrey','Grey','#c9ccd2','#8a8e96','pinto','#f8f6f0']],
 pegasus:[['cloudwhite','Cloud White','#f2f5fb','#dfe7f4','none'],['nightfall','Nightfall','#2a2a3a','#14141c','none'],['dapplesilver','Dapple Silver','#b9bec6','#787f8a','dapple'],['dapplechest','Dapple Chestnut','#a85a2a','#6e3617','dapple'],['skyazure','Skyline Azure','#7fb0e0','#dfe7f4','dapple']],
 unicorn:[['moonpearl','Moon Pearl','#f6f3ff','#cdb4f9','none'],['roseunicorn','Rose Quartz','#f4d8e4','#e8a0c8','none'],['duskunicorn','Dusk Lilac','#b8a0d8','#6a4a9a','dapple']],
 kestrel:[['silver','Silver','#c9ced6','#eef2f7','none'],['moonsilver','Moonlit Silver','#d8dde6','#f6f8fb','dapple']],
};
const MARK2_WEIGHTS=[['none',52],['socks',14],['blaze',12],['star',10],['stockings',7],['snip',5]];

/* Every fantasy horse has its own five-stat ceiling — the "level 50 spread" — and a source. */
const FANTASY_CEIL={
 aether:{speed:10,stamina:10,accel:9,jump:8,agility:8}, sunspear:{speed:10,stamina:10,accel:9,jump:7,agility:9},
 meadowlight:{speed:9,stamina:8,accel:8,jump:10,agility:10}, tempest:{speed:9,stamina:9,accel:9,jump:9,agility:10},
 eclipse:{speed:10,stamina:9,accel:8,jump:9,agility:8}, glacier:{speed:9,stamina:10,accel:7,jump:9,agility:10},
 unicorn:{speed:9,stamina:10,accel:9,jump:9,agility:10}, pegasus:{speed:9,stamina:9,accel:8,jump:10,agility:10},
 celestial:{speed:9,stamina:10,accel:9,jump:9,agility:8}, ember:{speed:10,stamina:8,accel:9,jump:8,agility:10},
 frost:{speed:8,stamina:10,accel:9,jump:9,agility:8}, aurora:{speed:9,stamina:9,accel:9,jump:10,agility:9},
 phoenix:{speed:9,stamina:8,accel:10,jump:10,agility:10}, shadowmare:{speed:10,stamina:9,accel:10,jump:8,agility:8},
 kestrel:{speed:10,stamina:10,accel:9,jump:9,agility:9},
 frostdrake:{speed:8,stamina:10,accel:9,jump:9,agility:10}, emberdrake:{speed:10,stamina:8,accel:10,jump:10,agility:8},
 amethyst:{speed:9,stamina:10,accel:9,jump:9,agility:9}, stormdrake:{speed:10,stamina:9,accel:10,jump:8,agility:8},
 verdant:{speed:8,stamina:9,accel:9,jump:10,agility:10},
 glimmerdrake:{speed:10,stamina:9,accel:9,jump:9,agility:8}, thorndrake:{speed:8,stamina:10,accel:8,jump:10,agility:9},
 tidedrake:{speed:9,stamina:10,accel:8,jump:8,agility:10}, gloomdrake:{speed:10,stamina:8,accel:10,jump:8,agility:9},
 tidewalker:{speed:9,stamina:10,accel:8,jump:8,agility:10}, alicorn:{speed:10,stamina:10,accel:10,jump:10,agility:10},
 ancientdrake:{speed:10,stamina:10,accel:10,jump:10,agility:10},
 duskmustang:{speed:10,stamina:9,accel:10,jump:8,agility:9}, kilnfriesian:{speed:10,stamina:8,accel:10,jump:9,agility:8}, larkunicorn:{speed:9,stamina:10,accel:8,jump:9,agility:10},
 petalmane:{speed:9,stamina:9,accel:9,jump:10,agility:9}, dryadwalker:{speed:8,stamina:10,accel:8,jump:10,agility:10}, blossomdrake:{speed:9,stamina:10,accel:9,jump:10,agility:9},
 sunflare:{speed:10,stamina:9,accel:10,jump:8,agility:9}, noonshade:{speed:10,stamina:8,accel:9,jump:8,agility:10}, heliosdrake:{speed:10,stamina:9,accel:10,jump:9,agility:8},
 harvestmoon:{speed:8,stamina:10,accel:9,jump:9,agility:9}, cinderlark:{speed:10,stamina:8,accel:10,jump:8,agility:9}, ashwing:{speed:9,stamina:9,accel:9,jump:10,agility:10},
 snowlark:{speed:8,stamina:10,accel:8,jump:9,agility:10}, rimewalker:{speed:8,stamina:10,accel:8,jump:9,agility:10}, polarisdrake:{speed:9,stamina:10,accel:9,jump:10,agility:9},
};
/* Mastery perks per breed: rung 5 and rung 10 of the mastery ladder. sp/ac/ag/jp multiply the
   ride; stam scales the gallop drain. Real breeds and fantasy horses alike. */
const BREED_PERKS={
 'bay-sporthorse':{5:{label:'Steady partner',ag:.04},10:{label:'Family horse',stam:.9}},
 bay:{5:{label:'Cow sense',ag:.05},10:{label:'Quarter-mile burst',ac:.08}}, chestnut:{5:{label:'Pony pluck',stam:.92},10:{label:'Island hardy',stam:.85}},
 palomino:{5:{label:'Range legs',stam:.92},10:{label:'Golden stride',sp:.03}}, haflinger:{5:{label:'Mountain footing',ag:.05},10:{label:'Alpine heart',stam:.85}},
 grey:{5:{label:'Collected canter',ag:.06},10:{label:'Haute école',jp:.05}}, black:{5:{label:'Baroque presence',ac:.05},10:{label:'Driving power',sp:.04}},
 pinto:{5:{label:'Trail sense',ag:.04},10:{label:'Painted dash',ac:.07}}, appaloosa:{5:{label:'Surefooted',ag:.05},10:{label:'Endurance blood',stam:.85}},
 sunset:{5:{label:'Desert lungs',stam:.9},10:{label:'Long stride',sp:.04}}, iceland:{5:{label:'Tölt',ag:.05},10:{label:'Weatherproof',stam:.88}},
 welsh:{5:{label:'Pony jump',jp:.05},10:{label:'Hill pony',ag:.05}}, stock:{5:{label:'Stockman\'s turn',ag:.06},10:{label:'Outback heart',stam:.85}},
 fjord:{5:{label:'Draft pull',ac:.05},10:{label:'Fjord footing',ag:.05}}, morgan:{5:{label:'Versatile',ac:.04},10:{label:'Morgan will',stam:.88}},
 thoro:{5:{label:'Long stride',sp:.04},10:{label:'Racing heart',sp:.04}}, knab:{5:{label:'Show ring',jp:.05},10:{label:'Spotted flair',ag:.05}},
 vanner:{5:{label:'Feathered stride',stam:.92},10:{label:'Road horse',stam:.85}}, marwari:{5:{label:'Curved ears',ag:.05},10:{label:'Warhorse',ac:.07}},
 lipiz:{5:{label:'Airs above the ground',jp:.06},10:{label:'Piaffe',ag:.06}}, sport:{5:{label:'Sporting scope',jp:.05},10:{label:'Powerhouse',sp:.04}},
 akhal:{5:{label:'Metallic sheen',sp:.03},10:{label:'Desert endurance',stam:.8}}, percheron:{5:{label:'Draft heart',stam:.85},10:{label:'Gentle giant',ac:.06}},
 shire:{5:{label:'Draft heart',stam:.85},10:{label:'Shire power',ac:.06}}, clyde:{5:{label:'Draft heart',stam:.85},10:{label:'Clyde stride',sp:.03}},
 aether:{5:{label:'Starlit stride',sp:.04},10:{label:'Aether wind',stam:.8}}, sunspear:{5:{label:'Sun-forged',ac:.06},10:{label:'Solar sprint',sp:.05}},
 meadowlight:{5:{label:'Meadow spring',jp:.06},10:{label:'Aurora bound',ag:.06}}, tempest:{5:{label:'Storm hooves',ac:.06},10:{label:'Thunderhead',jp:.06}},
 eclipse:{5:{label:'Corona burst',ac:.06},10:{label:'Totality',sp:.05}}, glacier:{5:{label:'Ice heart',stam:.85},10:{label:'Glacial calm',ag:.06}},
 unicorn:{5:{label:'Moonlit grace',ag:.05},10:{label:'Horn of plenty',stam:.85}}, pegasus:{5:{label:'Wing tuck',ag:.04},10:{label:'Soaring speed',sp:.05}},
 celestial:{5:{label:'Star glow',stam:.9},10:{label:'Constellation',ag:.06}}, ember:{5:{label:'Kindled',ac:.06},10:{label:'Wildfire',sp:.05}},
 frost:{5:{label:'Frost bound',stam:.88},10:{label:'Ice leap',jp:.06}}, aurora:{5:{label:'Aurora wings',ag:.05},10:{label:'Northern lights',jp:.06}},
 phoenix:{5:{label:'Rekindle',stam:.85},10:{label:'Rising flame',ac:.08}}, shadowmare:{5:{label:'Night step',ac:.06},10:{label:'Shadow dash',sp:.05}},
 kestrel:{5:{label:'Silver wind',sp:.04},10:{label:'Basin legend',stam:.8}},
 frostdrake:{5:{label:'Frostflight',stam:.85},10:{label:'Blizzard',jp:.06}}, emberdrake:{5:{label:'Emberflight',ac:.06},10:{label:'Inferno',sp:.05}},
 amethyst:{5:{label:'Crystal wing',ag:.05},10:{label:'Geode',stam:.8}}, stormdrake:{5:{label:'Stormflight',sp:.04},10:{label:'Lightning',ac:.08}},
 verdant:{5:{label:'Canopy leap',jp:.06},10:{label:'Old growth',stam:.8}}, glimmerdrake:{5:{label:'Glimmerflight',sp:.04},10:{label:'Golden hour',ac:.07}},
 thorndrake:{5:{label:'Thornflight',jp:.06},10:{label:'Bramble',stam:.8}}, tidedrake:{5:{label:'Tideflight',ag:.06},10:{label:'Riptide',stam:.8}},
 gloomdrake:{5:{label:'Gloomflight',ac:.07},10:{label:'Nightfall',sp:.05}}, tidewalker:{5:{label:'Sea legs',stam:.85},10:{label:'Undertow',ag:.07}},
 alicorn:{5:{label:'Twin blessing',sp:.04},10:{label:'Ascendant',stam:.75}}, ancientdrake:{5:{label:'Elder scale',ac:.06},10:{label:'Ancient fire',sp:.06}},
 duskmustang:{5:{label:'Dusk runner',sp:.04},10:{label:'Board champion',ac:.07}}, kilnfriesian:{5:{label:'Kiln heat',ac:.06},10:{label:'Club forge',sp:.05}},
 larkunicorn:{5:{label:'Lark song',ag:.05},10:{label:'Golden hour',stam:.85}},
 petalmane:{5:{label:'Petal step',ag:.05},10:{label:'Bloom leap',jp:.06}}, dryadwalker:{5:{label:'Root deep',stam:.85},10:{label:'Canopy',jp:.06}}, blossomdrake:{5:{label:'Blossomflight',ag:.05},10:{label:'Full bloom',stam:.8}},
 sunflare:{5:{label:'Sun flare',ac:.06},10:{label:'High noon',sp:.05}}, noonshade:{5:{label:'Shade seeker',stam:.88},10:{label:'Dust devil',ag:.06}}, heliosdrake:{5:{label:'Heliosflight',sp:.04},10:{label:'Corona',ac:.08}},
 harvestmoon:{5:{label:'Harvest heart',stam:.85},10:{label:'Moon pull',ac:.06}}, cinderlark:{5:{label:'Cinder step',ac:.06},10:{label:'Ember song',sp:.05}}, ashwing:{5:{label:'Ash wing',ag:.05},10:{label:'Smoke trail',jp:.06}},
 snowlark:{5:{label:'Snow tölt',ag:.06},10:{label:'Winter coat',stam:.8}}, rimewalker:{5:{label:'Rime heart',stam:.85},10:{label:'Frost pull',ac:.06}}, polarisdrake:{5:{label:'Polarisflight',jp:.06},10:{label:'North star',sp:.05}},
};
const FLIGHT_UNLOCKS={1:'Flying Leap — taking off costs no stamina',4:'Wing Tuck — Shift dives 25% faster',7:'Aerial Acrobatics — Q rolls and R spins in flight score pass points',10:'Soaring Speed — +15% cruise, boosts last 30% longer, gallop drains 30% less'};

/* Acquisition traits (the breeding package adds its own class of traits to the same registry). */
const TRAITS3={
 prospector:{label:'The Prospector',icon:'⛏️',desc:'+1 to every stat in Coyote Canyon and Barleyfold; forage there sometimes doubles',regions:['Coyote','Barleyfold'],all:1,forage:.5,roster:true},
 earlybird:{label:'Early Bird',icon:'🌅',desc:'+12% speed on the first leg of any race or course',firstGate:.12,roster:true},
 focus:{label:'Hyper Focus',icon:'🎯',desc:'+1 to every stat, everywhere',all:1,roster:true},
 nimble:{label:'Nimble',icon:'🌀',desc:'+2 agility, everywhere',agility:2,roster:true},
 lasso:{label:'Lasso',icon:'🪢',desc:'+2 acceleration and +2 agility during a Runaway Roundup or while taming a wild horse',hud:['roundHud','tameHud'],accel:2,agility:2,roster:true},
 surefoot:{label:'Surefoot',icon:'🏔️',desc:'+10% speed and +1 agility around Hollowpeak — snow, rock and falls',regions:['Hollowpeak'],speed:.10,agility:1,roster:true},
 waterborn:{label:'Waterborn',icon:'🌊',desc:'Swims half again as fast and tires half as quickly in water',swim:true,roster:true},
 showstopper:{label:'Showstopper',icon:'🎀',desc:'Every course finish pays 20% more pass points',passMul:1.2,roster:true},
};
const TRAIT_KEYS=Object.keys(TRAITS3);

/* The elemental dragon family, found by breeding. The partner is a breed key or a coat theme. */
const VARIANT_RECIPES=[
 {a:'emberdrake',b:{breed:'glacier'},child:'frostdrake',hint:'a Glacier Percheron'},
 {a:'emberdrake',b:{coat:'ice'},child:'frostdrake',hint:'any ice coat'},
 {a:'emberdrake',b:{coat:'galaxy'},child:'amethyst',hint:'any galaxy coat'},
 {a:'emberdrake',b:{coat:'shadow'},child:'stormdrake',hint:'any shadow coat'},
 {a:'emberdrake',b:{breed:'meadowlight'},child:'thorndrake',hint:'a Meadowlight Quarter Horse'},
 {a:'emberdrake',b:{coat:'aurora'},child:'verdant',hint:'any aurora coat'},
 {a:'emberdrake',b:{breed:'akhal'},child:'glimmerdrake',hint:'an Akhal-Teke'},
 {a:'emberdrake',b:{breed:'tidewalker'},child:'tidedrake',hint:'a Tidewalker Arabian'},
 {a:'stormdrake',b:{coat:'eclipse'},child:'gloomdrake',hint:'an eclipse coat'},
 {a:'unicorn',b:{breed:'pegasus'},child:'alicorn',hint:'a Unicorn and a Pegasus'},
 {a:'gloomdrake',b:{breed:'glimmerdrake'},child:'ancientdrake',hint:'a Gloomflight with a Glimmerflight'},
 {a:'ancientdrake',b:{coat:'fire'},child:'emberdrake',egg:true,hint:'the Elder Dragon and a fire coat — hatches from an egg'},
 {a:'ancientdrake',b:{coat:'ice'},child:'frostdrake',egg:true,hint:'the Elder Dragon and an ice coat — hatches from an egg'},
 {a:'ancientdrake',b:{coat:'tide'},child:'tidedrake',egg:true,hint:'the Elder Dragon and a tide coat — hatches from an egg'},
 {a:'ancientdrake',b:{coat:'glimmer'},child:'glimmerdrake',egg:true,hint:'the Elder Dragon and a glimmer coat — hatches from an egg'},
 {a:'ancientdrake',b:{coat:'thorn'},child:'thorndrake',egg:true,hint:'the Elder Dragon and a thorn coat — hatches from an egg'},
 {a:'ancientdrake',b:{coat:'gloom'},child:'gloomdrake',egg:true,hint:'the Elder Dragon and a gloom coat — hatches from an egg'},
];
const DRAGON_FAMILY=['emberdrake','frostdrake','amethyst','stormdrake','verdant','glimmerdrake','thorndrake','tidedrake','gloomdrake','ancientdrake'];

/* New fantasy coat themes: shader config + effect for the rigged mount, plus flat mirrors for
   the procedural herd path, the dragon body and the wings. */
const NEW_THEMES={
 tide:{cfg:{ramp:['#062a3a','#1c8a92','#a8fff0'],glow:0.65,rough:0.55},
  fx:`float rip=sin(vMapUv.y*26.0-uTime*2.2+sin(vMapUv.x*9.0+uTime)*1.5)*0.5+0.5;
   float foam=step(0.985,_hash(floor(vMapUv*120.0)+floor(uTime*2.0)))*rip;
   _ramp=mix(_ramp,vec3(0.35,0.95,0.9),rip*0.22*_l);
   _ramp+=vec3(0.9,1.0,1.0)*foam;
   _emis=_ramp*uGlow*(0.18+0.7*_l)+vec3(0.3,0.9,0.85)*_fres*0.55+vec3(1.0)*foam*0.8;`,
  base:'#1a6a72',coat:{emissive:0x3ad0c0,ei:0.5,rough:0.5},wing:{a:'#a8fff0',b:'#1c6a80',e:'#3ad0c0',ei:0.42},
  drg:{web:'#5ee0d0',root:'#0c3a44',bone:'#0a2a30',glow:'#a8fff0',head:'#1c6a72',ridge:'#a8fff0'},elem:'water'},
 glimmer:{cfg:{ramp:['#3a2408','#c48a1a','#fff2b0'],glow:0.7,rough:0.45},
  fx:`float gl=step(0.988,_hash(floor(vMapUv*160.0)))*(0.5+0.5*sin(uTime*5.0+vMapUv.x*90.0));
   float sheen=pow(_fres,1.5);
   _ramp=mix(_ramp,vec3(1.0,0.9,0.55),sheen*0.5);
   _ramp+=vec3(1.0,0.95,0.7)*gl*1.4;
   _emis=_ramp*uGlow*(0.2+0.6*_l)+vec3(1.0,0.85,0.4)*sheen*0.5+vec3(1.0)*gl*1.2;`,
  base:'#b07a1a',coat:{emissive:0xffc040,ei:0.55,rough:0.4},wing:{a:'#fff2b0',b:'#b07a1a',e:'#ffc040',ei:0.45},
  drg:{web:'#ffd870',root:'#5a3a08',bone:'#3a2408',glow:'#fff2b0',head:'#8a5a10',ridge:'#fff2b0'},elem:'fire'},
 thorn:{cfg:{ramp:['#0a2006','#3f8a1a','#d8ff7a'],glow:0.6,rough:0.7},
  fx:`float vein=smoothstep(0.46,0.5,abs(sin(vMapUv.x*30.0+sin(vMapUv.y*17.0)*2.0))*0.5)*smoothstep(0.2,0.8,_l);
   float pulse=0.6+0.4*sin(uTime*1.7+vMapUv.y*20.0);
   _ramp=mix(_ramp,vec3(0.7,1.0,0.35),vein*0.7*pulse);
   _emis=_ramp*uGlow*(0.15+0.6*_l)+vec3(0.6,1.0,0.3)*vein*pulse*0.9+vec3(0.4,0.9,0.3)*_fres*0.35;`,
  base:'#2f6a1a',coat:{emissive:0x7ae03a,ei:0.5,rough:0.6},wing:{a:'#d8ff7a',b:'#2f6a1a',e:'#7ae03a',ei:0.42},
  drg:{web:'#a8f060',root:'#143a08',bone:'#0a2006',glow:'#d8ff7a',head:'#2f6a1a',ridge:'#d8ff7a'},elem:'water'},
 gloom:{cfg:{ramp:['#07030c','#2a1440','#8a5ad8'],glow:0.55,rough:0.85},
  fx:`float smoke=_hash(floor(vMapUv*9.0)+floor(uTime*0.8))*0.5+_hash(floor(vMapUv*4.0)-floor(uTime*0.5))*0.5;
   _ramp=mix(_ramp,vec3(0.05,0.02,0.08),smoke*0.5);
   _ramp+=vec3(0.55,0.3,0.9)*_fres*0.7;
   _emis=_ramp*uGlow*(0.08+0.5*_l)+vec3(0.6,0.3,1.0)*_fres*0.8*(0.7+0.3*sin(uTime*2.3))+vec3(0.35,0.15,0.6)*smoke*0.4;`,
  base:'#1c1030',coat:{emissive:0x6a3ad0,ei:0.4,rough:0.8},wing:{a:'#6a4aa0',b:'#12081e',e:'#6a3ad0',ei:0.3},
  drg:{web:'#7a50d0',root:'#12081e',bone:'#0a0414',glow:'#a070ff',head:'#241238',ridge:'#a070ff'},elem:'shadow'},
 moonlit:{cfg:{ramp:['#0e1424','#5a6fa8','#eef3ff'],glow:0.6,rough:0.5},
  fx:`float st=step(0.993,_hash(floor(vMapUv*140.0)))*(0.5+0.5*sin(uTime*2.5+vMapUv.y*40.0));
   _ramp=mix(_ramp,vec3(0.85,0.9,1.0),_fres*0.5);
   _ramp+=vec3(1.0)*st*1.3;
   _emis=_ramp*uGlow*(0.2+0.6*_l)+vec3(0.7,0.8,1.0)*_fres*0.6+vec3(1.0)*st;`,
  base:'#4a5a8a',coat:{emissive:0x8aa0e0,ei:0.45,rough:0.5},wing:{a:'#eef3ff',b:'#4a5a8a',e:'#8aa0e0',ei:0.42},
  drg:{web:'#b8c8ff',root:'#1e2848',bone:'#0e1424',glow:'#eef3ff',head:'#3a4a7a',ridge:'#eef3ff'},elem:'arcane'},
 petal:{cfg:{ramp:['#3a1428','#d86aa0','#ffe4f0'],glow:0.6,rough:0.6},
  fx:'',   // filled in below
  base:'#b04a7a',coat:{emissive:0xff8ac0,ei:0.45,rough:0.55},wing:{a:'#ffe4f0',b:'#b04a7a',e:'#ff8ac0',ei:0.42},
  drg:{web:'#ffb0d8',root:'#4a1a30',bone:'#3a1428',glow:'#ffe4f0',head:'#8a3a60',ridge:'#ffe4f0'},elem:'water'},
 solar:{cfg:{ramp:['#3a1200','#f08a10','#fff6c0'],glow:0.85,rough:0.6},
  fx:`float ray=pow(max(0.0,sin(vMapUv.x*40.0+uTime*3.0)),8.0)*smoothstep(0.3,0.9,_l);
   _ramp=mix(_ramp,vec3(1.0,0.95,0.6),ray*0.6);
   _ramp+=vec3(1.0,0.6,0.15)*_fres*0.6;
   _emis=_ramp*uGlow*(0.25+0.9*_l)+vec3(1.0,0.7,0.2)*_fres*0.8+vec3(1.0,0.9,0.5)*ray*0.7;`,
  base:'#c85a10',coat:{emissive:0xffa020,ei:0.7,rough:0.55},wing:{a:'#fff6c0',b:'#c85a10',e:'#ffa020',ei:0.48},
  drg:{web:'#ffc060',root:'#5a2400',bone:'#3a1200',glow:'#fff6c0',head:'#a04a08',ridge:'#fff6c0'},elem:'fire'},
};
/* petal needs a spot helper the base shader does not carry, so it is inlined in its own block */
NEW_THEMES.petal.fx=`float pet;{vec2 g=vMapUv*18.0;vec2 c=floor(g),f=fract(g)-0.5;float best=1.0;
   for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 o=vec2(float(i),float(j)),cc=c+o;float r1=_hash(cc),r2=_hash(cc+37.7);
    if(r1>0.55){vec2 ctr=o+vec2(r2,_hash(cc+91.3))*0.7-0.35;best=min(best,length(f-ctr)-mix(0.08,0.2,r1));}}
   pet=1.0-smoothstep(-0.03,0.03,best);}
   _ramp=mix(_ramp,vec3(1.0,0.75,0.88),pet*0.7);
   _ramp=mix(_ramp,vec3(1.0,0.9,0.95),_fres*0.35);
   _emis=_ramp*uGlow*(0.18+0.6*_l)+vec3(1.0,0.6,0.8)*pet*0.6+vec3(1.0,0.7,0.85)*_fres*0.4;`;

/* New rows. [key,label,tier,coins,gems,body,mane,{flags}] — flags carry src, season, limited,
   exclusive, bredOnly, egg, traits (fixed), body (foundation model) and the usual look. */
const NEW_BREEDS=[
 ['tidewalker','Tidewalker Arabian','Mythic',0,0,'#1c4f63','#7fe0d8',{coat:'tide',glow:true,ability:'swim',size:0.98,src:'summon',body:'sunset'}],
 ['glimmerdrake','Glimmerflight Dragon','Dragon',0,0,'#3a2a08','#ffe08a',{wings:true,dragon:true,coat:'glimmer',glow:true,ability:'fly',src:'breed',body:'akhal'}],
 ['thorndrake','Thornflight Dragon','Dragon',0,0,'#143008','#d8ff7a',{wings:true,dragon:true,coat:'thorn',glow:true,ability:'fly',src:'breed',body:'stock'}],
 ['tidedrake','Tideflight Dragon','Dragon',0,0,'#062a3a','#a8fff0',{wings:true,dragon:true,coat:'tide',glow:true,ability:'fly',src:'breed',body:'sunset'}],
 ['gloomdrake','Gloomflight Dragon','Dragon',0,0,'#12081e','#a070ff',{wings:true,dragon:true,coat:'gloom',glow:true,ability:'fly',src:'breed',body:'clyde'}],
 ['alicorn','Alicorn','Ascendant',0,0,'#f8f4ff','#e0c8ff',{horn:true,wings:true,rainbow:true,glow:true,ability:'fly',bredOnly:true,src:'breed',body:'grey',size:1.06}],
 ['ancientdrake','Elder Dragon','Ascendant',0,0,'#0d0a12','#ffb44a',{wings:true,dragon:true,coat:'eclipse',glow:true,ability:'fly',bredOnly:true,egg:true,src:'breed',body:'clyde',size:1.14}],
 ['duskmustang','Dusk Mustang','Mythic',0,0,'#2a2a4a','#eef3ff',{coat:'moonlit',glow:true,ability:'swift',src:'weekly',exclusive:'weekly',body:'palomino'}],
 ['kilnfriesian','Kiln Friesian','Mythic',0,0,'#3a1410','#ff8a3a',{coat:'fire',glow:true,ability:'swift',src:'club',exclusive:'club',body:'black',size:1.06}],
 ['larkunicorn','Meadowlark Unicorn','Mythic',0,0,'#f4d8e4','#ffe4f0',{horn:true,rainbow:true,coat:'petal',glow:true,ability:'glow',src:'photo',exclusive:'photo',body:'grey'}],
 /* the seasonal releases: a pass horse, a deluxe (gold-track) horse and a limited banner horse per season */
 ['petalmane','Petalmane Quarter Horse','Mythic',0,0,'#b04a7a','#ffe4f0',{coat:'petal',glow:true,ability:'leap',src:'season',season:'bloom',role:'pass',body:'bay'}],
 ['dryadwalker','Dryad Walker','Mythic',0,0,'#2f6a1a','#d8ff7a',{coat:'thorn',glow:true,ability:'leap',src:'season',season:'bloom',role:'deluxe',traits:['prospector'],body:'sport',size:1.06}],
 ['blossomdrake','Blossom Dragon','Dragon',0,0,'#4a1a30','#ffb0d8',{wings:true,dragon:true,coat:'petal',glow:true,ability:'fly',src:'season',season:'bloom',role:'banner',limited:true,body:'thoro'}],
 ['sunflare','Sunflare Arabian','Mythic',0,0,'#c85a10','#fff6c0',{coat:'solar',glow:true,ability:'swift',src:'season',season:'sun',role:'pass',body:'sunset',size:0.98}],
 ['noonshade','Noonshade Mustang','Mythic',0,0,'#b07a1a','#fff2b0',{coat:'glimmer',glow:true,ability:'swift',src:'season',season:'sun',role:'deluxe',traits:['earlybird'],body:'palomino'}],
 ['heliosdrake','Helios Dragon','Dragon',0,0,'#3a1200','#ffc060',{wings:true,dragon:true,coat:'solar',glow:true,ability:'fly',src:'season',season:'sun',role:'banner',limited:true,body:'thoro'}],
 ['harvestmoon','Harvest Moon Fjord','Mythic',0,0,'#4a5a8a','#eef3ff',{coat:'moonlit',glow:true,ability:'leap',src:'season',season:'ember',role:'pass',body:'fjord',size:0.92}],
 ['cinderlark','Cinderlark Morgan','Mythic',0,0,'#3a1410','#ff9a4a',{coat:'fire',glow:true,ability:'swift',src:'season',season:'ember',role:'deluxe',traits:['showstopper'],body:'morgan',size:0.98}],
 ['ashwing','Ashwing Pegasus','Mythic',0,0,'#1c1030','#a070ff',{wings:true,coat:'gloom',glow:true,ability:'fly',src:'season',season:'ember',role:'banner',limited:true,body:'sport',size:1.1}],
 ['snowlark','Snowlark Icelandic','Mythic',0,0,'#4a5a8a','#eef3ff',{coat:'moonlit',glow:true,ability:'leap',src:'season',season:'frost',role:'pass',body:'iceland',size:0.84}],
 ['rimewalker','Rimewalker Percheron','Mythic',0,0,'#cfe9f6','#8fd0ec',{coat:'ice',glow:true,ability:'swim',src:'season',season:'frost',role:'deluxe',traits:['waterborn'],body:'percheron',size:1.14}],
 ['polarisdrake','Polaris Dragon','Dragon',0,0,'#0e1424','#eef3ff',{wings:true,dragon:true,coat:'moonlit',glow:true,ability:'fly',src:'season',season:'frost',role:'banner',limited:true,body:'percheron'}],
];
const SEASON_CALL_GEMS=30, SEASON_CALL_PITY=3;

/* ---------------------------------------------------------------------------------------
   INSTALL
   --------------------------------------------------------------------------------------- */
export function install(G){
 const {THREE,$,toast}=G, T=G.tables, BREEDS3=T.BREEDS3, TIER_BASE=T.TIER_BASE, TIER_STARS=T.TIER_STARS, MARKS=T.MARKS, MARKS2=T.MARKS2||{none:0,blaze:1,snip:2,socks:3,stockings:4,star:5};
 const player=G.horse.player, DYE_COST=T.DYE_COST||120;
 const byKey=k=>BREEDS3.find(b=>b[0]===k);
 const flagsOf=h=>((h&&byKey(h.breed))||[])[7]||{};
 const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

 /* ---- 1. rows, tiers, sources ---------------------------------------------------------- */
 T.RAR_COL.Ascendant='#ff9ad5';
 for(const b of BREEDS3){const o=b[7]||{};                       // mythic and dragon horses answer the Starfall call, they are not on a shelf
  if(!o.src&&!o.story&&(b[2]==='Mythic'||b[2]==='Dragon'))o.src='summon';}
 for(const row of NEW_BREEDS){ if(!byKey(row[0]))BREEDS3.push(row); }
 for(const k in FANTASY_CEIL){ if(!T.BREED_CEIL[k])T.BREED_CEIL[k]=FANTASY_CEIL[k]; }
 for(const k in TRAITS3){ if(!T.TRAITS[k])T.TRAITS[k]=TRAITS3[k]; }
 const TRAITS=T.TRAITS;
 G.horse.sourceRule((ctx,b)=>{const src=G.horse.breedSrc(b); if(ctx==='summon'&&src==='summon')return true; if(ctx==='shop'&&src!=='shop')return false; return undefined;});
 /* body models for the new keys, without touching the model manifest */
 try{for(const row of NEW_BREEDS){const o=row[7]||{};if(o.body&&G.horse.breedModels&&G.horse.breedModels.alias)G.horse.breedModels.alias(row[0],o.body);}}catch(e){}

 /* ---- 2. fantasy themes: shared shader module + the inline mirrors --------------------- */
 for(const k in NEW_THEMES){const th=NEW_THEMES[k];
  registerFantasyTheme(k,th.cfg,th.fx);
  if(T.FANTASY_CFG&&!T.FANTASY_CFG[k]){T.FANTASY_CFG[k]=th.cfg;T.FANTASY_FX[k]=th.fx;}
  if(T.FANTASY_COAT&&!T.FANTASY_COAT[k])T.FANTASY_COAT[k]=th.coat;
  if(T.COAT_BASE&&!T.COAT_BASE[k])T.COAT_BASE[k]=th.base;
  if(T.WING_TINT&&!T.WING_TINT[k])T.WING_TINT[k]=th.wing;
  if(T.DRAGON_TINT&&!T.DRAGON_TINT[k])T.DRAGON_TINT[k]=th.drg;
  if(T.ELEM_OF&&!T.ELEM_OF[k])T.ELEM_OF[k]=th.elem;
 }
 if(T.DRAGON_TINT&&!T.DRAGON_TINT.eclipse)T.DRAGON_TINT.eclipse={web:'#ffb44a',root:'#1a1008',bone:'#0d0a12',glow:'#ffd080',head:'#2a1a08',ridge:'#ffd080'};
 if(T.WING_TINT&&!T.WING_TINT.eclipse)T.WING_TINT.eclipse={a:'#ffd080',b:'#2a1a08',e:'#ffb44a',ei:0.4};
 for(const row of NEW_BREEDS){const o=row[7]||{};
  registerFantasyAppearance(row[0],Object.assign({mane:row[6]},o.coat?{theme:o.coat}:{body:row[5]},o.horn?{horn:true}:{},o.wings?{wings:true}:{},o.dragon?{dragon:true}:{}));}

 /* ---- 3. stars, coats, traits: the helpers -------------------------------------------- */
 function rarityOf(h){const b=h&&byKey(h.breed);return b?b[2]:'Common';}
 function starsN(h){const b=h&&byKey(h.breed);if(!b)return 2;const o=b[7]||{};return Math.min(6,(TIER_STARS[b[2]]||2)+(o.limited?1:0));}
 function starsOf(h){return STAR.repeat(starsN(h));}
 function starsOfBreed(b){const o=b[7]||{};return Math.min(6,(TIER_STARS[b[2]]||2)+(o.limited?1:0));}
 function coatsFor(breed){return COATS3[breed]||[];}
 function variantOf(h){if(!h||!h.variant)return null;return coatsFor(h.breed).find(v=>v[0]===h.variant)||null;}
 function variantLabel(h){const v=variantOf(h);return v?v[1]:'';}
 function lcg(seed){let x=(seed*2654435761+12345)>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
 function hexJitter(hex,rnd,hueDeg,lightPct){
  const c=new THREE.Color(hex),hsl={};c.getHSL(hsl);
  hsl.h=(hsl.h+(rnd()*2-1)*hueDeg/360+1)%1; hsl.l=Math.max(0.03,Math.min(0.97,hsl.l*(1+(rnd()*2-1)*lightPct))); hsl.s=Math.max(0,Math.min(1,hsl.s*(1+(rnd()*2-1)*0.08)));
  c.setHSL(hsl.h,hsl.s,hsl.l);return '#'+c.getHexString();
 }
 function pickW(list,rnd){let t=0;for(const e of list)t+=e[1];let x=rnd()*t;for(const e of list){x-=e[1];if(x<=0)return e[0];}return list[0][0];}
 function rollCoat3(breed,rnd){const L=coatsFor(breed);if(!L.length)return null;return L[Math.floor(rnd()*L.length)]||null;}
 function applyVariant(h,v){
  if(!h||!v)return h; h.variant=v[0]; h.colors=h.colors||{}; h.colors.body=v[2]; h.colors.mane=v[3];
  if(v[4]){h.mark=v[4];if(v[5])h.markCol=v[5];else delete h.markCol;}else{delete h.mark;delete h.markCol;}
  return h;
 }
 /* Procedural coats: a named coat or the breed colours, jittered a little, plus a marking and a
    second layer of face and leg white. Seeded from the id so the same horse looks the same on
    every device. */
 function rollAppearance(breed,seed,opts){
  opts=opts||{}; const rnd=lcg(seed||1), b=byKey(breed)||BREEDS3[0], o=b[7]||{};
  const out={variant:null,colors:{body:b[5],mane:b[6]},mark:undefined,markCol:undefined,mark2:'none'};
  if(o.coat||o.hero)return out;                                     // themed coats and the family bay stay as they are
  const v=opts.variant===null?null:(opts.variant||rollCoat3(breed,rnd));
  if(v){out.variant=v[0];out.colors={body:v[2],mane:v[3]};if(v[4]){out.mark=v[4];out.markCol=v[5];}else out.mark='none';}
  out.colors.body=hexJitter(out.colors.body,rnd,6,0.08); out.colors.mane=hexJitter(out.colors.mane,rnd,4,0.06);
  if(out.mark===undefined){const r=rnd();const dom=['pinto','roan','appaloosa','leopard'];out.mark=r<0.6?(o.mark||'none'):r<0.8?'none':dom[Math.floor(rnd()*dom.length)];if(out.mark!==o.mark&&out.mark!=='none'&&rnd()<0.5)out.markCol=T.DYE_MARK[Math.floor(rnd()*T.DYE_MARK.length)][0];}
  out.mark2=pickW(MARK2_WEIGHTS,rnd);
  return out;
 }
 function coatKey(h){const c=new THREE.Color((h.colors&&h.colors.body)||'#000');const hsl={};c.getHSL(hsl);return (h.mark||'breed')+'/'+(h.mark2||'none')+'/'+Math.round(hsl.h*24)+'-'+Math.round(hsl.l*8);}
 function noteCoat(s,h){s.roster=s.roster||{};s.roster.coatsSeen=s.roster.coatsSeen||{};const k=h.breed+':'+coatKey(h);const fresh=!s.roster.coatsSeen[k];s.roster.coatsSeen[k]=1;return fresh;}
 function rollTraits(h){
  const n=starsN(h), rnd=lcg((h.id||0)*31+7), want=n<=2?(rnd()<0.2?1:0):n<=4?1:n===5?(rnd()<0.5?2:1):2;
  const out=[]; let guard=0;
  while(out.length<want&&guard++<20){const k=TRAIT_KEYS[Math.floor(rnd()*TRAIT_KEYS.length)];if(out.indexOf(k)<0)out.push(k);}
  return out;
 }
 function traitsOf(h){return (h&&Array.isArray(h.traits))?h.traits.filter(k=>TRAITS[k]):[];}
 function traitChips(h){return traitsOf(h).map(k=>'<span title="'+esc(TRAITS[k].desc||'')+'" style="background:#fff3d6;border:1px solid #e8d2a0;border-radius:8px;padding:0 6px;font-size:11px;font-weight:700;white-space:nowrap">'+(TRAITS[k].icon||'✦')+' '+esc(TRAITS[k].label)+'</span>').join(' ');}
 /* Rungs are authored on a ten-step ladder; the mastery package may cap a breed lower (fantasy
    horses top out at 5), so every rung is scaled to that breed's real ladder: 5/10 -> 3/5, 1/4/7/10 -> 1/2/4/5. */
 const mxOf=b=>G.masteryMax?G.masteryMax(b):10, rungOf=(b,r)=>Math.max(1,Math.round(r*mxOf(b)/10));
 function perkFor(breed,M){const P=BREED_PERKS[breed];if(!P)return null;const out={sp:0,ac:0,ag:0,jp:0,stam:1,labels:[]};for(const r of [5,10]){if(M>=rungOf(breed,r)&&P[r]){const q=P[r];out.sp+=q.sp||0;out.ac+=q.ac||0;out.ag+=q.ag||0;out.jp+=q.jp||0;out.stam*=q.stam||1;out.labels.push(q.label);}}return out;}
 function perkLine(breed,M){const P=BREED_PERKS[breed];if(!P)return '';return [5,10].map(r=>(M>=rungOf(breed,r)?'✅ ':'🔒 ')+rungOf(breed,r)+' · <b>'+esc(P[r].label)+'</b> '+perkDesc(P[r])).join(' &nbsp; ');}
 function perkDesc(q){const a=[];if(q.sp)a.push('+'+Math.round(q.sp*100)+'% speed');if(q.ac)a.push('+'+Math.round(q.ac*100)+'% acceleration');if(q.ag)a.push('+'+Math.round(q.ag*100)+'% agility');if(q.jp)a.push('+'+Math.round(q.jp*100)+'% jump');if(q.stam)a.push('-'+Math.round((1-q.stam)*100)+'% gallop drain');return '<span style="color:#8c7a63">('+a.join(', ')+')</span>';}
 function matchesPartner(x,spec){if(!x||!spec)return false;if(spec.breed)return x.breed===spec.breed;if(spec.coat)return (x.coat||flagsOf(x).coat)===spec.coat;return false;}
 function resolveVariant(a,b){
  for(const r of VARIANT_RECIPES){
   if((a.breed===r.a&&matchesPartner(b,r.b))||(b.breed===r.a&&matchesPartner(a,r.b)))return r;
   if(r.b&&r.b.breed&&((a.breed===r.b.breed&&b.breed===r.a)||(b.breed===r.b.breed&&a.breed===r.a)))return r;
  }
  return null;
 }
 function howToGet(b){const o=b[7]||{};const src=G.horse.breedSrc(b);
  if(src==='season'){const S=T.SEASONS.find(x=>x.id===o.season);return (S?S.emoji+' '+S.name:'A season')+' · '+({pass:'free track tier 30',deluxe:'gold track tier 20',banner:'the Season Call (limited)'}[o.role]||'season');}
  if(src==='breed'){const r=VARIANT_RECIPES.find(x=>x.child===b[0]);return '💞 Bred from '+(r?esc(r.hint):'a rare pairing');}
  return SRC_LABEL[src]||src;}
 function seasonHorses(sid){return NEW_BREEDS.filter(r=>r[7].season===sid).reduce((o,r)=>{o[r[7].role]=r[0];return o;},{});}
 function seasonInfo(n){const now=G.time.seasonNow();const k=n==null?now.n:n;const d=T.SEASONS[k%T.SEASONS.length];const start=now.start+(k-now.n)*28*864e5;return {n:k,key:'S'+k,def:d,start,end:start+28*864e5,horses:seasonHorses(d.id)};}

 /* Exclusives: one copy per (horse, period). Other packages call this from their own claims. */
 function grantExclusive(s,key,period,why){
  s.roster=s.roster||{};s.roster.exclusives=s.roster.exclusives||{};
  const b=byKey(key); if(!b)return null;
  const tag=key+':'+(period||'once'); if(s.roster.exclusives[tag])return null;
  s.roster.exclusives[tag]=Date.now();
  const h=G.horse.grantHorse(s,key,{src:'exclusive',bond:30,extra:{exclusive:why||G.horse.breedSrc(b)}});
  s.inbox=s.inbox||[]; s.inbox.push({t:Date.now(),kind:'horse',text:(why||'An exclusive horse')+': '+h.name+' the '+b[1]+' has come to the ranch.'});
  return h;
 }
 function grantSeasonHorse(s,role){
  const now=G.time.seasonNow(), SH=seasonHorses(now.def.id), key=SH[role]; if(!key)return null;
  return grantExclusive(s,key,now.key,'🎟️ '+now.def.name+' '+role+' horse');
 }

 /* ---- 4. save shape -------------------------------------------------------------------- */
 function ensureRosterHorse(h){ if(h.traits==null)h.traits=rollTraits(h); if(h.mark2===undefined)h.mark2=null; if(h.egg&&!h.foal)delete h.egg; }
 G.save.ensure(s=>{ s.roster=s.roster||{}; const r=s.roster; r.coatsSeen=r.coatsSeen||{}; r.variantsFound=r.variantsFound||{}; r.exclusives=r.exclusives||{}; if(r.seasonPity==null)r.seasonPity=0; if(r.calls==null)r.calls=0;
  if(s.horses)for(const h of s.horses)if(h.traits==null||h.mark2===undefined)ensureRosterHorse(h); });   // the boot migration ran ensureStats before this package existed
 G.save.ensureHorse(ensureRosterHorse);

 /* ---- 5. acquisition: every new horse rolls a coat, a look and its traits -------------- */
 G.on('grantHorse',(s,h,opts)=>{
  opts=opts||{}; const o=flagsOf(h);
  if(!opts.colors&&!o.hero){
   const A=rollAppearance(h.breed,h.id,{});
   if(A.variant)h.variant=A.variant;
   h.colors=A.colors; if(A.mark!==undefined){if(A.mark==='none'&&!A.variant)delete h.mark;else h.mark=A.mark;} if(A.markCol)h.markCol=A.markCol;
   h.mark2=A.mark2==='none'?null:A.mark2;
  }else if(!o.hero){const rnd=lcg((h.id||0)+5);h.mark2=pickW(MARK2_WEIGHTS,rnd);if(h.mark2==='none')h.mark2=null;}
  if(Array.isArray(o.traits)){for(const k of o.traits)if(TRAITS[k]&&(h.traits||[]).indexOf(k)<0)h.traits=(h.traits||[]).concat([k]);}
  if(o.egg&&h.foal)h.egg=true;
  h.stars=starsN(h);
  if(h.src&&h.src!=='qa')noteCoat(s,h);
 });
 /* Foals: one trait from each side (and now and then a new one), a 5% coat mutation, the
    dragon family and the six-star pairings. */
 G.on('foal',(s,foal,a,b,opts)=>{
  opts=opts||{};
  const inh=[]; const ta=traitsOf(a), tb=traitsOf(b);
  if(ta.length&&Math.random()<0.7)inh.push(ta[Math.floor(Math.random()*ta.length)]);
  if(tb.length&&Math.random()<0.7){const k=tb[Math.floor(Math.random()*tb.length)];if(inh.indexOf(k)<0)inh.push(k);}
  if(Math.random()<0.10){const k=TRAIT_KEYS[Math.floor(Math.random()*TRAIT_KEYS.length)];if(inh.indexOf(k)<0)inh.push(k);}
  foal.traits=inh.slice(0,3);
  const r=(!opts.club&&!opts.noVariant)?resolveVariant(a,b):null;
  if(r&&byKey(r.child)){
   const cb=byKey(r.child), co=cb[7]||{};
   foal.breed=r.child; foal.coat=co.coat||null; foal.colors={body:cb[5],mane:cb[6]}; foal.horn=!!co.horn; foal.wings=!!co.wings; foal.dragon=!!co.dragon; foal.rainbow=!!co.rainbow; foal.glow=!!co.glow; foal.ability=co.ability||foal.ability;
   delete foal.mark; delete foal.markCol; foal.mark2=null;
   if(r.egg||co.egg)foal.egg=true;
   s.roster=s.roster||{}; s.roster.variantsFound=s.roster.variantsFound||{};
   const first=!s.roster.variantsFound[r.child]; s.roster.variantsFound[r.child]=(s.roster.variantsFound[r.child]||0)+1;
   foal.variantFound=first;
   setTimeout(()=>{try{toast((co.dragon?'🐉':'🦄')+(first?' A new '+(co.dragon?'dragon':'horse')+' for the lineage: ':' ')+cb[1]+'!'+(foal.egg?' It will hatch from an egg.':''));}catch(e){}},600);
  }else if(!foal.coat&&Math.random()<0.05){                        // a mutation: a colour and pattern neither parent wore
   const rnd=lcg(foal.id*13+1); const marks=Object.keys(MARKS).filter(k=>k!=='none');
   foal.mark=marks[Math.floor(rnd()*marks.length)]; foal.markCol=T.DYE_MARK[Math.floor(rnd()*T.DYE_MARK.length)][0];
   foal.colors.body=hexJitter(foal.colors.body,rnd,18,0.2); foal.mutant=true;
  }
  if(!foal.coat){const rnd=lcg(foal.id*7+3);const m2=pickW(MARK2_WEIGHTS,rnd);foal.mark2=m2==='none'?null:m2;}
  foal.stars=starsN(foal);
  if(!foal.coat&&noteCoat(s,foal))setTimeout(()=>{try{toast('🧬 A coat new to the ranch!');}catch(e){}},900);
 });

 /* ---- 6. the ride: traits, breed perks, swimming, flight ------------------------------ */
 const cur={h:null,M:0,traits:[],flags:{},abil:null,perk:null,region:null,regionT:-9,drainMul:1,wasFlying:false,lastTrick:null,trickN:0,swimDist:0,splashT:0};
 function refreshCur(){
  const h=G.horse.ridden(); cur.h=h||null; if(!h){cur.traits=[];cur.perk=null;return;}
  const s=G.save.fresh(); cur.M=s?G.xp.masteryOf(s,h.breed):0; cur.traits=traitsOf(h); cur.flags=flagsOf(h); cur.abil=h.ability||cur.flags.ability||null; cur.perk=perkFor(h.breed,cur.M); cur.mx=mxOf(h.breed); cur.fr={1:rungOf(h.breed,1),4:rungOf(h.breed,4),7:rungOf(h.breed,7),10:rungOf(h.breed,10)};
 }
 function regionMatch(list){const rg=cur.region;if(!rg||!list)return false;return list.some(n=>rg.name.indexOf(n)>=0);}
 function hudOn(ids){return ids.some(i=>{const e=$(i);return e&&e.style.display&&e.style.display!=='none';});}
 /* water: the river channel, Sparrow Creek and Loon Lake. Depth in metres above the bed. */
 function waterDepth(x,z){
  const W=G.world; let d=0;
  const dl=Math.hypot(x-20,z-16); if(dl<4.5)d=Math.max(d,0.35+0.9*(1-dl/4.5));
  const rz=W.riverZ(x); if(Math.abs(z-rz)<9){const th=W.terrainH(x,z);if(W.groundH(x,z)>th+0.3)return 0;d=Math.max(d,W.riverLevel(x)-th);}
  return Math.max(0,d);
 }
 G.addMul('stamDrain',()=>cur.drainMul);
 G.on('ride',(R,dt)=>{
  const h=G.horse.ridden(); if(h!==cur.h)refreshCur(); if(!cur.h)return;
  const HS=R.HS||{}, PM=R.PM||{sp:1,ac:1,ag:1}; const p=player;
  cur.regionT+=dt; if(cur.regionT>0.5){cur.regionT=0;cur.region=G.world.regionAt(p.pos.x,p.pos.z);}
  let all=0,spF=0,acF=0,agF=0,jpF=0,acN=0,agN=0,drain=1;
  for(const k of cur.traits){const Tk=TRAITS[k];if(!Tk||!Tk.roster)continue;
   const on=(!Tk.regions||regionMatch(Tk.regions))&&(!Tk.hud||hudOn(Tk.hud));
   if(!on)continue;
   if(Tk.all)all+=Tk.all; if(Tk.speed)spF+=Tk.speed; if(Tk.accel)acN+=Tk.accel; if(Tk.agility)agN+=Tk.agility;
   if(Tk.firstGate){const c=G.course.get();if(c&&c.started&&c.idx===0)spF+=Tk.firstGate;}
  }
  if(cur.perk){spF+=cur.perk.sp;acF+=cur.perk.ac;agF+=cur.perk.ag;jpF+=cur.perk.jp;drain*=cur.perk.stam;}
  if(all){const s0=HS.speed||3;spF+=(0.82+0.036*(s0+all))/(0.82+0.036*s0)-1;acN+=all;agN+=all;jpF+=0.016*all/(0.92+0.016*(HS.jump||3));drain*=1-0.06*all;}
  if(acN)R.acMul+=0.06*acN*(PM.ac||1); if(agN)R.agMul+=0.05*agN*(PM.ag||1);
  if(spF)R.target*=1+spF; if(acF)R.acMul*=1+acF; if(agF)R.agMul*=1+agF; if(jpF)R.jpMul*=1+jpF;
  /* swimming */
  const depth=waterDepth(p.pos.x,p.pos.z), swimming=depth>0.45&&!p.flying&&(p.y||0)<0.3;
  if(swimming&&!p.swim){p.swim=true;try{G.beep(420,180,0.16,'sine',0.08);}catch(e){}if(!window._swimTut){window._swimTut=1;toast('🌊 Swimming! Water is slow going — a Tidewalker cuts straight across.');}}
  else if(!swimming&&p.swim){p.swim=false;p.swimDepth=0;}
  if(p.swim){
   const spec=cur.abil==='swim', born=cur.traits.indexOf('waterborn')>=0;
   R.target*=spec?0.85:born?0.62:0.42; R.noJump=true; p.swimDepth=depth;
   R.drain=0; R.regen=0;                                             // water has its own economy: no gallop drain, no regen, one rate per horse
   if(Math.abs(p.speed)>0.5)p.stam=Math.max(0,(p.stam==null?1:p.stam)-dt*(spec?0.008:born?0.02:0.045));
   if(p.stam<=0.05)R.target=Math.min(R.target,1.2);
   cur.swimDist+=Math.abs(p.speed)*dt; if(cur.swimDist>=10){cur.swimDist-=10;G.quest.dailyEvt('swim',10);}
  }
  /* flight economy and the flying mastery track */
  if(p.flying){
   const M=cur.M, FR=cur.fr||{1:1,4:4,7:7,10:10};
   if(!cur.wasFlying){cur.wasFlying=true;if(M<FR[1])p.stam=Math.max(0,(p.stam==null?1:p.stam)-0.15);}
   if(R.gallop&&R.fwd){p.stam=Math.max(0,(p.stam==null?1:p.stam)-dt*0.02*(M>=FR[10]?0.7:1)*drain);R.regen=0;}   // a fast flight spends stamina; a glide gets it back
   if(M>=FR[4]&&R.gallop&&(p.climbInput||0)<0)p.flyAlt=Math.max(0,(p.flyAlt||0)-4*dt);   // Wing Tuck: a dive, not level flight
   if(M>=FR[10]&&R.fwd)R.target*=1.15;
   if(M>=FR[10]&&p.boostT>0)p.boostT+=dt*0.3;
   if(p.stam<=0.05)R.target=Math.min(R.target,7);
  }else cur.wasFlying=false;
  cur.drainMul=drain;
 });
 /* the per-frame pass: body in the water, splashes, the glow, the egg, the acrobat */
 let splashes=null, glowLight=null, sunLight=null;
 function mkSplashes(){
  const cv=document.createElement('canvas');cv.width=cv.height=32;const c=cv.getContext('2d');const g=c.createRadialGradient(16,16,2,16,16,16);g.addColorStop(0,'rgba(255,255,255,0.95)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,32,32);
  const tex=new THREE.CanvasTexture(cv);const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false,opacity:0.85});
  splashes=[];for(let i=0;i<10;i++){const sp=new THREE.Sprite(mat);sp.visible=false;sp.scale.setScalar(0.35);G.scene.add(sp);splashes.push({sp,life:0,vy:0});}
 }
 G.on('tick',(dt,t)=>{
  const p=player; if(!p.mesh)return;
  if(p.swim){
   p.mesh.position.y-=Math.min(0.7,(p.swimDepth||0)*0.55);
   if(Math.abs(p.speed)>1){cur.splashT+=dt;if(cur.splashT>0.22){cur.splashT=0;if(!splashes)mkSplashes();const f=splashes.find(x=>x.life<=0);if(f){f.life=0.55;f.vy=1.6;f.sp.visible=true;f.sp.position.set(p.pos.x+(Math.random()-0.5)*0.9,p.mesh.position.y+0.5,p.pos.z+(Math.random()-0.5)*0.9);f.sp.scale.setScalar(0.3+Math.random()*0.3);}}}
  }
  if(splashes)for(const f of splashes){if(f.life<=0)continue;f.life-=dt;f.sp.position.y+=f.vy*dt;f.vy-=4*dt;f.sp.material.opacity=Math.max(0,f.life*1.5);if(f.life<=0)f.sp.visible=false;}
  /* a glowing horse lights the night */
  if(cur.abil==='glow'){
   if(!glowLight){glowLight=new THREE.PointLight(0xc8b0ff,0,10,1.6);glowLight.position.set(0,1.5,0.4);}
   if(glowLight.parent!==p.mesh){if(glowLight.parent)glowLight.parent.remove(glowLight);p.mesh.add(glowLight);}
   if(!sunLight)sunLight=G.scene.children.find(o=>o.isDirectionalLight)||null;
   const night=sunLight?Math.max(0,Math.min(1,(1.2-sunLight.intensity)/1.0)):0;
   glowLight.intensity+=(night*1.6-glowLight.intensity)*Math.min(1,dt*2);
   glowLight.color.set(({galaxy:0xc8b0ff,petal:0xffb0d8,fire:0xffa040,ice:0xa0e0ff,aurora:0x80ffd0,moonlit:0xc0d0ff,solar:0xffd080,tide:0x80fff0,glimmer:0xffe080}[cur.h&&cur.h.coat])||0xc8b0ff);
  }else if(glowLight&&glowLight.parent){glowLight.parent.remove(glowLight);}
  /* acrobatics in flight */
  const tr=p.trick; if(tr&&tr!==cur.lastTrick){cur.lastTrick=tr;if(p.flying&&cur.M>=(cur.fr?cur.fr[7]:7)){G.xp.passAdd(2);cur.trickN++;if(cur.trickN%5===1)toast('🪽 Aerial Acrobatics! +2 pass points');}}
  if(!tr)cur.lastTrick=null;
  /* eggs sit where the foal stands */
  if(eggs.length)for(const e of eggs){if(e.ent&&e.ent.parts&&e.ent.parts.group){const g=e.ent.parts.group;g.visible=false;e.mesh.position.set(g.position.x,G.world.groundH(g.position.x,g.position.z),g.position.z);e.mesh.rotation.y=Math.sin(t*1.3+e.ph)*0.06;}}
 });
 /* dragon eggs in the pasture, until the foal grows */
 let eggs=[];
 function eggMesh(coat){
  const th=(T.DRAGON_TINT&&(T.DRAGON_TINT[coat]||T.DRAGON_TINT._))||{web:'#9fb4d8',glow:'#cfe0ff',root:'#2b3546'};
  const g=new THREE.Group(); g.name='dragonEgg';
  const m=new THREE.Mesh(new THREE.SphereGeometry(0.52,18,14),new THREE.MeshStandardMaterial({color:th.root||'#2b3546',emissive:new THREE.Color(th.glow||'#cfe0ff'),emissiveIntensity:0.35,roughness:0.5,metalness:0.15}));
  m.scale.set(1,1.32,1); m.position.y=0.66; m.castShadow=true; g.add(m);
  for(let i=0;i<7;i++){const sp=new THREE.Mesh(new THREE.SphereGeometry(0.07,8,6),new THREE.MeshStandardMaterial({color:th.web||'#9fb4d8',emissive:new THREE.Color(th.glow||'#cfe0ff'),emissiveIntensity:0.6}));const a=i*2.2,y=0.35+((i*37)%50)/60;sp.position.set(Math.cos(a)*0.46*Math.sin(y*2.3),y,Math.sin(a)*0.46*Math.sin(y*2.3));g.add(sp);}
  const nest=new THREE.Mesh(new THREE.TorusGeometry(0.62,0.14,8,18),new THREE.MeshStandardMaterial({color:'#8a6a3a',roughness:0.95}));nest.rotation.x=Math.PI/2;nest.position.y=0.12;g.add(nest);
  return g;
 }
 function rebuildEggs(){
  for(const e of eggs){if(e.mesh.parent)e.mesh.parent.remove(e.mesh);} eggs=[];
  for(const ent of G.horse.herd()){const h=G.horse.myHorses[ent.idx];if(!h||!h.egg||!h.foal)continue;ent.parts.group.visible=false;const mesh=eggMesh(h.coat);G.scene.add(mesh);eggs.push({ent,mesh,ph:Math.random()*6});}
 }
 G.on('rebuild',()=>{refreshCur();rebuildEggs();
  const el=$('nameEl'),h=cur.h; if(el&&h&&!/⭐/.test(el.textContent))el.textContent+=' '+STAR+starsN(h);
  const fb=$('flyBtn'); if(fb&&h&&h.wings)fb.title=FLIGHT_UNLOCKS[1];
 });
 G.on('coat',()=>refreshCur());
 G.on('grantHorse',()=>{setTimeout(refreshCur,0);});
 G.on('forage',(item)=>{                                              // The Prospector: gathering luck
  const Tk=cur.traits.map(k=>TRAITS[k]).find(x=>x&&x.forage);
  if(!Tk||!regionMatch(Tk.regions)||Math.random()>=Tk.forage)return;
  G.save.sync(s=>{s.items=s.items||{};s.items[item]=(s.items[item]||0)+1;});
  toast('⛏️ The Prospector finds a second one!');
 });
 G.on('courseFinish',(o)=>{ if(cur.traits.indexOf('showstopper')>=0){G.xp.passAdd(10);} });   // Showstopper: +20% of a 50-point finish
 G.on('courseStart',()=>{ const c=G.course.get(); if(!c||!c.ev)return; const hit=cur.traits.filter(k=>TRAITS[k]&&TRAITS[k].regions&&TRAITS[k].regions.some(n=>(c.ev.town||'').indexOf(n)>=0));
  if(hit.length)toast('✦ '+hit.map(k=>TRAITS[k].label).join(' & ')+' — a good match for this course!'); });
 G.on('state',o=>{const p=player,h=cur.h;o.swimming=!!p.swim;o.flyAlt=Number((p.flyAlt||0).toFixed(2));o.waterDepth=Number(waterDepth(p.pos.x,p.pos.z).toFixed(2));
  o.roster={stars:h?starsN(h):0,rarity:h?rarityOf(h):null,variant:h?(h.variant||null):null,traits:h?traitsOf(h):[],mastery:cur.M,ability:cur.abil,mark2:h?(h.mark2||null):null};});

 /* ---- 7. seasons, the pass, exclusives, the boot pass ------------------------------- */
 G.money.rewardKind('seasonHorse',(s,v)=>{grantSeasonHorse(s,v);},v=>'🐴 season '+v+' horse');
 if(T.PASS_FREE[29]&&!T.PASS_FREE[29].seasonHorse)T.PASS_FREE[29].seasonHorse='pass';
 if(T.PASS_GOLD[19]&&!T.PASS_GOLD[19].seasonHorse)T.PASS_GOLD[19].seasonHorse='deluxe';
 /* The week closes: a champion week (the top wage tier) earns the Dusk Mustang, first place in the
    weekly photo gallery the Meadowlark Unicorn, and topping the club's weekly Star Points board the
    Kiln Friesian. Each once per week key; grantExclusive keeps the ledger. The 'weekRoll' hook fires
    with the closing week still in s.wk; the boot pass looks at s.wkLast in case the roll happened
    before this package existed. */
 const CHAMPION_SP=(T.WAGE_TIERS[T.WAGE_TIERS.length-1]||{sp:550}).sp;
 G.world.addBoard({k:'wsp',g:'ride',label:'Star points this week',rate:30,cap:900,val:s=>(s.wk&&s.wk.sp)||0});
 function clubTopIsMe(){ try{const d=(G.net.lbData||{}).wsp||{};const me=G.net.myName();const names=Object.keys(d);if(names.length<2||!(me in d))return false;return names.every(n=>n===me||d[n]<d[me]);}catch(e){return false;} }
 function weeklyCheck(s,w){
  if(!s||!w||!w.week)return [];
  const got=[];
  if((w.sp||0)>=CHAMPION_SP){const h=grantExclusive(s,'duskmustang',w.week,'🏅 A champion week on the weekly board');if(h)got.push(h);}
  if(w.place===1){const h=grantExclusive(s,'larkunicorn',w.week,'📷 First place in the weekly photo gallery');if(h)got.push(h);}
  if(w.clubTop||clubTopIsMe()){const h=grantExclusive(s,'kilnfriesian',w.week,'🏰 Top of the club\'s weekly Star Points board');if(h)got.push(h);}
  return got;
 }
 G.on('weekRoll',s=>{ try{const got=weeklyCheck(s,s.wk);if(got.length)setTimeout(()=>{try{G.horse.reloadHorses();for(const h of got)toast('🎁 '+h.name+' the '+G.horse.breedLabel(h.breed)+' — '+(h.exclusive||'an exclusive horse')+'!');}catch(e){}},1200);}catch(e){} });
 G.on('boot',s=>{
  let got=[]; G.save.sync(sv=>{got=weeklyCheck(sv,sv.wkLast);});
  if(got.length){try{G.horse.reloadHorses();}catch(e){}setTimeout(()=>{try{for(const h of got)toast('🎁 '+h.name+' the '+G.horse.breedLabel(h.breed)+' — '+(h.exclusive||'an exclusive horse')+'!');}catch(e){}},1500);}
  refreshCur(); rebuildEggs();
 });
 function seasonCall(){
  const now=G.time.seasonNow(), SH=seasonHorses(now.def.id); if(!SH.banner){toast('No banner horse this season.');return;}
  const past=[]; for(let n=Math.max(0,now.n-3);n<now.n;n++){const I=seasonInfo(n);if(I.horses.banner&&past.indexOf(I.horses.banner)<0)past.push(I.horses.banner);}
  let msg='',ok=false,key=null;
  G.save.sync(s=>{
   if((s.gems||0)<SEASON_CALL_GEMS){msg='A Season Call costs '+SEASON_CALL_GEMS+'💎 — gems come from events and quests.';return;}
   s.gems-=SEASON_CALL_GEMS; s.roster=s.roster||{}; s.roster.seasonPity=(s.roster.seasonPity||0)+1; s.roster.calls=(s.roster.calls||0)+1;
   const banner=s.roster.seasonPity>=SEASON_CALL_PITY||!past.length||Math.random()<0.6;
   key=banner?SH.banner:past[Math.floor(Math.random()*past.length)];
   if(banner)s.roster.seasonPity=0;
   const b=byKey(key); const h=G.horse.grantHorse(s,key,{src:'season',bond:20,extra:{seasonKey:now.key}});
   msg='✨ '+h.name+' the '+b[1]+' answers the Season Call!'; ok=true;
  });
  toast(msg);
  if(ok){try{G.sGem();}catch(e){}G.money.refreshWallet();G.horse.reloadHorses();G.ui.rerender('catalogPanel');}
 }

 /* ---- 8. UI: chips on every card, the catalogue, the shop's horse shelf --------------- */
 function starChip(h){return '<span style="color:#d9a520;letter-spacing:-2px;font-size:12px" title="'+rarityOf(h)+'">'+STAR.repeat(starsN(h))+'</span>';}
 G.ui.careHeader((s,h)=>{const v=variantLabel(h);const ab=h.ability||flagsOf(h).ability;
  return '<div style="font-size:12px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">'+starChip(h)+' <b>'+esc(rarityOf(h))+'</b>'+(v?' · 🎨 '+esc(v):'')+(h.mark2?' · '+esc(h.mark2):'')+(ab?' · '+({swift:'💨 Swift',leap:'⤴️ Leap',fly:'🪽 Flight',glow:'✨ Glow',swim:'🌊 Swimmer'}[ab]||ab):'')+(traitsOf(h).length?' · '+traitChips(h):' · <span style="color:#8c7a63">no traits</span>')+'</div>';});
 G.ui.careSection((s,h)=>{const M=G.xp.masteryOf(s,h.breed);let x='';
  const pl=perkLine(h.breed,M); if(pl)x+='<div style="font-size:11.5px;margin-top:4px">🏷️ <b>'+esc(G.horse.breedLabel(h.breed))+' perks</b> · '+pl+'</div>';
  if(h.wings)x+='<div style="font-size:11.5px;margin-top:4px">🪽 <b>Flight mastery</b> · '+Object.keys(FLIGHT_UNLOCKS).map(r=>(M>=rungOf(h.breed,+r)?'✅ ':'🔒 ')+rungOf(h.breed,+r)+' '+esc(FLIGHT_UNLOCKS[r])).join(' &nbsp; ')+'</div>';
  if((h.ability||flagsOf(h).ability)==='swim')x+='<div style="font-size:11.5px;margin-top:4px">🌊 <b>Swimmer</b> · crosses rivers and Loon Lake at 85% pace and barely tires — a straight line is a shortcut.</div>';
  return x;});
 G.ui.stableRow((h,i)=>{const v=variantLabel(h);return '<span style="font-size:11px;color:#8c7a63;flex-basis:100%">'+starChip(h)+(v?' · '+esc(v):'')+(h.egg?' · 🥚 egg':'')+(traitsOf(h).length?' · '+traitChips(h):'')+'</span>';});
 G.ui.eventRow((ev,s,h)=>{const hit=traitsOf(h).filter(k=>TRAITS[k].regions&&TRAITS[k].regions.some(n=>(ev.town||'').indexOf(n)>=0));return hit.length?' <span class="badge" title="'+esc(hit.map(k=>TRAITS[k].label).join(', '))+'">TRAIT MATCH</span>':'';});

 /* the shop's horse shelf: stars, a rarity filter, what is not for sale and how to get it */
 let shopStars=0;
 const badgeOf=b=>b[2]==='Ascendant'?' <span style="background:linear-gradient(90deg,#ff9ad5,#9d6bff);color:#fff;border-radius:8px;padding:1px 7px;font-size:11px;font-weight:800">👑 ASCENDANT</span>':b[2]==='Dragon'?' <span style="background:linear-gradient(90deg,#e2703a,#8f4bd0);color:#fff;border-radius:8px;padding:1px 7px;font-size:11px;font-weight:800">🐉 DRAGON</span>':b[2]==='Mythic'?' <span style="background:linear-gradient(90deg,#9d6bff,#ff7ad0);color:#fff;border-radius:8px;padding:1px 7px;font-size:11px;font-weight:800">✨ MYTHIC</span>':b[2]==='Draft'?' <span style="background:#e8b84b;color:#5a3d12;border-radius:8px;padding:1px 7px;font-size:11px;font-weight:800">DRAFT</span>':'';
 const icoOf=b=>b[7].dragon?'🐉':b[7].horn?'🦄':b[7].wings?'🪽':(b[7].coat||b[7].glow)?'✨':'🐴';
 const abOf=b=>b[7].ability?{swift:' · 💨 Swift',leap:' · ⤴️ Leap',fly:' · 🪽 Flight',glow:' · ✨ Glow',swim:' · 🌊 Swims'}[b[7].ability]||'':'';
 function starFilterHtml(){return '<div class="crow" style="gap:4px;flex-wrap:wrap"><span class="lbl" style="font-size:11px">Rarity</span>'+[0,2,3,4,5,6].map(n=>'<button class="tabbtn'+(shopStars===n?' on':'')+'" data-fx="roster:stars:'+n+'" style="padding:3px 9px">'+(n?STAR.repeat(n):'All')+'</button>').join('')+'</div>';}
 G.ui.shopTab({id:'horses',label:'🐴 Horses',render(s,hh){
  let html=starFilterHtml();
  html+=BREEDS3.map((b,i)=>{
   if(!G.horse.breedAvailable(b,'shop'))return '';
   const st=starsOfBreed(b); if(shopStars&&st!==shopStars)return '';
   const owned=s.horses.filter(h=>h.breed===b[0]).length, nc=coatsFor(b[0]).length;
   return '<div class="evrow">'+icoOf(b)+' <b>'+esc(b[1])+'</b>'+badgeOf(b)+'<span><span style="color:#d9a520;letter-spacing:-2px">'+STAR.repeat(st)+'</span> '+b[2]+abOf(b)+(nc?' · '+nc+' coats':'')+(owned?' · owned ×'+owned:'')+'</span><button data-buyh="'+i+'">'+(b[7].hero?'Adopt & ride · Free':b[3]?b[3]+' 🪙':b[4]+' 💎')+'</button></div>';
  }).join('');
  const locked=BREEDS3.filter(b=>!G.horse.breedAvailable(b,'shop')&&(!shopStars||starsOfBreed(b)===shopStars));
  html+='<div style="font-size:12px;color:#8c7a63;margin:8px 0 2px">🔒 Not on the shelf · '+locked.length+' horses come from play — <button data-fx="open:catalogPanel" style="font-size:11px;padding:2px 8px">📖 Catalogue</button></div>';
  html+=locked.slice(0,40).map(b=>'<div class="evrow" style="opacity:.85">'+icoOf(b)+' <b>'+esc(b[1])+'</b>'+badgeOf(b)+'<span><span style="color:#d9a520;letter-spacing:-2px">'+STAR.repeat(starsOfBreed(b))+'</span> '+howToGet(b)+'</span></div>').join('');
  html+='<span style="font-size:11px;color:#8c7a63">'+s.horses.length+' horses and counting · no limits — new friends graze in the Home Pasture</span>';
  return html;
 }});

 /* the catalogue panel: roster, coats, traits, lineage, seasons */
 let catTab='roster';
 const TABS=[['roster','⭐ Roster'],['coats','🎨 Coats'],['traits','✦ Traits'],['lineage','🐉 Lineage'],['seasons','🗓️ Seasons']];
 function catalogHtml(s){
  const h=s.horses[G.horse.rideIdx()];
  let html='<div class="ph">📖 Horse Catalogue<button data-fx="close:catalogPanel" style="margin-left:auto">✖</button></div>'
   +'<div class="crow" style="gap:4px;flex-wrap:wrap">'+TABS.map(t=>'<button class="tabbtn'+(catTab===t[0]?' on':'')+'" data-fx="roster:tab:'+t[0]+'">'+t[1]+'</button>').join('')+'</div>';
  if(catTab==='roster'){
   html+=starFilterHtml();
   const owned=k=>s.horses.filter(x=>x.breed===k).length;
   for(const n of [6,5,4,3,2]){
    if(shopStars&&n!==shopStars)continue;
    const rows=BREEDS3.filter(b=>starsOfBreed(b)===n);
    if(!rows.length)continue;
    html+='<div style="font-size:12px;color:#8c7a63;margin:8px 0 2px"><span style="color:#d9a520;letter-spacing:-2px">'+STAR.repeat(n)+'</span> '+({6:'Ascendant & limited — bred or won',5:'Legendary — the Starfall Call, the seasons and the boards',4:'Epic',3:'Rare',2:'Common & Draft'}[n])+' · '+rows.filter(b=>owned(b[0])).length+'/'+rows.length+' owned</div>';
    html+=rows.map(b=>{const o=owned(b[0]),src=G.horse.breedSrc(b);return '<div class="evrow'+(o?' done':'')+'">'+icoOf(b)+' <b>'+esc(b[1])+'</b>'+badgeOf(b)+'<span><span style="color:#d9a520;letter-spacing:-2px">'+STAR.repeat(n)+'</span> '+b[2]+abOf(b)+' · '+howToGet(b)+(o?' · owned ×'+o:'')+(coatsFor(b[0]).length?' · '+coatsFor(b[0]).length+' coats':'')+'</span></div>';}).join('');
   }
   html+='<div style="font-size:11px;color:#8c7a63;margin-top:6px">Stars set a horse\'s stat ceilings, where it can come from and how many traits it carries. Six-star horses are bred, never bought.</div>';
  }else if(catTab==='coats'){
   const seen=Object.keys((s.roster&&s.roster.coatsSeen)||{}).length;
   html+='<div style="font-size:12px;margin:4px 0">🧬 <b>'+seen+' coats</b> seen on the ranch · named coats per breed below · every arrival rolls its own shade and a second marking (blaze, star, snip, socks, stockings)</div>';
   if(h){const L=coatsFor(h.breed);const fl=flagsOf(h);
    html+='<div style="font-size:12px;color:#8c7a63;margin:6px 0 2px">🎨 '+esc(h.name)+' · '+esc(G.horse.breedLabel(h.breed))+(h.variant?' · wearing <b>'+esc(variantLabel(h))+'</b>':'')+(fl.coat?' · a themed coat keeps its magic':L.length?' · change for '+DYE_COST+'🪙':'')+'</div>';
    if(!fl.coat&&!fl.hero)html+='<div class="crow" style="gap:5px;flex-wrap:wrap">'+L.map(v=>'<button data-fx="roster:coat:'+v[0]+'" title="'+esc(v[1])+(v[4]&&v[4]!=='none'?' · '+v[4]:'')+'"'+(h.variant===v[0]?' class="claimBtn"':'')+' style="display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:3px 8px"><span style="width:14px;height:14px;border-radius:50%;background:'+v[2]+';border:2px solid '+v[3]+';display:inline-block"></span>'+esc(v[1])+'</button>').join('')
     +'<span class="lbl" style="font-size:11px">Face &amp; legs</span>'+['none','blaze','star','snip','socks','stockings'].map(m=>'<button data-fx="roster:mark2:'+m+'"'+((h.mark2||'none')===m?' class="claimBtn"':'')+' style="font-size:11px;padding:3px 8px">'+m+'</button>').join('')+'</div>';}
   html+=Object.keys(COATS3).map(k=>{const b=byKey(k);if(!b)return '';const have=s.horses.filter(x=>x.breed===k);const worn=new Set(have.map(x=>x.variant).filter(Boolean));
    return '<div class="evrow"><b>'+esc(b[1])+'</b><span>'+COATS3[k].map(v=>'<span title="'+esc(v[1])+'" style="display:inline-block;width:13px;height:13px;border-radius:50%;background:'+v[2]+';border:2px solid '+(worn.has(v[0])?'#d9a520':v[3])+';margin-right:2px;vertical-align:middle"></span>').join('')+' '+worn.size+'/'+COATS3[k].length+'</span></div>';}).join('');
  }else if(catTab==='traits'){
   html+='<div style="font-size:12px;margin:4px 0">Traits are carried by the horse, not the breed. Rare horses roll one, five-star horses one or two, six-star horses two; foals inherit from both sides. Match a trait to a course and it shows a <span class="badge">TRAIT MATCH</span>.</div>';
   html+=Object.keys(TRAITS).map(k=>{const Tk=TRAITS[k];const n=s.horses.filter(x=>(x.traits||[]).indexOf(k)>=0).length;return '<div class="evrow">'+(Tk.icon||'✦')+' <b>'+esc(Tk.label)+'</b><span>'+esc(Tk.desc||'')+(Tk.roster?'':' · breeding trait')+(n?' · '+n+' of yours':'')+'</span></div>';}).join('');
  }else if(catTab==='lineage'){
   const found=(s.roster&&s.roster.variantsFound)||{};
   html+='<div style="font-size:12px;margin:4px 0">🐉 The Emberflight line. Breed a dragon with the right partner and the foal is a new element. The Elder Dragon\'s foals hatch from eggs.</div>';
   html+='<div class="crow" style="gap:6px;flex-wrap:wrap">'+DRAGON_FAMILY.map(k=>{const b=byKey(k);const have=s.horses.some(x=>x.breed===k)||found[k];return '<span style="border:1px solid '+(have?'#d9a520':'#ddd')+';border-radius:10px;padding:3px 8px;font-size:11px;background:'+(have?'#fff3d6':'#f6f2ea')+'">'+(have?'🐉 '+esc(b?b[1]:k):'❔ unknown')+'</span>';}).join('')+'</div>';
   html+=VARIANT_RECIPES.map(r=>{const cb=byKey(r.child);const have=s.horses.some(x=>x.breed===r.child)||found[r.child];return '<div class="evrow'+(have?' done':'')+'">'+(have?'✅':'🔒')+' <b>'+(have?esc(cb?cb[1]:r.child):'???')+'</b><span>'+esc(G.horse.breedLabel(r.a))+' × '+esc(r.hint)+(r.egg?' 🥚':'')+'</span></div>';}).join('');
   html+='<div style="font-size:11px;color:#8c7a63;margin-top:6px">Breeding is in the 🛍️ Shop → 💞 Breed tab; both parents need 60+ bond.</div>';
  }else{
   const now=G.time.seasonNow(), SH=seasonHorses(now.def.id), pity=(s.roster&&s.roster.seasonPity)||0, claimed=(s.roster&&s.roster.exclusives)||{};
   html+='<div style="font-size:12px;margin:4px 0">'+now.def.emoji+' <b>'+esc(now.def.name)+'</b> · day '+now.day+' of 28 · three horses every season, earned in play, and a limited one that comes back another year.</div>';
   for(const role of ['pass','deluxe','banner']){const k=SH[role],b=k&&byKey(k);if(!b)continue;const got=Object.keys(claimed).some(x=>x.startsWith(k+':'))||s.horses.some(x=>x.breed===k);
    html+='<div class="evrow'+(got?' done':'')+'">'+icoOf(b)+' <b>'+esc(b[1])+'</b>'+badgeOf(b)+'<span><span style="color:#d9a520;letter-spacing:-2px">'+STAR.repeat(starsOfBreed(b))+'</span> '+({pass:'🎟️ free track · tier 30',deluxe:'🎟️ gold track · tier 20',banner:'✨ Season Call · '+SEASON_CALL_GEMS+'💎'}[role])+(b[7].traits?' · '+b[7].traits.map(t=>TRAITS[t]?TRAITS[t].icon+' '+TRAITS[t].label:t).join(', '):'')+(got?' · yours':'')+'</span>'
     +(role==='banner'?'<button data-fx="roster:call"'+((s.gems||0)<SEASON_CALL_GEMS?' disabled':'')+'>'+SEASON_CALL_GEMS+' 💎</button>':'')+'</div>';}
   html+='<div style="font-size:11px;color:#8c7a63">Season Call odds: 60% this season\'s banner horse, 40% a returning banner horse from an earlier season; guaranteed banner horse on the '+SEASON_CALL_PITY+'rd call ('+pity+'/'+SEASON_CALL_PITY+' so far). Gems are earned in play — never bought.</div>';
   html+='<div style="font-size:12px;color:#8c7a63;margin:8px 0 2px">🗓️ Release calendar</div>';
   for(let n=now.n;n<now.n+4;n++){const I=seasonInfo(n);const d=new Date(I.start);
    html+='<div class="evrow'+(n===now.n?' done':'')+'">'+I.def.emoji+' <b>'+esc(I.def.name)+'</b><span>'+d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' · '+['pass','deluxe','banner'].map(r=>{const b=byKey(I.horses[r]);return b?esc(b[1]):'';}).filter(Boolean).join(' · ')+'</span></div>';}
   const ret=[];for(let n=Math.max(0,now.n-3);n<now.n;n++){const I=seasonInfo(n);if(I.horses.banner)ret.push(I.horses.banner);}
   html+='<div style="font-size:11px;color:#8c7a63;margin-top:4px">Returning this season: '+(ret.length?ret.map(k=>esc(byKey(k)[1])).join(', '):'none yet — the first season\'s banner horse returns next season')+'</div>';
  }
  return html;
 }
 G.ui.panel({id:'catalogPanel',title:'📖 Catalogue',dock:{label:'📖',after:'stableBtn',title:'Horse catalogue — stars, coats, traits, lineage, seasons'},render(p,s){return catalogHtml(s);},
  vr:{tab:'catalog',label:'Catalogue',build(rows,sv){return 'Open the flat catalogue for the full roster.';}}});
 G.ui.action('roster',(args)=>{
  const [what,val]=args;
  if(what==='tab'){catTab=val;G.ui.rerender('catalogPanel');return;}
  if(what==='stars'){shopStars=+val||0;if($('shopPanel').style.display==='flex')G.ui.openShop('horses');else G.ui.rerender('catalogPanel');return;}
  if(what==='call'){seasonCall();return;}
  if(what==='coat'||what==='mark2'){
   let msg='',ok=false;
   G.save.sync(s=>{const h=s.horses[G.horse.rideIdx()];if(!h){msg='No horse to groom.';return;}
    if(what==='coat'){const v=coatsFor(h.breed).find(x=>x[0]===val);if(!v){msg='No such coat.';return;}if(h.variant===v[0]){msg=h.name+' already wears '+v[1]+'.';return;}
     if((s.coins||0)<DYE_COST){msg='A change costs '+DYE_COST+'🪙.';return;}s.coins-=DYE_COST;applyVariant(h,v);noteCoat(s,h);msg=h.name+' wears '+v[1]+' now.';}
    else{if((s.coins||0)<DYE_COST){msg='A change costs '+DYE_COST+'🪙.';return;}s.coins-=DYE_COST;h.mark2=val==='none'?null:val;noteCoat(s,h);msg=h.name+' — '+(val==='none'?'plain':val)+'.';}
    ok=true;});
   if(ok){G.money.refreshWallet();G.horse.reloadHorses();try{G.horse.applyCoat();}catch(e){}try{G.horse.hairColour();}catch(e){}try{G.sChime();}catch(e){}G.ui.rerender('catalogPanel');}
   toast((ok?'🎨 ':'')+msg);
  }
 });

 /* ---- 9. world, events, quests, achievements ------------------------------------------ */
 T.RACE_ROUTES.ll=[[8,30],[20,16],[34,6],[44,22],[30,34],[12,12]];
 if(!T.EVENTS3.some(e=>e.id==='l1'))T.EVENTS3.push({id:'l1',town:'Loon Lake',name:'Loon Lake Crossing',lvl:3,race:true,route:'ll',reward:450,trains:['speed','stamina']});   // trains: the stats package's per-event stat XP
 T.REGIONS.unshift({name:'🌊 Loon Lake shallows',x:20,z:16,r:4.4});
 G.quest.addDaily({type:'swim',icon:'🏊',label:'Swim 120 m',goal:120,r:{c:120,g:2,p:15}});
 const ownedOf=(s,f)=>s.horses.filter(f).length;
 G.quest.addAch({id:'star6',icon:'👑',label:'Six stars',desc:'Own a six-star horse',v:s=>ownedOf(s,h=>starsN(h)>=6),goal:1,r:{g:10}});
 G.quest.addAch({id:'star5x3',icon:'⭐',label:'Legend collector',desc:'Own 3 five-star horses',v:s=>ownedOf(s,h=>starsN(h)>=5),goal:3,r:{g:4}});
 G.quest.addAch({id:'excl1',icon:'🎁',label:'One of a kind',desc:'Own an exclusive horse',v:s=>ownedOf(s,h=>!!flagsOf(h).exclusive),goal:1,r:{g:3}});
 G.quest.addAch({id:'coat20',icon:'🧬',label:'Colour breeder',desc:'See 20 different coats on the ranch',v:s=>Object.keys((s.roster&&s.roster.coatsSeen)||{}).length,goal:20,r:{c:400,g:2}});
 G.quest.addAch({id:'variant5',icon:'🎨',label:'Coat collector',desc:'Own 5 horses in named coats',v:s=>ownedOf(s,h=>!!h.variant),goal:5,r:{c:300}});
 G.quest.addAch({id:'drake8',icon:'🐉',label:'Dragon keeper',desc:'Find 8 of the dragon lineage',v:s=>Object.keys((s.roster&&s.roster.variantsFound)||{}).length,goal:8,r:{g:8}});
 G.quest.addAch({id:'ascend1',icon:'👑',label:'Ascendant',desc:'Breed an Ascendant horse',v:s=>ownedOf(s,h=>rarityOf(h)==='Ascendant'),goal:1,r:{g:10}});
 G.quest.addAch({id:'trait3',icon:'✦',label:'Talent scout',desc:'Own a horse with 2 traits',v:s=>ownedOf(s,h=>traitsOf(h).length>=2),goal:1,r:{c:250}});
 G.quest.addAch({id:'season1',icon:'🗓️',label:'Season rider',desc:'Earn a season horse',v:s=>ownedOf(s,h=>!!flagsOf(h).season),goal:1,r:{g:3}});
 G.quest.addAch({id:'swim500',icon:'🏊',label:'Strong swimmer',desc:'Swim 500 m',v:s=>Math.floor((s.life&&s.life.swim)||0),goal:500,r:{c:300,g:1}});
 G.quest.addAch({id:'peg10',icon:'🪽',label:'Soaring speed',desc:'Master a winged horse',v:s=>Math.max(0,...s.horses.filter(h=>h.wings).map(h=>Math.round(10*G.xp.masteryOf(s,h.breed)/mxOf(h.breed))),0),goal:10,r:{g:5}});

 /* ---- 10. exports for the other packages ----------------------------------------------- */
 G.horse.roster={rungOf,mxOf,TIER_STARS,COATS3,TRAITS3,VARIANT_RECIPES,DRAGON_FAMILY,BREED_PERKS,FLIGHT_UNLOCKS,FANTASY_CEIL,NEW_THEMES:Object.keys(NEW_THEMES),SEASON_CALL_GEMS,SEASON_CALL_PITY,
  rarityOf,starsN,starsOf,starsOfBreed,variantOf,variantLabel,coatsFor,rollCoat3,applyVariant,rollAppearance,rollTraits,traitsOf,perkFor,resolveVariant,howToGet,
  seasonHorses,seasonInfo,grantExclusive,grantSeasonHorse,weeklyCheck,seasonCall,waterDepth,refreshCur,cur,noteCoat};
}
