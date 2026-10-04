/* Clothing recipes reuse the rider's fitted, skinned meshes. All cuts keep the source
   skeleton and weights, so the wardrobe works on foot, in the saddle and on other riders. */
const look=(id,label,category,icon,source,design,palette,desc,cut='shirt')=>
 ({id,label,category,icon,source,design,palette,desc,cut});
export const RIDER_OUTFITS=[
 look('riding','Riding kit','Riding','🏇','riding',0,['#3d4a6e','#cfc6ae','#3b2a14'],'Stock collar, fitted breeches and tall boots.'),
 look('peasant','Stable hand','Ranch','🧺','peasant',0,['#c98c5a','#4a4338','#8a5a2b'],'An easy work tunic for days at the stable.','tunic'),
 look('ranger','Trail rider','Adventure','🏹','ranger',0,['#5a9a5a','#6b4a2e','#3b2a14'],'Layered trail leathers and sturdy boots.','tunic'),
 look('show','Show jacket','Riding','🏅','peasant',9,['#3d4a6e','#cfc6ae','#202633'],'A tailored jacket, ivory stock and brass buttons.','jacket'),
 look('hunter','Hunt coat','Riding','🌿','peasant',9,['#365447','#cfc6ae','#3b2a14'],'A longer hunt coat with contrast lapels.','coat'),
 look('dressage','Dressage jacket','Riding','🎖️','peasant',9,['#202633','#eee5d3','#202633'],'Dark competition tailoring with ivory trim.','jacket'),
 look('polo','Polo shirt','Riding','👕','riding',8,['#d48796','#2e3a52','#3b2a14'],'Short sleeves, a neat placket and riding breeches.','short'),
 look('eventer','Cross-country','Riding','🏁','riding',11,['#659c99','#202633','#202633'],'A striped riding jersey for a day on the course.'),
 look('flannel','Barn flannel','Ranch','🪵','peasant',1,['#b34a4a','#435f80','#8a5a2b'],'Buffalo plaid, a button front and denim trousers.'),
 look('denim','Denim jacket','Ranch','🧵','peasant',4,['#435f80','#4a4338','#8a5a2b'],'Indigo denim with patch pockets and golden seams.','jacket'),
 look('western','Western shirt','Ranch','🌵','peasant',5,['#659c99','#435f80','#3b2a14'],'A contrast shoulder yoke and pearl-style snaps.'),
 look('overalls','Work overalls','Ranch','🛠️','peasant',10,['#e8d9b8','#435f80','#8a5a2b'],'A denim bib, shoulder straps and a soft undershirt.'),
 look('canvas','Chore jacket','Ranch','🌾','peasant',13,['#bb9155','#365447','#3b2a14'],'Roomy canvas with big utility pockets.','jacket'),
 look('breton','Striped tee','Everyday','🐚','riding',2,['#e8d9b8','#435f80','#8a5a2b'],'A short-sleeved striped tee and easy denim.','short'),
 look('cable','Cable sweater','Everyday','🧶','peasant',3,['#e8d9b8','#6b4a2e','#3b2a14'],'Soft cable-knit texture, ribbed cuffs and hem.','sweater'),
 look('cardigan','Long cardigan','Everyday','🍂','peasant',12,['#b88064','#4a4338','#8a5a2b'],'An open-front knit over a cream top.','coat'),
 look('rugby','Rugby shirt','Everyday','🌈','peasant',11,['#8a5ab3','#2e3a52','#202633'],'Broad stripes and a cream collar.'),
 look('floral','Meadow blouse','Everyday','🌼','peasant',7,['#d48796','#eee5d3','#8a5a2b'],'A scattering of tiny flowers on a soft blouse.'),
 look('sweatshirt','Cozy sweatshirt','Everyday','☁️','peasant',8,['#a5b7a1','#435f80','#8a5a2b'],'Relaxed sleeves, a quarter zip and ribbed edges.','sweater'),
 look('quilted','Quilted gilet','Adventure','🍃','ranger',6,['#365447','#cfc6ae','#3b2a14'],'Diamond-quilted layers over a cream undershirt.','gilet'),
 look('raincoat','Rain jacket','Adventure','🌦️','peasant',8,['#e2b857','#2e3a52','#365447'],'A bright weather shell with a dark zip.','coat'),
 look('alpine','Alpine knit','Adventure','🏔️','peasant',3,['#659c99','#202633','#3b2a14'],'A warm patterned knit for the mountain trails.','sweater'),
 look('safari','Field shirt','Adventure','🧭','peasant',13,['#bb9155','#365447','#8a5a2b'],'Twin field pockets, buttons and tough trousers.'),
 look('explorer','Trail vest','Adventure','🎒','ranger',13,['#b88064','#2e3a52','#3b2a14'],'A pocketed vest, light sleeves and trail boots.','gilet'),
 look('argyle','Argyle riding knit','Riding','💠','peasant',15,['#a5b7a1','#eee5d3','#3b2a14'],'Traditional diamond knit with fine crossing stitches.','sweater'),
 look('pinstripe','Pinstripe jacket','Riding','🎩','peasant',19,['#202633','#cfc6ae','#202633'],'Fine chalk stripes on a fitted competition jacket.','jacket'),
 look('tweed','Tweed hack coat','Riding','🍁','peasant',16,['#817365','#cfc6ae','#3b2a14'],'Herringbone tweed with a longer hem and neat collar.','coat'),
 look('team','Team jersey','Riding','🏆','riding',18,['#b34a4a','#202633','#202633'],'Contrast shoulder panels and a broad athletic chest band.'),
 look('chevron','Chevron training top','Riding','⚡','riding',22,['#8a5ab3','#2e3a52','#202633'],'A fitted training jersey with a bold chevron pattern.'),
 look('sportpolo','Two-tone polo','Riding','🎾','riding',18,['#659c99','#eee5d3','#3b2a14'],'A lightweight polo with contrast chest panels.','short'),
 look('gingham','Gingham shirt','Ranch','🧺','peasant',14,['#d48796','#435f80','#8a5a2b'],'Small woven checks and a tidy button front.'),
 look('railroad','Railroad jacket','Ranch','🚂','peasant',19,['#435f80','#4a4338','#8a5a2b'],'Workwear stripes with a roomy chore-jacket cut.','jacket'),
 look('prairie','Prairie blouse','Ranch','🌷','peasant',21,['#eee5d3','#435f80','#3b2a14'],'Fine leafy sprigs on a relaxed cotton blouse.'),
 look('patchwork','Patchwork knit','Ranch','🪡','peasant',18,['#b88064','#365447','#8a5a2b'],'Warm colour panels, a soft knit and ribbed cuffs.','sweater'),
 look('orchard','Orchard checks','Ranch','🍎','peasant',14,['#365447','#bb9155','#3b2a14'],'Forest-green checks with sturdy harvest-day trousers.'),
 look('ranchknit','Heritage ranch knit','Ranch','🐑','peasant',17,['#b34a4a','#435f80','#8a5a2b'],'Rows of tiny woven diamonds in a cozy barn sweater.','sweater'),
 look('dotblouse','Polka-dot blouse','Everyday','🫧','peasant',20,['#3d4a6e','#eee5d3','#3b2a14'],'Ivory dots on a flowing, easy-fit blouse.'),
 look('daisytee','Daisy tee','Everyday','🌻','riding',7,['#659c99','#435f80','#8a5a2b'],'A meadow of daisies on a short-sleeved cotton tee.','short'),
 look('sunset','Sunset knit','Everyday','🌅','peasant',23,['#d48796','#2e3a52','#8a5a2b'],'A soft colour fade from warm rose to dusky plum.','sweater'),
 look('ivy','Ivy argyle','Everyday','🍀','peasant',15,['#8a5ab3','#cfc6ae','#3b2a14'],'A lavender diamond sweater with a classic collegiate feel.','sweater'),
 look('botanical','Botanical shirt','Everyday','🌿','peasant',21,['#a5b7a1','#eee5d3','#8a5a2b'],'Delicate leafy stems printed on sage cotton.'),
 look('mariner','Mariner pullover','Everyday','⚓','peasant',22,['#3d4a6e','#cfc6ae','#3b2a14'],'An ivory chevron knit inspired by days on the coast.','sweater'),
 look('fairisle','Fair Isle sweater','Adventure','❄️','peasant',17,['#659c99','#202633','#3b2a14'],'A mountain sweater with bands of intricate knit motifs.','sweater'),
 look('summit','Summit fleece','Adventure','⛰️','peasant',18,['#e2b857','#2e3a52','#202633'],'High-contrast colour panels for a bright trail-day layer.','sweater'),
 look('woodland','Woodland overshirt','Adventure','🌲','peasant',16,['#365447','#bb9155','#3b2a14'],'Subtle herringbone texture and a sturdy overshirt cut.','jacket'),
 look('wildflower','Wildflower trail shirt','Adventure','🌸','peasant',21,['#b88064','#365447','#8a5a2b'],'Little botanical sprigs for wandering the meadow trails.'),
 look('northern','Northern lights knit','Adventure','🌌','peasant',23,['#659c99','#202633','#202633'],'A teal-to-indigo colour fade in a warm knit.','sweater'),
 look('trailchecks','Trail check jacket','Adventure','🏕️','peasant',14,['#bb9155','#365447','#3b2a14'],'Small golden checks in a practical jacket.','jacket'),
];
export const riderOutfit=id=>RIDER_OUTFITS.find(o=>o.id===id)||RIDER_OUTFITS[0];
export const outfitPalette=o=>({outfit:o.id,shirt:o.palette[0],pants:o.palette[1],boots:o.palette[2]});

/* Shared by the fitted kit and mesh garments. Pattern coordinates are bind-space
   metres, so the fabric follows the animation instead of swimming across her. */
export const CLOTH_GLSL=`
uniform vec4 uClothes;
float clothLine(float x,float width){float aa=max(0.008,fwidth(x)*0.75);return 1.0-smoothstep(width,width+aa,abs(fract(x)-0.5));}
float clothWave(float x,float frequency){return sin(x*frequency)*(1.0-smoothstep(0.7,2.5,fwidth(x*frequency)));}
float clothBand(float x,float center,float width){float aa=max(fwidth(x),0.0005);return 1.0-smoothstep(width,width+aa,abs(x-center));}
float clothBox(vec2 p,vec2 center,vec2 halfSize){vec2 aa=max(fwidth(p),vec2(0.0007));vec2 edge=1.0-smoothstep(halfSize,halfSize+aa,abs(p-center));return edge.x*edge.y;}
float riderFabricRoughness(){
 float d=uClothes.x;
 return d>2.5&&d<3.5||d>11.5&&d<12.5?0.96:d>3.5&&d<4.5||d>9.5&&d<10.5?0.82:d>7.5&&d<8.5?0.66:0.90;
}
float riderFabricHeight(vec3 p,float trousers){
 float d=uClothes.x,ax=abs(p.x),front=smoothstep(0.025,0.055,p.z);
 float weave=clothWave(p.x+p.z*.55,6000.0)*clothWave(p.y,5700.0)*0.00006;
 float seams=0.0;
 if(trousers<0.5){
  seams+=clothBand(p.y,uZ1.z-0.025,0.004)*0.00025;
  seams+=clothBand(ax,uZ2.x-0.035,0.004)*0.00025;
  if(d>2.5&&d<3.5){
   float cable=clothWave(p.x+0.012*sin(p.y*47.0),145.0);
   weave+=cable*cable*0.00075+clothWave(p.x,370.0)*clothWave(p.y,290.0)*0.00020;
  }
  if(d>5.5&&d<6.5){float q=(1.0-clothLine((p.x+p.y)*19.0,0.02))*(1.0-clothLine((p.x-p.y)*19.0,0.02));weave+=q*0.0019;}
  if(d>3.5&&d<5.5||d>8.5&&d<9.5||d>12.5&&d<13.5){
   seams+=clothBand(ax,0.006,0.002)*front*0.0012;
   if(d>3.5&&d<4.5||d>12.5&&d<13.5)seams+=clothBox(vec2(ax,p.y),vec2(.079,uZ1.x-.205),vec2(.034,.044))*front*.0015;
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
 vec3 cream=vec3(0.82,0.77,0.65), ink=base*0.23;
 if(d>0.5&&d<1.5){
  float a=smoothstep(-0.12,0.12,clothWave(p.x,98.0)),b=smoothstep(-0.12,0.12,clothWave(y,98.0));
  base*=0.62+0.38*(1.0-a*0.48-b*0.42);
  base=mix(base,cream,0.12*max(clothLine(p.x*31.2,0.014),clothLine(y*31.2,0.014)));
 }else if(d<2.5&&d>1.5){base=mix(base,ink,smoothstep(0.52,0.60,fract(y*25.0))*0.85);
 }else if(d<3.5&&d>2.5){
  float knit=clothWave(p.x+sin(y*260.0)*.004,340.0)*clothWave(y,310.0);
  float cable=pow(0.5+0.5*cos(p.x*130.0+sin(y*58.0)*1.8),6.0);
  base*=0.93+0.035*knit+0.065*cable;
 }else if(d<4.5&&d>3.5){
  base*=0.97+0.025*clothWave(p.x+y*.95,3400.0);
  float seam=clothBand(ax,0.082,0.0009)*front;
  base=mix(base,cream*0.52,seam*.55);
 }else if(d<5.5&&d>4.5){
  float yoke=step(uZ1.x-0.115+ax*0.35,y)*(1.0-step(uZ1.x+0.01,y));
  base=mix(base,cream,yoke*0.90);
 }else if(d<6.5&&d>5.5){
  float quilt=max(clothLine((p.x+y)*27.0,0.018),clothLine((p.x-y)*27.0,0.018));
  base*=1.01-0.15*quilt;
 }else if(d<7.5&&d>6.5){
  vec2 cell=fract(vec2(p.x*34.0+floor(y*31.0)*0.37,y*31.0))-0.5;
  float petal=(1.0-smoothstep(0.11,0.18,length(cell-vec2(0.12,0))))+(1.0-smoothstep(0.11,0.18,length(cell+vec2(0.12,0))))
   +(1.0-smoothstep(0.11,0.18,length(cell-vec2(0,0.12))))+(1.0-smoothstep(0.11,0.18,length(cell+vec2(0,0.12))));
  base=mix(base,cream,clamp(petal,0.0,1.0));base=mix(base,vec3(0.67,0.39,0.07),1.0-smoothstep(0.045,0.07,length(cell)));
 }else if(d<9.5&&d>8.5){
  float opening=step(ax,(y-uZ1.z)*0.16)*front;
  float lapel=step(abs(ax-(y-uZ1.z)*0.18),0.018)*front;
  base=mix(base,cream,opening);base=mix(base,ink,lapel);
 }else if(d<10.5&&d>9.5){
  float bib=step(ax,0.085)*step(y,uZ1.x-0.14);
  float straps=step(abs(ax-0.075),0.018);
  float overall=max(max(bib,step(y,uZ1.z+0.06)),straps)*step(ax,0.18);
  base=mix(base,uPants*(0.93+0.035*clothWave(p.x+y,620.0)),overall);
 }else if(d<11.5&&d>10.5){base=mix(base,cream,step(0.58,fract(y*10.0))*0.90);
 }else if(d<12.5&&d>11.5){
  base*=0.97+0.025*clothWave(p.x+y*.85,330.0);
  base=mix(base,cream,step(ax,0.045+(y-uZ1.z)*0.055)*front);
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
  float chest=step(uZ1.x-.27,y)*step(y,uZ1.x-.12),shoulders=step(uZ1.x-.10,y);
  base=mix(base,cream,chest*.94);base=mix(base,ink,shoulders*.65);
 }else if(d>18.5&&d<19.5){
  base=mix(base,cream,clothLine(p.x*70.0,.025)*.64);
 }else if(d>19.5&&d<20.5){
  vec2 cell=fract(vec2(p.x*35.0+floor(y*35.0)*.5,y*35.0))-.5;
  base=mix(base,cream,1.0-smoothstep(.105,.14,length(cell)));
 }else if(d>20.5&&d<21.5){
  vec2 cell=fract(vec2(p.x*27.0+floor(y*20.0)*.37,y*20.0))-.5;
  float stem=(1.0-smoothstep(.017,.035,abs(cell.x-cell.y*.28)))*step(abs(cell.y),.35);
  vec2 leaf=cell-vec2(sign(cell.y)*.105,sign(cell.y)*.13);float leaves=1.0-smoothstep(.10,.16,length(leaf*vec2(1.0,.6)));
  base=mix(base,ink,clamp(stem+leaves,0.0,1.0)*.57);
 }else if(d>21.5&&d<22.5){
  float zig=abs(fract(p.x*13.0)-.5);base=mix(base,cream,step(.62,fract(y*17.0-zig))*.92);
 }else if(d>22.5&&d<23.5){
  float t=smoothstep(uZ1.z,uZ1.x,y);base=mix(base*vec3(.46,.44,.85),base,t);
 }
 float placket=step(ax,0.006)*front*step(uZ1.z,y)*step(y,uZ1.x-0.04);
 if(d>0.5&&d<1.5||d>3.5&&d<5.5||d>8.5&&d<9.5||d>12.5&&d<13.5){
  base=mix(base,ink,placket*0.50);
  float buttons=step(ax,0.005)*step(abs(fract(y*20.0)-0.5),0.085)*front*step(uZ1.z+0.04,y)*step(y,uZ1.x-0.065);
  // Raised buttons are skinned geometry on these garments.
 }
 if(d>7.5&&d<8.5||d>5.5&&d<6.5){base=mix(base,ink,placket);}
 if(d>3.5&&d<4.5||d>12.5&&d<13.5){
  float pocket=step(abs(ax-0.082),0.041)*step(abs(y-(uZ1.x-0.22)),0.049)*front;
  float flap=step(abs(ax-0.082),0.044)*step(abs(y-(uZ1.x-0.18)),0.008)*front;
  base=mix(base,base*0.70,pocket);base=mix(base,cream*0.55,flap);
 }
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
}`;

/* Tailor the source garment once per body/recipe, preserving every skin weight.
   Source geometry remains untouched and the library caches the tailored result. */
export function tailorGarment(THREE,mesh,outfit,zones){
 if(outfit.design===0||!/Body|Arms/.test(mesh.name)||/Belt|Bracer/.test(mesh.name))return mesh.geometry;
 const geo=mesh.geometry.clone(),p=geo.attributes.position,n=geo.attributes.normal;
 const body=/Body/.test(mesh.name),cut=outfit.cut;
 for(let i=0;i<p.count;i++){
  let x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  if(body){
   const hem=zones.waistY+(cut==='coat'?-0.10:cut==='gilet'?-0.035:0.008);
   if(y<zones.waistY+0.06){const t=Math.max(0,Math.min(1,(zones.waistY+0.06-y)/(zones.waistY+0.06-0.92)));y=zones.waistY+0.06-t*(zones.waistY+0.06-hem);}
  }
  const ease=cut==='sweater'?0.008:cut==='jacket'||cut==='coat'?0.004:0;
  if(ease&&(!/Arms/.test(mesh.name)||Math.abs(x)<zones.cuffX-0.02)){x+=n.getX(i)*ease;y+=n.getY(i)*ease;z+=n.getZ(i)*ease;}
  p.setXYZ(i,x,y,z);
 }
 geo.computeVertexNormals();geo.computeBoundingSphere();return geo;
}

/* A continuous cloth shell for everyday tops, instead of recolouring the source
   fantasy tunic's corset. The body supplies the exact joint weights and hands.
   A shader trims the neck and hem; a small envelope gives the cloth breathing room. */
function smoothClothNormals(geo){
 geo.computeVertexNormals();const p=geo.attributes.position,n=geo.attributes.normal,groups=new Map();
 for(let i=0;i<p.count;i++){
  const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*100000)).join(',');
  let group=groups.get(key);if(!group){group={indices:[],x:0,y:0,z:0};groups.set(key,group);}
  group.indices.push(i);group.x+=n.getX(i);group.y+=n.getY(i);group.z+=n.getZ(i);
 }
 for(const g of groups.values()){const length=Math.hypot(g.x,g.y,g.z)||1;for(const i of g.indices)n.setXYZ(i,g.x/length,g.y/length,g.z/length);}
 n.needsUpdate=true;
}
export function tailoredTop(kit,outfit){
 const src=kit.skin,geo=src.geometry.clone();smoothClothNormals(geo);
 const p=geo.attributes.position,n=geo.attributes.normal,zones=kit.zones;
 const ease=outfit.cut==='sweater'?0.026:outfit.cut==='jacket'||outfit.cut==='coat'?0.018:0.012;
 const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
 for(let i=0;i<p.count;i++){
  let x=p.getX(i),y=p.getY(i),z=p.getZ(i),ax=Math.abs(x);
  const upper=smooth(zones.waistY-0.11,zones.waistY-0.03,y)*(1-smooth(zones.neckY-0.04,zones.neckY+0.01,y));
  const hands=1-smooth(zones.cuffX-0.055,zones.cuffX,ax);
  const amount=ease*upper*hands;
  x+=n.getX(i)*amount;y+=n.getY(i)*amount;z+=n.getZ(i)*amount;
  // Bridge the breast and waist contours with one relaxed front of cloth.
  if(z>0.02&&ax<0.18&&y>zones.waistY&&y<zones.neckY-0.07){
   const front=Math.sqrt(Math.max(0,1-(x/0.185)**2))*(kit.body==='f'?0.127:0.14);
   const blend=smooth(zones.waistY,zones.waistY+0.08,y)*(1-smooth(zones.neckY-0.16,zones.neckY-0.07,y));
   z+=Math.max(0,front+ease-z)*blend;
  }
  const torso=(1-smooth(.16,.22,ax))*upper;
  const relaxed=outfit.cut==='sweater'?.18:outfit.cut==='jacket'||outfit.cut==='coat'?.13:.08;
  x*=1+relaxed*torso*(1-smooth(zones.waistY+.08,zones.neckY-.15,y));
  const elbow=Math.exp(-1*((ax-.49)/.07)**2)*smooth(.20,.28,ax);
  const waist=Math.exp(-1*((y-zones.waistY-.04)/.065)**2)*torso;
  const folds=(Math.sin(ax*116+y*31)*elbow*.0035+Math.sin(y*105+ax*24+Math.sin(ax*40))*waist*.0030)*(outfit.cut==='sweater'?1.5:1);
  const cuff=Math.exp(-1*((ax-zones.cuffX+.035)/.008)**2)*.0034*upper;
  const hem=zones.waistY-(outfit.cut==='coat'?.13:.04);
  const hemRoll=Math.exp(-1*((y-hem-.012)/.007)**2)*.0028*torso;
  const collar=Math.exp(-1*((y-zones.neckY+.025)/.009)**2)*.004*(1-smooth(.075,.12,ax));
  const seam=(folds+cuff+hemRoll+collar)*hands;
  x+=n.getX(i)*seam;y+=n.getY(i)*seam;z+=n.getZ(i)*seam;
  p.setXYZ(i,x,y,z);
 }
 smoothClothNormals(geo);geo.computeBoundingSphere();
 return {geometry:geo,material:src.material,name:'Tailored_Body',skeleton:src.skeleton,bindMatrix:src.bindMatrix};
}

/* Small sewn pieces use barycentric weights from the cloth beneath them. Collars,
   pocket lips and buttons therefore bend with her chest, instead of floating on it. */
export function sewnDetails(THREE,top,outfit,kit){
 const d=outfit.design,z=kit.zones;
 if(![1,4,5,9,12,13,14,16,19,20,21].includes(d))return [];
 const g=top.geometry,p=g.attributes.position,idx=g.index,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
 const get=(a,i,k)=>a[['getX','getY','getZ','getW'][k]](i);
 const sample=(x,y)=>{
  let best=null;
  for(let i=0;i<idx.count;i+=3){
   const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2);
   const ax=p.getX(a),ay=p.getY(a),bx=p.getX(b),by=p.getY(b),cx=p.getX(c),cy=p.getY(c);
   const det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(det)<1e-10)continue;
   const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/det,v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/det,w=1-u-v;
   if(Math.min(u,v,w)<-0.001)continue;
   const zz=u*p.getZ(a)+v*p.getZ(b)+w*p.getZ(c);if(zz<0||best&&zz<=best.z)continue;
   const weights=new Map();for(const [vi,t] of [[a,u],[b,v],[c,w]])for(let k=0;k<4;k++){const joint=get(si,vi,k);weights.set(joint,(weights.get(joint)||0)+get(sw,vi,k)*t);}
   const ranked=[...weights].filter(([,w])=>w>0).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=ranked.reduce((s,v)=>s+v[1],0);
   while(ranked.length<4)ranked.push([0,0]);
   best={z:zz,j:ranked.map(v=>v[0]),w:ranked.map(v=>v[1]/sum)};
  }
  return best;
 };
 const make=(name,triangles,metal=false)=>{
  const positions=[],uv=[],joints=[],weights=[];
  for(const tri of triangles){const samples=tri.map(v=>sample(v[0],v[1]));if(samples.some(v=>!v))continue;
   tri.forEach((v,i)=>{const s=samples[i];positions.push(v[0],v[1],s.z+v[2]);uv.push(v[0]*3,v[1]*3);joints.push(...s.j);weights.push(...s.w);});}
  if(!positions.length)return null;
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));
  geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));geo.computeVertexNormals();geo.computeBoundingSphere();
  const material=metal?new THREE.MeshStandardMaterial({color:d===4?0xa78a58:0xbab6a7,roughness:.38,metalness:.65,side:THREE.DoubleSide}):kit.materials.body;
  return {geometry:geo,material,name,skeleton:top.skeleton,bindMatrix:top.bindMatrix};
 };
 const cloth=[],collars=[],buttons=[];
 for(const side of [-1,1]){
  if(d!==12){
   const a=[side*.018,z.neckY-.008,.005],b=[side*.074,z.neckY-.035,.004],c=[side*.042,z.neckY-(d===9?.145:.066),.010];
   collars.push(side>0?[a,c,b]:[a,b,c]);
  }
  if([4,13].includes(d)){
   const cx=side*.077,cy=z.neckY-.20,w=.061,h=.072;
   for(let i=0;i<6;i++)for(let j=0;j<6;j++){
    const vertex=(u,v)=>[cx+(u-.5)*w,cy+(v-.5)*h,.0015+.002*Math.sin(u*Math.PI)*Math.sin(v*Math.PI)+(v>.8?.001:0)];
    const a=vertex(i/6,j/6),b=vertex((i+1)/6,j/6),c=vertex(i/6,(j+1)/6),e=vertex((i+1)/6,(j+1)/6);cloth.push([a,b,c],[b,e,c]);
   }
  }
 }
 for(let y=z.waistY+.065;y<z.neckY-.075;y+=.049){
  const x=d===12?.047:0,r=d===9?.0036:.0027;
  for(let k=0;k<12;k++){const a=k/12*Math.PI*2,b=(k+1)/12*Math.PI*2;buttons.push([[x,y,.0045],[x+Math.cos(a)*r,y+Math.sin(a)*r,.003],[x+Math.cos(b)*r,y+Math.sin(b)*r,.003]]);}
 }
 return [make('Tailored_Collars',collars),make('Tailored_Details',cloth),make('Sewn_Buttons',buttons,true)].filter(Boolean);
}
