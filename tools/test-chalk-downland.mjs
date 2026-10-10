import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three/build/three.module.js';
import {createChalkDown} from '../assets/chalk-down.js';
import {chalkDownlandLift,CHALK_MARE_PANEL} from '../assets/chalk-downland.mjs';
const site={x:0,z:0,len:112,depth:76,h:14,crest:.5};
const THREE={...T,TextureLoader:class{load(){return new T.Texture();}}};
const mat=new T.MeshStandardMaterial();
const down=createChalkDown({THREE,site,baseHeight:()=>2,groundMaterial:mat});
const ground=down.root.getObjectByName('vista:chalkscarp'),p=ground.geometry.attributes.position,idx=ground.geometry.index;

test('compact connected down retains zero hem and a substantial asymmetric ridge',()=>{
 let max=0;const crests=[];
 for(let u=-56;u<=56;u+=.5){assert.equal(chalkDownlandLift(site,u,0),0);assert.equal(chalkDownlandLift(site,u,1),0);let peak=0,at=0;
  for(let j=0;j<=160;j++){const t=j/160,y=chalkDownlandLift(site,u,t);assert(Number.isFinite(y)&&y>=0&&y<=site.h*1.11);if(y>peak){peak=y;at=t;}max=Math.max(max,y);}
  if(Math.abs(u)<35)crests.push(at);
 }
 assert(max>site.h&&max<site.h*1.11,'hill identity is retained');
 assert(Math.max(...crests)-Math.min(...crests)>.10,'ridge bends in depth, not just across-slope pigment');
 for(const u of [-60,-56,56,60])for(const t of [.1,.3,.6,.9])assert.equal(chalkDownlandLift(site,u,t),0);
});

test('ground retains grid and every sampled triangle is the physical surface',()=>{
 assert.equal(p.count,18193);assert.equal(idx.count/3,35840);assert.equal(ground.material,mat);assert(ground.castShadow&&ground.receiveShadow);
 let minDot=1,minY=Infinity,maxContact=0;
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),cross=new T.Vector3(),ab=new T.Vector3(),ac=new T.Vector3(),n=ground.geometry.attributes.normal;
 for(let i=0;i<idx.count;i+=3){const ia=idx.getX(i),ib=idx.getX(i+1),ic=idx.getX(i+2);a.fromBufferAttribute(p,ia);b.fromBufferAttribute(p,ib);c.fromBufferAttribute(p,ic);cross.crossVectors(ab.subVectors(b,a),ac.subVectors(c,a));assert(cross.lengthSq()>1e-8);assert(cross.y>0);cross.normalize();
  for(const id of [ia,ib,ic]){const v=new T.Vector3().fromBufferAttribute(n,id);assert(Number.isFinite(v.length())&&Math.abs(v.length()-1)<1e-6);minDot=Math.min(minDot,v.dot(cross));minY=Math.min(minY,v.y);}
  if(i%300===0){const x=(a.x+b.x+c.x)/3,z=(a.z+b.z+c.z)/3;maxContact=Math.max(maxContact,Math.abs(down.heightAt(x,z)-(a.y+b.y+c.y)/3));}
 }
 assert(minDot>.98);assert(minY>.66,'finite climb grades, not spikes');assert(maxContact<.00001);
 assert.equal(down.heightAt(57,0),-Infinity);assert.equal(down.reliefAt(57,0),0);
});

test('historical planting samples and masks remain separate from live hoof heights',()=>{
 // Baseline f8801b7, flat base 2m. This is the accepted planting surface, not
 // a second implementation of the new sculpted profile.
 const cases=[[0,.1,3.384157228469848,false,true],[0,.25,7.780403137207031,true,true],[0,.45,12.618330955505371,false,true],[-25,.5,16.270891189575195,false,true],[25,.5,14.597278322492327,false,true],[50,.9,2.085953576224191,false,false],[8,.35,10.086948912484305,true,true]];
 for(const [x,t,y,cut,contains] of cases){const z=(t-.5)*76;assert.equal(down.planningHeightAt(x,z),y);assert.equal(down.planningIsChalk(x,z),cut);assert.equal(down.planningContains(x,z),contains);}
 assert(Math.abs(down.heightAt(0,-19)-down.planningHeightAt(0,-19))>1);assert.equal(down.planningHeightAt(57,0),-Infinity);assert.equal(down.stats.planningBytes,18193*4);
});

test('direct-mapped mare is seated, finite and uses matching live plant exclusion',()=>{
 const cut=down.root.getObjectByName('Chalk Mare | ground cutting').geometry,cp=cut.attributes.position,cn=cut.attributes.normal;
 assert(cp.count/3<36000);let gap=0,inside=0,totalArea=0,minDot=1;
 for(let i=0;i<cp.count;i+=3){const vs=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(cp,i+k)),cross=new T.Vector3().subVectors(vs[1],vs[0]).cross(new T.Vector3().subVectors(vs[2],vs[0]));assert(cross.lengthSq()>1e-16);const area=Math.abs(cross.y)/2;totalArea+=area;cross.normalize();
  for(let k=0;k<3;k++){const v=vs[k],normal=new T.Vector3().fromBufferAttribute(cn,i+k);gap=Math.max(gap,Math.abs(v.y-down.heightAt(v.x,v.z)-.023));assert(Number.isFinite(normal.length())&&Math.abs(normal.length()-1)<1e-6);minDot=Math.min(minDot,normal.dot(cross));}
  const x=vs.reduce((s,v)=>s+v.x,0)/3,z=vs.reduce((s,v)=>s+v.z,0)/3;if(down.isChalk(x,z))inside+=area;
 }
 assert(gap<.00001);assert(minDot>.89);assert(inside/totalArea>.995,'only subcentimetre rough outline edges may differ from clean exclusion curve');
 const map=(x,y)=>[x*CHALK_MARE_PANEL.xScale+CHALK_MARE_PANEL.xOffset,(CHALK_MARE_PANEL.tBase+y*CHALK_MARE_PANEL.tScale-.5)*site.depth];
 assert(down.isChalk(...map(0,4)));assert(!down.isChalk(...map(0,-1)),'leg-space remains open');
});

test('planning preserves original draw and row identity before live cutting clearance',async()=>{
 const {readFile}=await import('node:fs/promises'),source=await readFile(new URL('../assets/features/world-flora.js',import.meta.url),'utf8');
 const start=source.indexOf(' function put(name,x,z,h,wid,col,lean,sink){'),end=source.indexOf(' /* A tree is a trunk',start);assert(start>=0&&end>start);
 const putFactory=new Function('chalkPlanning','W','BANK','rnd','groundH','_m','_q','_e','_v','_sc','_col',source.slice(start,end)+';return put;');
 const fixture=(legacy,live)=>{let calls=0;const result={matrices:[],colors:[]},bank={n:0,cap:1,im:{setMatrixAt(i,m){result.matrices[i]=m.toArray();},setColorAt(i,c){result.colors[i]=c.toArray();}}};
  const put=putFactory({planningIsChalk:()=>legacy,isChalk:()=>live},{sceneryArt:{containsWaterfall:()=>false}},{tuft:bank},()=>{calls++;return .4;},()=>5,new T.Matrix4(),new T.Quaternion(),new T.Euler(),new T.Vector3(),new T.Vector3(),new T.Color());
  const accepted=put('tuft',10,20,2,.6,'#ccccaa',.1);return{...result,calls,count:bank.n,accepted};};
 const outside=fixture(false,false),cut=fixture(false,true),legacy=fixture(true,false);
 assert.equal(outside.calls,6);assert.equal(cut.calls,6);assert.equal(cut.count,outside.count);assert(cut.accepted&&outside.accepted);assert.deepEqual(cut.colors,outside.colors);
 for(const i of [12,13,14,15])assert.equal(cut.matrices[0][i],outside.matrices[0][i]);
 assert.deepEqual(cut.matrices,outside.matrices,'cut rows must stay nonsingular until cover policies finish');
 assert(outside.matrices[0].slice(0,11).some(v=>Math.abs(v)>.1));assert.equal(legacy.calls,0);assert.equal(legacy.count,0);assert.equal(legacy.accepted,false);
});

test('actual cleanup, dry, winter and grazed policies finish before live-cut singular bases',async()=>{
 const {readFile}=await import('node:fs/promises'),source=await readFile(new URL('../assets/features/world-flora.js',import.meta.url),'utf8');
 const start=source.indexOf(' const coverKinds='),end=source.indexOf(' /* ================= 7.',start);assert(start>=0&&end>start);
 const body=source.slice(start,end),run=new Function('D','with(D){'+body+'}');
 const make=live=>{
  const BANK={},rows={};for(const name of ['scrub','juni','sage','brack','reed','tuft','petal','succ','oco']){
   const matrices=[new T.Matrix4().compose(new T.Vector3(10,4.95,20),new T.Quaternion(),new T.Vector3(.8,1.2,.8)),new T.Matrix4().compose(new T.Vector3(30,4.95,40),new T.Quaternion(),new T.Vector3(.8,1.2,.8))],colors=[new T.Color('#aabc90'),new T.Color('#aabc90')];
   rows[name]={matrices,colors};BANK[name]={n:2,im:{geometry:{attributes:{position:{count:2,getX:()=>0,getY:i=>i,getZ:()=>0}}},getMatrixAt(i,out){out.copy(matrices[i]);},setMatrixAt(i,m){matrices[i]=m.clone();},getColorAt(i,out){out.copy(colors[i]);},setColorAt(i,c){colors[i]=c.clone();}}};
  }
  let grazed=0;const D={THREE:T,BANK,F:{},KEEP:[],inFarm:()=>false,pathDist:()=>100,onRace:()=>false,alpineSnowAt:()=>0,vn:()=>.5,hsh:()=>0,groundH:()=>5,biomeAt:()=> 'meadow',coyoteCoverDryWeight:()=>0,coldCoverProfile:()=>null,onWater:()=>false,
   grazedTuftScale(x,z,height){grazed++;assert([x,z,height].every(Number.isFinite));assert(height>0,'hidden zero basis must never enter scale policy');return .8;},chalkPlanning:{isChalk:(x,z)=>live&&x===10&&z===20},_m:new T.Matrix4(),_q:new T.Quaternion(),_v:new T.Vector3(),_sc:new T.Vector3(),_col:new T.Color()};
  run(D);return{rows,BANK,F:D.F,grazed};
 };
 const ordinary=make(false),clear=make(true);assert.equal(clear.grazed,2);assert.equal(clear.grazed,ordinary.grazed);
 for(const name of Object.keys(clear.BANK)){assert.equal(clear.BANK[name].n,ordinary.BANK[name].n);assert.deepEqual(clear.rows[name].colors,ordinary.rows[name].colors);assert.deepEqual(clear.rows[name].matrices[1],ordinary.rows[name].matrices[1]);
  const a=clear.rows[name].matrices[0].elements,b=ordinary.rows[name].matrices[0].elements;assert(a.every(Number.isFinite));for(const i of [12,13,14,15])assert.equal(a[i],b[i]);for(const i of [0,1,2,4,5,6,8,9,10])assert.equal(a[i],0);assert.equal(clear.F.chalkCover[name],1);
 }
});
