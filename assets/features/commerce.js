import {refreshAccount, currentAccount, paidVipUntil, isStaticStore} from '../commerce-client.js';
export const id='commerce';
export function install(G){
  G.commerce={paidVipUntil,currentAccount,isStaticStore,storeLabel:isStaticStore?'Store preview':'Account & VIP'};
  const storeURL=new URL('../../store.html',import.meta.url).href;
  G.ui.action('store',()=>{location.assign(storeURL);});
  G.ui.shopTab({id:'purchases',label:isStaticStore?'Store preview':'Gems & VIP',render(){
    if(isStaticStore)return '<div class="passCard"><h3>Store preview</h3><p>Explore draft gem packs and VIP passes.</p><p>Purchases are coming soon. Prices and benefits may change before launch.</p><button data-fx="store" class="claimBtn">Browse gems & VIP</button></div>';
    const a=currentAccount();
    return '<div class="passCard"><h3>Ranch Store</h3><p>Account gem packs, VIP passes and cloud backups.</p>'
      +'<p>'+(a ? a.wallet.gems+' purchased gems in your account.' : 'Sign in to keep your purchases with your account.')+'</p>'
      +'<p style="font-size:12px">Test store — no real payments. Purchased gems buy VIP passes; earned gems remain in the game’s existing shops.</p>'
      +'<button data-fx="store" class="claimBtn">Open Gems & VIP</button></div>';
  }});
  if(isStaticStore){
    G.ui.onlineSection(()=>'<div class="crow"><span class="lbl">Store preview</span><button data-fx="store">Browse gems & VIP</button></div>');
    return;
  }
  G.ui.onlineSection(()=>'<div class="crow"><span class="lbl">Ranch account</span><button data-fx="store">Account, VIP & cloud saves</button></div>');
  const refresh=async()=>{await refreshAccount();G.money.refreshWallet();};
  refresh();
  setInterval(refresh,60000);
  window.addEventListener('focus',refresh);
}
