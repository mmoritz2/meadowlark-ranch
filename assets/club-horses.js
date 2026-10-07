// Shared by the live roster and the 3D preview. Preserve the stored breed ID,
// coat and color defaults so existing prize horses keep their customization.
export const EMBER_FRIESIAN_BREED=[
 'emberfriesian','Ember Friesian','Legendary',0,0,'#1a1412','#ff7a2a',
 {exclusive:'club',club:true,coat:'fire',glow:true,size:1.08,mark:'sooty',markCol:'#ff9a3a',body:'black',src:'club',family:'fantasy',
  coatLabel:'Obsidian coat with copper ember tracery',
  description:'A club champion’s Friesian: an obsidian coat, a glowing forehead crest, copper-and-gold mane and tail, and drifting cinders that stir as it moves.'}
];

// A Champions token always buys the horse the rider chooses. These profiles
// share the same 37-point budget; their specialties are useful in different rides.
export const CLUB_HORSE_BREEDS=[
 EMBER_FRIESIAN_BREED,
 ['moonveil','Moonveil Andalusian','Legendary',0,0,'#d9dbeb','#4d497a',
  {exclusive:'club',club:true,coat:'moonveil',glow:true,size:1.02,mark:'none',markCol:'#dae7ff',body:'grey',src:'club',family:'fantasy',
   coatLabel:'Pearl silver with moonlit tracery',
   description:'A pearl-silver Andalusian with an indigo mane, a crescent crest, and moonlit markings that shimmer along its coat.'}],
 ['stormglass','Stormglass Arabian','Legendary',0,0,'#182932','#93b5c6',
  {exclusive:'club',club:true,coat:'stormglass',glow:true,size:1,mark:'none',markCol:'#69dbc9',body:'sunset',src:'club',family:'fantasy',
   coatLabel:'Midnight blue with turquoise lightning veins',
   description:'A midnight-blue Arabian with a silver-cyan mane and luminous turquoise mineral veins, like lightning caught inside dark glass.'}],
 ['rosebloom','Rosebloom Gypsy Vanner','Legendary',0,0,'#ead5d0','#75445f',
  {exclusive:'club',club:true,coat:'rosebloom',glow:true,size:1.06,mark:'none',markCol:'#abc58e',body:'vanner',src:'club',family:'fantasy',
   coatLabel:'Warm ivory and rose with gilded botanical markings',
   description:'A warm ivory-and-rose Gypsy Vanner with a flowing plum mane, gilded leaves and rose motifs, and drifting petals.'}],
];

const profiles={
 emberfriesian:{tagline:'Obsidian. Living embers. A champion’s glow.',strength:'Explosive acceleration',stats:{speed:9,stamina:8,jump:6,accel:9,agility:5}},
 moonveil:{tagline:'Pearl silver beneath an indigo moon.',strength:'High jumps and graceful turns',stats:{speed:7,stamina:8,jump:9,accel:6,agility:7}},
 stormglass:{tagline:'Lightning caught in midnight glass.',strength:'Top speed and quick starts',stats:{speed:10,stamina:6,jump:7,accel:8,agility:6}},
 rosebloom:{tagline:'A garden of gold, rose, and flowing plum.',strength:'Long rides and strong jumps',stats:{speed:6,stamina:10,jump:8,accel:6,agility:7}},
};
export const CLUB_HORSE_REWARDS=CLUB_HORSE_BREEDS.map(row=>({
 id:row[0],name:row[1],description:row[7].description,...profiles[row[0]],
}));
