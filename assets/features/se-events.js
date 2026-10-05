/* Feature package 'se-events' — Riding Events, laid out the way the riding game this one is modelled
   on lays out its own.

   Its Events screen is a row of towns along the top, and under it a carousel of entry tickets, one
   event each: an old printed ticket on the left (the town across the top, a picture of the
   discipline, its name on a ribbon, a barcode on the stub marked ENTRY) and on the right the cup
   and the event, a photograph of the arena with a ring round a rosette for how much of it you have
   won, the gold ribbons, and what opens next. The event you want is one swipe away; tap it and its
   page opens: the course map, the ribbons, the time allowed and your best, and one gold button.
   A card at the left edge carries the week's featured events and their prize tiers.
   Ours was a list of twenty-seven rows in a narrow card.

   Everything is read from the tables and the save as they stand (EVENTS3, the difficulties, the
   ribbons won per difficulty, best times, the week), and every action goes through the game's own
   buttons: the events panel is still rendered underneath (se-frame's cover()), so "Ride" clicks the
   programme's own entry button for that event and difficulty, a weekly claim clicks its claim, the
   roundup and the drills click theirs. Nothing about entering, paying or gating changes. The full
   programme is still there, one tap away, framed like every other menu.

   The pictures: each ticket is drawn here (landscape, horse and rider in the discipline's pose,
   ribbon banner, stub); each arena photograph and course map is the game's own world, pictured
   from above the venue on the frame the screen opens (se-frame's snap). Nothing runs at import
   time. */
export const id='se-events';
export function install(G){
 const K=G.seFrame, T=G.tables;
 if(!K||!T||!T.EVENTS3||!document.body)return;
 const $=id=>document.getElementById(id), esc=K.esc, fmt=K.fmt;
 const S=()=>G.save.fresh()||{};
 const ridden=()=>(G.horse&&G.horse.ridden&&G.horse.ridden())||{};
 const DIFFS=()=>(G.course&&G.course.DIFFS)||[{k:'open',label:'Open',icon:'🏇',parMul:1,rewMul:1,lvlAdd:0,desc:'the course as set'}];
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const tSec=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
 const tBest=s=>{const m=Math.floor(s/60),r=s-m*60;return m+':'+(r<10?'0':'')+r.toFixed(1);};
 const hash=str=>{let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
 const rng=seed=>()=>{seed=(seed+0x6D2B79F5)>>>0;let t=seed;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
 let uid=0;

 /* ---------------------------------------------------------------- disciplines ------------ */
 const DISC={
  jump:{t:'Show Jumping',c:'#1d4a3b',pal:['#f2e8c8','#bcd5a8','#8bb88c','#57906a','#2b5d45'],pose:'jump',fg:'fence'},
  xc:{t:'Cross Country',c:'#2d4a24',pal:['#f1e7c5','#c7d69f','#98b670','#628f48','#34592a'],pose:'jump',fg:'log'},
  race:{t:'Flat Racing',c:'#6a2a20',pal:['#f5e6c6','#e5c592','#cc9f66','#a0703f','#6b4526'],pose:'gallop',fg:'post'},
  dressage:{t:'Dressage',c:'#22345e',pal:['#efe8d4','#c9d2de','#9cafc7','#6581a7','#344c73'],pose:'trot',fg:'letters'},
  show:{t:'Showmanship',c:'#4a2a57',pal:['#f3e8d8','#dfc7d8','#c09dbc','#8f6896','#5a3d63'],pose:'stand',fg:'rosette'},
  gauntlet:{t:'Gauntlet',c:'#6e4210',pal:['#f7e8c2','#f1cc88','#dea75e','#b27736','#7a4a1c'],pose:'gallop',fg:'sun'},
  roundup:{t:'Roundup',c:'#5b3a19',pal:['#f5e7c4','#e3cf98','#c6ab6c','#94784a','#5f4a2c'],pose:'gallop',fg:'loose'},
  drill:{t:'Training',c:'#2a3e68',pal:['#eee9d8','#cdd8c2','#a5bf9a','#6f9a70','#3f6a4c'],pose:'trot',fg:'cones'}
 };
 const discOf=ev=>ev.special||(ev.disc&&DISC[ev.disc]?ev.disc:(ev.kind==='show'?'show':(ev.gauntlet||ev.kind==='gauntlet')?'gauntlet':ev.dressage?'dressage':ev.xc?'xc':ev.race?'race':'jump'));

 /* ---------------------------------------------------------------- horse and rider -------- */
 const f1=v=>(+v).toFixed(1), P2=(x,y)=>f1(x)+' '+f1(y), rad=d=>d*Math.PI/180;
 /* a rosette placed inside another drawing: the kit's is a whole <svg>, so it is sized explicitly */
 const rosette=(x,y,sc,col,col2)=>'<g transform="translate('+f1(x)+' '+f1(y)+') scale('+sc+')">'+K.RIBBON(col,col2).replace('<svg ','<svg width="40" height="48" ')+'</g>';
 function leg(hx,hy,a1,a2,l1,l2,w1,w2,col,hoof){
  const kx=hx+l1*Math.sin(rad(a1)), ky=hy+l1*Math.cos(rad(a1)), fx=kx+l2*Math.sin(rad(a1+a2)), fy=ky+l2*Math.cos(rad(a1+a2));
  return '<path d="M'+P2(hx,hy)+'L'+P2(kx,ky)+'" stroke="'+col+'" stroke-width="'+w1+'" stroke-linecap="round" fill="none"/>'
   +'<path d="M'+P2(kx,ky)+'L'+P2(fx,fy)+'" stroke="'+col+'" stroke-width="'+w2+'" stroke-linecap="round" fill="none"/>'
   +'<circle cx="'+f1(fx)+'" cy="'+f1(fy)+'" r="'+f1(w2*0.62)+'" fill="'+hoof+'"/>';
 }
 const POSES={
  jump:{rot:-15,n:36,hd:-50,fn:[70,-150],ff:[60,-138],hn:[-54,-16],hf:[-45,-28],tail:'flow',rider:'two',ground:74},
  gallop:{rot:-4,n:32,hd:-46,fn:[48,25],ff:[-22,-40],hn:[34,-25],hf:[-48,-8],tail:'flow',rider:'two',ground:41},
  trot:{rot:-2,n:62,hd:-80,fn:[38,-88],ff:[2,0],hn:[-2,0],hf:[28,-62],tail:'hang',rider:'up',ground:44},
  stand:{rot:0,n:56,hd:-70,fn:[5,0],ff:[-3,0],hn:[3,0],hf:[-6,2],tail:'hang',rider:'up',ground:44}
 };
 /* a horse and rider, side on, facing right, in body units about 125 long; x,y is the barrel */
 function horseSvg(pose,x,y,s,o){
  o=o||{}; const P=POSES[pose]||POSES.stand;
  const body=o.body||'#8b4f2b', dark=o.dark||'#5d3219', mane=o.mane||'#33200f', hoof='#1e140c', coat=o.coat||'#263d68';
  let g=leg(19,8,P.ff[0],P.ff[1],17,19,7.5,5,dark,hoof)+leg(-21,7,P.hf[0],P.hf[1],17,20,9.5,5,dark,hoof);
  g+=P.tail==='flow'?'<path d="M-36 -7Q-50 -11 -65 -3" stroke="'+mane+'" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M-37 -5Q-52 -2 -62 7" stroke="'+mane+'" stroke-width="4" stroke-linecap="round" fill="none"/>'
   :'<path d="M-36 -8Q-45 2 -43 23" stroke="'+mane+'" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M-37 -6Q-41 6 -38 22" stroke="'+mane+'" stroke-width="3.5" stroke-linecap="round" fill="none"/>';
  g+='<ellipse cx="0" cy="0" rx="30" ry="13.5" fill="'+body+'"/><circle cx="-25" cy="-1.5" r="14.5" fill="'+body+'"/><circle cx="23" cy="1" r="13" fill="'+body+'"/>';
  const n=rad(P.n), dx=Math.cos(n), dy=-Math.sin(n), px=Math.sin(n), py=Math.cos(n), B=[22,-4], Tp=[B[0]+30*dx,B[1]+30*dy];
  g+='<path d="M'+P2(B[0]-px*9.5,B[1]-py*9.5)+'L'+P2(Tp[0]-px*5.5,Tp[1]-py*5.5)+'L'+P2(Tp[0]+px*5.5,Tp[1]+py*5.5)+'L'+P2(B[0]+px*10.5,B[1]+py*10.5)+'Z" fill="'+body+'" stroke="'+body+'" stroke-width="3" stroke-linejoin="round"/>';
  g+='<path d="M'+P2(Tp[0]-px*5.5,Tp[1]-py*5.5)+'L'+P2(B[0]-px*9.5,B[1]-py*9.5)+'" stroke="'+mane+'" stroke-width="3.2" stroke-linecap="round"/>';
  const h=rad(P.hd), hx=Math.cos(h), hy=-Math.sin(h), qx=Math.sin(h), qy=Math.cos(h), M=[Tp[0]+22*hx,Tp[1]+22*hy];
  g+='<path d="M'+P2(Tp[0]-qx*6.5,Tp[1]-qy*6.5)+'L'+P2(M[0]-qx*3.6,M[1]-qy*3.6)+'Q'+P2(M[0]+hx*3,M[1]+hy*3)+' '+P2(M[0]+qx*3.6,M[1]+qy*3.6)+'L'+P2(Tp[0]+qx*6.5,Tp[1]+qy*6.5)+'Z" fill="'+body+'" stroke="'+body+'" stroke-width="2.4" stroke-linejoin="round"/>';
  const E=[Tp[0]-qx*4.5-hx*1.5,Tp[1]-qy*4.5-hy*1.5];
  g+='<path d="M'+P2(E[0]-hx*2.4,E[1]-hy*2.4)+'L'+P2(E[0]-qx*7-hx*2,E[1]-qy*7-hy*2)+'L'+P2(E[0]+hx*2.6,E[1]+hy*2.6)+'Z" fill="'+body+'"/>';
  g+='<circle cx="'+f1(Tp[0]+hx*6-qx*1.6)+'" cy="'+f1(Tp[1]+hy*6-qy*1.6)+'" r="1.3" fill="#1b0f08"/>';
  g+=leg(22,8,P.fn[0],P.fn[1],17,19,8,5.2,body,hoof)+leg(-24,7,P.hn[0],P.hn[1],17,20,10.5,5.4,body,hoof);
  if(o.noRider)return '<g transform="translate('+f1(x)+' '+f1(y)+') rotate('+P.rot+') scale('+s+')">'+g+'</g>';
  const R=P.rider==='two'?{hip:[0,-16],knee:[11,-6],ank:[7,3],sh:[17,-30],hd:[21.5,-37.5],el:[22,-23.5],hand:[30,-19]}
   :{hip:[0,-16],knee:[5,-4],ank:[3,5],sh:[3,-33],hd:[4,-40.5],el:[7,-25],hand:[15,-21]};
  g+='<path d="M'+P2(R.hand[0],R.hand[1])+'L'+P2(M[0]+qx*1.5,M[1]+qy*1.5)+'" stroke="#2a1a10" stroke-width="1.2" fill="none"/>';
  g+='<path d="M'+P2(R.hip[0],R.hip[1])+'L'+P2(R.knee[0],R.knee[1])+'" stroke="'+(o.breeches||'#efe4cb')+'" stroke-width="7.5" stroke-linecap="round"/>';
  g+='<path d="M'+P2(R.knee[0],R.knee[1])+'L'+P2(R.ank[0],R.ank[1])+'" stroke="#1d1b22" stroke-width="5.6" stroke-linecap="round"/>';
  g+='<path d="M'+P2(R.hip[0],R.hip[1])+'L'+P2(R.sh[0],R.sh[1])+'" stroke="'+coat+'" stroke-width="11" stroke-linecap="round"/>';
  g+='<circle cx="'+R.hd[0]+'" cy="'+R.hd[1]+'" r="5.2" fill="#e8b98f"/>';
  g+='<path d="M'+P2(R.hd[0]-5.7,R.hd[1]-0.4)+'A5.7 5.7 0 0 1 '+P2(R.hd[0]+5.7,R.hd[1]-0.4)+'Z" fill="#1d1b22"/><path d="M'+P2(R.hd[0]+4,R.hd[1]-1.3)+'l4.4 .7-.5 1.3-4.1-.3z" fill="#1d1b22"/>';
  g+='<path d="M'+P2(R.sh[0],R.sh[1])+'L'+P2(R.el[0],R.el[1])+'L'+P2(R.hand[0],R.hand[1])+'" stroke="'+coat+'" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
  g+='<circle cx="'+R.hand[0]+'" cy="'+R.hand[1]+'" r="2.1" fill="#e8b98f"/>';
  return '<g transform="translate('+f1(x)+' '+f1(y)+') rotate('+P.rot+') scale('+s+')">'+g+'</g>';
 }

 /* ---------------------------------------------------------------- the ticket ------------ */
 const COATS=[['#8b4f2b','#5d3219','#33200f'],['#b7793f','#8a5528','#5a3515'],['#3d2a20','#23170f','#120b06'],['#c9b9a4','#9c8b76','#e8e1d6'],['#d4a75e','#a27a3a','#f2e6c8'],['#6d6a66','#4a4744','#2c2a28']];
 function scene(disc,seed){
  const D=DISC[disc]||DISC.jump, pal=D.pal, c=D.c, r=rng(seed), coat=COATS[seed%COATS.length];
  const ho={body:coat[0],dark:coat[1],mane:coat[2],coat:['#263d68','#5a2230','#2d4a33','#3b2d5c'][seed%4]};
  let s='<rect x="0" y="0" width="240" height="300" fill="'+pal[0]+'"/>';
  s+='<circle cx="'+f1(40+r()*150)+'" cy="'+f1(62+r()*16)+'" r="17" fill="#fff8e2" opacity=".85"/>';
  if(disc==='gauntlet'){s+='<g stroke="#fff3cf" stroke-width="3" opacity=".8">';for(let i=0;i<12;i++){const a=i/12*Math.PI*2;s+='<path d="M'+P2(170+Math.cos(a)*24,76+Math.sin(a)*24)+'L'+P2(170+Math.cos(a)*40,76+Math.sin(a)*40)+'"/>';}s+='</g><circle cx="170" cy="76" r="19" fill="#fff3cf"/>';}
  const y1=128+r()*14, y2=150+r()*10;
  s+='<path d="M0 '+f1(y1+14)+'Q40 '+f1(y1-14)+' 80 '+f1(y1+4)+'T160 '+f1(y1-6)+'T240 '+f1(y1+8)+'V300H0Z" fill="'+pal[1]+'"/>';
  if(disc==='xc'||seed%3===0){const wx=40+r()*150,wy=y1+6;s+='<path d="M'+P2(wx-4,wy+14)+'L'+P2(wx-2,wy-10)+'H'+f1(wx+2)+'L'+P2(wx+4,wy+14)+'Z" fill="'+pal[3]+'"/><g stroke="'+pal[3]+'" stroke-width="2.4" stroke-linecap="round"><path d="M'+P2(wx,wy-10)+'l11 -9M'+P2(wx,wy-10)+'l-11 9M'+P2(wx,wy-10)+'l9 11M'+P2(wx,wy-10)+'l-9 -11"/></g>';}
  s+='<path d="M0 '+f1(y2+12)+'Q60 '+f1(y2-10)+' 120 '+f1(y2+6)+'T240 '+f1(y2)+'V300H0Z" fill="'+pal[2]+'"/>';
  for(let i=0;i<6;i++){const x=12+r()*216,y=y2+2+r()*10,rr=5+r()*6;s+='<rect x="'+f1(x-1.2)+'" y="'+f1(y)+'" width="2.4" height="'+f1(rr*1.3)+'" fill="'+pal[4]+'"/><circle cx="'+f1(x)+'" cy="'+f1(y-rr*0.35)+'" r="'+f1(rr)+'" fill="'+pal[4]+'"/>';}
  const gy=222;
  s+='<path d="M0 '+(gy-18)+'Q120 '+(gy-30)+' 240 '+(gy-16)+'V300H0Z" fill="'+pal[3]+'"/>';
  s+='<path d="M0 '+(gy-2)+'Q120 '+(gy-10)+' 240 '+(gy)+'" stroke="'+pal[4]+'" stroke-width="1.4" fill="none" opacity=".5"/>';
  const P=POSES[D.pose], sc=0.95, hx=disc==='jump'||disc==='xc'?118:disc==='race'||disc==='gauntlet'||disc==='roundup'?112:120;
  if(D.fg==='fence'){for(const fx of[92,150]){s+='<rect x="'+(fx-2.5)+'" y="'+(gy-58)+'" width="5" height="52" fill="#f8f3e6" stroke="'+c+'" stroke-width="1"/><rect x="'+(fx-2.5)+'" y="'+(gy-58)+'" width="5" height="9" fill="'+c+'"/><rect x="'+(fx-2.5)+'" y="'+(gy-34)+'" width="5" height="9" fill="'+c+'"/>';}
   for(const ry of[gy-46,gy-32,gy-18])s+='<rect x="92" y="'+ry+'" width="58" height="4.5" fill="#f8f3e6" stroke="'+c+'" stroke-width=".8"/><rect x="104" y="'+ry+'" width="9" height="4.5" fill="'+c+'"/><rect x="128" y="'+ry+'" width="9" height="4.5" fill="'+c+'"/>';
   s+='<path d="M84 '+(gy-4)+'h74" stroke="'+pal[4]+'" stroke-width="3" stroke-linecap="round"/>';}
  if(D.fg==='log'){s+='<rect x="92" y="'+(gy-24)+'" width="62" height="16" rx="8" fill="#7a5433"/><ellipse cx="152" cy="'+(gy-16)+'" rx="5" ry="8" fill="#c9a26b"/><path d="M96 '+(gy-18)+'h48M100 '+(gy-13)+'h40" stroke="#5d3e22" stroke-width="1.4"/>'
   +'<circle cx="88" cy="'+(gy-14)+'" r="12" fill="'+pal[4]+'"/><circle cx="162" cy="'+(gy-12)+'" r="10" fill="'+pal[4]+'"/>';}
  if(D.fg==='post'){s+='<path d="M0 '+(gy+8)+'H240" stroke="#f8f3e6" stroke-width="3"/><path d="M0 '+(gy+1)+'H240" stroke="#f8f3e6" stroke-width="2"/>';for(let x=6;x<240;x+=26)s+='<rect x="'+x+'" y="'+(gy)+'" width="2.6" height="11" fill="#f8f3e6"/>';
   s+='<rect x="196" y="'+(gy-70)+'" width="5" height="78" fill="#f8f3e6"/><circle cx="198.5" cy="'+(gy-74)+'" r="10" fill="'+c+'" stroke="#f8f3e6" stroke-width="3"/>';}
  if(D.fg==='letters'){s+='<path d="M0 '+(gy+4)+'H240" stroke="#f8f3e6" stroke-width="4"/><rect x="190" y="'+(gy-20)+'" width="22" height="20" fill="#f8f3e6" stroke="'+c+'" stroke-width="1.5"/><text x="201" y="'+(gy-5)+'" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="15" fill="'+c+'">C</text>'
   +'<rect x="26" y="'+(gy-20)+'" width="22" height="20" fill="#f8f3e6" stroke="'+c+'" stroke-width="1.5"/><text x="37" y="'+(gy-5)+'" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="15" fill="'+c+'">E</text>';}
  if(D.fg==='rosette'){s+='<rect x="196" y="'+(gy-64)+'" width="4" height="64" fill="#8a6a44"/>'+rosette(180,gy-96,0.9,c,'#b5892f');}
  if(D.fg==='loose'){s+=horseSvg('gallop',40,gy-46,0.42,{body:'#c9b9a4',dark:'#9c8b76',mane:'#e8e1d6',noRider:true})+horseSvg('gallop',196,gy-40,0.36,{body:'#3d2a20',dark:'#23170f',mane:'#120b06',noRider:true});}
  if(D.fg==='cones'){for(const cx of[40,80,178,214])s+='<path d="M'+(cx-6)+' '+(gy+2)+'L'+cx+' '+(gy-14)+'L'+(cx+6)+' '+(gy+2)+'Z" fill="#e8743b"/><path d="M'+(cx-3.5)+' '+(gy-5)+'h7" stroke="#fff" stroke-width="2"/>';}
  s+=horseSvg(D.pose,hx,gy-P.ground*sc-(D.pose==='jump'?4:0),sc,ho);
  return s;
 }
 function ticketSvg(ev,o){
  const disc=discOf(ev), D=DISC[disc]||DISC.jump, c=D.c, seed=hash(ev.id), k='tk'+(++uid);
  const town=String(o.town||ev.town||'Meadowlark').toUpperCase(), title=(o.label||D.t).toUpperCase();
  let s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 420" preserveAspectRatio="xMidYMid meet">';
  s+='<defs><clipPath id="'+k+'"><rect x="16" y="36" width="208" height="198" rx="3"/></clipPath>'
   +'<pattern id="'+k+'p" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill="#b8a57a" opacity=".35"/></pattern></defs>';
  s+='<rect x="2" y="2" width="236" height="416" rx="10" fill="#efe4c4"/><rect x="2" y="2" width="236" height="416" rx="10" fill="url(#'+k+'p)"/>';
  s+='<rect x="10" y="10" width="220" height="280" rx="6" fill="none" stroke="'+c+'" stroke-width="3"/>';
  s+='<text x="120" y="29" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="'+(town.length>14?9.5:11)+'" letter-spacing="1.5" fill="'+c+'">★ ★  '+esc(town)+'  ★ ★</text>';
  s+='<g clip-path="url(#'+k+')">'+scene(disc,seed)+'</g><rect x="16" y="36" width="208" height="198" rx="3" fill="none" stroke="'+c+'" stroke-width="1.6"/>';
  const fs=title.length>13?14:title.length>10?16:18;
  s+='<path d="M12 232h24v28H12l8-14z" fill="#cdbb8e"/><path d="M228 232h-24v28h24l-8-14z" fill="#cdbb8e"/>'
   +'<path d="M26 225H214V257H26z" fill="#f6ecd2" stroke="'+c+'" stroke-width="2"/><path d="M26 257l10 6v-6zM214 257l-10 6v-6z" fill="#9c8a5e"/>'
   +'<text x="120" y="247" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="'+fs+'" letter-spacing=".8" fill="'+c+'">'+esc(title)+'</text>';
  const won=o.ribbons||0;
  for(let i=0;i<3;i++){const cx=100+i*20;s+='<path d="'+starPath(cx,276,7,3.2)+'" fill="'+(i<won?'#d9a728':'none')+'" stroke="'+(i<won?'#8a6410':c)+'" stroke-width="1.4"/>';}
  s+='<path d="M8 300H232" stroke="#b9a676" stroke-width="1.6" stroke-dasharray="4 4"/>';
  s+='<text transform="translate(27 356) rotate(-90)" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="11" letter-spacing="2.4" fill="'+c+'">ENTRY</text>';
  s+='<text transform="translate(213 356) rotate(90)" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="11" letter-spacing="2.4" fill="'+c+'">ENTRY</text>';
  s+='<path d="M40 306V404M200 306V404" stroke="'+c+'" stroke-width="1.4"/>';
  const r=rng(seed^0x9e3779b9); let x=50; s+='<g fill="#2a2418">';
  while(x<190){const w=r()<0.3?3:r()<0.5?2:1.2;s+='<rect x="'+f1(x)+'" y="312" width="'+w+'" height="'+(r()<0.1?60:56)+'"/>';x+=w+(r()<0.5?1.6:2.6);}
  s+='</g><text x="120" y="388" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="9.5" letter-spacing="1.4" fill="#5d5240">'+String(1e11+seed%9e10).slice(0,12)+'</text>';
  if(o.lock)s+='<rect x="2" y="2" width="236" height="416" rx="10" fill="#1b1a24" opacity=".45"/>';
  return s+'</svg>';
 }
 function starPath(cx,cy,R,r){let d='';for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r:R;d+=(i?'L':'M')+P2(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);}return d+'Z';}
 const EMBLEM='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="none" stroke="#f3ead1" stroke-width="2"/><path d="M13.5 28V19a6.5 6.5 0 0 1 13 0v9" fill="none" stroke="#f3ead1" stroke-width="3.4" stroke-linecap="round"/>'
  +'<path d="M11.8 27.5h3.6M24.6 27.5h3.6" stroke="#f3ead1" stroke-width="2.6"/><path d="'+'M20 7.2l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z'+'" fill="#f3ead1"/></svg>';

 /* ---------------------------------------------------------------- the data -------------- */
 const TOWN_ORDER=['Meadowlark Ranch','Cottonwood','Kestrel Basin','Loon Lake','Barleyfold','Coyote','Hollowpeak'];
 function regionOfTown(t){
  const w=String(t||'').split(' ')[0].toLowerCase(), R=T.REGIONS||[];
  const m=r=>r&&r.name&&r.name.toLowerCase().includes(w);
  return R.find(r=>r.venue&&m(r))||R.find(r=>m(r)&&r.unlock)||R.find(m)||null;
 }
 function townLock(t){
  const rg=regionOfTown(t), WP=G.worldPkg;
  if(!rg||!rg.unlock||!WP||!WP.regionUnlocked)return null;
  try{return WP.regionUnlocked(rg,S())?null:(WP.lockText?WP.lockText(rg):rg.name+' is not open yet');}catch(e){return null;}
 }
 function specials(){
  const out=[];
  const P=$('eventsPanel');
  out.push({id:'__roundup',special:'roundup',town:'Meadowlark Ranch',name:'The Runaway Roundup',lvl:1,reward:650,
   blurb:'Five loose horses in the pasture and two and a half minutes to pen them. They run from whoever is closest: get on the far side and push.'});
  out.push({id:'__drill',special:'drill',town:'Meadowlark Ranch',name:'Training Drills',lvl:1,reward:0,
   blurb:'Eight cones in a slalom, in order, against the clock. A clear round trains one of your horse\'s stats, and costs nothing but riding it well.'});
  return out;
 }
 function towns(){
  const m=new Map();
  for(const ev of T.EVENTS3){if(!ev||ev.friendly)continue;const t=ev.town||'Meadowlark Ranch';if(!m.has(t))m.set(t,[]);m.get(t).push(ev);}
  const home=m.get('Meadowlark Ranch')||[]; m.set('Meadowlark Ranch',home.concat(specials()));
  const arr=[...m].map(([name,evs])=>({name,evs:evs.slice().sort((a,b)=>(a.special?1:0)-(b.special?1:0)||(a.lvl||1)-(b.lvl||1)||(a.reward||0)-(b.reward||0)),
   min:Math.min(...evs.filter(e=>!e.special).map(e=>e.lvl||1).concat([99]))}));
  const oi=n=>{const i=TOWN_ORDER.indexOf(n);return i<0?99:i;};
  arr.sort((a,b)=>oi(a.name)-oi(b.name)||a.min-b.min);
  return arr;
 }
 function gate(ev){
  if(ev.special)return {ok:true,missing:[]};
  try{if(G.course&&G.course.eventOk)return G.course.eventOk(ev,ridden());}catch(e){}
  const lvl=ridden().level||1; return {ok:lvl>=(ev.lvl||1),missing:lvl>=(ev.lvl||1)?[]:[['level',ev.lvl,lvl]]};
 }
 function ribbonsOf(ev,s){
  const D=DIFFS(), by=s.ribbonsBy||{}, best=(s.ribbons||{})[ev.id]||0, gold=!!(s.ribbonGold||{})[ev.id];
  const per=D.map(d=>Math.min(4,by[ev.id+':'+d.k]||0));
  if(!per.some(Boolean)&&best){const oi=Math.max(0,D.findIndex(d=>d.k==='open'));per[oi]=Math.min(4,best);}
  const golds=per.filter(v=>v>=4).length||(gold?1:0);
  return {per,best,gold,golds,sum:per.reduce((a,b)=>a+b,0),max:4*D.length};
 }
 const statLbl=k=>(T.STAT_LBL&&T.STAT_LBL[k])||k;
 const needText=m=>m.map(([k,need])=>k==='level'?'Lv '+need:statLbl(k).replace(/^\S+\s/,'')+' '+need).join(' · ');
 const featured=()=>{try{return (G.course&&G.course.weeklyFeatured?G.course.weeklyFeatured():[]).map(f=>f.id);}catch(e){return [];}};
 const shortName=(ev)=>{const t=String(ev.town||'').split(' ')[0];let n=String(ev.name||'');if(t&&n.toLowerCase().startsWith(t.toLowerCase()+' '))n=n.slice(t.length+1);return n;};
 const cupOf=t=>'The '+String(t||'Meadowlark').replace(/ Ranch$/,'')+' Cup';

 /* ---------------------------------------------------------------- the pictures ----------- */
 const gh=(x,z)=>{try{return G.world.groundH(x,z);}catch(e){return 0;}};
 function routeOf(ev){let R=(T.RACE_ROUTES||{})[ev.route];if(!R||R.length<2)return null;R=R.slice();if(ev.rev)R.reverse();return R;}
 function venueView(ev){
  const R=(ev.race||ev.xc||ev.gauntlet)&&routeOf(ev);
  if(R){const a=R[0],b=R[1],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1,ux=dx/L,uz=dz/L;
   const px=a[0]-ux*16+uz*5,pz=a[1]-uz*16-ux*5,lx=a[0]+ux*34,lz=a[1]+uz*34;
   return {key:'v:'+ev.route+(ev.rev?':r':''),pos:[px,gh(px,pz)+6.5,pz],look:[lx,gh(lx,lz)+1.2,lz],fov:52};}
  if(ev.special==='roundup')return {key:'v:pasture',pos:[-40,gh(-40,20)+14,20],look:[-72,gh(-72,-10)+1,-10],fov:52};
  const at=ev.at||[2,1], cx=at[0], cz=at[1], g=gh(cx,cz);
  return {key:'v:'+Math.round(cx)+','+Math.round(cz),pos:[cx+26,g+12,cz+32],look:[cx,g+0.5,cz-2],fov:50};
 }
 function mapView(ev){
  const R=(ev.race||ev.xc||ev.gauntlet)&&routeOf(ev);
  if(R){let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const p of R){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);z0=Math.min(z0,p[1]);z1=Math.max(z1,p[1]);}
   const cx=(x0+x1)/2,cz=(z0+z1)/2,E=Math.max((x1-x0)/1.6,z1-z0)*1.18+30,g=gh(cx,cz);
   return {key:'m:'+ev.route+(ev.rev?':r':''),pos:[cx,g+E*1.08,cz+0.01],look:[cx,g,cz],up:[0,0,-1],fov:50,marks:R,kind:'route'};}
  const at=ev.at||[2,1], cx=at[0], cz=at[1], g=gh(cx,cz), N=ev.n||0;
  const A=Math.min(17,11+N*0.6), B=Math.min(13,8+N*0.5), marks=[];
  if(N&&!ev.dressage)for(let i=0;i<N;i++){const th=i/N*Math.PI*2+0.4;marks.push([cx+Math.cos(th)*A,cz+Math.sin(th)*B]);}
  else for(let i=0;i<24;i++){const th=i/24*Math.PI*2;marks.push([cx+Math.cos(th)*14,cz+Math.sin(th)*9]);}
  return {key:'m:'+ev.id,pos:[cx,g+58,cz+0.01],look:[cx,g,cz],up:[0,0,-1],fov:50,marks,kind:N&&!ev.dressage?'fences':'ring'};
 }
 const snapImg=(v,cls)=>{const e=K.snap(v);return '<img class="'+cls+(e.url?' se-snapped':'')+'" data-snap="'+esc(v.key)+'" alt=""'+(e.url?' src="'+e.url+'"':'')+'>';};

 /* ---------------------------------------------------------------- the look -------------- */
 const TOP='clamp(50px,8.5vh,64px)';
 if(!$('seEvCss')){
  const st=document.createElement('style'); st.id='seEvCss';
  st.textContent=`
#seEv{position:fixed;inset:0;z-index:10;display:none;font-family:Nunito,system-ui,sans-serif;color:#fff;overflow:clip;user-select:none;-webkit-user-select:none}
#seEv.on{display:block}
#seEv .sev-dim{position:absolute;inset:0;background:rgba(18,18,26,.34);backdrop-filter:blur(2.5px) saturate(.55) brightness(.8);-webkit-backdrop-filter:blur(2.5px) saturate(.55) brightness(.8)}
#seEv .se-strip{position:absolute}
/* the towns */
#seEv .sev-towns{position:absolute;left:0;right:0;top:calc(${TOP} + clamp(12px,2.6vh,24px));height:clamp(30px,4.6vh,38px);display:flex;justify-content:center;align-items:center}
#seEv .sev-towns::before{content:'';position:absolute;left:0;right:0;top:50%;height:2px;background:rgba(215,215,225,.55)}
#seEv .sev-tabs{position:relative;display:flex;max-width:calc(100% - 60px);overflow-x:auto;scrollbar-width:none;border:2px solid rgba(240,240,248,.8);border-radius:3px;background:#262562;box-shadow:0 2px 8px rgba(0,0,0,.4)}
#seEv .sev-tabs::-webkit-scrollbar{display:none}
#seEv .sev-tab{position:relative;flex:none;display:flex;align-items:center;justify-content:center;gap:6px;min-width:clamp(96px,9.4vw,132px);height:clamp(28px,4.2vh,34px);padding:0 14px;border:0;
 border-right:1px solid rgba(255,255,255,.3);background:transparent;color:#fff;font:800 clamp(11.5px,1.9vh,14.5px)/1 Georgia,'Times New Roman',serif;text-transform:uppercase;letter-spacing:.5px;cursor:pointer;white-space:nowrap;min-height:0;box-shadow:none;border-radius:0}
#seEv .sev-tab:last-child{border-right:0}
#seEv .sev-tab svg{width:14px;height:14px;flex:none}
#seEv .sev-tab.on{background:linear-gradient(180deg,#d6b27a,#b48a52);color:#34240f}
#seEv .sev-tab.lock{color:#c9c6e6}
#seEv .sev-tab i{position:absolute;top:3px;right:4px;width:8px;height:8px;border-radius:50%;background:#e43a33;box-shadow:0 0 0 1.5px #fff}
#seEv .sev-point{position:absolute;top:calc(50% + clamp(15px,2.3vh,19px));width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid #b48a52;transform:translateX(-50%);transition:left .25s}
#seEv .sev-dots{position:absolute;top:50%;width:9px;height:9px;border-radius:50%;border:2px solid rgba(215,215,225,.7);background:#2a2940;transform:translate(-50%,-50%)}
/* the carousel */
#seEv .sev-stage{position:absolute;left:0;right:0;top:calc(${TOP} + clamp(56px,9vh,76px));bottom:clamp(40px,6.5vh,56px);touch-action:pan-y}
#seEv .sev-card{position:absolute;left:50%;top:50%;width:min(700px,60vw,calc((100vh - 200px) * 1.62));aspect-ratio:1.6;transform:translate(-50%,-50%) translateX(calc(var(--o,0) * 97%)) scale(var(--s,1));z-index:calc(5 - var(--a,0));
 transition:transform .38s cubic-bezier(.2,.8,.2,1),opacity .3s,filter .3s;display:grid;grid-template-columns:37% 63%;border:3px solid #f4f1ea;border-radius:8px;
 background:var(--c,#1d4a3b);box-shadow:0 10px 30px rgba(0,0,0,.5);cursor:pointer;will-change:transform}
#seEv .sev-card.side{--s:.84;opacity:.8;filter:brightness(.72) saturate(.85)}
#seEv .sev-card.far{--s:.7;opacity:0;pointer-events:none}
#seEv .sev-card .sev-tk{position:relative;padding:3.2%;background:rgba(0,0,0,.18);border-right:3px solid rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:5px 0 0 5px}
#seEv .sev-card .sev-tk svg{height:100%;width:auto;max-width:100%;filter:drop-shadow(0 3px 5px rgba(0,0,0,.4))}
#seEv .sev-info{position:relative;display:flex;flex-direction:column;min-width:0;border-radius:0 5px 5px 0;overflow:hidden}
#seEv .sev-head{flex:none;display:flex;align-items:center;gap:10px;padding:2.2% 3.5%;min-height:18%}
#seEv .sev-head>svg{width:clamp(28px,5vh,40px);height:clamp(28px,5vh,40px);flex:none}
#seEv .sev-cup{font:800 clamp(9.5px,1.5vh,12px)/1.1 Georgia,serif;letter-spacing:1px;text-transform:uppercase;color:rgba(242,236,220,.8)}
#seEv .sev-name{font:800 clamp(15px,2.7vh,22px)/1.05 Georgia,serif;text-transform:uppercase;letter-spacing:.4px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.4)}
#seEv .sev-photo{position:relative;flex:1;min-height:0;background:#6d5a40;overflow:hidden}
#seEv .sev-photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:sepia(.9) saturate(.85) contrast(1.02) brightness(1.02);opacity:0;transition:opacity .4s}
#seEv .sev-photo img.se-snapped{opacity:1}
#seEv .sev-photo::after{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,transparent 45%,rgba(40,25,10,.4));pointer-events:none}
#seEv .sev-ring{position:absolute;left:50%;top:43%;width:clamp(96px,18vh,142px);height:clamp(96px,18vh,142px);transform:translate(-50%,-50%);z-index:1}
#seEv .sev-ring svg{width:100%;height:100%;display:block;overflow:visible}
#seEv .sev-pct{position:absolute;left:50%;transform:translateX(-50%);top:calc(43% + clamp(50px,9.4vh,74px));text-align:center;font:900 clamp(15px,2.6vh,20px)/1 Nunito,system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.7);z-index:1;background:rgba(24,18,10,.62);border-radius:10px;padding:2px 10px}
#seEv .sev-gold{position:absolute;left:50%;bottom:7%;transform:translateX(-50%);display:flex;align-items:center;gap:6px;height:clamp(22px,3.5vh,28px);padding:0 18px;z-index:1;white-space:nowrap;
 background:rgba(38,34,30,.88);color:#f4eedd;font:800 clamp(10.5px,1.7vh,13px)/1 Nunito,system-ui,sans-serif;clip-path:polygon(10px 0,calc(100% - 10px) 0,100% 50%,calc(100% - 10px) 100%,10px 100%,0 50%)}
#seEv .sev-gold svg{width:clamp(16px,2.6vh,20px);height:clamp(16px,2.6vh,20px)}
#seEv .sev-foot{flex:none;display:flex;align-items:center;gap:8px;padding:0 3.5%;min-height:11%;font:800 clamp(12px,2vh,15.5px)/1.1 Nunito,system-ui,sans-serif;color:#fff}
#seEv .sev-foot .sev-sp{flex:1}
#seEv .sev-foot svg{width:clamp(18px,3vh,24px);height:clamp(18px,3vh,24px);flex:none}
#seEv .sev-foot .sev-lv{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 5px;border-radius:11px;background:rgba(255,255,255,.18);font-size:12px}
#seEv .sev-new{position:absolute;right:-6px;top:-14px;z-index:3;padding:4px 9px;background:linear-gradient(180deg,#ffd34d,#f2b01e);color:#3b2600;font:900 clamp(10px,1.7vh,13px)/1 Georgia,serif;text-transform:uppercase;letter-spacing:.4px;box-shadow:0 2px 4px rgba(0,0,0,.35)}
#seEv .sev-feat{position:absolute;left:37%;top:-14px;z-index:3;padding:4px 9px;background:linear-gradient(180deg,#b5dcff,#72aee8);color:#10233f;font:900 clamp(10px,1.7vh,13px)/1 Georgia,serif;text-transform:uppercase;letter-spacing:.4px;box-shadow:0 2px 4px rgba(0,0,0,.35)}
#seEv .sev-photo:has(.sev-lockv) :is(.sev-ring,.sev-pct,.sev-gold){display:none}
#seEv .sev-lockv{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:rgba(20,18,30,.5);text-align:center;padding:10%}
#seEv .sev-lockv svg{width:34px;height:34px}
#seEv .sev-lockv b{font:800 clamp(13px,2.2vh,17px)/1.2 Georgia,serif;text-transform:uppercase;letter-spacing:.4px}
#seEv .sev-lockv span{font:700 clamp(11px,1.8vh,14px)/1.3 Nunito,system-ui,sans-serif;color:#e6e0f6}
#seEv .sev-arrow{position:absolute;bottom:-6px;z-index:6;width:30px!important;height:30px!important;padding:5px!important}
#seEv .sev-arrow.l{right:calc(50% + var(--dw,48px))}
#seEv .sev-arrow.r{left:calc(50% + var(--dw,48px))}
#seEv .sev-arrow[hidden]{display:none!important}
#seEv .sev-count{position:absolute;left:50%;bottom:0;transform:translateX(-50%);display:flex;gap:0;z-index:6}
/* each dot is a button: a clear border round it makes a finger-sized target without making the dot any bigger */
#seEv .sev-count i{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.35);border:5px solid transparent;background-clip:padding-box;cursor:pointer}
#seEv .sev-count i.on{background:#fff;background-clip:padding-box}
/* the week's card, and the special event's */
/* above every card (their z-index runs up to 5): the card beside the centre one slid under the week's card and printed its
   lock and its ribbons over the trophy */
#seEv .sev-promo{position:absolute;top:calc(${TOP} + clamp(70px,11vh,92px));bottom:clamp(40px,6.5vh,56px);width:clamp(150px,14.5vw,196px);display:flex;flex-direction:column;
 border-radius:6px;overflow:hidden;box-shadow:0 8px 22px rgba(0,0,0,.5);border:2px solid #d9b45e;background:linear-gradient(180deg,#472a6f,#2a1a4c);z-index:6;max-height:470px;margin:auto 0}
#seEv .sev-promo.wk{left:-4px;border-left:0;border-radius:0 6px 6px 0}
#seEv .sev-promo.sp{right:-4px;border-right:0;border-radius:6px 0 0 6px;background:linear-gradient(180deg,#6d3d18,#3b1f0d)}
#seEv .sev-promo .pr-h{flex:none;padding:6px 4px 7px;text-align:center;background:linear-gradient(180deg,#c3382e,#8e1f19);font:900 clamp(11px,1.8vh,14px)/1 Georgia,serif;text-transform:uppercase;letter-spacing:.4px;box-shadow:0 2px 3px rgba(0,0,0,.35)}
#seEv .sev-promo .pr-art{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:6px}
#seEv .sev-promo .pr-art svg{width:100%;height:100%;max-height:190px}
#seEv .sev-promo .pr-b{flex:none;padding:0 10px;text-align:center}
#seEv .sev-promo .pr-b b{display:block;font:900 clamp(13px,2.1vh,16px)/1.15 Nunito,system-ui,sans-serif}
#seEv .sev-promo .pr-b span{display:block;margin-top:4px;font:700 clamp(10px,1.6vh,12px)/1.3 Nunito,system-ui,sans-serif;color:#e8e2f6}
#seEv .sev-promo .se-gold{margin:10px;padding:9px 10px!important}
/* bottom row */
#seEv .sev-links{position:absolute;right:14px;bottom:10px;display:flex;gap:8px;z-index:4}
#seEv .sev-links button{padding:7px 14px!important;font-size:clamp(11px,1.8vh,13.5px)!important}
#seEv .sev-links .sev-wkbtn{display:none}
#seEv .sev-resume{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);z-index:5;display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;background:rgba(28,24,50,.92);border:1.5px solid #e8c56a;font:800 13px/1.2 Nunito,system-ui,sans-serif;white-space:nowrap}
#seEv .sev-resume button{padding:6px 12px!important;font-size:12px!important}
/* the event page */
#seEv .sev-page{position:absolute;inset:0;display:none;z-index:6}
#seEv.page .sev-page{display:block}
#seEv.page .sev-towns,#seEv.page .sev-stage,#seEv.page .sev-promo,#seEv.page .sev-links,#seEv.page .sev-resume{display:none}
#seEv .sev-side{position:absolute;left:0;top:${TOP};bottom:0;width:clamp(78px,7.4vw,98px);background:linear-gradient(180deg,#2a2760,#1d1b47);box-shadow:3px 0 10px rgba(0,0,0,.35);z-index:2}
#seEv .sev-side button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;width:100%;height:clamp(58px,9vh,72px);border:0;border-bottom:1px solid rgba(255,255,255,.07);border-radius:0;
 background:transparent;color:#e9e4ff;font:800 11.5px/1.1 Nunito,system-ui,sans-serif;cursor:pointer;box-shadow:none;min-height:0;padding:0}
#seEv .sev-side button svg{width:24px;height:24px}
#seEv .sev-side button.on{background:linear-gradient(180deg,#f1e8d3,#e3d5b3);color:#3b2a17}
#seEv .sev-main{position:absolute;left:clamp(78px,7.4vw,98px);right:0;top:${TOP};bottom:0;display:flex;flex-direction:column;align-items:center;padding:clamp(8px,2vh,18px) 20px 0;overflow-y:auto;overflow-x:hidden}
#seEv .sev-ptitle{display:flex;align-items:center;gap:14px;width:min(900px,100%);font:800 clamp(17px,3vh,24px)/1.1 Georgia,serif;text-transform:uppercase;letter-spacing:.8px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.5)}
#seEv .sev-ptitle::before,#seEv .sev-ptitle::after{content:'';flex:1;height:2px;background:rgba(230,230,240,.55)}
#seEv .sev-plaque{margin-top:8px;padding:5px 26px;background:linear-gradient(180deg,#f7efdb,#e3d4ae);color:#3b2a17;font:800 clamp(11.5px,1.9vh,14px)/1 Georgia,serif;text-transform:uppercase;letter-spacing:.7px;
 clip-path:polygon(0 0,100% 0,calc(100% - 10px) 50%,100% 100%,0 100%,10px 50%)}
#seEv .sev-prow{display:flex;gap:clamp(12px,2vw,22px);width:min(960px,100%);margin-top:clamp(8px,1.8vh,16px);align-items:stretch}
#seEv .sev-map{position:relative;flex:1.35;min-width:0;aspect-ratio:1.6;max-height:calc(100vh - ${TOP} - 250px);border:3px solid #f4f1ea;border-radius:8px;overflow:hidden;background:#3d4a36;box-shadow:0 8px 22px rgba(0,0,0,.45)}
#seEv .sev-map img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.95) brightness(.92);opacity:0;transition:opacity .4s}
#seEv .sev-map img.se-snapped{opacity:1}
#seEv .sev-map svg.sev-course{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
#seEv .sev-diffs{flex:1;display:flex;flex-direction:column;gap:clamp(6px,1.2vh,10px);min-width:200px;max-width:330px}
#seEv .sev-diff{position:relative;display:flex;align-items:center;gap:10px;padding:clamp(7px,1.3vh,11px) 12px;border-radius:8px;cursor:pointer;text-align:left;border:2px solid rgba(255,255,255,.25)!important;
 background:rgba(30,28,62,.86)!important;color:#fff!important;box-shadow:0 3px 8px rgba(0,0,0,.35)!important;min-height:0!important;font-family:Nunito,system-ui,sans-serif!important}
#seEv .sev-diff.on{border-color:#f1d27a!important;background:linear-gradient(180deg,rgba(80,62,140,.95),rgba(48,38,96,.95))!important;box-shadow:0 0 0 2px rgba(241,210,122,.35),0 3px 8px rgba(0,0,0,.35)!important}
#seEv .sev-diff.lock{opacity:.6}
#seEv .sev-diff .d-ic{font-size:22px;line-height:1;flex:none}
#seEv .sev-diff .d-t{display:block;font:800 clamp(13px,2.1vh,16px)/1.1 Georgia,serif;text-transform:uppercase;letter-spacing:.4px}
#seEv .sev-diff .d-s{display:block;margin-top:2px;font:700 clamp(10px,1.6vh,12px)/1.25 Nunito,system-ui,sans-serif;color:#d8d2ee}
#seEv .sev-diff .d-pay{margin-left:auto;flex:none;display:flex;align-items:center;gap:4px;font:900 clamp(12px,2vh,15px)/1 Nunito,system-ui,sans-serif}
#seEv .sev-diff .d-pay svg{width:18px;height:18px}
#seEv .sev-diff .d-rib{display:flex;gap:2px;margin-top:4px}
#seEv .sev-diff .d-rib svg{width:12px;height:15px}
#seEv .sev-ribs{display:flex;gap:clamp(10px,2vw,18px);margin-top:clamp(8px,1.6vh,14px)}
#seEv .sev-ribs .rs{width:clamp(40px,6.8vh,56px);height:clamp(48px,8.2vh,66px);display:flex;align-items:center;justify-content:center;border-radius:50% 50% 12px 12px;background:rgba(20,18,36,.5);border:2px solid rgba(255,255,255,.3)}
#seEv .sev-ribs .rs svg{width:78%;height:78%}
#seEv .sev-ribs .rs.off svg{opacity:.28;filter:grayscale(1)}
#seEv .sev-pbar{position:sticky;bottom:0;margin-top:auto;width:calc(100% + 40px);display:flex;align-items:center;gap:18px;padding:clamp(8px,1.6vh,14px) 20px;background:linear-gradient(180deg,rgba(24,22,46,.7),rgba(24,22,46,.94));border-top:1px solid rgba(255,255,255,.15)}
#seEv .sev-pbar .pb-k{display:block;font:800 clamp(9.5px,1.5vh,11.5px)/1.1 Nunito,system-ui,sans-serif;letter-spacing:.8px;text-transform:uppercase;color:#bdb6dc}
#seEv .sev-pbar .pb-v{display:block;font:900 clamp(14px,2.4vh,19px)/1.15 Nunito,system-ui,sans-serif;color:#fff;font-variant-numeric:tabular-nums}
#seEv .sev-pbar .pb-req{display:flex;flex-wrap:wrap;gap:5px;flex:1;min-width:0}
#seEv .sev-pbar .pb-req>span{padding:5px 8px;border-radius:8px;background:rgba(255,255,255,.12);font:800 11.5px/1.25 Nunito,system-ui,sans-serif}
#seEv .sev-pbar .pb-req>span.bad{background:rgba(228,80,70,.3);color:#ffd6d2}
#seEv .sev-pbar .pb-req>span.ok{background:rgba(90,190,110,.28);color:#d9ffe0}
#seEv .sev-pbar .pb-req small{display:block;margin-top:3px;font-size:10.5px;font-weight:700}
#seEv .sev-horse{width:min(960px,100%);margin:10px 0;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;font:700 12px/1.4 Nunito,system-ui,sans-serif;color:#e8e2f6}
#seEv .sev-horse b{font-size:14px;color:#fff}
#seEv .sev-pbar .se-gold{min-width:clamp(140px,15vw,200px);padding:12px 22px!important}
#seEv .sev-blurb{width:min(960px,100%);margin-top:10px;font:700 clamp(11.5px,1.9vh,14px)/1.45 Nunito,system-ui,sans-serif;color:#ece7fa;text-shadow:0 1px 2px rgba(0,0,0,.5)}
#seEv .sev-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;width:min(960px,100%);margin-top:14px}
#seEv .sev-stats button{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px!important;text-align:left}
/* the week's sheet */
#seEv .sev-sheet{position:absolute;inset:0;z-index:8;display:none;align-items:center;justify-content:center;background:rgba(10,8,22,.55)}
#seEv.sheet .sev-sheet{display:flex}
#seEv .sev-sbox{position:relative;width:min(900px,94vw);max-height:calc(100vh - ${TOP} - 30px);overflow-y:auto;margin-top:${TOP};border-radius:10px;border:2px solid #d9b45e;background:linear-gradient(180deg,#352466,#231848);box-shadow:0 14px 40px rgba(0,0,0,.6);padding:0 0 16px}
#seEv .sev-sh{display:flex;align-items:center;gap:12px;padding:12px 16px;background:linear-gradient(180deg,#c3382e,#8e1f19)}
#seEv .sev-sh b{font:900 clamp(16px,2.8vh,22px)/1 Georgia,serif;text-transform:uppercase;letter-spacing:.6px}
#seEv .sev-sh span{margin-left:auto;display:flex;align-items:center;gap:6px;font:800 13px/1 Nunito,system-ui,sans-serif}
#seEv .sev-sh span svg{width:16px;height:16px}
#seEv .sev-sh .se-circ{margin-left:6px}
#seEv .sev-fe{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:14px 16px 4px}
#seEv .sev-fe>div{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:8px;border-radius:8px;background:rgba(0,0,0,.2)}
#seEv .sev-fe svg{width:100%;max-width:120px;height:auto}
#seEv .sev-fe b{font:800 13px/1.15 Georgia,serif;text-transform:uppercase}
#seEv .sev-fe span{font:800 12px/1.2 Nunito,system-ui,sans-serif;color:#e8e2f6}
#seEv .sev-fe button{padding:7px 14px!important;font-size:12.5px!important}
#seEv .sev-tiers{display:flex;align-items:stretch;gap:10px;padding:12px 16px 0}
#seEv .sev-tier{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 6px;border-radius:8px;background:rgba(255,255,255,.08);border:1.5px solid rgba(255,255,255,.15);text-align:center;font:800 12.5px/1.25 Nunito,system-ui,sans-serif}
#seEv .sev-tier.done{border-color:#7dd87d;background:rgba(80,190,100,.18)}
#seEv .sev-tier.ready{border-color:#f1d27a;background:rgba(241,210,122,.14)}
#seEv .sev-tier .t-n{font:900 18px/1 Georgia,serif}
#seEv .sev-tier button{padding:6px 10px!important;font-size:12px!important}
#seEv .sev-wbar{height:10px;margin:14px 16px 0;border-radius:5px;background:rgba(0,0,0,.35);overflow:hidden}
#seEv .sev-wbar i{display:block;height:100%;background:linear-gradient(90deg,#7ee07e,#3fae5a);border-radius:5px}
@media (max-width:760px){
 #seEv .sev-card{width:94vw;grid-template-columns:40% 60%}
 #seEv .sev-promo,#seEv .sev-arrow{display:none!important}
 /* the week's card has no room on a phone, so it is a button beside Ladder and All events: without it the weekly prizes
    could not be seen or claimed from here at all */
 #seEv .sev-links{left:10px;right:10px;justify-content:center;flex-wrap:wrap}
 #seEv .sev-links .sev-wkbtn{display:inline-flex}
 #seEv .sev-links button{padding:7px 11px!important}
 #seEv .sev-name{font-size:14px}
 /* the badges took the head's whole width and ran into each other and the cup's name: New goes to the ticket's corner,
    Featured to the far one, and the cup's name (the same for every card in the town) makes room */
 #seEv .sev-cup{display:none}
 #seEv .sev-new{left:-6px;right:auto}
 #seEv .sev-feat{left:auto;right:-6px}
 /* ring, percentage and gold ribbons stacked down the photo, sized to it, instead of the pill lying across the ring */
 #seEv .sev-ring{top:1.6vw;transform:translateX(-50%);width:20vw;height:20vw}
 #seEv .sev-pct{top:22.6vw;font-size:clamp(13px,3.6vw,20px)}
 #seEv .sev-gold{bottom:auto;top:29.4vw;height:clamp(20px,6vw,28px);padding:0 12px;font-size:clamp(10px,2.7vw,13px)}
 #seEv .sev-foot{font-size:11.5px;white-space:nowrap;overflow:hidden}
 /* the dots sit just under the card (the card is centred in the stage), clear of the buttons along the bottom, which
    wrap to two rows when a special event is on */
 #seEv .sev-count{bottom:auto;top:calc(50% + 29.4vw + 6px)}
 #seEv .sev-count i{border-width:8px}
 #seEv .sev-prow{flex-direction:column}
 #seEv .sev-diffs{max-width:none}
 #seEv .sev-fe{grid-template-columns:repeat(2,1fr)}
 #seEv .sev-tiers{flex-wrap:wrap}
 #seEv .sev-pbar{flex-wrap:wrap}}`;
  document.head.appendChild(st);
 }

 /* ---------------------------------------------------------------- the screen ------------ */
 const root=document.createElement('div'); root.id='seEv'; root.setAttribute('role','dialog'); root.setAttribute('aria-label','Riding Events');
 root.innerHTML='<div class="sev-dim"></div><div class="sev-towns"><span class="sev-tabs" id="sevTabs"></span><span class="sev-point" id="sevPoint"></span></div>'
  +'<div class="sev-stage" id="sevStage"></div>'
  +'<div class="sev-promo wk" id="sevWeek"></div>'
  +'<div class="sev-links"><button class="se-cream" data-sev="special" id="sevSpecial" style="display:none"></button><button class="se-cream sev-wkbtn" data-sev="week" id="sevWeekBtn">Weekly</button><button class="se-cream" data-sev="ladder">Ladder</button><button class="se-cream" data-sev="classic">All events</button></div>'
  +'<div class="sev-resume" id="sevResume" style="display:none"></div>'
  +'<div class="sev-page" id="sevPage"></div><div class="sev-sheet" id="sevSheet"></div>';
 document.body.appendChild(root);
 const strip=K.bar({icon:'events',title:'Riding Events',back:()=>back(),close:()=>closeAll()});
 root.insertBefore(strip,root.children[1]);
 const st={on:false,town:0,cur:{},page:null,diff:null,tab:'event'};
 try{const m=JSON.parse(localStorage.getItem('mk_sev')||'{}');if(m&&typeof m.town==='string')st.townName=m.town;if(m&&m.cur)st.cur=m.cur;}catch(e){}
 const remember=()=>{try{localStorage.setItem('mk_sev',JSON.stringify({town:st.townName,cur:st.cur}));}catch(e){}};
 let TW=[];

 function closeAll(){st.page=null;root.classList.remove('page','sheet');G.hidePanels();}
 function back(){
  if(root.classList.contains('sheet')){root.classList.remove('sheet');return;}
  if(st.page){st.page=null;root.classList.remove('page');paint();return;}
  const f=K.takeBack('eventsPanel');   // a screen that sent the player here (My Journey's discipline cards) gets them back
  closeAll(); if(f)setTimeout(()=>{try{f();}catch(e){}},0);
 }
 function show(){st.on=true;root.classList.add('on');K.settle();paint();}
 function hide(){st.on=false;st.page=null;root.classList.remove('on','page','sheet');K.settle();}
 K.screens.add(()=>st.on);
 let pend=0;
 function refresh(){if(!st.on)return;clearTimeout(pend);pend=setTimeout(()=>{if(st.page)paintPage();else paint();},60);}
 K.cover('eventsPanel',{show,hide,refresh});

 /* ---- the towns and the carousel ---- */
 function paint(){
  if(!st.on)return;
  TW=towns();
  let ti=TW.findIndex(t=>t.name===st.townName); if(ti<0)ti=Math.max(0,TW.findIndex(t=>!townLock(t.name))); st.town=ti; st.townName=TW[ti]&&TW[ti].name;
  const s=S();
  strip.setTitle('Riding Events','', 'events'); strip.paint();
  /* the tabs */
  const tabs=$('sevTabs');
  tabs.innerHTML=TW.map((t,i)=>{const lk=townLock(t.name);const fresh=!lk&&t.evs.some(ev=>!ev.special&&gate(ev).ok&&!((s.ribbons||{})[ev.id]));
   return '<button class="sev-tab'+(i===ti?' on':'')+(lk?' lock':'')+'" data-town="'+i+'" title="'+esc(lk||t.name)+'">'+(lk?K.line('lock',i===ti?'#34240f':'#fff',2.4):'')+esc(t.name.replace(/ Ranch$/,''))+(fresh&&i!==ti?'<i></i>':'')+'</button>';}).join('');
  requestAnimationFrame(()=>{const on=tabs.querySelector('.sev-tab.on'),pt=$('sevPoint');if(on&&pt){tabs.scrollLeft=Math.max(0,on.offsetLeft-(tabs.clientWidth-on.offsetWidth)/2);pt.style.left=(tabs.offsetLeft+on.offsetLeft-tabs.scrollLeft+on.offsetWidth/2)+'px';}});   // only the strip scrolls: scrollIntoView moved the whole screen
  /* the cards */
  const T0=TW[ti]; if(!T0){$('sevStage').innerHTML='';return;}
  const lk=townLock(T0.name), feat=featured();
  let cur=st.cur[T0.name]; if(cur==null){cur=Math.max(0,T0.evs.findIndex(ev=>gate(ev).ok&&!((s.ribbons||{})[ev.id]>=4)));} cur=clamp(cur,0,T0.evs.length-1); st.cur[T0.name]=cur;
  const stage=$('sevStage');
  stage.innerHTML=T0.evs.map((ev,i)=>card(ev,i,cur,T0,s,lk,feat)).join('')
   +'<button class="se-circ sev-arrow l" data-sev="prev" aria-label="Previous"'+(cur>0?'':' hidden')+'>'+K.line('chevl','#fff',2.6)+'</button>'
   +'<button class="se-circ sev-arrow r" data-sev="next" aria-label="Next"'+(cur<T0.evs.length-1?'':' hidden')+'>'+K.line('chev','#fff',2.6)+'</button>'
   +'<span class="sev-count">'+T0.evs.map((e,i)=>'<i class="'+(i===cur?'on':'')+'" data-sev="dot:'+i+'" role="button" aria-label="'+esc(e.special?e.name:shortName(e))+'"></i>').join('')+'</span>';
  stage.style.setProperty('--dw',(T0.evs.length*9+14)+'px');   // the arrows stand clear of however many dots there are
  for(const ev of T0.evs.slice(Math.max(0,cur-1),cur+2))K.snap(venueView(ev));
  paintPromos(s,feat);
  paintResume();
  remember();
 }
 function card(ev,i,cur,T0,s,lk,feat){
  const o=i-cur, cls=o===0?'':Math.abs(o)===1?' side':' far', disc=discOf(ev), D=DISC[disc]||DISC.jump, g=gate(ev), rb=ev.special?null:ribbonsOf(ev,s);
  const pct=rb?Math.round(rb.sum/rb.max*100):0, fresh=!ev.special&&g.ok&&!lk&&!rb.best, isF=feat.includes(ev.id);
  const next=T0.evs.find(e=>!e.special&&!gate(e).ok);
  const foot=ev.special?(ev.special==='roundup'?(roundupReady()?'Ready to start':'Next roundup soon'):'Train a stat for free')
   :next?('Unlock next event: <span class="sev-lv">Lv '+next.lvl+'</span>'):(rb.golds>=DIFFS().length?'Every gold ribbon won':'All events open');
  const art=ticketSvg(ev,{town:T0.name,ribbons:rb?Math.min(3,rb.best):0,lock:!g.ok||!!lk,label:ev.special?D.t:null});
  const ring=ev.special?'<div class="sev-ring">'+ringSvg(1,disc==='roundup'?'#d9a33c':'#6fa3e8',true)+'</div>'
   :'<div class="sev-ring">'+ringSvg(pct/100,'#63d26b')+'</div><div class="sev-pct">'+pct+'%</div>';
  const gold=ev.special?'<div class="sev-gold">'+esc(ev.special==='roundup'?'Pays 130 coins a horse':'Eight cones, one stat')+'</div>'
   :'<div class="sev-gold">'+K.RIBBON('#e6b53a','#b8831d')+rb.golds+'/'+DIFFS().length+' Gold Ribbons</div>';
  const lock=lk?'<div class="sev-lockv">'+K.line('lock','#fff',2)+'<b>'+esc(T0.name)+'</b><span>'+esc(lk)+'</span></div>'
   :!g.ok?'<div class="sev-lockv">'+K.line('lock','#fff',2)+'<b>Needs '+esc(needText(g.missing))+'</b><span>'+esc(ridden().name||'Your horse')+' is Lv '+(ridden().level||1)+'</span></div>':'';
  return '<div class="sev-card'+cls+'" style="--o:'+o+';--a:'+Math.abs(o)+';--c:'+D.c+'" data-card="'+i+'" data-ev="'+esc(ev.id)+'">'
   +(fresh?'<span class="sev-new">New event!</span>':'')+(isF?'<span class="sev-feat">Featured · '+(((s.weekly&&s.weekly.rib)||{})[ev.id]||0)+'/4</span>':'')
   +'<div class="sev-tk">'+art+'</div>'
   +'<div class="sev-info"><div class="sev-head" style="background:'+D.c+'">'+EMBLEM+'<div><div class="sev-cup">'+esc(cupOf(T0.name))+'</div><div class="sev-name">'+esc(ev.special?ev.name:shortName(ev))+'</div></div></div>'
   +'<div class="sev-photo">'+snapImg(venueView(ev),'')+ring+gold+lock+'</div>'
   +'<div class="sev-foot" style="background:'+D.c+'">'+foot+'<span class="sev-sp"></span>'+K.line('chev','#fff',2.6)+'</div></div></div>';
 }
 function ringSvg(p,col,full){
  const R=40,C=2*Math.PI*R,d=Math.max(0,Math.min(1,p))*C;
  return '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" fill="rgba(24,18,10,.42)"/><circle cx="50" cy="50" r="'+R+'" fill="none" stroke="rgba(236,230,218,.42)" stroke-width="8"/>'
   +(d>0?'<circle cx="50" cy="50" r="'+R+'" fill="none" stroke="'+col+'" stroke-width="8" stroke-linecap="'+(full?'butt':'round')+'" stroke-dasharray="'+f1(d)+' '+f1(C)+'" transform="rotate(-90 50 50)"/>':'')
   +rosette(29,22,1.05,'#3fae5a','#2a7d40')+'</svg>';
 }
 function roundupReady(){const P=$('eventsPanel');return !!(P&&P.querySelector('button[data-round="go"]'));}
 function paintPromos(s,feat){
  const wk=(s.weekly&&s.weekly.rib)||{}, n=Object.values(wk).reduce((a,b)=>a+(+b||0),0);
  const tiers=T.WEEK_TIERS||[], ready=tiers.some((t,i)=>!((s.weekly&&s.weekly.claimed)||{})[i]&&n>=t[0]);
  $('sevWeek').innerHTML='<div class="pr-h">Weekly Events!</div><div class="pr-art">'+trophySvg()+'</div>'
   +'<div class="pr-b"><b>'+(ready?'A prize is waiting!':'Featured this week')+'</b><span>'+feat.length+' featured events pay half as much again. '+n+'/'+((tiers[tiers.length-1]||[16])[0])+' ribbons won.</span></div>'
   +'<button class="se-gold" data-sev="week">View</button>';
  const sp=$('eventsPanel')&&$('eventsPanel').querySelector('#snSpecialCard'), el=$('sevSpecial');
  if(sp&&sp.querySelector('.claimBtn')){const t=((sp.querySelector('.ph b')||{}).textContent||'Special event').trim();el.style.display='';el.textContent=t;el.title=((sp.querySelector('.ph span')||{}).textContent||'').trim();}
  else el.style.display='none';
 }
 function trophySvg(){
  return '<svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sevTg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffe9a0"/><stop offset=".5" stop-color="#f0c040"/><stop offset="1" stop-color="#b8831d"/></linearGradient></defs>'
   +'<g fill="#fff6d0" opacity=".85"><path d="'+starPath(18,26,6,2.4)+'"/><path d="'+starPath(102,18,5,2)+'"/><path d="'+starPath(96,70,4,1.6)+'"/><path d="'+starPath(22,84,4,1.6)+'"/></g>'
   +'<path d="M38 22h44v26a22 22 0 0 1-44 0z" fill="url(#sevTg)" stroke="#8a5e12" stroke-width="2"/><path d="M38 28H26a10 10 0 0 0 12 16M82 28h12a10 10 0 0 1-12 16" fill="none" stroke="#c8962a" stroke-width="4"/>'
   +'<path d="M55 70h10v14H55z" fill="#d7a633"/><path d="M44 84h32l4 10H40z" fill="url(#sevTg)" stroke="#8a5e12" stroke-width="1.6"/><path d="M36 94h48v10H36z" fill="#6b3f1f"/>'
   +'<path d="M50 34a10 10 0 0 0 4 20" fill="none" stroke="#fff6cf" stroke-width="3" stroke-linecap="round" opacity=".8"/>'
   +rosette(6,100,0.8,'#3f7fd6','#2a5aa0')+rosette(82,100,0.8,'#d63f3f','#a02a2a')+'</svg>';
 }
 function paintResume(){
  const P=$('eventsPanel'), el=$('sevResume'), b=P&&P.querySelector('[data-fx="lad:resume"]');
  if(!b){el.style.display='none';return;}
  const row=b.closest('.evrow'); const txt=row?((row.querySelector('.ladCard')||{}).textContent||''):'';
  el.style.display='';el.innerHTML='<span>⏪ '+esc(txt.split('.')[0]||'An unfinished round')+'</span><button class="se-gold" data-sev="resume">Pick it up</button><button class="se-cream" data-sev="drop">Let it go</button>';
 }
 function move(d){const T0=TW[st.town];if(!T0)return;const c=clamp((st.cur[T0.name]||0)+d,0,T0.evs.length-1);if(c===st.cur[T0.name])return;st.cur[T0.name]=c;paint();}

 /* ---- the event page ---- */
 function openPage(ev){st.page=ev.id;st.tab='event';const s=S();st.diff=ev.special?null:(s.evDiff==null?1:s.evDiff);root.classList.add('page');paintPage();}
 function evById(id){if(!id)return null;const sp=specials().find(e=>e.id===id);return sp||T.EVENTS3.find(e=>e.id===id)||null;}
 function paintPage(){
  const ev=evById(st.page); if(!ev){st.page=null;root.classList.remove('page');paint();return;}
  const s=S(), disc=discOf(ev), D=DISC[disc]||DISC.jump, g=gate(ev), lk=townLock(ev.town), h=ridden(), lvl=h.level||1;
  strip.setTitle(ev.name,(ev.town||'')+' · '+D.t,'events');
  const page=$('sevPage');
  let side='<div class="sev-side"><button class="on" data-sev="tab:event">'+K.line('events','currentColor',2)+'Event</button>'
   +(ev.special?'':'<button data-sev="tab:board">'+K.line('podium','currentColor',2)+'Board</button><button data-sev="tab:card">'+K.line('info','currentColor',2)+'Full card</button>')+'</div>';
  let main='<div class="sev-main"><div class="sev-ptitle">'+esc(D.t)+'</div>';
  if(ev.special==='drill'){
   const P=$('eventsPanel'), btns=P?[...P.querySelectorAll('button[data-drill]')]:[];
   main+='<div class="sev-plaque">'+esc(h.name||'Your horse')+' · Lv '+lvl+'</div><div class="sev-blurb">'+esc(ev.blurb)+'</div><div class="sev-stats">'
    +(T.STAT_KEYS||[]).map(k=>{const b=btns.find(x=>x.dataset.drill===k);const at=(h.stats&&h.stats[k])||0;
     return b?'<button class="se-cream" data-sev="drill:'+k+'"><span>'+esc(statLbl(k))+'</span><b>'+esc((b.textContent.match(/\d+\/\d+/)||[at])[0])+'</b></button>'
      :'<button class="se-cream" disabled><span>'+esc(statLbl(k))+'</span><b>maxed</b></button>';}).join('')+'</div></div>';
  }else if(ev.special==='roundup'){
   const ready=roundupReady();
   main+='<div class="sev-plaque">Home pasture</div><div class="sev-prow"><div class="sev-map">'+snapImg(venueView(ev),'')+'</div></div><div class="sev-blurb">'+esc(ev.blurb)+'</div>'
    +'<div class="sev-pbar"><span><span class="pb-k">Pays</span><span class="pb-v">130 coins a horse</span></span><span class="pb-req"></span>'
    +'<button class="se-gold" data-sev="round"'+(ready?'':' disabled')+'>'+(ready?'Start':'Not yet')+'</button></div></div>';
  }else{
   const rb=ribbonsOf(ev,s), DF=DIFFS(), di=clamp(st.diff==null?1:st.diff,0,DF.length-1), d=DF[di];
   const dLock=d.lvlAdd&&lvl<ev.lvl+d.lvlAdd;
   const mv=mapView(ev), me=K.snap(mv);
   const bits=ev.n?(ev.n+' fences'+(ev.laps>1?' × '+ev.laps+' laps':'')):ev.dressage?(ev.kind==='show'?'turnout and figures':'dressage test'):(routeOf(ev)?routeOf(ev).length+' gates':'');
   main+='<div class="sev-plaque">Lv '+ev.lvl+(bits?' · '+esc(bits):'')+'</div>';
   main+='<div class="sev-prow"><div class="sev-map">'+snapImg(mv,'')+'<svg class="sev-course" id="sevCourse" viewBox="0 0 1000 625" preserveAspectRatio="xMidYMid slice"></svg></div><div class="sev-diffs">'
    +DF.map((x,i)=>{const l=x.lvlAdd&&lvl<ev.lvl+x.lvlAdd;const pay=Math.round((ev.reward||0)*x.rewMul*(featured().includes(ev.id)?1.5:1));
     return '<button class="sev-diff'+(i===di?' on':'')+(l?' lock':'')+'" data-sev="diff:'+i+'"><span class="d-ic">'+esc(x.icon||'')+'</span><span><span class="d-t">'+esc(x.label)+'</span>'
      +'<span class="d-s">'+esc(l?('Opens at Lv '+(ev.lvl+x.lvlAdd)):(x.desc||''))+'</span><span class="d-rib">'+[0,1,2,3].map(k=>ribbonMini(k<rb.per[i],k===3)).join('')+'</span></span>'
      +'<span class="d-pay">'+K.COIN+fmt(pay)+'</span></button>';}).join('')+'</div></div>';
   main+='<div class="sev-ribs">'+[0,1,2,3].map(k=>'<span class="rs'+(k<rb.per[di]?'':' off')+'" title="'+(k<3?['Finish','Two stars','Three stars'][k]:'Gold: 95% accuracy, nothing down')+'">'+(k<3?K.RIBBON('#3fae5a','#2a7d40'):K.RIBBON('#e6b53a','#b8831d'))+'</span>').join('')+'</div>';
   let tA=0; try{tA=G.course.eventTimeAllowed?G.course.eventTimeAllowed(ev,di):0;}catch(e){}
   const best=(s.bestTimes||{})[ev.id], bestS=ev.dressage?((s.bestScore||{})[ev.id]||(s.showBest||{})[ev.id]):null;
   const stats=G.xp.statBreakdown?G.xp.statBreakdown(h):{total:G.xp.effStats(h),base:h.stats||{},tack:{}};
   const req=[['level',ev.lvl+(d.lvlAdd||0)]].concat(Object.entries(ev.req||{})).map(([k,need])=>{
    const have=k==='level'?lvl:(stats.total[k]||0),label=k==='level'?'Level':statLbl(k).replace(/^\S+\s/,'');
    const detail=k==='level'?'':('<small>'+esc(stats.base[k]||0)+' trained'+((stats.tack[k]||0)>0?' + '+esc(stats.tack[k])+' tack':'')+'</small>');
    return '<span class="'+(have>=need?'ok':'bad')+'">'+esc(label)+' <b>'+esc(have)+' / '+esc(need)+'</b>'+detail+'</span>';
   }).join('');
   const why=lk?lk:!g.ok?('Needs '+needText(g.missing)):dLock?(d.label+' opens at Lv '+(ev.lvl+d.lvlAdd)):'';
   main+='<div class="sev-horse"><b>'+esc(h.name||'Your horse')+'</b><span>Entry checks: current / required. Stats include equipped tack.</span></div>';
   main+='<div class="sev-pbar"><span><span class="pb-k">Time allowed</span><span class="pb-v">'+(tA?tSec(tA):'—')+(ev.laps>1?' ('+ev.laps+' laps)':'')+'</span></span>'
    +'<span><span class="pb-k">Personal best</span><span class="pb-v">'+(best?tBest(best):bestS?Math.round((bestS>1?bestS:bestS*100))+'%':'--:--')+'</span></span>'
    +'<span class="pb-req">'+req+'</span>'
    +'<button class="se-gold" data-sev="ride"'+(why?' disabled title="'+esc(why)+'"':'')+'>'+(why?'Locked':'Ride')+'</button></div></div>';
   me.fns.push(()=>drawCourse(ev,mv));
   setTimeout(()=>drawCourse(ev,mv),0);
  }
  page.innerHTML=side+main;
 }
 function ribbonMini(on,gold){return '<svg viewBox="0 0 40 48" style="opacity:'+(on?1:.3)+'">'+K.RIBBON(gold?'#e6b53a':'#3fae5a',gold?'#b8831d':'#2a7d40').replace(/^<svg[^>]*>|<\/svg>$/g,'')+'</svg>';}
 function drawCourse(ev,mv){
  const svg=$('sevCourse'), e=K.snaps.get(mv.key); if(!svg||!e||!e.pts)return;
  const P=e.pts.map(p=>[p[0]*1000,p[1]*625]);
  let s='';
  if(mv.kind==='route'){
   const d='M'+P.map(p=>f1(p[0])+' '+f1(p[1])).join('L');
   s+='<path d="'+d+'" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="11" stroke-linejoin="round" stroke-linecap="round"/><path d="'+d+'" fill="none" stroke="#fff" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="1 0"/>';
   P.forEach((p,i)=>{s+='<circle cx="'+f1(p[0])+'" cy="'+f1(p[1])+'" r="15" fill="'+(i===0?'#23703a':i===P.length-1?'#b3362a':'#26245e')+'" stroke="#fff" stroke-width="3"/><text x="'+f1(p[0])+'" y="'+f1(p[1]+5.5)+'" text-anchor="middle" font-family="Nunito,system-ui,sans-serif" font-weight="900" font-size="15" fill="#fff">'+(i===0?'S':i+'')+'</text>';});
  }else if(mv.kind==='fences'){
   const d='M'+P.map(p=>f1(p[0])+' '+f1(p[1])).join('L')+'Z';
   s+='<path d="'+d+'" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="9" stroke-linejoin="round"/><path d="'+d+'" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="14 9" stroke-linejoin="round"/>';
   P.forEach((p,i)=>{s+='<circle cx="'+f1(p[0])+'" cy="'+f1(p[1])+'" r="17" fill="#1f5f8f" stroke="#fff" stroke-width="3"/><text x="'+f1(p[0])+'" y="'+f1(p[1]+6)+'" text-anchor="middle" font-family="Nunito,system-ui,sans-serif" font-weight="900" font-size="17" fill="#fff">'+(i+1)+'</text>';});
  }else{
   const d='M'+P.map(p=>f1(p[0])+' '+f1(p[1])).join('L')+'Z';
   s+='<path d="'+d+'" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="9"/><path d="'+d+'" fill="none" stroke="#fff" stroke-width="4"/>';
   const c=P.reduce((a,p)=>[a[0]+p[0]/P.length,a[1]+p[1]/P.length],[0,0]);
   ['A','K','E','H','C','M','B','F'].forEach((L,i)=>{const p=P[Math.round(i/8*P.length)%P.length];const x=c[0]+(p[0]-c[0])*1.16,y=c[1]+(p[1]-c[1])*1.16;
    s+='<rect x="'+f1(x-13)+'" y="'+f1(y-13)+'" width="26" height="26" rx="4" fill="#f8f3e6" stroke="#22345e" stroke-width="2"/><text x="'+f1(x)+'" y="'+f1(y+6)+'" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="16" fill="#22345e">'+L+'</text>';});
  }
  svg.innerHTML=s;
 }

 /* ---- the week's sheet ---- */
 function paintSheet(){
  const s=S(), wk=s.weekly||{}, rib=wk.rib||{}, claimed=wk.claimed||{}, n=Object.values(rib).reduce((a,b)=>a+(+b||0),0), tiers=T.WEEK_TIERS||[];
  const fe=featured().map(id=>T.EVENTS3.find(e=>e.id===id)).filter(Boolean);
  const now=new Date(), day=(now.getDay()+6)%7, left=(7-day)*24*3600e3-(now.getHours()*3600e3+now.getMinutes()*60e3);
  const dd=Math.floor(left/864e5), hh=Math.floor(left%864e5/36e5);
  const P=$('eventsPanel');
  const rw=r=>[r.c?fmt(r.c)+' coins':'',r.g?r.g+' gems':'',r.k?r.k+(r.k>1?' keys':' key'):'',r.gear?r.gear+' tack':''].filter(Boolean).join(' · ');
  const max=(tiers[tiers.length-1]||[16])[0];
  $('sevSheet').innerHTML='<div class="sev-sbox"><div class="sev-sh"><b>Weekly Events</b><span>'+K.line('hourglass','#fff',2)+'Resets in '+dd+'d '+hh+'h</span><button class="se-circ" data-sev="sheetx" aria-label="Close">'+K.line('close','#fff',2.8)+'</button></div>'
   +'<div class="sev-fe">'+fe.map(ev=>{const w=rib[ev.id]||0,g=gate(ev);return '<div>'+ticketSvg(ev,{town:ev.town,ribbons:Math.min(3,w),lock:!g.ok})+'<b>'+esc(shortName(ev))+'</b><span>'+w+'/4 ribbons this week</span>'
     +'<button class="'+(g.ok?'se-gold':'se-cream')+'" data-sev="open:'+esc(ev.id)+'">'+(g.ok?'Ride':'See')+'</button></div>';}).join('')+'</div>'
   +'<div class="sev-wbar"><i style="width:'+Math.min(100,n/max*100).toFixed(1)+'%"></i></div>'
   +'<div class="sev-tiers">'+tiers.map((t,i)=>{const done=!!claimed[i],ready=!done&&n>=t[0],has=P&&P.querySelector('button[data-wk="'+i+'"]');
     return '<div class="sev-tier'+(done?' done':ready?' ready':'')+'"><span class="t-n">'+t[0]+'</span><span>ribbons</span><span>'+esc(rw(t[1]||{}))+'</span>'
      +(done?'<span>✓ Claimed</span>':ready&&has?'<button class="se-gold" data-sev="wk:'+i+'">Claim</button>':'<span>'+Math.max(0,t[0]-n)+' to go</span>')+'</div>';}).join('')+'</div></div>';
 }

 /* ---- input ---- */
 root.addEventListener('click',e=>{
  const b=e.target.closest('[data-sev],[data-town],[data-card]'); if(!b||!root.contains(b))return;
  if(b.dataset.town!=null){const t=TW[+b.dataset.town];if(t){st.townName=t.name;paint();const lk=townLock(t.name);if(lk)G.toast('🔒 '+lk);}return;}
  if(b.dataset.card!=null&&!b.dataset.sev){const T0=TW[st.town],i=+b.dataset.card;if(!T0)return;
   if(i!==st.cur[T0.name]){st.cur[T0.name]=i;paint();return;}
   const ev=T0.evs[i];if(ev)openPage(ev);return;}
  const [k,a]=String(b.dataset.sev).split(/:(.*)/);
  const P=$('eventsPanel');
  const via=sel=>{const x=P&&P.querySelector(sel);if(x){x.click();return true;}return false;};
  if(k==='prev')move(-1); else if(k==='next')move(1);
  else if(k==='dot'){const T0=TW[st.town];if(T0){const c=clamp(+a,0,T0.evs.length-1);if(c!==st.cur[T0.name]){st.cur[T0.name]=c;paint();}}}
  else if(k==='week'){paintSheet();root.classList.add('sheet');}
  else if(k==='sheetx')root.classList.remove('sheet');
  else if(k==='wk'){via('button[data-wk="'+a+'"]');setTimeout(()=>{if(st.on){paintSheet();paint();}},120);}
  else if(k==='open'){root.classList.remove('sheet');const ev=evById(a);if(ev){const t=TW.findIndex(x=>x.name===(ev.town||'Meadowlark Ranch'));if(t>=0){st.townName=TW[t].name;st.cur[TW[t].name]=Math.max(0,TW[t].evs.indexOf(ev));}openPage(ev);}}
  else if(k==='special'){const x=P&&P.querySelector('#snSpecialCard .claimBtn');if(x)x.click();}
  else if(k==='ladder'){K.setBack('lbPanel',()=>{const eb=$('eventsBtn');if(eb)eb.click();});if(!via('[data-fx="lad:boards"]')){G.hidePanels();const lb=$('lbBtn');if(lb)lb.click();}}
  else if(k==='classic'){K.classic('eventsPanel',()=>{const eb=$('eventsBtn');if(eb)eb.click();});}
  else if(k==='resume')via('[data-fx="lad:resume"]');
  else if(k==='drop'){via('[data-fx="lad:drop"]');setTimeout(paintResume,150);}
  else if(k==='tab'){
   const ev=evById(st.page); if(!ev)return;
   const again=()=>{const eb=$('eventsBtn');if(eb){eb.click();setTimeout(()=>openPage(ev),40);}};
   if(a==='board'){G.hidePanels();K.setBack('lbPanel',again);setTimeout(()=>{const lb=$('lbBtn');if(lb)lb.click();},30);}
   else if(a==='card'){
    K.setBack('ev2CardPanel',again);
    if(!via('[data-fx="ev2:card:'+ev.id+'"]')){
     K.setBack('ev2CardPanel',null);K.setBack('resultPanel',again);
     if(!via('[data-fx="lad:why:'+ev.id+'"]')){K.setBack('resultPanel',null);G.toast('ℹ️ '+(ev.blurb||ev.name));}
    }
   }
  }
  else if(k==='diff'){st.diff=+a;G.save.sync(s=>{s.evDiff=+a;});paintPage();}
  else if(k==='ride'){const ev=evById(st.page);if(ev)ride(ev,st.diff==null?1:st.diff);}
  else if(k==='round'){if(!via('button[data-round="go"]'))G.toast('🐎 The roundup is not ready yet.');}
  else if(k==='drill'){if(!via('button[data-drill="'+a+'"]'))G.toast('🎯 That stat is already as high as it can go.');}
 });
 function ride(ev,di){
  const P=$('eventsPanel'), i=T.EVENTS3.indexOf(ev);
  const btn=P&&(P.querySelector('button[data-ev="'+i+':'+di+'"]')||P.querySelector('button[data-ev="'+i+'"]'));
  st.page=null; root.classList.remove('page');
  if(btn){btn.click();return;}
  try{G.hidePanels();G.course.startCourse(ev,di);}catch(e){console.error('se-events ride',e);}
 }
 /* a swipe moves the carousel */
 {let x0=null,t0=0;const stage=$('sevStage');
  stage.addEventListener('pointerdown',e=>{x0=e.clientX;t0=performance.now();});
  stage.addEventListener('pointerup',e=>{if(x0==null)return;const dx=e.clientX-x0;x0=null;if(Math.abs(dx)>50&&performance.now()-t0<800){move(dx<0?1:-1);e.stopPropagation();}},true);}
 G.on('key',e=>{
  if(!st.on)return false;
  const c=e.code;
  if(root.classList.contains('sheet')||st.page){if(c==='ArrowLeft'||c==='ArrowRight')return true;return false;}
  if(c==='ArrowLeft'||c==='KeyA'){move(-1);return true;}
  if(c==='ArrowRight'||c==='KeyD'){move(1);return true;}
  if(c==='Enter'){const T0=TW[st.town];const ev=T0&&T0.evs[st.cur[T0.name]||0];if(ev)openPage(ev);return true;}
  if(c==='ArrowUp'||c==='ArrowDown'||c==='KeyW'||c==='KeyS'||c==='Space')return true;
  return false;
 });
 G.on('escape',()=>{if(!st.on)return false;if(root.classList.contains('sheet')){root.classList.remove('sheet');return true;}if(st.page){st.page=null;root.classList.remove('page');paint();return true;}return false;});
 G.on('wallet',()=>{if(st.on)strip.paint();});
 G.on('courseStart',()=>{if(st.on){st.page=null;root.classList.remove('page','sheet');const P=$('eventsPanel');if(P)P.style.display='none';}});   // only this screen closes: a card a discipline opens at the start (the judge's card) stays up
 G.on('state',o=>{o.seEvents={on:st.on,town:st.townName||null,card:st.on&&TW[st.town]?(TW[st.town].evs[st.cur[TW[st.town].name]||0]||{}).id:null,page:st.page,sheet:root.classList.contains('sheet'),
  towns:TW.map(t=>({name:t.name,n:t.evs.length,lock:!!townLock(t.name)}))};});
 G.seEvents={open:()=>{const b=$('eventsBtn');if(b)b.click();},openPage:id=>{const ev=evById(id);if(ev)openPage(ev);},move,paint,ticketSvg,horseSvg,scene,towns,venueView,mapView,state:st};
}
