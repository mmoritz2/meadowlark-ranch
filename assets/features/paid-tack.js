import {TACK_PIECES,getTackPiece} from '../tack-collection.mjs?v=native-tack-optional-20261007';
import {setPaidTackVerifier} from '../paid-tack-access.mjs';
export const id='paid-tack';
const VERIFY_MS=120000;
const token=v=>typeof v==='string'&&v.length>0&&v.length<=200?v:null;
const orderId=v=>token(Number.isSafeInteger(v)?String(v):v);
const bundles=new Map();
for(const p of TACK_PIECES){
 if(!p.premiumProduct)continue;
 if(!bundles.has(p.premiumProduct))bundles.set(p.premiumProduct,{collectionId:p.collectionId,pieces:[]});
 bundles.get(p.premiumProduct).pieces.push(p);
}
// A malformed catalog group fails closed; every paid product is one full set.
for(const [product,bundle] of bundles)if(bundle.pieces.length!==4||new Set(bundle.pieces.map(p=>p.slot)).size!==4||bundle.pieces.some(p=>p.collectionId!==bundle.collectionId))bundles.delete(product);
export function install(G){
 let accountId=null,rights=new Map(),verifiedUntil=0,verifiedAccount=null,timer=null,reconciling=false,lastCheck=0;
 const active=()=>!!accountId&&Date.now()<verifiedUntil&&(!G.commerce?.currentAccount||G.commerce.currentAccount()===verifiedAccount);
 const isPaid=item=>!!(getTackPiece(item?.catalogId)?.premiumProduct||item?.paidProduct||item?.paidEntitlementId||item?.paidAccountId);
 function authorized(item){const def=getTackPiece(item?.catalogId),right=active()&&rights.get(orderId(item?.paidEntitlementId));return !!(right&&token(item?.id)&&def?.premiumProduct===right.product&&item.paidAccountId===accountId&&item.paidProduct===right.product&&item.slot===def.slot&&right.pieceIds.includes(def.id));}
 setPaidTackVerifier(authorized);
 const canonical=(p,key,inventoryId)=>({id:inventoryId,catalogId:p.id,collectionId:p.collectionId,slot:p.slot,name:p.name,rarity:p.rarity,bonus:{...p.bonus},primary:p.primary,secondary:null,lvl:1,merged:0,set:null,style:p.style,paidAccountId:accountId,paidEntitlementId:key,paidProduct:p.premiumProduct});
 function archive(s,item){
  if(!token(item.paidAccountId)||!orderId(item.paidEntitlementId)||!getTackPiece(item.catalogId)?.premiumProduct)return;
  const key=[item.paidAccountId,String(item.paidEntitlementId),item.catalogId].join('|'),list=Array.isArray(s.paidTackArchive)?s.paidTackArchive:[];
  const old=list.find(a=>a?.key===key),live=s.horses||[],archived=(Array.isArray(s.paidHorseArchive)?s.paidHorseArchive:[]).filter(a=>a?.accountId===item.paidAccountId&&a.horse&&!live.some(h=>h.id===a.horse.id)).map(a=>a.horse);
  const horses=[...live,...archived],wearers=horses.filter(h=>h.gear?.[item.slot]===item.id).map(h=>h.id);
  // An existing horse's empty slot is an intentional removal. Only remember
  // absent horses whose current equipment cannot be inspected yet.
  const absentWearers=(Array.isArray(old?.wearers)?old.wearers:[]).filter(id=>!horses.some(h=>h.id===id));
  const entry={key,accountId:item.paidAccountId,entitlementId:String(item.paidEntitlementId),catalogId:item.catalogId,inventoryId:item.id,wearers:wearers.length?wearers:absentWearers};
  s.paidTackArchive=[...list.filter(a=>a?.key!==key),entry];
 }
 function repair(s){
  if(!s||!Array.isArray(s.tack))return;
  const seen=new Set(),kept=[],removed=new Set();
  for(const item of s.tack){
   if(!isPaid(item)){kept.push(item);continue;}
   const key=item.catalogId;
   if(authorized(item)&&!seen.has(key)){seen.add(key);kept.push(canonical(getTackPiece(key),String(item.paidEntitlementId),item.id));}
   else {archive(s,item);removed.add(item.id);}
  }
  // Duplicate IDs must not unequip the one authorized inventory row we retained.
  for(const item of kept)removed.delete(item.id);
  for(const h of s.horses||[])for(const [slot,key] of Object.entries(h.gear||{}))if(removed.has(key))delete h.gear[slot];
  s.tack=kept;
  if(!active())return;
  for(const right of rights.values())for(const p of right.pieces){
   if(seen.has(p.id))continue;
   const old=(Array.isArray(s.paidTackArchive)?s.paidTackArchive:[]).find(a=>a?.accountId===accountId&&a.entitlementId===right.id&&a.catalogId===p.id);
   const taken=new Set(s.tack.map(t=>t.id)),base=token(old?.inventoryId)||'paid_'+right.id+'_'+p.id;
   let key=base,n=2;while(taken.has(key))key=base+'_'+n++;
   const item=canonical(p,right.id,key);s.tack.push(item);seen.add(p.id);
   const h=(s.horses||[]).find(h=>(Array.isArray(old?.wearers)?old.wearers:[]).includes(h.id)&&!h.foal&&!h.egg&&!h.gear?.[p.slot]);
   if(h){h.gear=h.gear||{};h.gear[p.slot]=key;if(p.slot==='saddle')h.bareback=false;}
  }
 }
 function reconcile(){if(reconciling)return;reconciling=true;try{G.save.sync(repair);G.horse?.refreshTack?.();G.tackCollectionModels?.refresh?.();}finally{reconciling=false;}}
 function receive(account){
  clearTimeout(timer);timer=null;accountId=token(account?.user?.id);rights=new Map();verifiedUntil=0;verifiedAccount=account||null;
  if(accountId&&!account.wallet?.held&&Array.isArray(account.tack)){
   for(const purchase of account.tack){
    const key=orderId(purchase?.id),snapshot=purchase?.tack,bundle=bundles.get(purchase?.product);
    if(!key||!bundle||snapshot?.collectionId!==bundle.collectionId||!Array.isArray(snapshot.pieceIds)||snapshot.pieceIds.length!==4||!bundle.pieces.every(p=>snapshot.pieceIds.includes(p.id)))continue;
    rights.set(key,{id:key,product:purchase.product,pieceIds:[...snapshot.pieceIds],pieces:bundle.pieces});
   }
   verifiedUntil=Date.now()+VERIFY_MS;timer=setTimeout(()=>receive(null),VERIFY_MS+1);
  }else accountId=null;
  reconcile();
 }
 function check(){
  if(accountId&&!active()){receive(null);return;}
  if(!active()||!rights.size)return;
  const s=G.save.fresh();if(!s)return;
  const present=new Set((s.tack||[]).filter(authorized).map(t=>t.catalogId));
  if([...rights.values()].some(right=>right.pieceIds.some(id=>!present.has(id))))reconcile();
 }
 G.save.ensure(repair);G.on('commerceAccount',receive);G.on('boot',reconcile);G.on('interval30',check);
 G.on('tick',()=>{if(Date.now()-lastCheck>=1000){lastCheck=Date.now();check();}});window.addEventListener('focus',check);
 G.paidTack={isPaid,authorized,sync:reconcile};reconcile();
}
