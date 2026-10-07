// Public catalog and browsing only. Account-backed checkout is supplied by store.js.
import {TACK_COLLECTIONS,TACK_PIECES,TACK_SLOTS,TACK_SLOT_LABELS,getTackPiece} from './tack-collection.mjs';
import {PREMIUM_TACK_SETS} from './premium-tack.mjs';
import {tackPieceSVG} from './tack-collection-art.mjs?v=classic-western-1';
export const publicTackProducts=()=>PREMIUM_TACK_SETS.map(set=>({id:set.productId,name:set.name,cents:set.cents,description:set.description,tagline:set.tagline,vibe:set.vibe,gems:0,days:0,tack:{collectionId:set.id,pieceIds:TACK_PIECES.filter(p=>p.collectionId===set.id).map(p=>p.id)}}));
export function filterStoreTack({query='',slot='all',collection='all',kind='all'}={}){
 const q=query.trim().toLowerCase();return TACK_PIECES.filter(p=>(slot==='all'||p.slot===slot)&&(collection==='all'||p.collectionId===collection)&&(kind==='all'||(kind==='free'?p.free:kind==='coins'?!p.free&&!p.premiumProduct:!!p.premiumProduct))&&(!q||(p.name+' '+p.description+' '+p.slotLabel).toLowerCase().includes(q)));
}
export function tackStoreLinks({item,collection,horse}={},base=import.meta.url){
 const studio=new URL('../tack-studio.html',base),boutique=new URL('../ranch3d.html',base);boutique.searchParams.set('shop','tackcollection');
 if(item)studio.searchParams.set('item',item);else if(collection)studio.searchParams.set('collection',collection);
 if(collection)boutique.searchParams.set('collection',collection);if(horse)studio.searchParams.set('horse',horse);
 return {studio:studio.href,boutique:boutique.href};
}
const photoHorse={rainbow:'bay-sporthorse-native',starlight:'black',dragonfire:'bay-western',blossom:'grey',glacier:'white-western',forestguardian:'pinto'};
const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
export function createTackStore({document,isStatic,getCatalog,getAccount,isWorking,buyProduct,selectTab,params=new URLSearchParams()}={}){
 const $=id=>document.getElementById(id),state={query:'',slot:'all',collection:TACK_COLLECTIONS.some(c=>c.id===params.get('collection'))?params.get('collection'):'all',kind:'all',page:0,product:null};
 const publicProducts=publicTackProducts();state.product=publicProducts.some(p=>p.id===params.get('product'))?params.get('product'):null;
 const products=()=>publicProducts.map(p=>({...p,...getCatalog()?.premiumTack?.products?.find(server=>server.id===p.id)}));
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
 const link=(label,href,cls='catalog-link')=>{const a=node('a',label,cls);a.href=href;return a;};
 const preview=(label,links)=>{const a=link(label,links.studio);a.target='_blank';a.rel='noopener';return a;};
 const art=(id,cls='catalog-art')=>{const el=node('div',undefined,cls),piece=getTackPiece(id);if(piece)el.innerHTML=tackPieceSVG(piece);return el;};
 function lookPicture(p,eager=false){
  const box=node('div',undefined,'set-picture'),fallback=node('div',undefined,'set-picture-fallback');
  fallback.append(art(p.tack.pieceIds.find(id=>id.endsWith('_saddle')),'set-saddle'),art(p.tack.pieceIds.find(id=>id.endsWith('_bridle')),'set-bridle'));
  box.append(fallback);return box;
 }
 function openLook(id,focus=true){state.product=id;selectTab('tack',focus);renderDetail();if(focus){$('store-look-title')?.focus({preventScroll:true});$('tack-look-detail').scrollIntoView({block:'start',behavior:'instant'});}}
 function setCard(p){
  const card=node('article',undefined,'store-set-card'),view=node('button',undefined,'set-picture-button');view.type='button';view.setAttribute('aria-label','Explore '+p.name);view.append(lookPicture(p));view.addEventListener('click',()=>openLook(p.id));
  const copy=node('div',undefined,'set-copy');copy.append(node('span',p.vibe||'Coordinated collection','eyebrow'),node('h3',p.name),node('p',p.tagline||p.description,'set-tagline'));
  const price=node('p',undefined,'set-price');price.append(node('b',money(p.cents)+' USD'),node('span','4 pieces · '+(isStatic?'draft set price':'test set price')));copy.append(price);
  const actions=node('div',undefined,'set-actions'),details=node('button','Explore set','secondary');details.type='button';details.addEventListener('click',()=>openLook(p.id));actions.append(details,preview('Try in 3D ↗',tackStoreLinks({collection:p.tack.collectionId,horse:photoHorse[p.tack.collectionId]})));copy.append(actions);card.append(view,copy);return card;
 }
 function renderDiscover(){
  const p=products().find(p=>p.id==='tack_starlight')||products()[0],hero=node('article',undefined,'store-feature'),copy=node('div',undefined,'store-feature-copy');
  copy.append(node('span','THE SADDLERY COLLECTION','eyebrow'),node('h2','Find your kind of ride.'),node('p','127 pieces. A free Western classic, colorful everyday tack, and six coordinated statement sets.','feature-intro'));
  const actions=node('div',undefined,'feature-actions'),browse=node('button','Browse all tack');browse.type='button';browse.addEventListener('click',()=>{state.product=null;selectTab('tack',true);renderDetail();});actions.append(browse,preview('Visit the fitting room ↗',tackStoreLinks()));copy.append(actions);
  const picture=lookPicture(p,true);picture.append(node('span','STARLIGHT ROYAL · TACK PREVIEW','set-photo-caption'));hero.append(copy,picture);$('discover-feature').replaceChildren(hero);
  $('store-sets').replaceChildren(...products().map(setCard));
  const classic=node('article',undefined,'classic-promo'),original=art('tc_classicwestern_saddle');const text=node('div');text.append(node('span','ALWAYS FREE','eyebrow'),node('h3','Classic Western'),node('p','The original saddle, pad and bridle. Three optional cosmetic pieces; choose them in your tack locker whenever you like.'));
  const controls=node('div',undefined,'set-actions');controls.append(link('Equip the free set ↗',tackStoreLinks({collection:'classicwestern'}).boutique,'store-link-button'),preview('Try all three ↗',tackStoreLinks({collection:'classicwestern'})));text.append(controls);classic.append(original,text);$('discover-classic').replaceChildren(classic);
 }
 function renderDetail(){
  const p=products().find(p=>p.id===state.product),container=$('tack-look-detail');container.hidden=!p;if(!p){container.replaceChildren();return;}
  const back=node('button','← Back to all tack','text-button');back.type='button';back.addEventListener('click',()=>{state.product=null;renderDetail();$('tack-search').focus();});
  const article=node('article',undefined,'store-look-detail'),visual=node('div',undefined,'look-detail-visual');visual.append(lookPicture(p,true));
  const pieces=node('div',undefined,'included-pictures');for(const id of p.tack.pieceIds){const def=getTackPiece(id),figure=node('figure');figure.append(art(id),node('figcaption',def.slotLabel));pieces.append(figure);}visual.append(pieces);
  const copy=node('div',undefined,'look-detail-copy'),title=node('h2',p.name);title.id='store-look-title';title.tabIndex=-1;
  copy.append(node('span','FOUR PIECES · ONE COMPLETE LOOK','eyebrow'),title,node('p',p.description),node('p','Includes saddle, saddle pad, bridle and legwear. Horses are free to preview and are not included with tack.','included-note'));
  const price=node('p',undefined,'set-price');price.append(node('b',money(p.cents)+' USD'),node('span',isStatic?'Draft price · purchases coming soon':'Test price for the complete set'));copy.append(price);
  const checkout=node('div');checkout.dataset.tackAction=p.id;copy.append(checkout);
  const links=tackStoreLinks({collection:p.tack.collectionId,horse:photoHorse[p.tack.collectionId]});copy.append(preview('Try this set on any horse ↗',links),link('View these pieces in the boutique ↗',links.boutique));
  article.append(visual,copy);container.replaceChildren(back,article);updateActions();
 }
 function updateActions(){
  for(const target of document.querySelectorAll('[data-tack-action]')){
   const id=target.dataset.tackAction,p=products().find(p=>p.id===id),account=getAccount(),owned=account?.tack?.some(t=>t.product===id),offered=getCatalog()?.premiumTack?.products?.some(t=>t.id===id);
   if(owned){target.replaceChildren(node('p',account.wallet?.held?'Owned · account access is paused.':'Owned · ready for your tack locker.','set-availability'),...(account.wallet?.held?[]:[link('Choose a horse & equip ↗',tackStoreLinks({collection:p.tack.collectionId}).boutique,'store-link-button')]));continue;}
   if(isStatic||!offered||!getCatalog()?.checkoutEnabled){target.replaceChildren(node('p','Purchases coming soon. Enjoy a free 3D preview today.','set-availability'));continue;}
   const buy=node('button',account?money(p.cents)+' · Test checkout':'Sign in to buy');buy.type='button';buy.dataset.tackCheckout=id;buy.disabled=!!isWorking()||!!account?.wallet?.held;buy.addEventListener('click',()=>buyProduct(id));target.replaceChildren(buy);
  }
 }
 function itemCard(p){
  const card=node('article',undefined,'store-item');card.dataset.tackPiece=p.id;
  const imageLink=preview('',tackStoreLinks({item:p.id,collection:p.collectionId}));imageLink.className='item-picture-link';imageLink.setAttribute('aria-label','Preview '+p.name+' on a horse');imageLink.append(art(p.id));
  const copy=node('div',undefined,'item-copy');copy.append(node('span',p.slotLabel,'eyebrow'),node('h3',p.name),node('p',p.free?'Free cosmetic original':p.premiumProduct?money(p.priceCents)+' USD · part of a 4-piece set':p.priceCoins.toLocaleString()+' earned coins','item-price'));
  const links=tackStoreLinks({item:p.id,collection:p.collectionId});
  if(p.premiumProduct){const details=node('button','View complete set','text-button');details.type='button';details.addEventListener('click',()=>openLook(p.premiumProduct));copy.append(details);}else copy.append(link(p.free?'Equip in the boutique ↗':'Get with ranch coins ↗',links.boutique));
  copy.append(preview('Preview on a horse ↗',links));card.append(imageLink,copy);return card;
 }
 function renderItems(){
  const pieces=filterStoreTack(state),pages=Math.max(1,Math.ceil(pieces.length/12));state.page=Math.min(state.page,pages-1);const start=state.page*12;
  $('tack-result-count').textContent=pieces.length?(start+1)+'–'+Math.min(start+12,pieces.length)+' of '+pieces.length+' pieces':'No matching pieces';
  $('tack-item-grid').replaceChildren(...pieces.slice(start,start+12).map(itemCard));
  $('tack-empty').hidden=pieces.length>0;$('tack-page').textContent='Page '+(state.page+1)+' of '+pages;$('tack-previous').disabled=state.page===0;$('tack-next').disabled=state.page===pages-1;$('tack-pagination').hidden=pieces.length<=12;
 }
 $('tack-slot').append(...TACK_SLOTS.map(slot=>{const o=node('option',TACK_SLOT_LABELS[slot]);o.value=slot;return o;}));
 $('tack-collection-filter').append(...TACK_COLLECTIONS.map(c=>{const o=node('option',c.name);o.value=c.id;return o;}));$('tack-collection-filter').value=state.collection;
 for(const [id,key] of [['tack-search','query'],['tack-slot','slot'],['tack-collection-filter','collection'],['tack-kind','kind']])$(id).addEventListener(key==='query'?'input':'change',()=>{state[key]=$(id).value;state.page=0;renderItems();});
 const reset=()=>{Object.assign(state,{query:'',slot:'all',collection:'all',kind:'all',page:0});$('tack-search').value='';for(const id of ['tack-slot','tack-collection-filter','tack-kind'])$(id).value='all';renderItems();};
 $('tack-clear-filters').onclick=reset;$('tack-reset-empty').onclick=reset;
 for(const [id,step] of [['tack-previous',-1],['tack-next',1]])$(id).onclick=()=>{state.page+=step;renderItems();$('tack-result-count').focus({preventScroll:true});$('tack-result-count').scrollIntoView({block:'start'});};
 let catalogKey='';
 function render(){const key=JSON.stringify(getCatalog()?.premiumTack?.products||[]);if(key!==catalogKey){catalogKey=key;renderDiscover();renderDetail();}updateActions();}
 renderDiscover();renderItems();renderDetail();catalogKey=JSON.stringify(getCatalog()?.premiumTack?.products||[]);
 return {render,openLook,renderItems,state};
}
