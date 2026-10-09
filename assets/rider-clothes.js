/* Clothing recipes reuse the rider's fitted, skinned meshes. All cuts keep the source
   skeleton and weights, so the wardrobe works on foot, in the saddle and on other riders. */
const look=(id,label,category,icon,source,design,palette,desc,cut='shirt')=>
 ({id,label,category,icon,source,design,palette,desc,cut});
export const RIDER_OUTFITS=[
 look('riding','Riding kit','Riding','🏇','riding',0,['#3d4a6e','#cfc6ae','#3b2a14'],'Stock collar, fitted breeches and tall boots.'),
 look('peasant','Stable shirt','Ranch','🧺','peasant',0,['#c98c5a','#4a4338','#69432d'],'A soft collared work shirt, fitted trousers and leather boots.','tunic'),
 look('ranger','Trail rider','Adventure','🏹','ranger',0,['#5a9a5a','#6b4a2e','#3b2a14'],'A fitted trail vest over a cotton shirt, with slim riding boots.','tunic'),
 look('show','Show jacket','Riding','🏅','peasant',9,['#3d4a6e','#cfc6ae','#202633'],'A tailored jacket, ivory stock and brass buttons.','jacket'),
 look('hunter','Hunt coat','Riding','🌿','peasant',9,['#365447','#cfc6ae','#3b2a14'],'A longer hunt coat with contrast lapels.','coat'),
 look('dressage','Dressage jacket','Riding','🎖️','peasant',9,['#202633','#eee5d3','#202633'],'Dark competition tailoring with ivory trim.','jacket'),
 look('polo','Polo shirt','Riding','👕','riding',8,['#d48796','#2e3a52','#3b2a14'],'Short sleeves, a neat placket and riding breeches.','short'),
 look('eventer','Cross-country','Riding','🏁','riding',11,['#659c99','#202633','#202633'],'A striped riding jersey for a day on the course.'),
 look('flannel','Barn flannel','Ranch','🪵','peasant',1,['#b34a4a','#435f80','#69432d'],'Buffalo plaid, a button front and denim trousers.'),
 look('denim','Denim jacket','Ranch','🧵','peasant',4,['#435f80','#4a4338','#69432d'],'Indigo denim with patch pockets and golden seams.','jacket'),
 look('western','Western shirt','Ranch','🌵','peasant',5,['#659c99','#435f80','#3b2a14'],'A contrast shoulder yoke and pearl-style snaps.'),
 look('overalls','Work overalls','Ranch','🛠️','peasant',10,['#e8d9b8','#435f80','#69432d'],'A denim bib, shoulder straps and a soft undershirt.'),
 look('canvas','Chore jacket','Ranch','🌾','peasant',13,['#bb9155','#365447','#3b2a14'],'Roomy canvas with big utility pockets.','jacket'),
 look('breton','Striped tee','Everyday','🐚','riding',2,['#e8d9b8','#435f80','#69432d'],'A short-sleeved striped tee and easy denim.','short'),
 look('cable','Cable sweater','Everyday','🧶','peasant',3,['#e8d9b8','#6b4a2e','#3b2a14'],'Soft cable-knit texture, ribbed cuffs and hem.','sweater'),
 look('cardigan','Long cardigan','Everyday','🍂','peasant',12,['#b88064','#4a4338','#69432d'],'An open-front knit over a cream top.','coat'),
 look('rugby','Rugby shirt','Everyday','🌈','peasant',11,['#8a5ab3','#2e3a52','#202633'],'Broad stripes and a cream collar.'),
 look('floral','Meadow blouse','Everyday','🌼','peasant',7,['#d48796','#eee5d3','#69432d'],'A scattering of tiny flowers on a soft blouse.'),
 look('sweatshirt','Cozy sweatshirt','Everyday','☁️','peasant',8,['#a5b7a1','#435f80','#69432d'],'Relaxed sleeves, a quarter zip and ribbed edges.','sweater'),
 look('quilted','Quilted gilet','Adventure','🍃','ranger',6,['#365447','#cfc6ae','#3b2a14'],'Diamond-quilted layers over a cream undershirt.','gilet'),
 look('raincoat','Rain jacket','Adventure','🌦️','peasant',8,['#e2b857','#2e3a52','#365447'],'A bright weather shell with a dark zip.','coat'),
 look('alpine','Alpine knit','Adventure','🏔️','peasant',3,['#659c99','#202633','#3b2a14'],'A warm patterned knit for the mountain trails.','sweater'),
 look('safari','Field shirt','Adventure','🧭','peasant',13,['#bb9155','#365447','#69432d'],'Twin field pockets, buttons and tough trousers.'),
 look('explorer','Trail vest','Adventure','🎒','ranger',13,['#b88064','#2e3a52','#3b2a14'],'A pocketed vest, light sleeves and trail boots.','gilet'),
 look('argyle','Argyle riding knit','Riding','💠','peasant',15,['#a5b7a1','#eee5d3','#3b2a14'],'Traditional diamond knit with fine crossing stitches.','sweater'),
 look('pinstripe','Pinstripe jacket','Riding','🎩','peasant',19,['#202633','#cfc6ae','#202633'],'Fine chalk stripes on a fitted competition jacket.','jacket'),
 look('tweed','Tweed hack coat','Riding','🍁','peasant',16,['#817365','#cfc6ae','#3b2a14'],'Herringbone tweed with a longer hem and neat collar.','coat'),
 look('team','Team jersey','Riding','🏆','riding',18,['#b34a4a','#202633','#202633'],'Contrast shoulder panels and a broad athletic chest band.'),
 look('chevron','Chevron training top','Riding','⚡','riding',22,['#8a5ab3','#2e3a52','#202633'],'A fitted training jersey with a bold chevron pattern.'),
 look('sportpolo','Two-tone polo','Riding','🎾','riding',18,['#659c99','#eee5d3','#3b2a14'],'A lightweight polo with contrast chest panels.','short'),
 look('gingham','Gingham shirt','Ranch','🧺','peasant',14,['#d48796','#435f80','#69432d'],'Small woven checks and a tidy button front.'),
 look('railroad','Railroad jacket','Ranch','🚂','peasant',19,['#435f80','#4a4338','#69432d'],'Workwear stripes with a roomy chore-jacket cut.','jacket'),
 look('prairie','Prairie blouse','Ranch','🌷','peasant',21,['#eee5d3','#435f80','#3b2a14'],'Fine leafy sprigs on a relaxed cotton blouse.'),
 look('patchwork','Patchwork knit','Ranch','🪡','peasant',18,['#b88064','#365447','#69432d'],'Warm colour panels, a soft knit and ribbed cuffs.','sweater'),
 look('orchard','Orchard checks','Ranch','🍎','peasant',14,['#365447','#bb9155','#3b2a14'],'Forest-green checks with sturdy harvest-day trousers.'),
 look('ranchknit','Heritage ranch knit','Ranch','🐑','peasant',17,['#b34a4a','#435f80','#69432d'],'Rows of tiny woven diamonds in a cozy barn sweater.','sweater'),
 look('dotblouse','Polka-dot blouse','Everyday','🫧','peasant',20,['#3d4a6e','#eee5d3','#3b2a14'],'Ivory dots on a flowing, easy-fit blouse.'),
 look('daisytee','Daisy tee','Everyday','🌻','riding',7,['#659c99','#435f80','#69432d'],'A meadow of daisies on a short-sleeved cotton tee.','short'),
 look('sunset','Sunset knit','Everyday','🌅','peasant',23,['#d48796','#2e3a52','#69432d'],'A soft colour fade from warm rose to dusky plum.','sweater'),
 look('ivy','Ivy argyle','Everyday','🍀','peasant',15,['#8a5ab3','#cfc6ae','#3b2a14'],'A lavender diamond sweater with a classic collegiate feel.','sweater'),
 look('botanical','Botanical shirt','Everyday','🌿','peasant',21,['#a5b7a1','#eee5d3','#69432d'],'Delicate leafy stems printed on sage cotton.'),
 look('mariner','Mariner pullover','Everyday','⚓','peasant',22,['#3d4a6e','#cfc6ae','#3b2a14'],'An ivory chevron knit inspired by days on the coast.','sweater'),
 look('fairisle','Fair Isle sweater','Adventure','❄️','peasant',17,['#659c99','#202633','#3b2a14'],'A mountain sweater with bands of intricate knit motifs.','sweater'),
 look('summit','Summit fleece','Adventure','⛰️','peasant',18,['#e2b857','#2e3a52','#202633'],'High-contrast colour panels for a bright trail-day layer.','sweater'),
 look('woodland','Woodland overshirt','Adventure','🌲','peasant',16,['#365447','#bb9155','#3b2a14'],'Subtle herringbone texture and a sturdy overshirt cut.','jacket'),
 look('wildflower','Wildflower trail shirt','Adventure','🌸','peasant',21,['#b88064','#365447','#69432d'],'Little botanical sprigs for wandering the meadow trails.'),
 look('northern','Northern lights knit','Adventure','🌌','peasant',23,['#659c99','#202633','#202633'],'A teal-to-indigo colour fade in a warm knit.','sweater'),
 look('trailchecks','Trail check jacket','Adventure','🏕️','peasant',14,['#bb9155','#365447','#3b2a14'],'Small golden checks in a practical jacket.','jacket'),
];
export const riderOutfit=id=>RIDER_OUTFITS.find(o=>o.id===id)||RIDER_OUTFITS[0];
export const outfitPalette=o=>({outfit:o.id,shirt:o.palette[0],pants:o.palette[1],boots:o.palette[2]});

/* Shared by the fitted kit and mesh garments. Pattern coordinates are bind-space
   metres, so the fabric follows the animation instead of swimming across her. */
export const CLOTH_GLSL=`
uniform vec4 uClothes,uTailor;
float clothLine(float x,float width){float aa=max(0.008,fwidth(x)*0.75);return 1.0-smoothstep(width,width+aa,abs(fract(x)-0.5));}
float clothWave(float x,float frequency){return sin(x*frequency)*(1.0-smoothstep(0.7,2.5,fwidth(x*frequency)));}
float clothBand(float x,float center,float width){float aa=max(fwidth(x),0.0005);return 1.0-smoothstep(width,width+aa,abs(x-center));}
float clothBox(vec2 p,vec2 center,vec2 halfSize){vec2 aa=max(fwidth(p),vec2(0.0007));vec2 edge=1.0-smoothstep(halfSize,halfSize+aa,abs(p-center));return edge.x*edge.y;}
float riderFabricRoughness(){
 float d=uClothes.x;
 return d>2.5&&d<3.5||d>11.5&&d<12.5?0.96:d>3.5&&d<4.5||d>9.5&&d<10.5?0.82:d>7.5&&d<8.5?0.66:0.90;
}
vec3 riderCableKnit(vec3 p){
 // Paired yarn ropes cross in each repeat, with alternating raised strands.
 // On the sleeves the repeat follows the arm rather than the torso's vertical.
 float arm=smoothstep(.16,.23,abs(p.x));vec2 uv=mix(p.xy,vec2(p.y,abs(p.x)),arm);
 float lane=mod(uv.x+.014,.028)-.014,phase=uv.y*146.1206;
 float a=exp(-pow((lane-.006*cos(phase))/.0032,2.0));
 float b=exp(-pow((lane+.006*cos(phase))/.0032,2.0));
 float cable=max(a*(.72+.28*sin(phase)),b*(.72-.28*sin(phase)));
 float rib=pow(.5+.5*cos(uv.x*224.3995),8.0);
 float yarn=clothWave(uv.x+sin(uv.y*520.0)*.0011,1550.0)*clothWave(uv.y,1450.0);
 return vec3(cable,rib,yarn);
}
float riderFabricHeight(vec3 p,float trousers){
 float d=uClothes.x,ax=abs(p.x),front=smoothstep(0.025,0.055,p.z);
 float weave=clothWave(p.x+p.z*.55,6000.0)*clothWave(p.y,5700.0)*0.00006;
 float seams=0.0;
 if(trousers<0.5){
  seams+=clothBand(p.y,uZ1.z-0.025,0.004)*0.00025;
  seams+=clothBand(ax,uZ2.x-0.035,0.004)*0.00025;
  if(d>2.5&&d<3.5){
   vec3 knit=riderCableKnit(p);
   weave+=knit.x*.00085+knit.y*.00010+knit.z*.000035;
  }
  if(d>5.5&&d<6.5){float q=(.5+.5*clothWave(p.x+p.y+.0125,125.6637))*(.5+.5*clothWave(p.x-p.y+.0125,125.6637));weave+=q*.00065;}
  if(d>3.5&&d<5.5||d>8.5&&d<9.5||d>12.5&&d<13.5){
   seams+=clothBand(ax,0.006,0.002)*front*0.0012;
  }
 }else{weave+=clothWave(p.x+p.y,1900.0)*.00013;seams+=clothBand(p.z,-.012,.003)*.0008;}
 return weave+seams;
}
vec3 riderFabricNormal(vec3 n,vec3 p,float trousers){
 float height=riderFabricHeight(p,trousers);
 vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition),r1=cross(dy,n),r2=cross(n,dx);
 float det=dot(dx,r1);vec3 grad=sign(det)*(dFdx(height)*r1+dFdy(height)*r2);
 return normalize(abs(det)*n-grad+vec3(0.0,0.0,1e-10));
}
vec3 riderFabric(vec3 base,vec3 p){
 float d=uClothes.x, ax=abs(p.x), front=step(0.015,p.z), y=p.y;
 vec3 cream=vec3(0.82,0.79,0.71), ink=base*0.36;
 if(d>0.5&&d<1.5){
  float a=smoothstep(-0.12,0.12,clothWave(p.x,77.0)),b=smoothstep(-0.12,0.12,clothWave(y,77.0));
  base*=0.80+0.20*(1.0-a*0.48-b*0.42);
  base=mix(base,cream,0.06*max(clothLine(p.x*31.2,0.014),clothLine(y*31.2,0.014)));
 }else if(d<2.5&&d>1.5){base=mix(base,ink,smoothstep(0.52,0.60,fract(y*25.0))*0.85);
 }else if(d<3.5&&d>2.5){
  vec3 knit=riderCableKnit(p);
  base*=.92+.085*knit.x+.012*knit.y+.012*knit.z;
 }else if(d<4.5&&d>3.5){
  base*=0.97+0.025*clothWave(p.x+y*.95,3400.0);

 }else if(d<5.5&&d>4.5){
  float yoke=step(uZ1.x-0.115+ax*0.35,y)*(1.0-step(uZ1.x+0.01,y));
  base=mix(base,cream,yoke*0.90);
 }else if(d<6.5&&d>5.5){
  float quilt=max(clothLine((p.x+y)*20.0,0.025),clothLine((p.x-y)*20.0,0.025));
  base*=1.01-0.15*quilt;
 }else if(d<7.5&&d>6.5){
  vec2 cell=fract(vec2(p.x*34.0+floor(y*31.0)*0.37,y*31.0))-0.5;
  float petal=(1.0-smoothstep(0.11,0.18,length(cell-vec2(0.12,0))))+(1.0-smoothstep(0.11,0.18,length(cell+vec2(0.12,0))))
   +(1.0-smoothstep(0.11,0.18,length(cell-vec2(0,0.12))))+(1.0-smoothstep(0.11,0.18,length(cell+vec2(0,0.12))));
  base=mix(base,cream,clamp(petal,0.0,1.0));base=mix(base,vec3(0.67,0.39,0.07),1.0-smoothstep(0.045,0.07,length(cell)));
 }else if(d<9.5&&d>8.5){
  // Competition lapels and the ivory shirt are separate sewn layers.
 }else if(d<10.5&&d>9.5){
  float bib=step(ax,0.085)*step(y,uZ1.x-0.14);
  float straps=step(abs(ax-0.075),0.018);
  float overall=max(max(bib,step(y,uZ1.z+0.06)),straps)*step(ax,0.18);
  base=mix(base,uPants*(0.93+0.035*clothWave(p.x+y,620.0)),overall);
 }else if(d<11.5&&d>10.5){base=mix(base,cream,step(0.58,fract(y*10.0))*0.90);
 }else if(d<12.5&&d>11.5){
  base*=0.97+0.025*clothWave(p.x+y*.85,330.0);

 }else if(d>13.5&&d<14.5){
  float a=step(.5,fract(p.x*48.0)),b=step(.5,fract(y*48.0));
  base=mix(cream,base,.22+.38*a+.38*b);
 }else if(d>14.5&&d<15.5){
  vec2 uv=vec2(p.x*15.0,y*11.0);float a=step(.5,fract(uv.x+uv.y)),b=step(.5,fract(uv.x-uv.y));
  base=mix(base,cream*.85,abs(a-b)*.78);base=mix(base,ink,a*b*.50);
  float stitch=max(clothLine(uv.x+uv.y+.25,.015),clothLine(uv.x-uv.y+.25,.015));base=mix(base,cream,stitch*.85);
 }else if(d>15.5&&d<16.5){
  float zig=(fract(p.x*130.0)<.5?1.0:-1.0);base*=.84+.16*smoothstep(-.3,.3,clothWave(y+p.x*zig,1900.0));
  base=mix(base,cream,max(clothLine(p.x*24.0,.018),clothLine(y*24.0,.018))*.15);
 }else if(d>16.5&&d<17.5){
  vec2 cell=abs(fract(vec2(p.x*29.0,y*31.0))-.5);
  float diamonds=1.0-smoothstep(.30,.36,cell.x+cell.y),band=step(.48,fract(y*10.0));
  base=mix(base,cream,diamonds*band*.92);base=mix(base,ink,clothLine(y*31.0,.035)*.55);
 }else if(d>17.5&&d<18.5){
  float chest=step(uZ1.x-.215,y)*step(y,uZ1.x-.157),shoulders=step(uZ1.x-.09,y);
  base=mix(base,cream,chest*.80);base=mix(base,ink,shoulders*.65);
 }else if(d>18.5&&d<19.5){
  base=mix(base,cream,clothLine(p.x*92.0,.018)*.20);
 }else if(d>19.5&&d<20.5){
  vec2 cell=fract(vec2(p.x*35.0+floor(y*35.0)*.5,y*35.0))-.5;
  base=mix(base,cream,1.0-smoothstep(.105,.14,length(cell)));
 }else if(d>20.5&&d<21.5){
  vec2 cell=fract(vec2(p.x*27.0+floor(y*20.0)*.37,y*20.0))-.5;
  float stem=(1.0-smoothstep(.017,.035,abs(cell.x-cell.y*.28)))*step(abs(cell.y),.35);
  vec2 leaf=cell-vec2(sign(cell.y)*.105,sign(cell.y)*.13);float leaves=1.0-smoothstep(.10,.16,length(leaf*vec2(1.0,.6)));
  base=mix(base,ink,clamp(stem+leaves,0.0,1.0)*.57);
 }else if(d>21.5&&d<22.5){
  float zig=abs(fract(p.x*13.0)-.5);base=mix(base,cream,step(.70,fract(y*9.0-zig))*.56);
 }else if(d>22.5&&d<23.5){
  float t=smoothstep(uZ1.z,uZ1.x,y);base=mix(base*vec3(.46,.44,.85),base,t);
 }
 float placket=step(ax,0.006)*front*step(uZ1.z,y)*step(y,uZ1.x-0.04);
 if(d>0.5&&d<1.5||d>3.5&&d<5.5||d>8.5&&d<9.5||d>12.5&&d<13.5){
  base=mix(base,ink,placket*0.50);
  float buttons=step(ax,0.005)*step(abs(fract(y*20.0)-0.5),0.085)*front*step(uZ1.z+0.04,y)*step(y,uZ1.x-0.065);
  // Raised buttons are skinned geometry on these garments.
 }
 if(d>7.5&&d<8.5||d>5.5&&d<6.5){base=mix(base,ink,placket*(uClothes.y>.5?step(uZ1.x-.15,y):1.0));}
 if(uClothes.z>0.5){
  float hem=step(y,uZ1.z+0.065),cuff=step(uZ2.x-0.105,ax);
  base*=1.0-max(hem,cuff)*(0.12+0.035*clothWave(ax+y,620.0));
 }
 // Stitching sits along the sewn edges, while fine weave fades with distance.
 float stitch=(clothBand(y,uZ1.z-0.017,.0012)+clothBand(ax,uZ2.x-.033,.0012))*0.30;
 stitch*=0.5+0.5*clothWave(ax+y,1250.0);
 base=mix(base,base*1.22+vec3(.006),stitch);
 base*=0.975+0.025*clothWave(p.x+p.z*.5,1550.0)*clothWave(y,1250.0);
 return base;
}
vec3 riderBreeches(vec3 base,vec3 p){
 float ax=abs(p.x),front=smoothstep(.015,.055,p.z),back=1.0-smoothstep(-.075,-.035,p.z);
 float knee=clothBox(vec2(ax,p.y),vec2(.095,uZ1.w+.12),vec2(.049,.115))*(1.0-smoothstep(.015,.085,p.z));
 float seat=back*smoothstep(uZ1.w+.23,uZ1.z-.08,p.y);
 base*=1.0-.15*max(knee,seat);
 float seam=clothBand(ax,.155-.022*smoothstep(uZ1.w+.15,uZ1.z,p.y),.0011);
 float pocket=clothBand(p.y,uZ1.z-.060-(ax-.085)*.3,.0012)*clothBox(vec2(ax,p.y),vec2(.094,uZ1.z-.065),vec2(.045,.024))*front;
 base*=1.0-.20*max(seam,pocket);
 float weave=clothWave(p.x+p.y*.8,2100.0)*clothWave(p.y,1700.0);
 base*=.98+(.012+.012*uTailor.z)*weave;
 return base;
}`;

export {tailoredTop,tailoredLegs,garmentCut,sewnDetails,ridingBoots,waistband,GARMENT_NECK_GLSL,garmentNeckY} from './rider-tailoring.js?v=character-polish-20261009';
