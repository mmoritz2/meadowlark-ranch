import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../assets/vendor/three/build/three.module.js';
import {coldWoodlandWeights,coldWoodlandProfile,coldPastureCover,coldCoverProfile} from '../assets/cold-woodland.mjs';

const profile=(x,z,source='mature-pine',height=10.5)=>coldWoodlandProfile({x,z,height,source});

test('climate support follows the three established footprints and stays compact',()=>{
 for(const [x,z] of [[-160,-210],[-300,-320],[-150,-333]])assert.equal(coldWoodlandWeights(x,z).weight,1);
 for(const [x,z] of [[0,0],[47,-50],[300,-300],[310,300],[-330,300],[-501,-501]]){
  assert.equal(coldWoodlandWeights(x,z).weight,0);assert.equal(profile(x,z),null);
 }
 assert.equal(coldWoodlandWeights(-160,-52).hollow,0);
 assert.equal(coldWoodlandWeights(-300,-448).frost,0);
 assert.equal(coldWoodlandWeights(-40,-333).alpine,0);
 for(let z=-500;z<=500;z+=5)for(let x=-500;x<=500;x+=5){
  const w=coldWoodlandWeights(x,z);assert.ok(Object.values(w).every(v=>Number.isFinite(v)&&v>=0&&v<=1));
  if(w.weight>0)assert.ok(Math.hypot(x+160,z+210)<158||Math.hypot(x+300,z+320)<128||Math.hypot((x+150)/100,(z+333)/92)<1.1);
 }
});

test('the tapered margin is continuous and every snowy-core crown is evergreen',()=>{
 for(let x=-470;x<50;x+=2)for(let z=-460;z<-40;z+=2){
  const a=coldWoodlandWeights(x,z),b=coldWoodlandWeights(x+.1,z+.1);
  // Smoothstep's peak derivative is 1.5; the narrowest transition is 41.4m.
  assert.ok(Math.abs(a.weight-b.weight)<1.5*Math.hypot(.1,.1)/41.4+.00001);
  if(a.weight>.35){const p=profile(x,z,'woodland-broadleaf');assert.ok(/^(mature-pine|pine-[012])$/.test(p.source));}
 }
});

test('sheltered groves show coherent ages and a shorter regeneration layer',()=>{
 const points=[];for(let z=-382;z<=-258;z+=4)for(let x=-362;x<=-238;x+=4){
  const p=profile(x,z);if(p?.weight>.9)points.push({x,z,...p});
 }
 const adults=points.filter(p=>p.source==='mature-pine'),young=points.filter(p=>p.source.startsWith('pine-'));
 assert.ok(adults.length/points.length>.65&&adults.length/points.length<.94);
 assert.ok(young.length>30);
 let same=0,pairs=0;
 for(const p of points)for(const q of points)if(Math.hypot(p.x-q.x,p.z-q.z)===4){
  pairs++;same+=(p.source==='mature-pine')===(q.source==='mature-pine');
 }
 assert.ok(same/pairs>.86);
 const mean=a=>a.reduce((s,p)=>s+p.height,0)/a.length;
 assert.ok(mean(adults)>mean(young)*1.2);
 assert.ok(new Set(young.map(p=>p.source)).size>=2);
});

test('retained broadleaf crowns in the thaw margin preserve their original dimensions',()=>{
 let retained=0,replaced=0;
 for(let z=-450;z<-40;z+=3)for(let x=-470;x<30;x+=3){
  const site={x,z,height:13.75,source:'woodland-broadleaf'},p=coldWoodlandProfile(site);
  if(!p||p.weight>.35)continue;
  if(p.source===site.source){retained++;assert.equal(p.height,site.height);assert.equal(p.crownWidth,1);}
  else{replaced++;assert.ok(/^(mature-pine|pine-[012])$/.test(p.source));}
 }
 assert.ok(retained>100&&replaced>100);
});

test('wind-exposed trees stay smaller and profiles are bounded, immutable and deterministic',()=>{
 const site={x:-160,z:-338,height:14,source:'pine-1',elevation:45,grade:.7};
 const copy=structuredClone(site),first=coldWoodlandProfile(site);
 assert.deepEqual(site,copy);assert.deepEqual(coldWoodlandProfile(site),first);
 const sheltered=coldWoodlandProfile({...site,elevation:3,grade:.04});
 assert.ok(first.shelter<sheltered.shelter);
 assert.ok(first.height<=sheltered.height);
 let calls=0;const original=Math.random;Math.random=()=>{calls++;throw Error('Global RNG consumed');};
 try{for(let i=0;i<1000;i++){
  const p=coldWoodlandProfile({x:-400+i%200,z:-400+Math.floor(i/200)*20,height:6+i%9,source:'pine-2',elevation:i%50,grade:i%10/10});
  if(!p)continue;
  assert.ok(Object.values(p).every(v=>typeof v!=='number'||Number.isFinite(v)));
  assert.ok(p.height>=5.2&&p.height<=16&&p.crownWidth>=.86&&p.crownWidth<=1.05);
 }}finally{Math.random=original;}
 assert.equal(calls,0);
});

test('every evergreen choice has the existing licensed detailed mesh and matching eight-view atlas',()=>{
 const catalog=JSON.parse(readFileSync(new URL('../assets/models/world/realism/tree-impostors.json',import.meta.url)));
 const choices=[['pine_tree_01',0],['fir_sapling_medium',0],['fir_sapling_medium',1],['fir_sapling_medium',2]];
 for(const [id,variant] of choices){const item=catalog.trees.find(t=>t.id===id&&t.variant===variant);
  assert.equal(item.license,'CC0-1.0');assert.equal(item.viewCount,8);assert.ok(item.width>0&&item.sourceHeight>0);
  for(const file of [item.source,item.views.file,item.normals.file])assert.ok(readFileSync(new URL('../assets/models/world/realism/'+file,import.meta.url)).length>0);
 }
});


test('winter turf tapers continuously within existing support and leaves other biomes untouched',()=>{
 for(const [x,z] of [[0,0],[47,-50],[300,-300],[310,300],[-330,300]]){
  assert.equal(coldPastureCover(x,z),1);
  for(const kind of ['tuft','petal','brack','reed','scrub','juni','sage'])assert.equal(coldCoverProfile(x,z,kind),null);
 }
 for(let z=-470;z<-35;z+=2)for(let x=-470;x<35;x+=2){
  const weight=coldWoodlandWeights(x,z).weight,cover=coldPastureCover(x,z);
  assert.ok(Number.isFinite(cover)&&cover>=0&&cover<=1);
  if(weight<=.08)assert.equal(cover,1);
  if(weight>=.60)assert.equal(cover,0);
  // Combined smoothsteps have a bounded derivative, so no hard pasture seam.
  assert.ok(Math.abs(cover-coldPastureCover(x+.1,z+.1))<.016);
 }
});

test('winter cores remove summer flowers/turf while preserving a sparse low evergreen floor',()=>{
 for(const [x,z] of [[-160,-210],[-300,-320],[-150,-333]]){
  for(const kind of ['tuft','petal','brack'])assert.equal(coldCoverProfile(x,z,kind).density,0);
  for(const kind of ['reed','scrub','juni','sage']){
   const p=coldCoverProfile(x,z,kind);assert.ok(p.density>0&&p.density<=.25);assert.ok(p.size<=.67);
  }
  assert.equal(coldCoverProfile(x,z,'trunk'),null);
 }
 let margin=0;for(let z=-470;z<-35;z+=5)for(let x=-470;x<35;x+=5){
  const w=coldWoodlandWeights(x,z).weight;
  if(w>.08&&w<.6){margin++;assert.equal(coldCoverProfile(x,z,'petal').density,0);
   const p=coldCoverProfile(x,z,'tuft');assert.ok(p.density>0&&p.density<1&&p.size<1&&p.tintAmount>0);
  }
 }
 assert.ok(margin>200);
});

test('cover profiles consume no RNG and are deterministic regardless of visitation order',()=>{
 const points=[];for(let i=0;i<200;i++)points.push([-430+i%25*15,-410+Math.floor(i/25)*35]);
 let calls=0;const original=Math.random;Math.random=()=>{calls++;throw Error('Global RNG consumed');};
 try{
  const direct=points.map(([x,z])=>coldCoverProfile(x,z,'juni'));
  const reverse=points.slice().reverse().map(([x,z])=>coldCoverProfile(x,z,'juni')).reverse();
  assert.deepEqual(direct,reverse);assert.equal(calls,0);
 }finally{Math.random=original;}
});


test('actual winter bank pass preserves outside bytes, removes summer cores and keeps shortened roots grounded',()=>{
 const source=readFileSync(new URL('../assets/features/world-flora.js',import.meta.url),'utf8');
 const start=source.indexOf(' /* ---- 6l. winter woodland floor'),end=source.indexOf(' /* ================= 7. hand the banks to the renderer',start);
 assert.ok(start>=0&&end>start,'Winter postpass boundaries missing');
 const run=new Function('THREE','BANK','_m','_v','_q','_sc','_col','hsh','groundH','coldCoverProfile','F',source.slice(start,end));
 const groundH=(x,z)=>x*.004-z*.003+Math.sin(x*.07)*.2;
 const hsh=(i,j)=>{let h=(Math.imul(i|0,374761393)+Math.imul(j|0,668265263))|0;h=Math.imul(h^h>>>13,1274126177);return ((h^h>>>16)>>>0)/4294967295;};
 const points=[];
 // Interleave removed, transformed and unchanged sites to exercise real bank
 // compaction, including later outside instances copied over earlier removals.
 for(let i=0;i<32;i++){
  points.push([-320+i%8*5,-344+Math.floor(i/8)*6]);
  points.push([15.123+i*6.327,35.287+i%7*10.113]);
  const a=.12+i*.049;points.push([-160+Math.cos(a)*135,-210+Math.sin(a)*135]);
 }
 const BANK={},snapshots={},geometry=new THREE.BoxGeometry(.1,1,.1),material=new THREE.MeshBasicMaterial({vertexColors:true});
 const matrix=new THREE.Matrix4(),color=new THREE.Color(),quaternion=new THREE.Quaternion();
 const kinds=['tuft','petal','brack','reed','scrub','juni','sage','trunk'];
 for(const kind of kinds){
  const im=new THREE.InstancedMesh(geometry,material,points.length),before=[];
  points.forEach(([x,z],i)=>{
   quaternion.setFromEuler(new THREE.Euler((i%3-.5)*.08,i*1.718,(i%5-2)*.045));
   matrix.compose(new THREE.Vector3(x,groundH(x,z)+.17+i%5*.018,z),quaternion,new THREE.Vector3(.7+i%7*.17,.4+i%9*.12,.5+i%5*.13));
   im.setMatrixAt(i,matrix);color.setRGB(.27+i%7*.025,.42+i%5*.031,.21+i%3*.044);im.setColorAt(i,color);
   before.push({matrix:Array.from(im.instanceMatrix.array.slice(i*16,i*16+16)),color:Array.from(im.instanceColor.array.slice(i*3,i*3+3))});
  });
  BANK[kind]={im,n:points.length,cap:points.length};snapshots[kind]=before;
 }
 const F={},original=Math.random;let randomCalls=0;
 Math.random=()=>{randomCalls++;throw Error('Winter postpass consumed seeded RNG');};
 try{run(THREE,BANK,new THREE.Matrix4(),new THREE.Vector3(),new THREE.Quaternion(),new THREE.Vector3(),new THREE.Color(),hsh,groundH,coldCoverProfile,F);}
 finally{Math.random=original;}
 assert.equal(randomCalls,0);
 assert.ok(F.winterCover.removed>100&&F.winterCover.shortened>20);
 const key=m=>m[12]+','+m[14];let retainedMarginScrub=0;
 for(const kind of kinds){
  const bank=BANK[kind],before=new Map(snapshots[kind].map(record=>[key(record.matrix),record])),after=new Map();
  for(let i=0;i<bank.n;i++){
   const m=Array.from(bank.im.instanceMatrix.array.slice(i*16,i*16+16)),c=Array.from(bank.im.instanceColor.array.slice(i*3,i*3+3));
   assert.ok(before.has(key(m)),'Postpass moved a trunk/plant coordinate');after.set(key(m),{matrix:m,color:c});
   const old=before.get(key(m)),weight=coldWoodlandWeights(m[12],m[14]).weight;
   if(kind==='petal')assert.ok(weight<=.08,'Summer flowers survive winter support');
   if(['tuft','brack'].includes(kind))assert.ok(weight<.6,'Summer turf survives a snowy core');
   if(kind==='scrub'&&weight>.08&&weight<.6){
    retainedMarginScrub++;const profile=coldCoverProfile(m[12],m[14],kind),ground=groundH(m[12],m[14]);
    assert.ok(Math.abs(m[13]-(ground+(old.matrix[13]-ground)*profile.size))<.000002,'Shortened scrub root floated');
    for(const column of[0,4,8]){
     const oldLength=Math.hypot(...old.matrix.slice(column,column+3)),newLength=Math.hypot(...m.slice(column,column+3));
     assert.ok(Math.abs(newLength-oldLength*profile.size)<.000002,'Anisotropic source scale lost');
     for(let j=0;j<3;j++)assert.ok(Math.abs(m[column+j]/newLength-old.matrix[column+j]/oldLength)<.000002,'Source orientation changed');
    }
    assert.notDeepEqual(c,old.color,'Winter margin was not desaturated');
   }
  }
  for(const [k,old] of before)if(kind==='trunk'||coldWoodlandWeights(old.matrix[12],old.matrix[14]).weight<=.08){
   assert.ok(after.has(k),'Outside plant disappeared');assert.deepEqual(after.get(k),old,'Outside matrix/colour bytes changed');
  }
 }
 assert.ok(retainedMarginScrub>10,'Fixture did not exercise retained thaw scrub');
});
