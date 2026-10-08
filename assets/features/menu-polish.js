import {installMenuDialogFocus} from '../menu-dialog-focus.js?v=menus-polish-20261008';
export const id='menu-polish';
export function install(G){
 for(const [id,file] of [['menuSystemCSS','menu-system.css'],['menuDestinationsCSS','menu-destinations.css']]){
  if(document.getElementById(id))continue;
  const link=document.createElement('link');link.id=id;link.rel='stylesheet';
  link.href=new URL('../'+file+'?v=menus-polish-20261008',import.meta.url).href;
  document.head.appendChild(link);
 }
 // External styles define which custom screen is visible. Claim focus only after
 // those sheets finish, so a closed screen is never mistaken for an open dialog.
 const links=[...document.querySelectorAll('#seFrameCss,#seCareCss,#seCharCss,#menuSystemCSS,#menuDestinationsCSS')];
 Promise.all(links.map(link=>link.sheet?Promise.resolve():new Promise(resolve=>{link.addEventListener('load',resolve,{once:true});link.addEventListener('error',resolve,{once:true});}))).then(()=>installMenuDialogFocus(G));
}
