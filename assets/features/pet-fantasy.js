/* Feature package 'pet-fantasy' — the fantasy pets: the Emberling (a baby dragon), the Mossglow Fawn, the
   Cinder Chick, the Canyon Wyvern and the Gryphling (a griffin cub).

   Each one is a species sheet for pet-models.js (G.petModels.addSpecies), so the follow, the flight, the
   idles and the camera logic are the ones every pet uses. The Emberling, the Mossglow Fawn and the wyvern
   also have a real animal's body in assets/models/pets/manifest.json (the European Dragon by Regina Cachoa,
   Fawn_A1 by Assets_Animated and the Prowler Dragon Variant Rig by DM-913, all CC BY 4.0, credited in
   assets/models/pets/ATTRIBUTION.md; the wyvern's flight and idle were animated here); the drawn body here
   is what shows while that model loads, and for good if it cannot be used. The Cinder Chick is drawn only:
   the game's own chick in flame-coloured down, with a crest and tail plumes of flame; so is the Gryphling.

   The effects are laid on the pet's root, so they stay with the real body when it takes over:
     · Emberling: a warm glow under the throat and belly, a sneeze now and then when it sniffs (a puff of
       smoke and a few sparks from the nose), a thin trail of embers behind it in the air; it flutters low
       beside the horse when its legs cannot keep up, and flies with its own Fly clip beside a winged horse;
     · Mossglow Fawn: glowing spots along its back, fireflies that drift round it, petals that fall from
       its hooves when it bounds;
     · Cinder Chick: a flickering flame crest, embers rising off it, an ember trail in flight and a burst of
       sparks when it lands.
   Portraits for the menus go through G.petArt.add. The PETS3 rows (name, rarity, where it comes from)
   are in market-summon-keys-pets.js. Nothing runs at import time. */
export const id='pet-fantasy';
export function install(G){
 const THREE=G.THREE,PM=G.petModels;
 if(!THREE||!PM||!PM.addSpecies||!PM.kit)return;
 const K=PM.kit,TAU=Math.PI*2;
 const mirror=list=>{const out=[];for(const p of list){if(p[0]&&p[9]!=='one'){out.push(p.slice(0,9));const q=p.slice(0,9);q[0]=-q[0];out.push(q);}else out.push(p.slice(0,9));}return out;};
 const clamp=(v,a,b)=>v<a?a:v>b?b:v;

 /* ---------------------------------------------------------------- small effects kit ----------
    Points with a colour per point (additive: a black point is invisible, so each one fades on its own),
    in the pet's own frame or in the world (a trail left behind in the air). */
 const _v=new THREE.Vector3(),_w=new THREE.Vector3();
 function points(n,size,world){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(n*3),3));
  const m=new THREE.PointsMaterial({map:K.glowTex(),size,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,sizeAttenuation:true});
  const o=new THREE.Points(g,m);o.frustumCulled=false;o.name='pet-fx';o.userData.world=!!world;
  return {o,n,pos:g.attributes.position,col:g.attributes.color,vel:new Float32Array(n*3),life:new Float32Array(n),max:new Float32Array(n).fill(1),rgb:new Float32Array(n*3),next:0};
 }
 function spawn(p,x,y,z,vx,vy,vz,life,c){const i=p.next;p.next=(p.next+1)%p.n;p.pos.setXYZ(i,x,y,z);p.vel[i*3]=vx;p.vel[i*3+1]=vy;p.vel[i*3+2]=vz;p.life[i]=life;p.max[i]=life;p.rgb[i*3]=c.r;p.rgb[i*3+1]=c.g;p.rgb[i*3+2]=c.b;}
 function stepPts(p,dt,grav,drag,flick,t){
  for(let i=0;i<p.n;i++){if(p.life[i]<=0){p.col.setXYZ(i,0,0,0);continue;}p.life[i]-=dt;const u=clamp(p.life[i]/p.max[i],0,1);
   p.vel[i*3+1]+=grav*dt;const d=Math.exp(-drag*dt);p.vel[i*3]*=d;p.vel[i*3+1]*=d;p.vel[i*3+2]*=d;
   p.pos.setXYZ(i,p.pos.getX(i)+p.vel[i*3]*dt,p.pos.getY(i)+p.vel[i*3+1]*dt,p.pos.getZ(i)+p.vel[i*3+2]*dt);
   const k=Math.min(1,u*2.2)*(flick?0.75+0.25*Math.sin(t*23+i*7.1):1);p.col.setXYZ(i,p.rgb[i*3]*k,p.rgb[i*3+1]*k,p.rgb[i*3+2]*k);}
  p.pos.needsUpdate=true;p.col.needsUpdate=true;}
 /* a world-space effect goes into the scene with the pet and leaves with it */
 function attachWorld(P,fx){P.group.addEventListener('added',()=>{if(!fx.o.parent&&G.scene)G.scene.add(fx.o);});P.group.addEventListener('removed',()=>{if(fx.o.parent)fx.o.parent.remove(fx.o);});}
 function glowSprite(c,op,sx,sy){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:K.glowTex(),color:c,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,opacity:op}));s.scale.set(sx,sy||sx,1);s.name='pet-fx';return s;}
 /* where the head is now: the real body's head bone when it is showing, else the drawn head */
 function headWorld(P,out){const R=P.real;const b=R&&R.state==='ready'&&R.inst&&R.inst.bones&&R.inst.bones.head&&P.bodyPivot.visible===false?R.inst.bones.head:P.headGroup;b.getWorldPosition(out);return out;}
 const realOn=P=>!!(P.real&&P.real.state==='ready'&&P.bodyPivot.visible===false);

 /* ================================================================ Emberling ================== */
 const ER='#b8432a',ER2='#8e2a1c',EB='#f2b05a',ESP='#6a1c12';
 PM.addSpecies('emberling',{kind:'quad',h:.7,len:.62,w:.3,piv:.3,K:.045,cadence:1.3,
  body:mirror([[0,.30,.10,.12,1,.95,1.15,ER],[0,.31,-.10,.12,1,.95,1.1,ER],[0,.41,.18,.068,1,1.15,1,ER],
   [0,.2,.06,.11,1,.62,1.7,EB,1],[0,.37,.22,.065,1,1,.8,EB,1],[0,.43,-.02,.05,.35,.9,2.6,ESP,1]]),
  head:{at:[0,.5,.26],prims:mirror([[0,0,0,.095,1,.9,1.05,ER],[0,-.022,.1,.052,.85,.68,1.55,ER],[.042,.05,-.02,.032,1,1,1,ER2],[0,-.05,.1,.05,.8,.5,1.4,EB,1]])},
  eyes:{r:.026,yaw:.52,pitch:.22,o:[0,.012,0],iris:'#ffc21a',pupil:'slit'},
  nose:{o:[0,-.012,.12],d:[0,.1,1],s:[.013,.009,.009],c:'#4a140c',rough:.5},
  horns:{c:'#f1d7a8',h:.11,tilt:.95},
  legs:{hipY:.22,x:.08,zF:.12,zH:-.12,ru:.037,rl:.03,cu:ER,cl:ER,paw:{sx:.036,sy:.022,sz:.05,c:'#4a1a12'}},
  tail:{at:[0,.3,-.21],rest:.35,segs:[[.15,.046,ER,1,1,.08],[.14,.034,ER2,1,1,.1],[.11,.022,ER2,1,1,-.12]],wagHz:.8,wag:.3},
  wings:{round:true,arm:.17,hand:.21,chord:.17,top:ER2,under:'#f08a4a',tip:ESP,folded:[.03,.085,.14],foldAt:[.1,.4,-.02],foldC:ER2,at:[.1,.43,.02],
   hz:2.2,climbHz:3,amp:.9,glide:'bursts',pitchFly:.35,omega:3.2,stagger:.1,boxX:3.4,skim:1.0},
  shadow:[.22,.42],idles:[['sit',3],['sniff',2],['look',2],['tilt',1]],
  build(P,root){
   const glow=glowSprite('#ff7a2a',0.3,.34,.26);glow.position.set(0,.26,.1);root.add(glow);P.extra.fireGlow=glow;
   const sp=points(24,.045,false);root.add(sp.o);P.extra.sneeze=sp;
   const tr=points(40,.05,true);attachWorld(P,tr);P.extra.trail=tr;
   const sm=glowSprite('#9a8f86',0,.12);sm.material.blending=THREE.NormalBlending;root.add(sm);P.extra.smoke=sm;P.extra.smokeT=0;},
  fx(P,c,st,dt,t,o){
   const E=P.extra,g=E.fireGlow;
   if(g){g.material.opacity=0.22+0.08*Math.sin(t*3.1)+0.04*Math.sin(t*7.3);g.position.y=o.flying?.26:(.24+(st.q?st.q.by:0));}
   /* the sneeze: halfway through a sniff, smoke and a few sparks out of the nose */
   const I=st.idle;
   if(I&&I.name==='sniff'&&!I.sneezed&&I.u>0.55){I.sneezed=true;headWorld(P,_v);P.group.worldToLocal(_v);const f=_w.set(0,0,1);
    for(let k=0;k<5;k++)spawn(E.sneeze,_v.x,_v.y-.01,_v.z+.1,(Math.random()-.5)*.5,.25+Math.random()*.4,.6+Math.random()*.5,.5+Math.random()*.3,new THREE.Color(k%2?'#ffd24a':'#ff6a1a'));
    E.smoke.position.set(_v.x,_v.y,_v.z+.12);E.smokeT=1;}
   stepPts(E.sneeze,dt,-1.2,1.5,true,t);
   if(E.smokeT>0){E.smokeT=Math.max(0,E.smokeT-dt*1.1);const u=1-E.smokeT;E.smoke.material.opacity=0.5*E.smokeT;E.smoke.scale.setScalar(.08+u*.3);E.smoke.position.y+=dt*.25;E.smoke.position.z+=dt*.15;}
   /* embers trailing behind it in the air (in the world, so they stay where they were shed) */
   const tr=E.trail;if(tr){if(!tr.o.parent&&P.group.parent&&G.scene)G.scene.add(tr.o);
    if(o.flying||st.skim>0.08){E.trT=(E.trT||0)-dt;if(E.trT<=0){E.trT=0.07;_v.set((Math.random()-.5)*.08,.22,-.2).applyMatrix4(P.group.matrixWorld);spawn(tr,_v.x,_v.y,_v.z,(Math.random()-.5)*.2,-.1-Math.random()*.2,(Math.random()-.5)*.2,.6+Math.random()*.4,new THREE.Color(Math.random()<.5?'#ff7a1a':'#ffc040'));}}
    stepPts(tr,dt,-.4,1,true,t);}
  },
 });

 /* ================================================================ Canyon Wyvern ============== */
 /* the drawn body is the Emberling's in canyon colours; the real one (the Prowler, by DM-913) walks with its
    own prowl and flies with a flap and an idle Meadowlark Ranch animated on its wing bones */
 {const src=JSON.stringify(Object.assign({},PM.SPECIES.emberling,{build:null,fx:null}));
  const map={'#b8432a':'#b99a6a','#8e2a1c':'#7c5c3a','#f2b05a':'#efe0bc','#6a1c12':'#5a3e26','#4a1a12':'#3a2a1e','#f08a4a':'#d9c091','#4a140c':'#2a1d16','#ffc21a':'#e8d24a','#f1d7a8':'#e9e2cf'};
  const W=JSON.parse(src.replace(/#[0-9a-f]{6}/g,c=>map[c]||c));delete W.build;delete W.fx;
  W.h=.55;W.idles=[['look',3],['sniff',2],['tilt',1]];W.realGait={rateHi:3};
  Object.assign(W.wings,{skim:.9,skimH:.5,hz:1.6,climbHz:2.2,glide:'bursts'});
  PM.addSpecies('wyvern',W);}

 /* ================================================================ Gryphling ================== */
 /* a griffin cub, drawn: an eagle's white head and hooked beak, a lion cub's golden body and tufted tail,
    feathered wings; golden dust when it takes off. (The realistic Cragle body is not in yet: its file has
    no walk.) */
 const GG='#c9a24a',GB='#f0dca0',GW='#f6f0e2',GD='#8a6424';
 PM.addSpecies('gryphling',{kind:'quad',h:.6,len:.56,w:.28,piv:.3,K:.045,cadence:1.25,
  body:mirror([[0,.30,.10,.115,1,.95,1.1,GG],[0,.31,-.10,.115,1,.95,1.05,GG],[0,.40,.17,.075,1,1.15,1,GW],[0,.2,.04,.11,1,.6,1.7,GB,1],[0,.37,.2,.075,1.05,1,.9,GW,1]]),
  head:{at:[0,.5,.25],prims:mirror([[0,0,0,.092,1,.95,1.05,GW],[.04,.05,-.03,.03,1,1,1,GW],[0,.075,.02,.05,1.1,.5,1.1,'#e6d8b8',1]])},
  eyes:{r:.027,yaw:.5,pitch:.18,o:[0,.015,0],iris:'#f0a020'},
  beak:{c:'#e8b43a'},
  legs:{hipY:.22,x:.08,zF:.12,zH:-.12,ru:.036,rl:.029,cu:GG,cl:'#e8b43a',paw:{sx:.036,sy:.022,sz:.05,c:'#b8862e'}},
  tail:{at:[0,.32,-.21],rest:.9,segs:[[.16,.02,GG,1,1,.25],[.08,.032,GD,1,1,0]],wagHz:1,wag:.35},
  wings:{arm:.19,hand:.25,chord:.17,top:'#b8862e',under:GW,tip:'#6a4a1e',folded:[.04,.1,.15],foldAt:[.1,.4,-.03],foldC:'#b8862e',foldRx:-.2,at:[.1,.43,.01],
   hz:3,climbHz:4,amp:.9,glide:'bursts',pitchFly:.4,omega:3.2,stagger:.1,boxX:3.4,skim:4.2},
  shadow:[.21,.4],idles:[['sit',2],['look',2],['pounce',1],['tilt',1],['sniff',1]],
  build(P,root){const d=points(24,.05,true);attachWorld(P,d);P.extra.dust=d;},
  fx(P,c,st,dt,t,o){const E=P.extra,d=E.dust;if(!d)return;if(!d.o.parent&&P.group.parent&&G.scene)G.scene.add(d.o);
   const up=st.air==='takeoff'&&E.lastAir!=='takeoff';E.lastAir=st.air;
   if(up){for(let k=0;k<18;k++){const a=k/18*TAU;_v.set(Math.cos(a)*.15,.05,Math.sin(a)*.15).applyMatrix4(P.group.matrixWorld);spawn(d,_v.x,_v.y,_v.z,Math.cos(a)*.8,.2+Math.random()*.5,Math.sin(a)*.8,.7+Math.random()*.4,new THREE.Color(k%2?'#ffd86a':'#fff0b0'));}}
   stepPts(d,dt,-.3,2.4,true,t);},
 });

 /* ================================================================ Mossglow Fawn ============== */
 const FF='#b98a5a',FC='#f4ead6',FS='#fff6d8';
 PM.addSpecies('mossfawn',{kind:'quad',h:.72,len:.56,w:.24,piv:.47,K:.04,cadence:1.15,
  body:mirror([[0,.46,.11,.11,1,1,1.1,FF],[0,.47,-.11,.11,1,1,1.05,FF],[0,.56,.17,.058,1,1.35,1,FF],[0,.4,0,.09,1,.5,1.7,FC,1],
   [.05,.565,.06,.03,1,1,1,FS,1],[.07,.55,-.07,.03,1,1,1,FS,1],[.08,.53,.13,.026,1,1,1,FS,1],[.04,.57,-.15,.026,1,1,1,FS,1]]),
  head:{at:[0,.66,.27],prims:mirror([[0,0,0,.08,.95,1,1.05,FF],[0,-.04,.085,.04,.85,.75,1.5,FF],[0,-.056,.11,.038,1,.7,1.3,FC,1]])},
  eyes:{r:.029,yaw:.56,pitch:.14,o:[0,.01,0]},
  nose:{o:[0,-.045,.11],d:[0,.1,1],s:[.014,.011,.011],c:'#2a1d16',rough:.4},
  ears:{type:'cone',yaw:1.05,pitch:.5,w:.045,len:.1,d:.018,c:FF,inner:'#f2d9c4',rz:.85},
  legs:{hipY:.41,x:.06,zF:.12,zH:-.12,ru:.03,rl:.021,cu:FF,cl:FF,knee:{r:.025,c:FF},paw:{sx:.02,sy:.02,sz:.03,c:'#3a2a1e'}},
  tail:{puff:{at:[0,.53,-.23],r:.04,c:FC,wig:true}},
  realGait:{trot:[.45,.95],run:[4.6,6.4],rateHi:7},   // it breaks into its bounding run early: its own walk covers little ground
  shadow:[.2,.36],idles:[['graze',2],['look',2],['pronk',1],['sniff',1],['lie',1]],
  build(P,root){
   const ff=points(8,.09,false);root.add(ff.o);P.extra.flies=ff;ff.ph=Array.from({length:8},(_,i)=>({a:i/8*TAU,r:.32+Math.random()*.2,y:.35+Math.random()*.4,s:.4+Math.random()*.5,b:Math.random()*TAU}));
   const pe=points(30,.05,true);attachWorld(P,pe);P.extra.petals=pe;
   /* glowing spots: soft lights on its back, placed on the real body's spine each frame (the drawn body has painted ones) */
   P.extra.spots=[];for(let i=0;i<6;i++){const s=glowSprite('#d8ffe2',0,.095);root.add(s);P.extra.spots.push(s);}},
  fx(P,c,st,dt,t,o){
   const E=P.extra,ff=E.flies,col=new THREE.Color();
   for(let i=0;i<ff.n;i++){const f=ff.ph[i];f.a+=dt*f.s*.6;const x=Math.cos(f.a)*f.r,z=Math.sin(f.a)*f.r*1.2,y=f.y+Math.sin(t*1.3+f.b)*.08;ff.pos.setXYZ(i,x,y,z);const k=Math.max(0,Math.sin(t*1.7+f.b*3))**2;col.set(i%3?'#d8ff7a':'#9dffb0').multiplyScalar(.25+.75*k);ff.col.setXYZ(i,col.r,col.g,col.b);}
   ff.pos.needsUpdate=true;ff.col.needsUpdate=true;
   /* petals from the hooves when it bounds */
   const pe=E.petals;if(pe){if(!pe.o.parent&&P.group.parent&&G.scene)G.scene.add(pe.o);
    if(!o.flying&&o.spd>2.2&&!st.swim){E.peT=(E.peT||0)-dt;if(E.peT<=0){E.peT=.09;_v.set((Math.random()-.5)*.15,.06,-.12-Math.random()*.1).applyMatrix4(P.group.matrixWorld);spawn(pe,_v.x,_v.y,_v.z,(Math.random()-.5)*.4,.3+Math.random()*.3,(Math.random()-.5)*.4,1+Math.random()*.6,new THREE.Color(Math.random()<.5?'#ffd6e8':'#fff7d6'));}}
    stepPts(pe,dt,-.35,2.2,false,t);}
   /* spots along the real fawn's back, breathing slowly */
   const R=P.real,on=realOn(P);
   if(on&&!E.spine){const B=[];R.inst.model.traverse(b=>{if(b.isBone&&/spine|pelvis/i.test(b.name)&&!/end/i.test(b.name))B.push(b);});E.spine=B.length?B:null;}
   for(let i=0;i<E.spots.length;i++){const s=E.spots[i];if(!on||!E.spine){s.visible=false;continue;}s.visible=true;
    const b=E.spine[Math.min(E.spine.length-1,Math.floor(i/2)%E.spine.length)];b.getWorldPosition(_v);P.group.worldToLocal(_v);
    s.position.set(_v.x+(i%2?.045:-.045),_v.y+.075,_v.z+(i>3?-.05:0));s.material.opacity=.42+.18*Math.sin(t*1.4+i*1.9);}
  },
 });

 /* ================================================================ Cinder Chick =============== */
 const chick=PM.SPECIES.chick;
 if(chick){const S=JSON.parse(JSON.stringify(chick));
  S.body=[[0,.21,0,.15,1,1,1,'#ff8a1a'],[0,.27,.03,.115,1,1,1,'#ffa21e'],[0,.15,.07,.13,1,.9,.9,'#ffd84a',1],[0,.3,-.06,.12,1,.6,1.1,'#e8521a',1]];
  S.tuft={c:'#ff4a14'};S.beak={c:'#f0c24a'};S.blush={c:'#ff5a3a',yaw:.72,pitch:-.05,s:.022};S.legs.c='#e0701e';
  Object.assign(S.wings,{top:'#ff7a1a',under:'#ffd24a',tip:'#d8321a',foldC:'#f06a1a'});
  S.glow={c:'#ff8a3a',emissive:'#ff4a08',ei:.22};S.sparkle={n:10,c:'#ffb040',size:.05};S.lift=0;
  S.build=(P,root)=>{
   /* a crest of flame on the head and three flame plumes for a tail, lit from inside */
   const fm=c=>K.geo('cinder-flame-'+c,()=>new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:.85,roughness:.6}));
   const crest=K.grp(P.headGroup,0,.1,.0);P.extra.crest=crest;
   for(const [x,h,a,c] of [[0,.075,0,'#ff5a14'],[-.02,.055,-.35,'#ff9a1a'],[.02,.055,.35,'#ff9a1a'],[0,.045,-.2,'#ffd84a']]){const m=K.mesh(K.CONE,fm(c),crest,x,0,a<0&&c==='#ffd84a'?-.02:0,.018,h,.012);m.rotation.z=-a;m.rotation.x=-.3;}
   const tail=K.grp(P.bodyPivot,0,.27-(S.piv||.21),-.13);P.extra.plumes=tail;
   for(const [a,c,h] of [[0,'#ff5a14',.11],[-.35,'#ff9a1a',.09],[.35,'#ff9a1a',.09]]){const m=K.mesh(K.CONE,fm(c),tail,0,0,0,.02,h,.012);m.rotation.set(-2.2,0,a);}
   if(P.extra.halo)P.extra.halo.visible=false;   // the big shared halo reads as an orange haze round a small bird: a small warm glow instead
   const glow=glowSprite('#ff7a2a',.2,.36,.32);glow.position.set(0,.22,0);root.add(glow);P.extra.fireGlow=glow;
   const tr=points(40,.05,true);attachWorld(P,tr);P.extra.trail=tr;P.extra.burst=points(16,.05,false);root.add(P.extra.burst.o);};
  S.fx=(P,c,st,dt,t,o)=>{const E=P.extra;
   if(E.crest){const k=1+.12*Math.sin(t*17)+.08*Math.sin(t*29);E.crest.scale.set(1,k,1);}
   if(E.plumes)E.plumes.rotation.x=.08*Math.sin(t*9);
   if(E.fireGlow)E.fireGlow.material.opacity=.16+.06*Math.sin(t*5.3);
   const tr=E.trail;if(tr){if(!tr.o.parent&&P.group.parent&&G.scene)G.scene.add(tr.o);
    if(o.flying){E.trT=(E.trT||0)-dt;if(E.trT<=0){E.trT=.05;_v.set((Math.random()-.5)*.06,.18,-.14).applyMatrix4(P.group.matrixWorld);spawn(tr,_v.x,_v.y,_v.z,(Math.random()-.5)*.15,-.05,(Math.random()-.5)*.15,.5+Math.random()*.4,new THREE.Color(Math.random()<.5?'#ff6a1a':'#ffd040'));}}
    stepPts(tr,dt,-.3,1,true,t);}
   /* a burst of sparks when it lands */
   const was=E.wasAir;E.wasAir=o.flying;if(was&&!o.flying){for(let k=0;k<14;k++){const a=k/14*TAU;spawn(E.burst,Math.cos(a)*.05,.05,Math.sin(a)*.05,Math.cos(a)*(.6+Math.random()*.5),.5+Math.random()*.6,Math.sin(a)*(.6+Math.random()*.5),.45+Math.random()*.3,new THREE.Color(k%2?'#ffd24a':'#ff6a1a'));}}
   stepPts(E.burst,dt,-2.5,2,true,t);};
  PM.addSpecies('cinderchick',S);}

 /* ================================================================ portraits ================== */
 const A=G.petArt;
 if(A&&A.add){
  A.add('emberling',
   '<path d="M40 30C49 18 58 20 60 28C55 27 51 30 49 35Z" fill="#8e2a1c" stroke="#5a1a10" stroke-width="1.4"/>'
   +'<path d="M44 29L52 24M47 32L56 28" stroke="#5a1a10" stroke-width="1.1" fill="none"/>'
   +'<path d="M12 60C10 48 16 38 28 36C40 34 48 42 48 52C48 58 44 61 40 61Z" fill="#b8432a" stroke="#6a1c12" stroke-width="1.6"/>'
   +'<ellipse cx="30" cy="52" rx="9" ry="8" fill="#f2b05a"/><ellipse cx="30" cy="52" rx="12" ry="10" fill="#ffae4a" opacity=".35"/>'
   +'<path d="M16 34C12 22 18 12 30 11C42 10 47 19 45 28C44 34 38 38 30 38C24 38 18 37 16 34Z" fill="#b8432a" stroke="#6a1c12" stroke-width="1.6"/>'
   +'<path d="M22 13L17 3L27 10M37 11L43 2L41 13" fill="#f1d7a8" stroke="#a8875a" stroke-width="1.2" stroke-linejoin="round"/>'
   +'<path d="M20 30C24 34 36 34 41 30C39 36 33 38 30 38C26 38 22 35 20 30Z" fill="#f2b05a"/>'
   +'<ellipse cx="24" cy="23" rx="3.6" ry="4" fill="#ffc21a"/><ellipse cx="24" cy="23" rx="1.1" ry="3.2" fill="#1c130e"/><circle cx="22.8" cy="21.3" r="1" fill="#fff"/>'
   +'<ellipse cx="37" cy="23" rx="3.6" ry="4" fill="#ffc21a"/><ellipse cx="37" cy="23" rx="1.1" ry="3.2" fill="#1c130e"/><circle cx="35.8" cy="21.3" r="1" fill="#fff"/>'
   +'<circle cx="27.5" cy="31" r="1" fill="#4a140c"/><circle cx="33" cy="31" r="1" fill="#4a140c"/>'
   +'<circle cx="50" cy="12" r="1.6" fill="#ffd24a"/><circle cx="54" cy="16" r="1.1" fill="#ff7a1a"/><circle cx="8" cy="22" r="1.2" fill="#ffd24a"/>');
  A.add('mossfawn',
   '<circle cx="9" cy="14" r="2.2" fill="#d8ff7a" opacity=".9"/><circle cx="55" cy="10" r="1.8" fill="#9dffb0"/><circle cx="57" cy="44" r="1.5" fill="#d8ff7a"/>'
   +'<path d="M8 22C2 14 6 8 13 12C18 15 20 20 21 24Z" fill="#b98a5a" stroke="#7a5634" stroke-width="1.4"/><path d="M10 19C7 15 9 12 13 14C15 16 17 19 18 22Z" fill="#f2d9c4"/>'
   +'<path d="M56 22C62 14 58 8 51 12C46 15 44 20 43 24Z" fill="#b98a5a" stroke="#7a5634" stroke-width="1.4"/><path d="M54 19C57 15 55 12 51 14C49 16 47 19 46 22Z" fill="#f2d9c4"/>'
   +'<path d="M18 22C18 14 25 10 32 10C39 10 46 14 46 22C46 34 40 46 32 50C24 46 18 34 18 22Z" fill="#b98a5a" stroke="#7a5634" stroke-width="1.6"/>'
   +'<path d="M25 38C27 44 30 49 32 50C34 49 37 44 39 38C36 40 28 40 25 38Z" fill="#f4ead6"/>'
   +'<ellipse cx="32" cy="45" rx="4" ry="3" fill="#2a1d16"/><circle cx="31" cy="44" r=".9" fill="#fff" opacity=".7"/>'
   +'<ellipse cx="25" cy="27" rx="3.8" ry="4.3" fill="#2a1d16"/><circle cx="23.8" cy="25.4" r="1.3" fill="#fff"/>'
   +'<ellipse cx="39" cy="27" rx="3.8" ry="4.3" fill="#2a1d16"/><circle cx="37.8" cy="25.4" r="1.3" fill="#fff"/>'
   +'<circle cx="28" cy="15" r="1.7" fill="#eaffd8"/><circle cx="36" cy="15.5" r="1.5" fill="#eaffd8"/><circle cx="32" cy="19" r="1.3" fill="#eaffd8"/>'
   +'<circle cx="28" cy="15" r="3.4" fill="#b8ffc8" opacity=".35"/><circle cx="36" cy="15.5" r="3.2" fill="#b8ffc8" opacity=".35"/>'
   +'<path d="M20 54C24 52 26 56 22 58Z" fill="#ffd6e8"/><path d="M42 55C46 53 47 57 43 58Z" fill="#fff7d6"/>');
  A.add('cinderchick',
   '<ellipse cx="32" cy="36" rx="23" ry="21" fill="#ff7a1a" opacity=".22"/>'
   +'<path d="M28 14C25 8 28 3 32 1C31 6 36 7 36 12C38 9 41 10 40 15Z" fill="#ff5a14" stroke="#c0300c" stroke-width="1.2" stroke-linejoin="round"/>'
   +'<path d="M30 14C29 10 31 7 33 5C33 9 36 10 35 14Z" fill="#ffd24a"/>'
   +'<path d="M46 44C54 42 60 46 60 52C56 48 52 49 49 50Z" fill="#ff5a14" stroke="#c0300c" stroke-width="1.1"/>'
   +'<ellipse cx="32" cy="38" rx="17" ry="17" fill="#ff8a1a" stroke="#c0480c" stroke-width="1.6"/>'
   +'<ellipse cx="32" cy="44" rx="11" ry="9" fill="#ffd84a"/>'
   +'<path d="M15 38C10 40 9 46 13 49C16 46 18 43 19 41Z" fill="#ff6a1a" stroke="#c0480c" stroke-width="1.2"/><path d="M49 38C54 40 55 46 51 49C48 46 46 43 45 41Z" fill="#ff6a1a" stroke="#c0480c" stroke-width="1.2"/>'
   +'<circle cx="26" cy="31" r="3.2" fill="#1c130e"/><circle cx="25" cy="30" r="1.1" fill="#fff"/><circle cx="38" cy="31" r="3.2" fill="#1c130e"/><circle cx="37" cy="30" r="1.1" fill="#fff"/>'
   +'<path d="M29 36L35 36L32 40Z" fill="#f0c24a" stroke="#b8861a" stroke-width="1"/>'
   +'<ellipse cx="21" cy="37" rx="2.6" ry="1.6" fill="#ff5a3a" opacity=".7"/><ellipse cx="43" cy="37" rx="2.6" ry="1.6" fill="#ff5a3a" opacity=".7"/>'
   +'<path d="M26 55V59M38 55V59" stroke="#e0701e" stroke-width="2.2"/>'
   +'<circle cx="10" cy="20" r="1.4" fill="#ffd24a"/><circle cx="54" cy="18" r="1.8" fill="#ff7a1a"/><circle cx="50" cy="8" r="1" fill="#ffd24a"/>');
 }
  if(A&&A.add)A.add('wyvern',
   '<path d="M34 26C44 10 58 8 62 14C56 14 52 18 50 24C54 22 58 24 58 28C52 27 46 29 42 33Z" fill="#7c5c3a" stroke="#4a3522" stroke-width="1.4" stroke-linejoin="round"/>'
   +'<path d="M40 24L52 14M44 28L56 22" stroke="#4a3522" stroke-width="1" fill="none"/>'
   +'<path d="M10 58C8 46 14 36 26 35C38 34 44 42 44 50C44 56 40 60 36 60Z" fill="#b99a6a" stroke="#5a3e26" stroke-width="1.6"/>'
   +'<path d="M8 30C5 20 11 11 22 10C33 9 38 16 37 24C36 31 30 35 22 35C15 35 10 34 8 30Z" fill="#b99a6a" stroke="#5a3e26" stroke-width="1.6"/>'
   +'<path d="M14 12L10 3L20 9M28 10L33 2L32 12" fill="#e9e2cf" stroke="#a8977a" stroke-width="1.2" stroke-linejoin="round"/>'
   +'<path d="M20 9L22 4L25 9L27 5L29 10" fill="#7c5c3a"/>'
   +'<path d="M12 28C16 32 28 32 33 28C31 33 26 35 22 35C18 35 14 33 12 28Z" fill="#efe0bc"/>'
   +'<ellipse cx="16" cy="21" rx="3.4" ry="3.8" fill="#e8d24a"/><ellipse cx="16" cy="21" rx="1" ry="3" fill="#1c130e"/><circle cx="14.9" cy="19.5" r=".9" fill="#fff"/>'
   +'<ellipse cx="29" cy="21" rx="3.4" ry="3.8" fill="#e8d24a"/><ellipse cx="29" cy="21" rx="1" ry="3" fill="#1c130e"/><circle cx="27.9" cy="19.5" r=".9" fill="#fff"/>'
   +'<path d="M36 60C46 60 54 56 58 48C56 56 50 62 40 62Z" fill="#b99a6a" stroke="#5a3e26" stroke-width="1.2"/>');
  if(A&&A.add)A.add('gryphling',
   '<path d="M40 30C50 16 60 18 62 26C57 25 54 28 52 32C56 31 59 33 59 36C53 35 48 37 44 40Z" fill="#b8862e" stroke="#6a4a1e" stroke-width="1.3" stroke-linejoin="round"/>'
   +'<path d="M12 60C10 48 16 38 28 37C40 36 46 44 46 52C46 58 42 61 38 61Z" fill="#c9a24a" stroke="#8a6424" stroke-width="1.6"/>'
   +'<path d="M44 56C52 58 56 52 55 46" stroke="#c9a24a" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="55" cy="45" r="3.2" fill="#8a6424"/>'
   +'<path d="M14 32C11 20 18 11 29 11C40 11 46 19 44 29C43 36 36 40 29 40C22 40 16 37 14 32Z" fill="#f6f0e2" stroke="#b8a888" stroke-width="1.6"/>'
   +'<path d="M18 13L15 5L23 11M36 11L41 4L39 13" fill="#e6d8b8" stroke="#b8a888" stroke-width="1.1" stroke-linejoin="round"/>'
   +'<path d="M25 29C27 27 33 27 35 29C35 34 32 38 30 39C28 38 25 34 25 29Z" fill="#e8b43a" stroke="#a8761a" stroke-width="1.2"/><path d="M30 39C29 37 29 35 30 34" stroke="#a8761a" stroke-width="1"/>'
   +'<ellipse cx="22" cy="23" rx="3.6" ry="4" fill="#f0a020"/><circle cx="22" cy="23" r="1.9" fill="#1c130e"/><circle cx="20.8" cy="21.5" r="1" fill="#fff"/>'
   +'<ellipse cx="38" cy="23" rx="3.6" ry="4" fill="#f0a020"/><circle cx="38" cy="23" r="1.9" fill="#1c130e"/><circle cx="36.8" cy="21.5" r="1" fill="#fff"/>'
   +'<circle cx="8" cy="18" r="1.3" fill="#ffd86a"/><circle cx="54" cy="10" r="1.6" fill="#ffd86a"/><circle cx="58" cy="16" r="1" fill="#fff0b0"/>');
 G.petFantasy={keys:['emberling','mossfawn','cinderchick','wyvern','gryphling']};
}
