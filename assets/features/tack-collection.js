import {TACK_COLLECTIONS,TACK_PIECES,TACK_SLOTS,TACK_SLOT_LABELS,getTackPiece,ownedTackPiece,tackPieceWearer,buyTackPiece,equipTackPiece,unequipTackPiece,equipTackCollection,unequipTackCollection} from '../tack-collection.mjs?v=tack-summon-20261007';
import {tackPieceSVG} from '../tack-collection-art.mjs?v=lookbook-1';
export const id='tack-collection';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PAGE_SIZE=12;
const dollars=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
const statNames={stamina:'stamina',jump:'jump',agility:'agility',accel:'acceleration'};
export function filterTackPieces(save,{query='',slot='all',theme='all',owned=false}={}){
 const q=query.trim().toLowerCase();
 return TACK_PIECES.filter(p=>(slot==='all'||p.slot===slot)&&(theme==='all'||p.theme===theme)&&(!owned||ownedTackPiece(save,p.id))&&(!q||(p.name+' '+p.description+' '+p.slotLabel).toLowerCase().includes(q)));
}
export const isStaticTackPreview=(hostname=globalThis.location?.hostname||'')=>hostname==='github.io'||hostname.endsWith('.github.io');
export function tackPreviewURL(piece,horse,base=new URL('../../tack-studio.html',import.meta.url)){
 const url=new URL(base);url.searchParams.set('item',piece.id);
 if(typeof horse?.breed==='string'&&horse.breed)url.searchParams.set('horse',horse.breed);
 return url.href;
}
export function install(G){
 if(!document.getElementById('tackCollectionCSS')){const link=document.createElement('link');link.id='tackCollectionCSS';link.rel='stylesheet';link.href=new URL('../tack-collection.css?v=classic-western-1',import.meta.url).href;document.head.appendChild(link);}
 const selectedTheme=new URLSearchParams(location.search).get('collection');
 const state={query:'',slot:'all',theme:TACK_COLLECTIONS.some(t=>t.id===selectedTheme)?selectedTheme:'all',owned:false,page:0,detail:null,horseId:null,message:''};
 const studioURL=new URL('../../tack-studio.html',import.meta.url);
 const canFitHorse=h=>{if(!h||h.foal||h.egg)return false;const profile=G.horse?.breedModels?.profile?.(h.breed);return !profile||profile.nativeKind==='horse'&&!profile.nativeDragon;};
 const horseOf=s=>{const adults=(s.horses||[]).filter(canFitHorse);let h=adults.find(h=>String(h.id)===String(state.horseId));if(!h){h=adults.find(h=>h===(s.horses||[])[G.ranchSys?.tackIdx?.(s)??G.horse?.rideIdx?.()??0])||adults[0];state.horseId=h?.id??null;}return h;};
 const tryOn=(p,h)=>{const u=tackPreviewURL(p,h,studioURL);return `<a class="tc-link" href="${esc(u)}" target="_blank" rel="noopener">Try on in 3D <span aria-hidden="true">↗</span></a>`;};
 const action=(p,s,h)=>{
  const item=ownedTackPiece(s,p.id),wearer=tackPieceWearer(s,p.id),equipped=item&&h?.gear?.[p.slot]===item.id&&!(p.slot==='saddle'&&h.bareback);
  if(!item&&p.premiumProduct&&isStaticTackPreview()){const url=new URL(tackPreviewURL(p,h,studioURL));url.searchParams.delete('item');url.searchParams.set('collection',p.collectionId);return `<a class="tc-primary" href="${esc(url.href)}" target="_blank" rel="noopener">Preview set in 3D ↗</a><small class="tc-shortfall">Preview only · purchases unavailable on this site</small>`;}
  if(!item&&p.premiumProduct)return `<a class="tc-primary" href="store.html?tab=tack&product=${encodeURIComponent(p.premiumProduct)}">View ${esc(p.collectionName)} set · ${dollars(p.priceCents)} USD</a><small class="tc-shortfall">All four pieces · Stripe test checkout</small>`;
  if(!item&&p.free)return `<button type="button" class="tc-primary" data-tc-buy="${p.id}">Add to locker · Free</button>`;
  if(!item)return `<button type="button" class="tc-primary" data-tc-buy="${p.id}" ${(s.coins||0)<p.priceCoins?'disabled':''}>Buy · ${p.priceCoins.toLocaleString()} coins</button>${(s.coins||0)<p.priceCoins?'<small class="tc-shortfall">'+(p.priceCoins-(s.coins||0)).toLocaleString()+' more coins needed</small>':''}`;
  return `<button type="button" class="${equipped?'tc-secondary':'tc-primary'}" data-tc-${equipped?'unequip':'equip'}="${p.id}" ${!h?'disabled':''}>${equipped?'Unequip':wearer&&String(wearer.id)!==String(h?.id)?'Move to '+esc(h?.name||'horse'):'Equip'}</button>${!h?'<small class="tc-shortfall">An adult horse is needed to equip.</small>':''}`;
 };
 const card=(p,s,h)=>{const item=ownedTackPiece(s,p.id),wearer=tackPieceWearer(s,p.id);return `<article class="tc-card" data-tc-card="${p.id}"><button type="button" class="tc-art" data-tc-detail="${p.id}" aria-label="Details: ${esc(p.name)}">${tackPieceSVG(p)}</button><div class="tc-card-body"><div class="tc-eyebrow">${esc(p.slotLabel)}${item?'<span class="tc-owned">Owned</span>':''}</div><h3><button type="button" data-tc-detail="${p.id}">${esc(p.name)}</button></h3><p class="tc-worn">${wearer?'On '+esc(wearer.name):item?'In your tack locker':p.free?'Original Western tack · Free':esc(p.design.pattern)+' stitching · '+esc(p.design.ornament)+' detail'}</p><div class="tc-card-actions">${action(p,s,h)}${tryOn(p,h)}</div></div></article>`;};
 function renderBody(s){
  s=s||{horses:[],tack:[],coins:0};const h=horseOf(s),adult=(s.horses||[]).filter(canFitHorse),ownedCount=TACK_PIECES.filter(p=>ownedTackPiece(s,p.id)).length;
  let out=`<div class="tc-intro"><div><p class="tc-kicker">${TACK_PIECES.length} PIECES · ${TACK_COLLECTIONS.length} ORIGINAL COLLECTIONS</p><p>100 pieces for earned coins, a free Western set, and six matching ${isStaticTackPreview()?'preview sets.':'sets in the Ranch Store.'}</p>${G.tackSummon?'<button type="button" class="tc-link" data-tc-summon>Visit Summoning Stall →</button>':''}</div><div class="tc-wallet"><strong>${Math.floor(s.coins||0).toLocaleString()}</strong><span>coins available</span><small>${ownedCount} / ${TACK_PIECES.length} collected</small></div></div><div class="tc-target"><label>Dress your horse <select data-tc-filter="horseId" aria-label="Horse to equip">${adult.length?adult.map(x=>`<option value="${esc(x.id)}" ${x===h?'selected':''}>${esc(x.name||'Horse')}</option>`).join(''):'<option value="">No adult horses</option>'}</select></label><p>Fitted for adult horses. Mix collections freely; each owned piece fits one horse at a time.</p></div><p class="tc-status" role="status" aria-live="polite">${esc(state.message)}</p>`;
  const classic=TACK_PIECES.filter(p=>p.collectionId==='classicwestern'),classicWorn=classic.filter(p=>{const item=ownedTackPiece(s,p.id);return item&&h?.gear?.[p.slot]===item.id&&!(p.slot==='saddle'&&h.bareback);}).length;
  out+=`<section class="tc-free-set" aria-label="Free Classic Western set"><div><strong>Classic Western <span>Free</span></strong><p>The original saddle, pad & bridle. Keeps your legwear.</p></div><div class="tc-free-actions"><button type="button" class="tc-primary" data-tc-equip-set="classicwestern" ${!h||classicWorn===3?'disabled':''}>${classicWorn===3?'Set equipped':'Equip free set'}</button>${classicWorn?'<button type="button" class="tc-secondary" data-tc-remove-set="classicwestern">Remove set</button>':''}<button type="button" class="tc-link" data-tc-theme="classicwestern">View 3 pieces →</button></div></section>`;
  if(state.detail){const p=getTackPiece(state.detail);if(!p){state.detail=null;return renderBody(s);}const wearer=tackPieceWearer(s,p.id);
   return out+`<div class="tc-detail"><button type="button" class="tc-back" data-tc-back>← Back to collection</button><figure>${tackPieceSVG(p)}</figure><div class="tc-detail-copy"><p class="tc-kicker">${esc(p.collectionName)} · ${esc(p.slotLabel)}</p><h2 tabindex="-1" data-tc-heading>${esc(p.name)}</h2><p>${esc(p.description)}</p>${p.design.nativeOriginal?'<dl><div><dt>Style</dt><dd>Original Western</dd></div><div><dt>Material</dt><dd>'+(p.slot==='pad'?'Cloth':'Brown leather')+'</dd></div><div><dt>Fit</dt><dd>Original fitted model</dd></div><div><dt>'+(p.slot==='bridle'?'Includes':'Collection')+'</dt><dd>'+(p.slot==='bridle'?'Reins':'Classic Western')+'</dd></div></dl>':`<dl><div><dt>Cut</dt><dd>${esc(p.design.profile)}</dd></div><div><dt>Stitching</dt><dd>${esc(p.design.pattern)}</dd></div><div><dt>Finish</dt><dd>${esc(p.design.trim)} trim</dd></div><div><dt>Detail</dt><dd>${esc(p.design.ornament)}</dd></div></dl>`}<div class="tc-swatches" aria-label="Design colors">${['leather','cloth','metal','accent'].map(k=>`<span title="${k}" style="--tc-swatch:${p.design[k]}"></span>`).join('')}<span class="tc-stat">${p.free?'Original cosmetic tack':'+1 '+statNames[p.primary]+' · '+(p.premiumProduct?'cosmetic collection':'upgrade in Tack')}</span></div><p class="tc-worn">${wearer?'Worn by '+esc(wearer.name):ownedTackPiece(s,p.id)?'Owned · ready in your tack locker':p.premiumProduct?(isStaticTackPreview()?'Preview set · draft price ':'Part of the ')+dollars(p.priceCents)+' USD '+esc(p.collectionName)+' set':p.free?'Free · add to your tack locker':p.priceCoins.toLocaleString()+' earned coins'}</p><div class="tc-detail-actions">${action(p,s,h)}${tryOn(p,h)}</div><button type="button" class="tc-link" data-tc-theme="${p.theme}">See all ${p.free?'three':'four'} ${esc(p.collectionName)} pieces →</button></div></div>`;
  }
  const filtered=filterTackPieces(s,state),pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));state.page=Math.max(0,Math.min(state.page,pages-1));const start=state.page*PAGE_SIZE;
  out+=`<div class="tc-filters"><label class="tc-search">Search pieces<input type="search" placeholder="Name, collection, or detail…" data-tc-filter="query" value="${esc(state.query)}" autocomplete="off"></label><label>Category<select data-tc-filter="slot"><option value="all">All categories</option>${TACK_SLOTS.map(slot=>`<option value="${slot}" ${state.slot===slot?'selected':''}>${TACK_SLOT_LABELS[slot]}</option>`).join('')}</select></label><label>Collection<select data-tc-filter="theme"><option value="all">All ${TACK_COLLECTIONS.length} collections</option>${TACK_COLLECTIONS.map(t=>`<option value="${t.id}" ${state.theme===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label><label class="tc-owned-filter"><input type="checkbox" data-tc-filter="owned" ${state.owned?'checked':''}>Owned only</label></div><div class="tc-results"><span>${filtered.length?`${start+1}–${Math.min(start+PAGE_SIZE,filtered.length)} of ${filtered.length} pieces`:'No matching pieces'}</span>${state.query||state.slot!=='all'||state.theme!=='all'||state.owned?'<button type="button" class="tc-link" data-tc-clear>Clear filters</button>':''}</div><div class="tc-grid">${filtered.slice(start,start+PAGE_SIZE).map(p=>card(p,s,h)).join('')||'<div class="tc-empty"><h3>Room for a new favorite</h3><p>'+ (state.owned?'Your owned pieces will appear here.':'Try another name, category, or collection.')+'</p></div>'}</div>`;
  if(pages>1)out+=`<nav class="tc-pagination" aria-label="Tack collection pages"><button type="button" data-tc-page="${state.page-1}" ${!state.page?'disabled':''}>← Previous</button><span>Page ${state.page+1} of ${pages}</span><button type="button" data-tc-page="${state.page+1}" ${state.page===pages-1?'disabled':''}>Next →</button></nav>`;
  return out;
 }
 function transact(kind,catalogId,horseId=state.horseId){
  let result;G.save.sync(s=>{const selected=(s.horses||[]).find(h=>String(h.id)===String(horseId));if(kind==='equip'&&selected&&!canFitHorse(selected)){result={ok:false,code:selected.foal||selected.egg?'horse-too-young':'unsupported-horse'};return;}result=kind==='buy'?buyTackPiece(s,catalogId):({equip:equipTackPiece,unequip:unequipTackPiece})[kind](s,catalogId,horseId);});
  if(!result)result={ok:false,code:'save-unavailable'};
  if(result.ok&&result.changed){const saved=G.save.fresh(),item=ownedTackPiece(saved,catalogId),horse=(saved?.horses||[]).find(h=>String(h.id)===String(horseId));if(!item||(kind==='equip'&&horse?.gear?.[item.slot]!==item.id)||(kind==='unequip'&&horse?.gear?.[item.slot]===item.id))result={ok:false,code:'save-unavailable'};}
  const errors={'unsupported-horse':'These collection pieces are fitted for horses. Choose an adult horse.','paid-purchase-required':'Get this set from the Ranch Store to unlock all four matching pieces.','insufficient-coins':'Earn a few more coins to buy this piece.','not-owned':'Buy this piece before equipping it.','horse-too-young':'Choose an adult horse for tack.','no-horse':'Choose a horse first.','unknown-item':'This piece could not be found.','save-unavailable':'Your change could not be saved. Please try again.'};
  state.message=result.ok?((result.code==='bought'||result.code==='claimed')?result.item.name+' is yours. Choose Equip to put it on your horse.':result.code==='equipped'?result.item.name+' equipped on '+(result.horse.name||'your horse')+'.':result.code==='unequipped'?'Returned to your tack locker.':result.code==='already-owned'?'You already own this piece.':'Your tack is up to date.'):errors[result.code]||'Your tack could not be updated.';
  if(result.ok&&result.changed){G.horse?.refreshTack?.();G.money?.refreshWallet?.();if(kind!=='buy'){G.horse?.attachTack?.();G.horse?.dressSaddle?.();G.tackCollectionModels?.refresh?.();}G.sChime?.();}
  G.toast?.(state.message);return result;
 }
 function transactSet(kind,collectionId,horseId=state.horseId){
  let result;G.save.sync(s=>{
   const horse=(s.horses||[]).find(h=>String(h.id)===String(horseId));
   if(kind==='equip'&&horse&&!canFitHorse(horse)){result={ok:false,code:horse.foal||horse.egg?'horse-too-young':'unsupported-horse'};return;}
   result=(kind==='equip'?equipTackCollection:unequipTackCollection)(s,collectionId,horseId);
  });
  if(!result)result={ok:false,code:'save-unavailable'};
  if(result.ok&&result.changed){
   const saved=G.save.fresh(),horse=(saved?.horses||[]).find(h=>String(h.id)===String(horseId)),pieces=TACK_PIECES.filter(p=>p.collectionId===collectionId);
   const applied=horse&&pieces.every(p=>{const item=ownedTackPiece(saved,p.id),worn=item&&horse.gear?.[p.slot]===item.id;return kind==='equip'?worn&&!(p.slot==='saddle'&&horse.bareback):!worn;});
   if(!applied)result={ok:false,code:'save-unavailable'};
  }
  state.message=result.ok?result.collection.name+(kind==='equip'?' equipped on '+(result.horse.name||'your horse')+'.':' returned to your tack locker.'):
   result.code==='save-unavailable'?'Your change could not be saved. Please try again.':result.code==='not-owned'?'Own every piece before equipping this set.':'Choose an adult horse for this tack set.';
  if(result.ok&&result.changed){G.horse?.refreshTack?.();G.horse?.attachTack?.();G.horse?.dressSaddle?.();G.tackCollectionModels?.refresh?.();G.sChime?.();}
  G.toast?.(state.message);return result;
 }
 function bind(panel){
  const root=panel.querySelector('.tc-root');if(!root)return;
  function paint({focusHeading=false,focusItem=null,scroll=false}={}){const active=document.activeElement,filter=active?.dataset?.tcFilter,selection=filter==='query'?[active.selectionStart,active.selectionEnd]:null;root.innerHTML=renderBody(G.save.fresh());if(filter){const field=root.querySelector(`[data-tc-filter="${filter}"]`);field?.focus({preventScroll:true});if(selection)field?.setSelectionRange(...selection);}if(focusHeading)root.querySelector('[data-tc-heading]')?.focus({preventScroll:true});if(focusItem)root.querySelector(`[data-tc-buy="${focusItem}"],[data-tc-equip="${focusItem}"],[data-tc-unequip="${focusItem}"]`)?.focus({preventScroll:true});if(scroll)root.querySelector('.tc-results,.tc-detail')?.scrollIntoView({block:'start'});}
  root.addEventListener('input',e=>{const key=e.target.dataset.tcFilter;if(key!=='query')return;state.query=e.target.value;state.page=0;paint();});
  root.addEventListener('change',e=>{const key=e.target.dataset.tcFilter;if(!key||key==='query')return;state[key]=key==='owned'?e.target.checked:e.target.value;state.page=0;paint();});
  root.addEventListener('click',e=>{const el=e.target.closest('button');if(!el||!root.contains(el))return;const d=el.dataset;if('tcSummon'in d){G.ui.dispatch('tackstall:visit');return;}if(d.tcEquipSet||d.tcRemoveSet){transactSet(d.tcEquipSet?'equip':'remove',d.tcEquipSet||d.tcRemoveSet);paint();}else if(d.tcDetail){state.detail=d.tcDetail;paint({focusHeading:true,scroll:true});}else if('tcBack'in d){state.detail=null;paint({scroll:true});}else if(d.tcTheme){state.detail=null;state.theme=d.tcTheme;state.slot='all';state.owned=false;state.query='';state.page=0;paint({scroll:true});}else if('tcClear'in d){Object.assign(state,{query:'',slot:'all',theme:'all',owned:false,page:0});paint();}else if('tcPage'in d){state.page=Number(d.tcPage);paint({scroll:true});}else{for(const kind of ['buy','equip','unequip']){const key='tc'+kind[0].toUpperCase()+kind.slice(1);if(d[key]){transact(kind,d[key]);paint({focusItem:d[key]});break;}}}});
 }
 G.ui.shopTab({id:'tackcollection',label:'Tack boutique',render:s=>`<section class="tc-root" aria-label="Tack boutique">${renderBody(s)}</section>`,bind});
 G.tackCollection={equipSet:(collectionId,horseId)=>transactSet('equip',collectionId,horseId),removeSet:(collectionId,horseId)=>transactSet('remove',collectionId,horseId),open:()=>G.ui.openShop('tackcollection'),catalog:TACK_PIECES,buy:catalogId=>transact('buy',catalogId),equip:(catalogId,horseId)=>transact('equip',catalogId,horseId),unequip:(catalogId,horseId)=>transact('unequip',catalogId,horseId)};
 // First-time rider creation opens after boot. Keep this route pending until
 // that save succeeds, so the creator cannot replace the requested collection.
 let pendingBoutique=new URLSearchParams(location.search).get('shop')==='tackcollection';
 const openPendingBoutique=()=>{
  if(!pendingBoutique||!G.save.fresh()?.rider?.made)return;
  pendingBoutique=false;G.ui.openShop('tackcollection');
 };
 G.on('boot',openPendingBoutique);
 G.on('riderCreated',openPendingBoutique);
}
