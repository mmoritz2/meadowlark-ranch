import {refreshAccount, currentAccount, paidVipUntil, isStaticStore} from '../commerce-client.js';
export const id='commerce';
export function install(G){
  G.commerce={paidVipUntil,currentAccount,isStaticStore,storeLabel:'Ranch store'};
  const storeURL=new URL('../../store.html',import.meta.url).href;
  G.ui.action('store',()=>{location.assign(storeURL);});
  G.ui.shopTab({id:'purchases',label:'Ranch store',render(){
    if(isStaticStore)return '<div class="passCard"><h3>Ranch store</h3><p>Browse tack pictures and matching sets, gem packs and VIP plans.</p><p>Online preview — checkout and accounts are not available on this site. Prices and benefits may change before launch.</p><button data-fx="store" class="claimBtn">Browse the store</button></div>';
    const a=currentAccount();
    return '<div class="passCard"><h3>Ranch Store</h3><p>Tack collections, gem packs, VIP passes and cloud backups.</p>'
      +'<p>'+(a ? a.wallet.gems+' purchased gems in your account.' : 'Sign in to keep your purchases with your account.')+'</p>'
      +'<p style="font-size:12px">Test store — no real payments. Purchased gems buy VIP passes; earned gems remain in the game’s existing shops.</p>'
      +'<button data-fx="store" class="claimBtn">Browse the store</button></div>';
  }});
  if(isStaticStore){
    G.ui.onlineSection(()=>'<div class="crow"><span class="lbl">Ranch store · preview</span><button data-fx="store">Browse tack, gems & VIP</button></div>');
    return;
  }
  G.ui.onlineSection(()=>'<div class="crow"><span class="lbl">Ranch account</span><button data-fx="store">Store, account & VIP</button></div>');
  const refresh=async()=>{const account=await refreshAccount();G.run('commerceAccount',account);G.money.refreshWallet();};
  G.commerce.refresh=refresh;
  refresh();
  setInterval(refresh,60000);
  window.addEventListener('focus',refresh);
}
