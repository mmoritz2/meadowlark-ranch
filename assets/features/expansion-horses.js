import {EXPANSION_HORSE_BREEDS,EXPANSION_HORSE_DETAILS} from '../expansion-horses.js?v=horses-expansion-1';
import {registerExpansionHorseCoats} from '../expansion-horse-coats.js?v=horses-expansion-1';

export const id='expansion-horses';

// Register after horse-roster so its coat, ceiling and mastery tables are shared
// by the shop, breeding, care and the ride itself.
export function install(G){
 if(G.expansionHorses)return;
 const T=G.tables,H=G.horse,R=H.roster;
 const rows=EXPANSION_HORSE_BREEDS,details=EXPANSION_HORSE_DETAILS;
 const byKey=new Map(rows.map(row=>[row[0],row]));
 const has=(o,key)=>Object.prototype.hasOwnProperty.call(o||{},key);
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 T.BREED_CEIL=T.BREED_CEIL||{};

 for(const row of rows){
  if(!T.BREEDS3.some(existing=>existing[0]===row[0]))T.BREEDS3.push([...row.slice(0,7),{...row[7]}]);
  H.breedModels?.alias?.(row[0],row[7].body,row);
  const d=details[row[0]];
  T.BREED_CEIL[row[0]]={...d.stats};
  if(R){
   if(d.coats&&R.COATS3&&!R.COATS3[row[0]])R.COATS3[row[0]]=d.coats.map(coat=>{
    const copy=coat.slice();if(R.tameHex)copy[2]=R.tameHex(copy[2]);return copy;
   });
   if(d.perks&&R.BREED_PERKS&&!R.BREED_PERKS[row[0]])R.BREED_PERKS[row[0]]=Object.fromEntries(Object.entries(d.perks).map(([rung,perk])=>[rung,{...perk}]));
   if(row[7].family==='fantasy'&&R.FANTASY_CEIL)R.FANTASY_CEIL[row[0]]={...d.stats};
  }
 }
 registerExpansionHorseCoats(G);
 // Shop rows otherwise enter the generic summon pool too. These newcomers
 // have a direct earned-coin price, with no random draw or rotating listing.
 H.sourceRule((ctx,row)=>byKey.has(row?.[0])&&(ctx==='summon'||ctx==='market')?false:undefined);

 function ensureHorse(h){
  const row=byKey.get(h?.breed);if(!row)return;
  const flags=row[7];h.colors=h.colors||{};
  if(h.colors.body==null)h.colors.body=row[5];
  if(h.colors.mane==null)h.colors.mane=flags.maneCol||row[6];
  // Undefined is an old/missing field. Null is the rider's explicit plain coat.
  if(h.coat===undefined)h.coat=flags.coat||null;
  if(h.mark==null&&!h.coat)h.mark=flags.mark||'none';
  if(h.mark2===undefined)h.mark2=null;
 }
 G.save.ensure(s=>{for(const h of s?.horses||[])ensureHorse(h);});
 G.save.ensureHorse(ensureHorse);

 const lookKeys=['coat','mark','markCol','mark2','variant','tailCol','horn','wings','glow','ability'];
 G.on('grantHorse',(s,h,opts={})=>{
  const row=byKey.get(h?.breed);if(!row)return;
  const flags=row[7],extra=opts.extra||{};
  // The earlier roster hook randomizes natural coats. Keep that variety while
  // letting an explicit arrival look (e.g. a named reward) take precedence.
  if(opts.colors)h.colors={...opts.colors};
  if(extra.colors)h.colors={...extra.colors};
  for(const key of lookKeys)if(has(extra,key))h[key]=extra[key];
  if(flags.coat&&h.coat===flags.coat){
   if(!opts.colors&&!extra.colors)h.colors={body:row[5],mane:flags.maneCol||row[6]};
   if(!has(extra,'mark'))h.mark=flags.mark||'none';
   if(!has(extra,'markCol')){
    if(flags.markCol)h.markCol=flags.markCol;else delete h.markCol;
   }
   // A random white marking from an arrival with explicit colors can obscure
   // the themed material. Only keep one if it was deliberately requested.
   if(!has(extra,'mark2'))h.mark2=null;
  }
  ensureHorse(h);
 });

 function applyFoal(s,foal,a,b,opts={}){
  const row=byKey.get(foal?.breed);if(!row)return;
  const flags=row[7],mirror=Array.isArray(opts.pot)&&opts.pot.includes('mirror');
  if(flags.coat&&foal.coat===flags.coat&&!mirror){
   // makeFoal averages parents' colors before the breeding hook. For this
   // breed's own fantasy coat that average would be interpreted as a dye.
   foal.colors={body:row[5],mane:flags.maneCol||row[6]};
   foal.mark=flags.mark||'none';
   if(flags.markCol)foal.markCol=flags.markCol;else delete foal.markCol;
   foal.mark2=null;foal.variant=null;
  }else if(!foal.coat&&foal.mark==null){
   // Preserve genetic colors, including a plain chestnut foal on a bay shape.
   foal.mark='none';
  }
  ensureHorse(foal);
 }
 let foalHookReady=false;
 G.on('boot',()=>{
  const genes=G.breeding?.BREED_GENES;
  if(genes)for(const row of rows){const d=details[row[0]];if(d.genes&&!genes[row[0]])genes[row[0]]={...d.genes};}
  // Breeding installs later than the roster. Run after its genetic appearance
  // hook, and register only once if the boot signal is repeated.
  if(!foalHookReady){G.on('foal',applyFoal);foalHookReady=true;}
 });

 G.ui?.section?.('shopHorseRow',row=>{
  if(!byKey.has(row?.[0]))return '';
  const d=details[row[0]];
  return '<br><span data-expansion-horse="'+esc(row[0])+'">'+esc(d.strength)+' · Earn with coins</span><br><small>'+esc(d.description)+'</small>';
 });
 G.expansionHorses={KEYS:rows.map(row=>row[0]),ROWS:rows,DETAILS:details,source:'shop',currency:'coins'};
}
