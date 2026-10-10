import test from 'node:test';
import assert from 'node:assert/strict';
import {ALPINE_BOUNDS,HOLLOWPEAK,alpineRelief,fallsRelief,fallsTerrainHeight,fallsRadius} from '../assets/falls-landscape.js';

test('connected eastern buttress has unequal crests and keeps a finite bounded mountain field',()=>{
 const spine=[[-109,-330],[-98,-311],[-102,-295],[-88,-281]];
 for(let j=1;j<spine.length;j++)for(let t=0;t<=1;t+=.02){
  const a=spine[j-1],b=spine[j],x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
  assert(alpineRelief(x,z)>15,'The east ridge stays connected between its unequal crests');
 }
 assert(alpineRelief(-109,-330)>alpineRelief(-88,-281)+10);
 assert(alpineRelief(-102,-295)>alpineRelief(-85,-295)+8,'A real side face replaces the old broad uniform shoulder');
 let maximum=0;
 for(let z=-425;z<=-200;z+=1.3)for(let x=-285;x<=-20;x+=1.1){
  const h=fallsRelief(x,z);assert(Number.isFinite(h)&&h>=0&&h<64);maximum=Math.max(maximum,h);
  if(x<=ALPINE_BOUNDS.x0||x>=ALPINE_BOUNDS.x1||z<=ALPINE_BOUNDS.z0||z>=ALPINE_BOUNDS.z1)assert.equal(h,0);
  const d=.001;for(const [dx,dz]of[[d,0],[0,d]])assert(Math.abs(fallsRelief(x+dx,z+dz)-h)<.012,'No finite height jump at a authored profile end');
 }
 assert(maximum>45,'The divide is a substantial landform');
});

test('the full stream, both pool beds and protected Frostpine trail remain usable',()=>{
 for(const p of [HOLLOWPEAK.pool,HOLLOWPEAK.tarn]){
  assert(fallsTerrainHeight(p.x,p.z,3)<p.level-.8);
  for(let angle=0;angle<Math.PI*2;angle+=.07){
   const radius=fallsRadius(angle,p);
   for(const r of [.25,.5,.75,1]){
    const x=p.x+Math.cos(angle)*radius*r,z=p.z+Math.sin(angle)*radius*r*p.aspect;
    assert(fallsTerrainHeight(x,z,3)<p.level+.8,'Connected bank envelope remains bounded around both pools');
   }
  }
 }
 const trail=[[-160,-215],[-173.0439,-225.4024],[-187.0279,-235.9788],[-200.6802,-244.8582],[-260,-280]];
 for(let j=1;j<trail.length;j++)for(let t=0;t<=1;t+=.01){const a=trail[j-1],b=trail[j],x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;assert.equal(fallsTerrainHeight(x,z,3),3);}
});

test('rounded crest and bend tangents meet continuously at the visible ridge knots',()=>{
 // Public height samples test the resulting surface, not a duplicate of the
 // fillet formula. The sharp V1 profiles had3–7m/m derivative jumps here.
 for(const p of [[-194,-355],[-158,-347],[-109,-330],[-98,-311]])for(const axis of [0,1]){
  const h=.001,left=p.slice(),right=p.slice();left[axis]-=h;right[axis]+=h;
  const centre=alpineRelief(...p),a=(centre-alpineRelief(...left))/h,b=(alpineRelief(...right)-centre)/h;
  assert(Number.isFinite(a+b));assert(Math.abs(a-b)<.01,'No sharp tangent seam at '+[...p,axis]);
 }
});
