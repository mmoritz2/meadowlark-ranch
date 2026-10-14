import {grazedTuftScale} from '../assets/meadow-tufts.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {FIELD_SWARD_BANDS as oldBands,FIELD_SWARD_RECOVERY as oldRecovery,FIELD_SWARD_HEIGHT_BOOST as oldBoost,fieldSwardAt as before} from './fixtures/commons-landscape-2fbab/field-sward-bands.mjs';
import {FIELD_SWARD_BANDS as bands,FIELD_SWARD_RECOVERY,FIELD_SWARD_HEIGHT_BOOST,fieldSwardAt as after} from '../assets/field-sward-bands.mjs';
const source=fs.readFileSync(new URL('../assets/field-sward-bands.mjs',import.meta.url),'utf8'),parent=fs.readFileSync(new URL('./fixtures/commons-landscape-2fbab/field-sward-bands.mjs',import.meta.url),'utf8'),edit=JSON.parse(fs.readFileSync(new URL('./fixtures/commons-landscape-2fbab/integration-edit.json',import.meta.url),'utf8')),newBands=bands.slice(oldBands.length),within=(x,z,b)=>x>b.minX&&x<b.maxX&&z>b.minZ&&z<b.maxZ;
let coverage;
test('exact single data insertion retains original seven bands and every function/threshold byte',()=>{
 assert.equal(createHash('sha256').update(parent).digest('hex'),edit.parentSHA256);assert.equal(parent.split(edit.before).length-1,1);assert.equal(parent.replace(edit.before,edit.after),source);assert.equal(bands.length,9);assert.deepEqual(bands.slice(0,7),oldBands);assert.equal(FIELD_SWARD_RECOVERY,oldRecovery);assert.equal(FIELD_SWARD_HEIGHT_BOOST,oldBoost);assert.equal(FIELD_SWARD_RECOVERY,.92);assert.equal(FIELD_SWARD_HEIGHT_BOOST,.22);
 for(const b of newBands){assert(Object.isFrozen(b)&&Object.isFrozen(b.nodes)&&Object.isFrozen(b.segments)&&Object.isFrozen(b.bounds));assert(b.length>34&&b.length<35);for(const node of b.nodes){assert(Object.isFrozen(node));assert(node[2]>=2&&node[2]<=3);assert(node[3]>=.6&&node[3]<=.95);}}
});
test('visible planted flank runs receive substantive connected banks and the entire 4.7m grazing corridor stays zero',()=>{
 const visible=[[[45,248],[48,245],[55,241]],[[70,238],[69,233],[68,228]]];
 for(const run of visible)for(let k=1;k<run.length;k++)for(let i=0;i<=200;i++){const t=i/200,a=run[k-1],b=run[k],x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,f=after(x,z);assert(f.cover>.97,'Strong connected centreline '+x+','+z);assert(f.seed>.79,'Ripening bank '+x+','+z);}
 const length=Math.hypot(31,27),nx=27/length,nz=-31/length;let tested=0;
 for(let i=0;i<=1000;i++){const t=i/1000,x=74-31*t,z=249-27*t;for(let j=0;j<=40;j++){const off=-2.35+j*4.7/40;assert.deepEqual(after(x+nx*off,z+nz*off),{cover:0,seed:0});tested++;}}
 assert.equal(tested,41041);
});
test('all world samples outside the two new recorded supports remain exactly equal to the original sampler without RNG',()=>{
 const previous=Math.random;Math.random=()=>{throw Error('Sward sampling consumed ambient RNG');};let tested=0,changed=0,area=0,strong=0,seeded=0;try{
  for(let x=-500;x<=500;x++)for(let z=-500;z<=500;z++){const a=before(x,z),b=after(x,z),inside=newBands.some(n=>within(x,z,n.bounds));if(!inside){assert.equal(b.cover,a.cover);assert.equal(b.seed,a.seed);tested++;}else if(a.cover!==b.cover||a.seed!==b.seed)changed++;}
  for(let x=30;x<=88;x+=.25)for(let z=215;z<=262;z+=.25){const a=before(x,z),b=after(x,z);if(b.cover>a.cover+.01)area+=.0625;if(b.cover>.6&&b.cover>a.cover+.01)strong+=.0625;if(b.seed>.5&&b.cover>a.cover+.01)seeded+=.0625;}
 }finally{Math.random=previous;}
 assert(tested>999000);assert(changed>250);assert(area>200&&strong>100&&seeded>85);coverage={outsideSamplesExact:tested,changedMetreGridSamples:changed,additionalVisibleSupportAreaM2:area,additionalStrongCoverAreaM2:strong,additionalRipenedSeedAreaM2:seeded,corridorWidth:4.7,corridorSamples:41041};console.log(JSON.stringify(coverage));
});
test('module adoption and data construction do not consume ambient random stream',async()=>{
 const previous=Math.random;Math.random=()=>{throw Error('Module construction consumed RNG');};try{const candidate=await import('../assets/field-sward-bands.mjs?identity-audit=1');assert.deepEqual(candidate.FIELD_SWARD_BANDS,bands);assert.equal(candidate.fieldSwardAt(48,245).cover,1);}finally{Math.random=previous;}
});

// The new banks have narrower authored edges than the seven historical ribbons.
// Check the actual composed production tussock response at both spatial scales;
// a height discontinuity would not shrink tenfold from centimetres to millimetres.
test('actual new-bank tussock response stays bounded and converges at centimetre and millimetre steps',()=>{
 let checks=0,active=0,maxSlope=0;
 const points=[];
 for(const band of newBands){const b=band.bounds;for(let x=b.minX;x<=b.maxX+.0001;x+=.2)for(let z=b.minZ;z<=b.maxZ+.0001;z+=.2)points.push([x,z]);}
 // Include the measured steepest edge rather than relying on grid phase.
 points.push([75.21,243.81],[68.2,237.2]);
 for(const [x,z]of points){const original=grazedTuftScale(x,z,1.3);assert(Number.isFinite(original)&&original>0&&original<=1);if(after(x,z).cover>0)active++;
  for(const [dx,dz]of [[1,0],[0,1]]){
   const steps=[.01,.001,.0001],deltas=steps.map(h=>grazedTuftScale(x+dx*h,z+dz*h,1.3)-original);
   for(let i=0;i<steps.length;i++){const h=steps[i],slope=Math.abs(deltas[i])/h;assert(slope<.75,'New-bank actual composed response <=.75/m at '+[x,z,dx,dz,h]);maxSlope=Math.max(maxSlope,slope);checks++;}
   // Each tenfold spatial reduction has a tenfold smaller allowed height
   // change: 7.5mm, .75mm, then .075mm. The max-of-segments joins may kink,
   // so a globally C1 derivative is not required for continuous grass height.
  }
 }
 assert(checks>230000&&active>7000,'Dense real new-bank interiors and both boundary axes');
 console.log(JSON.stringify({newBankTuftChecks:checks,activeNewBankSamples:active,maxActualComposedSlope:maxSlope,spatialSteps:[.01,.001,.0001]}));
});
