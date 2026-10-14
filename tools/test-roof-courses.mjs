import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRanchArchitecture} from '../assets/ranch-architecture.js';
import * as T from '../assets/vendor/three/build/three.module.js';
import {setTimberBoxUV,applyTimberGrain} from '../assets/timber-cladding.mjs?v=timber-cladding-1';
import {recordSolidPart,createSolidWorld} from '../assets/solid-collisions.js?v=solid-world-1';
import {dressTimberBox} from '../assets/ranch-timber-joinery.mjs?v=ranch-timber-joinery-2';
import {dressRoofCoverBox,RANCH_ROOF_PHOTO_PROFILES} from '../assets/ranch-roof-courses.mjs?v=ranch-roof-courses-3';
const originalSource=fs.readFileSync(new URL('./fixtures/roof-courses-efded6f/ranch-architecture.js',import.meta.url),'utf8');
assert.equal(crypto.createHash('sha256').update(originalSource).digest('hex'),'998f3397d436700e650c0d3393403651e444db939790f2ac0a0fe0c42311eacb','Complete frozen efded6f architecture body');
const create=source=>new Function('setTimberBoxUV','applyTimberGrain','recordSolidPart','dressTimberBox','dressRoofCoverBox',source.replace(/^import .*;\n/gm,'').replace('export function createRanchArchitecture','function createRanchArchitecture')+'\nreturn createRanchArchitecture;')(setTimberBoxUV,applyTimberGrain,recordSolidPart,dressTimberBox,dressRoofCoverBox);
const beforeFactory=create(originalSource),afterFactory=createRanchArchitecture;
const seeded=fn=>{const old=Math.random;let seed=0x6ac043df,calls=0;Math.random=()=>{calls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};try{const result=fn(),used=calls,future=Array.from({length:32},()=>Math.random());return{result,calls:used,future};}finally{Math.random=old;}};
const geometryStats=g=>{const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,normalSum=new T.Vector3();let smallest=Infinity,uvSmallest=Infinity;
 for(const a of Object.values(g.attributes))assert(Array.from(a.array).every(Number.isFinite));
 for(let i=0;i<g.index.count;i+=3){const ids=[0,1,2].map(k=>g.index.getX(i+k)),v=ids.map(k=>new T.Vector3().fromBufferAttribute(p,k)),cross=v[1].sub(v[0]).cross(v[2].sub(v[0]));
  smallest=Math.min(smallest,cross.length());assert(cross.length()>1e-10,'nondegenerate triangle');normalSum.add(cross);
  for(const id of ids){const q=new T.Vector3().fromBufferAttribute(n,id);assert(Math.abs(q.length()-1)<1e-6);assert(cross.dot(q)>0,'hard authored normal agrees with winding');}
  const u=ids.map(k=>[uv.getX(k),uv.getY(k)]),area=Math.abs((u[1][0]-u[0][0])*(u[2][1]-u[0][1])-(u[2][0]-u[0][0])*(u[1][1]-u[0][1]));uvSmallest=Math.min(uvSmallest,area);assert(area>1e-12,'every physical face has a nondegenerate normal-map tangent basis');
 }
 return{smallest,uvSmallest,closureResidual:normalSum.length()};
};
const uvBox=({width,height,depth,patch,x=0,z=0,turnUV=false})=>{const g=new T.BoxGeometry(width,height,depth),p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv;
 for(let i=0;i<p.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));u.setXY(i,((ny>.5&&turnUV)||nx>.5?p.getZ(i)+z:p.getX(i)+x)/patch,(ny>.5?(turnUV?p.getX(i)+x:p.getZ(i)+z):p.getY(i))/patch);}return g;
};
// Generic helper unit cases include slate; the actual factory below must leave every slate byte unchanged.
const specs=[
 {name:'stable main +Z',width:7.76,height:.12,depth:3.747,patch:1.8,axis:'z',downSlope:1,style:'cedar',z:1.565},
 {name:'stable main -Z',width:7.76,height:.12,depth:3.747,patch:1.8,axis:'z',downSlope:-1,style:'cedar',z:-1.565},
 {name:'cottage main',width:3.88,height:.12,depth:2.66,patch:3,axis:'z',downSlope:1,style:'slate',z:.82},
 {name:'cottage dormer',width:.86,height:.095,depth:1.56,patch:3,axis:'x',downSlope:-1,style:'slate',turnUV:true,x:-.43,z:.42},
 {name:'cottage door hood',width:.79,height:.09,depth:.92,patch:3,axis:'x',downSlope:1,style:'slate',turnUV:true,x:.36,z:1.72},
 {name:'inn left wing',width:8.36,height:.12,depth:3.34,patch:3,axis:'z',downSlope:-1,style:'slate',z:-1.015},
 {name:'inn hall',width:6.96,height:.12,depth:4.65,patch:3,axis:'z',downSlope:1,style:'slate',z:2.09},
 {name:'ventilator cap',width:1.77,height:.065,depth:.50,patch:1.8,axis:'z',downSlope:1,style:'cedar',z:.24},
];

test('original cover identities, RNG, closed envelopes, hard normals, valid UVs and single top coverage',()=>{
 for(const spec of specs){const g=uvBox(spec),uuid=g.uuid,before=g.clone(),bounds=new T.Box3().setFromBufferAttribute(g.attributes.position),old=Math.random;let receipt;
  Math.random=()=>{throw Error('Roof dressing consumed gameplay RNG');};try{receipt=dressRoofCoverBox(T,g,spec);}finally{Math.random=old;}
  assert(receipt,spec.name);assert.equal(g.uuid,uuid);assert.deepEqual(g.boundingBox,bounds);assert(receipt.rows>1);const stats=geometryStats(g);assert(stats.closureResidual<2e-5,`closed oriented surface ${spec.name}: ${stats.closureResidual}`);
  // The unchanged outside face corners retain the same bounds under arbitrary yaw/tilt.
  for(const rotation of [new T.Euler(.63,.61,0),new T.Euler(0,-.4,.71)]){const m=new T.Matrix4().makeRotationFromEuler(rotation),a=before.clone().applyMatrix4(m),b=g.clone().applyMatrix4(m);a.computeBoundingBox();b.computeBoundingBox();assert.deepEqual(b.boundingBox,a.boundingBox);}
  const mesh=new T.Mesh(g,new T.MeshStandardMaterial());mesh.updateMatrixWorld(true);
  for(let ix=0;ix<7;ix++)for(let iz=0;iz<7;iz++){const x=-spec.width*.43+spec.width*.86*(ix+.371)/7,z=-spec.depth*.43+spec.depth*.86*(iz+.263)/7,
   hits=new T.Raycaster(new T.Vector3(x,1,z),new T.Vector3(0,-1,0)).intersectObject(mesh);assert.equal(hits.length,1,'no overlapping or missing upward covering');assert(hits[0].point.y<=spec.height/2+1e-6&&hits[0].point.y>=spec.height/2-receipt.relief-receipt.jointDepth-1e-6);}
  const p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv,fit=receipt.uvProjection;
  for(let i=0;i<p.count;i++)if(n.getY(i)>.1)for(let k=0;k<2;k++){const want=fit[k][0]*p.getX(i)+fit[k][1]*p.getZ(i)+fit[k][2];assert(Math.abs((k?u.getY(i):u.getX(i))-want)<2e-7,'resident texture retains exact affine projection');}
 }
});

test('generic helper course laps retain resident texture seam phase and fine metre scale',()=>{
 for(const spec of specs){const g=uvBox(spec),r=dressRoofCoverBox(T,g,spec),p=g.attributes.position,n=g.attributes.normal,profile=RANCH_ROOF_PHOTO_PROFILES[spec.style];let laps=0;
  for(let i=0;i<p.count;i++)if(Math.abs(n.getY(i))<.01&&Math.abs(p.getX(i))<spec.width/2-.006&&Math.abs(p.getZ(i))<spec.depth/2-.006){
   const v=r.uvProjection[1][0]*p.getX(i)+r.uvProjection[1][1]*p.getZ(i)+r.uvProjection[1][2],pixel=((1-v)%1+1)%1*1024;
   assert(profile.butts.some(y=>Math.min(Math.abs(pixel-y),Math.abs(pixel-y-1024),Math.abs(pixel-y+1024))<.002),'every interior lap matches a resident texture row boundary');laps++;
  }assert(laps>0);
 }
 const bad=uvBox({width:2.6,height:.14,depth:3.5,patch:1.8}),positions=bad.attributes.position;
 assert.equal(dressRoofCoverBox(T,bad,{width:2.6,height:.14,depth:3.5,axis:'x',downSlope:1}),null,'existing cross-slope open-stall UV policy is preserved');assert.equal(bad.attributes.position,positions);
});

const constructors=[['barn',f=>f.buildBarn()],['cottage',f=>f.buildCottage()],['cottage-1',f=>f.buildCottage({variant:1})],['inn',f=>f.buildCoachingInn()],['outbuilding',f=>f.buildOutbuilding()],['village-shop',f=>f.buildOutbuilding({exterior:'village',animatedDoorOpening:{width:2.3,height:2.7}})],['marsh',f=>f.buildMarshHouse()],['townhouse',f=>f.buildTownhouse()],['open-stall',f=>f.buildOpenStall()]];
test('actual factory adopts covers with exact proxies, resources, owners, transforms, bounds, metadata and mounted contacts',()=>{
 const build=factory=>seeded(()=>{const f=factory({THREE:T,loadTextures:false});return constructors.map(([name,make])=>({name,g:make(f)}));});
 const a=build(beforeFactory),b=build(afterFactory);assert.equal(b.calls,a.calls);assert.deepEqual(b.future,a.future);const report=[];
 for(let i=0;i<a.result.length;i++){const {name,g:x}=a.result[i],y=b.result[i].g;
  assert.equal(y.uuid,x.uuid);assert.deepEqual(y.userData.solidParts,x.userData.solidParts);assert.deepEqual(y.position,x.position);assert.deepEqual(y.quaternion.toArray(),x.quaternion.toArray());assert.deepEqual(y.scale,x.scale);assert.deepEqual(new T.Box3().setFromObject(y),new T.Box3().setFromObject(x));
  assert.deepEqual({...y.userData.architecture,triangles:0},{...x.userData.architecture,triangles:0});assert.equal(y.children.length,x.children.length);
  for(let j=0;j<x.children.length;j++){const xm=x.children[j],ym=y.children[j];assert.equal(ym.uuid,xm.uuid);assert.equal(ym.geometry.uuid,xm.geometry.uuid);assert.equal(ym.material.uuid,xm.material.uuid);assert.equal(ym.material.name,xm.material.name);
   if(xm.material.name!=='Ranch | aged cedar shingles'){assert.deepEqual(ym.geometry.index.array,xm.geometry.index.array);for(const attr of Object.keys(xm.geometry.attributes))assert.deepEqual(ym.geometry.attributes[attr].array,xm.geometry.attributes[attr].array);}
  }
  const sa=createSolidWorld({THREE:T}),sb=createSolidWorld({THREE:T});for(const g of[x,y]){g.position.set(76,2,-74);g.rotation.y=.61;g.updateMatrixWorld(true);}sa.register(x);sb.register(y);assert.deepEqual(sb.stats(),sa.stats());
  for(let vx=-7;vx<7;vx+=.91)for(let vz=-5;vz<5;vz+=.83){const w=x.localToWorld(new T.Vector3(vx,0,vz)),pa={x:w.x,z:w.z},pb={...pa},body={radius:.55,bottom:2.38,top:4.65};assert.equal(sb.resolve(pb,body),sa.resolve(pa,body));assert.deepEqual(pb,pa);}
  assert(y.userData.architecture.triangles<=24000,'actual resident building stays within a 24k triangle model budget');
  assert(y.userData.architecture.triangles-x.userData.architecture.triangles<=12000,'roof covering adds at most 12k triangles to a resident model');
  const covers=y.userData.roofCourses??[];if(['barn','outbuilding'].includes(name))assert(covers.length>=2,`${name} genuinely adopts cedar covers`);else assert.equal(covers.length,0,`${name} retains its original surfacing`);assert(covers.every(r=>r.style==='cedar'&&r.scope==='cedar-only'));if(!covers.length)assert.deepEqual(y.userData.architecture,x.userData.architecture);
  report.push({name,before:x.userData.architecture.triangles,after:y.userData.architecture.triangles,draws:y.children.length,covers:covers.length,rows:covers.reduce((s,r)=>s+r.rows,0),joints:covers.reduce((s,r)=>s+r.joints,0)});
 }
 if(process.env.ROOF_COURSES_AUDIT_OUTPUT)fs.writeFileSync(process.env.ROOF_COURSES_AUDIT_OUTPUT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
});
