import {createTravelMapArt} from './travel-map-art.js?v=travel-map-1';
import {drawTravelMapPlaces} from './travel-map-places.js?v=travel-map-1';

const clean=s=>String(s||'').replace(/^[^\p{L}\p{N}]+/u,'').trim();
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(name)=>'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+({pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',locate:'<circle cx="12" cy="12" r="6"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/><circle cx="12" cy="12" r="1.5"/>',home:'<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>'}[name]||'')+'</svg>';
const descriptions={ranch:'Your home arena, stables and everyday ranch life.',pasture:'Open grazing and a quiet place to spend time with your horses.',cottonwood:'A village stop for riding events and meeting the locals.',barleyfold:'Working farmland, golden fields and country riding.',coyote:'Sandstone country with canyon trails and western events.',hollowpeak:'Snowy uplands and mountain riding.',falls:'A mountain waterfall tucked into Hollowpeak.',lake:'A peaceful shore beside Loon Lake.',amberwood:'Autumn woodland and winding country trails.',willowmere:'Reed beds, marshland and waterside paths.',frostpine:'A quiet northern landscape of snow and pine.',ochre:'Open red-earth country and weathered stone.'};

export function createTravelMap({G,paths,travel}){
 const wrap=document.getElementById('bigmapWrap'),legacy=document.getElementById('ftBar');
 let open=false,selected=0,zoom=1,panX=0,panY=0,previousFocus=null,timer=null,art=null,entries=[],pins=[],drag=null,blockState='',showPlaces=false;
 const style=document.createElement('link');style.rel='stylesheet';style.href='./assets/travel-map.css?v=travel-map-1';document.head.append(style);
 wrap.classList.add('travel-map');wrap.innerHTML=`<section class="tm-dialog" role="dialog" aria-modal="true" aria-labelledby="tm-title">
  <header class="tm-header"><div class="tm-titlemark">${icon('pin')}</div><div><div class="tm-eyebrow">Meadowlark Ranch · World map</div><h1 id="tm-title">Kestrel Basin</h1></div><button class="tm-close" aria-label="Close map">${icon('close')}</button></header>
  <div class="tm-body"><div class="tm-stage" tabindex="0" aria-label="Map. Drag to pan. Use plus and minus to zoom; arrow keys to pan."><canvas id="bigmap" aria-label="Terrain, roads and waterways of Kestrel Basin"></canvas><div class="tm-pins"></div><div class="tm-you" role="img" aria-label="Your location"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 21-8-17 8 4 8-4Z"/></svg></div>
   <div class="tm-mapheading"><span>KESTREL BASIN</span><small>Trails, towns & open country</small><button class="tm-places" aria-pressed="false">Activities & treasures</button></div>
   <div class="tm-compass" aria-label="North is up"><b>N</b><svg viewBox="0 0 30 44" aria-hidden="true"><path d="M15 3 26 37 15 30 4 37Z" fill="#536256"/><path d="M15 3v27L4 37Z" fill="#faf5e6" stroke="#536256"/></svg></div>
   <div class="tm-tools"><button data-map="in" aria-label="Zoom in">+</button><button data-map="out" aria-label="Zoom out">−</button><button data-map="fit" aria-label="Show entire map">Fit</button><button data-map="locate" aria-label="Center on your location">${icon('locate')}</button></div>
   <div class="tm-mapfoot"><span class="tm-scale"></span><span>Drag to explore · Scroll to zoom</span></div></div>
   <aside class="tm-sidebar" aria-label="Fast travel destinations"><label class="tm-search">${icon('search')}<input type="search" placeholder="Find a destination" aria-label="Find a destination" autocomplete="off"></label><div class="tm-list" aria-label="Destinations"></div><section class="tm-detail" aria-live="polite"></section></aside></div>
  <footer class="tm-footer"><span><i class="tm-legend open"></i> Travel stop <i class="tm-legend locked"></i> Locked <i class="tm-legend you"></i> You</span><span class="tm-count"></span><span class="tm-shortcut">M or Esc to close</span></footer></section>`;
 const dialog=wrap.querySelector('.tm-dialog'),stage=wrap.querySelector('.tm-stage'),canvas=wrap.querySelector('#bigmap'),ctx=canvas.getContext('2d'),pinLayer=wrap.querySelector('.tm-pins'),list=wrap.querySelector('.tm-list'),detail=wrap.querySelector('.tm-detail'),search=wrap.querySelector('input'),closeButton=wrap.querySelector('.tm-close');
 // Other features keep their existing guarded buttons and dynamic destination registry.
 legacy.hidden=true;legacy.style.display='none';legacy.setAttribute('aria-hidden','true');wrap.append(legacy);
 const current=()=>G.horse.player;
 const getEntries=()=>G.tables.FT.map((f,i)=>{const region=G.worldPkg?.ftRegion(f);return{i,f,name:clean(f[0]),region,locked:!!region&&!G.worldPkg.regionUnlocked(region),x:f[1],z:f[2]};}).filter(f=>Number.isFinite(f.x)&&Number.isFinite(f.z));
 function scale(){return Math.min(stage.clientWidth,stage.clientHeight)*.94/1000*zoom;}
 function project(x,z){const s=scale();return{x:stage.clientWidth/2+x*s+panX,y:stage.clientHeight/2+z*s+panY};}
 function clampPan(){const s=scale();panX=Math.max(-Math.max(30,500*s-stage.clientWidth/2+50),Math.min(Math.max(30,500*s-stage.clientWidth/2+50),panX));panY=Math.max(-Math.max(30,500*s-stage.clientHeight/2+50),Math.min(Math.max(30,500*s-stage.clientHeight/2+50),panY));}
 function distance(e){return Math.round(Math.hypot(e.x-current().pos.x,e.z-current().pos.z))+' m away';}
 function renderList(){
  const q=search.value.trim().toLocaleLowerCase(),filtered=entries.filter(e=>e.name.toLocaleLowerCase().includes(q));
  list.innerHTML='<div class="tm-listhead">DESTINATIONS <span>'+filtered.length+'</span></div>'+filtered.map(e=>`<button class="tm-place ${e.i===selected?'selected':''}" data-destination="${e.i}" aria-pressed="${e.i===selected}"><span class="tm-placeicon ${e.locked?'locked':''}">${icon(e.locked?'lock':e.i===0?'home':'pin')}</span><span><b>${escape(e.name)}</b><small>${e.locked?'Locked · view requirement':distance(e)}</small></span>${e.i===selected?'<span class="tm-selected-dot"></span>':''}</button>`).join('')+(filtered.length?'':'<p class="tm-empty">No destinations found. Try a different name.</p>');
  list.querySelectorAll('[data-destination]').forEach(b=>b.onclick=()=>select(+b.dataset.destination,true));
 }
 const eventActive=()=>!!G.course.get()||document.getElementById('courseHud')?.style.display!=='none';
 const blockingState=()=>eventActive()+'|'+!!G.worldPkg?.vehicle();
 function renderDetail(){
  blockState=blockingState();
  const e=entries.find(e=>e.i===selected);if(!e)return;
  const blocked=eventActive()?'Finish your current event before traveling.':G.worldPkg?.vehicle()?'Finish your balloon or ferry ride before traveling.':e.locked?clean(G.worldPkg.lockText(e.region)):null;
  const desc=descriptions[e.region?.id]||(typeof e.f[3]==='string'&&e.f[3].startsWith('ranch:')?'Your own ranch, ready for your next visit.':'A place to explore in Kestrel Basin.');
  detail.innerHTML=`<div class="tm-detailkind">${e.locked?'LOCKED DESTINATION':'FAST TRAVEL'}</div><h2>${escape(e.name)}</h2><p>${escape(desc)}</p><div class="tm-distance">${escape(distance(e))}${!e.locked?' · Free travel':''}</div>${blocked?'<p class="tm-requirement">'+escape(blocked)+'</p>':''}<button class="tm-travel" ${blocked?'disabled':''}>${icon(e.locked?'lock':'arrow')}<span>${e.locked?'Destination locked':'Travel here'}</span></button>`;
  detail.querySelector('button').onclick=()=>{if(travel(e.i)){close();}else{entries=getEntries();renderDetail();}};
 }
 function buildPins(){
  pinLayer.innerHTML='';pins=[];
  for(const e of entries){const b=document.createElement('button');b.type='button';b.className='tm-pin'+(e.locked?' locked':'');b.dataset.pin=String(e.i);b.setAttribute('aria-label',e.name+(e.locked?' — locked':''));b.title=e.name;b.innerHTML=icon(e.locked?'lock':e.i===0?'home':'pin')+'<span>'+escape(e.name)+'</span>';b.onclick=()=>{if(b._cluster?.length>1){const members=b._cluster;zoom=Math.min(8,zoom*2);panX=-members.reduce((n,e)=>n+e.x,0)/members.length*scale();panY=-members.reduce((n,e)=>n+e.z,0)/members.length*scale();clampPan();draw();}else select(e.i);};pinLayer.append(b);pins.push({e,b});}
 }
 function select(i,focusPlace=false){const restoreFocus=list.contains(document.activeElement);selected=i;renderList();renderDetail();if(restoreFocus)list.querySelector('[data-destination="'+i+'"]')?.focus({preventScroll:true});if(focusPlace){const e=entries.find(e=>e.i===i);if(e){zoom=Math.max(zoom,1.65);panX=-e.x*scale();panY=-e.z*scale();clampPan();}}draw();}
 function draw(){
  if(!open||!stage.clientWidth||!art)return;
  const w=stage.clientWidth,h=stage.clientHeight,dpr=Math.min(2,devicePixelRatio||1);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#e8e5d4';ctx.fillRect(0,0,w,h);
  const s=scale(),p=project(-500,-500);ctx.drawImage(art.canvas,p.x,p.y,1000*s,1000*s);
  if(showPlaces)drawTravelMapPlaces(ctx,{G,project,zoom,width:w,height:h});
  const course=G.course.get();if(course?.jumps?.length){ctx.strokeStyle='#987949';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.beginPath();course.jumps.forEach((j,i)=>{const q=project(j.x,j.z);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.stroke();ctx.setLineDash([]);}
  // Group nearby stops at overview scale; zoom reveals their individual locations.
  const clusters=[];
  for(const pin of [...pins].sort((a,b)=>(b.e.i===selected)-(a.e.i===selected)||a.e.i-b.e.i)){
   const p=project(pin.e.x,pin.e.z),near=clusters.find(c=>c.members.every(m=>Math.hypot(m.x-p.x,m.y-p.y)<42));
   if(near)near.members.push({...p,...pin});else clusters.push({members:[{...p,...pin}]});
   pin.b.hidden=true;
  }
  const points=clusters.map(c=>({members:c.members,x:c.members.reduce((n,m)=>n+m.x,0)/c.members.length,y:c.members.reduce((n,m)=>n+m.y,0)/c.members.length})),boxes=[];
  for(const point of points){
   const {members,x,y}=point,{e,b}=members[0],multiple=members.length>1,chosen=members.some(m=>m.e.i===selected),visible=x>20&&x<w-20&&y>20&&y<h-20;
   b.hidden=!visible;b.style.left=x+'px';b.style.top=y+'px';b.classList.toggle('selected',chosen);b.classList.toggle('cluster',multiple);b.style.zIndex=chosen?4:2;b._cluster=members.map(m=>m.e);
   const name=e.name+(multiple?' + '+(members.length-1):''),title=members.map(m=>m.e.name).join(', ')+(multiple?' — zoom to explore':e.locked?' — locked':'');
   b.setAttribute('aria-label',title);b.setAttribute('aria-pressed',String(chosen));b.title=title;
   let count=b.querySelector('em');if(multiple){if(!count){count=document.createElement('em');b.prepend(count);}count.textContent=members.length;}else count?.remove();
   const label=b.querySelector('span');label.textContent=name;
   const lw=Math.min(154,name.length*6.1+18),box={l:x-lw/2,r:x+lw/2,t:y+22,b:y+43};
   const overlap=boxes.some(o=>box.l<o.r+5&&box.r>o.l-5&&box.t<o.b+3&&box.b>o.t-3)||points.some(o=>o!==point&&o.x>box.l-12&&o.x<box.r+12&&o.y>box.t-12&&o.y<box.b+12);
   const show=visible&&box.l>4&&box.r<w-4&&box.b<h-30&&(chosen||!overlap);label.hidden=!show;if(show)boxes.push(box);
  }
  const you=project(current().pos.x,current().pos.z),marker=wrap.querySelector('.tm-you');marker.style.left=you.x+'px';marker.style.top=you.y+'px';marker.style.transform='translate(-50%,-50%) rotate('+(-current().heading)+'rad)';marker.hidden=you.x<0||you.x>w||you.y<0||you.y>h;
  const metres=zoom>2?50:100;const bar=wrap.querySelector('.tm-scale');bar.style.width=Math.max(24,metres*s)+'px';bar.textContent=metres+' m';
  wrap.querySelector('[data-map="in"]').disabled=zoom>=8;wrap.querySelector('[data-map="out"]').disabled=zoom<=1;
 }
 function resize(){if(open){clampPan();draw();}}
 function setZoom(next,px=stage.clientWidth/2,py=stage.clientHeight/2){const old=scale(),wx=(px-stage.clientWidth/2-panX)/old,wz=(py-stage.clientHeight/2-panY)/old;zoom=Math.max(1,Math.min(8,next));panX=px-stage.clientWidth/2-wx*scale();panY=py-stage.clientHeight/2-wz*scale();clampPan();draw();}
 function show(){
  if(open)return;previousFocus=document.activeElement;G.hidePanels();G.riding.releaseAll();current().speed=0;G.riding.lock('travel-map',true);
  open=true;wrap.style.display='flex';G.seFrame?.settle();entries=getEntries();if(!entries.some(e=>e.i===selected))selected=0;
  if(!art)art=createTravelMapArt({groundH:G.world.groundH,riverZ:G.world.riverZ,streamX:G.world.streamX,paths,regions:G.tables.REGIONS,worldPaths:G.worldPaths});
  search.value='';zoom=1;panX=panY=0;buildPins();renderList();list.scrollTop=0;renderDetail();resize();closeButton.focus({preventScroll:true});
  wrap.querySelector('.tm-count').textContent=entries.filter(e=>!e.locked).length+' of '+entries.length+' stops open';
  timer=setInterval(()=>{const next=getEntries();if(next.map(e=>e.name+e.locked).join('|')!==entries.map(e=>e.name+e.locked).join('|')){entries=next;buildPins();renderList();renderDetail();wrap.querySelector('.tm-count').textContent=entries.filter(e=>!e.locked).length+' of '+entries.length+' stops open';}else if(blockState!==blockingState())renderDetail();draw();},700);
 }
 function close(){if(!open)return;open=false;clearInterval(timer);timer=null;wrap.style.display='none';G.riding.releaseAll();G.riding.lock('travel-map',false);G.seFrame?.settle();previousFocus?.isConnected&&previousFocus.focus?.({preventScroll:true});}
 closeButton.onclick=close;wrap.addEventListener('click',e=>{if(e.target===wrap)close();});dialog.addEventListener('click',e=>e.stopPropagation());
 search.addEventListener('input',()=>{renderList();list.scrollTop=0;});
 wrap.querySelector('.tm-places').onclick=e=>{showPlaces=!showPlaces;e.currentTarget.setAttribute('aria-pressed',String(showPlaces));draw();};
 wrap.querySelectorAll('[data-map]').forEach(b=>b.onclick=()=>{const action=b.dataset.map;if(action==='in')setZoom(zoom*1.35);else if(action==='out')setZoom(zoom/1.35);else if(action==='fit'){zoom=1;panX=panY=0;draw();}else{zoom=Math.max(zoom,2);panX=-current().pos.x*scale();panY=-current().pos.z*scale();clampPan();draw();}});
 stage.addEventListener('wheel',e=>{e.preventDefault();const r=stage.getBoundingClientRect();setZoom(zoom*(e.deltaY<0?1.15:1/1.15),e.clientX-r.left,e.clientY-r.top);},{passive:false});
 stage.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button'))return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,px:panX,py:panY};stage.setPointerCapture(e.pointerId);stage.classList.add('dragging');});
 stage.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;panX=drag.px+e.clientX-drag.x;panY=drag.py+e.clientY-drag.y;clampPan();draw();});
 const endDrag=()=>{drag=null;stage.classList.remove('dragging');};stage.addEventListener('pointerup',endDrag);stage.addEventListener('pointercancel',endDrag);
 document.addEventListener('keydown',e=>{
  if(!open)return;
  e.stopPropagation();
  const editing=e.target.matches('input,textarea,[contenteditable="true"]');
  if(e.code==='Escape'||(e.code==='KeyM'&&!editing)){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)close();return;}
  if(e.key==='Tab'){const focusable=[...dialog.querySelectorAll('button:not(:disabled),input,[tabindex="0"]')].filter(x=>!x.hidden&&x.getClientRects().length),first=focusable[0],last=focusable.at(-1);if(!dialog.contains(document.activeElement)){e.preventDefault();(e.shiftKey?last:first)?.focus();}else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}return;}
  if(e.target===stage){if(e.key==='+'||e.key==='=')setZoom(zoom*1.35);else if(e.key==='-')setZoom(zoom/1.35);else if(e.key.startsWith('Arrow')){panX+=e.key==='ArrowLeft'?45:e.key==='ArrowRight'?-45:0;panY+=e.key==='ArrowUp'?45:e.key==='ArrowDown'?-45:0;clampPan();draw();}else return;e.preventDefault();e.stopImmediatePropagation();}
 },true);
 new ResizeObserver(resize).observe(stage);G.seFrame?.screens.add(()=>open);
 const api={show,close,toggle(value){if(typeof value==='boolean')value?show():close();else open?close():show();},draw,project,get isOpen(){return open;},get selected(){return selected;},get zoom(){return zoom;}};
 G.travelMap=api;return api;
}
