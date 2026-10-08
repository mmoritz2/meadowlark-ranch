// One catalog for the ranch, the shop and the live 3D studio. These horses reuse
// the approved native breed shapes, skeleton, groom and complete gait library.
export const EXPANSION_HORSE_BREEDS = [
 ['dutchwarmblood','Dutch Warmblood','Rare',385,0,'#71432e','#241a16',
  {body:'thoro',src:'shop',family:'horse',mark:'points',markCol:'#211812',maneCol:'#241a16',coatLabel:'Rich bay with dark points',
   description:'A tall bay sport horse for riders who enjoy big fences and an open stride.'}],
 ['tennesseewalker','Tennessee Walking Horse','Uncommon',205,0,'#614737','#e7d4b0',
  {body:'morgan',src:'shop',family:'horse',mark:'none',maneCol:'#e7d4b0',coatLabel:'Chocolate with a flaxen mane',
   description:'A chocolate trail companion with a pale flowing mane and plenty of stamina.'}],
 ['dales','Dales Pony','Common',95,0,'#292d32','#13171c',
  {body:'iceland',src:'shop',family:'horse',mark:'none',maneCol:'#13171c',coatLabel:'Raven black',
   description:'A compact raven-black pony with a sturdy build, quick turns and a brave jump.'}],
 ['belgian','Belgian Draft','Draft',75,0,'#ba753d','#f3dfb2',
  {body:'percheron',src:'shop',family:'horse',mark:'none',maneCol:'#f3dfb2',coatLabel:'Golden chestnut with flaxen hair',
   description:'A broad golden-chestnut draft with a cream mane, built for long countryside rides.'}],
 ['seaglass','Seaglass Mustang','Legendary',880,0,'#3c9895','#dff3df',
  {body:'palomino',src:'shop',family:'fantasy',coat:'seaglass',glow:true,mark:'none',maneCol:'#dff3df',coatLabel:'Ocean jade with pearl foam tracery',
   description:'An ocean-jade Mustang with pearl hair and soft foam lines that shimmer like sunlit water.'}],
 ['starweave','Starweave Unicorn','Legendary',1200,0,'#30233f','#f0c2ad',
  {body:'lipiz',src:'shop',family:'fantasy',coat:'starweave',horn:true,glow:true,mark:'none',maneCol:'#f0c2ad',coatLabel:'Deep plum with a rose-gold star lattice',
   description:'A deep-plum unicorn with rose-gold hair and tiny luminous stars woven across its coat.'}],
];

// Ceilings use the same five attributes and mastery system as the existing
// stable. Named coats remain real colors a horse can inherit or be customized.
export const EXPANSION_HORSE_DETAILS = {
 dutchwarmblood:{strength:'Jumping and sport',stats:{speed:9,stamina:8,jump:10,accel:7,agility:8},
  coats:[['dutchbay','Rich Bay','#71432e','#241a16','points','#211812'],['dutchblack','Black','#28282e','#111116','none'],['dutchgrey','Dapple Grey','#b5b9c2','#69717d','dapple'],['dutchchestnut','Chestnut','#a66338','#673822','none']],
  perks:{5:{label:'Balanced approach',ag:.04},10:{label:'Warmblood scope',jp:.05}},genes:{E:'Ee',A:'Aa',G:'nG'}},
 tennesseewalker:{strength:'Trail stamina',stats:{speed:7,stamina:10,jump:6,accel:7,agility:8},
  coats:[['walkerchocolate','Chocolate Flaxen','#614737','#e7d4b0','none'],['walkerblack','Black','#27262b','#121116','none'],['walkerpalomino','Palomino','#d5ad69','#f4e5c7','none'],['walkerbay','Bay','#805137','#221810','points','#211812']],
  perks:{5:{label:'Trail rhythm',stam:.9},10:{label:'All-day partner',stam:.85}},genes:{E:'Ee',A:'Aa',Cr:'nCr',Z:'nZ'}},
 dales:{strength:'Nimble pony jumper',stats:{speed:6,stamina:9,jump:8,accel:7,agility:9},
  coats:[['dalesraven','Raven Black','#292d32','#13171c','none'],['dalesbay','Dark Bay','#513629','#15110f','points','#17120e'],['dalesgrey','Steel Grey','#858c93','#434950','dapple']],
  perks:{5:{label:'Pony confidence',ag:.05},10:{label:'Brave little jumper',jp:.05}},genes:{E:'EE',A:'Aa',G:'nG'}},
 belgian:{strength:'Power and endurance',stats:{speed:6,stamina:10,jump:6,accel:8,agility:6},
  coats:[['belgiangold','Golden Chestnut','#ba753d','#f3dfb2','none'],['belgianred','Red Chestnut','#a34d2b','#e4bf87','none'],['belgiansorrel','Light Sorrel','#ce8b51','#f5e7c9','none']],
  perks:{5:{label:'Draft heart',stam:.9},10:{label:'Steady power',ac:.05}},genes:{E:'ee',A:'AA'}},
 seaglass:{strength:'Long rides and responsive turns',stats:{speed:8,stamina:10,jump:7,accel:8,agility:9},
  perks:{5:{label:'Rolling tide',stam:.88},10:{label:'Pearl step',ag:.05}}},
 starweave:{strength:'Jumping and agility',stats:{speed:8,stamina:8,jump:10,accel:8,agility:10},
  perks:{5:{label:'Starlit balance',ag:.05},10:{label:'Woven leap',jp:.05}}},
};
for (const row of EXPANSION_HORSE_BREEDS) {
 EXPANSION_HORSE_DETAILS[row[0]].description = row[7].description;
}
