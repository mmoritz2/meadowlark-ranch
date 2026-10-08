/* Isolated DOM/event fixture for actual focus ownership and HUD gait handlers.
   No browser, WebGL, network, inventory writes, or player's localStorage. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let checks=0;const check=(ok,msg)=>{assert(ok,msg);checks++;};
const observers=new Set();
class Observer{constructor(fn){this.fn=fn;this.targets=[];observers.add(this);}observe(node,options){this.targets.push({node,options});}disconnect(){this.targets=[];}}
function mutation(node,type,attributeName){for(const ob of observers)if(ob.targets.some(({node:base,options:o})=>(node===base||o.subtree&&base.contains(node))&&o[type]&&(!o.attributeFilter||o.attributeFilter.includes(attributeName)))){if(ob.pending)continue;ob.pending=true;queueMicrotask(()=>{ob.pending=false;if(ob.targets.length)ob.fn([{target:node,type,attributeName}]);});}}
let document;
class Element{
 constructor(tag='div',id=''){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.attrs=new Map();this.listeners={};this.disabled=false;this.textContent='';this._style={};this.style=new Proxy(this._style,{set:(o,k,v)=>{o[k]=v;mutation(this,'attributes','style');return true;}});if(id)this.id=id;this.classList={contains:k=>this.classes().includes(k),add:(...ks)=>this.setAttribute('class',[...new Set([...this.classes(),...ks])].join(' ')),remove:(...ks)=>this.setAttribute('class',this.classes().filter(k=>!ks.includes(k)).join(' ')),toggle:(k,on)=>{const next=on??!this.classList.contains(k);this.classList[next?'add':'remove'](k);return next;}};}
 classes(){return (this.getAttribute('class')||'').split(/\s+/).filter(Boolean);}
 get id(){return this.getAttribute('id')||'';}set id(v){this.setAttribute('id',v);}
 get hidden(){return this.hasAttribute('hidden');}set hidden(v){v?this.setAttribute('hidden',''):this.removeAttribute('hidden');}
 get inert(){return this.hasAttribute('inert');}set inert(v){v?this.setAttribute('inert',''):this.removeAttribute('inert');}
 get tabIndex(){return this.hasAttribute('tabindex')?Number(this.getAttribute('tabindex')):/BUTTON|INPUT|SELECT|TEXTAREA/.test(this.tagName)||this.tagName==='A'&&this.hasAttribute('href')?0:-1;}
 get dataset(){return Object.fromEntries([...this.attrs].filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v]));}
 get isConnected(){return this===document?.body||!!this.parentElement?.isConnected;}
 setAttribute(k,v){if(this.attrs.get(k)===String(v))return;this.attrs.set(k,String(v));mutation(this,'attributes',k);}getAttribute(k){return this.attrs.has(k)?this.attrs.get(k):null;}hasAttribute(k){return this.attrs.has(k);}removeAttribute(k){if(this.attrs.delete(k))mutation(this,'attributes',k);}
 append(...els){for(const el of els){el.remove();this.children.push(el);el.parentElement=this;mutation(this,'childList');}}appendChild(el){this.append(el);return el;}
 remove(){if(this.parentElement){const p=this.parentElement;p.children=p.children.filter(x=>x!==this);this.parentElement=null;mutation(p,'childList');}}
 contains(el){return el===this||this.children.some(c=>c.contains(el));}
 getClientRects(){for(let p=this;p;p=p.parentElement){if(p.hidden||p.style.display==='none'||p.style.visibility==='hidden')return [];if(!p.ignoreMenuCSS&&['seHs','seEv','seJy','seOv','seChar','seMenu'].includes(p.id)&&!p.classList.contains('on'))return [];if(p.id==='shsModal'&&!p.parentElement?.classList.contains('m'))return [];}return this.isConnected?[{}]:[];}
 matches(sel){return sel.split(',').some(part=>{let s=part.trim();for(const m of [...s.matchAll(/:not\(([^)]+)\)/g)])if(this.matches(m[1]))return false;s=s.replace(/:not\([^)]+\)/g,'');if(s.includes(':disabled')){if(!this.disabled)return false;s=s.replace(':disabled','');}const tag=s.match(/^[a-z]+/i)?.[0];if(tag&&this.tagName!==tag.toUpperCase())return false;for(const m of s.matchAll(/#([\w-]+)/g))if(this.id!==m[1])return false;for(const m of s.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(m[1]))return false;for(const m of s.matchAll(/\[([\w-]+)(?:="?([^"\]]+)"?)?\]/g))if(!this.hasAttribute(m[1])||(m[2]!==undefined&&this.getAttribute(m[1])!==m[2]))return false;return true;});}
 querySelectorAll(sel){const out=[];for(const c of this.children){if(c.matches(sel))out.push(c);out.push(...c.querySelectorAll(sel));}return out;}querySelector(sel){return this.querySelectorAll(sel)[0]||null;}
 closest(sel){for(let el=this;el;el=el.parentElement)if(el.matches(sel))return el;return null;}
 compareDocumentPosition(other){return document.body.querySelectorAll('*').indexOf(this)<document.body.querySelectorAll('*').indexOf(other)?4:2;}
 addEventListener(type,fn,capture=false){(this.listeners[type]||=[]).push({fn,capture:!!capture});}removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(x=>x.fn!==fn);}
 focus(){if(!this.getClientRects().length||this.closest('[inert]'))return;const old=document.activeElement;document.activeElement=this;if(old&&old!==this)emit(old,'focusout');emit(this,'focusin');}
}
function event(target,type,fields={}){return {target,type,key:'',code:'',...fields,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=true;}};}
function emit(target,type,fields={}){const e=event(target,type,fields),chain=[];for(let p=target;p;p=p.parentElement)chain.push(p);chain.push(document);for(const p of [...chain].reverse()){for(const x of p.listeners[type]||[])if(x.capture)x.fn(e);if(e.stopped)return e;}for(const p of chain){for(const x of p.listeners[type]||[])if(!x.capture)x.fn(e);if(e.stopped)return e;}return e;}
function setup(){document=new Element('document');document.isConnected;document.body=new Element('body');document.activeElement=document.body;document.getElementById=id=>document.body.querySelectorAll('*').find(el=>el.id===id)||null;document.querySelectorAll=s=>document.body.querySelectorAll(s);global.document=document;global.window={};global.MutationObserver=Observer;global.getComputedStyle=el=>({display:el.getClientRects().length?'block':'none',visibility:el.style.visibility||'visible',zIndex:el.style.zIndex||'0'});return document;}
const node=(tag,id,parent=document.body)=>{const e=new Element(tag,id);parent.append(e);return e;};
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
(async()=>{
 setup();const {installMenuDialogFocus}=await import('../assets/menu-dialog-focus.js');
 const hud=node('div','seHudRoot'),menuBtn=node('button','seMenuBtn',hud),canvas=node('canvas','world'),preInert=node('div','locked');preInert.inert=true;preInert.setAttribute('aria-hidden','false');
 const top=node('div','seFrameTop');top.style.display='none';const back=node('button','back',top),close=node('button','close',top);
 const panel=node('div','settingsPanel');panel.classList.add('fpanel');panel.style.display='none';panel.setAttribute('role','region');panel.setAttribute('aria-label','Original label');const search=node('input','search',panel),save=node('button','save',panel);
 const marketTop=node('div','seMkTop');marketTop.style.display='none';const marketBack=node('button','market-back',marketTop),wallet=node('div','market-wallet',marketTop);
 const shop=node('div','shopPanel');shop.classList.add('fpanel','se-mk');shop.style.display='none';const category=node('h1','market-category',shop),shopAction=node('button','shop-action',shop);category.textContent='Breeds';
 const source=node('div','stablePanel');source.classList.add('fpanel','se-covered');source.inert=true;source.setAttribute('aria-hidden','true');
 const horses=node('div','seHs');horses.setAttribute('role','dialog');horses.setAttribute('aria-label','My Horses');const horseButton=node('button','horse-card',horses),pets=node('button','pets',horses),modal=node('div','shsModal',horses);modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');const mclose=node('button','modal-close',modal),mact=node('button','modal-action',modal);
 const dlg=node('div','dlg');dlg.style.display='none';const name=node('input','name',dlg);const menu=node('div','seMenu');const menuControl=node('button','menu-control',menu);const ceremony=node('div','tackStallDialog');ceremony.hidden=true;
 const calls=[],G={ui:{panels:['settingsPanel','stablePanel'],defs:{}},riding:{releaseAll:()=>calls.push('release'),lock:(key,on)=>calls.push([key,on])}};
 menuBtn.focus();const api=installMenuDialogFocus(G);check(api.active===null,'closed screens do not take focus');
 const unstyledCover=node('div','seJy');unstyledCover.ignoreMenuCSS=true;unstyledCover.style.zIndex='999';await flush();
 check(unstyledCover.getClientRects().length>0&&api.active===null&&document.activeElement===menuBtn,'closed covers cannot claim focus before their stylesheet loads');
 panel.classList.add('se-fr');panel.style.display='flex';top.style.display='flex';await flush();
 check(api.active==='settingsPanel'&&document.activeElement===panel,'opening framed menu focuses its dialog root');
 check(!unstyledCover.classList.contains('on')&&api.active==='settingsPanel','unstyled closed cover cannot outrank an open framed menu');
 check(hud.inert&&canvas.inert&&!panel.inert&&!top.inert,'framed content and shared topbar remain interactive while background is inert');
 check(panel.getAttribute('role')==='dialog'&&panel.getAttribute('aria-modal')==='true'&&panel.getAttribute('aria-owns')==='seFrameTop','framed screen announces its dialog and shared topbar');
 let e=emit(panel,'keydown',{key:'Tab',code:'Tab'});check(e.defaultPrevented&&document.activeElement===back,'first Tab reaches shared Back');
 emit(back,'keydown',{key:'Tab',code:'Tab',shiftKey:true});check(document.activeElement===save,'Shift Tab wraps from shared Back to last menu control');
 emit(save,'keydown',{key:'Tab',code:'Tab'});check(document.activeElement===back,'forward Tab wraps without reaching browser chrome');
 search.focus();e=emit(search,'keydown',{key:'w',code:'KeyW'});check(!e.defaultPrevented&&e.stopped,'typing stays native and does not reach riding shortcuts');
 save.focus();e=emit(save,'keydown',{key:' ',code:'Space'});check(!e.defaultPrevented&&e.stopped,'button Space retains default activation without jumping');
 e=emit(save,'keydown',{key:'Escape',code:'Escape'});check(!e.defaultPrevented&&!e.stopped,'Escape remains owned by existing close/back logic');
 const releaseCount=calls.filter(x=>x==='release').length;api.sync();api.sync();check(calls.filter(x=>x==='release').length===releaseCount&&document.activeElement===save,'unchanged redraws do not steal focus or repeatedly reset riding');
 // A later custom panel can overlap rather than hide its caller. Closing it must
 // reactivate the caller even while our own aria-hidden lease is still present.
 const overlay=node('div','overlayPanel');overlay.classList.add('fpanel');overlay.style.zIndex='50';const confirm=node('button','confirm',overlay);await flush();
 check(api.active==='overlayPanel'&&panel.inert,'a dynamically registered higher layer owns focus');
 overlay.style.display='none';await flush();check(api.active==='settingsPanel'&&!panel.inert&&document.activeElement===save,'closing an overlapping panel restores leased caller focus');
 // Direct screen transitions, a nested horse modal, and hidden covered sources.
 panel.style.display='none';top.style.display='none';panel.classList.remove('se-fr');horses.classList.add('on');await flush();horseButton.focus();
 check(api.active==='seHs'&&source.inert&&source.getAttribute('aria-hidden')==='true','cover owns focus without altering original hidden source panel');
 pets.focus();horses.classList.add('m');await flush();check(api.active==='shsModal'&&horseButton.inert&&pets.inert,'nested modal isolates the parent controls');
 emit(modal,'keydown',{key:'Tab',code:'Tab'});check(document.activeElement===mclose,'nested modal first Tab enters its own controls');
 emit(mclose,'keydown',{key:'Tab',code:'Tab',shiftKey:true});check(document.activeElement===mact,'nested modal Tab cannot reach outer horse cards');
 horses.classList.remove('m');await flush();check(api.active==='seHs'&&document.activeElement===pets&&!pets.inert,'closing nested modal restores its triggering control');
 // Existing dialogue focus owner takes priority and returns to the same screen.
 dlg.style.display='block';await flush();name.focus();check(api.active===null&&!hud.inert&&document.activeElement===name,'dialogue temporarily owns focus without fighting helper');
 dlg.style.display='none';await flush();check(api.active==='seHs'&&document.activeElement===pets,'dialogue close resumes parent menu focus');
 // Main menu releases leases synchronously before capturing its own inert baseline.
 api.suspend();const beforeMain=hud.inert;menu.classList.add('on');hud.inert=true;await flush();menuControl.focus();check(!beforeMain&&hud.inert&&api.active===null&&document.activeElement===menuControl,'main modal handoff preserves its independent inert ownership');
 menu.classList.remove('on');hud.inert=beforeMain;await flush();check(api.active==='seHs','leaving main modal can reactivate the remaining menu');
 ceremony.hidden=false;await flush();check(api.active===null,'world tack ceremony is excluded from shared ownership');ceremony.hidden=true;await flush();
 horseButton.focus();horseButton.remove();await flush();check(document.activeElement===horses,'redrawn controls recover focus inside their still-open screen');
 horses.classList.remove('on');await flush();check(api.active===null&&!hud.inert&&document.activeElement===menuBtn,'closing final screen restores a reachable ranch control');
 check(preInert.inert&&preInert.getAttribute('aria-hidden')==='false'&&panel.getAttribute('role')==='region'&&panel.getAttribute('aria-label')==='Original label'&&!panel.hasAttribute('aria-modal')&&!panel.hasAttribute('tabindex'),'preexisting inert and ARIA/role/tabindex state restored exactly');
 check(calls.filter(Array.isArray).at(-1)[1]===false,'independent riding lock is released');
 // Market has its own body-sibling header; it must be inside the same modal as
 // shopPanel, and late header visibility must update ownership without a redraw.
 shop.style.display='block';await flush();
 check(api.active==='shopPanel'&&shop.getAttribute('aria-label')==='Market','Market dialog has a stable label independent of its selected category');
 marketTop.style.display='flex';await flush();
 check(!marketTop.inert&&marketTop.getAttribute('aria-hidden')!=='true'&&!wallet.closest('[inert]')&&shop.getAttribute('aria-owns')==='seMkTop','visible Market header and wallet stay accessible within the shop dialog');
 emit(shop,'keydown',{key:'Tab',code:'Tab'});check(document.activeElement===marketBack,'first Market Tab reaches its body-sibling Back button');
 emit(marketBack,'keydown',{key:'Tab',code:'Tab',shiftKey:true});check(document.activeElement===shopAction,'Market Shift Tab wraps from header to content');
 emit(shopAction,'keydown',{key:'Tab',code:'Tab'});check(document.activeElement===marketBack,'Market Tab wraps from content to accessible Back');
 category.textContent='Tack boutique';node('p','new-category-copy',shop);await flush();
 check(shop.getAttribute('aria-label')==='Market','switching Market categories does not leave a stale category label on the dialog');
 marketBack.addEventListener('click',()=>{shop.style.display='none';marketTop.style.display='none';});emit(marketBack,'click');await flush();
 check(api.active===null&&document.activeElement===menuBtn&&!marketTop.inert&&!marketTop.hasAttribute('aria-hidden')&&!shop.hasAttribute('aria-owns'),'Market Back closes and restores header attributes plus ranch focus');
 api.dispose();
 // Run actual gait event wiring from se-hud; the scene and surrounding HUD are irrelevant.
 const pace=node('div','seRidePace'),label=node('button','seGaitLabel',pace),down=node('button','seGaitDown',pace),up=node('button','seGaitUp',pace),stop=node('button','seStop',pace),choices=node('div','seGaitChoices',pace);
 for(const gait of ['walk','trot','canter','gallop']){const b=node('button','',choices);b.setAttribute('data-gait',gait);b.setAttribute('aria-pressed',String(gait==='canter'));}const hooks={},actions=[];
 const gaitG={on:(n,f)=>(hooks[n]||=[]).push(f),riding:{shiftGait:n=>actions.push(['shift',n]),selectGait:g=>actions.push(['select',g]),brake:on=>actions.push(['brake',on])}};
 const sourceHUD=fs.readFileSync(path.join(__dirname,'../assets/features/se-hud.js'),'utf8'),a=sourceHUD.indexOf(" const choices=$('seGaitChoices')"),b=sourceHUD.indexOf(' // Less frequent actions',a);
 vm.runInNewContext(sourceHUD.slice(a,b),{pace,document,$:document.getElementById,G:gaitG,queueMicrotask});
 label.onclick();check(choices.classList.contains('on')&&document.activeElement===choices.children[2]&&label.getAttribute('aria-expanded')==='true','gait disclosure focuses currently selected gait');
 e=emit(choices.children[2],'keydown',{key:'ArrowRight',code:'ArrowRight'});check(e.defaultPrevented&&e.stopped&&document.activeElement===choices.children[3],'gait arrow navigation stays inside visible options');
 choices.children[1].hidden=true;emit(choices.children[3],'keydown',{key:'Home',code:'Home'});emit(choices.children[0],'keydown',{key:'ArrowRight',code:'ArrowRight'});check(document.activeElement===choices.children[2],'gait keyboard navigation skips unavailable dragon trot');
 e=emit(choices.children[2],'keydown',{key:' ',code:'Space'});check(!e.defaultPrevented&&e.stopped,'gait Space preserves native click and cannot reach riding');
 choices.onclick({target:choices.children[0]});check(actions.at(-1).join(':')==='select:walk'&&!choices.classList.contains('on')&&document.activeElement===label,'selecting gait uses existing riding API and restores trigger focus');
 label.onclick();emit(choices.children[0],'keydown',{key:'Escape',code:'Escape'});check(!choices.classList.contains('on')&&label.getAttribute('aria-expanded')==='false'&&document.activeElement===label,'Escape closes gait picker and restores trigger');
 e=emit(label,'keydown',{key:'Escape',code:'Escape'});check(!e.stopped,'Escape on a closed gait picker remains available to game shell');
 label.onclick();check(hooks.escape[0]()===true&&!choices.classList.contains('on'),'global Escape hook closes picker when focus is elsewhere');
 label.onclick();emit(canvas,'pointerdown');check(!choices.classList.contains('on'),'outside pointer dismisses gait picker');
 label.onclick();menuBtn.focus();await flush();check(!choices.classList.contains('on'),'leaving pace controls by keyboard dismisses disclosure');
 emit(stop,'keydown',{key:' ',code:'Space'});emit(stop,'keyup',{key:' ',code:'Space'});check(actions.slice(-2).map(x=>x.join(':')).join(',')==='brake:true,brake:false','STOP held-key contract is preserved');
 console.log(`PASS shared menu focus and gait keyboard: ${checks} behavioral checks`);
})().catch(e=>{console.error(e);process.exitCode=1;});
