import {NATIVE_BREED_PROFILES} from '../native-breed-profiles.js?v=native-roster-1';

export const id='native-horses';
export const NATIVE_MODEL_CHOICES=Object.freeze({
 'bay-sporthorse-native':{body:'#805638',mane:'#241b18',description:'Bay Sporthorse with Western tack. Standing pose, walk, trot, both canter leads, collected gallop and jump.'},
 'white-western':{body:'#f0eee5',mane:'#e7ded1',description:'White horse with Western tack. Idle, walk, trot, both canter leads, collected gallop and jump.'},
 'bay-western':{body:'#815638',mane:'#241b18',description:'Bay horse with Western tack. Standing pose, walk, trot, both canter leads, collected gallop and jump.'},
 'black-dragon-native':{body:'#24242a',mane:'#24242a',description:'The original Black Dragon, with its idle animation. A stationary companion for now; walking and flight are not available.'},
 'european-dragon':{body:'#665f52',mane:'#665f52',description:'European Dragon with standing and sitting idles, walk, run and flight. No jumping animation.'}
});

export function install(G){
 const H=G.horse,keys=Object.keys(NATIVE_MODEL_CHOICES);
 const esc=value=>String(value??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 for(const key of keys){
  const profile=NATIVE_BREED_PROFILES[key],choice=NATIVE_MODEL_CHOICES[key];
  const row=[key,profile.name,'Common',0,0,choice.body,choice.mane,{nativeModelChoice:true,src:'native-models'}];
  H.registerBreed(row);
 }
 H.sourceRule((context,row)=>keys.includes(row?.[0])?false:undefined);
 if(H.roster?.SRC_LABEL)H.roster.SRC_LABEL['native-models']='Free models in the shop';
 const owned=(save,key)=>(save.horses||[]).some(h=>h.breed===key&&!h.foal);
 G.ui.shopTab({id:'native-models',label:'Free models',pos:1,render(save){
  return '<p>Choose a horse or dragon to add to your stable for free. Each has the movements listed below.</p>'+keys.map(key=>{
   const profile=NATIVE_BREED_PROFILES[key],choice=NATIVE_MODEL_CHOICES[key];
   return '<div class="evrow" data-native-choice="'+key+'"><b>'+esc(profile.name)+'</b><span>'+esc(choice.description)+' <a href="breeds.html?horse='+key+'&amp;v=native-gaits-1" target="_blank" rel="noopener">Preview in Breed Studio</a></span><button data-fx="native-horses:add:'+key+'"'+(owned(save,key)?' disabled':'')+'>'+(owned(save,key)?'In your stable':'Add to stable · Free')+'</button></div>';
  }).join('')+'<p>After adding a model, open My Horses and choose Ride when you are ready.</p>';
 }});
 G.ui.action('native-horses',args=>{
  if(args[0]==='open'){G.ui.openShop('native-models');return;}
  const key=args[1];if(args[0]!=='add'||!NATIVE_MODEL_CHOICES[key])return;
  let added=false;
  G.save.sync(save=>{if(owned(save,key))return;H.grantHorse(save,key,{src:'native-models',name:NATIVE_BREED_PROFILES[key].name});added=true;});
  if(added){H.reloadHorses();G.toast(NATIVE_BREED_PROFILES[key].name+' is in your stable.');}
  G.ui.openShop('native-models');
 });
 G.ui.stableHeader(()=>'<div class="evrow"><b>New horses and dragons</b><span>'+keys.length+' free choices · preview their available movements</span><button data-fx="native-horses:open">Free models</button></div>');
 G.ui.section('shopHorseRow',row=>keys.includes(row?.[0])?' · Free model choice':'');
 G.on('state',state=>{state.nativeModels=keys.map(key=>({key,name:NATIVE_BREED_PROFILES[key].name,gaits:Object.keys(NATIVE_BREED_PROFILES[key].nativeGaits),price:0}));});
}
