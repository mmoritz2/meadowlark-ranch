// Authored cosmetic designs. Paid ownership is verified separately from local saves.
import {PREMIUM_TACK_SETS} from './premium-tack.mjs';
import {authorizedPaidTack} from './paid-tack-access.mjs';
// This module is shared by the boutique, illustrated item cards and fitted 3D tack.
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const TACK_SLOTS=freeze(['saddle','pad','bridle','shoes']);
export const TACK_SLOT_LABELS=freeze({saddle:'Saddles',pad:'Saddle pads',bridle:'Bridles',shoes:'Legwear'});
export const RAINBOW_TACK_PRODUCT='tack_rainbow';
export const RAINBOW_TACK_CENTS=PREMIUM_TACK_SETS[0].cents;
const rows=[
 ['moonpetal','Moonpetal','crescent','#31374f','#c9bfdc','#d8cba9','#c3a1d7','scroll','scallop','Moonlit petals and tiny crescent clasps.'],
 ['bramblecourt','Bramble Court','leaf','#4a382e','#64795a','#b59a62','#d3b88c','herringbone','braid','Woodland leaves worked into soft, braided edges.'],
 ['tidalglass','Tidal Glass','wave','#304f54','#8ebcbd','#c5d8d5','#a6e1d0','chevron','double','Wave stitching and translucent sea-glass accents.'],
 ['emberfox','Emberfox','flame','#55352e','#ae6144','#d4a45d','#eeaa67','lattice','studded','Flame-shaped tooling with warm copper fittings.'],
 ['cloudlark','Cloudlark','feather','#6d7475','#dce5df','#c7b58b','#b1cce5','quilt','piping','Feather embroidery and a pale, cloud-soft lining.'],
 ['frostlace','Frostlace','snowflake','#45566e','#aac5d5','#d7dfdf','#d7eced','lattice','scallop','Fine snowflake details on a frost-blue field.'],
 ['sunwheat','Sunwheat','wheat','#795632','#d6b45d','#cbaa61','#f2dc97','herringbone','double','Wheat-stem embroidery and sun-warmed brass.'],
 ['mossgrove','Mossgrove','vine','#3b4940','#78895d','#a9ab76','#bdd196','scroll','braid','Climbing vines and rounded woodland trim.'],
 ['rosequartz','Rose Quartz','rose','#79515c','#cea5ae','#d9c4ae','#edc6d2','quilt','scallop','Rose rosettes and softly faceted pink stones.'],
 ['stormkite','Stormkite','bolt','#303e50','#6c85a1','#bcc5cc','#93bfe1','chevron','studded','Angular lightning details with brushed silver.'],
 ['nightorchid','Night Orchid','orchid','#3a3048','#8a6d9e','#b4a6c7','#c4a1df','scroll','double','Layered orchid embroidery for evening rides.'],
 ['pearlcove','Pearl Cove','pearl','#655c54','#ded8c8','#c6b68d','#f0e8d7','quilt','piping','Pearl buttons and gently curved shell stitching.'],
 ['copperspur','Copper Spur','star','#6b412c','#a6794b','#c89160','#e8c493','herringbone','studded','Western star tooling and hammered copper edges.'],
 ['willowwisp','Willow Wisp','wisp','#425b54','#94b9a2','#c3c898','#d4e8b1','scroll','braid','Trailing wisps stitched over soft willow green.'],
 ['mapleharvest','Maple Harvest','maple','#694335','#b16b45','#c7a265','#e5b867','chevron','double','Maple-leaf appliqué and autumn-colored borders.'],
 ['thistlewing','Thistlewing','thistle','#54445e','#9b8bad','#b2b797','#d0bce0','lattice','scallop','Thistle flowers with delicate wing-shaped trim.'],
 ['lavenderhaze','Lavender Haze','lavender','#615366','#b5a6c8','#cbbfac','#e4d2ec','herringbone','piping','Little lavender sprigs on a neatly stitched field.'],
 ['obsidianrose','Obsidian Rose','thorn','#292a32','#70505c','#a9a4aa','#bd738e','scroll','studded','Thorn scrollwork and dark rose-colored crystals.'],
 ['staratlas','Star Atlas','compass','#303e55','#648393','#ccb879','#a7ccd7','lattice','double','Compass points and a carefully plotted star border.'],
 ['meadowmoth','Meadow Moth','moth','#64623e','#c3ba83','#bd9f61','#e4dbb2','quilt','scallop','Moth-wing embroidery with tiny golden eyespots.'],
 ['rivermint','River Mint','reeds','#42615d','#a3c8b7','#b6c7bb','#d4ead5','chevron','piping','Reed silhouettes and fresh mint piping.'],
 ['coralcrest','Coral Crest','shell','#815854','#d29b85','#d5b98f','#f0ccb3','scroll','scallop','Fan-shell edges and a warm coral lining.'],
 ['auroraveil','Aurora Veil','ribbon','#444565','#938bad','#c7ccd5','#a5dcd7','chevron','braid','Sweeping ribbon embroidery with cool opal accents.'],
 ['crystalvale','Crystal Vale','crystal','#58667b','#b4c6d4','#d1d8dd','#d9e6f1','lattice','studded','Faceted crystals set into crisp silver borders.'],
 ['goldleaf','Goldleaf','laurel','#635538','#b8a06b','#d8bc69','#f0dd9c','herringbone','double','Laurel embroidery and a finely edged gold finish.'],
];
export const TACK_COLLECTIONS=freeze(rows.map(([id,name,ornament,leather,cloth,metal,accent,pattern,trim,description],index)=>({id,name,description,ornament,leather,cloth,metal,accent,lining:'#e8dfcd',pattern,trim,index})).concat(PREMIUM_TACK_SETS.map((set,i)=>({id:set.id,name:set.name,description:set.description,...set.design,premiumProduct:set.productId,priceCents:set.cents,index:25+i}))).concat([{id:'classicwestern',name:'Classic Western',description:'The original brown Western saddle, cloth pad and leather bridle. An optional free three-piece cosmetic look; no legwear is included. These originals cannot be sold, salvaged, merged or upgraded.',free:true,nativeOriginal:true,slots:['saddle','pad','bridle'],profiles:{saddle:'roper',pad:'square',bridle:'classic'},ornament:'star',leather:'#69472e',cloth:'#c7b796',metal:'#a69b82',accent:'#92704b',lining:'#dccbaa',pattern:'scroll',trim:'double',index:31}]));
const profiles={saddle:['trail','roper','endurance','show','barrel'],pad:['square','round','swallowtail','scallop','shield'],bridle:['classic','browband','crescent','plaited','crown'],shoes:['wraps','boots','guards','ribbon','plated']};
const names={saddle:['Trail Saddle','High-Cantle Saddle','Endurance Saddle','Show Saddle','Barrel Saddle'],pad:['Quilted Square Pad','Rounded Trail Pad','Swallowtail Pad','Scalloped Show Pad','Shield Pad'],bridle:['Trail Bridle','Browband Bridle','Crescent Bridle','Braided Bridle','Crown Bridle'],shoes:['Ribbon Wraps','Trail Boots','Hoof Guards','Cross-Laced Wraps','Plated Boots']};
const slotStats={saddle:'stamina',pad:'jump',bridle:'agility',shoes:'accel'},slotPrice={saddle:280,pad:180,bridle:220,shoes:160};
export const TACK_PIECES=freeze(TACK_COLLECTIONS.flatMap((theme,index)=>(theme.slots||TACK_SLOTS).map((slot,slotIndex)=>{
 const shape=theme.profiles?profiles[slot].indexOf(theme.profiles[slot]):(index+slotIndex*2)%5,id='tc_'+theme.id+'_'+slot,primary=slotStats[slot];
 return {id,catalogId:id,name:theme.name+' '+(theme.nativeOriginal?{saddle:'Saddle',pad:'Pad',bridle:'Bridle'}[slot]:names[slot][shape]),theme:theme.id,collectionId:theme.id,collectionName:theme.name,slot,slotLabel:slot==='shoes'?'Legwear':slot==='pad'?'Saddle pad':slot==='saddle'?'Saddle':'Bridle',
  priceCoins:theme.free?0:theme.premiumProduct?null:slotPrice[slot]+Math.floor(index/5)*80+(index%5)*20,currency:theme.premiumProduct?'usd':'coins',...(theme.premiumProduct?{premiumProduct:theme.premiumProduct,priceCents:theme.priceCents}:{}),...(theme.free?{free:true}:{}),rarity:'Common',bonus:theme.free?{}:{[primary]:1},primary,style:slot==='saddle'||slot==='bridle'?'western':null,
  description:theme.nativeOriginal?theme.description:theme.description+' '+({saddle:'A Western seat with shaped panels and decorative fittings.',pad:'A fitted cloth pad with a distinct cut and stitched surface.',bridle:'A fitted headstall with matching brow and cheek details.',shoes:'A matching set for all four legs.'}[slot]),
  design:{...(theme.nativeOriginal?{nativeOriginal:true}:{}),leather:theme.leather,metal:theme.metal,cloth:theme.cloth,accent:theme.accent,lining:theme.lining,pattern:theme.pattern,profile:profiles[slot][shape],trim:theme.trim,ornament:theme.ornament,variant:index*4+slotIndex,...(theme.premiumTheme?{premiumTheme:theme.premiumTheme}:{}),...(theme.rainbow?{rainbow:true,palette:theme.palette}:{})}};
})));
const byId=new Map(TACK_PIECES.map(piece=>[piece.id,piece]));
export const getTackPiece=id=>byId.get(id)||null;
export function ownedTackPiece(save,catalogId){
 const def=getTackPiece(catalogId);if(!def)return null;
 return (Array.isArray(save?.tack)?save.tack:[]).find(item=>item?.catalogId===catalogId&&item.slot===def.slot&&typeof item.id==='string'&&item.id.length>0&&(!def.premiumProduct||authorizedPaidTack(item)))||null;
}
export function tackPieceWearer(save,catalogId){
 const item=ownedTackPiece(save,catalogId);if(!item)return null;
 return (save.horses||[]).find(h=>h.gear?.[item.slot]===item.id)||null;
}
// These functions have no DOM, clocks, randomness or game globals. G.save.sync
// provides the current save, so repeated clicks recheck ownership before charging.
const validInventorySave=save=>!!save&&typeof save==='object'&&!Array.isArray(save)&&(save.tack==null||Array.isArray(save.tack));
function createInventoryItem(inventory,def,inventoryId){
 const ids=new Set(inventory.map(item=>item?.id));
 let itemId=inventoryId;if(itemId!==undefined&&(typeof itemId!=='string'||!itemId||itemId.length>100||!/^[a-zA-Z0-9_-]+$/.test(itemId)||ids.has(itemId)))return {ok:false,code:'invalid-inventory-id'};
 if(!itemId){itemId='boutique_'+def.id;let n=2;while(ids.has(itemId))itemId='boutique_'+def.id+'_'+n++;}
 const item={id:itemId,catalogId:def.id,collectionId:def.collectionId,slot:def.slot,name:def.name,rarity:def.rarity,bonus:{...def.bonus},primary:def.primary,secondary:null,lvl:1,merged:0,set:null,style:def.style};
 return {ok:true,item};
}
export function buyTackPiece(save,catalogId,{inventoryId}={}){
 const def=getTackPiece(catalogId);if(!def)return {ok:false,code:'unknown-item'};
 if(def.premiumProduct)return {ok:false,code:'paid-purchase-required'};
 if(!validInventorySave(save))return {ok:false,code:'invalid-save'};
 const owned=ownedTackPiece(save,catalogId);if(owned)return {ok:true,changed:false,code:'already-owned',item:owned};
 if(def.priceCoins>0&&(!Number.isFinite(save.coins)||save.coins<def.priceCoins))return {ok:false,code:'insufficient-coins',needed:def.priceCoins};
 const inventory=Array.isArray(save.tack)?save.tack:[],created=createInventoryItem(inventory,def,inventoryId);if(!created.ok)return created;
 if(!def.free){save.coins-=def.priceCoins;save.stats=save.stats||{};save.stats.tackBought=(save.stats.tackBought||0)+1;}save.tack=inventory;inventory.push(created.item);
 return {ok:true,changed:true,code:def.free?'claimed':'bought',item:created.item,cost:def.priceCoins};
}
// Gameplay rewards may grant ordinary catalog tack. Free originals are explicit
// claims, and premium sets must always come from verified account entitlements.
export function grantEarnedTackPiece(save,catalogId,{inventoryId}={}){
 const def=getTackPiece(catalogId);if(!def)return {ok:false,code:'unknown-item'};
 if(def.premiumProduct)return {ok:false,code:'paid-purchase-required'};
 if(def.free||def.currency!=='coins'||!(def.priceCoins>0))return {ok:false,code:'earned-tack-only'};
 if(!validInventorySave(save))return {ok:false,code:'invalid-save'};
 const owned=ownedTackPiece(save,catalogId);if(owned)return {ok:true,changed:false,code:'already-owned',item:owned};
 const inventory=Array.isArray(save.tack)?save.tack:[],created=createInventoryItem(inventory,def,inventoryId);if(!created.ok)return created;
 save.tack=inventory;inventory.push(created.item);
 return {ok:true,changed:true,code:'granted',item:created.item};
}
export function equipTackPiece(save,catalogId,horseId){
 const def=getTackPiece(catalogId);if(!def)return {ok:false,code:'unknown-item'};
 const item=ownedTackPiece(save,catalogId);if(!item)return {ok:false,code:'not-owned'};
 const horse=(save.horses||[]).find(h=>String(h.id)===String(horseId));if(!horse)return {ok:false,code:'no-horse'};
 if(horse.foal||horse.egg)return {ok:false,code:'horse-too-young'};
 const assignments=(save.horses||[]).flatMap(h=>Object.entries(h.gear||{}).filter(([,id])=>id===item.id).map(([slot])=>({h,slot})));
 if(assignments.length===1&&assignments[0].h===horse&&assignments[0].slot===def.slot&&!(def.slot==='saddle'&&horse.bareback))return {ok:true,changed:false,code:'already-equipped',item,horse};
 for(const {h,slot} of assignments)delete h.gear[slot];
 horse.gear=horse.gear||{};horse.gear[def.slot]=item.id;if(def.slot==='saddle')horse.bareback=false;
 return {ok:true,changed:true,code:'equipped',item,horse};
}
export function unequipTackPiece(save,catalogId,horseId){
 const def=getTackPiece(catalogId);if(!def)return {ok:false,code:'unknown-item'};
 const item=ownedTackPiece(save,catalogId);if(!item)return {ok:false,code:'not-owned'};
 const horse=(save.horses||[]).find(h=>String(h.id)===String(horseId));if(!horse)return {ok:false,code:'no-horse'};
 if(horse.gear?.[def.slot]!==item.id)return {ok:true,changed:false,code:'not-equipped',item,horse};
 delete horse.gear[def.slot];return {ok:true,changed:true,code:'unequipped',item,horse};
}

// A set changes only its declared slots. Free originals are claimed only by
// this explicit action; paid/earned pieces must already be owned.
export function equipTackCollection(save,collectionId,horseId){
 const collection=TACK_COLLECTIONS.find(c=>c.id===collectionId),pieces=TACK_PIECES.filter(p=>p.collectionId===collectionId);
 if(!collection||!pieces.length)return {ok:false,code:'unknown-item'};
 if(!save||typeof save!=='object'||(save.tack!=null&&!Array.isArray(save.tack)))return {ok:false,code:'invalid-save'};
 const horse=(save.horses||[]).find(h=>String(h.id)===String(horseId));
 if(!horse)return {ok:false,code:'no-horse'};if(horse.foal||horse.egg)return {ok:false,code:'horse-too-young'};
 if(pieces.some(p=>!ownedTackPiece(save,p.id)&&!p.free))return {ok:false,code:'not-owned'};
 let changed=false;
 for(const piece of pieces){if(!ownedTackPiece(save,piece.id)){const result=buyTackPiece(save,piece.id);if(!result.ok)return result;changed||=result.changed;}}
 for(const piece of pieces){const result=equipTackPiece(save,piece.id,horseId);changed||=result.changed;}
 return {ok:true,changed,code:'collection-equipped',collection,horse,items:pieces.map(p=>ownedTackPiece(save,p.id))};
}
export function unequipTackCollection(save,collectionId,horseId){
 const collection=TACK_COLLECTIONS.find(c=>c.id===collectionId);
 if(!collection)return {ok:false,code:'unknown-item'};
 const horse=(save?.horses||[]).find(h=>String(h.id)===String(horseId));if(!horse)return {ok:false,code:'no-horse'};
 let changed=false;
 for(const piece of TACK_PIECES.filter(p=>p.collectionId===collectionId)){const item=ownedTackPiece(save,piece.id);if(item&&horse.gear?.[piece.slot]===item.id){const result=unequipTackPiece(save,piece.id,horseId);changed=result.changed||changed;}}
 return {ok:true,changed,code:'collection-unequipped',collection,horse};
}
