/* Feature package 'se-journey' — My Journey, laid out the way the riding game this one is modelled on
   lays out its own.

   Its Journey is one screen of picture cards over the dimmed world: a tall card for the main story on
   the left with the story's percentage across its picture, then two rows of smaller cards running off
   to the right (the disciplines, the ranch, the daily jobs, the side stories, a featured story), each a
   painting over a purple name plate with a thin gold bar for how far along it is. The row scrolls
   sideways, a scrollbar under it. Ours was a column of tabs and a list of rows in a cream card.

   Every figure is read from the save and the game's own modules as they stand (the story cursor, the
   dailies, the side quests, the ribbons per event and difficulty, the ranch points, the season's book,
   the hunts...). Nothing is claimed from here: a card opens the place where the thing is done. A quest
   card opens the old quest list itself, framed, on that card's tab (se-frame's classic()), and its Back
   comes here again; a discipline opens its next event in Riding Events; the ranch opens Build. The
   quest panel stays open underneath the whole time (se-frame's cover()), so its renderer, its claim
   buttons, every package that opens it on a tab, and every test that reads it carry on as before.

   A tap on the Season Pass tile, the quest board by the arena or a villager who says "have a look at
   your side quests" opens the quest panel on a tab of its own; the screen notices that and shows the
   list on that tab instead, so those routes land where they always did.

   Every picture is drawn here, flat colour in the manner of the entry tickets and the same at any
   hour (the horses are se-events' horseSvg and scene, and a card with a horse on it wears that horse's
   own coat). The ☰ Journey tile carries a red pip with how many things are waiting to be claimed.
   Nothing runs at import time. */
export const id='se-journey';
export function install(G){
 const K=G.seFrame, T=G.tables;
 if(!K||!T||!document.body||!document.getElementById('questPanel'))return;
 const EV=G.seEvents||{};
 const $=id=>document.getElementById(id), esc=K.esc;
 const S=()=>G.save.fresh()||{};
 const nx=s=>{try{return window.__noEmoji.clean(String(s==null?'':s),true);}catch(e){return String(s==null?'':s);}};
 const plain=s=>nx(String(s==null?'':s).replace(/<[^>]+>/g,'')).replace(/\s+/g,' ').trim();
 const clampPct=v=>Math.max(0,Math.min(100,Math.round(v)));
 const f1=v=>(+v).toFixed(1);
 const hash=str=>{let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
 const rng=seed=>()=>{seed=(seed+0x6D2B79F5)>>>0;let t=seed;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
 const today=()=>new Date().toDateString();
 const wk=()=>{try{return G.time.weekKey();}catch(e){return '';}};
 const sid=()=>{try{return G.time.seasonNow().def.id;}catch(e){return 'bloom';}};

 /* ================================================================ the figures ============
    One save read per paint (G.save.fresh() is a parse and every package's ensure); every card gets
    the same s. Each figure returns {pct,x,y,sub,status,ready,readyN,isNew,sig,locked}. */
 const F={};
 F.story=s=>{
  const ST=G.quest.STORY, i=G.quest.storyIdx(), p=G.quest.storyProg(), m=ST[i]||null, nb=G.storyQuests.nextBook();
  const name=(s.story&&s.story.name)||'the grey mare', tx=t=>String(t==null?'':t).replace(/\{name\}/g,name);
  const npc=m&&G.quest.NPC_DEFS.find(d=>d.id===(m.npc||'wren'));
  const chapter=m?(m.ch||m.book||'The Home Meadow'):(nb?'Next: '+nb.title:'Story complete');
  const ready=!!(m&&p>=m.goal);
  return {pct:clampPct(G.storyQuests.storyPct()),x:Math.min(i,ST.length),y:ST.length,sub:nx(chapter),
   status:nx(m?tx(m.label)+(m.goal>1?' ('+Math.floor(Math.min(p,m.goal))+'/'+m.goal+')':''):(nb?nb.title+' arrives in '+Math.max(0,Math.ceil((nb.releaseAt-Date.now())/864e5))+' days':'Every chapter so far is done')),
   ready,readyN:ready?1:0,readyText:ready?'Done! Tell '+nx(npc?npc.name:'the giver'):'',
   isNew:!!(m&&i>0&&p===0&&ST[i-1]&&(ST[i-1].ch||ST[i-1].book)!==(m.ch||m.book)),sig:'ch:'+chapter};
 };
 F.side=s=>{
  const SQ=G.storyQuests, side=s.side||{active:{},done:{},n:0};
  const done=q=>{const d=(side.done||{})[q.id];if(!d)return false;return q.repeat==='weekly'?d===wk():true;};
  const act=Object.keys(side.active||{}).map(id=>SQ.SIDE_BY[id]).filter(Boolean);
  const ready=act.filter(q=>(side.active[q.id].p||0)>=q.goal);
  const cleared=SQ.SIDEQ.filter(done).length;
  let waiting=0; try{waiting=G.quest.NPC_DEFS.reduce((n,d)=>n+SQ.sideAvailable(s,d.id).length,0);}catch(e){}
  return {pct:null,x:cleared,y:SQ.SIDEQ.length,active:act.length,
   sub:act.length?act.length+'/5 on the go'+(ready.length?' · '+ready.length+' ready':''):(waiting?waiting+' offers around the Basin':(side.n||0)+' finished'),
   status:(act.length?act.length+' of 5 side stories on the go'+(ready.length?', '+ready.length+' ready to turn in':''):(side.n||0)+' finished')+'. '+cleared+' of '+SQ.SIDEQ.length+' cleared.',
   ready:ready.length>0,readyN:ready.length};
 };
 F.welcome=s=>{
  const w=s.welcome||{day:0,claimed:{}}, cl=Object.keys(w.claimed||{}).length, rd=G.account.welcomeReady(s)||0;
  return {pct:clampPct(100*cl/7),x:cl,y:7,sub:cl>=7?'All seven gifts collected':'Day '+(w.day||0)+' of 7'+(rd?' · '+rd+' gift'+(rd>1?'s':'')+' waiting':''),
   status:'Welcome week: '+cl+' of 7 gifts opened'+(rd?', '+rd+' waiting':''),ready:rd>0,readyN:rd,isNew:(w.day||0)<=1&&cl===0,sig:'w'};
 };
 const welcomeOn=s=>!!(s.welcome&&Object.keys(s.welcome.claimed||{}).length<7&&!s.welcome.vet);
 F.season=s=>{
  const st=G.houses.bookState(s), n=st.B.entries.length, part=st.cur?Math.min(1,st.prog/st.cur.goal):0;
  const ready=!!(st.cur&&st.prog>=st.cur.goal);
  return {pct:clampPct(100*(st.i+part)/n),x:st.i,y:n,
   sub:nx(st.done?st.B.title+' closed':st.cur.label+' ('+Math.floor(st.prog)+'/'+st.cur.goal+')'),
   status:nx(st.B.title+(st.done?' is closed':', entry '+(st.i+1)+' of '+n+': '+st.cur.label)),ready,readyN:ready?1:0,isNew:st.i===0&&st.prog===0,sig:'b:'+st.B.title};
 };
 F.daily=s=>{
  const td=G.quest.todayDaily(), N=(G.storyQuests&&G.storyQuests.DAILY_N)||6;
  const dq=(s.dq&&s.dq.date===today())?s.dq:{prog:{},claimed:{}};
  const prog=q=>Math.min(q.goal,(dq.prog||{})[q.type]||0);
  const cl=Math.min(N,Object.keys(dq.claimed||{}).length);
  const readyN=td.filter(q=>prog(q)>=q.goal&&!dq.claimed[q.type]).length+(cl>=N&&!dq.umbrella?1:0);
  const next=td.find(q=>!dq.claimed[q.type]&&prog(q)<q.goal);
  return {pct:clampPct(100*td.reduce((a,q)=>a+prog(q)/q.goal,0)/Math.max(1,td.length)),x:cl,y:N,
   sub:nx(cl>=N?(dq.umbrella?'All done · new jobs at midnight':'Umbrella reward ready'):(next?next.label+' ('+Math.floor(prog(next))+'/'+next.goal+')':readyN+' ready to claim')),
   status:cl+' of '+N+' daily quests claimed',ready:readyN>0,readyN};
 };
 F.ach=s=>{
  const A=G.quest.ACHS, c=s.achClaims||{}, earned=A.filter(a=>c[a.id]).length;
  const readyN=A.filter(a=>{if(c[a.id])return false;try{return a.v(s)>=a.goal;}catch(e){return false;}}).length;
  return {pct:clampPct(100*earned/A.length),x:earned,y:A.length,sub:earned+' of '+A.length+' earned'+(readyN?' · '+readyN+' to claim':''),
   status:earned+' of '+A.length+' achievements earned',ready:readyN>0,readyN};
 };
 F.coll=s=>{
  const B=G.worldPkg.BOTTLES; let got=(s.bottles||[]).length, tot=B.length;
  for(const k of Object.keys(T.COLL_SETS)){const n=T.COLL_SETS[k].n||5;got+=Math.min(n,((s.sets&&s.sets[k])||[]).length);tot+=n;}
  got+=s.toyUnicorn?1:0; tot+=1;
  const chests=(T.CHESTS||[]).filter(c=>s.chests&&s.chests[c.id]).length;
  return {pct:clampPct(100*got/tot),x:got,y:tot,sub:got+' of '+tot+' found · '+chests+'/'+(T.CHESTS||[]).length+' chests',status:got+' of '+tot+' collectibles found'};
 };
 F.mastery=s=>{
  const rows=T.BREEDS3.filter(b=>!(b[7]&&b[7].story)||(s.horses||[]).some(h=>h.breed===b[0])).map(b=>({b,M:G.xp.masteryOf(s,b[0]),mx:G.mastery.maxOf(b[0])}));
  const owned=rows.filter(r=>r.M>0), mastered=rows.filter(r=>r.M>=r.mx).length;
  const best=owned.slice().sort((p,q)=>(q.M/q.mx)-(p.M/p.mx))[0];
  const sM=owned.reduce((a,r)=>a+r.M,0), sX=owned.reduce((a,r)=>a+r.mx,0);
  return {pct:clampPct(sX?100*sM/sX:0),x:mastered,y:rows.length,best:best?best.M/best.mx:0,
   sub:nx(best?best.b[1]+' '+best.M+'/'+best.mx+(mastered?' · '+mastered+' mastered':''):'No breeds yet'),status:mastered+' of '+rows.length+' breeds mastered'};
 };
 F.foal=s=>{
  const FS=G.breeding.FOAL_STORY, q=s.foalq;
  if(!q)return {pct:null,x:0,y:FS.length,sub:'Begins with your first foal',status:'Foal\'s First Steps begins when your first foal is born',locked:'Begins when your first foal is born'};
  const cur=FS[q.idx]||null, part=cur?Math.min(1,(q.prog||0)/cur.goal):0, f=(s.horses||[]).find(h=>h.id===q.active);
  return {pct:clampPct(100*(q.idx+part)/FS.length),x:q.idx,y:FS.length,foal:f||null,
   sub:nx(cur?cur.label+(f?' · '+f.name:''):'Complete'),status:nx(cur?'Next: '+cur.label+(f?', with '+f.name:''):'Every first step taken'),
   isNew:q.idx===0&&!(q.prog>0),sig:'f:'+(q.active||'')};
 };
 F.coop=s=>{
  const SP=G.social, total=SP.coopTotal(), cl=s.coopClaims||{};
  const goals=SP.COOP_GOALS.map(g=>({g,claimed:!!cl[wk()+':'+g.id],ready:total>=g.goal&&!cl[wk()+':'+g.id]}));
  const top=SP.COOP_GOALS[SP.COOP_GOALS.length-1].goal, nxg=goals.find(o=>!o.claimed), readyN=goals.filter(o=>o.ready).length;
  return {pct:clampPct(100*total/top),x:total,y:top,sub:nxg?total+'/'+nxg.g.goal+' foraged this week':'Both baskets claimed',status:'The club has foraged '+total+' this week',ready:readyN>0,readyN};
 };
 F.hunts=s=>{
  const P=G.hunts, defs=P.defs(), d=defs.find(x=>x.id===P.live()[0])||defs.find(x=>x.season===sid())||null;
  if(!d)return {pct:null,sub:'Nothing hidden this season',status:'Nothing hidden this season',kind:'egg'};
  const got=((s.hunt&&s.hunt.got&&s.hunt.got[d.id])||[]).length, locked=d.gated&&!P.open[d.id];
  return {pct:locked?null:clampPct(100*got/d.n),x:got,y:d.n,kind:d.id,sub:nx(d.label+' · '+got+'/'+d.n),
   status:nx(locked?d.label+' is locked: '+d.locked:d.label+': '+got+' of '+d.n+' found this week'),locked:locked?nx(d.locked):null,isNew:!locked&&got===0,sig:'h:'+wk()};
 };
 F.vistalog=s=>{
  const L=G.vistas.LAND, been=s.vistas||{}, got=L.filter(l=>been[l.id]).length;
  return {pct:clampPct(100*got/L.length),x:got,y:L.length,sub:got+' of '+L.length+' landmarks',status:got+' of '+L.length+' landmarks visited'};
 };
 const ribbonsOf=(ev,s)=>{
  const D=G.course.DIFFS, by=s.ribbonsBy||{}, best=(s.ribbons||{})[ev.id]||0;
  const per=D.map(d=>Math.min(4,by[ev.id+':'+d.k]||0));
  if(!per.some(Boolean)&&best){const oi=Math.max(0,D.findIndex(d=>d.k==='open'));per[oi]=Math.min(4,best);}
  return {sum:per.reduce((a,b)=>a+b,0),max:4*D.length,best,gold:per.filter(v=>v>=4).length};
 };
 const discEvents=k=>T.EVENTS3.filter(ev=>!ev.friendly&&G.events2.discOf(ev).k===k);
 const shortName=ev=>{const t=String(ev.town||'').split(' ')[0];let n=String(ev.name||'');if(t&&n.toLowerCase().startsWith(t.toLowerCase()+' '))n=n.slice(t.length+1);return n;};
 F.disc=(s,k)=>{
  const h=(G.horse.ridden&&G.horse.ridden())||{}, evs=discEvents(k);
  let sum=0,max=0,won=0; for(const ev of evs){const r=ribbonsOf(ev,s);sum+=r.sum;max+=r.max;if(r.best>0)won++;}
  const ok=ev=>{try{return G.course.eventOk(ev,h).ok;}catch(e){return true;}};
  const byLvl=(a,b)=>(a.lvl||1)-(b.lvl||1);
  const next=evs.filter(ev=>!((s.ribbons||{})[ev.id]>0)).sort(byLvl).sort((a,b)=>(ok(b)?1:0)-(ok(a)?1:0))[0]
   ||evs.slice().sort((a,b)=>ribbonsOf(a,s).sum-ribbonsOf(b,s).sum||byLvl(a,b))[0]||null;
  /* the event's name without its town; where that leaves only the card's own title (Barleyfold's "Cross Country") the town says which */
  const nm=ev=>{const n=shortName(ev);return n.toLowerCase()===String(DISC_T[k]||'').toLowerCase()?(String(ev.town||'').split(' ')[0]||String(ev.name||n)):n;};
  return {pct:clampPct(max?100*sum/max:0),x:sum,y:max,next:next?next.id:null,
   sub:nx(next&&!((s.ribbons||{})[next.id]>0)?'Next: '+nm(next):sum+' of '+max+' ribbons'),
   status:nx(won+' of '+evs.length+' events placed, '+sum+' of '+max+' ribbons')};
 };
 F.race=s=>{
  const f=F.disc(s,'race'), E=G.events;
  try{const pts=(s.racing&&s.racing.pts)||0, i=E.rankIdx(pts), R=E.RACE_RANKS, cl=(s.racing&&s.racing.claimed)||{};
   const claim=R.filter((r,k)=>k>0&&k<=i&&!cl[k]).length;
   f.sub=nx(R[i].label+' · '+pts+' pts'); f.claim=claim; f.ready=claim>0; f.readyN=claim;
   f.status+='. Racing rank '+nx(R[i].label)+(claim?', '+claim+' rank prize'+(claim>1?'s':'')+' to claim':'');}catch(e){}
  return f;
 };
 F.ranch=s=>{
  const RS=G.ranchSys, LV=T.RANCH_LEVELS, pts=RS.ranchPts(s), L=RS.ranchLevel(s), top=LV[LV.length-1];
  return {pct:clampPct(100*pts/top),x:pts,y:top,level:L,sub:'Level '+L+(L<LV.length?' · '+Math.max(0,LV[L]-pts)+' pts to '+(L+1):' · top level'),
   status:'Ranch level '+L+', '+Math.round(pts)+' builder points'};
 };
 F.special=s=>{
  const sp=G.seasons.special(); let d=0; try{d=G.time.seasonNow().daysLeft;}catch(e){}
  /* the status line reads "No wild horses gentled yet — carrots, and patience."; the card keeps the part before the dash, the whole of it goes in the label */
  const full=plain(G.seasons.specialStatus(s))||nx(sp.blurb);
  return {pct:null,title:nx(sp.label),id:sp.id,days:d,sub:full.split(/\s+[—–]\s+/)[0].replace(/\.$/,''),status:nx(sp.label)+': '+(full?full.replace(/\.$/,'')+'. ':'')+plain(sp.blurb)};
 };

 /* ================================================================ the pictures ===========
    Each card's picture is an SVG drawn here in the manner of the entry tickets: flat colour, a
    landscape, the game's own horse. viewBox 0 0 240 240 for a card (the story's is a 480 world). Ids
    are per card so a card's gradients never collide with another's. */
 const PAL={meadow:['#bfe0f0','#f5efd6','#b9d59a','#8fbd76','#6ea45a','#4f7f45'],gold:['#f3c98c','#fbe8c3','#e0c07e','#c6a361','#a79a58','#7a6a3a'],
  dusk:['#e59a6c','#f8d7aa','#c98b58','#a86c42','#8a6a3a','#5e4128'],frost:['#a9c4e0','#eef3f8','#dbe5ee','#c6d3df','#eef2f6','#5f7a8a'],
  lilac:['#c9b6e8','#f3e8f6','#bfc9a0','#9fb682','#86a56c','#5e7f4c']};
 const SPAL={bloom:'meadow',sun:'gold',ember:'dusk',frost:'frost'};
 const horse=(pose,x,y,sc,o,flip)=>{if(!EV.horseSvg)return '';const g=EV.horseSvg(pose,x,y,sc,o);return flip?'<g transform="translate('+f1(2*x)+' 0) scale(-1 1)">'+g+'</g>':g;};
 const coatOf=h=>{const c=(h&&h.colors)||{};const b=c.body||'#8b4f2b';return {body:b,dark:shade(b,-0.28),mane:c.mane||'#33200f',noRider:true};};
 function shade(hex,k){const m=/^#?([0-9a-f]{6})$/i.exec(String(hex||''));if(!m)return hex;const n=parseInt(m[1],16);let r=n>>16,g=n>>8&255,b=n&255;
  const f=v=>Math.max(0,Math.min(255,Math.round(k<0?v*(1+k):v+(255-v)*k)));return '#'+((1<<24)|(f(r)<<16)|(f(g)<<8)|f(b)).toString(16).slice(1);}
 const tree=(x,y,rr,col)=>'<rect x="'+f1(x-1.3)+'" y="'+f1(y)+'" width="2.6" height="'+f1(rr*1.3)+'" fill="'+col+'"/><circle cx="'+f1(x)+'" cy="'+f1(y-rr*0.35)+'" r="'+f1(rr)+'" fill="'+col+'"/>';
 function land(id,p,o){
  o=o||{}; const W=o.w||240,H=o.h||240,r=rng(o.seed||7),y1=o.y1||H*.5,y2=o.y2||H*.62,gy=o.gy||H*.76,g=id+'-sky';
  let s='<defs><linearGradient id="'+g+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+p[0]+'"/><stop offset="1" stop-color="'+p[1]+'"/></linearGradient></defs>'
   +'<rect width="'+W+'" height="'+H+'" fill="url(#'+g+')"/>';
  if(o.sun!==false)s+='<circle cx="'+f1(o.sunX||W*.74)+'" cy="'+f1(o.sunY||H*.2)+'" r="'+f1(W*.07)+'" fill="#fff8e2" opacity=".9"/>';
  s+='<path d="M0 '+f1(y1+10)+'Q'+f1(W*.18)+' '+f1(y1-14)+' '+f1(W*.36)+' '+f1(y1+2)+'T'+f1(W*.72)+' '+f1(y1-6)+'T'+W+' '+f1(y1+6)+'V'+H+'H0Z" fill="'+p[2]+'"/>';
  s+='<path d="M0 '+f1(y2+10)+'Q'+f1(W*.25)+' '+f1(y2-10)+' '+f1(W*.5)+' '+f1(y2+4)+'T'+W+' '+f1(y2)+'V'+H+'H0Z" fill="'+p[3]+'"/>';
  if(o.trees!==false)for(let i=0;i<(o.nTrees||5);i++){const x=8+r()*(W-16),y=y2+2+r()*8,rr=(5+r()*5)*W/240;s+=tree(x,y,rr,p[5]);}
  s+='<path d="M0 '+f1(gy)+'Q'+f1(W/2)+' '+f1(gy-10)+' '+W+' '+f1(gy+2)+'V'+H+'H0Z" fill="'+p[4]+'"/>';
  return s;
 }
 const fence=(x0,x1,y,col,step)=>{step=step||22;let s='<path d="M'+x0+' '+f1(y-14)+'H'+x1+'M'+x0+' '+f1(y-5)+'H'+x1+'" stroke="'+col+'" stroke-width="3"/>';for(let x=x0+4;x<x1;x+=step)s+='<rect x="'+f1(x)+'" y="'+f1(y-20)+'" width="3.4" height="22" fill="'+col+'"/>';return s;};
 const heart=(x,y,sc,col)=>'<path transform="translate('+f1(x)+' '+f1(y)+') scale('+sc+')" d="M0 6C-7-1-12 3-12 8c0 6 7 10 12 14 5-4 12-8 12-14 0-5-5-9-12-2z" fill="'+col+'"/>';
 const spark=(x,y,r,col)=>'<path d="M'+f1(x)+' '+f1(y-r)+'L'+f1(x+r*.28)+' '+f1(y-r*.28)+'L'+f1(x+r)+' '+f1(y)+'L'+f1(x+r*.28)+' '+f1(y+r*.28)+'L'+f1(x)+' '+f1(y+r)+'L'+f1(x-r*.28)+' '+f1(y+r*.28)+'L'+f1(x-r)+' '+f1(y)+'L'+f1(x-r*.28)+' '+f1(y-r*.28)+'Z" fill="'+(col||'#fff8dc')+'"/>';
 const starPath=(cx,cy,R,r)=>{let d='';for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r:R;d+=(i?'L':'M')+f1(cx+Math.cos(a)*rr)+' '+f1(cy+Math.sin(a)*rr);}return d+'Z';};
 const rosette=(x,y,sc,c1,c2)=>'<g transform="translate('+f1(x)+' '+f1(y)+') scale('+sc+')">'+K.RIBBON(c1,c2).replace('<svg ','<svg width="40" height="48" ')+'</g>';
 const pin=(x,y,sc,col)=>'<g transform="translate('+f1(x)+' '+f1(y)+') scale('+sc+')"><path d="M0 0C-7-9-10-13-10-18a10 10 0 0 1 20 0c0 5-3 9-10 18z" fill="'+col+'" stroke="#3a2a1a" stroke-width="1.4"/><circle cx="0" cy="-18" r="3.8" fill="#fff"/></g>';
 function barn(cx,gy,sc,stage){
  const w=110*sc,h=58*sc,x=cx-w/2,top=gy-h,peak=top-40*sc,e=6*sc,k=14*sc,sh=24*sc;
  const roof='M'+f1(x-e)+' '+f1(top)+'L'+f1(x+k)+' '+f1(top-sh)+'L'+f1(cx)+' '+f1(peak)+'L'+f1(x+w-k)+' '+f1(top-sh)+'L'+f1(x+w+e)+' '+f1(top)+'Z';
  const dw=34*sc,dh=40*sc,dx=cx-dw/2,dy=gy-dh;
  if(stage===0){const c='#8a5a30',sw=f1(3.4*sc);
   return '<g stroke="'+c+'" stroke-width="'+sw+'" stroke-linecap="round" fill="none"><path d="M'+f1(x)+' '+f1(gy)+'V'+f1(top)+'M'+f1(x+w)+' '+f1(gy)+'V'+f1(top)+'M'+f1(cx)+' '+f1(gy)+'V'+f1(peak)+'M'+f1(x+w*.25)+' '+f1(gy)+'V'+f1(top)+'M'+f1(x+w*.75)+' '+f1(gy)+'V'+f1(top)+'"/>'
    +'<path d="M'+f1(x-e)+' '+f1(top)+'H'+f1(x+w+e)+'M'+f1(x)+' '+f1(gy-h/2)+'H'+f1(x+w)+'"/><path d="'+roof.replace('Z','')+'"/><path d="M'+f1(x)+' '+f1(top)+'L'+f1(x+w*.25)+' '+f1(gy-h/2)+'M'+f1(x+w)+' '+f1(top)+'L'+f1(x+w*.75)+' '+f1(gy-h/2)+'"/></g>'
    +'<g stroke="#6b4a2a" stroke-width="'+f1(2*sc)+'"><path d="M'+f1(x+w+14*sc)+' '+f1(gy)+'L'+f1(x+w+2*sc)+' '+f1(top-6*sc)+'M'+f1(x+w+24*sc)+' '+f1(gy)+'L'+f1(x+w+12*sc)+' '+f1(top-6*sc)+'"/>'
    +[1,2,3,4,5].map(i=>'<path d="M'+f1(x+w+14*sc-i*2.2*sc)+' '+f1(gy-i*11*sc)+'h'+f1(10*sc)+'"/>').join('')+'</g>';}
  if(stage===1){
   return '<path d="'+roof+'" fill="#6f5a48"/><path d="M'+f1(cx)+' '+f1(peak)+'L'+f1(x+w-k)+' '+f1(top-sh)+'L'+f1(x+w+e)+' '+f1(top)+'H'+f1(cx)+'Z" fill="#c49a64" stroke="#8a5a30" stroke-width="'+f1(1.4*sc)+'"/>'
    +'<g stroke="#8a5a30" stroke-width="'+f1(1.6*sc)+'"><path d="M'+f1(cx+10*sc)+' '+f1(peak+6*sc)+'V'+f1(top)+'M'+f1(cx+24*sc)+' '+f1(top-sh+10*sc)+'V'+f1(top)+'M'+f1(cx+38*sc)+' '+f1(top-sh+2*sc)+'V'+f1(top)+'"/></g>'
    +'<rect x="'+f1(x)+'" y="'+f1(top)+'" width="'+f1(w)+'" height="'+f1(h)+'" fill="#c79a62"/>'
    +'<g stroke="#a67a45" stroke-width="'+f1(1.1*sc)+'">'+[1,2,3,4,5,6,7,8,9].map(i=>'<path d="M'+f1(x+i*w/10)+' '+f1(top)+'V'+f1(gy)+'"/>').join('')+'</g>'
    +'<rect x="'+f1(dx)+'" y="'+f1(dy)+'" width="'+f1(dw)+'" height="'+f1(dh)+'" fill="#5d3e22"/>';}
  const tr='#f3ead6';
  return '<path d="'+roof+'" fill="#5a3a2a"/><path d="'+roof+'" fill="none" stroke="'+tr+'" stroke-width="'+f1(2*sc)+'"/>'
   +'<rect x="'+f1(x)+'" y="'+f1(top)+'" width="'+f1(w)+'" height="'+f1(h)+'" fill="#b3372c"/>'
   +'<path d="M'+f1(x)+' '+f1(top)+'L'+f1(x+k)+' '+f1(top-sh)+'L'+f1(cx)+' '+f1(peak)+'L'+f1(x+w-k)+' '+f1(top-sh)+'L'+f1(x+w)+' '+f1(top)+'Z" fill="#a8322a"/>'
   +'<rect x="'+f1(cx-8*sc)+'" y="'+f1(top-22*sc)+'" width="'+f1(16*sc)+'" height="'+f1(14*sc)+'" fill="#3b2418" stroke="'+tr+'" stroke-width="'+f1(2*sc)+'"/>'
   +'<rect x="'+f1(dx)+'" y="'+f1(dy)+'" width="'+f1(dw)+'" height="'+f1(dh)+'" fill="#8f2a22" stroke="'+tr+'" stroke-width="'+f1(2.2*sc)+'"/>'
   +'<path d="M'+f1(dx)+' '+f1(dy)+'L'+f1(dx+dw)+' '+f1(gy)+'M'+f1(dx+dw)+' '+f1(dy)+'L'+f1(dx)+' '+f1(gy)+'M'+f1(cx)+' '+f1(dy)+'V'+f1(gy)+'" stroke="'+tr+'" stroke-width="'+f1(2*sc)+'"/>'
   +'<rect x="'+f1(x)+'" y="'+f1(top)+'" width="'+f1(w)+'" height="'+f1(h)+'" fill="none" stroke="'+tr+'" stroke-width="'+f1(2*sc)+'"/>'
   +'<path d="M'+f1(cx)+' '+f1(peak)+'V'+f1(peak-16*sc)+'M'+f1(cx-8*sc)+' '+f1(peak-12*sc)+'H'+f1(cx+8*sc)+'" stroke="#3b2a1a" stroke-width="'+f1(1.6*sc)+'"/><path d="M'+f1(cx+8*sc)+' '+f1(peak-12*sc)+'l-4 -3v6z" fill="#3b2a1a"/>';
 }
 const hay=(x,y,w,h)=>'<rect x="'+f1(x)+'" y="'+f1(y)+'" width="'+f1(w)+'" height="'+f1(h)+'" rx="'+f1(h*.2)+'" fill="#e2c164" stroke="#b99838" stroke-width="1.6"/>'
  +'<g stroke="#c7a345" stroke-width="1.2">'+[.2,.4,.6,.8].map(t=>'<path d="M'+f1(x+4)+' '+f1(y+h*t)+'H'+f1(x+w-4)+'"/>').join('')+'</g>'
  +'<path d="M'+f1(x+w*.28)+' '+f1(y)+'V'+f1(y+h)+'M'+f1(x+w*.72)+' '+f1(y)+'V'+f1(y+h)+'" stroke="#9a6a3a" stroke-width="2.4"/>';
 const bucket=(x,y,sc)=>'<g transform="translate('+f1(x)+' '+f1(y)+') scale('+sc+')"><path d="M-16-2a16 16 0 0 1 32 0" fill="none" stroke="#5f656e" stroke-width="2"/><path d="M-22 0h44l-5 40h-34z" fill="#8e96a3"/>'
  +'<ellipse cx="0" cy="0" rx="22" ry="5" fill="#6fa8d8" stroke="#6c7480" stroke-width="2"/><path d="M-21 9h42M-18 31h36" stroke="#6c7480" stroke-width="2.4"/></g>';
 /* a discipline's picture is the one on its entry ticket (se-events' scene); without se-events, a plain meadow */
 const scene=(d,sd)=>EV.scene?EV.scene(d,sd):land('sjy-fb-'+d,PAL.meadow,{});
 const A={};
 /* The story's grey mare and her foal. The card is tall on a desktop (the crop is x 45-345) and wide on a phone (y 128-398),
    and in both the pair stand clear of the corner where the percentage sits: up off the bottom edge on a desktop, over on
    the left half on a phone. A wooden fence rather than a white one, a shadow under each and dapples on the mare keep two
    pale horses from melting into the field and into each other; their legs do not cross. */
 A.story=(o)=>{
  const p=PAL[SPAL[o.season]||'meadow'], id='sjy-story', ph=!!o.phone;
  const M=ph?{x:174,y:262}:{x:206,y:262}, Fo=ph?{x:68,y:320}:{x:110,y:318};
  let s=land(id,p,{w:480,h:480,y1:196,y2:232,gy:270,seed:11,nTrees:8,sunX:318,sunY:96});
  s+='<circle cx="318" cy="96" r="74" fill="#fff8e2" opacity=".2"/><circle cx="318" cy="96" r="48" fill="#fff8e2" opacity=".26"/>';
  s+=barn(ph?336:84,238,.5,2)+fence(0,480,300,'#7c5a3a',26);
  const rr=rng(5); for(let i=0;i<34;i++){const x=rr()*480,y=318+rr()*150;s+='<circle cx="'+f1(x)+'" cy="'+f1(y)+'" r="'+f1(2+rr()*2.4)+'" fill="'+['#fff6e0',o.season==='ember'?'#f19a4a':'#f4a6c0','#fbe07a'][i%3]+'"/>';}
  s+='<ellipse cx="'+f1(M.x+4)+'" cy="'+f1(M.y+95)+'" rx="84" ry="8" fill="#2e2410" opacity=".24"/><ellipse cx="'+f1(Fo.x+3)+'" cy="'+f1(Fo.y+53)+'" rx="48" ry="5.5" fill="#2e2410" opacity=".24"/>';
  s+=horse('stand',M.x,M.y,2.0,{noRider:true,body:'#dad4cb',dark:'#8c8478',mane:'#f4f0ea'});
  s+='<g transform="translate('+M.x+' '+M.y+') scale(2)" fill="none" stroke="#b9b1a6" stroke-width=".8" opacity=".62">'
   +[[-27,-5,3.2],[-19,-8,2.8],[-20,1,2.6],[-10,-5,3],[-2,-8,2.4],[2,0,2.8],[11,-5,2.6],[-30,3,2.4],[-12,4,2.2]].map(c=>'<circle cx="'+c[0]+'" cy="'+c[1]+'" r="'+c[2]+'"/>').join('')+'</g>';
  s+=horse('stand',Fo.x,Fo.y,1.12,{noRider:true,body:'#f4f1ec',dark:'#b0a79a',mane:'#fbf8f3'});
  s+=spark(324,158,10)+spark(346,126,6)+spark(292,134,5)+(ph?spark(398,178,4):spark(340,196,4));   // on a phone the barn stands where the last one was
  return s;
 };
 A.daily=(o)=>{
  let s='<rect width="240" height="240" fill="#8a5a36"/>';
  for(let x=0;x<240;x+=30)s+='<path d="M'+x+' 0V240" stroke="#6e4527" stroke-width="2.2"/>';
  s+='<circle cx="46" cy="30" r="2.4" fill="#5c3a20"/><circle cx="196" cy="76" r="2.4" fill="#5c3a20"/>';
  s+='<rect y="192" width="240" height="48" fill="#caa35d"/><g stroke="#b08642" stroke-width="1.4">'+[10,40,70,110,150,190,220].map((x,i)=>'<path d="M'+x+' '+(200+i%3*10)+'l14 -4"/>').join('')+'</g>';
  s+='<path d="M110 16v9a10 10 0 0 0 20 0v-9" fill="none" stroke="#c3c7cf" stroke-width="5.5" stroke-linecap="round"/><circle cx="110.5" cy="22" r="1.2" fill="#666"/><circle cx="129.5" cy="22" r="1.2" fill="#666"/>';
  s+='<rect x="56" y="44" width="128" height="116" rx="5" fill="#7a5230"/><rect x="63" y="51" width="114" height="102" fill="#2f4a3a"/>';
  const r=rng(3);
  for(let i=0;i<6;i++){const y=62+i*15.5, on=i<(o.claimed||0);
   s+='<rect x="72" y="'+f1(y-5)+'" width="10" height="10" fill="none" stroke="#efe8d6" stroke-width="1.6"/>';
   if(on)s+='<path d="M73 '+f1(y)+'l3.5 3.5 7-8" fill="none" stroke="#f3e7a0" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
   s+='<path d="M90 '+f1(y)+'H'+f1(128+r()*40)+'" stroke="#d8d0bf" stroke-width="2.2" stroke-linecap="round" opacity="'+(on?'.45':'.85')+'"/>';}
  s+='<rect x="61" y="151" width="118" height="6" rx="2" fill="#5d3d22"/><rect x="86" y="148" width="12" height="4" rx="1" fill="#f4f0e4"/>';
  s+=hay(14,170,84,40)+hay(34,140,56,32)+bucket(190,178,1);
  return s;
 };
 A.side=(o)=>{
  let s=land('sjy-side',PAL.meadow,{seed:21,y1:104,y2:132,gy:170,sunX:190,sunY:44});
  s+='<path d="M150 240C130 214 176 196 150 176S110 150 128 138 160 124 176 116" fill="none" stroke="#f1e3b8" stroke-width="10" stroke-linecap="round"/>';
  s+='<path d="M150 240C130 214 176 196 150 176S110 150 128 138 160 124 176 116" fill="none" stroke="#caa56a" stroke-width="2" stroke-dasharray="5 6" stroke-linecap="round"/>';
  s+='<rect x="62" y="96" width="8" height="126" fill="#7a5433"/>';
  const boards=[[70,104,1,'#efe2c0'],[62,128,-1,'#e6cf9f'],[70,152,1,'#efe2c0']];
  for(const [x,y,d,c] of boards){const w=58;const pts=d>0?[[x,y],[x+w,y],[x+w+10,y+9],[x+w,y+18],[x,y+18]]:[[x,y],[x-w,y],[x-w-10,y+9],[x-w,y+18],[x,y+18]];
   s+='<path d="M'+pts.map(p=>f1(p[0])+' '+f1(p[1])).join('L')+'Z" fill="'+c+'" stroke="#7a5433" stroke-width="1.6"/>';
   s+='<path d="M'+f1(x+d*8)+' '+f1(y+7)+'h'+f1(d*34)+'M'+f1(x+d*8)+' '+f1(y+12)+'h'+f1(d*22)+'" stroke="#9a7a50" stroke-width="1.6" stroke-linecap="round"/>';}
  s+='<ellipse cx="66" cy="222" rx="18" ry="4" fill="#4f7f45" opacity=".6"/>';
  const cols=['#d9463a','#3f7fd6','#e6b53a'], n=Math.max(1,Math.min(3,o.active||1));
  [[176,110],[204,128],[126,96]].slice(0,n).forEach((p,i)=>{s+=pin(p[0],p[1],.9,cols[i]);});
  s+='<path d="M28 40l5 4 5-4M44 30l4 3 4-3" fill="none" stroke="#5b5b6b" stroke-width="1.6" stroke-linecap="round"/>';
  return s;
 };
 A.ranch=(o)=>{
  let s=land('sjy-ranch',PAL.gold,{seed:31,y1:110,y2:140,gy:180,sunX:196,sunY:46,nTrees:4});
  const st=o.level>=5?2:o.level>=3?1:0;
  s+=barn(128,188,1.05,st);
  s+=fence(0,52,196,'#f3ead6',16)+fence(206,240,196,'#f3ead6',16);
  s+='<g transform="translate(22 214)"><rect x="0" y="0" width="54" height="7" fill="#c9a06a" stroke="#8a6232"/><rect x="4" y="-7" width="50" height="7" fill="#d6ae76" stroke="#8a6232"/><rect x="-2" y="-14" width="48" height="7" fill="#c9a06a" stroke="#8a6232"/></g>';
  s+='<g transform="translate(196 222) rotate(-18)"><rect x="-3" y="-20" width="6" height="26" rx="2" fill="#8a5a30"/><rect x="-10" y="-26" width="20" height="8" rx="2" fill="#6c737e"/></g>';
  return s;
 };
 A.foal=(o)=>{
  let s=land('sjy-foal',PAL.meadow,{seed:41,y1:108,y2:134,gy:170,sunX:52,sunY:42,nTrees:4});
  s+=fence(0,240,176,'#f3ead6',30);
  s+=horse('stand',82,160,.95,o.mare||{noRider:true,body:'#8b4f2b',dark:'#5d3219',mane:'#33200f'});
  s+=horse('stand',170,178,.62,o.foalCoat||{noRider:true,body:'#b7793f',dark:'#8a5528',mane:'#5a3515'},true);
  s+=heart(128,96,1.2,'#e0567a');
  return s;
 };
 A.welcome=(o)=>{
  let s=land('sjy-welc',PAL.lilac,{seed:51,y1:150,y2:172,gy:196,sunX:196,sunY:56,trees:false});
  s+='<path d="M0 28Q120 70 240 28" fill="none" stroke="#6b4a2a" stroke-width="1.6"/>';
  const cols=['#e0567a','#f2b01e','#4f9bd9','#5fb86a'];
  for(let i=0;i<7;i++){const t=(i+.5)/7,x=240*t,y=28+84*t*(1-t);const on=i<(o.claimed||0);
   s+='<path d="M'+f1(x-9)+' '+f1(y)+'L'+f1(x+9)+' '+f1(y)+'L'+f1(x)+' '+f1(y+20)+'Z" fill="'+(on?cols[i%4]:'#d9d2e6')+'" stroke="'+(on?'#00000022':'#b9b0c9')+'"/>';}
  s+='<ellipse cx="120" cy="206" rx="64" ry="9" fill="#5e7f4c" opacity=".35"/>';
  s+='<rect x="70" y="124" width="100" height="78" rx="3" fill="#5a3fa6"/><rect x="64" y="108" width="112" height="22" rx="3" fill="#6d51bd"/>';
  s+='<rect x="112" y="108" width="16" height="94" fill="#f2c84b"/><rect x="70" y="150" width="100" height="14" fill="#f2c84b"/>';
  s+='<path d="M120 108c-18-22-40-10-26 0zM120 108c18-22 40-10 26 0z" fill="#f2c84b" stroke="#c9981e" stroke-width="1.6"/><circle cx="120" cy="107" r="6" fill="#e3b22f"/>';
  s+=spark(52,96,7)+spark(190,92,6)+spark(180,150,4);
  return s;
 };
 A.season=(o)=>{
  let s='<rect width="240" height="240" fill="#6a4a2e"/><g stroke="#5a3d24" stroke-width="2">'+[30,70,120,170,210].map(y=>'<path d="M0 '+y+'Q120 '+(y+8)+' 240 '+y+'"/>').join('')+'</g>';
  s+='<ellipse cx="206" cy="68" rx="46" ry="46" fill="#ffd98a" opacity=".16"/>';
  s+='<path d="M120 84C98 72 58 70 26 76V196C58 190 98 192 120 204Z" fill="#f4ead0" stroke="#b79d6b" stroke-width="1.6"/>';
  s+='<path d="M120 84C142 72 182 70 214 76V196C182 190 142 192 120 204Z" fill="#fbf3de" stroke="#b79d6b" stroke-width="1.6"/>';
  s+='<path d="M120 84V204" stroke="#c9b07e" stroke-width="2"/>';
  s+='<g stroke="#b9a780" stroke-width="2" stroke-linecap="round">'+[102,116,130,144,158,172].map(y=>'<path d="M40 '+y+'Q72 '+(y-4)+' 106 '+(y+2)+'"/>').join('')+'</g>';
  const cx=167,cy=138,k=o.season;
  if(k==='sun'){s+='<g stroke="#e9a927" stroke-width="3" stroke-linecap="round">';for(let i=0;i<8;i++){const a=i/8*Math.PI*2;s+='<path d="M'+f1(cx+Math.cos(a)*21)+' '+f1(cy+Math.sin(a)*21)+'L'+f1(cx+Math.cos(a)*29)+' '+f1(cy+Math.sin(a)*29)+'"/>';}s+='</g><circle cx="'+cx+'" cy="'+cy+'" r="15" fill="#f2c040"/>';}
  else if(k==='frost'){s+='<g stroke="#5b8fc9" stroke-width="3" stroke-linecap="round">';for(let i=0;i<6;i++){const a=i/6*Math.PI*2;s+='<path d="M'+cx+' '+cy+'L'+f1(cx+Math.cos(a)*26)+' '+f1(cy+Math.sin(a)*26)+'"/>';}s+='</g>';}
  else if(k==='ember'){s+='<path d="M'+cx+' '+(cy-26)+'C'+(cx+24)+' '+(cy-12)+' '+(cx+18)+' '+(cy+16)+' '+cx+' '+(cy+24)+'C'+(cx-18)+' '+(cy+16)+' '+(cx-24)+' '+(cy-12)+' '+cx+' '+(cy-26)+'Z" fill="#e0782f"/><path d="M'+cx+' '+(cy-20)+'V'+(cy+28)+'" stroke="#8a3f14" stroke-width="2"/>';}
  else{for(let i=0;i<5;i++){const a=i/5*Math.PI*2-Math.PI/2;s+='<circle cx="'+f1(cx+Math.cos(a)*12)+'" cy="'+f1(cy+Math.sin(a)*12)+'" r="10" fill="#f19ab7"/>';}s+='<circle cx="'+cx+'" cy="'+cy+'" r="7" fill="#f2c84b"/>';}
  s+='<rect x="196" y="30" width="16" height="44" rx="2" fill="#efe4c6"/><path d="M204 12c6 8 6 12 0 16-6-4-6-8 0-16z" fill="#ffb53a"/><path d="M204 18c3 4 3 6 0 8-3-2-3-4 0-8z" fill="#fff0b0"/>';
  s+='<path d="M30 60L66 20" stroke="#efe8dc" stroke-width="6" stroke-linecap="round"/><path d="M36 54L60 28" stroke="#cfc6b6" stroke-width="1.4"/><rect x="14" y="54" width="22" height="18" rx="4" fill="#2b2238"/>';
  return s;
 };
 function item(kind,x,y,sc){
  const g='<g transform="translate('+f1(x)+' '+f1(y)+') scale('+sc+')">';
  if(kind==='honey')return g+'<rect x="-10" y="-12" width="20" height="22" rx="6" fill="#e8a524" stroke="#a86a10" stroke-width="1.4"/><rect x="-11" y="-16" width="22" height="6" rx="2" fill="#7a5433"/><rect x="-6" y="-4" width="12" height="7" rx="1" fill="#fbf0d0"/></g>';
  if(kind==='lantern')return g+'<path d="M0-14C12-14 14 0 12 6S4 14 0 14-10 12-12 6-12-14 0-14z" fill="#e2562f" stroke="#9a2f16" stroke-width="1.4"/><path d="M-6-12V12M6-12V12" stroke="#f7a65a" stroke-width="1.2"/><rect x="-4" y="-18" width="8" height="4" fill="#3b2a1a"/></g>';
  if(kind==='frostbell')return g+'<path d="M-11 8C-11-4-8-12 0-12S11-4 11 8h3v3h-28v-3z" fill="#e6b53a" stroke="#9a6a10" stroke-width="1.4"/><circle cx="0" cy="13" r="3" fill="#9a6a10"/><path d="M-6-6C-4-9-2-10 0-10" stroke="#fff3c4" stroke-width="1.6" fill="none"/></g>';
  return g+'<ellipse cx="0" cy="0" rx="10" ry="13" fill="#f4c3d6" stroke="#b56a89" stroke-width="1.4"/><path d="M-9 2l4-4 4 4 4-4 4 4 2-2" fill="none" stroke="#6fa8d8" stroke-width="2"/></g>';
 }
 A.hunts=(o)=>{
  let s=land('sjy-hunt',PAL[SPAL[o.season]||'meadow'],{seed:61,y1:98,y2:124,gy:158,sunX:44,sunY:40,nTrees:6});
  const k=o.kind||'egg';
  s+='<path d="M20 232C60 206 44 186 90 176S170 170 200 150" fill="none" stroke="#fff6dc" stroke-width="2.2" stroke-dasharray="3 6" stroke-linecap="round"/>';
  s+=item(k,198,150,1)+item(k,44,196,.9);
  s+='<g transform="translate(128 198)"><path d="M-40-18h80l-8 38h-64z" fill="#b0773a"/><g stroke="#8a5a2a" stroke-width="1.6">'+[-30,-18,-6,6,18,30].map(x=>'<path d="M'+x+' -18L'+f1(x*.82)+' 20"/>').join('')+'<path d="M-38-8h76M-36 4h72"/></g>'
   +'<path d="M-34-18C-30-52 30-52 34-18" fill="none" stroke="#8a5a2a" stroke-width="4"/><ellipse cx="0" cy="-18" rx="41" ry="6" fill="#c48a48" stroke="#8a5a2a" stroke-width="1.6"/></g>';
  s+=item(k,112,176,.9)+item(k,140,174,.95);
  s+='<g fill="#4f7f45">'+[30,70,160,210].map(x=>'<path d="M'+x+' 234l4-12 3 12 4-10 3 10z"/>').join('')+'</g>';
  return s;
 };
 A.ach=()=>{
  let s='<rect width="240" height="240" fill="#3d2c52"/><g opacity=".12" stroke="#fff">'+[40,80,120,160,200].map(x=>'<path d="M'+x+' 0V240"/>').join('')+'</g>';
  s+='<rect x="20" y="182" width="200" height="12" rx="2" fill="#8a5a30"/><rect x="20" y="194" width="200" height="6" fill="#5d3d22"/>';
  s+='<defs><linearGradient id="sjy-achg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffe9a0"/><stop offset=".5" stop-color="#f0c040"/><stop offset="1" stop-color="#b8831d"/></linearGradient></defs>';
  s+='<path d="M92 70h56v30a28 28 0 0 1-56 0z" fill="url(#sjy-achg)" stroke="#8a5e12" stroke-width="2"/><path d="M92 78H78a12 12 0 0 0 14 20M148 78h14a12 12 0 0 1-14 20" fill="none" stroke="#c8962a" stroke-width="5"/>';
  s+='<path d="M114 128h12v24h-12z" fill="#d7a633"/><path d="M100 150h40l5 14H95z" fill="url(#sjy-achg)" stroke="#8a5e12" stroke-width="1.6"/><path d="M90 164h60v18H90z" fill="#6b3f1f"/>';
  s+='<path d="M104 86a12 12 0 0 0 5 22" fill="none" stroke="#fff6cf" stroke-width="3.5" stroke-linecap="round" opacity=".8"/>';
  s+=rosette(24,40,1.1,'#3f7fd6','#2a5aa0')+rosette(174,40,1.1,'#d63f3f','#a02a2a')+rosette(40,120,.8,'#3fae5a','#2a7d40')+rosette(170,122,.8,'#e6b53a','#b8831d');
  s+='<g fill="#fff6d0" opacity=".85"><path d="'+starPath(120,40,8,3.2)+'"/><path d="'+starPath(84,24,4,1.6)+'"/><path d="'+starPath(158,24,4,1.6)+'"/></g>';
  return s;
 };
 A.coll=()=>{
  let s='<rect width="240" height="240" fill="#e6d7b8"/><rect x="28" y="30" width="184" height="178" rx="6" fill="#7a5433"/><rect x="36" y="38" width="168" height="162" fill="#c9b48e"/>';
  s+='<path d="M92 38V200M148 38V200M36 119H204" stroke="#7a5433" stroke-width="6"/>';
  s+='<g transform="translate(64 84)"><path d="M-8-20h16v10c8 4 10 10 10 16v20h-36V6c0-6 2-12 10-16z" fill="#8fcfb4" opacity=".85" stroke="#4f8f74" stroke-width="1.4"/><rect x="-6" y="-26" width="12" height="7" fill="#9a6a3a"/><rect x="-10" y="2" width="20" height="10" rx="2" fill="#f4ead0" transform="rotate(-12)"/></g>';
  s+='<g transform="translate(120 88)"><path d="M0 18L-22-6A26 26 0 0 1 22-6Z" fill="#f0c8b0" stroke="#c08a6a" stroke-width="1.4"/><path d="M0 18L-12-12M0 18L0-14M0 18L12-12" stroke="#c08a6a" stroke-width="1.4"/></g>';
  s+='<g transform="translate(176 86) rotate(24)"><path d="M0-26C10-14 10 10 0 26C-10 10-10-14 0-26z" fill="#b7c7e0" stroke="#6f86ad" stroke-width="1.4"/><path d="M0-24V30" stroke="#6f86ad" stroke-width="1.6"/></g>';
  s+='<g transform="translate(64 162)"><path d="M0-24L14-8 8 20H-8L-14-8Z" fill="#a98ad8" stroke="#6a4aa0" stroke-width="1.4"/><path d="M0-24V20M-14-8H14" stroke="#e6dafc" stroke-width="1.2"/></g>';
  s+=item('honey',120,164,1.3);
  s+='<g transform="translate(176 162)"><circle r="18" fill="#e6b53a" stroke="#9a6a10" stroke-width="1.6"/><path d="'+starPath(0,0,11,4.6)+'" fill="#fff3c4"/></g>';
  s+='<rect x="36" y="38" width="168" height="162" fill="#fff" opacity=".08"/><path d="M40 44L90 116" stroke="#fff" stroke-width="3" opacity=".25"/>';
  return s;
 };
 A.vistalog=(o)=>{
  const p=PAL[o.season==='frost'?'frost':'meadow'];
  let s='<defs><linearGradient id="sjy-vis" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+p[0]+'"/><stop offset="1" stop-color="'+p[1]+'"/></linearGradient></defs><rect width="240" height="240" fill="url(#sjy-vis)"/>';
  s+='<path d="M-10 170L60 70 110 150 150 90 250 190V240H-10Z" fill="#8a9bb3"/><path d="M60 70L44 93 56 90 66 98 76 92Z" fill="#fff"/><path d="M150 90L134 114 148 108 160 118 170 112Z" fill="#fff"/>';
  s+='<path d="M-10 190Q60 150 120 176T250 170V240H-10Z" fill="'+p[3]+'"/><path d="M-10 214Q120 196 250 212V240H-10Z" fill="'+p[4]+'"/>';
  s+='<path d="M30 236C70 214 120 206 108 186S130 150 150 128 148 104 150 92" fill="none" stroke="#fff6dc" stroke-width="2.4" stroke-dasharray="4 5" stroke-linecap="round"/>';
  s+='<path d="M150 92V62" stroke="#3b2a1a" stroke-width="2.2"/><path d="M151 62l22 7-22 7z" fill="#d9463a"/>';
  s+='<g transform="translate(206 210)"><circle r="18" fill="#f4ead0" stroke="#7a5433" stroke-width="2"/><path d="M0-14L4 0 0 14-4 0Z" fill="#d9463a"/><path d="M0 14L4 0-4 0Z" fill="#3b2a1a"/></g>';
  return s;
 };
 A.mastery=(o)=>{
  let s='<rect width="240" height="240" fill="#bfe0f0"/><rect y="118" width="240" height="122" fill="#d8c095"/>'+fence(0,240,124,'#f3ead6',26);
  s+='<path d="M50 192h140l10 22H40z" fill="#4a3d7a"/><path d="M40 214h160v14H40z" fill="#342a5c"/><path d="M50 192h140" stroke="#d9b45e" stroke-width="3"/>';
  s+=horse('stand',120,150,.95,o.coat);
  const n=Math.max(0,Math.min(5,Math.round((o.best||0)*5)));
  for(let i=0;i<5;i++){const x=72+i*24;s+='<path d="'+starPath(x,44,10,4.4)+'" fill="'+(i<n?'#f2c040':'#ffffff55')+'" stroke="'+(i<n?'#9a6a10':'#ffffffaa')+'" stroke-width="1.4"/>';}
  return s;
 };
 A.coop=()=>{
  let s=land('sjy-coop',PAL.meadow,{seed:71,y1:112,y2:140,gy:176,sunX:200,sunY:70,nTrees:5});
  s+='<path d="M0 22Q120 56 240 22" fill="none" stroke="#6b4a2a" stroke-width="1.4"/>';
  const cols=['#d9463a','#f2b01e','#3f7fd6','#5fb86a','#b05fd0'];
  for(let i=0;i<9;i++){const t=(i+.5)/9,x=240*t,y=22+34*4*t*(1-t)*.5;s+='<path d="M'+f1(x-8)+' '+f1(y)+'L'+f1(x+8)+' '+f1(y)+'L'+f1(x)+' '+f1(y+16)+'Z" fill="'+cols[i%5]+'"/>';}
  s+='<path d="M20 200L120 184 220 200 200 236H40Z" fill="#f3ead6"/><g fill="#d9463a" opacity=".75">'+[0,1,2,3,4].map(i=>'<path d="M'+(40+i*34)+' 196l14-2 4 36h-14z"/>').join('')+'</g>';
  s+='<g transform="translate(78 194)"><path d="M-30-12h60l-6 28h-48z" fill="#b0773a"/><path d="M-26-12C-22-38 22-38 26-12" fill="none" stroke="#8a5a2a" stroke-width="3.4"/>'
   +[[-16,-16],[-4,-19],[8,-16],[20,-14],[-10,-24],[2,-26]].map(p=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r="7" fill="#d93a33" stroke="#9a1f1a" stroke-width="1"/>').join('')+'</g>';
  s+='<g transform="translate(166 196)"><rect x="-28" y="-12" width="56" height="28" fill="#c9a06a" stroke="#8a6232" stroke-width="1.6"/><path d="M-28 0h56" stroke="#8a6232" stroke-width="1.4"/>'
   +[-18,-6,6,18].map(x=>'<path d="M'+x+' -12l-4 -20 8 0z" fill="#f08a2a"/><path d="M'+x+' -32l-4 -8M'+x+' -32l4 -8" stroke="#4f9a3a" stroke-width="2.4" stroke-linecap="round"/>').join('')+'</g>';
  return s;
 };
 A.lantern=()=>{
  let s=land('sjy-lant',PAL.dusk,{seed:81,y1:120,y2:146,gy:184,sunX:120,sunY:120,nTrees:4});
  s+='<path d="M0 40Q120 90 240 40" fill="none" stroke="#3b2a1a" stroke-width="1.4"/>';
  for(let i=0;i<6;i++){const t=(i+.5)/6,x=240*t,y=40+50*4*t*(1-t)*.5;s+=item('lantern',x,y+16,.9);}
  s+='<path d="M70 196L120 140 170 196Z" fill="#f3ead6"/><path d="M120 140V196" stroke="#d9463a" stroke-width="4"/><path d="M100 196L120 162 140 196Z" fill="#3b2a1a" opacity=".5"/>';
  return s;
 };

 /* ================================================================ the cards =============
    kind: 'tab' opens the quest list on that tab; 'disc' a discipline's next event; others below. */
 const DISC_T={jump:'Show Jumping',xc:'Cross Country',race:'Racing',dressage:'Dressage',show:'Showmanship'};
 const CARD={
  story:{t:'Main Story',tab:'story',big:true},
  jump:{t:'Show Jumping',disc:'jump'}, xc:{t:'Cross Country',disc:'xc'}, race:{t:'Racing',disc:'race'}, dressage:{t:'Dressage',disc:'dressage'}, show:{t:'Showmanship',disc:'show'},
  daily:{t:'Repeatable Quests',tab:'daily'}, side:{t:'Side Stories',tab:'side'}, ranch:{t:'Ranch Builder'},
  foal:{t:'Foal\'s First Steps',tab:'foal'}, welcome:{t:'Welcome Week',tab:'welcome'}, special:{t:''},
  season:{t:'Wick\'s Almanac',tab:'season'}, hunts:{t:'Season Hunt',tab:'hunts'}, ach:{t:'Achievements',tab:'ach'},
  coll:{t:'Collection',tab:'coll'}, vistalog:{t:'Horizons',tab:'vistalog'}, mastery:{t:'Breed Mastery',tab:'mastery'}, coop:{t:'Club Co-op',tab:'coop'}
 };
 function figures(s){
  const o={}, run=(k,f)=>{try{o[k]=f();}catch(e){o[k]={pct:null,sub:'',status:'',err:String(e&&e.message||e)};}};
  run('story',()=>F.story(s)); for(const k of ['jump','xc','dressage','show'])run(k,()=>F.disc(s,k)); run('race',()=>F.race(s));
  for(const k of ['daily','side','ranch','foal','season','hunts','ach','coll','vistalog','mastery','coop','special'])run(k,()=>F[k](s));
  if(welcomeOn(s))run('welcome',()=>F.welcome(s));
  return o;
 }
 function order(s,fg){
  const FS=G.breeding.FOAL_STORY||[], foalOn=!!(s.foalq&&FS[s.foalq.idx]), wel=!!fg.welcome;
  const feat=foalOn?'foal':wel?'welcome':'special';
  const L=['story','jump','daily','xc','side','ranch',feat];
  if(wel&&feat!=='welcome')L.push('welcome');
  L.push('race','season','dressage','hunts');
  if(feat!=='special')L.push('special');
  L.push('show','ach','coll','vistalog','mastery','coop');
  if(feat!=='foal')L.push('foal');
  return {list:L,feat};
 }
 function artFor(id,f,s){
  const season=sid();
  switch(id){
   case 'story':{const ph=phone();return {k:'story:'+season+(ph?':p':''),svg:A.story({season,phone:ph})};}
   case 'jump':case 'xc':case 'race':case 'dressage':case 'show':return {k:id,svg:scene(id,hash('sjy-'+id))};
   case 'daily':return {k:'daily:'+(f.x||0),svg:A.daily({claimed:f.x||0})};
   case 'side':return {k:'side:'+Math.min(3,f.active||0),svg:A.side({active:f.active||0})};
   case 'ranch':{const st=f.level>=5?2:f.level>=3?1:0;return {k:'ranch:'+st,svg:A.ranch({level:f.level||1})};}
   case 'foal':{const c=f.foal?coatOf(f.foal):null;return {k:'foal:'+(c?c.body+c.mane:''),svg:A.foal({foalCoat:c})};}
   case 'welcome':return {k:'welcome:'+(f.x||0),svg:A.welcome({claimed:f.x||0})};
   case 'season':return {k:'season:'+season,svg:A.season({season})};
   case 'hunts':return {k:'hunts:'+f.kind+season,svg:A.hunts({kind:f.kind,season})};
   case 'ach':return {k:'ach',svg:A.ach()};
   case 'coll':return {k:'coll',svg:A.coll()};
   case 'vistalog':return {k:'vista:'+season,svg:A.vistalog({season})};
   case 'mastery':{const h=(G.horse.ridden&&G.horse.ridden())||{};const c=coatOf(h);const n=Math.round((f.best||0)*5);return {k:'mastery:'+c.body+c.mane+n,svg:A.mastery({coat:c,best:f.best})};}
   case 'coop':return {k:'coop',svg:A.coop()};
   case 'special':{const i=f.id||'';
    if(i==='sun-roundup')return {k:'sp:'+i,svg:scene('roundup',hash('sjy-roundup'))};
    if(i==='frost-trials')return {k:'sp:'+i,svg:scene('gauntlet',hash('sjy-gauntlet'))};
    if(i==='ember-festival')return {k:'sp:'+i,svg:A.lantern()};
    return {k:'sp:'+i,svg:A.foal({})};}
  }
  return {k:'none',svg:''};
 }

 /* ================================================================ the look ==============*/
 if(!$('seJyCss')){
  const st=document.createElement('style'); st.id='seJyCss';
  st.textContent=`
#seJy{--sjy-vh:100vh;--sjy-top:clamp(50px,8.5vh,64px);--sjy-pt:clamp(12px,2.6vh,26px);--sjy-pb:clamp(34px,5.6vh,50px);--sjy-gap:clamp(10px,2.2vh,20px);
 --sjy-r:calc((var(--sjy-vh) - var(--sjy-top) - var(--sjy-pt) - var(--sjy-pb) - var(--sjy-gap)) / 2);
 --sjy-w:min(calc(var(--sjy-r) * .8),calc((100vw - 36px - 3 * var(--sjy-gap)) / 4.55));--sjy-mw:calc(var(--sjy-w) * 1.55);--sjy-plate:clamp(38px,9vh,76px);
 position:fixed;inset:0;z-index:10;display:none;font-family:Nunito,system-ui,sans-serif;color:#fff;overflow:clip;user-select:none;-webkit-user-select:none}
@supports (height:100dvh){#seJy{--sjy-vh:100dvh}}
#seJy.on{display:block}
#seJy .sjy-dim{position:absolute;inset:0;background:rgba(18,18,26,.34);backdrop-filter:blur(2.5px) saturate(.55) brightness(.8);-webkit-backdrop-filter:blur(2.5px) saturate(.55) brightness(.8)}
#seJy .se-strip{position:absolute}
#seJy .sjy-rail{position:absolute;left:0;right:0;top:var(--sjy-top);bottom:var(--sjy-pb);display:grid;grid-auto-flow:column;grid-template-rows:repeat(2,var(--sjy-r));
 grid-template-columns:var(--sjy-mw);grid-auto-columns:var(--sjy-w);gap:var(--sjy-gap);align-content:start;
 padding:var(--sjy-pt) max(18px,env(safe-area-inset-right)) 0 max(18px,env(safe-area-inset-left));overflow-x:auto;overflow-y:hidden;scrollbar-width:none;overscroll-behavior-x:contain}
#seJy .sjy-rail::-webkit-scrollbar{display:none}
#seJy .sjy-card{position:relative;display:flex;flex-direction:column;min-width:0;min-height:0;height:100%;box-sizing:border-box;margin:0;padding:0;border:3px solid #d9d6e4;border-radius:9px;
 background:#2c2356;box-shadow:0 6px 16px rgba(0,0,0,.45);cursor:pointer;text-align:center;color:#fff;font:inherit;transition:transform .15s,filter .15s}
#seJy .sjy-card.big{grid-row:1 / span 2}
@media (hover:hover){#seJy .sjy-card:hover{transform:translateY(-2px);filter:brightness(1.06)}}
#seJy .sjy-card:active{transform:translateY(1px)}
#seJy .sjy-card:focus-visible{outline:3px solid #ffd970;outline-offset:3px}
#seJy .sjy-pic{position:relative;display:block;flex:1 1 auto;min-height:0;overflow:hidden;border-radius:6px 6px 0 0;background:#6b5a86}
#seJy .sjy-pic>svg{position:absolute;inset:0;width:100%;height:100%;display:block}
#seJy .sjy-ov{position:absolute;inset:0;display:block;pointer-events:none}
#seJy .sjy-bar{position:absolute;left:0;right:0;bottom:0;z-index:1;display:block;height:clamp(18px,3.4vh,30px);background:rgba(24,20,44,.55);border-top:1px solid rgba(255,255,255,.35)}
#seJy .sjy-bar>i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(180deg,#ffd955,#eaa81c);box-shadow:inset 0 -2px 0 rgba(140,80,0,.35)}
#seJy .sjy-bar>b{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:1px 9px;border-radius:9px;background:rgba(20,16,36,.8);font:900 clamp(11px,2vh,16px)/1.15 Nunito,system-ui,sans-serif;color:#fff;font-variant-numeric:tabular-nums;white-space:nowrap}
#seJy .sjy-plate{flex:none;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:1px;height:var(--sjy-plate);box-sizing:border-box;padding:0 8px;min-width:0;border-radius:0 0 6px 6px;
 background:linear-gradient(180deg,#46397f,#2c2356);box-shadow:inset 0 1px 0 rgba(255,255,255,.2)}
#seJy .sjy-t{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;max-width:100%;font:800 clamp(12.5px,2.4vh,22px)/1.06 var(--sef-serif);letter-spacing:.3px;text-transform:uppercase;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5);overflow:hidden;text-wrap:balance}
#seJy .sjy-t.long{font-size:clamp(11px,2vh,17px)}
#seJy .sjy-s{display:block;max-width:100%;font:800 clamp(10.5px,1.7vh,15px)/1.25 Nunito,system-ui,sans-serif;color:#eadfbf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#seJy .sjy-s.two{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal;line-height:1.2;text-overflow:clip;text-wrap:balance}   /* a line too long for one, where the plate has room for two (fit() decides) */
#seJy .sjy-pip{position:absolute;top:-9px;right:-9px;z-index:4;min-width:24px;height:24px;box-sizing:border-box;padding:0 6px;border-radius:12px;background:#c9302a;border:2px solid #fff;color:#fff;font:900 12.5px/20px Nunito,system-ui,sans-serif;text-align:center;box-shadow:0 2px 4px rgba(0,0,0,.4)}
#seJy .sjy-new{position:absolute;top:clamp(20px,3.6vh,30px);right:-6px;z-index:3;padding:5px 10px 5px 15px;background:linear-gradient(180deg,#ffd34d,#f2b01e);color:#3b2600;font:900 clamp(11px,1.9vh,15px)/1 var(--sef-serif);letter-spacing:.5px;text-transform:uppercase;
 clip-path:polygon(9px 0,100% 0,100% 100%,9px 100%,0 50%);filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))}
#seJy .sjy-ban{position:absolute;left:-7px;right:-7px;top:-13px;z-index:3;display:block;padding:5px 6px 6px;text-align:center;background:linear-gradient(180deg,#be3a30,#8f2019);font:800 clamp(10.5px,1.8vh,14px)/1 var(--sef-serif);
 color:#fff;text-transform:uppercase;letter-spacing:.4px;box-shadow:0 2px 3px rgba(0,0,0,.4);text-shadow:0 1px 0 rgba(0,0,0,.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#seJy .sjy-card.lock .sjy-pic>svg{filter:grayscale(.6) brightness(.8)}
#seJy .sjy-lockv{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:10%;background:rgba(20,18,30,.62);font:800 clamp(11px,1.8vh,14px)/1.3 Nunito,system-ui,sans-serif;color:#f1ecff;text-wrap:balance}
#seJy .sjy-lockv svg{width:clamp(24px,4.4vh,36px);height:clamp(24px,4.4vh,36px)}
#seJy .sjy-card.big .sjy-plate{height:calc(var(--sjy-plate) * 1.35)}
#seJy .sjy-card.big .sjy-t{font-size:clamp(17px,3.6vh,32px)}
#seJy .sjy-card.big .sjy-s{font:700 clamp(12px,2.2vh,19px)/1.2 var(--sef-serif)}
#seJy .sjy-big{position:absolute;left:0;right:0;bottom:0;z-index:1;display:flex;flex-direction:column;align-items:flex-end;padding:22% 8% 6%;text-align:right;pointer-events:none;background:radial-gradient(90% 80% at 100% 100%,rgba(14,10,26,.84),rgba(14,10,26,.74) 45%,rgba(14,10,26,0) 80%)}
#seJy .sjy-big>b{font:900 clamp(34px,8vh,72px)/1 var(--sef-serif);color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.55)}
#seJy .sjy-big>small{font:700 clamp(14px,3vh,28px)/1.15 var(--sef-serif);color:#f4ecd6;text-shadow:0 1px 3px rgba(0,0,0,.6)}
#seJy .sjy-big>em{margin-top:4px;font:800 normal clamp(11px,1.8vh,14px)/1.2 Nunito,system-ui,sans-serif;color:#ece6fa}
#seJy .sjy-orn{position:absolute;inset:4.5%;z-index:1;border:1.5px solid rgba(255,248,225,.6);border-radius:3px;pointer-events:none}
#seJy .sjy-orn>i{position:absolute;width:14px;height:14px;border:1.5px solid rgba(255,248,225,.75);transform:rotate(45deg);background:rgba(255,248,225,.25)}
#seJy .sjy-orn>i:nth-child(1){left:-8px;top:-8px}#seJy .sjy-orn>i:nth-child(2){right:-8px;top:-8px}#seJy .sjy-orn>i:nth-child(3){left:-8px;bottom:-8px}#seJy .sjy-orn>i:nth-child(4){right:-8px;bottom:-8px}
#seJy .sjy-ready{position:absolute;left:8%;top:6%;z-index:3;display:flex;align-items:center;gap:6px;max-width:80%;padding:6px 12px;border-radius:8px;background:linear-gradient(180deg,var(--sef-gold1),var(--sef-gold2));color:#3a2a10;
 font:900 clamp(11px,1.8vh,14px)/1.15 Nunito,system-ui,sans-serif;box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 2px 5px rgba(0,0,0,.35);text-align:left}
#seJy .sjy-ready svg{width:18px;height:18px;flex:none}
#seJy .sjy-foot{position:absolute;left:max(18px,env(safe-area-inset-left));right:max(18px,env(safe-area-inset-right));bottom:0;height:var(--sjy-pb);display:flex;align-items:center;gap:16px}
#seJy .sjy-track{position:relative;flex:1;height:clamp(8px,1.3vh,12px);border-radius:6px;background:rgba(18,14,40,.62);box-shadow:inset 0 1px 2px rgba(0,0,0,.5);cursor:pointer;touch-action:none}
#seJy .sjy-track>i{position:absolute;top:0;bottom:0;left:0;border-radius:6px;background:linear-gradient(180deg,#7a64d0,#4a3a94);box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
#seJy .sjy-track.none{visibility:hidden}
#seJy .sjy-all{flex:none;display:inline-flex!important;align-items:center;gap:8px;padding:7px 14px!important;font-size:clamp(11px,1.8vh,13.5px)!important}
#seJy .sjy-all svg{width:18px;height:18px}
/* while the row runs on past the right edge, the column cut by the edge fades out into it (its width is measured in paintTrack) */
#seJy .sjy-rail.more{-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - var(--sjy-fade,0px)),rgba(0,0,0,.1) 100%);mask-image:linear-gradient(90deg,#000 calc(100% - var(--sjy-fade,0px)),rgba(0,0,0,.1) 100%)}
/* a message while the hub is up: in the strip between the title and the wallet (toastLane measures the room), else on the foot row; never on a name plate */
html body.se-screen-open.sjy-open #toasts{top:auto!important;bottom:calc(3px + env(safe-area-inset-bottom))!important}
html body.se-screen-open.sjy-open.sjy-lane #toasts{top:var(--sjy-tt,6px)!important;bottom:auto!important;left:var(--sjy-tl,50%)!important;right:auto!important;width:var(--sjy-tw,420px)!important;transform:none!important;align-items:center!important}
@media (max-height:500px) and (min-width:761px){
 #seJy .sjy-card:not(.big) .sjy-s{display:none}
 #seJy .sjy-card:not(.big) .sjy-t{font-size:clamp(11px,calc(var(--sjy-w) * .095),12px);letter-spacing:-.3px}
 #seJy .sjy-card.big .sjy-s{font-size:10.5px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal;line-height:1.15;text-overflow:clip;text-wrap:balance}
 #seJy .sjy-plate{padding:0 3px}
 #seJy .sjy-big>em{display:none}
 #seJy .sjy-new{padding:3px 7px 3px 12px}
 #seJy .sjy-ban-l{display:none}
 #seJy .sjy-ban{left:-2px;right:-2px;letter-spacing:0}
 #seJy .sjy-pip{right:-6px;top:-7px}}
@media (max-width:760px){
 #seJy{--sjy-pw:calc((100vw - 44px) / 2);--sjy-ph:calc(var(--sjy-pw) * .92);--sjy-bh:calc((100vw - 32px) * .5625)}
 #seJy .sjy-rail{bottom:calc(58px + env(safe-area-inset-bottom));grid-auto-flow:row;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:calc(var(--sjy-bh) + 70px);grid-auto-rows:calc(var(--sjy-ph) + 72px);grid-auto-columns:auto;gap:18px 12px;
  padding:18px 16px 18px;overflow-x:hidden;overflow-y:auto;overscroll-behavior-y:contain}
 #seJy .sjy-card{height:100%}
 #seJy .sjy-card.big{grid-column:1 / -1;grid-row:auto}
 #seJy .sjy-pic{flex:1 1 auto}
 #seJy .sjy-plate{height:66px;padding:4px 8px}
 #seJy .sjy-card.big .sjy-plate{height:64px}
 #seJy .sjy-t{font-size:14px}#seJy .sjy-t.long{font-size:12.5px}
 #seJy .sjy-s{font-size:11.5px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal;line-height:1.2;text-overflow:clip;text-wrap:balance}
 #seJy .sjy-card.big .sjy-t{font-size:21px}
 #seJy .sjy-card.big .sjy-s{font-size:14px}
 #seJy .sjy-big{padding:16% 5% 4%;background:radial-gradient(75% 100% at 100% 100%,rgba(14,10,26,.8),rgba(14,10,26,.6) 45%,rgba(14,10,26,0) 85%)}   /* soft on every side: no edge across the picture */
 #seJy .sjy-big>b{font-size:42px}#seJy .sjy-big>small{font-size:17px}#seJy .sjy-big>em{font-size:12px}
 #seJy .sjy-bar{height:22px}#seJy .sjy-bar>b{font-size:12.5px}
 #seJy .sjy-foot{left:0;right:0;height:calc(58px + env(safe-area-inset-bottom));padding:0 16px env(safe-area-inset-bottom);box-sizing:border-box;background:rgba(24,20,44,.86);border-top:1px solid rgba(255,255,255,.14)}
 #seJy .sjy-track{display:none}
 #seJy .sjy-foot .sjy-all{flex:1;justify-content:center;padding:11px 14px!important;font-size:14px!important}
 #seJy .sjy-new{top:26px}
 #seJy .sjy-ban-l{display:none}
 #seJy .sjy-ban{left:-2px;right:-2px;letter-spacing:0}
 #seJy .sjy-pip{right:-6px;top:-7px}
 html body.se-screen-open.sjy-open #toasts{top:auto!important;bottom:calc(66px + env(safe-area-inset-bottom))!important}   /* just over the All quests bar, not over the story card */
 #seJy .se-strip .se-ttl>svg{display:none}
 #seJy .se-strip .se-ttl b{font-size:19px}}`;
  document.head.appendChild(st);
 }

 /* ================================================================ the screen ============*/
 const root=document.createElement('div'); root.id='seJy'; root.setAttribute('role','dialog'); root.setAttribute('aria-label','My Journey');
 root.innerHTML='<div class="sjy-dim"></div><div class="sjy-rail" id="sjyRail"></div>'
  +'<div class="sjy-foot"><div class="sjy-track" id="sjyTrack" aria-hidden="true"><i></i></div><button class="se-cream sjy-all" data-sjy="all">'+K.line('list','currentColor',2.2)+'All quests</button></div>';
 document.body.appendChild(root);
 const strip=K.bar({icon:'journey',title:'My Journey',back:()=>back(),close:()=>closeAll()});
 root.insertBefore(strip,root.children[1]);
 const rail=$('sjyRail'), track=$('sjyTrack');
 const st={on:false,lastTab:'daily',scroll:0,order:[],feat:null,figs:{},pips:0,paints:0};
 let mem={}; try{mem=JSON.parse(localStorage.getItem('mk_sjy')||'{}')||{};}catch(e){mem={};}
 const remember=()=>{try{localStorage.setItem('mk_sjy',JSON.stringify(mem));}catch(e){}};
 mem.seen=mem.seen||{};
 const P=()=>$('questPanel');
 const tabOn=()=>{const p=P(),b=p&&p.querySelector('.tabbtn.on[data-q^="tab:"]');return b?b.dataset.q.slice(4):null;};
 let selfTab=false, foreignAt=0, evRet=false, evT=0;   // the tab watch and the menu watch, below

 /* Another menu opening closes the hub. Every opener but one hides the panels first; Riding Events (its hotkey) opens
    over whatever is open, and would leave the hub on top of it. The same watch keeps the way back from Riding Events:
    a discipline card sends the player there with a way back here, and the events screen's own trips (its Ladder, All
    events, an event's leaderboard or result card) drop that way back as they leave. While such a trip lasts (evRet),
    the events screen opening again gets the way back again; any other menu, or everything closed for a moment, ends it. */
 const EV_TRIP=new Set(['eventsPanel','lbPanel','resultPanel']);
 const others=new MutationObserver(ms=>{
  const seen=new Set();
  for(const m of ms){const t=m.target; if(seen.has(t))continue; seen.add(t);
   if(t.id==='questPanel'||!K.isOpen(t))continue;
   if(st.on){const p=P();if(p&&K.isOpen(p))p.style.display='none';}
   if(evRet){if(!EV_TRIP.has(t.id))evRet=false;else if(t.id==='eventsPanel'&&K.framed()!=='eventsPanel'){const f=K.takeBack('eventsPanel');K.setBack('eventsPanel',f||reopen);}}
  }
  if(evRet){clearTimeout(evT);evT=setTimeout(()=>{if(![...EV_TRIP].concat(G.ui.panels||[]).some(id=>K.isOpen($(id))))evRet=false;},250);}
 });
 const seenPanels=new Set();
 function watchOthers(){for(const id of new Set([...(G.ui.panels||[]),...EV_TRIP]))if(id!=='questPanel'&&!seenPanels.has(id)){const el=$(id);if(el){seenPanels.add(id);others.observe(el,{attributes:true,attributeFilter:['style']});}}}
 watchOthers();

 function closeAll(){G.hidePanels();}
 function back(){const f=K.takeBack('questPanel');closeAll();if(f)setTimeout(()=>{try{f();}catch(e){}},0);}
 function show(p){
  st.on=true; evRet=false;
  if(!p.querySelector('.tabbtn'))try{G.ui.renderQuests();}catch(e){}
  const t=tabOn();
  if(performance.now()-foreignAt<250||(t&&st.lastTab&&t!==st.lastTab)){foreignAt=0;if(t)st.lastTab=t;setTimeout(()=>{if(K.isOpen(P()))K.classic('questPanel',reopen);},0);return;}   // opened on a tab by someone else: show that tab
  if(t)st.lastTab=t;
  root.classList.add('on');document.body.classList.add('sjy-open');K.settle();paint();watchOthers();
  requestAnimationFrame(()=>{rail.scrollLeft=st.scroll||0;rail.scrollTop=st.scrollY||0;paintTrack();});
 }
 function hide(){
  if(st.on&&root.classList.contains('on')){st.scroll=rail.scrollLeft;st.scrollY=rail.scrollTop;}   // only a hub that was showing has a scroll worth keeping
  st.on=false;root.classList.remove('on');document.body.classList.remove('sjy-open','sjy-lane');K.settle();
 }
 K.screens.add(()=>st.on&&root.classList.contains('on'));
 let pend=0;
 function refresh(){if(!st.on)return;clearTimeout(pend);pend=setTimeout(()=>{if(!st.on)return;const t=tabOn();
  if(t&&st.lastTab&&t!==st.lastTab){st.lastTab=t;K.classic('questPanel',reopen);return;}
  paint();},60);}
 K.cover('questPanel',{show,hide,refresh});
 {const p=P(); if(p){const t0=tabOn(); if(t0)st.lastTab=t0;
  new MutationObserver(()=>{if(!K.isOpen(P())){const t=tabOn();if(t)st.lastTab=t;}}).observe(p,{attributes:true,attributeFilter:['style']});
  /* A tab pressed by someone else (the Season Pass tile, the quest board, a villager's "have a look at your side
     quests") means "show me that tab". It is caught as the press itself, not only as a change of tab, so asking for
     the tab the list was already on works the second time too. selfTab marks the hub's own presses; foreignAt is when
     the last outside press came, for the ones made in the same moment as the panel opens, before the hub is up. In
     the list itself a tab is the player's own. */
  p.addEventListener('click',e=>{const b=e.target&&e.target.closest&&e.target.closest('[data-q^="tab:"]');if(!b||selfTab||K.framed()==='questPanel')return;
   st.lastTab=b.dataset.q.slice(4); foreignAt=performance.now();
   if(st.on)setTimeout(()=>{if(st.on&&K.isOpen(P()))K.classic('questPanel',reopen);},0);},true);}}
 function reopen(){const t=tabOn();if(t)st.lastTab=t;const q=$('questBtn');if(q)q.click();}

 /* ---- paint: the cards are kept, and only what changed is rewritten, so the scroll and the focus stay put ---- */
 const pipTxt=n=>n===true?'!':n>9?'9+':String(n);
 function paint(){
  if(!st.on)return;
  st.paints++;
  const s=S(), fg=figures(s), o=order(s,fg);
  st.figs=fg; st.order=o.list; st.feat=o.feat;
  strip.setTitle('My Journey',s.streakN>1?'Day '+s.streakN+' streak':'','journey'); strip.paint();
  let prev=null, total=0;
  for(const id of o.list){
   const f=fg[id]||{}, def=CARD[id]||{t:id};
   let el=rail.querySelector(':scope>[data-card="'+id+'"]');
   if(!el){el=document.createElement('button');el.type='button';el.className='sjy-card'+(def.big?' big':'');el.dataset.card=id;
    el.innerHTML='<span class="sjy-pic"></span><span class="sjy-plate"><b class="sjy-t"></b><small class="sjy-s"></small></span>';}
   const title=id==='special'?(f.title||'This season'):def.t;
   const a=artFor(id,f,s);
   const pic=el.querySelector('.sjy-pic');
   if(el.dataset.art!==a.k){el.dataset.art=a.k;const vb=id==='story'?storyVB():'0 0 240 240';
    const inner=/^(jump|xc|race|dressage|show)$/.test(id)||(id==='special'&&/roundup|trials/.test(f.id||''))?{vb:'20 58 200 200'}:{vb};
    pic.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+inner.vb+'" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">'+a.svg+'</svg>';}
   /* overlays */
   let extra='';
   const locked=f.locked||null;
   if(def.big){
    extra+='<span class="sjy-orn"><i></i><i></i><i></i><i></i></span><span class="sjy-big"><b>'+(f.pct||0)+'%</b><small>Story Progress</small><em>'+esc((f.x||0)+' of '+(f.y||0)+' missions')+'</em></span>';
    if(f.ready)extra+='<span class="sjy-ready">'+K.line('star','#3a2a10',2.2)+esc(f.readyText)+'</span>';
   }else if(!locked&&f.pct!=null){extra+='<span class="sjy-bar"><i style="width:'+f.pct+'%"></i><b>'+f.pct+'%</b></span>';}
   if(locked)extra+='<span class="sjy-lockv">'+K.line('lock','#fff',2)+'<span>'+esc(locked)+'</span></span>';
   let ov=pic.querySelector('.sjy-ov'); if(!ov){ov=document.createElement('span');ov.className='sjy-ov';pic.appendChild(ov);}
   if(ov.dataset.h!==extra){ov.dataset.h=extra;ov.innerHTML=extra;}
   el.classList.toggle('lock',!!locked);
   const tb=el.querySelector('.sjy-t'); if(tb.textContent!==title)tb.textContent=title;
   tb.classList.toggle('long',title.length>16);
   const sb=el.querySelector('.sjy-s'); const sub=f.sub||''; if(sb.textContent!==sub)sb.textContent=sub; sb.style.display=sub?'':'none';
   /* badges */
   const n=f.readyN||0; total+=n;
   let pp=el.querySelector(':scope>.sjy-pip'); if(n){if(!pp){pp=document.createElement('span');pp.className='sjy-pip';el.appendChild(pp);}pp.textContent=pipTxt(n);}else if(pp)pp.remove();
   const isNew=!!f.isNew&&f.sig&&mem.seen[id]!==f.sig;
   let nw=el.querySelector(':scope>.sjy-new'); if(isNew){if(!nw){nw=document.createElement('span');nw.className='sjy-new';nw.textContent='New';el.appendChild(nw);}}else if(nw)nw.remove();
   /* the ribbon: "Limited · 13 days left", and on a small card only the days, which are the point of it */
   const dl=(f.days|0)>1?(f.days|0)+' days left':(f.days|0)===1?'1 day left':'Last day';
   const ban=id==='special'&&o.feat==='special'?'<span class="sjy-ban-l">Limited · </span>'+esc(dl):'';
   let bn=el.querySelector(':scope>.sjy-ban'); if(ban){if(!bn){bn=document.createElement('span');bn.className='sjy-ban';el.appendChild(bn);}if(bn.dataset.h!==ban){bn.dataset.h=ban;bn.innerHTML=ban;}}else if(bn)bn.remove();
   el.setAttribute('aria-label',title+'. '+(ban?'Limited, '+dl+'. ':'')+(f.pct!=null&&!locked?f.pct+' percent. ':'')+(f.status||f.sub||'')+(n?'. '+n+' ready to claim':'')+(isNew?'. New':''));
   el.title=f.status||'';
   const want=prev?prev.nextSibling:rail.firstChild; if(el!==want)rail.insertBefore(el,want); prev=el;
  }
  for(const el of [...rail.children]){if(el.dataset.card&&!o.list.includes(el.dataset.card))el.remove();}
  st.pips=total;
  layout();
 }
 const phone=()=>innerWidth<=760;
 const storyVB=()=>phone()?'0 128 480 270':'45 0 300 480';
 function layout(){
  const svg=rail.querySelector('[data-card="story"] .sjy-pic>svg'); if(svg){const vb=storyVB();if(svg.getAttribute('viewBox')!==vb)svg.setAttribute('viewBox',vb);}
  fit(); toastLane(); paintTrack();
 }
 /* a subtitle too long for its line takes a second one where the plate has room for it (a one-line title), instead of
    being cut off mid-word; on a phone every subtitle may take two (the CSS), and on a short screen they are not shown */
 function fit(){
  const subs=[...rail.querySelectorAll(':scope>.sjy-card:not(.big) .sjy-s')];
  subs.forEach(x=>x.classList.remove('two'));
  if(phone()||innerHeight<=500)return;
  const want=subs.map(x=>{if(x.style.display==='none'||x.scrollWidth<=x.clientWidth+1)return false;const pl=x.parentElement,t=pl.firstElementChild;return pl.clientHeight-t.offsetHeight-3>=2*x.offsetHeight;});
  subs.forEach((x,i)=>{if(want[i])x.classList.add('two');});
 }
 /* the room in the strip between the title and the wallet, where a message goes while the hub is up */
 function toastLane(){
  const tb=$('toasts'), a=strip.querySelector('.se-ttl'), b=strip.querySelector('.se-pill')||strip.querySelector('[data-se="close"]');
  const off=()=>{document.body.classList.remove('sjy-lane');};
  if(!tb||!a||!b||phone()||!st.on)return off();
  const sr=strip.getBoundingClientRect(), l=a.getBoundingClientRect().right+14, r=b.getBoundingClientRect().left-24, w=Math.min(420,r-l);
  if(w<240)return off();
  tb.style.setProperty('--sjy-tl',Math.round(l+(r-l-w)/2)+'px'); tb.style.setProperty('--sjy-tw',Math.round(w)+'px'); tb.style.setProperty('--sjy-tt',Math.round(sr.top+Math.max(2,(sr.height-46)/2))+'px');
  document.body.classList.add('sjy-lane');
 }
 function paintTrack(){
  const sw=rail.scrollWidth, cw=rail.clientWidth, i=track.firstChild;
  if(phone()||!sw||sw<=cw+2){track.classList.add('none');rail.classList.remove('more');return;}
  track.classList.remove('none');
  const tw=track.clientWidth; i.style.width=Math.max(24,tw*cw/sw)+'px'; i.style.left=(tw-Math.max(24,tw*cw/sw))*(rail.scrollLeft/(sw-cw))+'px';
  /* the column the right edge cuts through fades out over what shows of it; a sliver is left as it is */
  const edge=rail.scrollLeft+cw; let vis=0;
  for(const el of rail.children){const l=el.offsetLeft;if(l<edge-1&&l+el.offsetWidth>edge+1)vis=Math.max(vis,edge-l);}
  const more=rail.scrollLeft<sw-cw-2&&vis>=16;
  rail.classList.toggle('more',more); if(more)rail.style.setProperty('--sjy-fade',Math.round(Math.min(vis+6,220))+'px');
 }
 rail.addEventListener('scroll',paintTrack,{passive:true});
 {let rz=0; addEventListener('resize',()=>{if(!st.on||rz)return;rz=requestAnimationFrame(()=>{rz=0;if(st.on)paint();});});}   // across 760 px the story's picture is redrawn for the other shape
 rail.addEventListener('wheel',e=>{if(phone())return;if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){rail.scrollLeft+=e.deltaY;e.preventDefault();}},{passive:false});
 /* drag the thumb, or click the track to jump there */
 {let drag=null;
  track.addEventListener('pointerdown',e=>{const sw=rail.scrollWidth,cw=rail.clientWidth,tw=track.clientWidth,r=track.getBoundingClientRect(),th=track.firstChild.getBoundingClientRect();
   if(e.clientX<th.left||e.clientX>th.right){rail.scrollTo({left:((e.clientX-r.left)/tw)*sw-cw/2,behavior:'smooth'});return;}
   drag={x:e.clientX,l:rail.scrollLeft,k:sw/tw};track.setPointerCapture(e.pointerId);e.preventDefault();});
  track.addEventListener('pointermove',e=>{if(drag)rail.scrollLeft=drag.l+(e.clientX-drag.x)*drag.k;});
  track.addEventListener('pointerup',()=>{drag=null;});track.addEventListener('pointercancel',()=>{drag=null;});}
 /* a mouse can drag the row itself, as a finger does */
 {let d=null,moved=false;
  rail.addEventListener('pointerdown',e=>{moved=false;if(e.pointerType!=='mouse'||e.button!==0||phone())return;d={x:e.clientX,l:rail.scrollLeft};});   // every press starts clean, so a finger's tap after a mouse drag is never taken for the end of the drag
  rail.addEventListener('pointermove',e=>{if(!d)return;const dx=e.clientX-d.x;if(Math.abs(dx)>6)moved=true;if(moved)rail.scrollLeft=d.l-dx;});
  addEventListener('pointerup',()=>{d=null;});
  rail.addEventListener('click',e=>{if(moved&&e.detail){e.stopPropagation();e.preventDefault();moved=false;}},true);}   // only a pointer's click ends a drag; Enter or Space on a card (detail 0) always opens it

 /* ---- where each card goes ---- */
 function markSeen(id){const f=st.figs[id];if(f&&f.sig&&f.isNew){mem.seen[id]=f.sig;remember();}}
 function openTab(t){
  const p=P(); if(!p)return;
  let b=p.querySelector('[data-q="tab:'+t+'"]');
  if(!b){try{G.ui.renderQuests();}catch(e){} b=p.querySelector('[data-q="tab:'+t+'"]');}
  st.scroll=rail.scrollLeft; st.scrollY=rail.scrollTop;
  if(b){st.lastTab=t;selfTab=true;try{b.click();}finally{selfTab=false;}}
  K.classic('questPanel',reopen);
 }
 function openEvents(evId,disc){
  G.hidePanels();
  K.setBack('eventsPanel',reopen); evRet=true;
  if(EV.open&&EV.openPage){EV.open();if(evId)setTimeout(()=>{try{EV.openPage(evId);}catch(e){}},60);return;}
  try{if(disc&&G.events2&&G.events2.setFilter)G.events2.setFilter(disc);}catch(e){}
  const b=$('eventsBtn'); if(b)b.click();
 }
 function openLadder(){G.hidePanels();K.setBack('lbPanel',reopen);let ok=false;try{ok=G.ui.dispatch('lad:boards');}catch(e){}   // dispatch answers false for an action nobody handles
  if(!ok){const b=$('lbBtn');if(b)b.click();else K.setBack('lbPanel',null);}}
 function openBuild(){G.hidePanels();K.setBack('buildPanel',reopen);const b=$('buildBtn');if(b)setTimeout(()=>b.click(),0);else try{G.ui.openBuild();}catch(e){}}
 const SPECIAL_GO={'sun-roundup':()=>openEvents('__roundup'),'frost-trials':()=>openEvents('gt')};
 function go(id){
  const def=CARD[id]; if(!def)return; const f=st.figs[id]||{};
  st.scroll=rail.scrollLeft; st.scrollY=rail.scrollTop;
  markSeen(id);
  if(def.disc){if(id==='race'&&f.claim>0){openLadder();return;}openEvents(f.next,def.disc);return;}
  if(id==='ranch'){openBuild();return;}
  if(id==='special'){const g=SPECIAL_GO[f.id];if(g)g();else{try{G.seasons.startSpecial();}catch(e){}}return;}
  if(def.tab)openTab(def.tab);
 }
 root.addEventListener('click',e=>{
  const b=e.target.closest('[data-card],[data-sjy]'); if(!b||!root.contains(b))return;
  if(b.dataset.sjy==='all'){st.scroll=rail.scrollLeft;st.scrollY=rail.scrollTop;K.classic('questPanel',reopen);return;}
  if(b.dataset.card)go(b.dataset.card);
 });

 /* ---- keys: arrows move between cards (by where they sit), the horse stays still behind the screen ---- */
 function nearest(from,dir){
  const r0=from.getBoundingClientRect(), cx=r0.left+r0.width/2, cy=r0.top+r0.height/2; let best=null,bd=1e9;
  for(const el of rail.querySelectorAll(':scope>.sjy-card')){if(el===from)continue;const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,dx=x-cx,dy=y-cy;
   const ok=dir==='l'?dx<-4:dir==='r'?dx>4:dir==='u'?dy<-4:dy>4; if(!ok)continue;
   const d=(dir==='l'||dir==='r')?Math.abs(dx)+Math.abs(dy)*2.5:Math.abs(dy)+Math.abs(dx)*2.5; if(d<bd){bd=d;best=el;}}
  return best;
 }
 function focusCard(el){if(!el)return;el.focus({preventScroll:true});const r=el.getBoundingClientRect(),rr=rail.getBoundingClientRect();
  if(phone()){if(r.top<rr.top+8||r.bottom>rr.bottom-8)rail.scrollBy({top:r.top<rr.top+8?r.top-rr.top-16:r.bottom-rr.bottom+16,behavior:'smooth'});}
  else if(r.left<rr.left+8||r.right>rr.right-8)rail.scrollBy({left:r.left<rr.left+8?r.left-rr.left-18:r.right-rr.right+18,behavior:'smooth'});}
 G.on('key',e=>{
  if(!st.on)return false;
  const c=e.code, a=document.activeElement, onCard=a&&a.classList&&a.classList.contains('sjy-card')&&root.contains(a);
  const dir={ArrowLeft:'l',KeyA:'l',ArrowRight:'r',KeyD:'r',ArrowUp:'u',KeyW:'u',ArrowDown:'d',KeyS:'d'}[c];
  if(dir){e.preventDefault();focusCard(onCard?nearest(a,dir):rail.querySelector(':scope>.sjy-card'));return true;}   // the focused row would otherwise scroll itself as well
  if(c==='Enter'||c==='Space'){const onBtn=a&&a.tagName==='BUTTON'&&root.contains(a);
   if(!onBtn){const f=rail.querySelector(':scope>.sjy-card');if(f)f.focus({preventScroll:true});e.preventDefault();}return true;}   // on a card, All quests or the strip's buttons, the button's own Enter/Space presses it
  return false;
 });
 G.on('wallet',()=>{if(st.on)strip.paint();});
 G.on('interval30',()=>{if(st.on)paint();});
 G.on('courseStart',()=>{if(st.on){const p=P();if(p)p.style.display='none';}});
 /* the ☰ Journey tile carries the hub's claim count */
 {const menu=$('seMenu'); if(menu)new MutationObserver(()=>{if(!menu.classList.contains('on'))return;const t=menu.querySelector('.se-tiles>[data-sem-main="journey"]');if(!t)return;
   let n=0; try{const s=S(),fg=figures(s);for(const k in fg)n+=fg[k].readyN||0;}catch(e){}
   let p=t.querySelector('.pip.sjy-tilepip'); if(n){if(!p){p=document.createElement('span');p.className='pip sjy-tilepip';t.appendChild(p);}p.textContent=pipTxt(n);}else if(p)p.remove();
  }).observe(menu,{attributes:true,attributeFilter:['class']});}
 G.on('state',o=>{o.seJourney={on:st.on&&root.classList.contains('on'),lastTab:st.lastTab,feat:st.feat,order:st.order.slice(),pips:st.pips,paints:st.paints,
  cards:st.order.map(id=>{const f=st.figs[id]||{};return {id,pct:f.pct==null?null:f.pct,ready:f.readyN||0,isNew:!!(f.isNew&&f.sig&&mem.seen[id]!==f.sig),locked:!!f.locked,err:f.err||null};})};});
 G.seJourney={open:()=>{const b=$('questBtn');if(b)b.click();},openCard:go,openTab,paint,figures:()=>figures(S()),state:st};
}
